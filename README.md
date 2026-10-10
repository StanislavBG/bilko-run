# bilko.run

bilko.run is a **host platform**, not a single product. Each app is its own repo and is published to `/projects/<slug>/` on this site. The host provides sign-in, credits (the pay-as-you-go balance), the shared look, the blog and the admin pages.

The full rules for how apps plug in are in [docs/host-contract.md](docs/host-contract.md).

## Stack

- **Frontend**: React + Vite + Tailwind CSS v4
- **Backend**: Fastify + Turso/libSQL (the database)
- **Sign-in**: Clerk
- **AI**: Gemini, using the `gemini-flash-latest` alias (never pin an old version)
- **Payments**: Stripe (credits)
- **Deploy**: Render

## Run it on your computer

You need Node 22 or newer and [pnpm](https://pnpm.io/installation) (a package installer).

```bash
cp .env.example .env   # then fill in the values you need
pnpm install
pnpm dev
```

Open http://localhost:3002 for the site. The API (the part that talks to the database) runs on port 4000, and the site forwards `/api` requests to it. Every setting in `.env` is explained in [.env.example](.env.example). Without the Clerk keys, sign-in will not work.

## Add or update a project

Use the `bilko-host` MCP (a tool Claude sessions can call) from the app's own repo. It registers the app and publishes it here. See [mcp-host-server/README.md](mcp-host-server/README.md) and [docs/host-contract.md](docs/host-contract.md).

**Never hand-edit `public/projects/<slug>/`.** That folder is a published copy and the next publish overwrites it. Fix the app's own repo, then republish.

## How changes go live

1. Push to `main` on `origin` (`StanislavBG/bilko-run`).
2. GitHub runs the checks in [.github/workflows/ci.yml](.github/workflows/ci.yml): typecheck, tests and a build.
3. Render sees the push and deploys automatically.

How to confirm a deploy landed is in [docs/deployment.md](docs/deployment.md). Secrets live in the Render dashboard, never in the repo.

**Never push to the `content-grade` remote.** It is a different project.

## Where things live

| Folder | What it is | Kind |
|---|---|---|
| `src/` | The website: pages, shared components, brand look | Platform |
| `server/` | The API: auth, credits, database (tables in `server/db-schema.ts`), blog loader, admin | Platform |
| `content/blog/` | The blog posts: one text file per post (see `content/blog/README.md`) | Platform |
| `shared/` | Code used by both site and API | Platform |
| `public/` | Static files. `public/projects/<slug>/` holds published apps (do not edit) | Platform |
| `packages/host-kit/` | Toolkit that apps in other repos use for sign-in and shared look | Platform |
| `mcp-host-server/` | The `bilko-host` MCP that registers and publishes apps | Platform |
| `scripts/` | Helper scripts for builds and maintenance (type-checked by `pnpm typecheck`) | Platform |
| `ops/` | Server setup files (systemd service units) | Platform |
| `tests/` | Unit tests, run with `pnpm test` | Platform |
| `e2e/` | Browser tests, run with `pnpm test:e2e` | Platform |
| `docs/` | Written guides (host contract, deployment, secrets) | Platform |
| `data/` | Bundled data files (the Session Manager manual) | Platform |
| `.claude/skills/blog-from-git` | Claude skill that drafts blog posts from git history | Platform |
| `server/routes/tools/` | One gateway file per AI tool (the tool's page lives in its own repo) | One specific app |
| `server/routes/academy.ts` | Gateway for Bilko Academy | One specific app |
| `server/sm-relay/`, `src/pages/session-manager-landing/` | Session Manager relay and landing page | One specific app |
| `session-manager-operations/` | Session Manager's job and scheduler records | One specific app |

## Add a blog post

Copy a file in `content/blog/`, rename it after your post's web address (for example `my-new-post.md`), change the details at the top, and write the post underneath. Step by step: [content/blog/README.md](content/blog/README.md). The site picks it up on the next restart; no database editing needed.

## Make a project public

Set `public: true` in the project's registry entry (via the `bilko-host` MCP); it then appears on `/projects`.

## Before you push

```bash
pnpm typecheck
pnpm test
```

Both must pass. CI runs the same checks.
