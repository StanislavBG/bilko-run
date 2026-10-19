---
title: README: a plain-language guide — what bilko.run is, run it, add a project, deploy, where things live
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-09T19:47:17.151Z
sourcePromptId: review-the-project-for-code-quality-perofmance-i-c56527b0
agentType: dev-lead
dependsOn: [ci-typecheck-tests-on-push, docs-archive-historical, env-example-and-dev-env-file]
planId: pl-mv1dgcto-8ab552
---
# Goal

doc. README.md is 25 lines, does not say bilko.run is a host platform, names the wrong Gemini model, and has no setup, deploy or repo-map guidance, so a less technical maintainer cannot find their way. Rewrite it in plain English, grounded in the files as they are now (read the landed .env.example, package.json, .github/workflows/ci.yml and docs/deployment.md first).

# Acceptance criteria

- [ ] README.md opens with 2-3 plain sentences: bilko.run is a host platform; each app is its own repo published to /projects/<slug>/; the host provides sign-in, credits, the shared look, the blog and admin.
- [ ] Section 'Run it on your computer': Node 22+, pnpm, `cp .env.example .env`, `pnpm install`, `pnpm dev`, site at http://localhost:3002 with API on :4000 (verify ports in vite.config.ts and server/index.ts).
- [ ] Section 'Add or update a project': use the bilko-host MCP (link mcp-host-server/README.md and docs/host-contract.md); never hand-edit public/projects/<slug>/ — fix the sibling repo and republish.
- [ ] Section 'How changes go live': push to origin main of StanislavBG/bilko-run; CI (link the workflow) runs checks; Render auto-deploys; link docs/deployment.md; never push to the content-grade remote.
- [ ] Section 'Where things live': a table of top-level folders (src, server, shared, public, packages/host-kit, mcp-host-server, scripts, ops, tests, e2e, docs, data, .claude/skills/blog-from-git, session-manager-operations) with one line each, marking which are platform vs one specific app (Session Manager, AI-tool gateways in server/routes/tools, Academy gateway).
- [ ] Section 'Before you push': `pnpm typecheck` and `pnpm test`; the Stack line says Gemini `gemini-flash-latest` and includes Clerk; every link in README.md points at a path that exists (check each with ls).

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- README.md

# Implementation notes

Repo: /home/bilko/Projects/Bilko. Audience: an owner who is not a developer. Short sentences, no jargon without a one-line explanation, under ~150 lines.

Read first: README.md; CLAUDE.md lines 1-100 (platform model, URLs); .env.example; docs/deployment.md; .github/workflows/ci.yml.

Do not touch: CLAUDE.md, docs/, any code.

# Out of scope

- (none)

# Gate

This PRD has no runnable check. Check each acceptance criterion by reading the files.

```gate
none
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
