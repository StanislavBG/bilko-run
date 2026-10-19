---
title: Tag host content pages: blog, blog post, manual, contact, project detail
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 8
createdVia: scheduler-api
issuedAt: 2026-10-18T18:44:00.312Z
sourcePromptId: bilko-observability-common-toolkit-each-projects-516b5e5c
agentType: dev-lead
dependsOn: [host-trackflow-helper]
planId: pl-mve5lxlp-756161
---
# Goal

wire: tag the host's content pages so their main buttons are named in session timelines and reading and contact flows show in the Flows dashboard. The pages are the blog index, blog posts (including the video player), the Session Manager Field Manual, the contact page and the portfolio project detail page.

# Acceptance criteria

- [ ] In src/pages/BlogPage.tsx, each post card link gets data-track="blog-open-post", plus category or filter controls blog-filter-<name>. In src/pages/BlogPostPage.tsx, the CTA, share and project links get blog-post-<action>, and the post calls trackFlow('read', 'start', { slug }) on mount.
- [ ] In src/pages/session-manager-landing/ManualPage.tsx, the chapter and section nav gets manual-nav-<x>, and any download or install link gets the download- prefix plus trackFlow('download', 'click-download', { artifact: 'session-manager', platform }).
- [ ] In src/pages/ContactPage.tsx, the submit button gets data-track="contact-submit", the form is wrapped in data-track-redact, and the page calls trackFlow('contact', 'start') on first focus and trackFlow('contact', 'success') or 'fail' after the existing submit resolves. Props never include form field values.
- [ ] In src/pages/PortfolioProjectDetailPage.tsx, the primary links (open app, source, back) get project-detail-<action>.
- [ ] No tracking call changes behavior or calls preventDefault. pnpm typecheck and a vite build pass.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- src/pages/BlogPage.tsx
- src/pages/BlogPostPage.tsx
- src/pages/session-manager-landing/ManualPage.tsx
- src/pages/ContactPage.tsx
- src/pages/PortfolioProjectDetailPage.tsx

# Implementation notes

Read first: the five page files (grep -n 'href\|onClick\|<button\|<form' in each); src/hooks/usePageView.ts trackFlow (landed by PRD host-trackflow-helper).

Taxonomy: data-track is kebab-case "<area>-<action>"; data-track-redact on any element that shows user text; download- prefix for downloads.

Do not touch: src/hooks/usePageView.ts, Layout.tsx, the other session-manager-landing files.

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm typecheck && timeout 300 pnpm exec vite build --outDir /tmp/bilko-gate-build-contenttag --emptyOutDir
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
