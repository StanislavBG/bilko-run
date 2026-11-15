// 3-seat toy game for tests/rooms-runtime.test.ts. Each seat holds concealed
// tokens drawn from a hidden, seed-shuffled deck of unique ids 't00'..'t29'.
// A turn: the seat to act already drew one token; it discards one of its own.
// After 6 turns the highest token-number sum wins: winner +2, others -1.
import type { RoomGameModule } from '../../server/rooms/runtime.js';

export interface ToyState {
  dealer: number;
  hands: string[][];
  deck: string[];
  discards: string[];
  turns: number;
}

export const TOY_TOKENS = Array.from({ length: 30 }, (_, i) => `t${String(i).padStart(2, '0')}`);
export const TOY_TURNS = 6;

/** FNV-1a string hash → 32-bit seed for mulberry32. */
function hashSeed(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

function mulberry32(a: number): () => number {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const num = (t: string) => Number(t.slice(1));
const toActOf = (s: ToyState) => (s.dealer + s.turns) % 3;

function clone(s: ToyState): ToyState {
  return { dealer: s.dealer, hands: s.hands.map((h) => [...h]), deck: [...s.deck], discards: [...s.discards], turns: s.turns };
}

export const toyGame: RoomGameModule<ToyState> = {
  id: 'toy',
  seats: 3,
  maxLossPoints: 1,
  newHand(seed, dealer) {
    const rand = mulberry32(hashSeed(seed));
    const deck = [...TOY_TOKENS];
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    const hands = [0, 1, 2].map(() => deck.splice(0, 3));
    hands[dealer].push(deck.shift()!);
    return { dealer, hands, deck, discards: [], turns: 0 };
  },
  view(state, seat) {
    return {
      mine: [...state.hands[seat]],
      discards: [...state.discards],
      counts: state.hands.map((h) => h.length),
      deckCount: state.deck.length,
    };
  },
  toAct(state) {
    return state.turns >= TOY_TURNS ? [] : [toActOf(state)];
  },
  apply(state, seat, action) {
    if (state.turns >= TOY_TURNS) return { ok: false, error: 'hand is over' };
    if (seat !== toActOf(state)) return { ok: false, error: 'not your turn' };
    const discard = (action as { discard?: unknown } | null)?.discard;
    if (typeof discard !== 'string' || !state.hands[seat].includes(discard)) return { ok: false, error: 'not your token' };
    const next = clone(state);
    next.hands[seat] = next.hands[seat].filter((t) => t !== discard);
    next.discards.push(discard);
    next.turns++;
    if (next.turns < TOY_TURNS) next.hands[toActOf(next)].push(next.deck.shift()!);
    return { ok: true, state: next };
  },
  aiAction(state, seat) {
    const lowest = [...state.hands[seat]].sort((a, b) => num(a) - num(b))[0];
    return { discard: lowest };
  },
  isOver(state) {
    return state.turns >= TOY_TURNS;
  },
  settle(state) {
    const sums = state.hands.map((h) => h.reduce((a, t) => a + num(t), 0));
    const winner = sums.indexOf(Math.max(...sums));
    return sums.map((_, i) => (i === winner ? 2 : -1));
  },
};
