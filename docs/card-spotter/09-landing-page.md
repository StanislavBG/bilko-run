# Agent 9 — Standalone Landing Page

## Objective
Design and build CardSpotter's marketing/landing page — a standalone page that works as if CardSpotter were its own product, independent from bilko.run.

## Dependencies
None — can start immediately. This is a static marketing page with no API calls.

## What to Build

### File: `src/pages/CardSpotterLanding.tsx` (NEW)

Separate from the tool page (`CardSpotterPage.tsx`). This is the marketing page that convinces someone to try the tool. Think of it as `cardspotter.com` even though it lives at `bilko.run/projects/card-spotter/about`.

### Route
Add to `src/App.tsx`:
```typescript
<Route path="card-spotter/about" element={lazyRoute(CardSpotterLanding)} />
```

### Page Sections

---

#### 1. Hero
Full-width dark section with the rose/red gradient.

**Headline:** "What's in your hand?"
**Subhead:** "Upload a photo. AI identifies every card in seconds."
**CTA:** "Try it free →" (links to `/projects/card-spotter`)
**Visual:** Fanned-out card illustration using Unicode/CSS (not an image):
```
  ♠A  ♥K  ♦Q  ♣J  ♠10
```
Rendered as overlapping mini card components with slight rotation.

---

#### 2. Demo Strip (static mockup)
Show a before/after:
- Left: Photo placeholder (blurred stock-image-style card fan)
- Right: Card tiles output (A♠, K♥, Q♦, J♣, 10♠) with confidence bars
- Arrow between them

Text: "Photo in → Cards out. That's it."

---

#### 3. How It Works (3 steps)

| Step | Icon | Title | Description |
|------|------|-------|-------------|
| 1 | 📸 | Take a photo | Snap your hand with your phone or upload any image |
| 2 | 🤖 | AI identifies | Gemini Vision spots every card, rank, and suit |
| 3 | 🃏 | Get results | See your cards listed with confidence + poker hand evaluation |

---

#### 4. What You Get
Feature cards in a 2x2 grid:

**Card Identification**
Every card spotted with rank and suit. Works with partial hands (2-7 cards).

**Confidence Scoring**
See how certain the AI is about each card. High confidence = green, uncertain = amber.

**Poker Hand Evaluation**
Automatically evaluates the best poker hand: Royal Flush through High Card.

**Image Quality Check**
Tells you if the photo is too blurry, dark, or obscured — and what to fix.

---

#### 5. Use Cases

**Poker Night** — "Forgot your hand? Snap a pic before you fold."
**Learning Poker** — "New to poker? See what hand you have instantly."
**Card Games** — "Settle debates about who had what."
**Content Creators** — "Overlay card data on your poker stream."

---

#### 6. Best Results Tips

Tips section styled as a card grid:

- **Good lighting** — avoid shadows across the cards
- **Face up** — cards must be face-up and visible
- **Steady shot** — no motion blur
- **Flat surface** — fan cards out, don't stack them
- **Fill the frame** — get close enough to read the pips

---

#### 7. Pricing
Simple, clean:

```
$1 per scan
No subscription. No signup required.
Buy credits when you need them.
```

Link to bilko.run pricing page.

---

#### 8. FAQ

**Q: How accurate is it?**
A: Very. Gemini Vision correctly identifies cards in well-lit photos with 90%+ accuracy. Blurry or dark photos may have lower confidence.

**Q: Does it work with any card deck?**
A: Standard 52-card decks with English rank/suit markings. Custom or non-standard decks may not be recognized.

**Q: What happens to my photo?**
A: Your image is sent to our server, processed by Gemini AI, and immediately discarded. We never store your photos.

**Q: How many cards can it spot at once?**
A: Any number in a single image. Works best with 2-7 cards (a typical hand).

**Q: Does it work on mobile?**
A: Yes. You can take a photo directly from the tool using your phone camera.

---

#### 9. CTA Footer
Dark section matching hero:

**"See what you're holding."**
[Try CardSpotter →]

---

### Design Tokens

- **Primary color:** Rose/Red (`rose-500`, `rose-600`)
- **Background gradient:** `from-[#1a0a0a] via-[#0f0505] to-[#1a0a0a]`
- **Card suit colors:** Black for ♠♣, Red (`red-600`) for ♥♦
- **Typography:** Use the bilko.run design system (`.text-display-xl`, `.text-display-lg`, negative letter-spacing)
- **Shadows:** Use `shadow-elevation-1/2/3` from the existing system
- **Cards as UI elements:** Mini card tiles (white bg, border, suit-colored text) used as decorative elements throughout

### Voice & Tone

Casual, confident, slightly fun. Not corporate. Not gamer-bro.
- "What's in your hand?"
- "Photo in → Cards out."
- "See what you're holding."

### Responsive
- Mobile-first: single column
- Desktop: 2-column layouts for demo strip and feature grid
- Card tiles wrap naturally in flex containers

## Output
- `src/pages/CardSpotterLanding.tsx` (NEW)
- Route added to `src/App.tsx`
- No API calls, no backend changes
- Fully static/marketing page

## Validation
- Navigate to `/projects/card-spotter/about` → landing page loads
- All sections render correctly on mobile and desktop
- CTA links go to `/projects/card-spotter` (the tool)
- No broken images or missing styles
