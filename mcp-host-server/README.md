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

All mutating tools default to `autoCommit: true` — they push to both `origin` and `content-grade`, so Render auto-deploys. Pass `autoCommit: false` to stage-only.

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
5.  Every deploy:                bilko-host__publish_static_project { slug, distPath: "/abs/path/dist" }
6.  Verify:                      bilko-host__status
```

That's it. Render redeploys after step 4 and 5; bilko.run/projects/<slug>/ goes live within ~minute.

## Safety notes

- The server resolves the host repo from its own location: `<HOST_ROOT>/mcp-host-server/dist/server.js` → `<HOST_ROOT>`. Don't move the binary.
- `register_static_project` refuses duplicate slugs — call `unregister_project` first if you want to replace.
- `publish_static_project` requires the slug to already be registered (override with `requireRegistered: false`).
- All commits use the message format `registry: add <slug> (<name>)`, `registry: remove <slug>`, or `publish: <slug> build`.
- Pushes go to **both** `origin` (StanislavBG/bilko-run) and `content-grade` (Content-Grade/Content-Grade master), per the host's CLAUDE.md rule. A failure on one remote is reported but doesn't block the other.
