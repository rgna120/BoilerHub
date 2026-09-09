import { get } from 'node:https';
import { normalizeDueDate } from './academic/planner';
import type { CampusEvent, EventFeed } from './events';

const endpoint = 'https://boilerlink.purdue.edu/api/discovery/event/search';
export function eventRange(start: string | null, end: string | null) {
  const from = normalizeDueDate(start), to = normalizeDueDate(end);
  if (!from || !to || Date.parse(to) <= Date.parse(from) || Date.parse(to) - Date.parse(from) > 45 * 86400000) throw new Error('INVALID_RANGE');
  return { start: from, end: to };
}
export function parseEvent(raw: unknown): CampusEvent | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  if (row.visibility !== 'Public' || row.status !== 'Approved') return null;
  const id = String(row.id || '');
  const start = typeof row.startsOn === 'string' ? normalizeDueDate(row.startsOn) : null;
  const end = typeof row.endsOn === 'string' ? normalizeDueDate(row.endsOn) : null;
  if (!/^\d+$/.test(id) || typeof row.name !== 'string' || !row.name.trim() || !start || !end || Date.parse(end) < Date.parse(start)) return null;
  return { id, title: row.name.trim(), startsAt: start,
    endsAt: Date.parse(end) === Date.parse(start) ? new Date(Date.parse(end) + 1).toISOString() : end,
    location: typeof row.location === 'string' ? row.location.trim() : '',
    organizer: typeof row.organizationName === 'string' ? row.organizationName.trim() : '',
    // Only canonical public links; never render upstream HTML descriptions.
    url: `https://boilerlink.purdue.edu/event/${id}` };
}
function publicJSON(url: URL): Promise<unknown> {
  return new Promise((resolve, reject) => {
    // Explicit IPv4 avoids an unreachable IPv6 route on some local networks.
    // TLS validation stays enabled; no academic cookies or incoming headers are forwarded.
    const request = get(url, { family: 4, headers: { Accept: 'application/json' } }, response => {
      if (response.statusCode !== 200) { response.resume(); reject(new Error('EVENT_FEED_UNAVAILABLE')); return; }
      const chunks: Buffer[] = []; let bytes = 0;
      response.on('data', (chunk: Buffer) => {
        bytes += chunk.length;
        if (bytes > 4_000_000) { response.destroy(new Error('EVENT_FEED_TOO_LARGE')); return; }
        chunks.push(chunk);
      });
      response.on('error', reject);
      response.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { reject(new Error('INVALID_EVENT_FEED')); } });
    });
    const timeout = setTimeout(() => request.destroy(new Error('EVENT_FEED_TIMEOUT')), 10_000);
    request.on('error', reject);
    request.on('close', () => clearTimeout(timeout));
  });
}
export async function fetchEvents(start: string, end: string, request: (url: URL) => Promise<unknown> = publicJSON): Promise<EventFeed> {
  const range = eventRange(start, end), events = new Map<string, CampusEvent>();
  const seen = new Set<string>(); let omitted = 0;
  const deadline = Date.now() + 30_000;
  for (let page = 0; page < 20; page++) {
    if (Date.now() > deadline) throw new Error('EVENT_FEED_TIMEOUT');
    const url = new URL(endpoint);
    url.search = new URLSearchParams({ endsAfter: range.start, startsBefore: range.end,
      orderByField: 'startsOn', orderByDirection: 'ascending', status: 'Approved', take: '100', skip: String(page * 100) }).toString();
    const payload = await request(url) as { value?: unknown[]; '@odata.count'?: number };
    if (!payload || !Array.isArray(payload.value)) throw new Error('INVALID_EVENT_FEED');
    const signature = JSON.stringify(payload.value.map(row => (row as { id?: unknown })?.id));
    if (payload.value.length && seen.has(signature)) throw new Error('EVENT_PAGINATION_STALLED');
    seen.add(signature);
    for (const row of payload.value) {
      const event = parseEvent(row);
      if (!event) { omitted++; continue; }
      if (Date.parse(event.startsAt) < Date.parse(range.end) && Date.parse(event.endsAt) > Date.parse(range.start)) events.set(event.id, event);
    }
    if (payload.value.length < 100 || (typeof payload['@odata.count'] === 'number' && (page + 1) * 100 >= payload['@odata.count'])) {
      return { events: Array.from(events.values()).sort((a, b) => a.startsAt.localeCompare(b.startsAt)), fetchedAt: new Date().toISOString(), truncated: false, omitted };
    }
  }
  return { events: Array.from(events.values()).sort((a, b) => a.startsAt.localeCompare(b.startsAt)), fetchedAt: new Date().toISOString(), truncated: true, omitted };
}
const cache = new Map<string, { until: number; feed: EventFeed }>();
const pending = new Map<string, Promise<EventFeed>>();
export async function cachedEvents(start: string, end: string) {
  const key = `${start}|${end}`;
  const saved = cache.get(key);
  if (saved && saved.until > Date.now()) return saved.feed;
  if (pending.has(key)) return pending.get(key)!;
  if (pending.size >= 3) throw new Error('EVENT_FEED_BUSY');
  const job = fetchEvents(start, end).then(feed => {
    if (cache.size >= 24) cache.delete(cache.keys().next().value!);
    cache.set(key, { until: Date.now() + 300_000, feed });
    return feed;
  }).finally(() => pending.delete(key));
  pending.set(key, job);
  return job;
}
