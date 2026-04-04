# bilko.run

## Main URLs

- **Home**: https://bilko.run — Bilko's solopreneur page, story, and tool showcase
- **Projects**: https://bilko.run/projects — All 10 AI tools with descriptions and status
- **Blog**: https://bilko.run/blog — Build logs, lessons, and deep dives

## What This Is

bilko.run is Bilko's personal brand site and AI tool platform. 10 independent tools across 3 verticals, sharing a common credit model ($1/credit or $5/7 credits via Stripe). Each tool is its own product with its own page, scoring engine, and UX — they are NOT features of one product.

### The 10 Tools

**Marketing & Content (7 tools, $1/credit each):**
1. **PageRoast** (`/projects/page-roast`) — Landing page CRO audit + savage roast
2. **HeadlineGrader** (`/projects/headline-grader`) — 4-framework headline scoring + generate mode
3. **AdScorer** (`/projects/ad-scorer`) — Platform-specific ad grading (FB/Google/LinkedIn) + generate
4. **ThreadGrader** (`/projects/thread-grader`) — X/Twitter thread viral analysis + generate
5. **EmailForge** (`/projects/email-forge`) — 5-email sequence generator (AIDA/PAS/Hormozi/Cialdini/Story)
6. **AudienceDecoder** (`/projects/audience-decoder`) — Audience archetype + engagement analysis
7. **LaunchGrader** (`/projects/launch-grader`) — 5-dimension go-to-market readiness audit

**Operations ($1/credit):**
8. **StackAudit** (`/projects/stack-audit`) — SaaS tool stack cost analysis + waste finder

**Dev Tools ($1/credit):**
9. **Stepproof** (`/projects/stepproof`) — YAML scenario regression tests for AI pipelines

**Privacy (FREE — runs in browser):**
10. **LocalScore** (`/projects/local-score`) — Document analyzer via Gemma/WebGPU, zero server

## Tech Stack

TypeScript everywhere. Always use TypeScript over JavaScript for new files.

- **Frontend**: React 18 + Vite 6 + Tailwind CSS v4
- **Backend**: Fastify 5 + Turso/libSQL (`@libsql/client`)
- **AI**: Gemini 2.0 Flash (REST API, key via header not URL)
- **Local AI**: Gemma 2B via WebLLM + WebGPU (LocalScore only)
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
- `server/routes/demos.ts` — All content tool endpoints (scoring, compare, generate)
- `server/routes/stepproof.ts` — Stepproof scenario runner with YAML parser
- `server/routes/blog.ts` — Blog CRUD (admin-only writes)
- `server/routes/stripe.ts` — Checkout, webhooks, billing portal
- `server/routes/analytics.ts` — Page views + admin stats dashboard
- `server/db.ts` — Turso client, async helpers (`dbGet`, `dbAll`, `dbRun`, `dbTransaction`, `txGet`, `txRun`), migrations, seed data
- `server/gemini.ts` — Gemini API client (key via header, not URL)
- `server/utils.ts` — `parseJsonResponse` (shared Gemini output parser)

## Voice & Tone

Bilko's voice: witty, direct, no corporate fluff. The tools are comedic (PageRoast has roast lines, grades have personality). The homepage is a solopreneur personal page, not a SaaS landing page. The blog is informative and reflective — "building in public, learning out loud."

## Rules

- Never propose solutions — implement them directly
- Each tool is independent — don't merge them or add cross-dependencies in the backend
- All tools share the same credit model (except LocalScore which is free)
- All SQL uses parameterized statements via db helpers — never string interpolation
- Auth: `requireAuth` for token-spending endpoints, rate limiting for free-tier endpoints
- Never publish to npm
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
