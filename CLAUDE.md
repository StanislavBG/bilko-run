# Bilko

**TL;DR — Bilko is a host platform, not a product.** Every "tool" is an independent app that uses Bilko's auth, credits, component kit, and brand chrome. Long-term goal: every app lives in its own sibling repo under `~/Projects/`, built in its own Claude session, and hosted on bilko.run via the **static-path contract**.

**Authoritative spec:** [`docs/host-contract.md`](docs/host-contract.md) — read it before adding, removing, or migrating any app.

**For Claude sessions working on a sibling app repo (not this one):** Use the [`bilko-host` MCP](mcp-host-server/README.md) to register, publish, and inspect apps. You don't need to edit this repo by hand.

## Project Ecosystem

Bilko's workspace lives in `~/Projects/` with this structure:

```
~/Projects/
  Bilko/                    ← THIS REPO — host/framework for bilko.run
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
```

## Main URLs

- **Home**: https://bilko.run — Bilko's solopreneur page, story, and tool showcase
- **Projects**: https://bilko.run/projects — All 10 AI tools with descriptions and status
- **Blog**: https://bilko.run/blog — Build logs, lessons, and deep dives

## What This Is

bilko.run is Bilko's personal brand site and host platform. Apps share a common credit model ($1/credit or $5/7 credits via Stripe), shared Clerk auth, shared Stripe wallet, and a shared component kit. Each app is its own product with its own page, scoring engine, and UX — they are NOT features of one product.

### Current apps

**In-repo (react-route, canonical URL `/products/<slug>`)** — slated for eventual extraction:

1. **PageRoast** (`/products/page-roast`) — Landing page CRO audit + savage roast
2. **HeadlineGrader** (`/products/headline-grader`) — 4-framework headline scoring + generate mode
3. **ThreadGrader** (`/products/thread-grader`) — X/Twitter thread viral analysis + generate
4. **EmailForge** (`/products/email-forge`) — 5-email sequence generator (AIDA/PAS/Hormozi/Cialdini/Story)
5. **AudienceDecoder** (`/products/audience-decoder`) — Audience archetype + engagement analysis

**Sibling repos (static-path, canonical URL `/projects/<slug>/`)** — fully independent, built in their own Claude sessions:

- **OutdoorHours** (`/projects/outdoor-hours/`) → `~/Projects/Outdoor-Hours/` — KOUT-7 weather report
- **LocalScore** (`/projects/local-score/`) → `~/Projects/Local-Score/` — Gemma/WebGPU doc analyzer
- **Boat Shooter** (`/projects/game-academy/`) → `~/Projects/Bilko-Game-Academy/` — browser arcade
- **Stepproof** (`/projects/stepproof/`) → `~/Projects/Stepproof/` — YAML scenario regression tests for AI pipelines (marketing page; CLI lives at github.com/StanislavBG/stepproof)
- **StackAudit** (`/projects/stack-audit/`) → `~/Projects/Stack-Audit/` — SaaS tool stack cost + waste finder. Page is standalone; server route stays in this repo (called same-origin via Clerk JWT)
- **LaunchGrader** (`/projects/launch-grader/`) → `~/Projects/Launch-Grader/` — 5-dimension go-to-market readiness audit. Page is standalone; server route stays in this repo (called same-origin via Clerk JWT)
- **AdScorer** (`/projects/ad-scorer/`) → `~/Projects/Ad-Scorer/` — Platform-specific ad copy grading (FB/Google/LinkedIn) with Score/Compare/Generate modes. Page is standalone; server route stays in this repo (called same-origin via Clerk JWT)

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
- **Deploy**: Render (auto-deploy from Content-Grade/Content-Grade master branch)
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
- All paid tools share the same credit model (free tools — LocalScore, OutdoorHours — don't deduct credits)
- All SQL uses parameterized statements via db helpers — never string interpolation
- Auth: `requireAuth` for token-spending endpoints, rate limiting for free-tier endpoints
- Push to both `origin` (StanislavBG/bilko-run) and `content-grade` (Content-Grade/Content-Grade master)
- Render auto-deploys from Content-Grade/Content-Grade master branch
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
