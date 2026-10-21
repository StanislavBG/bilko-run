# Validation: treat bots as a customer segment (plan 1466-1487)

Base: 12ff638469646ce2709326fea1f61ff12ad00d93, HEAD a08e730c. 2026-10-20.
All 19 PRD files found under `prds-archived/`. Commits per PRD were located in `git log base..HEAD` by subject (feat(analytics) x4, feat(offers), feat(buy), feat(seo) x2, feat(mcp) x3, feat(agent-keys) x2, feat(credit-gate), feat(checkout), docs x2, test(agent-buy) x2).

## Global gates (run in this worktree)
- `timeout 580 pnpm vitest run`: 141 files passed, 2 skipped (the two sandbox files, no `STRIPE_SANDBOX_KEY`); 1562 tests passed, 10 skipped, 0 failed.
- `pnpm typecheck`: exit 0 (client, server, scripts).
- `pnpm --dir mcp-host-server build`: exit 0; `git status mcp-host-server` clean afterward, so committed dist matches src.
- The per-PRD vitest gates are subsets of the full run, so they pass with it. The skipped sandbox gates are covered below.

## Cross-cutting checks
- byClass sums to all non-error hits: `server/routes/admin-observability.ts:212,312,323` uses `COALESCE(visitor_class, CASE WHEN is_bot=1 THEN 'script' ELSE 'human' END)` over all rows with `status<400`, and zero-fills from `VISITOR_CLASSES`. The sum-invariant test in `tests/observability.test.ts` passes.
- No `bkk_` key is accepted by requireAuth/requireAdmin: `server/clerk.ts` has no diff in the plan; `verifyAgentApiKey` is called only at `server/routes/tools/_shared.ts:241` (creditGate) and `server/routes/project-catalog.ts:126` (/mcp). `tests/agent-keys-routes.test.ts` covers bkk_-only → 401.
- No secrets in the diff: grep over added lines for `sk_test_<10+>`, `rk_`, `whsec_<10+>`, `bkk_<30+>` gave 0 hits. `sk_live_` appears only in the live-key guard (`server/services/stripe.ts`), its test and a doc line. Review docs show only `cs_test_` and `bkk_9pX7...` prefixes.

## Per-PRD verdicts
1. **visitor-class-primitive** VERIFIED. `server/services/analytics.ts:83,91,106,119` has VisitorClass, VISITOR_CLASSES, classifyVisitor and isBot. `tests/visitor-class.test.ts` has 28 tests, passing.
2. **page-hits-visitor-class** VERIFIED. `server/db-schema.ts:672` adds the column; `server/page-hits.ts:136,148,179,204,224,241` has the INSERT, backfill, agent-path allowlist, x-bot-id and detached backfill. Tests in `tests/page-hits.test.ts` pass.
3. **traffic-api-by-class** VERIFIED. byClass, topPagesByClass and recent[].visitorClass are at `admin-observability.ts:312-389`. Tests pass.
4. **traffic-report-mcp-classes** VERIFIED. `mcp-host-server/src/errors-report.ts:148-149,162` and the tool description at `server.ts:681`. Dist rebuilt clean and `mcp-dist-sync` passes.
5. **traffic-module-class-panel** VERIFIED. `TrafficModule.tsx`, `KpiStrip.tsx`, `types.ts` and `PreviewPage.tsx` are in the diff. `tests/obs-command-traffic-class.test.ts` passes.
6. **agent-offers-primitive** VERIFIED. `shared/agent-offers.ts` is pure data with 4 offers. `tests/agent-offers.test.ts` passes.
7. **agent-buy-route** VERIFIED. `server/routes/agent-buy.ts`: params match the criteria (lines 63-92). Crawler/HEAD get a 200 noindex page (`:108`), rate limit 10/min, funnel insert is best-effort. `tests/agent-buy.test.ts` passes.
8. **offer-jsonld** VERIFIED. `server/offer-jsonld.ts:26-49` has InStock, P1M, `<` escaping and the Product de-duplication check, wired at `og-routes.ts:74`. `tests/offer-jsonld.test.ts` passes.
9. **mcp-catalog-offers** VERIFIED. `list_offers`, `GET /api/offers` and per-project offers are in `project-catalog.ts`. `tests/project-catalog.test.ts` passes.
10. **llms-txt-storefront** VERIFIED. `server/routes/agent-storefront.ts` has the `# bilko.run`, `## Buy`, `## Projects` and `## For agents` sections. `tests/agent-storefront.test.ts` passes.
11. **agent-api-keys-primitive** VERIFIED. `server/services/agent-api-keys.ts` and the `agent_api_keys` table. `tests/agent-api-keys.test.ts` passes.
12. **credit-gate-agent-key** VERIFIED. `_shared.ts:238-247`: bkk_ is verified, an invalid key gets 401, and the Clerk path is unchanged. `tests/credit-gate-agent-key.test.ts` passes.
13. **agent-keys-routes** VERIFIED. `server/routes/agent-keys.ts` (Clerk-only). `tests/agent-keys-routes.test.ts` passes.
14. **checkout-success-agent-key** VERIFIED. `server/routes/stripe.ts:440-466` mints once, sets `private, no-store` and `no-referrer`. `tests/stripe-checkout-success.test.ts` passes.
15. **mcp-roast-page-tool** VERIFIED. `page-roast.ts:28-36` (roast_page, buy URL, invalid-key message) and `project-catalog.ts:125-126`. `tests/mcp-roast-page.test.ts` passes.
16. **agent-commerce-research-doc** VERIFIED. `docs/agent-commerce.md` has sections 1-5 plus Recommendation and 16 URLs. I did not re-fetch the third-party claims. This is a no-gate PRD checked by reading.
17. **agent-surfaces-docs-robots** VERIFIED. `public/robots.txt` has all Allow/Disallow lines and the Sitemap; `docs/host-contract.md:272` has the new section; the CLAUDE.md bullets are at lines 124, 125 and 143.
18. **sandbox-buy-urls** VERIFIED. Test is `skipIf(!KEY)` and refuses non-sk_test_ keys. The review doc records 4 offers with cs_test_ prefixes, price ids, modes and metadata. The skip with no key was confirmed in the full run. I did not re-run the live sandbox (no key here); the recorded run is the evidence.
19. **sandbox-paid-call-e2e** VERIFIED. Same guards. The review doc records the 6/6 run: balance 0→7, key prefix only, 7→6 via HTTP, 6→5 via MCP, no second key on revisit. I did not re-run it for lack of a key.

## Findings
### Critical
- none
### Important
- none
### Minor
- `server/routes/agent-buy.ts:107`: crawler blocking relies on the UA only; a crawler with a browser UA can still mint sessions (bounded by the 10/min per-IP limit and robots.txt `Disallow: /buy/`).
- `server/routes/tools/_shared.ts:249`: `isAdminEmail(email)` is evaluated for the agent key owner's email. This is harmless but means an admin-owned bkk_ key gets admin cost-limit treatment.
- The combined base..HEAD diff includes work from other plans (signin-capture, mailer, service-slots, web-products/Human For Hire, stripe live-key guard). It is outside this plan and was not judged here, but the full suite covering it is green.
- The sandbox legs were validated from the recorded review docs only, not re-executed.
