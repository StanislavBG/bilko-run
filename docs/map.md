# Bilko map

Read this first. Every link is written as `~/Projects/Bilko/<path>`; open it from that folder.

## What Bilko is

bilko.run is a **host platform**, not a product. Each app is its own product in its own repo under `~/Projects/`, built in its own Claude session. The host provides sign-in (Clerk), credits and the wallet (Stripe), a shared component kit, brand chrome, the blog and the admin pages. The repo is `StanislavBG/bilko-run` (remote `origin`, branch `main`).

The live app list is `src/data/standalone-projects.json` (or the `bilko-host` MCP tool `list_projects`). An entry with `public: true` shows on `/projects`. Do not copy the list into docs; it drifts.

Pick the entry that matches your job. Each is a different need.

## 1. Host my app on bilko.run (you work in a sibling repo)

Use the `bilko-host` MCP; do not hand-edit this repo.

- `~/Projects/Bilko/docs/host-contract.md`: the spec. Host kinds, registry rules, listing, publish gate, telemetry, manifest.
- `~/Projects/Bilko/packages/host-kit/README.md`: client SDK (auth, header, telemetry, publish CLI).
- `~/Projects/Bilko/mcp-host-server/README.md`: the MCP tools that register, publish and inspect apps.
- `~/Projects/Bilko/docs/observability.md`: errors and metrics for your app.
- `~/Projects/Bilko/docs/project-feedback-api.md`: how to send feedback to the host.

## 2. Change the host platform (auth, credits, API, registry, deploy)

- `~/Projects/Bilko/CLAUDE.md`: in-repo rules, test commands.
- `~/Projects/Bilko/docs/host-internals.md`: server and client internals, sanctioned app-specific code.
- `~/Projects/Bilko/docs/commerce.md`: credits, wallet, offers, agent storefront, paid downloads.
- `~/Projects/Bilko/docs/deployment.md`: Render, env vars, Node version, confirming a deploy.
- `~/Projects/Bilko/docs/repo-writers.md`: who writes to the repo; keeping local `main` equal to `origin/main`.
- `~/Projects/Bilko/docs/secrets-rotation.md`: secrets and how to rotate them.
- `~/Projects/Bilko/docs/identity-boundary.md`: the repo is public; what must never be committed.
- `~/Projects/Bilko/docs/publishing-contract.md`: publishing npm packages (host-kit and others).

## 3. Change bilko.run's own pages or blog

- `~/Projects/Bilko/docs/site.md`: URLs, routes, voice and tone.
- `~/Projects/Bilko/content/blog/README.md`: how a post, image or video goes live.
- `~/Projects/Bilko/.claude/skills/blog-from-git/`: the skill and rules that draft blog posts.

## Rules everyone shares

- Push to `origin` `main` of `StanislavBG/bilko-run` only. Never push Bilko to the `content-grade` remote.
- This repo is public. The owner's real name and personal email never go in tracked files: `~/Projects/Bilko/docs/identity-boundary.md`.
- New apps are `static-path` in their own repo. Fix the sibling that owns the source, never the published copy in `public/projects/<slug>/`.
- Each app is independent: no cross-dependencies between apps.
- Paid-tier entitlement comes only from the verified Clerk token, never from the request body.
- Env vars, secrets and deploys: `~/Projects/Bilko/docs/deployment.md` and `~/Projects/Bilko/docs/secrets-rotation.md`.
- Folder-by-folder layout: `~/Projects/Bilko/README.md`.
