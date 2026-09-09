import type { Provider } from './types';
export class AcademicError extends Error {
  constructor(public code: string, public status = 400) { super(code); }
}
export type TableConfig = { url: string; ready: string; row: string; title: string; value: string; link?: string; status?: string; next?: string };
export type AcademicConfig = {
  provider: Provider; loginUrl: string; dashboardUrl: string; ready: string; courses: string;
  courseNext?: string; courseCount?: string; assignments?: TableConfig; grades?: TableConfig;
};
export function httpsURL(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password) throw new AcademicError('INVALID_CONFIGURATION', 503);
  return url;
}
// Login can be opened before extraction selectors have been inspected. These are
// public login entry points; credentials are entered only in the service browser.
export function readLoginConfig(provider: Provider): { loginUrl: string } {
  const defaults = {
    brightspace: 'https://purdue.brightspace.com/d2l/login',
    gradescope: 'https://www.gradescope.com/login',
  };
  const loginUrl = process.env[`${provider.toUpperCase()}_LOGIN_URL`] || defaults[provider];
  httpsURL(loginUrl);
  return { loginUrl };
}
export function readConfig(provider: Provider): AcademicConfig {
  const prefix = provider.toUpperCase();
  const required = (name: string) => {
    const value = process.env[name];
    if (!value) throw new AcademicError('SYNC_CONFIGURATION_REQUIRED', 503);
    return value;
  };
  const dashboardUrl = required(`${prefix}_DASHBOARD_URL`);
  const origin = httpsURL(dashboardUrl).origin;
  const { loginUrl } = readLoginConfig(provider);
  const table = (prefix: string): TableConfig | undefined => {
    if (!process.env[`${prefix}_URL`]) return undefined;
    const url = required(`${prefix}_URL`);
    if (!url.includes('{courseId}') || httpsURL(url.replace('{courseId}', '1')).origin !== origin) {
      throw new AcademicError('INVALID_CONFIGURATION', 503);
    }
    return { url, ready: required(`${prefix}_READY_SELECTOR`), row: required(`${prefix}_ROW_SELECTOR`),
      title: required(`${prefix}_TITLE_SELECTOR`), value: required(`${prefix}_VALUE_SELECTOR`),
      link: process.env[`${prefix}_LINK_SELECTOR`], status: process.env[`${prefix}_STATUS_SELECTOR`], next: process.env[`${prefix}_NEXT_SELECTOR`] };
  };
  return { provider, loginUrl, dashboardUrl, ready: required(`${prefix}_READY_SELECTOR`),
    courses: required(`${prefix}_COURSE_SELECTOR`), courseNext: process.env[`${prefix}_COURSE_NEXT_SELECTOR`], courseCount: process.env[`${prefix}_COURSE_COUNT_SELECTOR`],
    assignments: table(`${prefix}_ASSIGNMENTS`), grades: table(`${prefix}_GRADES`) };
}
// Local interactive browsers open on the SERVER machine. This prototype must not
// be exposed as a hosted login service. Bind `npm run dev:academic` to loopback.
export function guardLocalRequest(req: Request) {
  if (process.env.ACADEMIC_LOCAL_MODE !== 'true' || process.env.NODE_ENV === 'production') {
    throw new AcademicError('LOCAL_MODE_REQUIRED', 503);
  }
  const configured = new URL(process.env.ACADEMIC_APP_ORIGIN || 'http://127.0.0.1:3000');
  if (!['localhost', '127.0.0.1', '[::1]'].includes(configured.hostname) ||
      !['http:', 'https:'].includes(configured.protocol) || configured.username || configured.password) {
    throw new AcademicError('INVALID_CONFIGURATION', 503);
  }
  // NextURL normalizes 127.0.0.1 and [::1] to localhost internally. Validate
  // that internal URL as loopback with the configured protocol/port, while
  // keeping the actual browser Host and mutation Origin exact (DNS/CSRF guard).
  const internal = new URL(req.url);
  if (req.headers.get('host') !== configured.host ||
      !['localhost', '127.0.0.1', '[::1]'].includes(internal.hostname) ||
      internal.protocol !== configured.protocol || internal.port !== configured.port ||
      req.headers.get('sec-fetch-site') === 'cross-site') throw new AcademicError('FORBIDDEN', 403);
  if (req.method !== 'GET' && req.headers.get('origin') !== configured.origin) throw new AcademicError('FORBIDDEN', 403);
}
