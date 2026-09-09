'use client';
import { useEffect, useState } from 'react';
import { monthDays } from '@/lib/academic/planner';
import type { EventFeed } from '@/lib/events';
export function useCampusEvents(month: Date | null, enabled: boolean) {
  const [feed, setFeed] = useState<EventFeed | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const year = month?.getFullYear(), index = month?.getMonth();
  useEffect(() => {
    if (!enabled || year === undefined || index === undefined) return;
    const controller = new AbortController();
    const days = monthDays(new Date(year, index, 1));
    const end = new Date(days[41].getFullYear(), days[41].getMonth(), days[41].getDate() + 1);
    setFeed(null); setError(''); setLoading(true);
    fetch(`/api/events?${new URLSearchParams({ start: days[0].toISOString(), end: end.toISOString() })}`, { signal: controller.signal, credentials: 'omit', cache: 'no-store' })
      .then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error); return data as EventFeed; })
      .then(data => { if (!controller.signal.aborted) setFeed(data); })
      .catch(() => { if (!controller.signal.aborted) setError('Could not load BoilerLink events. Your assignment calendar is still available.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [year, index, enabled, retry]);
  return { feed, loading, error, refresh: () => setRetry(value => value + 1) };
}
