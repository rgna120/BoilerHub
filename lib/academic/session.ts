import { randomBytes, createHash } from 'node:crypto';
import puppeteer, { type Browser, type Page } from 'puppeteer';
import { AcademicError, readConfig, readLoginConfig } from './config';
import { extractSnapshot } from './extract';
import { dropIndex, indexAssignments, searchAssignments } from './search';
import type { ConnectionView, Provider, Snapshot } from './types';

export const COOKIE_TTL = 30 * 60;
export const cookieName = (provider: Provider) => `boilerhub_${provider}_connection`;
const digest = (token: string) => createHash('sha256').update(token).digest('hex');
type Session = {
  key: string; provider: Provider; expires: number; state: ConnectionView['state'];
  browser?: Browser; page?: Page; config: ReturnType<typeof readLoginConfig>; snapshot?: Snapshot;
  collection: string; searchReady: boolean; message?: string;
};
// In-memory only: a restart requires reconnecting. No credentials or cookies are
// serialized. Global state survives Next development module reloads.
const globalStore = globalThis as typeof globalThis & {
  academicConnections?: Map<string, Session>; academicCleanup?: Set<string>; academicTimer?: NodeJS.Timeout;
};
const sessions = globalStore.academicConnections ||= new Map<string, Session>();
const cleanup = globalStore.academicCleanup ||= new Set<string>();
async function remove(session: Session) {
  sessions.delete(session.key);
  cleanup.add(session.collection);
  try { await session.browser?.close(); } catch { /* It may already be closed. */ }
  try { await dropIndex(session.collection); cleanup.delete(session.collection); } catch { /* Retry below. */ }
}
if (!globalStore.academicTimer) {
  globalStore.academicTimer = setInterval(() => {
    for (const session of Array.from(sessions.values())) if (session.expires <= Date.now()) void remove(session);
    for (const name of Array.from(cleanup)) void dropIndex(name).then(() => cleanup.delete(name)).catch(() => {});
  }, 30_000);
  globalStore.academicTimer.unref();
}
function find(token: string | undefined, provider: Provider) {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) throw new AcademicError('CONNECTION_REQUIRED', 401);
  const session = sessions.get(digest(token));
  if (!session || session.provider !== provider) throw new AcademicError('CONNECTION_REQUIRED', 401);
  if (session.expires <= Date.now()) { void remove(session); throw new AcademicError('CONNECTION_EXPIRED', 401); }
  return session;
}
function alive(session: Session) {
  if (!sessions.has(session.key) || session.expires <= Date.now()) throw new AcademicError('CONNECTION_EXPIRED', 401);
}
function view(session: Session): ConnectionView {
  return { available: true, state: session.state, expiresAt: new Date(session.expires).toISOString(),
    snapshot: session.snapshot, searchReady: session.searchReady, message: session.message };
}
export function status(token: string | undefined, provider: Provider): ConnectionView {
  if (!token) return { available: true, state: 'disconnected' };
  try { return view(find(token, provider)); }
  catch { return { available: true, state: 'disconnected' }; }
}
export async function connect(token: string | undefined, provider: Provider) {
  const config = readLoginConfig(provider); // Login does not require scraping selectors.
  if (token) {
    const previous = sessions.get(digest(token));
    if (previous?.provider === provider) await remove(previous);
  }
  if (sessions.size >= 4) throw new AcademicError('TOO_MANY_CONNECTIONS', 429);
  const nextToken = randomBytes(32).toString('hex');
  const session: Session = { key: digest(nextToken), provider, expires: Date.now() + COOKIE_TTL * 1000,
    state: 'opening', config, collection: `academic_${randomBytes(16).toString('hex')}`, searchReady: false };
  sessions.set(session.key, session);
  try {
    // Opens on the local server computer. Never expose a debugging/WebSocket URL.
    session.browser = await puppeteer.launch({ headless: false, timeout: 30_000,
      // Use installed Chrome when configured, keeping a fresh isolated context.
      channel: process.env.ACADEMIC_BROWSER_CHANNEL === 'chrome' ? 'chrome' : undefined });
    const context = await session.browser.createBrowserContext();
    session.page = await context.newPage();
    session.page.setDefaultTimeout(15_000);
    session.page.setDefaultNavigationTimeout(30_000);
    await session.page.goto(config.loginUrl, { waitUntil: 'domcontentloaded' });
    session.state = 'awaiting_login';
    session.message = 'Complete login and MFA in the opened browser, then select “I’ve signed in”.';
    return { token: nextToken, view: view(session) };
  } catch {
    await remove(session);
    throw new AcademicError('BROWSER_START_FAILED', 502);
  }
}
export async function disconnect(token: string | undefined, provider: Provider) {
  if (!token) return;
  const session = sessions.get(digest(token));
  if (session?.provider === provider) await remove(session);
}
export async function refresh(token: string | undefined, provider: Provider) {
  const session = find(token, provider);
  if (session.state === 'syncing' || session.state === 'opening') throw new AcademicError('SYNC_BUSY', 409);
  if (!session.page || !session.browser?.connected || session.page.isClosed()) throw new AcademicError('RECONNECT_REQUIRED', 401);
  // Validate extraction settings only when syncing, preserving the open login
  // browser if setup is incomplete. Reload settings so a reconnect isn't needed.
  const config = readConfig(provider);
  session.state = 'syncing';
  session.message = undefined;
  // A bounded sync closes the browser to interrupt outstanding navigation/evaluation.
  let timedOut = false;
  const timeout = setTimeout(() => { timedOut = true; void session.browser?.close().catch(() => {}); }, 120_000);
  timeout.unref();
  try {
    // Require both the expected origin and an authenticated dashboard marker.
    // The marker must not exist on a login page (even one on the same origin).
    if (new URL(session.page.url()).origin !== new URL(config.dashboardUrl).origin) throw new AcademicError('LOGIN_INCOMPLETE', 401);
    const snapshot = await extractSnapshot(session.page, config);
    alive(session);
    session.snapshot = snapshot; // Publish only a complete extraction.
    session.searchReady = false;
    try {
      session.searchReady = snapshot.coverage.assignments && await indexAssignments(session.collection, snapshot.assignments);
      if (!session.searchReady) session.message = snapshot.coverage.assignments ? 'Synced. Typesense search is not configured.' : 'Courses synced. Assignment extraction is not configured yet.';
    } catch { session.message = 'Synced, but search indexing failed. Sync again to retry.'; }
    alive(session);
    session.state = 'connected';
    return view(session);
  } catch (error) {
    session.state = 'awaiting_login';
    session.searchReady = false;
    session.message = 'Sync did not complete. Previous results, if any, have not been updated.';
    if (timedOut) throw new AcademicError('SYNC_TIMED_OUT', 504);
    if (error instanceof AcademicError) throw error;
    throw new AcademicError('CHECK_LOGIN_AND_SELECTORS', 502);
  } finally {
    clearTimeout(timeout);
    // A disconnect during indexing must not leave a newly recreated collection.
    if (!sessions.has(session.key)) { cleanup.add(session.collection); void dropIndex(session.collection).then(() => cleanup.delete(session.collection)).catch(() => {}); }
  }
}
export async function search(token: string | undefined, provider: Provider, query: string) {
  const session = find(token, provider);
  if (session.state !== 'connected' || !session.searchReady) throw new AcademicError('SEARCH_NOT_READY', 409);
  const result = await searchAssignments(session.collection, query);
  alive(session);
  return result;
}
