# Transcript — make-the-game-academy-card-public-on-bilko-run-p-6ffd2f0f

## User — 2026-10-19T14:08:02.850Z

This session is INBOUND FEEDBACK from another project: Bilko-Game-Academy (/home/bilko/Projects/Bilko-Game-Academy, session counter-loop-to-separate-assets-use-the-gauntlet-6fcf535c). It was raised while working on: Counter loop to separate assets  Use the gauntlet loop to improve the game assets so that they are more enjoyable   How a Gauntlet Loop Works for Game Graphics 1. Task Decomposition: A lead AI agent takes a high-level goal (e.g., "Make the lighting, post-processing, and shaders look like a modern AA. Nobody in this project wrote the report below — an agent working in that project did, and it may be wrong about this codebase. Verify the claim against the code here before acting on it, and if it does not hold, say so and close the session rather than building against it.

Goal: Make the game-academy card public on bilko.run/projects (site is live and validated)

## Why
The owner asked to "publish all live" for Bilko Game Academy. The static bundle is already published at https://bilko.run/projects/game-academy/; the live manifest gitSha c4facd3 is the release-checked, validator-verified build with the improved gauntlet art for Pong, Skyline Slam, Tinpot Tanks and Tandem Derby. The only part not live is the public /projects card: the slug 'game-academy' is missing from https://bilko.run/api/projects. Visibility (`public`) is owned by the Bilko registry, and update_project_listing cannot change it from the Game Academy repo.

## Proposed plan
1. In the Bilko registry entry for slug 'game-academy', set the visibility flag (public) to true.
2. Optionally refresh listing.callToAction from 'Play Pong' to a four-game call to action (e.g. 'Play the Academy'), or leave that to the Game Academy repo via update_project_listing.
3. Redeploy bilko.run and confirm the card appears.

## Acceptance criteria
- [ ] https://bilko.run/api/projects lists slug 'game-academy'.
- [ ] The card links to https://bilko.run/projects/game-academy/, which returns 200.
- [ ] No change to the published bundle or its hosting path.

## Details
Evidence, checked 2026-10-19 PDT:
- get_project('game-academy') returns status 'live' and host static-path /projects/game-academy/, with no public flag set.
- GET https://bilko.run/api/projects lists session-manager, social-signals-trader, escape-velocity, academy, git-viewer, launch-kit, outdoor-hours and family-frame, but not game-academy.
- GET https://bilko.run/projects/game-academy/ returns 200, and assets/index-jWaTrk98.js returns 200. The live manifest reports gitSha c4facd3 and was built 2026-10-19T09:34:06Z.
Release and validation records in the Game Academy repo:
- session-manager-operations/reviews/release/counter-loop-to-separate-assets-use-the-gauntlet-6fcf535c/gauntlet-release.md (READY)
- the validate-gauntlet-publish.md record (every PRD VERIFIED)
Note: a separate 'academy' slug is already public. Check whether it is a different project before treating it as a duplicate.

## Agent — 2026-10-19T14:13:10.042Z

The Game Academy card is now public on bilko.run and the live site shows it.

**Their claim was correct.** The `game-academy` entry had no `public` flag. The public `academy` slug is a different project: it's the Bilko-Academy AI course, so this isn't a duplicate.

**Change (commit `0bfc96a9`, pushed to `origin/main`):**
- I added `"public": true` to the `game-academy` entry in `src/data/standalone-projects.json`.
- I added `game-academy` to the expected public-card list in `tests/projects-view.test.ts`.
- All 1,287 tests and the typecheck pass.

**Acceptance criteria:**
- **Listed:** `https://bilko.run/api/projects` lists `game-academy`. It went live about 3.5 minutes after the 7:09 AM PDT push.
- **Link works:** the card's URL is `https://bilko.run/projects/game-academy/`, which returns 200.
- **Bundle untouched:** I didn't change the published bundle or its hosting path.

The card still says "Play Pong", and its audience and talking points are empty. I left those alone because the Game Academy repo owns them and can change them with `update_project_listing`.

## User — 2026-10-19T14:13:10.177Z

publish all other changes from local too merge all and publish all
