---
slug: "the-week-the-platform-got-dumber"
title: "The week the platform got dumber on purpose"
excerpt: "Last Saturday Burrow scored sentiment on every Reddit post that mentioned a ticker. This Friday it scores nothing. That is not a regression — it is the point. A per-project breakdown of the May 16–22 decoupling: Burrow, SST, the harness, a brand-new Bulgarian guest house repo, and the host that stayed boring."
category: "lessons"
published: true
published_at: "2026-05-23T04:04:09.966Z"
order: 13
---

Last Saturday Burrow scored sentiment on every Reddit post that mentioned a ticker. This Friday it doesn't score anything. That is not a regression. It is the point.

If you read [last week's post](/blog/all-green-three-bugs-the-regression-pass-caught), you already know the host repo barely moved — only the blog seed itself landed in `Bilko/` since May 16. That is not the same as a quiet week. The work moved sideways into the siblings, where it belongs: a Reddit pipeline got demoted from analyst to stenographer, a trading research engine inherited everything Reddit used to interpret, the harness we run all of this from grew most of an IDE in six days, and a brand-new sibling opened for a guest house in Bulgaria that does not want any of this energy applied to it.

Here is what actually happened, per project, with the specifics that would be invisible from the homepage.

## Burrow: gather, don't interpret

[Burrow](/projects/burrow) is the Reddit capture pipeline. Until last week it captured posts, dedup'd them, persisted raw bodies — and also classified sentiment, computed pulse coverage, tracked ticker mentions, and exposed all of that derived state through MCP. The problem with that bundle is that **interpretation is not data**. Sentiment for a trader is "is this bull or bear pressure on the stock?" Sentiment for a marketing tool is "is this user happy with the product?" Sentiment for a quant fund is "what is the conviction-weighted edge on this thesis?" Same post, three different answers, and Burrow was picking one of them.

Three PRDs landed this week, all in service of stripping that out.

- **PRD 09 (May 21) — `track_ticker` MCP write endpoint.** Consumers can now tell Burrow "make sure pulse is ready for AAPL by 2026-06-30," and a 5-min pipeline drains the queue, scores any already-captured posts that mention the ticker, and transitions queue rows through `awaiting_capture → in_progress → ready → expired`. 16 new tests, schema gated on a `BURROW_MCP_WRITE_TOKEN`. v1 deliberately ships without targeted Reddit search for tickers with zero existing posts — those wait for binge to surface them organically.
- **PRD 10 (May 21) — Defer sentiment to consumers.** `sentiment_score.enabled = False` in the orchestrator registry. The function is preserved as a callable library so a one-off historical re-score still works from the CLI, but no new rows are written. The PRD 07 ticker-mention bypass that we shipped two weeks ago is now a revert. We were wrong; the consumer should own this. 31 tests passing on the new shape.
- **PRD 11 (May 22) — Gather-only Burrow.** The full statement of the policy. Burrow's job is to capture Reddit at human pace, persist raw posts, and expose them through raw MCP endpoints. Ticker extraction, intent counts, mention aggregates, themes, author track records, short-pressure rollups — every one of those belongs in whichever consumer cares. PRD 11 is policy + consumer-migration plan; no Burrow code change yet. SST is the first consumer migrating. After every consumer is off, a follow-up will flip the derived pipelines to `enabled=False` and PRDs 03 and 05 get marked superseded.

The honest framing: PRD 07 (May 6) widened the sentiment catchment specifically to feed SST. Two weeks later we reversed it because feeding one consumer is not what a platform pipeline does. The lesson is older than the code — when the right place for a feature is in one specific consumer, putting it in the shared pipeline costs every future consumer and us.

## SST: six phases in six days, suite green at 1023/1027

[Social Signals Trader](/projects/social-signals-trader/) is the consumer that absorbed everything Burrow stopped doing. Forty-three commits since May 16, organized as phases. In order:

- **Phase I (May 17)** — snapshot-data validity test (30 tests pinning `window.X` shapes), thread `now` through `GateInputs` to kill date-drift in the rule engine. Boring, foundational, the kind of work that makes the rest of the week possible.
- **Phase J (May 17–18)** — four small bug-class kills. J1: stop flooding `TradeProvenanceModal` with `market_closed` rule_breaks (it was the noisiest line in the modal). J2: `SQUEEZE` sleeve recognizes Burrow's short-volume schema. J3: populate `data/options_flow.json` so the OPT_FLOW panel actually has a panel. J4: retire `THETA_PREMIUM` out of the executable sleeve set — it was generating signals but nobody trusted them.
- **Phase L (May 20)** — universe activation, five steps. `proactive_scan` activates probes and promotes signals into the thesis lifecycle. OPT_FLOW producer default top-50 → top-200 SP500. `PORTFOLIO_MAX_OPEN_TOTAL` default 20 → 30. Earnings cron daily with Yahoo fallback. Per-run coverage row. This is the phase that turned SST from "scans a watchlist" into "scans the universe."
- **Phase M (May 20)** — sleeve activation matrix on the Methodology page, `top_shorted` becomes a file-backed producer with file-first preload in `proactive_scan`, WSB sleeve probe populates `topSubreddit`. Three steps, all in service of "show me which sleeves saw which signal."
- **Phase N (May 20)** — SP500 ∪ NASDAQ-100 as the combined scan universe. `--extra-universe` flag on producers so NASDAQ-100 can be piped through cleanly. Two steps. Cheap.
- **Phase O (May 20)** — penny watchlist. `scan_penny_universe` runs in parallel with the main scan. The whole phase was "expand without slowing down the hot path." Two steps.
- **Phase R (May 21)** — sentiment classification consumer-side. The mirror of Burrow PRD 10. SST now has its own `sentiment_scorer` + `sentiment_cache` + `score_tickers` loop that reads raw posts from Burrow via `reddit_mcp.posts_for_ticker`. The classification logic that used to live in Burrow is now in SST, but tuned for trading semantics specifically — bull/bear/neutral with conviction weighting, not generic sentiment.
- **Phase S (May 21–22)** — SST owns extraction + caching + aggregates. The mirror of Burrow PRD 11. SST's ticker extractor + local cache verified (S1). `fetch-posts` drains `hot_posts` + `dd_posts` into a local `post_cache` (S2). Local `aggregates` computes `mentions_count`, `velocity`, `top_subreddit` per ticker (S3). `proactive_scan` reads those from the local cache instead of MCP-roundtripping Burrow on every tick (S4). Phase closed (S5) with the full suite green at **1023 pass / 1027** — the four failures are pre-existing and tracked separately.

The thing that is easy to miss: SST is now a more complete consumer of Burrow than Burrow was of itself. The bundle of "raw data + interpretation" lived inside Burrow as a leaky abstraction; pulled apart, SST owns about 60% of the lines that used to be in Burrow, and Burrow lost about 30% of its surface area. Neither service is smaller in code lines — but the boundary now matches the actual contract.

## session-manager: from v0.10.0 to v0.12.1 in six days

[session-manager](/projects/session-manager) is the Claude Code session harness we run everything else from — the TUI/Electron app with the tab bar, the agent inspector, the scheduler queue, the cockpit. It got an order of magnitude more attention this week than any of the products it manages.

The unifying move was a port from `ClaudeCodeUnleashed` (a community Electron harness with a more mature IDE-ish UI). The pace was real:

- **v0.10.0 (May 16)** — consolidation pass + Cmd-K / CSP / agent-view bug fixes.
- **v0.10.1 (May 17)** — Mac startup detection, real `/usage` everywhere, cockpit refactor.
- **v0.10.2 (May 18)** — Ctrl+V image paste, drop the AppStatusBar/TabBar "new" button, Alt+1..5 tab shortcuts.
- **v0.10.3 (May 21)** — Doc Editor lands (Tiptap, not Monaco — the editor for prose and markdown lives separately from the editor for code), agent-view cleanup, scheduler hardening.
- **v0.10.4 (May 21)** — left-nav section separators. Cosmetic but the nav was getting busy enough to need them.
- **v0.10.5 (May 22)** — Terminal clickable URLs + file paths, native context menu, smart Ctrl-C.
- **v0.11.0 (May 22)** — 12-feature port from Unleashed (Wave 1+2+3a+3f+4): GitActions, DeployMenu, NotificationCenter, plus nine others. This is the release that adopted the Unleashed Header + modals nav pattern across the harness.
- **v0.11.1 (May 22)** — FileTree sidebar (Cmd+B) + first-run TourOverlay.
- **v0.12.0 (May 22)** — Orchestrator (multi-pty parallel task dispatch), GlobalSearch, QuickOpen, RepoVisualization, Activity section on the overview page (7d/30d cuts, hourly/daily, top projects).
- **v0.12.1 (May 22)** — Hives: pre-baked agent swarm templates. The slot pattern from `scheduled-plans/prds/NN-*.md` generalized into reusable templates you can drop into a project.

Eleven releases in six days for a tool that we use every day to ship the rest of the tools. The risk is real — every release of session-manager is a release of the thing we use to release everything else, so a bad release of the harness costs more than a bad release of any single sibling. So far no rollbacks; one e2e suite fix landed mid-cycle (`doc-editor sub-tab selector excludes close buttons`). The bet is that the IDE-ish surface (FileTree + Orchestrator + GlobalSearch + QuickOpen) is going to compound for as long as we keep building sibling repos.

## torlashka-sreshta: a new sibling, deliberately slow

A new repo opened on May 21: `~/Projects/torlashka-sreshta/` — marketing site + booking API scaffold for a small guest house in Bulgaria. Three commits so far: initial scaffold, hamburger menu for mobile nav, and "proposal 0003 — tracking and API request logging." The interesting thing about this repo is the rule it shipped with on day one:

> **No DB tables, columns, indexes, or API endpoints get written as code until the corresponding spec is approved.** Propose changes as a markdown doc under `docs/proposals/NNNN-<slug>.md`. Include motivation, DDL (SQL), endpoint signatures, open questions. Wait for explicit approval in chat. Only then write migrations, route handlers, or types.

That is the exact opposite of how the games shipped (PRD-chained, parallel fan-out, agent-graded) and the exact opposite of how SST runs (six phases in six days). And it is deliberate. The Bulgarian guest house has one owner, one season, one set of guests; the SaaS pace would be ridiculous for it. The proposal-gate is the speed limit, and the speed limit is the feature.

This is the model for any future sibling that wants to be a service business and not a SaaS — torlashka-sreshta is the template. The host doesn't care; static-path siblings can ship at any pace they like, and the manifest contract treats a hand-built artisan site the same way it treats a 1023-test trading engine.

## The host stayed boring

The Bilko host repo itself moved exactly twice this week: the [previous blog post seed](/blog/all-green-three-bugs-the-regression-pass-caught), and an Etch v0.8.2 redesign refresh sitting uncommitted in the working tree as I write this. Every other diff in the repo is the cron pipeline doing its job — `social-signals-trader: publish dashboard snapshot 2026-05-22T*` every thirty minutes, `OutdoorHours` daily JSON refreshes. The dashboard snapshots alone account for ~180 commits in the week. That is not noise; it is the heartbeat of the platform working without me.

The point of the static-path contract is that the host doesn't have to change for the siblings to ship. This week was the cleanest evidence of that yet — five repos shipped real work, two architectural decouplings landed, a brand new sibling opened, and the host's own commit log was a flat line punctuated by the auto-deploy webhook firing on schedule.

## What we'd do differently

Two things.

**The Burrow decoupling could have happened in week three, not week ten.** The moment SST needed sentiment to be tuned for trading semantics (early April), the right move was to write the interpretation in SST and let Burrow stay raw. Instead we widened the Burrow pipeline (PRD 07), then reverted it (PRD 10), then wrote the policy doc (PRD 11). That is three rounds of work to land at the design we could have started with. The cost of that round-trip is real but bounded — the Burrow → SST migration is mechanical now because the test suites pinned the contract. If we'd never written PRD 07 we'd have had less evidence that the boundary was wrong. So: not a regret, but a tax we'd skip next time.

**The harness port was ambitious.** Eleven releases in six days, on the tool we use to ship every other tool. The thing that kept us out of trouble was that the underlying scheduler/queue/agent-view code didn't change — what changed was the chrome around them. We should still expect a hardening week for session-manager, because eleven releases compounded means eleven release-notes worth of small edges that haven't all been hit yet. Queueing a paranoid follow-up agent on the harness itself is now on the docket.

## Calling it a week

That is the post. Burrow gathers. SST interprets. The harness grew an IDE. A guest house in Bulgaria opened its own repo with a proposal-gate rule. The host did nothing except let the cron run.

If you want to poke at any of the surfaces:

- [Outdoor Hours](/projects/outdoor-hours/) — the daily heartbeat
- [Stack Audit](/projects/stack-audit/) — older but still grading SaaS bloat
- [Page Roast](/projects/page-roast/) — the savage CRO audit tool
- The [/projects](/projects) gallery — every sibling, current status

## FAQ

**Why pull sentiment out of Burrow if SST is the only consumer right now?**
Because the moment we wrote the second consumer, the cost of pulling it out would be 2× higher, not 1×. The right time to decouple is when there is exactly one consumer using a leaky abstraction — because the test surface is small enough to migrate cleanly, and the cost of being wrong is one rewrite. Decoupling at three consumers means three rewrites and a coordination problem.

**Is the harness port (session-manager v0.10 → v0.12) risky for the day-to-day Claude Code workflow?**
Yes, structurally. Eleven releases of the thing we run every other tool from is more change than we'd ship in any single product repo. The mitigation is that session-manager's release contract is the same as every sibling's: `pnpm test:unit && pnpm test:e2e` are preconditions, and a regression-validation agent runs behind every non-trivial structural change. We've taken one e2e fix mid-cycle so far; if a v0.12.x dot-release shows up next week, it'll be because something compounded that the agent didn't catch.

**Why does torlashka-sreshta have a manual review gate when every other sibling is agent-fan-out?**
Because the speed limit is the feature. A guest house booking site has one owner, a finite number of rooms, and one season's worth of guests. The cost of a wrong schema migration on production is one phone call from a confused booking. The proposal-gate matches the actual blast radius of the system. The same gate on SST would slow it to 5% of its current pace; the same fan-out on the guest house would land us with a payments table nobody asked for.

**What is the actual contract Burrow exposes now?**
Read MCP endpoints: `reddit_mcp.posts_for_ticker`, `reddit_mcp.recent_posts`, raw post bodies + metadata. Write MCP endpoint: `track_ticker` (gated on `BURROW_MCP_WRITE_TOKEN`) for calendar-driven backfill — "make sure pulse is ready for X by deadline Y." Everything else — extraction, interpretation, aggregation, sentiment — moved to the consumer. After every consumer migrates, the derived-pipeline rows in the orchestrator registry flip to `enabled=False` and the deprecated PRDs (03, 05) get final superseded banners.

**Is the host repo going to stay boring?**
For as long as the static-path contract holds, yes. The host's job is to provide brand chrome (Layout, HomePage, ProjectsPage, BlogPage, PricingPage, AdminPage), shared auth (Clerk), shared credits (Stripe), shared analytics, and the manifest/static-serve plumbing. None of those things should need to change just because a sibling shipped a new feature. The week the host stops being boring is the week a sibling needs something the contract doesn't cover — and that has not happened since the decomposition in early April.