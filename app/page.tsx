"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, BookOpen, CalendarDays, Check, CircleUserRound, LockKeyhole, RefreshCw, Utensils } from "lucide-react";

type SearchHit = {
  document: {
    id: string;
    title: string;
    category: string;
    description: string;
    location: string;
  };
};

type DiningMenu = {
  location: string;
  date: string;
  published: boolean;
  meals: Array<{
    id: string;
    name: string;
    stations: Array<{
      name: string;
      items: Array<{ id: string; name: string; vegetarian: boolean; allergens: string[] }>;
    }>;
  }>;
};

type SearchFilter = "all" | "dining-halls" | "menu-items" | "buildings" | "courses";

const courses = [
  { code: "CS 18000", name: "Problem Solving and OOP", next: "Project 2 due Friday", color: "coral" },
  { code: "MA 16500", name: "Analytic Geometry & Calculus I", next: "Quiz 04 on Monday", color: "gold" },
  { code: "STAT 11300", name: "Statistics & Society", next: "Reading reflection due", color: "blue" },
];

export default function Dashboard() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [diningMenus, setDiningMenus] = useState<DiningMenu[]>([]);
  const [diningLoading, setDiningLoading] = useState(true);
  const [diningError, setDiningError] = useState("");
  const [searchFilter, setSearchFilter] = useState<SearchFilter>("all");
  const [selectedDiningLocation, setSelectedDiningLocation] = useState("");

  async function loadDiningMenus() {
    setDiningLoading(true);
    setDiningError("");

    try {
      const response = await fetch("/api/dining/menus", { cache: "no-store" });
      const data = await response.json();

      if (!response.ok) throw new Error("Dining menus are unavailable right now.");
      setDiningMenus(data.menus || []);
    } catch (error) {
      setDiningError((error as Error).message);
    } finally {
      setDiningLoading(false);
    }
  }

  useEffect(() => {
    void loadDiningMenus();
  }, []);

  useEffect(() => {
    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
      setResults([]);
      setSearching(false);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setSearching(true);

      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(trimmedQuery)}`, {
          signal: controller.signal,
        });
        const data = await response.json();
        setResults(data.hits || []);
      } catch (error) {
        if ((error as Error).name !== "AbortError") setResults([]);
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [query]);

  const visibleResults = results.filter(({ document }) => {
    if (query.trim().toLowerCase() === "dining" && searchFilter === "all") {
      return document.category === "dining-location";
    }

    if (searchFilter === "dining-halls") return document.category === "dining-location";
    if (searchFilter === "menu-items") return document.category === "dining-menu";
    if (searchFilter === "buildings") return document.category === "building";
    if (searchFilter === "courses") return document.category === "course";
    return true;
  });

  const selectedDiningMenu = diningMenus.find((menu) => menu.location === selectedDiningLocation);

  return (
    <div className="min-h-screen overflow-hidden bg-[#f5f2eb] text-[#171717]">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-5 pb-28 sm:px-8 lg:px-12">
        <header className="flex items-center justify-between border-b border-black/10 py-5">
          <div className="flex items-center gap-3"><div className="brand-mark">B</div><span className="font-display text-xl font-bold tracking-tight">Boiler<span className="text-[#c69214]">Hub</span></span></div>
          <span className="flex items-center gap-2 rounded-full border border-black/10 bg-white/60 px-3 py-2 text-sm font-semibold"><CircleUserRound size={17} /> Demo dashboard</span>
        </header>

        <div className="grid flex-1 gap-10 py-10 lg:grid-cols-[1fr_340px] lg:items-start lg:py-16">
          <section>
            <div className="mb-10 max-w-2xl"><p className="eyebrow">Campus overview</p><h1 className="font-display mt-3 text-5xl font-bold leading-[0.98] tracking-[-0.04em] sm:text-7xl">Your campus,<br /><span className="text-[#c69214]">in one place.</span></h1><p className="mt-5 max-w-lg text-lg leading-8 text-black/60">A calmer way to keep up with courses, deadlines, and your next meal at Purdue.</p></div>
            <section className="mb-10" aria-labelledby="search-heading">
              <label id="search-heading" className="eyebrow" htmlFor="campus-search">Search campus</label>
              <input id="campus-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try dining, CS 18000, or Union" className="mt-3 w-full rounded-2xl border border-black/10 bg-white/75 px-5 py-4 text-base outline-none transition focus:border-[#c69214] focus:ring-2 focus:ring-[#c69214]/20" />
              <div className="mt-3 flex flex-wrap gap-2" aria-label="Search filters">
                {([["all", "All"], ["dining-halls", "Dining halls"], ["menu-items", "Menu items"], ["buildings", "Buildings"], ["courses", "Courses"]] as Array<[SearchFilter, string]>).map(([value, label]) => <button key={value} type="button" onClick={() => setSearchFilter(value)} className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${searchFilter === value ? "border-[#c69214] bg-[#e8d9b9]" : "border-black/10 bg-white/60 hover:bg-white"}`}>{label}</button>)}
              </div>
              {query && <div className="mt-3 overflow-hidden rounded-2xl border border-black/10 bg-white/75">
                {searching && <p className="px-5 py-4 text-sm text-black/50">Searching...</p>}
                {!searching && visibleResults.length === 0 && <p className="px-5 py-4 text-sm text-black/50">No campus results found.</p>}
                {!searching && visibleResults.map(({ document }) => document.category === "dining-location" ? <button key={document.id} type="button" onClick={() => setSelectedDiningLocation(document.location)} className="block w-full border-b border-black/10 px-5 py-4 text-left transition hover:bg-[#f5f2eb] last:border-0"><div className="flex items-center justify-between gap-4"><h3 className="font-bold">{document.title}</h3><span className="text-xs font-bold uppercase tracking-wider text-black/40">View menu</span></div><p className="mt-1 text-sm text-black/55">{document.description}</p><p className="mt-1 text-xs text-black/40">{document.location}</p></button> : <article key={document.id} className="border-b border-black/10 px-5 py-4 last:border-0"><div className="flex items-center justify-between gap-4"><h3 className="font-bold">{document.title}</h3><span className="text-xs font-bold uppercase tracking-wider text-black/40">{document.category}</span></div><p className="mt-1 text-sm text-black/55">{document.description}</p><p className="mt-1 text-xs text-black/40">{document.location}</p></article>)}
              </div>}
              {selectedDiningMenu && <section className="mt-4 rounded-2xl border border-black/10 bg-white/75 p-5" aria-labelledby="selected-menu-heading"><div className="flex items-start justify-between gap-4"><div><p className="eyebrow">Today&apos;s menu</p><h3 id="selected-menu-heading" className="font-display mt-2 text-xl font-bold">{selectedDiningMenu.location}</h3></div><button type="button" onClick={() => setSelectedDiningLocation("")} className="text-sm font-semibold text-black/50 hover:text-black">Close</button></div><div className="mt-4 space-y-4">{selectedDiningMenu.meals.map((meal) => <div key={meal.id}><h4 className="font-bold">{meal.name}</h4><div className="mt-2 space-y-2">{meal.stations.map((station) => <div key={station.name}><p className="text-xs font-bold uppercase tracking-wider text-black/40">{station.name}</p><p className="mt-1 text-sm text-black/65">{station.items.map((item) => item.name).join(" · ") || "No items listed"}</p></div>)}</div></div>)}</div></section>}
            </section>
            <section className="mb-10" aria-labelledby="dining-heading">
              <div className="flex items-center justify-between gap-4">
                <div><p className="eyebrow">Today at Purdue</p><h2 id="dining-heading" className="font-display mt-2 text-2xl font-bold">Dining halls</h2></div>
                <button type="button" onClick={() => void loadDiningMenus()} disabled={diningLoading} className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/70 px-3 py-2 text-sm font-semibold transition hover:bg-white disabled:opacity-50" title="Refresh today's dining menus"><RefreshCw size={15} className={diningLoading ? "animate-spin" : ""} />Refresh</button>
              </div>
              {diningLoading && <p className="mt-4 text-sm text-black/50">Loading today&apos;s menus...</p>}
              {diningError && <p className="mt-4 text-sm text-red-700">{diningError}</p>}
              {!diningLoading && !diningError && <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {diningMenus.map((menu) => {
                  const itemCount = menu.meals.reduce((total, meal) => total + meal.stations.reduce((stationTotal, station) => stationTotal + station.items.length, 0), 0);
                  return <article key={menu.location} className="course-row"><div className="course-dot gold" /><div className="min-w-0 flex-1"><h3 className="font-bold">{menu.location}</h3><p className="mt-1 text-sm text-black/50">{menu.meals.length} meals · {itemCount} menu items</p></div><Utensils size={18} className="shrink-0 text-black/35" /></article>;
                })}
              </div>}
            </section>
            <div className="mb-4 flex items-center justify-between"><h2 className="font-display text-2xl font-bold">A week at a glance</h2><span className="text-sm text-black/45">Sample data</span></div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="stat-card bg-[#202c28] text-white"><CalendarDays size={20} className="text-[#d9b657]" /><strong>2</strong><span>deadlines this week</span></div>
              <div className="stat-card bg-[#e8d9b9]"><BookOpen size={20} /><strong>3</strong><span>active courses</span></div>
              <div className="stat-card bg-[#e7a38b]"><Utensils size={20} /><strong>12:15</strong><span>lunch at Earhart</span></div>
            </div>

            <div className="mt-12 flex items-center justify-between"><h2 className="font-display text-2xl font-bold">Active courses</h2><span className="text-sm text-black/45">Sample courses</span></div>
            <div className="mt-4 grid gap-3">{courses.map((course) => <article key={course.code} className="course-row"><div className={`course-dot ${course.color}`} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-baseline gap-x-3 gap-y-1"><h3 className="font-bold">{course.code}</h3><span className="text-sm text-black/45">{course.name}</span></div><p className="mt-2 text-sm text-black/55">{course.next}</p></div><ArrowUpRight size={18} className="shrink-0 text-black/35" /></article>)}</div>
          </section>

          <aside className="space-y-4 lg:pt-14">
            <section className="sync-panel" aria-labelledby="sync-heading">
              <div className="mb-6 flex items-start justify-between">
                <div><p className="eyebrow text-[#d9b657]">Brightspace sync</p><h2 id="sync-heading" className="font-display mt-2 text-2xl font-bold text-white">Bring in your classes</h2></div>
                <LockKeyhole className="text-[#d9b657]" size={22} />
              </div>
              <p className="text-sm leading-6 text-white/70">Course sync is not available in this dashboard yet. Student sign-in needs to be connected before you can securely import your classes.</p>
              <button disabled className="sync-button" type="button">Sync unavailable</button>
              <p className="mt-4 text-xs leading-5 text-white/60">Courses and deadlines shown here are examples.</p>
            </section>
            <div className="rounded-2xl border border-black/10 bg-white/65 p-5"><div className="flex items-center justify-between"><h2 className="font-display text-xl font-bold">Next up</h2><Check size={18} className="text-[#69866d]" /></div><div className="mt-5 border-l-2 border-[#e7a38b] pl-4"><p className="text-xs font-bold uppercase tracking-[0.16em] text-black/40">Friday · 11:59 PM</p><p className="mt-2 font-semibold">CS 18000 · Project 2</p><p className="mt-1 text-sm text-black/50">Implement your linked list</p></div></div>
          </aside>
        </div>
      </div>
    </div>
  );
}
