# Sub-skill: voice — tones, length, and how to not write like a bot

Read BEFORE drafting a word of the post body.

## Plain language (GED level)

Owner direction, 2026-10-02: write at a GED / about 8th-grade reading level — the US Federal
Plain Language Guidelines (plainlanguage.gov), enforced by `scripts/blog-readability.ts`
(`blog.config.yaml` `readability:`). Every draft must pass the checker before it ships. The rules,
in short:

- **Use "you."** Talk to the reader, not about "the user."
- **Use active voice.** "The tool scores your ad," not "your ad is scored by the tool."
- **Use short sentences.** One idea per sentence; most posts should read easily out loud.
- **Use common words.** Say "use," not "leverage"; say "help," not "facilitate" (full swap list in
  `readability.jargon_blocklist`).
- **One idea per paragraph.** If a paragraph covers two things, split it.
- **Explain any needed technical term in plain words the first time you use it.** If a reader
  needs the word "coverage" to understand the post, define it in one plain clause the first time.

Two before/after rewrites, pulled from this file's own tone micro-examples below:

Before: "Burrow's coverage number is the thing that tells you whether the brain actually saw a
subreddit before you ask it a question."
After: "Coverage is the number that tells you if Burrow checked a subreddit before it answers
your question."

Before: "I gave OutdoorHours a rule engine this week. The old version hard-coded what 'a
comfortable hour' meant; now it's data, and you can see why any hour scored the way it did."
After: "This week I added a rule engine to OutdoorHours. Before, the app had one fixed idea of a
'comfortable hour.' Now you can see exactly why each hour got its score."

## Links readers can click

Owner direction, 2026-10-03, verbatim: "you need to print the full links not a sudo-code ... the
audience is early college people so they need to click." Every link in a post must be:

- **A full `https://` URL.** Never a relative path like `/projects/<slug>/` — the readability
  checker (`scripts/blog-readability.ts`) fails any relative link (`blog.config.yaml`
  `links.absolute_urls_only`).
- **Named by where it goes.** The link text says what the reader will land on ("try
  gitoverview"), never "click here" or "the project page."
- **Present whenever you say "open source."** If the post calls the code open source, says it's
  on GitHub, or says it can be forked, link the real repo: `https://` + that project's
  `host.sourceRepo` (`blog.config.yaml` `links.source_repo`).

Before: "You can check out [the project page](/projects/git-viewer/) — the project is open source."
After: "Try it yourself at [bilko.run/projects/git-viewer](https://bilko.run/projects/git-viewer/). The code is open source — see it at [github.com/StanislavBG/git-viewer](https://github.com/StanislavBG/git-viewer)."

## Written to travel (LinkedIn-ready, no selling)

Owner direction, 2026-10-03, verbatim: "I want to eventually make this blog even more public by
double-publishing to linkedIN - make sure that objective is already baked into the grouding for it
- talking about hte projects I work on will drive traffic. so the language can't be marketing but
urls need be real and we let the landing page convert." (`blog.config.yaml` `distribution:`.) This
pipeline does not post to LinkedIn yet — no automation exists for it — but every post is written
today so a human could paste it there unchanged.

Stand-alone rules — a post must read as a complete thing with zero site context around it:

- **No "last post," "see above," or "on this blog" references.** A LinkedIn reader never saw the
  previous post and isn't on bilko.run — every sentence must make sense cold.
- **Every link is a full, real, absolute `https://` URL** (`links.absolute_urls_only`) — never a
  relative path, never a fake or placeholder link. The post does not sell; the landing page does
  the converting, so the one real link to it is load-bearing, not decorative.
- **The first two sentences carry the cool part.** LinkedIn (and most feeds) truncate after a line
  or two — if the hook is buried in paragraph three, it never gets read.
- **No marketing language.** The post states what the project does and how to try it, plainly; it
  never pitches, hypes, or urges (`distribution.marketing_blocklist` in `blog.config.yaml`).
- **No automation or pipeline disclosure.** A syndicated copy never mentions that it was drafted,
  scanned, or scheduled by a pipeline — it reads as Bilko writing about Bilko's own work.

Before (sells): "Don't miss this game-changer — sign up now and unlock the full power of
AdScorer's new compare mode!"
After (plain, real link, no selling): "AdScorer can now put two ad drafts side by side and tell you
which one a platform's algorithm will favor. Try it at
[bilko.run/projects/ad-scorer](https://bilko.run/projects/ad-scorer/)."

Real, absolute, live URLs are mandatory here for the same reason they're mandatory for the
early-college reader above: the post's job is to get someone to click, and the landing page — not
the post — is what has to convert them.

## Feature-VALUE, not changelog (the thing that keeps going wrong)

The robotic failure mode isn't just bad sentences — it's writing a **list of what changed** instead
of **what the change is worth**. For every feature you mention, the post must answer, in the prose,
plainly, in this priority order:

- **What it now does that it couldn't before** (the capability, concretely). Required.
- **Who/what is better off** because of it (the user, a downstream pipeline, the KPI). Required.
- **How a reader starts using it right now** (the concrete action and the correct link per
  `blog.config.yaml` `links:` rules — see `tones.required_value_use_payload`). Required.
- **Where this is heading** (the next move it unlocks — this is the "ongoing focus" spine). Required.
- *Why it was hard or non-obvious* (the real engineering, the thing that almost broke). **Optional
  and subordinate to the four bullets above** — include it only when it actually backs a value or
  use claim (per `research.md` item 5); never let it become the paragraph's own point. Git selects
  which project and window to write about, not what the post is about (`blog.config.yaml`
  `grounding:`) — a paragraph whose engineering detail has no value/use point it serves is
  changelog filler in the opposite direction and gets cut just like a bare capability statement.

A paragraph that states a capability but none of its value is changelog filler — cut or fix it. The
test: a reader who doesn't care about your commit history should still finish the section knowing
why the feature matters AND how to go try it. Ground the value in a real artifact or number
(`ground.md`), never a vibe — swapping engineering narrative for value claims does not mean the
value claims can be unsourced.

## Tones (pick ONE per post; we are experimenting)

Pick one tone per post, name it in the ledger row, and commit to it — don't blend. Over the next
several posts, vary the tone so we can compare. All five obey the bot-tell blocklist and the
ground-every-claim rule; they differ in shape, length, and stance.

| # | Tone | Shape | Length | Best for |
|---|---|---|---|---|
| 1 | **Changelog** | 1 hero change told in 2–3 short paras + an "Also shipped" bullet bucket | 250–450 w | Tools with frequent small releases (the grader tools, sigma) |
| 2 | **Shipped note** | First-person, informal: what I shipped, the one decision behind it, what's next | 350–600 w | Build-in-public cadence; honest in-progress work |
| 3 | **Problem → outcome** | Open on the user's pain, land on what they can now do; benefit-led | 400–600 w | A feature with a clear user job (AdScorer mode, PageRoast) |
| 4 | **Field note** (the old build-log, trimmed) | One hard bug/decision used as PROOF of a value/use point (never as the subject itself), one lesson, one concrete artifact | 500–800 w | Deep infra weeks (Burrow, signal-builder) — when the story backs a real value/use point, not for its own sake |
| 5 | **Metric update** | Lead with the number that moved, then the 1–2 changes that moved it | 300–550 w | Projects with a live KPI (Burrow coverage %, trader vs SPY) |

**Tone micro-examples** (the opening move of each — cool part first, plain words, per `angle:`):

1. **Changelog** — "AdScorer now grades LinkedIn copy, not just Facebook and Google. Paste your ad, pick the platform, and get a teardown built for that one. Scores are faster too, and the share-card bug is gone."
2. **Shipped note** — "OutdoorHours can now explain itself. Open any hour and you see exactly why it got that score. The old version just said 'comfortable' with no reason why; this week I gave it a rule engine instead."
3. **Problem → outcome** — "Staring at a blank page five times to write one email sequence is no fun. EmailForge now writes all five emails at once. Pick AIDA, PAS, or Hormozi style, and edit instead of starting from zero."
4. **Field note** — "Burrow's coverage number tells you if the brain actually checked a subreddit before it answers your question. Coverage is climbing again this week, so you can trust that number more. One bug had it stuck: subs got checked, then forgotten, before they reached the index. A single sort fixed it." (The bug gets one sentence, in service of the number you can now trust — not the subject on its own.)
5. **Metric update** — "Coverage is 80.4% this week. Last week I did not trust that number at all. Two fixes moved it: a smarter pick for which subs to check next, and a fix for a count that reset itself at midnight."

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

Two real posts already in `content/blog/` bracket the quality range:

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
- **Lead with the coolest thing, not setup.** Open on the coolest thing a reader can do, see, or
  play with — the fun or impressive part, told as what it feels like to use (`angle:` in
  `blog.config.yaml`). A bug, refactor, or internal fix stays out of the post entirely unless one
  sentence of it makes the cool part more believable; it never becomes the subject.
- **One spine, not a changelog.** A flat list of "also I did X, also Y" is a commit log, not a
  post — bucket the small stuff under "Also shipped."
- **Every post tells the reader how to use the thing.** Required regardless of tone: what the
  project is for, who it helps, and the concrete next action with the correct link
  (`tones.required_value_use_payload` in `blog.config.yaml`). A post that never says how a reader
  starts using it fails the phase-5 self-check even if the prose is otherwise clean.
- **Structure** (tone-dependent): title <60 chars (insight, not clickbait) · 1-3 sentence hook that
  leads with user value · the body shape for the chosen tone · the how-to-use payload above · link
  the product's tile · optional one real CTA (same link, not a second one). "What I'd do
  differently" and an FAQ are **field-note-only** — a 250-word changelog or metric update doesn't
  need them.
