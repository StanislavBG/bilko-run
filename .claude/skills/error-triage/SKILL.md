---
name: error-triage
description: Triage bilko.run production errors — pull grouped app_errors through the bilko-host MCP, decide which are real bugs, map each to the repo that owns the app, and dispatch it. Use for "triage errors", "observability errors", "what are the errors on bilko.run", "/error-triage". NOT for fixing the bugs (the owning project does that).
---

# Error triage — pull, judge, route

Errors are already collected into `app_errors`. This skill turns them into work items in the right
project. Dispatch is the default action: never ask for confirmation before routing. Never edit a
sibling repo directly — hand it off.

Ledger: `.claude/skills/error-triage/ledger.md` (table: signature, app, routed-to, date, count).

## Procedure

1. **Fetch.** Call `mcp__bilko-host__errors_report` with `days: 1`, `env: "prod"` (widen `days` only if
   the user asks). Groups carry `app`, `signature`, `name`, `count`, `firstSeen`, `lastSeen`,
   `versions`, `sampleUrl`, `sampleId`.
2. **Guard.** If the result's top-level `database` is `local`, STOP. Say: "errors_report read the local
   dev DB, not bilko.run. Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in the bilko-host MCP env in
   ~/.claude.json, restart the session, and re-run." Do nothing else.
3. **Classify** each group:
   - **noise** — browser extensions (`chrome-extension://`, `moz-extension://`), bots/crawlers,
     `ResizeObserver loop`, network aborts (`AbortError`, `Failed to fetch` on navigation,
     `NetworkError`), scripts from third-party origins.
   - **real-bug** — first-party code throws (our `/assets`, `/projects/<slug>/assets`, or `server/`
     paths), reproducible signature, or a count/version pattern that points at a release.
   - **needs-more-data** — can't tell from signature and sample; note what's missing.
4. **Detail.** For every real-bug, call `mcp__bilko-host__error_detail` with `id: sampleId`. Read the
   stack and URL before deciding the owner. (Re-check `database` is not `local` here too.)
5. **Own.** Look up the group's `app` in `src/data/standalone-projects.json` (or
   `mcp__bilko-host__get_project`).
   - `host.localPath` outside this repo → owner is that sibling project.
   - Host code (Session Manager relay, Academy gateway, Git Viewer routes, `server/`, `src/` chrome)
     or no registry match → owner is this repo.
   - **Gateway-pattern AI tools** (stack-audit, launch-grader, ad-scorer, headline-grader,
     thread-grader, email-forge, audience-decoder, page-roast) can fail in either place. Decide from
     frames: host server stacks name `server/` paths (owner: this repo, `server/routes/tools/<slug>.ts`);
     browser stacks name `/projects/<slug>/assets` (owner: the sibling).
6. **Dedup.** Read the ledger. Skip a signature already present for that app unless its count grew by
   10 or more since that row, or `versions` contains a version not seen before (note versions in the
   ledger's routed-to cell or re-check via error_detail). Skipped rows are reported as `already-routed`.
7. **Dispatch** (no confirmation):
   - Sibling owner → use the `session-manager-dev:send-feedback` skill (`feedback_open_session`) aimed
     at that project. Include: signature, count, first and last seen, versions, sample URL, and the
     stack from error_detail. State the suspected cause and that it is a production error on bilko.run.
   - This repo → queue via `/develop` with the same facts as the PRD context.
8. **Ledger.** Append one row per dispatched group: signature | app | routed-to (project, or `bilko`)
   | date (YYYY-MM-DD) | count. Update by adding a new row, never delete old ones.
9. **Report.** End with a short table:

   | app | signature | count | verdict | routed-to |
   |---|---|---|---|---|

   Verdict is real-bug, noise, needs-more-data, or already-routed; routed-to is `-` when nothing was sent.
