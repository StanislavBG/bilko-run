# Extraction plan: AudienceDecoder

**Slug:** `audience-decoder` · **Target repo:** `~/Projects/Audience-Decoder/` · **Migration #8** (mostly template work, but unique one-time-purchase auth path via `hasPurchased` + `PRODUCT_KEYS`).

## Inventory

| | Value |
|---|---|
| Page | `src/pages/AudienceDecoderPage.tsx` (1,182 lines — largest after PageRoast) |
| Server | `server/routes/tools/audience-decoder.ts` (239 lines) |
| Tool entry | `src/config/tools.ts:253` (`category: 'content'`, `status: 'live'`) |
| Theme | purple: `--color-purple-400/500/600` |
| Endpoints | `POST /api/demos/audience-decoder`, `/compare` (2 routes) |

**Page imports (`AudienceDecoderPage.tsx:1-6`):**
```ts
import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { SignInButton } from '@clerk/clerk-react';
import { useToolApi } from '../hooks/useToolApi.js';
import { track } from '../hooks/usePageView.js';
import { ToolHero, ScoreCard, CrossPromo } from '../components/tool-page/index.js';
```

**Notable:** kit usage is mid-tier — `<ToolHero>` + `<ScoreCard>` + `<CrossPromo>`. No `<SectionBreakdown>`, no `<CompareLayout>`, no `<Rewrites>`. Page does its own custom rendering for archetypes / engagement / growth opportunities / content calendar.

**Tailwind tokens:** warm + purple + grade-* (ScoreCard) + standard utilities.

## Frontend coupling

| Symbol | Source | Action |
|---|---|---|
| `useToolApi` | host hook | Copy to `src/useToolApi.ts`, swap API base |
| `track()` | host | Inline in `src/kit.tsx` |
| `<ToolHero>` | host kit | Slim local copy with purple gradient |
| `<ScoreCard>` | host kit | Slim local copy + inline `colors.ts` |
| `<CrossPromo>` | host kit | Slim local copy with hardcoded promo (`thread-grader`, `email-forge`) |
| `<SignInButton>` from `@clerk/clerk-react` | Clerk | Keep |
| `<Link>` from `react-router-dom` | router | Replace with `<a href>` |

## Backend coupling

| Endpoint | Method | Auth | Credits | Notes |
|---|---|---|---|---|
| `/api/demos/audience-decoder` | POST | Clerk JWT | **Pro-skip OR `hasPurchased(email, PRODUCT_KEYS.audience_decoder)` OR 1 token** | One-time purchase variant — unique to this tool |
| `/api/demos/audience-decoder/compare` | POST | Clerk JWT | Same model, 2 tokens | A/B compare |

**Same-origin OK?** Yes. Standard same-origin Clerk session.

**One-time purchase model (specific to AudienceDecoder):**
- Server reads `email`, then `hasPurchased(email, PRODUCT_KEYS.audience_decoder)` from `server/services/stripe.ts`
- If purchased: skips token deduction, gives Pro-tier rate limits
- Otherwise: standard subscription / token-deduction path

This logic is in `server/routes/tools/audience-decoder.ts` and `server/routes/tools/_shared.ts:checkRateLimit`. **Stays server-side** — standalone has no awareness of the purchase model. The standalone just calls the endpoint; the server handles tiering.

`PRODUCT_KEYS` is defined in `shared/product-catalog.ts`. The standalone never touches it.

## Test coverage

| Test file | References audience-decoder? | Action |
|---|---|---|
| All `tests/` | indirect | leave |
| `e2e/local-score.spec.ts` | no | leave |

## External references

| Where | What | Action |
|---|---|---|
| `src/config/tools.ts:272,273` | AudienceDecoder's `crossPromo` to `thread-grader`, `email-forge` | Data only |
| Other tools' `crossPromo` | `{ slug: 'audience-decoder', ... }` in ThreadGrader, EmailForge, Stepproof? | Leave |
| `server/db.ts` blog seeds | "AudienceDecoder" mentioned in PageRoast blog seed (line 416) | URL `/projects/audience-decoder` already works |
| `src/pages/PricingPage.tsx`, FAQ entries | "AudienceDecoder" in tool lists | Cosmetic |

## Standalone repo setup

### `package.json`
Mirror AdScorer/HeadlineGrader, swap `"name": "audience-decoder"` and sync path.

### `vite.config.ts`
```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base: '/projects/audience-decoder/',
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
    <meta name="description" content="AudienceDecoder · Decode who actually follows you. Audience archetypes + engagement model + content calendar." />
    <title>AudienceDecoder · Audience archetype + engagement</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

### `src/main.tsx`
Mirror previous extractions; swap component to `<AudienceDecoderPage />`.

### `src/index.css`
Same warm + grade base, swap accent to **purple**:
```css
/* AudienceDecoder accent — purple */
--color-purple-400: #c084fc;
--color-purple-500: #a855f7;
--color-purple-600: #9333ea;
```

### `src/kit.tsx`
Inline: `track`, `<ToolHero>`, `<ScoreCard>`, `<CrossPromo>`. Skip `<SectionBreakdown>`/`<CompareLayout>`/`<Rewrites>` (page doesn't use them). If you've published `@bilko/host-kit`, install it instead of inlining.

### `src/useToolApi.ts`
Copy from host, swap API base.

## Auth/credit migration

Same-origin same-cookie same-JWT. The unique twist is the one-time-purchase tier resolution, which all happens server-side in `_shared.ts:checkRateLimit`:

```ts
if (productKey && await hasPurchased(email, productKey)) {
  // Pro-tier limits; no token deduction
}
```

The standalone POSTs `email` (from Clerk via the JWT-derived identity); the server resolves tier. **No client-side awareness of the one-time-purchase product needed in the standalone.** This is a clean boundary.

If a user has paid for AudienceDecoder one-time and not for a sub: server's `hasPurchased` returns true → no deduction, Pro rate limits. Same as today.

## Step-by-step extraction sequence

```bash
# 1. Init
mkdir -p ~/Projects/Audience-Decoder/src && cd ~/Projects/Audience-Decoder && git init -q

# 2. Create config files

# 3. Copy page + hook + kit
cp ~/Projects/Bilko/src/pages/AudienceDecoderPage.tsx src/AudienceDecoderPage.tsx
cp ~/Projects/Bilko/src/hooks/useToolApi.ts src/useToolApi.ts
sed -i "s|/api|https://bilko.run/api|g" src/useToolApi.ts
# Build src/kit.tsx with track + ToolHero + ScoreCard + CrossPromo
# (or copy from a previous extraction and trim unused components)

# 4. Adapt page imports (5 substitutions)

# 5. Build
pnpm install && pnpm build

# 6. Wire .mcp.json
cat > .mcp.json <<'EOF'
{"mcpServers":{"bilko-host":{"command":"node","args":["/home/bilko/Projects/Bilko/mcp-host-server/dist/server.js"]}}}
EOF

# 7. Register + publish via MCP
#    bilko-host__register_static_project { slug: "audience-decoder", name: "AudienceDecoder",
#      tagline: "Decode who actually follows you",
#      category: "AI Tool · Content", status: "live", year: 2026,
#      sourceRepo: "github.com/StanislavBG/audience-decoder",
#      localPath: "~/Projects/Audience-Decoder",
#      tags: ["Audience", "Archetypes"] }
#    bilko-host__publish_static_project { slug: "audience-decoder", distPath: "/home/bilko/Projects/Audience-Decoder/dist" }

# 8. Remove from host (KEEP server route — one-time-purchase logic stays server-side)
cd ~/Projects/Bilko
rm src/pages/AudienceDecoderPage.tsx
# DO NOT rm server/routes/tools/audience-decoder.ts
# Edit src/config/tools.ts: delete the slug:'audience-decoder' { ... } block

# 9. Verify host
pnpm exec tsc --noEmit
pnpm test
pnpm exec vite build
node dist-server/server/index.js &
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:4000/projects/audience-decoder/
for path in audience-decoder audience-decoder/compare; do
  curl -s -o /dev/null -w "$path: %{http_code}\n" -X POST http://127.0.0.1:4000/api/demos/$path
done

# 10. Commit + push host
git add -A && git commit -m "Extract AudienceDecoder to ~/Projects/Audience-Decoder (static-path sibling)"
git push origin main && git push content-grade main:master

# 11. GitHub repo
cd ~/Projects/Audience-Decoder
git add -A && git commit -m "Initial: extract AudienceDecoder from Bilko monorepo"
gh repo create StanislavBG/audience-decoder --public --source=. --push \
  --description "Standalone audience archetype + engagement analysis. Static-path app on bilko.run/projects/audience-decoder/"
```

## Risks / gotchas specific to this tool

- **One-time-purchase auth path.** This is the only tool using `hasPurchased` + `PRODUCT_KEYS.audience_decoder`. **All logic is server-side in `_shared.ts:checkRateLimit`** — no client-side awareness needed. Standalone is unaware of the purchase product. Don't try to add it.
- **Stripe webhook for one-time purchases.** The `payment_intent.succeeded` webhook handler in `server/routes/stripe.ts` records the purchase against `PRODUCT_KEYS.audience_decoder`. That handler stays in the host. Verify after extraction by checking that a test purchase still records correctly via `hasPurchased`.
- **Large input** (10-20 social media posts pasted). The page may have client-side validation for input size — keep that check in the standalone to avoid 400-response round trips.
- **Custom rendering** of archetypes / engagement / growth / calendar — fully self-contained in the page. No host kit involvement.
- **No `<SectionBreakdown>` / `<CompareLayout>`** — page renders these custom. Smaller kit inline.
- **CORS on dev.** Same caveat.

## Verification checklist

- [ ] `pnpm exec tsc --noEmit` → 0 errors
- [ ] `pnpm test` → 27/27 pass
- [ ] `pnpm exec vite build` → no `AudienceDecoderPage-*.js` chunk
- [ ] `pnpm exec tsc -p tsconfig.server.json` → server compiles
- [ ] `curl /projects/audience-decoder/` → 200
- [ ] `curl -X POST /api/demos/audience-decoder{,/compare}` → 401 each
- [ ] Browser smoke: sign in, paste ~15 posts, verify decoded archetypes render. If you have a one-time-purchase test account, verify it skips token deduction.
- [ ] `bilko-host__list_projects` shows `audience-decoder`

## Estimated effort

**~45 minutes.** Justification:
- Page is large (1,182 lines) with custom rendering for 4 sub-sections (archetypes, engagement, growth, calendar) → more reading
- Mid-tier kit (3 components inlined) — less than the score-tools, more than EmailForge
- One-time purchase logic is a no-op for the client side; verifying server-side after extraction is a 5-min smoke test
