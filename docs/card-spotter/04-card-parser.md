# Agent 4 — Card Parser & Normalizer

## Objective
Parse Gemini Vision response JSON into clean, validated `Card[]` with normalized ranks and suits.

## Dependencies
None — can start immediately. Uses types from `server/types/card-spotter.ts` (Agent 2 creates this, but you can define the types inline and they'll be moved later).

## What to Build

### File: `server/card-parser.ts` (NEW)

```typescript
import type { Card, ImageQuality } from './types/card-spotter.js';

export interface ParsedCardResponse {
  cards: Card[];
  image_quality: ImageQuality;
}

export function parseCardResponse(raw: string): ParsedCardResponse
```

### What Gemini Returns

Gemini responds with JSON (we request `responseMimeType: 'application/json'`), but it's a string that needs parsing. The response may have quirks:

```json
{
  "cards": [
    { "rank": "Ace", "suit": "Spades", "confidence": 0.95 },
    { "rank": "10", "suit": "hearts", "confidence": 0.88 },
    { "rank": "king", "suit": "HEARTS", "confidence": 0.72 }
  ],
  "image_quality": { "score": 0.8, "issues": [] }
}
```

The model may use inconsistent casing, full names instead of abbreviations, or other variations.

### Normalization Rules

**Rank normalization** (case-insensitive):
```
"ace" | "a" | "1"  → "A"
"2" through "10"    → "2" through "10"
"jack" | "j" | "11" → "J"
"queen" | "q" | "12" → "Q"
"king" | "k" | "13"  → "K"
```

**Suit normalization** (case-insensitive):
```
"spades" | "spade" | "♠" → "spades"
"hearts" | "heart" | "♥" → "hearts"
"diamonds" | "diamond" | "♦" → "diamonds"
"clubs" | "club" | "♣" → "clubs"
```

**Confidence normalization:**
- Clamp to [0, 1]
- Default to 0.5 if missing
- Round to 2 decimal places

### Deduplication

Remove duplicate cards (same rank + suit). Keep the one with higher confidence. A standard deck has exactly one of each card — duplicates indicate a recognition error.

### Validation

Reject cards that don't normalize to valid rank/suit. Don't throw — just filter them out and log a warning.

```typescript
const VALID_RANKS = new Set(['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']);
const VALID_SUITS = new Set(['spades', 'hearts', 'diamonds', 'clubs']);
```

### Sorting

Sort output cards by:
1. Confidence descending (most certain first)
2. Tie-break: rank value descending (A > K > Q > ... > 2)

### JSON Parse Fallback

Gemini occasionally wraps JSON in markdown code fences. Handle:
```
```json\n{...}\n```
```

Use the same `parseJsonResponse` pattern from `server/utils.ts`:
```typescript
import { parseJsonResponse } from './utils.js';
```

### Edge Cases

- **Empty cards array** — valid (no cards detected)
- **Null/undefined fields** — filter out, don't crash
- **Extra fields** — ignore (Gemini may add commentary)
- **Non-JSON response** — throw with descriptive error
- **Partial JSON** — attempt to extract with regex fallback

## Output

- `server/card-parser.ts` (NEW)
- Exports: `parseCardResponse`, `ParsedCardResponse`, `normalizeRank`, `normalizeSuit`
- Pure functions, no side effects, no I/O

## Validation

```typescript
// Normal case
parseCardResponse('{"cards":[{"rank":"Ace","suit":"Spades","confidence":0.95}],"image_quality":{"score":0.8,"issues":[]}}')
// → { cards: [{ rank: 'A', suit: 'spades', confidence: 0.95 }], image_quality: { score: 0.8, issues: [] } }

// Case normalization
parseCardResponse('{"cards":[{"rank":"king","suit":"HEARTS","confidence":0.7}],...}')
// → { cards: [{ rank: 'K', suit: 'hearts', confidence: 0.7 }], ... }

// Dedup
parseCardResponse('{"cards":[{"rank":"A","suit":"spades","confidence":0.9},{"rank":"A","suit":"spades","confidence":0.6}],...}')
// → { cards: [{ rank: 'A', suit: 'spades', confidence: 0.9 }], ... }  (kept higher confidence)

// Invalid card filtered
parseCardResponse('{"cards":[{"rank":"Joker","suit":"none","confidence":0.5}],...}')
// → { cards: [], ... }

// Markdown-wrapped JSON
parseCardResponse('```json\n{"cards":[],"image_quality":{"score":0.5,"issues":["blurry"]}}\n```')
// → { cards: [], image_quality: { score: 0.5, issues: ['blurry'] } }
```
