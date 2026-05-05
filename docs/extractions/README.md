# Extraction plans

Per-tool playbooks for extracting each in-repo react-route AI tool to its own static-path sibling repo. See [`../migration-plan.md`](../migration-plan.md) for the overall plan and rationale.

| # | Tool | Plan | Effort | Sibling repo | Status | Key risk |
|--:|---|---|---|---|---|---|
| 1 | Stepproof | [stepproof.md](stepproof.md) | ~30 min | `StanislavBG/stepproof-page` | ✅ **DONE 2026-05-05** | Marketing page only — server route deleted (frontend never called it) |
| 2 | StackAudit | [stack-audit.md](stack-audit.md) | ~60 min | `StanislavBG/stack-audit` | ⏳ next | First Clerk-bundled standalone; proves same-origin cookie pattern |
| 3 | LaunchGrader | [launch-grader.md](launch-grader.md) | ~30–45 min | `StanislavBG/launch-grader` | pending | SSRF — server-side, unaffected by extraction |
| 4 | AdScorer | [ad-scorer.md](ad-scorer.md) | ~90 min | `StanislavBG/ad-scorer` | pending | First "big" page; first inline of `<CompareLayout>` + `<Rewrites>` |
| 5 | HeadlineGrader | [headline-grader.md](headline-grader.md) | ~45 min | `StanislavBG/headline-grader` | pending | Email-unlock free-tier flow; possible `@bilko/host-kit` publish point |
| 6 | ThreadGrader | [thread-grader.md](thread-grader.md) | ~30 min | `StanislavBG/thread-grader` | pending | Pure template work |
| 7 | EmailForge | [email-forge.md](email-forge.md) | ~30 min | `StanislavBG/email-forge` | pending | Smaller kit footprint; large response payloads |
| 8 | AudienceDecoder | [audience-decoder.md](audience-decoder.md) | ~45 min | `StanislavBG/audience-decoder` | pending | Unique one-time-purchase tier (server-side, transparent to client) |
| 9 | PageRoast | [page-roast.md](page-roast.md) | ~2 hours | `StanislavBG/page-roast` | pending | Brand flagship; bespoke fetch (no `useToolApi`); 6 endpoints; fire-themed CSS |

All 8 GitHub repo names verified available 2026-05-05.

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

## Stepproof retrospective — corrections that apply to ALL remaining migrations

After executing #1 (Stepproof) end-to-end, several deltas surfaced that the original per-tool playbooks miss. Apply these to every migration #2–#9 unless that tool's plan explicitly contradicts.

### 1. Grep the actual page for Tailwind tokens before scaffolding `index.css`

The playbooks list a single "accent palette" (cyan for Stepproof, slate for StackAudit, teal for LaunchGrader, etc.) that's pulled from `src/config/tools.ts → theme`. **That metadata is read by the host's home/projects cards, not by the page itself.** The page's actual palette can be entirely different.

For Stepproof the playbook called for cyan; the page used **`warm-*` (50→950) + `fire-500/600` + `green-400`** and zero cyan. The right move:

```bash
grep -oE "(bg|text|border)-(warm|fire|slate|teal|emerald|indigo|sky|amber|purple|cyan|grade|fuchsia|green|red|yellow)-[0-9]+" src/pages/<Tool>Page.tsx | sort -u
```

Run that against the page, then build the standalone's `@theme` block to match. Default to the host's full `warm-*` and `fire-*` palettes (both ship in `src/index.css`); overlay any tool-specific accent on top.

### 2. Verify the server route is actually called by the page before deciding keep/delete

Stepproof's playbook said "verify whether the server route is BYOK passthrough or actually executes" — and it turned out the page never called the server at all. **For #2 onward, every page DOES call its server route**, so all routes stay. Confirm with a one-liner regardless:

```bash
grep -rE "/api/demos/<slug>|/<slug>/run|/<slug>/presets" src/ --include='*.tsx' --include='*.ts' | head
```

If the grep is empty, treat the route as a candidate for deletion (Stepproof case). Otherwise the route stays in the host and the standalone calls it same-origin.

### 3. GitHub repo naming — check before assuming `StanislavBG/<slug>` is free

Stepproof's playbook assumed `StanislavBG/stepproof`; that name was already taken by the CLI repo and we landed on `StanislavBG/stepproof-page`. All 8 remaining slugs were checked 2026-05-05 and are clear (table above). Re-check at execution time:

```bash
gh repo view StanislavBG/<slug> --json name 2>&1 | grep -q '"name"' && echo "TAKEN" || echo "AVAILABLE"
```

If taken, fall back to `<slug>-page` and update `sourceRepo` in `standalone-projects.json` accordingly.

### 4. Host-side cleanup checklist (every migration)

The original playbooks list 4 things to delete from the host. The full set, from running #1, is:

- [ ] `rm src/pages/<Tool>Page.tsx`
- [ ] Remove the tool's block from `src/config/tools.ts` (replace with a one-line `// <Tool> moved to its own repo` comment for legibility)
- [ ] **`src/data/standalone-projects.json`** — append the new entry with `host.kind: 'static-path'`, `host.path: '/projects/<slug>/'`, correct `sourceRepo` and `localPath`
- [ ] **`server/index.ts`** — only edit if the route lives outside `tools/` (Stepproof case). For #2–#9 the routes live in `server/routes/tools/<slug>.ts` and are auto-registered via the barrel; **leave them alone**
- [ ] **Leave `OG_OVERRIDES` entry in `server/index.ts`** untouched — `/projects/<slug>` is still a valid URL and the meta is correct
- [ ] **Leave the sitemap entry** in `server/index.ts` untouched (same reason)
- [ ] **`CLAUDE.md`** — move the tool from "In-repo (react-route)" to "Sibling repos (static-path)" and remove any tool-specific server route reference under "Backend Patterns"
- [ ] `public/projects/<slug>/` — populate from the standalone's `dist/` (overwrites any prior copy)

### 5. The MCP isn't available in the host session

The `bilko-host` MCP is only loaded when a Claude session opens a sibling repo (its `.mcp.json` wires it in). When you're working **in the host repo**, you can't call `bilko-host__register_static_project` — do the equivalent file ops directly:

- "Register" = edit `src/data/standalone-projects.json` (append a new entry)
- "Publish" = `rm -rf public/projects/<slug> && cp -r ~/Projects/<Tool>/dist public/projects/<slug>`

The end state is identical to what the MCP would produce.

### 6. Verification command set (proven on Stepproof)

```bash
pnpm exec tsc --noEmit                         # frontend → 0 errors
pnpm exec tsc -p tsconfig.server.json          # server → 0 errors
pnpm test                                       # 27/27 pass
pnpm exec vite build                            # → no <Tool>Page-*.js chunk in dist/assets/
NODE_ENV=production PORT=4099 node dist-server/server/index.js & sleep 3
curl -sI http://127.0.0.1:4099/projects/<slug>/                 # → 200
curl -sI http://127.0.0.1:4099/api/demos/<slug>                 # → 200 if route stays, 404 if deleted
pkill -f 'dist-server/server/index.js'
```

### 7. Commit + push pattern (per global memory rule)

Always push to BOTH remotes. Commit messages used for #1:

- `Extract <Tool> to ~/Projects/<Tool>-Page (static-path sibling)` — host repo
- `Initial: <Tool> landing page extracted from bilko-run monorepo` — sibling repo

Push commands:
```bash
git push origin main && git push content-grade main:master   # host
gh repo create StanislavBG/<slug>[-page] --public --source=. --push --description "..."   # sibling
```

### 8. Vite base + asset paths

`vite.config.ts` must include `base: '/projects/<slug>/'`. Verify after `pnpm build` that `dist/index.html` has `<script src="/projects/<slug>/assets/...js">` (not `/assets/...`). Stepproof's was correct on first build.

---

## After all 9 are done

- `src/pages/` contains zero AI-tool pages
- `src/config/tools.ts` is empty (or deleted) — `LISTING_TOOLS` is `[]`
- `server/routes/tools/*` files all stay (standalone apps still call those endpoints)
- `src/index.css` has many orphaned color/animation tokens — clean them up. Specifically: indigo, emerald, sky, amber, purple, slate accent tokens; PageRoast's 7+ fire-themed animations (`flame-rise`, `flame-flicker`, `ember-float`, `roast-shake`, `heat-wave`, `border-burn`, `result-slam`)
- `src/components/tool-page/*` may have orphaned components — audit
- Host bundle is tiny: just brand chrome (Layout, HomePage, ProjectsPage, BlogPage, PricingPage, AdminPage, etc.)

Update [`../migration-plan.md`](../migration-plan.md) to mark all 9 as DONE.
