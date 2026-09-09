# Interactive Brightspace and Gradescope connections

This is a **local, single-computer prototype**, wired to the dashboard. Each Connect
button launches a separate Chromium context. Enter credentials and complete MFA
in the service's browser window; then click **I’ve signed in — sync** in BoilerHub.
Keep the service windows open for refreshes. BoilerHub never receives a password
from its frontend, and it does not bypass MFA.

This is not a hosted student authentication system. Browser windows open on the
machine running Node, not on a remote visitor's computer. The new connection routes
are disabled in production and require loopback Host/origin checks. Do not tunnel,
proxy, or expose the development server to a network. All local OS users/processes
are inside this prototype's trust boundary. The opaque HttpOnly cookie isolates app
browser connections but does not verify a university identity or provide app login.

## Run it

1. Install the existing dependencies with `npm install`. If Chromium is missing, run
   `npx puppeteer browsers install chrome`.
2. You can open login windows without `.env.local`: the defaults are Purdue
   Brightspace and Gradescope. To import data after login, create `.env.local`
   with the dashboard URLs and verified selectors below, replacing placeholders.
3. Run `npm run dev:academic`, which enables local connection mode and binds to
   `127.0.0.1:3000`. Stop any existing server on port 3000 first. The command sets
   the local-mode flag and matching origin automatically; no manual flag setup is needed.
4. Open `http://127.0.0.1:3000`, then use **Your academic connections**.
5. Complete each service's login (including institutional SSO and MFA) in the browser
   it opens. Navigate to the configured dashboard if login doesn't land there.
6. Click **I’ve signed in — sync**. The UI displays actual synced courses, assignments,
   and grades separately from the original sample dashboard. Use **Refresh data**
   to sync again or **Disconnect** to clear the connection.

```dotenv
ACADEMIC_LOCAL_MODE=true
ACADEMIC_APP_ORIGIN=http://127.0.0.1:3000

# Placeholders: use the actual institutional login entry and authenticated dashboard.
BRIGHTSPACE_LOGIN_URL=https://courses.example.edu/d2l/login
BRIGHTSPACE_DASHBOARD_URL=https://courses.example.edu/d2l/home
BRIGHTSPACE_READY_SELECTOR=[data-current-term-loaded="true"]
BRIGHTSPACE_COURSE_SELECTOR=[data-current-term-loaded="true"] a[href*="/d2l/home/"]

GRADESCOPE_LOGIN_URL=https://www.gradescope.com/
GRADESCOPE_DASHBOARD_URL=https://www.gradescope.com/account
GRADESCOPE_READY_SELECTOR=[data-course-list-loaded="true"]
GRADESCOPE_COURSE_SELECTOR=[data-course-list-loaded="true"] a[href^="/courses/"]

# Optional Typesense; use a separate local instance/collection namespace for academics.
ACADEMIC_TYPESENSE_URL=http://127.0.0.1:8108
ACADEMIC_TYPESENSE_API_KEY=<server-side key with academic_* collection create/delete/import/search permissions>
```

The example attributes above are **illustrations, not verified Purdue or Gradescope
selectors**. The code is exercised against synthetic pages, not a live account.
A ready selector must uniquely indicate an authenticated, completely loaded list,
including the empty state; never use `body`, a spinner, or a generic app shell.
Use current-term courses rather than pinned-only courses if you want complete data.
Course selectors must match anchors, with numeric IDs in `/d2l/home/<id>` for
Brightspace or `/courses/<id>` for Gradescope.

## Configure assignments and grades

Use either `BRIGHTSPACE` or `GRADESCOPE` in place of `SERVICE` below. Each provider
can be enabled separately. If a section's URL is absent, it is explicitly shown as
**not configured**, not presented as a successful zero-result extraction.

```dotenv
SERVICE_ASSIGNMENTS_URL=https://service.example/courses/{courseId}/assignments
SERVICE_ASSIGNMENTS_READY_SELECTOR=[data-loaded="true"]
SERVICE_ASSIGNMENTS_ROW_SELECTOR=table tbody tr
SERVICE_ASSIGNMENTS_TITLE_SELECTOR=.assignment-title
SERVICE_ASSIGNMENTS_VALUE_SELECTOR=.due-date
SERVICE_ASSIGNMENTS_LINK_SELECTOR=a.assignment-link
# Optional selector matching an enabled next-page button (or disabled on last page).
SERVICE_ASSIGNMENTS_NEXT_SELECTOR=button.next-page

SERVICE_GRADES_URL=https://service.example/courses/{courseId}/grades
SERVICE_GRADES_READY_SELECTOR=[data-loaded="true"]
SERVICE_GRADES_ROW_SELECTOR=table tbody tr
SERVICE_GRADES_TITLE_SELECTOR=.grade-title
SERVICE_GRADES_VALUE_SELECTOR=.grade-value
SERVICE_GRADES_NEXT_SELECTOR=button.next-page

# Optional course-list pagination as well:
SERVICE_COURSE_NEXT_SELECTOR=button.next-page
```

URLs must be HTTPS, on the configured dashboard origin, and contain `{courseId}`.
The paths above are examples: configure the actual institutional paths. Configure
the assignment value selector to the due-date cell and the grade value selector to
the score cell. Selectors for title/value/link are CSS selectors relative to each
row. Page/course/row selectors support Puppeteer's open shadow-root syntax (`>>>`).
Inner cells in separate shadow roots and iframe-based lists need an adapter change.
When pagination exists, configure its next button; otherwise only the rendered
page is read. Infinite scrolling and term-tab selection need an adapter change.
The ready marker must hide during loading and reappear when the next page is complete.

Extraction fails on malformed rows, duplicate assignment identities, stalled pagination,
more than 20 pages per list, or more than 50 courses. Sync has a two-minute deadline.
A failed sync does not overwrite the last complete snapshot. Dates and grades are
kept as displayed strings: the draft does not guess time zones, calculate overall
course grades, or translate score scales. Grade rows may be separate from assignment
rows because the two pages do not necessarily share a stable identifier.

## Frontend/API contract

All new endpoints require `?provider=brightspace` or `?provider=gradescope`. No
credentials, session tokens, target URLs, collection names, or user IDs are passed
in JSON bodies. The browser automatically sends the scoped HttpOnly cookie.
Mutating requests must include the exact configured Origin (normal browser fetch
sets it). All responses use `Cache-Control: private, no-store`; the service worker
uses NetworkOnly for academic GET routes.

| Endpoint | Method | Result |
| --- | --- | --- |
| `/api/academic/connection` | POST | Opens login browser, sets cookie, returns `awaiting_login` |
| `/api/academic/connection` | GET | Returns connection state and last successful snapshot |
| `/api/academic/connection` | DELETE | Closes browser, clears app cookie and snapshot, schedules index deletion |
| `/api/academic/refresh` | POST | Extracts full snapshot and updates optional search index |
| `/api/academic/search&q=...` | GET | Searches only this connection's assignment collection |

The search URL is `/api/academic/search?provider=brightspace&q=project` (or gradescope).
The old bearer-protected `/api/academic/sync` password-based example is preserved
for compatibility; the interactive frontend does not use it.

Snapshot shape:

```json
{
  "courses": [{ "id": "123", "name": "CS 180", "url": "https://service.example/courses/123" }],
  "assignments": [{ "id": "hash", "courseId": "123", "courseName": "CS 180", "title": "Project 1", "url": "https://service.example/courses/123/assignments/1", "due": "Friday 11:59 PM" }],
  "grades": [{ "id": "hash", "courseId": "123", "courseName": "CS 180", "title": "Project 1", "value": "9 / 10" }],
  "coverage": { "assignments": true, "grades": true },
  "syncedAt": "2026-09-08T12:00:00.000Z"
}
```

Search uses a server-generated, random collection per connection, with no shared
student filter supplied by the client. It indexes assignment titles/course names,
source URLs, and displayed due dates; **grades and login cookies are not indexed**.
The server key never enters the browser bundle or the existing public CampusData
search adapter. An index failure leaves the fetched snapshot visible but disables
search. Search returns up to 50 hits and a total match count.

## Session lifecycle and hosted follow-up

Connections expire after 30 minutes and are swept every 30 seconds. Snapshots and
browser handles live only in process memory; restart means reconnect. Chromium may
write temporary files: use an encrypted disk/ephemeral worker volume. No cookie
export, shared user profile, screenshots, traces, or credential logging is enabled.
Browser closure clears the local session but does not revoke institutional SSO.

Disconnect/expiry deletes the connection's Typesense collection; failed deletions
are retried while Node runs. A hard crash can leave orphan collections. Use a
separate disposable local Typesense instance, and delete orphan `academic_*`
collections after stopping BoilerHub. Do not assume Typesense data is memory-only.
Never give the existing browser/public search key access to `academic_*`.

A hosted version needs a real app identity/session, an authenticated interactive
browser service (or local connector/extension), encrypted session vault, persistent
student-owned snapshots, distributed quotas/job processing, and durable index
cleanup. Simply changing `headless: false` to true or removing the local-mode guard
will not make this a remote interactive login flow.

## Validation

- `npm run test:academic`: local-origin/CSRF checks, URL sanitization, configuration,
  and unowned session rejection.
- `npm run test:academic:browser`: Chromium fixtures for both services, shadow DOM,
  pagination, due dates, grades, empty assignments, and selector/login failures.
- `npx tsc --noEmit --incremental false`
- `npm run build`

References: [Puppeteer isolated browser contexts](https://pptr.dev/api/puppeteer.browser.createbrowsercontext)
and [Typesense document operations](https://typesense.org/docs/26.0/api/documents.html).

Login defaults are verified public entry points: [Purdue Brightspace access](https://service.purdue.edu/TDClient/32/Purdue/KB/Article/238/How-do-I-access-D2L-Brightspace)
and [Gradescope login](https://www.gradescope.com/login). Login and extraction
configuration are separate: Connect opens a browser without page selectors; Sync
requires verified dashboard and list selectors. Login success alone does not
verify extraction. Override `BRIGHTSPACE_LOGIN_URL` for another institution.

## This workspace's verified configuration

The local `.env.local` now contains selectors inspected in the signed-in Purdue
Brightspace and Gradescope pages. It is ignored by Git and contains no credentials.
Brightspace uses the selected course-term panel and grade-item table. Gradescope
uses course cards and the student assignment table, including only posted scores
in the grade list (submission status is not treated as a grade).

`ACADEMIC_BROWSER_CHANNEL=chrome` selects the installed Google Chrome for future
connections, avoiding the outdated bundled Chromium warning. Existing connection
windows retain their browser version until reconnected. This still uses isolated
contexts; it does not open or reuse your personal Chrome profile.

Repeated grade labels are retained using row identities local to each snapshot.
Brightspace assignment extraction is not enabled in this workspace yet; Gradescope
assignments and posted scores, plus Brightspace course/grade lists, are configured.

`SERVICE_COURSE_COUNT_SELECTOR` can point to a loaded-list total formatted as
`(N)`. When configured, sync waits for that many cards and refuses a partial list.
The Purdue profile uses this to wait for web-component hydration.

## Assignment tracker

The homepage combines synced assignments into a to-do list and monthly calendar.
Tasks are grouped into overdue, today, the next seven calendar days, later, and
unknown dates. Dates use the source `datetime` value with an explicit offset and
are shown in the viewer's local timezone; display-only dates are not guessed.
Refresh existing snapshots once to populate timestamps and submission status.

The configured Gradescope status selector marks submitted or graded work complete.
Manual checkmarks only affect the tracker, never the LMS. They persist across page
reloads in sessionStorage for the current tab and connection; a new login gets
separate checkmarks. No assignment text, grades, or credentials are stored there.
Calendar and to-do filtering do not depend on Typesense.
