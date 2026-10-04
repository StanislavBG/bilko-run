# Rollout plan

## Platform tier

| Date | Version | Change |
|------|---------|--------|
| 2026-05-08 | 0.3.0 | Ship `@bilkobibitkov/host-kit/testing` subpath — Playwright harness (`withHostStub`, `expectChromeLoaded`, `signInAs`, `setCredits`, `submitPrimaryAction`, `expectScoreCard`), golden template, and `data-testid` attributes on `ScoreCard`. Pilot verified on Stack-Audit (`~/Projects/Stack-Audit/tests/golden.spec.ts`). |

## Per-sibling adoption

Each sibling adopts the harness by copying `golden.template.ts` into
`tests/golden.spec.ts` and filling in three TODOs (slug, title regex, CTA
regex). PRD 26-platform-publish-gate will block publish for siblings that
lack a passing `golden.spec.ts`.

## Previous entries

*(none — this is the first platform-tier entry)*
