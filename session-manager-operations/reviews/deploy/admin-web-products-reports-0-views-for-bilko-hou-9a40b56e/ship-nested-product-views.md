# Ship: nested-product-views

- Pushed SHA: d0377ebeeca0724483f340ef32bc243d0dccfaff (origin/main, StanislavBG/bilko-run; previous tip 98baaa48)
- Commit: `fix(admin): count nested product pages under their own product` (cherry-picked from f58ea065 onto origin/main in a throwaway tree; no other local-main commit pushed)
- Pushed: 5:46 PM PST, 2026-11-02
- Deploy seen: 5:49 PM PST (health uptime 56 s vs 184 s since push)
- Live check: 5:49 PM PST

## Numbers (views, days=365, exclude_self=0)

| Product | Before | After |
|---|---|---|
| launch-kit | 8 | 8 |
| agent-factory-kit | 0 | 0 |
| bilko-hour | 4 | 4 |

toolVisits rows: /projects/launch-kit/ = 7, /projects/launch-kit/thanks/ = 1, none under /projects/launch-kit/agent-factory-kit/ or /projects/agent-factory-kit/. No numbers change, as expected: no non-bot nested-page view existed.

## Checks
- Validation record VERIFIED, no Critical/Important: PASS
- Only the one commit on origin, pushed to origin only: PASS
- pnpm test (1858 passed, 15 skipped), pnpm typecheck, pnpm build all exit 0 on pushed tree: PASS
- Health uptime (56 s) below seconds since push (184 s): PASS
- agent-factory-kit views 0 = nested visits 0; launch-kit views 8 = other launch-kit visits 8: PASS
- No POST, no page request, no browser: PASS

SHIP: PASS
