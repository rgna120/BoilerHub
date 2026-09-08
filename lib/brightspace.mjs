import puppeteer from 'puppeteer';

// Configuration is trusted server configuration, NEVER URLs supplied by an API caller.
export async function scrapeBrightspace({ username, password }, config) {
  if (typeof username !== 'string' || !username.trim() || username.length > 320 ||
      typeof password !== 'string' || !password || password.length > 4096) {
    throw new Error('INVALID_CREDENTIALS');
  }
  const httpsURL = (value) => {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error('INVALID_CONFIG');
    return url;
  };
  const login = httpsURL(config.loginUrl);
  const dashboard = httpsURL(config.dashboardUrl);
  const casOrigin = httpsURL(config.casOrigin).origin;
  if (!config.readySelector || !config.courseSelector) throw new Error('INVALID_CONFIG');
  const usernameSelector = config.usernameSelector || '#username';
  const passwordSelector = config.passwordSelector || '#password';
  const submitSelector = config.submitSelector || 'button[type="submit"]';
  let browser;
  let context;
  let phase = 'START';
  try {
    // Keep Chromium's sandbox and TLS certificate validation enabled.
    browser = await puppeteer.launch({ headless: true });
    // A fresh context per request isolates students' cookies and local storage.
    // Never use a shared userDataDir or log cookies, passwords, page HTML, or traces.
    context = await browser.createBrowserContext();
    const page = await context.newPage();
    page.setDefaultTimeout(30_000);
    page.setDefaultNavigationTimeout(30_000);
    phase = 'AUTH';
    // Start at the LMS SSO entry point so CAS receives the correct service ticket target.
    await page.goto(login.href, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector(usernameSelector, { visible: true });
    if (new URL(page.url()).origin !== casOrigin) throw new Error('UNEXPECTED_LOGIN_ORIGIN');
    await page.waitForSelector(passwordSelector, { visible: true });
    // Refuse a form that sends the password to another origin or over HTTP.
    const safeForm = await page.$eval(passwordSelector, (input, origin) => {
      const form = input.form;
      return form && form.method.toLowerCase() === 'post' &&
        new URL(form.action, location.href).origin === origin && location.origin === origin;
    }, casOrigin);
    if (!safeForm) throw new Error('UNEXPECTED_LOGIN_FORM');
    await page.type(usernameSelector, username);
    await page.type(passwordSelector, password);
    // Register before clicking to avoid missing fast redirects. Do not retry passwords.
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
      page.click(submitSelector),
    ]);
    // Wrong credentials / MFA remain at the identity provider and time out safely.
    await page.waitForFunction(origin => location.origin === origin, {}, dashboard.origin);
    phase = 'COURSES';
    await page.goto(dashboard.href, { waitUntil: 'domcontentloaded' });
    if (new URL(page.url()).origin !== dashboard.origin) throw new Error('SESSION_EXPIRED');
    // Must identify the loaded CURRENT-TERM list (including its empty state),
    // not a spinner or generic dashboard shell. Configure for your institution.
    await page.waitForSelector(config.readySelector, { visible: true });
    // Puppeteer selectors such as `>>> a` can traverse open shadow roots.
    const courses = await page.$$eval(config.courseSelector, (links, origin) => {
      const result = new Map();
      for (const link of links) {
        const name = (link.getAttribute('aria-label') || link.textContent || '').replace(/\s+/g, ' ').trim();
        const href = link.getAttribute('href');
        if (!href || !name) continue;
        const url = new URL(href, location.href);
        // Only return canonical Brightspace course links, never CAS tickets or query tokens.
        if (url.origin !== origin || !/^\/d2l\/home\/\d+\/?$/.test(url.pathname)) continue;
        url.search = '';
        url.hash = '';
        url.pathname = url.pathname.replace(/\/$/, '');
        result.set(url.href, { name, url: url.href });
      }
      return [...result.values()];
    }, dashboard.origin);
    return courses;
  } catch {
    // Raw browser errors can expose URLs containing service tickets. Return only safe codes.
    throw new Error(phase === 'AUTH' ? 'AUTHENTICATION_INCOMPLETE' : 'SCRAPE_FAILED');
  } finally {
    // Never return session cookies to the caller. Context closure discards session state.
    // If persistence is later required: encrypt at rest with a managed key, bind to the
    // authenticated student, use a short TTL, and delete on logout/revocation. Never
    // commit cookie files. Preserve Secure/HttpOnly/SameSite flags when restoring them.
    // Browser processes may use temporary disk files: use an isolated worker with an
    // encrypted/ephemeral temp volume. JS strings cannot be reliably zeroed from memory.
    try { await context?.close(); } finally { await browser?.close(); }
  }
}
