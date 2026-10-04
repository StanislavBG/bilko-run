---
title: Bandwidth panel: show egress data on /admin/observability without requiring a published manifest
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 55
createdVia: scheduler-api
issuedAt: 2026-08-14T00:20:38.629Z
sourcePromptId: render-http-bandwith-we-need-to-identify-what-ap-7331446e
---
# Goal

We spent today building per-project and per-file bandwidth metering, and none of it is visible. /admin/observability renders "No manifests published yet" and an empty table, because the whole rollup is built by mapping over app_manifests — bytes-out is only ever attached to a slug that already has a published manifest. Meanwhile GET /api/admin/egress returns the real ranked egress data and has NO UI at all (grep for 'admin/egress' in src/ returns nothing). The data may be collecting perfectly; there is simply nowhere to look at it. Make the bandwidth numbers visible on their own terms.

# Acceptance criteria

- [ ] /admin/observability shows bandwidth rows even when app_manifests is completely empty. Verified by pointing the page at a DB with zero manifests and at least one api_egress_daily row, and seeing the egress row rendered.
- [ ] The bandwidth view is driven by the egress tables (api_egress_daily, static_asset_daily), NOT by a join onto manifests. A project with egress and no manifest still appears; static:_host and static:_other appear as their own rows rather than being dropped.
- [ ] GET /api/admin/egress gets a UI. Either a dedicated Bandwidth panel/section on the observability page or its own admin route — but it must render route rows with bytes, requests, and bytesPerRequest, sorted by bytes descending.
- [ ] Per-file drilldown from PRD 998 is reachable: for a given project slug, the top paths by bytes from static_asset_daily are viewable, including the folded `_rest` row. This is the view that would have identified the 10 sprite PNGs over 2 MB without manual du/curl work.
- [ ] Empty state is honest and distinguishes causes: "no traffic recorded in this window" must read differently from "metering has not started / table is empty", using the earliest-date signal already implemented in usage_report. The current message ("No manifests published yet. Run emit-manifest.mjs...") must NOT be shown when the real situation is "no egress rows yet".
- [ ] The existing manifest-driven per-app table keeps working unchanged when manifests DO exist — this adds a view, it does not replace the rollup.
- [ ] pnpm test and pnpm build pass.

# Implementation notes

ROOT CAUSE, confirmed in the working tree:

server/routes/admin-observability.ts:134 — `const rows: Row[] = manifests.map(m => {...})`. Every row originates from a manifest. traffic24h and bytesOut24h are looked up FROM maps keyed by manifest slug (lines 121-122, 147-148). No manifest ⇒ no row ⇒ bytes invisible. The bytesOut query itself (added by PRD 997, around line 70) is correct and returns data independent of manifests — it is only the render that drops it.

src/pages/admin/ObservabilityPage.tsx already has the "Bytes out" column header (line ~244) and fmtBytesOut rendering (~321). That part shipped fine; it is just never reached because the rows array is empty.

`grep -rn "admin/egress" src/` returns NOTHING — the /api/admin/egress endpoint (server/routes/admin-observability.ts:156) has no frontend consumer at all. topEgress() is at server/egress.ts and already returns method/route/requests/bytes/bytesPerRequest.

Per-file data comes from static_asset_daily (added by PRD 998, server/db.ts + server/egress.ts) — bounded to ASSET_TOP_N=50 per (date, slug) plus a folded `_rest` row. There is already a reader function in server/egress.ts for the per-asset rows; reuse it rather than writing new SQL.

Do not regress the accuracy caveat that static:_host absorbs top-level static dirs (/outdoor-hours/, /apps/, /session-manager-operations/) — surface it in the UI the same way usage_report surfaces it in its notes, so nobody reads _host as pure host chrome.

Design note worth honouring: the manifest-driven table answers "is each app healthy". The bandwidth view answers "where are the bytes going". They are different questions over different key sets and should not be forced into one table — that coupling is exactly what made today's data invisible.

# Out of scope

- Fixing the static:_host attribution gap itself — surface it, don't fix it here.
- Any change to how egress is measured or bucketed — 995/997/998 all validated clean; this is purely a read/render problem.
- Cache-Control or Render edge-caching changes.

## Engineering standards

Before writing any code, read `/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` — it has the Performance, Debugging,
API-reuse, TDD, and Execution-discipline rules that apply to this PRD. Every rule in it is
mandatory, especially Execution discipline (bounded commands, verify before done, the
finish-protocol sentinel).
