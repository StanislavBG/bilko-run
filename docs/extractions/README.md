# Extraction plans

Per-tool playbooks for extracting each in-repo react-route AI tool to its own static-path sibling repo. See [`../migration-plan.md`](../migration-plan.md) for the overall plan and rationale.

| # | Tool | Plan | Effort | Key risk |
|--:|---|---|---|---|
| 1 | Stepproof | [stepproof.md](stepproof.md) | ~30 min | Smallest page; no auth; verify whether server route is BYOK passthrough or actually executes |
| 2 | StackAudit | [stack-audit.md](stack-audit.md) | ~60 min | First Clerk-bundled standalone; proves same-origin cookie pattern |
| 3 | LaunchGrader | [launch-grader.md](launch-grader.md) | ~30–45 min | SSRF — server-side, unaffected by extraction |
| 4 | AdScorer | [ad-scorer.md](ad-scorer.md) | ~90 min | First "big" page; first inline of `<CompareLayout>` + `<Rewrites>` |
| 5 | HeadlineGrader | [headline-grader.md](headline-grader.md) | ~45 min | Email-unlock free-tier flow; **publish `@bilko/host-kit` here** |
| 6 | ThreadGrader | [thread-grader.md](thread-grader.md) | ~30 min | Pure template work |
| 7 | EmailForge | [email-forge.md](email-forge.md) | ~30 min | Smaller kit footprint; large response payloads |
| 8 | AudienceDecoder | [audience-decoder.md](audience-decoder.md) | ~45 min | Unique one-time-purchase tier (server-side, transparent to client) |
| 9 | PageRoast | [page-roast.md](page-roast.md) | ~2 hours | Brand flagship; bespoke fetch (no `useToolApi`); 6 endpoints; fire-themed CSS |

## Plan structure (every tool)

Each plan follows the same shape so you can read one fluently after reading any other:

1. **Inventory** — page LOC, server LOC, tool entry, theme, endpoints
2. **Frontend coupling** — host symbols imported, what to inline / replace
3. **Backend coupling** — endpoints, auth, credits, same-origin path
4. **Test coverage** — what tests reference the tool, what to do post-extraction
5. **External references** — cross-promo, blog seeds, FAQ mentions
6. **Standalone repo setup** — concrete file contents for `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, `src/index.css`, `src/kit.tsx`, `src/useToolApi.ts`
7. **Auth/credit migration** — same-origin Clerk session + JWT bearer pattern
8. **Step-by-step extraction sequence** — copy-pasteable shell commands
9. **Risks / gotchas specific to this tool**
10. **Verification checklist**
11. **Estimated effort**

## Read order

For maximum context, read in migration order (Stepproof → PageRoast). Each later plan assumes patterns from earlier ones (especially: Stepproof for the analytics/track pattern, AdScorer for the full kit, PageRoast for the bespoke-fetch pattern).

## After all 9 are done

- `src/pages/` contains zero AI-tool pages
- `src/config/tools.ts` is empty (or deleted) — `LISTING_TOOLS` is `[]`
- `server/routes/tools/*` files all stay (standalone apps still call those endpoints)
- `src/index.css` has many orphaned color/animation tokens — clean them up
- `src/components/tool-page/*` may have orphaned components — audit
- Host bundle is tiny: just brand chrome (Layout, HomePage, ProjectsPage, BlogPage, PricingPage, AdminPage, etc.)

Update [`../migration-plan.md`](../migration-plan.md) to mark all 9 as DONE.
