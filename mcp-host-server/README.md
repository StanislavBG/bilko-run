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
| `register_external_project` | yes (registry + commit + push) | Register an app hosted on its own domain: `{ slug, url (https://), name, tagline, category, status, year, callerRepoPath, … }`. The card links straight to `url`; nothing is published. |
| `update_project_listing` | yes (registry + commit + push) | Change your own `/projects` card: `{ slug, callerRepoPath, patch }`. Only project-owned fields; `public`, slug and hosting are rejected. |
| `get_project` | no | Read one registry entry (`{ slug }`) before editing its listing. Like `list_projects`, it fetches and reads `origin/main`, so it sees listings pushed since the host checkout was last pulled. |
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

### Headless / scheduled runs (`claude -p`)

A project-scoped `.mcp.json` server needs interactive approval, so a headless `claude -p` run (e.g. a scheduled PRD) may never load it. For headless publishing, register the server at user scope instead (this is how this machine is configured today):

```bash
claude mcp add -s user bilko-host -- node /home/bilko/Projects/Bilko/mcp-host-server/dist/server.js
```

Even when the server is connected, its tools may arrive as *deferred* tools: the executor must load them with `ToolSearch` (`select:mcp__bilko-host__publish_static_project`) before calling them. A headless prompt that expects `publish_static_project` should say so explicitly instead of assuming the tool is already in the tool list.

## Typical sibling-repo session flow

```
1.  Read the contract:           bilko-host__get_host_contract
2.  Pick a slug, check it free:  bilko-host__list_projects
3.  Build:                       pnpm build (in your repo)
4.  First deploy only:           bilko-host__register_static_project { slug, name, tagline, category, status, year, callerRepoPath, ... }
5.  Every deploy:                bilko-host__publish_static_project {
                                    slug,
                                    distPath: "/abs/path/dist",
                                    sourceRepoPath: "/abs/path/to/repo"
                                  }
6.  Verify:                      bilko-host__status
```

`sourceRepoPath` is the sibling repo root (not `dist/`). The `golden` and `audit` publish gates shell out into it to run `tests/golden.spec.ts` and `pnpm audit` (`npm audit --omit=dev` in npm-only repos); omit it and both gates fail outright, which blocks the publish unless you explicitly bypass them.

That's it. Render redeploys after step 4 and 5; bilko.run/projects/<slug>/ goes live within ~minute.

## Environment variables

| Var | Required | Effect |
|---|---|---|
| `BILKO_PUBLISH_CHECKOUT` | No | Absolute path to the dedicated git checkout the server uses for every mutating call (commit + push happen here, never in your working tree). Defaults to `~/.local/state/bilko-host/publish-checkout`; missing parent directories are created on first use. |
| `TURSO_DATABASE_URL` | No | Turso database URL for manifest rows and publish-override audit logs. |
| `TURSO_AUTH_TOKEN` | No | Auth token paired with `TURSO_DATABASE_URL`. |
| `BILKO_ADMIN_KEY` | For `usage_report` / `errors_report` / `error_detail` / `traffic_report` / `funnel_report` | Personal read-only admin API key (`bka_...`), minted at https://bilko.run/admin/secrets. Sent as `Authorization: Bearer` to the bilko.run admin API. Wins over the key file. |
| `BILKO_ADMIN_KEY_FILE` | No | Key file read when `BILKO_ADMIN_KEY` is unset. Defaults to `~/.config/bilko-host/admin-key`. Must be mode `0600` (refused otherwise). |
| `BILKO_BASE_URL` | No | Base URL of the host the admin API is called on. Defaults to `https://bilko.run`. |

**Admin key (one human step).** Signed in as admin, open https://bilko.run/admin/secrets → *Admin API keys* → create a key and copy the `bka_...` value (shown once). Then:

```sh
mkdir -p ~/.config/bilko-host && (umask 077; cat > ~/.config/bilko-host/admin-key)   # paste the key, Enter, Ctrl-D
```

No restart needed: the key is read on every admin call. This keeps the key out of `~/.claude.json`.

Without `TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN` set, the server's DB writes (manifest upserts, `publish_overrides` audit rows) fall back to a local SQLite file at `data/contentgrade.db` relative to the server's working directory — fine for a local/dev MCP session, but it means those writes aren't visible to the production host's `/admin` dashboards. Set both vars to write to the same Turso instance the deployed host uses.

## Safety notes

- The server resolves the host repo from its own location: `<HOST_ROOT>/mcp-host-server/dist/server.js` → `<HOST_ROOT>`. Don't move the binary.
- `register_static_project` / `register_external_project` refuse duplicate slugs — call `unregister_project` first if you want to replace.
- **Ownership.** `register_static_project` binds the slug to `callerRepoPath` (stored as `host.localPath`). `publish_static_project` (`sourceRepoPath`), `unregister_project` and `update_project_listing` (`callerRepoPath`) refuse any other repo. `publish_static_project` also refuses unregistered slugs.
- **Trust model.** The ownership check compares a self-asserted `callerRepoPath` / `sourceRepoPath` with `host.localPath`. It stops one project's session editing another's slug by mistake; it is not authentication and does not stop a hostile local session. The real boundary is that write tools exist only in this local stdio MCP on the owner's machine and push with the owner's GitHub access to `StanislavBG/bilko-run`; the public `https://bilko.run/mcp` is read-only. Details: [host contract, Trust model](../docs/host-contract.md#trust-model).
- **Listings.** Siblings own their card content. Edit it with `update_project_listing`, or commit a `bilko.listing.json` (max 16 KB, same shape as the `patch`) at the repo root: `publish_static_project` syncs it into the registry. `public`, `slug`, `host`, `year` and `launchedAt` are Bilko-owned. `register_static_project` never sets `public`; going public is the Bilko owner's call. Caps and the banned-term rule are in the [host contract](../docs/host-contract.md) under "Project listing — who owns what".
- **One publisher per slug.** `publish_static_project` atomically swaps the new build in for `public/projects/<slug>/`. A second publisher targeting the same slug overwrites the first's bytes on its next publish — even if it ships only a sub-directory the first bundle doesn't contain. A slug's static prefix must have exactly one owning publisher; see "One publisher per `/projects/<slug>/` prefix" in the [host contract](../docs/host-contract.md).
- All commits use the message format `registry: add <slug> (<name>)`, `registry: remove <slug>`, `listing: update <slug>`, or `publish: <slug> build`.
- Pushes go to `origin` (StanislavBG/bilko-run) only. `content-grade` (Content-Grade/Content-Grade) is a separate, unrelated project with diverged history — the server never pushes there, per the host's CLAUDE.md rule.
