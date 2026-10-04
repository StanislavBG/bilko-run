---
title: Close three egress-metering blind spots: streamed API responses, unmatched /api/ 404s, and per-asset attribution
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 60
createdVia: scheduler-api
issuedAt: 2026-08-13T23:05:07.484Z
sourcePromptId: render-http-bandwith-we-need-to-identify-what-ap-7331446e
---
# Goal

The egress meter now covers /api/* route patterns and per-project static buckets, but three categories of bytes are still counted as zero or not counted at all. Two of them are on routes that serve whole files, so they are exactly the shape most likely to be expensive. Close them so "we are collecting usage per endpoint" is true without asterisks.

# Acceptance criteria

- [ ] Streamed /api/* responses record real byte counts instead of 0. server/egress.ts:69-75 sizeOf() returns 0 for anything that is not a string/Buffer/Uint8Array, and at least two API routes send streams: server/routes/manual.ts:167 (reply.send(createReadStream(full))) and server/routes/project-events.ts:101 (reply.sendFile(...)). Verified by requesting each and asserting the recorded bytes are non-zero and match the file size.
- [ ] Unmatched /api/* requests (404s) are recorded somewhere rather than vanishing. Today the onSend hook requires a matched route pattern (server/egress.ts:133) and the onResponse hook early-returns on any /api/ path (server/egress.ts:145), so a 404 under /api/ is counted by neither. Bucket them under a single bounded key (e.g. `api:_notfound`) — never per-URL.
- [ ] Per-asset attribution is available for static traffic without unbounded cardinality: it must be possible to answer "which FILE under a project burned the bytes", not only "which project". Suggested approach: a bounded top-N heavy-hitter table (e.g. top 50 paths by bytes per day, everything else folded into an `_rest` row) rather than a row per URL. Whatever the design, state the cardinality bound explicitly in a comment.
- [ ] The existing per-project and per-route numbers are unchanged in shape and key naming — usage_report and /api/admin/egress keep working without modification to their callers.
- [ ] Tests cover all three: a streamed API route records non-zero bytes, an unmatched /api/ 404 lands in its bucket, and per-asset rows stay bounded when N distinct URLs are requested.
- [ ] pnpm test and pnpm build both pass.

# Implementation notes

Read server/egress.ts in full first — the design constraints in its header comment (never key on resolved URL, never write on the request path, never fail a response) still apply and are the reason the current gaps exist.

The likely unifying fix for gaps 1 and 2: the onResponse hook already reads Content-Length correctly (server/egress.ts:121-126, 140-153) and that mechanism works for streams. Consider routing ALL responses through the onResponse Content-Length path and keeping onSend only where a payload measurement is genuinely better, rather than maintaining two measurement strategies with different blind spots. If you do that, be careful not to double-count — there is an existing regression test for exactly that at tests/egress.test.ts:187 and :200.

Note Content-Length may be absent on chunked/streamed responses. If so, measure by counting bytes written to the raw socket rather than reintroducing a zero. Do not silently record 0 — a wrong zero is worse than a missing row because it reads as "this endpoint is free".

For gap 3, the motivating case is concrete: game-academy's 116.5 MB was 117 individual sprite PNGs, and identifying that required manual du + curl work. Per-project granularity would have said "game-academy is heavy" but not "these 10 files over 2 MB are the problem".

Do not regress the accuracy note already surfaced in usage_report's output about static:_host absorbing top-level dirs (/outdoor-hours/, /apps/, /session-manager-operations/) — that gap is tracked separately and should stay visible until fixed.

# Out of scope

- Fixing the top-level-static-dir attribution gap (static:_host inflation) — separate follow-up.
- Cache-Control headers or Render edge-caching configuration.
- Reconciling any of these numbers against Render billing.

## Engineering standards

Before writing any code, read `/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` — it has the Performance, Debugging,
API-reuse, TDD, and Execution-discipline rules that apply to this PRD. Every rule in it is
mandatory, especially Execution discipline (bounded commands, verify before done, the
finish-protocol sentinel).
