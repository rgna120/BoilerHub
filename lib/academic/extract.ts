import { normalizeDueDate } from './planner';
import { createHash } from 'node:crypto';
import type { Page } from 'puppeteer';
import { AcademicError, type AcademicConfig, type TableConfig } from './config';
import type { Course, Snapshot, Provider } from './types';

const hash = (text: string) => createHash('sha256').update(text).digest('hex');
export function courseURL(raw: string, base: string, provider: Provider = 'brightspace'): string | null {
  try {
    const url = new URL(raw, base);
    if (url.origin !== new URL(base).origin || url.username || url.password || !(provider === 'brightspace' ? /^\/d2l\/home\/\d+\/?$/ : /^\/courses\/\d+\/?$/).test(url.pathname)) return null;
    return `${url.origin}${url.pathname.replace(/\/$/, '')}`;
  } catch { return null; }
}
// Keep only navigation IDs in links; never return SSO tickets or arbitrary query tokens.
export function academicURL(raw: string, base: string): string | null {
  try {
    const url = new URL(raw, base);
    if (url.origin !== new URL(base).origin || url.username || url.password || !/^\/(d2l|courses)\//.test(url.pathname)) return null;
    const query = new URLSearchParams();
    for (const name of ['ou', 'db', 'qi', 'ai']) {
      const value = url.searchParams.get(name);
      if (value && /^\d+$/.test(value)) query.set(name, value);
    }
    return `${url.origin}${url.pathname}${query.size ? `?${query}` : ''}`;
  } catch { return null; }
}
async function authenticated(page: Page, origin: string) {
  if (new URL(page.url()).origin !== origin) throw new AcademicError('RECONNECT_REQUIRED', 401);
}
async function pages<T>(page: Page, ready: string, next: string | undefined, origin: string, extract: () => Promise<T[]>): Promise<T[]> {
  const output: T[] = [];
  const seen = new Set<string>();
  for (let count = 0; count < 20; count++) {
    await authenticated(page, origin);
    await page.waitForSelector(ready, { visible: true });
    const rows = await extract();
    const signature = JSON.stringify(rows);
    if (seen.has(signature)) throw new AcademicError('PAGINATION_NOT_ADVANCING', 502);
    seen.add(signature);
    output.push(...rows);
    if (!next) return output;
    const button = await page.$(next);
    if (!button) return output;
    const disabled = await button.evaluate(el => el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true');
    if (disabled) { await button.dispose(); return output; }
    await button.click();
    await button.dispose();
    // Supports both navigations and JS-updated tables. A changing row signature
    // must be paired with an institution-specific loaded-state selector.
    let changed = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 100));
      await authenticated(page, origin);
      try {
        if (await page.$(ready) && JSON.stringify(await extract()) !== signature) { changed = true; break; }
      } catch { /* DOM may be replaced during navigation; retry within this bound. */ }
    }
    if (!changed) throw new AcademicError('PAGINATION_NOT_ADVANCING', 502);
  }
  throw new AcademicError('PAGE_LIMIT_REACHED', 502);
}
async function tableRows(page: Page, config: TableConfig, course: Course, origin: string) {
  const target = config.url.replace('{courseId}', encodeURIComponent(course.id));
  await page.goto(target, { waitUntil: 'domcontentloaded' });
  return pages(page, config.ready, config.next, origin, () => page.$$eval(config.row, (rows, selectors) => rows.map(row => {
    const text = (selector: string) => row.querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim() || '';
    const title = text(selectors.title);
    // A missing configured field is a selector mismatch, not an empty grade.
    if (!title || !row.querySelector(selectors.value)) throw new Error('ROW_SHAPE_CHANGED');
    const anchor = selectors.link ? row.querySelector(selectors.link) : null;
    const status = selectors.status ? row.querySelector(selectors.status) : null;
    return { title, value: text(selectors.value), datetime: row.querySelector(selectors.value)?.getAttribute('datetime'),
      submitted: !!status && (status.textContent?.trim() === 'Submitted' || !!status.querySelector('.submissionStatus--score')),
      sourceId: row.querySelector('[data-assignment-id]')?.getAttribute('data-assignment-id') || anchor?.getAttribute('href')?.match(/\/assignments\/(\d+)/)?.[1], href: anchor?.getAttribute('href') ? new URL(anchor.getAttribute('href')!, location.href).href : '' };
  }), config));
}
export async function extractSnapshot(page: Page, config: AcademicConfig): Promise<Snapshot> {
  const origin = new URL(config.dashboardUrl).origin;
  await page.goto(config.dashboardUrl, { waitUntil: 'domcontentloaded' });
  const readCourses = () => page.$$eval(config.courses, links => links.filter(link => {
      // D2L cards can be offscreen before layout. Follow composed ancestors to
      // exclude inactive term panels without dropping unloaded/offscreen cards.
      let node: Element | null = link;
      while (node) {
        if (node.tagName === 'D2L-TAB-PANEL' && !node.hasAttribute('_selected')) return false;
        const root = node.getRootNode();
        node = node.parentElement || (root instanceof ShadowRoot ? root.host : null);
      }
      return true;
    }).map(link => ({
      name: (link.getAttribute('aria-label') || link.getAttribute('text') || link.textContent || '').replace(/\s+/g, ' ').trim(),
      href: link.getAttribute('href') || '',
    })));
  const raw = await pages(page, config.ready, config.courseNext, origin, async () => {
    // Some web-component cards hydrate in separate renders. Compare with the
    // provider's displayed total instead of returning the first partial render.
    for (let attempt = 0; attempt < 100; attempt++) {
      const rows = await readCourses();
      if (!config.courseCount) return rows;
      const expected = await page.$$eval(config.courseCount, nodes => {
        const totals = nodes.filter(node => {
          let el: Element | null = node;
          while (el) {
            if (el.tagName === 'D2L-TAB-PANEL' && !el.hasAttribute('_selected')) return false;
            const root = el.getRootNode();
            el = el.parentElement || (root instanceof ShadowRoot ? root.host : null);
          }
          return true;
        }).map(el => el.textContent?.match(/\((\d+)\)/)?.[1]).filter(Boolean).map(Number);
        return totals.length ? Math.max(...totals) : null;
      });
      if (expected !== null && rows.length === expected && rows.every(row => row.name)) return rows;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new AcademicError('COURSE_LIST_INCOMPLETE', 502);
  });
  const courses = new Map<string, Course>();
  for (const link of raw) {
    const url = courseURL(link.href, config.dashboardUrl, config.provider);
    if (!url || !link.name) throw new AcademicError('COURSE_SELECTORS_CHANGED', 502);
    const id = url.split('/').pop()!;
    courses.set(id, { id, name: link.name, url });
  }
  if (courses.size > 50) throw new AcademicError('COURSE_LIMIT_REACHED', 502);
  const snapshot: Snapshot = { courses: Array.from(courses.values()), assignments: [], grades: [],
    syncedAt: new Date().toISOString(), coverage: { assignments: !!config.assignments, grades: !!config.grades } };
  for (const course of Array.from(courses.values())) {
    if (config.assignments) {
      const rows = await tableRows(page, config.assignments, course, origin);
      for (const row of rows) {
        const url = row.href ? academicURL(row.href, config.dashboardUrl) : course.url;
        if (!url) throw new AcademicError('ASSIGNMENT_LINK_CHANGED', 502);
        snapshot.assignments.push({ id: hash(`${course.id}|${row.sourceId || row.title}`), courseId: course.id,
          courseName: course.name, title: row.title, url, due: row.value || null, dueAt: normalizeDueDate(row.datetime), submitted: row.submitted });
      }
    }
    if (config.grades) {
      const rows = await tableRows(page, config.grades, course, origin);
      // Gradebooks can repeat labels across categories without exposing stable
      // item IDs. Preserve each row with an identity local to this full snapshot.
      rows.forEach((row, index) => snapshot.grades.push({ id: hash(`${course.id}|${row.title}|${index}`),
        courseId: course.id, courseName: course.name, title: row.title, value: row.value || 'Not posted' }));
    }
  }
  // Avoid silently losing distinct rows when a selector doesn't expose unique titles/links.
  for (const rows of [snapshot.assignments, snapshot.grades]) {
    if (new Set(rows.map(row => row.id)).size !== rows.length) throw new AcademicError('DUPLICATE_ROW_IDENTITIES', 502);
  }
  return snapshot;
}
