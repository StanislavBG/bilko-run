---
title: Add a "Buy me a coffee" link to the Session Manager page header (landing and Field Manual)
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-11T01:36:37.917Z
sourcePromptId: buy-me-coffee-this-needs-to-make-a-comeback-on-t-352f8148
agentType: dev-lead
disposition: new-head
planId: pl-mv35k4d9-aa6319
---
# Goal

wire: The Session Manager home page (/products/session-manager) and its Field Manual share one Header component (src/pages/session-manager-landing/Header.tsx) but have no tip link. Add a "Buy me a coffee ☕" anchor to the header's right side pointing at the server route /coffee, with its copy in COPY.header and styling that fits both the fixed-canvas and reflow (mobile) layouts.

# Acceptance criteria

- [ ] src/pages/session-manager-landing/copy.ts COPY.header gains `"coffeeLink": "Buy me a coffee ☕"` and `"coffeeHref": "/coffee"`.
- [ ] src/pages/session-manager-landing/Header.tsx renders, inside `.smlp-header__right` before the manual link, `<a className="smlp-header__coffee" href={h.coffeeHref}>{h.coffeeLink}</a>` — a plain anchor with no onClick (it must not go through onBookLinkClick / page-turn logic), shown on both current='landing' and current='manual'.
- [ ] src/styles/session-manager-landing.css adds `.smlp-root .smlp-header__coffee` (and :hover) rules mirroring `.smlp-header__manual` (lines ~218-228), and under the `.smlp-root--reflow` rules (near line 1259 / 1518) it stays on one line or wraps cleanly without overlapping the AccountChip at 375px width.
- [ ] No test file is added for the JSX; tests/session-manager-landing.test.ts still passes unchanged.
- [ ] pnpm typecheck, pnpm build and the vitest suite pass.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- src/pages/session-manager-landing/copy.ts
- src/pages/session-manager-landing/Header.tsx
- src/styles/session-manager-landing.css

# Implementation notes

Read first: src/pages/session-manager-landing/Header.tsx (whole, ~45 lines); src/pages/session-manager-landing/copy.ts lines 1-40 (header block; the file is a verbatim mirror of session-manager's copy.json — add the two keys anyway, a separate cross-project note handles upstream); src/styles/session-manager-landing.css lines 205-230 and 1255-1265 and 1510-1525.

Steps:
1. copy.ts: add the two keys to "header".
2. Header.tsx: add the anchor as described. Keep the manual link and AccountChip order otherwise unchanged.
3. CSS: add rules next to `.smlp-header__manual`; in reflow mode, if the right side gets crowded, it's fine to hide the trailing ' ☕' text? No — keep text; instead allow `.smlp-header__right` gap/wrap. Prefer the smallest change that keeps everything on screen at 375px.
4. `timeout 300 pnpm build`, then gate.

/coffee is a Fastify route (server/routes/stripe.ts) that 302-redirects to the live Stripe payment link; do not change server code.

Do not touch: src/components/Layout.tsx, src/pages/HomePage.tsx, server/, shared/, tests/ (sibling PRDs own them).

# Out of scope

- Main-site footer/home page
- Server route changes
- Editing the upstream session-manager copy.json

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm typecheck
timeout 300 pnpm build
timeout 600 pnpm vitest run
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
