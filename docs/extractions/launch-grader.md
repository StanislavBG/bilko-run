# Extraction plan: LaunchGrader

**Slug:** `launch-grader` · **Target repo:** `~/Projects/Launch-Grader/` · **Migration #3** (template work after StackAudit; same shape, +SSRF concern).

## Inventory

| | Value |
|---|---|
| Page | `src/pages/LaunchGraderPage.tsx` (782 lines) |
| Server | `server/routes/tools/launch-grader.ts` (118 lines) |
| Tool entry | `src/config/tools.ts:279` (`category: 'business'`, `status: 'live'`) |
| Theme | teal: `--color-teal-400/500/600` |
| Endpoints | `POST /api/demos/launch-grader` only |

**Page imports** — identical pattern to StackAudit:
```ts
import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { SignInButton } from '@clerk/clerk-react';
import { useToolApi } from '../hooks/useToolApi.js';
import { track } from '../hooks/usePageView.js';
import { ToolHero, ScoreCard, SectionBreakdown, CrossPromo } from '../components/tool-page/index.js';
```

**Tailwind tokens:** warm + teal. Quick scan also expects standard Tailwind utilities and `text-warm-*`.

## Frontend coupling

Identical to StackAudit (see `stack-audit.md` — same kit components, same Clerk pattern, same useToolApi). The only delta is the theme color (teal vs slate).

## Backend coupling

| Endpoint | Method | Auth | Credits | Same-origin? |
|---|---|---|---|---|
| `/api/demos/launch-grader` | POST | Clerk JWT (`requireAuth`) | 1 token deducted (paid) | Yes |

**Server flow** mirrors StackAudit but with one twist: LaunchGrader scrapes the user-supplied URL via `validatePublicUrl` + `fetchPageBounded` from `server/services/page-fetch.ts`. SSRF protection lives server-side; the standalone keeps calling the host endpoint, so this stays safe.

## Test coverage

| Test file | References launch-grader? | Action |
|---|---|---|
| `tests/page-fetch.test.ts` | indirect (LaunchGrader is a primary consumer of `validatePublicUrl`) | leave |
| Other tests | no | leave |

No LaunchGrader-specific tests. The page-fetch tests guard the SSRF boundary; those stay in the host.

## External references

| Where | What | Action |
|---|---|---|
| `src/config/tools.ts:301,302` | LaunchGrader's `crossPromo` to `page-roast` and `stack-audit` | Data only — no action |
| Other tools' `crossPromo` arrays | a few `{ slug: 'launch-grader', ... }` entries | Leave; resolved via `MaybeStandaloneRedirect` |
| `src/pages/PricingPage.tsx`, FAQ entries | "LaunchGrader" in tool lists | Cosmetic |
| Blog seeds | none specific | nothing |

## Standalone repo setup

### `package.json`
Same shape as StackAudit; replace `name: "stack-audit"` → `"launch-grader"` and adjust the sync path to `../Bilko/public/projects/launch-grader`.

### `vite.config.ts`
```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base: '/projects/launch-grader/',
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
    <meta name="description" content="LaunchGrader · Is your product ready to launch? 5-dimension AI go-to-market audit." />
    <title>LaunchGrader · Go-to-market readiness audit</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

### `src/main.tsx`
Identical to StackAudit's; swap component name:
```tsx
import { LaunchGraderPage } from './LaunchGraderPage.js';
// ...
<LaunchGraderPage />
```

### `src/index.css`
Same as StackAudit but accent is **teal**:
```css
/* LaunchGrader accent — teal */
--color-teal-400: #2dd4bf;
--color-teal-500: #14b8a6;
--color-teal-600: #0d9488;
```
(Drop the slate tokens. Keep warm + fire + grade-* + animations.)

### `src/kit.tsx`
Reuse the same slim kit shape as StackAudit. Components needed: `track`, `<ToolHero>`, `<ScoreCard>`, `<SectionBreakdown>`, `<CrossPromo>`.

### `src/useToolApi.ts`
Copy from host, replace API base with `'https://bilko.run/api'`.

## Auth/credit migration

Same as StackAudit. Standalone calls `bilko.run/api/demos/launch-grader` from `bilko.run/projects/launch-grader/` — same origin, Clerk JWT in `Authorization: Bearer`, server's `requireAuth` validates. Token deduction unchanged on the server.

## Step-by-step extraction sequence

```bash
# 1. Init
mkdir -p ~/Projects/Launch-Grader/src && cd ~/Projects/Launch-Grader && git init -q

# 2. Create config files (mirror StackAudit's)

# 3. Copy page + hook
cp ~/Projects/Bilko/src/pages/LaunchGraderPage.tsx src/LaunchGraderPage.tsx
cp ~/Projects/Bilko/src/hooks/useToolApi.ts src/useToolApi.ts
sed -i "s|/api|https://bilko.run/api|g" src/useToolApi.ts

# 4. Adapt imports in src/LaunchGraderPage.tsx (same 5 substitutions as StackAudit)

# 5. Build
pnpm install && pnpm build

# 6. Wire .mcp.json (one-liner)
cat > .mcp.json <<'EOF'
{"mcpServers":{"bilko-host":{"command":"node","args":["/home/bilko/Projects/Bilko/mcp-host-server/dist/server.js"]}}}
EOF

# 7. Register + publish via the MCP from a Claude session in this dir
#    bilko-host__register_static_project {
#      slug: "launch-grader", name: "LaunchGrader",
#      tagline: "Is your product ready to launch?",
#      category: "AI Tool · Productivity", status: "live", year: 2026,
#      sourceRepo: "github.com/StanislavBG/launch-grader",
#      localPath: "~/Projects/Launch-Grader",
#      tags: ["GTM", "Audit"]
#    }
#    bilko-host__publish_static_project { slug: "launch-grader", distPath: "/home/bilko/Projects/Launch-Grader/dist" }

# 8. Remove from host (KEEP the server route file — standalone calls it!)
cd ~/Projects/Bilko
rm src/pages/LaunchGraderPage.tsx
# DO NOT rm server/routes/tools/launch-grader.ts — standalone needs the endpoint live
# Edit src/config/tools.ts: delete the slug:'launch-grader' { ... } block

# 9. Verify
pnpm exec tsc --noEmit
pnpm test                     # 27/27
pnpm exec vite build          # no LaunchGraderPage chunk
node dist-server/server/index.js &
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:4000/projects/launch-grader/   # → 200
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://127.0.0.1:4000/api/demos/launch-grader   # → 401 (auth required, endpoint alive)

# 10. Commit + push host
git add -A && git commit -m "Extract LaunchGrader to ~/Projects/Launch-Grader (static-path sibling)"
git push origin main && git push content-grade main:master

# 11. GitHub repo
cd ~/Projects/Launch-Grader
git add -A && git commit -m "Initial: extract LaunchGrader from Bilko monorepo"
gh repo create StanislavBG/launch-grader --public --source=. --push \
  --description "Standalone go-to-market readiness audit. Static-path app on bilko.run/projects/launch-grader/"
```

## Risks / gotchas specific to this tool

- **Server route stays live.** Same as StackAudit — do NOT delete `server/routes/tools/launch-grader.ts`. The standalone calls it.
- **SSRF / `validatePublicUrl`.** All URL fetching happens server-side via `server/services/page-fetch.ts`. The standalone never fetches the user's URL directly — it just POSTs the URL to `/api/demos/launch-grader` and the host scrapes it under `validatePublicUrl` rules. **Don't try to fetch in the browser** (CORS would block it anyway).
- **5-dimension scoring output.** Larger response payload than StackAudit (5 pillars vs N tools). `<SectionBreakdown>` should handle it, but verify with a real run after publish.
- **Page also embeds an iframe / preview?** Read `LaunchGraderPage.tsx` carefully — if it iframes the user's URL for visual reference, that's a same-origin / CSP question. Leave it as-is unless it breaks.
- **CORS on dev.** Same as StackAudit — local dev needs Vite proxy or local Bilko.

## Verification checklist

- [ ] `pnpm exec tsc --noEmit` → 0 errors
- [ ] `pnpm test` → 27/27 pass (including `page-fetch.test.ts`)
- [ ] `pnpm exec vite build` → no `LaunchGraderPage-*.js` chunk
- [ ] `pnpm exec tsc -p tsconfig.server.json` → server compiles
- [ ] `curl /projects/launch-grader/` → 200
- [ ] `curl -X POST /api/demos/launch-grader` → 401 (proves endpoint kept)
- [ ] Browser smoke: sign in, paste a public URL (e.g. your own landing page), get a 5-dimension scored audit back
- [ ] `bilko-host__list_projects` shows `launch-grader`

## Estimated effort

**~30–45 minutes.** Justification:
- Same shape as StackAudit; copy-and-adapt
- One real risk (SSRF) is already cleanly contained server-side and unaffected by extraction
- After this, AdScorer is the next "big" one (90 min), but LaunchGrader proves the recipe is rote
