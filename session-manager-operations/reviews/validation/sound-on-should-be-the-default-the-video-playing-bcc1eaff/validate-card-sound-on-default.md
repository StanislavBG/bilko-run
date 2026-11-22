# Validation: card sound on by default

Base: f4845b74. Commits: 9a0c8107 (primitives), 569681a0 (wiring). Diff: ProjectCardShot.tsx, ProjectsPage.tsx, tests/project-card-shot.test.ts. PRD files read from prds-archived/ (1882, 1883).

## card-sound-primitives — VERIFIED
- Exports CardPlayback, SoundMedia, PlayOutcome, playWithSound: ProjectCardShot.tsx:113-170; `VideoIsSoundMedia` (line ~122) makes typecheck prove HTMLVideoElement fits SoundMedia; typecheck exit 0.
- playWithSound sets muted and calls play() before any await (ProjectCardShot.tsx:~145-150); NotAllowedError unmuted -> mute + one retry -> 'held'/'blocked'; muted NotAllowedError -> 'blocked'; other -> 'interrupted'; never rejects (play() throw is caught).
- SOUND_GESTURE_EVENTS, CardSound, createCardSound exported (~:173-245).
- apply/gen/held semantics: ~:210-228 (paused path pauses and clears held; stale outcomes dropped by gen; onHeldChange only on flip in setHeld).
- Listeners: capture+passive added per event while held, removed with { capture: true } on release and dispose; onGesture checks ignore, isActive, then apply synchronously; defaultIsActive matches spec (~:182-186).
- Tests: describe 'playWithSound' (tests:199) and 'createCardSound' (tests:249) present.
- Gate: `pnpm vitest run tests/project-card-shot.test.ts` green (33 tests); `pnpm typecheck` exit 0.

## card-sound-on-by-default — VERIFIED
- DEFAULT_CARD_PLAYBACK = { muted: false, paused: false } exported; ProjectsPage.tsx:143 `useState<CardPlayback>(DEFAULT_CARD_PLAYBACK)`; comment says sound on by default, choices carry across cards.
- playEl and onMutedRef gone (grep shows none). soundRef/getSound with `gestureTarget: document` and `ignore: t => t instanceof Node && !!ctlRef.current?.contains(t)`; ctlRef is on the video-mode `.pr-shot-ctl` only; getSound is called only in effects and handlers; dispose effect keyed [mode, video] declared before the play/pause effect.
- Play/pause effect calls apply(el,{muted,paused}) then setElMuted/setElPaused.
- `grep -n onMutedChange ProjectCardShot.tsx`: lines 276 (props), 287 (type), 360 (inside toggleMuted) — the only call is in toggleMuted. Gesture listener ignores events whose target is inside the controls div.
- toggleMuted: next=!el.muted, apply before onMutedChange. togglePaused: next=!el.paused, apply with the muted prop, before onPausedChange.
- Docblock updated (lines 3-13).
- Test at tests:31-34 asserts DEFAULT_CARD_PLAYBACK and Mute video label; all 33 tests pass.
- Gate: vitest (card-shot + open-core-positioning) 54 passed; typecheck exit 0; `pnpm build` completed.

## Findings
### Critical
- none
### Important
- none
### Minor
- ProjectCardShot.tsx: `VideoIsSoundMedia` is an extra exported type-only helper not in the PRD; harmless.
- Behaviour in real browsers (autoplay refusal, first-gesture unmute) is covered by fake-media unit tests only; no browser run was done.
- /code-review and /security-review were not run as separate tools; self-review found no unsafe input, secrets, path handling or duplicated helper.
