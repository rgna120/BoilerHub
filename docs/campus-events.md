# BoilerLink calendar events

Open Calendar in the homepage tracker. “Show BoilerLink events” is enabled by
default. Gold markers represent assignment deadlines; blue markers represent
public campus events. Select a day to see event times, locations, organizers, and
links to the original listings. This works without an academic account connection.

The backend reads the anonymous JSON feed used by
[BoilerLink's public events page](https://boilerlink.purdue.edu/events). It requests
approved events overlapping the visible six-week calendar using `endsAfter` and
`startsBefore`, follows pagination, and includes only Public/Approved records.
The source is the website's discovery endpoint, not a guaranteed stable API.

`GET /api/events?start=<ISO timestamp>&end=<ISO timestamp>` accepts up to 45 days.
URLs and upstream parameters are fixed on the server; incoming headers and academic
cookies are never forwarded. No credentials or browser automation are needed.
TLS-validated HTTPS requests use IPv4 to support this machine's network routing.

Successful results are cached for five minutes, with duplicate requests combined
and a bounded cache. Each range is limited to 2,000 records and a bounded request
budget. Truncation or malformed omitted records are indicated in the UI. Upstream
failures show a retry message while assignment deadlines remain available.

Timestamps retain their UTC offsets and display in the viewer's local timezone.
Multi-day events appear on each day they overlap; an event ending at midnight does
not appear on the following day. Events are informational: opening a listing does
not RSVP or add attendance. Check the original listing for updates or restrictions.

Validation: `npm run test:events` covers parsing, public visibility, pagination,
range bounds, failed feeds, and multi-day/midnight behavior. The live September
calendar range was checked against BoilerLink's feed.
