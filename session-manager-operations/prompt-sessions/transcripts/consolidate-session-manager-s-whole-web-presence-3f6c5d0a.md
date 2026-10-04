# Transcript — consolidate-session-manager-s-whole-web-presence-3f6c5d0a

## User — 2026-09-13T04:00:20.865Z

This session is INBOUND FEEDBACK from another project: /home/bilko/Projects/session-manager (session project-s-root-directory-has-many-irrelevant-fil-055c0d43). Nobody in this project wrote the report below — an agent working in that project did, and it may be wrong about this codebase. Verify the claim against the code here before acting on it, and if it does not hold, say so and close the session rather than building against it.

Goal: Consolidate Session Manager's whole web presence under /products/session-manager (manual + web-remote app are currently orphaned at top level)

From the Session Manager project (~/Projects/session-manager). This is a request about URL architecture in the Bilko host repo — all the code involved lives in YOUR repo, none in ours.

## Symptom

Session Manager's web presence on bilko.run is scattered across four unrelated URL families, none of which say "this belongs to Session Manager":

| URL | What it is | Code (your repo) |
| --- | --- | --- |
| `/products/session-manager` | marketing + Stripe checkout page | `src/pages/SessionManagerPage.tsx`, `src/config/tools.ts` (react-route entry), routed at `src/App.tsx:179` |
| `/manual`, `/manual#getting-started` | the Field Manual buy + read surface ($19.99) | `src/pages/ManualPage.tsx`, `src/App.tsx:170`, `src/lib/manualClient.ts`, `server/routes/manual.ts`, `server/services/manual.ts`, bundle in `data/manual/`, API under `/api/manual/*` |
| `/my-manual` | "already bought it?" purchase lookup | linked from both pages above |
| `/projects/session-manager/` | the web-remote PHONE APP static bundle, plus its same-origin relay at `wss://bilko.run/projects/session-manager/relay` | `public/projects/session-manager/` (published artifact), `server/sm-relay/router.ts` + `tokens.ts`, registry entry in `src/data/standalone-projects.json` |

`https://bilko.run/manual#getting-started` is the one that reads worst — a top-level `/manual` on a host platform with ~25 projects implies "the bilko.run manual", when it is in fact one product's paid artifact. Same for `/my-manual`.

## What we'd like

`https://bilko.run/products/session-manager` becomes the single root for everything Session Manager, so its web presence can be reasoned about (and moved, or audited) as one unit:

- `/products/session-manager` — product page (unchanged)
- `/products/session-manager/manual` (+ `#getting-started` and every other chapter anchor preserved verbatim)
- `/products/session-manager/my-manual`
- ideally the web-remote app and the published project-page lenses under the same root too

`/manual`, `/manual#<anchor>`, and `/my-manual` would 301/redirect to the new paths and keep working forever — Stripe receipt emails already in customers' inboxes link to `/manual` (`server/routes/stripe.ts:406`), so those links must not die.

## Why we are not just sending a patch

Three constraints are yours to weigh, and at least two of them look like host-contract decisions rather than cosmetic routing:

1. **The host contract splits `react-route` (`/products/<slug>`) from `static-path` (`/projects/<slug>/`)** (`docs/host-contract.md`, `src/data/projectsRegistry.ts`). Moving the web-remote static bundle under `/products/session-manager/...` puts static files inside a react-route subtree — `src/App.tsx` currently has `/products/*` owned by the SPA and `/projects/*` redirecting INTO it. We don't know whether the static plugin can be made to win for a subpath of a react route, and it's not our call.

2. **The relay path is baked into already-paired devices.** `RELAY_WS_PATH = '/projects/session-manager/relay'` is pinned in `server/sm-relay/router.ts` AND compiled into the phone bundle we publish (our `web-remote/app`, built into `public/projects/session-manager/assets/`). If that path moves, every currently-paired phone breaks until it reloads a new bundle, and the host CSP `connect-src 'self'` assumptions need re-checking. A safe sequencing probably means: serve the relay at BOTH paths for a deprecation window, ship a new app bundle pointing at the new one, then retire the old path.

3. **Two different things already share the `/projects/session-manager/` path.** The root `index.html` there is the web-remote phone app (manifest says built 2026-07-21, gitSha 69c1d7a). Separately, our repo's project-page publisher (`src/main/bilkoHostCore.cjs`) is designed to publish lens pages to `/projects/<slug>/home/`, `/feature/`, `/architecture/` under that same slug. Those two publishers can collide. Worth deciding, as part of this, which one owns that prefix — or whether the lenses should land under the new `/products/session-manager/` root instead.

## Also, unrelated but blocking us

`session-manager-operations/bilko-host/publish-state.json` in our repo records our last publish attempt (2026-09-11) failing on two host-side gates:

- `budget`: bundle 1053.2 KB gz exceeds the configured budget of 195 KB — but the *already-live* bundle's own manifest declares 1,072,016 bytes. The configured `app_budgets.max_size_gz_bytes` for slug `session-manager` (195000) is therefore below what is already shipping and can never pass. Either the budget is wrong for this slug or the live bundle should never have landed.
- `a11y`: `"playwright not installed — run: pnpm add playwright"` — host-repo tooling gap in ~/Projects/Bilko.

`manifest`, `golden`, and `audit` gates all passed. We can't fix either of these from our side.

## What we are NOT asking for

No copy changes, no pricing changes, and no change to the open-core split (the desktop app is free; only the Field Manual is paid — please keep any new page copy consistent with that). We're not asking you to touch our repo either; if a new app bundle needs to be built against a changed relay path, tell us and we'll publish it.

Reference: /home/bilko/Projects/session-manager/session-manager-operations/bilko-host/publish-state.json
Reference: /home/bilko/Projects/session-manager/docs/web-remote/ARCHITECTURE-V2-MOBILE.md
Reference: /home/bilko/Projects/session-manager/src/main/bilkoHostCore.cjs
Reference: /home/bilko/Projects/session-manager/web-remote/app/vite.config.ts

## Agent — 2026-09-13T04:10:57.533Z

Verified every claim against this repo — all five held. Shipped as `a843ef2`, pushed to `origin/main` (Render auto-deploys).

## What landed

**Consolidated URL root**

| URL | Served by |
|---|---|
| `/products/session-manager` | unchanged |
| `/products/session-manager/manual` | SPA, inside `<Layout />` (`src/App.tsx`) |
| `/products/session-manager/my-manual` | Fastify (`server/routes/manual.ts`) |
| `/products/session-manager/remote` | Fastify 301 → `/projects/session-manager/` |
| `/manual`, `/my-manual` | **server-side 301** to the above, permanently |

The old paths are real 301s, not a 200-then-client-redirect — `/manual` used to be SPA-only, so I added Fastify handlers ahead of the SPA fallback. Query strings carry over (`?email=`). Chapter anchors need no work: a fragment is never sent to the server and the browser re-applies it to the redirect target. In-app and Stripe receipt-email links (`server/routes/stripe.ts:406,408`) now point at the new paths; a test asserts no `href="/manual"` survives in shipped source.

**Relay — dual path, no flag day.** `RELAY_WS_PATHS` now accepts both `/projects/session-manager/relay` (legacy, compiled into paired phones) and `/products/session-manager/relay`. Your sequencing was right and is what I implemented step 1 of. Both are same-origin, so `connect-src 'self'` covers either — no CSP change needed.

**The bundle deliberately did not move.** `publish_static_project` only ever writes `public/projects/<slug>/`, and the bundle's URL is baked into deployed clients. So the product root exposes a 301 to the one canonical artifact rather than a second copy. Technically static-under-a-react-route *does* work here (@fastify/static runs before the SPA notFound handler, and a specific route outranks its `/*` wildcard) — it's just the wrong trade.

## Your two blockers, both fixed

- **a11y** — real host-repo bug, worse than a gap: the gate did `import('playwright')`, but this repo only has `@playwright/test`. The import always threw, so that gate failed **100% of the time for every app that reached it**. Now tries `playwright` → `@playwright/test` → `playwright-core`. I ran it against your live bundle: **pass, "0 serious, 2 minor"**.
- **budget** — confirmed dead-gate. Oversize-by-design slugs now seed via a raise-if-lower upsert instead of `INSERT OR IGNORE` (the stale 195000 row was unreachable by `INSERT OR IGNORE`), with `session-manager` at 1,300,000. Verified on a scratch DB: raises 195000 → 1300000, and will not downgrade a deliberately higher budget. It applies on the next Render boot via `initDb()`.

Side note on that number: your manifest's `bundle.sizeBytesGz` of 1,072,016 against a 1.4 MB uncompressed directory suggests the field is being filled with the *raw* size, not the gzipped one. Worth checking in your publisher — the budget I set assumes the declared number.

## The prefix-collision question (your #3)

`publish_static_project` does `rm -rf public/projects/<slug>` before copying. Two publishers on one slug silently delete each other — including when one writes only sub-directories the other's bundle lacks. **Decision, now written into `docs/host-contract.md`: a slug's static prefix has exactly one publisher, and for `session-manager` that is the web-remote phone app.** Project-home lenses from `bilkoHostCore.cjs` must not target that prefix — either fold them into the same bundle before publishing, or register them under a distinct slug. I documented the rule but did not add a mechanical guard; that would mean changing the MCP publish contract, which felt like more than this request covered.

## What's on you

Nothing is required — everything works today on the legacy relay path. When you want to complete the migration, build a bundle pointing at `/products/session-manager/relay` and publish it; once it's live I can retire the old path. Your next publish should also clear both gates.

Test suite: 428 pass (8 new in `tests/session-manager-urls.test.ts`), typecheck clean across the app, server, and mcp-host-server configs. One caveat, stated plainly: an early full run showed `1 failed` before I could capture which test — four subsequent full runs were green, so I believe it was a flake, but I can't name it.
