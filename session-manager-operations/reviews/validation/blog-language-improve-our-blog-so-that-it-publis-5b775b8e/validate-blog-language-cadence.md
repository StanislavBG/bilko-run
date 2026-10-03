# Validation: blog-language-improve-our-blog-so-that-it-publis-5b775b8e

Base: `b3eff74641acf20a7106dddd0511b1d9e1e7746b`
PRD files located at: `/home/bilko/Projects/Bilko/session-manager-operations/scheduler/epics/blog-language-improve-our-blog-so-that-it-publis-5b775b8e/prds-archived/` (this epic's own worktree — not present under this job's epic-relative path, since scheduler epic/PRD directories are worktree-local runtime state, not committed to git).

Commits in scope (`git log --oneline <base>..HEAD`):
- `ff97536` feat(blog): add deterministic blog readability checker — PRD 1014
- `9019e89` merge scheduler job 1014-blog-readability-checker (same diff as ff97536, landed via merge)
- `b516d41` feat(blog): enforce plain-language and cool-angle editorial policy — PRD 1015
- `2903bcd` feat(blog): add spotlight fallback and readability gate to cadence watchdog — PRD 1016
- `d6b1209` docs(blog-from-git): document spotlight mode and authored-time published_at — PRD 1017
- `7a0fd66` social-signals-trader: publish dashboard snapshot — unrelated automated publish job, touches `public/projects/social-signals-trader/dashboard-code.bundle.js` only (timestamp refresh); not part of this plan's PRDs, not caused by them.

## PRD 1014 — blog-readability-checker — VERIFIED

| AC | Evidence |
|---|---|
| `analyzeReadability` exports with the specified report shape | `scripts/blog-readability.ts:22-29,113-152` — `ReadabilityReport` has `fkGrade, avgSentenceWords, longSentences, jargonHits, wordCount, pass`. |
| Strips non-prose before scoring | `scripts/blog-readability.ts:62-73` `stripNonProse` strips front matter, fenced code, inline code, link targets, HTML tags, bare URLs, heading lines. Proven by test `tests/blog-readability.test.ts:43-52` ("does not let fenced code blocks or URLs change the score"). |
| Default thresholds incl. ≥15 jargon pairs | `scripts/blog-readability.ts:31-56` `DEFAULT_THRESHOLDS` — maxFkGrade 8, maxAvgSentenceWords 18, longSentenceWords 25, maxLongSentences 2, 18 jargon pairs (≥15 required). |
| CLI reads `readability:` block from config, else defaults; JSON to stdout; exit 0/1/2 | `scripts/blog-readability.ts:161-220` `loadThresholdsFromConfig` + `main()`. |
| Tests: plain passes, jargon-heavy fails, code/URLs don't change score, case-insensitive whole-word jargon match, CLI exits 1/0 | `tests/blog-readability.test.ts:28-102`, all present. |
| Syllable counter documented heuristic, no new dependency | `scripts/blog-readability.ts:93-107` (comment + implementation); `js-yaml`/`tsx` already in `package.json` — no new deps added in this diff. |

Gate (`timeout 300 pnpm vitest run tests/blog-readability.test.ts`, `timeout 300 pnpm typecheck`): re-ran both as part of the combined gate below — **PASS** (6/6 tests; `tsc --noEmit` clean).

## PRD 1015 — blog-plain-language-voice — VERIFIED

| AC | Evidence |
|---|---|
| `blog.config.yaml` `readability:` block with standard/reading_level/thresholds/jargon_blocklist/checker | `.claude/skills/blog-from-git/blog.config.yaml:118-149` — matches `scripts/blog-readability.ts` key names and defaults exactly. |
| `angle:` block, cool-lead prose, `show_the_mistake: false` with comment pointing at angle | `blog.config.yaml:151-160` (angle block); `blog.config.yaml:173-174` (`show_the_mistake: false  # 2026-10-02: superseded by angle: above`). |
| `gates.5_draft` names readability; `identity.stance` mentions plain/simple English; truth/tones/field-note shape unchanged | `blog.config.yaml:197-200` (gate), `blog.config.yaml:11-13` (stance: "plain simple English (GED level...)"), `truth:` block (`blog.config.yaml:164-174`) and `tones:` (`96-116`) still present with all prior keys — confirmed by `tests/blog-editorial-focus-not-content.test.ts` passing unchanged (21/21). |
| `voice.md` Plain-language section near top, Federal rules in short form, 2 before/after examples; "show the mistake" replaced by cool-angle; micro-examples rewritten to pass checker | `.claude/skills/blog-from-git/voice.md:5-31` (section + 2 before/afters at lines 23-31); "Lead with the coolest thing, not setup" at `voice.md:141-144` replaces the old show-the-mistake guidance; micro-examples at `voice.md:73-77` proven to pass the checker by `tests/blog-plain-language.test.ts:144-164`. |
| `SKILL.md` self-check gains 2 YES/NO items; field-note item softened to optional | `.claude/skills/blog-from-git/SKILL.md:95-98` (readability exit-0 item, cool-opener item); `SKILL.md:99-101` ("Field note only, optional: ..."). |
| New `tests/blog-plain-language.test.ts` asserts all of the above | Present, 19 tests, all passing. |

Gate (`pnpm vitest run tests/blog-plain-language.test.ts tests/blog-editorial-focus-not-content.test.ts tests/blog-readability.test.ts`, `pnpm typecheck`): **PASS** (19+21+6 = 46 tests; typecheck clean).

## PRD 1016 — blog-watchdog-spotlight-fallback — VERIFIED

| AC | Evidence |
|---|---|
| `cadence.no_new_work_fallback: spotlight`, `cadence.current_post_published_at: authored_at`, `grounding.spotlight_mode_exception` comment | `blog.config.yaml:28-32` (grounding exception), `blog.config.yaml:67-75` (both cadence keys with comments). |
| Pure `spotlight_candidates <registry> <ledger> <cooldown_csv>` ordering never-covered-first then oldest-last-covered, excluding cooldown | `scripts/blog-cadence-watchdog.sh:152-216` (`git show 2903bcd`). Proven by `tests/blog-cadence-watchdog.test.ts:693-793` (5 behavioral cases: excludes cooldown, never-covered-before-covered, oldest-first ordering, empty-when-all-cooldown, empty-ledger handling). |
| Portfolio-mode prompt passes top spotlight candidates, instructs spotlight-on-noop | `scripts/blog-cadence-watchdog.sh` diff hunk adding `SPOTLIGHT_FALLBACK_INSTRUCTIONS` and `SPOTLIGHT_CANDIDATES_TOP3` wiring into `MODE_INSTRUCTIONS` (portfolio branch) and `COOLDOWN_INSTRUCTIONS`; asserted structurally by `tests/blog-cadence-watchdog.test.ts:795-808`. |
| Autonomous prompt requires `published_at = AUTHORED_AT` for non-catchup, and readability-exit-0 gate with 2-retry bound before seeding | `scripts/blog-cadence-watchdog.sh` `REQUIREMENTS` block additions (`published_at (blog.config.yaml cadence.current_post_published_at...)`, `Readability gate (...) up to 2 rewrite-and-recheck cycles...`); asserted by `tests/blog-cadence-watchdog.test.ts:810-820`. |
| New behavioral tests for `spotlight_candidates`; existing watchdog/heartbeat/rail tests unchanged and passing; `bash -n` clean | `tests/blog-cadence-watchdog.test.ts` (75 tests, all passing), `tests/blog-watchdog-heartbeat.test.ts` (8 passing), `bash -n scripts/blog-cadence-watchdog.sh` exits 0. |

Gate (`bash -n`, `pnpm vitest run tests/blog-cadence-watchdog.test.ts tests/blog-watchdog-heartbeat.test.ts tests/blog-editorial-focus-not-content.test.ts tests/blog-plain-language.test.ts`, `pnpm typecheck`): **PASS** (75+8+21+19 = 123 tests; `bash -n` and `tsc` clean).

## PRD 1017 — blog-spotlight-mode-docs — VERIFIED

| AC | Evidence |
|---|---|
| `SKILL.md` Mode decision lists spotlight as 4th mode with subject/grounding rule | `.claude/skills/blog-from-git/SKILL.md:72` (table row) + `SKILL.md:79-83` (explainer para) + frontmatter description updated to "Four modes..." (`SKILL.md:3`). |
| `rotation.md` explains spotlight subject selection (never-covered first, then oldest ledger row, cooldown still applies) + ledger row with mode note | `.claude/skills/blog-from-git/rotation.md:42-63` ("Spotlight mode (Part 0.25)" section, items 1 and 4). |
| `seed.md` states published_at = authored time for portfolio/focused/spotlight, honest backdating catch-up-only, never-`new Date()` rule stays | `.claude/skills/blog-from-git/seed.md:18-24` (`published_at` rule paragraph) + `seed.md:42-44` (spotlight ledger-row note). |
| New `tests/blog-spotlight-mode.test.ts` asserts all three files mention spotlight and config values | Present, 8 tests, all passing (confirms `cadence.no_new_work_fallback === 'spotlight'`, mode-decision table row, rotation.md keyword coverage, seed.md `current_post_published_at` + `new Date()` references). |

Gate (`pnpm vitest run tests/blog-spotlight-mode.test.ts tests/blog-editorial-focus-not-content.test.ts tests/blog-plain-language.test.ts`): **PASS** (8+21+19 = 48 tests).

## Combined re-run of all PRD gates (this validation)

```
timeout 60 bash -n scripts/blog-cadence-watchdog.sh                                            → exit 0
timeout 300 pnpm vitest run tests/blog-readability.test.ts tests/blog-plain-language.test.ts \
  tests/blog-editorial-focus-not-content.test.ts tests/blog-cadence-watchdog.test.ts \
  tests/blog-watchdog-heartbeat.test.ts tests/blog-spotlight-mode.test.ts                      → 6 files, 137 tests, all passed
timeout 300 pnpm typecheck (tsc --noEmit)                                                      → clean, exit 0
```

(`node_modules` was absent in this job's worktree; `pnpm install --frozen-lockfile` resolved instantly from the local pnpm store before running the above — no lockfile or dependency changes resulted.)

## Diff review

`git diff b3eff74641acf20a7106dddd0511b1d9e1e7746b..HEAD --stat`: 12 files changed, 923 insertions, 20 deletions — the 11 files listed across the four PRDs above, plus the one unrelated `social-signals-trader` snapshot file noted above (not this plan's work).

### Code review (`/code-review`, medium)

Two findings, both in `scripts/blog-cadence-watchdog.sh`, both about prompt-text robustness rather than a deterministic logic bug:

- **Important** (`scripts/blog-cadence-watchdog.sh:538`) — `COOLDOWN_INSTRUCTIONS` is built independent of `$MODE`. In catch-up mode, if every candidate with real new work is on cooldown while `spotlight_candidates` is non-empty, the cooldown branch tells the `claude -p` agent to "write the spotlight post described in the mode instructions above" — but catch-up's `MODE_INSTRUCTIONS` (set a few lines earlier) never describes a spotlight post, only a backdated queue. The autonomous agent would receive a self-contradictory prompt in that specific combination of conditions. Scoped to PRD 1016, which this plan's commits added; worth a follow-up PRD to make `COOLDOWN_INSTRUCTIONS`'s spotlight branch mode-aware, but out of scope for this validation to fix.
- **Minor** (`scripts/blog-cadence-watchdog.sh:568`) — the readability gate is enforced by instructing the `claude -p` agent to run the checker and self-report `SEED_RESULT:`, with no independent post-hoc verification by the wrapper script (unlike the git-remote and live-`/api/blog` checks elsewhere in the same script). This is consistent with how every other mechanical rail in this autonomous prompt already works (self-reported, not independently re-verified), so it's a pre-existing pattern this PRD extends rather than a new weakness, but it does mean a non-compliant model run could still report success without the gate having actually run.

Both are plausible-but-narrow prompt-engineering gaps in an LLM-facing instruction string, not a bug in the deterministic bash/TS logic; neither blocks the acceptance criteria, which are about the gate existing and being described correctly, and both read exactly as scoped/specified.

### Security review

No high-confidence findings. The new surface is: (1) `scripts/blog-readability.ts` — reads a local CLI-arg file path and an optional local YAML config via `js-yaml`'s `load()`, which uses the safe schema in v4.1.1 (no custom tags/RCE); no network or untrusted-user input reaches it. (2) `scripts/blog-cadence-watchdog.sh`'s new `spotlight_candidates()` — pipes repo-local JSON/markdown (registry, ledger) through `jq`/`awk`, using slug values only in `[[ == * ]]` string comparisons and output assembly, never in `eval` or a re-interpreted shell context; the resulting strings are consumed only as prompt text handed to `claude -p`, not executed. No externally-controlled input reaches any command-execution context in this diff.

## Findings summary (ranked)

- **Important** — `scripts/blog-cadence-watchdog.sh:538` — catch-up-mode cooldown branch can tell the autonomous agent to follow spotlight instructions that don't exist in catch-up's own mode instructions, under the specific condition of a long gap + cooldown-blocked candidates + non-empty spotlight list.
- **Minor** — `scripts/blog-cadence-watchdog.sh:568` — readability gate relies on agent self-report with no independent re-verification, consistent with the script's existing pattern for other rails.

## Verdicts

VALIDATION: blog-readability-checker VERIFIED
VALIDATION: blog-plain-language-voice VERIFIED
VALIDATION: blog-watchdog-spotlight-fallback VERIFIED
VALIDATION: blog-spotlight-mode-docs VERIFIED
SCHEDULER_VERDICT: PASS
