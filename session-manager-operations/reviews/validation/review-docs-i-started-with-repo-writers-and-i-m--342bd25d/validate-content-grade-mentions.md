# Validation: content-grade mention cleanup

Base: 90be0380 (known). Commits: 1700bfa6 (docs), 6d6a26fa (scripts). Review tools: self-review of the 5-file, 8-line diff (no secrets, no input handling, comments/prose only).

## drop-content-grade-doc-mentions — VERIFIED
- deployment.md bullet: `docs/deployment.md:75` now "Push only to `origin` `main` of `StanislavBG/bilko-run`", still links map.md#rules-everyone-shares.
- blog.config.yaml: `:324` and `:334` keep `push_remote: origin` with original spacing; the diff changes only the trailing comments.
- scan.md:14 now "its only remote is `origin`"; no CLAUDE.md citation.
- `git grep -n -i content-grade -- docs CLAUDE.md README.md .claude` printed nothing; `docs-guard.sh docs/deployment.md` → "clean (1 files)".
- Re-ran the three watchdog test files: 52 passed.

## drop-content-grade-script-comments — VERIFIED
- grep for `content-grade` / `CLAUDE.md hard rule` in both scripts: no match.
- Diff of both scripts touches comment lines only (`blog-cadence-watchdog.sh:216-217`, `sanity-qa-cron.sh:72-73`); the push-remote check is unchanged.
- Watchdog, env and heartbeat tests: 3 files, 52 tests passed.

## Findings
- Critical: none.
- Important: none.
- Minor: `scripts/blog-cadence-watchdog.sh:217` has a comment line break that leaves a short orphan line ("Rules everyone shares"). Cosmetic only.
