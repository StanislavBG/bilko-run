---
title: Tag host pages: layout nav/footer tip, home, projects, pricing
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-18T18:43:17.690Z
sourcePromptId: bilko-observability-common-toolkit-each-projects-516b5e5c
agentType: dev-lead
dependsOn: [host-trackflow-helper]
planId: pl-mve5lxlp-756161
---
# Goal

wire: tag the host's core pages so every main button and monetization surface shows up by name in the session timeline and the Flows dashboard. Those pages are the site-wide nav and footer (including the coffee tip jar), the home hero, the project cards on /projects, and the pricing/credits checkout.

# Acceptance criteria

- [ ] In src/components/Layout.tsx, the nav links get data-track="nav-<target>" and the footer links get footer-<target>. The coffee tip link gets data-track="tip-coffee" plus trackFlow('tip', 'click-tip', { product: 'coffee', area: 'footer' }) on click.
- [ ] In src/pages/HomePage.tsx, the hero CTAs get home-<action>. Any coffee or tip link there gets tip-coffee plus trackFlow('tip', 'click-tip', { product: 'coffee', area: 'home' }).
- [ ] In src/pages/ProjectsPage.tsx, each project card link gets data-track="project-open" with data-track-slug or a similarly unique attribute, so clicks say which project. Opening a card calls trackFlow('explore', 'open-project', { slug }).
- [ ] In src/pages/PricingPage.tsx, every buy or credit-pack button gets data-track="buy-<pack>". The page calls trackFlow('checkout', 'view-offer', { product: 'credits' }) once on mount, and trackFlow('checkout', 'click-buy' then 'checkout-redirect', { product: 'credits', plan: <pack> }) around the existing Stripe redirect. If the page handles a success or cancel return, it emits 'success' or 'cancel'.
- [ ] No tracking call changes navigation or checkout behavior or calls preventDefault. pnpm typecheck and a vite build pass.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- src/components/Layout.tsx
- src/pages/HomePage.tsx
- src/pages/ProjectsPage.tsx
- src/pages/PricingPage.tsx

# Implementation notes

Read first: src/components/Layout.tsx, src/pages/HomePage.tsx, src/pages/ProjectsPage.tsx and src/pages/PricingPage.tsx (grep -n 'href\|onClick\|<button\|checkout\|coffee' in each); src/hooks/usePageView.ts trackFlow (landed by PRD host-trackflow-helper).

Taxonomy:
- data-track is kebab-case "<area>-<action>". Buy buttons use the prefix buy-, tip buttons tip-.
- Flows are 'checkout' (view-offer, click-buy, checkout-redirect, success, cancel), 'tip' (click-tip, ...) and 'explore'.
- Props carry no email or amount tied to a person.

Never click a real checkout or /coffee in captures: they are live Stripe.

Do not touch: src/hooks/usePageView.ts, the session-manager-landing files.

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm typecheck && timeout 300 pnpm exec vite build --outDir /tmp/bilko-gate-build-coretag --emptyOutDir
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
