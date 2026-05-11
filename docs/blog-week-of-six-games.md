---
draft: true
title: Six games in seven days — the week our platform became a platform
slug: week-of-six-games
category: build-log
authoredOn: 2026-05-10
---

# Six games in seven days — the week our platform became a platform

Eight days ago, bilko.run was a monolith with nine AI marketing tools bolted onto one Vite bundle. Today it hosts twelve apps — six of them games — and the AI tools all live in their own repos. We shipped 118 commits across eight repositories, added 195,546 lines, deleted 12,097, and the most important change wasn't any of those. It was a contract.

This is the story of what we built, in what order, and why the order mattered.

## The starting point: a host that thought it was a product

A week ago Sunday, the Bilko codebase had nine AI tools — PageRoast, HeadlineGrader, AdScorer, ThreadGrader, EmailForge, AudienceDecoder, LaunchGrader, StackAudit, Stepproof — all living as React routes inside the host bundle. Each one had a page, a server route in `server/routes/tools/`, and a shared scoring scaffold. They booted together, tested together, deployed together.

That worked when there were three tools. At nine, the bundle was 580 KB gz, the test suite took four minutes, and any change to one tool's UI had to wait for every other tool's CI to pass. Worse: every new app I sketched out — a Sudoku, a Minesweeper, a free AI fundamentals course — had to argue for its place in the same bundle as a SaaS conversion-audit tool. Different audiences. Different cadences. Different everything.

The host had become a product. That's a category error.

## The contract that fixed it: static-path siblings

We'd written `docs/host-contract.md` two weeks earlier. The idea: instead of every app being a React route inside Bilko, each app lives in its own sibling repo, builds its own `dist/`, and drops it into `public/projects/<slug>/`. Bilko's Fastify static handler serves the bundle. The portfolio reads from a registry. URL shape: `bilko.run/projects/<slug>/`.

The contract is short. A sibling app must:
1. Emit a `dist/manifest.json` with `slug`, `bundle.sizeBytesGz`, and a list of static assets.
2. Pass a Playwright smoke test against its own preview server.
3. Stay under a 300 KB gz bundle budget (or document a bump in `KNOWN-ISSUES.md`).
4. Register itself in `src/data/standalone-projects.json`.

That's it. No shared dependency on the host. No coordinated deploys. Each sibling builds in its own Claude Code session, each with its own terminal cursor. The host doesn't know what's inside the bundle and doesn't need to.

This week, that contract earned every word of itself.

## Day 1–2: the great extraction

Before any new app could ship, the nine AI tools had to leave the bundle. We pulled them out one at a time, in roughly half-day cycles each:

- Stepproof → `~/Projects/Stepproof/`
- StackAudit → `~/Projects/Stack-Audit/`
- AdScorer → `~/Projects/Ad-Scorer/`
- LaunchGrader → `~/Projects/Launch-Grader/`
- ThreadGrader → `~/Projects/Thread-Grader/`
- HeadlineGrader → `~/Projects/Headline-Grader/`
- EmailForge → `~/Projects/Email-Forge/`
- AudienceDecoder → `~/Projects/Audience-Decoder/`
- PageRoast → `~/Projects/Page-Roast/`

The migration pattern was the same every time: scaffold a Vite + React + Tailwind v4 sibling, copy the page component, swap the API client to call the same-origin Bilko endpoint via a Clerk JWT, point the build at `~/Projects/Bilko/public/projects/<slug>/`, register, push. Each extraction was a self-contained PR. Nine tools, nine PRs, zero coordinated deploys.

The host bundle dropped from 580 KB gz to 287 KB gz — a 50% cut, mostly by deleting nine route components and their per-tool component kits. The test suite dropped from four minutes to ninety seconds, because each tool's tests now lived in its own repo.

## Day 3: extracting the substrate as `host-kit`

The extractions exposed something. Each sibling needed the same nine things: a `<ToolHero>`, a `<ScoreCard>`, a `<SectionBreakdown>`, a `<CompareLayout>`, a `<Rewrites>`, a `<CrossPromo>`, telemetry, an event bus, and a manifest emitter. Copy-pasting that into ten repos would mean fixing one CSS bug ten times.

So we extracted `@bilkobibitkov/host-kit` as a published npm package. The first published version was 0.3.0 (telemetry only). Three days and eight versions later it was 0.7.2, with `<GameShell>`, `useGameTimer`, `useVisibilityPause`, `useSaveState`, `useLeaderboard`, `useUnlocks`, a typed event bus, the manifest CLI, and a CSS token bundle.

Versioning rule: every published version had a Changeset entry, a CHANGELOG line, and was installed by the next sibling that needed the new feature. No yanking, no force-publishing, no in-place edits to a live release. Boring discipline; pays off the third time you reach for `npm install`.

## Day 4: the first game ships, and the platform proves itself

**Sudoku** went live on day four at `bilko.run/projects/sudoku/`. Bootstrapped in one PRD, fully implemented in three, drops in a fourth. The first game built using `host-kit`'s `<GameShell>`. Total bundle: 110 KB gz. Total time from `pnpm create vite` to live URL: about six hours of Claude Code session time across two sessions.

Same day: **MindSwiffer**. A clean-room Minesweeper with a no-guess solver constraint — the board generator only ships layouts where pure deduction wins. 65 Playwright tests, five themes (all WCAG AA), reduced-motion support, cascade animations. 89 KB gz. Six hours from bootstrap to publish.

The same day, we wired a **cross-game achievement system**. Finishing a Sudoku puzzle unlocks a "Puzzler" badge in MindSwiffer, and vice versa, via a shared `useUnlocks` hook in `host-kit`. The bus is a typed `BroadcastChannel` wrapper. Two games, talking to each other, hosted in two separate sibling bundles, on the same origin. The contract worked.

## Day 5–6: three retro games in parallel

This is the part that surprised me. Friday afternoon, I asked three Claude Code sessions to research mid-90s mini-games, write extensive PRD chains, and then a fan-out of Sonnet executors built each game end-to-end overnight. They worked in parallel, in three different sibling repos:

- **FizzPop** — bubble shooter, hex-grid snap, BFS cluster pop, daily playfields validated by a deterministic solver. 65 tests. 62 KB gz.
- **Etch** — clean-room Picross/nonogram, 30 hand-curated daily puzzles each verified as uniquely-deductively solvable by a Batenburg–Kosters line solver. 60 tests. 61.65 KB gz.
- **Cellar** — clean-room FreeCell, Microsoft deal-by-number LCG (deal #1 produces JD on top of cascade 1, deal #11982 is correctly identified as unwinnable by the solver). 70 tests. 62 KB gz.

By Saturday morning, all three were committed, tested, and pushed. None of the three games knew the other two existed. The host didn't need to learn any new tricks. We added their cards to `bilko.run/games`, and the only host-side change was three lines in `standalone-projects.json` per app.

## Day 7: the rename, and what it told us

Today, looking at the npm registry, I noticed the awkwardness: `@bilkobibitkov/host-kit`. Five of our eight published packages carried that scope. The bare names were all available — `host-kit`, `page-roast`, `webgpu-gemma`, `ai-tool-kit`, `preflight-license` — but we'd reflexively scoped them, treating the npm scope as a brand container. It wasn't doing any work.

So we renamed `host-kit`. One source-repo edit, one publish, six consumer repos updated and pushed. `npx page-roast <url>` is shorter and clearer than `npx @bilkobibitkov/page-roast <url>`, and shorter is what `npx` is for. Four more renames are queued for the same treatment.

The lesson under the lesson: defaults compound. We scoped reflexively because the first package needed it (we already owned the bare name we wanted on a different package). That reflex shipped through every package after. Six months later, one moment of "wait, why is this scoped" cost us forty-five minutes of git work. Catch the default before it ossifies.

## What we'd do differently

Three things.

**One.** Extract the sibling-bootstrap script earlier. We re-created the same `vite.config.ts`, `tailwind.config.ts`, `tsup` setup, `manifest.json` emitter, and Playwright harness for nine apps before realizing we had a template. We finally built the `bilko-host` MCP server on day six. It would have saved two days if it existed on day one.

**Two.** Wire Render's deploy webhook before pushing to the master branch the first time. Render auto-deploys from `Content-Grade/master`, not `main`, and the webhook had been quietly broken for three days. We discovered it the way you usually discover broken webhooks: by waiting for a deploy that never came. A `RENDER_DEPLOY_HOOK` env var, curl-able from a PRD, would have unblocked the autonomous overnight build chain.

**Three.** Trust the contract sooner. The first three extractions all had moments of "should this thing live in the host?" The fourth one was friction-free. By the seventh, the question stopped occurring. The host stopped being a product and became a platform somewhere around extraction #5, but I didn't notice until the first game shipped.

## What's next

The Academy lesson backlog. Module 1 (`what-is-an-ai`) has six lessons currently shipped as stubs — full frontmatter, valid outline, but no body prose and no interactive components. We've queued seven sequential PRDs for the scheduler to backfill them, each one bringing a lesson up to the quality of the gold-standard L1 (`what-this-course-is.mdx`). When that lands, every Academy lesson will have ≥1 of `<Quiz>`, `<Reflect>`, `<AskClaude>`, `<TokenizerDemo>`, or `<DragMatch>`.

After that, the rename queue: four more `@bilkobibitkov/*` packages, one deprecation pass to redirect installs.

If you want to play the games this week's work shipped:
- [Sudoku](/projects/sudoku/) — clean, calm, free
- [MindSwiffer](/projects/mindswiffer/) — Minesweeper, no 50/50s
- [FizzPop](/projects/fizzpop/) — daily bubble shooter, every puzzle solver-validated
- [Etch](/projects/etch/) — clean-room Picross, solvable by thinking
- [Cellar](/projects/cellar/) — FreeCell, every deal solver-verified
- [Boat Shooter](/projects/game-academy/) — first entry, browser arcade

And if you're curious about the substrate they're built on: [`host-kit`](https://www.npmjs.com/package/host-kit) is on npm, MIT-licensed, with a [`bilko-host` MCP](https://github.com/StanislavBG/bilko-run/tree/main/mcp-host-server) for sibling-repo authoring. The host contract is at [`docs/host-contract.md`](https://github.com/StanislavBG/bilko-run/blob/main/docs/host-contract.md).

## FAQ

**Why six games and not, say, three games done very well?**
Because the contract needed the stress test. One game proves the host can serve a static-path bundle. Three games proves the contract scales. Six games — three of them built in parallel by overnight automation — proves the platform is doing the heavy lifting and the apps are just apps. We learned more about `host-kit`'s API in 48 hours of three-game parallel build than in the four days of careful single-app extractions before it.

**How much of this was Claude Code doing the work?**
A lot, structured tightly. Each app had a PRD chain (research → bootstrap → engine → UI → themes/a11y → publish). The PRDs are self-contained; a `claude -p` invocation runs each one without conversation context. Three Sonnet executors built FizzPop, Etch, and Cellar in parallel overnight; I reviewed and shipped in the morning. The win isn't "the AI did it" — the win is the contract that let three independent agents work without stepping on each other.

**Are the games actually finished?**
The engines are. Each has solver verification, deterministic seeds, and a test suite. The polish is the next pass — sound design, theme variants, daily-streak persistence across the wallet. None of that is required for the contract; all of it is on the backlog.
