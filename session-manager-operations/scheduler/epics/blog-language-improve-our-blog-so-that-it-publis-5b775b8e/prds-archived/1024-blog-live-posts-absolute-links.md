---
title: Blog: rewrite live posts' links to full https://bilko.run URLs and link GitViewer's open-source repo
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-03T16:26:26.175Z
sourcePromptId: blog-language-improve-our-blog-so-that-it-publis-5b775b8e
tag: bug
agentType: dev-lead
disposition: new-head
planId: pl-musltlof-c41006
---
# Goal

behavior. Owner feedback 2026-10-03 on the live post `turn-your-github-year-into-a-heatmap-and-badge-wall`: links must be printed as full, clickable URLs, not site-relative paths, and "the project is open source" must actually link the repo. The audience is early college students who need to click straight through. Today the post has `[GitViewer](/projects/git-viewer/)` and `[the project page](/projects/git-viewer/)`, and "open source" has no link. Fix it in the live DB with a once-only boot data migration in server/db.ts. The migration also rewrites every live post's site-relative markdown links to absolute bilko.run URLs.

# Acceptance criteria

- [ ] server/db.ts: the INSERT OR IGNORE seed for slug 'turn-your-github-year-into-a-heatmap-and-badge-wall' (~line 2960) uses https://bilko.run/projects/git-viewer/ for both links, and the sentence 'the project is open source' becomes a markdown link to https://github.com/StanislavBG/git-viewer (verified PUBLIC). Rewrite that paragraph so a first-time reader sees both links as clickable text naming where they go.
- [ ] server/db.ts gains `applyDataMigrationOnce('2026-10-03-blog-absolute-links', [...])`, modelled on the existing '2026-09-25-blog-manual-now-free' migration. It (a) sets the git-viewer post's content to the corrected text and sets updated_at; (b) runs `UPDATE blog_posts SET content = REPLACE(content, '](/', '](https://bilko.run/') WHERE content LIKE '%](/%'` so every live post's relative links become absolute.
- [ ] The migration is idempotent: a second boot changes nothing. It never touches links that are already absolute, and it never touches '](//' protocol-relative links (exclude them, or prove none exist with a test).
- [ ] tests/db.test.ts gains tests: after initDb, no blog_posts.content contains the substring '](/'; and the git-viewer post contains 'https://bilko.run/projects/git-viewer/' and 'https://github.com/StanislavBG/git-viewer'.
- [ ] All parameterized SQL goes through the db helpers (no string interpolation). The existing tests in tests/db.test.ts still pass.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- server/db.ts
- tests/db.test.ts

# Implementation notes

Read first: server/db.ts lines 2760-2800 (applyDataMigrationOnce usage + MANUAL_FREE_* constants pattern) and ~2950-2990 (the git-viewer seed), the definition of applyDataMigrationOnce in server/db.ts (grep for it), tests/db.test.ts (how initDb is exercised).

Repo URL source of truth: src/data/standalone-projects.json entry slug git-viewer has host.sourceRepo 'github.com/StanislavBG/git-viewer' — prefix https://.

Steps: red tests first; edit the seed text; add the migration (define the corrected content once as a const and use it in both the seed and the migration, like MANUAL_FREE_NOTE); typecheck; tests last.

After pushing, Render auto-deploys; the migration runs at boot. Do NOT poll production in this PRD (validator checks live).

Do not touch: scripts/blog-readability.ts, .claude/skills/blog-from-git/* (a sibling PRD owns them). Commit only server/db.ts and tests/db.test.ts, then push to origin main (never content-grade).

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/db.test.ts
timeout 300 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
