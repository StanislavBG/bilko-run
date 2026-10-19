# Transcript — git-viewer-listing-your-git-your-r-sum-pitch-per-0c4e43ac

## User — 2026-10-12T16:06:32.941Z

This session is INBOUND FEEDBACK from another project: git-viewer (/home/bilko/Projects/git-viewer, session how-is-our-progress-towards-saas-this-project-is-1437947c). It was raised while working on: How is our progress towards SAAS?  This project is in your hands to monetize, how do we go about it finishing the product? We then since it already listed on Bilko, should have a "Your Git your Resume" pitch part of it and ensure that others can use it from the web alone. Nobody in this project wrote the report below — an agent working in that project did, and it may be wrong about this codebase. Verify the claim against the code here before acting on it, and if it does not hold, say so and close the session rather than building against it.

Goal: git-viewer listing: "Your Git, your Résumé" pitch + per-user share previews for ?u= portfolios

## Why
Stanislav asked to monetize git-viewer as SaaS on bilko.run under a "Your Git, your Résumé" pitch, usable by anyone from the web alone. The git-viewer repo is building the landing page (bilko.run/projects/git-viewer/ with no ?u= now shows a pitch, a username box and Free vs $5/mo pricing), a paid repo picker, a checkout return path and a résumé PDF button. Two pieces live in Bilko: (1) the catalog entry still reads "Turn your GitHub into a public portfolio", with name 'gitoverview' and displayName 'Git Viewer' that disagree with each other; (2) shared links like bilko.run/projects/git-viewer/?u=octocat preview with generic static meta, because the SPA cannot set per-user OG tags. Per-user previews (name, avatar, "Your Git, your Résumé") are the main growth loop for a portfolio product.

## Proposed plan
1. src/data/standalone-projects.json git-viewer entry: set tagline to 'Your Git, your Résumé — a portfolio and printable résumé from your GitHub, free in seconds', and make name/displayName consistent (suggest 'Git Viewer').
2. Where bilko.run serves /projects/git-viewer/index.html: when ?u=<login> is present and matches the login regex, inject og:title '<name> — Your Git, your Résumé', og:description and og:image (GitHub avatar URL from the cached git_viewer_profiles payload, falling back to static) into the HTML head. HTML-escape all values. Use the existing csp-nonce HTML rewrite path if there is one.
3. Make sure the sitemap/catalog page for git-viewer links to the landing page and not to ?u=StanislavBG.

## Acceptance criteria
- [ ] The bilko.run/projects catalog card for git-viewer shows the new tagline.
- [ ] curl -s 'https://bilko.run/projects/git-viewer/?u=octocat' returns HTML whose og:title contains 'The Octocat' (or 'octocat' when uncached) and 'Your Git, your Résumé'.
- [ ] Injected values are HTML-escaped, and an invalid ?u= gets the static meta.

## Details
Live state verified 2026-10-12: GET https://bilko.run/api/git-viewer/u/octocat → 200 ready (tier free, lockedCount 3). The /projects/git-viewer/ static page already gets a csp-nonce injected by the host, so an HTML rewrite path exists. The static index.html in git-viewer will carry generic og:title 'Your Git, your Résumé' (PRD 33-landing-wire). Per-user values need server help. The git-viewer side needs no API change.

Reference: /home/bilko/Projects/Bilko/src/data/standalone-projects.json
Reference: /home/bilko/Projects/Bilko/server/routes/tools/git-viewer.ts

## Agent — 2026-10-12T16:12:02.598Z

The git-viewer report was correct on both points. Both changes are now live on bilko.run, in commit `00c2aa1` pushed to `origin/main`.

**Checked against the code before building:**
- The registry entry really did read "Turn your GitHub into a public portfolio", with `name: "gitoverview"` and `displayName: "Git Viewer"` disagreeing.
- Share cards (OG tags) were already being added to project pages by `server/og-routes.ts`, but it threw away the query string, so `?u=` links got the generic card.
- Item 3 needed no change: nothing in the host links to `?u=StanislavBG`, there's no sitemap, and the registry points at `/projects/git-viewer/`.

**What changed:**
- **Registry** (`src/data/standalone-projects.json`): new tagline "Your Git, your Résumé — a portfolio and printable résumé from your GitHub, free in seconds", and `name` is now "Git Viewer" to match `displayName`.
- **Per-user share cards:** the OG code can now take page-specific lookups that read the query string (`server/og-meta.ts`, `server/og-routes.ts`). Git Viewer's lookup is `gitViewerOg` in `server/routes/tools/git-viewer.ts`, wired up in `server/index.ts`. For `?u=<login>` it:
  - reads only the cached portfolio and never starts a new generation;
  - uses the person's name and GitHub avatar, accepting avatar URLs only from `avatars.githubusercontent.com`, and switches to the square card style;
  - falls back to the login plus the static card image if the user isn't cached;
  - HTML-escapes every value, and an invalid `?u=` gets the normal static card.
- **Tests:** 4 new tests in `tests/og-routes.test.ts`. The OG, git-viewer and og-meta tests all pass (40 of 40).

**Live checks (all three acceptance criteria met):**
- `?u=octocat` → og:title is "The Octocat — Your Git, your Résumé" and og:image is the GitHub avatar.
- An invalid `?u=` gets "Git Viewer — bilko.run".
- `/api/projects` returns the new tagline.

**Problems in the repo that my change didn't cause:**
- `pnpm typecheck` fails, and `tests/project-catalog.test.ts` can't load, because `@modelcontextprotocol/sdk` isn't installed in `node_modules`.
- `db-boot.test.ts` and `secrets-metadata.test.ts` each fail one test on a clean checkout of HEAD before my commit. Each expects one fewer seeded secret than the database now has (the secret list has 9 names, the tests expect 8). The likely cause is the scheduler job 1280 (`telemetry-usage-read-token`) that landed just before my commit.
- There is a leftover `stash@{0}` from 09:07 AM PDT, made by a concurrent scheduler merge. It holds scheduler state files plus an older copy of the registry edit. I didn't create it, so I left it alone.
