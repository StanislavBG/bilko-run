# Ship: docs hold current facts only

Pushed SHA: c929b5da (origin/main, StanislavBG/bilko-run), previous origin head 428d30dd (plan base). Pushed 12:17 PM PST 2026-11-22.

## Commits (log order)
All 18 commits in 428d30dd..c929b5da are this plan's, so the cherry-pick onto origin/main fast-forwarded and kept their shas:
3a0bd2a9, 7e3b8957, 4f3c6920, 7e670406, 2e1464af, 43944779, 5ba1e082, 14de26f1, 198710b3, b7eb6363, 37e7839b, 8cd7ad60, 76c8123b, 60a51af0, 7682a842, f932ba5f, 95b1f75f, c929b5da (validation record).
No other plan's commits were pushed.

## Checks
- Validation record: Critical none, Important none (session-manager-operations/reviews/validation/review-docs-i-started-with-repo-writers-and-i-m--342bd25d/validate-docs-current-only.md).
- Throwaway worktree at origin/main 428d30dd, `git cherry-pick --ff` of the 18 commits: PASS, no conflicts.
- `bash scripts/docs-guard.sh` in that tree: `docs-guard: clean (14 files)`.
- `git push origin c929b5da:main`: PASS (428d30dd..c929b5da).
- `bash scripts/sync-local-main.sh` in ~/Projects/Bilko: `in sync at c929b5da`, exit 0. `git status -sb`: `## main...origin/main`.
- The shared tree (~/Projects/Bilko) now holds the new docs/map.md and docs/host-contract.md that the bilko-host MCP reads.

## Open (minor, from the validation record)
- docs/deployment.md:75 still says "Never push Bilko to the `content-grade` remote"; the remote no longer exists.
- scripts/blog-cadence-watchdog.sh:216 and scripts/sanity-qa-cron.sh:72 comments still cite the removed content-grade rule.

SHIP: PASS
