---
title: First Blog Video: 30-second video for the newest post, published live
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 15
createdVia: scheduler-api
issuedAt: 2026-10-09T21:34:01.953Z
sourcePromptId: blog-shold-include-images-annotated-or-even-shor-18d2b557
agentType: dev-lead
dependsOn: [blog-video-discovery-api, blog-video-csp-fence, blog-video-cli, blog-video-player, blog-markdown-links-figures, blog-video-skill]
planId: pl-mv1hdjm5-02147b
---
# Goal

Behavior: produce and publish the first blog video by following the new project skill end-to-end on the newest published post, `twelve-places-one-weather-rule-you-set-yourself` ("Twelve Places, One Weather Rule You Set Yourself", OutdoorHours). This is the first iteration of the Blog Video macro, so it also proves the skill works headless.

# Acceptance criteria

- [ ] Followed .claude/skills/blog-video/SKILL.md; `pnpm tsx scripts/blog-video.ts next` printed slug `twelve-places-one-weather-rule-you-set-yourself` (if it printed a different slug, use the twelve-places slug anyway and note the discrepancy in the report).
- [ ] public/blog-videos/twelve-places-one-weather-rule-you-set-yourself/index.html exists, passes `pnpm tsx scripts/blog-video.ts validate`, declares sm-demo-duration 30, exposes window.smDemo, and every caption traces to a sentence in that post's seed in server/db.ts (claims list in the report).
- [ ] Narration is embedded as a base64 MP3 generated with Kokoro (af_heart, or af_bella if af_heart fails) per ~/.claude/agents/demo-video-builder.md audio_policy; if TTS is genuinely unavailable, the video ships silent and the report says why.
- [ ] The commit adding only that file is pushed to origin main (`git pull --rebase origin main && git push origin main`, never content-grade), which also ships the already-landed player/API/CSP commits.
- [ ] Bounded live check (at most 20 tries × 30 s): https://bilko.run/blog-videos/twelve-places-one-weather-rule-you-set-yourself/ returns 200 with a `sandbox allow-scripts` CSP header, and https://bilko.run/api/blog/twelve-places-one-weather-rule-you-set-yourself has video_url set; the result (live or not-yet-deployed with last status) is in the report.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- public/blog-videos/twelve-places-one-weather-rule-you-set-yourself/index.html

# Implementation notes

Read first: .claude/skills/blog-video/SKILL.md (all — it is the procedure; follow it); ~/.claude/agents/demo-video-builder.md (output_contract + audio_policy); server/db.ts — search for `twelve-places-one-weather-rule-you-set-yourself` to read the post body; src/components/BlogVideoPlayer.tsx (the frame the video plays in — 16:9, the video must not draw its own outer border).

Steps:
1. Run the skill's pick step, then the claims list + storyboard (exactly 30 s).
2. Generate narration under a temp dir (mktemp -d) — never commit audio sources or model files; Kokoro model files may already be cached from earlier demo-video runs (look under ~/.cache and ~ before downloading ~350 MB).
3. Build and validate the HTML (fix at most 3 rounds, else HALT exit 1).
4. Run the gate, commit only the html path, then push and do the bounded live check. Render deploys take several minutes; if not live after the cap, report the last HTTP status and still print the verdict honestly per the gate (the gate is the local validate).
Bounded loops only; no background processes.

Do not touch: any file other than public/blog-videos/twelve-places-one-weather-rule-you-set-yourself/index.html.

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 120 pnpm tsx scripts/blog-video.ts validate public/blog-videos/twelve-places-one-weather-rule-you-set-yourself/index.html
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
