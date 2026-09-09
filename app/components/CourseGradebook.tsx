'use client';

import { useState } from 'react';
import { BookOpen, ChevronDown, ExternalLink } from 'lucide-react';
import type { Snapshot } from '@/lib/academic/types';

export default function CourseGradebook({ snapshot }: { snapshot: Snapshot }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [section, setSection] = useState<'grades' | 'assignments'>('grades');
  const [query, setQuery] = useState('');
  const selected = snapshot.courses.find(course => course.id === selectedId);
  const grades = snapshot.grades.filter(grade => grade.courseId === selected?.id);
  const assignments = snapshot.assignments.filter(assignment => assignment.courseId === selected?.id);
  const shown = grades.filter(grade => grade.title.toLocaleLowerCase().includes(query.toLocaleLowerCase().trim()));
  function choose(id: string) {
    setSelectedId(previous => previous === id ? null : id);
    setSection('grades'); setQuery('');
  }
  return <div className="mt-5">
    <h4 className="font-display text-xl font-bold">Your classes</h4>
    <p className="mt-1 text-sm text-black/55">Choose a class to view its grades and assignment details.</p>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      {snapshot.courses.map(course => {
        const active = selected?.id === course.id;
        const count = snapshot.grades.filter(grade => grade.courseId === course.id).length;
        return <button key={course.id} type="button" onClick={() => choose(course.id)} aria-expanded={active}
          aria-controls="brightspace-class-details" aria-label={`View grades for ${course.name}`}
          className={`flex items-start gap-3 rounded-xl border p-4 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b6b25] ${active ? 'border-[#202c28] bg-[#202c28] text-white' : 'border-black/10 bg-white hover:border-[#c69214]'}`}>
          <BookOpen size={19} className={`mt-1 shrink-0 ${active ? 'text-[#d9b657]' : 'text-[#8b6b25]'}`} />
          <span className="min-w-0 flex-1"><span className="block break-words text-sm font-semibold" title={course.name}>{course.name.split(',')[0]}</span>
            <span className={`mt-2 block text-xs ${active ? 'text-white/65' : 'text-black/50'}`}>{snapshot.coverage.grades ? `${count} grade ${count === 1 ? 'entry' : 'entries'}` : 'Grades not synced'}</span></span>
          <ChevronDown size={17} className={`mt-1 shrink-0 transition-transform ${active ? 'rotate-180' : ''}`} />
        </button>;
      })}
    </div>
    {!snapshot.courses.length && <p className="mt-4 text-sm text-black/60">No courses in the synced course list.</p>}
    <div id="brightspace-class-details">
      {selected ? <section className="mt-5 rounded-xl border border-black/10 bg-[#f5f2eb]/60 p-4 sm:p-5" aria-labelledby="selected-class-heading">
        <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><p className="eyebrow">Class details</p><h5 id="selected-class-heading" className="mt-2 break-words text-lg font-bold">{selected.name.split(',')[0]}</h5>
          <p className="mt-1 text-xs text-black/50">Last synced {new Date(snapshot.syncedAt).toLocaleString()}</p></div>
          <a href={selected.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-sm font-semibold text-[#8b6b25] underline underline-offset-4">Open class <ExternalLink size={13} /></a>
        </div>
        <div className="mt-5 flex gap-2" aria-label="Class information">
          <button type="button" aria-pressed={section === 'grades'} onClick={() => setSection('grades')} className={`rounded-lg px-3 py-2 text-sm ${section === 'grades' ? 'bg-[#202c28] text-white' : 'bg-white'}`}>Grades ({grades.length})</button>
          <button type="button" aria-pressed={section === 'assignments'} onClick={() => setSection('assignments')} className={`rounded-lg px-3 py-2 text-sm ${section === 'assignments' ? 'bg-[#202c28] text-white' : 'bg-white'}`}>Assignments ({assignments.length})</button>
        </div>
        {section === 'grades' ? !snapshot.coverage.grades ? <p className="mt-4 text-sm text-black/60">Grades have not been synced for this service yet.</p> : grades.length ? <>
          <label className="mt-4 block"><span className="sr-only">Find a grade item in this class</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Find a quiz, project, or grade item" className="w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm" /></label>
          <p className="mt-2 text-xs text-black/50">Values are shown as reported by Brightspace; no overall average is calculated.</p>
          <div className="mt-4 overflow-hidden rounded-lg border border-black/10 bg-white"><table className="w-full text-left text-sm"><caption className="sr-only">Grades for {selected.name}</caption>
            <thead className="bg-black/[0.03] text-xs text-black/60"><tr><th scope="col" className="px-3 py-3 font-medium">Grade item</th><th scope="col" className="px-3 py-3 text-right font-medium">Reported value</th></tr></thead>
            <tbody className="divide-y divide-black/10">{shown.map(grade => <tr key={grade.id}><th scope="row" className="break-words px-3 py-3 font-normal">{grade.title}</th><td className="px-3 py-3 text-right font-semibold">{grade.value}</td></tr>)}</tbody>
          </table>{!shown.length && <p className="p-4 text-sm text-black/60">No grade items match your search.</p>}</div>
        </> : <p className="mt-4 rounded-lg bg-white p-4 text-sm text-black/60">No grade items were returned for this class. Check Brightspace for the latest details.</p>
        : !snapshot.coverage.assignments ? <p className="mt-4 text-sm text-black/60">Brightspace assignment import is not configured yet. You can open the class above to check assignments.</p>
        : assignments.length ? <ul className="mt-4 divide-y divide-black/10">{assignments.map(assignment => <li key={assignment.id} className="py-3"><a href={assignment.url} target="_blank" rel="noreferrer" className="text-sm font-semibold underline underline-offset-4">{assignment.title}</a><p className="mt-1 text-xs text-black/60">{assignment.dueAt ? new Date(assignment.dueAt).toLocaleString() : assignment.due || 'No due date posted'}{assignment.submitted ? ' · Submitted' : ''}</p></li>)}</ul>
        : <p className="mt-4 text-sm text-black/60">No assignments were returned for this class.</p>}
      </section> : snapshot.courses.length > 0 && <p className="mt-5 rounded-xl border border-dashed border-black/15 p-5 text-center text-sm text-black/55">Select a class above to open its gradebook.</p>}
    </div>
  </div>;
}
