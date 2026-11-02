# Validation: free-hour plan

Base `8158c598` (from the PRD). 7 commits `8158c59..HEAD`, subjects match the PRDs. Gates re-run in the foreground in this worktree:
`pnpm test` 169 files passed, 1879 tests passed, 20 skipped; `pnpm typecheck` exit 0; `vite build` ok and `dist/index.html` contains `bilko-prerender`; `pnpm identity:scan` clean; `playwright test e2e/bilko-profile.spec.ts` 3 passed (port 3002 was free).

## free-hour-claim — VERIFIED
- shared/service-slots.ts: `durationMinutes` 30 -> 60, other fields untouched (diff).
- server/db-schema.ts:620 unique partial index `idx_service_bookings_free_hour_email` ... `WHERE slug = 'free-hour'`, `IF NOT EXISTS` so it applies to existing tables.
- server/services/service-bookings.ts:144-214 exports FREE_HOUR_SLUG, claimFreeHour (on claimQueue, trim+lowercase, existing check -> already_booked, UNIQUE -> hasFreeHour decides), hasFreeHour, cancelFreeHour (token + slug + future, delete by id, null otherwise).
- Tests in tests/service-bookings-store.test.ts (+48 lines) pass; 30-minute pins updated to 60. CLAUDE.md bullet present (line 154). Commit subject exact.

## free-hour-route — VERIFIED
- server/routes/free-hour.ts: validation -> 400 (l.39-45); `if (!mailerConfigured()) return 503` (l.47) precedes slot lookup, dryRun and `claimFreeHour`, so no path writes a row when mail is unset. mailerConfigured needs RESEND_API_KEY, MAIL_FROM and BILKO_INBOX (mailer.ts:36).
- No import of Clerk, requireAuth or Stripe in the file; token `free_`+randomUUID (l.63); 201 body matches; 409 slot_unavailable/already_booked; dryRun writes nothing; rate limit 6/h and cancel 10/min; cancel regex 400, 404, 200 with owner notice in try/catch.
- Mail failure after claim keeps booking, `emailed` stays false, ics returned (l.97-109). EMAIL_RE/organizerEmail moved to mailer.ts. tests/free-hour-routes.test.ts passes. docs/host-contract.md updated (+6/-... lines).

## bilko-profile-copy — VERIFIED
- Throwaway script (tsx) compared tags-stripped, whitespace-collapsed TOP+BOTTOM with `<main>`..`</footer>` of /home/bilko/Self/self/personas/bilko/profile.html: `equal true`, 2014 chars each.
- shared/bilko-profile.ts: no `<script`, no inline handlers, no "Preview" (grep count 0); ids `free-hour`, `built` and `data-track="hire-hero-book"` present. bilko-profile.css imported from src/index.css; tests/bilko-profile-copy.test.ts passes.

## bilko-profile-served — VERIFIED
- index.html:32 carries both markers; server/bilko-profile-routes.ts swaps them, logs and returns the shell unchanged if missing; routes /bilko, /hire, /human-for-hire return the html with `private, no-store`; 301 redirects keep only the query string on a fixed `/bilko` path (no host control). Registered after registerProjectsHubRoutes (server/index.ts:309).
- og-meta.ts: three paths with canonical `https://bilko.run/bilko` via `url` override; sitemap lists /bilko. Tests pass; vite build contains the marker.

## bilko-profile-page — VERIFIED
- src/App.tsx: eager import with comment, three routes; BilkoProfilePage uses useDocumentTitle(BILKO_PROFILE_TITLE) and TOP / widget / BOTTOM.
- FreeHourBooking.tsx: aria-pressed slot buttons, honeypot with tabIndex -1 and aria-hidden, textarea maxLength 2000, submit disabled until time and email, no auth header, exact refusal texts (l.114-131), Blob ics download, cancel button, trackFlow calls without email/topic.
- e2e/bilko-profile.spec.ts exists; 3 passed.

## hire-discoverable — VERIFIED
- Ran `buildCatalog()` from src/data/projectCatalog.ts: human-for-hire `url=https://bilko.run/bilko`, `pricing=freemium`. Entry is external-url, no localPath.
- portfolio.ts has `hire` section with path /bilko; HomePage has Link to /bilko with `data-track="home-hire"`; signin-capture maps the three new paths. Tests and nav e2e edits present.

## admin-bookings — VERIFIED
- server/routes/admin-bookings.ts: requireAdmin, days clamp 1..365 default 7, owner list (ADMIN_EMAILS, bilko@bilko.run, BILKO_INBOX) lowercased as `?` params, cs_test_ and checkout_start is_admin exclusions, paid = cents / 10000, mailer_configured.
- `upcoming` maps to slug/startMs/endMs/email/topic/createdAt only; `checkout_session_id` is never emitted (l.55-62). tests/admin-bookings.test.ts passes with real initDb rows.

## Identity
- `pnpm identity:scan` clean. Commit author is `Bilko <bilko@bilko.run>`. Hits for BilkoBibitkov2000@gmail.com are Bilko's persona address (owner ruling cited in PRD 1564) in shared/bilko-profile.ts and tests/e2e; no owner real name or `stanislavbg` address in the diff.

## Findings
### Critical
- none
### Important
- none
### Minor
- server/routes/free-hour.ts:97-109 — the owner notice shares one try/catch with the booker confirmation; if the booker's sendMail throws, the owner notice is skipped. The PRD specified this shape; consider separate try blocks.
- server/routes/free-hour.ts:103 — `process.env.BILKO_INBOX!` is safe only because mailerConfigured() guards earlier; fine today.
- The dryRun branch reveals whether an email already holds a free hour (enumeration), bounded by the 6/h IP limit; accepted by spec.
- Plan PRDs 1570/1573/1576 are still queued and out of this validation's scope.
