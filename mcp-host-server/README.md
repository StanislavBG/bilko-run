# bilko-host MCP server

An [MCP](https://modelcontextprotocol.io) server that lets a Claude session in a **sibling-repo app** (e.g. `~/Projects/Outdoor-Hours`, `~/Projects/Local-Score`, `~/Projects/Bilko-Game-Academy`) register, publish, and inspect its app on the bilko.run host **without editing the host repo by hand**.

The host (this repo) stays the source of truth for the registry; the MCP is the API.

## Why

Per the [host contract](../docs/host-contract.md), each app lives in its own repo and its own Claude session. Without an MCP, those sessions either need write access to the host or have to ping a human ("please add my entry to projectsRegistry.ts and run the sync"). With this MCP they don't — they just call `register_static_project` and `publish_static_project` and the host repo updates and pushes itself.

## Tools

| Tool | Mutates host? | Use when |
|---|---|---|
| `get_host_contract` | no | First thing to call from a new session — returns the full contract markdown. |
| `list_projects` | no | Check if a slug is taken; inspect what's currently registered. |
| `register_static_project` | yes (registry + commit + push) | First deploy of a new app. |
| `unregister_project` | yes | Retire an app (optionally also delete `public/projects/<slug>/`). |
| `publish_static_project` | yes (copies bytes + commit + push) | After every `vite build` in your app repo. |
| `status` | no | Verify a publish landed; see uncommitted state. |
| `usage_report` | no | Per-project egress (bytes out + requests) over a trailing window. Reads `api_egress_daily` straight through this MCP's Turso client — no Clerk JWT, works from cron/headless. These are capacity-signal numbers measured at the origin, not Render billing figures, and under-report by up to the flush interval (60s) on every process restart. |

All mutating tools default to `autoCommit: true` — they push to `origin`, so Render auto-deploys. Pass `autoCommit: false` to stage-only.

## Build

```bash
cd ~/Projects/Bilko/mcp-host-server
pnpm install
pnpm build      # → dist/server.js
```

`pnpm dev` runs via tsx without a build step.

## Wire it into a sibling-repo Claude session

In your app repo (e.g. `~/Projects/Outdoor-Hours/`), add a `.mcp.json`:

```json
{
  "mcpServers": {
    "bilko-host": {
      "command": "node",
      "args": ["/home/bilko/Projects/Bilko/mcp-host-server/dist/server.js"]
    }
  }
}
```

Claude Code picks it up automatically when you open the repo.

## Typical sibling-repo session flow

```
1.  Read the contract:           bilko-host__get_host_contract
2.  Pick a slug, check it free:  bilko-host__list_projects
3.  Build:                       pnpm build (in your repo)
4.  First deploy only:           bilko-host__register_static_project { slug, name, ... }
5.  Every deploy:                bilko-host__publish_static_project {
                                    slug,
                                    distPath: "/abs/path/dist",
                                    sourceRepoPath: "/abs/path/to/repo"
                                  }
6.  Verify:                      bilko-host__status
```

`sourceRepoPath` is the sibling repo root (not `dist/`). The `golden` and `audit` publish gates shell out into it to run `tests/golden.spec.ts` and `pnpm audit`; omit it and both gates fail outright, which blocks the publish unless you explicitly bypass them.

That's it. Render redeploys after step 4 and 5; bilko.run/projects/<slug>/ goes live within ~minute.

## Environment variables

| Var | Required | Effect |
|---|---|---|
| `BILKO_PUBLISH_CHECKOUT` | No | Absolute path to the dedicated git checkout the server uses for every mutating call (commit + push happen here, never in your working tree). Defaults to `~/.local/state/bilko-host/publish-checkout`. |
| `TURSO_DATABASE_URL` | No | Turso database URL for manifest rows and publish-override audit logs. |
| `TURSO_AUTH_TOKEN` | No | Auth token paired with `TURSO_DATABASE_URL`. |

Without `TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN` set, the server's DB writes (manifest upserts, `publish_overrides` audit rows) fall back to a local SQLite file at `data/contentgrade.db` relative to the server's working directory — fine for a local/dev MCP session, but it means those writes aren't visible to the production host's `/admin` dashboards. Set both vars to write to the same Turso instance the deployed host uses.

## Safety notes

- The server resolves the host repo from its own location: `<HOST_ROOT>/mcp-host-server/dist/server.js` → `<HOST_ROOT>`. Don't move the binary.
- `register_static_project` refuses duplicate slugs — call `unregister_project` first if you want to replace.
- `publish_static_project` requires the slug to already be registered (override with `requireRegistered: false`).
- **One publisher per slug.** `publish_static_project` atomically swaps the new build in for `public/projects/<slug>/`. A second publisher targeting the same slug overwrites the first's bytes on its next publish — even if it ships only a sub-directory the first bundle doesn't contain. A slug's static prefix must have exactly one owning publisher; see "One publisher per `/projects/<slug>/` prefix" in the [host contract](../docs/host-contract.md).
- All commits use the message format `registry: add <slug> (<name>)`, `registry: remove <slug>`, or `publish: <slug> build`.
- Pushes go to `origin` (StanislavBG/bilko-run) only. `content-grade` (Content-Grade/Content-Grade) is a separate, unrelated project with diverged history — the server never pushes there, per the host's CLAUDE.md rule.
