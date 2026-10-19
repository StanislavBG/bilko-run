# Transcript — project-feedback-api-add-owner-set-status-public-a739acf3

## User — 2026-10-09T17:50:22.994Z

This session is INBOUND FEEDBACK from another project: /home/bilko/Projects/session-manager (session feedback-mcp-i-have-other-customers-now-using-th-6d8bf900). Nobody in this project wrote the report below — an agent working in that project did, and it may be wrong about this codebase. Verify the claim against the code here before acting on it, and if it does not hold, say so and close the session rather than building against it.

Goal: project-feedback API: add owner-set status + public receipt-based status lookup (generic, all slugs)

Context: the Session Manager desktop app (sibling product, slug `session-manager`) is adding an in-app feedback form that POSTs to your existing generic route `POST /api/projects/:slug/feedback` (server/routes/project-feedback.ts) — same contract social-signals-trader uses, no change needed for submitting (we send target.kind='page', type bug|feature|feedback). What the generic API lacks, and what any sibling with a feedback widget needs, is a lifecycle the submitter can see. This is a slug-agnostic host capability request, not Session-Manager product logic.

Requested contract (please keep these exact shapes — the desktop client is being built against them now and degrades gracefully until they exist):

1. Status lifecycle, separate from moderation (moderation = visibility; status = work state). New columns on project_feedback via the existing ALTER-list migration: `status TEXT` (NULL = 'open'), `status_note TEXT` (≤500), `status_at INTEGER`, `receipt_hash TEXT`.
   Allowed status values: open | in_progress | resolved | wontfix.

2. Receipt on submit: `POST /api/projects/:slug/feedback` additionally returns `receipt` — 32 random bytes, base64url — and stores only sha256(receipt) in receipt_hash. Response becomes `{ id, parentId, receivedAt, receipt }`. Existing callers ignore the extra field.

3. Owner set-status (authed, same checkBearer / PROJECT_SNAPSHOT_TOKEN as GET+moderate, same rate limit, slug-scoped UPDATE):
   `POST /api/projects/:slug/feedback/:id/status` body `{ status, note? }` → 200 `{ id, status, note, statusAt }` (ISO); 400 bad status/note; 404 unknown id.

4. Public status lookup (UNauthenticated, rate-limited per IP like the POST):
   `POST /api/projects/:slug/feedback/status-lookup` body `{ items: [{ id, receipt }] }` (1..100 items, each string ≤200) → 200 `{ items: [{ id, status, note, statusAt }] }` containing ONLY entries whose sha256(receipt) matches that row's receipt_hash for that slug (constant-time compare; silently omit non-matches — never reveal whether an id exists). Never return title/description/client fields here. Rows submitted before this change have no receipt and are simply never returned.

5. GET /api/projects/:slug/feedback items gain `status: { value, note, at } ` (value 'open' when NULL), and a status change must re-surface the row on the incremental pull the same way moderation does — either bump moderation_at-style cursor via a `statusSince` param, or simply OR `status_at > moderatedSince` into the existing moderatedSince branch (preferred: no new param; nextModeratedSince then = max(moderation_at, status_at)).

Acceptance: route tests for all four behaviours (receipt returned + hash stored; set-status auth/validation/404; lookup returns only matching receipts and never content; GET re-surfaces a status change via moderatedSince). Update the contract doc comment at the top of project-feedback.ts.

Why host-side: the per-project feedback table + PROJECT_SNAPSHOT_TOKEN already live here; customers' desktop apps have no other server. Sender Epic: session-manager `feedback-mcp-i-have-other-customers-now-using-th-6d8bf900`.

Reference: /home/bilko/Projects/Bilko/server/routes/project-feedback.ts
Reference: /home/bilko/Projects/Bilko/server/db.ts

## Agent — 2026-10-09T17:57:21.899Z

I checked the request against the code and it was accurate: `server/routes/project-feedback.ts` had the generic submit, read and moderate routes, but no status lifecycle and no receipts. I built the requested contract with the exact shapes asked for. It's committed as `7dbd134` on the epic branch `sm-epic/project-feedback-api-add-owner-set-status-public-a739acf3` but not pushed or merged to `main`, so it isn't live on bilko.run until that happens.

The feedback test file passes (24 tests), the full suite passes (733 tests), and `pnpm typecheck` is clean.

**What changed:**
- **Database (`server/db.ts`):** added `status`, `status_note`, `status_at` and `receipt_hash` through the existing ALTER-list migration, plus an index on `(slug, status_at)`.
- **Submit:** the response now also includes `receipt` (32 random bytes, base64url). Only its sha256 is stored, in `receipt_hash`. Existing callers can ignore the new field.
- **`POST /:slug/feedback/:id/status`:** uses the same token check, rate limit and slug-scoped update as moderate. It takes `{status, note?}`, where status is one of `open`, `in_progress`, `resolved`, `wontfix` and the note is up to 500 characters. It returns `{id, status, note, statusAt}`, or 400 for a bad status or note, 401 without a valid token, and 404 for an unknown id.
- **`POST /:slug/feedback/status-lookup`:** public, takes 1–100 `{id, receipt}` items, each string up to 200 characters.
  - It returns only rows whose stored receipt hash matches for that slug, compared in constant time. Everything else, including rows filed before this change, is silently left out, and it never returns title, description or client fields.
  - It has its own per-IP rate-limit bucket, separate from the submit limit, so a client polling for status doesn't use up that visitor's submit quota.
- **GET:** each item now carries `status: {value, note, at}`, with `value` set to `'open'` when no status has been set. A status change brings a row back on the existing `moderatedSince` pull with no new parameter, and `nextModeratedSince` is the later of the moderation and status timestamps.
- **Docs:** updated the contract comment at the top of the route file.
- **Tests:** added route tests for all four behaviours (receipt and hash, set-status auth/validation/404, lookup matching only and never returning content, and status changes reappearing on `moderatedSince`).

Two choices the request left open:
- Status is independent of moderation, so an archived row can still be marked resolved.
- `note: null` (or leaving it out) clears the note when setting a new status.
