---
title: Cleanup: host src/lib/telemetry.ts — one send helper, constants, drop unused trackScreen
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 8
createdVia: scheduler-api
issuedAt: 2026-10-19T02:42:33.091Z
sourcePromptId: bilko-observability-common-toolkit-each-projects-516b5e5c
agentType: dev-lead
disposition: new-head
planId: pl-mvenfpj7-94f4a9
---
# Goal

minimalism: src/lib/telemetry.ts writes the sendBeacon-else-fetch transport out twice. It mixes an API base constant with a hard-coded TELEMETRY_URL, types 'bilko_vid' out literally instead of using its own constant, and exports trackScreen, which nothing in the host uses because every host screen has its own URL. Shrink it to one transport helper and consistent constants, keeping track() and trackFlow() behavior identical.

# Acceptance criteria

- [ ] src/lib/telemetry.ts has one internal send(url: string, body: string) helper (sendBeacon with a Blob, else fetch with keepalive and swallowed errors), used by both track() and trackFlow().
- [ ] Both endpoints derive from the same API base constant (`${API}/analytics/event` and `${API}/telemetry/event`). The cookie names come from the VID/SID constants, with no stray 'bilko_vid' literals: rg -c "'bilko_vid'" src/lib/telemetry.ts prints at most 1.
- [ ] trackScreen is deleted, and getOrCreateVisitorId/getOrCreateSessionId are no longer exported unless some src/ file imports them (check with rg).
- [ ] tests/host-track-flow.test.ts drops its trackScreen case and keeps every trackFlow case passing unchanged. track() and trackFlow() payloads are byte-identical to before.
- [ ] pnpm typecheck and a vite build pass.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- src/lib/telemetry.ts
- tests/host-track-flow.test.ts

# Implementation notes

Read first: src/lib/telemetry.ts (whole file, ~134 lines); tests/host-track-flow.test.ts.

Keep this module separate from host-kit on purpose. The host SPA must not post to production from localhost, and must not install host-kit's global error handlers.

Do not touch: page components (PRD cleanup-click-tagging edits them after this lands).

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/host-track-flow.test.ts tests/open-core-positioning.test.ts
timeout 300 pnpm typecheck && timeout 300 pnpm exec vite build --outDir /tmp/bilko-gate-build-telclean --emptyOutDir
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
