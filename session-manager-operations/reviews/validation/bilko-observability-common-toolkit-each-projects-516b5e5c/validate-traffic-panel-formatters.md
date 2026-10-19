# Validation: traffic-panel-shared-formatters

Base: e896d46b (HEAD 837d52ad). Closes the Important finding in validate-observability-cleanup.md.

## traffic-panel-shared-formatters — VERIFIED (intent met; literal ACs obsolete)

PRD files: `prds-archived/1400-traffic-panel-shared-formatters.md` (original) and `prds-archived/1400-fix-traffic-panel-shared-formatters.md` (fix plan that superseded it).

Commits: `git log e896d46b..HEAD` shows 59910d9d (rename in `AudienceModule.tsx`, 3 insertions / 3 deletions, only that file) merged by 837d52ad. No diff to `src/lib/format.ts` since base.

Evidence:
- Original AC 1-3 (add `fmtTimeZoned`, TrafficPanel imports it): not met literally and not needed. `src/pages/admin/TrafficPanel.tsx` no longer exists (removed by c7fd3217), and `rg fmtTimeZoned|TrafficPanel src server` finds nothing. The shared `fmtTime` in `src/lib/format.ts:10` already carries the zone abbreviation, so a zoned variant would only duplicate it.
- Invariant (my PRD's AC): `rg '(const|function) (fmtTime|shortId|fmtMmSs)\b' src server | grep -v '^src/lib/format.ts:'` printed nothing (clean). Definitions exist only at `src/lib/format.ts:10` (`fmtTime`), `:14` (`shortId`), `:17` (`fmtMmSs`).
- The leftover local `shortId` in `AudienceModule.tsx` is now `idPrefix` (`AudienceModule.tsx:47`). Its body is `id.length > 8 ? id.slice(0, 8) : id`, unchanged. Both call sites (`:107`, `:150`) use `idPrefix`. It is not a duplicate of the shared `shortId` (threshold 10, appends an ellipsis), so rename rather than replace was correct and rendered text is unchanged.
- Gate: the original PRD's gate (`pnpm typecheck` and vite build) was re-run. Typecheck passed (client, server, scripts) and the vite build printed "built in 5.51s".

## Findings

Critical: none.

Important: none.

Minor:
- The original PRD 1400-traffic-panel-shared-formatters.md is stale. Its ACs reference a deleted file and a helper that was deliberately not added. Anyone who reads it alone will think `fmtTimeZoned` should exist; the fix PRD documents why it does not.
- The code review covered a 3-line identifier rename and found nothing. No input handling, secrets or paths are touched. I self-reviewed rather than running `/code-review` or `/security-review`.
