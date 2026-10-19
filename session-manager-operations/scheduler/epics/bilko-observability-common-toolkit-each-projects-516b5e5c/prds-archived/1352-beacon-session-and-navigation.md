---
title: Injected beacon: session ids, SPA navigation pageviews, data-track, PII scrub
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 12
createdVia: scheduler-api
issuedAt: 2026-10-18T18:25:30.819Z
sourcePromptId: bilko-observability-common-toolkit-each-projects-516b5e5c
agentType: dev-lead
dependsOn: [session-identity-cookie]
planId: pl-mve5lxlp-756161
---
# Goal

behavior: the server already injects BEACON_JS into every HTML document on bilko.run, which covers the host SPA and every static-path app with zero sibling code. Make it the universal auto-capture layer. It should send the shared session ids with every click, honor data-track names, and scrub PII from click labels and hrefs. It should also send a pageview on the first load and on every SPA navigation, so where a user landed and where they went is captured everywhere.

# Acceptance criteria

- [ ] BEACON_JS in server/click-beacon.ts implements the touchSession rule from the implementation notes. Each click payload adds visitor_id, session_id and track, where track is the closest element's data-track attribute, sliced to 60 chars, or ''.
- [ ] Click PII scrub: the label has email-like substrings replaced with '[email]' and runs of 6 or more digits replaced with '#'. href is sent without its query string or hash. An element inside [data-track-redact] sends label ''.
- [ ] Pageviews: on load, and on history.pushState / history.replaceState / popstate, the beacon calls navigator.sendBeacon('/api/analytics/pageview', JSON) with path, referrer (document.referrer on the first send only, else ''), screen ('WxH'), any utm_source/utm_medium/utm_campaign/utm_term/utm_content from location.search, visitor_id and session_id. It sends only when location.pathname differs from the last sent pathname. It never sends, and records no clicks, while location.pathname starts with /admin, but keeps tracking after the SPA navigates away from /admin.
- [ ] The pushState/replaceState wrappers call the original function with the original this and arguments, return its result, and never throw, even if the beacon code throws.
- [ ] tests/click-beacon.test.ts gets new tests. They run BEACON_JS in node:vm with a stubbed window/document/location/history/navigator.sendBeacon/localStorage, and assert: ids reused from the cookie; the legacy localStorage vid winning; the click payload with track and a scrubbed label and href; an initial pageview plus one per pushState to a new path; none for a replaceState to the same path; none on /admin.
- [ ] Existing injection tests in tests/click-beacon.test.ts and pnpm typecheck pass.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- server/click-beacon.ts
- tests/click-beacon.test.ts

# Implementation notes

Read first: server/click-beacon.ts (whole file); tests/click-beacon.test.ts; server/session-identity.ts (added by PRD session-identity-cookie; it holds the contract doc comment and constants); server/routes/analytics.ts lines 77-100 (the pageview body fields the endpoint reads).

Identity contract: cookie bilko_vid = visitor UUID, Max-Age 31536000; cookie bilko_sid = session UUID, Max-Age 1800 sliding; both `Path=/; SameSite=Lax` plus `; Secure` when location.protocol is 'https:'; not HttpOnly. A valid id matches the UUID regex /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.

touchSession rule (run on every send):
- vid = the valid cookie bilko_vid, else the valid localStorage bilko_vid, else crypto.randomUUID() (with a Math.random v4 fallback).
- If the localStorage vid is valid and differs from the cookie, the localStorage vid wins.
- Write the vid cookie and localStorage bilko_vid.
- sid = the valid cookie bilko_sid, else a new UUID; always rewrite the sid cookie with Max-Age=1800.

Notes:
- The pageview endpoint currently does not JSON.parse a text/plain body. PRD analytics-ingest-session-ids adds that, so send the plain JSON string with sendBeacon, exactly as clicks do today.
- Keep BEACON_JS a self-contained ES5-ish IIFE string with no imports. You may interpolate the cookie names and max-ages from session-identity.ts constants into the template string.
- Mind the escaping: it is a JS template literal, so regex backslashes must be doubled, as the existing \\s+ is.
- The test can build a fake document whose cookie getter/setter emulates a cookie jar, a minimal Element with closest/getAttribute/tagName/textContent, and then vm.runInNewContext(BEACON_JS, ctx).

Do not touch: src/hooks/usePageView.ts (PRD remove-usepageview-pageviews), server/routes/analytics.ts.

# Out of scope

- Removing the React usePageView hook (separate PRD)
- Server ingestion changes

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/click-beacon.test.ts
timeout 300 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
