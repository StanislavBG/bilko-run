# Ship: book-live-everywhere

- Pushed SHA: none. Nothing was pushed.
- Time: 2026-11-02 11:49 PM PST
- Commits found (4, each touching only its listed files): f926c96a, aa58f56e, 7d477d37, f84ec2fc. None were on origin.

## Checks
- Validation record VERIFIED for all four, no Critical/Important: PASS
- Cherry-pick onto origin/main (5955efb9): FAIL. f84ec2fc conflicts in docs/host-contract.md (origin gained the .ics SEQUENCE commit 5955efb9 touching the same free-hour contract text). The first three picked cleanly. Per the PRD the pick was aborted and the tree removed.
- pnpm test / typecheck / build: not run
- Push: not done
- Deploy wait and live checks: not run

Follow-up: resolve the docs/host-contract.md line against origin's current text, then re-run this ship.

SHIP: FAIL
