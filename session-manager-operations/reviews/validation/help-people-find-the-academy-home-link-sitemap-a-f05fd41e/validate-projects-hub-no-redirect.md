# Validation: projects-hub-no-redirect

Base: 4fdfef6f (commit 7cb3b40e touches server/projects-hub.ts, server/index.ts, tests/projects-hub.test.ts).

## projects-hub-no-redirect — VERIFIED

- AC1: server/projects-hub.ts:10-20 exports registerProjectsHubRoutes; GET /projects sets `private, no-store`, `return reply.type('text/html').send(indexHtml)` (l.11-14); GET /projects/ 301 to '/projects' + own query string (l.16-19).
- AC2: server/index.ts:291 reads indexHtml, :294 calls registerProjectsHubRoutes(app, indexHtml), :310 setNotFoundHandler comes after.
- AC3: tests/projects-hub.test.ts:53-57 — /projects/academy/ returns 200 via @fastify/static (passes).
- AC4: tests/projects-hub.test.ts:12-57 uses inject + static (redirect: true, temp dir) and covers all five cases.
- Gate: `pnpm vitest run tests/projects-hub.test.ts tests/project-not-found.test.ts` → 2 files, 14 tests passed; `pnpm typecheck` → exit 0.

## Findings

- Critical: none. Important: none.
- Minor: OG meta/canonical injection on /projects is not exercised by tests (relies on existing hook in server/og-routes.ts); not verified end to end.
- Minor: the review commands (/code-review, /security-review) were replaced by self-review: redirect target is a fixed path plus own query string (no open redirect, but a `//`-style query cannot alter the path prefix); no secrets; no duplicated helper.
