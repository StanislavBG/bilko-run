---
slug: "from-saas-to-host-decomposing-bilko-in-one-week"
title: "From SaaS to host: decomposing Bilko in one week"
excerpt: "Last week we shipped 1,500+ lines of architecture, deleted 3,156 lines of page code, and added zero features. Here's how Bilko stopped pretending to be one product and started being a host for ten of them."
category: "build-log"
published: true
published_at: "2026-05-05T07:32:42.118Z"
order: 10
---

## The week we shipped no features

Last week's git log is four commits and 1,500+ net new lines of code. None of them added a feature. None of them moved a tool's score, fixed a roast line, or reworded a CTA. Every commit was structural — splitting things apart, writing the rules for how the pieces should sit, building the API that lets the pieces move themselves.

That sounds like the worst kind of week to write up. It's actually the most important one Bilko has had since launch.

## Context: ten products in a single bundle

Bilko started with one tool. PageRoast. Then HeadlineGrader. Then eight more. By April there were ten AI tools sharing one Vite bundle, one Fastify server, one deploy. A bug in Stepproof's YAML parser could break PageRoast's build. A redesign of the kit ripped through every tool's page in one commit. Adding the eleventh tool meant rebasing the rest.

The honest read: Bilko was never one product. It's ten products that happen to share a brand, a credit wallet, and a Clerk login. The codebase had been pretending otherwise for a year, and the cost was getting expensive — every shipped change had to think about every other tool.

The week's work was to stop pretending.

## Step 1: Split the server (commit `63821a7`)

`server/routes/demos.ts` was 2,160 lines and 24 routes. Every AI tool's POST handler, plus the rate limiter, plus the IP-hashing helper, plus the Gemini wrapper, plus a usage tracker — all wedged into one file. We split it into ten per-tool files under `server/routes/tools/` and one `_shared.ts` for the cross-cutting bits.

The rule we now follow: shared utilities live in `_shared.ts`. Tool-specific handlers live in `tools/<slug>.ts`. The barrel at `tools/index.ts` imports each one and registers it.

This isn't over-engineering. It's the prerequisite for moving any tool out of this repo without touching the others. Without the split, every extraction is a merge conflict against the previous one. With the split, an extraction is `rm tools/<slug>.ts` and one line out of the barrel.

The same commit deleted `src/views/*` — eight legacy dashboard files from the pre-tool-page era — and killed the `/app/*` URL space. Replaced with redirects so old shared links still resolve.

## Step 2: Two pilot extractions

The same commit moved two tools out of the bundle entirely. **OutdoorHours** — a 2,183-line page that had become its own product — went to `~/Projects/Outdoor-Hours`. **LocalScore**, the WebGPU-powered private document analyzer, went to `~/Projects/Local-Score`. Both now live in their own repos with their own Vite builds, their own slim copies of the kit, and ship as static bundles dropped into `public/projects/<slug>/` on the host.

The numbers that mattered: LocalScore alone bundled `@mlc-ai/web-llm` at ~2 MB gzipped. That dependency is now zero bytes in the host bundle. OutdoorHours's 2,183 lines of page code dropped to zero. The host's `vite build` got measurably faster, and the `/products` route hydration stopped paying for code that 90% of visitors never load.

The user-visible URLs didn't change. `/projects/outdoor-hours/` is still `/projects/outdoor-hours/` — Fastify just serves a different bundle there now.

## Step 3: Write the contract (commit `faa3b88`)

Two extractions worked. The third extraction would work too. The ninth wouldn't, because by then the recipe would have drifted three times and nobody would remember which version was right.

So we wrote it down. `docs/host-contract.md` codifies the three host kinds:

- `react-route` — `/products/<slug>`. App lives in this repo, shares Clerk + token wallet in-bundle. Legacy default.
- `static-path` — `/projects/<slug>/`. App lives in its own repo, drops `dist/` into `public/projects/<slug>/`. **New default.**
- `external-url` — App lives somewhere else.

Plus the URL canonicalization rules, the registry entry shape, the things the host provides each kind, and the things each kind must provide back.

Why a contract beats a convention: the next sibling repo isn't built by me. It's built by a Claude session in that repo's directory, which has never seen the host code. If the rules live only in our heads, the contract drifts. If the rules live in a markdown file the session reads first, the contract holds.

## Step 4: Ship the MCP (same commit)

`mcp-host-server/` is a stdio MCP server. Six tools:

- `get_host_contract` — returns the contract markdown
- `list_projects` — returns the registry
- `register_static_project` — adds a registry entry, commits + pushes
- `unregister_project` — removes an entry, optionally deletes assets
- `publish_static_project` — copies the sibling's `dist/` into `public/projects/<slug>/`, commits + pushes
- `status` — git state + last 5 commits

Sibling-repo Claude sessions wire it via `.mcp.json`:

```json
{ "mcpServers": { "bilko-host": {
    "command": "node",
    "args": ["/home/bilko/Projects/Bilko/mcp-host-server/dist/server.js"]
}}}
```

The sibling never opens the host repo. It calls `bilko-host__register_static_project` once, `bilko-host__publish_static_project` after every build. The MCP commits to the host repo's `origin` remote, and Render auto-deploys within a minute.

This is the part that turns a process into a system. Two extractions by hand was bearable. Nine extractions by hand would be a slog. Nine extractions where each one is "register, build, publish, done" is a Saturday afternoon.

## Step 5: Write the playbooks (commit `e8d965e`)

The MCP automates the registration. It doesn't automate the *extraction* — figuring out what each tool imports from the host kit, what tests need to migrate, what server routes stay vs. get deleted, what tailwind tokens the page actually uses. So the last commit was nine per-tool playbooks in `docs/extractions/`, ordered by coupling and risk:

1. **Stepproof** (~30 min) — easiest, no auth, no kit
2. **StackAudit** (~60 min) — first Clerk-bundled standalone
3. **LaunchGrader** (~30–45 min) — same shape, SSRF stays server-side
4. **AdScorer** (~90 min) — first "big" one, full kit inline
5. **HeadlineGrader** (~45 min) — kit copy-paste tax bites; publish `@bilko/host-kit` here
6. **ThreadGrader** (~30 min)
7. **EmailForge** (~30 min)
8. **AudienceDecoder** (~45 min) — one-time-purchase tier
9. **PageRoast** (~2 hours) — brand flagship, last

Each playbook is the same template — inventory, frontend coupling, backend coupling, test coverage, standalone repo setup, copy-pasteable shell sequence, risks. The template *is* the design. If a tool doesn't fit, that's a signal.

## The Gemini alias fix (commit `dcb74ca`)

Earlier in the week, the warm-up: switched the Gemini model from the pinned `gemini-2.0-flash` to the auto-rolling `gemini-flash-latest` alias. Pinned versions had been getting silently throttled — same model id, longer latencies, no notice. The lesson is small but real: when a vendor ships an auto-rolling alias, use it. Pinning is a foot-gun masquerading as a stability strategy, because "stable" without a deprecation contract just means "frozen in a way the vendor can revoke."

## What I'd do differently

**Ship the MCP first.** We did the two pilot extractions by hand, then wrote the contract, then built the MCP. The second pilot was 3× faster than the first because the recipe was crystallizing. The MCP would have made the first pilot fast too. If you're decomposing a monolith into N siblings, build the publish-pipeline before the first extraction, not after the second.

**The kit will hurt before it gets fixed.** Each extracted sibling carries its own slim copy of the kit (ToolHero, CrossPromo, the colors). After two siblings that's fine. After five siblings it's a copy-paste tax — every brand tweak is a five-repo change. The plan says publish `@bilko/host-kit` as a private npm package after the fifth extraction; in retrospect that should have been after the third.

## What's next

This week, Stepproof becomes the first of the nine. Smallest page, no auth, no credits — the lowest-risk way to prove the recipe end-to-end with the new MCP in the loop. Following posts will walk through individual extractions in real time.

If you're interested in how the host platform sits together — three kinds of apps, one home button — both [OutdoorHours](/projects/outdoor-hours) and [LocalScore](/projects/local-score) are reference implementations of the static-path lane. The full project list is at [/projects](/projects). Or if you want a louder demo of what the host's react-route lane still feels like, [PageRoast](/products/page-roast) is the brand flagship — last on the extraction list, exactly because it's the loudest.

## FAQ

**Why not just use a monorepo?**
We will, eventually, in the form of a private npm package for the kit. But monorepos couple deploys: a change in one package can block a release of another. The static-path contract keeps each app's deploy fully independent — the host doesn't redeploy when an app does, and vice versa. That mattered more than the dev-time ergonomics of a single workspace.

**Doesn't every extraction add HTTP latency to API calls?**
Only if the app calls the host API. Free apps like OutdoorHours and LocalScore don't — they're entirely client-side. Apps that do (the upcoming nine) call `bilko.run/api/...` from `bilko.run/projects/<slug>/`, which is same-origin: zero CORS, zero extra DNS, Clerk's session cookie travels for free. The latency cost is one HTTP round-trip we were already paying inside the bundle as a function call. Real but small; Gemini's 2–8 second response time dwarfs it.

**What if I want to host my own app on bilko.run?**
That's the long bet. The MCP is the API. Read `docs/host-contract.md`, build a Vite app with `base: '/projects/<slug>/'`, publish via `bilko-host__publish_static_project`. Right now the MCP is wired into my own siblings; opening it up to others is a plan-mode question for next quarter.