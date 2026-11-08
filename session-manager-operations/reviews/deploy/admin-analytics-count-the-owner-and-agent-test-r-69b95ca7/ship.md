> Recovered from the job log: Ship PRD 1676 wrote this record, then its budget ran out during review before it committed it. Ship PRD 1709 committed it unchanged.

# Ship: real-visitor analytics (PRDs 1669-1674, Ship PRD 1676)

SHIP: PASS

Pushed SHA: c371c81cf3e82f274f1887ef69f23c5f4e6b60ab (origin/main, b6463c0f..c371c81c, fast-forward, no force, origin only: https://github.com/StanislavBG/bilko-run.git)
Push time: 12:05:10 AM PST, 2026-11-08.
Deploy: Render restarted the service at 12:07:37 AM PST, 2 min 27 s after the push. Both live checks passed at 12:08:33 AM PST. A second restart at 12:10:14 AM PST followed sibling Ship PRD 1679's push on top of this one. The checks passed again at 12:10:52 AM PST.

## Commits

The six feature commits were found by their exact subjects in `git cherry -v origin/main main`. They were cherry-picked in this order onto origin/main b6463c0f in the throwaway tree /tmp/ship-real-visitor-analytics.

| Local main SHA | Pushed SHA | PRD (validation name) | Subject |
| --- | --- | --- | --- |
| c2041e0e4b430e4b66b698dc990d9d5d9156f14d | 80a49fe22fedf0d330e7fd96719ae2e994040c27 | automation-signals-at-ingest | feat(analytics): flag automation traffic at ingest (webdriver beacon flag, telemetry UA class) |
| 7aee49aa68d2829cb4040c9912e44fea3fd38d4c | 5026f4a6b8b89aa92f53cbc8613bde49d5919312 | internal-device-mark | feat(admin): mark this device as the owner's |
| 6f6c0d60ade48bce83f0065735ee415c543221a4 | ed975e40e3f97be06d0e31fbf6351fb4e17e2aca | real-visitor-reads | feat(admin): real-visitor reads across sessions, flows, funnel and visitor timeline |
| 0b62aa013473e50592e495e59ee77a7f093a19ce | 60b3dc4e74fbbf9ecbc895d8f4e90b913aacd54d | git-viewer-profile-attribution | feat(git-viewer): record created_at and builder class on new portfolios |
| 321cc3872a39418360775577623de4f5b98dad37 | 1d60df7b8f971e2fa56e0869d2ba3a33c6b47798 | mcp-real-visitor-defaults | feat(mcp): report tools default to real visitors |
| e344a8befdf54a83ba80563b6c61c117e717b231 | c371c81cf3e82f274f1887ef69f23c5f4e6b60ab | git-viewer-profiles-report | feat(admin): git-viewer portfolios and subscriptions report |

All six applied cleanly. Local main's other four `+` commits were not part of this push:
- bf0a651d docs(deploy): ship record for post-push-catch-up. A record commit; it stays local.
- 9891d35a feat(host-kit): stamp telemetry records with env (prod, dev, test). It belongs to the sibling plan host-kit-telemetry-env (PRD 1677). Its own Ship PRD 1679 pushed it as 53bcd69c (committed 12:06:17 AM PST).
- 28d54759 docs(validation): host-kit telemetry env review. Ship PRD 1679 pushed it as 69aefa7c.
- d6fc91e5 docs(validation): real-visitor analytics plan review. A record commit; it stays local.

## Sibling plan rule

The PRD says to cherry-pick the sibling plan's endpoint commits too, but only if they are not on origin/main yet and their own Ship PRD has not run. The flows check depends on the `mine` and `bots` filters and the `filters` echo. Those come from the obs-traffic-filters plan (Ship PRD 1662): 141722fb (flows), 8922f754 (sessions) and d4412b24 (traffic). All three were already on origin/main, so nothing extra was cherry-picked.

The other sibling, host-kit-telemetry-env (9891d35a), has no endpoint commit. It changes only packages/host-kit, a changeset, docs/host-contract.md and tests/host-track-flow.test.ts, and none of the six touch those files. Its Ship PRD 1679 ran in the same scheduler batch. So it was left out, as the acceptance criterion "pushes only them" requires.

## Checks

- origin/main was b6463c0f at the start, and still b6463c0f when re-fetched just before the push: PASS
- Cherry-picks: 6 clean, 0 conflicts. `git cherry -v HEAD d6fc91e5` marked all six `-` (patch-identical). `git diff --stat HEAD d6fc91e5` listed only the 10 files of the 4 local commits not in this ship: PASS
- pnpm test on c371c81c: PASS, with one flaky first run (see Findings).
  - First run, 12:00:01 to 12:02:01 AM PST: exit 1. Both failures were in tests/blog-cadence-watchdog.test.ts: "non-autonomous: leaves a reviewable draft..." and "autonomous pending drafts honour max_posts_per_run...". That test file and scripts/ are byte-identical between origin/main b6463c0f and c371c81c, and none of the six touch them.
  - That file alone at 12:02:22 AM PST: 28 of 28 passed.
  - Full rerun, 12:02:38 to 12:03:53 AM PST: exit 0. 180 files passed, 2 skipped. 2080 tests passed, 15 skipped.
- pnpm typecheck (client, server, scripts) on c371c81c, 12:04:11 to 12:04:22 AM PST: exit 0: PASS
- pnpm build on c371c81c, 12:04:22 to 12:04:50 AM PST: exit 0: PASS
- After the three runs, `git status --short` was empty and HEAD was still c371c81c, the SHA that was pushed: PASS
- Push: remote `origin` is https://github.com/StanislavBG/bilko-run.git. `git push origin HEAD:main` pushed b6463c0f..c371c81c with no force: exactly 6 commits (`git rev-list --count origin/main..HEAD` = 6, 0 merges). `git ls-remote origin refs/heads/main` returned c371c81c right after: PASS
- Author and committer of all 6 pushed commits are Bilko <bilko@bilko.run>, the same as on the originals. The messages have no "cherry picked from" line and no personal identity: PASS
- Baseline before the push, at 11:59:33 PM PST on 2026-11-07:
  - /api/health uptime was 2805 s, so the process had been up since 11:12:48 PM PST.
  - GET /api/admin/git-viewer/profiles returned 404 `{"error":"Not found"}`.
  - GET /api/admin/flows?app=git-viewer&mine=exclude&bots=exclude returned 200.
- Deploy, at 12:08:13 AM PST: /api/health uptime was 35 s, so the process started at 12:07:37 AM PST, after the 12:05:10 AM push. In the same poll, /api/admin/git-viewer/profiles went from 404 to 200: PASS
- GET /api/admin/git-viewer/profiles with the admin key, 12:08:33 AM PST: 200, application/json: PASS
  - totals: all 12. byTier: free 12, paid 0. Claimed 0, unclaimed 12.
  - byBuiltBy: owner 0, automation 0, visitor 0, showcase 0, unknown 12.
  - subscriptions: active 0, total 0.
  - rows: 13, with keys login, tier, claimed, showcase, builtBy, createdAt, updatedAt.
- GET /api/admin/flows?app=git-viewer&mine=exclude&bots=exclude with the admin key, 12:08:33 AM PST: 200, application/json: PASS
  - Keys: apps, flows, filters.
  - The body echoes `"filters":{"mine":"exclude","bots":"exclude"}`.
  - git-viewer: 1 session, 2 views, 8 events, 3 flows.
  - Control without mine and bots: 200, with `"filters":{"mine":"include","bots":"include"}` and 3 sessions.
- /api/health gitViewer.ok was false at 56 s uptime, because the GitHub budget probe had not run yet. It was true at 12:08:51 AM PST (budget http 200, remaining 4998): PASS
- Second restart: sibling Ship PRD 1679 pushed 53bcd69c and 69aefa7c on top of c371c81c, so c371c81c is an ancestor of origin/main 69aefa7c. The service restarted at 12:10:14 AM PST. Re-check at 12:10:52 AM PST: profiles 200 with the same totals, and flows 200 with `"filters":{"mine":"exclude","bots":"exclude"}`: PASS
- The admin key (~/.config/bilko-host/admin-key; BILKO_ADMIN_KEY was unset) was used only for read-only GETs. Response bodies went to a temp dir that was then deleted, and no login appears in this record: PASS
- Throwaway tree: the 3 node_modules symlinks were unlinked, and the main-tree node_modules were left intact. `git worktree remove` ran without --force, and /tmp/ship-real-visitor-analytics was gone at 12:05:32 AM PST: PASS

## Local main

After the push, `git cherry -v origin/main main` marks the six and the sibling's 9891d35a and 28d54759 `-`. Only the record commits bf0a651d and d6fc91e5 stay `+`. In ~/Projects/Bilko, `git status -sb` shows `## main...origin/main [ahead 10, behind 8]`. The 8 behind are the 8 twins.

This PRD did not run `bash scripts/sync-local-main.sh`, for three reasons:
- It is not in the acceptance criteria.
- This job's own branch was cut from local main's current tip, d6fc91e5, and has not been merged yet.
- The default mode pushes record commits, and this PRD ships none.

Run the sync after this job is merged (docs/repo-writers.md, rule 3). It drops the 8 twins and publishes bf0a651d, d6fc91e5 and this record.

## Findings

- Critical: none.
- Important: none new. One finding from validate-real-visitor-analytics.md is still open and shipped as it was: server/routes/admin-funnel.ts:47 drops bots only by `page_views.is_bot` and does not read `funnel_events.is_bot`.
- Minor: tests/blog-cadence-watchdog.test.ts is not isolated from other runs on the same machine. The likely cause of the first-run failures is not proven.
  - scripts/blog-cadence-watchdog.sh (lines 170-175) takes a fixed machine-wide lock, `flock -n` on /tmp/bilko.blog-cadence-watchdog.lock. If the lock is held, it exits 0 with "skipped, another instance running".
  - The test does not override that path. So two `pnpm test` runs at once can make the drafting tests see no draft and no seed. That matches both failures: status 0, no draft, no seed, about 50 ms each. Scheduler jobs run in parallel, and Ship PRD 1679 was running its own gate in the same minutes.
  - The first run started at 12:00:01 AM PST, but the passing rerun at 12:02 AM was on the same date, so the date change is a less likely cause.
  - The fix belongs in this repo: let the lock path be overridden, and set it per test.
