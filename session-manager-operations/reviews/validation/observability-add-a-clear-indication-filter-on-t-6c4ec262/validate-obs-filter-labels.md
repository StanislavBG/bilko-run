# Validation: obs-filter-labels-from-echo

Base 39228786; one commit in range: e658f386 (touches exactly the 4 PRD files). Self-reviewed diff (no unsafe input, no secrets, no duplicated helper).

## obs-filter-labels-from-echo — VERIFIED
- AC1: useCommandData.ts:66-68 `echo = traffic?.filters; botsOut = echo?.bots === 'exclude'; mineNote = echo?.mine === 'exclude'`; `filters` param removed; no echo → no labels.
- AC2: CommandShell.tsx prop `mineHits?: number` (line ~116); titles override uses `Hide the owner’s own traffic · ${mineHits.toLocaleString('en-US')} owner hits in this window` when typeof number, else EXCLUDE_TITLES.
- AC3: ObservabilityPage.tsx:58-59 deriveKpis without filters, deps updated; line ~88 `mineHits={traffic.data?.filters?.mineHits}`. Other caller PreviewPage.tsx:256 already uses 4 args.
- AC4: tests/obs-command-kpis.test.ts covers echo exclude both labels, echo include with local toggles exclude (via cast), no-filters response; old tests updated only where they asserted local-filter labels.
- Gate: `vitest run obs-command-kpis + obs-command-layout` → 2 files, 33 passed; `pnpm typecheck` → exit 0.

## Findings
- Critical: none. Important: none.
- Minor: tests use an `unknown` cast to simulate legacy callers (tests/obs-command-kpis.test.ts, `withLocal`); acceptable.
