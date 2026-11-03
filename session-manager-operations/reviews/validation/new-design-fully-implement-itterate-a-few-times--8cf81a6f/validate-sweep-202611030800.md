# Validation sweep: fix-ship-book-live-everywhere

Base: ad0abfab (given). PRD file: scheduler/epics/.../prds-archived/1616-fix-ship-book-live-everywhere.md. Commits in range: 2590e25a (ship record only; the pushed code commits are on origin/main).

## fix-ship-book-live-everywhere — VERIFIED

- Record `ship-book-live-everywhere.md` exists, committed (2590e25a), contains `SHIP: PASS`, pushed SHA 8f1fb73d, conflict-resolution notes, PST times, per-check PASS.
- Four commits on origin/main in order on top of 5955efb9 (`git log origin/main -8` after fetch): 1693d1d4, 3f914488, 584dfaf0, 8f1fb73d. No other local-main commits present; history linear (no force push evident).
- `git show origin/main:docs/host-contract.md`: `icsSequence` x2 (origin's SEQUENCE text intact), `https://bilko.run/book` x1.
- Live re-check (curl, today): /bilko `href="/book"` x2, `fhb-slots` x0, `$100 / hour` x3; /book HTTP 200 containing "Bring your AI idea. Leave with a plan."; /api/offers contains `https://bilko.run/book`.
- Validation record cited by the PRD (validate-book-live-everywhere.md): all four PRDs VERIFIED, Critical none, Important none.
- Gate commands re-run: `grep -q 'SHIP: PASS'` exit 0; `git fetch origin` exit 0; origin host-contract grep exit 0.
- Not re-run by me: pnpm test/typecheck/build on the pushed tree and Chromium href check (taken from the ship record; no independent evidence).

## Findings

- Critical: none.
- Important: none.
- Minor: the ship record's test/build and Chromium results are self-reported and not independently reproduced here.
