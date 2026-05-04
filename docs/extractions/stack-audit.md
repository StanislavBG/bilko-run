# Extraction plan: StackAudit

**Slug:** `stack-audit` · **Target repo:** `~/Projects/Stack-Audit/` · **Migration #2** (proves the paid-tier credit pattern through same-origin cookie).

## Inventory

| | Value |
|---|---|
| Page | `src/pages/StackAuditPage.tsx` (786 lines) |
| Server | `server/routes/tools/stack-audit.ts` (105 lines) |
| Tool entry | `src/config/tools.ts:307` (`category: 'business'`, `status: 'live'`) |
| Theme | slate: `--color-slate-400/500/600` |
| Endpoints | `POST /api/demos/stack-audit` only (no compare, no generate) |

**Page imports (`StackAuditPage.tsx:1-6`):**
```ts
import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { SignInButton } from '@clerk/clerk-react';
import { useToolApi } from '../hooks/useToolApi.js';
import { track } from '../hooks/usePageView.js';
import { ToolHero, ScoreCard, SectionBreakdown, CrossPromo } from '../components/tool-page/index.js';
```

Standard mid-tier coupling: kit (3 components) + Clerk SignInButton + useToolApi + react-router Link + track.

**Tailwind tokens:** warm + slate (per theme). Quick scan also expects `text-warm-*`, `bg-white`, possibly `text-slate-*` for pillar bars.

## Frontend coupling

| Symbol | Source | Action in standalone |
|---|---|---|
| `useToolApi` | `src/hooks/useToolApi.ts` | Inline a slim version in `src/kit.tsx` that handles fetch + Clerk JWT bearer header + token state. See "Auth/credit migration" below — for SaaS at the same origin, the Clerk session cookie travels and you only need the JWT for `Authorization: Bearer` calls. Easiest: copy `useToolApi.ts` wholesale into `src/useToolApi.ts` and replace its API base. |
| `track()` | `src/hooks/usePageView.ts:81` | Inline slim version in `src/kit.tsx` (see Stepproof plan) |
| `<ToolHero>` | `src/components/tool-page/ToolHero.tsx` | Inline slim local copy (LocalScore pattern: vanilla Tailwind, drop `toolSlug`/theme prop, hardcode the slate gradient) |
| `<ScoreCard>` | `src/components/tool-page/ScoreCard.tsx` | Inline slim local copy. Read source first — likely needs `colors.ts` helper. |
| `<SectionBreakdown>` | `src/components/tool-page/SectionBreakdown.tsx` | Inline slim local copy |
| `<CrossPromo>` | `src/components/tool-page/CrossPromo.tsx` | Inline slim local copy with hardcoded promo list pointing to `https://bilko.run/products/<slug>` (or `/projects/<slug>/` for static-path neighbors). Pulls from registry-of-record at build time. |
| `<SignInButton>` from `@clerk/clerk-react` | host's Clerk wrapper | **Keep** — needs `@clerk/clerk-react` in standalone deps. Wrap with a minimal `<ClerkProvider publishableKey={...}>` in main.tsx. |
| `<Link>` from `react-router-dom` | router | Replace with `<a href="https://bilko.run/...">` for cross-promo (full reload back to host). |

Standalone needs `@clerk/clerk-react` — adds ~67KB gzipped. Acceptable. Same Clerk publishable key as host so sessions transfer.

## Backend coupling

| Endpoint | Method | Auth | Credits | Same-origin OK? |
|---|---|---|---|---|
| `/api/demos/stack-audit` | POST | Clerk JWT (`requireAuth`) | 1 token deducted on success (paid) | Yes — `bilko.run/projects/stack-audit/` → `bilko.run/api/demos/stack-audit`, same origin, Clerk session cookie + JWT travel naturally |

**Server flow (server/routes/tools/stack-audit.ts):**
1. `requireAuth(req, reply)` — extracts Clerk email or 401s
2. Validate body (tool list)
3. `getActiveSubscriptionLive(email)` — checks Pro tier
4. If not Pro: `getTokenBalance(email)` — must be ≥ 1
5. Call Gemini
6. On success: `deductToken(email)` if not Pro

Standalone calls this endpoint as-is. No server changes.

## Test coverage

| Test file | References stack-audit? | Action |
|---|---|---|
| `tests/auth.test.ts` | indirect (tests requireAuth, used by all tools) | leave |
| `tests/tokens.test.ts` | indirect (tests deductToken / grantFreeTokens) | leave |
| `tests/db.test.ts`, `tests/page-fetch.test.ts` | no | leave |
| `e2e/local-score.spec.ts` | no | leave |

No StackAudit-specific tests. Add `e2e/stack-audit.spec.ts` in the standalone repo later if desired.

## External references

```bash
$ grep -rEn "stack-audit|StackAudit" src/ server/db.ts --include="*.tsx" --include="*.ts"
```

| Where | What | Action |
|---|---|---|
| `src/config/tools.ts:329` | StackAudit's own `crossPromo` to `launch-grader` | Becomes data-only after extraction |
| `src/config/tools.ts:330` | StackAudit's `crossPromo` to `local-score` | (already a sibling) |
| Other tools' crossPromo | a few `{ slug: 'stack-audit', hook: ... }` entries | Leave; slug still resolves via `MaybeStandaloneRedirect` |
| `server/db.ts` blog seeds | "We Built StackAudit Because Reddit Told Us To" — multiple `/projects/stack-audit` mentions | URLs already work (static-path) |
| `src/pages/PricingPage.tsx`, FAQ pages | "StackAudit" in comma-separated tool lists | Cosmetic, can leave |

After registration in `standalone-projects.json`, `MaybeStandaloneRedirect` (App.tsx) catches `/products/stack-audit` and forwards to `/projects/stack-audit/`. All existing inbound links keep working.

## Standalone repo setup

### `package.json`
```json
{
  "name": "stack-audit",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "sync": "rm -rf ../Bilko/public/projects/stack-audit && cp -r dist ../Bilko/public/projects/stack-audit"
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
No `react-router-dom` (replace `<Link>` with `<a>`).

### `vite.config.ts`
```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base: '/projects/stack-audit/',
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
    <meta name="description" content="StackAudit · Find waste in your SaaS stack. Cost analysis + alternatives in 30 seconds. $1." />
    <title>StackAudit · SaaS stack waste finder</title>
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
import { StackAuditPage } from './StackAuditPage.js';
import './index.css';

const CLERK_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ?? 'pk_live_Y2xlcmsuYmlsa28ucnVuJA';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ClerkProvider publishableKey={CLERK_KEY}>
      <StackAuditPage />
    </ClerkProvider>
  </React.StrictMode>,
);
```

### `src/index.css`
```css
@import "tailwindcss";

@theme {
  /* Warm base shared by all bilko.run apps */
  --color-warm-50:  #fefdfb;
  --color-warm-100: #faf7f2;
  --color-warm-200: #f0e9df;
  --color-warm-300: #e0d5c5;
  --color-warm-400: #c4b49e;
  --color-warm-500: #a89478;
  --color-warm-600: #8c7660;
  --color-warm-700: #6b5a49;
  --color-warm-800: #4a3d33;
  --color-warm-900: #2d2520;
  --color-warm-950: #1a1613;

  /* Fire (used by some buttons) — keep just what StackAuditPage actually references */
  --color-fire-500: #ff6b1a;
  --color-fire-600: #e85a0a;

  /* StackAudit accent — slate */
  --color-slate-400: #94a3b8;
  --color-slate-500: #64748b;
  --color-slate-600: #475569;

  /* Grade colors (used by ScoreCard) */
  --color-grade-a: #16a34a;
  --color-grade-b: #2563eb;
  --color-grade-c: #eab308;
  --color-grade-d: #f97316;
  --color-grade-f: #ef4444;
}

html, body, #root { margin: 0; padding: 0; }
body {
  background: #faf7f2;
  color: #2d2520;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
}

/* Animations the kit references */
@keyframes slide-up { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
.animate-slide-up { animation: slide-up 0.5s ease-out both; }
@keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
.animate-fade-in { animation: fade-in 0.4s ease-out both; }
```
Verify by greping `StackAuditPage.tsx` for tokens you didn't account for.

### `src/kit.tsx`
Inline slim versions of `track`, `<ToolHero>`, `<ScoreCard>`, `<SectionBreakdown>`, `<CrossPromo>`. Use the LocalScore standalone (`~/Projects/Local-Score/src/kit.tsx`) as the template for `track` + `<ToolHero>` + `<CrossPromo>`. For `<ScoreCard>` + `<SectionBreakdown>`, copy from `src/components/tool-page/` and inline `colors.ts`.

### `src/useToolApi.ts`
Copy `src/hooks/useToolApi.ts` from the host. Replace any internal `/api` constant with `'https://bilko.run/api'`. Verify Clerk's `useAuth().getToken()` is what's added to the `Authorization: Bearer` header (it should already be).

## Auth/credit migration

The standalone runs at `bilko.run/projects/stack-audit/` and calls `bilko.run/api/demos/stack-audit`. **Same origin → Clerk session cookie travels automatically.**

The page already uses `useToolApi`, which already calls Clerk's `useAuth().getToken()` to get a JWT for `Authorization: Bearer`. The standalone needs `@clerk/clerk-react` for `useUser`/`useAuth`/`SignInButton`/`<ClerkProvider>`. Use the same publishable key as the host (`pk_live_Y2xlcmsuYmlsa28ucnVuJA`) so a user signed in at `bilko.run` is signed in here.

Server-side: `requireAuth(req, reply)` (in `server/clerk.ts`) verifies the JWT and returns the email. No CORS preflight because the request is same-origin.

**Token deduction:** unchanged. Server calls `deductToken(email)` after success. Pro users skip deduction.

## Step-by-step extraction sequence

```bash
# 1. Init repo
mkdir -p ~/Projects/Stack-Audit/src
cd ~/Projects/Stack-Audit
git init -q

# 2. Create config files (paste contents from "Standalone repo setup" above)

# 3. Copy the page
cp ~/Projects/Bilko/src/pages/StackAuditPage.tsx ~/Projects/Stack-Audit/src/StackAuditPage.tsx

# 4. Copy the hook (and adapt API base)
cp ~/Projects/Bilko/src/hooks/useToolApi.ts ~/Projects/Stack-Audit/src/useToolApi.ts
sed -i "s|/api|https://bilko.run/api|g" ~/Projects/Stack-Audit/src/useToolApi.ts

# 5. Adapt the page imports:
#    OLD: import { Link } from 'react-router-dom';
#    NEW: (delete; replace usages with <a href="https://bilko.run/...">)
#    OLD: import { useToolApi } from '../hooks/useToolApi.js';
#    NEW: import { useToolApi } from './useToolApi.js';
#    OLD: import { track } from '../hooks/usePageView.js';
#    NEW: import { track } from './kit.js';
#    OLD: import { ToolHero, ScoreCard, SectionBreakdown, CrossPromo } from '../components/tool-page/index.js';
#    NEW: import { ToolHero, ScoreCard, SectionBreakdown, CrossPromo } from './kit.js';
#    Drop toolSlug=... prop from <ToolHero> (slim local kit doesn't need it).
#    Drop currentTool=... from <CrossPromo> (slim version has the list hardcoded).

# 6. Install + build
pnpm install
pnpm build

# 7. Wire .mcp.json
cat > .mcp.json <<'EOF'
{"mcpServers":{"bilko-host":{"command":"node","args":["/home/bilko/Projects/Bilko/mcp-host-server/dist/server.js"]}}}
EOF

# 8. From a Claude Code session in ~/Projects/Stack-Audit/:
#    bilko-host__register_static_project {
#      slug: "stack-audit",
#      name: "StackAudit",
#      tagline: "Find waste in your SaaS stack",
#      category: "AI Tool · Productivity",
#      status: "live", year: 2026,
#      sourceRepo: "github.com/StanislavBG/stack-audit",
#      localPath: "~/Projects/Stack-Audit",
#      tags: ["Ops", "Cost"]
#    }
#    bilko-host__publish_static_project { slug: "stack-audit", distPath: "/home/bilko/Projects/Stack-Audit/dist" }

# 9. Remove from host
cd ~/Projects/Bilko
rm src/pages/StackAuditPage.tsx
rm server/routes/tools/stack-audit.ts
# Edit server/routes/tools/index.ts: drop registerStackAuditRoutes import + call
# Edit src/config/tools.ts: delete the slug:'stack-audit' { ... } block (lines ~307-336)

# 10. Verify host
pnpm exec tsc --noEmit
pnpm test                      # 27/27
pnpm exec vite build           # no StackAuditPage chunk
pnpm exec tsc -p tsconfig.server.json
node dist-server/server/index.js &
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:4000/projects/stack-audit/   # → 200
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:4000/api/demos/stack-audit   # → 404 (deleted) — OK, standalone calls live host

# 11. Commit + push host
git add -A
git commit -m "Extract StackAudit to ~/Projects/Stack-Audit (static-path sibling)"
git push origin main && git push content-grade main:master

# 12. Create GitHub repo
cd ~/Projects/Stack-Audit
git add -A && git commit -m "Initial: extract StackAudit from Bilko monorepo"
gh repo create StanislavBG/stack-audit --public --source=. --push \
  --description "Standalone SaaS stack waste finder. Static-path app on bilko.run/projects/stack-audit/"
```

## Risks / gotchas specific to this tool

- **Server route is deleted but standalone still calls `/api/demos/stack-audit`.** This works ONLY if the standalone is hosted at `bilko.run/projects/stack-audit/` AND the host keeps the route. Wait — we deleted it in step 9. ⚠️ **Do not delete `server/routes/tools/stack-audit.ts`** in this migration. The endpoint must stay live; the standalone calls it. Update step 9 accordingly.
- **Correction to step 9:** keep the server file. Only delete `src/pages/StackAuditPage.tsx`. The `tools/index.ts` still registers the route. Re-verify with `curl /api/demos/stack-audit` returning 401 (auth required) not 404.
- **Clerk publishable key.** Verify the standalone uses `pk_live_Y2xlcmsuYmlsa28ucnVuJA` (the production key). Different key = different session = "you're signed out" surprise.
- **CORS on dev.** Local dev (vite dev server at `localhost:5173`) calling `https://bilko.run/api` IS cross-origin; you'll need `bilko.run` to allow `localhost:5173` OR run dev against a local Bilko (`http://localhost:4000`) via Vite proxy. Production has no issue (same origin).
- **Dropping `react-router-dom`.** Make sure no `<Link>` outside the imports list lurks in the 786 lines. `grep -n "<Link"` first.
- **Test coverage.** No tests block extraction, but adding an `e2e/stack-audit.spec.ts` in the standalone is good hygiene.

## Verification checklist

- [ ] `pnpm exec tsc --noEmit` (host) → 0 errors
- [ ] `pnpm test` (host) → 27/27 pass
- [ ] `pnpm exec vite build` (host) → no `StackAuditPage-*.js` chunk
- [ ] `pnpm exec tsc -p tsconfig.server.json` (host) → server compiles
- [ ] `curl /projects/stack-audit/` → 200, returns standalone `index.html`
- [ ] `curl -X POST /api/demos/stack-audit` → 401 (auth required) — proves endpoint kept alive
- [ ] Browser: open `bilko.run/projects/stack-audit/`, sign in, paste a small tool list, get an audit back
- [ ] `bilko-host__list_projects` shows `stack-audit`
- [ ] No console errors about CORS, missing modules, or missing Clerk

## Estimated effort

**~60 minutes.** Justification:
- Page is medium-sized (786 lines) and uses the standard mid-tier kit
- First migration to keep the server route ALIVE (need to be careful with the "remove from host" step — server file stays)
- First migration to bundle Clerk in a standalone — proves the cookie-auth pattern
- Risk of small CSS regressions if Tailwind tokens are missed (budget 15 min for visual smoke test)

After this one, LaunchGrader (almost identical shape) is ~30 min.
