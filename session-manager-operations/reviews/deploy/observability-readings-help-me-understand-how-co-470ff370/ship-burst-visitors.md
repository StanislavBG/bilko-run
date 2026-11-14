# Ship: burst-visitors-are-bots (PRD 1744)

- Validation record: `validate-burst-visitors.md` — 1742 burst-visitors-are-bots **VERIFIED**; Critical none, Important none. PASS
- Candidate (`git log --no-merges origin/main..HEAD -- server/page-hits.ts tests/page-hits.test.ts docs/observability.md`): exactly one, c04d6f41 `feat(page-hits): flag 20-hits-in-60s visitors as scripts`, matches the validation SHA. PASS
- Previous origin/main tip: 2c0a0b7a2a15fa9605b6cb3b61720b12a469214b
- Cherry-picked in a throwaway tree (`/tmp/ship-burst-visitors`, detached at origin/main), no conflict.
- **Pushed SHA: 862fe87d6df325f9638a67c2c57071a04e6260fc** (`feat(page-hits): flag 20-hits-in-60s visitors as scripts`), one commit on top of 2c0a0b7a. Remote: https://github.com/StanislavBG/bilko-run.git (origin) only; `git ls-remote origin refs/heads/main` = 862fe87d. PASS

## Gate on the pushed tree

- `pnpm test`: 183 files passed, 2 skipped; 2302 tests passed, 15 skipped; exit 0. PASS
- `pnpm typecheck`: exit 0. PASS
- `pnpm build`: exit 0. PASS

## Times (America/Los_Angeles)

- Push: 2026-11-13 08:05:43 PM PST
- Deploy seen: 2026-11-13 08:08:21 PM PST (uptime 47 s, 158 s after push; earlier tries showed the old instance at 289–410 s uptime)

## Live checks (all with cookie bilko_internal=1)

- Deploy (/api/health uptime < seconds since push): PASS
- https://bilko.run/ → 200: PASS
- https://bilko.run/book → 200: PASS
- https://bilko.run/wp-config.php → 404: PASS
- GET /api/admin/traffic?days=1&mine=exclude&bots=exclude (admin Bearer) → 200, totals.visitors = 92, totals.confirmedVisitors = 19 (both numeric); hits 575, botHits 3213: PASS

Counts only; no IPs, user agents or visitor ids recorded.

SHIP: PASS
