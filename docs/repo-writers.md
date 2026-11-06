# Who writes to this repo

`~/Projects/Bilko` is the live checkout. Burrow runs scripts from it, Session Manager merges
epics into its local `main`, and scheduler PRDs commit there. Render deploys `origin/main`. This
page lists every automated writer, the paths it owns, and how it reaches `origin/main`.

Goal: local `main` equals `origin/main`, or sits strictly ahead of it with only work that is
waiting to ship. `git status -sb` shows which.

## Writers

| Writer | Runs from | Commits | Reaches `origin/main` by |
|---|---|---|---|
| Blog post seed: `scripts/blog-seed.sh`, run by Burrow's `blog_publish` (Mon and Thu, 9:05 AM Pacific) | the live checkout | `content/blog/<slug>.md`, `public/blog-images/<slug>/`, the blog ledger | one commit built in a throwaway worktree at a fresh `origin/main`, guarded (exactly one commit, own paths only), pushed as `<sha>:main`, then mirrored onto local `main` |
| Blog and project videos: Burrow's `app/pipelines/marketing_video/publish.py` | Burrow | `public/blog-videos/<slug>/index.html` | the same pattern as the seed (Burrow `52fe2be`) |
| Static-path app publishes: bilko-host MCP `publish_static_project` (`mcp-host-server/src/publish-checkout.ts`) | `~/.local/state/bilko-host/publish-checkout` | `public/projects/<slug>/`, the registry | its own checkout pushes `HEAD:main`. Local `main` only falls behind, and the sync fast-forwards it |
| Scheduler PRDs: dev-lead, validator, `Ship:` | the live checkout, on local `main` | any code; plan records under `session-manager-operations/reviews/` | a `Ship:` PRD cherry-picks the feature commit onto a throwaway `origin/main` tree and pushes it. Records stay local until `scripts/sync-local-main.sh` publishes them |
| Epic sessions | their own worktree under `~/.local/state/session-manager/session-manager-epic-worktrees/` | their own work | `git push origin HEAD:main` once the branch is on `origin/main`. Session Manager later merges the epic into local `main` |
| `scripts/sanity-qa-cron.sh` (not scheduled) | the live checkout | `src/data/commit-*.json` | pushes only when local `main` is exactly one commit ahead of `origin/main` |

`.git/blog-seed.lock` serializes everything that moves local `main` from outside a session: the
seed, the video publisher and the sync.

## Rules

1. Never push local `main` as a whole unless `git status -sb` shows only your own commits ahead
   and nothing behind. Pushing more publishes other plans' unvalidated work.
2. A new publisher copies the seed's pattern (`build_seed_commit` and `seed_commit_ok` in
   `scripts/blog-seed.sh`): commit on a fresh `origin/main` in a throwaway worktree, push
   `<sha>:main`, rebuild on a push race, never rebase local `main`.
3. After a ship, or whenever `git status -sb` shows ahead and behind, run
   `bash scripts/sync-local-main.sh` (try `--dry-run` first). It pushes record-only commits, drops
   local commits that already shipped, keeps unshipped commits on top, and saves the old tip as
   `backup/main-pre-sync`. It never pushes product code.

## When the sync exits 3

A local commit conflicts with `origin/main`, or local `main` has merge commits. Do it by hand
in a throwaway tree, as on 2026-11-05:

1. `git worktree add --detach /tmp/sync origin/main`, then cherry-pick each `+` commit from
   `git cherry origin/main main` in order.
2. On a conflict, look at both sides. Where `origin/main` already shipped the same change, keep
   its side. Skip a commit if nothing is left of it. Keep real unshipped work.
3. Test, push what should ship, create a backup branch, then run `git reset --keep <tip>` in
   `~/Projects/Bilko`. Reset each `sm-epic/*` branch that was cut from the old tip onto the new
   `main`, so a later merge cannot bring the old history back.
