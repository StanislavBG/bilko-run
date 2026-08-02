---
title: Rebuild Session Manager marketing page as standalone product surface (own nav, Buy Now framing, full feature sections)
cwd: ~/Projects/Bilko
estimateMinutes: 30
---

# Goal

The `/products/session-manager` page (added by PRD 723, commit `b5e7795`, already live) has three problems the user explicitly flagged after seeing it deployed:

1. **It shares Bilko.run's global site navigation** (rendered inside `<Route element={<Layout />}>` in `src/App.tsx`, which wraps every route in `src/components/Layout.tsx`'s `pf-topbar` — Bilko's own brand/nav/command-palette). This page must NOT do that. Reference: `bilko.run/projects/social-signals-trader/` is a *static-path* project that ships its own completely independent "publictrades.dev" header — no shared Bilko chrome at all. This page needs the same independence even though it's a `react-route` page (it still needs to share this repo's Stripe/checkout backend, so it can't become static-path, but it must visually and structurally NOT render Bilko's `Layout`).
2. **The purchase framing drifted into donation copy** during PRD 723's execution ("Support the build" / "Session Manager is free and open source — this is a one-time, pay-what-you-want way to back the project" / "Support Session Manager" button) — this is NOT what was asked for. It must read as a straightforward paid product: "Buy Now — $19.99" / fixed one-time price, not pay-what-you-want.
3. **Features render as compact cards**, not full sections. The updated design (see below) gives each of the 8 features a dedicated full-width section with its own heading, longer description copy, and screenshot — a long single-scroll page is explicitly fine.

The Claude Design project "Session Manager" (id `0ca33cd3-c2fa-4644-b728-bde42292abbd`) has an updated `variants/landing-page.jsx` (just rewritten, etag `1785218711072171`) implementing all three fixes: a sticky standalone header (own brand mark + a "Buy Now — $19.99" button that stays pinned while scrolling), 8 full alternating-layout feature sections, and a bottom buy/checkout section with explicit "Buy Now" copy throughout (no donation language anywhere). Port this into the real page.

The real Stripe price now exists and is LIVE (created directly via the Stripe CLI, not a placeholder): price id `price_1Ty42LR6w0VtQRLTOuiVP78R`, product `prod_Uy02607cUsi1tP`, $19.99 USD one-time, set as the product's default price. The existing webhook `we_1TGSyNR6w0VtQRLTgQme5wNo` (`https://bilko.run/api/stripe/webhook`) already covers `checkout.session.completed` — no webhook changes needed.

# Acceptance criteria

- [ ] Fetch the current `variants/landing-page.jsx` from Claude Design project `0ca33cd3-c2fa-4644-b728-bde42292abbd` via the `claude_design` MCP `read_file` tool (etag `1785218711072171`) if that MCP tool is available in this execution context. If unavailable, use the copy/structure embedded in the Implementation notes below instead of blocking — do not fail the PRD over MCP unavailability.
- [ ] `src/pages/SessionManagerPage.tsx` (added by PRD 723) is rewritten to match: a sticky header (own "Session Manager" brand mark, NOT Bilko's brand/nav, with a "Buy Now — $19.99" button pinned via `position: sticky` that stays visible while scrolling), a hero section, then one full-width section PER feature (not compact cards) — alternating image-left/image-right layout is fine but not required, each with its own heading + substantive description (2-4 sentences, not a one-line blurb) — and a bottom purchase section.
- [ ] ALL "Support the build" / "pay-what-you-want" / "back the project" / donation-style copy is removed and replaced with explicit paid-product framing: "Buy Now — $19.99", "one-time purchase", "$19.99 USD". Grep the current live page's rendered copy (`git show b5e7795 -- src/pages/SessionManagerPage.tsx` and `git log -1 -- src/pages/SessionManagerPage.tsx` to see the latest version, since the executor of PRD 723 apparently improvised different copy than what was speced) to confirm no residual donation language survives.
- [ ] **Route this page OUTSIDE Bilko's shared `<Layout />` wrapper** in `src/App.tsx` — move `/products/session-manager`'s route to be a sibling of the `<Route element={<Layout />}>` block (same pattern as the existing `/app` / `/app/*` redirect routes, which are already outside Layout), so it renders with zero Bilko site chrome (no `pf-topbar`, no Bilko brand, no Bilko nav links, no Cmd-K palette). Verify by reading `src/components/Layout.tsx` first to understand exactly what it renders, so the new standalone page doesn't accidentally still pull in Layout-only providers it actually needs (check whether Clerk provider, toast, etc. are supplied by Layout vs. a higher-level app-wide provider — if a route currently NEEDS something Layout provides beyond the nav chrome, that dependency must be preserved another way, not silently dropped).
- [ ] Confirm the portfolio hub card (`ProjectsPage.tsx`) and its `card.href` (verified working in PRD 723) still correctly link to `/products/session-manager` — this PRD must not regress that.
- [ ] The "Buy Now" purchase flow still calls the real `POST /api/stripe/create-checkout-session` with `{ email, priceType: 'session_manager' }` exactly as PRD 723 wired it (`src/lib/sessionManagerCheckout.ts`, `tests/session-manager-checkout.test.ts`) — this PRD changes the page's LAYOUT/copy/nav-independence, not the checkout wiring, which already works. Do not re-derive it; read the existing `sessionManagerCheckout.ts` first and reuse it as-is from both the sticky header's Buy Now button and the bottom purchase section (both should trigger the same checkout flow, e.g. by scrolling to / opening the same purchase form, matching the design's `scrollToBuy` pattern).
- [ ] The Web Remote secondary links added by PRD 727 (commit `b966204` — a link to `/projects/session-manager/` on both the hub card and this page) are preserved through this rewrite, not accidentally dropped.
- [ ] `npm run typecheck` (or this repo's equivalent) passes.
- [ ] Existing test `tests/session-manager-checkout.test.ts` still passes: `timeout 300 npm test` (or this repo's actual test script).

# Implementation notes

Read `src/App.tsx` (route structure), `src/components/Layout.tsx` (what the shared nav/chrome actually renders and what else it might provide besides visual chrome), and the CURRENT `src/pages/SessionManagerPage.tsx` (as landed by PRD 723 + PRD 727, commits `b5e7795` and `b966204`) before making changes. This is a rewrite of an already-shipped page, not new scaffolding — check what's already correct (Stripe wiring, Web Remote link) and preserve it; only fix nav-independence, copy, and section layout.

Fallback copy/structure (use only if the Claude Design MCP read is unavailable) — 8 features, each needs its own full section with a heading + 2-4 sentence body, NOT one-line card blurbs:
1. **Scheduler** — author PRDs, run as `claude -p` jobs timed around the plan's 5-hour token window; auto-pauses on rate-limit, auto-resumes at reset; no manual re-triggering.
2. **Subagents · Hive** — launch a crew of subagents against one problem, watch them work live, race competing approaches; live tool-use feed + results digest.
3. **History** — every past session indexed, searchable, and fully resumable, no terminal-scrollback hunting.
4. **Usage** — live token/cost burn-rate against the plan's rolling window, in-app, no separate dashboard.
5. **Voice** — push-to-talk dictation via local Whisper transcription, nothing leaves the machine.
6. **Browser** — an embedded dev browser Claude can drive: capture DOM state, record click-sequences, in-app.
7. **Web Remote** — pair a phone once, issue scheduler/terminal commands remotely over a self-hosted, end-to-end-encrypted relay.
8. **Everything, one cockpit** — 25+ config/observability surfaces (Settings, Skills, Hooks, MCP Servers, Memory, Permissions, Plans, Tasks), one left-nav, one app.

Sticky header spec: own brand mark (small square logo + "Session Manager" wordmark, NOT Bilko's "B / Bilko Bibitkov" mark from `Layout.tsx`), `position: sticky; top: 0`, a "Buy Now — $19.99" button always visible that scrolls to / opens the purchase section on click.

# Out of scope

- Any change to the Stripe backend, checkout endpoint, or webhook — all already correct and live (price `price_1Ty42LR6w0VtQRLTOuiVP78R`, webhook `we_1TGSyNR6w0VtQRLTgQme5wNo`).
- Setting `STRIPE_PRICE_SESSION_MANAGER` in Render's production environment — that's a manual dashboard step tracked separately, not a repo change.
- Real screenshot import from Claude Design — still tracked as a separate future item; keep using whatever image approach PRD 723 actually shipped (verify what it did — it may have gone text-only per the original PRD's AC, or may have used something else; match the design's intent of "image + copy per feature" using what's actually available in this repo, without a new dependency on live MCP asset access at PRD-execution time).

## Engineering standards

Before writing any code, read `/home/bilko/Projects/session-manager/plugins/session-manager-dev/skills/develop/standards.md` — it has the Performance, Debugging, API-reuse, TDD, and Execution-discipline rules that apply to this PRD. Every rule in it is mandatory, especially Execution discipline (bounded commands, verify before done, the finish-protocol sentinel).
