# Agent 8 — Site Integration

## Objective
Wire CardSpotter into the bilko.run ecosystem: routes, navigation, product listing, theme, and OG meta tags.

## Dependencies
- Agent 6 (Frontend page must exist to route to)

## What to Modify

### 1. Router: `src/App.tsx`

Add lazy import:
```typescript
const CardSpotterPage = React.lazy(() =>
  import('./pages/CardSpotterPage.js').then(m => ({ default: m.CardSpotterPage }))
);
```

Add route inside `toolRoutes()`:
```typescript
<Route path="card-spotter" element={lazyRoute(CardSpotterPage)} />
```

### 2. Product Listing: `src/pages/ProjectsPage.tsx`

Add to `PRODUCTS` array:
```typescript
{
  slug: 'card-spotter',
  name: 'CardSpotter',
  tagline: 'Identify playing cards from a photo',
  description: 'Upload a photo of your hand. AI spots every card and evaluates your poker hand instantly.',
  status: 'live',
  category: 'business',
  features: ['Card identification', 'Poker hand evaluation', 'Confidence scoring', 'Image quality check'],
  accent: 'hover:border-rose-300',
  accentDot: 'bg-rose-500',
}
```

### 3. Theme: `src/components/tool-page/themes.ts`

Add `card-spotter` theme:
```typescript
'card-spotter': {
  heroGradient: 'from-[#1a0a0a] via-[#0f0505] to-[#1a0a0a]',
  glowColor: 'rgba(225,29,72,0.14)',
  accentText: 'text-rose-400',
  accentTextLight: 'text-rose-500',
  buttonBg: 'bg-rose-500',
  buttonHover: 'hover:bg-rose-600',
  buttonShadow: 'shadow-rose-900/30',
},
```

### 4. Navigation: `src/components/Layout.tsx`

Add CardSpotter to the PRODUCTS dropdown (the nav menu). Insert alongside other standalone tools:

```typescript
{
  title: 'CardSpotter',
  desc: 'Identify cards from a photo',
  to: '/projects/card-spotter',
  accent: 'bg-rose-500',
},
```

### 5. OG Meta Tags: `server/index.ts`

Add to `OG_OVERRIDES`:
```typescript
'/projects/card-spotter': {
  title: 'CardSpotter — Identify Playing Cards from a Photo',
  description: 'Upload a photo of your hand. AI identifies every card and evaluates your poker hand. Instant results.',
  url: 'https://bilko.run/projects/card-spotter',
},
```

Register both paths (backward compat):
```typescript
'/products/card-spotter': { /* same as above */ },
```

### 6. Homepage: `src/pages/HomePage.tsx`

Add CardSpotter to the tools table array (if one exists showing all tools):
```typescript
{ name: 'CardSpotter', slug: 'card-spotter', desc: 'Identify cards from a photo', accent: 'bg-rose-500' }
```

### 7. CrossPromo: `src/components/tool-page/CrossPromo.tsx`

If CrossPromo has a static list of tools, add CardSpotter so other tools can promote it and vice versa.

## Checklist

- [ ] `src/App.tsx` — lazy import + route
- [ ] `src/pages/ProjectsPage.tsx` — PRODUCTS array entry
- [ ] `src/components/tool-page/themes.ts` — card-spotter theme
- [ ] `src/components/Layout.tsx` — nav dropdown entry
- [ ] `server/index.ts` — OG_OVERRIDES + route registration
- [ ] `src/pages/HomePage.tsx` — tools table entry
- [ ] `src/components/tool-page/CrossPromo.tsx` — add to promo pool

## Output
- 7 files modified (no new files)
- CardSpotter accessible at `/projects/card-spotter` and `/products/card-spotter`
- Appears in nav, product listing, homepage tools table

## Validation
- Navigate to `/projects/card-spotter` → page loads
- Check nav dropdown → CardSpotter appears with rose accent dot
- Check `/projects` page → CardSpotter listed with correct tagline
- View page source → OG tags present
- Check CrossPromo on other tool pages → CardSpotter appears
