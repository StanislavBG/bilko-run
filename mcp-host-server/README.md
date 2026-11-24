# bilko-host MCP server

An [MCP](https://modelcontextprotocol.io) server that lets a Claude session in a **sibling-repo app** (e.g. `~/Projects/Outdoor-Hours`, `~/Projects/Local-Score`, `~/Projects/Bilko-Game-Academy`) register, publish, and inspect its app on the bilko.run host **without editing the host repo by hand**.

The host (this repo) stays the source of truth for the registry; the MCP is the API.

## Why

Per the [host contract](../docs/host-contract.md), each app lives in its own repo and its own Claude session. Without an MCP, those sessions either need write access to the host or have to ping a human ("please add my entry to projectsRegistry.ts and run the sync"). With this MCP they don't — they just call `register_static_project` and `publish_static_project` and the host repo updates and pushes itself.

## Tools

| Tool | Auth | Mutates host? | Use when |
|---|---|---|---|
| `get_host_contract` | none | no | First thing to call from a new session — returns the full contract markdown. |
| `list_projects` | none | no | Check if a slug is taken; inspect what is currently registered. |
| `get_project` | none | no | Read one registry entry (`{ slug }`) before editing its listing. Like `list_projects`, it reads `origin/main`, so it sees listings pushed since the host checkout was last pulled. |
| `register_static_project` | none | yes (registry + commit + push) | First deploy of a new app. |
| `register_external_project` | none | yes (registry + commit + push) | Register an app hosted on its own domain: `{ slug, url (https://), name, tagline, category, status, year, callerRepoPath, … }`. The card links straight to `url`; nothing is published. |
| `update_project_listing` | none | yes (registry + commit + push) | Change your own `/projects` card: `{ slug, callerRepoPath, patch }`. Only project-owned fields; `public`, slug and hosting are rejected. |
| `set_listing_media` | none | yes (registry commit + push; bytes uploaded to bilko.run) | Upload your card's `video` (MP4/WebM, up to 8 MB), `shareImage` (PNG exactly 1200x630, up to 5 MB) or `icon` (square PNG 128-1024 px, up to 512 KB) from local files: `{ slug, callerRepoPath, media: { video?, shareImage?, icon? } }`; `null` removes a field. Works for static-path and external-url slugs; only the bound repo may call it. Bytes are hosted by bilko.run at `/projects/<slug>/_media/<sha256>.<ext>`, never committed; the card updates after the ~1 minute redeploy. |
| `set_app_backend` | none | yes (registry + commit + push) | Set or clear the origin bilko.run forwards `/projects/<slug>/api/*` to: `{ slug, callerRepoPath, origin }`, where `origin` is a bare https origin (no path, query, hash or credentials; a trailing `/` is dropped) or `null` to clear. Static-path slugs only, and only the repo bound to the slug (`host.localPath`) may call it, because the forwarder passes users' `Authorization` headers to that origin. Takes effect after the ~1 minute redeploy (`GET /api/health` then shows `appBackends.<slug> = "registry"`); an `APP_BACKENDS` entry on Render overrides it for that slug. |
| `app_team` | registry key | no (calls the host team API) | Manage your app's Bilko-DB team: `{ slug, callerRepoPath, action: 'list' \| 'set' \| 'remove', email?, role? }`. `list` calls `GET /api/db/<slug>/team` (one line per member: email and role); `set` calls `PUT /api/db/<slug>/team/members/<email>` with `{ role: 'owner' \| 'member' }`; `remove` calls `DELETE` on the same path. Only the bound repo may call it. The registry-scope admin key comes from `BILKO_REGISTRY_KEY`, else the file at `BILKO_REGISTRY_KEY_FILE`, else `~/.config/bilko-host/registry-key`; the owner mints it. `BILKO_HOST_URL` overrides `https://bilko.run`. Failures show the HTTP status and the API error code. |
| `unregister_project` | none | yes | Retire an app (optionally also delete `public/projects/<slug>/`). |
| `publish_static_project` | none | yes (copies bytes + commit + push) | After every `vite build` in your app repo. |
| `status` | none | no | Verify a publish landed; see uncommitted state. |
| `usage_report` | admin key | no | Per-project egress (bytes out + requests) over a trailing window. Calls `/api/admin/egress` on bilko.run with the admin key. Capacity-signal numbers measured at the origin, not Render billing figures; they under-report by up to the flush interval (60s) on every process restart. |
| `errors_report` | admin key | no | App errors grouped by app + signature over a trailing window (`/api/admin/observability/errors`). |
| `error_detail` | admin key | no | One `app_errors` row by id (`/api/admin/observability/errors/:id`). |
| `traffic_report` | admin key | no | Visitors, bot/human split, top pages and referrers (`/api/admin/traffic`). `excludeSelf` defaults to true (sends `mine=exclude`); `excludeSelf: false` sends `mine=include`. `includeBots` defaults to true (sends `bots=include`), because the human numbers exclude bots either way; `includeBots: false` sends `bots=exclude`, which only trims `byClass`/`topPagesByClass`. |
| `funnel_report` | admin key | no | Per-UTM revenue funnel: visits, sign-ins, checkout, paid, booked (`/api/admin/funnel`). Always excludes the owner and bot sessions (the host's defaults; no opt-out). |
| `flows_report` | admin key | no | Per-app sessions, views, clicks, events, errors and flow steps (`/api/admin/flows`). Sends `mine=exclude&bots=exclude` unless `includeMine` / `includeBots` is true. `env` defaults to `prod` and is always sent: host-kit 0.11.0+ tags localhost runs `dev` and webdriver (Playwright) runs off bilko.run `test`, and rows without `env` (older host-kit) count as prod. `env: 'dev'` or `'test'` reads only that env; `env: 'all'` turns the filter off. Returns the host's `filters` echo (`{ mine, bots, env }`). |
| `sessions_report` | admin key | no | Per-session audit (`/api/admin/sessions`): landing and exit path, referrer host, utm, country, device, counts, apps and the owner/bot flags. `timeline: true` adds each session's timeline (`/api/admin/sessions/:id`, at most 50 sessions, 5 requests at a time); `sessionId` reads one session. Same `mine` / `bots` defaults and opt-outs as `flows_report`; no `env` filter. Never returns an email. |
| `checkout_starts_report` | admin key | no | One row per checkout start, newest first (`/api/admin/checkout-starts`; `days` default 7, 1–90; `limit` 1–1000). Nothing is filtered: each row carries its `label` (human, automated or unlabeled) and `labelReasons`, `counted` (false only for owner-flagged starts), `mine` and `mineReasons`, and its `session` (landing path, referrer, utm, country, device) or a `sessionNote`, and for an agent-buy start its `/buy` page `hit` (visitor class, country, device, browser, os, referrer; matched by IP hash and time, never the IP or user agent). `totals.counted` equals the checkout starts `/api/admin/web-products` reports. `timeline: true` adds each start's session timeline (`/api/admin/sessions/:id`, at most 50 sessions, 5 requests at a time). Never returns an email. |
| `git_viewer_report` | admin key | no | Hosted Git Viewer portfolios and `git_viewer` subscriptions in one call (`/api/admin/git-viewer/profiles`). `totals` (all, byTier, claimed/unclaimed, byBuiltBy) leave out the showcase logins (`SHOWCASE_LOGINS`, the owner's own portfolio) and nothing else, so the owner's and automation's builds show up in `byBuiltBy`; `subscriptions` (`active`, `total`) count every `git_viewer` subscription, the owner's included; `rows` list every login newest first, the showcase ones flagged, at most 500. Never returns an email, payload or allowlist. |

The four visitor reports count real visitors by default. What the owner (`mine`), bot (`bots`) and `flows_report` telemetry `env` filters exclude, and what they miss: [Observability §11](../docs/observability.md#11-reading-your-numbers-through-the-bilko-host-mcp).

Mutating tools commit and push to `origin`, so Render auto-deploys.

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

See the [host contract](../docs/host-contract.md). `publish_static_project` needs `sourceRepoPath` (the repo root, not `dist/`) for its `golden` and `audit` gates.

## Environment variables

| Var | Required | Effect |
|---|---|---|
| `BILKO_PUBLISH_CHECKOUT` | No | Absolute path to the dedicated git checkout the server uses for every mutating call (commit + push happen here, never in your working tree). Defaults to `~/.local/state/bilko-host/publish-checkout`; missing parent directories are created on first use. |
| `TURSO_DATABASE_URL` | No | Turso database URL for manifest rows and publish-override audit logs. |
| `TURSO_AUTH_TOKEN` | No | Auth token paired with `TURSO_DATABASE_URL`. |
| `BILKO_ADMIN_KEY` | For `usage_report` / `errors_report` / `error_detail` / `traffic_report` / `funnel_report` / `flows_report` / `sessions_report` / `checkout_starts_report` / `git_viewer_report` | Personal read-only admin API key (`bka_...`), minted at https://bilko.run/admin/secrets. Sent as `Authorization: Bearer` to the bilko.run admin API. Wins over the key file. |
| `BILKO_ADMIN_KEY_FILE` | No | Key file read when `BILKO_ADMIN_KEY` is unset. Defaults to `~/.config/bilko-host/admin-key`. Must be mode `0600` (refused otherwise). |
| `BILKO_BASE_URL` | No | Base URL of the host the admin API is called on. Defaults to `https://bilko.run`. |

**Admin key (one human step).** Signed in as admin, open https://bilko.run/admin/secrets → *Admin API keys* → create a key and copy the `bka_...` value (shown once). Then:

```sh
mkdir -p ~/.config/bilko-host && (umask 077; cat > ~/.config/bilko-host/admin-key)   # paste the key, Enter, Ctrl-D
```

No restart needed: the key is read on every admin call. This keeps the key out of `~/.claude.json`.

Without `TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN` set, the server's DB writes (manifest upserts, `publish_overrides` audit rows) fall back to a local SQLite file at `data/contentgrade.db` under the host repo root (`HOST_ROOT`, resolved from the server's location; `src/db.ts`) — fine for a local/dev MCP session, but it means those writes aren't visible to the production host's `/admin` dashboards. Set both vars to write to the same Turso instance the deployed host uses.

## Safety notes

Ownership, trust model, listings and one-publisher-per-slug rules live in the [host contract](../docs/host-contract.md).
