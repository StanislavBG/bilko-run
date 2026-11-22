# Project feedback API (host side)

The host's contract for project feedback: what `server/routes/project-feedback.ts`
implements, for sibling repos that consume it, so a sibling session doesn't have to read
the route source. Where a sibling's own notes disagree with this file, this file and the
route win.

Storage: table `project_feedback`, plus `project_feedback_images` for screenshots 2–5
(Turso; local SQLite in dev). Screenshot 1 stays in `project_feedback.image_data`.

## Owner credentials

`GET`, `moderate` and `status` take either bearer. Use the narrower one unless the
caller also posts snapshots or events.

| Bearer | Opens |
| --- | --- |
| The project's own token in `PROJECT_FEEDBACK_TOKENS` | those three routes for that one slug, and nothing else: another slug, a snapshot write and an event write all return `401` |
| `PROJECT_SNAPSHOT_TOKEN` | those three routes for every slug, plus snapshot and event writes for every slug |

`PROJECT_FEEDBACK_TOKENS` is a comma-separated list of `slug:token` pairs. Holders and
rotation steps are in [`secrets-rotation.md`](secrets-rotation.md). With no bearer that
could open the route, it returns `503`.

## `POST /api/projects/:slug/feedback` — public

Unauthenticated by design (any visitor to a public page may file feedback), so the
server-side hygiene is load-bearing: 10 MiB body cap, 10 submissions/min/IP, strict
field validation. Text is stored raw and never rendered by this server — anything
that displays it must escape it.

Body:

| Field | Required | Notes |
| --- | --- | --- |
| `target.kind` | yes | one of `component`, `position`, `trade`, `page` |
| `target.id` | yes | ≤ 200 chars |
| `target.label` | no | ≤ 200 chars |
| `type` | yes | one of `bug`, `feature`, `feedback` |
| `title` | yes | ≤ 120 chars |
| `description` | yes | ≤ 4 000 chars |
| `route` | no | ≤ 200 chars |
| `images` | no | 1–5 `{ dataUrl, mime? }`, in order. Each `dataUrl` is base64 `data:image/(png\|jpeg\|webp\|gif)`, ≤ 2,000,000 chars; all together ≤ 8,000,000 chars |
| `image.dataUrl` | no | legacy single screenshot, same rules; read only when `images` is absent, `null` or empty |
| `client` | no | arbitrary object, JSON-stringified and truncated to 4 000 chars |
| `snapshotGeneratedAt` | no | string |
| `parentId` | no | **opaque threading pointer, ≤ 200 chars** |

Screenshot refusals store nothing: more than 5 entries, a non-array `images`, or an
entry without a valid data URL → `400` (the error names the entry, e.g. `images[1]`);
one image over 2,000,000 chars or a total over 8,000,000 → `413`. The stored `mime` is
the type the data URL declares; a client's `mime` is not used.

The route validates field-by-field and does **not** persist unknown keys — anything
not listed above is dropped. `parentId` is the one deliberate exception to
interpretation: it is stored verbatim, echoed back unchanged, never resolved or
validated against an existing row. A dangling value is the reading client's problem.

→ `201 {"id", "parentId", "receivedAt", "receipt", "imageCount"}`. `imageCount` is the
number of screenshots stored (0 when none were sent); a client can treat a missing
`imageCount` as a host that dropped its images. `receipt` is a one-time secret for the
status lookup below. Only its sha256 is stored, so it can't be fetched again.

## `GET /api/projects/:slug/feedback` — owner bearer

Query: `since` (ISO, exclusive `created_at` cursor), `moderatedSince` (ISO, exclusive
`moderation_at` cursor), `limit` (1–1000, default 500), `images` (`none` to omit
image payloads).

**Use `images=none` on moderation-replay pulls.** Screenshots are stored inline as
base64 and run to 2 MB each, so a page of them is three orders of magnitude larger
than the same page without. On a replay pull the caller already has every blob on
disk and only wants the changed flags. `images=none` keeps every `mime` and `bytes`,
nulls every `dataUrl`, and never reads a screenshot out of the database. A submission
carries up to 5 screenshots, so keep `limit` small on pulls that include images.

Each item carries `id`, `receivedAt`, `target`, `route`, `type`, `title`,
`description`, `image`, `images`, `client`, `snapshotGeneratedAt`, plus:

```jsonc
"image": { "dataUrl": "data:image/png;base64,…" | null, "mime": "image/png", "bytes": 123456 } | null,
"images": [ /* every screenshot in submission order, same shape; [] when none */ ],
"parentId": "fb_abc123" | null,
"moderation": { "action": "archived" | "deleted", "at": "<ISO>", "reason": "..." } | null,
"status": { "value": "open" | "in_progress" | "resolved" | "wontfix", "note": "..." | null, "at": "<ISO>" | null }
```

`image` is the first screenshot, for readers that read only `image`, so with images
included its `dataUrl` is sent twice (once in `images[0]`).

`moderation` is `null` when the item has never been moderated or was un-archived /
restored. `status.value` is `open` until someone sets it.

Response also returns `nextSince` and `nextModeratedSince`. **`nextSince` alone is not
enough to stay in sync:** moderation happens long after a row's `created_at`, so a
purely created_at-based cursor never re-surfaces a newly archived item. Replay
`moderatedSince=<nextModeratedSince>` alongside `since` to re-admit already-pulled rows
whose moderation or status changed. `nextSince` never regresses, even on a page made
entirely of re-admitted old rows.

## `POST /api/projects/:slug/feedback/:id/moderate` — owner bearer

```jsonc
{ "action": "archive" | "unarchive" | "delete" | "restore", "reason": "<optional, ≤500>" }
```

→ `200 {"id", "action", "moderatedAt"}` · `400` bad action/reason · `401` bad token ·

`404` unknown id (or id belonging to another slug) · `429` rate-limited.

`delete` is a **hide, not a purge**: the row and its id are kept and only the flag
flips. Hard-deleting would make the item re-arrive as brand-new feedback on the
sibling's next pull (its store dedupes on ids already seen on disk) and resurrect
itself on the published page. `archive` → `moderation.action = "archived"`, `delete`
→ `"deleted"`, `unarchive`/`restore` → `moderation = null`. Moderation is
slug-scoped: an id only resolves under its own slug.

## `POST /api/projects/:slug/feedback/:id/status` — owner bearer

```jsonc
{ "status": "open" | "in_progress" | "resolved" | "wontfix", "note": "<optional, ≤500>" }
```

→ `200 {"id", "status", "note", "statusAt"}` · `400` bad status/note · `401` bad token ·
`404` unknown id (or id belonging to another slug) · `429` rate-limited.

Status is work state and independent of moderation: an archived row can still be
resolved. A change re-surfaces the row through the `moderatedSince` cursor.

## `POST /api/projects/:slug/feedback/status-lookup` — public

```jsonc
{ "items": [{ "id": "fb_abc123", "receipt": "<from the 201>" }] } // 1–100 items
```

→ `200 {"items": [{"id", "status", "note", "statusAt"}]}`

The receipt is the credential. Anything that doesn't match (unknown id, another slug,
wrong receipt, a row filed before receipts existed) is left out without a trace, and
no title, description or client field is ever returned. 10 lookups/min/IP, in a
separate bucket from submissions.

## Measuring what this costs

`GET /api/admin/egress?days=7&limit=25` (admin) reports response bytes per route
pattern, sourced from the `onSend` meter in `server/egress.ts` and the
`api_egress_daily` table. Read `bytesPerRequest`, not just `bytes`: a route can top
the list on volume (cheap and expected) or on payload size (usually a bug — an
unpaginated list, or blobs inlined into JSON). The feedback GET is the one route on
the host that can legitimately return hundreds of megabytes, so watch it here.
