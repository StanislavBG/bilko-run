# Validation: blog distribution objective + readability gates

Epic: `multiple-publications-on-10-3-this-should-not-ha-e1937593`
Base: `93dbb33` (test(blog): replace cadence-gate regex scan with a behavioral faked-clock test)

**Note on sourcing:** none of the three PRD files (`1049-blog-distribution-objective-policy.md`,
`1050-blog-readability-marketing-and-real-links.md`, `1051-blog-readability-live-link-check.md`)
exist in this worktree — not under the epic's `prds/`, not under `prds-archived/` anywhere in the
tree, and not in git history (`git log --all -- '*1049*' '*1050*' '*1051*'` returns nothing). The
epic directory `session-manager-operations/scheduler/epics/multiple-publications-on-10-3-this-should-not-ha-e1937593/`
itself does not exist in this checkout. Their goal text, acceptance criteria preview, and landed
commit SHAs were recovered from `session-manager-operations/scheduler/state/history.jsonl`
(foreign WIP, read-only), which records all three as `status: "completed", exitCode: 0`:

| slug | landedCommit (history.jsonl) | matches `git log` |
|---|---|---|
| `1049-blog-distribution-objective-policy` | `bc88c34...` | `bc88c34 docs(blog): bake LinkedIn distribution objective into blog pipeline grounding` |
| `1050-blog-readability-marketing-and-real-links` | `7e31838...` | `7e31838 feat(blog): enforce no-marketing-language and real project links in readability gate` |
| `1051-blog-readability-live-link-check` | `e9073aa...` | `e9073aa feat(blog): add --check-live link checker to blog-readability and gate seeding on it` |

Each `landedCommit` prefix matches the corresponding commit in `git log --oneline` exactly, and
each commit sits directly on top of base `93dbb33` in order, so the commit-to-slug mapping is not
in doubt even though the PRD body text is gone. This loss of the PRD source files (no copy in
`prds-archived/`) is itself a finding — see Findings, Minor.

## 1049-blog-distribution-objective-policy — VERIFIED

Goal (from history.jsonl): bake the owner's distribution objective (eventual LinkedIn
double-publishing; language can't be marketing, URLs must be real, the landing page converts)
into the blog pipeline's grounding.

Evidence:
- `distribution:` block exists in `.claude/skills/blog-from-git/blog.config.yaml:23-56`, with the
  owner's verbatim 2026-10-03 quote (lines 24-27), `objective`, `channels` (bilko.run/blog: live,
  linkedin: planned), `syndication_ready: true`, `primary_link`, `no_marketing_language: true`,
  and `marketing_blocklist` (16 phrases).
- `.claude/skills/blog-from-git/voice.md:50-70` — "Written to travel (LinkedIn-ready, no selling)"
  section quotes the same owner direction and states the LinkedIn-readiness rules (no
  "last post"/"see above" references, absolute URLs only, first two sentences carry the cool part,
  no marketing language, no automation/pipeline disclosure).
- `.claude/skills/blog-from-git/SKILL.md:108-111` — the phase-5 self-check gate includes "Zero
  items from the `distribution.marketing_blocklist`" and "Reads complete if pasted into LinkedIn
  with no site context... its one primary link points at the project's real landing page."

All three surfaces (config, voice, SKILL self-check) carry the objective consistently. VERIFIED.

## 1050-blog-readability-marketing-and-real-links — VERIFIED, with one finding

Goal (from history.jsonl): extend `scripts/blog-readability.ts` so a draft fails on any phrase in
`blog.config.yaml` `distribution.marketing_blocklist`, and on any bilko.run project link whose
slug or host kind doesn't match `src/data/standalone-projects.json`.

Evidence:
- `scripts/blog-readability.ts:290-298` (`analyzeReadability`) computes `marketingHits` against
  `thresholds.marketingBlocklist` and folds it into `pass` (line 305).
- `scripts/blog-readability.ts:334-372` (`loadThresholdsFromConfig`) reads
  `doc.distribution.marketing_blocklist` from the live `blog.config.yaml` (line 353-355) when the
  config file parses, which is the live-repo case.
- `scripts/blog-readability.ts:168-201` (`findProjectLinkIssues` + `expectedLinkForm`) matches
  `https://bilko.run/projects/<slug>/` or `/products/<slug>` against the registry's `host.kind`
  (`static-path` → `projects/` + trailing slash; `react-route` → `products/` + no trailing slash),
  flagging an unmatched slug or wrong form as `unknown-project-link`.
- `src/data/standalone-projects.json` (27 entries) has the `{ slug, host: { kind, path, ... } }`
  shape the script expects — confirmed by reading the `outdoor-hours` entry directly.
- `tests/blog-readability.test.ts` and `tests/blog-plain-language.test.ts`: ran
  `npx vitest run tests/blog-readability.test.ts tests/blog-plain-language.test.ts` →
  **52/52 passed**.
- `npx tsc --noEmit -p tsconfig.json` → no errors referencing `blog-readability.ts`.

**Finding (Important) — DEFAULT marketing list does not match `blog.config.yaml`.** The AC for
this validation explicitly asks to check this, and it fails:
`DEFAULT_THRESHOLDS.marketingBlocklist` at `scripts/blog-readability.ts:72` is
`['sign up now', "don't miss", 'game-changer']` (3 phrases), while
`blog.config.yaml` `distribution.marketing_blocklist` (lines 41-56) has 16 phrases (adds `game
changer`, `revolutionary`, `unlock`, `level up`, `supercharge`, `best-in-class`, `world-class`,
`cutting-edge`, `limited time`, `act now`, `buy now`, `skyrocket`, `must-have`). In THIS repo the
drift is masked: `loadThresholdsFromConfig()` always prefers the YAML list when the config file
parses (which it does here), so the live checker never actually falls back to
`DEFAULT_THRESHOLDS`. But the fallback is reachable — the same function's own comment
(`scripts/blog-readability.ts:342`) says "No config file at all is the normal case for most
checkouts" — e.g. any checkout of this script without the `.claude/skills/blog-from-git/`
directory. In that case the drafter's blocklist silently shrinks from 16 phrases to 3, with no
warning. `blog.config.yaml:176-177` documents the same intent for the sibling `jargon_blocklist`
("keep the two lists in sync") but no equivalent comment or sync exists for the marketing list,
and `DEFAULT_THRESHOLDS.jargonBlocklist` does match its yaml counterpart exactly — only the
marketing list drifted.

Given the live-repo path (yaml present) works correctly and all tests pass, the PRD's stated
behavior is VERIFIED; the drifted default is recorded as a finding rather than a refutation.

## 1051-blog-readability-live-link-check — VERIFIED, with one significant finding

Goal (from history.jsonl): add a `--check-live` mode to `scripts/blog-readability.ts` that
requests every absolute https link in a draft and fails the draft if any does not load; gate the
seed step on it.

Evidence:
- `scripts/blog-readability.ts:213-255` (`collectHttpsLinks`, `checkLiveLinks`) collects every
  markdown-link target and bare `https://` URL, fetches each (15s timeout, 20-link cap, status
  200-399 required), and `main()` (lines 396-408) returns a non-zero exit when any fetch fails or
  the static report didn't already pass.
- `.claude/skills/blog-from-git/seed.md:41-43` (diff `93dbb33..e9073aa`) adds
  `npx tsx scripts/blog-readability.ts <draft.md> --check-live` to the seed sequence, with a STOP
  instruction on failure, before the commit/push lines.
- Real run #1 — passing case, required by the validation AC:
  ```
  $ npx tsx scripts/blog-readability.ts /tmp/validate-1052/good-draft.md --check-live
  ... "pass": true
  EXIT_CODE=0
  ```
  (draft links `https://bilko.run/projects/outdoor-hours/`, a real registered project)
- Real run #2 — failing case, required by the validation AC:
  ```
  $ npx tsx scripts/blog-readability.ts /tmp/validate-1052/bad-draft.md --check-live
  ... "linkIssues": [{ "kind": "unknown-project-link", "text": "https://bilko.run/projects/does-not-exist-xyz/" }]
  EXIT_CODE=1
  ```
- `tests/blog-readability.test.ts` includes `checkLiveLinks` unit tests (passed, see above),
  including "fails on an aborted/timed-out request".

Both required real runs behave as specified (exit 0, exit 1). VERIFIED.

**Finding (Important) — the live-check itself cannot detect a fake bilko.run page; the exit-1
above is borrowed from PRD 1050's registry check, not from liveness.** The validation AC
anticipated this and asked to record it if true. Confirmed:
```
$ curl -s -o /dev/null -w "%{http_code}" https://bilko.run/projects/does-not-exist-xyz/
200
$ curl -s -o /dev/null -w "%{http_code}" https://bilko.run/this-path-truly-does-not-exist-anywhere-404-test
200
```
bilko.run's static/SPA serving returns HTTP 200 for *any* path, including ones with no route at
all. I isolated `--check-live` from the registry check by using a bilko.run URL that doesn't match
`PROJECT_LINK_RE` (so `findProjectLinkIssues` never runs on it) and confirmed the live check alone
passes it:
```
$ npx tsx scripts/blog-readability.ts /tmp/validate-1052/live-only-bad.md --check-live   # bare bilko.run/<bogus-path>
... "pass": true
EXIT_CODE=0
```
Compare to a genuinely dead external link (GitHub 404), where the live check does catch it on its
own:
```
$ npx tsx scripts/blog-readability.ts /tmp/validate-1052/live-external-bad.md --check-live   # dead github.com/<repo>
blog-readability: live link check failed:
  https://github.com/StanislavBG/this-repo-should-not-exist-404-test -> 404
EXIT_CODE=1
```
Net effect: `--check-live` does its job for non-bilko.run links (GitHub, etc.), but for
`bilko.run/projects/*` and `bilko.run/products/*` links — the exact links `distribution.objective`
cares about most, since those are the "let the landing page convert" URLs — all liveness
protection currently comes from the registry check (1050), not from the live-HTTP check this PRD
built. If PRD 1050's registry check were ever removed or a slug were typo'd into an existing
*different* real project's URL form (passing the registry check) that nonetheless 404s for some
other reason, `--check-live` would not catch it, because bilko.run always answers 200.

## Combined diff review

`git diff 93dbb33..e9073aa --stat`:
```
 .claude/skills/blog-from-git/SKILL.md              |   4 +
 .claude/skills/blog-from-git/blog.config.yaml      |  39 ++++-
 .claude/skills/blog-from-git/seed.md               |   3 +
 .claude/skills/blog-from-git/voice.md              |  33 ++++
 scripts/blog-readability.ts                        | 169 +++++++++++++++++++--
 .../validate-blog-min-gap-wave3.md                 | 151 ++++++++++++++++++
 tests/blog-readability.test.ts                     | 138 ++++++++++++++++-
 7 files changed, 524 insertions(+), 13 deletions(-)
```
(`validate-blog-min-gap-wave3.md` is an unrelated sibling validation doc from commit `51dfd4d`
inside this commit range — not part of any of the three PRDs under review here, and docs-only.)

`/code-review` and `/security-review` slash commands are not available as tools in this headless
session; self-reviewed the diff instead. `checkLiveLinks` fetches URLs extracted from the draft
file the pipeline itself authored (not third-party/attacker-controlled input), bounds concurrency
with a 20-link cap and a 15s per-request timeout, and does nothing with the response body beyond
the status code — no SSRF-relevant sink, no secret handling, no injection surface. `loadThresholdsFromConfig`
and `loadProjectRegistry` both fail closed to safe defaults (`DEFAULT_THRESHOLDS`, `[]`) on a
missing/malformed file rather than throwing. No other correctness issues found.

## Findings (ranked)

1. **Important — `scripts/blog-readability.ts:72` `DEFAULT_THRESHOLDS.marketingBlocklist` (3
   phrases) drifts from `blog.config.yaml:41-56` `distribution.marketing_blocklist` (16 phrases).**
   Masked today because this repo always has the config file, but the fallback path
   (`scripts/blog-readability.ts:342-344`) is real and used by any checkout without
   `.claude/skills/blog-from-git/`. Fix: copy the 16-phrase list into `DEFAULT_THRESHOLDS`, same as
   `jargonBlocklist` already matches its yaml counterpart.

2. **Important — `--check-live` provides no actual liveness protection for `bilko.run/projects/*`
   and `bilko.run/products/*` links**, because bilko.run returns HTTP 200 for any path (confirmed
   via `curl` above). Today this is covered only because PRD 1050's registry check
   (`findProjectLinkIssues`) independently rejects any slug not in `standalone-projects.json`. If
   that check is ever bypassed, weakened, or if a draft links a real registered slug under the
   wrong path (e.g. a typo that still matches some other real project's form), `--check-live`
   would not catch it. Not a regression from this PRD's stated goal (it does correctly check
   external hosts), but the goal's framing — "urls need be real... we let the landing page
   convert" — is only enforced for bilko.run links by the *other* PRD's registry check, not by
   this one's HTTP check. Worth a one-line comment at minimum noting bilko.run's catch-all 200 so
   a future reader doesn't assume `--check-live` alone verifies a real `/projects/` page.

3. **Minor — none of PRDs 1049/1050/1051's source files survived anywhere in the tree** (not in
   `prds/`, not in `prds-archived/`, not in git history), and the epic directory itself is absent
   from this checkout. Recovered their goal text and landed-commit SHAs from
   `scheduler/state/history.jsonl` instead. If PRD archival is supposed to retain a copy per the
   acceptance-criteria text's own "or prds-archived/" fallback, that step did not happen for this
   epic's three PRDs — worth checking whether the scheduler's archival step has a gap, or whether
   this epic's PRDs were deleted by a cleanup pass that shouldn't have touched them.

## Sentinel

VALIDATION: 1049-blog-distribution-objective-policy VERIFIED
VALIDATION: 1050-blog-readability-marketing-and-real-links VERIFIED
VALIDATION: 1051-blog-readability-live-link-check VERIFIED
SCHEDULER_VERDICT: PASS
