# Deployment — bilko.run on Render

## Where it deploys from

bilko.run auto-deploys from `origin` = `StanislavBG/bilko-run`, branch `main`. Push to `origin main` and Render picks it up. The deploy source is set in the Render dashboard; there is no `render.yaml` in this repo.

## What Render runs

- Build: `pnpm install && pnpm build` (`build` in package.json is `vite build && tsc -p tsconfig.server.json`)
- Start: `pnpm start` (`node dist-server/server/index.js`)

These come from `package.json`. Confirm the exact commands in the Render dashboard (service → Settings → Build & Deploy), since the dashboard is what actually runs.

## Env vars

Env vars live in the Render dashboard (service → Environment). They are not committed to the repo. Rotation steps are in [secrets-rotation.md](secrets-rotation.md).

## Checking a deploy

Compare the server uptime with the time you pushed. A fresh deploy resets uptime to seconds or minutes:

```bash
curl -s https://bilko.run/api/health | jq .uptime
```

If uptime is still days old well after the build time (about 3–5 minutes), the deploy has not landed. Open the Render dashboard, check the service's Events tab, and use **Manual Deploy → Deploy latest commit** if needed.

To confirm a newly published static app is live, fetch its page and check that it returns its own title, not the host app's:

```bash
curl -s "https://bilko.run/projects/<slug>/" | grep -oE "<title>[^<]+</title>"
```

## Never do

- Never push Bilko to the `content-grade` remote. It is a separate, unrelated project and its history has diverged.
- Never add secrets to the repo; set them in the Render dashboard.

## Deploy drain and large static downloads

On a deploy Render moves traffic to the new instance, waits 60 s, sends SIGTERM to the old one, and SIGKILLs it after the service's shutdown delay. The server drains on SIGTERM (`server/shutdown.ts`): in-flight responses finish, the WebSocket relays close with 1012 so clients reconnect, and the meters flush first. `SHUTDOWN_DRAIN_SECONDS` (default 290) is only a backstop.

**The real limit is Render's `maxShutdownDelaySeconds`**: 30 s by default, so a download gets about 90 s after the traffic switch. The maximum is 300 s, set through the Render API (`PATCH /v1/services/<id>` with `maxShutdownDelaySeconds: 300`); the dashboard does not expose it. Raising it to 300 gives a download about 6 minutes.

Static files are precompressed at build time (`server/precompress.ts`, the last step of `pnpm build`), and `@fastify/static` serves the `.br`/`.gz` sibling with a Content-Length instead of compressing on every request.

Edge caching is Render's, not ours (the domain has no Cloudflare zone of its own). Turn it on under the service's Edge Caching setting and choose "all file types", because `.wasm`/`.pck` are not in the default list. Render purges the edge cache on every deploy, so a hit lasts only until the next push.
