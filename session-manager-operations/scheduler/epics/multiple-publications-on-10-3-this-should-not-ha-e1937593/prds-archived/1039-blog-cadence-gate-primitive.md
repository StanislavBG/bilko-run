---
title: Blog cadence gate: hard minimum gap between published posts (check + next-slot)
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-03T19:10:36.464Z
sourcePromptId: multiple-publications-on-10-3-this-should-not-ha-e1937593
agentType: dev-lead
planId: pl-musroq7k-b96201
---
# Goal

primitive: add a deterministic, code-enforced cadence gate so two blog posts can never be published less than 3 days apart. Bug context: on 2026-10-03 bilko.run published two posts (turn-your-github-year-into-a-heatmap-and-badge-wall at 16:08Z by the cadence watchdog, twelve-places-one-weather-rule-you-set-yourself at 17:26Z by an interactive "owner override" session) because the 3-day lower bound was only prose for the manual path. This PRD builds the gate (pure functions + CLI + config keys); later PRDs remediate the data and wire it into the watchdog and skill.

# Acceptance criteria

- [ ] `.claude/skills/blog-from-git/blog.config.yaml` `cadence:` block gains `min_gap_days: 3` and `min_gap_enforced_since: '2026-10-01T00:00:00.000Z'`, each with a comment saying min_gap_days is a HARD rule that no override (including rotation.override) may bypass.
- [ ] `scripts/blog-cadence-gate.ts` exports pure `findSpacingViolations(posts: {slug: string; publishedAt: string}[], minGapDays: number, sinceIso: string)` returning `{earlier: string; later: string; gapHours: number}[]` for every chronologically-adjacent pair whose later post is at/after sinceIso and whose gap is < minGapDays*24h; and pure `nextAllowedSlot(posts, minGapDays, now: Date): string` returning the ISO of max(now, latest publishedAt + minGapDays days).
- [ ] `scripts/blog-cadence-gate.ts` exports `loadSeededPosts(): Promise<{slug; publishedAt}[]>` that deletes TURSO_DATABASE_URL/TURSO_AUTH_TOKEN from process.env, points the local SQLite client at a fresh temp file via a new `BILKO_SQLITE_PATH` env override honoured by `getClient()` in `server/db.ts`, runs `initDb()`, and returns `SELECT slug, published_at FROM blog_posts WHERE published = 1` (dates normalised to ISO).
- [ ] CLI: `pnpm tsx scripts/blog-cadence-gate.ts check` prints each violation and exits 1 (exit 0 and prints `ok` when none); `pnpm tsx scripts/blog-cadence-gate.ts next-slot` prints only the next allowed ISO timestamp. Both read min_gap_days / min_gap_enforced_since from blog.config.yaml via js-yaml and exit 1 with a diagnostic if the keys are missing.
- [ ] `tests/blog-cadence-gate.test.ts` unit-tests findSpacingViolations (same-day pair flagged, exactly-3-day pair allowed, pre-cutoff pairs ignored, unsorted input, empty list) and nextAllowedSlot (empty list returns now, recent post returns latest+3d, old post returns now).

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- scripts/blog-cadence-gate.ts
- tests/blog-cadence-gate.test.ts
- server/db.ts
- .claude/skills/blog-from-git/blog.config.yaml

# Implementation notes

Read first: server/db.ts lines 1-25 (getClient), server/db.ts lines 565-600 (applyDataMigrationOnce/applyBlogRewrites), server/routes/admin-observability.ts lines 318-345 (how blog.config.yaml cadence is loaded with js-yaml `load`), .claude/skills/blog-from-git/blog.config.yaml lines 55-90 (cadence block).

Steps:
1. server/db.ts getClient(): in the local branch use `process.env.BILKO_SQLITE_PATH` as dbPath when set (still mkdir its dirname), otherwise the existing data/contentgrade.db. No other change to db.ts.
2. blog.config.yaml: add the two cadence keys from the AC right under target_gap_days. Do NOT change target_gap_days in this PRD.
3. Create scripts/blog-cadence-gate.ts (TypeScript, ESM, run with tsx like scripts/blog-readability.ts). In loadSeededPosts set env BEFORE dynamically importing '../server/db.js' (getClient caches the client). Use os.tmpdir()+mkdtemp for the file. Normalise published_at with new Date(x).toISOString(); skip rows with null/invalid dates. CLI dispatch only when run as main (compare import.meta.url to process.argv[1]) so tests can import the pure functions without side effects.
4. tests/blog-cadence-gate.test.ts: pure-function tests only. Do NOT add a test that runs `check` against the real repo seeds — the repo currently has a known same-day violation on 2026-10-03 that a later PRD (blog-cadence-remediate-10-03) fixes and then adds that repo-wide test.

Do not touch: server/routes/blog.ts, server/routes/admin-observability.ts, scripts/blog-cadence-watchdog.sh, any blog seed content in server/db.ts.

# Out of scope

- Changing any post's published_at
- Watchdog or skill-doc wiring
- API filtering of future-dated posts

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/blog-cadence-gate.test.ts tests/db.test.ts
timeout 120 pnpm tsx scripts/blog-cadence-gate.ts next-slot
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
