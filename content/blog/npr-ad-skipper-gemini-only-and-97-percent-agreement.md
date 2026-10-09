---
slug: "npr-ad-skipper-gemini-only-and-97-percent-agreement"
title: "The NPR Ad Skipper: Going Gemini-Only and Getting 97.5% Agreement with Claude"
excerpt: "We ripped out 2,000 lines of OpenAI and Whisper code, moved the entire ad-detection pipeline onto Gemini, then ran it head-to-head against Claude Opus on a 15-episode corpus. 58 of 60 ad blocks matched. Here is why that matters."
category: "build-log"
published: true
published_at: "2026-04-20T07:27:07.970Z"
order: 7
---

## The tool

[npr-podcast](https://github.com/StanislavBG) is an ad-free podcast player for NPR shows — The Indicator, Planet Money, Hidden Brain, Short Wave, Up First. It fetches the RSS feed, transcribes the audio, detects ad breaks, and auto-skips them during playback. Front-end is React; workflow is orchestrated through [bilko-flow](/projects) (our open-source pipeline library, more on that shortly); audio processing hits Gemini.

This week the tool went through four real changes: a big architectural simplification, a bug that was freezing the UI on mobile, a full classifier evaluation, and a mobile-UX polish pass. Eleven commits in a single day on April 19.

## 1. Ripping out OpenAI and Whisper (commit `c1245f2`)

The pipeline used to have two speech-to-text paths (OpenAI Whisper + Gemini) and **18 regex heuristics** for ad-boundary detection (`AD_PATTERNS`, `CONTINUE_BREAK_RE`, `extendEndBoundaries`, and friends). It was a mess of fallbacks: if Whisper fails, use Gemini; if the LLM boundary looks off, run the regex extender.

We deleted all of it. 2,000+ lines gone. The pipeline is now:

- **Speech-to-text**: `gemini-2.0-flash` (fast, cheap, good enough)
- **Ad classification**: `gemini-2.5-pro` (slower, smarter, $-per-episode tolerable)
- **Boundary refinement**: the same classification call, no post-hoc regex

The regex heuristics existed because our first classifier was bad at production credits. "This episode was produced by..." would end the transcript without flagging the sponsors that followed. Upgrading the prompt to explicitly mark credits as the *opening* of a post-roll break — plus moving classification to `gemini-2.5-pro` — killed the need for the regex extender entirely.

When `GEMINI_API_KEY` isn't set, the pipeline now emits **zero ad blocks with a diagnostic message**. Previously it would silently fall back to regex-only detection and miss 30% of ads. Silent failure is worse than loud failure.

## 2. The eval harness and 97.5% agreement (commits `ff85712`, `8e42b6e`, `f31ba0a`, `351794d`)

Here's the question anyone building an LLM pipeline should ask but usually doesn't: **"How do I know this is actually working?"**

We built an eval harness in `scripts/eval-classifier.ts` that runs two models — Gemini 2.5 Pro and Claude Opus 4.7 — over the same 15-episode fixture corpus and compares block-level agreement. The corpus spans all five podcasts, episodes ranging from 15 to 7,178 words of transcript, with 2–9 ad breaks each.

Results: **58 of 60 ad blocks matched. Two false negatives. One false positive. 97.5% F1.**

The two disagreements are policy questions, not capability gaps. The models disagreed on whether NPR live-tour promos count as ads — which is an editorial call, not a correctness question. On the 58 they both agreed on, the block boundaries match to within a few words.

That number is load-bearing for the whole architecture: if the cheaper, faster model disagreed with the frontier model on actual ad detection, we'd have to pay for the frontier model at inference time. 97.5% agreement means we can run Gemini in production and trust Claude as an oracle for regression testing.

The 15 fixtures — 42 to 334 events per episode, ~730 KB total — now live in `tests/fixtures/runs/`. Replay tests (`tests/fixtures-replay.spec.ts`) run the reducer against captured SSE event streams without any LLM calls. CI runs these offline. Fast, deterministic, free.

## 3. The chunking-stuck bug (commit `ffc84dc`)

User report: "UI freezes when playing online, chunks don't process properly."

Three bugs, all of them mine, stacked on top of each other:

**(a) SSE reconnect was a TODO comment.** On any network blip — mobile sleep/wake, proxy timeout, aggressive CGNAT — the UI froze while the server kept working. Fix: exponential backoff from 1s to 30s, snapshot re-fetch, resubscribe with the correct `lastEventId` so we don't replay events we've already applied.

**(b) Reducer monotonicity.** The `step_emit_skips` event handler could *shrink* `totalChunks` because it took the `min` of the existing max and the event's value. If events arrived out of order (which they do under reconnect), the total would visibly tick downward. Fix: `Math.max`, not `Math.min`.

**(c) RunPanel progress > 100%.** Displayed raw completion count without clamping. Under out-of-order events, the bar would show 103% and looked broken. Fix: clamp to `[0, total]`.

Added 7 unit tests in `tests/run-store.spec.ts` covering idempotent replay, out-of-order completion, and monotonic chunk counts. Also fixed `parseDuration()` to accept numeric durations: Planet Money's feed sends numbers, Hidden Brain sends strings. One more case where "the real world is more annoying than the test fixtures" bit us.

## 4. Mobile UX and a11y polish (commit `3da5812`)

Nine small changes, each worth about 2% on its own, collectively noticeable:

- Tap targets on play/skip bumped to **≥44px** (Apple HIG minimum).
- `focus-visible` rings on every interactive control.
- Semantic roles: `role=switch` on the auto-skip toggle, `aria-label` on player buttons, `aria-expanded` / `aria-controls` on RunPanel.
- Episode tile labels bumped from 10–11px to 12px.
- WebKit scrollbars styled to match Firefox's `scrollbar-width: thin` on sandbox detail panes.

Accessibility work usually doesn't make it into build logs because it's not glamorous. It matters: screen readers now name the player controls correctly, and the tool stops failing `axe-core` audits.

## 5. bilko-flow moves to npm (commits `72a37ad`, `40bf848`)

The pipeline library — [bilko-flow](/projects) — used to ship via a Git URL in `package.json`. Deploys were brittle: Replit couldn't always reach the private repo, and `npm install` was slow because it cloned the whole history.

We moved bilko-flow to the public npm registry. Two commits, because v0.3.0's published tarball didn't include `src/` (npr-podcast imports some paths directly from source), so we bumped to v0.3.1 and added `src` to the `files` whitelist. Fixed in one line.

The broader story of that npm publish is [its own post](/blog/bilko-flow-v0-3-1-first-npm-release).

## What I'd do differently

I'd have written the eval harness before removing Whisper, not after. We ran the removal on faith and got lucky that 97.5% agreement held. If the eval had come back at 82%, we'd have reverted — but we wouldn't have known until a week of user reports came in.

I'd also have built the fixture corpus from day one. 15 captured pipeline runs turn "does this change break anything" from a 20-minute manual test into a 9-second replay. Every LLM pipeline should ship with recorded fixtures before it ships anything else.

## What's next

Ad classification accuracy is high enough that we're moving to the playback layer: smoother skips, no audible glitch at boundaries, and optional "skip with a beep" for users who want to know an ad was there. Also investigating whether we can precompute ad blocks on the server when the episode first drops, so new listeners get zero-latency skips.

## FAQ

**Why Gemini and not Claude in production?**
Cost and speed. `gemini-2.0-flash` is ~10× cheaper than Opus and ~3× faster for STT. The 97.5% agreement says we don't pay for the difference.

**Does this work on podcasts that aren't NPR?**
The RSS fetcher is NPR-flavored (handles their specific feed quirks). The classification pipeline would work on any podcast — NPR just has consistent ad structure so it's a good starting point.

**Will this be a bilko.run tool?**
Probably not — it's not really monetizable as a one-shot AI analysis. But the eval harness pattern and the bilko-flow-based pipeline are both going to show up in other bilko.run tools.