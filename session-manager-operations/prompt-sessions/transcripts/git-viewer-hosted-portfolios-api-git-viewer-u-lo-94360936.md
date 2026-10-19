# Transcript — git-viewer-hosted-portfolios-api-git-viewer-u-lo-94360936

## User — 2026-10-11T02:49:24.620Z

This session is INBOUND FEEDBACK from another project: git-viewer (/home/bilko/Projects/git-viewer, session how-can-we-turn-this-project-into-saas-the-git-v-2b6e3202). It was raised while working on: How can we turn this project into SAAS?  The Git-Viewer is nice, but how can we make it accessible to people without knowldge. Esentually, ppl that have git-account and are like "yo, I want ot see my projects" like that in a the Git-Viewer;   What options or appach for the project should we take?. Nobody in this project wrote the report below — an agent working in that project did, and it may be wrong about this codebase. Verify the claim against the code here before acting on it, and if it does not hold, say so and close the session rather than building against it.

Goal: git-viewer hosted portfolios: /api/git-viewer/u/:login + $5/mo tier on bilko.run

## Why
Stanislav wants git-viewer to become a paid product on bilko.run: anyone with a GitHub account visits bilko.run/projects/git-viewer/?u=<login> and gets their own editorial portfolio, without git knowledge. Free = 3 projects, Paid = $5/month for 12 chosen projects + daily refresh + Writing tab. Decision was 'reuse what we have, no new stuff, reuse the domain' — so the server half lives in Bilko using the existing gateway pattern (like the 8 AI-tool siblings), libsql snapshot storage (like project-data.ts), Clerk auth and the existing Stripe checkout/webhook. The git-viewer repo is concurrently building the dashboard side (?u= loader, generating/upsell UI) and a library entry buildPortfolio(opts) the host calls.

## Proposed plan
1. Wait for/consume the git-viewer library: buildPortfolio({ user, token, maxProjects, allowlist, writing }) -> Promise<{ data: GitData; lockedCount }>, plus PLAN_LIMITS {free:3, paid:12}, exported from git-viewer's pipeline/index.ts (built with `pnpm build:lib` in ~/Projects/git-viewer; publish as @bilkobibitkov/git-viewer via /builder, same as @bilkobibitkov/page-roast).
2. Add server/routes/tools/git-viewer.ts implementing GET /api/git-viewer/u/:login exactly per the contract in ~/Projects/git-viewer/docs/prds/10-hosted-portfolios.md: 200 {status:'ready', login, tier, lockedCount, updatedAt, data}; 202 {status:'generating', retryAfterSec}; 404 {status:'not_found'}; 429 {status:'rate_limited', retryAfterSec}. Validate login with ^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$ before anything else.
3. Storage: a git_viewer_profiles table in the libsql control DB (login PK lowercase, payload JSON text, tier, locked_count, owner_email nullable, allowlist JSON nullable, updated_at) modelled on project_snapshots in server/routes/project-data.ts.
4. Generation: on cache miss or stale (>24h free) enqueue an in-process job (max 2 concurrent) using the server's GITHUB_TOKEN with maxProjects = PLAN_LIMITS.free; return 202 meanwhile. Per-IP limits via server/routes/tools/_shared.ts checkRateLimit (new endpoint key 'git-viewer').
5. Claim + paid: authed POST /api/git-viewer/claim verifies the Clerk user's linked GitHub external account username equals :login (requires GitHub social connection enabled in the Clerk dashboard), stores owner_email + allowlist (<=12 names). Entitlement: getActiveSubscriptionLive(email) tier !== 'free' (pro/business/team include it) OR a new STRIPE_PRICE_GITVIEWER subscription ($5/mo, product key git_viewer) wired through the existing server/routes/stripe.ts checkout + webhook + priceToPlanTier.
6. Daily refresh for paid/claimed profiles (allowlist, maxProjects 12, writing 'profile-repo'), bounded batch, reusing whatever scheduled-job mechanism the server already uses.
7. Update the git-viewer entry in src/data/standalone-projects.json (drop the 'Free'-only tag, tagline 'Turn your GitHub into a public portfolio') and add it to the pricing page.

## Acceptance criteria
- [ ] GET /api/git-viewer/u/octocat on bilko.run returns 202 then, within a few minutes, 200 with tier 'free', data.projects.length <= 3 and lockedCount = remaining public non-fork repos
- [ ] Invalid logins (e.g. '-bad', 'a--b', '<script>') get 400 without any GitHub call; nonexistent users get 404
- [ ] A second request within 24h is served from the DB (no GitHub calls) with cache-control set
- [ ] Per-IP rate limit returns 429 with retryAfterSec
- [ ] A Clerk user whose linked GitHub login matches can claim, pick up to 12 repos, and after a Stripe test-mode $5/mo checkout (or an existing pro subscription) gets tier 'paid' with their chosen repos and Writing from <login>/<login>/writing/
- [ ] Claim is refused (403) when the Clerk user's linked GitHub login does not match
- [ ] Paid profiles refresh daily; free profiles do not refresh on a schedule
- [ ] bilko.run/projects/git-viewer/?u=<login> renders the portfolio end to end

## Out of scope
- Dashboard UI (git-viewer repo)
- Private-repo data for free users
- Custom domains

## Details
Contract source of truth: ~/Projects/git-viewer/docs/prds/10-hosted-portfolios.md (being written by git-viewer PRD hosted-portfolios-spec in this same push; if not yet landed, the contract is exactly the plan step above). Dashboard side (git-viewer PRDs tenant-client, tenant-loader, tenant-ui) calls same-origin /api/git-viewer/u/<login> and polls 202 with retryAfterSec clamped 2..15s, max 20 attempts; the upsell card links to https://bilko.run/pricing. Library side (git-viewer PRDs select-repos, build-portfolio-lib, profile-writing, pipeline-lib-build) exposes buildPortfolio; the repo cap is applied before per-repo fetches, so a free generation costs roughly 3 repos' worth of GitHub API calls. Data payload for a capped portfolio is far below project-data.ts's 6 MB cap. Human prerequisites: enable GitHub as a social connection in Clerk; create the $5/mo Stripe price and set STRIPE_PRICE_GITVIEWER in Render. Existing reuse points: server/routes/project-data.ts, server/routes/tools/_shared.ts, server/routes/stripe.ts, server/services/stripe.ts (getActiveSubscriptionLive, priceToPlanTier), server/clerk.ts, src/data/standalone-projects.json.

Reference: /home/bilko/Projects/git-viewer/pipeline/sync.ts
Reference: /home/bilko/Projects/git-viewer/src/types.ts
Reference: /home/bilko/Projects/Bilko/server/routes/project-data.ts
Reference: /home/bilko/Projects/Bilko/server/routes/tools/_shared.ts
Reference: /home/bilko/Projects/Bilko/server/routes/stripe.ts

## Agent — 2026-10-11T03:00:28.526Z

I built the server side of hosted Git Viewer portfolios on bilko.run, but it can't make a portfolio yet. It depends on a git-viewer code package (`@bilkobibitkov/git-viewer`) that isn't on npm, so for now the API answers `503 {status:'unavailable'}`. The work is committed as `51e262a` on this epic branch and is not merged or pushed to `main`. Typecheck passes and all 987 tests pass, 21 of them new.

**Checking the report:** its claims about this codebase hold (the files, helpers and Stripe flow it points to all exist). Four points needed correcting or adding:
- **Package not on npm.** git-viewer's library code exists, but its package is marked private, hasn't been built and isn't published. I made the host load it only when it's installed, so the site starts and tests run without it.
- **A $5 subscription would have unlocked every paid tool.** Before this change, any active Stripe subscription counted as a site-wide "pro" plan, so a Git Viewer subscriber would have got the AI tools for free. Now the $5 price is recorded as its own `git_viewer` tier, which never counts as pro. A test covers this.
- **Bad logins return 404, not 400.** The report's acceptance list says 400, but the written contract in git-viewer's PRD-10 says 404 `not_found`. I followed the contract.
- **"Pro/business/team get it included" means old ContentGrade subscribers.** Those are the only subscribers on those plans, so the "included" perk only reaches people still on a retired ContentGrade plan. I kept it because the spec asks for it.

**What's built:**
- **`GET /api/git-viewer/u/:login`:**
  - 200 when the portfolio is ready, cacheable for 5 minutes.
  - 202 "generating" on first visit; at most 2 portfolios are built at once.
  - 404 for invalid logins and GitHub users that don't exist.
  - 429 after 3 new portfolio builds per IP per day. Polling and repeat views don't count.
  - Free portfolios rebuild at most once a day, and only when someone views them; visitors see the older copy while it rebuilds.
- **`POST /api/git-viewer/claim`:** requires sign-in (401 otherwise) and refuses with 403 unless the GitHub account linked to that sign-in matches the login. It saves up to 12 chosen repos and rebuilds the portfolio at the right tier.
- **Paid tier:** 12 chosen repos plus the Writing tab. It turns on for a `git_viewer` subscription or a legacy pro plan, and a paid profile drops back to free when its subscription lapses.
- **Daily refresh:** an hourly check rebuilds paid profiles older than 24 hours; free profiles are never refreshed on a schedule.
- **Other changes:**
  - A new `git_viewer_profiles` table.
  - A `git_viewer` checkout option in the existing Stripe checkout.
  - The registry entry's tagline is now "Turn your GitHub into a public portfolio" and its tag is "Freemium".
  - A Git Viewer section on the pricing page.
  - A new line in CLAUDE.md's list of app-specific host code.
  - Two new env vars in `.env.example`.

**Still needed before the acceptance criteria can be met:**
- **git-viewer:** publish the package. I sent this to git-viewer as a proposed session (`publish-bilkobibitkov-git-viewer-so-bilko-run-ca-239d21f5`), with the claim and checkout details their dashboard needs. It runs only once someone approves it there. After it's published, Bilko needs `pnpm add @bilkobibitkov/git-viewer`.
- **You:**
  - Enable GitHub as a sign-in option in Clerk.
  - Create the $5/month price in Stripe.
  - Set `STRIPE_PRICE_GITVIEWER` and `GITHUB_TOKEN` in Render.
- **Not tested live:** the real Stripe test-mode checkout and the full page at `bilko.run/projects/git-viewer/?u=<login>`. Both need the package and the settings above first.
