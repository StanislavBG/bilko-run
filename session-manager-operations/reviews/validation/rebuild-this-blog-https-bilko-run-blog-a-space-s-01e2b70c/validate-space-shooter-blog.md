# Validation: Escape Velocity blog rebuild (PRDs 1228, 1229, 1230)

Base: 37ffe61. Validated 2026-10-10 (PDT). PRD files read from the main checkout `prds-archived/`.
Scripts were run from the main checkout (`/home/bilko/Projects/Bilko`) because the job worktree has no `node_modules`; main HEAD (7fb5b1f) holds identical post/images/video to the worktree.

## 1228 rewrite-space-shooter-post — VERIFIED (with an important caveat, see Findings #1)

- DAG artifacts: `questions.json`, `evidence.json`, `outline.json`, `renditions/linkedin.md`, `renditions/x.md` all exist in the main-checkout drafts folder; not tracked by git (`git status` clean of them).
- Pipeline check: `npx tsx scripts/blog-pipeline-check.ts <drafts> content/blog/<slug>.md` → `pass: true`, 5 questions, 14 evidence items, 3 sections, post 436 words (budget 424–636), LinkedIn 186 words, X 272 chars. Exit 0.
- Readability `--check-live`: FK grade 5.2, no long sentences, no jargon/marketing/link issues, pass. Exit 0.
- `vitest run tests/blog-rewrites.test.ts tests/blog-posts-loader.test.ts tests/blog-markdown.test.ts`: 3 files, 17 tests pass.
- Frontmatter: slug, `published_at` 2026-09-26T19:00:00.000Z, order 41, category product, published true unchanged. Title "Eight Planets, One Browser Tab, Zero Downloads" is 46 chars (under 60). It is curiosity-driven and true.
- Opening sentence names the playable thing plus the 43.4 → 14.6 MB number. One primary link, full URL `https://bilko.run/projects/escape-velocity/` (written as `bilko.run/projects/escape-velocity` link text with the full https href). No repo or open-source claim.
- Figures: 3 JPEGs, all 1280x720 (`file`), 40–55 KB (each < 220 KB). Each viewed with Read: `mercury-briefing.jpg` (build picker, crisp), `sol-system-map.jpg` (Sol map, Mercury parked, legible), `mercury-arena.jpg` (mid-gameplay: ship, enemies, HUD at 2:43, Kills 3). No blank/loading/cropped frames. Each referenced exactly once as its own paragraph with a caption.

## 1229 ship-space-shooter-rewrite — REFUTED — figures not live (3 images 404 as SPA HTML)

- `server/blog-rewrites/<slug>.ts` exports `rewrite` with the required slug and migrationId `2026-10-10-rewrite-…-v2`.
- Title, excerpt and content are byte-identical to the md (script check against the live API: `titleMatch true | excerptMatch true | bodyMatch true`, 3341 = 3341 chars).
- `tests/blog-rewrites.test.ts` and `blog-posts-loader` pass (above). `server/blog-rewrites/index.ts` unchanged. (Typecheck not re-run: the worktree has no node_modules; PRD 1229's own gate, not 1228's.)
- Live API `https://bilko.run/api/blog/<slug>` returns the NEW title "Eight Planets, One Browser Tab, Zero Downloads". `video_url` is set to `/blog-videos/<slug>/`.
- FAIL: each `https://bilko.run/blog-images/<slug>/{mercury-briefing,sol-system-map,mercury-arena}.jpg` returns HTTP 200 but `content-type: text/html`, 2767 bytes (the SPA fallback shell), not `image/jpeg`. Control: other posts' images (`turn-your-github-year…/headline-and-badges.jpg`, `localscore…/github-repo.jpg`) return `image/jpeg`. The images are not deployed.
- Root cause: `git ls-tree -r origin/main` has no `public/blog-images/<slug>/` files. Commit a5849c0 (the post rewrite + 3 images) is not an ancestor of origin/main (`merge-base --is-ancestor` exit 1). Local `main` is 8 commits ahead of `origin/main`, including a5849c0, 385a43c, d5e8bc1 (the same v2 rewrite as pushed 5c2007b), and the coffee commits. Only the rewrite entry (5c2007b) and the video (b582539) reached origin; the commit that carries the images was never pushed.
- PRD AC says: if images are not 200 image/jpeg, report "pushed, deploy not yet live". The executor's run completed; I cannot see its report. The state on the wire is a live post with three broken figure images.
- Also: `content/blog/<slug>.md` on origin/main is still the OLD post (last touched by c43e965). The DB text is new, but the repo seed file on origin is stale; a fresh DB seeded from the repo would show the old text until the rewrite entry runs.

## 1230 video-space-shooter — VERIFIED (with Minor quality notes)

- `public/blog-videos/<slug>/index.html` exists (1,063,606 bytes), single commit f881743 touching only that path.
- Validate: `npx tsx scripts/blog-video.ts validate <index.html> --post content/blog/<slug>.md` → `OK`, exit 0.
- Contains `data:video/mp4` ×2 (two real motion clips), `data:audio/mpeg` ×1 (narration present), `data:image/jpeg` ×3.
- Contact sheet (`scripts/blog-video-frames.ts`, 25 frames, viewed): hook title card 0–3 s; "The first browser build weighed 43.4 MB" statement; Sol map with callout "Map 1 of 9 bodies" and caption "Eight real planets are eight maps"; gameplay clip with Mercury timer counting 2:54 → 2:53 → 2:52 and callout "Beat the 3:00 timer"; later clip with Kills 0 → 1 and callout "Kills count up" on the HUD kills box; art-pack statement "The art pack shrank to 14.6 MB"; closing card with `bilko.run/projects/escape-velocity/` on one line, once. Callout focus rects sit on the named thing (Sol header, timer, kills box).
- Real gameplay motion: confirmed by changing timer and kill counter and enemy rings appearing, but the arena is dark and sparse. Frames at 18.25 s and 21 s show little (ship + faint rings); no boss or dense swarm.
- Live: `https://bilko.run/blog-videos/<slug>/` → 200 `text/html`, 1,063,606 bytes, sha256 identical to the local file (`60bba5aabfedcdf13ba9…`), contains `data:video/mp4`.
- Storyboard JSON itself not retained (temp dir); scene sources checked only through the validator's `--post` grounding pass.

## Findings

### Critical
1. **Live post figures are broken.** The three `/blog-images/<slug>/*.jpg` URLs serve the SPA HTML shell, not JPEGs, because commit a5849c0 (images + md) and the other 7 local-main commits were never pushed to `origin/main`. Fix: push local main to `origin` (`StanislavBG/bilko-run`) after confirming nothing else on it is unready; then re-run `curl -sI` on the three image URLs. `public/blog-images/a-space-shooter-shrank-66-percent-to-fit-in-your-browser/*.jpg`.

### Important
2. `content/blog/a-space-shooter-shrank-66-percent-to-fit-in-your-browser.md` on origin/main is the old text while `server/blog-rewrites/…ts` and the live DB carry the rewrite — they resolve with finding 1's push.
3. Executor final reports (tone, number sources, steps that were unclear) are not stored in `history.jsonl` or the PRD files, so I could not collect them (see Skill test findings).

### Minor
4. Video gameplay clips are dark and low-density; the strongest moment (a boss, a swarm) is not shown. `public/blog-videos/<slug>/index.html` (frames 15–24 s).
5. Frame 12.25 s shows overlapped caption text during a scene crossfade (cosmetic transition artifact).
6. Scenes 0–3 s and 25–28 s are text-only cards over a dark background; the two statement scenes carry no visual.
7. The job worktree lacks `node_modules`, so every `npx tsx` gate fails there with `ERR_MODULE_NOT_FOUND: js-yaml`; PRD gates for validators must run from the main checkout.

## Skill test findings

I could not read the executors' final reports (not persisted in the PRD files or `history.jsonl`; exit 0 and `completed` status only). What is observable from the artifacts:
- **blog-from-git DAG (1228):** worked end to end — pipeline check passes with real artifacts. `communityKept: 0`, so the optional Burrow-brain community evidence was skipped or yielded nothing; the executor was expected to say which.
- **Illustrate (1228):** gameplay shot captured (mercury-arena), so the keyboard-focus recipe worked at least once; the arena frame is clean.
- **Ship step (1229):** the "bounded live check" is the step that failed silently. The PRD told the executor to verify each image URL returns 200 `image/jpeg`; fetched by status code only, a 200 `text/html` SPA fallback looks like success. The skill/PRD should say to check `content-type` and size, not status alone. Also "git pull --rebase origin main && git push origin main" pushed 5c2007b without a5849c0 (the 1228 commit was not on the rebased branch), so a dependency PRD's commit can be left behind.
- **blog-video (1230):** the skill worked — validate OK, frames reviewed, live file byte-identical. Unclear: the skill has no gameplay-density check, so dark/empty record clips pass the rubric.
- Executor-reported unclear steps: none recoverable. Request the executors' reports from the architect if needed.

## Shareability

- **Hook:** strong. "You can fly a full space-survivors run across our solar system in a browser tab right now" followed by the 43.4 → 14.6 MB number is playable-first and specific. The first paragraph ends with a clear action ("Click to play… Nothing to install").
- **Title:** "Eight Planets, One Browser Tab, Zero Downloads" is clean and true, but it is a slogan more than a curiosity gap; it drops the 66% shrink that was the original hook number. The excerpt carries the number. A title naming a surprising detail (e.g. Pluto wizard duel, or the soccer-ball launcher) might travel better in a feed.
- **Body:** short sections, 436 words, grade-5 readability, ends with an exact thing to try (Mercury, Baller-Launcher, beat the Lava Ape). The size section is the weakest for a general audience; the Pluto wizard duel and soccer-ball weapon are the "huh, cool" facts.
- **Renditions:** X (272 chars) and LinkedIn (186 words) both lead with the playable thing, include the full https link and a try-this-first call to action; neither was posted (as specified). X reads as a feature list; LinkedIn is clear and human.
- **Verdict:** share-worthy copy, but today a reader hitting the post sees three broken images. Until finding 1 is fixed the post cannot be shared with confidence. The video is a real, narrated, grounded asset but visually dark; fine as a supporting asset.
