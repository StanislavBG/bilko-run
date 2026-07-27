# Bilko

**TL;DR — Bilko is a host platform, not a product.** Every "tool" is an independent app that uses Bilko's auth, credits, component kit, and brand chrome. Long-term goal: every app lives in its own sibling repo under `~/Projects/`, built in its own Claude session, and hosted on bilko.run via the **static-path contract**.

**Git repo:** this is **`StanislavBG/bilko-run`**, remote `origin`, branch `main`. That is the one and only repo for the Bilko platform — commit and push here. The `content-grade` remote (`Content-Grade/Content-Grade`) is a **separate, unrelated project**; its history has diverged and you must **never push Bilko to it**. (Older docs/scripts that say "push to both remotes" or "deploy from Content-Grade master" are obsolete — see [Deploy](#tech-stack) and [Rules](#rules).)

**Authoritative spec:** [`docs/host-contract.md`](docs/host-contract.md) — read it before adding, removing, or migrating any app.

**For Claude sessions working on a sibling app repo (not this one):** Use the [`bilko-host` MCP](mcp-host-server/README.md) to register, publish, and inspect apps. You don't need to edit this repo by hand.

## Project Ecosystem

Bilko's workspace lives in `~/Projects/` with this structure:

```
~/Projects/
  Bilko/                    ← THIS REPO — host/framework for bilko.run
                               (git: StanislavBG/bilko-run · origin/main)
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
  Bilko-Academy/            ← sibling — non-technical AI fundamentals (see [docs/academy-research.md](docs/academy-research.md))
```

## Main URLs

- **Home**: https://bilko.run — Bilko's solopreneur page, story, and tool showcase
- **Projects**: https://bilko.run/projects — every registered project (driven by the registry; ~25 standalone projects + tools, not a fixed count)
- **Blog**: https://bilko.run/blog — Build logs, lessons, and deep dives

## What This Is

bilko.run is Bilko's personal brand site and host platform. Apps share a common credit model ($1/credit or $5/7 credits via Stripe), shared Clerk auth, shared Stripe wallet, and a shared component kit. Each app is its own product with its own page, scoring engine, and UX — they are NOT features of one product.

### Current apps

**In-repo (react-route, canonical URL `/products/<slug>`):** _none_ — all 9 AI tools have been extracted to sibling repos. The host repo now ships only brand chrome (Layout, HomePage, ProjectsPage, BlogPage, PricingPage, AdminPage).

**Sibling repos (static-path, canonical URL `/projects/<slug>/`)** — fully independent, built in their own Claude sessions. The **authoritative list is the registry** (`src/data/standalone-projects.json`, ~25 entries, MCP-managed); the list below is a curated subset and will drift — check the registry, not this doc, for the live set:

- **OutdoorHours** (`/projects/outdoor-hours/`) → `~/Projects/Outdoor-Hours/` — KOUT-7 weather report
- **LocalScore** (`/projects/local-score/`) → `~/Projects/Local-Score/` — Gemma/WebGPU doc analyzer
- **Boat Shooter** (`/projects/game-academy/`) → `~/Projects/Bilko-Game-Academy/` — browser arcade
- **Bilko-Academy** (`/projects/academy/`) → `~/Projects/Bilko-Academy/` — Interactive AI fundamentals course (15 `.mdx` files total: 3 intro lessons — welcome + 2 demos — plus 12 chapters across 4 modules — Meet Claude, Working In Claude, Prompting, Trust And Next Steps). Pure static-path; consumes `host-kit` (workspace package at `~/Projects/Bilko-Host-Kit/`) for shared chrome, telemetry, and the publish CLI. No Bilko-host server route.
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

The portfolio (`/`, `/products`, `⌘K`) reads from `projectsRegistry.ts`, so once registered the app shows up everywhere. Static-path and external apps trigger a full page load on click (so Fastify serves the static bundle); React routes use SPA navigation.

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

### Shared Component Kit (`src/components/tool-page/`)
- `ToolHero` — Dark hero section with title, tagline, optional tab toggle
- `ScoreCard` — Big score + grade + verdict + share/download buttons
- `SectionBreakdown` — Per-pillar score bars with feedback
- `CompareLayout` — Side-by-side A/B comparison with winner banner
- `Rewrites` — AI rewrite suggestions with copy buttons
- `CrossPromo` — Contextual links to related tools
- `colors.ts` — Shared grade/bar color utilities

### Shared Hooks (`src/hooks/`)
- `useToolApi` — Auth, submit, compare, generate, error/loading/token state
- `usePageView` — Page view tracking with Clerk email
- `useOgMeta` — OG/Twitter meta tag setter

### Backend Patterns (`server/`)
- `server/routes/tools/` — One file per AI tool. `_shared.ts` holds the rate limiter, IP hashing, usage tracking, and the inverse-mode generator helper. `index.ts` is the barrel that registers all tools. To extract a tool to a sibling repo, lift its file + the page; no other server changes required.
- `server/routes/blog.ts` — Blog CRUD (admin-only writes)
- `server/routes/stripe.ts` — Checkout, webhooks, billing portal
- `server/routes/analytics.ts` — Page views + admin stats dashboard (`/api/analytics/event` is open to same-origin sibling apps for `track()`)
- `server/db.ts` — Turso client, async helpers (`dbGet`, `dbAll`, `dbRun`, `dbTransaction`, `txGet`, `txRun`), migrations, seed data
- `server/gemini.ts` — Gemini API client (key via header, not URL)
- `server/utils.ts` — `parseJsonResponse` (shared Gemini output parser)

## Voice & Tone

Bilko's voice: witty, direct, no corporate fluff. The tools are comedic (PageRoast has roast lines, grades have personality). The homepage is a solopreneur personal page, not a SaaS landing page. The blog is informative and reflective — "building in public, learning out loud."

## Rules

- Never propose solutions — implement them directly
- Each tool is independent — don't merge them or add cross-dependencies in the backend or frontend
- **New apps default to `static-path` (own repo).** Use `react-route` only when an app genuinely needs to live in this bundle (rare); the trend is the other direction
- **New npm packages follow [`docs/publishing-contract.md`](docs/publishing-contract.md).** LICENSE on disk (not just metadata), MIT, `--provenance` on publish, Changesets-managed CHANGELOG. Templates in `docs/templates/`.
- All paid tools share the same credit model (free tools — LocalScore, OutdoorHours — don't deduct credits)
- All SQL uses parameterized statements via db helpers — never string interpolation
- Auth: `requireAuth` for token-spending endpoints, rate limiting for free-tier endpoints
- **Push to `origin` (`StanislavBG/bilko-run`) `main` only.** The `content-grade` remote is a separate project — **never push Bilko there** (the old "push to both" rule is dead; histories have diverged)
- Render auto-deploys from `origin` (`bilko-run`) `main` — deploy source set in the Render dashboard
- Static-path app fixes belong in the **sibling repo that owns the source**, not the published copy under `public/projects/<slug>/` (the publisher overwrites it)
- Env vars managed via Render dashboard

## Testing

27 tests across 4 files:
- `tests/db.test.ts` — Table creation, seed data, blog posts
- `tests/tokens.test.ts` — Grant, deduct, balance, credit, idempotency
- `tests/page-fetch.test.ts` — SSRF protection, URL validation
- `tests/auth.test.ts` — Clerk token verification

Run: `pnpm test`

## Blog

4 posts, guidelines in `blogs.md`. Each post follows the structure: hook → context → meat (3-5 sections) → what we'd do differently → CTA. Blog content seeds are in `server/db.ts` initDb().
