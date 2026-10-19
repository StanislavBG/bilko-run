---
title: Page speed: drop the unused Caveat font and unused Inter weights, trim dead global CSS
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-09T19:46:35.725Z
sourcePromptId: review-the-project-for-code-quality-perofmance-i-c56527b0
agentType: dev-lead
disposition: new-head
planId: pl-mv1dm4b1-6e6db1
---
# Goal

behavior. index.html ~line 26 has a render-blocking Google Fonts link that loads Caveat (used nowhere in src/) and six Inter weights (400-900). src/index.css carries utility classes nothing uses (~lines 147-260) and Session Manager manual-reader rules (~263-341) that every page downloads. Trim fonts to what is used and remove dead CSS.

# Acceptance criteria

- [ ] index.html: Caveat is removed from the Google Fonts URL; Inter keeps only the weights actually used (derive from Tailwind font-* classes and font-weight values across src/ and index.css; list the evidence in the report).
- [ ] src/index.css: each class removed (expected candidates: shadow-elevation-2, shadow-fire-glow, border-shadow, shadow-dark-elevation, card-base, card-interactive, animate-*, stagger-children, text-display-lg, text-display-sm) has zero uses in src/, index.html and public/*.html, proven per class with git grep in the report.
- [ ] The `.manual-*` rules move from src/index.css into src/styles/session-manager-manual.css only if every element using a `.manual-` class is rendered by a component that imports that stylesheet; otherwise they stay and the report says why.
- [ ] `pnpm build` before/after: report the main CSS asset size (raw + gzip) both times.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- index.html
- src/index.css
- src/styles/session-manager-manual.css

# Implementation notes

Repo: /home/bilko/Projects/Bilko. Tailwind v4 via @tailwindcss/vite.

Read first: index.html; src/index.css (whole, ~340 lines); `git grep -n "session-manager-manual.css"` to see who imports it; `git grep -n "manual-"` under src/.

Do not touch: src/styles/portfolio.css, src/styles/session-manager-landing.css, any .tsx file.

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm build
timeout 300 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
