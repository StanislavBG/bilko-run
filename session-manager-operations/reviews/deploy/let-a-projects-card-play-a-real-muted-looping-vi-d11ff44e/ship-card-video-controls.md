# Ship: card video controls

Pushed SHA: ba7eccd2197305e4345601e5ef17d5244174a5d6 (origin/main, StanislavBG/bilko-run; was e82b204a)
Pushed at: 2026-11-14 9:17:33 PM PST, fast-forward, from a throwaway tree at /tmp/ship-card-video-controls (removed).

## Commits (log order; local SHA → pushed SHA)
- 2641c318 → 68fb738e feat(shared): add hasAudioTrack MP4/WebM audio-track sniffer (video-audio-sniff)
- 36ceb550 → 26c9ab47 feat(cards): flag listing.video clips that carry an audio track (card-video-audio-flag)
- 85016957 → 996bf5a7 feat(projects): Pause/Play and Mute controls on the /projects card video (card-video-controls)
- 4a2e6f71 → ba7eccd2 docs(host-contract): card video sound, Pause/Unmute controls, click-to-play poster (card-video-controls-docs)

e82b204a (publish: escape-velocity build) was already on origin/main; nothing else was pushed. The validation record commit 30882d5f stays local for scripts/sync-local-main.sh.

## Checks
- Validation record: all four PRDs VERIFIED, Critical none, Important none: PASS
- Cherry-pick onto origin/main, no conflicts: PASS
- pnpm test on the pushed tree: PASS (188 files passed, 2 skipped; 2378 tests passed, 15 skipped)
- pnpm typecheck on the pushed tree: PASS (exit 0)
- pnpm build on the pushed tree: PASS (exit 0)
- Push to origin main: PASS (e82b204a..ba7eccd2)
- Deploy live: PASS — /api/health uptime 45 s at 164 s after the push (2026-11-14 9:20:17 PM PST)
- https://bilko.run/projects: PASS (200, 9:20:20 PM PST, cookie bilko_internal=1)
- https://bilko.run/: PASS (200, 9:20:20 PM PST, cookie bilko_internal=1)

SHIP: PASS
