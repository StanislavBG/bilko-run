# Sub-skill: seed (Part 3) — seed, verify, push, record

**Bilko is an autonomous agent, not a human-supervised publishing workflow.** The gate before
seeding is `blog.config.yaml`'s `autonomy.autonomous_publish` (the owner's master kill switch) plus
the phase-4/5 quality self-check (SKILL.md) having passed — not an interactive human OK. When
`autonomous_publish` is `true`, proceed straight to seeding once that self-check is clean. When it
is `false`, this reverts to the old gate verbatim: show the full draft(s) and wait for an explicit
human OK before writing the post file / pushing. This gate applies before ANYTHING below runs.

## Seeding mechanics

Posts are markdown files, one per post, in `content/blog/<slug>.md` (read `content/blog/README.md`
first). The server loads them at boot (`server/blog-posts.ts`) and inserts any slug it has not seen.
Create `content/blog/<slug>.md` with this frontmatter, then the body in markdown below it:
`slug` (lowercase-dashes, unique), `title`, `excerpt`, `category`, `published` (`true`),
`published_at` (explicit recent ISO string — **never `new Date()`**; stagger several so they order
right), `order` (higher than every other post). Categories:
`build-log | lessons | deep-dive | market | product`. No backtick or `${` escaping is needed — it is
plain markdown.

**`published_at` rule (`blog.config.yaml` `cadence.current_post_published_at: authored_at`):**
portfolio, focused, and spotlight posts are dated to `max(now, output of
pnpm tsx scripts/blog-cadence-gate.ts next-slot)` — normally that's just "now" (the time of the
seed commit, not the ship date of the work they describe), but `next-slot` is the code-enforced
floor: if the last seeded post is less than `cadence.min_gap_days` (3) away, `next-slot` returns a
future ISO timestamp and that's what you seed, not "now". This is a HARD rule — see `rotation.md`'s
top section for what does and doesn't override it. Honest backdating (`cadence.backdating:
honest-only`) only applies to catch-up mode's backfill posts, where `published_at` must match when
the work actually shipped (`rotation.md` Part 0.5). The "never `new Date()`" rule above still holds
for every mode — always an explicit ISO string, just one you compute from `max(now, next-slot)` for
portfolio/focused/spotlight, and from the slot date for catch-up.

A post seeded with a future `published_at` is **hidden from `/api/blog`** until that timestamp
arrives (`datetime(published_at) <= datetime('now')` filter) — this is expected, not a bug. When
verifying a scheduled post went live, wait for (or skip the check until) its `published_at` time
has passed; don't treat "not showing up yet" as a failure before then.

```bash
cd ~/Projects/Bilko
pnpm vitest run tests/blog-posts-loader.test.ts tests/db.test.ts   # must pass
timeout 180 pnpm tsx scripts/blog-cadence-gate.ts check   # hard gap gate — must exit 0
# if this fails: STOP — no commit, no push. Print SEED_RESULT: noop note="cadence gate check failed"
npx tsx scripts/blog-readability.ts <draft.md> --check-live  # every https link must actually load
# if this fails: STOP — no commit, no push. A failing link is how the post converts readers
# into visitors of the project landing page, so a dead link means the post can't do its job.
git add content/blog/<slug>.md .claude/skills/blog-from-git/blog-ledger.md && git commit
git push origin main                                       # origin only — memory feedback_always_push
```
Push to `origin` (`StanislavBG/bilko-run`) `main` **only** — never the `content-grade` remote
(CLAUDE.md).

## Update the ledger — SAME commit, not optional

Add a row to `blog-ledger.md` (newest at top: date · slug · project · on-`/projects`? · tone) and
rewrite its "Current rotation state" block (last project covered, what rotation debt is now owed,
refreshed cooling-off and due lists). A post that isn't recorded in the ledger will get the
rotation guard wrong next time. In catch-up mode, also move the seeded row out of the "Planned
backfill queue" block. A spotlight post (`rotation.md` Part 0.25) still gets a ledger row like
any other — add a `spotlight` mode note next to its tone so the next rotation pass knows it was
picked by ledger coverage age, not by new git work.

## Series / multi-post seeding

Write each post as its own `content/blog/<slug>.md` with staggered `published_at` so they order newest-first,
and category `build-log` (or `deep-dive` for the meaty one). Cross-link them in the body
(`/blog/<other-slug>`) so a series reads as one ongoing thread. Burrow has no project tile —
link the GitHub repo for "the code", not a `/projects/` path.

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
