---
title: Blog skill docs: seed, scan and voice guides point at content/blog/ instead of server/db.ts
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 8
createdVia: scheduler-api
issuedAt: 2026-10-09T23:13:59.988Z
sourcePromptId: review-the-project-for-code-quality-perofmance-i-c56527b0
agentType: dev-lead
dependsOn: [blog-posts-migrate]
planId: pl-mv1kpii1-1d18b9
---
# Goal

doc. The blog-from-git skill files tell writers and agents that posts live in server/db.ts. seed.md (~lines 8-44) describes INSERT OR IGNORE blocks and `git add server/db.ts`. scan.md (~28) greps published_at in db.ts. SKILL.md (~41, 46), rotation.md (~99), voice.md (~145) and blog-ledger.md (~52) mention db.ts too. After blog-posts-migrate (read content/blog/README.md first), update them so the next post is written as a markdown file.

# Acceptance criteria

- [ ] seed.md: the seeding steps create content/blog/<slug>.md (frontmatter fields listed), run `pnpm vitest run tests/blog-posts-loader.test.ts tests/db.test.ts`, and stage `content/blog/<slug>.md` plus the ledger with explicit pathspecs.
- [ ] scan.md: the 'last post date' command reads frontmatter from content/blog/*.md (e.g. `grep -h '^published_at' content/blog/*.md` sorted), not db.ts.
- [ ] SKILL.md, rotation.md and voice.md: every instruction to edit or read posts in server/db.ts now points to content/blog/. Historical notes in blog-ledger.md stay as history; at most a one-line note is added.
- [ ] `git grep -n 'server/db.ts' -- .claude/skills/blog-from-git` lists only historical ledger lines (report the output).

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- .claude/skills/blog-from-git/seed.md
- .claude/skills/blog-from-git/scan.md
- .claude/skills/blog-from-git/SKILL.md
- .claude/skills/blog-from-git/rotation.md
- .claude/skills/blog-from-git/voice.md
- .claude/skills/blog-from-git/blog-ledger.md

# Implementation notes

Repo: /home/bilko/Projects/Bilko. Read first: .claude/skills/blog-from-git/seed.md, scan.md, SKILL.md (table rows ~38-50), rotation.md ~90-105, voice.md ~140-150; content/blog/README.md. Do not touch: blog.config.yaml (owned by blog-pipeline-seed-path), scripts/.

# Out of scope

- (none)

# Gate

This PRD has no runnable check. Check each acceptance criterion by reading the files.

```gate
none
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
