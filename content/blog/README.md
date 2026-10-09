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
