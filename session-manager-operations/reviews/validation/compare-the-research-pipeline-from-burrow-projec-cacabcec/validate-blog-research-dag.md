# Validation: blog research DAG plan (PRDs 1190-1193)

Base: 8fe9c8c3dd26ece247f2ad405e3256b73e819391. HEAD: 95811b7. PRD files found under `prds-archived/`.
Commits: 5608dff (1190), b8ca8b5 (1192), 7747140 (1191), 74cb781 (1193).
Gates were run from the main checkout (same HEAD 95811b7, tracked files clean), because the job worktree has no `node_modules`.

Gate results (all re-run, foreground):
- `pnpm vitest run` on blog-pipeline-check, blog-readability, blog-plain-language, blog-cadence-watchdog and blog-rewrites: 5 files, 180 tests passed.
- `pnpm exec tsc -p tsconfig.scripts.json`: exit 0.
- `bash -n scripts/blog-cadence-watchdog.sh`: exit 0.
- `loadPipelineConfigFromConfig()` against the real blog.config.yaml: `assert.deepStrictEqual` to `DEFAULT_PIPELINE_CONFIG` passes. `computeBlogBudget(3)` = `{target:530,min:424,max:636}`.

## 1190-blog-pipeline-check-script — VERIFIED
- Exports and CLI: `scripts/blog-pipeline-check.ts` exports `DEFAULT_PIPELINE_CONFIG`, `computeBlogBudget`, `checkPipeline`, `loadPipelineConfigFromConfig` and has the argv guard (lines 276-386). The CLI reads the five artifacts (364-371).
- Budget numbers: confirmed by the run above, 530/424/636.
- Rules R1-R6 and the summary: covered by `tests/blog-pipeline-check.test.ts`, which passes.
- The CLI exits 0 on a valid dir and 1 on an invalid one: the execFileSync tests pass.
- Loader: reads `pipeline:` and `tones.*.max_sections`; falls back to the defaults per key.

## 1191-blog-dag-config-and-skill — VERIFIED
- `blog.config.yaml:155-178`: the `pipeline:` block has the exact keys and default values, with comments.
- Tones (184-195): every tone has `max_sections` (2/3/3/5/3), no `words:` ranges, and keeps `shape` and `payload`.
- Gates (293-303): `3_research`, `4_ground` and `5_draft` name the artifacts, and `5_draft` requires the pipeline-check command to exit 0.
- `dag.md` covers the six steps, the JSON schemas, the budget formula and the drafts-stay-gitignored statement.
- SKILL.md: sub-step rows 3a, 3b, 5a-5d, the pipeline-check self-check line and the folder-map entry. The blog-plain-language tests pass.
- `images.md` says 5d and chooses figures from the outline `figure` field.
- Config equals the code defaults: confirmed above.

## 1192-blog-dag-research-ground-voice — VERIFIED
- `research.md`: step 3a with the template-to-kind table, and step 3b with the exact evidence item shape. The Traps section and push status are kept.
- `ground.md`: the "Community signal (burrow-brain), high-quality only" section. It uses `filters.min_upvotes`, `min_quality`, records `upvotes`/`quality`, and states the three rules.
- `voice.md`: the Length section is replaced by the dynamic budget (50 + 140n + 60, ±20%, clamped 200-1000, LinkedIn 120-250 words, X at most 280 chars). The Length column is now "Max sections" (2,3,3,5,3).
- The plain-language and readability tests pass.
- Cross-doc agreement: question kinds (value, who, how-it-works, proof, next, start, other; required value/who/start), community floors (25 / 0.7), and the budget and channel numbers all match across dag.md, research.md, ground.md, voice.md and blog.config.yaml.

## 1193-blog-watchdog-pipeline-gate — VERIFIED
- `DAG_INSTRUCTIONS` is injected into both prompts. It names dag.md, the five artifacts and the drafts folder, and says never to commit them.
- The autonomous prompt has the pipeline gate with 2 fix cycles and the abort line `SEED_RESULT: error note="pipeline-check"`.
- `run_pipeline_audit`: `timeout 120` per slug, report-only. The heartbeat becomes `warn: ... pipeline-check failed slugs=...` on failure.
- The drafts glob is filtered to regular files. `allowed_commit_paths` is not in the diff, so it is unchanged. `.gitignore:38` ignores `drafts/`.
- `seed.md` has the pre-commit check line and the artifacts-stay-gitignored statement.
- Watchdog tests: 108 pass.

## Findings
### Critical
- None.
### Important
- None.
### Minor
- `.claude/skills/blog-from-git/dag.md` (5c, LinkedIn bullet) says "exactly one `https://` link", but the checker only requires at least one (R6). The docs are stricter than the enforcement. The two should be aligned.
- `scripts/blog-cadence-watchdog.sh` (`run_pipeline_audit`): the slug is interpolated into a path from `SEEDED_SLUGS`, which comes from model output. It is only used as a quoted argument to a read-only checker, so there is no injection, but a slug containing `..` could point the checker outside `drafts/`. A slug-format check would harden it.
- Security and code review were done by self-review (no secrets, no network calls in the checker, JSON.parse errors are mapped to exit 2).
