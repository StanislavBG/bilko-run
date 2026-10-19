# Validation: home-flip-back-fix + home-radar-e2e re-check

Base: be68e73d. Commits since Base on the PRD paths: `8b14f9d0` (flip straight to `/projects?p=`), `1654dd63` (ProjectsPage guard). Port :3002 was free (`ss -ltn`) before the e2e run.

## home-flip-back-button-fix — VERIFIED
- Guard: `git diff 8b14f9d0 -- src/pages/ProjectsPage.tsx` is only `if (searchParams.get('p') === activeSlug) return;`, `if (window.location.pathname !== '/projects') return;`, and `searchParams` added to deps (ProjectsPage.tsx ~L223-233).
- Deep link / `?p=` sync: `e2e/projects-hub.spec.ts` "?p= deep link selects the card and navigation syncs the URL" passed unchanged.
- Immediate-Back test: `e2e/home-radar.spec.ts:76` is a plain `test`, presses `1`, `waitForURL`, `goBack()` at once, then `expectUnflippedHome` (path `/` held 1500ms, no `bk-flip-out`, heading visible). Passed.
- Header-pill test `e2e/home-radar.spec.ts:95` present and passed.
- No `fixme`/`skip`/`BLOCKED` in the spec (grep rc=1).
- `git diff --stat be68e73d..HEAD -- src/pages/ContactPage.tsx src/styles/projects-ring.css` is empty. `src/pages/ProjectsPage.tsx` changed since Base only by the guard above (`8b14f9d0` did not touch it; `1654dd63` is the guard).
- Gate re-run: `vitest run tests/home-radar.test.ts` 12/12 pass; `pnpm typecheck` exit 0; playwright `home-radar` + `projects-hub` 14/14 pass.

## home-radar-e2e — VERIFIED (re-check)
- The spec has no `test.fixme`/`test.skip`. The fourth criterion (`back returns to an un-flipped home`) is now a live test and passes.
- All other criteria: wheel/keys, project blip, channel blips, same chrome, reduced motion and mobile tests all passed in the same 14/14 run.
- Gate: typecheck exit 0 and playwright 14/14.

## Findings
- Critical: none.
- Important: none.
- Minor: the header-pill Back test (`e2e/home-radar.spec.ts:95-101`) does not wait for the `/projects` URL before `goBack()`. It can still pass if Back fires before the navigation commits, so it may under-test the race. Consider adding `waitForURL(/\/projects/)` first.
- Minor: the immediate-Back test relies on the 1500ms hold only. The guard cannot be fully proven against all timings, but it passed in this run.
- Security/code review: diff is a two-line early-return guard plus tests; no input handling, secrets or paths involved.
