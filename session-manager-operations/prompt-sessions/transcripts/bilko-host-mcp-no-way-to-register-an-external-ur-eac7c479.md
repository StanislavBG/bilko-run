# Transcript — bilko-host-mcp-no-way-to-register-an-external-ur-eac7c479

## User — 2026-10-13T23:03:34.603Z

This session is INBOUND FEEDBACK from another project: family-frame (/home/bilko/Projects/family-frame, session bilko-run-project-mcp-i-think-we-need-to-list-fa-ee698bf1). It was raised while working on: Bilko.run - Project MCP  I think we need to list Family Frame on Bilko.run, see how to get a project-card via the MCP and publish our project!   The Project-Card will simply redirect to existing hosted URL. Nobody in this project wrote the report below — an agent working in that project did, and it may be wrong about this codebase. Verify the claim against the code here before acting on it, and if it does not hold, say so and close the session rather than building against it.

Goal: bilko-host MCP: no way to register an external-url app; list family-frame publicly once published

## Why
The owner wants Family Frame (a full-stack Express + Firebase app hosted at https://family-frame.replit.app) listed on bilko.run with a card that simply sends visitors to that hosted URL. The bilko-host MCP only offers register_static_project, so a sibling repo cannot register an external-url entry itself, even though the registry schema, the listing patch (`url` on external-url entries) and existing entries like `sigma` (also a replit.app URL) already support that kind. As a workaround Family Frame registered `family-frame` as static-path (pushed 5157ce0) and is building a tiny redirect bundle to publish there. Two asks: (1) a register_external_project tool so hosted-elsewhere apps don't need a redirect bundle; (2) once the family-frame bundle is published, set `public: true` so the card shows on /projects.

## Proposed plan
1. Add a `register_external_project` tool to mcp-host-server/src/server.ts mirroring register_static_project (same ownership binding via callerRepoPath, same field limits) but writing host.kind external-url with a required https:// `url`.
2. Cover it in the MCP's tests (https-only url, slug uniqueness, one slug per repo binding) and document it in docs/host-contract.md's sibling-session checklist.
3. Decide whether to offer an owner-side conversion of an existing static-path slug (e.g. family-frame) to external-url, or keep family-frame as a static-path redirect page.
4. After https://bilko.run/projects/family-frame/ serves the published redirect bundle, set `public: true` on the family-frame registry entry in a Bilko session.

## Acceptance criteria
- [ ] A sibling session can register an external-url project through the bilko-host MCP without hand-editing src/data/standalone-projects.json.
- [ ] Non-https urls and already-bound repos are refused with a clear error.
- [ ] family-frame appears on https://bilko.run/projects and in GET https://bilko.run/api/projects once its bundle is live.

## Details
Evidence: mcp-host-server/src/contract/registry.ts accepts `kind: 'external-url'` and validates https; mcp-host-server/src/listing-patch.ts allows `url` only on external-url entries; but server.ts exposes no registration path for that kind. Registry entries `sigma`, `bglabs`, `bilko-flow`, `signal-builder`, `bilko-host` are external-url and appear to have been hand-added. family-frame registration result: `registered: family-frame → /projects/family-frame/ (admin-only until the Bilko owner lists it)`, pushed 5157ce01a667339e4306d8362f8daac6b5cf6524, bound to ~/Projects/family-frame. Family Frame's redirect bundle (index.html with meta refresh to https://family-frame.replit.app/ plus manifest.json) is being built in ~/Projects/family-frame (npm run bilko:build -> bilko-dist/), with tests/golden.spec.ts for the golden gate. Side note for the publish gates: the audit gate runs `pnpm audit`, which cannot run in npm-only repos (no pnpm-lock.yaml), so npm siblings must bypass it; consider falling back to `npm audit --omit=dev` when package-lock.json is present.

Reference: /home/bilko/Projects/Bilko/mcp-host-server/src/server.ts
Reference: /home/bilko/Projects/Bilko/mcp-host-server/src/contract/registry.ts
Reference: /home/bilko/Projects/Bilko/mcp-host-server/src/gates

## Agent — 2026-10-13T23:11:52.915Z

Family Frame is now listed on bilko.run. Its card links straight to https://family-frame.replit.app, so the redirect bundle isn't needed. I checked the report against the code first and it was right: the registry schema already supported apps hosted elsewhere, but the MCP had no tool to register one, and the audit gate only ran `pnpm audit`.

Everything is pushed to `origin/main` in two commits. The full test suite (1162 tests) and typecheck passed before pushing.

- **New MCP tool (`9008392`):** `register_external_project` lets a sibling repo register an app hosted on its own domain, with the same ownership and admin-only rules as `register_static_project`.
  - It refuses non-https URLs, slugs that are already taken, and repos already linked to another slug, with a clear error each time.
  - `publish_static_project` now refuses these entries, since they have no bundle to publish.
  - Tests and both docs (`docs/host-contract.md`, `mcp-host-server/README.md`) are updated, and `dist/` is rebuilt.
- **Audit gate fix (same commit):** in npm-only repos (a `package-lock.json` and no `pnpm-lock.yaml`) it now runs `npm audit --omit=dev --audit-level=high --json`, so those repos no longer have to bypass it. Tests are added.
- **Family Frame entry (`937bffe`):** I chose to convert `family-frame` in the registry to point at its own URL instead of keeping the redirect page, and set `public: true`. Its repo still owns the card. I updated the test that pins the list of public cards to include it.
- **Live check:** `GET https://bilko.run/api/projects` returned `family-frame` with the right URL at 4:11 PM PDT. Its card goes on /projects through the same public list.

I sent the family-frame project a proposed session (it waits for someone there to approve it) telling it to drop the redirect bundle and not publish. Card edits from there go through `update_project_listing`.

**Warning:** your local `~/Projects/Bilko` checkout is out of sync with GitHub (7 local commits, 6 remote ones; most look like the same work with different hashes). The local bilko-host MCP runs from that checkout, so other repos won't see the new tool until it's synced. I didn't touch it because another session's work may be in it.

## User — 2026-10-13T23:11:52.924Z

This session is INBOUND FEEDBACK from another project: family-frame (/home/bilko/Projects/family-frame, session bilko-run-project-mcp-i-think-we-need-to-list-fa-ee698bf1). It was raised while working on: Bilko.run - Project MCP  I think we need to list Family Frame on Bilko.run, see how to get a project-card via the MCP and publish our project!   The Project-Card will simply redirect to existing hosted URL. Nobody in this project wrote the report below — an agent working in that project did, and it may be wrong about this codebase. Verify the claim against the code here before acting on it, and if it does not hold, say so and close the session rather than building against it.

Goal: bilko-host MCP: no way to register an external-url app; list family-frame publicly once published

## Why
The owner wants Family Frame (a full-stack Express + Firebase app hosted at https://family-frame.replit.app) listed on bilko.run with a card that simply sends visitors to that hosted URL. The bilko-host MCP only offers register_static_project, so a sibling repo cannot register an external-url entry itself, even though the registry schema, the listing patch (`url` on external-url entries) and existing entries like `sigma` (also a replit.app URL) already support that kind. As a workaround Family Frame registered `family-frame` as static-path (pushed 5157ce0) and is building a tiny redirect bundle to publish there. Two asks: (1) a register_external_project tool so hosted-elsewhere apps don't need a redirect bundle; (2) once the family-frame bundle is published, set `public: true` so the card shows on /projects.

## Proposed plan
1. Add a `register_external_project` tool to mcp-host-server/src/server.ts mirroring register_static_project (same ownership binding via callerRepoPath, same field limits) but writing host.kind external-url with a required https:// `url`.
2. Cover it in the MCP's tests (https-only url, slug uniqueness, one slug per repo binding) and document it in docs/host-contract.md's sibling-session checklist.
3. Decide whether to offer an owner-side conversion of an existing static-path slug (e.g. family-frame) to external-url, or keep family-frame as a static-path redirect page.
4. After https://bilko.run/projects/family-frame/ serves the published redirect bundle, set `public: true` on the family-frame registry entry in a Bilko session.

## Acceptance criteria
- [ ] A sibling session can register an external-url project through the bilko-host MCP without hand-editing src/data/standalone-projects.json.
- [ ] Non-https urls and already-bound repos are refused with a clear error.
- [ ] family-frame appears on https://bilko.run/projects and in GET https://bilko.run/api/projects once its bundle is live.

## Details
Evidence: mcp-host-server/src/contract/registry.ts accepts `kind: 'external-url'` and validates https; mcp-host-server/src/listing-patch.ts allows `url` only on external-url entries; but server.ts exposes no registration path for that kind. Registry entries `sigma`, `bglabs`, `bilko-flow`, `signal-builder`, `bilko-host` are external-url and appear to have been hand-added. family-frame registration result: `registered: family-frame → /projects/family-frame/ (admin-only until the Bilko owner lists it)`, pushed 5157ce01a667339e4306d8362f8daac6b5cf6524, bound to ~/Projects/family-frame. Family Frame's redirect bundle (index.html with meta refresh to https://family-frame.replit.app/ plus manifest.json) is being built in ~/Projects/family-frame (npm run bilko:build -> bilko-dist/), with tests/golden.spec.ts for the golden gate. Side note for the publish gates: the audit gate runs `pnpm audit`, which cannot run in npm-only repos (no pnpm-lock.yaml), so npm siblings must bypass it; consider falling back to `npm audit --omit=dev` when package-lock.json is present.

Reference: /home/bilko/Projects/Bilko/mcp-host-server/src/server.ts
Reference: /home/bilko/Projects/Bilko/mcp-host-server/src/contract/registry.ts
Reference: /home/bilko/Projects/Bilko/mcp-host-server/src/gates

## Agent — 2026-10-13T23:13:54.608Z

This is the same report as before, and all of it is already done and still in place. I checked again just now:

- **New tool:** `register_external_project` is on `origin/main` in `mcp-host-server/src/server.ts` (commit `9008392`). It refuses non-https URLs, slugs that are already taken, and repos already linked to another slug.
- **Audit gate:** in that same commit, it now runs `npm audit --omit=dev` in npm-only repos, so they no longer have to bypass it.
- **Family Frame entry:** commit `937bffe` changed the `family-frame` registry entry to link straight to `https://family-frame.replit.app` and made it public, so no redirect bundle is needed.
- **Live check:** `GET https://bilko.run/api/projects` still returns `family-frame` with url `https://family-frame.replit.app`.

I didn't commit or push anything new this time. The family-frame project already has my earlier proposal in its queue telling it to drop the redirect bundle and not publish.

Your local `~/Projects/Bilko` checkout is still out of sync with GitHub. The local bilko-host MCP runs from that checkout, so other repos won't see `register_external_project` until you sync it.
