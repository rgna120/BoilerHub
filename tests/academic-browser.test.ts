import { test } from 'node:test';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';
import { extractSnapshot } from '../lib/academic/extract';
import type { AcademicConfig } from '../lib/academic/config';

// Every request is intercepted; no account, real LMS, or network access is used.
test('browser fixtures: both providers, shadow DOM, pagination, grades, and selector failures', async () => {
  const browser = await puppeteer.launch({ headless: true });
  try {
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    page.setDefaultTimeout(750);
    await page.setRequestInterception(true);
    let mode = 'normal';
    page.on('request', request => {
      const url = new URL(request.url());
      let body = '';
      if (url.pathname === '/d2l/home') body = mode === 'login' ? '<h1>Sign in</h1>' : '<div id="loaded"><course-list></course-list></div><script>document.querySelector("course-list").attachShadow({mode:"open"}).innerHTML = `<d2l-tab-panel _selected><a href="/d2l/home/123?ticket=secret">CS 180</a></d2l-tab-panel><d2l-tab-panel><a href="/d2l/home/999">Old term</a></d2l-tab-panel>`;</script>';
      else if (url.pathname === '/account') body = mode === 'delayed'
        ? '<div id="loaded"><span id="course-count">Courses (2)</span><a href="/courses/123">CS 180</a></div><script>setTimeout(() => document.querySelector("#loaded").insertAdjacentHTML("beforeend", `<a href="/courses/124">MA 261</a>`), 250)</script>'
        : '<div id="loaded"><a href="/courses/123">CS 180</a></div>';
      else if (url.pathname.endsWith('/assignments')) {
        body = `<div id="loaded"><table><tr><td class="title"><a href="/courses/123/assignments/1">Project 1</a></td><td class="value" datetime="2026-09-11 23:59:00 -0400">Friday 11:59 PM</td></tr></table></div><button id="next" onclick='document.querySelector(".title").innerHTML="<a href=\\"/courses/123/assignments/2\\">Project 2</a>";this.disabled=true'>Next</button>`;
        if (mode === 'broken') body = '<div id="loaded"><table><tr><td>Changed page structure</td></tr></table></div>';
        if (mode === 'empty') body = '<div id="loaded">No assignments<table></table></div>';
        if (mode === 'stuck') body = '<div id="loaded"><table><tr><td class="title">Project</td><td class="value">Monday</td></tr></table></div><button id="next">Next</button>';
      } else if (url.pathname.endsWith('/grades')) body = '<div id="loaded"><table><tr><td class="title">Project 1</td><td class="value">9 / 10</td></tr><tr><td class="title">Project 1</td><td class="value">8 / 10</td></tr></table></div>';
      void request.respond({ status: body ? 200 : 404, contentType: 'text/html', body });
    });
    for (const provider of ['brightspace', 'gradescope'] as const) {
      const config: AcademicConfig = { provider, loginUrl: 'https://fixture.example/login',
        dashboardUrl: `https://fixture.example/${provider === 'brightspace' ? 'd2l/home' : 'account'}`,
        ready: '#loaded', courses: provider === 'brightspace' ? 'course-list >>> a' : '#loaded a',
        assignments: { url: 'https://fixture.example/courses/{courseId}/assignments', ready: '#loaded', row: 'tr', title: '.title', value: '.value', link: 'a', next: '#next' },
        grades: { url: 'https://fixture.example/courses/{courseId}/grades', ready: '#loaded', row: 'tr', title: '.title', value: '.value' } };
      mode = 'normal';
      const snapshot = await extractSnapshot(page, config);
      assert.equal(snapshot.courses.length, 1);
      assert.equal(snapshot.assignments.length, 2);
      assert.equal(snapshot.assignments[0].dueAt, '2026-09-12T03:59:00.000Z');
      assert.equal(snapshot.assignments[1].title, 'Project 2');
      assert.equal(snapshot.grades[0].value, '9 / 10');
      assert.equal(snapshot.grades.length, 2);
      assert.notEqual(snapshot.grades[0].id, snapshot.grades[1].id);
      assert.ok(!snapshot.courses[0].url.includes('ticket'));
      if (provider === 'gradescope') {
        mode = 'delayed';
        config.courseCount = '#course-count';
        assert.equal((await extractSnapshot(page, config)).courses.length, 2);
        config.courseCount = undefined;
      }
      mode = 'broken';
      await assert.rejects(extractSnapshot(page, config), /ROW_SHAPE_CHANGED/);
      mode = 'empty';
      assert.equal((await extractSnapshot(page, config)).assignments.length, 0);
      if (provider === 'brightspace') {
        mode = 'login';
        await assert.rejects(extractSnapshot(page, config));
      }
    }
    await context.close();
  } finally { await browser.close(); }
});
