---
title: Add secondary Web Remote link to Session Manager marketing page + hub card
cwd: ~/Projects/Bilko
estimateMinutes: 12
---

# Goal

PRD 723 (commit `b5e7795`, already merged and pushed to `main`) added the Session Manager marketing/checkout page at `/products/session-manager` but missed two of its acceptance criteria: a secondary, non-competing link to the existing Web Remote app (`/projects/session-manager/`, source at `~/Projects/session-manager/web-remote/app`) for people who already own the product. Without it, an existing customer has no discoverable path back to the Web Remote pairing app from either the new marketing page or the portfolio hub card. Add both links now — small, additive, low-risk.

# Acceptance criteria

- [ ] On `src/pages/SessionManagerPage.tsx`, add a small, visually secondary link — NOT a primary CTA, not competing with the 'Get Session Manager' purchase button — that navigates to `/projects/session-manager/`, labeled something like 'Already own it? Open Web Remote →'. Place it out of the primary above-the-fold flow (e.g. small header or footer link). Check `src/components/` first for an existing small link/menu primitive to reuse before adding new markup.
- [ ] On `src/pages/ProjectsPage.tsx`'s `HubRow`, add a same-style secondary link for 'Web Remote' pointing at `/projects/session-manager/`, alongside the existing npm/github secondary links (`pf-hub-link`/`pf-hub-src` classes, ~lines 109-114) for the Session Manager card specifically. This is ADDITIVE — do not remove or reorder the existing npm/github links, and do not add this link to any other project's card.
- [ ] `npm run typecheck` (or this repo's equivalent — check `package.json` scripts) passes.
- [ ] Existing tests still pass: `timeout 300 npm test` (or this repo's actual test script — check `package.json`), including `tests/session-manager-checkout.test.ts` added by PRD 723.

# Implementation notes

Read `src/pages/SessionManagerPage.tsx` and `src/pages/ProjectsPage.tsx` (both added/touched by commit `b5e7795`, already on `main`) before making changes — this PRD is a small addition to already-landed code, not new scaffolding. The Session Manager hub card is the MERGED card (project + package, deduped by slug — see `src/data/projectsView.ts`'s merge logic, also touched by `b5e7795`) so its existing `card.npm`/`card.github` secondary links are the precedent to match visually.

# Out of scope

- Any other change to the marketing page's hero, feature list, or checkout flow — those already work per PRD 723.
- Screenshots, Stripe price ID configuration — unrelated, tracked separately.

## Engineering standards

Before writing any code, read `/home/bilko/Projects/session-manager/plugins/session-manager-dev/skills/develop/standards.md` — it has the Performance, Debugging, API-reuse, TDD, and Execution-discipline rules that apply to this PRD. Every rule in it is mandatory, especially Execution discipline (bounded commands, verify before done, the finish-protocol sentinel).
