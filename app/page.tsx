"use client";

import AcademicConnections from "./components/AcademicConnections";
import type { CampusEvent } from "@/lib/events";
import { useEffect, useState } from "react";
import { CalendarDays, CircleUserRound, LockKeyhole, RefreshCw, Search, Utensils } from "lucide-react";

type SearchHit = {
  document: {
    id: string;
    title: string;
    category: string;
    description?: string;
    location?: string;
    url?: string;
    startsAt?: string;
    endsAt?: string;
    organizer?: string;
  };
  highlight?: Record<string, { snippet?: string; matched_tokens?: string[] }>;
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

type SearchFilter = "all" | "dining-halls" | "menu-items" | "events" | "buildings" | "courses";

export default function Dashboard() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [diningMenus, setDiningMenus] = useState<DiningMenu[]>([]);
  const [diningLoading, setDiningLoading] = useState(true);
  const [diningError, setDiningError] = useState("");
  const [searchFilter, setSearchFilter] = useState<SearchFilter>("all");
  const [selectedDiningLocation, setSelectedDiningLocation] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [facets, setFacets] = useState<Record<string, Array<{ value: string; count: number }>>>({});
  const [boilerLinkQuery, setBoilerLinkQuery] = useState("");
  const [boilerLinkResults, setBoilerLinkResults] = useState<SearchHit[]>([]);
  const [boilerLinkSearching, setBoilerLinkSearching] = useState(false);
  const [selectedEvents, setSelectedEvents] = useState<CampusEvent[]>([]);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("boilerhub:selected-events:v1") || "[]");
      if (Array.isArray(saved)) setSelectedEvents(saved);
    } catch {
      setSelectedEvents([]);
    }
  }, []);

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
    const start = new Date();
    const end = new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);
    void fetch(`/api/events?${new URLSearchParams({ start: start.toISOString(), end: end.toISOString() })}`, { cache: "no-store" }).catch(() => undefined);
  }, []);

  useEffect(() => {
    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
      setResults([]);
      setSearching(false);
      setSuggestions([]);
      setFacets({});
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
        setSuggestions(data.suggestions || []);
        setFacets(data.facets || {});
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

  useEffect(() => {
    const trimmedQuery = boilerLinkQuery.trim();
    if (!trimmedQuery) {
      setBoilerLinkResults([]);
      setBoilerLinkSearching(false);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setBoilerLinkSearching(true);
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(trimmedQuery)}`, { signal: controller.signal });
        const data = await response.json();
        setBoilerLinkResults((data.hits || []).filter((hit: SearchHit) => hit.document.category === "event"));
      } catch (error) {
        if ((error as Error).name !== "AbortError") setBoilerLinkResults([]);
      } finally {
        if (!controller.signal.aborted) setBoilerLinkSearching(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [boilerLinkQuery]);

  const visibleResults = results.filter(({ document }) => {
    if (query.trim().toLowerCase() === "dining" && searchFilter === "all") {
      return document.category === "dining-location";
    }

    if (searchFilter === "dining-halls") return document.category === "dining-location";
    if (searchFilter === "menu-items") return document.category === "dining-menu";
    if (searchFilter === "events") return document.category === "event";
    if (searchFilter === "buildings") return document.category === "building";
    if (searchFilter === "courses") return document.category === "course";
    return true;
  });

  const selectedDiningMenu = diningMenus.find((menu) => menu.location === selectedDiningLocation);

  function toggleCalendarEvent(hit: SearchHit) {
    const document = hit.document;
    if (!document.url || !document.startsAt || !document.endsAt) return;
    const event: CampusEvent = {
      id: document.id,
      title: document.title,
      startsAt: document.startsAt,
      endsAt: document.endsAt,
      location: document.location || "",
      organizer: document.organizer || "",
      url: document.url,
    };
    const next = selectedEvents.some((selected) => selected.id === event.id)
      ? selectedEvents.filter((selected) => selected.id !== event.id)
      : [...selectedEvents, event];
    setSelectedEvents(next);
    localStorage.setItem("boilerhub:selected-events:v1", JSON.stringify(next));
  }

  function highlightedText(hit: SearchHit, field: "title" | "description" | "location") {
    const value = hit.highlight?.[field]?.snippet || hit.document[field] || "";
    return value.split(/(<mark>.*?<\/mark>)/gi).map((part, index) => part.toLowerCase().startsWith("<mark>")
      ? <mark key={`${field}-${index}`} className="bg-[#f1d77a]">{part.replace(/<\/?mark>/gi, "")}</mark>
      : part);
  }

  function courseCatalogUrl(title: string) {
    const match = title.match(/^([A-Za-z&]+)\s+(\d{3,5})/);
    const search = match ? `${match[1].toUpperCase()} ${match[2]}` : title;
    return `https://selfservice.mypurdue.purdue.edu/prod/bwckctlg.p_disp_dyn_ctlg?search=${encodeURIComponent(search)}`;
  }

  return (
    <div className="min-h-screen overflow-hidden bg-[#f5f2eb] text-[#171717]">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-5 pb-28 sm:px-8 lg:px-12">
        <header className="flex items-center justify-between border-b border-black/10 py-5">
          <div className="flex items-center gap-3"><div className="brand-mark">B</div><span className="font-display text-xl font-bold tracking-tight">Boiler<span className="text-[#c69214]">Hub</span></span></div>
          <span className="flex items-center gap-2 rounded-full border border-black/10 bg-white/60 px-3 py-2 text-sm font-semibold"><CircleUserRound size={17} /> Student workspace</span>
        </header>

        <div className="grid flex-1 gap-10 py-10 lg:grid-cols-[1fr_340px] lg:items-start lg:py-16">
          <section>
            <div className="mb-10 max-w-2xl"><p className="eyebrow">Campus overview</p><h1 className="font-display mt-3 text-5xl font-bold leading-[0.98] tracking-[-0.04em] sm:text-7xl">Your campus,<br /><span className="text-[#c69214]">in one place.</span></h1><p className="mt-5 max-w-lg text-lg leading-8 text-black/60">A calmer way to keep up with courses, deadlines, and your next meal at Purdue.</p></div>
            <AcademicConnections selectedEvents={selectedEvents} />
            <section className="mb-10" aria-labelledby="search-heading">
              <label id="search-heading" className="eyebrow" htmlFor="campus-search">Search campus</label>
              <input id="campus-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try dining, CS 18000, or Union" className="mt-3 w-full rounded-2xl border border-black/10 bg-white/75 px-5 py-4 text-base outline-none transition focus:border-[#c69214] focus:ring-2 focus:ring-[#c69214]/20" />
              {query && !searching && suggestions.length > 0 && <div className="mt-2 flex flex-wrap gap-2" aria-label="Search suggestions">{suggestions.slice(0, 5).map((suggestion) => <button key={suggestion} type="button" onClick={() => setQuery(suggestion)} className="rounded-full border border-black/10 bg-white/70 px-3 py-1.5 text-xs text-black/65 hover:bg-white">{suggestion}</button>)}</div>}
              <div className="mt-3 flex flex-wrap gap-2" aria-label="Search filters">
                {([["all", "All"], ["dining-halls", "Dining halls"], ["menu-items", "Menu items"], ["events", "Events"], ["buildings", "Buildings"], ["courses", "Courses"]] as Array<[SearchFilter, string]>).map(([value, label]) => <button key={value} type="button" onClick={() => setSearchFilter(value)} className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${searchFilter === value ? "border-[#c69214] bg-[#e8d9b9]" : "border-black/10 bg-white/60 hover:bg-white"}`}>{label}{value !== "all" && <span className="ml-1 text-black/40">{facets.category?.find((facet) => facet.value === (value === "dining-halls" ? "dining-location" : value === "menu-items" ? "dining-menu" : value === "events" ? "event" : value))?.count || ""}</span>}</button>)}
              </div>
              {query && <div className="mt-3 overflow-hidden rounded-2xl border border-black/10 bg-white/75">
                {searching && <p className="px-5 py-4 text-sm text-black/50">Searching...</p>}
                {!searching && visibleResults.length === 0 && <p className="px-5 py-4 text-sm text-black/50">No campus results found.</p>}
                {!searching && visibleResults.map((hit) => hit.document.category === "dining-location" ? <button key={hit.document.id} type="button" onClick={() => setSelectedDiningLocation(hit.document.location || "")} className="block w-full border-b border-black/10 px-5 py-4 text-left transition hover:bg-[#f5f2eb] last:border-0"><div className="flex items-center justify-between gap-4"><h3 className="font-bold">{highlightedText(hit, "title")}</h3><span className="text-xs font-bold uppercase tracking-wider text-black/40">View menu</span></div><p className="mt-1 text-sm text-black/55">{highlightedText(hit, "description")}</p><p className="mt-1 text-xs text-black/40">{highlightedText(hit, "location")}</p></button> : hit.document.category === "event" ? <a key={hit.document.id} href={hit.document.url} target="_blank" rel="noreferrer" className="block border-b border-black/10 px-5 py-4 transition hover:bg-[#f5f2eb] last:border-0"><div className="flex items-center justify-between gap-4"><h3 className="font-bold">{highlightedText(hit, "title")}</h3><span className="text-xs font-bold uppercase tracking-wider text-black/40">Event ↗</span></div><p className="mt-1 text-sm text-black/55">{highlightedText(hit, "description")}</p><p className="mt-1 text-xs text-black/40">{highlightedText(hit, "location")} {hit.document.startsAt && `· ${new Date(hit.document.startsAt).toLocaleDateString()}`}</p></a> : hit.document.category === "course" ? <a key={hit.document.id} href={courseCatalogUrl(hit.document.title)} target="_blank" rel="noreferrer" className="block border-b border-black/10 px-5 py-4 transition hover:bg-[#f5f2eb] last:border-0"><div className="flex items-center justify-between gap-4"><h3 className="font-bold">{highlightedText(hit, "title")}</h3><span className="text-xs font-bold uppercase tracking-wider text-black/40">Purdue catalog ↗</span></div><p className="mt-1 text-sm text-black/55">{highlightedText(hit, "description")}</p></a> : <article key={hit.document.id} className="border-b border-black/10 px-5 py-4 last:border-0"><div className="flex items-center justify-between gap-4"><h3 className="font-bold">{highlightedText(hit, "title")}</h3><span className="text-xs font-bold uppercase tracking-wider text-black/40">{hit.document.category}</span></div><p className="mt-1 text-sm text-black/55">{highlightedText(hit, "description")}</p><p className="mt-1 text-xs text-black/40">{highlightedText(hit, "location")}</p></article>)}
              </div>}
              {selectedDiningMenu && <section className="mt-4 rounded-2xl border border-black/10 bg-white/75 p-5" aria-labelledby="selected-menu-heading"><div className="flex items-start justify-between gap-4"><div><p className="eyebrow">Today&apos;s menu</p><h3 id="selected-menu-heading" className="font-display mt-2 text-xl font-bold">{selectedDiningMenu.location}</h3></div><button type="button" onClick={() => setSelectedDiningLocation("")} className="text-sm font-semibold text-black/50 hover:text-black">Close</button></div><div className="mt-4 space-y-4">{selectedDiningMenu.meals.map((meal) => <div key={meal.id}><h4 className="font-bold">{meal.name}</h4><div className="mt-2 space-y-2">{meal.stations.map((station) => <div key={station.name}><p className="text-xs font-bold uppercase tracking-wider text-black/40">{station.name}</p><p className="mt-1 text-sm text-black/65">{station.items.map((item) => item.name).join(" · ") || "No items listed"}</p></div>)}</div></div>)}</div></section>}
            </section>
            <section className="mb-10 rounded-2xl border border-sky-100 bg-sky-50/60 p-5" aria-labelledby="boilerlink-search-heading">
              <div className="flex items-start justify-between gap-4"><div><p className="eyebrow text-sky-800">BoilerLink</p><h2 id="boilerlink-search-heading" className="font-display mt-2 text-2xl font-bold">Find campus events</h2><p className="mt-2 text-sm text-black/60">Choose which public events you want to add to your calendar.</p></div><Search className="text-sky-800" size={21} /></div>
              <input id="boilerlink-search" value={boilerLinkQuery} onChange={(event) => setBoilerLinkQuery(event.target.value)} placeholder="Search clubs, workshops, fairs..." className="mt-4 w-full rounded-xl border border-sky-200 bg-white px-4 py-3 text-sm outline-none focus:border-sky-700 focus:ring-2 focus:ring-sky-700/20" />
              {boilerLinkQuery && <div className="mt-3 overflow-hidden rounded-xl border border-sky-100 bg-white">{boilerLinkSearching && <p className="p-4 text-sm text-black/50">Searching BoilerLink events...</p>}{!boilerLinkSearching && !boilerLinkResults.length && <p className="p-4 text-sm text-black/50">No BoilerLink events found.</p>}{!boilerLinkSearching && boilerLinkResults.map((hit) => { const added = selectedEvents.some((event) => event.id === hit.document.id); return <article key={hit.document.id} className="border-b border-black/10 p-4 last:border-0"><div className="flex items-start justify-between gap-4"><div><h3 className="font-bold">{highlightedText(hit, "title")}</h3><p className="mt-1 text-sm text-black/55">{highlightedText(hit, "location")} {hit.document.startsAt && `· ${new Date(hit.document.startsAt).toLocaleString()}`}</p><p className="mt-1 text-xs text-black/50">{hit.document.organizer || "Purdue campus event"}</p></div><button type="button" onClick={() => toggleCalendarEvent(hit)} className={`shrink-0 rounded-lg px-3 py-2 text-xs font-bold ${added ? "bg-[#202c28] text-white" : "bg-[#d9b657] text-black"}`}>{added ? "Added" : "Add to calendar"}</button></div></article>; })}</div>}
              <p className="mt-3 text-xs text-black/50">{selectedEvents.length} event{selectedEvents.length === 1 ? "" : "s"} added to your calendar.</p>
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
          </section>

          <aside className="space-y-4 lg:pt-14">
            <section className="sync-panel" aria-labelledby="sync-heading">
              <div className="mb-6 flex items-start justify-between">
                <div><p className="eyebrow text-[#d9b657]">Brightspace sync</p><h2 id="sync-heading" className="font-display mt-2 text-2xl font-bold text-white">Bring in your classes</h2></div>
                <LockKeyhole className="text-[#d9b657]" size={22} />
              </div>
              <p className="text-sm leading-6 text-white/70">Connect Brightspace or Gradescope below to sign in directly in your browser and sync your academic data.</p>
              <a href="#academic-connections" className="sync-button">Connect your accounts</a>
              <p className="mt-4 text-xs leading-5 text-white/60">Your tracker uses the latest successful sync.</p>
            </section>
            <div className="rounded-2xl border border-black/10 bg-white/65 p-5">
              <div className="flex items-center justify-between"><h2 className="font-display text-xl font-bold">Plan your week</h2><CalendarDays size={19} className="text-[#8b6b25]" /></div>
              <p className="mt-4 text-sm leading-6 text-black/60">Start with overdue work, then check what is due today and this week. Switch to Calendar to see deadlines by day.</p>
              <p className="mt-3 text-sm leading-6 text-black/60">Refresh your accounts to bring in new assignments and submission status.</p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
