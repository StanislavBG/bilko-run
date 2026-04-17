# Agent 2 — Server Route & API Endpoint

## Objective
Create the CardSpotter API endpoint that receives an image, calls Gemini Vision, and returns identified cards.

## Dependencies
- **Agent 1** (Gemini Vision Client) — needs `askGeminiVision()` to exist
- Uses types/functions from Agent 3 (image validation), Agent 4 (card parser), Agent 5 (hand evaluator) — but can stub these initially and swap in real implementations later

## Context

All bilko.run tools follow the same server route pattern (see `server/routes/demos.ts`). CardSpotter gets its own route file because it handles binary image data, not text.

## What to Build

### File: `server/routes/card-spotter.ts` (NEW)

```typescript
export function registerCardSpotterRoutes(app: FastifyInstance): void
```

### Endpoint: `POST /api/demos/card-spotter`

**Request:**
```typescript
interface CardSpotterRequest {
  image: string;      // base64-encoded image (with or without data URI prefix)
  mimeType: string;   // image/jpeg | image/png | image/webp
  email?: string;     // for credit deduction
}
```

**Response (success):**
```typescript
interface CardSpotterResponse {
  cards: Card[];
  count: number;
  hand_evaluation: HandEvaluation;
  image_quality: ImageQuality;
  usage?: { balance: number };
}
```

**Response (error):**
```typescript
{ error: string }
```

**Response (gated):**
```typescript
{ gated: true; isPro: boolean; remaining: number; limit: number; message: string }
```

### Implementation Steps

```
1. Parse request body
2. Validate image (Agent 3: validateImage())
   - Check mimeType is allowed
   - Check base64 is valid
   - Check size < 10MB
   - Strip data URI prefix if present
3. Rate limit check (reuse existing checkRateLimit)
4. Build Gemini system prompt (card identification instructions)
5. Call askGeminiVision(base64, mimeType, prompt, { systemPrompt })
6. Parse response (Agent 4: parseCardResponse())
7. Evaluate hand (Agent 5: evaluateHand())
8. Deduct credit if user has token account
9. Record analytics event
10. Return structured response
```

### Gemini System Prompt

```
You are a playing card identification expert. Analyze the image and identify every
standard playing card (from a 52-card deck) visible in the photo.

For each card, provide:
- rank: "2" through "10", "J", "Q", "K", or "A"
- suit: "spades", "hearts", "diamonds", or "clubs"
- confidence: 0.0 to 1.0 (how certain you are about this identification)

Also assess image quality:
- score: 0.0 to 1.0
- issues: array of strings describing problems (e.g., "blurry", "partially obscured", "poor lighting")

Respond with this exact JSON structure:
{
  "cards": [
    { "rank": "A", "suit": "spades", "confidence": 0.95 }
  ],
  "image_quality": {
    "score": 0.8,
    "issues": []
  }
}

Rules:
- Only identify standard playing cards (no jokers, no blank cards)
- If a card is partially visible but identifiable, include it with lower confidence
- If you cannot identify any cards, return an empty cards array
- Order cards by confidence (highest first)
- Do not hallucinate cards that aren't in the image
```

### Fastify Body Size

The default Fastify body size limit is 1MB. Base64-encoded images can be 5-10MB. Configure:

```typescript
app.post('/api/demos/card-spotter', {
  config: { rawBody: false },
  bodyLimit: 15_000_000,  // 15MB to accommodate base64 overhead
}, async (req, reply) => { ... });
```

### File: `server/index.ts` (MODIFY)

```typescript
import { registerCardSpotterRoutes } from './routes/card-spotter.js';
// ... after other route registrations:
registerCardSpotterRoutes(app);
```

Add OG_OVERRIDES entry:
```typescript
'/projects/card-spotter': {
  title: 'CardSpotter — Identify Playing Cards from a Photo',
  description: 'Upload a photo of your hand. AI identifies every card instantly. Poker hand evaluation included.',
  url: 'https://bilko.run/projects/card-spotter',
},
```

## Shared Types

Create `server/types/card-spotter.ts` (NEW) — shared between route, parser, and evaluator:

```typescript
export interface Card {
  rank: string;       // "2"-"10", "J", "Q", "K", "A"
  suit: string;       // "spades", "hearts", "diamonds", "clubs"
  confidence: number; // 0-1
}

export interface HandEvaluation {
  name: string;         // "Two Pair — Kings and Sevens"
  poker_rank: number;   // 1 (Royal Flush) to 10 (High Card)
  description: string;  // Human-readable explanation
}

export interface ImageQuality {
  score: number;      // 0-1
  issues: string[];   // ["blurry", "poor lighting"]
}

export interface CardSpotterResult {
  cards: Card[];
  count: number;
  hand_evaluation: HandEvaluation;
  image_quality: ImageQuality;
  usage?: { balance: number };
}
```

## Output
- `server/routes/card-spotter.ts` (NEW)
- `server/types/card-spotter.ts` (NEW)
- `server/index.ts` (MODIFIED — route registration + OG tags)

## Validation
- POST with valid base64 image → returns card list
- POST with invalid image → returns 400 error
- POST without credits → returns gated response
- POST with oversized image → returns 400 error
