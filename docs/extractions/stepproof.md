# Extraction plan: Stepproof

**Slug:** `stepproof` · **Target repo:** `~/Projects/Stepproof/` · **Migration #1** (easiest — proves the pattern, no auth, no credits, smallest page).

## Inventory

| | Value |
|---|---|
| Page | `src/pages/StepproofPage.tsx` (217 lines) |
| Server | `server/routes/stepproof.ts` (458 lines — note: **NOT** in `tools/`, predates the split) |
| Tool entry | `src/config/tools.ts:338` (`category: 'devtools'`, `status: 'live'`) |
| Theme | cyan: `--color-cyan-400/500/600` |
| Endpoints | `GET /api/demos/stepproof/presets`, `POST /api/demos/stepproof/run` |

**Page imports (`StepproofPage.tsx:1-2`):**
```ts
import { useEffect, useState } from 'react';
import { track } from '../hooks/usePageView.js';
```

That's it. No `useToolApi`, no shared kit (`<ToolHero>` / `<ScoreCard>` / etc), no Clerk SDK, no `<Link>`. Self-contained except for `track()`.

**Tailwind tokens used:** scan reveals only standard Tailwind (white, gray, slate). No `fire-*` or `warm-*`. Possibly `cyan-*` for accents — verify when you grep the file.

## Frontend coupling

| Symbol | Source | Action in standalone |
|---|---|---|
| `track()` | `src/hooks/usePageView.ts:81` | Inline a slim `track()` in `src/kit.ts` that POSTs to `https://bilko.run/api/analytics/event` (same-origin once deployed). |

No other host kit symbols. This is by far the simplest of the 9.

## Backend coupling

| Endpoint | Method | Auth | Credits | Notes |
|---|---|---|---|---|
| `/api/demos/stepproof/presets` | GET | none | none | Returns the YAML preset library |
| `/api/demos/stepproof/run` | POST | optional | none | Runs N iterations of a YAML scenario; supports BYOK (user supplies their own LLM API key in the request body) |

**Cookie/CORS path:** Same-origin from `bilko.run/projects/stepproof/` → `bilko.run/api/...`. No CORS, no cookie work needed (BYOK already trust-the-client model).

## Test coverage

| Test file | References stepproof? | Action post-extraction |
|---|---|---|
| `tests/auth.test.ts` | no | leave |
| `tests/db.test.ts` | no | leave |
| `tests/page-fetch.test.ts` | no | leave |
| `tests/tokens.test.ts` | no | leave |
| `e2e/local-score.spec.ts` | no | leave |

No test references Stepproof. The standalone repo can add its own `tests/` later if desired.

## External references

```
$ grep -rEn "stepproof|Stepproof" src/ --include="*.tsx" --include="*.ts" | grep -v "src/pages/StepproofPage.tsx\|src/config/tools.ts\|src/data/portfolio.ts\|standalone-projects.json"
```

| Where | What | Action |
|---|---|---|
| `src/config/tools.ts:357,358` | crossPromo entries inside other tools' definitions linking back to `stepproof` (and Stepproof's own crossPromo to other tools) | Leave as data; the slug still exists in standalone-projects.json after registration. |
| `server/db.ts` blog seeds | not mentioned | nothing to update |
| Other pages' FAQs | none | nothing |

After registration in `standalone-projects.json`, the existing `MaybeStandaloneRedirect` (App.tsx) catches `/products/stepproof` and forwards to `/projects/stepproof/`. Existing `<Link to="/projects/stepproof">` elsewhere already lands at the right place (Fastify static serves before SPA).

## Standalone repo setup

### `package.json`
```json
{
  "name": "stepproof",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "sync": "rm -rf ../Bilko/public/projects/stepproof && cp -r dist ../Bilko/public/projects/stepproof"
  },
  "dependencies": {
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
No `react-router-dom` (page doesn't use it). No `@clerk/clerk-react` (no auth).

### `vite.config.ts`
```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base: '/projects/stepproof/',
  plugins: [react(), tailwindcss()],
  build: { outDir: 'dist', sourcemap: false, target: 'es2022' },
});
```

### `tsconfig.json`
Identical to `~/Projects/Outdoor-Hours/tsconfig.json`.

### `index.html`
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="Stepproof · Regression tests for AI pipelines. YAML scenarios, LLM judge, BYOK." />
    <title>Stepproof · AI pipeline regression tests</title>
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
import { StepproofPage } from './StepproofPage.js';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <StepproofPage />
  </React.StrictMode>,
);
```

### `src/index.css`
```css
@import "tailwindcss";

@theme {
  --color-warm-50:  #fefdfb;
  --color-warm-100: #faf7f2;
  --color-warm-200: #f0e9df;
  --color-warm-900: #2d2520;
  --color-warm-950: #1a1613;
  /* Stepproof accent — cyan */
  --color-cyan-400: #22d3ee;
  --color-cyan-500: #06b6d4;
  --color-cyan-600: #0891b2;
}

html, body, #root { margin: 0; padding: 0; }
body {
  background: #0a0a0f;
  color: #e0e0e0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}
```
Verify the actual palette by greping `StepproofPage.tsx` for tokens before finalizing.

### `src/kit.ts`
Inline only `track()` (no React components needed):
```ts
const HOST = 'https://bilko.run';
const API = `${HOST}/api`;
let visitorId: string | null = null;
function getVisitorId(): string {
  if (visitorId) return visitorId;
  try {
    let v = localStorage.getItem('bilko_visitor_id');
    if (!v) { v = crypto.randomUUID(); localStorage.setItem('bilko_visitor_id', v); }
    visitorId = v; return v;
  } catch { return 'anon'; }
}
let sessionId: string | null = null;
function getSessionId(): string {
  if (sessionId) return sessionId;
  try {
    sessionId = sessionStorage.getItem('bilko_session_id') ?? crypto.randomUUID();
    sessionStorage.setItem('bilko_session_id', sessionId);
    return sessionId;
  } catch { return 'anon'; }
}
export function track(event: string, props?: { tool?: string; metadata?: unknown }): void {
  try {
    const body = JSON.stringify({
      event,
      tool: props?.tool ?? 'stepproof',
      path: window.location.pathname,
      metadata: props?.metadata ?? null,
      visitor_id: getVisitorId(),
      session_id: getSessionId(),
    });
    const url = `${API}/analytics/event`;
    if (typeof navigator?.sendBeacon === 'function') {
      const blob = new Blob([body], { type: 'application/json' });
      if (navigator.sendBeacon(url, blob)) return;
    }
    fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
  } catch { /* analytics never breaks the app */ }
}
```

## Auth/credit migration

Stepproof has no auth and no credit deduction (BYOK). The `POST /api/demos/stepproof/run` endpoint just executes the user's YAML against the user's API key. Standalone calls remain `https://bilko.run/api/demos/stepproof/run` — same origin once deployed, no CORS preflight needed for `application/json` POST.

If you ever DO want to gate Stepproof behind login later: same-origin Clerk session cookie travels automatically; no client work needed.

## Step-by-step extraction sequence

```bash
# 1. Init repo
mkdir -p ~/Projects/Stepproof/src
cd ~/Projects/Stepproof
git init -q

# 2. Create config files (paste contents from "Standalone repo setup" above)
#    package.json, vite.config.ts, tsconfig.json, index.html,
#    src/main.tsx, src/index.css, src/kit.ts, .gitignore, README.md

# 3. Copy the page
cp ~/Projects/Bilko/src/pages/StepproofPage.tsx ~/Projects/Stepproof/src/StepproofPage.tsx

# 4. Adapt the import: replace track import
#    OLD: import { track } from '../hooks/usePageView.js';
#    NEW: import { track } from './kit.js';

# 5. Install + build
pnpm install
pnpm build
# expected: dist/index.html + dist/assets/index-*.{js,css}

# 6. Wire up the bilko-host MCP (one-time, sibling .mcp.json)
cat > .mcp.json <<'EOF'
{"mcpServers":{"bilko-host":{"command":"node","args":["/home/bilko/Projects/Bilko/mcp-host-server/dist/server.js"]}}}
EOF

# 7. From a Claude Code session in ~/Projects/Stepproof/:
#    bilko-host__register_static_project {
#      slug: "stepproof",
#      name: "Stepproof",
#      tagline: "Regression tests for AI pipelines",
#      category: "AI Tool · Dev",
#      status: "live",
#      year: 2026,
#      sourceRepo: "github.com/StanislavBG/stepproof",
#      localPath: "~/Projects/Stepproof",
#      tags: ["YAML", "BYOK"]
#    }
#    bilko-host__publish_static_project {
#      slug: "stepproof",
#      distPath: "/home/bilko/Projects/Stepproof/dist"
#    }

# 8. Remove from host (in ~/Projects/Bilko/)
cd ~/Projects/Bilko
# Delete the page
rm src/pages/StepproofPage.tsx
# Delete the server route file
rm server/routes/stepproof.ts
# Remove the import + register call from server/index.ts
sed -i "/registerStepproofRoutes/d" server/index.ts
# Remove the entry from src/config/tools.ts (delete the {} block at line 338-360 plus comma)
# Best done by hand or via Edit tool — the block is contiguous.

# 9. Verify host
pnpm exec tsc --noEmit         # → 0 errors
pnpm test                       # → 27/27 pass
pnpm exec vite build            # → no StepproofPage chunk
pnpm exec tsc -p tsconfig.server.json  # → server compiles, no missing import
node dist-server/server/index.js &     # boot, then:
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:4000/projects/stepproof/
# → 200 (Fastify serves the standalone bundle)

# 10. Commit + push host
git add -A
git commit -m "Extract Stepproof to ~/Projects/Stepproof (static-path sibling)"
git push origin main
git push content-grade main:master

# 11. Create GitHub repo for the sibling
cd ~/Projects/Stepproof
git add -A
git commit -m "Initial: extract Stepproof from Bilko monorepo"
gh repo create StanislavBG/stepproof --public --source=. --push \
  --description "Standalone YAML scenario regression tests for AI pipelines. Static-path app on bilko.run/projects/stepproof/"
```

## Risks / gotchas specific to this tool

- **`server/routes/stepproof.ts` is large (458 lines).** Most of it is the YAML parser and runner logic, not the route handlers. After extraction, deleting the whole file is correct — Stepproof's logic is fully replaced by client-side or BYOK-driven execution. **Verify this assumption before deleting**: if the runner logic actually executes server-side LLM calls (not just BYOK passthrough), the standalone needs to keep calling `/api/demos/stepproof/run` and the server file stays.
- **YAML parsing.** If the page POSTs YAML strings to the server, the standalone keeps doing that → server file stays. Read `server/routes/stepproof.ts` carefully before pulling the trigger.
- **BYOK key handling.** Confirm the BYOK key is sent in the request body (not headers, not stored). Standalone behavior is identical — same endpoint, same body shape.
- **No tests to migrate.** Cleanest of all 9.
- **`src/views/`** was already deleted in the previous refactor. Nothing legacy to clean up.

## Verification checklist

- [ ] `pnpm exec tsc --noEmit` → 0 errors
- [ ] `pnpm test` → 27/27 pass
- [ ] `pnpm exec vite build` → no `StepproofPage-*.js` chunk in `dist/assets/`
- [ ] `pnpm exec tsc -p tsconfig.server.json` → no missing imports for stepproof
- [ ] `curl http://127.0.0.1:4000/projects/stepproof/` → 200, returns standalone `index.html`
- [ ] `curl http://127.0.0.1:4000/api/demos/stepproof/presets` → either 200 (if server kept) or 404 (if server deleted — and standalone must not call it)
- [ ] Browser: open `http://127.0.0.1:4000/projects/stepproof/` → page loads, Run button executes a preset
- [ ] `bilko-host__list_projects` shows `stepproof` in the standalone array
- [ ] `bilko-host__status` shows clean tree

## Estimated effort

**~30 minutes.** Justification:
- Page is the smallest of the 9 (217 lines, 2 imports)
- Zero shared kit usage
- No auth, no credits
- No test migration
- The only judgment call is whether to keep `server/routes/stepproof.ts` (depends on whether runner is server-side or BYOK-only). Reading the server file is ~5 min.

This migration's value is mostly proving the recipe end-to-end with the lowest risk; subsequent extractions can move faster.
