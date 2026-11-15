# Validation: card video controls plan

Base: fe487c47. Commits: 2641c318 (sniff), 36ceb550 (audio flag), 85016957 (controls), 4a2e6f71 (docs). Unrelated e82b204a (publish: escape-velocity build) is also in the range.
Gates re-run: vitest (video-audio, asset-versions, projects-view, project-card-shot, projects-ring) 64/64 pass; `pnpm typecheck` exit 0; `vite build` exit 0. `/code-review` and `/security-review` not run separately; self-reviewed the diff.

## video-audio-sniff — VERIFIED
- Exports `hasAudioTrack(bytes, ext)`, no imports: shared/video-audio.ts:19, file header (no `import`).
- MP4: moov>trak>mdia>hdlr, 'soun' at payload+8: shared/video-audio.ts:70-125; size 1 largesize at :53-60, size 0 at :62; moov after mdat works since top-level walk continues.
- WebM IDs/sizes, unknown size to parent end: :127-190.
- Never throws (try/catch :20-32), budget 10,000 (`MAX_ELEMENTS`, `--budget.left`), unknown ext false (:28-29), children clamped to parent (`end > parentEnd` → undefined).
- tests/video-audio.test.ts 15 pass.

## card-video-audio-flag — VERIFIED
- `AssetVersions.audio: string[]` shared/asset-versions.ts:27; built sorted at :100; video read once (`readAsset` once, hash and sniff share bytes) :90-96. `cards`, `files`, `cardVersion` untouched.
- src/data/assetVersions.ts: EMPTY has `audio: []`; `assetHasAudio` false without a list (Array.isArray guard).
- HubCard.videoHasAudio with doc comment; set only when `listing.video` (src/data/projectsView.ts:76,124).
- Tests present and passing.

## card-video-controls — VERIFIED
- Props `hasAudio, muted, paused, onMutedChange, onPausedChange`: src/components/ProjectCardShot.tsx:84-100. ProjectsPage keeps `{muted:true, paused:false}` in page state (src/pages/ProjectsPage.tsx:143), passes card.videoHasAudio; it survives card changes.
- `.pr-shot-ctl` with type=button Pause/Play buttons, Mute only under `hasAudio` (:171-179), aria-hidden SVG icons, no `controls` attribute.
- Handlers act on the element then report; effect applies props; play() rejection while unmuted mutes, retries once, reports muted (:106-117); labels follow play/pause/volumechange events.
- Reduced motion/Save-Data: image mode renders poster img + 'Play video'; no `<video>` or video URL in markup (:181-190); `playRequested` resets per video (:104).
- CSS: projects-ring.css:56-65 (absolute 12px/12px, gap 8, 36px round, rgba(0,0,0,.6), focus-visible outline).
- tests/project-card-shot.test.ts passes.

## card-video-controls-docs — VERIFIED
- docs/host-contract.md "Card video": no "no sound/always muted"; says starts muted because of autoplay block, Pause/Play always shown, Unmute only with an audio track detected at build time; choices carry to next card; reduced-motion/Save-Data poster shows Play, no bytes until pressed; recipe step 1 uses AAC/Opus, no `-an`, 8 MB covers video plus audio; "Implemented in" names shared/video-audio.ts, `AssetVersions.audio`, `assetHasAudio`. Named files exist at HEAD.

## Cross-diff checks
- Starts muted, no sound autoplay: state `muted: true`; effect sets `el.muted = muted` before play; unmuted refusal falls back to muted. OK.
- Mute button only when hasAudio: ProjectCardShot.tsx:174. OK.
- No video URL in reduced-motion markup: confirmed above. OK.
- hasAudioTrack bounded, no throw: see above. OK.
- cardVersion/fileVersion/og:image hash: only a `sha1Hex8` refactor; same output. standalone-projects.json change adds only `listing.video` (from e82b204a), shareImage unchanged. OK.
- CSP: server/security-headers.ts has no commits in the range. OK.

## Findings
### Critical
- none
### Important
- none
### Minor
- e82b204a (EV publish: index.pck, 7 MB tile.mp4, manifest) sits in the range but belongs to no PRD here; not reviewed beyond the registry diff.
- No DOM test covers the click/effect paths (play() rejection retry, volumechange labels); only markup and pure functions are tested (ProjectCardShot.tsx:100-140).
- ProjectCardShot.tsx:119 effect: `autoPlay={!paused}` plus effect `playEl` can call play() twice on mount; harmless.
