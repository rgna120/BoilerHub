import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guardLocalRequest, readConfig, readLoginConfig, AcademicError } from '../lib/academic/config';
import { courseURL, academicURL } from '../lib/academic/extract';
import { status, disconnect, search } from '../lib/academic/session';

test('local mode fails closed, with host and CSRF origin enforcement', () => {
  const previous = { ...process.env };
  try {
    Object.assign(process.env, { NODE_ENV: 'development', ACADEMIC_LOCAL_MODE: 'true', ACADEMIC_APP_ORIGIN: 'http://127.0.0.1:3000' });
    const request = (host = '127.0.0.1:3000', origin = 'http://127.0.0.1:3000', method = 'POST') => new Request('http://127.0.0.1:3000/api/academic/connection', { method, headers: { host, origin } });
    assert.doesNotThrow(() => guardLocalRequest(request()));
    // Next internally rewrites the request URL's loopback IP to localhost.
    const normalized = new Request('http://localhost:3000/api/academic/connection', {
      method: 'POST', headers: { host: '127.0.0.1:3000', origin: 'http://127.0.0.1:3000' },
    });
    assert.doesNotThrow(() => guardLocalRequest(normalized));
    assert.throws(() => guardLocalRequest(new Request('http://localhost:3001/api/academic/connection', {
      headers: { host: '127.0.0.1:3000' },
    })), AcademicError);
    assert.throws(() => guardLocalRequest(new Request('http://evil.example:3000/api/academic/connection', {
      headers: { host: '127.0.0.1:3000' },
    })), AcademicError);
    assert.throws(() => guardLocalRequest(request('evil.example')), AcademicError);
    assert.throws(() => guardLocalRequest(request(undefined, 'https://evil.example')), AcademicError);
    assert.throws(() => guardLocalRequest(request(undefined, '')), AcademicError);
    Object.assign(process.env, { NODE_ENV: 'production' });
    assert.throws(() => guardLocalRequest(request()), AcademicError);
  } finally { process.env = previous; }
});

test('course links enforce provider paths and discard authentication query strings', () => {
  assert.equal(courseURL('/d2l/home/123/?ticket=secret', 'https://campus.example/d2l/home'), 'https://campus.example/d2l/home/123');
  assert.equal(courseURL('https://evil.example/d2l/home/123', 'https://campus.example'), null);
  assert.equal(courseURL('/courses/1', 'https://www.gradescope.com', 'gradescope'), 'https://www.gradescope.com/courses/1');
  assert.equal(courseURL('/d2l/home/1', 'https://www.gradescope.com', 'gradescope'), null);
  assert.equal(academicURL('/d2l/lms/dropbox/user/folder_submit_files.d2l?ou=1&db=2&ticket=secret#token', 'https://campus.example'), 'https://campus.example/d2l/lms/dropbox/user/folder_submit_files.d2l?ou=1&db=2');
  assert.equal(academicURL('javascript:alert(1)', 'https://campus.example'), null);
});

test('provider configuration requires complete row selectors and same-origin templates', () => {
  const previous = { ...process.env };
  try {
    for (const name of Object.keys(process.env)) if (name.startsWith('GRADESCOPE_')) delete process.env[name];
    Object.assign(process.env, { GRADESCOPE_LOGIN_URL: 'https://www.gradescope.com/', GRADESCOPE_DASHBOARD_URL: 'https://www.gradescope.com/account', GRADESCOPE_READY_SELECTOR: '#ready', GRADESCOPE_COURSE_SELECTOR: '.course' });
    assert.equal(readConfig('gradescope').assignments, undefined);
    process.env.GRADESCOPE_ASSIGNMENTS_URL = 'https://evil.example/courses/{courseId}';
    assert.throws(() => readConfig('gradescope'), AcademicError);
    process.env.GRADESCOPE_ASSIGNMENTS_URL = 'https://www.gradescope.com/courses/{courseId}';
    assert.throws(() => readConfig('gradescope'), AcademicError);
  } finally { process.env = previous; }
});

test('unowned or expired connections cannot read data or search another provider', async () => {
  const token = 'a'.repeat(64);
  assert.equal(status(token, 'brightspace').state, 'disconnected');
  await assert.rejects(search(token, 'brightspace', '*'), /CONNECTION_REQUIRED/);
  await assert.doesNotReject(disconnect(token, 'gradescope'));
});

test('connection cookies are provider-bound and disconnect closes only the owned browser', async () => {
  const puppeteer = (await import('puppeteer')).default;
  const { connect } = await import('../lib/academic/session');
  const originalLaunch = puppeteer.launch;
  const previous = { ...process.env };
  let closes = 0;
  try {
    delete process.env.ACADEMIC_TYPESENSE_API_KEY;
    for (const name of Object.keys(process.env)) if (/^(BRIGHTSPACE|GRADESCOPE)_/.test(name)) delete process.env[name];
    for (const prefix of ['BRIGHTSPACE', 'GRADESCOPE']) Object.assign(process.env, {
      [`${prefix}_LOGIN_URL`]: 'https://fixture.example/login', [`${prefix}_DASHBOARD_URL`]: 'https://fixture.example/dashboard',
    });
    puppeteer.launch = async () => ({
      createBrowserContext: async () => ({ newPage: async () => ({ setDefaultTimeout() {}, setDefaultNavigationTimeout() {}, goto: async () => {} }) }),
      close: async () => { closes++; },
    } as unknown as Awaited<ReturnType<typeof originalLaunch>>);
    const one = await connect(undefined, 'brightspace');
    const two = await connect(undefined, 'gradescope');
    assert.notEqual(one.token, two.token);
    assert.equal(status(one.token, 'brightspace').state, 'awaiting_login');
    assert.equal(status(one.token, 'gradescope').state, 'disconnected');
    assert.equal(status(two.token, 'brightspace').state, 'disconnected');
    await disconnect(one.token, 'gradescope');
    assert.equal(closes, 0);
    await disconnect(one.token, 'brightspace');
    assert.equal(closes, 1);
    assert.equal(status(two.token, 'gradescope').state, 'awaiting_login');
    await disconnect(two.token, 'gradescope');
    assert.equal(closes, 2);
  } finally { puppeteer.launch = originalLaunch; process.env = previous; }
});

test('Typesense indexes assignments without grades and reports partial import failures', async () => {
  const Typesense = (await import('typesense')).default;
  const { indexAssignments, searchAssignments } = await import('../lib/academic/search');
  const original = Typesense.Client;
  const previous = { ...process.env };
  const accessed: string[] = [];
  let imported: unknown[] = [];
  let fail = false;
  try {
    process.env.ACADEMIC_TYPESENSE_API_KEY = 'fixture-key';
    process.env.ACADEMIC_TYPESENSE_URL = 'http://127.0.0.1:8108';
    Typesense.Client = class {
      collections(name: string) {
        accessed.push(name);
        return { delete: async () => {}, create: async () => {}, documents: () => ({
          import: async (rows: unknown[]) => { imported = rows; return [{ success: !fail }]; },
          search: async () => ({ found: 0, hits: [] }),
        }) };
      }
    } as unknown as typeof original;
    const rows = [{ id: '1', courseId: '2', courseName: 'CS 180', title: 'Project', url: 'https://fixture.example/courses/2', due: null }];
    assert.equal(await indexAssignments('academic_fixture', rows), true);
    assert.deepEqual(Object.keys(imported[0] as object).sort(), ['courseId', 'courseName', 'id', 'title', 'url']);
    await searchAssignments('academic_fixture', 'project');
    assert.ok(accessed.filter(Boolean).every(name => name === 'academic_fixture'));
    fail = true;
    await assert.rejects(indexAssignments('academic_fixture', rows), /SEARCH_INDEX_FAILED/);
  } finally { Typesense.Client = original; process.env = previous; }
});

test('public login defaults work without extraction settings; sync still requires them', () => {
  const previous = { ...process.env };
  try {
    for (const name of Object.keys(process.env)) if (/^(BRIGHTSPACE|GRADESCOPE)_/.test(name)) delete process.env[name];
    assert.equal(readLoginConfig('brightspace').loginUrl, 'https://purdue.brightspace.com/d2l/login');
    assert.equal(readLoginConfig('gradescope').loginUrl, 'https://www.gradescope.com/login');
    assert.throws(() => readConfig('brightspace'), /SYNC_CONFIGURATION_REQUIRED/);
    process.env.BRIGHTSPACE_LOGIN_URL = 'http://insecure.example/login';
    assert.throws(() => readLoginConfig('brightspace'), /INVALID_CONFIGURATION/);
  } finally { process.env = previous; }
});

test('planner uses timezone-qualified dates and separates overdue, upcoming, and unknown dates', async () => {
  const { normalizeDueDate, bucketFor, compareTasks, monthDays } = await import('../lib/academic/planner');
  assert.equal(normalizeDueDate('2026-11-20 23:59:00 -0500'), '2026-11-21T04:59:00.000Z');
  assert.equal(normalizeDueDate('Sep 9 at 11:59PM'), null);
  assert.equal(normalizeDueDate('2026-09-09T23:59:00'), null);
  const now = new Date(2026, 8, 8, 12);
  const task = { id: '1', title: 'Homework', courseId: 'c', courseName: 'Course', url: 'https://example.com', due: null };
  assert.equal(bucketFor({ ...task, dueAt: new Date(2026, 8, 8, 11).toISOString() }, now), 'Overdue');
  assert.equal(bucketFor({ ...task, dueAt: new Date(2026, 8, 8, 23).toISOString() }, now), 'Today');
  assert.equal(bucketFor({ ...task, dueAt: new Date(2026, 8, 15, 23).toISOString() }, now), 'Next 7 days');
  assert.equal(bucketFor({ ...task, dueAt: new Date(2026, 8, 16, 0).toISOString() }, now), 'Later');
  assert.equal(bucketFor(task, now), 'Check due date');
  assert.ok(compareTasks({ ...task, dueAt: now.toISOString() }, task) < 0);
  const days = monthDays(new Date(2026, 1, 1));
  assert.equal(days.length, 42);
  assert.equal(days[0].getDay(), 0);
  assert.equal(days[41].getDay(), 6);
});
