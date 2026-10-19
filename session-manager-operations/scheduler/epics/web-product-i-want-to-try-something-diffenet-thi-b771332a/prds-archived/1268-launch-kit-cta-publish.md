---
title: Publish the fixed Launch Kit page via the bilko-host MCP and verify all four buy CTAs reach checkout live
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-11T20:16:50.244Z
sourcePromptId: web-product-i-want-to-try-something-diffenet-thi-b771332a
agentType: dev-lead
dependsOn: [launch-kit-cta-checkout]
planId: pl-mv49k24v-9e85f3
---
# Goal

deploy: publish the rebuilt /home/bilko/Projects/Bilko-Launch-Kit/site/dist (from PRD launch-kit-cta-checkout, which made every purchase CTA start checkout) to https://bilko.run/projects/launch-kit/ through the bilko-host MCP with every publish gate passing. Then prove on the live page that all four [data-buy] CTAs POST to the checkout endpoint and navigate to the returned URL, without creating a real Stripe session.

# Acceptance criteria

- [ ] Before publishing, the run fails if any *.zip or SKILL.md exists under /home/bilko/Projects/Bilko-Launch-Kit/site/dist (find, inverted so the clean case exits 0).
- [ ] mcp__bilko-host__publish_static_project publishes {slug 'launch-kit', distPath '/home/bilko/Projects/Bilko-Launch-Kit/site/dist', sourceRepoPath '/home/bilko/Projects/Bilko-Launch-Kit/site'} with no gate bypassed; on a gate failure, FAIL with the gate output.
- [ ] Bounded poll (max 20 x 30s): https://bilko.run/projects/launch-kit/manifest.json reports the gitSha of the sibling commit from launch-kit-cta-checkout.
- [ ] Live, headless Chromium with the checkout POST and /api/analytics/** stubbed in-browser: each of the 4 [data-buy] CTAs, clicked in a fresh page, sends one POST to /api/web-products/launch-kit/checkout and navigates to the stubbed Stripe URL.
- [ ] Live: no element on the page whose text starts with 'Get' links to #top.
- [ ] session-manager-operations/reviews/deploy/web-product-i-want-to-try-something-diffenet-thi-b771332a/launch-kit-cta-publish.md is committed and pushed to origin main: publish SHA (mcp__bilko-host__status), live gitSha, per-CTA PASS/FAIL, PDT/PST times, and 'CTA: PASS' only if all checks pass.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- session-manager-operations/reviews/deploy/web-product-i-want-to-try-something-diffenet-thi-b771332a/launch-kit-cta-publish.md

# Implementation notes

The bilko-host MCP is registered at user scope but its tools arrive deferred: load them first with ToolSearch `select:mcp__bilko-host__publish_static_project,mcp__bilko-host__list_projects,mcp__bilko-host__status`. The publish tool commits and pushes to origin from its own publish checkout. Do not copy files into public/projects/ by hand. launch-kit is already registered, so do not call register_static_project.

Steps:
1. Read the sibling HEAD SHA (`git -C /home/bilko/Projects/Bilko-Launch-Kit rev-parse --short HEAD`) and confirm its subject is the CTA fix from launch-kit-cta-checkout. Rebuild if site/dist is older than that commit (`pnpm --dir /home/bilko/Projects/Bilko-Launch-Kit/site build`). Run the no-paid-files check.
2. publish_static_project, then status.
3. Poll the live manifest.json with `curl --max-time 15` in `for i in $(seq 1 20)` with `sleep 30`, until gitSha matches. HALT on exhaustion.
4. Write a temp Playwright script, e.g. /tmp/lk-cta/check.mjs. Load chromium via createRequire('/home/bilko/Projects/Bilko/package.json') and require('@playwright/test').
   - In each fresh page, call page.route('**/api/web-products/launch-kit/checkout') and fulfill 200 JSON {url:'https://checkout.stripe.com/c/pay/cs_test_stub'}. Also route that stub URL to a local 200 HTML page, and fulfill '**/api/analytics/**' with 204. This keeps live Stripe and the funnel metrics untouched.
   - Go to https://bilko.run/projects/launch-kit/, click the CTA (nth of '[data-buy]', 0-3), wait for the stub URL, and count POSTs to the checkout route.
   - Then scan the anchors for text starting 'Get' with href '#top'.
5. Write the record. `git add` only the record and commit. `git fetch origin`, then if needed `git merge --no-edit origin/main`; never rebase, because local history has merges. Then `git push origin HEAD:main`. Before pushing, check that the origin remote is github.com/StanislavBG/bilko-run.

Do not touch: application source, src/data/, public/projects/ by hand, the sibling repo's files.

# Out of scope

- A real purchase or a real Stripe Checkout Session
- Code changes. If a live check fails, FAIL and report it; do not fix it here.

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 30 curl -sf --max-time 15 https://bilko.run/projects/launch-kit/ && timeout 10 grep -q 'CTA: PASS' session-manager-operations/reviews/deploy/web-product-i-want-to-try-something-diffenet-thi-b771332a/launch-kit-cta-publish.md
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
