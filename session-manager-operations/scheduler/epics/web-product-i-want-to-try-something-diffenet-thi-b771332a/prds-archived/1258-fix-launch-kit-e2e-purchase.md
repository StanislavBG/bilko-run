---
title: Fix: Launch Kit live E2E — get past hosted-Checkout promo rejection and record a real PASS
cwd: /home/bilko/Projects/Bilko
parallelGroup: 1258
estimateMinutes: 45
isFixPlan: true
---

# Goal

Re-run the live Launch Kit purchase at $0 with the 100%-off QA promotion code, and record `E2E: PASS` in the deploy review. The run must cover checkout, the thanks page, the download, a sha256 match and the downloadsUsed counter. Job 1258 stopped at Stripe's hosted Checkout, which showed "This code is invalid." The Stripe objects and the host code are correct. The automation is what needs to change.

# Root cause (established 2026-10-10 PDT, read-only + expired diagnostic sessions)

- **Symptom.** Job 1258 ran `/home/bilko/Projects/Bilko-Launch-Kit/site/scripts/live-purchase.mjs` (headless Chromium). It reached checkout.stripe.com and entered the email and the code. Then Checkout printed "This code is invalid." and the total stayed at $9.00. Both attempts failed the same way, and nothing was charged or redeemed.
- **Every Stripe object is valid** (live account `acct_1SbkmmR6w0VtQRLT`):
  - Promotion code `promo_1UPEV2R6w0VtQRLTqcsFAi1Z`: `active: true`, `times_redeemed: 0`, `max_redemptions: 5`, restrictions all null or false.
  - Coupon `zqomwcOl`: `percent_off: 100`, `valid: true`, `applies_to.products = [prod_VQ4ePQ5HTW5znY]`.
  - Price `price_1UPEUuR6w0VtQRLTqFklclrS` (the `defaultPriceId` in `shared/web-products.ts`) belongs to `prod_VQ4ePQ5HTW5znY`.
  - The code string in `/home/bilko/.config/bilko/launch-kit-qa-promo.txt` matches exactly what the script typed.
- **The host is correct.** `server/routes/web-products.ts:151` sets `allow_promotion_codes: true`. The live sessions list shows `allow_promotion_codes: True`, `amount_total: 900`, `metadata.web_product: launch-kit`.
- **The API accepts the promo.** `stripe checkout sessions create --live` was run with the same price and `discounts[0][promotion_code]=promo_1UPEV2R6w0VtQRLTqcsFAi1Z`. It returned `amount_total: 0` and `amount_discount: 900`, both with the CLI's default API version and with `--stripe-version 2024-12-18.acacia` (the server's pinned version). Both diagnostic sessions were expired immediately.
  - This rules out the failed run's guess that promo codes created with `promotion[type]=coupon` don't work with the older API version.
- **Conclusion.** The hosted Checkout UI rejects the promo only when submitted by this automation. There are two possible causes, and the old script logs nothing that tells them apart:
  - The script calls `promoInput.fill(promo)` and clicks Apply at once (lines 50-52). In the "promo-typed" screenshot the Apply button still looks greyed out, so Stripe's React state may not have registered the value.
  - Stripe's anti-abuse layer may return the generic "invalid" message to headless or automated promo submissions.
- **Secondary.** The failed run's `git rebase origin/main` failed because of pre-existing unstaged files in its worktree. The push still fast-forwarded cleanly, so this is cosmetic, but do it properly this time.

# Fix steps

All work is in the uncommitted scratch script `/home/bilko/Projects/Bilko-Launch-Kit/site/scripts/live-purchase.mjs`. It is not part of the golden spec, so leave it uncommitted. The only committed change is the review file. Do not change product code in either repo.

1. **Log Stripe's real answer to the promo.** Before clicking Apply, add `page.on('response', ...)` for `checkout.stripe.com` / `api.stripe.com` URLs whose path or body mentions `promotion`, `discount` or `coupon`. Write each status and JSON error `code`/`message` to `/tmp/launch-kit-e2e/promo-net.json`.
   - Replace the promo code value with `<PROMO>` before writing.
   - Print only the error code and message to stdout.
2. **Make the promo entry look human:**
   - Click the field.
   - Use `promoInput.pressSequentially(promo, { delay: 80 })` instead of `fill`.
   - Wait until the Apply button is enabled (`expect(apply).toBeEnabled()` or poll `isEnabled()` with a 5s cap).
   - Click Apply, or press Enter in the field.
   - Type the email with `pressSequentially` as well.
3. **Use a less bot-like browser:**
   - If `command -v xvfb-run` succeeds, launch with `headless: false` under `timeout 300 xvfb-run -a node scripts/live-purchase.mjs`.
   - Otherwise use `chromium.launch({ headless: true, args: ['--disable-blink-features=AutomationControlled'] })`.
   - In both cases use a context with a normal desktop Chrome `userAgent`, `locale: 'en-US'` and `timezoneId: 'America/Los_Angeles'`.
4. **Attempt budget.** Each attempt can use up a redemption only if checkout completes, so the budget is 2 attempts total. Before running, confirm `times_redeemed` < 5 with `timeout 30 stripe promotion_codes retrieve promo_1UPEV2R6w0VtQRLTqcsFAi1Z --live`. Expect 0.
5. **Fallback if the UI still says "invalid" after steps 1-3** (the API path is proven to work):
   - Still open https://bilko.run/projects/launch-kit/ and click Buy, to show that landing → Checkout works.
   - Create a session with the production parameters:
     ```
     timeout 30 stripe checkout sessions create --live -d mode=payment \
       -d "line_items[0][price]=price_1UPEUuR6w0VtQRLTqFklclrS" -d "line_items[0][quantity]=1" \
       -d customer_creation=always -d "metadata[web_product]=launch-kit" \
       -d "discounts[0][promotion_code]=promo_1UPEV2R6w0VtQRLTqcsFAi1Z" \
       -d "success_url=https://bilko.run/projects/launch-kit/thanks/?session_id={CHECKOUT_SESSION_ID}" \
       -d "cancel_url=https://bilko.run/projects/launch-kit/?checkout=cancel"
     ```
     Do not pass `allow_promotion_codes`, because it can't be combined with `discounts`.
   - Save the session id and URL to `/tmp/launch-kit-e2e/` only.
   - In the browser, open that URL, enter the QA email, confirm `$0.00`, and complete checkout.
   - The webhook, thanks page and download stay on the real production path.
   - In the report, state plainly that the promo was pre-applied server-side because the hosted UI rejected it. Include the logged network error code from step 1.
6. **Thanks page and download.** Same as the original PRD:
   - The browser lands on `https://bilko.run/projects/launch-kit/thanks/?session_id=cs_live_...`.
   - `#download` is visible within 60s.
   - Use `page.waitForEvent('download')` and hash the file with `node:crypto` sha256.
   - The hash must equal the release `sha256` for launch-kit in `shared/web-products.ts`.
   - `curl --max-time 15 "https://bilko.run/api/web-products/launch-kit/order?session_id=<sid>"` must report `downloadsUsed >= 1`.
   - Keep the sid in /tmp only.
7. **Stop conditions.** If a visible captcha appears, if card details are demanded at $0, or if the fallback also fails:
   - Write `E2E: BLOCKED` with the exact blocker and the step-1 network error code.
   - End with `SCHEDULER_VERDICT: FAIL ...`.
8. **Rewrite the report** at `session-manager-operations/reviews/deploy/web-product-i-want-to-try-something-diffenet-thi-b771332a/launch-kit-e2e-purchase.md`:
   - `E2E: PASS` or `E2E: BLOCKED`.
   - Which path was used (UI promo or API-pre-applied fallback).
   - Times in America/Los_Angeles with PDT.
   - Session id shortened to its last 6 characters.
   - sha256 compared, and the downloadsUsed value.
   - Never include the promo code value or the full session id. Screenshots stay in /tmp.
9. **Commit and push only that file:**
   - `git add <that path>` and commit.
   - Run `timeout 60 git fetch origin`.
   - If `git merge-base --is-ancestor origin/main HEAD` succeeds, push with `timeout 60 git push origin HEAD:main`.
   - Otherwise run `git rebase origin/main`. If unstaged files you did not create block the rebase, do not stash or discard them. Instead, cherry-pick your commit onto `origin/main` in a temporary `git worktree add /tmp/lk-push origin/main` and push from there.
   - Push to `origin` only. Never push to `content-grade`.

# Verification

```
F=session-manager-operations/reviews/deploy/web-product-i-want-to-try-something-diffenet-thi-b771332a/launch-kit-e2e-purchase.md
if grep -E 'LAUNCHKITQA[A-Z0-9]{6}|cs_live_[A-Za-z0-9]{20,}' "$F"; then echo "HALT: secret leaked"; exit 1; fi; echo clean
timeout 30 git log origin/main -1 --format=%s -- "$F"
```

# Acceptance criteria

- [ ] `/tmp/launch-kit-e2e/promo-net.json` records Stripe's promo-validation response (code redacted). The report quotes its error code or states that it succeeded.
- [ ] One of these paths completes at $0.00: the UI promo path after steps 2-3, or the documented API-pre-applied fallback. Either way the browser lands on the production thanks URL and shows the Download link within 60s.
- [ ] The downloaded file's sha256 equals the launch-kit release sha256 in `shared/web-products.ts`, and the order endpoint reports `downloadsUsed >= 1`.
- [ ] The review file says `E2E: PASS` (or `E2E: BLOCKED` with the exact blocker and a FAIL verdict) and names the path used. It has PDT times and only the last 6 characters of the session id. It contains no promo code value and no full session id. It is committed and pushed to origin/main.
- [ ] No product code changed in either repo, and at most 2 promo redemptions were used.

# Files

- session-manager-operations/reviews/deploy/web-product-i-want-to-try-something-diffenet-thi-b771332a/launch-kit-e2e-purchase.md (committed)
- /home/bilko/Projects/Bilko-Launch-Kit/site/scripts/live-purchase.mjs (scratch, uncommitted; edited to fix the automation)

# Gate

```gate
timeout 30 grep -q 'E2E: PASS' session-manager-operations/reviews/deploy/web-product-i-want-to-try-something-diffenet-thi-b771332a/launch-kit-e2e-purchase.md
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
