# Games Launch Log

## 2026-05-10 — wave-2 prod validation FAILED

**Gate:** PRD 150 — games-prod-validate

**Smoke test results:**
- fizzpop: FAIL — SPA fallback (not game title)
- etch: FAIL — SPA fallback
- cellar: FAIL — SPA fallback
- sudoku (regression): FAIL — SPA fallback
- mindswiffer (regression): FAIL — SPA fallback
- academy (regression): FAIL (title) / PASS (page loads via SPA)
- studio page: FAIL — fizzpop/etch/cellar/sudoku/mindswiffer not listed

**Root cause:** Render auto-deploy never fired. Static files ARE committed in
`content-grade/master` (fizzpop `9f7bd9c`, etch `4b79090`, cellar `0d35f6d`) but
Render's GitHub App is fully disconnected — `gh api repos/Content-Grade/Content-Grade/hooks`
returns `[]`. Render uptime at check time: 337,869 s (last deploy ~May 7, 2026).
This is the 4th recurrence of this pattern.

**Fix queued:** `~/.claude/session-manager/scheduled-plans/prds/151-games-prod-fix-render-deploy.md`
— requires human to trigger Render manual deploy or reconnect GitHub App.
