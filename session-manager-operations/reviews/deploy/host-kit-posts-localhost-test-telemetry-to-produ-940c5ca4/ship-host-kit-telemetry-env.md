# Ship: host-kit-telemetry-env

SHIP: PASS

Pushed SHA: 69aefa7cce2d0b4e218539752f35daffc76ccc30 (origin/main, c371c81c..69aefa7c, fast-forward, no force, origin only: https://github.com/StanislavBG/bilko-run.git)
Push time: 12:08:11 AM PST, 2026-11-08.
No live bilko.run check. Per the PRD, this is library and docs only. The 8 files are host-kit source, tests and README, a changeset, docs/host-contract.md, one root vitest file and a validation record. The root app has no host-kit dependency (none in package.json, no import in src/ or server/). server/ and src/ mention docs/host-contract.md only in comments, and nothing in server/, src/ or shared/ reads docs/ at runtime. So nothing Render serves changes. The push still sets off a Render auto-deploy. None of the 8 files is under server/, src/, shared/ or public/, so the app it builds is the same as at c371c81c, pushed about 2 minutes earlier. host-kit's own tsup build, which its `prepare` script runs, passes on the shipped source (see Checks). Per the PRD, no /api/health check was run.

## Commits

Found on local main by exact subject (`git log main --format='%H %s'`, one match each). Cherry-picked in this order onto origin/main b6463c0f in the throwaway tree /tmp/ship-host-kit-env. They were then rebased onto c371c81c when origin moved (see below).

| Local main SHA | Pushed SHA | patch-id (stable) | Subject |
| --- | --- | --- | --- |
| 9891d35a2eaa75aa1a62a65cf0eca1da34aace9c | 53bcd69c70c3509b812ab025852bf51270c8cdb5 | ca427f4cf92b724e2da89192cb2b1bab0c71f58b | feat(host-kit): stamp telemetry records with env (prod, dev, test) |
| 28d54759e9727a946a5792ad462b24d9a6868a66 | 69aefa7cce2d0b4e218539752f35daffc76ccc30 | c747da455f3e3dd2c8b2b04f425ff3c9d3eb5905 | docs(validation): host-kit telemetry env review |

Both applied cleanly. The feature commit's local-main parent, c2041e0e (feat(analytics)), touches none of its 7 files. `git diff b6463c0f 9891d35a^` over those files was empty. The patch-ids above are the same for the original, the first cherry-pick (d92c12a4, 858fea0a) and the pushed commit.

## Origin moved before the push

The re-fetch at 12:05:50 AM PST, just before the push, found origin/main at c371c81c instead of b6463c0f. 6 commits had been pushed: 80a49fe2, 5026f4a6, ed975e40, 60b3dc4e, 1d60df7b and c371c81c, the real-visitor analytics and git-viewer work. By all signs the sibling ship job 1676 pushed them: its throwaway tree /tmp/ship-real-visitor-analytics was running tests minutes earlier. The guard stopped this push, and nothing went out.

- Neither of this ship's subjects was on the new origin/main (count 0), and `git cherry` still marked both commits `+`, so there was no twin and the push was still needed.
- None of the 6 commits touches the 8 shipped files, and none changes pnpm-lock.yaml or any package.json.
- `git rebase origin/main` replayed both commits cleanly onto c371c81c. Every check below was re-run on the rebased HEAD before pushing.

## Checks

- validate-host-kit-telemetry-env.md says host-kit-telemetry-env VERIFIED, with Critical: none, Important: none, Minor: 2: PASS
- No patch-identical twin was on origin, either on b6463c0f or on c371c81c, so the push was needed: PASS
- On the first pick, 858fea0a (base b6463c0f):
  - `pnpm --filter host-kit run test`: 7 files, 50 tests, exit 0 (11:59:46 to 11:59:48 PM PST, 2026-11-07).
  - `pnpm typecheck`: exit 0.
  - `tests/host-track-flow.test.ts`: 4 passed, so the root test does not need c2041e0e.
  - Full `pnpm test` #1 (12:00:06 to 12:02:08 AM PST): 2 tests failed in tests/blog-cadence-watchdog.test.ts. One got the heartbeat `2026-11-08T00:01:34-08:00 ok: skipped…` where a "draft skipped" heartbeat was expected. The other exited 0 where 1 was expected. Both match the watchdog's lock-contention path (`write_heartbeat "ok: skipped, another instance running"`, scripts/blog-cadence-watchdog.sh:174, its only `ok: skipped` heartbeat). It locks the fixed path /tmp/bilko.blog-cadence-watchdog.lock, which the tests do not override. Which run held the lock at 12:01:34 AM was not identified. Two holders are possible. One is a concurrent suite on the machine. The other is tests/blog-watchdog-heartbeat.test.ts in a parallel worker of the same run, since it runs the same script against the same lock. So a single `pnpm test` can flake this way on its own. A foreign vitest run in /tmp/ship-real-visitor-analytics was seen at 12:02:52 AM PST and had ended by 12:03:54 AM PST. The lock was free at 12:02:39 AM PST, and the file passed alone, 28 of 28, at 12:02:52 AM PST.
  - Full `pnpm test` #2 (12:04:10 to 12:05:40 AM PST, no other vitest running): 176 files passed, 2 skipped. 2013 tests passed, 15 skipped. Exit 0.
- On the pushed HEAD 69aefa7c (base c371c81c):
  - `pnpm --filter host-kit run test`: 7 files, 50 tests, exit 0 (12:06:17 to 12:06:19 AM PST).
  - `pnpm typecheck` (client, server, scripts): exit 0 (12:06:19 to 12:06:31 AM PST).
  - Full `pnpm test` #3 (12:06:31 to 12:08:01 AM PST): 180 files passed, 2 skipped. 2081 tests passed, 15 skipped. Exit 0. host-track-flow (4), telemetry (32), analytics-automation (7), mcp-dist-sync (2) and blog-cadence-watchdog (28) all passed.
  - Overall: PASS
- After the runs, `git status --short` was empty and HEAD was still 69aefa7c, the SHA that was pushed: PASS
- origin/main was still c371c81c when re-fetched at 12:08:10 AM PST, just before the push: PASS
- `git push origin HEAD:main` pushed exactly 2 commits (`git rev-list --count origin/main..HEAD` = 2, 0 merges), with no force, to https://github.com/StanislavBG/bilko-run.git: PASS
- Both pushed commits have the same author and committer as the originals, Bilko <bilko@bilko.run>: PASS
- After the push, `git ls-remote origin refs/heads/main` returns 69aefa7c, and each exact subject appears once on origin/main. `git cherry -v origin/main main` marks 9891d35a and 28d54759 with `-`: PASS
- No other local-main commit was in this push, since c371c81c..69aefa7c is exactly these 2:
  - bf0a651d (docs(deploy): ship record for post-push-catch-up) and d6fc91e5 (docs(validation): real-visitor analytics plan review) are still `+`, meaning they are not on origin.
  - The other 6 commits marked `-` went out in the b6463c0f..c371c81c push (by all signs job 1676's), not in this one.
  - Overall: PASS
- Throwaway tree: the 3 node_modules symlinks were removed and the main-tree node_modules are intact. `git worktree remove` ran, and /tmp/ship-host-kit-env was gone at 12:08:26 AM PST: PASS
- After the push, in the job worktree (based on local main d6fc91e5; `git diff 69aefa7c HEAD -- packages/host-kit` is empty, so it holds the shipped host-kit source):
  - PRD gate `timeout 300 pnpm --filter host-kit run test`: 7 files, 50 tests, exit 0 (12:18:38 to 12:18:40 AM PST).
  - `pnpm --filter host-kit run typecheck` (`tsc --noEmit`; root `pnpm typecheck` does not cover the package): exit 0 (12:19:26 AM PST).
  - `pnpm --filter host-kit run build` (tsup: CJS, ESM, DTS): exit 0 (12:19:40 to 12:19:44 AM PST). `resolveEnv` is in dist/index.js and dist/index.d.ts. dist/ is gitignored, so no tracked file changed.
  - Overall: PASS

## Reviews

- `/code-review` (medium, scoped to this record) made no edits; it checked the SHAs, patch-ids, counts, line references, identity, version and origin state against git. Its 7 findings are all follow-ups outside this file: the watchdog lock path, the host-kit npm release, the local-main sync, the CLAUDE.md test count and a Render health check. The record was tightened on the possible holders of the run #1 lock and on what the Render deploy builds.
- `/security-review` covered the whole branch diff against b6463c0f: this ship's 2 commits and record, the 6 carried commits from b6463c0f..c371c81c, and the foreign WIP. It had no findings. A check against the identity deny-list found 0 hits in this record, in the added diff lines, and in commit authors, committers and messages.

## Left as is

- Local main was not synced; the PRD does not ask for it. `git -C ~/Projects/Bilko status -sb` shows `## main...origin/main [ahead 10, behind 8]`.
  - 8 of the 10 local-only commits are patch-identical twins of origin's 8 new commits.
  - The other 2 are the unpushed record-only commits bf0a651d and d6fc91e5.
  - In its default mode, `bash scripts/sync-local-main.sh` would publish those 2. `--no-push` would catch local main up without publishing them.
- npm: this ship does not publish host-kit. On origin, packages/host-kit/package.json is still 0.10.0, and .changeset/host-kit-telemetry-env.md declares only a minor bump. The README ("before 0.11.0") and docs/host-contract.md (`>=0.11.0`) refer to a version that has not been released yet. Sibling apps start stamping env only once a host-kit release ships.
- Flaky test: tests/blog-cadence-watchdog.test.ts fails whenever another run holds /tmp/bilko.blog-cadence-watchdog.lock. That can be a concurrent suite, the real daily timer, or tests/blog-watchdog-heartbeat.test.ts, which runs the same script. The lock path is hardcoded at scripts/blog-cadence-watchdog.sh:170, and the tests cannot point it somewhere else.
