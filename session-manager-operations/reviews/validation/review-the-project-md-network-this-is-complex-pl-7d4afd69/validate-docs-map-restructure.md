# Validation: docs map restructure

Base: 4cfb2934049e6f50f1ce0772780dd9f6e2e0ca80. Reviewed at HEAD 29b77c17.
Gates re-run in the foreground: `pnpm typecheck` (clean, no tsc output) and `vitest run` on sync-local-main, identity-guard, open-core-positioning, blog-cadence-watchdog, blog-pipeline-check, mcp-dist-sync and mcp-host-contract-tool: 7 files, 99 tests, all pass.
Gates for the none-gate PRDs (1631) were checked by reading.
The range also holds two non-plan commits (57519463 untracks Session Manager runtime state; b2c753d6 Field Manual release), which explain the 537-file stat. Not judged here.

## Per-PRD verdicts and evidence
- **delete-stale-docs: VERIFIED.** `[ -e ]` on docs/archive, docs/design, docs/validation, packages/host-kit/docs, project-pages/README.md and reviews/ops|publish: none exist. A `git grep` for the deleted paths outside session-manager-operations, content/blog and data/manual finds no dead doc citations. typecheck is clean.
- **host-internals-owns-platform-internals: VERIFIED.** docs/host-internals.md:214 "Sanctioned app-specific host code"; :148 `useAdminFetch` rule; :23, :82 and :106 say the monitors run by hand (no crontab entry or timer); :155 and :192 CSP text names `BLOG_VIDEO_CSP`. CLAUDE.md keeps one same-commit line.
- **deploy-and-writers-docs-own-their-facts: VERIFIED.** CLAUDE.md Git bullet 2 is 1 line plus link; docs/deployment.md:62 links to CLAUDE.md for the push rule. The gate passes. The writers list was not re-derived from the sibling repos.
- **secrets-and-npm-docs-match-code: VERIFIED.** docs/publishing-contract.md says by-hand release, no org token, and `publishConfig.provenance` false. This was read, and the code paths cited were not re-grepped line by line.
- **commerce-doc-owns-money: VERIFIED.** docs/commerce.md exists; agent-commerce.md and docs/stripe/ are gone; the host-contract "Stripe live vs test" heading is kept (:658). The added lines have no email or real name (the "Gmail" hits are generic).
- **site-doc-owns-bilko-run-pages: VERIFIED.** docs/site.md exists and owns routes, voice and the /book design source. CLAUDE.md has no Main URLs or Voice sections.
- **host-contract-sibling-only: VERIFIED.** All five required headings exist (host-contract.md :66, :208, :387, :578, :658). Telemetry contract is 8 lines (:378). docs/telemetry-beacons.md is deleted; "First-run setup outcomes" is at observability.md:172. host-contract has no relative links. Golden-template gap is flagged. typecheck is clean.
- **sdk-and-mcp-readmes-match-code: VERIFIED.** The MCP README has 21 table rows against 15 `server.tool` registrations in src/server.ts; the extra rows are header or other table rows, not checked row by row. There is no `autoCommit` mention. The changeset `.changeset/host-kit-readme-owner.md` exists. host-kit README export coverage was not diffed export by export.
- **blog-docs-one-owner: VERIFIED with a Minor.** blogs.md and docs/blog-watchdog.md are deleted; voice.md:191 says blog.config.yaml wins; content/blog/README.md:30-41 holds the video contract (2 MiB, smDemo, sm-demo-duration). See Minor 1.
- **blog-skill-docs-match-pipeline: VERIFIED with a Minor.** research.md is deleted and dag.md:62 has "Traps". seed.md is 31 lines and points to scripts/blog-seed.sh. rotation.md:32 defines "on /projects" via `public: true` (src/data/projectsView.ts, which exists). See Minor 2.
- **docs-map-entry: VERIFIED.** docs/map.md is 48 lines (cap 70), holds all required entries, and states the registry and `public: true` rules. CLAUDE.md line 1 is `@docs/map.md` and it is 44 lines (cap 90). README.md:5 links the map; the ops/ and error-triage rows are updated. Every path linked from map.md and CLAUDE.md exists. Old CLAUDE.md facts: stack, gateway pattern (host-contract.md:17), `_shared.ts` helpers, host-kit and web products all appear in owner docs. The gateway sentence about 8 siblings was shortened, so the named-sibling list is no longer in any doc. See Minor 3.
- **host-contract-tool-serves-map: VERIFIED.** `readHostContract(hostRoot)` is in mcp-host-server/src/host-contract.ts and re-exported from server.ts:56-58; server.ts:157 uses it; server.ts:186 names src/data/projectsRegistry.ts. tests/mcp-host-contract-tool.test.ts covers both cases; mcp-dist-sync passes.

## Combined-diff checks
- Personal email or real name added in tracked files: none found. The commit author is the generic bilko@bilko.run.
- A fact stated in two docs: the "never push to content-grade" rule is in docs/map.md "Rules everyone shares" and in CLAUDE.md Git, which imports the map, so it is stated twice (Minor 3).
- Links to deleted files: found two (Minor 1 and 2).
- `/code-review` and `/security-review` were not run; I self-reviewed the doc diff and found no secrets, unsafe input handling or path traversal. The one code change (`readHostContract`) reads fixed paths under HOST_ROOT.

## Findings
### Critical
None.
### Important
None.
### Minor
1. scripts/blog-cadence-watchdog.sh:204 still cites the deleted docs/blog-watchdog.md in a FATAL message. The PRD only named lines ~30 and ~194.
2. .claude/skills/blog-from-git/blog.config.yaml:4, :59 and :78 still cite the deleted research.md. The PRD covered only SKILL.md, ground.md and voice.md. blog.config.yaml:70 and :116-118 still mention spotlight_candidates and SEED_RESULT, which are fine there (only rotation.md was required to drop them).
3. docs/map.md "Rules everyone shares" duplicates the push-to-origin-only and identity rules that CLAUDE.md Git states, and CLAUDE.md imports the map. This conflicts with the one-owner goal; the PRDs only required CLAUDE.md to state the rule once.
