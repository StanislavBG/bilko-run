# Validation: sst-writer-row

Base: ea15af341d8f7512a98243f5d22e2bb32e28012e. Commits touching docs/repo-writers.md since base: cc0bc977 and a9bbee11, both "doc(repo-writers): social-signals-trader publishes from a throwaway worktree". Gate: none (read-only check). I read the script with cat and never ran it.

## 1641-sst-writer-row — VERIFIED

- Script defines `build_publish_commit` and `publish_commit_ok` and pushes `"$SHA:refs/heads/$BILKO_BRANCH"` (publish-to-bilko.sh push loop). Criterion 1 holds.
- Writer cell, docs/repo-writers.md:26: "run by hand (its hourly cron row is paused)". The live crontab has `#PAUSED-INACTIVE# 47 * * * * .../publish-to-bilko.sh`, so it is hourly and paused. The script header says "Run by hand".
- Runs-from cell: the script's `mktemp -d "${TMPDIR:-/tmp}/publish-to-bilko.XXXXXX"` with `WT="$WT_PARENT/tree"` and `git worktree add --detach --no-checkout`. All writes go to the worktree, `$STAGE`, and the lock file in the git dir. Nothing touches the live working tree or local main.
- Commits cell: `SUBTREE="public/projects/social-signals-trader"`. The guard `publish_commit_ok` rejects any other path.
- Last cell: `fetch_base` fetches origin/main. `publish_commit_ok` requires `rev-list --count base..sha == 1` and `sha^@ == base`, which excludes merge commits (two parents). It pushes `$SHA:refs/heads/main`. `for attempt in 1 2 3` rebuilds after a lost race, so 3 attempts. Local main is never written, so it only falls behind. scripts/sync-local-main.sh:49-51 fast-forwards it.
- Paragraph (repo-writers.md:34-36): the script takes `$(git rev-parse --git-common-dir)/publish-to-bilko.lock`, which is `.git/publish-to-bilko.lock`, via `flock`. b1f82963 is a commit and is an ancestor of origin/main. sync-local-main.sh:55 stops only on `rev-list --merges origin/main..main`, so the claim holds.
- Diff scope: the repo-writers.md diff is one row plus one paragraph. No other row changed.
- Push route described elsewhere: none. `git grep publish-to-bilko` finds only repo-writers.md, plus an unrelated code comment in server/routes/project-events.ts:12.
- Personal email or real name in added tracked lines: none found.
- Link criterion (SocialSignalsTrader entry → docs/repo-writers.md): not applicable as written. The docs-map plan deleted that entry from CLAUDE.md (0264ff76, 3fd0bc19). No file now contains "the sibling's publish-to-bilko step", so there is nothing to link. The PRD allowed that move. It is a Minor finding because the pointer from the project description to the writer row is gone.
- CLAUDE.md is unchanged by this PRD, which agrees with "no push-route description added there".

## Findings

Critical: none.

Important: none.

Minor:
- No SocialSignalsTrader entry links to docs/repo-writers.md. The entry was removed by the docs-map plan, so criterion 5 is vacuous. docs/host-internals.md:122 mentions SocialSignalsTrader but not the publish step.
- The row says "exactly one non-merge commit". The script checks one commit whose sole parent is the base. That is equivalent, so the claim is accurate.
- The PRD files are in prds-archived/ (1641-sst-writer-row.md, and 1641-fix-sst-writer-row.md as well). I checked against 1641-sst-writer-row.md.
