# Validation: academy discoverability plan

Base `96143b9a`; commits a30b5509, 22b2a467, b8006c22, ec6b5e3d, 7343b268, de1b14fd. PRDs read from `prds-archived/`.
Gates re-run in the foreground, all exit 0:
- `pnpm vitest run` on sitemap, agent-storefront, project-not-found, og-meta, mcp-errors-report and mcp-dist-sync: 59 tests passed.
- `pnpm --filter host-kit test`: 40 passed.
- `pnpm --filter host-kit typecheck`: clean.
- `pnpm typecheck`: clean.

## generated-sitemap — VERIFIED
- `server/routes/sitemap.ts` exports `buildSitemapXml`, `registerSitemapRoutes`. Content-Type, Cache-Control and the 10-minute memo are at the end of the file (`MEMO_TTL_MS`, the `/sitemap.xml` handler).
- The six static pages are in order. The project loop keeps `public === true` and `status === 'live'`. Static-path needs `isPublished`, which tests `index.html`. React-route becomes `/products/<slug>`. External-url is skipped.
- Posts are queried with `published = 1 AND datetime(published_at) <= datetime('now')`. lastmod is `YYYY-MM-DD`. `escapeXml` is applied to `<loc>`.
- `robotsDisallows` implements longest match. `public/robots.txt:15` disallows `/projects/game-academy/`.
- `server/index.ts` calls `registerSitemapRoutes(app, { distPath })`. `public/sitemap.xml` is gone (ls: no such file).
- A db error is caught and the sitemap is served without posts.
- `tests/sitemap.test.ts` has 6 tests covering each listed case.

## projects-deep-path-404 — VERIFIED
- `server/project-not-found.ts` follows the spec: regex, index.html returns null, sibling-404 only when published, plain for file extensions, otherwise page.
- `server/index.ts:315-349`: every branch uses `return reply...send`. Sibling 404 and HTML are `private, no-store`. Plain is `public, max-age=300`. An unpublished page sets 404 and falls through to the shell.
- `tests/project-not-found.test.ts` has 9 tests, all listed cases covered.

## og-canonical-link — VERIFIED
- `server/og-meta.ts:174` computes `hasCanonical` on the original HTML. The block injects the canonical only when absent, using the escaped `u`. Existing canonicals are not stripped. `resolveOg` is untouched.
- `tests/og-meta.test.ts` adds 3 tests (injected, preserved with count 1, escaping). 14 passed.

## search-shortcut-ctrl-k-label — VERIFIED
- `SiteHeader.tsx:113-121` `searchShortcutLabel` matches the spec (userAgentData, then platform, then userAgent; undefined gives Ctrl K). It is used for the title and the kbd. `index.tsx` re-exports it.
- `Layout.tsx:13-18` has a module-level helper, used for the chip title and span.
- `.changeset/host-kit-search-shortcut-label.md` marks host-kit as patch.
- `packages/host-kit/tests/site-header-shortcut.test.ts` has 7 tests: mac, iPhone, Windows, Linux, UA fallback, userAgentData precedence, undefined navigator.

## now-items-academy-line — VERIFIED
- `src/data/portfolio.ts:86` holds the exact new line in the third position. The diff changes only that line.

## mcp-flows-report-tool — VERIFIED
- `errors-report.ts:201-211` `flowsReport` sends only the given params, throws on a null body, and returns `{ source: baseUrl(), ...b }`.
- `server.ts:721-740` registers `flows_report` with `days` int 1-30 and `app`. The `app` regex matches `APP_FILTER_RE` at `admin-sessions.ts:8`. The header comment lists it.
- dist rebuilt: `tests/mcp-dist-sync.test.ts` passes. 3 new flowsReport tests in `tests/mcp-errors-report.test.ts`.

## Findings
Critical: none. Important: none.
Minor:
- `src/components/Layout.tsx:122,124` calls `searchShortcutLabel()` twice per render. Harmless.
- `server/routes/sitemap.ts` does not run post slugs through `SLUG_RE`. Slugs come from the DB and `<loc>` is XML-escaped, so this is safe.
- `server/index.ts`: the `reply.status(404)` for an unpublished deep page falls through to the shell without an explicit `return`. It matches the existing root-rule flow.
- The `/code-review` and `/security-review` skills were not run; I self-reviewed the diff instead. I found no secrets, no path traversal (slugs are restricted to `[a-z0-9-]` before path joins) and no unescaped input in the injected HTML.
