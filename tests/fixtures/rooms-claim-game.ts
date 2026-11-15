// Test-only RoomGameModule: a claim window in which both non-dealer seats are
// due at once and each must declare `CLAIM_DECLARES` times before it is done,
// so a seat stays due after its own applied action (tests/rooms-runtime.test.ts).
import type { RoomGameModule } from '../../server/rooms/runtime.js';

export const CLAIM_DECLARES = 2;

export interface ClaimWindowState { dealer: number; declared: number[]; by: Array<{ seat: number; how: string }> }

const due = (s: ClaimWindowState) => [0, 1, 2].filter((x) => x !== s.dealer && s.declared[x] < CLAIM_DECLARES);

export const claimWindowGame: RoomGameModule<ClaimWindowState> = {
  id: 'claim-window',
  seats: 3,
  maxLossPoints: 1,
  newHand: (_seed, dealer) => ({ dealer, declared: [0, 0, 0], by: [] }),
  view: (s) => ({ declared: [...s.declared] }),
  toAct: due,
  apply(s, seat, action) {
    const how = (action as { how?: unknown } | null)?.how;
    if (typeof how !== 'string') return { ok: false, error: 'bad action' };
    if (!due(s).includes(seat)) return { ok: false, error: 'not due' };
    const declared = [...s.declared];
    declared[seat]++;
    return { ok: true, state: { ...s, declared, by: [...s.by, { seat, how }] } };
  },
  aiAction: () => ({ how: 'ai' }),
  isOver: (s) => due(s).length === 0,
  settle: () => [0, 0, 0],
};
