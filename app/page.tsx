import AcademicConnections from './components/AcademicConnections';
import { CalendarDays, CircleUserRound, LockKeyhole } from "lucide-react";

export default function Dashboard() {
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
            <AcademicConnections />
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
