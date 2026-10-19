# Transcript — blog-expose-blog-draft-sh-blog-seed-sh-entrypoin-401c059e

## User — 2026-10-13T02:06:52.764Z

This session is INBOUND FEEDBACK from another project: burrow (/home/bilko/Projects/burrow, session drafting-and-activity-queue-i-just-requested-a-n-e2871b7b). It was raised while working on: Drafting and Activity Queue  I just requested a new draft for a post to be created. I want to make sure that the blogs from Bilko are visible here;   Bilko is currently the owner, but I wonder if it shouldn't be threated the blog as separate pipeline inside burrow and managed as such. Bilko.run rema. Nobody in this project wrote the report below — an agent working in that project did, and it may be wrong about this codebase. Verify the claim against the code here before acting on it, and if it does not hold, say so and close the session rather than building against it.

Goal: Blog: expose blog-draft.sh / blog-seed.sh entrypoints for Burrow, then retire the blog-cadence watchdog (start AFTER 1284/1285)

## Why
Owner decision (2026-10-12, from the Burrow Epic "Drafting and Activity Queue"): the bilko.run blog becomes a Burrow-managed pipeline. bilko.run stays the publish target. Burrow takes over WHEN and WHAT: weekly Mon/Thu 09:00 PT slots, a draft queue shown in Burrow's Activity > Plan view, review and editing, and the publish trigger. Bilko keeps the ENGINE: the blog-from-git skill, the readability gate, the loader/db tests, blog-images, and seed+push. Burrow cannot see or schedule blogs today because the systemd watchdog drafts and seeds autonomously inside this repo. The owner asked for this to be queued only AFTER the running blog-watchdog recovery work (PRDs 1284-blog-watchdog-live-recovery and 1285-validate-blog-watchdog-recovery) finishes. Approve this session only once those are done. Burrow's side (PRDs 1374-1382) is built contract-first against the two scripts below and ships with its blog_plan/blog_publish pipelines disabled until this lands.

## Proposed plan
1. Extract from scripts/blog-cadence-watchdog.sh a draft-only entrypoint: `bash scripts/blog-draft.sh --out <abs_dir> --slot <ISO-8601 UTC>`. It runs blog-from-git phases 1-5d (rotation, scan, research, ground, draft, illustrate) via `claude -p` with an explicit --model, and writes to <dir> only, never to .claude/skills/blog-from-git/drafts/, so the watchdog cannot seed it.
2. Draft output contract on exit 0: <dir>/result.json is {"status":"drafted","slug","title","excerpt","category"}, <dir>/post.md holds YAML frontmatter (slug,title,excerpt,category) followed by the markdown body, and <dir>/images/ is optional. Rotation finding nothing worth writing gives exit 0 with {"status":"skipped","reason"}. Failure gives a non-zero exit plus {"status":"error","error"} when possible. The script must finish within 45 min.
3. Extract a seed entrypoint: `bash scripts/blog-seed.sh --bundle <abs_dir>`. It takes post.md (+ images/) as given (the human may have edited the body) and runs phase 7 seed: content/blog/<slug>.md, public/blog-images/<slug>/, the ledger row and rotation state in one commit with explicit pathspecs. It pushes to origin, then verifies the post is live on https://bilko.run/api/blog with a bounded poll.
4. Seed output contract: exit 0 only once the post is live, with the last stdout line JSON {"slug","url","commit","published_at"} where url = https://bilko.run/blog/<slug>. If the 3-day minimum-gap cadence gate (scripts/blog-cadence-gate.ts) refuses, exit 3 and commit nothing. Any other failure is a different non-zero exit. The script must finish within 25 min. Both scripts must resolve pnpm/node without relying on an interactive PATH (the 1282 lesson).
5. Make blog-cadence-watchdog.sh reuse the two scripts internally, so there is one implementation until cutover.
6. Retirement PRD, gated on an explicit owner go-ahead (Burrow's blog_plan/blog_publish enabled): disable blog-cadence-watchdog.timer and blog-watchdog-heartbeat-check.timer, and document in blog.config.yaml/SKILL.md that cadence is owned by Burrow (data/pipelines/blog_post/templates.yaml in ~/Projects/burrow).

## Acceptance criteria
- [ ] scripts/blog-draft.sh exists, honours the --out/--slot contract, and never writes into .claude/skills/blog-from-git/drafts/
- [ ] scripts/blog-seed.sh exists and returns exit 0 + JSON last line only after the post is live on /api/blog; exit 3 on the cadence gate with no commit
- [ ] Both scripts pin `claude --model` explicitly and run correctly from a non-interactive (cron/subprocess) environment
- [ ] Tests cover both scripts' exit-code and output contracts (fake claude / fake git push)
- [ ] Watchdog timers are disabled only after the owner confirms Burrow's blog_publish pipeline is enabled

## Out of scope
- Changing blog-from-git editorial rules, voice or rotation
- Touching the 1284/1285 watchdog recovery
- Any change to how bilko.run serves /api/blog

## Details
Context and evidence:
- Burrow (~/Projects/burrow) Epic drafting-and-activity-queue-i-just-requested-a-n-e2871b7b queued PRDs 1374-1382. Its app/pipelines/blog_post/drafter.py:draft_blog_slot calls `bash $BURROW_BILKO_REPO/scripts/blog-draft.sh --out <tmp> --slot <iso>` (cwd = Bilko repo, timeout 2700s) and copies the bundle to burrow/downloads/blog-drafts/. app/pipelines/blog_post/publisher.py:run_blog_publish calls `bash scripts/blog-seed.sh --bundle <dir>` (timeout 1500s) and treats exit 3 as "hold and retry next hour". BURROW_BILKO_REPO defaults to ~/Projects/Bilko.
- app/pipelines/blog_post/site_sync.py in Burrow reads the public GET https://bilko.run/api/blog daily to mirror published posts into Burrow's Activity. No change is needed here for that.
- Current state (2026-10-12): the watchdog has published nothing since 2026-10-07 (pnpm rc=127 at the cadence gate). 1284/1285 are recovering it. Leave that recovery alone; this proposal builds on it.
- Today's draft/seed logic lives in scripts/blog-cadence-watchdog.sh (~1053 lines; drafting around :700-750, gap gate :505-520, stalled-draft logic :610-652) and .claude/skills/blog-from-git/{SKILL.md,seed.md,blog.config.yaml}.
- Until the retirement step, Burrow keeps blog_plan/blog_publish disabled, so the watchdog and Burrow never both publish. The seed script's 3-day gap gate is the second safety net.

Reference: /home/bilko/Projects/Bilko/scripts/blog-cadence-watchdog.sh
Reference: /home/bilko/Projects/Bilko/.claude/skills/blog-from-git/SKILL.md
Reference: /home/bilko/Projects/Bilko/.claude/skills/blog-from-git/seed.md
Reference: /home/bilko/Projects/burrow/session-manager-operations/scheduler/epics/drafting-and-activity-queue-i-just-requested-a-n-e2871b7b/prds/1376-blog-slot-drafter.md
Reference: /home/bilko/Projects/burrow/session-manager-operations/scheduler/epics/drafting-and-activity-queue-i-just-requested-a-n-e2871b7b/prds/1378-blog-publisher.md

## User — 2026-10-13T02:10:32.594Z

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

## Agent — 2026-10-13T02:11:39.300Z

The report checked out, so I queued three build PRDs and one validation PRD as a chain. Nothing has been built yet; the scheduler will run them in order.

**What I checked before queuing:**
- **The prerequisites are done.** The two watchdog recovery jobs, `1284-blog-watchdog-live-recovery` and `1285-validate-blog-watchdog-recovery`, both show as completed in the scheduler.
- **The current code matches the report.** `scripts/blog-cadence-watchdog.sh` is 1,053 lines. The line ranges the report gave for the next-slot gate, pending-drafts logic and drafting prompt are right. The watchdog already pins `--model`. Both blog timers are still running on the systemd schedule.
- **One gap in the plan.** The seed step is supposed to commit images to `public/blog-images/<slug>/`, but `autonomy.allowed_commit_paths` in `blog.config.yaml` doesn't include that folder. The watchdog also has a hard check that stops it when that list doesn't match its own commit paths. I folded the fix for both into the seed PRD.

**Queued, in the epic `blog-expose-blog-draft-sh-blog-seed-sh-entrypoin-401c059e`:**
1. **`1299-blog-draft-entrypoint`** builds `scripts/blog-draft.sh --out <dir> --slot <iso>` plus a shared helper file, `scripts/blog-pipeline-lib.sh`.
   - It returns a result of drafted, skipped or error, writes only into the folder it's given, and must finish in under 45 minutes.
   - The script itself checks afterwards that it didn't write into the watchdog's drafts folder.
   - Tests use a fake `claude` on a minimal PATH.
2. **`1300-blog-seed-entrypoint`** builds `scripts/blog-seed.sh --bundle <dir>`, after 1299.
   - It uses the post exactly as given, so human edits are kept.
   - It writes the post, images and ledger row in one commit, staging only those paths explicitly.
   - It pushes to origin main, waits until the post shows up on `/api/blog`, and only then exits 0 with the JSON line Burrow expects.
   - If the cadence gate refuses, it exits 3 and commits nothing.
   - This PRD also adds `public/blog-images/` to the allowed paths and updates the watchdog's matching check.
   - Tests use a temporary git repo and a fake `curl`.
3. **`1301-blog-watchdog-use-entrypoints`** changes the watchdog to call the two new scripts, so drafting and seeding have one implementation until cutover. It runs after 1300.
4. **`1302-validate-blog-burrow-entrypoints`** is a validation pass after 1301. It checks the scripts against Burrow's PRDs 1376 and 1378, confirms every `claude -p` call pins its model, and confirms the timers are still enabled.

**Not queued:** step 6, turning off the two watchdog timers. The report says that needs your explicit go-ahead after Burrow's `blog_plan` and `blog_publish` pipelines are enabled, so I left it out. No timers have been touched.

## Agent — 2026-10-13T02:12:27.380Z

`scripts/blog-draft.sh` now exists and the gate is green: 14 tests pass in `tests/blog-draft.test.ts` and `bash -n` is clean. The tests use fake `claude`, `npx` and `pnpm` stubs, so the real `claude` was never called. I never skipped to a red run first, because the test and script were written together; the first run of the finished test passed.

**Files**
- `scripts/blog-draft.sh`
- `scripts/blog-pipeline-lib.sh` (sourced helpers: env sourcing, frontmatter validation, JSON escaping, the prompt)
- `tests/blog-draft.test.ts`

**What it does**
- **Arguments:** a missing or relative `--out`, an unparseable `--slot`, or an unknown flag exits 2 with the usage line.
- **Claude call:** one `claude -p` pinned to `--model claude-sonnet-5`, the same model as the watchdog, under `timeout 2400`. The 120s readability timeout on top keeps the script well under 45 minutes. DAG files go to `<out>/artifacts/`.
- **Result:** the last line claude prints decides drafted vs skipped. The script validates `post.md`, runs the readability gate, then writes `result.json`. Skipped and error results use the shapes in the acceptance criteria.
- **Guard:** the script snapshots git status of `content/blog`, `public/blog-images` and `blog-ledger.md`, plus HEAD, the staged file list and the `drafts/` listing, before and after the claude call. Any change fails the run.
- **Binaries:** it sources `blog-watchdog-env.sh` and fails fast, naming any missing binary. The required list is `claude git npx pnpm timeout`, which drops the watchdog's `curl`/`flock`/`jq`/`node`/`awk`.

**Choices to know about**
- **Skip signal:** claude signals a skip by printing `DRAFT_RESULT: skipped reason="..."` as its last line. Burrow doesn't see this line; it only reads `result.json`.
- **Image check:** the script also checks that every `/blog-images/<slug>/x.jpg` reference in the post has a matching file in `<out>/images/`.
- **Test cleanup:** the guard tests deliberately write a rogue file into the real `drafts/` and `content/blog/` to prove the guard fires, and clean it up afterward.
- **Install:** the worktree had no `node_modules`, so I ran `pnpm install --frozen-lockfile --offline` to run the gate. Nothing from that install was committed.
- **Review steps:** I did not run `/code-review` or `/security-review`. I reviewed the diff by hand instead. User input only reaches `date -u -d`, `mkdir` and quoted arguments, and JSON output is escaped.

SCHEDULER_VERDICT: PASS

## User — 2026-10-13T02:14:03.098Z

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

## Agent — 2026-10-13T02:18:14.224Z

`scripts/blog-seed.sh --bundle <abs_dir>` is built and committed. I haven't run it against the real origin or the live site. The gate's two commands exited 0: `tests/blog-seed.test.ts` and `tests/blog-cadence-watchdog.test.ts` pass (113 tests), and `bash -n scripts/blog-seed.sh` is clean. I also ran the red test first: all five failed before the script existed.

**Exit codes**
- 0: the slug is live, and the last stdout line is `{"slug","url","commit","published_at"}`.
- 1: error.
- 2: bad bundle (missing `post.md`, bad frontmatter or bad image refs), nothing committed.
- 3: the cadence gate refused. Written files are rolled back and HEAD is unchanged.
- 4: the readability check failed. Nothing was written. I picked this code myself; the PRD didn't specify one.
- 5: pushed, but the slug didn't appear before the poll timeout.

**How it works**
- **Writes:** `scripts/blog-seed-apply.ts` writes `content/blog/<slug>.md` with the body verbatim, copies the images, and adds the ledger row and rotation-state update.
- **Gates:** the readability check runs on the bundle before anything is written, then the cadence gate runs after.
- **Commit:** one commit that stages only the changed paths, which must match `autonomy.allowed_commit_paths`. It refuses unless origin is `StanislavBG/bilko-run` and HEAD is on `main`.
- **Push:** `git push origin main`, with the watchdog's fetch/rebase retry on a push race. I added `--autostash` to the rebase because this tree has hundreds of unrelated modified files.
- **Poll:** `/api/blog` is polled using the interval and timeout from `blog.config.yaml`, capped so the whole script stays under 1440s.
- **Config and watchdog:** `blog.config.yaml` gains `public/blog-images/`, and the watchdog's expected-paths check and error message now match. The watchdog test's real-config assertion now expects three paths.
- **No `claude -p`:** nothing in the script calls it, so there's no model to pin.
- **PATH:** `blog-pipeline-lib.sh` gained a seed-specific binary preflight (`curl`, `jq`, `flock`, `node`, etc.). It resolves `pnpm` and `node` through `blog-watchdog-env.sh`.

**Behaviours the PRD didn't specify**
- **Retry:** if the slug is already on origin/main, it skips straight to polling. That lets Burrow retry after a poll-timeout exit.
- **Rollback:** a failed push or rebase undoes the commit, so a retry starts clean.
- **Future `published_at`:** a bundle `published_at` in the future ends in exit 5, because `/api/blog` hides future-dated posts.
- **Ledger fields:** the ledger row's project and tone come from optional `project` and `tone` bundle frontmatter. They default to the slug and `unspecified (burrow)`.
- **Dependencies:** the worktree had no `node_modules`, so I ran `pnpm install --frozen-lockfile`.

One command was denied mid-run, a heredoc containing `rm` on variable paths. Nothing had run, so I redid the edits with the edit tools and switched the script's rollback to pathspec-scoped `git clean`.

SCHEDULER_VERDICT: PASS

## User — 2026-10-13T02:18:35.970Z

# Goal

Until Burrow cutover there must be one implementation of drafting and seeding. Refactor scripts/blog-cadence-watchdog.sh so its autonomous path calls scripts/blog-draft.sh (into a temp dir) and then scripts/blog-seed.sh on that bundle, instead of its own inline claude -p phase 1-7 prompt; heartbeat, lock, cadence gate and pending-drafts behaviour keep working.

# Acceptance criteria

- [ ] Autonomous publish path in blog-cadence-watchdog.sh invokes scripts/blog-draft.sh --out <tmp> --slot <NEXT_SLOT> then scripts/blog-seed.sh --bundle <tmp>; the duplicated inline seed/push/verify code is removed or reduced to calling the shared lib
- [ ] Exit mapping: draft skipped -> scan-only/heartbeat ok-or-stall as today; seed exit 3 -> no commit, heartbeat reflects cadence hold; other failures -> heartbeat error naming which script and rc; state lock kept only when blog-seed.sh returned 0
- [ ] Non-autonomous mode still leaves a reviewable draft in .claude/skills/blog-from-git/drafts/ (copy the bundle's post.md there with the existing front-matter fields) and never seeds
- [ ] Every claude -p reached from the watchdog still pins --model
- [ ] tests/blog-cadence-watchdog.test.ts updated to the new structure and an execution test with fake blog-draft.sh/blog-seed.sh covers drafted+seeded, skipped, and exit-3 paths; tests/blog-watchdog-env.test.ts and tests/blog-watchdog-heartbeat.test.ts still pass

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- scripts/blog-cadence-watchdog.sh
- scripts/blog-pipeline-lib.sh
- tests/blog-cadence-watchdog.test.ts
- tests/blog-watchdog-heartbeat.test.ts

# Implementation notes

Keep the daily scan-only path, next-slot gate (:505-597), and heartbeat semantics intact. Pending-drafts consumption (:610-760): convert each pending drafts/*.md into a bundle and seed it via blog-seed.sh, honoring max_posts_per_run. Allow BLOG_DRAFT_CMD / BLOG_SEED_CMD env overrides for tests only. Do not touch systemd timers.

# Out of scope

- Disabling blog-cadence-watchdog.timer or blog-watchdog-heartbeat-check.timer (needs explicit owner go-ahead after Burrow blog_publish is enabled)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 900 pnpm vitest run tests/blog-cadence-watchdog.test.ts tests/blog-watchdog-env.test.ts tests/blog-watchdog-heartbeat.test.ts tests/blog-draft.test.ts tests/blog-seed.test.ts
timeout 60 bash -n scripts/blog-cadence-watchdog.sh
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.

## Agent — 2026-10-13T02:22:32.308Z

The watchdog now drafts with `blog-draft.sh` into a temp dir and seeds that bundle with `blog-seed.sh`. The gate is green: the five vitest files pass (70 tests, including `blog-watchdog-env` and `blog-watchdog-heartbeat`, which I didn't touch), and `bash -n` on the watchdog exits 0. The commit is `d7dd941`.

I skipped the early red run. This PRD rewrites existing structural tests, so there was no single new test to capture failing first.

**What changed in `scripts/blog-cadence-watchdog.sh`**
- **Removed:** the inline `claude -p` phase 1-7 prompt and all the push, rebase, ledger-audit and live-pickup code. `blog-seed.sh` already does these.
- **Dead helpers removed:** the spotlight, ledger and cooldown helpers, the `allowed_commit_paths` cross-check, and `project_cooldown_posts` parsing. The `blog-draft.sh` prompt now owns rotation.
- **Kept:**
  - the daily scan-only path;
  - the next-slot gate;
  - the same-day lock, heartbeat and EXIT trap;
  - the push-remote assertion;
  - the non-autonomous pending-draft skip and its age warning.
- **Draft result:** skipped gives an `ok` or `warn` heartbeat by gap, with the lock cleared. A draft failure gives `error: blog-draft.sh rc=N (<error from result.json>)`.
- **Seed result:** rc 0 keeps the lock and writes an `ok` heartbeat, or `warn` if the post-publish pipeline check fails. rc 3 clears the lock, commits nothing and writes a "cadence hold" heartbeat. Any other rc gives `error: blog-seed.sh rc=N`, clears the lock and exits 1.
- **Pending drafts (autonomous):** each pending `drafts/*.md` is converted to a bundle and seeded, up to `max_posts_per_run`, and the draft file is deleted on rc 0.
- **Non-autonomous mode:** the bundle's `post.md` is copied to `drafts/<date>-<slug>.md` with title, slug, excerpt, category, published_at, tone, authored_by and authored_at. It never seeds.
- **`claude -p` pinning:** the only `claude -p` call left in the watchdog is the scan-only one, and it still pins `--model`.
- **Test overrides:** `BLOG_DRAFT_CMD` and `BLOG_SEED_CMD` swap in fake entrypoints.

**Other files**
- `scripts/blog-pipeline-lib.sh`: added the draft-to-bundle and bundle-to-draft converters, and a body-extraction helper.
- `tests/blog-cadence-watchdog.test.ts`: rewritten for the new structure. It runs the real watchdog in a scratch repo with fake entrypoints, covering drafted and seeded, draft skipped, seed rc 3, other seed rc, draft error, non-autonomous, pending-draft seeding, the pending-draft cap, and pending drafts skipped in non-autonomous mode.
- `tests/blog-watchdog-heartbeat.test.ts`: unchanged, because it only tests the heartbeat checker script.

**Behaviour changes to know about**
- Converted pending drafts drop their `published_at`. Otherwise an old value could make the cadence gate refuse the post forever. `blog-seed.sh` supplies the date.
- A pending draft that can't be converted, or that `blog-seed.sh` rejects with rc 2, is renamed `.rejected-invalid` so it doesn't block later runs. The old rotation-gate rename and the single re-draft attempt are gone, since rotation is now `blog-draft.sh`'s job.
- The worktree had no `node_modules`, so I symlinked the main checkout's to run vitest. The symlink is untracked and not in the commit.

SCHEDULER_VERDICT: PASS

## User — 2026-10-13T02:22:57.114Z

# Goal

Validate PRDs 1299-blog-draft-entrypoint, 1300-blog-seed-entrypoint and 1301-blog-watchdog-use-entrypoints against the real tree and the Burrow contract (Burrow PRDs 1376/1378), once, after the last lands.

# Acceptance criteria

- [ ] Each PRD's gate re-run and passes
- [ ] Every acceptance criterion checked against the tree with one VERIFIED/REFUTED verdict per PRD
- [ ] Contract cross-check: blog-draft.sh args/result.json/post.md and blog-seed.sh args/exit 3/last-line JSON match /home/bilko/Projects/burrow/session-manager-operations/scheduler/epics/drafting-and-activity-queue-i-just-requested-a-n-e2871b7b/prds/1376-blog-slot-drafter.md and 1378-blog-publisher.md
- [ ] Every claude -p call under scripts/blog-*.sh pins --model
- [ ] Systemd blog timers were NOT disabled by this plan

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- scripts/blog-draft.sh

# Implementation notes

Read-only. Run `pnpm typecheck` and the full blog test set. Check `systemctl --user is-enabled blog-cadence-watchdog.timer blog-watchdog-heartbeat-check.timer` still reports enabled.

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 900 pnpm vitest run tests/blog-draft.test.ts tests/blog-seed.test.ts tests/blog-cadence-watchdog.test.ts tests/blog-watchdog-env.test.ts tests/blog-watchdog-heartbeat.test.ts
timeout 600 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.

## Agent — 2026-10-13T02:24:13.215Z

All three PRDs are verified. The five blog test files pass (70 tests) and `pnpm typecheck` exits 0. The review record is committed as c58eed4, at `session-manager-operations/reviews/validation/blog-expose-blog-draft-sh-blog-seed-sh-entrypoin-401c059e/validate-blog-burrow-entrypoints.md`.

- **Burrow contract:** the args, exit codes and output of `blog-draft.sh` and `blog-seed.sh` match Burrow PRDs 1376 and 1378, including seed's exit 3 and last-line JSON. I read those PRDs from `prds-archived/`.
- **Model pinning:** every `claude -p` call pins `--model claude-sonnet-5`. That is `blog-draft.sh` and the watchdog's daily scan; `blog-seed.sh` makes no `claude -p` call.
- **Systemd timers:** both blog timers still report `enabled`.
- **Findings:** no Critical or Important findings. There are three Minor items:
  - A stray zero-byte file named `<path>` sits untracked in the worktree root. It isn't from this plan's commits, and I left it alone.
  - PRD 1302 has no `Base:` line, so I used 42ae188 (the parent of the first plan commit) as the base.
  - PRD 1302's `# Files` lists only `scripts/blog-draft.sh`, although the deliverable is the review record.
- **Environment:** the job worktree had no `node_modules`, so I symlinked the main tree's (gitignored) copy to run the gates. That symlink is not committed.

VALIDATION: 1299-blog-draft-entrypoint VERIFIED
VALIDATION: 1300-blog-seed-entrypoint VERIFIED
VALIDATION: 1301-blog-watchdog-use-entrypoints VERIFIED
SCHEDULER_VERDICT: PASS
