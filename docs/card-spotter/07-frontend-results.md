# Agent 7 — Frontend Page: Results UI

## Objective
Build the results display for CardSpotter — card list, poker hand evaluation, confidence indicators, and visual card representations.

## Dependencies
- Agent 4 types (`Card`, `HandEvaluation`, `ImageQuality`) — use the interfaces defined in `server/types/card-spotter.ts`
- Agent 6 creates the page shell — this agent fills in the results section

## What to Build

### Integrate into: `src/pages/CardSpotterPage.tsx`

Replace the `{/* Results: Agent 7 */}` placeholder with the full results UI. If Agent 6 hasn't created the file yet, create the results as a standalone component that can be imported.

### Fallback: `src/components/card-spotter/CardResults.tsx` (NEW)

```typescript
interface CardResultsProps {
  result: CardSpotterResult;
  onReset: () => void;
}

export function CardResults({ result, onReset }: CardResultsProps)
```

### Results Layout

```
┌─────────────────────────────────────────┐
│  Hand Evaluation Banner                 │
│  ┌───────────────────────────────────┐  │
│  │  🃏 "Two Pair"                    │  │
│  │  "Kings and Sevens, Ace kicker"   │  │
│  │  Rank: 8/10                       │  │
│  └───────────────────────────────────┘  │
├─────────────────────────────────────────┤
│  Card Count: "5 cards identified"       │
├─────────────────────────────────────────┤
│  Card Grid                              │
│  ┌──────┐ ┌──────┐ ┌──────┐           │
│  │  K♠  │ │  K♥  │ │  7♦  │           │
│  │ 95%  │ │ 92%  │ │ 88%  │           │
│  └──────┘ └──────┘ └──────┘           │
│  ┌──────┐ ┌──────┐                     │
│  │  7♣  │ │  A♠  │                     │
│  │ 85%  │ │ 80%  │                     │
│  └──────┘ └──────┘                     │
├─────────────────────────────────────────┤
│  Image Quality                          │
│  ██████████░░ 85% — "Good quality"     │
│  Issues: none                           │
├─────────────────────────────────────────┤
│  Actions                                │
│  [Copy List] [Download] [Spot Another]  │
└─────────────────────────────────────────┘
```

### Visual Card Component

Each card is a mini playing card with suit color and confidence bar:

```typescript
function CardTile({ card }: { card: Card }) {
  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
  const suitSymbol = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' }[card.suit];
  const confidencePct = Math.round(card.confidence * 100);

  return (
    <div className="bg-white rounded-xl border-2 border-warm-200 p-3 w-20 text-center shadow-elevation-1 hover:shadow-elevation-2 transition-shadow">
      <div className={`text-2xl font-black ${isRed ? 'text-red-600' : 'text-warm-900'}`}>
        {card.rank}
      </div>
      <div className={`text-xl ${isRed ? 'text-red-500' : 'text-warm-700'}`}>
        {suitSymbol}
      </div>
      {/* Confidence bar */}
      <div className="mt-2 h-1 bg-warm-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${
            confidencePct >= 90 ? 'bg-green-500' :
            confidencePct >= 70 ? 'bg-amber-500' : 'bg-red-500'
          }`}
          style={{ width: `${confidencePct}%` }}
        />
      </div>
      <div className="text-[10px] text-warm-400 mt-1 tabular-nums">{confidencePct}%</div>
    </div>
  );
}
```

### Hand Evaluation Banner

Show the poker hand with appropriate styling:

```typescript
function HandBanner({ evaluation }: { evaluation: HandEvaluation }) {
  // Color by hand quality
  const color =
    evaluation.poker_rank <= 2 ? 'from-amber-500 to-yellow-500' :  // Royal/Straight Flush (gold)
    evaluation.poker_rank <= 4 ? 'from-purple-500 to-indigo-500' : // 4-kind, Full House
    evaluation.poker_rank <= 6 ? 'from-blue-500 to-cyan-500' :    // Flush, Straight
    evaluation.poker_rank <= 8 ? 'from-green-500 to-emerald-500' : // 3-kind, Two Pair
    'from-warm-500 to-warm-600';                                    // Pair, High Card

  return (
    <div className={`bg-gradient-to-r ${color} rounded-2xl p-6 text-white text-center`}>
      <p className="text-xs font-bold uppercase tracking-widest opacity-80 mb-1">Your Hand</p>
      <h3 className="text-2xl font-black">{evaluation.name}</h3>
      <p className="text-sm opacity-90 mt-1">{evaluation.description}</p>
    </div>
  );
}
```

### Card Count

```typescript
<p className="text-sm text-warm-600">
  <span className="font-bold text-warm-900 tabular-nums">{result.count}</span>
  {' '}{result.count === 1 ? 'card' : 'cards'} identified
</p>
```

### Image Quality Indicator

```typescript
function QualityBar({ quality }: { quality: ImageQuality }) {
  const pct = Math.round(quality.score * 100);
  const label = pct >= 80 ? 'Great' : pct >= 60 ? 'Good' : pct >= 40 ? 'Fair' : 'Poor';

  return (
    <div className="bg-warm-50 rounded-xl p-4">
      <div className="flex justify-between text-xs text-warm-500 mb-1">
        <span>Image quality</span>
        <span className="font-bold">{label} ({pct}%)</span>
      </div>
      <div className="h-2 bg-warm-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${pct >= 60 ? 'bg-green-500' : 'bg-amber-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {quality.issues.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {quality.issues.map((issue, i) => (
            <span key={i} className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">
              {issue}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
```

### Action Buttons

```typescript
// Copy card list as text
function copyCardList(cards: Card[]) {
  const text = cards.map(c => {
    const suit = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' }[c.suit];
    return `${c.rank}${suit}`;
  }).join(', ');
  navigator.clipboard.writeText(text);
}

// Download as JSON
function downloadResult(result: CardSpotterResult) {
  const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'card-spotter-result.json';
  a.click();
  URL.revokeObjectURL(url);
}
```

### Empty State (no cards found)

```typescript
{result.cards.length === 0 && (
  <div className="text-center py-8">
    <p className="text-3xl mb-3">🤔</p>
    <h3 className="text-lg font-bold text-warm-900 mb-2">No cards detected</h3>
    <p className="text-sm text-warm-500 mb-4">
      Make sure the cards are face-up, well-lit, and clearly visible.
    </p>
    <button onClick={onReset} className="text-sm text-rose-500 hover:text-rose-600 font-bold">
      Try another image
    </button>
  </div>
)}
```

### Low Confidence Warning

If any card has confidence < 0.7, show a subtle warning:

```typescript
{result.cards.some(c => c.confidence < 0.7) && (
  <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
    ⚠️ Some cards were hard to identify. Results with lower confidence may be inaccurate.
  </p>
)}
```

## Output
- Card result components (either in `CardSpotterPage.tsx` or as `src/components/card-spotter/CardResults.tsx`)
- Exports: `CardResults`, `CardTile`, `HandBanner`, `QualityBar`

## Validation
- 5 cards → shows 5 tiles + poker hand evaluation
- 0 cards → shows "no cards detected" message
- Low confidence cards → shows amber warning
- Copy button → clipboard has "A♠, K♥, 7♦"
- Download → saves JSON file
- "Spot Another" → resets to upload state
