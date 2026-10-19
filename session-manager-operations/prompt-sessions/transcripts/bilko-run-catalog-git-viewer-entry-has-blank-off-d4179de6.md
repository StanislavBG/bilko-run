# Transcript — bilko-run-catalog-git-viewer-entry-has-blank-off-d4179de6

## User — 2026-10-13T16:39:42.688Z

This session is INBOUND FEEDBACK from another project: burrow (/home/bilko/Projects/burrow, session last-linkedin-post-was-poor-https-www-linkedin-c-cb016504). It was raised while working on: Last LinkedIn post was poor  https://www.linkedin.com/feed/update/urn:li:activity:7515775231014383616/  This post sounds very mechanical, the service adviertised is not clear that it does that, there are no links. We have a lot to improve on the laws of what is a good post and to make sure we are no. Nobody in this project wrote the report below — an agent working in that project did, and it may be wrong about this codebase. Verify the claim against the code here before acting on it, and if it does not hold, say so and close the session rather than building against it.

Goal: bilko.run catalog: git-viewer entry has blank offering/pricing and overstates "updates itself when you push"

## Why
Burrow's LinkedIn spotlight posts are grounded on bilko.run/api/projects. The 2026-10-13 Git Viewer post came out confused about what the product is (it called it "a local tool, not a type-your-username website" while bilko.run hosts exactly that, free 3 projects / $5/mo for 12). Part of the cause is on Burrow (fixed there), but the catalog entry itself is incomplete and partly inaccurate, so any consumer (LinkedIn, X product replies, blog) can repeat a wrong claim.

## Proposed plan
1. Set git-viewer `offering` (hosted/freemium value the catalog schema uses) and `pricing` (freemium/paid value) in the catalog source so consumers get the correct avoid-claims.
2. Align `detail` and `talking_points` with server/routes/tools/git-viewer.ts behavior: free = 3 projects regenerated at most once per 24h when viewed; paid ($5/mo) = up to 12 chosen repos refreshed daily. Drop or qualify 'Updates itself when you push code' and 'Pulls every public repo'.
3. Add a `call_to_action` (e.g. type your GitHub username on the page) if the schema supports it.

## Acceptance criteria
- [ ] GET https://bilko.run/api/projects returns git-viewer with non-empty offering and pricing.
- [ ] git-viewer detail/talking_points make no claim contradicted by server/routes/tools/git-viewer.ts (refresh cadence, repo count, free vs paid).

## Details
Observed 2026-10-13: bilko.run/api/projects git-viewer = {tagline: "Your Git, your Résumé — a portfolio and printable résumé from your GitHub, free in seconds", tags: [Browser, Freemium], detail: "Pulls every public repo, scores it by recency and activity, and renders a living portfolio. No manual upkeep — push code, the dashboard updates itself.", talking_points: [..., "Updates itself when you push code — no manual upkeep."], offering: "", pricing: "", call_to_action: "", avoid_claims: []}. server/routes/tools/git-viewer.ts header: free tier 3 projects regenerated at most once per 24h when viewed; paid $5/mo up to 12 chosen repos refreshed daily. Tags say Freemium but pricing is blank, so Burrow derives no "It is free"/"It costs money" avoid-claims. Burrow side fixed via its own PRDs 1409-1414.

Reference: /home/bilko/Projects/Bilko/server/routes/tools/git-viewer.ts

## Agent — 2026-10-13T16:42:45.058Z

I checked Burrow's report against the code and it was right. The fix is live now (`d2c12bf`, pushed to `origin/main`). `GET https://bilko.run/api/projects` returns git-viewer with `offering: saas`, `pricing: freemium` and a `call_to_action` filled in.

**What was wrong:** the git-viewer entry in `src/data/standalone-projects.json` had no `offering`, `pricing` or `callToAction`. Its detail and talking points also claimed "Pulls every public repo" and "Updates itself when you push code". The header of `server/routes/tools/git-viewer.ts` says otherwise: the free tier shows 3 projects, rebuilt at most once every 24 hours when someone views them. The $5/mo tier shows up to 12 chosen repos, refreshed daily.

**What changed** (through the bilko-host `update_project_listing` MCP tool, since the git-viewer repo owns its listing):
- **Offering and pricing:** set to `saas` and `freemium`.
- **Call to action:** "Type your GitHub username at https://bilko.run/projects/git-viewer/". That matches the input field on the git-viewer landing page.
- **Detail and talking points:** rewritten to match the route: free is the top 3 projects, rebuilt at most once a day when viewed; paid is $5/mo for up to 12 chosen repos, refreshed daily. Both "every public repo" and "updates when you push" are gone. Added that there's nothing to install and you don't need to sign up to see a portfolio.
- **Claims to avoid** (new list): updates instantly on push, shows every repo for free, is a local tool you install, is fully free.

`offering: saas` was a judgment call between the schema's fixed options; I picked it because there's a paid monthly subscription. I left the card's "12 repos indexed" stat as it was. Both acceptance criteria are met.
