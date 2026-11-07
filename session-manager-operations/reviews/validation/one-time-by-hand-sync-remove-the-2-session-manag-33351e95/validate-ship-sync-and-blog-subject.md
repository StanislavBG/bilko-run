# Validation: ship-sync-and-blog-subject

Base: 816b3cd9 (PRD notes). Verdict: VERIFIED. Checked 2026-11-07 ~1:46 PM PST.

## ship-sync-and-blog-subject: VERIFIED
- Ship record exists in main tree (`session-manager-operations/reviews/deploy/.../ship-sync-and-blog-subject.md`, commit 805aff55) and contains `SHIP: PASS` (grep count 1); gate passes.
- origin/main = e21ae07c; `git rev-list --count 9487f88c..origin/main` = 3, parents chain 9487f88c → a8d82ff5 (fix(blog)…(WIP)) → af266fc2 (fix(sync)…) → e21ae07c (test(blog)…), correct order, only those three. `git diff --name-only 9487f88c origin/main` = 13 files, none Field Manual/ops-untrack/records.
- Excluded commits still `+` in `git cherry origin/main`: f4f766e2, 69d740be, 60cfd169 — not pushed.
- `git cherry origin/main` marks d3514453, 85967893, 29deadc0 as `-`.
- `git ls-tree origin/main`: scripts/blog-subjects.ts and tests/blog-subjects.test.ts exist.
- Live (curl): / 200, /projects 200, /blog 200, /api/projects 200 application/json with projects listed. /api/health uptime 125s (recent redeploy after 1:41 PM PST push).
- Not re-run by me: pnpm test/typecheck/build (ship record reports pass on e21ae07c; this PRD's gate is `none`).
- Remote/force: record states origin = StanislavBG/bilko-run, fast-forward, no force; consistent with origin history above.

## Findings
- Critical: none. Important: none.
- Minor: the ship record's test/build results are self-reported and not independently re-run here.
