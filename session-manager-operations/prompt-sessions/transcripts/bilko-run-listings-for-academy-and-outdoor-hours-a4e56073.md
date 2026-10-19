# Transcript — bilko-run-listings-for-academy-and-outdoor-hours-a4e56073

## User — 2026-10-16T05:36:00.392Z

This session is INBOUND FEEDBACK from another project: burrow (/home/bilko/Projects/burrow, session x-pipeline-marketing-replies-give-me-stats-for-t-50764b79). It was raised while working on: X Pipeline - Marketing Replies  Give me stats for this pieline, how the decission on where to post after searching and how to increase posting for tihs specific type since we have a bit more projects going on now. Nobody in this project wrote the report below — an agent working in that project did, and it may be wrong about this codebase. Verify the claim against the code here before acting on it, and if it does not hold, say so and close the session rather than building against it.

Goal: bilko.run listings for academy and outdoor-hours are missing offering, pricing and call_to_action — X marketing skips them

Part 4 of 5 — Fill bilko.run listing marketing fields so X can advertise every project

## Why
Bilko decided (2026-10-15) that every project on bilko.run is for marketing. Burrow's X "marketing replies" pipeline (x_product_replies, 5 replies/day into "show us your startup / what are you building" threads) now has academy and outdoor-hours set to active. It still can't advertise them: the pipeline only markets what a project's own bilko.run listing says, and it refuses a project whose listing has no offering, pricing or call_to_action. Their source repos (~/Projects/Bilko-Academy, ~/Projects/Outdoor-Hours) are not Session Manager projects, so this is routed to the bilko.run host repo to fill in or forward.

## Proposed plan
1. Read both cards with the bilko-host MCP get_project('academy') and get_project('outdoor-hours').
2. For each, call bilko-host update_project_listing to set listing.offering, listing.pricing and listing.callToAction (one plain sentence, e.g. 'Start the free course' / 'Look up a place's comfortable hours').
3. Add listing.avoidClaims for anything a reply must never imply (e.g. Academy: certification or accredited credit; OutdoorHours: forecasts).
4. Re-read both with get_project and confirm the fields are non-empty.

## Acceptance criteria
- [ ] https://bilko.run/api/projects returns academy with non-empty offering, pricing and call_to_action
- [ ] https://bilko.run/api/projects returns outdoor-hours with non-empty offering, pricing and call_to_action

## Details
Evidence: Burrow app/pipelines/x/session.py:656 logs "active project ... skipped for X: blank marketing fields ['offering', 'pricing', 'call_to_action']" for both. Academy already has audience + 2 talking points; outdoor-hours has detail, audience, 2 talking points. Same pattern as the earlier git-viewer blank-fields fix (Bilko commit 579e154 "listing: update git-viewer"). Burrow reads the live catalog every run; no Burrow change needed once listings are updated.

## Agent — 2026-10-16T05:51:45.584Z

The report was correct. Both listings now have their marketing fields filled in, and https://bilko.run/api/projects shows them live, so both acceptance criteria are met.

| | offering | pricing | call_to_action | avoid_claims |
|---|---|---|---|---|
| **academy** | `content` | `free` | Start the free course at https://bilko.run/projects/academy/ | 5: certification or accredited credit, "official Anthropic/Claude course", needs coding, unlimited AI chat, paid tier |
| **outdoor-hours** | `free-tool` | `free` | Compare comfortable outdoor hours by place at https://bilko.run/projects/outdoor-hours/ | 4: forecasts, live or real-time weather, covers any place in the world, install or signup required |

- **How:** I used the `bilko-host` MCP's `update_project_listing`, which pushed commits `ee742ec` (academy) and `3be5c27` (outdoor-hours) to `origin/main`. I kept each listing's existing fields as they were.
- **Avoid-claims are mine:** neither project's author wrote them. Academy's author has been asked to check them in the proposal below; the outdoor-hours ones haven't been checked by anyone. Burrow needs no change.
- **Risk for Academy:** publishing a project syncs its card from a `bilko.listing.json` file in its repo, and that replaces the whole listing. Academy's file still has only audience, talking points and share image, so its next publish would blank these fields again. I opened a proposed bug session in Bilko-Academy (`sync-bilko-listing-json-with-the-live-listing-of-cc533d10`) with the exact JSON to put in that file. It only runs once someone presses Approve & start there. Outdoor-Hours has no such file, so its fields will survive a publish.
