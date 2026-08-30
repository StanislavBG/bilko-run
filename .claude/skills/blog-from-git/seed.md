# Sub-skill: seed (Part 3) — seed, verify, push, record

**Outward-facing content: draft first, seed only on approval.** A blog post is published content.
Show the user the full draft(s) and wait for an OK before editing `server/db.ts` / pushing — don't
auto-publish. This gate applies before ANYTHING below runs.

## Seeding mechanics

Seeds are `INSERT OR IGNORE INTO blog_posts (...)` in `server/db.ts` initDb(). Add a new
`await dbRun(...)` after the latest. Fields: slug, title (backtick literal), excerpt (single-quote
— escape apostrophes), content (backtick literal — **escape every backtick** `` \` `` and avoid
`${`), category, `1`, published_at (explicit recent ISO string — **never `new Date()`**; stagger
several so they order right). Categories: `build-log | lessons | deep-dive | market | product`.

```bash
cd ~/Projects/Bilko
npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i db.ts    # must be clean
pnpm test tests/db.test.ts
git add server/db.ts && git commit
git push origin main                                       # origin only — memory feedback_always_push
```
Push to `origin` (`StanislavBG/bilko-run`) `main` **only** — never the `content-grade` remote
(CLAUDE.md).

## Update the ledger — SAME commit, not optional

Add a row to `blog-ledger.md` (newest at top: date · slug · project · on-`/projects`? · tone) and
rewrite its "Current rotation state" block (last project covered, what rotation debt is now owed,
refreshed cooling-off and due lists). A post that isn't recorded in the ledger will get the
rotation guard wrong next time. In catch-up mode, also move the seeded row out of the "Planned
backfill queue" block.

## Series / multi-post seeding

Seed each post as its own `dbRun(...)` with staggered `published_at` so they order newest-first,
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

- **New seeds DO reach production; edits DON'T.** Verified 2026-07-24: only the very first seed
  is gated behind a `COUNT(*) == 0` check; every later seed is an unconditional `INSERT OR IGNORE`
  run on every boot, so a NEW slug goes live on the next Render deploy automatically. But because
  of the IGNORE, **editing an already-deployed post's seed changes nothing in production** — that
  needs the admin blog API (`server/routes/blog.ts`). After pushing, verify the live site picked
  the new slugs up once Render finishes deploying.
- **Local-only repos are invisible to GitHub.** Always run the reconciliation pass (`scan.md` §5).
- Don't trust commit counts as effort; filter cron noise first.
- Stay in the Bilko lane operationally (memory `feedback_stay_in_bilko_lane`): *report* cross-repo
  findings (for a blog that's the point), but don't edit sibling repos.
