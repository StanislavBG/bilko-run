# bilko.run

## Tech Stack

This project uses TypeScript as the primary language. Always use TypeScript over JavaScript for new files. The stack also includes Python for scraping/automation pipelines.

- **Frontend**: React + Vite + Tailwind CSS v4
- **Backend**: Fastify + SQLite (better-sqlite3)
- **AI**: Gemini 2.0 Flash (REST API)
- **Auth**: Clerk
- **Payments**: Stripe (token-based)
- **Deploy**: Render (auto-deploy from Content-Grade/Content-Grade repo, master branch)

## General Rules

Never propose solutions — implement them. When the user describes a bug or feature, write the code and apply the fix directly rather than suggesting what could be done.

Use the user's terminology for domain concepts. Ask if unsure. Do not rename things to be 'clearer' — the user's naming reflects their mental model (e.g., Ventures not Products, Learning Queue not Backlog).

## Code Changes

When making multi-file refactors (especially splitting files or restructuring routes), verify that ALL existing routes/exports are preserved. Run a before/after diff of exported symbols and route paths.

## Database

When editing SQL migrations, never split on semicolons naively — trigger blocks contain BEGIN/END with internal semicolons. Always parse migration files accounting for PL/pgSQL and SQLite trigger syntax.

SQLite with WAL mode. Schema defined in `server/db.ts`. All queries use parameterized statements (no string interpolation in SQL).

## Automation & Scraping

When building automation that interacts with external platforms (Reddit, X/Twitter, Facebook), always default to human-like timing and organic behavior patterns. Never use batch operations, systematic browsing, or bot-like patterns unless explicitly told otherwise.

## Key Architecture

- `server/clerk.ts` — Auth helpers: `verifyClerkToken`, `requireAuth`, `requireAdmin`, `ADMIN_EMAILS`
- `server/services/page-fetch.ts` — Shared URL fetching with SSRF protection
- `server/gemini.ts` — Gemini API client (key via header, not URL)
- `server/services/tokens.ts` — Token balance system (1 free, $1/1 credit or $5/7 credits)
- `src/constants.ts` — Client-side shared constants (ADMIN_EMAILS)

## Deployment

- Push to both `origin` (StanislavBG/bilko-run) and `content-grade` (Content-Grade/Content-Grade master)
- Render auto-deploys from Content-Grade/Content-Grade master branch
- Env vars managed via Render API
- Never publish to npm
