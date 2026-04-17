# Agent 5 — Poker Hand Evaluator

## Objective
Pure-logic module that takes a `Card[]` and evaluates the best poker hand. No AI, no I/O — just combinatorics.

## Dependencies
None — can start immediately. Uses the `Card` type from `server/types/card-spotter.ts`.

## What to Build

### File: `server/hand-evaluator.ts` (NEW)

```typescript
import type { Card, HandEvaluation } from './types/card-spotter.js';

export function evaluateHand(cards: Card[]): HandEvaluation
```

### Poker Hand Rankings (best to worst)

| Rank | Name | Description | Example |
|------|------|-------------|---------|
| 1 | Royal Flush | A-K-Q-J-10, same suit | A♠ K♠ Q♠ J♠ 10♠ |
| 2 | Straight Flush | 5 consecutive, same suit | 7♥ 6♥ 5♥ 4♥ 3♥ |
| 3 | Four of a Kind | 4 same rank | K♠ K♥ K♦ K♣ 3♠ |
| 4 | Full House | 3 of a kind + pair | Q♠ Q♥ Q♦ 9♣ 9♠ |
| 5 | Flush | 5 same suit, not consecutive | A♦ J♦ 8♦ 6♦ 2♦ |
| 6 | Straight | 5 consecutive, mixed suits | 10♠ 9♥ 8♦ 7♣ 6♠ |
| 7 | Three of a Kind | 3 same rank | 8♠ 8♥ 8♦ K♣ 4♠ |
| 8 | Two Pair | 2 different pairs | J♠ J♥ 5♦ 5♣ A♠ |
| 9 | One Pair | 2 same rank | 10♠ 10♥ A♦ 8♣ 3♠ |
| 10 | High Card | Nothing matches | A♠ J♥ 8♦ 5♣ 2♠ |

### Input Handling

- **5 cards:** Standard hand evaluation
- **6-7 cards:** Find best 5-card hand from all C(n,5) combinations
  - 6 cards → 6 combinations
  - 7 cards → 21 combinations
- **2-4 cards:** Evaluate what's possible (pair, two pair, three of a kind, straight draw, flush draw)
  - Still return a hand name, but note it's a partial hand
- **0-1 cards:** Return `{ name: "No hand", poker_rank: 10, description: "Not enough cards to evaluate" }`
- **>7 cards:** Use first 7 only (unlikely edge case)

### Rank Value Map

```typescript
const RANK_VALUES: Record<string, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
  '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14,
};
```

**Ace special case for straights:** Ace can be low (A-2-3-4-5 = "wheel") or high (10-J-Q-K-A). When checking straights, test both.

### Algorithm

For 5-card evaluation:

```
// O(1) — fixed input size (max 7 cards, C(7,5) = 21 combos)
1. Count ranks (histogram) → Map<rank, count>
2. Count suits → Map<suit, count>
3. Sort by rank value descending
4. Check in order (most valuable first):
   a. isRoyalFlush()    — isStraightFlush() && highest card is Ace
   b. isStraightFlush() — isFlush() && isStraight()
   c. isFourOfAKind()   — any rank with count === 4
   d. isFullHouse()     — one rank with 3 + another with 2
   e. isFlush()         — any suit with count >= 5
   f. isStraight()      — 5 consecutive rank values (or A-2-3-4-5)
   g. isThreeOfAKind()  — any rank with count === 3
   h. isTwoPair()       — two ranks with count === 2
   i. isOnePair()       — one rank with count === 2
   j. highCard()        — fallback
5. Return first match
```

For >5 cards: generate all C(n,5) combos, evaluate each, return best.

### Description Format

The `description` field should be human-readable:

```
"Royal Flush — Ace-high spades"
"Straight Flush — 7-high hearts"
"Four of a Kind — Kings with a 3 kicker"
"Full House — Queens full of Nines"
"Flush — Ace-high diamonds"
"Straight — 10-high"
"Three of a Kind — Eights"
"Two Pair — Jacks and Fives, Ace kicker"
"One Pair — Tens, Ace kicker"
"High Card — Ace"
```

For partial hands (< 5 cards):
```
"Pair of Kings (3-card hand)"
"No matching cards (2-card hand)"
```

### Combination Generator

```typescript
// Generate all k-combinations from array
// O(C(n,k)) — for n≤7, k=5 this is at most 21
function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (arr.length < k) return [];
  const [first, ...rest] = arr;
  const withFirst = combinations(rest, k - 1).map(c => [first, ...c]);
  const withoutFirst = combinations(rest, k);
  return [...withFirst, ...withoutFirst];
}
```

## Output

- `server/hand-evaluator.ts` (NEW)
- Exports: `evaluateHand`
- Pure function, no I/O, no dependencies beyond the Card type
- Fully testable with unit tests

## Validation

```typescript
// Royal Flush
evaluateHand([
  { rank: 'A', suit: 'spades', confidence: 1 },
  { rank: 'K', suit: 'spades', confidence: 1 },
  { rank: 'Q', suit: 'spades', confidence: 1 },
  { rank: 'J', suit: 'spades', confidence: 1 },
  { rank: '10', suit: 'spades', confidence: 1 },
])
// → { name: "Royal Flush", poker_rank: 1, description: "Royal Flush — Ace-high spades" }

// Two Pair from 7 cards (best 5-card hand)
evaluateHand([
  { rank: 'K', suit: 'spades', confidence: 1 },
  { rank: 'K', suit: 'hearts', confidence: 1 },
  { rank: '7', suit: 'diamonds', confidence: 1 },
  { rank: '7', suit: 'clubs', confidence: 1 },
  { rank: 'A', suit: 'spades', confidence: 1 },
  { rank: '3', suit: 'hearts', confidence: 1 },
  { rank: '2', suit: 'diamonds', confidence: 1 },
])
// → { name: "Two Pair", poker_rank: 8, description: "Two Pair — Kings and Sevens, Ace kicker" }

// Partial hand (3 cards)
evaluateHand([
  { rank: '10', suit: 'hearts', confidence: 1 },
  { rank: '10', suit: 'clubs', confidence: 1 },
  { rank: 'A', suit: 'spades', confidence: 1 },
])
// → { name: "One Pair", poker_rank: 9, description: "Pair of Tens, Ace kicker (3-card hand)" }

// Wheel (A-2-3-4-5)
evaluateHand([
  { rank: 'A', suit: 'spades', confidence: 1 },
  { rank: '2', suit: 'hearts', confidence: 1 },
  { rank: '3', suit: 'diamonds', confidence: 1 },
  { rank: '4', suit: 'clubs', confidence: 1 },
  { rank: '5', suit: 'spades', confidence: 1 },
])
// → { name: "Straight", poker_rank: 6, description: "Straight — 5-high (wheel)" }

// Empty
evaluateHand([])
// → { name: "No hand", poker_rank: 10, description: "Not enough cards to evaluate" }
```
