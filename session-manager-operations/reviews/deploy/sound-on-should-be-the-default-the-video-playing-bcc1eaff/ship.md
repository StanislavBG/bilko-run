# Ship: card video sound on by default (plan sound-on-should-be-the-default-the-video-playing-bcc1eaff)

## Validation

Record: `session-manager-operations/reviews/validation/sound-on-should-be-the-default-the-video-playing-bcc1eaff/validate-card-sound-on-default.md`

- card-sound-primitives: VERIFIED
- card-sound-on-by-default: VERIFIED

## Commits to push (local main ahead of origin/main, nothing else)

- 9a0c8107 feat(projects): card sound primitives playWithSound + createCardSound
- 569681a0 feat(projects): card video sound on by default via createCardSound
- 3abc7266 docs(validation): card sound on default review record
- plus this record's commit

`git cherry -v origin/main HEAD` after `git fetch origin main` at 6:30 PM PST 2026-11-21: ahead 3, behind 0, only this plan's commits, so no cherry-pick worktree and no `scripts/sync-local-main.sh` were needed.
Remote: `origin` = https://github.com/StanislavBG/bilko-run.git (never content-grade). No force push.

## Pre-push state

- Checked 6:30 PM PST 2026-11-21: /api/health uptime 3044 s (old process).
