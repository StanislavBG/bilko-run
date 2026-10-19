---
title: "Fix: make blog-cadence-gate next-slot print one ISO line so 1144 re-validates and the wave can publish"
cwd: /home/bilko/Projects/Bilko
parallelGroup: 1166
estimateMinutes: 35
isFixPlan: true
---

# Goal

Unblock the publish job `1166-publish-simplification-wave-2`. To do that, fix the one defect that left PRD 1144 REFUTED. Then re-validate 1144 and update its validation record so it has no REFUTED line and no Critical/Important entry. **Do NOT push and do NOT run the publish job yourself.** The scheduler re-runs 1166 after this fix lands.

# Root-cause analysis

- Job 1166 starts by reading the wave's validation records under
  `session-manager-operations/reviews/validation/review-the-project-for-code-quality-perofmance-i-c56527b0/`. It halts if any record has a REFUTED line or a Critical/Important entry other than `- none`. It halted correctly, pushed nothing and exited with `SCHEDULER_VERDICT: FAIL`.
- The blocker is `validate-blog-files-db.md`:
  - `## 1144-blog-pipeline-seed-path — REFUTED — dry run prints FATAL (pre-existing cause)`
  - `### Important`: the stdout `[DB] Initialized` line breaks the next-slot ISO check.
- The mechanism:
  - `scripts/blog-cadence-gate.ts`: `runNextSlot()` calls `loadSeededPosts()`. That function (around lines 80-81) does `await import('../server/db.js')` and `await initDb()`.
  - `initDb()` ends with `console.log('[DB] Initialized' + ...)` at `server/db.ts:401`, which goes to **stdout**.
  - `runNextSlot()` then prints the ISO slot with `console.log`, so stdout ends up as two lines: `[DB] Initialized (local SQLite)` followed by `2026-10-10T16:00:00.000Z`.
  - `scripts/blog-cadence-watchdog.sh:501-505` runs `NEXT_SLOT="$(timeout 180 pnpm tsx scripts/blog-cadence-gate.ts next-slot 2>&1)"`. It requires `"$NEXT_SLOT" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T` and otherwise prints `FATAL: cadence gate next-slot unavailable or returned a non-ISO value` and exits 1.
  - As a result, the unattended daily blog watchdog fails closed on every run and never publishes.
- The other six records (contentgrade-retirement, frontend-simplification, host-simplification, server-fixes, tool-gateways, tooling-docs) are clean. Leave them alone.

# Fix steps

1. Work in your own job worktree. Confirm with `git rev-parse --git-common-dir`. Never stage, stash, reset or discard files you did not create. The main checkout has unrelated untracked files under session-manager-operations/, `.playwright-mcp/`, `check-blank.png` and an empty stray file literally named `<path>`. Never run `git add -A`.
2. **Red first.** Add a test to `tests/blog-cadence-gate.test.ts`, matching the file's existing style:
   - Spawn `pnpm tsx scripts/blog-cadence-gate.ts next-slot` (via `execFile`/`spawnSync`, cwd = repo root, a 120 s timeout, and `TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN` removed from env).
   - Assert exit code 0.
   - Assert that **stdout trimmed is exactly one line** matching `/^\d{4}-\d{2}-\d{2}T[^\s]*Z$/`.
   - Run it once and confirm it fails on the current code. Print `RED (expected)`; don't let the raw failure text dominate the transcript.
3. **Fix in `scripts/blog-cadence-gate.ts`**, not in `server/db.ts`. The server's boot log is still useful on Render. The stdout contract belongs to the CLI.
   - In `loadSeededPosts()`, redirect `console.log` to `console.error` for the duration of `await initDb()`. Restore it in a `finally`.
   - This leaves the CLI's stdout as the single ISO line, and the DB log still reaches stderr.
   - Keep the change small and in the same style as the surrounding code (there is already a try/finally that restores env vars; extend it).
4. Defense in depth, also required: in `scripts/blog-cadence-watchdog.sh`, change the next-slot capture so stderr is not merged into the value being validated.
   - Capture stdout only. Send stderr to a temp file created with `mktemp`, and remove the file via the existing cleanup or a trap if one exists.
   - Include the stderr text in the FATAL message so diagnostics aren't lost.
   - Keep the fail-closed ISO regex check exactly as strict as it is now.
   - Make sure `tests/blog-cadence-watchdog.test.ts` and `tests/blog-watchdog-heartbeat.test.ts` still pass. If they stub the gate command's output, update the stubs to match.
   - **Do not run the full watchdog script.** Past the gate it can launch `claude -p` publish runs.
5. Green: the new test passes. `timeout 300 pnpm vitest run tests/blog-cadence-gate.test.ts tests/blog-cadence-watchdog.test.ts tests/blog-watchdog-heartbeat.test.ts` exits 0.
6. Reproduce the watchdog's exact check by hand, bounded:
   ```
   OUT="$(timeout 180 pnpm tsx scripts/blog-cadence-gate.ts next-slot 2>/dev/null)"; RC=$?
   if [[ $RC -eq 0 && "$OUT" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T && $(printf '%s\n' "$OUT" | wc -l) -eq 1 ]]; then echo "NEXT_SLOT_OK $OUT"; else echo "HALT: next-slot output not a single ISO line: $OUT"; exit 1; fi
   ```
7. Full checks, each under a timeout: `timeout 400 pnpm typecheck`, `timeout 400 pnpm test` and `timeout 400 pnpm build` must each exit 0.
   - `pnpm test` has hit a known flaky `SQLITE_BUSY` from contention with concurrent jobs. If it fails only on `SQLITE_BUSY`, re-run the exact same command once.
   - If it fails for any other reason, stop: print `SCHEDULER_VERDICT: FAIL <reason>` and exit 1.
8. Update `session-manager-operations/reviews/validation/review-the-project-for-code-quality-perofmance-i-c56527b0/validate-blog-files-db.md`. It is a tracked file. Base the change on evidence you gathered in this run:
   - Replace the 1144 heading with `## 1144-blog-pipeline-seed-path — VERIFIED (re-validated after fix 1166-fix)`.
   - Add a bullet citing the step-6 `NEXT_SLOT_OK` output and the new test name.
   - Under `### Important`, replace the watchdog finding with `- none`.
   - Under `### Minor`, add one line: "Resolved: next-slot stdout polluted by `[DB] Initialized`; fixed in scripts/blog-cadence-gate.ts (+ watchdog stderr split)."
   - The word `REFUTED` must not appear anywhere in the file afterwards.
   - Do not edit any other validation record.
9. Commit only the paths you changed, by explicit path: `scripts/blog-cadence-gate.ts`, `scripts/blog-cadence-watchdog.sh`, `tests/blog-cadence-gate.test.ts`, any updated watchdog test, and the validation record. Use the message `fix(blog): next-slot prints a single ISO line; re-validate 1144` with the standard Co-Authored-By trailer. Do not push.

# Out of scope

- Pushing to any remote. Running job 1166's publish/live checks. Editing `server/db.ts`.
- Fixing the flaky `SQLITE_BUSY`, deleting the stray `<path>` file, or touching other validation records.

# Acceptance criteria

- [ ] The new test in `tests/blog-cadence-gate.test.ts` asserts that next-slot stdout is exactly one ISO line. It fails before the fix and passes after.
- [ ] `pnpm tsx scripts/blog-cadence-gate.ts next-slot 2>/dev/null` prints exactly one line matching `^\d{4}-\d{2}-\d{2}T` and exits 0.
- [ ] The watchdog captures next-slot stdout without merging stderr, keeps the strict ISO check, and includes the stderr text in its FATAL message. The watchdog tests pass.
- [ ] `pnpm typecheck`, `pnpm test` and `pnpm build` each exit 0.
- [ ] `validate-blog-files-db.md` has no `REFUTED` text, and its `### Important` section reads `- none`.
- [ ] One commit with only the listed paths. Nothing pushed.

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/blog-cadence-gate.test.ts tests/blog-cadence-watchdog.test.ts tests/blog-watchdog-heartbeat.test.ts
timeout 200 bash -c 'OUT="$(pnpm tsx scripts/blog-cadence-gate.ts next-slot 2>/dev/null)" && [[ "$OUT" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T[^[:space:]]*$ ]] && echo "NEXT_SLOT_OK $OUT"'
bash -c 'f=session-manager-operations/reviews/validation/review-the-project-for-code-quality-perofmance-i-c56527b0/validate-blog-files-db.md; if grep -q REFUTED "$f"; then echo "HALT: REFUTED still in record"; exit 1; fi; echo RECORD_CLEAN'
timeout 400 pnpm typecheck
```

## Engineering standards

## Execution discipline (headless runs)

Data from 400+ scheduler runs: long hangs, not bad code, cause most failures, and "exited clean but left a red test" is the top verifier downgrade. The PRD body carries a one-line pointer to this file, never a copy. The dev-lead persona and the scheduler's finish protocol carry the per-run rules; this file gives the reasons behind them. Run order: orient → red → build → finish protocol (review → verify the `# Gate` commands → commit exact paths → verdict line).

- **Bound every command.** Wrap every test, build, dev-server, deploy, or poll command in a hard timeout, e.g. `timeout 300 <typecheck|unit>` or `curl --max-time 15`. Why: a bare `playwright test`, `vite`, `pnpm dev`, full e2e suite, or endpoint-polling publish hangs until the 4-hour watchdog kills it with SIGTERM.
- **Verify before done.** Run the acceptance test once before declaring success. Why: ending the run on a failing test trips the verifier's `transcript_errors` downgrade — fix it or `exit 1` with the failure instead.
- **Fail loud, fail fast.** On any step failure, print one diagnostic line and `exit 1`. Do not swallow it with `|| true` or retry silently. Exception: a `rateLimited` exit-1 is the scheduler's own benign auto-pause — it resumes next window on its own, so do not engineer around it.
- **Stay in the AC.** Do not add work past the acceptance checklist — "while we're here" extras are how runs overrun. Keep the body clean UTF-8, with no NUL or control bytes.
- **You ARE the executor — never re-queue or self-schedule.** Do the acceptance criteria yourself. Why: `/develop` or any queue-authoring skill just writes a *new* PRD and returns — the run exits 0 having done nothing, with no commit and no verdict line (`needs_review` with `no_verdict_sentinel`). The same applies to calling `ScheduleWakeup`, or backgrounding a review agent (`/code-review`, `/security-review`, `requesting-code-review`) and ending your turn with something like "I'll wait for the review agents to complete": a headless run has no next turn, so nothing ever resumes it — no verdict line prints, and the job parks in `needs_review` even though the work already landed. Run a required second review pass synchronously, inline, before the finish protocol — call the reviewer and read its result in the same turn. If the work is too big for one run, do not queue more work; see the timeout rule below. (Incidents: PRD 460 invoked `/develop` and exited 0 with no work. PRD 479 landed its commit, then backgrounded `/code-review --fix` + `/security-review` and called `ScheduleWakeup` to "wait" — same failure, different entry point.)
- **Never `git stash`, `git reset`, `git checkout -- <path>`, or `git clean` against working-tree state you did not create.** There is no polite version of this. You are normally isolated in your own `git worktree` on branch `sm-job/<slug>` (`src/main/lib/gitWorktree.cjs`), and the scheduler salvages any uncommitted diff of yours on teardown — so you never need to touch shared state to protect your own work. Confirm isolation with `git rev-parse --git-common-dir` (a worktree's common-dir differs from its own `.git`) or by checking your cwd; `git diff`/`git status` are always safe. If you land in a SHARED tree with pre-existing dirty tracked files anyway, work around them — scope `git add`/commits to only the paths you touched — or end with `SCHEDULER_VERDICT: FAIL <reason>` (`SCHEDULER_VERDICT: BLOCKED_BY_FOREIGN_WIP` only when your gate failed on those files, as the finish protocol says); never discard, stash, or revert someone else's uncommitted changes to get a clean checkout. A shared tree may be feeding a running service that reads its config straight from the working tree, so reverting it is a production change, not a local inconvenience. The scheduler runs a shared-tree stash guard as a backstop (`scheduler.cjs`'s `checkSharedTreeGuard`/`evaluateSharedTreeGuard`), but that guard exists to catch a mistake, not to license one. (Incidents: PRD 477 stashed a sibling job's WIP to get its own checkout and never restored it. 2026-09-01: a headless executor in the trader repo ran a blanket `git stash` against an operator's uncommitted live trading-config edit and exited without restoring it — the third incident of this class.)
- **`gh pr edit --body` can fail on repos with legacy GitHub Projects (classic) boards.** It queries the deprecated `repository.pullRequest.projectCards` field and errors with a `GraphQL: Projects (classic) is being deprecated` message even though the edit itself would otherwise succeed — a known `gh` CLI quirk, not a defect in your work. Prefer `gh api -X PATCH repos/<owner>/<repo>/pulls/<n> -f body="$(cat body.md)"` instead; it skips that field. If `gh pr edit` fails this way anyway, retry immediately with the `gh api` form and print one line noting the fallback — don't leave the bare GraphQL error as the step's last output, or the verifier reads it as unrecovered.
- **`gh pr checks`/`gh run watch` exit non-zero while CI is merely *pending*, not failed — don't let that read as a bare error.** `gh pr checks <n>` returns a non-zero exit (e.g. 8) with output like `check  pending  0  <url>` before checks finish — normal, documented `gh` CLI behavior, not a failure. Poll with the exact same command and description every time; the verifier's self-recovery detector pairs a failure with a later success only when the wording matches, so switching wording mid-poll (e.g. dropping a `sleep N &&` prefix) can leave the earlier pending-state error looking unrecovered. (Incident: `745-pr188-ci-lint-docs-integrity` — a fully green, committed, pushed run was flagged `needs_review` over exactly this.)
- **Negative-assertion checks must exit 0 when clean.** A check for the *absence* of something (a `grep` that should find nothing, a `diff` expecting no change) must exit 0 on the clean case. Why: a bare `grep` exits 1 on no-match, so the success path surfaces as `is_error=true` and the verifier downgrades a perfect run. Invert it: `if <detector>; then echo "HALT: <what was found>"; exit 1; fi; echo clean` — never let the clean path carry a non-zero exit.
- **Recover or annotate every error — don't strand a Traceback in the transcript.** The verifier's `transcript_errors` heuristic downgrades an otherwise-perfect run when a `Traceback`/`Error` has no visible recovery within ~10 lines — the single most common false-positive on green work. The top cause is a throwaway probe that errors (a quoting/f-string slip in an inline `python -c`, a wrong kwarg, a bad path): when a probe errors, immediately re-run the corrected version, or print `# expected/handled: <why>` right after it so the recovery sits next to the error. Prefer a small temp `.py` file over a fragile multi-quote one-liner. (The timeout rule below is the other cause.)
- **An *expected* bounded timeout (exit 124) must be annotated, not left bare.** Capping a genuinely long task (a full-universe ingest, a long scan) at its expected limit is correct, but a bare `Exit code 124` reads as a failure to the verifier. Wrap it so the cap reads as success-with-note: `timeout 120 <cmd> || { rc=$?; [ $rc -eq 124 ] && echo "hit time cap — OK" || { echo "HALT: rc=$rc"; exit 1; }; }` — distinguish the expected 124 from a real non-zero. If the work needs longer than a safe cap, the PRD is too big: end with `SCHEDULER_VERDICT: FAIL <reason>` so the planner splits it. Never run it in the background.
- **Never `sleep N && <cmd>` to poll remote CI/job status.** The harness hard-blocks a `sleep` chained to another command, and that block itself lands in the transcript as a bare error — usually in the last 20% of the run, right where the verifier weighs errors most. Use the tool's own blocking watcher under a hard cap instead: `timeout 600 gh run watch <run-id> --repo <owner>/<repo> --exit-status`. `gh pr checks` is itself negative-assertion-shaped (exits 8 pending, 1 failed/none-reported — see above), so wrap it the same way. (Incident: PRD 745 landed a truthful PASS and a fully green CI run, but an unannotated `sleep 20 && gh pr checks` and a harness-blocked `sleep 90 && gh pr checks` sat at the end of the transcript and the run was flagged anyway.)
- **Don't leak expected-error text into tool output.** The verifier pattern-matches the transcript for `Traceback`/`FAIL`/`Error:`. When a step is *expected* to error (a TDD red-phase test, an existence probe), capture it and print a clean token instead of letting the raw exception land verbatim — e.g. `if <probe> 2>/dev/null; then echo PROBE_OK; else echo PROBE_ABSENT; fi`, or filter a noisy run down to `RED (expected)` / `GREEN`. When retrying a transient failure, re-run the exact same command with the same description — the self-recovery detector only pairs a failure with a later success when the wording matches.
- **End green: run the AC gate LAST, and let nothing error after it.** The verifier weighs the final ~20% of the run most heavily — a tool error there trips a downgrade even when everything actually passed. Order the run so any intentionally-failing step (a TDD red test, an expected-nonzero probe) runs early, never after the gate. If you must demonstrate a failure late anyway, capture it (`… 2>&1 | tail` inside a conditional, or assert on the captured text) instead of letting it hit the transcript bare.
- **The verdict line is your authoritative "I passed" signal — emit it truthfully.** The scheduler's finish protocol ends by printing `SCHEDULER_VERDICT: PASS` once the AC gate is green and the commit has landed (or `SCHEDULER_VERDICT: FAIL <reason>` + `exit 1` otherwise). `PASS` plus a landed commit is authoritative: it overrides incidental transcript markers, so a deliberately reproduced red test or a grep result containing "Error" will not false-trip `needs_review`, as long as the run genuinely ends green and committed. Exiting 0 with uncommitted changes, or with no verdict line at all, is the #1 cause of needless `needs_review`. Never print `PASS` when the gate is red — that turns a safety net into a silent-failure machine.
- **If your own AC gate failed on a SIBLING job's in-flight file, say so with the right verdict — don't print a lying FAIL.** If the prompt disclosed a `--- FOREIGN WORKING-TREE STATE ---` section and your gate failure is confined to paths that section named as not your work, print `SCHEDULER_VERDICT: BLOCKED_BY_FOREIGN_WIP` (and `exit 1`) plus a `FOREIGN_WIP_PATHS: <path1>, <path2>, ...` line naming exactly the failing paths. The scheduler validates every listed path against the manifest it disclosed to you — list a path it never named, or claim this verdict for your own regression, and it is rejected back to `FAIL`. This is not an escape hatch: it exists so a correctly-diagnosed "not my regression" gets auto-requeued once the sibling clears its WIP, instead of spawning a fix-plan investigation into someone else's unfinished work.
