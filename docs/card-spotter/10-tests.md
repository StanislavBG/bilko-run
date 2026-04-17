# Agent 10 — Tests & E2E

## Objective
Full test coverage: unit tests for parser/evaluator/validation, integration test for the API endpoint, and Playwright E2E for the UI.

## Dependencies
- Agent 2 (server route) — for API integration tests
- Agent 6 (frontend page) — for E2E tests
- Agents 3, 4, 5 can be tested as soon as they're done (unit tests have no cross-deps)

## What to Build

---

### Unit Tests

#### File: `tests/card-parser.test.ts` (NEW)

Test `parseCardResponse()` from `server/card-parser.ts`:

```typescript
describe('parseCardResponse', () => {
  test('parses valid Gemini response');
  test('normalizes rank names (Ace → A, King → K)');
  test('normalizes suit casing (HEARTS → hearts)');
  test('normalizes unicode suits (♠ → spades)');
  test('clamps confidence to [0, 1]');
  test('defaults missing confidence to 0.5');
  test('deduplicates same card, keeps higher confidence');
  test('filters out invalid ranks (Joker)');
  test('filters out invalid suits (none)');
  test('sorts by confidence descending');
  test('handles empty cards array');
  test('handles markdown-wrapped JSON');
  test('handles JSON with extra fields');
  test('throws on non-JSON response');
  test('handles partial JSON with regex fallback');
});

describe('normalizeRank', () => {
  test.each([
    ['ace', 'A'], ['Ace', 'A'], ['A', 'A'], ['a', 'A'],
    ['king', 'K'], ['King', 'K'], ['K', 'K'], ['13', 'K'],
    ['queen', 'Q'], ['Queen', 'Q'], ['Q', 'Q'], ['12', 'Q'],
    ['jack', 'J'], ['Jack', 'J'], ['J', 'J'], ['11', 'J'],
    ['10', '10'], ['2', '2'], ['9', '9'],
  ])('normalizes %s to %s', (input, expected) => { ... });
});

describe('normalizeSuit', () => {
  test.each([
    ['spades', 'spades'], ['Spades', 'spades'], ['SPADES', 'spades'],
    ['spade', 'spades'], ['♠', 'spades'],
    ['hearts', 'hearts'], ['heart', 'hearts'], ['♥', 'hearts'],
    ['diamonds', 'diamonds'], ['diamond', 'diamonds'], ['♦', 'diamonds'],
    ['clubs', 'clubs'], ['club', 'clubs'], ['♣', 'clubs'],
  ])('normalizes %s to %s', (input, expected) => { ... });
});
```

---

#### File: `tests/hand-evaluator.test.ts` (NEW)

Test `evaluateHand()` from `server/hand-evaluator.ts`:

```typescript
describe('evaluateHand', () => {
  // Each hand type
  test('Royal Flush — A K Q J 10 same suit');
  test('Straight Flush — 5 consecutive same suit');
  test('Four of a Kind — 4 same rank');
  test('Full House — 3 of a kind + pair');
  test('Flush — 5 same suit non-consecutive');
  test('Straight — 5 consecutive mixed suits');
  test('Three of a Kind — 3 same rank');
  test('Two Pair — 2 different pairs');
  test('One Pair — 2 same rank');
  test('High Card — nothing matches');

  // Edge cases
  test('Wheel straight — A 2 3 4 5');
  test('Ace-high straight — 10 J Q K A');
  test('6-card hand — finds best 5-card combo');
  test('7-card hand — finds best 5-card combo');
  test('3-card hand — partial evaluation');
  test('2-card hand — pair or high card');
  test('1 card — returns no hand');
  test('0 cards — returns no hand');

  // Hand comparison (poker_rank ordering)
  test('Royal Flush beats Straight Flush');
  test('Straight Flush beats Four of a Kind');
  test('poker_rank 1 (Royal Flush) < poker_rank 10 (High Card)');
});

describe('descriptions', () => {
  test('Full House description includes rank names');
  test('Two Pair description includes both pair ranks');
  test('Partial hand description notes card count');
});
```

**Test data factory:**
```typescript
function card(rank: string, suit: string, confidence = 1): Card {
  return { rank, suit, confidence };
}

// Shorthand: cards('As', 'Kh', '7d') → [{ rank: 'A', suit: 'spades', ... }, ...]
function cards(...specs: string[]): Card[] {
  const suitMap: Record<string, string> = { s: 'spades', h: 'hearts', d: 'diamonds', c: 'clubs' };
  return specs.map(s => {
    const suit = suitMap[s.slice(-1)];
    const rank = s.slice(0, -1).toUpperCase();
    return card(rank, suit);
  });
}
```

---

#### File: `tests/image-validation.test.ts` (NEW)

Test `validateImage()` from `server/image-validation.ts`:

```typescript
describe('validateImage', () => {
  test('valid JPEG �� returns clean base64');
  test('valid PNG — returns clean base64');
  test('valid WebP — returns clean base64');
  test('strips data URI prefix');
  test('rejects GIF');
  test('rejects SVG');
  test('rejects empty string');
  test('rejects non-base64 input');
  test('rejects oversized image (>10MB)');
  test('rejects tiny image (<1KB)');
  test('detects mimeType mismatch (says JPEG, is PNG)');
  test('infers mimeType from data URI prefix');
});
```

**Test fixtures:**
Create minimal valid images in base64 for testing:
```typescript
// 1x1 red pixel JPEG (smallest valid JPEG)
const TINY_JPEG = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP...';

// 1x1 red pixel PNG
const TINY_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
```

---

### API Integration Test

#### File: `tests/card-spotter-api.test.ts` (NEW)

Test the `POST /api/demos/card-spotter` endpoint:

```typescript
describe('POST /api/demos/card-spotter', () => {
  test('returns 400 for missing image');
  test('returns 400 for invalid mimeType');
  test('returns 400 for oversized image');
  test('returns 400 for corrupted base64');
  test('returns valid response shape for good image');
  test('response includes cards array');
  test('response includes hand_evaluation');
  test('response includes image_quality');
  test('rate limiting returns gated response after limit');
});
```

**Note:** These tests need the Gemini API key to be set. For CI, mock the `askGeminiVision` call. For local dev, use real API.

```typescript
// Mock Gemini for CI
vi.mock('../server/gemini.js', () => ({
  askGeminiVision: vi.fn().mockResolvedValue(JSON.stringify({
    cards: [
      { rank: 'A', suit: 'spades', confidence: 0.95 },
      { rank: 'K', suit: 'hearts', confidence: 0.88 },
    ],
    image_quality: { score: 0.85, issues: [] },
  })),
}));
```

---

### Playwright E2E Tests

#### File: `e2e/card-spotter.spec.ts` (NEW)

```typescript
import { test, expect } from '@playwright/test';

// Base64 of a small test image (a simple card photo or synthetic image)
const TEST_IMAGE_BASE64 = '...'; // Minimal JPEG

test.describe('CardSpotter E2E', () => {
  test('page loads with upload zone', async ({ page }) => {
    await page.goto('/projects/card-spotter');
    await expect(page.getByText('Drop a photo')).toBeVisible();
    // or whatever the upload zone text ends up being
  });

  test('rejects non-image file', async ({ page }) => {
    await page.goto('/projects/card-spotter');
    // Upload a .txt file via file chooser
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.locator('input[type="file"]').first().dispatchEvent('click');
    const fileChooser = await fileChooserPromise;
    // This should show an error
  });

  test('shows image preview after upload', async ({ page }) => {
    await page.goto('/projects/card-spotter');

    // Mock the API response to avoid needing real Gemini
    await page.route('/api/demos/card-spotter', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          cards: [
            { rank: 'A', suit: 'spades', confidence: 0.95 },
            { rank: 'K', suit: 'hearts', confidence: 0.88 },
          ],
          count: 2,
          hand_evaluation: { name: 'High Card', poker_rank: 10, description: 'Ace-high' },
          image_quality: { score: 0.85, issues: [] },
        }),
      });
    });

    // Upload test image
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles({
      name: 'test-hand.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from(TEST_IMAGE_BASE64, 'base64'),
    });

    // Should show preview
    await expect(page.locator('img[alt*="hand"]').or(page.locator('img[alt*="Uploaded"]'))).toBeVisible();
  });

  test('full flow — upload → analyze → see results', async ({ page }) => {
    await page.goto('/projects/card-spotter');

    // Mock API
    await page.route('/api/demos/card-spotter', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          cards: [
            { rank: 'A', suit: 'spades', confidence: 0.95 },
            { rank: 'K', suit: 'hearts', confidence: 0.92 },
            { rank: '7', suit: 'diamonds', confidence: 0.88 },
            { rank: '7', suit: 'clubs', confidence: 0.85 },
            { rank: 'Q', suit: 'spades', confidence: 0.80 },
          ],
          count: 5,
          hand_evaluation: {
            name: 'Two Pair',
            poker_rank: 8,
            description: 'Sevens and... wait, only one pair of 7s. High Card — Ace.',
          },
          image_quality: { score: 0.9, issues: [] },
        }),
      });
    });

    // Upload
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles({
      name: 'test-hand.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from(TEST_IMAGE_BASE64, 'base64'),
    });

    // Click submit
    await page.getByRole('button', { name: /spot/i }).click();

    // Verify results
    await expect(page.getByText('5 cards identified').or(page.getByText('5 cards'))).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Two Pair')).toBeVisible();

    // Verify action buttons
    await expect(page.getByRole('button', { name: /copy/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /download/i }).or(page.getByRole('button', { name: /save/i }))).toBeVisible();
  });

  test('landing page loads', async ({ page }) => {
    await page.goto('/projects/card-spotter/about');
    await expect(page.getByText("What's in your hand")).toBeVisible();
  });
});
```

---

### Test Commands

Add to `package.json`:
```json
{
  "scripts": {
    "test:card-spotter": "vitest run tests/card-parser.test.ts tests/hand-evaluator.test.ts tests/image-validation.test.ts",
    "test:e2e:card-spotter": "playwright test e2e/card-spotter.spec.ts"
  }
}
```

## Output

| File | Type | Tests |
|------|------|-------|
| `tests/card-parser.test.ts` | Unit | ~20 |
| `tests/hand-evaluator.test.ts` | Unit | ~20 |
| `tests/image-validation.test.ts` | Unit | ~12 |
| `tests/card-spotter-api.test.ts` | Integration | ~9 |
| `e2e/card-spotter.spec.ts` | E2E | ~5 |
| **Total** | | **~66 tests** |

## Validation
- `pnpm test` — all unit + integration tests pass
- `pnpm test:e2e` — all E2E tests pass
- No regressions in existing 27 unit tests + 9 LocalScore E2E tests
