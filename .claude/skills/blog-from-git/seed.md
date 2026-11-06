# Sub-skill: seed (Part 3) — publishing

Publishing is `scripts/blog-seed.sh`, run under its lock and built on `origin/main` in a throwaway
worktree (see `docs/repo-writers.md`). It runs the readability check and the cadence gate, then
commits the post, images and ledger row and pushes. Do not hand-commit on local `main`; do not
duplicate its steps here. The gate before seeding is `blog.config.yaml`'s
`autonomy.autonomous_publish` plus the SKILL.md quality self-check.

Post format and frontmatter: `content/blog/README.md`.

## Link correctness (match host kind in `src/data/standalone-projects.json`)

```bash
python3 -c "import json;[print(p['slug'],p['host']['kind'],p['host'].get('url','')) for p in json.load(open('src/data/standalone-projects.json'))]"
```
- `static-path` → `/projects/<slug>/` (TRAILING slash — social-signals-trader, outdoor-hours, academy)
- `external-url` → link the external/GitHub URL directly, NOT `/projects/<slug>`
- no tile (burrow, edgar-rag) → link GitHub · other posts → `/blog/<slug>`

## Gotchas

- **New posts DO reach production; edits DON'T.** The loader inserts any slug it has not seen on
  every boot, so a NEW `content/blog/<slug>.md` goes live on the next Render deploy automatically.
  But a post already in the database is never overwritten by editing its file — changing a live
  post needs a rewrite under `server/blog-rewrites/` (or the admin blog API,
  `server/routes/blog.ts`). After pushing, verify the live site picked the new slugs up once Render
  finishes deploying.
- **Local-only repos are invisible to GitHub.** Always run the reconciliation pass (`scan.md` §5).
- Don't trust commit counts as effort; filter cron noise first.
- Stay in the Bilko lane operationally (memory `feedback_stay_in_bilko_lane`): *report* cross-repo
  findings (for a blog that's the point), but don't edit sibling repos.
