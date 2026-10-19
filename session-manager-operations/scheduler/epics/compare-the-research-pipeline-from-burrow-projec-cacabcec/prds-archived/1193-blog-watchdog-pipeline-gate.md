---
title: Blog watchdog: require the DAG pipeline check before seeding and audit it after publish
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-10T05:49:22.318Z
sourcePromptId: compare-the-research-pipeline-from-burrow-projec-cacabcec
tag: feature
agentType: dev-lead
dependsOn: [blog-pipeline-check-script]
planId: pl-mv1z38j8-0e0445
---
# Goal

wire: make the autonomous blog pipeline actually go through the new content DAG, enforced in two ways.
1. The `claude -p` prompts in `scripts/blog-cadence-watchdog.sh` tell the subprocess to write the DAG artifacts to `.claude/skills/blog-from-git/drafts/<slug>/`, and to run `scripts/blog-pipeline-check.ts` as a hard pre-commit gate.
2. After a publish, the watchdog itself re-runs the check for every seeded slug. If any check fails, it downgrades the heartbeat to `warn:` instead of `ok:`.
`seed.md` documents the same gate.

# Acceptance criteria

- [ ] Every drafting instruction in the `claude -p` prompts of `scripts/blog-cadence-watchdog.sh` (both the non-autonomous phases-1-5 prompt and the autonomous prompt) tells the subprocess to follow `.claude/skills/blog-from-git/dag.md`. It must write `questions.json`, `evidence.json`, `outline.json`, `renditions/linkedin.md` and `renditions/x.md` under `.claude/skills/blog-from-git/drafts/<slug>/`, and must never commit them.
- [ ] The autonomous prompt's requirements list gains a pipeline gate next to the existing readability gate. Before committing, run `npx tsx scripts/blog-pipeline-check.ts .claude/skills/blog-from-git/drafts/<slug> <draft-file>`; it must exit 0. The subprocess gets at most 2 fix-and-recheck cycles. If it still fails, it aborts with exactly `SEED_RESULT: error note="pipeline-check"`.
- [ ] In the `SEED_RESULT: published=*` branch, after the existing push and live checks, the script runs `timeout 120 npx tsx scripts/blog-pipeline-check.ts "$DRAFTS_DIR/<slug>" content/blog/<slug>.md` for each seeded slug. If any run exits non-zero, the final heartbeat starts with `warn:` and contains `pipeline-check failed slugs=<list>` instead of `ok:`. The audit never reverts, rewrites, or re-pushes anything.
- [ ] `autonomy.allowed_commit_paths` and the explicit seed pathspecs are unchanged. The `drafts/<slug>/` artifact folders are excluded from every `*.md` drafts glob the script uses: they are directories, and the script must not treat them as pending drafts.
- [ ] `tests/blog-cadence-watchdog.test.ts` gains tests covering these properties: both prompts reference dag.md and the artifact folder; the autonomous prompt contains the pipeline-check gate and the `note="pipeline-check"` abort line; and the published branch runs the audit per seeded slug and emits `warn:` on failure. All existing tests in that file still pass.
- [ ] `.claude/skills/blog-from-git/seed.md` lists the pipeline-check exit-0 requirement among its pre-commit checks, and states that the artifacts stay in the gitignored drafts folder and only the final post is committed.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- scripts/blog-cadence-watchdog.sh
- tests/blog-cadence-watchdog.test.ts
- .claude/skills/blog-from-git/seed.md

# Implementation notes

Work in /home/bilko/Projects/Bilko. A prior PRD landed `scripts/blog-pipeline-check.ts`. Read its CLI usage: `<artifact-dir> <post.md>`, exit 0 pass, 1 fail, 2 usage. A sibling PRD running in parallel creates `.claude/skills/blog-from-git/dag.md`. Reference it by path only; do not create it.

Read first:
- `scripts/blog-cadence-watchdog.sh` lines 680-740 (the drafting and autonomous prompt texts: the readability gate is at about line 702, the draft-file instructions at about lines 694 and 736).
- The same file, lines 813-1000 (the `SEED_RESULT: published=*` branch, `SEEDED_SLUGS`, and the `write_heartbeat "ok: ..."` calls at about lines 959 and 994).
- The same file, lines 595-650 (the `EXISTING_DRAFTS=("$DRAFTS_DIR"/*.md)` glob).
- `tests/blog-cadence-watchdog.test.ts` lines 1-120. This suite is static text checks: it never invokes claude or curl. Follow that style.

Steps:
1. Add failing tests first. Run them early and capture the output with `2>&1 | tail -5`.
2. Edit the prompt strings. Escape backticks and quotes the way the neighbouring readability-gate line does.
3. Add a small `run_pipeline_audit` bash function. It loops over `SEEDED_SLUGS`, collects failures, and makes the final heartbeat use `warn: ... pipeline-check failed slugs=...` when any check failed. Every command it runs must be wrapped in `timeout`.
4. Edit seed.md.
5. Run the gate last.

Do not touch: blog.config.yaml, SKILL.md, images.md, dag.md, research.md, ground.md, voice.md (sibling PRDs own them). Do not change the push, rebase-recovery, or cadence-gate logic.

# Out of scope

- Unpublishing or reverting a post that fails the audit
- Committing drafts artifacts
- Posting renditions to LinkedIn or X

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/blog-cadence-watchdog.test.ts tests/blog-pipeline-check.test.ts
timeout 60 bash -n scripts/blog-cadence-watchdog.sh
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
