# Validation: bind-human-for-hire-to-self + ship-human-for-hire-binding

Base: 992ef37b (known). Commits in range: 05ac2e15 (plan), d8022fda (Self's own `listing: update human-for-hire`), 1ff2d3be (ship record).

## bind-human-for-hire-to-self — VERIFIED
- Registry: `git show 05ac2e15` changes only the human-for-hire host block (adds `"localPath": "~/Self"` plus the comma on the url line). `python3` read of the shared tree: `{'kind': 'external-url', 'url': 'https://bilko.run/book', 'localPath': '~/Self'}`.
- Probe re-run (output): `ACCEPT /home/bilko/Self changed=false`; `THROW /home/bilko/Projects/Bilko "human-for-hire" is owned by ~/Self; caller is /home/bilko/Projects/Bilko`; same THROW for `/home/bilko/Projects/burrow`.
- `scripts/refresh-commit-order.ts` (diff 05ac2e15): `NO_COMMIT_SIGNAL = new Set<string>(['human-for-hire'])` with the why-comment; collect loop has `&& !NO_COMMIT_SIGNAL.has(p.slug)`; header comment updated. `grep -c human-for-hire` on commit-order.json and commit-counts.json: 0 and 0; neither sidecar changed in base..HEAD.
- `docs/host-internals.md`: one-line diff inserts the `NO_COMMIT_SIGNAL` mention in the Human For Hire bullet only.
- No new test file; mcp-host-server untouched.
- Gate re-run: 5 test files, 111 tests pass; `pnpm typecheck` exit 0; `git grep -F '/Self"'` ok.
- Note: d8022fda (Self, via update_project_listing) changed human-for-hire tagline/detail/talkingPoints/callToAction/avoidClaims after the binding. It is not part of the PRD diff; it shows the binding works end to end. The PRD's "no listing field changes" holds for 05ac2e15.

## ship-human-for-hire-binding — VERIFIED
- `git merge-base --is-ancestor 05ac2e15 origin/main` → yes; 1ff2d3be (ship record) also on origin/main (origin tip = 1ff2d3be).
- Ship record exists with SHA, PST push time, uptime poll (57 s after 2081 s, elapsed 188 s), live checks, sync result, CI result (success on d8022fda; 05ac2e15's own run cancelled by supersession).
- `/home/bilko/Projects/Bilko/src/data/standalone-projects.json` has `localPath ~/Self` on human-for-hire (python3 above).
- Live now: `/api/projects` lists human-for-hire with `"url":"https://bilko.run/book"`; `grep -c -e localPath -e '~/Self'` → 0; `/book` → 200; `/api/health` uptime 161 s (running the redeployed build).
- Gate re-run: `git diff --quiet origin/main HEAD -- scripts/refresh-commit-order.ts` ok; `git grep -F '/Self"' origin/main` ok.

## Combined diff review
`git diff 992ef37..HEAD --stat`: host-internals.md, refresh-commit-order.ts, standalone-projects.json, ship record. /code-review and /security-review were self-reviewed: no unsafe input handling, no secrets, no path traversal (static string Set, JSON data), no duplicated helper. The ownership check is exact-path based and already covered by tests/mcp-ownership.test.ts.

## Findings
- Critical: none.
- Important: none.
- Minor: ship record says CI covered 05ac2e15 only via the later d8022fda run (acceptable, noted in the record).
