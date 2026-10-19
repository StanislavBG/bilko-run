---
title: Build the Launch Kit landing page (instalanding.ai "Clay Constellation" design) as a Vite multi-page static site
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 15
createdVia: scheduler-api
issuedAt: 2026-10-11T04:39:52.655Z
sourcePromptId: web-product-i-want-to-try-something-diffenet-thi-b771332a
agentType: dev-lead
dependsOn: [launch-kit-package]
planId: pl-mv3bwyfa-549f4d
---
# Goal

feature: build the sales page for the $9 "Bilko Launch Kit" at /home/bilko/Projects/Bilko-Launch-Kit/site/, to be served at bilko.run/projects/launch-kit/. Rebuild it from the written brief of the instalanding.ai design "clay-constellation-saas-hero" (MIT; brief already in design/), themed to the kit: a launch-control vibe where the hero's live chat demo shows a skill run. Only real facts about the kit — the design library's brands, numbers and testimonials are fictional and must not ship.

# Acceptance criteria

- [ ] site/ is a Vite 6 + TypeScript (vanilla, no framework) project with base '/projects/launch-kit/' and two HTML entry points, index.html and thanks/index.html (rollupOptions.input), so the build emits dist/thanks/index.html; scripts build (vite build + node scripts/emit-manifest.mjs writing dist/manifest.json in the host manifest format) and test (playwright test).
- [ ] index.html follows design/clay-constellation-saas-hero.txt (prefer the brief over the demo) with sections: nav; hero (headline, subhead, '$9 one-time' price chip, a <button id="buy"> CTA, tilted live-chat demo of page-roast scoring a page); clay stat cards with real facts (8 skills, 1 shared context file, scored rubrics, $9); 'What's inside' with 8 skill cards (label -> outcome -> output file); 'How it works' (install -> launch-context -> skills -> scorecard); pricing card; FAQ; final CTA; footer linking https://bilko.run, /projects, /privacy, /terms.
- [ ] A 'Built on open source' credits block names coreyhaines31/marketingskills and alirezarezvani/claude-skills (MIT), the instalanding.ai design (MIT) and keeps every third-party credit listed in design/clay-constellation-saas-hero.json (e.g. dexter-st / Uiverse); no fabricated testimonials, logos or user counts appear anywhere.
- [ ] The FAQ answers: what a Claude skill is, which Claude products it works with, what you get (zip, 20 downloads per purchase, re-download by signing in with your purchase email), refunds (contact via https://bilko.run/contact within 14 days), and 'does it phone home?' (no — the skills contain no telemetry).
- [ ] No CDN or hotlinked scripts (bundle any motion library, e.g. gsap, from npm, or use CSS); Google Fonts via <link> is allowed; no inline event handlers; prefers-reduced-motion respected; no horizontal scroll at 390px; Playwright screenshots at 1512px and 390px of `vite preview` are saved to site/screenshots/ and visibly correct.
- [ ] Committed in the sibling repo, and session-manager-operations/reviews/deploy/web-product-i-want-to-try-something-diffenet-thi-b771332a/launch-kit-landing-page.md is committed in Bilko with the sibling SHA, dist size, section list and screenshot paths.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- session-manager-operations/reviews/deploy/web-product-i-want-to-try-something-diffenet-thi-b771332a/launch-kit-landing-page.md

# Implementation notes

Read first: /home/bilko/Projects/Bilko-Launch-Kit/design/clay-constellation-saas-hero.txt and .json (the brief and credits), /home/bilko/Projects/Bilko-Launch-Kit/design/instalanding-SKILL.md (adapting rules), /home/bilko/Projects/Bilko-Launch-Kit/pack/README.md (skill labels and outcomes to reuse), /home/bilko/Projects/Stack-Audit/scripts/emit-manifest.mjs, /home/bilko/Projects/Stack-Audit/playwright.config.ts and /home/bilko/Projects/Stack-Audit/vite.config.ts (sibling conventions to copy). Reference demo only if needed: https://instalanding.ai/demos/traffo-constellation.html.

Host facts: bilko.run injects a CSP nonce into every <script>/<style> tag of served HTML; script-src is nonce + 'strict-dynamic', so use module scripts from the bundle; style-src allows fonts.googleapis.com, font-src fonts.gstatic.com.

Steps:
1. Scaffold site/ (package.json private, pnpm install). Leave thanks/index.html as a styled placeholder ("Your download is being prepared") — PRD launch-kit-buy-flow fills it in. The #buy button has no behaviour yet.
2. Write copy in Bilko's voice (witty, direct, no fluff). Never write first-person claims as a human 'I'm Bilko' or a location.
3. Build, preview, screenshot at 1512 and 390, look at the screenshots, fix visible problems, rebuild.
4. Commit in the sibling (`git -C /home/bilko/Projects/Bilko-Launch-Kit add -A`), then the Bilko record.

Never copy anything from pack/ or dist-pack/ into site/ — the zip must never reach a published folder. Do not touch: pack/, sources/, scripts/build-pack.mjs.

# Out of scope

- Buy/checkout wiring, thanks page logic, telemetry, golden spec (launch-kit-buy-flow)
- Publishing (launch-kit-publish-landing)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm --dir /home/bilko/Projects/Bilko-Launch-Kit/site build
timeout 30 test -f /home/bilko/Projects/Bilko-Launch-Kit/site/dist/manifest.json && timeout 30 test -f /home/bilko/Projects/Bilko-Launch-Kit/site/dist/thanks/index.html
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
