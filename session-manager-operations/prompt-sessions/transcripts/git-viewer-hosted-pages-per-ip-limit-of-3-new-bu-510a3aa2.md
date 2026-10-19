# Transcript — git-viewer-hosted-pages-per-ip-limit-of-3-new-bu-510a3aa2

## User — 2026-10-13T16:39:49.822Z

This session is INBOUND FEEDBACK from another project: git-viewer (/home/bilko/Projects/git-viewer, session saas-whats-the-plan-to-be-a-saas-and-be-able-to--e8a5a1c7). It was raised while working on: SAAS?  Whats the plan to be a SAAS and be able to host other user's pages and keep them fresh? This seems complicated, I also don't want to add more security or other stuff like auth, tokens.   Can it be done? if not, its ok to not be SAAS just out own personal Agentic Resume. Nobody in this project wrote the report below — an agent working in that project did, and it may be wrong about this codebase. Verify the claim against the code here before acting on it, and if it does not hold, say so and close the session rather than building against it.

Goal: git-viewer hosted pages: per-IP limit of 3 new builds/day returns 429 to prospects, paying owners, and the owner's own showcase

## Why
git-viewer is being run as a paid SaaS on bilko.run: people pay $5/mo for a hosted portfolio page at bilko.run/projects/git-viewer/?u=<login>, use it as a reference URL (résumé, LinkedIn), and it refreshes periodically. Right now the funnel breaks at step one. GET /api/git-viewer/u/:login counts each new (uncached) build against FREE_TIER_LIMIT = 3 per IP per day, shared across every login. A prospect who tries a couple of example logins and then their own gets a 429 until UTC midnight, so they can't see their page, sign in, claim it, or pay. Paying owners aren't exempt either: the route calls checkRateLimit(ipHash, GIT_VIEWER_ENDPOINT) with no email. And the owner's own showcase, ?u=StanislavBG, currently returns 429 because it isn't cached.

## Proposed plan
1. Pin claimed (owner_email set) and paid profiles so they're always served from cache, and add StanislavBG as a seeded, always-refreshed profile so the owner showcase never depends on a visitor's quota.
2. Rate-limit new builds with a budget suited to a 'try your own login' funnel (e.g. a per-IP burst like 10/day plus a global GitHub-budget guard driven by x-ratelimit-remaining) instead of the generic FREE_TIER_LIMIT = 3 shared with paid tools.
3. Exempt signed-in users whose Clerk-linked GitHub login matches :login (and paid entitlements) from the per-IP limit, using checkRateLimitForRequest or an equivalent check.
4. Give claimed free profiles a slow refresh (e.g. weekly) in runGitViewerRefresh. Today they're skipped entirely and only refresh when someone views them, which is fine for 'updates every once in a while' but means a reference URL can show data that's months old the first time a recruiter opens it.
5. Add tests for the paths above.

## Acceptance criteria
- [ ] GET /api/git-viewer/u/StanislavBG returns 200 ready from any IP, including one that has used up its new-build quota.
- [ ] From one IP, a visitor can build at least 10 distinct uncached logins in a day before getting a 429. The exact number is your call, but it must be above 3 and documented.
- [ ] A signed-in owner requesting their own login never gets a per-IP 429.
- [ ] Claimed and paid profiles are never re-queued in a way that's subject to the per-IP limit.
- [ ] Claimed free profiles get regenerated on a documented cadence without anyone viewing them.
- [ ] Server tests cover each case and pass.

## Out of scope
- Pricing or plan changes ($5/mo, 3 vs 12 projects stay as they are).
- Any git-viewer dashboard or npm library change.
- Clerk or Stripe flow changes.

## Details
Symptom (observed 2026-10-12 and again 2026-10-13 from the same IP):
  GET https://bilko.run/api/git-viewer/u/octocat     -> 200 ready (cached)
  GET https://bilko.run/api/git-viewer/u/StanislavBG -> 429 {"status":"rate_limited","retryAfterSec":33659}
  GET https://bilko.run/api/git-viewer/u/torvalds    -> 429 {"status":"rate_limited","retryAfterSec":33658}

Where: server/routes/tools/git-viewer.ts, the GET /api/git-viewer/u/:login handler (around lines 310-319). Once there's no cached payload, it calls checkRateLimit(hashIp(req.ip), GIT_VIEWER_ENDPOINT) without an email. In server/routes/tools/_shared.ts that falls through to FREE_TIER_LIMIT = 3 (line 11), so it's 3 new generations per IP per UTC day across all logins. Separately, runGitViewerRefresh skips claimed free profiles (`if (tier === 'free' && row.tier === 'free') continue;`), so they only refresh when viewed.

Expected: the hosted-portfolio contract (git-viewer docs/prds/10-hosted-portfolios.md) says viewing any portfolio is public. The SaaS funnel (PRD-12: landing -> enter login -> see page -> sign in -> claim -> pay) assumes a visitor can always reach their own page.

I'm fairly sure this is Bilko's to fix, because the limit and the refresh loop both live entirely in Bilko's server. The git-viewer client only renders the 429.

Reference: /home/bilko/Projects/Bilko/server/routes/tools/git-viewer.ts
Reference: /home/bilko/Projects/Bilko/server/routes/tools/_shared.ts
Reference: /home/bilko/Projects/git-viewer/docs/prds/10-hosted-portfolios.md
Reference: /home/bilko/Projects/git-viewer/docs/prds/12-saas-self-serve.md
