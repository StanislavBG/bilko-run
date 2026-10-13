# Validation: blog-draft.sh / blog-seed.sh Burrow entrypoints (PRDs 1299, 1300, 1301)

Base: no `Base:` line in PRD 1302; used 42ae188 (parent of first plan commit a3234b9). Plan commits: a3234b9 (1299), d5d821e (1300), d7dd941 (1301). Diff: 9 files, +1495/-1816.
Environment note: the job worktree had no `node_modules`; I symlinked the main tree's (gitignored) so the gates could run. Not committed.

## Gates (re-run)
- `vitest run` blog-draft, blog-seed, blog-cadence-watchdog, blog-watchdog-env, blog-watchdog-heartbeat: 5 files, 70 tests passed.
- `pnpm typecheck`: exit 0.
- `bash -n` on blog-draft.sh / blog-seed.sh / blog-cadence-watchdog.sh covered by the test files running them; sources read.

## 1299-blog-draft-entrypoint — VERIFIED
- Args: scripts/blog-draft.sh:34-46 requires absolute --out and ISO UTC --slot, else exit 2 + usage.
- Drafted: :112-118 writes result.json {status,slug,title,excerpt,category}; post.md validated by bp_validate_post (:105); images under out.
- Skipped: :90-98 exit 0, result.json {status:skipped,reason}, no post.md.
- Error: fail() :51-57 exit 1 + result.json {status:error,error} when out writable; covers claude rc/timeout (:81-87), missing post.md (:100), malformed frontmatter (:105), readability (:107-110).
- Guards: GUARDED_PATHS + drafts/ + HEAD + index snapshot compared before/after (:60-78, :84); prompt forbids git add/commit/push (lib:108); DAG artifacts under ${out}/artifacts (lib:94).
- Model pin: `--model "$BP_CLAUDE_MODEL"` (:81), = claude-sonnet-5, same as watchdog. timeout 2400s (<45 min).
- Env: sources blog-pipeline-lib.sh, missing binaries -> status error (:62).
- tests/blog-draft.test.ts passes.

## 1300-blog-seed-entrypoint — VERIFIED
- Bad bundle/post.md/frontmatter -> exit 2 before any write (seed.sh:44-50).
- Body verbatim via blog-seed-apply.ts; writes content/blog, public/blog-images/<slug>/, ledger row + rotation state.
- Cadence gate `pnpm tsx scripts/blog-cadence-gate.ts check`: rc 1 -> rollback_files then exit 3; readability failure exit 4 before any write.
- One commit with explicit pathspecs (`git add -- PATHS`, `git commit -- PATHS`), allowed-path check against config; `git push origin main` only; origin must match StanislavBG/bilko-run (:62-64); 3-attempt fetch/rebase race recovery.
- blog.config.yaml allowed_commit_paths gains public/blog-images/ (line 339); watchdog check updated, tests pass.
- Live poll of /api/blog bounded by verify_deploy_* and 1440s budget; poll timeout is exit 5 (distinct); last stdout line JSON {slug,url,commit,published_at} (emit_result :94-96; logs go to stderr).
- No claude -p in seed. tests/blog-seed.test.ts + watchdog test pass.

## 1301-blog-watchdog-use-entrypoints — VERIFIED
- watchdog:~560-600 calls DRAFT_CMD --out --slot "$NEXT_SLOT", then run_seed on the bundle; BLOG_DRAFT_CMD / BLOG_SEED_CMD test overrides (:446-447); inline seed/push/verify removed (-781 lines).
- Exit mapping: draft skipped -> heartbeat ok/stall, lock cleared; seed rc 3 -> cadence-hold heartbeat, lock cleared, exit 0; other -> `error: blog-seed.sh rc=N` heartbeat; lock kept only for rc 0 (keep_state_lock_for_seed_rc).
- Non-autonomous: bp_bundle_to_draft writes drafts/<date>-<slug>.md, never seeds.
- Pending drafts converted to bundles and seeded, honoring MAX_POSTS_PER_RUN; rc 2 -> .rejected-invalid.
- Only remaining watchdog `claude -p` (daily scan, :331) pins `--model claude-sonnet-5`.
- Tests updated, env + heartbeat tests pass.

## Cross-check vs Burrow PRDs 1376 / 1378 (prds-archived/)
- 1376: `--out <abs_dir> --slot <ISO UTC>`, exit 0 + result.json drafted/skipped, error JSON on non-zero, post.md frontmatter slug/title/excerpt/category, optional images/, 45 min max — all match.
- 1378: `--bundle <abs_dir>`, exit 0 last stdout line {slug,url,commit,published_at}, exit 3 = cadence gate with nothing committed, other non-zero = failure, <25 min (1440s budget) — all match.

## Other criteria
- claude -p pins --model: blog-draft.sh:81, watchdog:332; blog-seed.sh uses no claude. PASS.
- Timers: `systemctl --user is-enabled blog-cadence-watchdog.timer blog-watchdog-heartbeat-check.timer` -> enabled, enabled. No plan commit touches systemd files. PASS.

## Findings
### Critical
- none
### Important
- none
### Minor
- A zero-byte file literally named `<path>` exists untracked in the worktree root (created 19:22, not by this plan's commits); likely a stray from another job. Not committed.
- PRD 1302 has no `Base:` line (base inferred), and its `# Files` lists only scripts/blog-draft.sh although the deliverable is this record.
- blog-seed.sh exit 1 and exit 4 are both "failure" to Burrow (only 3 is special) — matches contract, noted for awareness.
