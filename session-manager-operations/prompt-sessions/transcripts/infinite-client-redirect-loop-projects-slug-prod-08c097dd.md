# Transcript — infinite-client-redirect-loop-projects-slug-prod-08c097dd

## User — 2026-10-17T19:06:28.396Z

This session is INBOUND FEEDBACK from another project: Bilko-Game-Academy (/home/bilko/Projects/Bilko-Game-Academy, session tell-me-a-summary-of-this-project-and-run-it-loc-9d48a074). It was raised while working on: Tell me a summary of this project and run it local to see it  What type of games can this project host?  Where is it hosted?  How does it handle persistence?   Overview of the project. Nobody in this project wrote the report below — an agent working in that project did, and it may be wrong about this codebase. Verify the claim against the code here before acting on it, and if it does not hold, say so and close the session rather than building against it.

Goal: Infinite client redirect loop /projects/<slug>/ <-> /products/<slug>/ when a static-path slug has no published bundle

## Why
The owner opened bilko.run/projects/game-academy/ and the browser bounced endlessly between /projects/game-academy/ and /products/game-academy/. Any static-path registry entry whose bundle was removed (game-academy was unpublished in 89e0a80 but its registry entry kept) turns into a redirect loop instead of a clean 404 or "postponed" page. Game Academy wants to keep /projects/ as its canonical URL and will republish; the host should still never loop.

## Proposed plan
1. When /projects/<slug>/ has no file in public/projects/<slug>/, do not fall through to the SPA index.html (or have the SPA detect it) — serve a real 404 or a 'postponed / not currently published' page.
2. Make MaybeStandaloneRedirect / RedirectProjectsToProducts loop-safe: never hard-navigate to a static-path the SPA itself is currently serving.
3. Add a test covering a registered static-path slug with no bundle.

## Acceptance criteria
- [ ] curl/browser on https://bilko.run/projects/game-academy/ (no bundle) ends on a single page with no redirect cycle
- [ ] A registered static-path slug with a published bundle still serves its bundle at /projects/<slug>/
- [ ] Regression test exists for the missing-bundle case

## Details
Evidence (2026-10-17): curl https://bilko.run/projects/game-academy/ returns 200 with the HOST SPA index.html (title injected as 'Boat Shooter — bilko.run'), because public/projects/game-academy/ was deleted in commit 89e0a80 ('unpublish game-academy: stop serving 116 MB of uncached sprites') while the standalone-projects.json entry (static-path, status postponed) remains.
Loop: SPA route /projects/* -> RedirectProjectsToProducts (src/App.tsx:88-91) Navigates to /products/game-academy/ -> /products/* unknown slug -> MaybeStandaloneRedirect (src/App.tsx:96-111) finds the static-path entry and sets window.location.href = '/projects/game-academy/' -> full reload -> server falls back to SPA index.html again -> repeat.
Likely responsible: src/App.tsx (the two redirect components) and the Fastify static fallback that serves index.html for missing /projects/<slug>/ paths.

Reference: /home/bilko/Projects/Bilko/src/App.tsx

## Agent — 2026-10-17T19:24:38.205Z

The report was right, and the loop is fixed. It's committed as `1580a4b` on this epic branch. I haven't pushed it or merged it to `main`, so bilko.run won't change until that happens.

**What was wrong:** `public/projects/game-academy/` doesn't exist, but its registry entry (static-path, postponed) is still there. So `/projects/game-academy/` fell through to the host site's main page, which sent the browser to `/products/game-academy`. That page found the static-path entry and did a full reload back to `/projects/game-academy/`, and the cycle repeated.

**Fix:**
- **Server** (`server/index.ts`): a `/projects/<slug>/` address that has no published bundle now returns a real 404 status instead of a 200.
- **Site code** (new `src/lib/projectPaths.ts`, used by `RedirectProjectsToProducts` in `src/App.tsx`): for a static-path slug, the site now shows a new "<name> isn't published right now" page (`src/pages/UnpublishedProjectPage.tsx`) and never redirects to `/products`. The no-slash `/projects/<slug>` form does one full reload to the trailing-slash address and stops there. Other slugs still go to `/products/<slug>` as before.
- **Republishing:** when Game Academy republishes, the server serves the bundle again and none of this runs.

**Tests:**
- `tests/spa-fallback-notfound-crash.test.ts` starts the real production server. It now checks that `/projects/game-academy/` returns 404 with no redirect, and that `/projects/local-score/` still serves its own bundle.
- New `tests/projects-path-action.test.ts` covers the routing decision for each kind of project.
- Typecheck and build pass. In the full run, 1,179 of 1,180 tests pass. The one failure is `tests/mcp-dist-sync.test.ts`: it timed out at its 5-second limit in the full run and failed again on its own. I didn't change anything under `mcp-host-server/` and didn't look into why it fails.

I haven't checked the 404 page on the live site yet. That needs a deploy after the merge.

## User — 2026-10-17T23:29:14.761Z

finish all and merge

## Agent — 2026-10-17T23:42:47.877Z

The fix is merged and deployed (`ab7ae3e` on `origin/main`), and the redirect loop is gone on bilko.run.

**Live checks after the deploy:**
- `/projects/unpublished-xyz/` (a slug with no bundle) returns **404** with no redirect.
- `/projects/game-academy/` returns **200** with Game Academy's own page, not the host page. It was republished on `main` while this was in progress, so it no longer has a missing bundle.
- `/projects/local-score/` returns **200** and still serves its bundle.

I confirmed these with curl only. I didn't open the new "isn't published right now" page in a browser; the unit test covers the code that picks it.

**Changes made while merging:**
- **Server test:** it used to check `/projects/game-academy/` for the missing-bundle case. Since game-academy is now published, it uses a made-up slug instead, so it stays valid whatever gets published.
- **`tests/mcp-dist-sync.test.ts`:** its compile check takes about 6 seconds, which was over vitest's default 5-second limit. I raised that test's limit to 30 seconds and it now passes.

Typecheck, build and the full test suite pass: 1184 of 1184 tests. I applied the commit onto the latest `origin/main` in a temporary worktree and removed it afterwards. The epic branch here still has the original commit `1580a4b`, which `main` now supersedes.
