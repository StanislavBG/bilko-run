---
title: Compress responses at the origin — Render bills uncompressed bytes because only Cloudflare compresses
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 45
createdVia: scheduler-api
issuedAt: 2026-08-14T04:11:24.670Z
sourcePromptId: render-http-bandwith-we-need-to-identify-what-ap-7331446e
---
# Goal

The new bandwidth panel produced its first real data and exposed a large, cheap win. The host does NOT compress responses — @fastify/compress is neither a dependency nor registered. Cloudflare compresses at the edge, so users get small payloads, but Render's origin egress (what is billed) is the FULL uncompressed size. Measured live: GET /api/projects/social-signals-trader/snapshot is ~93 KB on the wire after brotli but the meter recorded ~733 KB per request at the origin — roughly an 8x multiplier being paid on every JSON and HTML response the host serves. Compress at the origin so billed bytes match what users actually receive.

# Acceptance criteria

- [ ] The host sends compressed responses for compressible content types. Verified by requesting a JSON endpoint with `Accept-Encoding: br, gzip` directly against the origin (bypassing Cloudflare if possible, or by checking that the ORIGIN sets content-encoding rather than relying on the edge) and confirming a content-encoding header set by Fastify.
- [ ] GET /api/projects/:slug/snapshot for social-signals-trader drops from ~733 KB to under 150 KB as measured by the egress meter's recorded bytes (not by the edge-compressed wire size).
- [ ] Already-compressed content types are NOT re-compressed: PNG/JPEG/WebP/woff2 and other binary assets must pass through untouched. Verified by asserting no content-encoding on a sprite/image response.
- [ ] A size threshold is set so tiny responses aren't compressed (CPU cost exceeds benefit) — state the chosen threshold in a comment.
- [ ] The egress meter keeps recording correct byte counts after compression is added. This is the subtle risk: server/egress.ts measures Content-Length in onResponse and falls back to bytes written to the socket. Confirm the recorded number reflects the COMPRESSED size actually leaving the origin, not the pre-compression payload — otherwise the panel will report a saving that did not happen. Add a test.
- [ ] Static assets served by @fastify/static are covered too, not just API routes — the panel shows static:social-signals-trader at 25.2 MB across 1,098 requests, and that bundle is JS/CSS/JSON.
- [ ] pnpm test and pnpm build pass.

# Implementation notes

EVIDENCE (measured live against production today):

  $ curl -H 'Accept-Encoding: br, gzip' https://bilko.run/api/projects/social-signals-trader/snapshot
    → 93,047 bytes on the wire (Cloudflare brotli)
  Egress panel, same route: 26 requests / 18.6 MB / 733 KB per request

The gap is the point: Cloudflare compresses edge→user, but Render already paid to ship 733 KB origin→edge. Render bills origin egress.

  $ grep -n compress package.json           → nothing
  $ grep -rn "fastify/compress" server/index.ts → nothing

So: add @fastify/compress and register it in server/index.ts. Register it BEFORE @fastify/static (registration order matters for the onSend chain) — the static plugin's responses must also flow through the compressor.

CRITICAL INTERACTION — do not skip: server/egress.ts was rewritten twice today (PRDs 995, 998) and now measures bytes in an onResponse hook, preferring Content-Length and falling back to a raw-socket write counter installed in an onRequest hook. Compression changes Content-Length and can remove it entirely (chunked). If the meter ends up recording the pre-compression size, the bandwidth panel will show a phantom saving and we will have made the observability worse while making the bill better. Verify empirically, and add a test asserting the recorded bytes match the compressed output size.

Also note server/security-headers.ts installs an onSend hook (CSP nonce injection) — check ordering interactions there too.

Threshold guidance: @fastify/compress's `threshold` option; ~1 KB is a common choice. Do not compress below it.

SEPARATE OBSERVATION worth a look but NOT this PRD's job: the panel shows POST /api/security/csp-report at 1,465 requests / 0 bytes — the highest request count on the board. Zero egress, but something is firing CSP violations constantly. File separately if it turns out to be a real misconfiguration.

# Out of scope

- Enabling Render's edge caching or setting Cache-Control values — related but separate, and it interacts with deploy-time ETag churn.
- Reducing the snapshot payload's own size (that is the social-signals-trader sibling's data shape, not the host's).
- Investigating the csp-report request volume.

## Engineering standards

Before writing any code, read `/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` — it has the Performance, Debugging,
API-reuse, TDD, and Execution-discipline rules that apply to this PRD. Every rule in it is
mandatory, especially Execution discipline (bounded commands, verify before done, the
finish-protocol sentinel).
