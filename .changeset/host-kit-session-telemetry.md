---
"host-kit": minor
---

Telemetry SDK joins the site-wide session: visitor/session ids now come from the `bilko_vid` / `bilko_sid` cookies (session cookie re-read and refreshed with a 30-minute sliding Max-Age on every event; a legacy localStorage `bilko_vid` still wins) instead of a per-tab sessionStorage id. The default endpoint is now relative `/api/telemetry` on bilko.run and `https://bilko.run/api/telemetry` elsewhere, and an uninitialized `track()` auto-initializes (app from `/projects/<slug>/`) and batches to `/api/telemetry/event` instead of posting to `/api/analytics/event`. Every event gets `props.path`. New `trackFlow(flow, step, props?)` sends `${flow}.${step}` with `props.flow` / `props.step`.
