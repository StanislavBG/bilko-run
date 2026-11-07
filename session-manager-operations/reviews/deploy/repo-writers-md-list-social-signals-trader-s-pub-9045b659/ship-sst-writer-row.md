# Ship record: sst-writer-row (PRD 1641)

Time: 2026-11-06 5:44 PM PST

Result: already shipped. Both commits were already on origin/main (matched by patch-id), so this run pushed nothing.

## Commits

| Local SHA | Role | Origin SHA |
| --- | --- | --- |
| cc0bc977f608e5d4e6b7510b8ddf1c09da7111c8 | first run: `publish-to-bilko.sh` row | c2d341ab2c20e96bbb292f06ff01b366d5ac3e2f |
| a9bbee1118d79c5c5a7310ecf8d2593425205e59 | fix plan: `.git/publish-to-bilko.lock` paragraph | f19676bd177f0a898345892902ccba87fca5a2da |

origin/main tip at check time: f19676bd177f0a898345892902ccba87fca5a2da.

The duplicate subject was a fix plan (1641-fix-sst-writer-row) reusing the feature subject. They are two halves of one change. Both are on origin in the right order (row first, then lock paragraph).

## Checks

- Validation record (VERIFIED, Critical: none, Important: none): PASS
- Exactly the two commits carry the subject, and cc0bc977 is an ancestor of a9bbee11: PASS
- `git cherry -v origin/main a9bbee11`: both commits show `-`: PASS
- Docs-map prerequisite on origin/main: PASS
- Cherry-pick: not needed, already on origin: PASS
- Docs-only diff: only docs/repo-writers.md changed across the two commits: PASS
- origin/main docs/repo-writers.md has `publish-to-bilko.lock` (1) and the `run by hand (its hourly cron row is paused)` text (1): PASS
- Remote URL is https://github.com/StanislavBG/bilko-run.git: PASS
- Push: not performed (nothing to push): PASS
- /tmp/ship-sst-writer-row: never created: PASS

SHIP: PASS
