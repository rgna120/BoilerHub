import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eventRange, fetchEvents, parseEvent } from '../lib/boilerlink';
import { eventOccursOnDay } from '../lib/events';
const raw = (id = '1') => ({ id, name: 'Campus meetup', startsOn: '2026-09-08T23:00:00-04:00', endsOn: '2026-09-09T01:00:00-04:00', location: 'WALC', organizationName: 'Student club', visibility: 'Public', status: 'Approved' });
test('only public approved events with valid timestamps become canonical listings', () => {
  const event = parseEvent(raw())!;
  assert.equal(event.url, 'https://boilerlink.purdue.edu/event/1');
  assert.equal(event.startsAt, '2026-09-09T03:00:00.000Z');
  assert.equal(parseEvent({ ...raw(), visibility: 'Organization' }), null);
  assert.equal(parseEvent({ ...raw(), status: 'Cancelled' }), null);
  assert.equal(parseEvent({ ...raw(), startsOn: 'Tuesday at 7 PM' }), null);
  assert.equal(parseEvent({ ...raw(), id: '../evil' }), null);
});
test('calendar range is bounded and multi-day events use an exclusive end', () => {
  assert.throws(() => eventRange(null, '2026-10-01T00:00:00Z'));
  assert.throws(() => eventRange('2026-09-01T00:00:00Z', '2027-01-01T00:00:00Z'));
  const first = new Date(2026, 8, 8), midnight = new Date(2026, 8, 9);
  const event = { ...parseEvent(raw())!, startsAt: new Date(2026, 8, 8, 23).toISOString(), endsAt: midnight.toISOString() };
  assert.ok(eventOccursOnDay(event, first));
  assert.equal(eventOccursOnDay(event, midnight), false);
  assert.ok(eventOccursOnDay({ ...event, endsAt: new Date(2026, 8, 9, 1).toISOString() }, midnight));
});
test('feed follows pagination, enforces range, and ignores private listings', async () => {
  const pages: URL[] = [];
  const feed = await fetchEvents('2026-09-01T00:00:00Z', '2026-10-01T00:00:00Z', async url => {
    pages.push(url);
    return pages.length === 1 ? { '@odata.count': 102, value: Array.from({ length: 100 }, (_, i) => raw(String(i + 1))) }
      : { '@odata.count': 102, value: [{ ...raw('101'), visibility: 'Organization' }, { ...raw('102'), startsOn: '2027-01-01T00:00:00Z', endsOn: '2027-01-01T01:00:00Z' }] };
  });
  assert.equal(pages.length, 2); assert.equal(pages[1].searchParams.get('skip'), '100');
  assert.equal(pages[0].searchParams.get('startsBefore'), '2026-10-01T00:00:00.000Z');
  assert.equal(feed.events.length, 100); assert.equal(feed.omitted, 1); assert.equal(feed.truncated, false);
});
test('feed failures and stalled pagination are not reported as empty success', async () => {
  await assert.rejects(fetchEvents('2026-09-01T00:00:00Z', '2026-10-01T00:00:00Z', async () => ({ nope: [] })), /INVALID_EVENT_FEED/);
  await assert.rejects(fetchEvents('2026-09-01T00:00:00Z', '2026-10-01T00:00:00Z', async () => ({ '@odata.count': 500, value: Array.from({ length: 100 }, (_, i) => raw(String(i))) })), /EVENT_PAGINATION_STALLED/);
});
