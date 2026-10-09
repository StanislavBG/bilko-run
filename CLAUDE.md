# Bilko

**TL;DR — Bilko is a host platform, not a product.** Every "tool" is an independent app that uses Bilko's auth, credits, component kit, and brand chrome. Long-term goal: every app lives in its own sibling repo under `~/Projects/`, built in its own Claude session, and hosted on bilko.run via the **static-path contract**.

**Git repo:** this is **`StanislavBG/bilko-run`**, remote `origin`, branch `main`. That is the one and only repo for the Bilko platform — commit and push here. The `content-grade` remote (`Content-Grade/Content-Grade`) is a **separate, unrelated project**; its history has diverged and you must **never push Bilko to it**. (Older docs/scripts that say "push to both remotes" or "deploy from Content-Grade master" are obsolete — see [Deploy](#tech-stack) and [Rules](#rules).)

**Repo map:** see README.md → "Where things live" for the folder-by-folder layout.

**Authoritative spec:** [`docs/host-contract.md`](docs/host-contract.md) — read it before adding, removing, or migrating any app.

**For Claude sessions working on a sibling app repo (not this one):** Use the [`bilko-host` MCP](mcp-host-server/README.md) to register, publish, and inspect apps. You don't need to edit this repo by hand.

## Project Ecosystem

Bilko's workspace lives in `~/Projects/` with this structure:

```
~/Projects/
  Bilko/                    ← THIS REPO — host/framework for bilko.run
                               (git: StanislavBG/bilko-run · origin/main)
    packages/host-kit/      ← `host-kit`: client SDK for static-path siblings
                               (auth, games hooks, SiteHeader, manifest CLI)
  Outdoor-Hours/            ← static-path sibling — KOUT-7 weather report
  Local-Score/              ← static-path sibling — private doc analyzer
  Bilko-Game-Academy/       ← static-path sibling — Boat Shooter
  Local-Browser-Automation/ ← Social media ops, marketing, networking
  BGLabs/                   ← bglabs.app — AI canvas animation platform
  Provocations/             ← AI-augmented thinking workspace (14 personas)
  review-pilot/             ← Google review response SaaS ($49-79/mo)
  Preflight/                ← Monorepo: stepproof, agent-comply, agent-gate,
                               agent-shift, agent-trace, license, site
  Archive/                  ← Bilko-Archive, AIQA, Content-Grade, experiments
  Bilko-Academy/            ← sibling — non-technical AI fundamentals (see [docs/archive/academy-research.md](docs/archive/academy-research.md))
```

## Main URLs

- **Home**: https://bilko.run — Bilko's solopreneur page, story, and tool showcase
- **Projects**: https://bilko.run/projects — every registered project (driven by the registry; ~25 standalone projects + tools, not a fixed count)
- **Blog**: https://bilko.run/blog — Build logs, lessons, and deep dives

## What This Is

bilko.run is Bilko's personal brand site and host platform. Apps share a common credit model ($1/credit or $5/7 credits via Stripe), shared Clerk auth, shared Stripe wallet, and a shared component kit. Each app is its own product with its own page, scoring engine, and UX — they are NOT features of one product.

### Current apps

**In-repo (react-route, canonical URL `/products/<slug>`):** **Session Manager** is the one react-route app (`/products/session-manager`, plus its Field Manual at `/products/session-manager/manual`). All 9 AI tools have been extracted to sibling repos. Beyond that the host repo ships only brand chrome (Layout, HomePage, ProjectsPage, BlogPage, PricingPage, AdminPage).

**Sibling repos (static-path, canonical URL `/projects/<slug>/`)** — fully independent, built in their own Claude sessions. The **authoritative list is the registry** (`src/data/standalone-projects.json`, ~25 entries, MCP-managed); the list below is a curated subset and will drift — check the registry, not this doc, for the live set:

- **OutdoorHours** (`/projects/outdoor-hours/`) → `~/Projects/Outdoor-Hours/` — KOUT-7 weather report
- **LocalScore** (`/projects/local-score/`) → `~/Projects/Local-Score/` — Gemma/WebGPU doc analyzer
- **Boat Shooter** (`/projects/game-academy/`) → `~/Projects/Bilko-Game-Academy/` — browser arcade
- **Bilko-Academy** (`/projects/academy/`) → `~/Projects/Bilko-Academy/` — Interactive AI fundamentals course (15 `.mdx` files total: 3 intro lessons — welcome + 2 demos — plus 12 chapters across 4 modules — Meet Claude, Working In Claude, Prompting, Trust And Next Steps). Pure static-path; consumes `host-kit` (lives in this repo at `packages/host-kit/`) for shared chrome, telemetry, and the publish CLI. No Bilko-host server route.
- **Stepproof** (`/projects/stepproof/`) → `~/Projects/Stepproof/` — YAML scenario regression tests for AI pipelines (marketing page; CLI lives at github.com/StanislavBG/stepproof)
- **StackAudit** (`/projects/stack-audit/`) → `~/Projects/Stack-Audit/` — SaaS tool stack cost + waste finder
- **LaunchGrader** (`/projects/launch-grader/`) → `~/Projects/Launch-Grader/` — 5-dimension go-to-market readiness audit
- **AdScorer** (`/projects/ad-scorer/`) → `~/Projects/Ad-Scorer/` — Platform-specific ad copy grading (FB/Google/LinkedIn) with Score/Compare/Generate modes
- **HeadlineGrader** (`/projects/headline-grader/`) → `~/Projects/Headline-Grader/` — 4-framework headline scoring (Rule of One, Hormozi, Readability, Proof+Promise+Plan) with Score/Compare/Generate modes
- **ThreadGrader** (`/projects/thread-grader/`) → `~/Projects/Thread-Grader/` — X/Twitter thread viral analysis with Score/Compare/Generate modes
- **EmailForge** (`/projects/email-forge/`) → `~/Projects/Email-Forge/` — 5-email sequence generator (AIDA/PAS/Hormozi/Cialdini/Story) with Generate/Compare modes
- **AudienceDecoder** (`/projects/audience-decoder/`) → `~/Projects/Audience-Decoder/` — Audience archetype + engagement analysis with Decode/Compare modes
- **PageRoast** (`/projects/page-roast/`) → `~/Projects/Page-Roast/` — Brutally honest landing page CRO audits with Score/Compare modes + savage roast lines
- **SocialSignalsTrader** (`/projects/social-signals-trader/`) → `~/Projects/social-signals-trader/` — "trade in public" dashboard (Alpaca account vs SPY, equity curve, trade log, Reddit-signal provenance). Source is the sibling's `dashboard/`; the host copy under `public/projects/social-signals-trader/` is a **published artifact** regenerated by the sibling's `publish-to-bilko` step — fix the sibling, not the host copy. Live data is overlaid at load from a host snapshot endpoint (`/api/projects/social-signals-trader/snapshot`).
- **Plus several more registered standalone apps** not yet documented here — e.g. `cellar`, `etch`, `fizzpop`, `git-viewer`, `mindswiffer`, `sudoku` (and external/cooking entries like `bglabs`, `bilko-flow`, `signal-builder`, `mcp-host`, `session-manager`). The registry is the source of truth.

**Architectural note — gateway pattern for the 8 AI-tool siblings:** StackAudit, LaunchGrader, AdScorer, HeadlineGrader, ThreadGrader, EmailForge, AudienceDecoder, and PageRoast each ship their React page from the sibling repo, but their Gemini-backed scoring endpoint stays in Bilko host under `server/routes/tools/<slug>.ts`. The sibling calls its endpoint same-origin via Clerk JWT — no CORS, no cross-origin auth. Two tools carry extra host-side weight: PageRoast owns 6 endpoints plus the PAGEROAST_TOKENS one-time-purchase tier, and AudienceDecoder owns its own one-time-purchase tier. This split is deliberate, not a migration leftover; Academy and the free tools (OutdoorHours, LocalScore) are not in this pattern and have no host-side server route.

**Long-term direction:** all in-repo apps eventually become sibling repos. Bilko stays the framework: registry, auth, credits, kit, brand, blog, admin.

## Projects hosting pattern

Three host kinds, declared in `src/data/projectsRegistry.ts`. Full spec in [`docs/host-contract.md`](docs/host-contract.md).

| Kind | Path | When to use |
|---|---|---|
| `react-route` | `/products/<slug>` | App needs shared auth/credits and is small enough to live in this bundle. Existing AI tools. |
| `static-path` | `/projects/<slug>/` | App is built in its own repo, dropped into `public/projects/<slug>/`. **Default for new apps.** |
| `external-url` | other domain | App lives elsewhere |

**URL canonicalization (enforced by `src/App.tsx`):**
- `/projects/<slug>` (no trailing slash, react-route) → redirects to `/products/<slug>`
- `/app/<old-slug>` → redirects to `/products/<canonical-slug>`
- `/projects/<slug>/` (trailing slash, static-path) → served by Fastify static, never hits the SPA

**Adding a new app from another Claude session:** read [`docs/host-contract.md`](docs/host-contract.md) and use the [`bilko-host` MCP](mcp-host-server/README.md). Don't edit `projectsRegistry.ts` by hand from a sibling repo.

The portfolio (`/`, `/projects`, `⌘K`) reads from `projectsRegistry.ts`, so once registered the app shows up everywhere. (`/products` itself redirects to `/projects`; only `/products/<slug>` paths stay live.) Static-path and external apps trigger a full page load on click (so Fastify serves the static bundle); React routes use SPA navigation.

## Tech Stack

TypeScript everywhere. Always use TypeScript over JavaScript for new files.

- **Frontend**: React 18 + Vite 6 + Tailwind CSS v4
- **Backend**: Fastify 5 + Turso/libSQL (`@libsql/client`)
- **AI**: Gemini (REST API via `gemini-flash-latest` alias, key via header not URL)
- **Auth**: Clerk (JWT verification, `requireAuth`, `requireAdmin`)
- **Payments**: Stripe (token credits, webhook verification)
- **Deploy**: Render, from the **`StanislavBG/bilko-run`** repo (`main`). Deploy source is configured in the Render dashboard (no `render.yaml` in-repo) — confirm there if in doubt. **Not** the `content-grade` remote anymore.
- **Database**: Turso (persistent), falls back to local SQLite in dev

## Key Architecture

### host-kit (`packages/host-kit/`)
This is the client SDK that static-path siblings use. It provides `authFetch`/`useAuth` (Clerk Bearer auth to the host's `/api`), the games hooks, `SiteHeader`, `GameShell`, and the `bilko-host-kit` manifest CLI. It is a pnpm workspace package with its own build and tests (`pnpm --filter host-kit build|test|typecheck`).

All 14 sibling consumers depend on it locally with `"host-kit": "file:../Bilko/packages/host-kit"`. None of them use npm. Those consumers are the 8 AI-tool pages, Stepproof, Academy, Sudoku, Etch, Fizzpop and MindSwiffer.
- **After changing it:** pnpm copies the untracked `dist/` into each app. Run `pnpm --filter host-kit build` here, then `pnpm install` in each app.
- **Tailwind:** apps that render its components need `@source "<rel>/node_modules/host-kit/dist";` in their Tailwind CSS, because Tailwind skips `node_modules`.
- **Changesets:** add a `.changeset/*.md` (root `.changeset/`) for each change.
- **npm releases:** optional. Push a `host-kit-vX.Y.Z` tag to run `.github/workflows/host-kit-release.yml`. This needs an `NPM_AUTOMATION_TOKEN` repo secret.
- **History:** merged in from `StanislavBG/bilko-host-kit` (now archived) on 2026-10-04, with its full history.

### Shared Hooks (`src/hooks/`)
- `usePageView` — Page view tracking with Clerk email

Clerk auth state comes straight from `@clerk/clerk-react` (`useUser()` / `useAuth()`); there is no host-side `useAuth` wrapper.

### Backend Patterns (`server/`)
- `server/routes/tools/` — One file per AI tool. `_shared.ts` holds the rate limiter, IP hashing, usage tracking, and the inverse-mode generator helper. `index.ts` is the barrel that registers all tools. To extract a tool to a sibling repo, lift its file + the page; no other server changes required.
- `server/routes/blog.ts` — Blog CRUD (admin-only writes)
- `server/routes/stripe.ts` — Checkout, webhooks, billing portal
- `server/routes/analytics.ts` — Page views + admin stats dashboard (`/api/analytics/event` is open to same-origin sibling apps for `track()`)
- `server/db.ts` — Turso client, async helpers (`dbGet`, `dbAll`, `dbRun`, `dbTransaction`, `txGet`, `txRun`), migrations, seed data
- `server/gemini.ts` — Gemini API client (key via header, not URL)
- `server/utils.ts` — `parseJsonResponse` (shared Gemini output parser)

### Sanctioned app-specific host code

Host code is framework by default — it should not know about one specific app. These exceptions are allowed because the app can't work without a host-side gateway:

- AI-tool gateway routes — `server/routes/tools/`
- Session Manager — `server/sm-relay/`, `server/routes/sm-relay.ts`, `server/routes/manual.ts`, `server/routes/admin-session-manager-usage.ts`, `src/pages/session-manager-landing/`, `shared/manual-catalog.ts`, `server/services/manual.ts`, `src/lib/manualClient.ts`, `src/pages/SessionManagerPage.tsx`, `src/pages/ManualPage.tsx`, `src/styles/session-manager-*.css`, `data/manual/`
- Academy gateway — `server/routes/academy.ts`, `server/services/academy-quota.ts`, `shared/academy-models.ts`
- SocialSignalsTrader coffee checkout — in `server/routes/stripe.ts`
- Game config — `shared/game-config.ts`
- Legacy ContentGrade license code — `server/routes/license.ts`, `server/services/license.ts` (not part of the framework; pending an owner decision to move or delete)

Any new app-specific host code must be added to this list in the same commit, or live in the sibling repo instead.

## Voice & Tone

Bilko's voice: witty, direct, no corporate fluff. The tools are comedic (PageRoast has roast lines, grades have personality). The homepage is a solopreneur personal page, not a SaaS landing page. The blog is informative and reflective — "building in public, learning out loud."

## Rules

- Never propose solutions — implement them directly
- Each tool is independent — don't merge them or add cross-dependencies in the backend or frontend
- **New apps default to `static-path` (own repo).** Use `react-route` only when an app genuinely needs to live in this bundle (rare); the trend is the other direction
- **New npm packages follow [`docs/publishing-contract.md`](docs/publishing-contract.md).** LICENSE on disk (not just metadata), MIT, `--provenance` on publish, Changesets-managed CHANGELOG. Templates in `docs/templates/`.
- **Publishing a sibling app follows [`docs/host-contract.md`](docs/host-contract.md).** The registry is schema-validated (`mcp-host-server/src/contract/registry.ts`); `mcp-host-server/dist/` must be rebuilt and committed with any `src/` change (`tests/mcp-dist-sync.test.ts` enforces this). Paid-tier entitlement is derived only from the verified Clerk token, never from the request body.
- All paid tools share the same credit model (free tools — LocalScore, OutdoorHours — don't deduct credits)
- All SQL uses parameterized statements via db helpers — never string interpolation
- Auth: `requireAuth` for token-spending endpoints, rate limiting for free-tier endpoints
- **Push to `origin` (`StanislavBG/bilko-run`) `main` only.** The `content-grade` remote is a separate project — **never push Bilko there** (the old "push to both" rule is dead; histories have diverged)
- Render auto-deploys from `origin` (`bilko-run`) `main` — deploy source set in the Render dashboard
- Static-path app fixes belong in the **sibling repo that owns the source**, not the published copy under `public/projects/<slug>/` (the publisher overwrites it)
- Env vars managed via Render dashboard

## Testing

54 files, 754 tests (counted via `pnpm vitest run`; recount whenever this drifts). CI runs on every push via `.github/workflows/ci.yml`.

Commands:
- `pnpm test` — vitest run
- `pnpm typecheck` — client (`tsc --noEmit`) + server (`tsc -p tsconfig.server.json --noEmit`)
- `pnpm test:e2e` — Playwright

### What a test must guard

A test earns its place by exercising host behavior: security (SSRF, auth, egress), money (tokens, Stripe checkout/webhooks), the publish contract (registry schema, mcp-dist sync), or routing (static-path vs react-route canonicalization). Do not add tests that:
- grep prose, docs, or skill files instead of exercising code
- snapshot the registry or other generated data
- test a sibling app's UI — that belongs in the sibling's own golden spec
- call production bilko.run from vitest

## Blog

Guidelines in `blogs.md`. Each post follows the structure: hook → context → meat (3-5 sections) → what we'd do differently → CTA. Blog posts are seeded in `server/db.ts` initDb().
