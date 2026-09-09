'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, ExternalLink, ListTodo } from 'lucide-react';
import type { ConnectionView, Provider } from '@/lib/academic/types';
import { bucketFor, compareTasks, dayKey, monthDays, normalizeDueDate, type Bucket, type Task } from '@/lib/academic/planner';

import { useCampusEvents } from './useCampusEvents';
import CampusEventList from './CampusEventList';
import { eventOccursOnDay } from '@/lib/events';

const storageKey = 'boilerhub:task-checks:v1';
const buckets: Bucket[] = ['Overdue', 'Today', 'Next 7 days', 'Later', 'Check due date'];
const providerName = (provider: Provider) => provider === 'brightspace' ? 'Brightspace' : 'Gradescope';
export default function AssignmentPlanner({ sources }: { sources: Partial<Record<Provider, ConnectionView>> }) {
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [now, setNow] = useState<Date | null>(null);
  const [month, setMonth] = useState<Date | null>(null);
  const [selected, setSelected] = useState('');
  const [mode, setMode] = useState<'list' | 'calendar'>('list');
  const [showDone, setShowDone] = useState(false);
  const [course, setCourse] = useState('all');
  const [storageNotice, setStorageNotice] = useState('');
  const [showEvents, setShowEvents] = useState(true);
  const campus = useCampusEvents(month, mode === 'calendar' && showEvents);
  const events = showEvents ? campus.feed?.events || [] : [];
  const selectedEvents = selected ? events.filter(event => eventOccursOnDay(event, new Date(`${selected}T12:00:00`))) : [];
  useEffect(() => {
    const date = new Date(); setNow(date); setMonth(new Date(date.getFullYear(), date.getMonth(), 1)); setSelected(dayKey(date));
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey) || '{}');
      if (saved && typeof saved === 'object' && !Array.isArray(saved)) setChecks(Object.fromEntries(Object.entries(saved).filter(([, value]) => value === true).map(([key]) => [key, true])));
    } catch { setStorageNotice('Task checkmarks are available for this page visit only.'); }
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);
  const tasks = useMemo(() => (Object.entries(sources) as [Provider, ConnectionView][]).flatMap(([provider, view]) =>
    (view.snapshot?.assignments || []).map(assignment => {
      // New connections get separate checkmarks, so another student's login on
      // this browser cannot inherit the previous student's completion state.
      const key = `${provider}:${view.expiresAt}:${assignment.id}`;
      return { ...assignment, provider, key, completed: !!assignment.submitted || !!checks[key] };
    })).sort(compareTasks), [sources, checks]);
  const courses = Array.from(new Map(tasks.map(task => [`${task.provider}:${task.courseId}`, task.courseName])).entries());
  const filtered = tasks.filter(task => (course === 'all' || `${task.provider}:${task.courseId}` === course) && task.completed === showDone);
  const open = tasks.filter(task => !task.completed);
  const snapshots = Object.values(sources).filter(view => !!view?.snapshot);
  function toggle(task: Task) {
    if (task.submitted) return;
    const next = { ...checks };
    if (next[task.key]) delete next[task.key]; else next[task.key] = true;
    setChecks(next);
    try { sessionStorage.setItem(storageKey, JSON.stringify(next)); }
    catch { setStorageNotice('Task checkmarks are available for this page visit only.'); }
  }
  function rows(items: Task[]) {
    return <ul className="divide-y divide-black/10">{items.map(task => <li key={task.key} className="flex gap-3 py-4">
      <input type="checkbox" className="mt-1 h-5 w-5 shrink-0 accent-[#202c28]" checked={task.completed} disabled={task.submitted}
        onChange={() => toggle(task)} aria-label={`${task.completed ? 'Mark incomplete' : 'Mark complete'}: ${task.title}`} />
      <div className="min-w-0 flex-1"><a href={task.url} target="_blank" rel="noreferrer" className={`font-semibold underline-offset-4 hover:underline ${task.completed ? 'text-black/50 line-through' : ''}`}>{task.title} <ExternalLink size={12} className="inline" /></a>
        <p className="mt-1 break-words text-xs text-black/55">{task.courseName} · {providerName(task.provider)}</p>
        <p className={`mt-1 text-sm ${now && !task.completed && bucketFor(task, now) === 'Overdue' ? 'text-red-700' : 'text-black/65'}`}>
          {normalizeDueDate(task.dueAt) ? new Date(task.dueAt!).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : task.due || 'No due date posted'}
          {task.submitted && ' · Submitted'}
        </p>
      </div>
    </li>)}</ul>;
  }
  return <section className="mb-8 rounded-2xl border border-black/10 bg-white/80 p-5 sm:p-6" aria-labelledby="planner-heading">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="eyebrow">Your next steps</p><h2 id="planner-heading" className="font-display mt-2 text-2xl font-bold">Calendar & to-do</h2></div>
      <div className="flex rounded-lg bg-black/5 p-1" aria-label="Tracker view">{(['list', 'calendar'] as const).map(value => <button key={value} type="button" aria-pressed={mode === value} onClick={() => setMode(value)} className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${mode === value ? 'bg-white shadow-sm' : ''}`}>{value === 'list' ? <ListTodo size={15} /> : <CalendarDays size={15} />}{value === 'list' ? 'To-do' : 'Calendar'}</button>)}</div>
    </div>
    <p className="mt-3 text-sm text-black/60">Plan your assignments and explore campus events from BoilerLink. Checking off a task does not submit your work.</p>
    <>
      {mode === 'list' && !tasks.length && <p className="mt-6 rounded-xl bg-[#f5f2eb] p-5 text-sm">{!snapshots.length ? 'Sync your accounts below to see upcoming assignments, or open Calendar to explore campus events.' : 'No assignments imported yet. You can still explore campus events in Calendar.'}</p>}
      <div className="my-5 grid grid-cols-3 gap-2 text-center"><div className="rounded-xl bg-[#f5f2eb] p-3"><strong className="block text-2xl">{open.length}</strong><span className="text-xs text-black/60">to do</span></div><div className="rounded-xl bg-red-50 p-3"><strong className="block text-2xl text-red-700">{now ? open.filter(task => bucketFor(task, now) === 'Overdue').length : '—'}</strong><span className="text-xs text-black/60">overdue</span></div><div className="rounded-xl bg-[#e8d9b9] p-3"><strong className="block text-2xl">{now ? open.filter(task => ['Today', 'Next 7 days'].includes(bucketFor(task, now))).length : '—'}</strong><span className="text-xs text-black/60">due within 7 days</span></div></div>
      <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex gap-2">{[false, true].map(done => <button key={String(done)} onClick={() => setShowDone(done)} aria-pressed={showDone === done} className={`rounded-full px-3 py-2 text-sm ${showDone === done ? 'bg-[#202c28] text-white' : 'bg-black/5'}`}>{done ? 'Completed' : 'To do'}</button>)}</div>
        <label className="text-sm"><span className="sr-only">Filter by course</span><select value={course} onChange={event => setCourse(event.target.value)} className="max-w-full rounded-lg border border-black/15 bg-white px-2 py-2"><option value="all">All courses</option>{courses.map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label>
      </div>
      {mode === 'list' && now && (showDone ? rows(filtered) : buckets.map(bucket => {
        const items = filtered.filter(task => bucketFor(task, now) === bucket);
        return items.length ? <div key={bucket} className="mt-5"><h3 className={`text-sm font-bold ${bucket === 'Overdue' ? 'text-red-700' : 'text-[#8b6b25]'}`}>{bucket} ({items.length})</h3>{bucket === 'Check due date' && <p className="mt-1 text-xs text-black/55">Refresh your sync for exact timestamps, or check the assignment page.</p>}{rows(items)}</div> : null;
      }))}
      {mode === 'calendar' && month && now && <div className="mt-5">
        <div className="mb-4 rounded-xl bg-sky-50/70 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2"><label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={showEvents} onChange={event => setShowEvents(event.target.checked)} className="accent-sky-700" />Show BoilerLink events</label><a className="text-xs text-sky-800 underline" href="https://boilerlink.purdue.edu/events" target="_blank" rel="noreferrer">Browse BoilerLink</a></div>
          {showEvents && <p role="status" className="mt-2 text-xs text-black/60">{campus.loading ? 'Loading campus events…' : campus.error || (campus.feed ? `${events.length} public events overlap this calendar. Updated ${new Date(campus.feed.fetchedAt).toLocaleTimeString()}.` : 'Campus events will appear here.')}</p>}
          {showEvents && campus.error && <button onClick={campus.refresh} className="mt-2 text-xs text-sky-800 underline">Retry events</button>}
          {showEvents && (campus.feed?.truncated || !!campus.feed?.omitted) && <p className="mt-2 text-xs text-amber-800">Some listings could not be included. Check BoilerLink for the full event list.</p>}
        </div>
        <div className="mb-3 flex gap-4 text-xs text-black/60"><span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-[#c69214]" />Assignments</span>{showEvents && <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-sky-600" />Campus events</span>}</div>
        <div className="mb-3 flex items-center justify-between"><button aria-label="Previous month" className="rounded-lg p-2 hover:bg-black/5" onClick={() => { const next = new Date(month.getFullYear(), month.getMonth() - 1, 1); setMonth(next); setSelected(dayKey(next)); }}><ChevronLeft size={19} /></button><h3 className="font-bold">{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h3><button aria-label="Next month" className="rounded-lg p-2 hover:bg-black/5" onClick={() => { const next = new Date(month.getFullYear(), month.getMonth() + 1, 1); setMonth(next); setSelected(dayKey(next)); }}><ChevronRight size={19} /></button></div>
        <div className="grid grid-cols-7 text-center text-xs text-black/50">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => <span key={day} className="py-2">{day}</span>)}</div>
        <div className="grid grid-cols-7 gap-1">{monthDays(month).map(date => {
          const key = dayKey(date), count = filtered.filter(task => task.dueAt && dayKey(new Date(task.dueAt)) === key).length;
          const eventCount = events.filter(event => eventOccursOnDay(event, date)).length;
          return <button key={key} onClick={() => setSelected(key)} aria-pressed={selected === key} aria-label={`${date.toLocaleDateString(undefined, { dateStyle: 'full' })}, ${count} assignments, ${eventCount} campus events`} className={`flex min-h-14 flex-col items-center rounded-lg py-2 text-sm ${selected === key ? 'bg-[#202c28] text-white' : dayKey(now) === key ? 'bg-[#e8d9b9]' : 'hover:bg-black/5'} ${date.getMonth() !== month.getMonth() ? 'opacity-40' : ''}`}><span>{date.getDate()}</span>{count > 0 && <span className={`mt-1 rounded-full px-1.5 text-[10px] ${selected === key ? 'bg-white/20' : 'bg-[#d9b657]/40'}`}>{count}</span>}{eventCount > 0 && <span className={`mt-1 rounded-full px-1.5 text-[10px] ${selected === key ? 'bg-sky-400/30 text-sky-100' : 'bg-sky-100 text-sky-800'}`}>{eventCount}</span>}</button>;
        })}</div>
        <div className="mt-3 flex justify-between text-xs text-black/60"><button className="underline" onClick={() => { setMonth(new Date(now.getFullYear(), now.getMonth(), 1)); setSelected(dayKey(now)); }}>Today</button><span>Times in {Intl.DateTimeFormat().resolvedOptions().timeZone}</span></div>
        <h3 className="mt-5 font-bold">{new Date(`${selected}T12:00:00`).toLocaleDateString(undefined, { dateStyle: 'full' })}</h3>
        <h4 className="mt-4 text-sm font-semibold">Assignments</h4>
        {rows(filtered.filter(task => task.dueAt && dayKey(new Date(task.dueAt)) === selected))}
        {showEvents && <div className="mt-5"><h4 className="text-sm font-semibold text-sky-900">Campus events ({selectedEvents.length})</h4><CampusEventList events={selectedEvents} />{!selectedEvents.length && !campus.loading && !campus.error && <p className="mt-2 text-sm text-black/55">No public events listed for this day.</p>}</div>}
        {!filtered.some(task => task.dueAt && dayKey(new Date(task.dueAt)) === selected) && <p className="mt-3 text-sm text-black/55">No {showDone ? 'completed assignments' : 'tasks due'} on this day.</p>}
        {filtered.some(task => !normalizeDueDate(task.dueAt)) && <p className="mt-4 text-xs text-black/55">Assignments without exact dates are in the to-do list under “Check due date”.</p>}
      </div>}
      {mode === 'list' && filtered.length === 0 && <p className="mt-5 text-sm text-black/55">{showDone ? 'No completed tasks yet.' : 'No outstanding tasks in this view.'}</p>}
      <p className="mt-4 text-xs text-black/45">Checkmarks stay in this tab for the current connection. Submitted work is automatically completed after a fresh sync. {storageNotice}</p>
    </>
  </section>;
}
