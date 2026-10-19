---
title: Publish the restyled Launch Kit buy buttons via the bilko-host MCP and verify them live
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-11T21:51:18.254Z
sourcePromptId: web-product-i-want-to-try-something-diffenet-thi-b771332a
agentType: dev-lead
dependsOn: [launch-kit-cta-style]
planId: pl-mv4cxsw1-4fe9c4
---
# Goal

deploy: publish the rebuilt /home/bilko/Projects/Bilko-Launch-Kit/site/dist (from PRD launch-kit-cta-style, which gave all four buy buttons one consistent style) to https://bilko.run/projects/launch-kit/ through the bilko-host MCP with every publish gate passing. Then prove on the live page that the four [data-buy] buttons share one look and still reach checkout, without creating a real Stripe session.

# Acceptance criteria

- [ ] Before publishing, the run fails if any *.zip or SKILL.md exists under /home/bilko/Projects/Bilko-Launch-Kit/site/dist (find, inverted so the clean case exits 0).
- [ ] mcp__bilko-host__publish_static_project publishes {slug 'launch-kit', distPath '/home/bilko/Projects/Bilko-Launch-Kit/site/dist', sourceRepoPath '/home/bilko/Projects/Bilko-Launch-Kit/site'} with no gate bypassed; on a gate failure, FAIL with the gate output.
- [ ] Bounded poll (max 20 x 30s): https://bilko.run/projects/launch-kit/manifest.json reports the gitSha of the sibling commit from launch-kit-cta-style.
- [ ] Live, headless Chromium at 1512px and 390px: all 4 [data-buy] elements have class btn and identical computed background-color, color, font-family, font-weight and border-radius; none has class pill.
- [ ] Live, with the checkout POST and /api/analytics/** stubbed in-browser: each of the 4 buttons, clicked in a fresh page, sends one POST to /api/web-products/launch-kit/checkout and lands on the stubbed Stripe URL.
- [ ] session-manager-operations/reviews/deploy/web-product-i-want-to-try-something-diffenet-thi-b771332a/launch-kit-cta-style-publish.md is committed and pushed to origin main: publish SHA, live gitSha, per-check PASS/FAIL, /tmp screenshot paths, PDT/PST times, and 'BUTTONS: PASS' only if every check passed.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- session-manager-operations/reviews/deploy/web-product-i-want-to-try-something-diffenet-thi-b771332a/launch-kit-cta-style-publish.md

# Implementation notes

The bilko-host MCP is registered at user scope, but its tools are deferred. Load them first with ToolSearch `select:mcp__bilko-host__publish_static_project,mcp__bilko-host__list_projects,mcp__bilko-host__status`. The publish tool commits and pushes to origin from its own publish checkout. Do not copy files into public/projects/ by hand, and do not call register_static_project.

Steps:
1. Run `git -C /home/bilko/Projects/Bilko-Launch-Kit rev-parse --short HEAD` and confirm its subject is the button-style change from launch-kit-cta-style. If site/dist is older than that commit, rebuild it (`pnpm --dir /home/bilko/Projects/Bilko-Launch-Kit/site build`). Run the no-paid-files check.
2. Call publish_static_project, then status.
3. Poll the live manifest.json with `curl --max-time 15` inside `for i in $(seq 1 20)` and `sleep 30` until gitSha matches. HALT if the loop runs out.
4. Write a temporary Playwright script, e.g. /tmp/lk-style/check.mjs. Load chromium with createRequire('/home/bilko/Projects/Bilko/package.json') and require('@playwright/test').
   - Fulfil '**/api/analytics/**' with 204 in every page.
   - Style check: at 1512px and at 390px, read getComputedStyle for each '[data-buy]' and compare the five properties.
   - Take one element screenshot per button per width into /tmp/lk-style/.
   - Click check: use a fresh page per button. Route '**/api/web-products/launch-kit/checkout' to a 200 JSON response {url:'https://checkout.stripe.com/c/pay/cs_test_stub'}. Route that stub URL to a local 200 HTML page. Click the button and wait for the stub URL. Count POSTs.
5. Write the record. `git add` only the record and commit it. `git fetch origin`, then `git merge --no-edit origin/main` if needed (never rebase). Check that origin is github.com/StanislavBG/bilko-run, then `git push origin HEAD:main`.

Do not touch: application source, src/data/, public/projects/ by hand, the sibling repo's files.

# Out of scope

- A real purchase or a real Stripe Checkout Session
- Code changes. If a live check fails, FAIL and report; do not fix here.

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 30 curl -sf --max-time 15 https://bilko.run/projects/launch-kit/ && timeout 10 grep -q 'BUTTONS: PASS' session-manager-operations/reviews/deploy/web-product-i-want-to-try-something-diffenet-thi-b771332a/launch-kit-cta-style-publish.md
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
