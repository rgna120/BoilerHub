'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { ExternalLink, Loader2, LockKeyhole } from 'lucide-react';
import AssignmentPlanner from './AssignmentPlanner';
import CourseGradebook from './CourseGradebook';
import type { Assignment, ConnectionView, Provider } from '@/lib/academic/types';

const messages: Record<string, string> = {
  FORBIDDEN: 'Open BoilerHub at http://127.0.0.1:3000 and try again. The connection must come from the configured local address.',
  LOCAL_MODE_REQUIRED: 'Stop the current server and run npm run dev:academic, then open http://127.0.0.1:3000 to enable browser connections.',
  CONFIGURATION_REQUIRED: 'This service needs its connection configuration checked.',
  SYNC_CONFIGURATION_REQUIRED: 'Your login browser can stay open. Importing data still needs the dashboard URL and page selectors configured in .env.local; see docs/academic-connections.md.',
  INVALID_CONFIGURATION: 'The connection configuration needs to be corrected.',
  BROWSER_START_FAILED: 'The login browser could not open. Check that Chromium is installed on the computer running BoilerHub.',
  LOGIN_INCOMPLETE: 'Finish login and MFA in the service browser, then try again.',
  RECONNECT_REQUIRED: 'The browser session has ended. Connect again to sign in.',
  CONNECTION_EXPIRED: 'Your connection expired. Connect again to sign in.',
  CONNECTION_REQUIRED: 'Connect to this service first.',
  CHECK_LOGIN_AND_SELECTORS: 'Could not read the course pages. Check that login is complete and the configured selectors match the service.',
  SYNC_TIMED_OUT: 'Sync took too long. Reconnect and try again.',
  SEARCH_NOT_READY: 'Search is not ready. Complete a sync with Typesense configured first.',
  COURSE_LIST_INCOMPLETE: 'The course list has not fully loaded. Open the full course list in the service browser and try syncing again.',
  SYNC_BUSY: 'A sync is already running. Wait for it to finish.',
};
async function request(path: string, provider: Provider, method = 'GET', query = '') {
  const response = await fetch(`/api/academic/${path}?provider=${provider}${query}`, { method, cache: 'no-store', credentials: 'same-origin' });
  const result = await response.json();
  if (!response.ok) throw new Error(messages[result.error] || 'The request failed. Check your connection setup and try again.');
  return result;
}
function AssignmentRows({ rows }: { rows: Assignment[] }) {
  return <ul className="mt-3 divide-y divide-black/10">{rows.map(row => <li key={row.id} className="py-3">
    <a className="font-semibold underline decoration-black/20 underline-offset-4" href={row.url} target="_blank" rel="noreferrer">{row.title} <ExternalLink className="inline" size={13} /></a>
    <p className="mt-1 text-sm text-black/60">{row.courseName} · {row.due || 'No due date posted'}</p>
  </li>)}</ul>;
}
function Connection({ provider, onView }: { provider: Provider; onView: (provider: Provider, view: ConnectionView) => void }) {
  const name = provider === 'brightspace' ? 'Brightspace' : 'Gradescope';
  const [view, setView] = useState<ConnectionView>({ available: false, state: 'disconnected' });
  const [busy, setBusy] = useState(true);
  const [notice, setNotice] = useState('Checking connection…');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ found: number; assignments: Assignment[] } | null>(null);
  const version = useRef(0);
  useEffect(() => { onView(provider, view); }, [onView, provider, view]);
  useEffect(() => {
    let mounted = true;
    request('connection', provider).then(result => { if (mounted) { setView(result); setNotice(result.message || 'Sign in directly in the browser that opens.'); } })
      .catch(error => { if (mounted) setNotice(error.message); }).finally(() => { if (mounted) setBusy(false); });
    return () => { mounted = false; };
  }, [provider]);
  // Expiry polling also notices disconnects made in another app tab. Never polls
  // Brightspace/Gradescope; only checks the local connection registry.
  useEffect(() => {
    if (view.state === 'disconnected' || busy) return;
    const timer = setInterval(() => {
      const current = version.current;
      request('connection', provider).then(result => {
        if (current !== version.current) return;
        setView(result);
        if (result.state === 'disconnected') { setResults(null); setNotice('Connection ended. Sign in again to refresh your data.'); }
      }).catch(() => {});
    }, 15_000);
    return () => clearInterval(timer);
  }, [provider, view.state, busy]);
  async function action(path: string, method = 'POST') {
    version.current++;
    setBusy(true); setResults(null);
    setNotice(path === 'refresh' ? 'Reading your courses, assignments, and grades…' : method === 'DELETE' ? 'Disconnecting…' : `Opening ${name} for login…`);
    try {
      const result = await request(path, provider, method);
      setView(result);
      setNotice(result.message || (method === 'DELETE' ? 'Disconnected. Local session data has been cleared.' : 'Sync complete.'));
    } catch (error) {
      setNotice((error as Error).message);
      // Clear any expired snapshot and reflect server-side failure state.
      try { setView(await request('connection', provider)); } catch { /* Keep the error notice. */ }
    } finally { setBusy(false); }
  }
  async function search(event: FormEvent) {
    event.preventDefault(); setBusy(true); version.current++;
    try { setResults(await request('search', provider, 'GET', `&q=${encodeURIComponent(query)}`)); setNotice('Search complete.'); }
    catch (error) { setResults(null); setNotice((error as Error).message); }
    finally { setBusy(false); }
  }
  const connected = view.state !== 'disconnected';
  return <section className="rounded-2xl border border-black/10 bg-white/70 p-6" aria-labelledby={`${provider}-heading`}>
    <div className="flex items-center justify-between gap-3"><h3 id={`${provider}-heading`} className="font-display text-xl font-bold">{name}</h3><LockKeyhole size={19} className="text-[#8b6b25]" /></div>
    <p className="mt-2 text-sm text-black/60">Enter your password and complete MFA directly in {name}. BoilerHub does not ask for them.</p>
    <div className="mt-4 flex flex-wrap gap-3">
      <button disabled={busy || !view.available} onClick={() => action('connection')} className="rounded-lg bg-[#202c28] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{connected ? `Reconnect ${name}` : `Connect ${name}`}</button>
      {connected && <><button disabled={busy} onClick={() => action('refresh')} className="rounded-lg bg-[#d9b657] px-4 py-2 text-sm font-semibold disabled:opacity-50">{view.state === 'connected' ? 'Refresh data' : 'I’ve signed in — sync'}</button>
        <button disabled={busy} onClick={() => action('connection', 'DELETE')} className="px-2 py-2 text-sm underline disabled:opacity-50">Disconnect</button></>}
    </div>
    <p role="status" aria-live="polite" className="mt-3 text-sm text-black/70">{busy && <Loader2 size={14} className="mr-2 inline animate-spin" />}{notice}</p>
    {view.expiresAt && <p className="mt-1 text-xs text-black/50">Connection expires at {new Date(view.expiresAt).toLocaleTimeString()}.</p>}
    {view.snapshot && <div className="mt-6 border-t border-black/10 pt-4">
      <p className="text-xs text-black/50">Last successful sync: {new Date(view.snapshot.syncedAt).toLocaleString()}</p>
      {provider === 'brightspace' ? <CourseGradebook key={view.expiresAt} snapshot={view.snapshot} /> : <>
      <h4 className="mt-4 font-bold">Courses ({view.snapshot.courses.length})</h4>
      {view.snapshot.courses.length ? <ul className="mt-2 space-y-2">{view.snapshot.courses.map(course => <li key={course.id}><a className="text-sm underline" href={course.url} target="_blank" rel="noreferrer">{course.name}</a></li>)}</ul> : <p className="mt-2 text-sm">No courses in the configured course list.</p>}
      <h4 className="mt-5 font-bold">Assignments ({view.snapshot.assignments.length})</h4>
      {!view.snapshot.coverage.assignments ? <p className="mt-2 text-sm text-black/60">Assignment extraction is not configured for {name} yet.</p> : <>
        <form onSubmit={search} className="mt-3 flex flex-wrap gap-2"><label className="sr-only" htmlFor={`${provider}-search`}>Search {name} assignments</label>
          <input id={`${provider}-search`} maxLength={200} value={query} onChange={event => setQuery(event.target.value)} placeholder="Search assignments or courses" className="min-w-0 flex-1 rounded-lg border border-black/20 bg-white px-3 py-2 text-sm" />
          <button disabled={busy || !view.searchReady} className="rounded-lg bg-[#202c28] px-3 py-2 text-sm text-white disabled:opacity-50">Search</button>
          {results && <button type="button" onClick={() => setResults(null)} className="text-sm underline">Clear search</button>}
        </form>
        {!view.searchReady && <p className="mt-2 text-xs text-black/50">Typesense search is unavailable. Your synced assignments are shown below.</p>}
        {results && <p className="mt-2 text-xs text-black/60">{results.found} matches · showing up to 50</p>}
        <AssignmentRows rows={results ? results.assignments : view.snapshot.assignments} />
        {(results ? results.assignments : view.snapshot.assignments).length === 0 && <p className="mt-3 text-sm">No assignments found.</p>}
      </>}
      <h4 className="mt-5 font-bold">Grades ({view.snapshot.grades.length})</h4>
      {!view.snapshot.coverage.grades ? <p className="mt-2 text-sm text-black/60">Grade extraction is not configured for {name} yet.</p> : view.snapshot.grades.length ?
        <ul className="mt-2 divide-y divide-black/10">{view.snapshot.grades.map(grade => <li key={grade.id} className="flex justify-between gap-4 py-3 text-sm"><span>{grade.title}<span className="block text-xs text-black/50">{grade.courseName}</span></span><strong>{grade.value}</strong></li>)}</ul> : <p className="mt-2 text-sm">No grades found.</p>}
      </>}
    </div>}
  </section>;
}
export default function AcademicConnections() {
  const [sources, setSources] = useState<Partial<Record<Provider, ConnectionView>>>({});
  const onView = useCallback((provider: Provider, view: ConnectionView) => {
    setSources(previous => ({ ...previous, [provider]: view }));
  }, []);
  return <section id="academic-connections" className="mt-12" aria-labelledby="academic-heading">
    <AssignmentPlanner sources={sources} />
    <h2 id="academic-heading" className="font-display text-2xl font-bold">Your academic connections</h2>
    <p className="mb-5 mt-2 text-sm text-black/60">Local prototype: login windows open on the computer running BoilerHub. Keep them open while connected. Your tracker updates after each successful sync.</p>
    <div className="space-y-5"><Connection provider="brightspace" onView={onView} /><Connection provider="gradescope" onView={onView} /></div>
  </section>;
}
