# Who writes to this repo

`~/Projects/Bilko` is the live checkout. Render deploys `origin/main`. Scheduler PRDs commit code to local `main`; their plan records go to the git-ignored `session-manager-operations/plan-records/` and are never committed. A `Ship:` PRD pushes only the feature commit, and most publishers push from a throwaway worktree or their own checkout. So local `main` drifts behind and ahead of `origin/main`.

Goal: `git status -sb` prints `## main...origin/main`, with no ahead or behind count (strictly ahead with work waiting to ship is fine).

## Rules

1. Never push local `main` as a whole unless `git status -sb` shows only your own commits ahead and nothing behind. Pushing more publishes other plans' unvalidated work.
2. When local `main` drifts, run `bash scripts/sync-local-main.sh --dry-run`, then `bash scripts/sync-local-main.sh`. It drops commits already on `origin/main`, keeps unshipped work on top in order and saves the old tip as `backup/main-pre-sync`. It never pushes.
3. A new publisher copies `build_seed_commit`, `seed_commit_ok` and `mirror_to_local_main` from `scripts/blog-seed.sh`: one guarded commit built on a fresh `origin/main` in a throwaway worktree, pushed as `<sha>:main`, rebuilt on a push race. It ends with `bash scripts/sync-local-main.sh --no-push` in the live checkout (releasing `.git/blog-seed.lock` first if it holds it). It never cherry-picks onto local `main`: that makes a twin (the same patch under another sha) and leaves local `main` diverged.

## Writers

| Writer | Writes | Lands by |
|---|---|---|
| Blog seed: `scripts/blog-seed.sh` (run by Burrow) | `content/blog/<slug>.md`, `public/blog-images/<slug>/`, the blog ledger | throwaway worktree, push `<sha>:main`, then `--no-push` sync |
| Blog videos: `~/Projects/burrow/app/pipelines/marketing_video/publish.py` | `public/blog-videos/<slug>/` | same pattern as the seed |
| Blog withdraw: `~/Projects/burrow/app/pipelines/blog_post/withdraw.py` | deletes a post's files, its ledger row; appends `content/blog/withdrawn.txt` | same pattern as the seed |
| bilko-host `publish_static_project` (`mcp-host-server/src/publish-checkout.ts`) | `public/projects/<slug>/`, the registry | own checkout pushes `HEAD:main`, then `--no-push` sync in the live checkout |
| Scheduler PRDs (dev-lead, validator, `Ship:`) | any code | `Ship:` pushes the feature commit; plan records stay in the git-ignored `session-manager-operations/plan-records/` and are never committed |
| Epic sessions (`~/.local/state/session-manager/session-manager-epic-worktrees/`) | their own work | `git push origin HEAD:main`; Session Manager merges the epic into local `main` |
| `scripts/sanity-qa-cron.sh` | `src/data/commit-*.json` | pushes only when local `main` is one commit ahead |
| `~/Projects/social-signals-trader/scripts/publish-to-bilko.sh` | `public/projects/social-signals-trader/` | throwaway worktree, push `<sha>:main`; never touches local `main` |
| `~/Projects/Weather/scripts/publish_web.sh` | `public/projects/outdoor-hours/`, `public/outdoor-hours/` | live checkout: fast-forward, pathspec commit, `git push origin main` |
| `~/Projects/session-manager/web/remote-app/scripts/vendor-to-bilko.mjs` | `public/projects/session-manager/` | no commit; files stay dirty until someone commits them |
| Session Manager Project Home | `session-manager-operations/project-pages/` (git-ignored) | no commit; writes into the git-ignored folder |

`.git/blog-seed.lock` serializes every writer that moves local `main` from outside a session, and the sync takes it itself. Outside callers (`~/Projects/burrow/app/shared/bilko_sync.py`) rely on the contract in the header of `scripts/sync-local-main.sh`; tell Burrow with `/send-feedback` before changing it.

## When the sync exits 3

A local commit conflicts with `origin/main`, or local `main` has merge commits. Do it by hand in a throwaway tree:

1. `git worktree add --detach /tmp/sync origin/main`, then cherry-pick each `+` commit from `git cherry origin/main main` in order.
2. On a conflict, look at both sides. Where `origin/main` already shipped the same change, keep its side. Skip a commit if nothing is left of it. Keep real unshipped work.
3. Test, push what should ship, create a backup branch, then run `git reset --keep <tip>` in `~/Projects/Bilko`. Reset each `sm-epic/*` branch cut from the old tip onto the new `main`, so a later merge cannot bring the old history back.
