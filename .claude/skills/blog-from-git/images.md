# Sub-skill: images (phase 5d) — 2-3 real screenshots as captioned figures

The post page renders `![alt](src "caption")` blocks as captioned figures (`parseFigure` in
`src/lib/blogMarkdown.ts`). Use them to show the reader the real product, not to decorate.

## 1. When and how many

Run after Compose (5c), before Approve (6). Choose figures from the `figure` field of the `outline.json` sections (`dag.md`), so each figure illustrates a specific section. Add 2-3 figures; never more than 4. A post with nothing
worth showing gets none — don't pad.

## 2. Real screenshots only

Capture live pages on `https://bilko.run` or `https://github.com`. Never mockups, generated art,
stock images, or edited screenshots. Pick the moments the draft sentences describe: the tile, the
result screen, the repo page.

## 3. Capture

1. `<tmp>=$(mktemp -d)`. Write `<tmp>/shots.json`: an array of
   `{ name, url, scrollY?, waitMs?, actions? }`. Stills only: do NOT use `record` (that is for
   video clips; see `blog-video/SKILL.md` section 3). Max 6 shots, `name` in kebab-case.
2. Run `pnpm tsx scripts/blog-video-capture.ts --shots <tmp>/shots.json --out <tmp>/shots --max-bytes 220000`.
   It writes 1280x720 JPEGs, each capped by `--max-bytes`.
3. Copy each keeper to `public/blog-images/<slug>/<kebab-name>.jpg`. The path must match
   `FIGURE_SRC_RE` in `src/lib/blogMarkdown.ts`: lowercase letters, digits and `-` in the slug
   folder. Each file is at most 220 KB. Never commit `<tmp>`.

## 4. Visual check (mandatory)

Open every JPEG with the Read tool. Reject and recapture any frame that is blank, still loading,
shows a cookie banner or sign-in wall, or crops the headline. Adjust `scrollY`, `waitMs` or
`actions`, then retake. At most 2 recapture rounds; if a shot still fails, drop that figure.

## 5. Place the figure

Exact syntax, as its own paragraph (blank line above and below), right after the sentence it
illustrates:

`![alt](/blog-images/<slug>/<file>.jpg "caption")`

- `alt` describes what the image shows, for someone who can't see it.
- `caption` is at most 20 plain words telling the reader what to notice. No marketing words.
- Don't put a figure first in the post or two figures back to back.

## 6. Posts already live

New posts ship with the images in the seed commit. For an already-live post, editing
`content/blog/<slug>.md` alone changes nothing. Add a `server/blog-rewrites/<slug>.ts` entry whose
content matches `content/blog/<slug>.md`. See `seed.md` Gotchas.

**Exit:** 2-3 figures placed; every JPEG viewed and at most 220 KB; every `src` matches
`/blog-images/<slug>/`; captions at most 20 words; `npx tsx scripts/blog-readability.ts <draft>`
still exits 0.
