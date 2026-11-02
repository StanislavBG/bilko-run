# Validation sweep: fix-ship-menu-retired (PRD 1579)

Base: b6e2b8f49f8711639a970d34a3062dc2ccf9cbe8 (PRD file found at epics/.../prds-archived/1579-fix-ship-menu-retired.md).
Commits since base touching the PRD's files: none new (the fix landed before base: a19dd1ee, 254c36eb, fbc2ccbe, merge 3427029e). Evidence is from the tree and origin.

## fix-ship-menu-retired: VERIFIED

- AC1 MCP parity: `tests/offer-price-ceiling.test.ts:109-120` POSTs /mcp `list_offers` and compares id, amount, price inside the existing test. Commit a19dd1ee `fix(menu): compare MCP list_offers in the offer parity test`. Re-run: 4 tests passed.
- AC2 Resolution: `validate-menu-retired.md:54` `## Resolution` names a19dd1ee, 4 tests passed, time with PST. Original finding text kept.
- AC3 zero queued/drafted orders before push: stated in ship record ("0 orders"); cannot be re-observed now (admin key call not repeated, pre-push state). Taken from the record only.
- AC4 origin/main subjects: `git log origin/main` has all 8 feat(menu): subjects, `fix(menu): compare MCP...` (2e6693a1) and `fix(menu): recount tests in CLAUDE.md` (39278bb6). Local docs commits (a19dd1ee etc.) are not on origin, matching "no other commit". No-force and origin-only not re-observable; origin history is linear through 39278bb6.
- AC5 pnpm test/typecheck/build on pushed tree: from ship record only (not re-run; the pushed tree is not this tree).
- AC6 live offers: `/api/offers` now lists the same nine ids (bilko-hour first, not last as the criterion wrote it; ids and set match); `/api/menu` lists only agent-factory-kit. Prices, /llms.txt and MCP not re-fetched here; from record.
- AC7 `/buy/ask-bilko` re-checked: 404. dryRun, /api/projects and browser checks come from the record (screenshots under /tmp, not re-inspected).
- AC8 ship record: `ship-menu-retired.md` has pushed SHA 39278bb6, commits, PST times, per-check PASS, screenshot paths, CLAUDE.md conflict resolution, `SHIP: PASS` (line 38); no `SHIP: FAIL`.
- Gate: PRD's gate commands: vitest passes (re-run); `list_offers` grep present; `^## Resolution` present; `SHIP: PASS` present.

## Findings

### Critical
none

### Important
none

### Minor
- `ship-menu-retired.md`: AC6 listed bilko-hour last; live and record show first. The record notes it. Criterion wording, not a defect.
- Several live/build checks (AC3, AC5, parts of AC6/AC7) rest on the ship record, not independent re-observation.
- Combined-diff review: the only code change is the test addition (13 lines, no secrets, no unsafe input); no application source changed.
