# Brightspace course sync

`lib/brightspace.mjs` exports `scrapeBrightspace({ username, password }, config)`.
It uses the existing Puppeteer dependency. `POST /api/academic/sync` invokes it
and returns `{ success: true, courses: [{ name, url }] }`.

Set these in server-only environment configuration (never `NEXT_PUBLIC_*`):

```dotenv
ACADEMIC_SYNC_TOKEN=<random secret of at least 32 characters>
BRIGHTSPACE_LOGIN_URL=https://courses.example.edu/d2l/login
BRIGHTSPACE_DASHBOARD_URL=https://courses.example.edu/d2l/home
CAS_ORIGIN=https://sso.example.edu
CAS_USERNAME_SELECTOR=#username
CAS_PASSWORD_SELECTOR=#password
CAS_SUBMIT_SELECTOR=button[type="submit"]
# Illustrative selectors only: inspect your institution's rendered DOM.
BRIGHTSPACE_READY_SELECTOR=[data-current-term-loaded="true"]
BRIGHTSPACE_COURSE_SELECTOR=[data-current-term-loaded="true"] a[href*="/d2l/home/"]
```

The LMS login URL must redirect to CAS with the correct service parameter. The
generic example expects a POST form and a navigation after submission. Adapt it
for institutions with an SSO-choice screen, JS-only forms, or other login steps.
MFA/CAPTCHA are not bypassed; this example returns an authentication error if login
does not finish. Do not repeatedly retry credentials.

The ready selector must indicate a fully loaded course list, including an empty
state. The course selector must match anchors in the current-term list. If the
dashboard only shows pinned courses, select the current term and load every page
before extraction. These institution-specific steps are not implemented here;
the generic script returns only the matching rendered courses. Puppeteer's `>>>`
selector can traverse open shadow roots. Iframes require selecting the appropriate
frame before querying. Course links are deduplicated and restricted to same-origin
`/d2l/home/<numeric-id>` URLs, with query strings and fragments removed.

For a trusted backend caller:

```js
const response = await fetch('https://your-app.example/api/academic/sync', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${process.env.ACADEMIC_SYNC_TOKEN}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ username, password }),
});
const result = await response.json();
```

Use HTTPS and disable request-body logging in proxies, APM, and application logs.
The bearer token is for server-to-server access; never ship it to the frontend.
Before exposing a student-facing endpoint, use your application's student-session
authentication, CSRF protection where applicable, and distributed per-user rate
limits. The existing busy guard only limits concurrency inside one process; enforce
request deadlines, rate limits, and worker limits at your gateway/queue as well.
Deploy on a Node host that supports Chromium and its sandbox.

Cookies stay inside a fresh browser context per request, and cleanup runs on both
success and failure. Do not log or export cookies or reuse browser profiles across
students. Chromium may use temporary disk files: isolate workers and use encrypted
or ephemeral temporary storage. If session persistence becomes necessary, encrypt
it with managed keys, bind it to the authenticated student, apply short expiry,
preserve cookie security attributes, and delete it on logout/revocation. Browser
cleanup does not itself revoke the remote CAS session.

This implements Brightspace course names and URLs only. Gradescope needs its own
SSO entry point, authenticated-page checks, and extraction logic; it is not scraped
by this endpoint.

Validation: `node --check lib/brightspace.mjs` and
`npx tsc --noEmit --incremental false`. A real institution login has not been tested.

References: [Puppeteer page interactions](https://pptr.dev/guides/page-interactions)
and [authentication-state sensitivity](https://playwright.dev/docs/auth).
