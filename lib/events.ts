export type CampusEvent = {
  id: string; title: string; startsAt: string; endsAt: string; location: string; organizer: string; url: string;
};
export type EventFeed = { events: CampusEvent[]; fetchedAt: string; truncated: boolean; omitted: number };
export function eventOccursOnDay(event: CampusEvent, date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime();
  // Midnight is an exclusive end: a Tuesday event ending at midnight is not Wednesday's event.
  return Date.parse(event.startsAt) < end && Date.parse(event.endsAt) > start;
}
