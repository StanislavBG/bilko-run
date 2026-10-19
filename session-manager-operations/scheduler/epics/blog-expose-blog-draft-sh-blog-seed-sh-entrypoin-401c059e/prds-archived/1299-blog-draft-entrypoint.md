---
title: Blog: scripts/blog-draft.sh draft-only entrypoint for Burrow
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 15
createdVia: scheduler-api
issuedAt: 2026-10-13T02:09:34.365Z
sourcePromptId: blog-expose-blog-draft-sh-blog-seed-sh-entrypoin-401c059e
tag: feature
agentType: dev-lead
disposition: new-head
planId: pl-mv61m6ql-0ceaeb
---
# Goal

Burrow (~/Projects/burrow, app/pipelines/blog_post/drafter.py) will own blog cadence and calls `bash scripts/blog-draft.sh --out <abs_dir> --slot <ISO-8601 UTC>` with cwd = this repo and a 2700s timeout. Build that script: it runs blog-from-git phases 1-5d (rotation, scan, research, ground, draft, illustrate) via one pinned `claude -p` and writes ONLY into <abs_dir>, so the watchdog can never seed its output.

# Acceptance criteria

- [ ] scripts/blog-draft.sh exists; usage `bash scripts/blog-draft.sh --out <abs_dir> --slot <ISO-8601 UTC>`; missing/relative --out or unparseable --slot exits 2 with a usage message
- [ ] On a successful draft: exit 0, <out>/result.json is exactly {"status":"drafted","slug","title","excerpt","category"}, <out>/post.md is YAML frontmatter (slug,title,excerpt,category) + markdown body, optional <out>/images/*.jpg referenced as /blog-images/<slug>/<file>
- [ ] When rotation finds nothing worth writing: exit 0 with result.json {"status":"skipped","reason":"..."} and no post.md
- [ ] On failure (claude non-zero/timeout, missing post.md, malformed frontmatter, readability check fails): non-zero exit and result.json {"status":"error","error":"..."} written when <out> is writable
- [ ] Never writes into .claude/skills/blog-from-git/drafts/ (DAG artifacts go under <out>/artifacts/), never touches content/blog/, public/blog-images/, blog-ledger.md, and never runs git add/commit/push — the claude prompt says so AND the script verifies afterwards (git status of those paths unchanged, drafts/ listing unchanged) and fails if violated
- [ ] `claude -p` call pins `--model` explicitly (same model as blog-cadence-watchdog.sh) and is wrapped in a timeout so the whole script finishes under 45 min
- [ ] Script sources scripts/blog-watchdog-env.sh (or equivalent) so pnpm/node/claude resolve under a non-interactive PATH, and fails fast with status error naming any missing binary
- [ ] tests/blog-draft.test.ts runs the script with a fake `claude` on PATH (env -i style minimal PATH plus the fake dir) covering drafted, skipped, error, bad-args and the drafts/-untouched guarantee; passes

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- scripts/blog-draft.sh
- scripts/blog-pipeline-lib.sh
- tests/blog-draft.test.ts

# Implementation notes

Source of truth for current drafting logic: scripts/blog-cadence-watchdog.sh (~:690-760 non-autonomous STOP AFTER PHASE 5 prompt, DAG_INSTRUCTIONS at :694, model pin at :791) and .claude/skills/blog-from-git/{SKILL.md,dag.md,images.md,blog.config.yaml}. Put shared helpers (env sourcing, prompt fragments, frontmatter validation) in a new sourced file scripts/blog-pipeline-lib.sh so blog-seed.sh and the watchdog can reuse them later; do NOT modify blog-cadence-watchdog.sh in this PRD. The --slot is the intended published_at; pass it into the prompt and into post.md frontmatter is NOT required (Burrow owns the slot), but the readability gate (`npx tsx scripts/blog-readability.ts <post.md>`) must pass before status drafted. Fake-claude test pattern: write an executable `claude` shell stub into a tmp dir that inspects its args (assert `--model` present) and writes fixture files into the --out dir taken from an env var or parsed from the prompt. Tests must not call network or real claude. Burrow contract reference: /home/bilko/Projects/burrow/session-manager-operations/scheduler/epics/drafting-and-activity-queue-i-just-requested-a-n-e2871b7b/prds/1376-blog-slot-drafter.md

# Out of scope

- Changing blog-from-git editorial rules, voice or rotation
- Editing blog-cadence-watchdog.sh or the 1284/1285 recovery
- Any change to /api/blog

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 600 pnpm vitest run tests/blog-draft.test.ts
timeout 60 bash -n scripts/blog-draft.sh
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
