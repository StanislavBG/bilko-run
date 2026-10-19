---
title: Page titles: one useDocumentTitle hook so every page sets and resets its tab title the same way
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-09T23:10:14.490Z
sourcePromptId: review-the-project-for-code-quality-perofmance-i-c56527b0
agentType: dev-lead
disposition: new-head
planId: pl-mv1kw0d6-becc55
---
# Goal

migration. The title-reset string 'Bilko.run — Tools for Makers Who Ship' is hardcoded in ~6 pages. ProjectsPage resets to a different title, and HomePage, WorkflowsPage and ContactPage never reset, so tab titles go stale when you navigate. Add one hook and adopt it in the public pages.

# Acceptance criteria

- [ ] New src/hooks/useDocumentTitle.ts exports `useDocumentTitle(title: string)`, which sets document.title on mount/change and restores the site default on unmount. The default constant lives in that file.
- [ ] These pages use it instead of manual document.title code: HomePage, ProjectsPage, BlogPage, BlogPostPage, WorkflowsPage, ContactPage, PricingPage, PrivacyPage, TermsPage, NotFoundPage (where present).
- [ ] `git grep -n 'document.title' -- src/pages` shows no remaining manual assignments in those pages (report output). AdminPage, ManualPage and SessionManagerPage are untouched.
- [ ] `pnpm typecheck` and `pnpm build` pass.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- src/hooks/useDocumentTitle.ts
- src/pages/HomePage.tsx
- src/pages/ProjectsPage.tsx
- src/pages/BlogPage.tsx
- src/pages/BlogPostPage.tsx
- src/pages/WorkflowsPage.tsx
- src/pages/ContactPage.tsx
- src/pages/PricingPage.tsx
- src/pages/PrivacyPage.tsx
- src/pages/TermsPage.tsx
- src/pages/NotFoundPage.tsx

# Implementation notes

Repo: /home/bilko/Projects/Bilko. Mechanical migration; keep each page's existing title text. Read first: `git grep -n 'document.title' -- src`. Do not touch: src/pages/AdminPage.tsx, src/pages/ManualPage.tsx, src/pages/SessionManagerPage.tsx, src/pages/admin/.

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm typecheck
timeout 300 pnpm build
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
