# Publish record: npx repairs (copy e2e + vitest SQLITE_BUSY)

- Pushed SHA (`origin/main`): d407bc91108c85193bd9266b7eda2af9536f4110 (fast-forward from 441efb7, 2 commits: docs(validation) records; the repair commits 382dcea/441efb7 and 06d1714/4a9f982 were already on origin/main or ride in this range)
- Pushed: 2026-10-10 15:44 PDT, `git push origin HEAD:main`, no force, origin only

## CI
- GitHub Actions run 38092571828, workflow "CI", SHA d407bc9: conclusion **success** (seen completed on poll 4 of 20, ~15:46 PDT)

## Live checks
- 2026-10-10 15:46 PDT: https://bilko.run/products/session-manager returns 200: PASS
- 2026-10-10 15:46 PDT: entry bundle /assets/index-CeKs_HdR.js unchanged since the previous publish
- 2026-10-10 15:46 PDT: /assets/hooks-BGcWDMEg.js contains "npx claude-code-session-manager@latest": PASS
- 2026-10-10 15:46 PDT: SessionManagerPage-D8jFRsbe.js does not hold the string itself (it comes from the hooks chunk, as in publish.md): expected
