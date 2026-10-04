---
title: Extend egress metering to static/project asset responses, keyed by project slug
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 75
createdVia: scheduler-api
issuedAt: 2026-08-13T19:28:40.347Z
sourcePromptId: render-http-bandwith-we-need-to-identify-what-ap-7331446e
---
# Goal

The host has per-route API egress metering (server/egress.ts, added 2026-08-13) but it is blind to static files, which is where essentially all of the bandwidth goes. A 17.51 GB / 5 GB Render overage was traced to game-academy's 116.5 MB of incompressible sprites purely by measuring assets on disk and probing URLs with curl — the platform itself could not answer "which project is burning bandwidth". Extend the meter to cover static responses, bucketed by project slug, so that question is answerable from the admin dashboard instead of by hand.

# Acceptance criteria

- [ ] GET /api/admin/egress returns static-asset egress rows alongside the existing /api/* route rows, with each static row keyed by project slug (e.g. `static:game-academy`, `static:outdoor-hours`) plus a `static:_host` bucket for the host's own dist assets (index.html, /assets/*, og images).
- [ ] Byte counts for static responses are correct and non-zero: verified by requesting a known-size asset and asserting the recorded bytes match its content-length. Note server/egress.ts:67-73 sizeOf() returns 0 for streams and @fastify/static replies with a stream, so payload-based measurement WILL silently record zeros — read content-length from the reply (e.g. in onResponse) instead.
- [ ] 304 Not Modified and 404 responses are recorded with 0 bytes but still counted in `requests`, so revalidation volume is distinguishable from transfer volume.
- [ ] Cardinality stays bounded: keys are per-slug, never per-URL. A request to an unknown /projects/<x>/ path does not create an unbounded number of distinct keys — cap or bucket unrecognised slugs into `static:_other`.
- [ ] The existing /api/* metering behaviour is unchanged — same keys, same values — and its tests still pass.
- [ ] Metering still never fails a response and never writes to the DB on the request path (keep the buffered + timer-flush design and the swallow-everything error handling documented in server/egress.ts:14-21).
- [ ] The admin observability per-app rollup (server/routes/admin-observability.ts) shows bytes-out per app next to the existing traffic24h count, so an app with 3 visits and 350 MB is visually distinct from one with 3000 visits and 3 MB.
- [ ] A test covers the static path end-to-end: request a static fixture, flush, assert the row lands under the right slug with the right byte count.

# Implementation notes

Read server/egress.ts first — the design constraints in its header comment (lines 14-21) are load-bearing and must be preserved: key on pattern not URL, never write on the request path, never fail a response.

Two independent reasons the current meter cannot see static traffic, both must be fixed:
1. server/egress.ts:80 filters `route && route.startsWith('/api/')`. Static files have no matched route at all (the comment at line 79 says so explicitly), so they are dropped before anything else happens.
2. server/egress.ts:67-73 sizeOf() returns 0 for anything that is not a string/Buffer/Uint8Array. @fastify/static serves streams, so even after removing the filter every static row would record 0 bytes. Switch to reading the response content-length rather than measuring the payload — an onResponse hook can read reply.getHeader('content-length'). Confirm behaviour for HEAD and for range requests.

Slug extraction: the static-path contract is /projects/<slug>/... (see docs/host-contract.md and the existing SUBSTR/INSTR slug extraction at server/routes/admin-observability.ts:55-56, which does the same thing against page_views — reuse that shape rather than inventing a second parser). Anything not under /projects/ is host chrome → `static:_host`.

Schema: api_egress_daily (server/db.ts:355) is keyed (date, method, route) with an ON CONFLICT upsert. The static keys fit that table as-is if you use the `static:<slug>` convention for the route column — prefer that over a second table unless there is a concrete reason.

Context that motivated this, worth preserving in a comment so the next person does not re-derive it: PNGs are already compressed and transfer byte-for-byte, while JSON/JS gets brotli'd ~3-24x by Render's edge. Measured on the wire: a 2.58 MB sprite transfers 2.58 MB, whereas outdoor-hours' 2.01 MB hourly JSON transfers 87 KB. So on-disk size is a bad proxy for egress and the meter has to measure actual bytes, which is exactly the mistake this PRD exists to stop repeating.

Do NOT re-publish or restore public/projects/game-academy/ — it was deliberately unpublished in 89e0a80 and its sprites need WebP conversion in the sibling repo (~/Projects/Bilko-Game-Academy) before it comes back.

# Out of scope

- Converting the Boat Shooter sprites to WebP — that is the sibling repo's work, not the host's.
- Setting Cache-Control headers on @fastify/static or enabling Render edge caching — related to the bill but a separate change with its own risk profile.
- Any attempt to reconcile these numbers against Render's billing figures. This is capacity signal, not billing, exactly as the existing header comment states.

## Engineering standards

Before writing any code, read `/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` — it has the Performance, Debugging,
API-reuse, TDD, and Execution-discipline rules that apply to this PRD. Every rule in it is
mandatory, especially Execution discipline (bounded commands, verify before done, the
finish-protocol sentinel).
