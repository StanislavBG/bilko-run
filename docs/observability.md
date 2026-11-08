# Observability: adopting the common toolkit

Every project on bilko.run reports into one shared pipeline, so one visitor's trip across the host and any number of sibling apps reads as a single **session**. This doc is the process to adopt it. The admin view is `/admin/observability`.

Code of record: `server/session-identity.ts`, `server/click-beacon.ts`, `packages/host-kit/src/telemetry.ts`, `server/routes/telemetry.ts`, `server/routes/admin-sessions.ts`, `server/traffic-filters.ts`, `mcp-host-server/src/report-tools.ts`.

## 1. What you get for free

Zero code, zero config. The host injects a small beacon script (`BEACON_JS`, `server/click-beacon.ts`) into every HTML document it serves: the SPA shell and every static-path app under `/projects/<slug>/`.

- **Pageviews** on load and on every SPA navigation (`pushState`, `replaceState`, `popstate`) → `POST /api/analytics/pageview`. Routes under `/admin` are skipped.
- **Clicks** on `a`, `button`, `[role=button]`, `summary`, `input[type=submit|button]` and anything with `data-track` → `POST /api/analytics/click`. Each click records path, tag, element id, label, href (query and hash stripped) and the `data-track` name.
- **Server page hits.** The server also logs each HTML request itself (`page_hits`), so even a page where scripts fail shows up.
- All of it is stitched into one session by the `bilko_vid` / `bilko_sid` cookies (section 2).

Labels are scrubbed in the browser: emails become `[email]`, runs of 6+ digits become `#`, labels are cut at 80 characters.

## 2. Identity contract

| Cookie | Meaning | Lifetime |
|---|---|---|
| `bilko_vid` | visitor UUID | Max-Age 1 year |
| `bilko_sid` | session UUID | 30-minute **sliding** idle window |

- Both are first-party, `Path=/`, `SameSite=Lax` (+`Secure` on https), and deliberately **not** HttpOnly so client JS can read them.
- The whole site is one origin, so every tab and every app shares them. Two tabs open at once are one session. Each qualifying page load, beacon call or SDK call re-stamps `bilko_sid`, so the window slides; 30 minutes with no activity in any tab ends the session, and the next activity starts a new one.
- A valid id is a UUID. Anything else counts as absent and is never stored.
- The server mints missing ids on HTML responses. The beacon and the SDK also mint and refresh them client-side. The visitor id is mirrored in `localStorage` (`bilko_vid`) so it survives cleared cookies.
- On the wire the fields are `visitor_id` and `session_id`. The cookie wins over any id in the body, and `/api/telemetry/*` stamps the cookie ids onto every record, so you never manage ids yourself.
- Storage: `session_id` on `page_views`, `page_hits`, `click_events`, `funnel_events`, `app_logs`, `app_errors`; `client_vid` and `track_name` on `click_events`; `client_vid` on `page_hits`.

## 3. Tagging

```html
<button data-track="pricing-buy-pro">Buy Pro</button>
```

- `data-track="<kebab-name>"`: names the click. It lands in `click_events.track_name` (max 60 chars) and shows in the session timeline. Unique per app. Put it on the clickable element or any ancestor.
- `data-track-redact`: put it on an element (or ancestor) whose label could hold personal text; the click is recorded with an empty label.

Naming convention: see section 9.

## 4. SDK (`host-kit`)

For anything the beacon cannot see: flows, errors, logs.

```ts
import { initTelemetry, track, trackFlow, log, logError } from 'host-kit';

initTelemetry({ app: 'my-app', version: '1.2.0' });   // once, at boot

track('screen_view', { screen: 'results' });            // one event
trackFlow('checkout', 'click-buy', { product: 'pro' }); // one step of a flow
log.warn('quota near limit', { used: 9 });              // structured log
try { await save(); } catch (e) { logError(e as Error, { where: 'save' }); }
```

- `initTelemetry({ app, version })`: idempotent. Also installs `window.error` and `unhandledrejection` capture. `app` is your slug. Optional `sampleInfo` (default 0.1) and `endpoint`.
- `env`: host-kit 0.11.0+ stamps every event, log and error with `env`, resolved once at init: `prod` on bilko.run and www.bilko.run (automation there included; the bot filters handle it), otherwise `test` when the browser reports `navigator.webdriver` (Playwright, Selenium) and `dev` for everything else (localhost, LAN addresses, any other host). `initTelemetry({ app, version, env })` overrides it; any value but `prod`, `dev` or `test` is ignored. The host counts a record without `env` as prod, and host-kit before 0.11.0 sends none, so its local runs land in production numbers until you upgrade. `flows_report` and `errors_report` read `env=prod` by default (section 11).
- `track(name, props)` → `POST /api/telemetry/event` → `funnel_events`. Auto-inits (app from `/projects/<slug>/`, version `unknown`) if you never called `initTelemetry`. `props.path` defaults to the current pathname.
- `trackFlow(flow, step, props)`: sugar for `track('<flow>.<step>', { ...props, flow, step })`. Both parts must match `^[a-z0-9][a-z0-9-]{0,39}$`; otherwise the call is silently dropped.
- `log.info|warn|error(msg, fields)` → `/api/telemetry/log` → `app_logs`. `info` is sampled (10% by default); `warn` and `error` are kept; `error` flushes immediately.
- `logError(err, context)` → `/api/telemetry/error` → `app_errors`. 100% captured, de-duplicated at 3 per minute per fingerprint. Needs `initTelemetry` first.
- Batched: one request per channel per 5 s, flushed on page hide. `flush()` forces it. Never throws.
- Default endpoint is relative (`/api/telemetry`) on bilko.run and `https://bilko.run/api/telemetry` elsewhere (local dev).

## 5. Primary-flow checklist for a new app

1. Pick 3-5 primary flows (the things a visitor came to do: score a thing, buy, download, finish a lesson).
2. Name each flow and its steps in kebab-case (`score`, `start`, `results-shown`).
3. Emit a **start** step when the visitor commits (`click-run`) and a **success** step when the outcome lands (`results-shown`). Add a failure step if there is one.
4. Add `data-track` to the buttons that begin each flow.
5. Call `initTelemetry` once; wrap risky calls with `logError`.
6. Verify (section 7).

Keep it small: five flows with clean start/success pairs beat thirty loose events.

## 6. PII rules

- No emails, tokens, passwords or free text in `props`, `fields` or `context`. Use ids, enums, counts and booleans.
- Never put user-typed text, document contents, or prompts in an event.
- Never attach price amounts to a person.
- `stripPII` is a safety net, not a licence: any prop key matching `/(email|password|token|key|ssn|card|cvv|apikey)/i` has its value replaced with `[redacted]` before sending. Values are not inspected, so don't rely on it for free text under an innocent key.
- Use `data-track-redact` where a button label can carry personal text.

## 7. Verify

1. Open your app on bilko.run in a fresh tab and click through a flow.
2. Open `/admin/observability` (admin sign-in).
3. In module **02 Sessions · journeys**, find your session (filter by app or path). The journey shows pageviews, clicks (with your `data-track` names), events, logs and errors in order.
4. In module **03 App health**, click your app's tile to open the detail sheet and check the `<flow>` funnel step counts.

No rows? Check that the request hit bilko.run (not localhost), that `flow` and `step` are kebab-case, and that the `/api/telemetry/*` calls in DevTools return 200 (a 429 means a quota; the SDK retries nothing, so slow down).

## 8. Rollout

1. In your app, bump the host-kit dependency (`"host-kit": "file:../Bilko/packages/host-kit"` for local siblings, or the current `^` release).
2. `pnpm install`.
3. Add `initTelemetry`, the `data-track` attributes and `trackFlow` calls.
4. Rebuild and republish via the bilko-host MCP (`publish_static_project`).
5. Verify (section 7).

If the host-kit source changed, build it first in the Bilko repo: `pnpm --filter host-kit build`, then `pnpm install` in each app.

## 9. Tagging taxonomy

These conventions are already sent to sibling repos. Do not drift from them.

- **Pages.** Every route is auto-captured. Screens that do not change the URL emit `track('screen_view', { screen: '<kebab>' })`.
- **Buttons.** Every primary button/link gets `data-track="<area>-<action>"` (kebab, unique per app). Monetization buttons use the prefix `buy-` / `tip-` / `subscribe-`; download buttons use `download-`.
- **Monetization flow.** `trackFlow('checkout', step)` with steps `view-offer`, `click-buy`, `checkout-redirect`, `success`, `cancel` and props `{ product, plan? }`. Never price amounts tied to a person, never emails.
- **Download flow.** `trackFlow('download', step)` with steps `click-download`, `download-started`, `download-failed` and props `{ artifact, version, platform }`.
- **Tip flow.** `trackFlow('tip', step)` with steps `click-tip`, `checkout-redirect`, `success`.
- **Plain-HTML pages without a bundler** may post straight to the endpoint:

```js
navigator.sendBeacon('/api/telemetry/event', new Blob([JSON.stringify({
  batch: [{ app: '<slug>', name: '<flow>.<step>', ts: Date.now(),
            props: { flow: '<flow>', step: '<step>', path: location.pathname } }],
})], { type: 'application/json' }));
```

The server stamps `session_id` / `visitor_id` from the cookies.

> **Code differs from the sent snippet.** The taxonomy as sent passes `JSON.stringify(...)` directly to `sendBeacon`. That goes out as `text/plain`, and `/api/telemetry/event` only reads a parsed JSON body (`server/routes/telemetry.ts` `batchOf`), so the batch would be ignored (`ingested: 0`). Wrap the string in a `Blob` with type `application/json`, as above. The body shape (`batch[]` with `app`, `name`, `ts`, `props`) is otherwise exactly as sent.

## 10. Public telemetry beacons (endpoints, limits, retention)

Unauthenticated POST endpoints on bilko.run that any app (a browser bundle, a CLI, an Electron desktop app on a stranger's laptop) can report into with nothing configured. Code: `server/routes/telemetry.ts`, registered in `server/index.ts` via `registerTelemetryRoutes(app)`.

| Route | Table | Shape | Per-IP limit |
|---|---|---|---|
| `POST /api/telemetry/event` | `funnel_events` | `{ batch: [{ name, app, props, visitor_id, session_id }] }` | 1200/min |
| `POST /api/telemetry/log` | `app_logs` | `{ batch: [{ app, version, level, msg, visitor_id, session_id, fields, ts }] }` | 600/min |
| `POST /api/telemetry/error` | `app_errors` | `{ batch: [{ app, version, name, msg, stack, url, ua, visitor_id, session_id, context, ts }] }` | 300/min |
| `POST /api/telemetry/install` | `app_installs` | single object (machine profile + optional `seeds`), upsert keyed on `install_id` | 60/min |
| `POST /api/analytics/pageview` | `page_views` | `{ path, referrer, screen, visitor_id, session_id, utm_* }` (injected beacon) | event-rate limiter |
| `POST /api/analytics/click` | `click_events` | `{ path, tag, id, label, href, visitor_id, session_id, track }` (injected beacon; `track` is the `data-track` name) | event-rate limiter |

`MAX_BATCH` is 50 records; the server body limit is 2 MB (`server/index.ts`); stacks clamp at 16 KB, other strings at their column widths. Session columns are listed in section 2.

### Design constraint: zero user-facing auth

There is no API key, no OAuth, no account. A first run must succeed, so every abuse control is identity-free. Responses:

- **Malformed request:** `400`, currently only `install` with no `install_id`.
- **Quota exceeded** (per-IP, per-install, per-app ceiling): `429 { error: "quota_exceeded", retryAfterSec }` with a `Retry-After` header. A `200` would tell a desktop client the batch was delivered, so it would drop the batch from its queue and lose a boot backlog or crash burst. Clients back off and retry on `429` and do not treat it as "stop reporting". The quota check is all-or-nothing per request and consumes no budget when it refuses, so a retried batch never double-inserts.
- **Records that can never be valid** (an `app` that is not slug-shaped, a `/log` record with an invalid level): dropped silently inside a `200 { ok: true }`, never charged.
- Nothing answers `403` for throttling.

### Abuse controls

- **Per-install (`visitor_id`) limits:** 200/hour and 2000/day per install UUID. Records with no `visitor_id` are exempt (per-IP and the app ceiling still cover them).
- **Shape rejection before any INSERT:** `app` must match `/^[a-z0-9][a-z0-9._-]{0,59}$/i`. There is no hardcoded app allowlist.
- **Per-app daily ceiling:** 250 000 records/day per `app`.
- **Beacon tag:** clients may send `X-SM-Beacon: <client>/<version>`. It is not a secret and not authentication. It only gives recognised client traffic its own per-IP bucket. Untagged traffic is never dropped for being untagged.

### Retention

Pruned opportunistically on the write path (at most every 10 min per process), plus a daily scheduled prune:

| Table | Retention |
|---|---|
| `app_logs` | 30 days, capped at 200 000 rows |
| `app_errors` | 90 days, capped at 100 000 rows |
| `funnel_events` | 180 days (daily prune; only rows that carry an `env` or `version`) |
| `app_installs` | 365 days since `last_seen_at` (daily prune) |

### No PII

`app_installs` carries the anonymous install UUID and a machine profile (platform, arch, cpu count, memory, versions, locale, timezone, first-run setup outcomes). It has no column that can hold an email, username or hostname, and must not gain one; `tests/telemetry.test.ts` asserts this.

### First-run setup outcomes

An install POST may carry `seeds`: the client's first-run setup steps and how each one ended. Session Manager sends `{ "devPlugin": "done", "schedulerMcp": "failed", "agentPersonas": "pending" }`. Step names belong to the client. The server keeps a step only when its name is slug-shaped (the `app` pattern, after clamping to 60 chars) and its value is `done`, `pending`, `failed` or `exhausted`, and keeps at most 20 steps. Anything else is dropped, never a 4xx. `app_installs.seeds` holds the kept steps as JSON, or NULL when none are left. Every upsert overwrites it, so a POST without `seeds` clears it.

### CORS

`@fastify/cors` restricts browser origins to bilko.run in production. It does not reject requests with no `Origin` header, so a desktop main process or CLI POSTs successfully. Cross-origin browser callers are blocked.

### Admin surface

`GET /api/admin/observability/installs?app=<slug>` returns installs, 7-day actives, platform/arch splits, installs per setup step and outcome (`installs.bySeed`), and an errors-by-version rollup. Admin-only. `GET /api/admin/session-manager/usage` has the same per-step rollup as `installs.seeds` and each machine's steps as `perInstall[].seeds`.

## 11. Reading your numbers through the bilko-host MCP

From your own repo, read your app's numbers with the `bilko-host` MCP report tools. They need the admin key (`mcp-host-server/README.md`). They count **real visitors by default**, so the owner and automation are left out unless you opt in.

| Tool | Admin API | Default | Opt-out |
|---|---|---|---|
| `flows_report` | `GET /api/admin/flows` | `mine=exclude&bots=exclude&env=prod` | `includeMine: true` sends `mine=include`; `includeBots: true` sends `bots=include`; `env: 'dev'`, `'test'` or `'all'` sends that `env` |
| `sessions_report` | `GET /api/admin/sessions` (`/:id` for timelines) | `mine=exclude&bots=exclude` | `includeMine` / `includeBots`, as `flows_report`; no `env` filter |
| `traffic_report` | `GET /api/admin/traffic` | `mine=exclude&bots=include` | `excludeSelf: false` sends `mine=include`; `includeBots: false` sends `bots=exclude` |
| `funnel_report` | `GET /api/admin/funnel` | owner and bot sessions excluded (the host's defaults) | none |

**The owner (`mine=exclude`)** means:

- rows flagged `is_admin` (requests made while signed in as admin);
- every device seen signed in as admin in the last 30 days, including its signed-out visits: its `bilko_vid` cookie id, and for page hits and clicks its IP+user-agent hash;
- every device marked as the owner's on `/admin/secrets`, however long ago it last signed in;
- rows sent with the `bilko_internal=1` marker cookie (the owner's automation): see [Internal traffic marker](host-contract.md#internal-traffic-marker).

`flows_report` also drops events and errors from any session with an admin or marked page view. `sessions_report` drops the whole session.

**Bots (`bots=exclude`)** means UA-flagged automation:

- page views and clicks whose user agent is a crawler, script, AI agent or API client, HeadlessChrome and Playwright included;
- page views and clicks from a browser that reported `navigator.webdriver`. Headed Playwright and agent browsers keep a normal Chrome user agent, so this flag is their tell. It also re-flags that device's last 24 hours;
- telemetry events and errors whose request user agent is not a person's browser (the telemetry UA class, flagged at ingest).

`flows_report` also drops events and errors from any session with a bot-flagged page view. `sessions_report` drops every session with a bot-flagged page view, event or error.

`traffic_report` keeps `bots=include` by default because its human numbers (visitors, hits, pages, referrers, countries, devices) exclude bot hits either way. `bots=exclude` only trims `byClass` and `topPagesByClass` to the non-bot classes.

`funnel_report` has no opt-out. It drops sessions with an admin or bot-flagged page view, sessions from the owner's devices (seen signed in as admin in the last 30 days, or marked), the owner's own checkout and free-hour events, and anything under an admin email.

**Not caught:** automation that shows a normal browser user agent without `navigator.webdriver`, on a device never signed in as admin or marked, still counts as a visitor unless it sends the [internal traffic marker](host-contract.md#internal-traffic-marker).

**Telemetry env (`env=prod`)**, `flows_report` only. It always sends `env`, `prod` by default, so local dev and automated test runs stay out of your numbers:

- `prod` counts rows tagged `prod` and rows with no `env` (host-kit before 0.11.0 and other clients). `dev` and `test` rows are left out.
- host-kit 0.11.0+ tags a run `dev` on localhost and any other non-bilko.run host, and `test` there when the browser reports `navigator.webdriver` (section 4). Automation on bilko.run itself stays `prod`; the bot filters handle it.
- `env: 'dev'` or `env: 'test'` counts only that env; `env: 'all'` turns the filter off.
- It covers telemetry events, errors and flow steps. Page views and clicks carry no `env`: only the bilko.run beacon writes them.

Every report but `funnel_report` returns the host's `filters` echo (`{ mine, bots }`, plus `env` from `flows_report` and `mineHits` from `traffic_report`), so you can see what was applied. `filters: null` means a host older than these filters, which applied neither. A `flows_report` echo without `env` means a host older than the env filter, which counted every env.

`sessions_report` never returns an email. Its fields are allowlisted, event `props` lose every email-named key at any depth, and an email address inside any string becomes `[email]`.
