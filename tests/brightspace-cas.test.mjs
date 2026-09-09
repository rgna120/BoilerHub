import { test } from 'node:test';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';
import { scrapeBrightspace } from '../lib/brightspace.mjs';

test('CAS POST login returns canonical courses and closes its browser on success and failure', async () => {
  const launch = puppeteer.launch.bind(puppeteer);
  const browsers = [];
  let unsafe = false;
  let submissions = 0;
  puppeteer.launch = async options => {
    const browser = await launch(options);
    browsers.push(browser);
    const createContext = browser.createBrowserContext.bind(browser);
    browser.createBrowserContext = async () => {
      const context = await createContext();
      const newPage = context.newPage.bind(context);
      context.newPage = async () => {
        const page = await newPage();
        await page.setRequestInterception(true);
        page.on('request', request => {
          const url = new URL(request.url());
          // All requests are synthetic: no real university or credentials are used.
          if (url.href === 'https://courses.example/d2l/login') {
            void request.respond({ status: 302, headers: { location: 'https://cas.example/login' } });
          } else if (url.origin === 'https://cas.example' && request.method() === 'GET') {
            void request.respond({ status: 200, contentType: 'text/html', body: `<form method="post" action="${unsafe ? 'https://untrusted.example/login' : '/login'}"><input id="username" name="username"><input id="password" name="password" type="password"><button type="submit">Log in</button></form>` });
          } else if (url.origin === 'https://cas.example' && request.method() === 'POST') {
            submissions++;
            const body = new URLSearchParams(request.postData());
            assert.equal(body.get('username'), 'fixture-student');
            assert.equal(body.get('password'), 'fixture-password');
            void request.respond({ status: 302, headers: { location: 'https://courses.example/d2l/home', 'set-cookie': 'session=fixture; Secure; HttpOnly; SameSite=Lax' } });
          } else if (url.href === 'https://courses.example/d2l/home') {
            void request.respond({ status: 200, contentType: 'text/html', body: '<div id="loaded"><a href="/d2l/home/123?ticket=secret">CS 180</a><a href="/d2l/home/123/">CS 180</a><a href="https://other.example/d2l/home/456">Other site</a></div>' });
          } else void request.respond({ status: 404, body: '' });
        });
        return page;
      };
      return context;
    };
    return browser;
  };
  const config = { loginUrl: 'https://courses.example/d2l/login', dashboardUrl: 'https://courses.example/d2l/home',
    casOrigin: 'https://cas.example', readySelector: '#loaded', courseSelector: '#loaded a' };
  try {
    const result = await scrapeBrightspace({ username: 'fixture-student', password: 'fixture-password' }, config);
    assert.deepEqual(result, [{ name: 'CS 180', url: 'https://courses.example/d2l/home/123' }]);
    assert.equal(browsers[0].connected, false);
    unsafe = true;
    await assert.rejects(scrapeBrightspace({ username: 'fixture-student', password: 'fixture-password' }, config), /AUTHENTICATION_INCOMPLETE/);
    assert.equal(submissions, 1);
    assert.equal(browsers[1].connected, false);
  } finally {
    puppeteer.launch = launch;
    await Promise.all(browsers.map(browser => browser.close()));
  }
});
