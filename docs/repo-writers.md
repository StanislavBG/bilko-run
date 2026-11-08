# Who writes to this repo

`~/Projects/Bilko` is the live checkout. Burrow runs scripts from it, Session Manager merges
epics into its local `main`, and scheduler PRDs commit there. Render deploys `origin/main`. This
page lists every automated writer, the paths it owns, and how it reaches `origin/main`.

Goal: local `main` equals `origin/main`, or sits strictly ahead of it with only work that is
waiting to ship. `git status -sb` shows which: it should print `## main...origin/main` with no
ahead or behind count. Scheduler plans commit their validation and ship records
(`session-manager-operations/reviews/`) to local `main`, and a `Ship:` PRD pushes only the
feature commit, so local `main` drifts unless the records are pushed too. On 2026-11-05 it was 95
commits ahead and 60 behind, and every blog publish failed. `bash scripts/sync-local-main.sh`
publishes the records, drops commits that already shipped and keeps unshipped work on top; it never
pushes product code.

Most publishers push from a throwaway worktree or their own checkout, so each push leaves local
`main` behind. Copying the commit onto local `main` with a cherry-pick makes a twin (the same
patch under another sha), and a twin leaves local `main` diverged. On 2026-11-07 local `main`
ended up 4 ahead (two commits that had not shipped yet, plus two twins) and 3 behind. Those two
unshipped commits meant local `main` was not the push base, so Burrow's blog withdraw pushed
`c8e179f7` and cherry-picked twin `47bf41f6` onto it at 7:17 PM PST, and the seed pushed
`0648de33` and cherry-picked twin `399f7c42` at 7:28 PM PST. Then a bilko-host publish pushed
`b04aaf12` from its own checkout at 7:40 PM PST. To prevent that, the seed, the bilko-host
publisher, and Burrow's video publisher and blog withdraw now run
`bash scripts/sync-local-main.sh --no-push` right after their push. The seed and Burrow's two
fast-forward instead when local `main` is the push base. The sync drops twins and rebuilds local
`main` on `origin/main` with the unshipped commits on top, so local `main` ends equal to
`origin/main` or strictly ahead of it, never diverged, and it never pushes.
social-signals-trader's publisher does not run it (see its row).

## Writers

| Writer | Runs from | Commits | Reaches `origin/main` by |
|---|---|---|---|
| Blog post seed: `scripts/blog-seed.sh`, run by Burrow's `blog_publish` (Mon and Thu, 9:05 AM Pacific) | the live checkout | `content/blog/<slug>.md`, `public/blog-images/<slug>/`, the blog ledger | one commit built in a throwaway worktree at a fresh `origin/main`, guarded (exactly one commit, own paths only), pushed as `<sha>:main` (a push race rebuilds it). After its push it fast-forwards local `main` when local `main` is the commit's parent. Otherwise it releases `.git/blog-seed.lock` and runs `bash scripts/sync-local-main.sh --no-push`, which leaves local `main` equal to `origin/main` or strictly ahead, never diverged, and never pushes (Bilko PRD 1664; it no longer cherry-picks a twin). A non-zero sync exit is only a warning naming the manual fix; the seed's exit code and stdout stay the same |
| Blog videos: Burrow's `app/pipelines/marketing_video/publish.py` (Burrow no longer makes project videos; Session Manager's Demo Video, in the Project Home row, replaced them) | Burrow, against the live checkout | `public/blog-videos/<slug>/index.html` | the same pattern as the seed (Burrow `52fe2be`): one guarded commit on a fresh `origin/main`, built in a throwaway worktree and pushed as `<sha>:refs/heads/main` under `.git/blog-seed.lock`. After its push it fast-forwards local `main` when local `main` is the push base. Otherwise it releases the lock and runs `bash <checkout>/scripts/sync-local-main.sh --no-push` (Burrow PRD 2059, `efc60576`). It no longer cherry-picks |
| Blog post withdraw: Burrow's `app/pipelines/blog_post/withdraw.py`, also run by `app/pipelines/blog_post/replace.py` (by hand, `python -m app.pipelines.blog_post.replace --post-id <id> --reason <text>`; not scheduled) | Burrow, against the live checkout | only what its push guard, `_check_commit`, allows: deletes `content/blog/<slug>.md` (required), `public/blog-images/<slug>/` and `public/blog-videos/<slug>/`, drops the slug's row from the blog ledger (`.claude/skills/blog-from-git/blog-ledger.md`), and lists the slug in `content/blog/withdrawn.txt` (appended lines only), which unpublishes the live post (`d2e59329`) | one guarded commit (exactly one commit on a fresh `origin/main`, only those changes), built in a throwaway no-checkout worktree and pushed as `<sha>:refs/heads/main` under `.git/blog-seed.lock`. After its push it fast-forwards local `main` when local `main` is the push base. Otherwise it releases the lock and runs `bash <checkout>/scripts/sync-local-main.sh --no-push` (Burrow PRD 2060, `c1eb9679`). Its old `cherry-pick -x` made twin `47bf41f6` of `c8e179f7` on 2026-11-07 at 7:17 PM PST |
| Static-path app publishes: bilko-host MCP `publish_static_project` (`mcp-host-server/src/publish-checkout.ts`) | `~/.local/state/bilko-host/publish-checkout` | `public/projects/<slug>/`, the registry | its own checkout pushes `HEAD:main` (a push race refetches and rebases that checkout, 3 attempts), which leaves local `main` behind. After its push it releases its publish lock and runs `bash scripts/sync-local-main.sh --no-push` in the checkout the MCP server runs from (the live checkout; `BILKO_SYNC_REPO_ROOT` pinned to it, 180 s timeout), which leaves local `main` equal to `origin/main` or strictly ahead, never diverged, and never pushes (Bilko PRD 1665). Best effort: the publish reports one `local main: ...` line under `pushed: <sha>` and never fails because of it. Nothing to commit means no catch-up |
| Scheduler PRDs: dev-lead, validator, `Ship:` | the live checkout, on local `main` | any code; plan records under `session-manager-operations/reviews/` | a `Ship:` PRD cherry-picks the feature commit onto a throwaway `origin/main` tree and pushes it. Records stay local until `scripts/sync-local-main.sh` publishes them |
| Epic sessions | their own worktree under `~/.local/state/session-manager/session-manager-epic-worktrees/` | their own work | `git push origin HEAD:main` once the branch is on `origin/main`. Session Manager later merges the epic into local `main` |
| `scripts/sanity-qa-cron.sh` (not scheduled) | the live checkout | `src/data/commit-*.json` | pushes only when local `main` is exactly one commit ahead of `origin/main` |
| `~/Projects/social-signals-trader/scripts/publish-to-bilko.sh`, run by hand (its hourly cron row is paused) | a throwaway worktree of the live checkout (`${TMPDIR:-/tmp}/publish-to-bilko.XXXXXX/tree`); never writes the live checkout's working tree or local `main` | `public/projects/social-signals-trader/` only | one commit built at a freshly fetched `origin/main`, guarded (exactly one non-merge commit on that tip, every path under `public/projects/social-signals-trader/`), pushed as `<sha>:main`, rebuilt when a push loses a race (3 attempts). It never moves local `main` and does not call the catch-up (`--no-push`) itself: local `main` only falls behind until another writer's `--no-push` catch-up or `bash scripts/sync-local-main.sh` catches it up |
| `~/Projects/Weather/scripts/publish_web.sh` | the live checkout | `public/projects/outdoor-hours/`, `public/outdoor-hours/` | fast-forwards to `origin/main`, pathspec commit, `git push origin main`. Line 106 also runs `git push content-grade main:master`, which breaks the rule never to push Bilko to `content-grade` (fix belongs in the Weather repo) |
| `~/Projects/session-manager/web/remote-app/scripts/vendor-to-bilko.mjs` | Session Manager | copies `dist/` into `public/projects/session-manager/` (`--target` overrides) | does not commit or push. The files sit dirty in the live checkout until another writer or a person commits them |
| Session Manager Project Home | Session Manager | `session-manager-operations/project-pages/home.html` and `demo-video/index.html` | written into the live checkout's working tree; not committed or pushed by the writer. They show as dirty until committed by hand or by a scheduler PRD |

`.git/blog-seed.lock` serializes everything that moves local `main` from outside a session: the
seed, the video publisher, the blog withdraw and the sync. The first three release it before their
`--no-push` catch-up, because the sync takes it itself (`flock -w 120`) and would otherwise wait
120 s and exit 1. The bilko-host publisher holds only its own publish lock; its catch-up takes this
one through the sync.

social-signals-trader's publisher takes its own lock, `.git/publish-to-bilko.lock`, because it never moves
local `main`. Its old merge retry left merge commit `b1f82963` on `origin/main` on 2026-11-06. It stays:
the sync stops only on merge commits that are not on `origin/main` yet.

## Callers of `scripts/sync-local-main.sh` outside this repo

Burrow's video publisher and blog withdraw moved off the cherry-pick on 2026-11-07 (Burrow PRDs
2058-2060: the `app/shared/bilko_sync.py` helper, then each writer). After its push, unless a
fast-forward already caught local `main` up, each releases `.git/blog-seed.lock` and runs
`bash <checkout>/scripts/sync-local-main.sh --no-push` with `BILKO_SYNC_REPO_ROOT` set to the
checkout. A non-zero exit is only a warning there; the push still counts.

The contract is written in the header of `scripts/sync-local-main.sh`. Burrow relies on it, so
tell Burrow (`/send-feedback`) before changing any of it:

- the flag names `--no-push` and `--dry-run`, in any order (any other non-empty argument exits 1
  before the lock or any git command);
- the exit codes: 0 in sync or synced, 1 error with local `main` untouched, 3 needs a human;
- `flock -w 120` on `.git/blog-seed.lock`;
- the `BILKO_SYNC_REPO_ROOT` override, which is no longer test-only;
- log lines on stderr only. Burrow's warning quotes the last one.

## Rules

1. Never push local `main` as a whole unless `git status -sb` shows only your own commits ahead
   and nothing behind. Pushing more publishes other plans' unvalidated work.
2. A new publisher copies the seed's pattern (`build_seed_commit`, `seed_commit_ok` and
   `mirror_to_local_main` in `scripts/blog-seed.sh`): build its commit on a fresh `origin/main` in
   a throwaway worktree, push `<sha>:main`, rebuild on a push race, then run
   `bash scripts/sync-local-main.sh --no-push` in the live checkout (releasing
   `.git/blog-seed.lock` first if it holds it). It never cherry-picks a twin onto local `main`.
3. After a ship, or whenever `git status -sb` shows ahead and behind, run
   `bash scripts/sync-local-main.sh` (try `--dry-run` first). This default mode is still the one
   that publishes record commits: it pushes record-only commits, drops local commits that already
   shipped, keeps unshipped commits on top, and saves the old tip as `backup/main-pre-sync`. It
   never pushes product code. `--no-push`, which the publishers run after their push, does the
   same catch-up but never runs `git push`: record commits stay local, replayed in order with the
   rest. It fast-forwards a local `main` that is only behind and leaves a strictly-ahead one
   untouched.

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
