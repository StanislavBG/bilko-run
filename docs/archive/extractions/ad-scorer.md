# Extraction plan: AdScorer

**Slug:** `ad-scorer` · **Target repo:** `~/Projects/Ad-Scorer/` · **Migration #4** (first "big" extraction; full kit including Compare + Rewrites; 3 endpoints).

## Inventory

| | Value |
|---|---|
| Page | `src/pages/AdScorerPage.tsx` (1,103 lines) |
| Server | `server/routes/tools/ad-scorer.ts` (305 lines) |
| Tool entry | `src/config/tools.ts:178` (`category: 'content'`, `status: 'live'`) |
| Theme | emerald: `--color-emerald-400/500/600` |
| Endpoints | `POST /api/demos/ad-scorer`, `/compare`, `/generate` (3 routes — Score / Compare / Generate tab modes) |

**Page imports (`AdScorerPage.tsx:1-6`):**
```ts
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { SignInButton } from '@clerk/clerk-react';
import { useToolApi } from '../hooks/useToolApi.js';
import { track } from '../hooks/usePageView.js';
import { ToolHero, ScoreCard, SectionBreakdown, CompareLayout, Rewrites, CrossPromo } from '../components/tool-page/index.js';
```

Full kit usage. First extraction to need `<CompareLayout>` and `<Rewrites>`.

**Tailwind tokens:** warm + emerald + grade-* (ScoreCard) + standard utilities.

## Frontend coupling

| Symbol | Source | Action |
|---|---|---|
| `useToolApi` | `src/hooks/useToolApi.ts` | Copy to `src/useToolApi.ts`, swap API base to `https://bilko.run/api`. Already handles 3 endpoints (submit / compare / generate) via the same hook — no refactor needed. |
| `track()` | `src/hooks/usePageView.ts:81` | Inline in `src/kit.tsx` (LocalScore pattern) |
| `<ToolHero>` | host kit | Slim local copy — emerald gradient, drop `toolSlug`/theme prop |
| `<ScoreCard>` | host kit | Slim local copy + inline `colors.ts` |
| `<SectionBreakdown>` | host kit | Slim local copy |
| `<CompareLayout>` | host kit | Slim local copy — first time we need this; check the source for nested kit deps |
| `<Rewrites>` | host kit | Slim local copy — copy buttons, AI rewrite suggestions |
| `<CrossPromo>` | host kit | Slim local copy with hardcoded promo list (`page-roast`, `email-forge`) |
| `<SignInButton>` from `@clerk/clerk-react` | Clerk | Keep — needs `@clerk/clerk-react` in deps + `<ClerkProvider>` in main.tsx |
| `<Link>` from `react-router-dom` | router | Replace with `<a href>` for cross-promo (full reload back to host) |

This is the first extraction needing `<CompareLayout>` + `<Rewrites>`. Read both source files in `src/components/tool-page/` before inlining; they may import from each other or from `colors.ts`.

## Backend coupling

| Endpoint | Method | Auth | Credits | Notes |
|---|---|---|---|---|
| `/api/demos/ad-scorer` | POST | Clerk JWT | 1 token | Single ad scoring (Score tab) |
| `/api/demos/ad-scorer/compare` | POST | Clerk JWT | 2 tokens | A/B compare two ads |
| `/api/demos/ad-scorer/generate` | POST | Clerk JWT | 1 token | Inverse mode — describe product, get ad copy back. Uses shared `handleGenerateEndpoint` helper. |

All same-origin; Clerk session + JWT bearer travel naturally.

**Server flow:** standard `requireAuth` → `getActiveSubscriptionLive` → free-tier `getTokenBalance` check → Gemini call → `deductToken` if not Pro. The `/generate` endpoint uses the shared helper from `server/routes/tools/_shared.ts:handleGenerateEndpoint` — that helper STAYS in the host (used by HeadlineGrader generate and ThreadGrader generate too).

## Test coverage

| Test file | References ad-scorer? | Action |
|---|---|---|
| All in `tests/` | indirect (auth, tokens, page-fetch) | leave |
| `e2e/local-score.spec.ts` | no | leave |

No AdScorer-specific tests. Standalone can add `e2e/ad-scorer.spec.ts` later.

## External references

| Where | What | Action |
|---|---|---|
| `src/config/tools.ts:197,198` | AdScorer's `crossPromo` to `page-roast`, `email-forge` | Data only |
| Other tools' `crossPromo` arrays | `{ slug: 'ad-scorer', ... }` entries in PageRoast, HeadlineGrader, EmailForge | Leave; resolved via `MaybeStandaloneRedirect` |
| `server/db.ts` blog seeds | "AdScorer" mentioned in the PageRoast and StackAudit blog seed posts (line 413, etc.) | Leave; `/projects/ad-scorer` URL still works |
| `src/pages/PricingPage.tsx`, FAQ pages | "AdScorer" in tool lists | Cosmetic |

## Standalone repo setup

### `package.json`
```json
{
  "name": "ad-scorer",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "sync": "rm -rf ../Bilko/public/projects/ad-scorer && cp -r dist ../Bilko/public/projects/ad-scorer"
  },
  "dependencies": {
    "@clerk/clerk-react": "^5.60.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.1.6",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^5.0.0",
    "tailwindcss": "^4.1.6",
    "typescript": "^5.6.3",
    "vite": "^6.0.0"
  }
}
```

### `vite.config.ts`
```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base: '/projects/ad-scorer/',
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
    <meta name="description" content="AdScorer · Grade ads before you spend the budget. Platform-specific scoring for Facebook, Google, LinkedIn." />
    <title>AdScorer · Platform-specific ad grading</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

### `src/main.tsx`
```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';
import { AdScorerPage } from './AdScorerPage.js';
import './index.css';

const CLERK_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ?? 'pk_live_Y2xlcmsuYmlsa28ucnVuJA';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ClerkProvider publishableKey={CLERK_KEY}>
      <AdScorerPage />
    </ClerkProvider>
  </React.StrictMode>,
);
```

### `src/index.css`
Same warm + grade base as StackAudit, swap accent to **emerald**:
```css
/* AdScorer accent — emerald */
--color-emerald-400: #34d399;
--color-emerald-500: #10b981;
--color-emerald-600: #059669;
```
Plus all the `slide-up`, `fade-in` keyframes. Verify by greping the page for any `text-fire-*` (PageRoast cross-promo cards may use fire) and `text-emerald-*`.

### `src/kit.tsx`
Inline: `track`, `<ToolHero>`, `<ScoreCard>`, `<SectionBreakdown>`, `<CompareLayout>`, `<Rewrites>`, `<CrossPromo>`. Use LocalScore's `kit.tsx` as the template for `track`/`<ToolHero>`/`<CrossPromo>`. For the others: copy from `src/components/tool-page/`. Check whether `<Rewrites>` uses `colors.ts` helpers — inline those too.

### `src/useToolApi.ts`
Copy from host, swap API base. AdScorer's hook supports all 3 modes (submit / compare / generate) via the same useToolApi instance — verify the hook source supports all three and that no per-endpoint logic lives in the page.

## Auth/credit migration

Same as StackAudit. Standalone runs at `bilko.run/projects/ad-scorer/`, calls `bilko.run/api/demos/ad-scorer{,/compare,/generate}` — same origin, Clerk session cookie + JWT bearer.

The 3 tabs differ only in which endpoint they call; auth is identical for all three. Token deduction:
- Score: 1 token
- Compare: 2 tokens
- Generate: 1 token

The `requireAuth` middleware on each endpoint is unchanged. Pro users skip deduction.

## Step-by-step extraction sequence

```bash
# 1. Init repo
mkdir -p ~/Projects/Ad-Scorer/src && cd ~/Projects/Ad-Scorer && git init -q

# 2. Create config files (paste contents above)

# 3. Copy page + hook
cp ~/Projects/Bilko/src/pages/AdScorerPage.tsx src/AdScorerPage.tsx
cp ~/Projects/Bilko/src/hooks/useToolApi.ts src/useToolApi.ts
sed -i "s|/api|https://bilko.run/api|g" src/useToolApi.ts

# 4. Build src/kit.tsx with all 6 components inlined
#    (track, ToolHero, ScoreCard, SectionBreakdown, CompareLayout, Rewrites, CrossPromo)
#    Reference:
#    - ~/Projects/Local-Score/src/kit.tsx for track + ToolHero + CrossPromo
#    - ~/Projects/Bilko/src/components/tool-page/{ScoreCard,SectionBreakdown,CompareLayout,Rewrites,colors}.tsx for the others

# 5. Adapt the page imports (same 5 substitutions as StackAudit, plus CompareLayout/Rewrites going to ./kit.js)
#    Drop toolSlug=... from <ToolHero>; drop currentTool=... from <CrossPromo>.

# 6. Install + build
pnpm install && pnpm build

# 7. Wire .mcp.json
cat > .mcp.json <<'EOF'
{"mcpServers":{"bilko-host":{"command":"node","args":["/home/bilko/Projects/Bilko/mcp-host-server/dist/server.js"]}}}
EOF

# 8. Register + publish via MCP
#    bilko-host__register_static_project { slug: "ad-scorer", name: "AdScorer",
#      tagline: "Grade ads before you spend the budget",
#      category: "AI Tool · Content", status: "live", year: 2026,
#      sourceRepo: "github.com/StanislavBG/ad-scorer",
#      localPath: "~/Projects/Ad-Scorer",
#      tags: ["Ads", "FB/Google/LinkedIn"] }
#    bilko-host__publish_static_project { slug: "ad-scorer", distPath: "/home/bilko/Projects/Ad-Scorer/dist" }

# 9. Remove from host (KEEP server route — standalone calls it)
cd ~/Projects/Bilko
rm src/pages/AdScorerPage.tsx
# DO NOT rm server/routes/tools/ad-scorer.ts
# Edit src/config/tools.ts: delete the slug:'ad-scorer' { ... } block

# 10. Verify host
pnpm exec tsc --noEmit
pnpm test
pnpm exec vite build  # no AdScorerPage chunk
node dist-server/server/index.js &
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:4000/projects/ad-scorer/   # 200
for path in ad-scorer ad-scorer/compare ad-scorer/generate; do
  curl -s -o /dev/null -w "$path: %{http_code}\n" -X POST http://127.0.0.1:4000/api/demos/$path  # 401 each
done

# 11. Commit + push host
git add -A && git commit -m "Extract AdScorer to ~/Projects/Ad-Scorer (static-path sibling)"
git push origin main && git push content-grade main:master

# 12. GitHub repo
cd ~/Projects/Ad-Scorer
git add -A && git commit -m "Initial: extract AdScorer from Bilko monorepo"
gh repo create StanislavBG/ad-scorer --public --source=. --push \
  --description "Standalone platform-specific ad copy grading. Static-path app on bilko.run/projects/ad-scorer/"
```

## Risks / gotchas specific to this tool

- **First "big" extraction.** 1,103-line page + 6 kit components to inline. Budget for surprises — first time inlining `<CompareLayout>` and `<Rewrites>`.
- **Multi-tab UI (Score / Compare / Generate).** `<ToolHero>` has a `tab` / `onTabChange` / `hasCompare` prop trio. The slim version needs to keep these or AdScorer loses its tab UX. Verify the hero you inline supports tabs.
- **Platform variants (FB / Google / LinkedIn).** Each platform has its own scoring rules server-side. Standalone passes a `platform` field; server selects the right prompt. No client change.
- **Generate mode (`/generate`).** This is the inverse mode — user describes product, gets ad copy back. Server uses `handleGenerateEndpoint` helper from `_shared.ts`. Standalone calls the same endpoint; no special handling.
- **Cross-promo to `page-roast`, `email-forge`.** Both still in-repo (they extract LATER). Hardcode those as `https://bilko.run/products/<slug>` (react-route URL); they'll work whether the target is react-route or static-path (`MaybeStandaloneRedirect` handles the static-path case).
- **`<Rewrites>` copy buttons.** May use `navigator.clipboard.writeText`. Verify it works under the standalone (no permissions issue at `bilko.run/projects/ad-scorer/`).
- **CORS on dev.** Same caveat as StackAudit / LaunchGrader.

## Verification checklist

- [ ] `pnpm exec tsc --noEmit` → 0 errors
- [ ] `pnpm test` → 27/27 pass
- [ ] `pnpm exec vite build` → no `AdScorerPage-*.js` chunk
- [ ] `pnpm exec tsc -p tsconfig.server.json` → server compiles
- [ ] `curl /projects/ad-scorer/` → 200
- [ ] `curl -X POST /api/demos/ad-scorer{,/compare,/generate}` → 401 each (auth required, endpoints alive)
- [ ] Browser smoke: sign in, switch all 3 tabs, score one Facebook ad, compare two Google ads, generate one LinkedIn ad. Verify token deductions and rewrites copy-to-clipboard.
- [ ] `bilko-host__list_projects` shows `ad-scorer`

## Estimated effort

**~90 minutes.** Per migration plan. Justification:
- First time inlining the full 6-component kit (CompareLayout + Rewrites are new)
- 1,103-line page to scan for any non-obvious coupling
- 3 endpoints to verify (Score, Compare, Generate)
- After this one, HeadlineGrader (#5) can reuse the same kit copy → ~45 min
