---
name: blog-from-git
description: Draft a Bilko (bilko.run) blog post from a real scan of git activity since the last post. Default framing is a SHORT PRODUCT UPDATE — progress on a product the reader can go use — not a long build-log. GitHub is the source of truth — enumerate repos and pull diffs via `gh`, not local working trees. Before drafting, consult the rotation ledger (rotation.md): alternate projects and never run two consecutive posts about a project with no `/projects` tile. Three modes — portfolio (whole-workspace week-in-review), focused (one project/theme, framed as an ongoing-focus update; can emit a short series), and catch-up (backfill a 3-5 day cadence over a publishing gap). When focused on a project that exposes its own MCP or scorecard (e.g. Burrow's `burrow-brain` MCP + `coverage_scorecard.py`), query it during composing to ground value claims in live project state, not just diffs. Project-scoped to ~/Projects/Bilko. Use for "write a blog post from the git diff/history", "blog the last N days", "update on <project>", "what did I ship — write it up", or any product-update/week-in-review for bilko.run. NOT for marketing copy unrelated to shipped work.
---

# Blog from git (bilko.run only) — orchestrator

Draft bilko.run **product-update** posts from what was **actually shipped**, scanned across the
portfolio since the last post.

**`blog.config.yaml` in this folder is the grounding authority.** It declares every editorial
parameter — identity/voice stance, cadence, rotation policy, the tone roster with word ranges,
truth/number rules, link rules, all seven gates, and seed mechanics — as data. **Read it FIRST,
before any sub-skill file.** The per-phase sub-skill files below explain *how* to satisfy the
config; if any prose ever disagrees with the config, the config wins and the prose is a bug.
Editorial policy changes go into the config, not into scattered prose.

This skill is decomposed into per-phase sub-skill files in this folder — **Read each file when
its phase starts, not all up front.** This SKILL.md owns the pipeline order, the mode decision,
and the final quality gate; the sub-files own the how.

**The bar:** a post must read like a builder reporting real, usable progress to a reader who might
go try the thing. If it could have been written by someone who only read the commit *titles*, it's
garbage — delete it and start over. Most of the failure here is not the git scan; it's the writing.

**Research basis (2026-06-24):** tone/length rules grounded in 8 external sources (Linear changelog
philosophy, Intercom feature-announcement guides, Keep a Changelog, Paul Graham on writing,
build-in-public practitioners) plus Burrow's indexed community signal and the hand-authored
`blog-bilko` voice (`~/Projects/burrow/data/voices/blog-bilko.yaml`). The cross-source rules:
frame around user value, be concise and skimmable, plain spoken voice, feature a few changes well,
show don't tell, keep a consistent cadence, write honestly not salesy.

## The pipeline

Run the phases in this order. Each phase has ONE sub-skill file and a gate you must pass before
moving on.

| # | Phase | Read | Gate to proceed |
|---|---|---|---|
| 1 | **Rotation** — what am I allowed to cover? | `rotation.md` + `blog-ledger.md` | project choice satisfies both hard rules (or user explicitly overrode) |
| 2 | **Scan** — what actually shipped? | `scan.md` | window confirmed from db.ts seeds; every repo enumerated via `gh`; local-only reconciliation ran; cron noise filtered |
| 3 | **Research** — deep evidence per story unit | `research.md` | one parallel read-only agent per story unit returned structured notes; slot dates re-verified against actual commit dates; push status of every covered repo known |
| 4 | **Ground** — what is it worth, live? | `ground.md` | every number the draft will print has a named source (scorecard / MCP / DB / doc / research note) |
| 5 | **Draft** — write it | `voice.md` | one tone picked and named; within its length target; self-check below all YES |
| 6 | **Approve** — user reads the full draft | — | explicit user OK. **Never seed without it** |
| 7 | **Seed** — db.ts + ledger + push | `seed.md` | tsc clean, db test passes, ledger row + rotation-state updated in the SAME commit, pushed to origin only; live-site pickup verified after deploy |

Phases 1–2 are cheap and always run. Phases 3–4 run per covered project (phase 3's agent fan-out
pays for itself from ~2 story units up; for a single small changelog post it may collapse into
reading the diffs inline). Phases 5–6 run per post (a catch-up backfill loops 5→6 per post, then
one combined phase 7).

**Phase 5 drafts directory is append-only for automated runs.** `drafts/` may already contain
`.md` files a prior run (human or automated, e.g. `scripts/blog-cadence-watchdog.sh`) wrote and
left pending phase-6 approval. Never delete, move, or overwrite a pre-existing draft — only a
human, or an explicitly human-approved seed step (`seed.md`), removes files from this directory.
If you find drafts you did not author in this run, report them as pre-existing and attribute
them to their `authored_by` front-matter value; never present someone else's draft as your own
output. A clean `git status` proves nothing here — `drafts/` is gitignored.

## Mode decision (after phase 1, before phase 2)

| Mode | When | Scope | Output |
|---|---|---|---|
| **Portfolio** | "blog the last N days", "week in review", no project named | scan EVERY repo | one arc post spanning repos |
| **Focused** | a project or theme is named ("update on Burrow", "blog the X work") | that project's repo(s), rest of portfolio as *context only* | one update post — or a short series (2-3), cross-linked |
| **Catch-up** | gap since last post > ~10 days and no single project named | scan EVERY repo over the whole gap | a queue of backdated posts at 3–5 day cadence (`rotation.md` Part 0.5) |

**Focused mode is the default when the user names a project or theme.** Don't widen a focused ask
into a portfolio sweep. A focused post is an *update on an ongoing focus*, not a launch
announcement — name where the project was, what moved, where it's going (**was → now → next**).
If emitting a series, each post covers one sub-theme and ends pointing at the next.

## Final self-check (phase 4 gate — all must be YES before showing the draft)

- [ ] **Rotation:** ledger permits this project? Not same as previous post; not a second
      consecutive off-`/projects` project. Ledger row will be written on seed.
- [ ] **Tone named and held:** one `voice.md` tone, within its length target, not blended?
- [ ] **Leads with user value** (what the reader can now do), not the engineering it took?
- [ ] Could a reader who only saw commit titles NOT have written this? (specifics prove the diff read)
- [ ] Zero items from the `voice.md` bot-tell blocklist?
- [ ] Every number traced to a source I actually queried (`ground.md`), with its source implied?
- [ ] Spine is **was → now → next** (or, for a field note, one real story), not a launch pitch?
- [ ] **Field note only:** a real mistake/surprise; "What I'd do differently" names a concrete
      action; FAQ entries each add a new angle. (Skip for changelog/metric/shipped-note tones.)

If any is NO, the post is not ready. Rewrite, don't ship.

## Folder map

```
blog-from-git/
  blog.config.yaml ← THE AUTHORITY: every editorial rule as data — read first
  SKILL.md        ← this file: pipeline, modes, final gate
  rotation.md     ← Part 0 rotation rules + Part 0.5 catch-up mode
  scan.md         ← Part 2 GitHub-first scan + local reconciliation
  research.md     ← parallel per-story-unit evidence agents + backdating traps
  ground.md       ← Part 2.5 live-state grounding (MCP / scorecard / DBs)
  voice.md        ← Part 1 + 1.5: tones, lengths, bot-tell blocklist, calibration posts
  seed.md         ← Part 3 seeding mechanics, ledger update, link correctness, gotchas
  blog-ledger.md  ← rotation memory: published rows + rotation state + backfill queue
```
