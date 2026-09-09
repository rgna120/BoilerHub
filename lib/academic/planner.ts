import type { Assignment, Provider } from './types';

// Calendar placement requires an explicit year and timezone. Never infer either
// from display strings such as “Sep 9 at 11:59PM”. Gradescope exposes datetime.
export function normalizeDueDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const value = raw.trim().replace(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) ([+-]\d{2})(\d{2})$/, '$1T$2$3:$4');
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}
export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export type Task = Assignment & { key: string; provider: Provider; completed: boolean };
export type Bucket = 'Overdue' | 'Today' | 'Next 7 days' | 'Later' | 'Check due date';
export function bucketFor(task: Assignment, now: Date): Bucket {
  const due = normalizeDueDate(task.dueAt);
  if (!due) return 'Check due date';
  const date = new Date(due);
  if (date.getTime() < now.getTime()) return 'Overdue';
  if (dayKey(date) === dayKey(now)) return 'Today';
  const limit = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 8);
  return date < limit ? 'Next 7 days' : 'Later';
}
export function compareTasks(a: Assignment, b: Assignment) {
  const at = normalizeDueDate(a.dueAt), bt = normalizeDueDate(b.dueAt);
  return (at ? Date.parse(at) : Infinity) - (bt ? Date.parse(bt) : Infinity) || a.title.localeCompare(b.title);
}
export function monthDays(month: Date): Date[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = new Date(month.getFullYear(), month.getMonth(), 1 - first.getDay());
  return Array.from({ length: 42 }, (_, offset) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + offset));
}
