# Extraction plans

Per-tool playbooks for extracting each in-repo react-route AI tool to its own static-path sibling repo. See [`../migration-plan.md`](../migration-plan.md) for the overall plan and rationale.

| # | Tool | Plan | Effort | Sibling repo | Status | Key risk |
|--:|---|---|---|---|---|---|
| 1 | Stepproof | [stepproof.md](stepproof.md) | ~30 min | `StanislavBG/stepproof-page` | ✅ **DONE 2026-05-05** | Marketing page only — server route deleted (frontend never called it) |
| 2 | StackAudit | [stack-audit.md](stack-audit.md) | ~60 min | `StanislavBG/stack-audit` | ✅ **DONE 2026-05-05** (84 KB gz) | First Clerk-bundled standalone; proves same-origin cookie pattern |
| 3 | LaunchGrader | [launch-grader.md](launch-grader.md) | ~30–45 min | `StanislavBG/launch-grader` | ✅ **DONE 2026-05-05** (83 KB gz) | SSRF — server-side, unaffected by extraction |
| 4 | AdScorer | [ad-scorer.md](ad-scorer.md) | ~90 min | `StanislavBG/ad-scorer` | ✅ **DONE 2026-05-05** (86 KB gz) | First "big" page; first inline of `<CompareLayout>` + `<Rewrites>` |
| 5 | HeadlineGrader | [headline-grader.md](headline-grader.md) | ~45 min | `StanislavBG/headline-grader` | ✅ **DONE 2026-05-06** (85 KB gz) | Email-unlock free-tier flow; possible `@bilko/host-kit` publish point |
| 6 | ThreadGrader | [thread-grader.md](thread-grader.md) | ~30 min | `StanislavBG/thread-grader` | ✅ **DONE 2026-05-06** (88 KB gz) | Pure template work |
| 7 | EmailForge | [email-forge.md](email-forge.md) | ~30 min | `StanislavBG/email-forge` | ✅ **DONE 2026-05-06** (86 KB gz) | Smaller kit footprint; large response payloads |
| 8 | AudienceDecoder | [audience-decoder.md](audience-decoder.md) | ~45 min | `StanislavBG/audience-decoder` | ✅ **DONE 2026-05-06** (86 KB gz) | Unique one-time-purchase tier (server-side, transparent to client) |
| 9 | PageRoast | [page-roast.md](page-roast.md) | ~2 hours | `StanislavBG/page-roast` | ✅ **DONE 2026-05-06** (84 KB gz) | Brand flagship; bespoke fetch (no `useToolApi`); 6 endpoints; fire-themed CSS |

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

## StackAudit retrospective — additional corrections from #2

Migration #2 added four more learnings on top of the Stepproof eight:

### 9. `src/vite-env.d.ts` is required when the standalone reads `import.meta.env`

`useToolApi` references `import.meta.env.VITE_API_URL` in some shapes; without `vite-env.d.ts` declaring `interface ImportMetaEnv` the standalone's `tsc` fails. Stepproof never read env so dodged this. Add this file to every Clerk-bundled standalone:

```ts
/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_CLERK_PUBLISHABLE_KEY?: string;
}
interface ImportMeta { readonly env: ImportMetaEnv; }
```

### 10. Copy kit components from `src/components/tool-page/*.tsx` directly — NOT from a sibling's slim copy

LocalScore is a free tool and ships only `<ToolHero>`/`<CrossPromo>`. It has no `<ScoreCard>`. The instinct to "copy from the working sibling" fails for paid tools that need scoring UI. Read each component's source in the host:

- `src/components/tool-page/ToolHero.tsx`
- `src/components/tool-page/ScoreCard.tsx`
- `src/components/tool-page/SectionBreakdown.tsx`
- `src/components/tool-page/CompareLayout.tsx` (#4 onward)
- `src/components/tool-page/Rewrites.tsx` (#4 onward)
- `src/components/tool-page/CrossPromo.tsx`
- `src/components/tool-page/colors.ts` (grade/bar color helpers — inline these into the standalone's `kit.tsx`)

Bake the tool's `theme` colors directly into the slim copies. Drop generic props (`toolSlug`, `currentTool`) — the standalone only renders one tool.

### 11. The hero gradient + glow color come from `src/config/tools.ts → theme`, NOT from the page's Tailwind classes

The page's body uses `bg-warm-50`, etc. — those are page-level palette tokens. The hero's dark gradient + radial glow live inside `<ToolHero>` and read from `theme.heroGradient` / `theme.glowColor`. When inlining a slim `<ToolHero>` in the standalone, hardcode those exact strings (e.g. `from-[#0d1f17] via-[#0a1510] to-[#0d1f17]` for AdScorer's emerald hero). Source-of-truth is `tools.ts`, not the page.

### 12. Fresh `git init` lands on `master` — rename to `main` before first push

```bash
cd ~/Projects/<Tool>
git init -q
# ... add files, commit ...
git branch -M main          # rename master → main
gh repo create StanislavBG/<slug> --public --source=. --push --description "..."
```

Without the rename, `gh repo create --push` pushes a `master` branch and the GitHub UI shows `master` as default — inconsistent with the host repo's `main`.

## AdScorer retrospective — additional corrections from #4

Migration #4 added five more learnings on top of Stepproof + StackAudit. Apply to #5–#9.

### 13. `src/pages/ContentToolsPage.tsx` lazy-imports each tabbed tool — cleanup is mandatory

`ContentToolsPage.tsx` is the host's "Content Tools" tab dashboard. It does `React.lazy(() => import('./<Tool>Page.js'))` for **AdScorer, HeadlineGrader, ThreadGrader, EmailForge, AudienceDecoder** (NOT LaunchGrader, NOT PageRoast). Deleting `<Tool>Page.tsx` without removing the lazy import + tab entry breaks the build.

For #5–#8, every migration must:

```bash
grep -n "<Tool>Page\|<slug>" src/pages/ContentToolsPage.tsx
```

Then remove the lazy import line, the `{ id: '<slug>', label: '...' }` tab entry, and the `{activeTab === '<slug>' && <ToolPage />}` render line. `MaybeStandaloneRedirect` handles the redirect from `/products/<slug>` to `/projects/<slug>/`.

**Add to host-side cleanup checklist** (extends retrospective #4): for tabbed tools, also `[ ] Remove <Tool>Page from src/pages/ContentToolsPage.tsx (lazy import + tab + render)`.

### 14. `<CompareLayout>` and `<Rewrites>` inline pattern — proven on AdScorer

The slim kit pattern from StackAudit extends cleanly: copy `src/components/tool-page/CompareLayout.tsx` and `Rewrites.tsx` source verbatim into the standalone's `kit.tsx`, drop generic props (`toolSlug`, `currentTool`), bake theme colors directly. HeadlineGrader and ThreadGrader use both — reuse this pattern.

### 15. `text-display-sm` is required when CompareLayout's winner banner is used

CompareLayout's winner banner uses `text-display-sm`. Add to standalone `index.css`:

```css
.text-display-sm { font-size: 1.875rem; line-height: 2.25rem; font-weight: 600; }
```

Or whatever the host's `index.css` defines. Without it, the banner renders as default body text. Applies to AdScorer, HeadlineGrader, ThreadGrader.

### 16. Tab-mode pages don't need `<ToolHero>` tab props

The plan's `<ToolHero>` shape exposed `tab/onTabChange/hasCompare` props, but pages with multi-mode toggles (Score/Compare/Generate) render their own tab UI inside `<ToolHero>` children. Drop those props from the slim copy. Applies to: AdScorer, HeadlineGrader, ThreadGrader, EmailForge.

### 17. Cross-promo target URL: always `https://bilko.run/products/<slug>` (full reload)

Cross-promo links in the standalone should use `https://bilko.run/products/<slug>` with `target="_top"` or `window.location.href = ...` for a full reload. The host's `MaybeStandaloneRedirect` resolves `/products/<slug>` to either the react-route or the static-path bundle, regardless of whether the target tool has been extracted yet. Don't try to know the target's host kind from inside a sibling repo.

---

## After all 9 are done

- `src/pages/` contains zero AI-tool pages
- `src/config/tools.ts` is empty (or deleted) — `LISTING_TOOLS` is `[]`
- `server/routes/tools/*` files all stay (standalone apps still call those endpoints)
- `src/index.css` has many orphaned color/animation tokens — clean them up. Specifically: indigo, emerald, sky, amber, purple, slate accent tokens; PageRoast's 7+ fire-themed animations (`flame-rise`, `flame-flicker`, `ember-float`, `roast-shake`, `heat-wave`, `border-burn`, `result-slam`)
- `src/components/tool-page/*` may have orphaned components — audit
- Host bundle is tiny: just brand chrome (Layout, HomePage, ProjectsPage, BlogPage, PricingPage, AdminPage, etc.)

Update [`../migration-plan.md`](../migration-plan.md) to mark all 9 as DONE.
