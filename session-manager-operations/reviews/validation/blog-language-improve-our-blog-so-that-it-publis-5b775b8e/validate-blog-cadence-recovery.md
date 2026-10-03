# Validation: blog-watchdog-catchup-spotlight / blog-watchdog-lock-after-publish / blog-heartbeat-auto-retry

Base: `0364a52` (previous validation's HEAD — "docs(validation): verify blog-language plan's four PRDs").

PRD files located at `/home/bilko/Projects/Bilko/session-manager-operations/scheduler/epics/blog-language-improve-our-blog-so-that-it-publis-5b775b8e/{prds,prds-archived}/` — this epic's own worktree. The epic directory does not exist under this validation job's own worktree-relative path (scheduler epic/PRD directories are worktree-local runtime state, not committed to git — consistent with the prior validation record's note).

Commits in scope (`git log --oneline 0364a52..HEAD`):
- `88a4c1c` fix(blog-watchdog): make catch-up mode describe its spotlight fallback — PRD 1019
- `b9d2b9d` fix(blog-watchdog): clear same-day lock unless a post was actually seeded — PRD 1020
- `13db9d0` fix(blog-watchdog): auto-retry the watchdog on error:/warn: heartbeats — PRD 1021
- `f6a0324` social-signals-trader: publish dashboard snapshot — unrelated automated publish job, touches only `public/projects/social-signals-trader/dashboard-code.bundle.js` (timestamp refresh); not part of this plan, not caused by it.

## PRD 1019 — blog-watchdog-catchup-spotlight — VERIFIED

| AC | Evidence |
|---|---|
| Catch-up mode's `MODE_INSTRUCTIONS` describes the spotlight fallback: write ONE spotlight post on the first candidate, dated `AUTHORED_AT`, when the backfill queue would be empty | `scripts/blog-cadence-watchdog.sh:218-227` — new `build_mode_instructions()`; catch-up branch (`:222-227`) appends `catchup_spotlight_note` naming the exact trigger condition and "Date it AUTHORED_AT (not backdated)". |
| `COOLDOWN_INSTRUCTIONS`' spotlight branch no longer depends on portfolio-only wording | `scripts/blog-cadence-watchdog.sh:561` — now reads "per blog.config.yaml cadence.no_new_work_fallback: spotlight, write ONE evergreen FEATURE SPOTLIGHT post on the first of these candidates instead, dated AUTHORED_AT (not backdated)" (the old "described in the mode instructions above" phrase is gone). |
| New test: catch-up mode + non-empty spotlight candidates mentions spotlight and the first candidate | `tests/blog-cadence-watchdog.test.ts:785-816` — `build_mode_instructions (... PRD 1019)` describe block: asserts `Catch-up mode`, `spotlight`, `outdoor-hours` (first candidate), `AUTHORED_AT`, `not backdated`; a sibling test asserts the note is omitted when candidates are empty; a sibling test confirms `MODE_INSTRUCTIONS="$(build_mode_instructions …)"` is actually wired into the main script. |
| Existing tests + `bash -n` still pass | Re-ran below — 90 tests in `tests/blog-cadence-watchdog.test.ts` pass, `bash -n` exits 0. |

Gate (`timeout 60 bash -n scripts/blog-cadence-watchdog.sh`, `timeout 300 pnpm vitest run tests/blog-cadence-watchdog.test.ts tests/blog-watchdog-heartbeat.test.ts`): **PASS** — both exit 0; 104 tests total (90 + 14), all green.

## PRD 1020 — blog-watchdog-lock-after-publish — VERIFIED (one Important finding — see below)

| AC | Evidence |
|---|---|
| Lock kept only on `published=N, N>=1`; cleared on noop/cooldown_blocked/error/unparseable/non-zero exit | `scripts/blog-cadence-watchdog.sh:126-144` — new pure `keep_state_lock_for_seed_line()`; called at `:697-699` right after `SEED_LINE` is computed (covers noop/cooldown_blocked/error/unparseable paths) and at `:673-675` on the `$CLAUDE_RC -ne 0` exit path (passes `''`, which the function clears). |
| Pre-invocation state write and `EXISTING_DRAFTS`/`max_posts_per_run` behavior unchanged | `scripts/blog-cadence-watchdog.sh:655` `echo "$TODAY $MODE $GAP_DAYS" > "$STATE_FILE"` — diff shows no change to this line or to the orphan-draft / max-posts logic above it. |
| Second same-day run still short-circuits to scan-only | `scripts/blog-cadence-watchdog.sh:505-509` (`if [[ -f "$STATE_FILE" ]]` → `run_scan_only`) is untouched by this diff — the new lock-clearing logic only changes when the file gets removed, not this read-side check. |
| Pure function, tested for every SEED_RESULT shape incl. `published=1` keep and `N>=2` keep | `tests/blog-cadence-watchdog.test.ts:859-898` `keep_state_lock_for_seed_line (… PRD 1020)`: `published=1`→keep, `published=0`/noop/cooldown_blocked/error/empty/unparseable→clear, `published=3`→keep. |
| `write_heartbeat` still called exactly once per run; `bash -n` clean | `grep -n write_heartbeat scripts/blog-cadence-watchdog.sh` — exactly one `write_heartbeat` call per code path (error/ok/warn/noop branches are mutually exclusive `if/elif`), unchanged by the diff; `bash -n` exits 0 (ran below). |

Gate (same two commands as PRD 1019 — this PRD shares the gate): **PASS** (same 104-test run).

**Important finding (not a gate failure, not grounds for REFUTED — the AC's literal text is met and tested exactly as written):** `scripts/blog-cadence-watchdog.sh:697-699` decides to keep the lock from the `SEED_RESULT: published=N` text alone, *before* the pre-existing mechanical verification that follows a `published=*` match (push-race recovery `:752-797`, disallowed-path check `:804-821`, rotation-cooldown check `:828-834`, HEAD-vs-origin assertion). If any of those checks fails — e.g. push-race recovery exhausts its 3 attempts, or the seeded commit violates the cooldown — the script still `write_heartbeat "error: …"` and `exit 1`, but `$STATE_FILE` was already kept at `:698` and is never re-evaluated on this path. Net effect: a run that self-reported `published=1` but was then mechanically rejected still leaves the same-day lock in place, blocking the next scheduled run (and PRD 1021's new auto-retry) from a same-day publish attempt — a narrower version of exactly the stall this PRD's Goal describes fixing. Confirmed by reading `scripts/blog-cadence-watchdog.sh:690-834`; the AC text ("kept ONLY when the run seeded at least one post (SEED_RESULT: published=N…)") is satisfied by the implementation and by the new tests, which only exercise the SEED_LINE text and don't reach this downstream-failure interaction — so this is a real gap the AC itself didn't anticipate, not a failed AC.

## PRD 1021 — blog-heartbeat-auto-retry — VERIFIED

| AC | Evidence |
|---|---|
| `error:`/`warn:` branches start `systemctl --user start --no-block blog-cadence-watchdog.service`, log it, still exit 1 | `scripts/check-blog-watchdog-heartbeat.sh:166,171` call `maybe_retry "$status"` before `exit 1` in both the `error:*` and `warn:*` cases of `main()`'s case statement; `maybe_retry()` (`:97-115`) logs `RETRY: starting …` and runs `"$SYSTEMCTL" --user start --no-block blog-cadence-watchdog.service` when `should_retry` says so. |
| Rate limit: marker file, ≤1 retry/6h, ≤3/PT-day, logs when skipped | `scripts/check-blog-watchdog-heartbeat.sh:44-82` `should_retry()` — `RETRY_COOLDOWN_SECONDS=$((6*3600))`, `MAX_RETRIES_PER_DAY=3`, PT-day bucketing via `TZ=America/Los_Angeles date -d "@$now_epoch" +%Y-%m-%d`; `maybe_retry()`'s else-branch (`:113-115`) logs "retry rate-limited, not starting …". |
| No retry on `ok:`, on stale/dead-watchdog (CRITICAL age path), or when the service is already active | `should_retry()` `:50-56` returns `none` for any status other than `error:*`/`warn:*`; `:58-61` returns `none` when `service_active == "active"`; the staleness `CRITICAL` branch (`:138-144`) exits 1 without ever calling `maybe_retry`. |
| Pure `should_retry <status> <now_epoch> <marker_contents> <service_active>`, tested for all 6 named cases, never touches real `systemctl` | `tests/blog-watchdog-heartbeat.test.ts` new `describe('should_retry', …)` block — 6 tests: error→retry, warn→retry, ok→none, within-6h→none, 3-today→none, service-active→none; all invoke the sourced function directly, no real systemctl call. The existing `runChecker` integration tests were updated to pass a `fakeSystemctl` stub script and an isolated `BLOG_WATCHDOG_RETRY_MARKER_FILE` (`tests/blog-watchdog-heartbeat.test.ts:17-45`), so no test touches the real service or the real marker file either. |
| Existing tests pass; `bash -n` clean | Re-ran below — 14 tests in `tests/blog-watchdog-heartbeat.test.ts` pass (including all pre-existing ones), `bash -n` exits 0. |

Gate (`timeout 60 bash -n scripts/check-blog-watchdog-heartbeat.sh`, `timeout 300 pnpm vitest run tests/blog-watchdog-heartbeat.test.ts tests/blog-cadence-watchdog.test.ts`): **PASS** — both exit 0; 104 tests total, all green.

## Combined re-run of all PRD gates (this validation)

```
timeout 60 bash -n scripts/blog-cadence-watchdog.sh                                      → exit 0
timeout 60 bash -n scripts/check-blog-watchdog-heartbeat.sh                               → exit 0
timeout 300 pnpm vitest run tests/blog-cadence-watchdog.test.ts tests/blog-watchdog-heartbeat.test.ts
                                                                                            → 2 files, 104 tests, all passed
timeout 300 pnpm typecheck (tsc --noEmit)                                                 → clean, exit 0
```

(`node_modules` was absent in this job's worktree; `pnpm install --frozen-lockfile` resolved instantly from the local pnpm store before running the above — no lockfile or dependency changes resulted.)

## Diff review

`git diff 0364a52..HEAD --stat`: 5 files changed, 448 insertions, 75 deletions — `scripts/blog-cadence-watchdog.sh` (+72/-8), `scripts/check-blog-watchdog-heartbeat.sh` (+154/-44, effectively a full rewrite into `main()`/`should_retry()`/`maybe_retry()`), `tests/blog-cadence-watchdog.test.ts` (+140), `tests/blog-watchdog-heartbeat.test.ts` (+95/-14), plus the one unrelated social-signals-trader snapshot file noted above.

### Code review (`code-review` skill, medium)

Two findings, both read and confirmed against the live diff:

1. **Important** — the lock-interaction gap on `scripts/blog-cadence-watchdog.sh:697-699` vs. the downstream `published=*` verification (`:752-834`), described in full under PRD 1020 above. Not fixed here — out of scope for a validator; the Goal's literal AC is met and tested, this is a follow-up finding.
2. **Minor** — `scripts/check-blog-watchdog-heartbeat.sh`'s `RETRY_MARKER_FILE` (`:105` `printf '%s\n' "$now_epoch" >>"$RETRY_MARKER_FILE"`) grows forever; nothing prunes lines from prior PT-days, so `should_retry()`'s line-by-line loop (`:67-76`) does unbounded work over the file's lifetime. Confirmed by reading the code — no day-bucket pruning or line cap exists anywhere in the diff. Cosmetic/efficiency only (not in this validation's scope to fix); worth a follow-up PRD if it matters (file growth is ~1 line per retry, capped by the existing ≤3/day rate limit, so practical growth is slow).

### Security review

The `security-review` skill auto-detected the branch-vs-`main` diff rather than the requested `0364a52..HEAD` range and returned an unrelated, empty result (it found only the latest automated snapshot-publish commit). Falling back to a manual read of the diff per the validator procedure: both scripts only consume **trusted** inputs — `SYSTEMCTL`/`BLOG_WATCHDOG_RETRY_MARKER_FILE`/`BLOG_WATCHDOG_HEARTBEAT_FILE` are operator/test-set env vars (never attacker-controlled per this repo's threat model — local cron/systemd scripts, no network-facing input), the retry marker file is written/read by the script itself (epoch integers only, no interpolation into `eval` or a sub-shell), and no new code path accepts remote/user input. No command injection, path traversal, or secret-handling issues found in this diff.

## Findings (ranked)

- **Important** — `scripts/blog-cadence-watchdog.sh:697-699`: same-day lock is decided from the `SEED_RESULT: published=N` text before the downstream push-race/disallowed-path/rotation-cooldown verification runs, so a self-reported publish that is later mechanically rejected still leaves the lock held, blocking a same-day retry. Narrower recurrence of the exact problem PRD 1020 set out to fix; not caught by its own AC or new tests, both of which only exercise the SEED_LINE text in isolation. Fix direction: re-call `keep_state_lock_for_seed_line` with an updated/failed outcome (or just `rm -f "$STATE_FILE"`) on each of the four downstream `exit 1` paths inside the `published=*` branch.
- **Minor** — `scripts/check-blog-watchdog-heartbeat.sh:105`: `RETRY_MARKER_FILE` grows without bound (no pruning of past-day lines). Low practical impact given the ≤3/day rate limit already caps growth; a day-bucket prune would be a clean follow-up but is not urgent.

VALIDATION: blog-watchdog-catchup-spotlight VERIFIED
VALIDATION: blog-watchdog-lock-after-publish VERIFIED
VALIDATION: blog-heartbeat-auto-retry VERIFIED
SCHEDULER_VERDICT: PASS
