# Sub-skill: research — parallel evidence agents (between scan and draft)

The scan (`scan.md`) produces story units: "project X, date range, these commits." Before drafting,
each story unit needs deep evidence — actual diffs read, actual numbers pulled. Doing that inline
for several posts burns the composing session's context on raw diff dumps. Delegate it.

**Pattern (validated on the 2026-07-24 backfill, 6 agents / 7 posts):** spawn one read-only
research agent (Explore type) per story unit, all in a single parallel batch. Each agent gets the
repo, the window, the named commits, and this note template to fill.

**Git selects the story unit's focus and window only — it does not supply the post's subject
matter** (`blog.config.yaml` `grounding:`). The template below is ordered by what the DRAFT must
lead with: items 1-3 are the primary payload (what the project is, what it's worth, how a reader
uses it); items 4-5 are supporting evidence that BACKS the payload; item 6 is process bookkeeping.
No item below licenses making a bug, an error code, or an internal refactor the post's subject.

1. **What the project IS and WHO it's for** (README, tile description) — one sentence a reader
   who's never heard of it can understand.
2. **Before → after** — what the product could not do, and now can (user-visible, concrete). This
   is the value claim the rest of the notes exist to back.
3. **How a reader starts using it right now** — the concrete action (URL, command, flow) and the
   correct link per `blog.config.yaml` `links:` host-kind rules. Required — a story unit with no
   answer here likely means an ineligible subject (see `grounding.ineligible_subject`), not a gap
   to paper over with engineering narrative.
4. **Countable specifics** — versions, PRD numbers, test counts, file names, line counts, DB
   counts — each with its source (commit sha, file path, query). Use these to make #2 and #3
   concrete and sourced, not as a parts list on their own.
5. **Supporting color (optional, subordinate to 1-3)** — the hardest/most surprising engineering
   detail, and honest admissions about what broke or is still rough. Include ONLY when it actually
   illuminates the value/use point above (e.g. "this is why the coverage number moved"); never
   include it as the story's own subject. If a story unit's only interesting material is an
   engineering detail with no value/use point it serves, that is a signal the story unit is too
   thin for a post, not licence to lead with the detail anyway.
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
