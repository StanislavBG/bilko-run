# Extraction plan: PageRoast

**Slug:** `page-roast` · **Target repo:** `~/Projects/Page-Roast/` · **Migration #9 — LAST.** Brand flagship. Most cross-promo back-references. Most complex page (1,496 lines). Budget the most time and the most polished playbook.

After this migration, the host repo's `src/pages/` directory contains zero AI-tool pages and `src/config/tools.ts` is empty (or you can delete the file entirely). Kick-out complete.

## Inventory

| | Value |
|---|---|
| Page | `src/pages/PageRoastPage.tsx` (1,496 lines — biggest by far) |
| Server | `server/routes/tools/page-roast.ts` (332 lines) |
| Tool entry | `src/config/tools.ts:124` (`category: 'business'`, `status: 'live'` — listed first, the brand flagship) |
| Theme | fire/orange: `--color-fire-400/500/600` (the brand's default accent) |
| Endpoints | 6: `GET /api/roasts/stats`, `/api/roasts/recent`, `/api/roasts/mine`, `/api/roasts/mine/:id`, `POST /api/demos/page-roast`, `/api/demos/page-roast/compare` |

**Page imports (`PageRoastPage.tsx:1-5`):**
```ts
import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useUser, SignInButton, useAuth, useClerk } from '@clerk/clerk-react';
import { CrossPromo } from '../components/tool-page/index.js';
import { track } from '../hooks/usePageView.js';
```

**Notable:** PageRoast is the only tool that uses `useUser`, `useAuth`, `useClerk` directly (not just `<SignInButton>` + `useToolApi`). This is because it has bespoke auth flows: history view (`/api/roasts/mine`), the recent-roasts feed, and free-tier IP rate limiting that interacts with auth state. Page does its own fetch calls; does NOT use `useToolApi` (notable exception).

**Tailwind tokens:** warm + fire + grade-* + a LOT of fire-themed animations (see "Standalone repo setup" below).

## Frontend coupling

| Symbol | Source | Action |
|---|---|---|
| `useUser`, `useAuth`, `useClerk` from `@clerk/clerk-react` | Clerk SDK | Keep — wrap with `<ClerkProvider>` in main.tsx |
| `<SignInButton>` from `@clerk/clerk-react` | Clerk | Keep |
| `track()` | host | Inline in `src/kit.tsx` |
| `<CrossPromo>` | host kit | Slim local copy with hardcoded promo (`headline-grader`, `ad-scorer`) |
| `<Link>` from `react-router-dom` | router | Replace with `<a href>` for cross-promo. PageRoast may also navigate to `/admin` or `/projects` — check the page for any in-app routes (likely there are none — it's a single-purpose page). |
| `fetch()` calls | direct | Keep, but route through a slim `apiBase = "https://bilko.run/api"` constant so nothing hardcodes `/api`. |

**Critical:** PageRoast does NOT use `useToolApi`. It makes its own fetches. So the standalone needs to handle JWT-bearer construction itself (or replicate `useToolApi`'s logic inline). The pattern: `useAuth().getToken()` returns the JWT; pass as `Authorization: Bearer <token>`. This is how `useToolApi` already does it — just inline the call sites.

## Backend coupling

| Endpoint | Method | Auth | Credits | Notes |
|---|---|---|---|---|
| `/api/roasts/stats` | GET | none | none | Public counter — total roasts, total users (social proof) |
| `/api/roasts/recent` | GET | none | none | Last 20 roasts feed (public) |
| `/api/roasts/mine` | GET | `requireAuth` | none | User's own past roasts (auth required) |
| `/api/roasts/mine/:id` | GET | `requireAuth` | none | Single past roast detail |
| `/api/demos/page-roast` | POST | `requireAuth` | 1 token (paid; free-tier gets 3 free roasts via IP hashing) | Submit a URL, get a roast |
| `/api/demos/page-roast/compare` | POST | `requireAuth` | 2 tokens | A/B compare two URLs |

**Same-origin OK?** Yes — all calls from `bilko.run/projects/page-roast/` to `bilko.run/api/...` are same-origin.

**SSRF / URL fetching.** Server uses `validatePublicUrl` + `fetchPageBounded` from `server/services/page-fetch.ts`. The standalone POSTs the user's URL string to `/api/demos/page-roast`; **the server fetches it under the safe boundary**. Standalone must NEVER try to fetch the URL itself in the browser (CORS would block + would expose the user's IP to the target).

**Free-tier rate limiting (3 roasts/session via IP hashing).** Lives server-side in `_shared.ts:checkRateLimit`. Unchanged.

## Test coverage

| Test file | References page-roast? | Action |
|---|---|---|
| `tests/page-fetch.test.ts` | Tests `validatePublicUrl` + `fetchPageBounded` — these are the SSRF-safe utilities PageRoast depends on. Stays in the host. | leave |
| `tests/auth.test.ts` | Tests `requireAuth` (used by all roast endpoints) | leave |
| `tests/tokens.test.ts` | Tests `deductToken` / `grantFreeTokens` | leave |
| `tests/db.test.ts` | Tests `roast_history` + `user_roasts` table creation. **Tables stay** — server endpoints stay in the host. | leave |
| `e2e/local-score.spec.ts` | no | leave |

## External references (LONG list — PageRoast is the brand flagship)

| Where | What | Action |
|---|---|---|
| `src/config/tools.ts:146,147` | PageRoast's own `crossPromo` to `headline-grader`, `ad-scorer` | Becomes irrelevant after the tool is removed; this `{}` block is deleted entirely |
| Other tools' `crossPromo` arrays | Many `{ slug: 'page-roast', ... }` entries | All resolved via `MaybeStandaloneRedirect` after registration in `standalone-projects.json` |
| `server/db.ts` blog seeds (lines 354, 383, 385, 410, 418, 422, 489) | "How PageRoast Went From..." blog post + "PageRoast" mentioned in StackAudit blog post + cross-promo paragraphs | URL `/projects/page-roast` already works. Blog content stays. |
| `src/data/portfolio.ts:115` | `'PageRoast — live'` ticker text | Cosmetic |
| `src/pages/PricingPage.tsx`, every other tool's FAQ list | "PageRoast" mentioned in tool lists | Cosmetic; `/products/page-roast` URLs redirect via `MaybeStandaloneRedirect` |
| `src/pages/HomePage.tsx`, hero copy | Likely mentions PageRoast as a featured product | Stays — `/projects/page-roast/` route works post-extraction |
| `src/pages/NotFoundPage.tsx` | Possibly suggests PageRoast as a top-tool quick link | Cosmetic |
| Sitemap / OG meta | If there's a sitemap, `/products/page-roast` and `/projects/page-roast/` should both resolve. The redirect handles it. | Verify after publish |

## Standalone repo setup

### `package.json`
```json
{
  "name": "page-roast",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "sync": "rm -rf ../Bilko/public/projects/page-roast && cp -r dist ../Bilko/public/projects/page-roast"
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
  base: '/projects/page-roast/',
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
    <meta name="description" content="PageRoast · Brutally honest landing page audits. CRO score + savage roast in 30 seconds." />
    <meta property="og:title" content="PageRoast" />
    <meta property="og:description" content="Brutally honest landing page audits. CRO score + savage roast." />
    <title>PageRoast · Landing page roasts that actually help</title>
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
import { PageRoastPage } from './PageRoastPage.js';
import './index.css';

const CLERK_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ?? 'pk_live_Y2xlcmsuYmlsa28ucnVuJA';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ClerkProvider publishableKey={CLERK_KEY}>
      <PageRoastPage />
    </ClerkProvider>
  </React.StrictMode>,
);
```

### `src/index.css`
PageRoast uses the **most** custom CSS of any tool — a fire-themed animation suite. Copy from host's `src/index.css`:

```css
@import "tailwindcss";

@theme {
  /* Warm + fire (PageRoast's primary palette) + grade colors */
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

  --color-fire-50:  #fff7f0;
  --color-fire-100: #ffede0;
  --color-fire-200: #ffd6b8;
  --color-fire-300: #ffb380;
  --color-fire-400: #ff8a47;
  --color-fire-500: #ff6b1a;
  --color-fire-600: #e85a0a;
  --color-fire-700: #c04808;
  --color-fire-800: #993a0a;
  --color-fire-900: #7a310d;

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

/* Animations referenced by PageRoast (copy ALL of these from host src/index.css) */
@keyframes slide-up        { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
@keyframes fade-in         { from { opacity: 0; } to { opacity: 1; } }
@keyframes score-count     { /* host CSS */ }
@keyframes pulse-glow      { /* host CSS */ }
@keyframes shimmer         { /* host CSS */ }
@keyframes flame-rise      { /* host CSS */ }
@keyframes flame-flicker   { /* host CSS */ }
@keyframes ember-float     { /* host CSS */ }
@keyframes roast-shake     { /* host CSS */ }
@keyframes heat-wave       { /* host CSS */ }
@keyframes border-burn     { /* host CSS */ }
@keyframes result-slam     { /* host CSS */ }

.animate-slide-up    { animation: slide-up 0.5s ease-out both; }
.animate-fade-in     { animation: fade-in 0.4s ease-out both; }
/* + every .animate-* / .shadow-fire-glow / etc that PageRoastPage references */
```

**Action item:** before writing the standalone, `grep -nE "@keyframes|\.animate-|\.shadow-fire-|\.text-display" ~/Projects/Bilko/src/index.css | head -100` and copy every block PageRoast references. The host's `src/index.css` has fire-themed animations that no other tool uses — they're effectively PageRoast's CSS. After extraction, those blocks can be DELETED from the host's `src/index.css` (they're orphaned).

### `src/kit.tsx`
Inline only: `track`, `<CrossPromo>`. PageRoast does NOT use `<ToolHero>` / `<ScoreCard>` / `<SectionBreakdown>` / `<CompareLayout>` / `<Rewrites>` — its UI is fully bespoke.

The slim `<CrossPromo>` should hardcode the now-fully-extracted neighbors. By migration #9, every other tool is also a sibling at `/projects/<slug>/`:
```ts
const CROSS_PROMO = [
  { slug: 'headline-grader', name: 'HeadlineGrader', hook: "Roasted your page? Now grade the headline that's selling it." },
  { slug: 'ad-scorer', name: 'AdScorer', hook: "Fixed your page? Score the ad that's driving traffic to it." },
];
// All neighbors are static-path now — every link goes to /projects/<slug>/
```

### `src/api.ts`
PageRoast doesn't use `useToolApi`. Inline a small helper for JWT-bearer fetch:
```ts
import { useAuth } from '@clerk/clerk-react';
const HOST = 'https://bilko.run';
const API = `${HOST}/api`;

export function useAuthedFetch() {
  const { getToken } = useAuth();
  return async (path: string, init: RequestInit = {}) => {
    const token = await getToken();
    return fetch(`${API}${path}`, {
      ...init,
      headers: {
        ...(init.headers ?? {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        'Content-Type': 'application/json',
      },
    });
  };
}
```

The page's existing `fetch()` calls become `await api(path, { method, body })`.

## Auth/credit migration

Same-origin from `bilko.run/projects/page-roast/` → `bilko.run/api/...`. Clerk session cookie travels for the JWT-bearer pattern.

PageRoast's auth complexity:
- Anonymous users can call `/api/roasts/stats` and `/api/roasts/recent` (public)
- Anonymous users can call `/api/demos/page-roast` for free roasts (rate-limited by IP hashing, 3/session)
- Authed users get the JWT bearer header → `requireAuth` succeeds; their email is used for token deduction
- `/api/roasts/mine` requires auth — standalone uses `useAuth().getToken()` to get the JWT

All same-origin → cookies + JWT travel naturally. No CORS issues in production.

## Step-by-step extraction sequence

```bash
# 1. Init
mkdir -p ~/Projects/Page-Roast/src && cd ~/Projects/Page-Roast && git init -q

# 2. Create config files (paste contents above)

# 3. Copy page + build local helpers
cp ~/Projects/Bilko/src/pages/PageRoastPage.tsx src/PageRoastPage.tsx
# Build src/api.ts (useAuthedFetch helper) — see above
# Build src/kit.tsx with track + CrossPromo only

# 4. Copy + extend src/index.css from host (every keyframe + utility PageRoast uses)
# Run this in the host repo first to extract the CSS blocks:
grep -nE "@keyframes|^\.animate-|^\.shadow-fire-|^\.text-display" ~/Projects/Bilko/src/index.css
# Then copy each referenced block into ~/Projects/Page-Roast/src/index.css

# 5. Adapt the page imports:
#    OLD: import { Link } from 'react-router-dom';
#    NEW: (drop; replace with <a href="https://bilko.run/...">)
#    OLD: import { CrossPromo } from '../components/tool-page/index.js';
#    NEW: import { CrossPromo } from './kit.js';
#    OLD: import { track } from '../hooks/usePageView.js';
#    NEW: import { track } from './kit.js';
#    Keep useUser/useAuth/useClerk/<SignInButton> imports from '@clerk/clerk-react'.
#    Replace bare `fetch('/api/...')` calls with the api helper from src/api.ts.

# 6. Build
pnpm install && pnpm build

# 7. Wire .mcp.json
cat > .mcp.json <<'EOF'
{"mcpServers":{"bilko-host":{"command":"node","args":["/home/bilko/Projects/Bilko/mcp-host-server/dist/server.js"]}}}
EOF

# 8. Register + publish via MCP
#    bilko-host__register_static_project { slug: "page-roast", name: "PageRoast",
#      tagline: "Brutally honest landing page audits",
#      category: "AI Tool · Productivity", status: "live", year: 2026,
#      sourceRepo: "github.com/StanislavBG/page-roast",
#      localPath: "~/Projects/Page-Roast",
#      tags: ["CRO", "Roast"] }
#    bilko-host__publish_static_project { slug: "page-roast", distPath: "/home/bilko/Projects/Page-Roast/dist" }

# 9. Remove from host (KEEP server route — standalone calls /api/roasts/* and /api/demos/page-roast)
cd ~/Projects/Bilko
rm src/pages/PageRoastPage.tsx
# DO NOT rm server/routes/tools/page-roast.ts
# Edit src/config/tools.ts: delete the slug:'page-roast' { ... } block (lines ~124-150)

# 10. CLEANUP — host is now framework-only:
#  src/config/tools.ts is empty → either delete or repurpose as a docs stub
#  src/index.css fire-themed animations are now orphaned → delete (they only existed for PageRoast)
#  src/components/tool-page/* may have orphaned components if no in-repo tools remain → audit
#  Update CLAUDE.md tool list (remove PageRoast and earlier-extracted tools from the in-repo list)
#  Update docs/migration-plan.md to mark all 9 done

# 11. Verify host
pnpm exec tsc --noEmit
pnpm test
pnpm exec vite build  # main bundle is now tiny — host is framework-only
node dist-server/server/index.js &
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:4000/projects/page-roast/
for path in roasts/stats roasts/recent demos/page-roast demos/page-roast/compare; do
  curl -s -o /dev/null -w "$path: %{http_code}\n" http://127.0.0.1:4000/api/$path
done
# Stats + recent → 200, demos → 401 (POST without auth)

# 12. Commit + push host
git add -A && git commit -m "Extract PageRoast to ~/Projects/Page-Roast (kick-out complete: host is framework-only)"
git push origin main && git push content-grade main:master

# 13. GitHub repo
cd ~/Projects/Page-Roast
git add -A && git commit -m "Initial: extract PageRoast from Bilko monorepo (final extraction)"
gh repo create StanislavBG/page-roast --public --source=. --push \
  --description "Standalone landing page CRO audit + savage roast. Static-path app on bilko.run/projects/page-roast/"
```

## Risks / gotchas specific to this tool

- **Brand flagship — cosmetic regressions are highly visible.** Budget extra visual smoke-testing time. Compare side-by-side with the live `bilko.run/products/page-roast` (still up while you build the standalone) before flipping.
- **SSRF-safe URL fetch boundary.** All URL fetching stays server-side via `validatePublicUrl` + `fetchPageBounded`. The standalone NEVER calls `fetch(userUrl)` directly in the browser.
- **Share cards (OG image generation).** If PageRoast has a `<meta property="og:image">` route that generates a share image of the roast result, that endpoint may live in `server/routes/tools/page-roast.ts` or in a separate route. Check before extraction. The standalone may need to call back to a host endpoint for the share image.
- **Recent-roasts feed.** `/api/roasts/recent` returns 20 recent roasts with URLs. Standalone displays this; verify URLs render safely (no XSS via the `roast` string).
- **User-history view.** `/api/roasts/mine` and `/api/roasts/mine/:id` need the JWT bearer header. The slim `useAuthedFetch` helper handles this; verify after extraction by signing in and checking the history view loads.
- **Free-tier IP rate limiting.** Server-side, unchanged. Standalone passes no rate-limit awareness — just hits the endpoint and reads the 429 response.
- **Fire-themed animations.** PageRoast uses 7+ custom keyframes (flame-rise, flame-flicker, ember-float, roast-shake, heat-wave, border-burn, result-slam) that no other tool uses. After extraction these become orphaned in the host CSS — delete them to slim the host bundle.
- **Empty `src/config/tools.ts` after extraction.** Decide: delete the file entirely (`LISTING_TOOLS = []` is a degenerate registry; `projectsRegistry.ts` derives `TOOL_PROJECTS` from it which becomes empty), or keep as a docs stub. If you delete, also remove the import in `projectsRegistry.ts` and have it just spread `STANDALONE_PROJECTS`.
- **CSS orphans.** After every tool is extracted, `src/index.css` will have many unused `@theme` color tokens (indigo, emerald, sky, amber, purple, slate, cyan, green, fire). Delete the unused ones — the host UI itself uses only warm + maybe one accent for the brand.
- **CORS on dev.** Same caveat as previous extractions.
- **Content-Grade master push delay.** Render redeploys on push; the brand flagship URL `bilko.run/projects/page-roast/` will be the static-path version after this push lands. There's a brief window where the old `bilko.run/products/page-roast` returns the host's NotFound (because you removed it from `LISTING_TOOLS`); the `MaybeStandaloneRedirect` catches it and forwards to `/projects/page-roast/`. So worst case is a one-extra-hop redirect, not a 404.

## Verification checklist

- [ ] `pnpm exec tsc --noEmit` (host) → 0 errors
- [ ] `pnpm test` (host) → 27/27 pass
- [ ] `pnpm exec vite build` (host) → no `PageRoastPage-*.js` chunk; main `index-*.js` is tiny (<100KB)
- [ ] `pnpm exec tsc -p tsconfig.server.json` (host) → server compiles
- [ ] `curl /projects/page-roast/` → 200, returns standalone `index.html`
- [ ] `curl /api/roasts/stats` → 200 (public)
- [ ] `curl /api/roasts/recent` → 200 (public)
- [ ] `curl -X POST /api/demos/page-roast` → 401 (auth required)
- [ ] `curl /products/page-roast` → 200 (returns SPA shell which redirects to `/projects/page-roast/` via `MaybeStandaloneRedirect`)
- [ ] Browser smoke: paste a real URL (e.g. example.com), get a roast back. Sign in. Check history view loads. Check recent-roasts feed renders. Check share/screenshot looks right.
- [ ] Open share card URL — verify OG image generates correctly
- [ ] `bilko-host__list_projects` shows `page-roast`
- [ ] `bilko-host__status` shows clean tree

## Estimated effort

**~2 hours.** Justification:
- Brand flagship — cosmetic regression budget (visual smoke + side-by-side comparison) is ~30 min alone
- 1,496-line page to read carefully (no `useToolApi` shortcut → bare fetches to inline)
- 6 endpoints to verify (stats, recent, mine, mine/:id, demos, demos/compare)
- Custom CSS (7+ animations) to copy + then delete from host
- Host cleanup after this migration: empty `tools.ts`, orphan animations in `index.css`, possibly unused tool-page kit components — budget ~30 min
- Final commit message marks the kick-out completion

After this migration: host is framework-only. CLAUDE.md and `docs/migration-plan.md` get a "DONE" footer. The bilko.run iPhone analogy is fully realized — 12+ apps, one home button.
