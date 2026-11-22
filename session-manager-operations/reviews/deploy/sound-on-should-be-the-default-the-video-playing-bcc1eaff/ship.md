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

## Push

- 6:30 PM PST 2026-11-21: `git push origin HEAD:main` → `f4845b74..d7c00530`. Pushed SHA: d7c00530 (fast-forward). PASS

## Deploy check

- Poll of https://bilko.run/api/health (curl --max-time 15, 30 s apart, max 20 tries): try 7 at 6:33 PM PST showed uptime 49 s, 183 s after the push (tries 1-6 showed the old ~3055-3206 s process). PASS
- Bundle: https://bilko.run/projects references /assets/clerk-DEjcwaoN.js (userActivation 0, NotAllowedError 0) and /assets/index-DUOzrr7N.js (userActivation 1, NotAllowedError 1; both were 0 in the old /assets/index-DrfUtgye.js). The new sound code is served. PASS
- This record's final update is pushed as a follow-up commit (docs only, no redeploy needed).

SHIP: PASS
