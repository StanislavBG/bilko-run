# Public telemetry beacons

Unauthenticated POST endpoints on bilko.run that any app — a browser bundle, a CLI,
an Electron desktop app on a stranger's laptop — can report into with nothing configured.

| Route | Table | Shape | Per-IP limit |
|---|---|---|---|
| `POST /api/telemetry/event` | `funnel_events` | `{ batch: [{ name, app, props, visitor_id, session_id }] }` | 1200/min |
| `POST /api/telemetry/log` | `app_logs` | `{ batch: [{ app, version, level, msg, visitor_id, session_id, fields, ts }] }` | 600/min |
| `POST /api/telemetry/error` | `app_errors` | `{ batch: [{ app, version, name, msg, stack, url, ua, visitor_id, session_id, context, ts }] }` | 300/min |
| `POST /api/telemetry/install` | `app_installs` | single object, upsert keyed on `install_id` | 60/min |
| `POST /api/analytics/pageview` | `page_views` | `{ path, referrer, screen, visitor_id, session_id, utm_* }` (injected beacon) | event-rate limiter |
| `POST /api/analytics/click` | `click_events` | `{ path, tag, id, label, href, visitor_id, session_id, track }` (injected beacon; `track` is the `data-track` name) | event-rate limiter |

Session columns: `session_id` on `page_views`, `page_hits`, `click_events`, `funnel_events`, `app_logs`, `app_errors`; `client_vid` (cookie visitor id) on `click_events` and `page_hits`; `track_name` on `click_events`. The pageview and click beacons are injected into every HTML page by the host; ids come from the `bilko_vid`/`bilko_sid` cookies (`server/session-identity.ts`), which win over body ids.

Adoption process, tagging rules and PII rules: [observability.md](observability.md).

`MAX_BATCH` is 50 records; the server body limit is 2 MB (`server/index.ts`); stacks clamp at
16 KB, other strings at their column widths. Everything is registered in `server/index.ts` via
`registerTelemetryRoutes(app)`.

## Design constraint: zero user-facing auth

There is no API key, no OAuth, no account. A first run must succeed. Consequently every abuse
control here is identity-free, and **all of them drop silently with `200 { ok: true }`**. A
non-2xx is reserved for a genuinely malformed request — currently only `install` with no
`install_id` (400). The pre-existing per-IP limiter still answers `429`, which clients back off
from rather than disable on. Nothing here may ever answer `403` for throttling: a client that
reads 4xx as "the contract is broken, stop reporting" would be permanently silenced by a
transient burst.

## Abuse controls

- **Per-install (`visitor_id`) limits** — 200/hour and 2000/day per install UUID. Catches what
  per-IP misses in both directions: one looping install behind CGNAT, and an office of five real
  installs sharing an egress IP. Records with no `visitor_id` are exempt (per-IP and the app
  ceiling still cover them).
- **Shape rejection before any INSERT** — `app` must match `/^[a-z0-9][a-z0-9._-]{0,59}$/i`.
  There is no hardcoded app allowlist to maintain; anything not slug-shaped is not ours.
- **Per-app daily ceiling** — 250 000 records/day per `app`, so one pathological release cannot
  fill the DB overnight even if it rotates UUIDs and IPs.
- **Beacon tag** — clients may send `X-SM-Beacon: <client>/<version>`. It ships inside a public
  npm package, so it is **not a secret and is not authentication**. Its only job is to give
  recognised client traffic its own per-IP bucket, so a scanner hammering a public POST route
  cannot exhaust the budget of a real install behind the same IP. Untagged traffic is never
  dropped for being untagged.
- **Retention** — opportunistic prune on the write path (at most every 10 min/process):
  `app_logs` 30 days / 200 000 rows, `app_errors` 90 days / 100 000 rows.

## No PII

`app_installs` carries the anonymous install UUID and a machine profile (platform, arch, cpu
count, memory, versions, locale, timezone). It has **no column that can hold an email, username
or hostname**, and must not gain one — a test in `tests/telemetry.test.ts` asserts this. The
former `identify_email` column was dropped.

## CORS

`@fastify/cors` restricts *browser* origins to bilko.run in production. It does not reject
requests that carry no `Origin` header, so a desktop main process or CLI POSTs successfully.
Cross-origin browser callers would be blocked — these beacons are meant to be called
same-origin or from a non-browser client.

## Admin surface

`GET /api/admin/observability/installs?app=<slug>` — installs, 7-day actives, platform/arch
splits, and an errors-by-version rollup. Admin-only.
