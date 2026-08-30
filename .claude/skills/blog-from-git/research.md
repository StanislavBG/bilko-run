# Sub-skill: research — parallel evidence agents (between scan and draft)

The scan (`scan.md`) produces story units: "project X, date range, these commits." Before drafting,
each story unit needs deep evidence — actual diffs read, actual numbers pulled. Doing that inline
for several posts burns the composing session's context on raw diff dumps. Delegate it.

**Pattern (validated on the 2026-07-24 backfill, 6 agents / 7 posts):** spawn one read-only
research agent (Explore type) per story unit, all in a single parallel batch. Each agent gets the
repo, the window, the named commits, and this note template to fill:

1. **Before → after** — what the product could not do, and now can (user-visible, concrete).
2. **Countable specifics** — versions, PRD numbers, test counts, file names, line counts, DB
   counts — each with its source (commit sha, file path, query). Nothing uncounted.
3. **The hardest / most surprising engineering detail** — from commit bodies and diffs, not titles.
4. **Honest admissions** — what broke, what's still rough, what the commits confess. This section
   reliably yields the best material in the post.
5. **One sentence on what the project IS** (README) — for the reader who's never heard of it.
6. **Remote/push status** — is this work actually on GitHub? (See trap below.)

Tell each agent explicitly: return structured notes, do NOT write the blog post.

## Traps this pattern has already caught (keep checking for them)

- **Story units can be misdated.** One backfill slot's planned story ("scheduler fixes, late
  June") turned out to have happened on July 18 — the research agent caught it by reading commit
  dates. **Slot dates must follow verified commit dates, not the other way around**; move the slot
  rather than backdate a post about work that hadn't happened yet.
- **"Pushed recently" ≠ "work is on GitHub."** Repos can be dozens-to-hundreds of commits ahead of
  origin (2026-07-24: signal-builder +105, burrow +174, sigma-plus no remote). Every agent must
  report ahead/behind status; posts about unpushed work must not link commits or imply the code is
  public. Maintain the ledger's unpushed-repo watchlist from these reports.
- **Live numbers may belong to a newer regime than the backdated slot.** A KPI redefined after the
  slot date makes today's scorecard anachronistic for that post. Prefer period-correct numbers
  queried from operational DBs (run tables, logs) over today's live scorecard; if only the live
  number exists, date-stamp it in the post.
- **Epilogue knowledge stays out of backdated posts.** If later evidence grades the covered work
  (e.g. a fix later judged NO-EFFECT), the backdated post may only carry an honest in-period
  hedge ("this bets that X is the bottleneck; mid-month will tell") — the grading belongs to the
  NEXT post, dated when the grade existed.

## Composing from the notes

Draft from the agents' notes plus `voice.md`; go back to `ground.md` surfaces yourself only for
numbers the notes lack. Every number in the final draft must appear in a note or a query you ran —
if it's in neither, cut it.
