# Validation: burst-visitors-are-bots (PRD 1742)

Base: 5209e630. Landed commit: **c04d6f411bc381fc8e7788bfa72bce2a5a80b697** (`feat(page-hits): flag 20-hits-in-60s visitors as scripts`; touches server/page-hits.ts, tests/page-hits.test.ts, docs/observability.md).

## 1742-burst-visitors-are-bots — VERIFIED

- AC1: server/page-hits.ts exports `BURST_HITS = 20`, `BURST_WINDOW_MS = 60_000`; `isBurst` keeps per-visitor ts list, prunes to the window on each record, evicts stale keys past 5000; on a burst it calls `markProbeVisitor` and sets class `script` (recordPageHit else-if branch, ~line 133).
- AC2: reuses markProbeVisitor, so the existing flush stamping and backfill UPDATE apply; test "burst flags all hits incl. one flushed earlier" (tests/page-hits.test.ts ~387-393) passes.
- AC3: tests cover 19-in-60s (~399), 20-over-10-min (~407), other visitor untouched (~414); probe tests unchanged and pass.
- AC4: tests cover all cases; `resetProbeVisitorCache` clears `burstHits` (test ~425).
- AC5: docs/observability.md §11 bullet added (plus "loads fewer than 20 pages a minute" in "Not caught").
- Gate re-run: `pnpm vitest run tests/page-hits.test.ts tests/non-page-paths.test.ts` → 153 passed; `pnpm typecheck` → exit 0.

## Findings

Critical: none.

Important: none.

Minor:
- server/page-hits.ts (`isBurst`, recordPageHit branch): only hits already classed `human` are counted and relabelled, narrower than AC1's literal "records the current hit as script". Disclosed by the implementer; UA-flagged bots keep their class. Acceptable.
- server/page-hits.ts (`isBurst`): stale-key eviction only runs when a new key is added at ≥5000 entries; if all 5000 are fresh the map can exceed the cap briefly. Bounded by visitors active in one minute.
- Edge: window is exclusive (`t > since`), so 20 hits spanning exactly 60.000s do not trigger. Negligible.
- Review: no unsafe input handling, secrets or path handling in the diff; no existing helper duplicated (reuses markProbeVisitor). /code-review and /security-review were done as self-review.
