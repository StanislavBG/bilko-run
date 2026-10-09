---
slug: "mcp-host-istore-for-mcps"
title: "MCP-Host: building the iStore for MCP servers"
excerpt: "Once two of my projects turned into hosted paid MCP services, they needed somewhere to live that solved auth, billing, and tenancy once instead of per repo. MCP-Host is that — a single gateway mounting every provider at /mcp/<provider>, sharing OAuth 2.1, one x402 wallet, and per-provider Postgres RLS. From \"initial platform\" to self-serve publish in six days."
category: "build-log"
published: true
published_at: "2026-06-03T17:30:00.000Z"
order: 17
---

This week two of my projects — [signal-builder](https://github.com/StanislavBG/signal-builder) and edgar-rag — stopped being internal libraries and became hosted, paid MCP services. The moment that happened, they both needed the same boring things: authentication, billing, per-tenant data isolation, metering, a public registry entry. Building that once per repo is how you end up maintaining three half-baked auth layers. So I built it once. MCP-Host is the result — a single control plane, runtime, and storefront for a whole fleet of MCP servers.

## One gateway, every provider

MCP-Host is one Replit-hosted FastAPI app that mounts every provider at `/mcp/<provider>`. A request flows through a single pipeline — auth → entitlement → billing → dispatch → metering — before it ever reaches provider code. That means a provider author writes tools, not infrastructure: the gateway handles the OAuth handshake, checks the caller's entitlement, debits the wallet, routes to the tool, and records usage. Add a provider, and it inherits the entire pipeline for free.

The three pilots wired in this week are real, not toy: edgar-rag (SEC filings), signal-builder (trading signals), and the social-trader — three providers from completely disconnected disciplines, sharing one gateway.

## The Provider Protocol

What keeps this from becoming a pile of special cases is a contract. A provider conforms to the Provider Protocol: a `provider.json` manifest plus an SDK `Provider` base class with `@tool` decorators, a `ToolContext`, typed `ErrorCode`s, content helpers, and a manifest validator. There's a CLI — `mcp-host scaffold / validate / tdqs / syndicate` — that generates a new provider skeleton, validates the manifest, runs it through a quality gate (TDQS), and plans registry syndication. The protocol is the thing that lets "onboard a new MCP" be a documented checklist instead of a negotiation.

## Auth, billing, and tenancy — solved once

The shared services are the whole value proposition:

- **Auth** — OAuth 2.1-style token + API-key validation, plus an entitlement engine that decides who can call what.
- **Billing** — one shared x402 wallet, a per-tool price map, fail-closed by default, with an admin bypass for testing. Every provider bills through the same wallet.
- **Data** — a per-provider Postgres layer with Row-Level Security schemas, so two providers (or two tenants of one provider) can never read each other's rows. In dev it's a `SqliteStore` with a `TenantDB`; in prod a `PgStore` with RLS; a factory picks the backend off `DATABASE_URL`.
- **Artifacts** — an HMAC chunked-upload store with a read-only view, for providers that serve files.

Phase 2 this week added per-MCP owner-admin isolation and a publisher MCP with owner-gated upload — so a provider's owner administers their own MCP without touching anyone else's. 81 tests across all of it.

## Six days: v0.2 to self-serve v0.4

The pace tells the story. It went from "initial platform" on May 29 to self-serve in six days:

- **v0.2.0** (Jun 2) — first real provider (platform-health), DB-degraded resilience, version + live git short-SHA in `/health`.
- **v0.2.1–v0.2.2** (Jun 2) — a storefront with a status dot, a version/build/backend/provider-count header, and live `/health` results embedded on the homepage.
- **v0.3.0** (Jun 3) — live owner ingest for the social-trader.
- **v0.4.0** (Jun 3) — the big one: self-serve register, publish, and a declarative proxy, so a provider can be added without hand-editing the host.

Along the way it grew a production Postgres backend (PgStore + per-provider RLS, auto-selected by `DATABASE_URL`) and Replit first-boot hardening — a Reserved-VM target, a preflight config guard, and a `PgStore` that retries connect with backoff so a cold database can't abort boot. The unglamorous deploy-reality work is exactly what makes a control plane trustworthy.

## What I'd do differently

I'd have written the Provider Protocol before the first provider, not alongside the second. MCP-Host only exists because I noticed signal-builder and edgar-rag needed the same scaffolding — but I noticed it *after* both had started growing their own. A little of that work was thrown away. The general lesson: the second time you build the same plumbing, stop and extract it; the third time, you've already lost. Two providers in one week was my signal, and I took it instead of building a third bespoke auth layer.

## See it / build on it

- [MCP-Host on GitHub](https://github.com/StanislavBG/MCP-Host) — gateway, SDK, CLI, three pilot providers
- [signal-builder](https://github.com/StanislavBG/signal-builder) — a pilot provider, trading signals
- [How the providers came to exist](/blog/signal-builder-m0-to-m9) — the refactor that turned libraries into services

## FAQ

**Isn't a whole MCP storefront over-engineering for three providers?**
It would be if three were the target. They're pilots. The shared parts — OAuth, an x402 wallet, per-tenant Postgres isolation, metering, registry syndication — are identical for provider four and provider forty, and they're exactly the parts nobody wants to rebuild per repo. MCP-Host is a bet that I'll keep peeling standalone MCP services off bigger projects, and that they should share one billing-and-auth plane.

**Why x402 for billing?**
Because the customers are AI agents, and x402 is built for machine-to-machine, pay-per-call settlement without a human entering a card. One shared wallet across all providers means an agent funds once and can call any MCP on the host. Fail-closed by default means an unpaid call doesn't reach provider code.

**What does "per-provider RLS" buy me over just separate databases?**
Isolation without operational sprawl. Row-Level Security schemas mean one Postgres instance enforces that provider A — and tenant A1 — can never read provider B's rows, at the database layer, not in application code. Separate databases would give the same isolation and ten times the ops burden. RLS is how one control plane stays one control plane.