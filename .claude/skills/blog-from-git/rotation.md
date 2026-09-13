# Sub-skill: rotation (Part 0) — what you're ALLOWED to write about

Read FIRST, before any scan or drafting. `blog-ledger.md` (this folder) is the memory of what's
been published and the source of truth for *what to cover next* — the git scan tells you what
*changed*, the ledger tells you what you're *allowed* to write about.

## Two hard rules

1. **3-post cooldown (blog.config.yaml `rotation.project_cooldown_posts: 3`).** A project covered
   in ANY of the last 3 ledger rows is INELIGIBLE as the next post's subject — not just the
   immediately previous post. "Never repeat the previous project" is the degenerate N=1 case of
   this same rule; the binding constraint is the 3-post window. Evaluate this against
   `blog-ledger.md`'s recorded per-post rows (the ledger IS the rotation memory), never against a
   heuristic reading of post titles. Rotate through the roster; prefer an on-`/projects` project
   that hasn't had a post recently (the ledger lists "due / under-covered" candidates). If a post
   is due but every candidate project is on cooldown, do not invent one to fill the slot — see
   `blog.config.yaml`'s truth rules.
2. **Never run two consecutive posts about a project with no `/projects` tile.** A project is
   "on `/projects`" iff its slug is in `src/data/standalone-projects.json`. Off-list projects
   (burrow, edgar-rag, and anything untiled) may be blogged, but **not back-to-back** — an on-list
   project must run between them. The blog exists to drive readers to the catalogue; a run of posts
   about things they can't click is a leak.

**Why:** three consecutive Burrow (off-list) posts once ran in a row — readers got three updates
about a thing with no tile to visit. That's the failure this sub-skill exists to prevent.

**Third rule — no user-facing surface, no solo post.** A project with no `/projects` tile and
nothing at all a reader could go try is INELIGIBLE as a post's sole subject (`blog.config.yaml`
`grounding.ineligible_subject`). If that's the only candidate left after the two rules above, pick
a different eligible project instead, or — with explicit user override — mention it as portfolio
context inside a wider post, never as a standalone post with an invented "how to use it."

## Procedure

- Read the ledger's "Current rotation state" block. If it says rotation debt is owed to an on-list
  project, the next post MUST satisfy it.
- If the user *names* a project that would violate a rule (e.g. "another Burrow post" right after
  two Burrow posts), say so plainly, propose the on-list project that's due instead, and let them
  override — don't silently break rotation.
- After seeding, **append a ledger row and update the rotation-state block** (see `seed.md`).

## Catch-up mode (Part 0.5) — gap > ~10 days since last post

When the blog has gone quiet for weeks, don't write one mega "everything since June" post — backfill
a **queue of normal-sized posts at the standing 3–5 day cadence**, each dated to when its work
actually happened. The blog should read as if it never stopped.

1. Run the full scan (`scan.md`) for the whole gap window. Cluster the work into per-project story
   units, each anchored to the dates the commits actually landed.
2. Lay out slots every 3–5 days from `last_post + ~4d` to today. Assign one story unit per slot,
   choosing the unit whose commit dates fall nearest the slot. **Rotation rules above apply across
   the whole backfilled sequence** — alternate projects, no two consecutive off-`/projects`
   posts — and vary tones per the experiment log (`voice.md`).
3. Record the planned queue in `blog-ledger.md` under a "Planned backfill queue" block BEFORE
   drafting, so a later session can resume the backfill mid-way.
4. Draft each post exactly as a normal post (scan already done — go straight to `ground.md` for its
   project). Get user approval on the drafts, then seed them in ONE `server/db.ts` commit with
   staggered backdated `published_at` values matching the slots.
5. **Backdating is honest here** because each post's `published_at` matches when the work shipped,
   not when the prose was written — the date claims "this is when this happened." Never backdate a
   post about work that didn't occur near its date.
6. Move each queue row into the main ledger table as it seeds; delete the queue block when empty.
