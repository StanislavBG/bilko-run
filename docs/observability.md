# Observability: adopting the common toolkit

Every project on bilko.run reports into one shared pipeline, so one visitor's trip across the host and any number of sibling apps reads as a single **session**. This doc is the process to adopt it. The admin view is `/admin/observability`.

Code of record: `server/session-identity.ts`, `server/click-beacon.ts`, `packages/host-kit/src/telemetry.ts`, `server/routes/telemetry.ts`, `server/routes/admin-sessions.ts`.

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
3. In **Sessions**, find your session (filter by app or path). The timeline shows pageviews, clicks (with your `data-track` names), events, logs and errors in order.
4. In **Flows**, find `<flow>` under your app and check the step counts.

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
