---
title: Observability adoption guide + host-contract telemetry section refresh
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 8
sourcePromptId: bilko-observability-common-toolkit-each-projects-516b5e5c
agentType: dev-lead
createdVia: scheduler-api
issuedAt: 2026-10-18T18:30:23.157Z
dependsOn: [beacon-session-and-navigation, host-kit-shared-session-sdk, admin-flows-api, analytics-ingest-session-ids, telemetry-ingest-cookie-session]
planId: pl-mve5mpcr-a175c5
---
# Goal

doc: write the process that every bilko.run project follows to adopt the common observability toolkit. It covers what is captured automatically with zero code, how to tag buttons and primary flows, how to report errors and logs, the naming and PII rules, and how to verify in the admin Sessions and Flows dashboard. Point the host contract, which sibling Claude sessions read via the bilko-host MCP, and the host-kit README at it, and fix their stale telemetry facts.

# Acceptance criteria

- [ ] New docs/observability.md has these sections. (1) What you get for free: the server-injected beacon gives pageviews on load and SPA navigation plus clicks on a/button/[role=button]/summary/[data-track], all stitched by the bilko_vid/bilko_sid cookies; server page hits. (2) Identity contract: the cookie names, lifetimes, the 30-minute sliding idle window and cross-tab behavior. (3) Tagging: data-track="<kebab-name>" and data-track-redact. (4) SDK: initTelemetry({ app, version }), track(name, props), trackFlow(flow, step, props), log.*, logError, with host-kit code examples. (5) Primary-flow checklist for a new app: pick 3-5 flows, name kebab-case steps, emit a start step and a success step. (6) PII rules: no emails, tokens or free text in props; stripPII key list. (7) Verify: open /admin/observability, find your session in Sessions, see your flow in Flows. (8) Rollout: bump the host-kit file dependency, pnpm install, then republish.
- [ ] docs/observability.md also has a "(9) Tagging taxonomy" section stating these exact conventions, which have already been sent to sibling repos and must not drift: Pages: every route is auto-captured; screens that do not change the URL emit track('screen_view', { screen: '<kebab>' }). Buttons: every primary button/link gets data-track="<area>-<action>" (kebab, unique per app); monetization buttons use the prefix buy- / tip- / subscribe-, download buttons download-. Monetization flow: trackFlow('checkout', step) with steps view-offer, click-buy, checkout-redirect, success, cancel and props { product, plan? } (never price amounts tied to a person, never emails). Download flow: trackFlow('download', step) with steps click-download, download-started, download-failed and props { artifact, version, platform }. Tip flow: trackFlow('tip', step) with click-tip, checkout-redirect, success. Plain-HTML pages without a bundler may POST navigator.sendBeacon('/api/telemetry/event', JSON.stringify({ batch: [{ app: '<slug>', name: '<flow>.<step>', ts: Date.now(), props: { flow, step, path: location.pathname } }] })) — the server stamps the session ids from the cookie.
- [ ] In docs/host-contract.md, the 'Telemetry contract' section (around lines 362-390) is rewritten to match the code. track goes to funnel_events, not analytics_events. Uninitialized track() auto-inits and no longer posts to /api/analytics/event. The default endpoint is relative on bilko.run. The section links docs/observability.md, and any stale usePageView() mention (around line 35) is corrected.
- [ ] packages/host-kit/README.md documents initTelemetry, track, trackFlow, log and logError in a few lines each and links ../../docs/observability.md. The stale line saying track POSTs to /api/analytics/event is fixed.
- [ ] docs/telemetry-beacons.md's endpoint table adds the click beacon and pageview fields (visitor_id, session_id, track) and the new columns (session_id, client_vid, track_name) and links docs/observability.md.
- [ ] Every API name, endpoint, cookie name and column in the docs matches the landed code. Check against server/session-identity.ts, server/click-beacon.ts, packages/host-kit/src/telemetry.ts and server/routes/admin-sessions.ts. If the landed code contradicts the taxonomy above (e.g. the /api/telemetry/event body shape), document the code's truth and say so in the report.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- docs/observability.md
- docs/host-contract.md
- packages/host-kit/README.md
- docs/telemetry-beacons.md

# Implementation notes

Read first: server/session-identity.ts, server/click-beacon.ts BEACON_JS, packages/host-kit/src/telemetry.ts, server/routes/telemetry.ts (all landed by the earlier PRDs in this plan: read them, don't assume); docs/host-contract.md lines 25-40 and 355-395; packages/host-kit/README.md; docs/telemetry-beacons.md.

Keep the voice direct and plain-English. Do not add prose-grepping tests: per CLAUDE.md, tests must exercise code.

Do not touch: any code file.

# Out of scope

- (none)

# Gate

This PRD has no runnable check. Check each acceptance criterion by reading the files.

```gate
none
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
