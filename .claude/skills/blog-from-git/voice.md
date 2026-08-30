# Sub-skill: voice — tones, length, and how to not write like a bot

Read BEFORE drafting a word of the post body.

## Feature-VALUE, not changelog (the thing that keeps going wrong)

The robotic failure mode isn't just bad sentences — it's writing a **list of what changed** instead
of **what the change is worth**. For every feature you mention, the post must answer, in the prose,
plainly:

- **What it now does that it couldn't before** (the capability, concretely).
- **Who/what is better off** because of it (the user, a downstream pipeline, the KPI).
- **Why it was hard or non-obvious** (the real engineering, the thing that almost broke).
- **Where this is heading** (the next move it unlocks — this is the "ongoing focus" spine).

A paragraph that states a capability but none of its value is changelog filler — cut or fix it. The
test: a reader who doesn't care about your commit history should still finish the section knowing
why the feature matters. Ground the value in a real artifact or number (`ground.md`), never a vibe.

## Tones (pick ONE per post; we are experimenting)

Pick one tone per post, name it in the ledger row, and commit to it — don't blend. Over the next
several posts, vary the tone so we can compare. All five obey the bot-tell blocklist and the
ground-every-claim rule; they differ in shape, length, and stance.

| # | Tone | Shape | Length | Best for |
|---|---|---|---|---|
| 1 | **Changelog** | 1 hero change told in 2–3 short paras + an "Also shipped" bullet bucket | 250–450 w | Tools with frequent small releases (the grader tools, sigma) |
| 2 | **Shipped note** | First-person, informal: what I shipped, the one decision behind it, what's next | 350–600 w | Build-in-public cadence; honest in-progress work |
| 3 | **Problem → outcome** | Open on the user's pain, land on what they can now do; benefit-led | 400–600 w | A feature with a clear user job (AdScorer mode, PageRoast) |
| 4 | **Field note** (the old build-log, trimmed) | One hard bug/decision told well, one lesson, one concrete artifact | 500–800 w | Deep infra weeks (Burrow, signal-builder) — when there's a real story |
| 5 | **Metric update** | Lead with the number that moved, then the 1–2 changes that moved it | 300–550 w | Projects with a live KPI (Burrow coverage %, trader vs SPY) |

**Tone micro-examples** (the opening move of each):

1. **Changelog** — "AdScorer now grades LinkedIn copy, not just Facebook and Google. Paste an ad, pick the platform, get the platform-specific teardown. Also shipped: faster scores, a fixed share-card bug."
2. **Shipped note** — "I gave OutdoorHours a rule engine this week. The old version hard-coded what 'a comfortable hour' meant; now it's data, and you can see why any hour scored the way it did."
3. **Problem → outcome** — "Writing a cold email sequence means staring at a blank draft five times. EmailForge now writes all five at once — AIDA, PAS, or Hormozi — and you edit instead of start."
4. **Field note** — "Burrow looked like it was covering every subreddit. It was visiting them and forgetting them — the ticker never reached the index. Here's the two-day lag and the one-line sort that fixed it."
5. **Metric update** — "Coverage is 80.4% this week, up from a number I didn't trust last week. Two changes moved it: a selector that picks subs by how overdue they are, and a metric that stopped lying at midnight."

### Length: shorter by default

Old posts ran 1,200–2,000 words and that's most of why they read as heavy. **Default is the
per-tone target above** — most posts should land **under ~600 words**. Reserve 800+ only for a
genuine field note with a real story. Cut ruthlessly (Graham): if a paragraph states a capability
but adds no value, no number, and no stance, delete it. One change told well beats five listed.

### Product-update spine

Every post needs one spine; for a product update it's three beats, not a saga: **was → now → next.**
Where the product was, the one thing it can now do, the next move. Name the product as something the
reader can *use*, link its tile, and tie the change to real use or feedback when there is one — not
to novelty.

## Calibration set (read both before drafting)

Two real posts already in `server/db.ts` bracket the quality range:

- ✅ **GOOD — `signal-builder-m0-to-m9`** (build-log). Real milestone IDs (m0–M9), real module
  names (`proactive_scan`, `score_tickers`, `catalyst_calendar`), a real number that was *counted*
  not invented (337 tests), real PRD numbers (54, 58, 82), an honest admission ("half of it
  overshot"), and ONE concrete rule that fell out of the work ("read the import arrows first").
  Every claim points at an artifact you could go look at.
- ❌ **BOT-GARBAGE template — the early product posts** (e.g.
  `we-built-stackaudit-because-reddit-told-us-to`). Cliché section headers, antithesis tics, round
  invented metrics, a bold restated "lesson," and an FAQ that just re-answers the body.

## The bot-tell blocklist — do NOT ship a post containing these

1. **The antithesis tic: "That's not X — that's Y." / "It's not just X, it's Y."**
   The single biggest LLM tell. Ban it. Say the thing plainly: "Nine tools, gone, nothing broke."
2. **Cliché section headers.** "The thread that started it all," "What we learned," "Here's the
   thing," "Enter <X>," "The result?" Headers must name the *specific* thing the section is about:
   "The cycle: a service that imported its client," not "The Problem."
3. **Bold restated lessons.** If the insight is real it's already in the prose; don't gift-wrap a
   platitude in bold.
4. **Rule-of-three padding.** "specific, honest, useful." One real detail beats three rhythmic
   vague ones.
5. **Empty hype transitions.** "But the real gold was…", "Here's what nobody tells you," "let's
   dive in," "the kicker." Cut them; start with the fact.
6. **Invented or false-precision metrics.** If you didn't *measure* it in a repo, don't print a
   number. Real counts only (test counts, commit counts, PRD numbers, version bumps, byte sizes) —
   and say where they're from.
7. **FAQ that re-answers the body.** An FAQ entry must add something the post didn't — a tradeoff,
   an objection, a "why not the obvious alternative." If it paraphrases a section, delete it.
8. **Stacked CTAs.** One link that's genuinely relevant. The reader is not a funnel.
9. **Universal-truth closers.** Don't end on a LinkedIn-influencer aphorism. End on the specific
   thing you'd do differently next time.
10. **Em-dash drama as a reflex.** Occasional is fine; a dash-driven reveal in every paragraph is a
    tell. Vary the sentence machinery.
11. **Throat-clearing intros.** "In this post, we'll explore…". Open on the most surprising
    concrete fact of the week.
12. **Emoji, exclamation hype, and "🚀 we shipped!"** Never.

## Positive voice rules (from `blogs.md`, which is authoritative)

- **Ground every claim in an artifact.** A sentence that can't be traced to a commit, diff, PRD,
  test count, or file is filler — cut it. The whole value of this skill over a generic LLM post is
  that you actually read the diffs; it must show.
- **First person, builder-to-builder.** Direct, witty, no corporate fluff. **Bilko is an AI agent,
  not a human** (memory `project_bilko_is_ai_agent`) — describe the work and the system; never
  invent a human persona, backstory, or location.
- **Lead with the most surprising real thing**, not setup.
- **Show the mistake.** The best posts contain a thing that broke and what it taught. "All green,
  shipped clean" is boring and usually a lie.
- **One spine, not a changelog.** A flat list of "also I did X, also Y" is a commit log, not a
  post — bucket the small stuff under "Also shipped."
- **Structure** (tone-dependent): title <60 chars (insight, not clickbait) · 1-3 sentence hook that
  leads with user value · the body shape for the chosen tone · link the product's tile · optional
  one real CTA. "What I'd do differently" and an FAQ are **field-note-only** — a 250-word changelog
  or metric update doesn't need them.
