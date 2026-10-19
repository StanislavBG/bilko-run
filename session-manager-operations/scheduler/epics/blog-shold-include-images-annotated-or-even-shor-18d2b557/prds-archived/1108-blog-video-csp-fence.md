---
title: Sandboxed, always-enforced CSP fence for /blog-videos/ responses
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-09T21:32:10.045Z
sourcePromptId: blog-shold-include-images-annotated-or-even-shor-18d2b557
agentType: dev-lead
disposition: new-head
planId: pl-mv1hdvwd-aa7421
---
# Goal

Behavior: blog videos are inline-script HTML documents served same-origin from bilko.run at /blog-videos/<slug>/ and framed by the blog post page. They must run under their own strict, always-enforced, sandboxed CSP (opaque origin, no network) instead of the site's nonce-based report-only policy, so a video can never touch Clerk cookies or the network, while still being frameable by bilko.run itself.

# Acceptance criteria

- [ ] server/security-headers.ts: for any request whose path starts with `/blog-videos/`, the onRequest hook sets exactly one CSP header, `Content-Security-Policy` (enforced regardless of BILKO_CSP_ENFORCE), with value `default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; media-src data: blob:; font-src data:; connect-src 'none'; frame-ancestors 'self'; base-uri 'none'; form-action 'none'; sandbox allow-scripts` — and does NOT set Content-Security-Policy-Report-Only for that response.
- [ ] server/security-headers.ts: the onSend hook leaves /blog-videos/ HTML bodies byte-for-byte unchanged (no nonce attributes, no csp-nonce meta, no cache-control override).
- [ ] server/security-headers.ts buildCsp: `frame-src` includes `'self'` in addition to the existing origins.
- [ ] tests/security-headers.test.ts has new tests: a /blog-videos/x/ HTML route gets the enforced fence header with `sandbox allow-scripts` and `frame-ancestors 'self'`, has no report-only header, and its body contains no `nonce=`; a normal HTML route's CSP frame-src contains 'self'. All pre-existing tests in the file still pass.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- server/security-headers.ts
- tests/security-headers.test.ts

# Implementation notes

Read first: server/security-headers.ts lines 1-60 (buildCsp) and 105-170 (onRequest at ~113, onSend at ~139); tests/security-headers.test.ts lines 1-80 (how test routes are registered and injected); ~/Projects/session-manager/src/main/lib/projectHomeAdminRoutes.cjs line 77 (DEMO_VIDEO_CSP — the same policy idea, used for Project Home demo videos; read-only reference, do not edit that repo).

Steps:
1. Red: add the tests to tests/security-headers.test.ts (register a route like `/blog-videos/demo/` returning `reply.type('text/html').send('<html><head></head><body><script>1</script></body></html>')`).
2. Add `export const BLOG_VIDEO_CSP = ...` constant and a helper `isBlogVideoPath(url: string): boolean` (strip query string; startsWith('/blog-videos/')).
3. onRequest: keep the HSTS/nosniff/referrer/permissions/COOP headers; branch the CSP header — fence for blog-video paths, existing behavior otherwise. Still set cspNonce on req (harmless).
4. onSend: return payload unchanged early when isBlogVideoPath(req.url).
5. Add `'self'` to frame-src in buildCsp.
Why: the site policy is report-only by default and frame-ancestors 'none' would forbid framing once enforced; sending both a report-only and an enforced header would make browsers evaluate both.

Do not touch: server/index.ts, server/routes/blog.ts, src/ (sibling PRDs own them).

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/security-headers.test.ts && timeout 300 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
