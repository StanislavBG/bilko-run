# Validation: hfh-slots-10pm-pacific

Base: d47bc2a099b02b13c7bae26d9d5808dd08cf5424. PRD file: epics/.../prds-archived/1688-hfh-slots-10pm-pacific.md.
Commit: bec91d80 `feat(booking): free-hour slots at 10 PM Pacific` (touches only the 3 PRD files).

## hfh-slots-10pm-pacific — VERIFIED

1. Config: shared/service-slots.ts:38-48 weekly = weekday 2/3/4 at '22:00'; timeZone America/Los_Angeles, 60 min, horizon 21, lead 24 (unchanged).
2. DST case: tests/service-slots.test.ts expects Date.UTC(2026,9,29,5,0) and Date.UTC(2026,10,4,6,0) (seen in the diff).
3. Lead-time case: now = Date.UTC(2026,9,28,4,0); asserts absence of Date.UTC(2026,9,28,5,0); asserts all slots > now + 24h.
4. New case 'every human-for-hire slot is 22:00 Pacific on Tue, Wed or Thu' covers NOW and Date.UTC(2027,5,1); checks weekday, hour 22, minute 00, duration 3600000.
5. docs/commerce.md:61 reads "Tue/Wed/Thu 22:00 Pacific"; diff is that one line; `grep 18:30` finds nothing in the doc or config.
6. One commit with the exact subject; the three named route tests pass with no edits to them (not in the commit's file list).

Gate re-run:
- `pnpm vitest run` (6 files): 6 passed, 54 tests passed.
- `pnpm typecheck`: exit 0.

Base..HEAD also includes other jobs' commits (host-kit, registry, catalog, a sweep record); they are outside this PRD and not reviewed here. /code-review and /security-review were not run as separate tools; self-reviewed the 3-file diff: no input handling, secrets, or path changes; no helper duplication.

## Findings

- Critical: none.
- Important: none.
- Minor: none. (Commit author is the repo's standing Bilko identity, consistent with the identity boundary.)
