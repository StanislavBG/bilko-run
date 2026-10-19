---
title: Blog: scripts/blog-seed.sh publish entrypoint for Burrow
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 15
createdVia: scheduler-api
issuedAt: 2026-10-13T02:10:53.346Z
sourcePromptId: blog-expose-blog-draft-sh-blog-seed-sh-entrypoin-401c059e
tag: feature
agentType: dev-lead
dependsOn: [1299-blog-draft-entrypoint]
planId: pl-mv61m6ql-0ceaeb
---
# Goal

Burrow (app/pipelines/blog_post/publisher.py) calls `bash scripts/blog-seed.sh --bundle <abs_dir>` (timeout 1500s) with a human-reviewed post.md (+ images/). Build the script: run phase 7 seed exactly as given, commit with explicit pathspecs, push to origin main, and return only once the post is live on https://bilko.run/api/blog. Exit 3 means the cadence gate refused and Burrow retries next hour.

# Acceptance criteria

- [ ] scripts/blog-seed.sh exists; usage `bash scripts/blog-seed.sh --bundle <abs_dir>`; missing bundle/post.md or invalid frontmatter (slug,title,excerpt,category) exits 2 and commits nothing
- [ ] post.md body is used verbatim (human edits preserved); writes content/blog/<slug>.md in the loader's format (server/blog-posts.ts), copies <bundle>/images/* to public/blog-images/<slug>/, appends the blog-ledger.md row and updates its rotation-state block
- [ ] Runs `pnpm tsx scripts/blog-cadence-gate.ts check` (and readability check) before committing; a cadence-gate refusal exits 3 with the working tree and HEAD unchanged (any written files rolled back)
- [ ] One commit staged with explicit pathspecs only (content/blog/<slug>.md, public/blog-images/<slug>/, .claude/skills/blog-from-git/blog-ledger.md); push is `git push origin main` only, with the same fetch/rebase push-race recovery as the watchdog; refuses if origin is not StanislavBG/bilko-run
- [ ] blog.config.yaml autonomy.allowed_commit_paths gains public/blog-images/ and the watchdog's FATAL allowed-paths check in blog-cadence-watchdog.sh is updated to match so it still passes
- [ ] After push, polls https://bilko.run/api/blog (bounded, interval/timeout from blog.config.yaml verify_deploy_*) until the slug appears; exit 0 only then, last stdout line JSON {"slug","url":"https://bilko.run/blog/<slug>","commit","published_at"}; poll timeout is a distinct non-zero exit (not 3); whole script bounded under 25 min
- [ ] If any `claude -p` is used it pins --model; script resolves pnpm/node under a non-interactive PATH via scripts/blog-pipeline-lib.sh / blog-watchdog-env.sh
- [ ] tests/blog-seed.test.ts runs the script against a temp git repo with a bare-repo origin, fake curl and fake pnpm-gate on a minimal PATH: covers success JSON, exit 3 no-commit, bad bundle exit 2, live-poll timeout, and asserts only the allowed paths are in the commit; existing tests/blog-cadence-watchdog.test.ts still passes

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- scripts/blog-seed.sh
- scripts/blog-seed-apply.ts
- scripts/blog-pipeline-lib.sh
- scripts/blog-cadence-watchdog.sh
- .claude/skills/blog-from-git/blog.config.yaml
- tests/blog-seed.test.ts
- tests/blog-cadence-watchdog.test.ts

# Implementation notes

Current seed logic is prose in .claude/skills/blog-from-git/seed.md and the autonomous REQUIREMENTS prompt in scripts/blog-cadence-watchdog.sh (:720-760); push-race recovery :855-930; live verification near :940+; allowed_commit_paths check :418-447. Prefer deterministic bash/tsx for the file writes (a small scripts/blog-seed-apply.ts is fine if it keeps ledger editing testable) over claude -p. Make the repo root / origin URL / api URL overridable by env for tests only (e.g. BLOG_SEED_API_URL), defaulting to production. published_at: use the bundle frontmatter's published_at if present, else now, and it must satisfy the cadence gate. The working tree has hundreds of unrelated modified files (public/outdoor-hours/...) — never sweep them in. Burrow contract: /home/bilko/Projects/burrow/session-manager-operations/scheduler/epics/drafting-and-activity-queue-i-just-requested-a-n-e2871b7b/prds/1378-blog-publisher.md

# Out of scope

- Changing editorial rules, voice or rotation
- Any change to how bilko.run serves /api/blog
- Disabling watchdog timers

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 600 pnpm vitest run tests/blog-seed.test.ts tests/blog-cadence-watchdog.test.ts
timeout 60 bash -n scripts/blog-seed.sh
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
