# Deployment — bilko.run on Render

## Where it deploys from

bilko.run auto-deploys from `origin` = `StanislavBG/bilko-run`, branch `main`. Push to `origin main` and Render picks it up. The deploy source is set in the Render dashboard; there is no `render.yaml` in this repo.

## What Render runs

- Build: `pnpm install && pnpm build` (`build` in package.json is `vite build && tsc -p tsconfig.server.json && node dist-server/server/precompress-cli.js dist`; the last step precompresses static files)
- Start: `pnpm start` (`node dist-server/server/index.js`)

These come from `package.json`. Confirm the exact commands in the Render dashboard (service → Settings → Build & Deploy), since the dashboard is what actually runs.

## Node version

`engines.node` in `package.json` sets the Node version. The ceiling matters: Render resolves a range to the newest release inside it on every build, so patch releases arrive on their own and a new major never does. That puts production on the newest Node 24 release. CI reads the same field (`node-version-file: package.json`), so it tests the same range.

The floor stays at 22 because this machine runs Node 22. Outside the range pnpm prints an `Unsupported engine` warning on stdout, which breaks scripts that parse pnpm output, such as the blog watchdog, and fails `pnpm test` in every scheduler gate here. Raise the floor only after upgrading local Node.

Render uses the first of these it finds: a `NODE_VERSION` env var, `.node-version`, `.nvmrc`, `engines`. Keep the first three unset, or `engines` stops deciding anything. An exact pin in `.node-version` would also stop patch releases.

To see what production runs, use the admin key (`~/.config/bilko-host/admin-key`):

```bash
curl -s -H "Authorization: Bearer $(cat ~/.config/bilko-host/admin-key)" https://bilko.run/api/admin/runtime
```

`node` is the running release. `nodeVersionEnv` should be `null`: Render never sets that variable itself, so any value means it is set on the service and is overriding `engines`. After removing it, choose **Save, rebuild, and deploy**, because Render picks the Node version at build time.

To move to a new major, run `pnpm typecheck`, `pnpm test`, `pnpm --filter host-kit test` and `pnpm build` on it, then change both bounds together. Node 25 and later add a global `localStorage` that hides jsdom's, so `packages/host-kit/tests/telemetry.test.ts` fails on Node 26 until its test setup handles that.

## Env vars

Env vars live in the Render dashboard (service → Environment). They are not committed to the repo. A change reaches the running server only after a restart, so save it with a deploy. Rotation steps are in [secrets-rotation.md](secrets-rotation.md).

[`.env.example`](../.env.example) is the one list of env var names the code reads, each with a one-line meaning. Copy it to `.env` for local dev. Where the behavior behind a var is documented:

- Stripe keys and the live/test split: [commerce.md](commerce.md) ("Stripe live vs test").
- `PLAY_CURRENCY_SALES_OPEN` and `PLAY_CURRENCY_FREE_PACKS`: [commerce.md](commerce.md) ("Play currency"); switching them is under [Realtime relay constraints](#realtime-relay-constraints).
- `ROOMS_CLOSED`: [host-contract.md](host-contract.md) ("Authoritative game rooms") and [Realtime relay constraints](#realtime-relay-constraints).
- `BILKO_CSP_ENFORCE`: [host-internals.md](host-internals.md).
- `BILKO_GAME_HMAC_KEY`: [host-contract.md](host-contract.md) ("Game services").

`APP_BACKENDS` is an optional override of the registry's `host.backend` per slug: apps set their own backend with the `bilko-host` MCP tool `set_app_backend`, and what is forwarded and the errors apps see are in [host-contract.md](host-contract.md) ("App backends (forwarding)"). A valid entry here wins for its slug; every other slug keeps its registry backend, and an invalid entry leaves that slug on its registry backend. The value is a comma list of `<slug>=<https origin>`, for example `APP_BACKENDS=threewinds=https://<service>.onrender.com`. Unset means only registry backends are forwarded. The origin must be `https://` with no path, query or credentials (`http://` only for localhost). A malformed entry is skipped and logged at boot as `[app-backends] APP_BACKENDS entry <n> ignored: <reason>`, followed by ` (slug <slug>)` once the slug is valid; for a duplicate slug the first entry wins. Each forwarded slug logs one boot line, `[app-backends] forwarding /projects/<slug>/api/ -> <origin>/api/ (env APP_BACKENDS)` for an override or `[app-backends] forwarding /projects/<slug>/api/ -> <origin>/api/ (registry)` for a registry backend; `/api/health` lists the same slugs under `appBackends` with source `"env"` or `"registry"`. The value is read only at boot, so a change needs a redeploy.

## Checking a deploy

Compare the server uptime with the time you pushed. A fresh deploy resets uptime to seconds or minutes:

```bash
curl -s https://bilko.run/api/health | jq .uptime
```

If uptime is still days old well after the build time (a redeploy takes about 3–5 minutes), the deploy has not landed. Open the Render dashboard, check the service's Events tab, and use **Manual Deploy → Deploy latest commit** if needed.

To confirm a newly published static app is live, fetch its page and check that it returns its own title, not the host app's:

```bash
curl -s "https://bilko.run/projects/<slug>/" | grep -oE "<title>[^<]+</title>"
```

## Realtime relay constraints

The WebSocket relay (`server/realtime/relay.ts`) and its lobby directory (`server/realtime/lobbies.ts`) keep rooms in one process's memory.

- **One instance only.** Scaling Render horizontally would split a room across instances. That needs room-to-instance routing (or a shared pub/sub) first.
- A deploy drops every room (`1012`). Clients reconnect with a fresh ticket and resync from their own state. The server keeps no input log. The lobby directory is emptied too. Hosts re-announce on their next heartbeat PUT (the Game Academy client sends one every 10 s; a listing expires 30 s after its last PUT, `LOBBY_TTL_MS` in `server/realtime/lobbies.ts`).
- **Render tier.** The service runs one instance; its plan and region are shown in the Render dashboard (service → Settings → Instance Type). On the Free plan the service spins down after 15 minutes without inbound traffic, so the first ticket after an idle spell waits for a cold start (tens of seconds), and a spin-down drops every live room. Online play beyond casual testing needs a plan that does not sleep (Starter or above).
- **Authoritative game rooms** (`server/rooms/socket.ts`, `server/routes/rooms.ts`) run in one process too, but their tables are saved to the room store on every move. A deploy or a spin-down closes the sockets with `1012`; when a seated player asks for a new ticket, the table resumes with its hand and escrows. They do not need a paid Render tier: a paid tier that does not sleep only removes the cold-start wait after an idle spell.
- **Three Winds tables are open by default.** `ROOMS_CLOSED` is the emergency switch: set `ROOMS_CLOSED=threewinds` on Render and both room endpoints answer `409 rooms_closed`. Leave it unset otherwise. Keep `PLAY_CURRENCY_SALES_OPEN` unset (web tael sales closed) until the owner decides to sell taels.
- **Three Winds free test packs (temporary).** To make every tael pack free, set `PLAY_CURRENCY_FREE_PACKS=threewinds` on Render (service → Environment) and save it with a deploy. `GET /api/play-currency/balance?app=threewinds` then reports `freePacks: true`. To end the test, delete the variable the same way. What the switch does to checkout and the ledger is in [commerce.md](commerce.md) ("Play currency").

## Never do

- Push only to `origin` `main` of `StanislavBG/bilko-run`: see [Rules everyone shares](map.md#rules-everyone-shares).
- Never add secrets to the repo; set them in the Render dashboard.

## Deploy drain and large static downloads

On a deploy Render moves traffic to the new instance, waits 60 s, sends SIGTERM to the old one, and SIGKILLs it after the service's shutdown delay. The server drains on SIGTERM (`server/shutdown.ts`): in-flight responses finish, the WebSocket relays close with 1012 so clients reconnect, and the meters flush first. `SHUTDOWN_DRAIN_SECONDS` (default 290) is only a backstop.

**The real limit is Render's `maxShutdownDelaySeconds`**: 30 s by default, so a download gets about 90 s after the traffic switch. The maximum is 300 s, set through the Render API (`PATCH /v1/services/<id>` with `maxShutdownDelaySeconds: 300`); the dashboard does not expose it. Raising it to 300 gives a download about 6 minutes.

Static files are precompressed at build time (`server/precompress.ts`, the last step of `pnpm build`), and `@fastify/static` serves the `.br`/`.gz` sibling with a Content-Length instead of compressing on every request.

Edge caching is Render's, not ours (the domain has no Cloudflare zone of its own). Turn it on under the service's Edge Caching setting and choose "all file types", because `.wasm`/`.pck` are not in the default list. Render purges the edge cache on every deploy, so a hit lasts only until the next push.
