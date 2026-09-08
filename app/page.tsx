"use client";

import { FormEvent, useState } from "react";
import { ArrowUpRight, BookOpen, CalendarDays, Check, CircleUserRound, Cloud, LoaderCircle, LockKeyhole, Utensils } from "lucide-react";

const courses = [
  { code: "CS 18000", name: "Problem Solving and OOP", next: "Project 2 due Friday", color: "coral" },
  { code: "MA 16500", name: "Analytic Geometry & Calculus I", next: "Quiz 04 on Monday", color: "gold" },
  { code: "STAT 11300", name: "Statistics & Society", next: "Reading reflection due", color: "blue" },
];

export default function Dashboard() {
  const [syncing, setSyncing] = useState(false);
  const [notice, setNotice] = useState("Your dashboard is ready with sample course data.");

  async function syncAcademicData(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSyncing(true);
    setNotice("Connecting to Purdue Brightspace...");

    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/academic/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: form.get("username"), password: form.get("password") }),
      });
      const result = await response.json();
      setNotice(result.message || result.error || "Sync complete.");
    } catch {
      setNotice("Could not reach the sync service. Try again shortly.");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="min-h-screen overflow-hidden bg-[#f5f2eb] text-[#171717]">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-5 pb-28 sm:px-8 lg:px-12">
        <header className="flex items-center justify-between border-b border-black/10 py-5">
          <div className="flex items-center gap-3"><div className="brand-mark">B</div><span className="font-display text-xl font-bold tracking-tight">Boiler<span className="text-[#c69214]">Hub</span></span></div>
          <button className="flex items-center gap-2 rounded-full border border-black/10 bg-white/60 px-3 py-2 text-sm font-semibold"><CircleUserRound size={17} /> Student view</button>
        </header>

        <main className="grid flex-1 gap-10 py-10 lg:grid-cols-[1fr_340px] lg:items-start lg:py-16">
          <section>
            <div className="mb-10 max-w-2xl"><p className="eyebrow">Tuesday, September 8</p><h1 className="font-display mt-3 text-5xl font-bold leading-[0.98] tracking-[-0.04em] sm:text-7xl">Your campus,<br /><span className="text-[#c69214]">in one place.</span></h1><p className="mt-5 max-w-lg text-lg leading-8 text-black/60">A calmer way to keep up with courses, deadlines, and your next meal at Purdue.</p></div>
            <div className="mb-4 flex items-center justify-between"><h2 className="font-display text-2xl font-bold">Today at a glance</h2><span className="text-sm text-black/45">Fall 2026 · Week 3</span></div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="stat-card bg-[#202c28] text-white"><CalendarDays size={20} className="text-[#d9b657]" /><strong>2</strong><span>deadlines this week</span></div>
              <div className="stat-card bg-[#e8d9b9]"><BookOpen size={20} /><strong>3</strong><span>active courses</span></div>
              <div className="stat-card bg-[#e7a38b]"><Utensils size={20} /><strong>12:15</strong><span>lunch at Earhart</span></div>
            </div>

            <div className="mt-12 flex items-center justify-between"><h2 className="font-display text-2xl font-bold">Active courses</h2><button className="link-button">View all <ArrowUpRight size={16} /></button></div>
            <div className="mt-4 grid gap-3">{courses.map((course) => <article key={course.code} className="course-row"><div className={`course-dot ${course.color}`} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-baseline gap-x-3 gap-y-1"><h3 className="font-bold">{course.code}</h3><span className="text-sm text-black/45">{course.name}</span></div><p className="mt-2 text-sm text-black/55">{course.next}</p></div><ArrowUpRight size={18} className="shrink-0 text-black/35" /></article>)}</div>
          </section>

          <aside className="space-y-4 lg:pt-14">
            <form onSubmit={syncAcademicData} className="sync-panel"><div className="mb-6 flex items-start justify-between"><div><p className="eyebrow text-[#d9b657]">Member B · secure sync</p><h2 className="font-display mt-2 text-2xl font-bold text-white">Bring in your classes</h2></div><LockKeyhole className="text-[#d9b657]" size={22} /></div><p className="mb-5 text-sm leading-6 text-white/55">Connect Brightspace to pull your latest courses and assignments into BoilerHub.</p><label className="field-label">Purdue username<input required name="username" autoComplete="username" placeholder="username" /></label><label className="field-label">Password<input required name="password" type="password" autoComplete="current-password" placeholder="••••••••" /></label><button disabled={syncing} className="sync-button" type="submit">{syncing ? <LoaderCircle className="animate-spin" size={17} /> : <Cloud size={17} />}{syncing ? "Syncing..." : "Sync Brightspace"}</button><p aria-live="polite" className="mt-4 text-xs leading-5 text-white/45">{notice}</p></form>
            <div className="rounded-2xl border border-black/10 bg-white/65 p-5"><div className="flex items-center justify-between"><h2 className="font-display text-xl font-bold">Next up</h2><Check size={18} className="text-[#69866d]" /></div><div className="mt-5 border-l-2 border-[#e7a38b] pl-4"><p className="text-xs font-bold uppercase tracking-[0.16em] text-black/40">Friday · 11:59 PM</p><p className="mt-2 font-semibold">CS 18000 · Project 2</p><p className="mt-1 text-sm text-black/50">Implement your linked list</p></div></div>
          </aside>
        </main>
      </div>
    </div>
  );
}
