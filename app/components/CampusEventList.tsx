import { ExternalLink, MapPin } from 'lucide-react';
import type { CampusEvent } from '@/lib/events';
export default function CampusEventList({ events }: { events: CampusEvent[] }) {
  return <ul className="mt-3 space-y-3">{events.map(event => <li key={event.id} className="rounded-xl border border-sky-100 bg-sky-50/60 p-4">
    <a href={event.url} target="_blank" rel="noreferrer" className="font-semibold text-sky-950 underline-offset-4 hover:underline">{event.title} <ExternalLink size={13} className="inline" /></a>
    <p className="mt-2 text-sm text-sky-950/80">{new Date(event.startsAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} – {new Date(event.endsAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
    <p className="mt-1 flex items-start gap-1 text-sm text-black/60"><MapPin size={14} className="mt-0.5 shrink-0" />{event.location || 'Location listed on BoilerLink'}</p>
    {event.organizer && <p className="mt-2 text-xs text-black/50">Hosted by {event.organizer}</p>}
  </li>)}</ul>;
}
