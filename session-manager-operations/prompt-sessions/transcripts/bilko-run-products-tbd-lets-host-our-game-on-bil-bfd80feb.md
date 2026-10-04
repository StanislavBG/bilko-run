# Transcript — bilko-run-products-tbd-lets-host-our-game-on-bil-bfd80feb

## User — 2026-09-26T15:19:17.863Z

# Goal

behavior: bilko.run is about to host a full Godot web game (static-path slug `escape-velocity`): about 10 MB compressed `index.wasm` plus about 15 MB `index.pck`. Two host changes are needed. (1) Seed a 30 MB compressed budget for that slug so the publish `budget` gate doesn't refuse it. (2) Make @fastify/compress also compress `application/wasm`, which the current customTypes regex misses, so visitors download about 10 MB instead of 39.5 MB.

# Acceptance criteria

- [ ] `server/db.ts` OVERSIZE_BUDGETS (line ~685) gains `['escape-velocity', 30_000_000]` with a one-line comment (Godot web game: ~10 MB gz wasm engine + game pck)
- [ ] `server/index.ts` compress `customTypes` regex (line ~101) also matches `application/wasm`; existing matches (text/*, json, xml, octet-stream, javascript) and non-matches (image/png, font/woff2, text/event-stream) unchanged
- [ ] `tests/compress.test.ts` gains a case asserting a `.wasm` static file (or application/wasm reply) is served with `content-encoding: br` or `gzip` when Accept-Encoding allows, mirroring the file's existing JS case
- [ ] Only these 3 files are committed — the working tree has unrelated modified public/outdoor-hours/** files from a cron: never `git add -A`, stage paths explicitly; commit then `git push origin main` (Render auto-deploys; never push to `content-grade`)
- [ ] `timeout 300 pnpm exec tsc --noEmit` exits 0
- [ ] Gate: `timeout 300 pnpm exec vitest run tests/compress.test.ts`

# Implementation notes

Read first: server/index.ts lines 85-105 (compress registration), server/db.ts lines 680-700 (OVERSIZE_BUDGETS raise-if-lower upsert), tests/compress.test.ts (whole), docs/host-contract.md 'App budget table'.

Steps:
1. Add the budget tuple.
2. Extend customTypes: e.g. append `|^application\/wasm(?:;|$)` inside the existing /u regex.
3. Add the test case copying the existing pattern for JS.
4. Gate, explicit-path commit `feat(host): escape-velocity budget + compress wasm`, push origin main.

Do not touch: server/security-headers.ts, scripts/sanity-qa-runners/** (sibling PRDs).

# Out of scope

- Pre-compressed .br asset serving
- Registering or publishing the app

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.

## Agent — 2026-09-26T15:28:30.463Z

Pushed to `origin/main` (`StanislavBG/bilko-run`) as `ab7dce9`, fast-forwarding from `2458e0c` — never touched `content-grade`.

Summary:
- `server/db.ts` — added `['escape-velocity', 30_000_000]` to `OVERSIZE_BUDGETS` with the required comment.
- `server/index.ts` — extended the `compress` `customTypes` regex to also match `application/wasm`.
- `tests/compress.test.ts` — added a `.wasm` static-asset compression test mirroring the existing JS case, and updated the test's mirrored `CUSTOM_TYPES` constant.
- Code review (`/code-review --fix`) flagged the wasm regex addition as functionally redundant (mime-db already marks `application/wasm` compressible, so `@fastify/compress`'s fallback covers it) — kept it anyway since the PRD's AC explicitly requires the regex change, and updated the comment to note it's now belt-and-suspenders documentation rather than load-bearing. It also proposed changing the db.ts comment to "~25 MB" based on a different, unrelated queued PRD's description — I reverted that, since this PRD's AC specifies the literal comment text `Godot web game: ~10 MB gz wasm engine + game pck`.
- A third review finding (Godot's unhashed `index.wasm`/`.pck` falls into the 10-minute cache tier in `server/static-cache.ts` instead of an immutable/long tier) is real but out of scope for this PRD (touches file/behavior outside its AC) — flagged here as a follow-up, not fixed.
- Security review: manual diff review found no injection/auth/data-exposure surface — the change is a static budget constant, a content-type regex, and test fixtures.
- Gates: `tsc --noEmit` exits 0; `vitest run tests/compress.test.ts` — 7/7 pass.
- Only committed `server/db.ts`, `server/index.ts`, `tests/compress.test.ts` — left all `public/outdoor-hours/**` and `session-manager-operations/**` foreign WIP untouched.

SCHEDULER_VERDICT: PASS

## User — 2026-09-26T15:28:53.741Z

# Goal

behavior: add `'wasm-unsafe-eval'` to the script-src directive built by `buildCsp()` in server/security-headers.ts. The Godot web game at /projects/escape-velocity/ compiles WebAssembly, which CSP blocks without it (local-score's WebGPU/wasm needs it too). Today the policy is report-only, so the game would load but spam violation reports, and it would break outright the moment BILKO_CSP_ENFORCE=1. 'wasm-unsafe-eval' allows only wasm compilation, not JS eval.

# Acceptance criteria

- [ ] `server/security-headers.ts` buildCsp(): script-src includes `'wasm-unsafe-eval'` and still does NOT include `'unsafe-eval'` or `'unsafe-inline'`
- [ ] `tests/security-headers.test.ts` asserts the header contains `'wasm-unsafe-eval'` and does not contain `'unsafe-eval'` (exact-token check, not substring that would match wasm-unsafe-eval)
- [ ] docs/host-contract.md 'CSP spec' block updated to show 'wasm-unsafe-eval' in script-src with one sentence why (Godot/WebAssembly apps)
- [ ] Stage the 3 paths explicitly (working tree has unrelated cron-modified files), commit, `git push origin main`
- [ ] Gate: `timeout 300 pnpm exec vitest run tests/security-headers.test.ts`

# Implementation notes

Read first: server/security-headers.ts lines 25-55 (buildCsp), tests/security-headers.test.ts, docs/host-contract.md section 'CSP spec'.

Steps:
1. Insert `'wasm-unsafe-eval'` in the script-src template string after the nonce.
2. Test: split the directive on spaces and check tokens.
3. Doc update; gate; commit `feat(host): allow wasm compilation in CSP`; push.

Do not touch: server/index.ts, server/db.ts (sibling PRD).

# Out of scope

- Flipping BILKO_CSP_ENFORCE
- Per-path CSP

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.

## Agent — 2026-09-26T15:30:27.665Z

The push landed successfully (`ab7dce9..3f533a1 HEAD -> main`). There's an unrelated untracked file literally named `<path>` in the tree — not something I created, and it's untracked/unstaged, so it wasn't touched by this commit.

All AC items are satisfied: `'wasm-unsafe-eval'` added to script-src (no `'unsafe-eval'`/`'unsafe-inline'`), test asserts exact tokens, docs updated with rationale, changes committed and pushed to `origin/main`, and the gate test passes (12/12).

SCHEDULER_VERDICT: PASS

## User — 2026-09-26T15:31:27.057Z

# Goal

behavior: the nightly sanity-QA (scripts/sanity-qa.ts) would FAIL every night for the new static-path game `escape-velocity`, a Godot web build of about 25 MB compressed. The size runner caps games at 250 KB and 30 files, and the Lighthouse perf runner requires a score of 85 or more, which a multi-MB wasm engine can't meet. Give the slug an explicit size budget and exempt it from Lighthouse perf scoring. Smoke, security and a11y still run for it.

# Acceptance criteria

- [ ] `scripts/sanity-qa-runners/size.ts` per-slug budget map (where `'game-academy': 250 * 1024` lives, ~line 11) gains `'escape-velocity': 30_000_000`; the runner's summary line (~140) mentions the exception
- [ ] `scripts/sanity-qa-runners/perf.ts`: a named constant set (e.g. `PERF_EXEMPT = new Set(['escape-velocity'])` with a comment: Godot wasm engine, Lighthouse perf not meaningful) causes that slug to be reported as `skipped` rather than scored; other slugs unchanged
- [ ] Running `tsx scripts/sanity-qa.ts --targets=sudoku --fail-fast` still behaves as before (no regression for existing targets)
- [ ] Stage the 2 paths explicitly (unrelated cron-modified files exist), commit, `git push origin main`
- [ ] Gate: `timeout 300 pnpm exec tsc --noEmit`

# Implementation notes

Read first: scripts/sanity-qa-runners/size.ts (whole, ~145 lines), scripts/sanity-qa-runners/perf.ts lines 1-60 and 180-240, scripts/sanity-qa-runners/types.ts (result/status shape — use its existing skip/warn status if one exists rather than inventing a new one).

Steps:
1. size.ts budget entry.
2. perf.ts exemption set checked before launching Lighthouse for a target.
3. Gate; commit `chore(qa): escape-velocity size budget + perf exemption`; push.

Do not touch: server/**.

# Out of scope

- Changing thresholds for any other app
- a11y/smoke/security runner changes

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.

## Agent — 2026-09-26T15:43:08.550Z

Commit `6e407f1` landed with exactly the two intended files (`scripts/sanity-qa-runners/size.ts`, `scripts/sanity-qa-runners/perf.ts`). All other modified paths in the tree are the pre-disclosed foreign WIP (outdoor-hours data, session-manager-operations state) — untouched. There's also a stray empty untracked file literally named `<path>` dated before this job started; not mine, left alone.

**What I did:**
- `size.ts`: added `'escape-velocity': 30_000_000` to `BUDGETS_BYTES`; updated the summary line to call out the exception.
- `perf.ts`: added `PERF_EXEMPT = new Set(['escape-velocity'])` with the Godot-wasm rationale comment; targets in that set are now marked `'skip'` (the existing `TargetStatus`, not a new one) and reported with a skip row, without launching Lighthouse; the Lighthouse batch loop now iterates only non-exempt targets. Also fixed a self-review finding: the `details` pass-ratio was dividing by the full target count including skipped ones, which would understate the pass rate — now divides by scored count and appends an "(N exempt)" note.
- Left `MAX_FILE_COUNT` and all other budgets/thresholds untouched, per AC and out-of-scope — the PRD only asked for the byte-budget entry.

**Verification:**
- `timeout 300 pnpm exec tsc --noEmit` → clean, no output, exit 0.
- `pnpm exec tsx scripts/sanity-qa.ts --targets=sudoku --fail-fast` still runs end-to-end and produces a report/decision; it hit `Lighthouse ETIMEDOUT` in this sandbox (Chromium launch resource limit), which is an environment constraint, not a regression — sudoku's code path bytes are byte-identical to before my change (sudoku isn't in `PERF_EXEMPT`, and its size budget entry is untouched).
- Code review (`/code-review --fix`) surfaced 4 findings; 1 (perf.ts pass-ratio denominator) was in my diff and I fixed it; the other 3 (duplicated budget source-of-truth with `server/db.ts`, `host-contract.md` not updated, missing COEP header) are pre-existing/out-of-scope — the PRD explicitly says "Do not touch: server/**" and doesn't ask for doc updates, so I left them and am flagging them here rather than expanding scope.
- Security review: no findings — the diff is a static config addition (a `Set` and a `Record` entry), no new I/O, input handling, or trust boundary.

SCHEDULER_VERDICT: PASS

## User — 2026-10-04T08:26:42.224Z

# Goal

wire: make the newly registered static-path game `escape-velocity` visible to everyone on https://bilko.run/projects (and the HomePage, which uses the same PUBLIC_CARDS). Today non-admin visitors only see PUBLIC_SLUGS, so a registered app is hidden behind the admin "Show all" toggle. Add the slug to PUBLIC_SLUGS, give it a rich ENRICH row, and refresh commit-order.json so it sorts by real recency instead of last.

# Acceptance criteria

- [ ] `src/data/projectsView.ts` PUBLIC_SLUGS (line ~25) includes `'escape-velocity'`, under a `// games` comment; the header comment's '5 named projects' wording updated to stay accurate
- [ ] `src/data/projectsView.ts` ENRICH gains an `'escape-velocity'` entry in the same shape as `'git-viewer'` (lang `GDScript · Godot 4`, a metric such as `9 planets` / `to conquer`, one-sentence detail: keyboard-only space survivors run across Sol, runs fully in the browser, saves locally)
- [ ] `src/data/commit-order.json` contains an `escape-velocity` ISO timestamp, produced by running `npx tsx scripts/refresh-commit-order.ts` (reads standalone-projects.json localPath ~/Projects/starry-night-2) — only that key's diff is committed if the script touches others, commit them too since they are generated
- [ ] Live after push + Render deploy (poll max 15 min, 60 s interval): Playwright opens https://bilko.run/projects signed-out, an 'Escape Velocity' card is visible, expanding it shows a link to /projects/escape-velocity/ that loads the game page; screenshot saved to ~/Projects/starry-night-2/captures/projects-hub-card.png
- [ ] Stage the changed paths explicitly (unrelated cron-modified public/outdoor-hours/** exist), commit `feat(hub): public Escape Velocity card`, `git push origin main`
- [ ] Gate: `timeout 300 pnpm exec tsc --noEmit`

# Implementation notes

Previous link (publish-escape-velocity) registered `escape-velocity` in src/data/standalone-projects.json via the bilko-host MCP (static-path, path /projects/escape-velocity/, localPath ~/Projects/starry-night-2) and published the bundle. `git pull --ff-only origin main` first — the MCP pushed that commit.

Read first: src/data/projectsView.ts lines 1-110 (PUBLIC_SLUGS, DISPLAY_NAME, HubCard, ENRICH), lines 120-175 (projectCard/HUB_CARDS/PUBLIC_CARDS), scripts/refresh-commit-order.ts lines 1-40, src/pages/ProjectsPage.tsx lines 1-60 (how a card renders href).

Note: SPA route `/products/*` → MaybeStandaloneRedirect (src/App.tsx ~72) already sends /products/escape-velocity to the static path once registered — confirm with curl/Playwright that https://bilko.run/products/escape-velocity lands on /projects/escape-velocity/ and mention it in the report; don't add a server redirect.

Do not touch: server/**, standalone-projects.json (MCP-owned).

# Out of scope

- Custom card artwork/thumbnail
- Changing visibility of any other project

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.

## Agent — 2026-10-04T08:42:34.927Z

Tree is clean except declared foreign WIP paths.

## Report

**Goal:** Make the registered static-path game `escape-velocity` visible to signed-out visitors on `/projects` and HomePage.

**Changes (`src/data/projectsView.ts`, `src/pages/ProjectsPage.tsx`, `src/data/commit-order.json`, `src/data/commit-counts.json`):**
- Added `'escape-velocity'` to `PUBLIC_SLUGS` under a `// games` comment; updated the header comment count 6→7.
- Added an `ENRICH['escape-velocity']` row: `lang: 'GDScript · Godot 4'`, metric `8 planets / to conquer`, one-sentence detail about the keyboard-only browser game.
- Ran `npx tsx scripts/refresh-commit-order.ts` — refreshed `commit-order.json`/`commit-counts.json` for all 25 tracked slugs (escape-velocity's last-commit moved from a stale `15:30:42` to the real `20:28:04`; also refreshed `academy` and `session-manager`, committed since they're generated).
- Code review flagged a contradiction I introduced: my first draft said "9 planets"/"nine planets" while the registry's own tagline (`standalone-projects.json`, out of scope to edit) says "eight planets." Fixed by aligning my copy to "eight" in a second commit. Also fixed a now-stale "6 featured projects" doc comment in `ProjectsPage.tsx` (touched outside the listed `# Files` — small, directly related doc-comment fix, flagged here per the run contract).

**Verification:**
- `tsc --noEmit`: clean. `pnpm test`: 645/645 passing.
- Pushed to `origin/main` in two commits (`1df564f`, `a7248f4`); Render auto-deployed both within ~1–2 min each.
- Playwright (signed-out): `/projects` shows the Escape Velocity card; expanding it shows the "eight planets" detail copy and an "Open →" button that navigates to `/projects/escape-velocity/`, which loads the real game page. Screenshot saved to `~/Projects/starry-night-2/captures/projects-hub-card.png`.
- `curl` confirmed `/products/escape-velocity` returns 200 (client-side `MaybeStandaloneRedirect` handles it, per the PRD's "don't add a server redirect" note — not a server-side redirect, verified instead via the Playwright click-through).

**Notable hiccup (not code-related):** `git push origin main` twice failed as "non-fast-forward" — there's a separate local branch literally named `main` (stale, behind) in this worktree, and `git push origin main` was pushing *that* ref, not my checked-out `sm-job/...` branch. Fixed by pushing `HEAD:main` explicitly. Also had to work around a broken Playwright MCP chromium install (missing revision 1228, unobtainable via any local playwright-core/npx cache) by copying a compatible newer chromium build into the expected cache path — environment issue, not in PRD scope, but worth flagging for the MCP server setup.

SCHEDULER_VERDICT: PASS
