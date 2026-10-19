---
title: Blog pipeline: the automatic publisher adds new posts as content/blog/*.md, not database code
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 12
createdVia: scheduler-api
issuedAt: 2026-10-09T23:13:50.435Z
sourcePromptId: review-the-project-for-code-quality-perofmance-i-c56527b0
agentType: dev-lead
dependsOn: [blog-posts-migrate]
planId: pl-mv1kpii1-1d18b9
---
# Goal

wire. The autonomous blog watchdog (scripts/blog-cadence-watchdog.sh, run by a systemd timer) and its config still seed posts by editing server/db.ts. Its EXPECTED_COMMIT_PATHS (~line 431) and prompt text (~684-702) say 'edit server/db.ts', and .claude/skills/blog-from-git/blog.config.yaml autonomy.allowed_commit_paths/seed file (~280-298) list server/db.ts. After blog-posts-migrate (read content/blog/README.md and server/db.ts first), new posts must be added as content/blog/<slug>.md. Update the script, the config and its test together so the watchdog's own consistency check keeps passing.

# Acceptance criteria

- [ ] blog.config.yaml: the seed file and autonomy.allowed_commit_paths name `content/blog/` (the new post file) and .claude/skills/blog-from-git/blog-ledger.md instead of server/db.ts; comments explain the frontmatter format.
- [ ] scripts/blog-cadence-watchdog.sh: EXPECTED_COMMIT_PATHS and every prompt instruction now say to create content/blog/<slug>.md (copying the frontmatter of the newest post) and stage it plus the ledger with explicit pathspecs. The FATAL consistency check compares against the new paths.
- [ ] tests/blog-cadence-watchdog.test.ts expectations are updated to the new paths, including the awk parser cases; all its tests pass.
- [ ] A dry run, `bash scripts/blog-cadence-watchdog.sh --help` or the script's existing no-op/dry-run mode (find it; do not trigger a real publish), exits 0 and prints no FATAL; the report pastes its output.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- scripts/blog-cadence-watchdog.sh
- .claude/skills/blog-from-git/blog.config.yaml
- tests/blog-cadence-watchdog.test.ts

# Implementation notes

Repo: /home/bilko/Projects/Bilko. This pipeline runs unattended daily; correctness matters more than brevity. Never run it in a mode that drafts, commits or pushes.

Read first: scripts/blog-cadence-watchdog.sh lines 40-60, 380-450, 530-560, 670-720; .claude/skills/blog-from-git/blog.config.yaml lines 260-300; tests/blog-cadence-watchdog.test.ts lines 270-335; content/blog/README.md.

Do not touch: .claude/skills/blog-from-git/*.md (blog-skill-docs-seed-path updates them), server/db.ts.

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/blog-cadence-watchdog.test.ts tests/blog-watchdog-heartbeat.test.ts
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
