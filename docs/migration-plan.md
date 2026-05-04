# Migration plan: Bilko → framework-only

**Goal:** Bilko (this repo) becomes pure host platform — registry, auth, credits, kit, brand chrome, blog, admin. Every product lives in its own sibling repo and ships via the static-path contract.

**Status today (2026-05):**

| Lives in | Apps |
|---|---|
| **Sibling repos (static-path)** ✅ done | OutdoorHours, LocalScore, Boat Shooter |
| **In-repo (react-route)** — to extract | PageRoast, HeadlineGrader, AdScorer, ThreadGrader, EmailForge, AudienceDecoder, LaunchGrader, StackAudit, Stepproof |

That's 9 left. Each extraction follows the same template proven on OutdoorHours + LocalScore.

## Why extract everything

- **Independent ship.** A bug in one tool can't block deploys for the rest. A tool can ship 5x a day without bumping the host.
- **Small host bundle.** The host loads in milliseconds because it has no product code — just chrome + the registry.
- **Per-tool sessions.** Each tool gets its own focused Claude session, its own git history, its own roadmap.
- **Optional public-source.** Sibling repos can be open-source individually without exposing the host's auth/Stripe glue.
- **Swappable hosts.** A sibling repo could be hosted off bilko.run later (custom subdomain, different platform) with no host changes.

## Why **not** extract everything

- React-route apps share the host's Clerk auth and Stripe credit wallet over function calls (zero RTT). After extraction those become HTTP round-trips. Latency cost is real for chatty UIs.
- The shared component kit (`src/components/tool-page/*`) gets copied into each sibling. Updates require N copies. Mitigation: publish the kit as a tiny private npm package once 4-5 siblings exist.

The latency cost is small for the existing tools (a Gemini call dominates). The kit-fork cost is manageable. **Net: keep going.**

## Extraction template (per app)

This is the proven recipe from OutdoorHours + LocalScore:

1. **Inventory coupling.** `grep -E "from ['\"]\.\.[/]" src/pages/<App>Page.tsx` — what does the page import from the host?
2. **Build the standalone repo:** `~/Projects/<App>/` with Vite + React + Tailwind v4. `package.json sync` script copies `dist/` into `~/Projects/Bilko/public/projects/<slug>/`.
3. **Inline the host kit it uses.** Slim local versions of `ToolHero`, `CrossPromo`, `track()` (analytics POSTs to `bilko.run/api/analytics/event`, same-origin, no CORS).
4. **Replicate the colors/animations** it needs from `src/index.css` `@theme` tokens. Most apps need just the warm/fire base + their accent (purple/green/etc).
5. **Build, sync, register via the MCP** (`bilko-host__register_static_project` then `bilko-host__publish_static_project`).
6. **Remove from host:** delete `src/pages/<App>Page.tsx` and `src/config/tools.ts` entry, delete `server/routes/tools/<app>.ts` and remove from `server/routes/tools/index.ts`. Add a redirect from `/products/<slug>` if needed (the existing `MaybeStandaloneRedirect` in App.tsx handles this automatically once the slug appears in `standalone-projects.json`).
7. **Verify:** `pnpm test && pnpm exec tsc --noEmit && pnpm exec vite build` in the host. Sample `curl /projects/<slug>/` returns 200. Bundle size for that page chunk drops to zero.

A clean extraction takes ~30-60 min per app. The two pilots cost ~1h each (including building the recipe).

## The hard ones

These need decisions before extraction, not just elbow grease.

### Auth + credits coupling

**PageRoast, HeadlineGrader, AdScorer, ThreadGrader, EmailForge, AudienceDecoder, LaunchGrader, StackAudit, Stepproof** all call paid endpoints that require Clerk auth + a token deduction. After extraction they hit the host over HTTPS instead of in-bundle.

Options:
- (a) **Same-origin XHR.** Sibling at `bilko.run/projects/<slug>/` calls `/api/demos/<slug>/...` on `bilko.run/api/...`. Same origin, Clerk's session cookie travels, no CORS. ✓ Easiest.
- (b) **Move the API call into the host's `useToolApi` hook**, expose it as a global on `window` so siblings can call without bundling Clerk. (Worse than a.)
- (c) **Sibling carries its own Clerk SDK.** ~67 KB gzipped per sibling. Wasteful.

Recommendation: **(a)** for all extractions. Sibling never needs Clerk SDK; it just calls the API and the cookie does the work. Server-side the route handlers don't change.

### LegacyDashboard / `/app/*` is gone

Already done. No migration debt there.

### The Tailwind kit

After 4-5 siblings, the `index.css` `@theme` block becomes copy-paste tax. Time to publish it as `@bilko/host-kit` (private npm or git submodule) with the warm/fire palette + slim component primitives.

Defer until ~app #5 forces the issue.

## Suggested order (lowest coupling → highest)

| # | App | Why this order | Notes |
|--:|---|---|---|
| 1 | **Stepproof** | Smallest page (StepproofPage.tsx), free-tier featured. Server side already its own file (`server/routes/stepproof.ts`, not in `tools/`). Mostly self-contained. | Easy win; proves the auth-via-cookie pattern. |
| 2 | **StackAudit** | Smaller form-based UI, fewer cross-promo back-references. | Proves the paid-tier credit deduction path through the cookie. |
| 3 | **LaunchGrader** | Same shape as StackAudit. | After this, you've shipped 3 paid extractions; the recipe is rote. |
| 4 | **AdScorer** | Largest of the content tools (1,103 lines + 305-line server). | First "big" extraction; budget 90 min. |
| 5 | **HeadlineGrader** | Same shape as AdScorer. | At this point: extract the kit to a package. |
| 6 | **ThreadGrader** | — | — |
| 7 | **EmailForge** | — | — |
| 8 | **AudienceDecoder** | — | — |
| 9 | **PageRoast** | Most complex page (1,496 lines), most cross-promo back-references, brand flagship. | Extract last so you have the most polished playbook. |

## What stays in the host forever

- `src/config/tools.ts` — referenced as historical archive once empty? Probably delete eventually.
- `src/data/standalone-projects.json` — the registry, source of truth.
- `src/data/projectsRegistry.ts`, `src/data/portfolio.ts` — registry types + portfolio derivation.
- `src/components/Layout.tsx`, `src/pages/HomePage.tsx`, `src/pages/ProjectsPage.tsx`, `src/pages/BlogPage.tsx`, `src/pages/PricingPage.tsx`, `src/pages/AdminPage.tsx`, `src/pages/ContactPage.tsx`, `src/pages/StudioPage.tsx`, `src/pages/AcademyPage.tsx`, `src/pages/WorkflowsPage.tsx`, `src/pages/PortfolioProjectDetailPage.tsx`, `src/pages/Privacy/Terms/NotFoundPage.tsx`. The brand site.
- `server/routes/tools/_shared.ts` + `tokens.ts` + `email-capture.ts` — shared APIs even sibling apps call.
- `server/routes/{stripe,blog,analytics,license,social}.ts` — host-level concerns.
- `mcp-host-server/` — the MCP every sibling depends on.
- The Clerk + Turso + Stripe + Render plumbing.

That's a small, sharp host. The 10 AI-tool pages currently in `src/pages/*Page.tsx` and `server/routes/tools/<tool>.ts` are the only things slated for the door.

## Done state

```
~/Projects/Bilko/                 ← framework only: brand, registry, kit, auth, credits, blog, admin
  src/pages/                      → ~12 brand pages, no products
  server/routes/                  → tools/_shared.ts + global services only
  public/projects/                → 12+ static-path bundles synced from siblings
  mcp-host-server/                → the registry/publish API
  docs/                           → host-contract.md, migration-plan.md, prds

~/Projects/<every-app>/           ← own repo, own session, own ship
  vite.config.ts                  → base: /projects/<slug>/
  src/                            → page + slim local kit
  .mcp.json                       → wires up bilko-host
```

That's the iPhone analogy realized: 12+ apps, one home button.
