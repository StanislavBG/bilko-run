# Blog posts

Each post is one markdown file in this folder. The server reads them all at boot
(`server/blog-posts.ts`) and inserts any post it has not seen before.

To add a post:

1. Copy an existing file and rename it to `<slug>.md`.
2. Edit the frontmatter (the block between the two `---` lines):
   - `slug`: the URL part, lowercase words joined by dashes. Must be unique.
   - `title`, `excerpt`: shown on the blog index and the post page.
   - `category`: for example `product` or `build-log`.
   - `published`: `true` to show it, `false` to keep it hidden.
   - `published_at`: ISO date, such as `"2026-10-12T16:00:00.000Z"`.
   - `order`: a number higher than every other post, so it sorts last.
3. Write the post below the frontmatter, in markdown. Use full https links.

`published_at` must respect the blog cadence gate (`scripts/blog-cadence-gate.ts`):
posts need the minimum gap between them, so check it before picking a date.

A post that is already in the database is never overwritten by editing its file.
To change a live post, add a rewrite under `server/blog-rewrites/`.

## Categories

`build-log`, `lessons`, `deep-dive`, `market`, `product` (the list in `blog.config.yaml`).

## Blog videos

Blog videos are made in Burrow (`~/Projects/burrow`, macro and skill `marketing-video`), not here.
Burrow writes `public/blog-videos/<slug>/index.html` in this repo as one commit to that path. It
builds the commit on a fresh `origin/main` in a throwaway worktree, pushes `<sha>:main` under the
`scripts/blog-seed.sh` lock, then mirrors it onto local `main`.

- Each page is one self-contained file of at most 2 MiB.
- It defines `window.smDemo` and has a `sm-demo-duration` meta tag.
- The server scans `public/blog-videos/` at boot, so a new video shows on its post only after the
  Render deploy.

Bilko keeps the hosting (`server/blog-videos.ts`, `server/routes/blog.ts`, `BlogVideoPlayer`,
`BLOG_VIDEO_CSP` in `server/security-headers.ts`) and two scripts Burrow runs from this repo:
`scripts/blog-video-capture.ts` (`blog-from-git` uses it too) and `scripts/blog-video-frames.ts`.
Keep both, and keep their flags stable.

## Burrow's blog drafter and `BLOG_DRAFT_CONTEXT`

Burrow's blog drafter (`~/Projects/burrow/app/pipelines/blog_post/drafter.py`) runs
`scripts/blog-draft.sh` from the live checkout. It commits nothing here, but it is the only writer
of the JSON file that `BLOG_DRAFT_CONTEXT` names. Its keys (`schema_version` 1): `slot_at`, `rule`,
`public_projects` (the public set), `blog_posts` (queued or published posts, counted toward the
cooldown) and an optional `brief`. A brief makes the slot an owner-commissioned post:
`brief.project` must be one of `public_projects` (otherwise `scripts/blog-subjects.ts` exits 2), it
becomes the only candidate, and a post about any other project is refused. The draft prompt adds
one paragraph that follows `brief.angle`, `brief.sources` (the scan range, which may start before
the last post), `brief.facts` (verified before use), `brief.links` and `brief.avoid_claims`; without
a brief the prompt is unchanged. The cooldown and the cadence gate still apply.
`parseDraftContext` in `scripts/blog-subjects.ts` is the schema; tell Burrow (`/send-feedback`)
before changing it.
