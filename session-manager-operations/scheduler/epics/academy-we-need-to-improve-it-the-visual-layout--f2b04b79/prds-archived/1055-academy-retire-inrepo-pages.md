---
title: Retire the old in-repo /academy pages and redirect them to the Academy course
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-03T22:23:55.311Z
sourcePromptId: academy-we-need-to-improve-it-the-visual-layout--f2b04b79
tag: feature
agentType: dev-lead
planId: pl-musylbxr-9425e2
---
# Goal

Type: behavior. bilko.run has an orphaned, half-finished second "Academy" built into this repo (5 levels, only Level 1 written, stale copy describing the sibling course as "three modules, BYOK") served at /academy and /academy/:level. The real course is the static-path sibling app at /projects/academy/. Delete the in-repo pages and make every /academy URL do a full-page redirect to /projects/academy/.

# Acceptance criteria

- [ ] src/pages/AcademyPage.tsx, src/pages/AcademyLevelPage.tsx, src/data/academy/lessons.tsx and src/components/academy/Diagrams.tsx are deleted (and their now-empty folders src/data/academy/ and src/components/academy/ are gone); nothing else in src/ imports them.
- [ ] src/App.tsx no longer imports AcademyPage or AcademyLevelPage; it defines a component RedirectAcademyToCourse that calls window.location.replace('/projects/academy/') in a useEffect and renders null, mounted on Route path="/academy" and Route path="/academy/*" in the same place the old two routes were.
- [ ] New test tests/academy-retired.test.ts (vitest, node env) asserts: the four deleted files do not exist (fs.existsSync false), src/App.tsx text contains 'RedirectAcademyToCourse' and '/projects/academy/' and does not contain 'AcademyPage' or 'AcademyLevelPage'. It passes.
- [ ] pnpm typecheck and pnpm build both pass.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- src/App.tsx
- src/pages/AcademyPage.tsx
- src/pages/AcademyLevelPage.tsx
- src/data/academy/
- src/components/academy/
- tests/academy-retired.test.ts

# Implementation notes

Read first: src/App.tsx lines 1-110 (existing redirect helpers MaybeStandaloneRedirect at ~72-90 uses window.location.href for static-path targets — mirror that full-page-load style, but use location.replace so /academy does not stay in history) and lines 175-185 (the two /academy routes). Read vitest.config.ts (environment node, include tests/**/*.test.ts).
Steps:
1. Before deleting, run `grep -rn "academy/lessons\|components/academy\|AcademyPage\|AcademyLevelPage" src` to confirm the only importers are App.tsx and the files being deleted. If anything else imports them (other than src/data/portfolio.ts, which a sibling PRD owns), remove that import usage minimally.
2. git rm the four files.
3. In src/App.tsx add `function RedirectAcademyToCourse() { useEffect(() => { window.location.replace('/projects/academy/'); }, []); return null; }` (import useEffect from react if not already imported) next to the other redirect helpers, and replace the two academy routes with path="/academy" and path="/academy/*" both rendering <RedirectAcademyToCourse />.
4. Write tests/academy-retired.test.ts per the criteria (read files with fs.readFileSync relative to process.cwd()).
Do not touch: src/data/portfolio.ts, src/components/Layout.tsx (owned by PRD academy-drop-nav-section), src/data/projectsView.ts, server/ (the /api/academy/ask proxy stays until the Academy v2 rebuild is live).

# Out of scope

- Removing the Academy nav tab / SECTIONS entry (sibling PRD)
- Retiring server/routes/academy.ts or academy-quota
- Any change in ~/Projects/Bilko-Academy or ~/Projects/Bilko-Host-Kit

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/academy-retired.test.ts && timeout 300 pnpm typecheck && timeout 600 pnpm build
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
