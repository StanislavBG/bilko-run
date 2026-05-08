# Rollout plan: npm packages + bilko.run registry

Authoritative tracker for two parallel rollouts: (1) publishing developer-facing CLIs and libraries to npm, and (2) registering existing sibling projects on bilko.run so the portfolio is complete. Designed to be picked up incrementally by the `schedule` skill — one item per run, mark DONE in this file, commit, move on.

**Status legend:** ⬜ pending · 🟡 in progress · ✅ done · ⏸ blocked

---

## Part A — npm packages

### Audit table

| # | Package | Source | npm registry status | Local version | Action | Status |
|--:|---|---|---|---|---|---|
| A1 | `stepproof` | `~/Projects/Preflight/packages/stepproof/` | `0.5.0` live | `0.5.0` | nothing — already in sync | ✅ |
| A2 | `claude-code-session-manager` | `~/Projects/session-manager/` | `0.8.1` live | `0.8.1` | bump + publish (version delta) | ✅ |
| A3 | `bilko-flow` | `~/Projects/bilko-flow/` | `0.3.1` live | `0.3.1` | verify in-sync, bump if needed | ✅ |
| A4 | `@bilkobibitkov/agent-trace` | `~/Projects/Preflight/packages/agent-trace/` | not in scope | `0.4.4` | first publish under scope | ⬜ |
| A5 | `@bilkobibitkov/agent-comply` | `~/Projects/Preflight/packages/agent-comply/` | not in scope | `0.2.13` | first publish under scope | ⬜ |
| A6 | `@bilkobibitkov/agent-gate` | `~/Projects/Preflight/packages/agent-gate/` | not in scope | `0.2.10` | first publish under scope | ⬜ |
| A7 | `agent-shift` | `~/Projects/Preflight/packages/agent-shift/` | not in registry | `0.2.3` | first publish (unscoped, matches name) | ⬜ |
| A8 | `@bilkobibitkov/preflight-license` | `~/Projects/Preflight/packages/license/` | not in scope | `1.0.3` | first publish under scope | ⬜ |
| A9 | `@bilkobibitkov/host-kit` | new — extract from siblings | not yet | n/a | create, publish, migrate 9 siblings to depend on it | ⬜ |

**Net delta after this rollout:** 3 → 11 published packages.

### Per-package execution plan

#### A2 — `claude-code-session-manager` 0.7.1 → 0.8.0

Single command, verifying first.

```
cd ~/Projects/session-manager
npm whoami                       # confirm logged in as bilkobibitkov
git status                       # must be clean
npm run build                    # rebuild dist/ with current source
npm pack --dry-run               # inspect what files will ship; check size
npm publish --access public
git tag v0.8.0 && git push --tags
```

Verify: `npm view claude-code-session-manager version` returns `0.8.0`.

#### A3 — `bilko-flow` (verify, possibly bump)

```
cd ~/Projects/bilko-flow
cat package.json | grep version  # compare to npm view bilko-flow version
# if equal: nothing to do, mark ✅
# if local > npm: build, publish, tag
```

#### A4–A8 — Preflight CLIs (5 packages)

All five follow the same shape; do them serially in one routine run after A2/A3 prove the publish flow is healthy. The Preflight monorepo uses `pnpm-workspace.yaml`, so build from the package root, not the monorepo root.

```
cd ~/Projects/Preflight/packages/<pkg>
pnpm install                     # ensure deps current
pnpm build                       # produce dist/
npm pack --dry-run               # check files: should include bin/, dist/, README, LICENSE
# If dry-run looks clean:
npm publish --access public      # scoped pkgs default to private; --access public is required
```

Order to publish:
1. `@bilkobibitkov/preflight-license` (A8) — others depend on it
2. `@bilkobibitkov/agent-trace` (A4) — observability primitive
3. `@bilkobibitkov/agent-comply` (A5)
4. `@bilkobibitkov/agent-gate` (A6)
5. `agent-shift` (A7)

Verify each: `npm view <pkg-name> version`.

#### A9 — `@bilkobibitkov/host-kit` (new package)

The drift-killer. Currently 9 sibling repos each carry a hand-edited copy of `kit.tsx` (ToolHero, ScoreCard, SectionBreakdown, CompareLayout, Rewrites, CrossPromo, `track`, `useToolApi`). Publishing collapses those into one dependency.

**Phase 1 — create the package (one routine run):**

1. `mkdir -p ~/Projects/Bilko-Host-Kit/{src,dist}` and `cd ~/Projects/Bilko-Host-Kit`
2. `package.json` with `"name": "@bilkobibitkov/host-kit"`, `"version": "0.1.0"`, peer deps on `react@^18`, `@clerk/clerk-react@^5`
3. Copy the most complete kit (use `~/Projects/Headline-Grader/src/kit.tsx` as the canonical source — it has all 6 components) into `src/index.ts`. Strip the theme-baked-in colors; accept `theme: { heroGradient, glowColor, accentText, ... }` as a prop.
4. Build with `tsup` → emits `dist/index.js` + `dist/index.d.ts` (CJS + ESM + types).
5. `git init`, push to `github.com/StanislavBG/bilko-host-kit`.
6. `npm publish --access public`.

**Phase 2 — migrate one sibling as proof (one routine run):**

Pick `~/Projects/Stack-Audit/` (smallest paid sibling). Replace its local `src/kit.tsx` import with `import { ToolHero, ScoreCard, ... } from '@bilkobibitkov/host-kit'`. Keep `src/index.css` for tokens. Build, verify visual parity, push.

**Phase 3 — migrate remaining 8 siblings (eight routine runs, one per sibling):**

Same recipe as Phase 2 for: Launch-Grader, Ad-Scorer, Headline-Grader, Thread-Grader, Email-Forge, Audience-Decoder, Page-Roast, Stepproof. Each becomes one scheduled item.

---

## Part B — bilko.run registry additions

### Audit table

These projects exist locally but are not in `src/data/standalone-projects.json`. Each needs an entry; some get a representative landing page, others just a card.

| # | Project | Local path | Host kind | Slug / path | Action | Status |
|--:|---|---|---|---|---|---|
| B1 | Session Manager | `~/Projects/session-manager/` | `external-url` | npm + GitHub link | JSON entry only | ⬜ |
| B2 | bilko-flow | `~/Projects/bilko-flow/` | `external-url` | npm link | JSON entry only | ⬜ |
| B3 | BGLabs | `~/Projects/BGLabs/` | `external-url` | https://bglabs.app | JSON entry only | ⬜ |
| B4 | Provocations | `~/Projects/Provocations/` | `external-url` | (resolve URL — bglabs subroute? own domain?) | JSON entry, after URL is decided | ⬜ |
| B5 | review-pilot | `~/Projects/review-pilot/` | `external-url` | (own SaaS domain — confirm) | JSON entry only | ⬜ |
| B6 | Preflight | `~/Projects/Preflight/site/` | `external-url` | (preflight site URL — confirm) | JSON entry only | ⬜ |
| B7 | Local-Browser-Automation | `~/Projects/Local-Browser-Automation/` | _skip_ | private utility | no entry | n/a |

### Per-project execution plan

Each B-item is identical in shape — one append to `src/data/standalone-projects.json`. The schema is in `docs/host-contract.md`. Template:

```json
{
  "slug": "<kebab-slug>",
  "name": "<DisplayName>",
  "tagline": "<≤80 char one-liner>",
  "category": "<AI Tool · X | Tool · Y | App · Z>",
  "status": "live",
  "year": 2026,
  "host": {
    "kind": "external-url",
    "url": "https://<final-url>",
    "sourceRepo": "github.com/StanislavBG/<repo>"
  },
  "tags": ["<tag1>", "<tag2>"]
}
```

Concrete bodies for B1–B6:

**B1 — Session Manager**
```json
{ "slug": "session-manager", "name": "Session Manager",
  "tagline": "Local cockpit for Claude Code CLI sessions",
  "category": "Dev Tool · CLI", "status": "live", "year": 2026,
  "host": { "kind": "external-url",
    "url": "https://www.npmjs.com/package/claude-code-session-manager",
    "sourceRepo": "github.com/StanislavBG/session-manager" },
  "tags": ["Electron", "CLI", "Free"] }
```

**B2 — bilko-flow**
```json
{ "slug": "bilko-flow", "name": "bilko-flow",
  "tagline": "Deterministic workflows from natural-language goals",
  "category": "Dev Tool · Library", "status": "live", "year": 2026,
  "host": { "kind": "external-url",
    "url": "https://www.npmjs.com/package/bilko-flow",
    "sourceRepo": "github.com/StanislavBG/bilko-flow" },
  "tags": ["TypeScript", "Workflows"] }
```

**B3 — BGLabs**
```json
{ "slug": "bglabs", "name": "BGLabs",
  "tagline": "Generate dynamic background animations with AI",
  "category": "AI Tool · Design", "status": "live", "year": 2026,
  "host": { "kind": "external-url", "url": "https://bglabs.app",
    "sourceRepo": "github.com/StanislavBG/bglabs" },
  "tags": ["Canvas", "Animation"] }
```

**B4 — Provocations:** confirm public URL with user before scheduling.
**B5 — review-pilot:** confirm SaaS domain (see CLAUDE.md says "Google review response SaaS, $49–79/mo" — needs URL).
**B6 — Preflight:** confirm site URL (could be bilko.run-hosted via the `Preflight/site/` static, or its own domain).

Do B1, B2, B3 first (URLs known). B4–B6 wait on a 30-second confirmation reply.

After each: rebuild host (`pnpm exec vite build`), commit `Registry: add <Project>`, push to both remotes. Render redeploys; the `/projects` page shows the new card automatically (verified pattern).

---

## Part C — Representative page on bilko.run

Add **`/packages`** — a public page that lists every npm package Bilko ships, with install commands and descriptions. Feels like the "OS app store" framing the user asked about earlier, scoped to dev tools.

### Design

- Route: `/packages` in the host SPA (new `<PackagesPage>` component, same `<Layout>` chrome).
- Source of truth: a new `src/data/packages.ts` with one entry per published package (name, description, install command, GitHub link, latest version, gated free-tier or paid).
- Layout: vertical list of cards. Each card has:
  - Icon / monogram (per package)
  - Name + one-line description (from `package.json` `description`)
  - Install snippet with copy-to-clipboard: `npm i @bilkobibitkov/agent-trace` (or `npx <pkg>` for CLIs)
  - Latest version badge (manually updated; or fetched from npm at build time via a `scripts/fetch-versions.ts`)
  - Two links: GitHub repo + npm page
- Header copy: "Bilko's open-source packages — install with one line, use locally, no signup."
- Footer of page: link to the `Preflight` site for the orchestration story.

### Implementation steps (one routine run, after at least 4–5 packages are published)

1. `src/data/packages.ts` — typed array with the 8–11 published packages.
2. `src/pages/PackagesPage.tsx` — read the data, render cards. ~150 LOC.
3. `src/App.tsx` — register the route under `Layout` (sibling to `BlogPage`, `PricingPage`).
4. `src/components/Layout.tsx` — add a "Packages" link in the nav (between Projects and Blog).
5. `src/data/portfolio.ts` SECTIONS — append `{ id: 'packages', label: 'Packages', path: '/packages', icon: '⊟', desc: 'CLI tools and libraries — npm install and you have them.', tag: '<N> live' }`.
6. Optional: `scripts/fetch-versions.ts` runs at build time to fetch latest versions from npm registry and inline them, so versions don't go stale.

Defer: a `/packages/<slug>` detail page (overkill for now — the npm page is the canonical detail page).

---

## Part D — Schedule (for the `schedule` skill)

This rollout is designed to be paced, not blasted. Each item is small enough to fit in one scheduled run (≤30 min of agent work), and each commits/pushes its own result so progress is visible between runs.

### Recurrence

**Daily routine, weekdays only, 9:00 AM Pacific** — one scheduled remote agent that:

1. Reads this file (`docs/rollout-plan.md`).
2. Finds the first ⬜ item top-to-bottom.
3. Executes its plan section.
4. On success: rewrites the row's status to ✅, prepends a one-line note in a "Run log" section at the bottom of this file with the date and what shipped, commits + pushes to both remotes.
5. On failure: leaves the row at 🟡 with a comment in the run log explaining what blocked.
6. Stops after one item per run (no chaining).

Why daily, weekday-only, single-item: avoids npm hitting publish rate limits, lets the user catch a regression on the live site before a second item piles on, keeps token cost predictable.

### Item ordering (drives execution order)

Phase 1 — npm publishes (low-risk, mostly mechanical):
A2 → A3 → A8 → A4 → A5 → A6 → A7

Phase 2 — registry additions (visible to users immediately):
B1 → B2 → B3 (then pause for B4–B6 URL confirmations)

Phase 3 — host-kit (architectural):
A9 phase-1 (publish) → A9 phase-2 (Stack-Audit migration as proof) → 8× A9 phase-3 sibling migrations

Phase 4 — representative page:
Part C, only after A2–A8 + A9 phase-1 are ✅ (so the page has real content).

**Total:** ~20 scheduled runs over ~4 weeks at one weekday per item.

### Scheduler bootstrap

After the user approves this plan, set up the routine via the `schedule` skill with:

- Cron: `0 9 * * 1-5` (9:00 AM Mon–Fri, America/Los_Angeles)
- Prompt: `Read docs/rollout-plan.md in ~/Projects/Bilko/. Execute the next pending item per the rules in Part D. Commit progress. Stop after one item.`
- Concurrency: 1 (no overlapping runs)

User can manually trigger a run anytime to advance faster, or pause the routine if a publish goes wrong.

---

## Run log

_(Each scheduled run appends one line here.)_

- _empty — routine not yet scheduled._
- 2026-05-07: A2 + A3 — published claude-code-session-manager@0.8.1 (npm was at 0.8.0; local bumped to 0.8.1); bilko-flow skipped at 0.3.1 (already in sync). Note: session-manager has no `.git` directory, so git tag/push step was skipped.
