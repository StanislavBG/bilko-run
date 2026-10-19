# Transcript — git-viewer-hosted-free-tier-3-projects-1-paid-st-032b4dba

## User — 2026-10-14T15:28:01.592Z

This session is INBOUND FEEDBACK from another project: git-viewer (/home/bilko/Projects/git-viewer, session saas-whats-the-plan-to-be-a-saas-and-be-able-to--e8a5a1c7). It was raised while working on: SAAS?  Whats the plan to be a SAAS and be able to host other user's pages and keep them fresh? This seems complicated, I also don't want to add more security or other stuff like auth, tokens.   Can it be done? if not, its ok to not be SAAS just out own personal Agentic Resume. Nobody in this project wrote the report below — an agent working in that project did, and it may be wrong about this codebase. Verify the claim against the code here before acting on it, and if it does not hold, say so and close the session rather than building against it.

Goal: git-viewer hosted free tier: 3 projects → 1 (paid stays 12)

## Why
Owner decision (2026-10-13): the hosted git-viewer free tier at bilko.run/projects/git-viewer/?u=<login> should show 1 project instead of 3. The quote: "just 1 project, if the service is good ppl will pay to unlock more." Free lets anyone try the service. The $5/mo git_viewer plan unlocks up to 12 chosen repos, daily refresh and the Writing tab, and doesn't change. The git-viewer repo is updating its library constant, landing copy, docs and its own bilko.run listing (git-viewer PRDs 37-39). The limit that actually applies lives in Bilko's server, and the pricing page copy is Bilko's too.

## Proposed plan
1. server/routes/tools/git-viewer.ts: set PLAN_LIMITS to { free: 1, paid: 12 } and update the header comment ('Free: 3 projects' -> 'Free: 1 project').
2. Make existing cached free profiles pick up the new cap on their next regeneration, so free pages don't keep showing 3 projects. For example, mark free rows stale (updated_at = 0) in a one-off migration or at boot, so they rebuild the next time someone views them or in the weekly sweep. Paid and showcase rows stay untouched.
3. src/pages/PricingPage.tsx (~line 127): change the git-viewer free features from '3 projects' to '1 project'.
4. Update tests/git-viewer.test.ts for the new limit and the stale-free-rows behavior, run the suite, and deploy.

## Acceptance criteria
- [ ] PLAN_LIMITS in server/routes/tools/git-viewer.ts is { free: 1, paid: 12 }.
- [ ] A fresh free build via GET /api/git-viewer/u/<uncached-login> returns data.projects with length <= 1, and lockedCount counts the rest.
- [ ] A previously cached free profile with 3 projects is rebuilt with 1 project the next time it's viewed after deploy (or in the weekly sweep), without a manual DB edit.
- [ ] Paid and showcase (stanislavbg) profiles are unaffected and still show up to 12.
- [ ] The bilko.run pricing page lists '1 project' for the git-viewer free tier.
- [ ] tests/git-viewer.test.ts passes with the new limit.

## Out of scope
- Price changes ($5/mo stays)
- Rate-limit or refresh-cadence changes (just landed in 27ec48a)
- git-viewer's own listing, which git-viewer updates itself via update_project_listing

## Details
Current state (Bilko main, after 27ec48a):
- server/routes/tools/git-viewer.ts:34 `export const PLAN_LIMITS = { free: 3, paid: 12 } as const;`, used at ~:189 as `maxProjects: paid ? PLAN_LIMITS.paid : PLAN_LIMITS.free`.
- server/routes/tools/git-viewer.ts:16 header comment says "Free: 3 projects".
- src/pages/PricingPage.tsx:127 `features: ['3 projects', 'Public repos only', 'Refreshed at most once a day', 'Bilko branding']`.
- src/data/standalone-projects.json git-viewer listing mentions "top 3 projects". git-viewer owns that listing and is updating it itself via the bilko-host update_project_listing tool (git-viewer PRD 39), so don't hand-edit it here.

Client side: git-viewer's ProjectsTab already renders '+N more projects' upgrade cards from lockedCount, so the dashboard needs no change for the server to cap at 1. The npm library @bilkobibitkov/git-viewer's exported PLAN_LIMITS also moves to free: 1 in the next release, but Bilko keeps its own copy, so no dependency bump is required.

Reference: /home/bilko/Projects/Bilko/server/routes/tools/git-viewer.ts
Reference: /home/bilko/Projects/Bilko/src/pages/PricingPage.tsx
Reference: /home/bilko/Projects/Bilko/tests/git-viewer.test.ts

## Agent — 2026-10-14T15:46:16.602Z

The feedback was accurate except for one point, and the change is now live on bilko.run in commit `0b052fc`. The live rebuilds haven't happened yet because the server has used up its GitHub request allowance (details under "Not yet confirmed live").

**What was right:** the limit was `{ free: 3, paid: 12 }` in `server/routes/tools/git-viewer.ts`, the header comment said "Free: 3 projects", and the pricing page listed '3 projects'.

**What was wrong:** the report assumed the showcase profile (`stanislavbg`) already showed up to 12 projects. It didn't. It was on the free tier with 3 projects, so this change would have cut it to 1. I made showcase logins always build at the paid tier, so the sample page shows up to 12 projects and the Writing tab.

**Changes:**
- **Limit and comment:** `PLAN_LIMITS` is now `{ free: 1, paid: 12 }` and the header comment says "Free: 1 project".
- **Showcase:** a free-tier cached copy of a showcase profile is now rebuilt at the paid tier the next time it's viewed.
- **Existing free profiles:** a one-time database update (in `server/db.ts`) marks every cached free profile as out of date. Unclaimed ones rebuild with 1 project the next time someone views them. Claimed ones rebuild in the next background sweep. Paid profiles aren't touched.
- **Pricing page:** the git-viewer free tier now says '1 project'.
- **Tests:** `tests/git-viewer.test.ts` now expects a free build to have 1 project and the showcase to build at paid. Two new tests cover the stale marking (free rows marked, paid rows unchanged, then rebuilt with 1 project on view or in the sweep) and the showcase upgrade on view.
- **Checks:** typecheck passes and the full suite passes (103 files, 1169 tests).

**Live after deploy:**
- The pricing page code on bilko.run says "1 project".
- The database update ran: cached free profiles now report `updatedAt` 1970, which means they're marked for rebuild.

**Not yet confirmed live:** no profile has rebuilt yet. `stanislavbg` is still free with 3 projects. A request for an uncached login returns 503 with `retryAfterSec: 1056`, so new builds are blocked for about 18 minutes from around 8:45 AM PDT, until the allowance resets.

I couldn't see the Render logs, so I can't tell whether this change caused the overrun or it was already happening. One possible cause: after the restart, the background sweep queued the larger paid showcase build plus every claimed free profile, all at once. Once the allowance resets, viewing the showcase page should rebuild it at paid; I didn't see that happen because this run ended first. If it still shows 3 projects an hour or more after the reset, look at the GitHub rate-limit line in the git-viewer startup logs on Render.

I didn't touch git-viewer's own listing; git-viewer is updating that itself.

## User — 2026-10-14T15:46:16.610Z

This session is INBOUND FEEDBACK from another project: git-viewer (/home/bilko/Projects/git-viewer, session saas-whats-the-plan-to-be-a-saas-and-be-able-to--e8a5a1c7). It was raised while working on: SAAS?  Whats the plan to be a SAAS and be able to host other user's pages and keep them fresh? This seems complicated, I also don't want to add more security or other stuff like auth, tokens.   Can it be done? if not, its ok to not be SAAS just out own personal Agentic Resume. Nobody in this project wrote the report below — an agent working in that project did, and it may be wrong about this codebase. Verify the claim against the code here before acting on it, and if it does not hold, say so and close the session rather than building against it.

Goal: git-viewer hosted free tier: 3 projects → 1 (paid stays 12)

## Why
Owner decision (2026-10-13): the hosted git-viewer free tier at bilko.run/projects/git-viewer/?u=<login> should show 1 project instead of 3. The quote: "just 1 project, if the service is good ppl will pay to unlock more." Free lets anyone try the service. The $5/mo git_viewer plan unlocks up to 12 chosen repos, daily refresh and the Writing tab, and doesn't change. The git-viewer repo is updating its library constant, landing copy, docs and its own bilko.run listing (git-viewer PRDs 37-39). The limit that actually applies lives in Bilko's server, and the pricing page copy is Bilko's too.

## Proposed plan
1. server/routes/tools/git-viewer.ts: set PLAN_LIMITS to { free: 1, paid: 12 } and update the header comment ('Free: 3 projects' -> 'Free: 1 project').
2. Make existing cached free profiles pick up the new cap on their next regeneration, so free pages don't keep showing 3 projects. For example, mark free rows stale (updated_at = 0) in a one-off migration or at boot, so they rebuild the next time someone views them or in the weekly sweep. Paid and showcase rows stay untouched.
3. src/pages/PricingPage.tsx (~line 127): change the git-viewer free features from '3 projects' to '1 project'.
4. Update tests/git-viewer.test.ts for the new limit and the stale-free-rows behavior, run the suite, and deploy.

## Acceptance criteria
- [ ] PLAN_LIMITS in server/routes/tools/git-viewer.ts is { free: 1, paid: 12 }.
- [ ] A fresh free build via GET /api/git-viewer/u/<uncached-login> returns data.projects with length <= 1, and lockedCount counts the rest.
- [ ] A previously cached free profile with 3 projects is rebuilt with 1 project the next time it's viewed after deploy (or in the weekly sweep), without a manual DB edit.
- [ ] Paid and showcase (stanislavbg) profiles are unaffected and still show up to 12.
- [ ] The bilko.run pricing page lists '1 project' for the git-viewer free tier.
- [ ] tests/git-viewer.test.ts passes with the new limit.

## Out of scope
- Price changes ($5/mo stays)
- Rate-limit or refresh-cadence changes (just landed in 27ec48a)
- git-viewer's own listing, which git-viewer updates itself via update_project_listing

## Details
Current state (Bilko main, after 27ec48a):
- server/routes/tools/git-viewer.ts:34 `export const PLAN_LIMITS = { free: 3, paid: 12 } as const;`, used at ~:189 as `maxProjects: paid ? PLAN_LIMITS.paid : PLAN_LIMITS.free`.
- server/routes/tools/git-viewer.ts:16 header comment says "Free: 3 projects".
- src/pages/PricingPage.tsx:127 `features: ['3 projects', 'Public repos only', 'Refreshed at most once a day', 'Bilko branding']`.
- src/data/standalone-projects.json git-viewer listing mentions "top 3 projects". git-viewer owns that listing and is updating it itself via the bilko-host update_project_listing tool (git-viewer PRD 39), so don't hand-edit it here.

Client side: git-viewer's ProjectsTab already renders '+N more projects' upgrade cards from lockedCount, so the dashboard needs no change for the server to cap at 1. The npm library @bilkobibitkov/git-viewer's exported PLAN_LIMITS also moves to free: 1 in the next release, but Bilko keeps its own copy, so no dependency bump is required.

Reference: /home/bilko/Projects/Bilko/server/routes/tools/git-viewer.ts
Reference: /home/bilko/Projects/Bilko/src/pages/PricingPage.tsx
Reference: /home/bilko/Projects/Bilko/tests/git-viewer.test.ts

## Agent — 2026-10-14T16:13:18.167Z

Out of time for this turn, so here's where it stands.

The code change is live in commit `0b052fc` and every code-side acceptance check passes:
- **Limit:** `PLAN_LIMITS` is now `{ free: 1, paid: 12 }`.
- **Rebuilds:** the database update ran on boot, and every cached free profile is marked for rebuild (its `updatedAt` reads 1970).
- **Pricing page:** the live bilko.run pricing page says "1 project".
- **Tests:** typecheck passes and the full suite passes (1169 tests), including a new test that a stale free profile rebuilds with 1 project.

**Still not working live: the showcase hasn't rebuilt yet.** `stanislavbg` still shows free tier with 3 projects. The server keeps running out of its hourly GitHub request allowance:
- It reset at 9:03 AM PDT.
- I viewed the showcase right away to trigger the rebuild, but no build had saved by 9:13 AM PDT.
- By then the allowance was used up again; it resets around 9:37 AM PDT.

The likely cause is all the rebuilds starting at once: the bigger paid showcase build (it has 62+ repos plus the Writing tab), plus every claimed free profile the sweep queued. If `GITHUB_TOKEN` isn't set on Render, the allowance is only 60 requests an hour and the showcase build can never finish. The git-viewer log line at startup (`[git-viewer] GitHub rate budget: … token=set|unset limit=…`) shows which. I couldn't read the Render logs from here.

What's left:
- Check that log line on Render.
- If the token is set, the queue should clear within an hour or two. Then the showcase should show paid with up to 12 projects, and free profiles should show 1 project with the rest counted in `lockedCount`.
- If the allowance keeps running out, the next step is to spread these rebuilds out over time. That's a rate-limit change, which the feedback listed as out of scope, so I didn't make it.

## User — 2026-10-14T17:17:32.847Z

I don't know, you decide and lets wrapt it up for the week

## Agent — 2026-10-14T17:28:12.174Z

The code side is finished and live, but no git-viewer page has rebuilt yet. The server is almost certainly missing its GitHub token on Render (`GITHUB_TOKEN`), and that is a setting only you can add.

**What's live:**
- **`0b052fc`:** the free tier is 1 project and paid stays at 12. Cached free pages are marked to rebuild at the new limit, and the pricing page says "1 project".
- **`6bfef81` (my decision for today):** the showcase (`stanislavbg`) builds at the paid tier only when `GITHUB_TOKEN` is set, and at the free tier otherwise. Without a token, GitHub allows only 60 requests an hour. A 12-project build needs roughly 70 or more, so the showcase build kept failing, using up the allowance and blocking every other page. Once the token is set, the showcase switches to 12 projects on its own.
- Full test suite passes (1170 tests) and typecheck is clean. Both commits are deployed.

**What I saw live:** right after this deploy at 10:21 AM PDT, new builds were allowed. By 10:27 AM PDT the allowance was used up again before even a 1-project build finished. It resets around 11:03 AM PDT. So the allowance runs out within minutes of every reset no matter what this code does, most likely because the server is sending requests without a token from an address it shares with others. The showcase still shows 3 projects, and the other cached pages show their old content until they rebuild.

**One step left for you:** in the Render dashboard, add `GITHUB_TOKEN` to the bilko-run service. A read-only personal access token with public repo access is enough. Render restarts the service when you save. After that, the pages rebuild on their own: free pages show 1 project and the showcase shows up to 12.

I saved a memory note so a future session checks the token first if git-viewer pages look stale.
