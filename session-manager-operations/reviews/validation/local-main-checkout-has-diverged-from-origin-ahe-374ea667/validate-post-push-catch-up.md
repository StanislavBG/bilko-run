# Validation: post-push local-main catch-up

Base: none recorded in the PRD; used 261abb85 (last commit before c23ab688). Gate-relevant commits: c23ab688, bd5dc54f, 6d87a950, c15e42de.
Reviewed with self-review (no background agents). Gate: `pnpm vitest run` on sync-local-main, blog-seed, mcp-publish-checkout, mcp-dist-sync: 4 files, 37 tests pass. Also `bash -n` on both scripts OK and `pnpm --dir mcp-host-server build` exits 0 and leaves mcp-host-server clean (dist in sync).

## sync-no-push-mode — VERIFIED
- --no-push never pushes: scripts/sync-local-main.sh `(( ! NO_PUSH )) && [[ "$RECORDS_TIP" != "$BASE" ]]` guards the only `git push`; records forced into OTHERS (line ~86), replayed via replay() in cherry order.
- Behind-only ff / strictly-ahead no-op / guards (exit 3 merges, exit 1 dirty): short-circuit untouched in diff; tests cover them (gate green).
- --dry-run + --no-push either order: arg loop accepts both; dry branch prints "would move … push nothing" and exits 0 before any write; unknown flag exits 1 before lock/git (loop precedes `cd`).
- Tests: tests/sync-local-main.test.ts +210 lines cover twins+unshipped+record, ff, ahead, merge exit 3; pass.
- Header documents callers, flags, exit 0/1/3, flock -w 120, BILKO_SYNC_REPO_ROOT (not test-only), stderr-only, tell Burrow first: present.

## seed-mirror-rebases-not-twins — VERIFIED
- scripts/blog-seed.sh mirror_to_local_main: ff branch unchanged when HEAD == parent; else `flock -u 9` then `BILKO_SYNC_REPO_ROOT="$REPO_ROOT" bash sync-local-main.sh --no-push >&2`; no cherry-pick remains (grep: only comments/replay in sync script).
- Non-zero rc logs warning with exit code and `bash scripts/sync-local-main.sh`; function always returns 0, so seed exit code/stdout unaffected; sync stdout is redirected to stderr.
- Sync's output is routed to stderr, keeping stdout a single JSON line.
- Tests for ahead and behind cases added in tests/blog-seed.test.ts; pass. Header describes the mirror.

## publisher-catches-up-local-main — VERIFIED
- mcp-host-server/src/publish-checkout.ts catchUpLocalMain: runs `bash <hostRoot>/scripts/sync-local-main.sh --no-push`, cwd hostRoot, timeout 180s, only if script exists; never throws.
- ok/committed/sha unchanged; localMain {synced, exitCode, detail(last stderr line)} added only on committed success; nothing-to-commit returns early with no catch-up.
- Lock released before catch-up, documented in a comment.
- server.ts pushedLine adds one `local main: …` line. Tests cover invoked/failing/no-commit; dist rebuilt, mcp-dist-sync passes, build leaves tree clean.

## writers-doc-post-push-catch-up — VERIFIED
- docs/repo-writers.md: seed row and static-path row say they run `--no-push`, never diverge, never push; 2026-11-07 attribution (47bf41f6 7:17 PM, 399f7c42 7:28 PM, b04aaf12 7:40 PM) present.
- Burrow rows match tree: grep of Burrow marketing_video/publish.py and blog_post/withdraw.py shows no cherry-pick calls (only "never cherry-picks" docs), so the rows' fast-forward-or-sync wording is correct; withdraw row lists withdrawn.txt matching withdraw.py:37.
- social-signals-trader row says it does not call the catch-up. Rules 2/3 and the external-callers section mention --no-push (lines 49-88).

## Combined-diff checks
- Twin cherry-pick onto local main: none left (seed and docs). replay() cherry-picks only in a throwaway worktree.
- Push from --no-push: none.
- Seed blocking on its own lock: avoided by `flock -u 9`; both seed call paths go through mirror_to_local_main.
- Catch-up failure turning publish into failure: not possible (caught, returned as data).
- Burrow contract: flag names, exit codes 0/1/3, flock -w 120, BILKO_SYNC_REPO_ROOT, stderr-only logs all unchanged.

## Findings
- Critical: none. Important: none.
- Minor: no `Base:` line in the validate PRD, so the base was inferred.
- Minor: docs/repo-writers.md ~line 27: "social-signals-trader's publisher does not run it (see its row)." sits as an unwrapped stray line after the paragraph.
- Minor: catchUpLocalMain awaits the sync (up to 180s) before returning, so a publish call can take that much longer; intentional and documented.
