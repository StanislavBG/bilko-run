# Bilko

**TL;DR — Bilko is a host platform, not a product.** Every "tool" is an independent app that uses Bilko's auth, credits, component kit, and brand chrome. Long-term goal: every app lives in its own sibling repo under `~/Projects/`, built in its own Claude session, and hosted on bilko.run via the **static-path contract**.

**Git repo:** this is **`StanislavBG/bilko-run`**, remote `origin`, branch `main`. That is the one and only repo for the Bilko platform — commit and push here. The `content-grade` remote (`Content-Grade/Content-Grade`) is a **separate, unrelated project**; its history has diverged and you must **never push Bilko to it**. (Older docs/scripts that say "push to both remotes" or "deploy from Content-Grade master" are obsolete — see [Deploy](#tech-stack) and [Rules](#rules).)

**Local `main` must match `origin/main`.** Check with `git status -sb` in `~/Projects/Bilko` (expect `## main...origin/main`, no ahead or behind); if not, run `bash scripts/sync-local-main.sh`. Details and every writer: [`docs/repo-writers.md`](docs/repo-writers.md).

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

See [`docs/site.md`](docs/site.md).

## What This Is

bilko.run is Bilko's personal brand site and host platform. Apps share a common credit model (details: [`docs/commerce.md`](docs/commerce.md)), shared Clerk auth, shared Stripe wallet, and a shared component kit. Each app is its own product with its own page, scoring engine, and UX — they are NOT features of one product.

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
- **Runtime**: Node version set by `engines.node` — see [`docs/deployment.md`](docs/deployment.md#node-version)
- **Deploy**: Render, from `origin` `main` — see [`docs/deployment.md`](docs/deployment.md)
- **Database**: Turso (persistent), falls back to local SQLite in dev

## Key Architecture

### host-kit (`packages/host-kit/`)
Client SDK for static-path siblings (auth, games hooks, `SiteHeader`, telemetry, manifest CLI). Install, Tailwind and rebuild steps: [`packages/host-kit/README.md`](packages/host-kit/README.md).
Releases are by hand: [`docs/publishing-contract.md`](docs/publishing-contract.md).

### Shared Hooks (`src/hooks/`)
- `usePageView` — Page view tracking with Clerk email

Clerk auth state comes straight from `@clerk/clerk-react` (`useUser()` / `useAuth()`); there is no host-side `useAuth` wrapper.

### Backend Patterns (`server/`)
- `server/routes/tools/` — One file per AI tool. `_shared.ts` holds the rate limiter, IP hashing, usage tracking, and the shared gateway helpers: `freeTierGate` (free-tier rate limit), `creditGate` (paid credit check/deduct), `askGeminiJson` (Gemini call + JSON parse), `toolErrorReply` (uniform error reply), plus `handleGenerateEndpoint` (inverse-mode generator). `index.ts` is the barrel that registers all tools. To extract a tool to a sibling repo, lift its file + the page; no other server changes required.
- `server/routes/blog.ts` — Blog CRUD (admin-only writes)
- `server/routes/forum.ts` + `server/services/forum.ts` — site-level Forum at `/forum`, like the blog: public reads, Clerk + handle writes, admin hide
- `server/routes/project-catalog.ts` — public `GET /api/projects` + `GET /api/offers` + MCP at `/mcp` (read-only `list_projects`/`get_project`/`list_offers`, plus the paid `roast_page` behind a `bkk_` agent key; the public `/projects` cards as data; contract in `docs/host-contract.md` → "Public project catalog"; card content is project-owned via each registry entry's `listing`, see "Project listing — who owns what")
- Agent storefront — `shared/agent-offers.ts` (offer data), `server/routes/agent-buy.ts` (`/buy/:offerId`), `server/routes/agent-storefront.ts` (`/llms.txt`), `server/routes/agent-keys.ts` + `server/services/agent-api-keys.ts` (`bkk_` keys); contract in [`docs/commerce.md`](docs/commerce.md)
- Wallet and credit-bought product — `server/services/wallet.ts` + `server/routes/wallet.ts` (`/api/wallet`, `/api/wallet/topup`; PPP bonus credits from `shared/ppp-bonus.ts`), `server/services/menu-orders.ts` + `server/routes/menu-orders.ts` (`/api/menu`, `/api/menu/:itemId/order`); contract in [`docs/commerce.md`](docs/commerce.md)
- `server/routes/stripe.ts` — Checkout, webhooks, billing portal
- `server/routes/signin-capture.ts` + `shared/signin-capture.ts` — "sign in for updates" capture: source page + opt-in consent per account, admin signups view + CSV (`/admin` → Signups); contract in `docs/host-contract.md` → "Sign-in capture"
- `server/routes/realtime.ts` + `server/realtime/relay.ts` — ticket endpoint and binary WebSocket input relay (`/api/realtime/rooms/:roomId`, ≤10 seats, in-memory, single instance); `server/realtime/lobbies.ts` — public lobby directory (`/api/realtime/lobbies`: open rooms listed while their owner holds a seat, 30 s TTL)
- `server/routes/analytics.ts` — Page views + admin stats dashboard (`/api/analytics/event` is open to same-origin sibling apps for `track()`)
- `server/db.ts` — Turso client, async helpers (`dbGet`, `dbAll`, `dbRun`, `dbTransaction`, `txGet`, `txRun`), migrations, seed data
- `server/db-schema.ts` — table/schema definitions (split out of `db.ts`)
- `server/blog-posts.ts` — loads `content/blog/*.md` seed posts
- `server/gemini.ts` — Gemini API client (key via header, not URL)
- `server/utils.ts` — `parseJsonResponse` (shared Gemini output parser)
- `server/bearer.ts` — `bearerMatches`, the timing-safe compare for shared-secret bearer routes

### Web products (paid downloads)
Paid zips and bookable services, the wallet, offers and agent storefront: [`docs/commerce.md`](docs/commerce.md); sibling-facing endpoints and playbook: [`docs/host-contract.md`](docs/host-contract.md).

### Sanctioned app-specific host code

Host code is framework by default. New app-specific host code must be added to the list in [`docs/host-internals.md`](docs/host-internals.md#sanctioned-app-specific-host-code) in the same commit, or live in the sibling repo instead.

## Voice & Tone

See [`docs/site.md`](docs/site.md).

## Rules

- Never propose solutions — implement them directly
- **This repo is public: the owner's real name and personal email never go in a tracked file, commit message or commit author** — write "the owner". `session-manager-operations/prompt-sessions/` is gitignored for this reason; `pnpm hooks:install` puts the identity guard on commit and push. See [`docs/identity-boundary.md`](docs/identity-boundary.md)
- Each tool is independent — don't merge them or add cross-dependencies in the backend or frontend
- **New apps default to `static-path` (own repo).** Use `react-route` only when an app genuinely needs to live in this bundle (rare); the trend is the other direction
- **New npm packages follow [`docs/publishing-contract.md`](docs/publishing-contract.md).** LICENSE on disk (not just metadata), MIT, `--provenance` on publish, Changesets-managed CHANGELOG. Templates in `docs/templates/`.
- **Publishing a sibling app follows [`docs/host-contract.md`](docs/host-contract.md).** The registry is schema-validated (`mcp-host-server/src/contract/registry.ts`); `mcp-host-server/dist/` must be rebuilt and committed with any `src/` change (`tests/mcp-dist-sync.test.ts` enforces this). Paid-tier entitlement is derived only from the verified Clerk token, never from the request body.
- All paid tools share the same credit model (free tools — LocalScore, OutdoorHours — don't deduct credits)
- All SQL uses parameterized statements via db helpers — never string interpolation
- Auth: `requireAuth` for token-spending endpoints, rate limiting for free-tier endpoints
- **Push to `origin` (`StanislavBG/bilko-run`) `main` only.** The `content-grade` remote is a separate project — **never push Bilko there** (the old "push to both" rule is dead; histories have diverged)
- Static-path app fixes belong in the **sibling repo that owns the source**, not the published copy under `public/projects/<slug>/` (the publisher overwrites it)
- **Paid download bytes never go in this repo (it is public on GitHub) — commit only their sha256 in `shared/web-products.ts`; the bytes live in the `web_product_releases` table.**
- Env vars and deploys: [`docs/deployment.md`](docs/deployment.md)

## Testing

175 files, 1926 tests (1911 pass, 15 skipped; counted via `pnpm vitest run` on 2026-11-05; recount whenever this drifts). CI runs on every push via `.github/workflows/ci.yml`.

Commands:
- `pnpm test` — vitest run
- `pnpm typecheck` — client (`tsc --noEmit`) + server (`tsc -p tsconfig.server.json --noEmit`) + scripts (`tsc -p tsconfig.scripts.json`)
- `pnpm test:e2e` — Playwright

### What a test must guard

A test earns its place by exercising host behavior: security (SSRF, auth, egress), money (tokens, Stripe checkout/webhooks), the publish contract (registry schema, mcp-dist sync), or routing (static-path vs react-route canonicalization). Do not add tests that:
- grep prose, docs, or skill files instead of exercising code
- snapshot the registry or other generated data
- test a sibling app's UI — that belongs in the sibling's own golden spec
- call production bilko.run from vitest

## Blog

Rules as data: `.claude/skills/blog-from-git/blog.config.yaml`; writing style: `.claude/skills/blog-from-git/voice.md`; how a post, image or video goes live: [`content/blog/README.md`](content/blog/README.md).
Blog videos are made in Burrow and hosted here; the page contract is in that README. Keep `scripts/blog-video-capture.ts` and `scripts/blog-video-frames.ts` and their flags stable (Burrow runs them).
