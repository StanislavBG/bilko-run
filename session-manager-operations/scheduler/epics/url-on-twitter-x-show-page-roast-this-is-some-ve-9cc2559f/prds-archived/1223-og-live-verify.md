---
title: Ship social cards and verify them live on bilko.run as a crawler sees them
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 12
createdVia: scheduler-api
issuedAt: 2026-10-10T21:51:12.618Z
sourcePromptId: url-on-twitter-x-show-page-roast-this-is-some-ve-9cc2559f
agentType: dev-lead
dependsOn: [og-wire-routes, og-base-html-refresh, og-host-contract-doc]
planId: pl-mv2xh98y-887554
---
# Goal

validate: push main to origin (StanislavBG/bilko-run; Render auto-deploys from it) and prove that the live site now serves current, project-specific share cards to the X crawler: /projects/<slug>/ pages carry their own title, tagline and /og/<slug>.png image, /products/session-manager carries Session Manager's card, and nothing serves the old 'AI Advisory for Small Business' / PageRoast card. Record the evidence in a committed check file.

# Acceptance criteria

- [ ] origin/main contains the commits from PRDs og-meta-resolver, og-image-renderer, og-wire-routes, og-base-html-refresh and og-host-contract-doc (git push origin main; never push to the content-grade remote).
- [ ] After the Render deploy (bounded wait: at most 20 polls x 15s of `curl -sf --max-time 15 https://bilko.run/og/default.png -o /dev/null`), https://bilko.run/og/session-manager.png, /og/page-roast.png and /og/default.png return 200 image/png.
- [ ] Fetched with `-A Twitterbot`: https://bilko.run/projects/page-roast/ has og:image https://bilko.run/og/page-roast.png; https://bilko.run/products/session-manager has og:image https://bilko.run/og/session-manager.png and a title containing 'Session Manager'; https://bilko.run/ has no 'AI Advisory' text and og:image https://bilko.run/og/default.png.
- [ ] Each downloaded card PNG is viewed (Read tool on the saved PNG) and the session-manager card visibly says Session Manager, not PageRoast.
- [ ] session-manager-operations/reviews/validation/url-on-twitter-x-show-page-roast-this-is-some-ve-9cc2559f/og-live-check.md is committed, listing every URL checked with HTTP status and the og:title / og:image observed.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- session-manager-operations/reviews/validation/url-on-twitter-x-show-page-roast-this-is-some-ve-9cc2559f/og-live-check.md

# Implementation notes

Read first: server/og-routes.ts and server/og-meta.ts (to know expected output).

Steps:
1. `git -C /home/bilko/Projects/Bilko log --oneline -10` and confirm the five PRD commits are on main; `git push origin main`. If the push is rejected (non-fast-forward), `git pull --rebase origin main` then push again once; if still rejected, print HALT and exit 1.
2. Bounded deploy wait (PRD_AUTHORING §1): `for i in $(seq 1 20); do curl -sf --max-time 15 -o /dev/null https://bilko.run/og/default.png && break; sleep 15; done`. Do NOT use /api/health uptime as the deploy signal alone. If still 404 after 20 tries, write the record with the failure and exit 1.
3. Save pages with `curl -sf --max-time 15 -A Twitterbot -o /tmp/og-<name>.html <url>` and PNGs to /tmp; grep the meta tags; view PNGs with Read.
4. Write and commit the record file (exact path only).

Do not touch any source file. If a check fails, do NOT fix code here — record the failure and emit SCHEDULER_VERDICT: FAIL with the reason.

# Out of scope

- Code fixes (a failure is reported, not fixed)
- Refreshing X's cache for already-posted tweets

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 20 curl -sf --max-time 15 -o /tmp/og-gate-sm.png https://bilko.run/og/session-manager.png
timeout 20 curl -sf --max-time 15 -A Twitterbot -o /tmp/og-gate-pr.html https://bilko.run/projects/page-roast/ && timeout 5 grep -q 'https://bilko.run/og/page-roast.png' /tmp/og-gate-pr.html
timeout 20 curl -sf --max-time 15 -A Twitterbot -o /tmp/og-gate-sm.html https://bilko.run/products/session-manager && timeout 5 grep -q 'https://bilko.run/og/session-manager.png' /tmp/og-gate-sm.html
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
