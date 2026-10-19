---
title: Env setup: complete .env.example, make `pnpm dev` load .env, fix secret names in the rotation doc
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-09T19:44:32.673Z
sourcePromptId: review-the-project-for-code-quality-perofmance-i-c56527b0
agentType: dev-lead
dependsOn: [docs-archive-historical]
planId: pl-mv1dism9-2d1c5f
---
# Goal

doc. .env.example misses vars the code needs (CLERK_SECRET_KEY, VITE_CLERK_PUBLISHABLE_KEY, PROJECT_SNAPSHOT_TOKEN, BILKO_GAME_HMAC_KEY, ...), lists one nobody reads (STRIPE_PUBLISHABLE_KEY), and nothing loads .env at all, so a newcomer following it gets a server with no config. docs/secrets-rotation.md names STRIPE_API_KEY where the server reads STRIPE_SECRET_KEY. Fix all three.

# Acceptance criteria

- [ ] Every `process.env.X` / `import.meta.env.X` read in server/, shared/, src/, scripts/ and mcp-host-server/src/ appears in .env.example exactly once (derive the list with git grep, not from memory); STRIPE_PUBLISHABLE_KEY is removed if still unread.
- [ ] .env.example is grouped under three headed sections — Required to run the site / Optional features / Scripts and tooling only — with a one-line plain-English comment per var saying what breaks without it; no real secret values.
- [ ] package.json `dev:server` loads .env when present and still starts when it is absent (e.g. `tsx watch --env-file-if-exists=.env server/index.ts`, Node >= 22.9); proven in the report by starting it once with a temp .env holding a dummy var and once without .env (each bounded by `timeout 20`). `engines` is not changed.
- [ ] docs/secrets-rotation.md: STRIPE_API_KEY is corrected to STRIPE_SECRET_KEY for the server (noting scripts/cost-monitor.ts reads STRIPE_API_KEY), CLERK_WEBHOOK_SECRET is removed if no code reads it, and ANTHROPIC_API_KEY_ACADEMY, PROJECT_SNAPSHOT_TOKEN and BILKO_GAME_HMAC_KEY are added.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- .env.example
- package.json
- docs/secrets-rotation.md

# Implementation notes

Repo: /home/bilko/Projects/Bilko. Local node is v22.22.1.

Read first: .env.example; docs/secrets-rotation.md; package.json scripts; vite.config.ts (dev port 3002, proxy /api to 4000).

Steps:
1. `git grep -ohE "process\.env\.[A-Z0-9_]+|import\.meta\.env\.[A-Z0-9_]+" -- server shared src scripts mcp-host-server/src | sort -u` to build the list (ignore NODE_ENV, PORT and Vite built-ins DEV/PROD/MODE/BASE_URL beyond a single mention).
2. Rewrite .env.example.
3. Change dev:server; prove both runs; do not leave a .env file behind.
4. Fix docs/secrets-rotation.md.

Do not touch: server code, server/db.ts secret_metadata seeds, README.md, CLAUDE.md.

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 120 node -e 'const p=require("./package.json");if(!/env-file/.test(p.scripts["dev:server"]))process.exit(1)'
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
