# Project feedback API (host side)

What `server/routes/project-feedback.ts` actually implements, for sibling repos that
consume it. The cross-project contract is authored in the sibling
(`~/Projects/social-signals-trader/docs/feedback-api-contract.md`); this file records the
host's side of it so a sibling session doesn't have to read the route source.

Storage: table `project_feedback` (Turso; local SQLite in dev).

## `POST /api/projects/:slug/feedback` — public

Unauthenticated by design (any visitor to a public page may file feedback), so the
server-side hygiene is load-bearing: 4 MB body cap, 10 submissions/min/IP, strict
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
| `image.dataUrl` | no | base64 `data:image/(png\|jpeg\|webp\|gif)`, ≤ 2 MB |
| `client` | no | arbitrary object, JSON-stringified and truncated to 4 000 chars |
| `snapshotGeneratedAt` | no | string |
| `parentId` | no | **opaque threading pointer, ≤ 200 chars** |

The route validates field-by-field and does **not** persist unknown keys — anything
not listed above is dropped. `parentId` is the one deliberate exception to
interpretation: it is stored verbatim, echoed back unchanged, never resolved or
validated against an existing row. A dangling value is the reading client's problem.

→ `201 {"id", "parentId", "receivedAt"}`

## `GET /api/projects/:slug/feedback` — `Authorization: Bearer $PROJECT_SNAPSHOT_TOKEN`

Query: `since` (ISO, exclusive `created_at` cursor), `moderatedSince` (ISO, exclusive
`moderation_at` cursor), `limit` (1–1000, default 500).

Each item carries `id`, `receivedAt`, `target`, `route`, `type`, `title`,
`description`, `image`, `client`, `snapshotGeneratedAt`, plus:

```jsonc
"parentId": "fb_abc123" | null,
"moderation": { "action": "archived" | "deleted", "at": "<ISO>", "reason": "..." } | null
```

`moderation` is `null` when the item has never been moderated or was un-archived /
restored.

Response also returns `nextSince` and `nextModeratedSince`. **`nextSince` alone is not
enough to stay in sync:** moderation happens long after a row's `created_at`, so a
purely created_at-based cursor never re-surfaces a newly archived item. Replay
`moderatedSince=<nextModeratedSince>` alongside `since` to re-admit already-pulled rows
whose moderation state changed. `nextSince` never regresses, even on a page made
entirely of re-admitted old rows.

## `POST /api/projects/:slug/feedback/:id/moderate` — same bearer

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
slug-scoped, so a token can't reach another project's rows.
