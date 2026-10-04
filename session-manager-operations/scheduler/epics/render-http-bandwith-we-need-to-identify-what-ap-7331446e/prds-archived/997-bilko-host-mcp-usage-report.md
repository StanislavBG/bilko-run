---
title: Expose platform usage/egress centrally via the bilko-host MCP (no browser, no Clerk)
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 50
createdVia: scheduler-api
issuedAt: 2026-08-13T22:27:02.916Z
sourcePromptId: render-http-bandwith-we-need-to-identify-what-ap-7331446e
dependsOn: [996-fix-projects-404-crash-loop]
---
# Goal

Bilko is a host platform, so central usage monitoring should be a platform capability — readable by whoever operates the platform, not only by a human clicking through a browser session. Today the only way to read per-project egress is GET /api/admin/egress or /admin/observability, both gated on a Clerk JWT that exists only inside a signed-in browser. That makes the platform's own usage data unreachable to any agent, script, cron, or headless session — including the ones that maintain the platform. Add a usage report tool to the bilko-host MCP, which already holds a direct Turso client and is the established control plane for host operations.

# Acceptance criteria

- [ ] A new bilko-host MCP tool (suggested name `usage_report`) returns per-project egress: for each project slug, bytes out and request count over a caller-specified trailing window (default 7 days), sorted by bytes descending, including bytesPerRequest.
- [ ] The tool reads api_egress_daily through the existing Turso client in mcp-host-server/src/db.ts — it does NOT call the host's HTTP API and therefore does NOT require a Clerk JWT.
- [ ] Output distinguishes the static:<slug> buckets from the /api/* route rows, and explicitly surfaces static:_host and static:_other rather than hiding them, since _host currently absorbs top-level static dirs (/outdoor-hours/, /apps/, /session-manager-operations/) that belong to real projects.
- [ ] The tool reports the window it actually covered and the earliest date present in the table, so a caller can tell "no traffic" apart from "metering only started on <date>".
- [ ] Running the tool against the local dev DB with no rows returns a clean empty result with that explanation, not an error or a bare [].
- [ ] README/tool description states plainly that these are capacity-signal numbers measured at the origin, not Render billing figures, and that they will under-report by up to the flush interval on every process restart.
- [ ] mcp-host-server builds and its existing tools are unaffected.

# Implementation notes

The control plane already exists — this is one tool, not an architecture change.

- mcp-host-server/src/server.ts registers tools via server.registerTool(...); see `list_projects` at line ~175 and `publish_static_project` at ~313 for the established shape (zod inputSchema, ok()/err() helpers).
- mcp-host-server/src/db.ts:14-16 already builds a libsql client from TURSO_DATABASE_URL / TURSO_AUTH_TOKEN, falling back to the local data/contentgrade.db file. Reuse it. This is exactly why the MCP can read production without touching Clerk.
- The query shape to reuse is server/egress.ts topEgress() (lines 171-183) — SUM(requests), SUM(bytes) grouped by route over `date >= ?`, plus the bytesPerRequest derivation. Do not duplicate the SQL by hand if it can be shared; if sharing across the two packages is awkward, copy it with a comment pointing at the original.
- Slug convention: static rows are stored with route = `static:<slug>` (server/egress.ts:92,147). `static:_host` = host chrome and any top-level static dir; `static:_other` = unrecognised slug, cardinality-bounded.

KNOWN ACCURACY GAP worth surfacing in the tool output rather than silently inheriting: only /projects/<slug>/ paths bucket to a named slug. OutdoorHours serves its ~168 MB data tree from top-level /outdoor-hours/, so those bytes land in static:_host, not static:outdoor-hours. Same for /apps/ and /session-manager-operations/. A follow-up PRD should map known top-level static dirs to their owning slug; for now the tool should not present _host as if it were purely host chrome.

Depends on 996 (the crash-loop fix): while the service restarts every few minutes the in-process egress buffer is dropped on each restart, so any report built now reads low and would be misleading.

# Out of scope

- Adding a non-Clerk auth path to the host's HTTP API — the MCP's direct DB access is the right seam, and punching an API-key hole in requireAdmin is a security change nobody asked for.
- Reconciling these numbers against Render's billing figures.
- Fixing the top-level-static-dir attribution gap — note it in the output, fix it in a follow-up.

## Engineering standards

Before writing any code, read `/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` — it has the Performance, Debugging,
API-reuse, TDD, and Execution-discipline rules that apply to this PRD. Every rule in it is
mandatory, especially Execution discipline (bounded commands, verify before done, the
finish-protocol sentinel).
