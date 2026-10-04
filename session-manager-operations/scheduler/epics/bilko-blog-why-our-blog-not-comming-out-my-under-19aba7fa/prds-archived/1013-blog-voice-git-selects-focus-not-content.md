---
title: Blog voice: git selects the focus, not the content — posts must sell the project's value and use
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 22
createdVia: scheduler-api
issuedAt: 2026-09-13T04:21:59.000Z
sourcePromptId: bilko-blog-why-our-blog-not-comming-out-my-under-19aba7fa
tag: feature
agentType: dev-lead
---
# Goal

The first autonomous post ("The Book Didn't Know What It Already Held", live 2026-09-02) reads as an engineering post-mortem: two named Alpaca error codes, a leg-collision root cause, retry-suffix internals. The owner's correction: git history is grounding for choosing WHICH PROJECT to write about — it is not the post's subject matter. A post should say "I worked on this project" and then spend its words on what the project is WORTH and HOW A READER USES IT. blog.config.yaml's `identity.post_is` already says exactly this ("a product update — what the reader can now DO, not the engineering it took"), but three other files license the opposite and won the argument. Fix them so the config's stated intent is the one the pipeline actually follows.

# Acceptance criteria

- [ ] Core: blog.config.yaml gains an explicit statement (in `identity:` or a new `grounding:` block) that git/commit history selects the post's FOCUS (which project, what window) and must NOT supply the post's subject matter — the body is about the project's value and use, not the changes that prompted writing about it
- [ ] Core: the `field-note` tone is redefined or removed — its current shape, `one hard bug/decision told well + one lesson`, is a direct licence for the post-mortem style the owner rejected, and at 500-800 words it is also the longest tone; if kept, its shape must require the bug to serve a value/use point rather than be the subject
- [ ] Core: every tone in `tones:` gains a required payload the post must deliver: what the project is for, who it helps, and concretely how a reader starts using it (with the correct link per `links:` host-kind rules) — a post that never tells a reader how to use the thing fails the phase-5 self-check
- [ ] Core: `.claude/skills/blog-from-git/research.md`'s per-story-unit note template is rebalanced — item 3 ('The hardest / most surprising engineering detail — from commit bodies and diffs') and item 4 ('Honest admissions ... This section reliably yields the best material in the post') currently steer the draft toward bug narrative; demote them to supporting colour and promote the value/use material (items 1 and 5) to the primary payload
- [ ] Core: `.claude/skills/blog-from-git/voice.md`'s 'Feature-VALUE, not changelog' checklist is amended — its third bullet, 'Why it was hard or non-obvious (the real engineering, the thing that almost broke)', licenses engineering detail as a required element; make it optional and subordinate to the capability/benefit bullets
- [ ] Core: SKILL.md's phase-5 final self-check gains a check the draft must pass: 'Does a reader who has never heard of this project finish the post knowing what it does for them and how to try it?' — and an explicit fail condition for a post whose main narrative is a bug, an error code, or an internal refactor
- [ ] Edge cases: the truth rules still bind absolutely — `no_invented_metrics`, `every_number_needs_a_source`, `backdating: honest-only`. Shifting from engineering detail to value claims must NOT license unsourced marketing claims; a value claim still needs a real artifact or number per ground.md
- [ ] Edge cases: `ground.md`'s live-state grounding (MCP reads, scorecards, KPI scripts) becomes MORE important under this change, not less — it is the sanctioned way to back a value claim with a real number; keep it and reference it from the new rules
- [ ] Edge cases: a project with no user-facing surface at all (pure internal tooling with no /projects tile and nothing a reader can use) must be handled explicitly — either it is ineligible as a post subject, or the rules state what such a post may say instead; do not leave this ambiguous
- [ ] Edge cases: `max_ctas_per_post: 1` still holds — the required how-to-use payload is prose plus the one correct link, not a pile of CTAs
- [ ] Interaction / integration: no change to the watchdog's scheduling, rotation cooldown, autonomy rails, or heartbeat semantics from PRDs 1007/1009/1010/1011/1012 — this PRD is editorial policy and prose only
- [ ] Interaction / integration: per blog.config.yaml's own header ('THIS FILE IS THE AUTHORITY ... If prose and this file ever disagree, this file wins — fix the prose'), the config change is the source of truth and rotation.md/voice.md/research.md/SKILL.md are updated to match — no file may be left contradicting it
- [ ] Tests: a test asserts blog.config.yaml declares the focus-vs-content grounding rule and that every tone carries the required value/use payload
- [ ] Tests: a test asserts no sub-skill file still instructs the executor to make the hardest engineering detail or a bug narrative the post's primary material
- [ ] Tests: `timeout 300 pnpm test` passes
- [ ] Tests: `timeout 300 pnpm typecheck` passes

# Implementation notes

OWNER CORRECTION, 2026-09-12, verbatim: "The blog is way too literal about the git. The git as grounding is meant to be about the figuring out the focus was the project. The blog is not to spell out every bug but to say I worked on the project and use the opportunity to highlight value of the project and how to be used."

Read the shipped post first to see the failure concretely: `git show 8305663 -- server/db.ts`. It opens with an Alpaca rejection (`position intent mismatch, inferred: buy_to_close`), spends its middle on retry suffixes (`CLOSE_*_R2`, `_R3`) and error `40310000 insufficient qty available`, and never tells a reader what Social Signals Trader IS, who it is for, or how to look at it. It is technically accurate and correctly grounded — and it is the wrong genre.

VERIFIED sources of the conflict — the config is already right, three files override it:

1. `.claude/skills/blog-from-git/blog.config.yaml` `identity:` block ALREADY states the correct intent: `reader: someone deciding whether a product is worth their attention` and `post_is: a product update — what the reader can now DO, not the engineering it took`. Do not weaken these; make them win.

2. `blog.config.yaml` `tones:` — `field-note: { words: [500, 800], shape: "one hard bug/decision told well + one lesson", extras: [...] }`. This tone's own definition IS the rejected genre, and it is the longest tone. The shipped post used exactly this tone (ledger row records `field-note`). This is the single biggest lever.

3. `.claude/skills/blog-from-git/research.md` lines ~9-18, the per-story-unit note template. Item 3 is "**The hardest / most surprising engineering detail** — from commit bodies and diffs, not titles." Item 4 is "**Honest admissions** — what broke ... This section reliably yields the best material in the post." Those two sentences actively direct the research agents to mine diffs for bug narrative, and the draft then uses what research handed it.

4. `.claude/skills/blog-from-git/voice.md`, the "Feature-VALUE, not changelog" section. It is mostly RIGHT (it already says "A paragraph that states a capability but none of its value is changelog filler") but its third required bullet is "**Why it was hard or non-obvious** (the real engineering, the thing that almost broke)" — which makes engineering detail a required element of every feature mention.

5. `.claude/skills/blog-from-git/SKILL.md` phase-5 "Final self-check" — add the reader-can-use-it gate there so it is enforced at the gate, not just advised in prose.

Keep `ground.md` intact and lean on it harder: it is the sanctioned mechanism for backing a value claim with a live number (MCP reads, `coverage_scorecard.py`, KPI scripts) rather than a vibe. The risk of this change is swapping grounded engineering detail for ungrounded marketing prose — the truth rules are what prevent that, so state the link explicitly in the new rules.

Follow the repo convention that blog.config.yaml is the authority and prose gets fixed to match it.

# Out of scope

- Do NOT weaken the truth rules (no_invented_metrics, every_number_needs_a_source, honest-only backdating) — value claims still need a real source
- Do NOT rewrite or unpublish the already-live post in this PRD — editing a seeded post does not reach production (INSERT OR IGNORE); that needs the admin blog API and is a separate decision
- Do NOT change the watchdog's scheduling, rotation cooldown, autonomy rails, push-race recovery, or heartbeat semantics
- Do NOT raise the word counts — the fix is a different genre, not a longer post
- Do NOT remove ground.md's live-state grounding — it matters more under this change, not less
- Do NOT turn posts into marketing copy detached from shipped work — git still selects the focus, and the work still has to be real

## Engineering standards

Before writing any code, read `/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` — it has the Performance, Debugging,
API-reuse, TDD, and Execution-discipline rules that apply to this PRD. Every rule in it is
mandatory, especially Execution discipline (bounded commands, verify before done, the
finish-protocol sentinel).
