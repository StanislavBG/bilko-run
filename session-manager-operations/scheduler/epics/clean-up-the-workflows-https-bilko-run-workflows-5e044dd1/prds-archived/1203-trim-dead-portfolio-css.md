---
title: Delete dead CSS blocks from portfolio.css (Academy lesson, game cards, skills, levels, categories, pf-ann)
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 8
createdVia: scheduler-api
issuedAt: 2026-10-10T16:36:05.315Z
sourcePromptId: clean-up-the-workflows-https-bilko-run-workflows-5e044dd1
agentType: dev-lead
dependsOn: [remove-workflows-page]
planId: pl-mv2m49us-ae38eb
---
# Goal

migration: About 300 of portfolio.css's ~1000 lines style pages that moved out of the host (Academy went to /projects/academy/, games/studio folded into /projects). Delete those blocks so the stylesheet only carries rules the host still renders. PRD remove-workflows-page already removed the .pf-wf-* rules from this file — read its landed version first.

# Acceptance criteria

- [ ] src/styles/portfolio.css no longer contains these dead blocks: `/* ============ Academy lesson page ============ */` (pf-lesson*, pf-callout*, pf-exercise*, pf-diagram*, pf-stub-banner, pf-num), `/* ============ Game cards ============ */` (pf-game-grid, pf-game-card, pf-game-body, pf-cover), `/* ============ Skills ============ */` (pf-skills-grid, pf-skill-block, pf-items), `/* ============ Academy ============ */` (pf-level-list, pf-level-row, pf-cta), `/* ============ Category groups ============ */` (pf-category, pf-category-header), and the `pf-ann` rules in the utility block; dead class names are also removed from shared selector lists such as the mobile `@media` rule `.pf-proj-grid, .pf-skills-grid, .pf-game-grid, .pf-contact`.
- [ ] Before deleting each class, `git grep -n '<class>' -- src packages/host-kit/src server` confirms it has no use outside portfolio.css (also check template-literal/dynamic class construction); any class found in use is kept and listed in the report.
- [ ] No still-used class (e.g. pf-lede, pf-name, pf-n, pf-meta, pf-proj-grid, pf-contact) loses its own top-level rule; only descendant rules scoped under a dead parent class are removed.
- [ ] `pnpm typecheck`, `pnpm test` and `pnpm build` pass.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- src/styles/portfolio.css

# Implementation notes

Read first: src/styles/portfolio.css in full (≈1000 lines; section headers are `/* ============ X ============ */`); `git log -3 --oneline -- src/styles/portfolio.css` to see PRD remove-workflows-page's change.
Steps:
1. For each candidate class in the criteria run `git grep -n 'classname' -- src packages/host-kit/src server shared` excluding portfolio.css. Also `git grep -n 'pf-\${' src` for dynamic names.
2. Delete each confirmed-dead block whole (header comment + its rules). Where a block contains descendant rules like `.pf-level-row .pf-name`, delete them with the block — they are scoped to the dead parent.
3. Strip dead classes out of multi-selector lists (e.g. in the 720px media query) without removing the live ones.
4. Run the gate. Optionally do a quick visual sanity check with `pnpm build` output only — no screenshots required.
Do not touch: any other file; data/manual/ HTML (manual-* and callout rules elsewhere serve it); session-manager-*.css.

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm typecheck
timeout 300 pnpm test
timeout 300 pnpm build
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
