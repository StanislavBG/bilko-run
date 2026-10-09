# Extraction plan: EmailForge

**Slug:** `email-forge` · **Target repo:** `~/Projects/Email-Forge/` · **Migration #7** (slimmer than AdScorer/Headline/Thread — generates a sequence, doesn't score, so fewer kit components).

## Inventory

| | Value |
|---|---|
| Page | `src/pages/EmailForgePage.tsx` (1,076 lines) |
| Server | `server/routes/tools/email-forge.ts` (301 lines) |
| Tool entry | `src/config/tools.ts:228` (`category: 'content'`, `status: 'live'`) |
| Theme | amber: `--color-amber-400/500/600` |
| Endpoints | `POST /api/demos/email-forge`, `/compare` (2 routes — no `/generate`, EmailForge IS a generator) |

**Page imports (`EmailForgePage.tsx:1-6`):**
```ts
import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { SignInButton } from '@clerk/clerk-react';
import { useToolApi } from '../hooks/useToolApi.js';
import { track } from '../hooks/usePageView.js';
import { ToolHero, CrossPromo } from '../components/tool-page/index.js';
```

**Notable:** only `<ToolHero>` + `<CrossPromo>` from the kit. No `<ScoreCard>`, no `<SectionBreakdown>`, no `<CompareLayout>`, no `<Rewrites>`. EmailForge generates a 5-email sequence with custom rendering (likely cards or a stepper).

**Tailwind tokens:** warm + amber + standard utilities. No grade-* (no scoring).

## Frontend coupling

| Symbol | Source | Action |
|---|---|---|
| `useToolApi` | host hook | Copy to `src/useToolApi.ts`, swap API base |
| `track()` | host | Inline in `src/kit.tsx` |
| `<ToolHero>` | host kit | Slim local copy with amber gradient |
| `<CrossPromo>` | host kit | Slim local copy with hardcoded promo (`ad-scorer`, `audience-decoder`) |
| `<SignInButton>` from `@clerk/clerk-react` | Clerk | Keep — needs `@clerk/clerk-react` + `<ClerkProvider>` |
| `<Link>` from `react-router-dom` | router | Replace with `<a href>` |

Smaller kit footprint than AdScorer/HeadlineGrader/ThreadGrader. The page does its own custom rendering for the email sequence — that lives in the page itself, not in the host kit.

## Backend coupling

| Endpoint | Method | Auth | Credits | Notes |
|---|---|---|---|---|
| `/api/demos/email-forge` | POST | Clerk JWT | 1 token | Generate a 5-email sequence |
| `/api/demos/email-forge/compare` | POST | Clerk JWT | 2 tokens | A/B compare two sequences |

Same-origin from `bilko.run/projects/email-forge/` → `bilko.run/api/demos/email-forge{,/compare}`. Standard Clerk JWT auth + token deduction.

**Larger response payload** than the scoring tools — 5 emails × subject + body each. Verify the standalone handles streaming or the wait state cleanly (likely a simple loading spinner is fine; Gemini returns the full sequence in one shot).

## Test coverage

| Test file | References email-forge? | Action |
|---|---|---|
| All `tests/` | indirect (auth, tokens) | leave |
| `e2e/local-score.spec.ts` | no | leave |

## External references

| Where | What | Action |
|---|---|---|
| `src/config/tools.ts:247,248` | EmailForge's `crossPromo` to `ad-scorer`, `audience-decoder` | Data only |
| Other tools' `crossPromo` | `{ slug: 'email-forge', ... }` in AdScorer, ThreadGrader, AudienceDecoder | Leave |
| `server/db.ts` blog seeds | "EmailForge" mentioned in PageRoast blog seed (line 415) | URL `/projects/email-forge` already works |
| `src/pages/PricingPage.tsx`, FAQ entries | "EmailForge" in tool lists | Cosmetic |

## Standalone repo setup

### `package.json`
```json
{
  "name": "email-forge",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "sync": "rm -rf ../Bilko/public/projects/email-forge && cp -r dist ../Bilko/public/projects/email-forge"
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
  base: '/projects/email-forge/',
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
    <meta name="description" content="EmailForge · AI generates 5-email sequences. AIDA, PAS, Hormozi, Cialdini, Story frameworks." />
    <title>EmailForge · 5-email sequence generator</title>
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
import { EmailForgePage } from './EmailForgePage.js';
import './index.css';

const CLERK_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ?? 'pk_live_Y2xlcmsuYmlsa28ucnVuJA';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ClerkProvider publishableKey={CLERK_KEY}>
      <EmailForgePage />
    </ClerkProvider>
  </React.StrictMode>,
);
```

### `src/index.css`
Same warm base as previous extractions, swap accent to **amber**:
```css
/* EmailForge accent — amber */
--color-amber-400: #fbbf24;
--color-amber-500: #f59e0b;
--color-amber-600: #d97706;
```
Drop `grade-*` (no scoring). Keep slide-up / fade-in animations.

### `src/kit.tsx`
**Smaller kit than AdScorer/HeadlineGrader.** Inline only: `track`, `<ToolHero>`, `<CrossPromo>`. If you've already published `@bilko/host-kit`, just install it. Otherwise, copy the relevant slice from `~/Projects/Headline-Grader/src/kit.tsx` (drop `<ScoreCard>`/`<SectionBreakdown>`/`<CompareLayout>`/`<Rewrites>`).

### `src/useToolApi.ts`
Copy from host, swap API base.

## Auth/credit migration

Same as previous: same-origin, Clerk session cookie + JWT bearer. Token deduction:
- Generate sequence: 1 token
- Compare two sequences: 2 tokens

The compare endpoint is heavier (2 Gemini calls) — server already handles, no client work.

## Step-by-step extraction sequence

```bash
# 1. Init
mkdir -p ~/Projects/Email-Forge/src && cd ~/Projects/Email-Forge && git init -q

# 2. Create config files (mirror AdScorer's, swap accent + slug + sync path)

# 3. Copy page + hook + kit
cp ~/Projects/Bilko/src/pages/EmailForgePage.tsx src/EmailForgePage.tsx
cp ~/Projects/Bilko/src/hooks/useToolApi.ts src/useToolApi.ts
sed -i "s|/api|https://bilko.run/api|g" src/useToolApi.ts
# Build src/kit.tsx with just track + ToolHero + CrossPromo
# (or copy from a previous extraction and delete the unused components)

# 4. Adapt page imports:
#    OLD: import { Link } from 'react-router-dom';
#    NEW: (drop)
#    OLD: import { useToolApi } from '../hooks/useToolApi.js';
#    NEW: import { useToolApi } from './useToolApi.js';
#    OLD: import { track } from '../hooks/usePageView.js';
#    NEW: import { track } from './kit.js';
#    OLD: import { ToolHero, CrossPromo } from '../components/tool-page/index.js';
#    NEW: import { ToolHero, CrossPromo } from './kit.js';
#    Drop toolSlug=... from <ToolHero>; drop currentTool=... from <CrossPromo>.

# 5. Build
pnpm install && pnpm build

# 6. Wire .mcp.json
cat > .mcp.json <<'EOF'
{"mcpServers":{"bilko-host":{"command":"node","args":["/home/bilko/Projects/Bilko/mcp-host-server/dist/server.js"]}}}
EOF

# 7. Register + publish via MCP
#    bilko-host__register_static_project { slug: "email-forge", name: "EmailForge",
#      tagline: "Generate email sequences that convert",
#      category: "AI Tool · Content", status: "live", year: 2026,
#      sourceRepo: "github.com/StanislavBG/email-forge",
#      localPath: "~/Projects/Email-Forge",
#      tags: ["Email", "Sequences"] }
#    bilko-host__publish_static_project { slug: "email-forge", distPath: "/home/bilko/Projects/Email-Forge/dist" }

# 8. Remove from host (KEEP server route)
cd ~/Projects/Bilko
rm src/pages/EmailForgePage.tsx
# DO NOT rm server/routes/tools/email-forge.ts
# Edit src/config/tools.ts: delete the slug:'email-forge' { ... } block

# 9. Verify host
pnpm exec tsc --noEmit
pnpm test
pnpm exec vite build
node dist-server/server/index.js &
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:4000/projects/email-forge/
for path in email-forge email-forge/compare; do
  curl -s -o /dev/null -w "$path: %{http_code}\n" -X POST http://127.0.0.1:4000/api/demos/$path
done

# 10. Commit + push host
git add -A && git commit -m "Extract EmailForge to ~/Projects/Email-Forge (static-path sibling)"
git push origin main && git push content-grade main:master

# 11. GitHub repo
cd ~/Projects/Email-Forge
git add -A && git commit -m "Initial: extract EmailForge from Bilko monorepo"
gh repo create StanislavBG/email-forge --public --source=. --push \
  --description "Standalone 5-email sequence generator. Static-path app on bilko.run/projects/email-forge/"
```

## Risks / gotchas specific to this tool

- **5-email sequence rendering** lives in the page itself (not in the kit). The page likely renders email cards / stepper / accordion. Read the page carefully to ensure no other host symbols sneak in beyond the imports listed.
- **5 frameworks (AIDA / PAS / Hormozi / Cialdini / Story)** are server-side prompt selection. Standalone passes a `framework` field; server picks the prompt. No client change.
- **No `<ScoreCard>` / `<Rewrites>`.** Smaller kit footprint = less inlining tax.
- **Larger payload.** 5 emails × ~200 words each = ~10KB JSON response. Fine, but loading state matters more than for scoring tools (longer wait for the full Gemini response).
- **Compare = 2x Gemini calls.** Wait state could be 60+ seconds. Verify a clear loading indicator survives the extraction.
- **CORS on dev.** Same caveat.

## Verification checklist

- [ ] `pnpm exec tsc --noEmit` → 0 errors
- [ ] `pnpm test` → 27/27 pass
- [ ] `pnpm exec vite build` → no `EmailForgePage-*.js` chunk
- [ ] `pnpm exec tsc -p tsconfig.server.json` → server compiles
- [ ] `curl /projects/email-forge/` → 200
- [ ] `curl -X POST /api/demos/email-forge{,/compare}` → 401 each
- [ ] Browser smoke: sign in, generate one sequence (test all 5 frameworks if possible). Verify cards render and copy-to-clipboard works on each email.
- [ ] `bilko-host__list_projects` shows `email-forge`

## Estimated effort

**~30 minutes.** Justification:
- Smaller kit footprint (only 2 components to inline) → less work than AdScorer/HeadlineGrader/ThreadGrader
- Same standard auth pattern
- Visual smoke test for amber theme + sequence rendering: ~10 min
