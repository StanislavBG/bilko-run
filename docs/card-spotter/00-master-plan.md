# CardSpotter — Master Plan

## What It Is

CardSpotter is a bilko.run tool that identifies playing cards from a photo of a hand. Upload an image → get a list of every card visible. Uses Gemini 2.0 Flash vision API server-side.

**URL:** `bilko.run/projects/card-spotter`
**Pricing:** $1/credit (shared bilko.run credit model)
**Status:** New tool (#11)

---

## Product Requirements

### Core Flow
1. User uploads/drops/pastes an image of a card hand
2. Server sends image to Gemini Vision API
3. AI identifies each visible card (rank + suit)
4. Returns structured list + confidence + hand evaluation
5. User sees results with visual card representations

### Input
- Single image (JPEG, PNG, WebP)
- Max 10MB
- Sources: file upload, drag-and-drop, clipboard paste, camera capture (mobile)

### Output
```json
{
  "cards": [
    { "rank": "A", "suit": "spades", "confidence": 0.98 },
    { "rank": "K", "suit": "hearts", "confidence": 0.95 },
    { "rank": "7", "suit": "diamonds", "confidence": 0.91 }
  ],
  "count": 3,
  "hand_evaluation": {
    "name": "High Card — Ace",
    "poker_rank": 10,
    "description": "No matching cards. Ace-high."
  },
  "image_quality": {
    "score": 0.85,
    "issues": []
  }
}
```

### Poker Hand Evaluation
Evaluate the identified cards as a poker hand:
- Royal Flush, Straight Flush, Four of a Kind, Full House, Flush,
  Straight, Three of a Kind, Two Pair, One Pair, High Card
- Works for 5-card and partial hands (2-7 cards)

---

## Architecture

### Pipeline Design (parallel-ready)

```
Image Upload
    │
    ���
┌─────────────┐
│  Validate   │  ← Agent 3: Image validation, resize, format check
│  & Prepare  │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Gemini     │  ← Agent 4: Vision API integration (new askGeminiVision)
│  Vision API │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Parse &    │  ← Agent 5: Response parser, card normalization
│  Normalize  │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Evaluate   │  ← Agent 6: Poker hand evaluator (pure logic, no AI)
│  Hand       │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Render     │  ← Agent 7-8: Frontend results UI
│  Results    │
└─────────────┘
```

### Tech Decisions
- **Gemini 2.0 Flash** — already in stack, supports vision via same REST API
- **Image sent as base64** in the `inlineData` part (Gemini content API)
- **No image stored** — processed in memory, never written to disk/DB
- **Server-side only** — unlike LocalScore, this needs Gemini API
- **Shared credit model** — 1 credit per analysis via existing token system

---

## Agent Work Packages

10 parallel-safe work packages. Dependencies noted — agents can start immediately on packages with no deps.

| # | Package | Deps | Agent Doc |
|---|---------|------|-----------|
| 1 | Gemini Vision Client | None | `01-gemini-vision.md` |
| 2 | Server Route & API | #1 | `02-server-route.md` |
| 3 | Image Validation | None | `03-image-validation.md` |
| 4 | Card Parser & Normalizer | None | `04-card-parser.md` |
| 5 | Poker Hand Evaluator | None | `05-hand-evaluator.md` |
| 6 | Frontend Page — Layout & Input | None | `06-frontend-input.md` |
| 7 | Frontend Page — Results UI | #4, #5 types | `07-frontend-results.md` |
| 8 | Site Integration | #6 | `08-site-integration.md` |
| 9 | Standalone Landing Page | None | `09-landing-page.md` |
| 10 | Tests & E2E | #2, #6 | `10-tests.md` |

### Parallelism Map

**Wave 1 (no deps — start immediately):**
- Agent 1: Gemini Vision Client
- Agent 3: Image Validation
- Agent 4: Card Parser & Normalizer
- Agent 5: Poker Hand Evaluator
- Agent 6: Frontend Input UI
- Agent 9: Standalone Landing Page

**Wave 2 (after Wave 1):**
- Agent 2: Server Route (needs #1)
- Agent 7: Frontend Results UI (needs #4, #5 type interfaces)
- Agent 8: Site Integration (needs #6)

**Wave 3 (after Wave 2):**
- Agent 10: Tests & E2E (needs #2, #6)

---

## File Map (what gets created)

```
server/
  gemini.ts                    ← MODIFY: add askGeminiVision()
  routes/card-spotter.ts       ← NEW: API endpoints
  card-parser.ts               ← NEW: parse Gemini response → Card[]
  hand-evaluator.ts            ← NEW: Card[] → poker hand evaluation
  image-validation.ts          ← NEW: validate, resize, extract base64

src/
  pages/CardSpotterPage.tsx    ← NEW: tool page (input + results)
  pages/CardSpotterLanding.tsx ← NEW: standalone marketing page
  App.tsx                      ← MODIFY: add routes
  components/
    tool-page/themes.ts        ← MODIFY: add card-spotter theme
    Layout.tsx                 ← MODIFY: add to nav dropdown
  pages/ProjectsPage.tsx       ← MODIFY: add to PRODUCTS array

server/index.ts                ← MODIFY: register routes + OG tags

tests/
  card-parser.test.ts          ← NEW: unit tests
  hand-evaluator.test.ts       ← NEW: unit tests
  image-validation.test.ts     ← NEW: unit tests

e2e/
  card-spotter.spec.ts         ← NEW: Playwright E2E
```

---

## Design Language

- **Theme color:** Red (playing card back) — `rose-500` / `red-500`
- **Hero gradient:** Deep red/black (`from-[#1a0a0a] via-[#0f0505] to-[#1a0a0a]`)
- **Glow:** `rgba(225,29,72,0.14)` (rose glow)
- **Voice:** Quick, confident, slightly playful — "Let's see what you're holding"
- **Card visuals:** Unicode suit symbols (♠ ♥ ♦ ♣) with suit-colored text
