---
title: Bring "Buy me a coffee" back on bilko.run: footer link on every page plus a home-page hero CTA
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 8
createdVia: scheduler-api
issuedAt: 2026-10-11T01:36:30.593Z
sourcePromptId: buy-me-coffee-this-needs-to-make-a-comeback-on-t-352f8148
agentType: dev-lead
disposition: new-head
planId: pl-mv35jypt-847dcb
---
# Goal

wire: bilko.run has a working tip-jar route, GET /coffee (server-side 302 to Stripe), but nothing on the main site links to it. Add a "Buy me a coffee" link to the shared footer in src/components/Layout.tsx (so it appears on every host page) and a visible CTA in the home-page hero in src/pages/HomePage.tsx, both pointing at /coffee.

# Acceptance criteria

- [ ] src/components/Layout.tsx footer 'Elsewhere' column (around lines 166-172) has a new first-or-second entry `<a href="/coffee">Buy me a coffee ☕ →</a>` — a plain <a>, NOT react-router <Link>, so the browser does a full load that Fastify serves.
- [ ] src/pages/HomePage.tsx hero button row (around lines 40-43, next to 'See the work →' and 'Get in touch') gains a third CTA that is an <a href="/coffee" className="pf-btn ghost">Buy me a coffee ☕</a> (plain anchor, same visual style as the existing ghost button, no new CSS file).
- [ ] Neither link opens in a new tab and neither uses window.location / onClick navigation; no hard-coded buy.stripe.com URL appears in src/.
- [ ] Copy follows Bilko voice (short, warm, no corporate fluff) and does not use first-person claims about being a human builder or a location.
- [ ] pnpm typecheck, pnpm build and the vitest suite pass.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- src/components/Layout.tsx
- src/pages/HomePage.tsx

# Implementation notes

Read first: src/components/Layout.tsx lines 140-178 (footer); src/pages/HomePage.tsx lines 15-50 (hero, buttons use `pf-btn` / `pf-btn ghost`).

Steps:
1. Layout.tsx: add the anchor in the 'Elsewhere' column next to GitHub/Twitter/Email, matching the existing `→` style.
2. HomePage.tsx: add the anchor in the hero button row. The existing buttons are <button onClick={navigate}>; this one must be an <a> because /coffee is a server route, not an SPA route. If `pf-btn` styles assume <button>, add `style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}` inline rather than editing CSS.
3. Run `timeout 300 pnpm build` to make sure Vite compiles, then the gate.

Context: GET /coffee is registered in server/routes/stripe.ts and redirects to the live Stripe payment link; a sibling PRD (coffee-stripe-defaults) makes it work without env vars. Do not modify server code.

Do not touch: server/, shared/, tests/coffee-checkout.test.ts, src/pages/session-manager-landing/ (sibling PRDs own them).

# Out of scope

- Session Manager page
- Server route changes
- New tests that grep JSX

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm typecheck
timeout 300 pnpm build
timeout 600 pnpm vitest run
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
