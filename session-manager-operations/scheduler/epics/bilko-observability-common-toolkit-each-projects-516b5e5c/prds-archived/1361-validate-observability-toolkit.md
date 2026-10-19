---
title: Validate: Bilko-wide session observability toolkit (shared session id, auto-capture, SDK, Sessions/Flows dashboard, adoption guide)
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
sourcePromptId: bilko-observability-common-toolkit-each-projects-516b5e5c
tag: build
agentType: validator
createdVia: scheduler-api
issuedAt: 2026-10-18T18:32:02.243Z
dependsOn: [session-identity-cookie, host-kit-shared-session-sdk, telemetry-ingest-cookie-session, session-columns-page-hits, beacon-session-and-navigation, privacy-cookie-disclosure, analytics-ingest-session-ids, remove-usepageview-pageviews, admin-sessions-api, admin-flows-api, admin-sessions-panel, admin-flows-panel, observability-adoption-doc, host-trackflow-helper, tag-session-manager-landing, tag-host-core-pages, tag-host-content-pages]
planId: pl-mve5lxlp-756161
---
# Goal

validate: verify the plan that gives bilko.run one session identity and a common observability toolkit. PRDs:
- session-identity-cookie (shared bilko_vid/bilko_sid cookies)
- host-kit-shared-session-sdk (SDK cookie ids, same-origin endpoint, trackFlow)
- telemetry-ingest-cookie-session (telemetry ingest joins the cookie session)
- session-columns-page-hits (session columns and page-hit ids)
- beacon-session-and-navigation (beacon ids, SPA pageviews, data-track, PII scrub)
- privacy-cookie-disclosure (privacy page)
- analytics-ingest-session-ids (click/pageview ingest, cookie-first)
- remove-usepageview-pageviews (retire the React pageview hook)
- admin-sessions-api (session list and timeline API)
- admin-flows-api (app health and flow funnels API)
- admin-sessions-panel (Sessions UI)
- admin-flows-panel (Flows UI)
- observability-adoption-doc (adoption guide)
- host-trackflow-helper (host SPA trackFlow/trackScreen)
- tag-session-manager-landing (downloads, tip and film tagging)
- tag-host-core-pages (layout, home, projects and pricing tagging)
- tag-host-content-pages (blog, manual, contact and project-detail tagging)

# Acceptance criteria

- [ ] session-identity-cookie: the PRD file under $SM_PROJECT_ROOT/session-manager-operations/scheduler/epics/bilko-observability-common-toolkit-each-projects-516b5e5c/prds/ (or prds-archived/), found by slug, is VERIFIED against its criteria. This includes that no /api/* or non-200 response sets cookies and that malformed cookie values are never echoed.
- [ ] host-kit-shared-session-sdk: the PRD file under the same Epic prds/ or prds-archived/ folder, found by slug, is VERIFIED.
- [ ] telemetry-ingest-cookie-session: the PRD file under the same Epic prds/ or prds-archived/ folder, found by slug, is VERIFIED.
- [ ] session-columns-page-hits: the PRD file under the same Epic prds/ or prds-archived/ folder, found by slug, is VERIFIED.
- [ ] beacon-session-and-navigation: the PRD file under the same Epic prds/ or prds-archived/ folder, found by slug, is VERIFIED. This includes that the history wrappers never break navigation.
- [ ] privacy-cookie-disclosure: the PRD file under the same Epic prds/ or prds-archived/ folder, found by slug, is VERIFIED.
- [ ] analytics-ingest-session-ids: the PRD file under the same Epic prds/ or prds-archived/ folder, found by slug, is VERIFIED.
- [ ] remove-usepageview-pageviews: the PRD file under the same Epic prds/ or prds-archived/ folder, found by slug, is VERIFIED, with no remaining client POST to /analytics/pageview outside BEACON_JS.
- [ ] admin-sessions-api: the PRD file under the same Epic prds/ or prds-archived/ folder, found by slug, is VERIFIED. This includes requireAdmin on every route and parameterized SQL.
- [ ] admin-flows-api: the PRD file under the same Epic prds/ or prds-archived/ folder, found by slug, is VERIFIED.
- [ ] admin-sessions-panel: the PRD file under the same Epic prds/ or prds-archived/ folder, found by slug, is VERIFIED.
- [ ] admin-flows-panel: the PRD file under the same Epic prds/ or prds-archived/ folder, found by slug, is VERIFIED.
- [ ] observability-adoption-doc: the PRD file under the same Epic prds/ or prds-archived/ folder, found by slug, is VERIFIED. Doc claims, including the (9) Tagging taxonomy, match the landed code.
- [ ] host-trackflow-helper: the PRD file under the same Epic prds/ or prds-archived/ folder, found by slug, is VERIFIED. Its payload shape matches host-kit trackFlow and the /api/telemetry/event handler.
- [ ] tag-session-manager-landing: the PRD file under the same Epic prds/ or prds-archived/ folder, found by slug, is VERIFIED. Download and tip buttons are tagged, and no handler calls preventDefault or changes behavior.
- [ ] tag-host-core-pages: the PRD file under the same Epic prds/ or prds-archived/ folder, found by slug, is VERIFIED. The pricing checkout flow steps are present and checkout behavior is unchanged.
- [ ] tag-host-content-pages: the PRD file under the same Epic prds/ or prds-archived/ folder, found by slug, is VERIFIED. No contact form values reach props.
- [ ] Combined: the full pnpm vitest run and pnpm typecheck are green on the final tree.
- [ ] Write and commit session-manager-operations/reviews/validation/bilko-observability-common-toolkit-each-projects-516b5e5c/validate-observability-toolkit.md.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- session-manager-operations/reviews/validation/bilko-observability-common-toolkit-each-projects-516b5e5c/validate-observability-toolkit.md

# Implementation notes

Work as the validator persona — the procedure is your system prompt.
Base: cbe9161d1f46ee2899dcaea5dd14b9db509cdeef

# Out of scope

- Sibling-repo tagging work (delivered to those repos as proposals; not part of this plan)

# Gate

This PRD has no runnable check. Check each acceptance criterion by reading the files.

```gate
none
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
