# Extraction plan: ThreadGrader

**Slug:** `thread-grader` · **Target repo:** `~/Projects/Thread-Grader/` · **Migration #6** (template work — same shape as AdScorer/HeadlineGrader, swap accent + slug).

## Inventory

| | Value |
|---|---|
| Page | `src/pages/ThreadGraderPage.tsx` (1,074 lines) |
| Server | `server/routes/tools/thread-grader.ts` (290 lines) |
| Tool entry | `src/config/tools.ts:203` (`category: 'content'`, `status: 'live'`) |
| Theme | sky: `--color-sky-400/500/600` |
| Endpoints | `POST /api/demos/thread-grader`, `/compare`, `/generate` (3 routes) |

**Page imports** — same shape as AdScorer (full kit):
```ts
import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { SignInButton } from '@clerk/clerk-react';
import { useToolApi } from '../hooks/useToolApi.js';
import { track } from '../hooks/usePageView.js';
import { ToolHero, ScoreCard, SectionBreakdown, CompareLayout, Rewrites, CrossPromo } from '../components/tool-page/index.js';
```

**Tailwind tokens:** warm + sky + grade-* + standard utilities.

## Frontend coupling

Identical to AdScorer/HeadlineGrader (full kit). Differences:
- Theme color: sky (vs emerald / indigo)
- `useRef` is in the import list but verify whether it's actually used (some pages keep stale refs after refactor)
- Page renders tweet-by-tweet breakdown — likely uses `<SectionBreakdown>` per tweet

## Backend coupling

| Endpoint | Method | Auth | Credits | Notes |
|---|---|---|---|---|
| `/api/demos/thread-grader` | POST | Clerk JWT | 1 token | Score one thread (multi-line input parsed into tweets server-side) |
| `/api/demos/thread-grader/compare` | POST | Clerk JWT | 2 tokens | A/B compare |
| `/api/demos/thread-grader/generate` | POST | Clerk JWT | 1 token | Inverse mode (uses shared `handleGenerateEndpoint`) |

Same-origin from `bilko.run/projects/thread-grader/` → `bilko.run/api/demos/thread-grader{,/compare,/generate}`. Clerk session + JWT travel naturally.

## Test coverage

| Test file | References thread-grader? | Action |
|---|---|---|
| All `tests/` | indirect (auth, tokens) | leave |
| `e2e/local-score.spec.ts` | no | leave |

No ThreadGrader-specific tests.

## External references

| Where | What | Action |
|---|---|---|
| `src/config/tools.ts:222,223` | ThreadGrader's `crossPromo` to `headline-grader`, `audience-decoder` | Data only |
| Other tools' `crossPromo` | `{ slug: 'thread-grader', ... }` in HeadlineGrader, AudienceDecoder, EmailForge | Leave; resolved via `MaybeStandaloneRedirect` |
| `server/db.ts` blog seeds | "ThreadGrader" mentioned in PageRoast blog seed (line 414) | URL `/projects/thread-grader` already works |
| `src/pages/PricingPage.tsx`, FAQ entries | "ThreadGrader" in tool lists | Cosmetic |

## Standalone repo setup

### `package.json`
Mirror AdScorer's; swap `"name": "thread-grader"` and adjust sync path.

### `vite.config.ts`
```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base: '/projects/thread-grader/',
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
    <meta name="description" content="ThreadGrader · Score your X/Twitter threads. Hook strength, tension chain, payoff, and share triggers." />
    <title>ThreadGrader · X/Twitter thread scoring</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

### `src/main.tsx`
Mirror AdScorer; replace component to `<ThreadGraderPage />`.

### `src/index.css`
Same warm + grade base, swap accent to **sky**:
```css
/* ThreadGrader accent — sky */
--color-sky-400: #38bdf8;
--color-sky-500: #0ea5e9;
--color-sky-600: #0284c7;
```

### `src/kit.tsx`
**Reuse the kit from AdScorer/HeadlineGrader.** If you've published `@bilko/host-kit` by now, just `pnpm add @bilko/host-kit` instead of inlining. Otherwise: copy `~/Projects/Headline-Grader/src/kit.tsx`, update the `CROSS_PROMO` array to point at ThreadGrader's neighbors (`headline-grader`, `audience-decoder`), update the gradient/glow colors to sky.

### `src/useToolApi.ts`
Copy from host, swap API base.

## Auth/credit migration

Identical to AdScorer. Same-origin same-cookie same-JWT. Token deduction unchanged on server (1 / 2 / 1 for the 3 endpoints).

## Step-by-step extraction sequence

```bash
# 1. Init
mkdir -p ~/Projects/Thread-Grader/src && cd ~/Projects/Thread-Grader && git init -q

# 2. Create config files

# 3. Copy page + hook + kit
cp ~/Projects/Bilko/src/pages/ThreadGraderPage.tsx src/ThreadGraderPage.tsx
cp ~/Projects/Bilko/src/hooks/useToolApi.ts src/useToolApi.ts
sed -i "s|/api|https://bilko.run/api|g" src/useToolApi.ts
cp ~/Projects/Headline-Grader/src/kit.tsx src/kit.tsx
# Edit kit: gradient/glow → sky; CROSS_PROMO list → ThreadGrader's neighbors

# 4. Adapt page imports (same 5 substitutions)

# 5. Build
pnpm install && pnpm build

# 6. Wire .mcp.json
cat > .mcp.json <<'EOF'
{"mcpServers":{"bilko-host":{"command":"node","args":["/home/bilko/Projects/Bilko/mcp-host-server/dist/server.js"]}}}
EOF

# 7. Register + publish via MCP
#    bilko-host__register_static_project { slug: "thread-grader", name: "ThreadGrader",
#      tagline: "Score your X/Twitter threads",
#      category: "AI Tool · Content", status: "live", year: 2026,
#      sourceRepo: "github.com/StanislavBG/thread-grader",
#      localPath: "~/Projects/Thread-Grader",
#      tags: ["X/Twitter", "Viral"] }
#    bilko-host__publish_static_project { slug: "thread-grader", distPath: "/home/bilko/Projects/Thread-Grader/dist" }

# 8. Remove from host (KEEP server route)
cd ~/Projects/Bilko
rm src/pages/ThreadGraderPage.tsx
# DO NOT rm server/routes/tools/thread-grader.ts
# Edit src/config/tools.ts: delete the slug:'thread-grader' { ... } block

# 9. Verify host
pnpm exec tsc --noEmit
pnpm test
pnpm exec vite build  # no ThreadGraderPage chunk
node dist-server/server/index.js &
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:4000/projects/thread-grader/
for path in thread-grader thread-grader/compare thread-grader/generate; do
  curl -s -o /dev/null -w "$path: %{http_code}\n" -X POST http://127.0.0.1:4000/api/demos/$path
done

# 10. Commit + push host
git add -A && git commit -m "Extract ThreadGrader to ~/Projects/Thread-Grader (static-path sibling)"
git push origin main && git push content-grade main:master

# 11. GitHub repo
cd ~/Projects/Thread-Grader
git add -A && git commit -m "Initial: extract ThreadGrader from Bilko monorepo"
gh repo create StanislavBG/thread-grader --public --source=. --push \
  --description "Standalone X/Twitter thread viral analysis. Static-path app on bilko.run/projects/thread-grader/"
```

## Risks / gotchas specific to this tool

- **Tweet parsing.** Threads are typically pasted as multi-line text (one tweet per line, or with separators). Server-side parsing handles this — verify the standalone passes the raw text correctly.
- **Tweet-by-tweet breakdown.** Output may be a longer list than AdScorer's 4 pillars; verify `<SectionBreakdown>` slim local renders 5+ items cleanly.
- **Hook rewrites** use `<Rewrites>` — same component as AdScorer/HeadlineGrader.
- **Sky theme.** Color contrast on dark gradient may need a quick visual check.
- **CORS on dev.** Same caveat as previous extractions.

## Verification checklist

- [ ] `pnpm exec tsc --noEmit` → 0 errors
- [ ] `pnpm test` → 27/27 pass
- [ ] `pnpm exec vite build` → no `ThreadGraderPage-*.js` chunk
- [ ] `pnpm exec tsc -p tsconfig.server.json` → server compiles
- [ ] `curl /projects/thread-grader/` → 200
- [ ] `curl -X POST /api/demos/thread-grader{,/compare,/generate}` → 401 each
- [ ] Browser smoke: paste a real thread (~10 tweets), verify scoring + tweet breakdown render
- [ ] `bilko-host__list_projects` shows `thread-grader`

## Estimated effort

**~30 minutes.** Justification:
- Pure template work — reuse kit from previous extraction
- No new endpoint shape (3 endpoints, all standard auth+credit pattern)
- Visual smoke test: ~5 min for sky theme verification

Migration #7 (EmailForge) is similar shape but uses fewer kit components (no `<ScoreCard>` / `<SectionBreakdown>` / `<CompareLayout>` / `<Rewrites>` — it generates emails, doesn't score).
