# Extraction plan: HeadlineGrader

**Slug:** `headline-grader` · **Target repo:** `~/Projects/Headline-Grader/` · **Migration #5** (same shape as AdScorer + an extra `/unlock` flow for free-tier email gate).

## Inventory

| | Value |
|---|---|
| Page | `src/pages/HeadlineGraderPage.tsx` (1,076 lines) |
| Server | `server/routes/tools/headline-grader.ts` (355 lines) |
| Tool entry | `src/config/tools.ts:153` (`category: 'content'`, `status: 'live'`) |
| Theme | indigo: `--color-indigo-400/500/600` |
| Endpoints | `POST /api/demos/headline-grader/unlock`, `/api/demos/headline-grader`, `/compare`, `/generate` (4 routes) |

**Page imports** — same shape as AdScorer (full kit including CompareLayout + Rewrites):
```ts
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { SignInButton } from '@clerk/clerk-react';
import { useToolApi } from '../hooks/useToolApi.js';
import { track } from '../hooks/usePageView.js';
import { ToolHero, ScoreCard, SectionBreakdown, CompareLayout, Rewrites, CrossPromo } from '../components/tool-page/index.js';
```

**Tailwind tokens:** warm + indigo + grade-* + standard utilities.

## Frontend coupling

Identical to AdScorer (full kit) — see `ad-scorer.md`. Theme color and slug differ; everything else is template work.

The standalone needs `@clerk/clerk-react` for `<SignInButton>` and the `useUser` / `getToken` flow inside `useToolApi`. Same publishable key as host.

## Backend coupling

| Endpoint | Method | Auth | Credits | Notes |
|---|---|---|---|---|
| `/api/demos/headline-grader/unlock` | POST | none | none | Email-only "unlock" — adds the user's email to the funnel and grants 1 free use. Pre-Clerk pattern from the early days; does NOT verify email ownership. |
| `/api/demos/headline-grader` | POST | Clerk JWT (`requireAuth`) | 1 token (paid) | Score one headline |
| `/api/demos/headline-grader/compare` | POST | Clerk JWT | 2 tokens | A/B compare |
| `/api/demos/headline-grader/generate` | POST | Clerk JWT | 1 token | Inverse mode (uses shared `handleGenerateEndpoint`) |

**Same-origin OK?** Yes — all 4 are on `bilko.run/api/...` from the standalone at `bilko.run/projects/headline-grader/`.

**Email-unlock flow specifics:** the `/unlock` endpoint:
1. Validates email format
2. Hashes the IP, records a `funnel_events` row
3. Calls `resetUsage(ipHash, 'headline-grader')` so the user gets a fresh free-tier count
4. Returns `{ ok: true }`

The page POSTs the email pre-score, then runs the score endpoint. After extraction the standalone makes both calls in sequence — no client-side change beyond the import swap.

## Test coverage

| Test file | References headline-grader? | Action |
|---|---|---|
| `tests/auth.test.ts` | indirect | leave |
| `tests/tokens.test.ts` | indirect | leave |
| `tests/page-fetch.test.ts` | no | leave |
| `tests/db.test.ts` | no | leave |
| `e2e/local-score.spec.ts` | no | leave |

No HeadlineGrader-specific tests.

## External references

| Where | What | Action |
|---|---|---|
| `src/config/tools.ts:172,173` | HeadlineGrader's `crossPromo` to `page-roast`, `thread-grader` | Data only |
| Other tools' `crossPromo` | `{ slug: 'headline-grader', ... }` in PageRoast, AdScorer, ThreadGrader, Stepproof | Leave |
| `server/db.ts` blog seeds | "HeadlineGrader" mentioned in PageRoast blog seed (line 412) | URL `/projects/headline-grader` already works |
| `src/pages/PricingPage.tsx`, `HeadlineGraderPage.tsx` itself | "HeadlineGrader" in FAQ entries inside the same page | Goes with the page when extracted |

## Standalone repo setup

### `package.json`
Same template as AdScorer; swap `"name": "headline-grader"` and adjust the sync path.

### `vite.config.ts`
```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base: '/projects/headline-grader/',
  plugins: [react(), tailwindcss()],
  build: { outDir: 'dist', sourcemap: false, target: 'es2022' },
});
```

### `index.html`
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="HeadlineGrader · Score headlines like a pro copywriter. 4 frameworks: Rule of One, Hormozi, Readability, Proof+Promise+Plan." />
    <title>HeadlineGrader · 4-framework headline scoring</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

### `src/main.tsx`
Mirror AdScorer; replace `<AdScorerPage />` → `<HeadlineGraderPage />`.

### `src/index.css`
Same warm + grade base as AdScorer, swap accent to **indigo**:
```css
/* HeadlineGrader accent — indigo */
--color-indigo-400: #818cf8;
--color-indigo-500: #6366f1;
--color-indigo-600: #4f46e5;
```

### `src/kit.tsx`
**Reuse the kit you built for AdScorer extraction** — copy `~/Projects/Ad-Scorer/src/kit.tsx` into this repo. Same 6 components (`track`, `<ToolHero>`, `<ScoreCard>`, `<SectionBreakdown>`, `<CompareLayout>`, `<Rewrites>`, `<CrossPromo>`). Update the `CROSS_PROMO` array to point at HeadlineGrader's neighbors (`page-roast`, `thread-grader`).

> **At this point** (migration #5), the kit copy-paste tax is real. Per `docs/migration-plan.md`, this is when you extract the kit to `@bilko/host-kit` (private npm or git submodule) and have all standalones depend on it. Defer that decision to after this migration if you want to ship faster.

### `src/useToolApi.ts`
Copy from host, swap API base to `https://bilko.run/api`. The hook already supports the `/unlock` pre-call pattern via its email/auth flow — verify by reading the hook source.

## Auth/credit migration

Same as AdScorer. All 4 endpoints same-origin, Clerk session cookie + JWT bearer.

**Email-unlock flow post-extraction:**
1. Standalone shows email input on first visit
2. POST `/api/demos/headline-grader/unlock` with `{email}` — same-origin, no cookie/JWT needed (it's the open free-tier flow)
3. Server records funnel event, resets the IP's usage count
4. User then submits headline → POST `/api/demos/headline-grader` with the JWT (or just IP rate-limited if not signed in)

Note: the unlock endpoint does NOT verify the email is real — the user could enter any string. That's an existing accept-the-leakage decision; the extraction doesn't change it.

## Step-by-step extraction sequence

```bash
# 1. Init
mkdir -p ~/Projects/Headline-Grader/src && cd ~/Projects/Headline-Grader && git init -q

# 2. Create config files

# 3. Copy page + hook + kit (kit reused from AdScorer extraction)
cp ~/Projects/Bilko/src/pages/HeadlineGraderPage.tsx src/HeadlineGraderPage.tsx
cp ~/Projects/Bilko/src/hooks/useToolApi.ts src/useToolApi.ts
sed -i "s|/api|https://bilko.run/api|g" src/useToolApi.ts
cp ~/Projects/Ad-Scorer/src/kit.tsx src/kit.tsx
# Edit src/kit.tsx CROSS_PROMO list to point at HeadlineGrader's neighbors

# 4. Adapt page imports (same 5 substitutions as AdScorer)

# 5. Build
pnpm install && pnpm build

# 6. Wire .mcp.json
cat > .mcp.json <<'EOF'
{"mcpServers":{"bilko-host":{"command":"node","args":["/home/bilko/Projects/Bilko/mcp-host-server/dist/server.js"]}}}
EOF

# 7. Register + publish via MCP
#    bilko-host__register_static_project { slug: "headline-grader", name: "HeadlineGrader",
#      tagline: "Score headlines like a pro copywriter",
#      category: "AI Tool · Content", status: "live", year: 2026,
#      sourceRepo: "github.com/StanislavBG/headline-grader",
#      localPath: "~/Projects/Headline-Grader",
#      tags: ["Copy", "Frameworks"] }
#    bilko-host__publish_static_project { slug: "headline-grader", distPath: "/home/bilko/Projects/Headline-Grader/dist" }

# 8. Remove from host (KEEP server route)
cd ~/Projects/Bilko
rm src/pages/HeadlineGraderPage.tsx
# DO NOT rm server/routes/tools/headline-grader.ts
# Edit src/config/tools.ts: delete the slug:'headline-grader' { ... } block

# 9. Verify host
pnpm exec tsc --noEmit
pnpm test
pnpm exec vite build  # no HeadlineGraderPage chunk
node dist-server/server/index.js &
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:4000/projects/headline-grader/
for path in headline-grader/unlock headline-grader headline-grader/compare headline-grader/generate; do
  curl -s -o /dev/null -w "$path: %{http_code}\n" -X POST http://127.0.0.1:4000/api/demos/$path
done

# 10. Commit + push host
git add -A && git commit -m "Extract HeadlineGrader to ~/Projects/Headline-Grader (static-path sibling)"
git push origin main && git push content-grade main:master

# 11. GitHub repo
cd ~/Projects/Headline-Grader
git add -A && git commit -m "Initial: extract HeadlineGrader from Bilko monorepo"
gh repo create StanislavBG/headline-grader --public --source=. --push \
  --description "Standalone 4-framework headline scoring + AI rewrites. Static-path app on bilko.run/projects/headline-grader/"
```

## Risks / gotchas specific to this tool

- **Email-unlock flow.** Two-step: POST `/unlock` (no auth) → POST `/headline-grader` (auth or IP-rate-limited). Verify the standalone preserves the order and the unlock POST actually fires before the score POST.
- **4 frameworks UI.** Page has framework-by-framework breakdown rendered through `<SectionBreakdown>`. Verify the slim local copy handles 4 sections cleanly.
- **Generate mode** uses the same shared `handleGenerateEndpoint` server-side helper as AdScorer + ThreadGrader — that helper stays in `server/routes/tools/_shared.ts` regardless of how many tools are extracted.
- **Kit copy-paste tax begins to bite.** Strongly consider publishing the kit as `@bilko/host-kit` after this migration. Migration #6 onward will keep paying the same tax otherwise.
- **CORS on dev.** Same caveat as AdScorer.

## Verification checklist

- [ ] `pnpm exec tsc --noEmit` → 0 errors
- [ ] `pnpm test` → 27/27 pass
- [ ] `pnpm exec vite build` → no `HeadlineGraderPage-*.js` chunk
- [ ] `pnpm exec tsc -p tsconfig.server.json` → server compiles
- [ ] `curl /projects/headline-grader/` → 200
- [ ] `curl -X POST /api/demos/headline-grader/unlock` → 400 (missing email body) — proves alive
- [ ] `curl -X POST /api/demos/headline-grader{,/compare,/generate}` → 401 each (auth required)
- [ ] Browser smoke: enter email → unlock → score one headline → compare two → generate from a description
- [ ] `bilko-host__list_projects` shows `headline-grader`

## Estimated effort

**~45 minutes** — kit reused from AdScorer reduces inlining work to a paste + tweak. Justification:
- Page is similar size to AdScorer (1,076 lines)
- Same 6-component kit shape; reuse `~/Projects/Ad-Scorer/src/kit.tsx`
- One extra endpoint (`/unlock`) to verify wiring, but no new patterns
- Visual smoke test for indigo theme + 4-framework layout: ~10 min

If you publish `@bilko/host-kit` as part of this migration, add ~60 min for the npm package work.
