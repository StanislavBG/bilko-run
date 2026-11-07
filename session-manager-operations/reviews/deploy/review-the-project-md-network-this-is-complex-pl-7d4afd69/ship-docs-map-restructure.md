# Ship: docs-map-restructure

SHIP: PASS

Pushed SHA: 47778ece9f5577af81387742c814e8c5ad893a27 (origin/main, 1a83bc3c..47778ece, no force, origin only: StanislavBG/bilko-run)
Push time: 4:36 PM PST, 2026-11-06. Deploy seen live at about 4:39 PM PST (/api/health uptime 57s, below the 185s since push).

## Commits (cherry-picked from local main onto origin/main 1a83bc3c, no conflicts)
- 2ab80adc chore(docs): delete stale archive, design and validation docs (was 29657bf1)
- 2f361118 doc: host-internals owns platform internals; fold in observability rules, fix drift (was 9e174534)
- 487edae7 doc: deployment.md and repo-writers.md own their facts; CLAUDE.md points (was 86cf633c)
- 12d5177f doc: align secrets-rotation and publishing-contract with code and GitHub setup (was f782fd07)
- 1e9f4129 doc: docs/commerce.md owns platform-side money (was 2a935b64)
- 29c0bae4 doc(site): docs/site.md owns bilko.run's own pages (was 3489002e)
- 363ae733 doc(blog-skill): align skill files with blog-seed.sh pipeline (was 8f8d0c88)
- f5908071 doc: host-contract sibling-only; merge telemetry-beacons into observability (was f2ccb1d9)
- 67dc1457 doc: host-kit README owns consumer usage; MCP README lists all 15 tools (was 2c2bb974)
- 5ab26d71 doc(blog): one owner per blog fact; delete blogs.md and blog-watchdog.md (was a694c27b)
- 3dc4f4c1 doc: add docs/map.md entry map; slim CLAUDE.md to in-repo rules (was 3fd0bc19)
- 50f22847 feat(mcp): get_host_contract serves docs/map.md before the contract (was 29b77c17)
- 47778ece doc: drop links to deleted docs; the map owns the shared rules (was 0264ff76)

Not pushed: 82e10922, b2c753d6, 57519463 and the other local-main commits (validation records, cc0bc977).

## Checks
- Validation records (both): every PRD VERIFIED, no Critical or Important open (Minors only): PASS
- All 13 subjects found exactly once; none already on origin: PASS
- Cherry-picks applied with no conflict: PASS
- pnpm test (1921 passed, 15 skipped; blog-seed test passed), pnpm typecheck, pnpm build on the pushed tree: PASS
- Push only to origin, only these 13 commits, no force: PASS
- Deploy: /api/health uptime 57s < 185s since push: PASS
- https://bilko.run/ 200: PASS
- https://bilko.run/projects 200: PASS
- https://bilko.run/blog 200: PASS
- https://bilko.run/api/projects returns JSON with 10 projects: PASS
- origin/main has docs/map.md: PASS
- origin/main has no docs/archive/: PASS
- origin/main CLAUDE.md first line is @docs/map.md: PASS
