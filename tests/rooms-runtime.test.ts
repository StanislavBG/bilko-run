import { describe, it, expect } from 'vitest';
import { GameRoom, type RoomGameModule, type RoomMessage, type RoomSnapshot } from '../server/rooms/runtime.js';
import { toyGame, TOY_TOKENS, type ToyState } from './fixtures/rooms-toy-game.js';
import { claimWindowGame, type ClaimWindowState } from './fixtures/rooms-claim-game.js';

const TURN_MS = 10_000;
const AI_MS = 500;

/** Injected clock + timer queue: nothing runs until advance(). */
function fakeClock() {
  let now = 0;
  let nextId = 1;
  const timers = new Map<number, { at: number; fn: () => void }>();
  return {
    now: () => now,
    timers: {
      set(fn: () => void, ms: number) { const id = nextId++; timers.set(id, { at: now + ms, fn }); return id; },
      clear(h: unknown) { timers.delete(h as number); },
    },
    pending: () => timers.size,
    advance(ms: number) {
      const end = now + ms;
      for (;;) {
        let best: [number, { at: number; fn: () => void }] | undefined;
        for (const e of timers) if (e[1].at <= end && (!best || e[1].at < best[1].at || (e[1].at === best[1].at && e[0] < best[0]))) best = e;
        if (!best) break;
        timers.delete(best[0]);
        now = best[1].at;
        best[1].fn();
      }
      now = end;
    },
  };
}

/** Wraps the toy module so the test can see the room's real state and seed. */
function spyModule(base: RoomGameModule<ToyState> = toyGame) {
  const spy = { state: null as ToyState | null, seeds: [] as string[] };
  const mod: RoomGameModule<ToyState> = {
    ...base,
    newHand(seed, dealer) { spy.seeds.push(seed); spy.state = base.newHand(seed, dealer); return spy.state; },
    apply(state, seat, action) { const r = base.apply(state, seat, action); if (r.ok) spy.state = r.state; return r; },
  };
  return { mod, spy };
}

function setup(opts: { base?: RoomGameModule<ToyState>; seed?: () => string } = {}) {
  const clock = fakeClock();
  const { mod, spy } = spyModule(opts.base);
  const sent: Array<{ seat: number; msg: RoomMessage }> = [];
  const results: Array<{ hand: number; points?: number[]; voided?: boolean }> = [];
  const room = new GameRoom('r1', mod, { turnMs: TURN_MS, aiDelayMs: AI_MS, seed: opts.seed, timers: clock.timers, now: clock.now }, {
    send: (seat, msg) => sent.push({ seat, msg }),
    onHandOver: (r) => results.push(r),
  });
  return { clock, spy, sent, results, room };
}

const lastState = (sent: Array<{ seat: number; msg: RoomMessage }>, seat: number) =>
  [...sent].reverse().find((s) => s.seat === seat && s.msg.type === 'state')?.msg as Extract<RoomMessage, { type: 'state' }> | undefined;

describe('GameRoom', () => {
  it('50 seeded hands, 1 human + 2 AI: no message leaks a concealed token or the seed', () => {
    let n = 0;
    const { clock, spy, sent, results, room } = setup({ seed: () => `deadbeef${String(n++).padStart(8, '0')}cafef00d` });
    expect(room.seatHuman('alice')).toBe(0);
    room.fillWithAi();
    expect(room.isAi(1) && room.isAi(2) && !room.isAi(0)).toBe(true);
    expect(room.humanSeats()).toEqual([0]);

    let checked = 0;
    const check = (seat: number, msg: RoomMessage) => {
      const s = spy.state!;
      const json = JSON.stringify(msg);
      const concealed = [...s.deck, ...s.hands.flatMap((h, i) => (i === seat ? [] : h))];
      for (const t of concealed) expect(json, `${t} leaked to seat ${seat}`).not.toContain(`"${t}"`);
      for (const seed of spy.seeds) expect(json).not.toContain(seed);
      expect(json).not.toContain('"deck"');
      expect(json).not.toContain('"hands"');
      expect(['state', 'error', 'hand_over']).toContain(msg.type);
      checked++;
    };
    // Check at send time (the state the room held when it sent).
    const origPush = sent.push.bind(sent);
    sent.push = (...items) => { for (const it of items) check(it.seat, it.msg); return origPush(...items); };

    for (let h = 0; h < 50; h++) {
      room.startHand(h % 3);
      let guard = 0;
      while (results.length === h) {
        if (++guard > 50) throw new Error('hand did not finish');
        const st = lastState(sent, 0)!;
        if (st.toAct.includes(0)) {
          const mine = (st.view as { mine: string[] }).mine;
          room.act(0, st.seq, { discard: mine[mine.length - 1] });
        } else {
          clock.advance(AI_MS);
        }
      }
      expect(results[h].voided).toBeUndefined();
      expect(results[h].points!.reduce((a, b) => a + b, 0)).toBe(0);
    }
    expect(results).toHaveLength(50);
    expect(new Set(spy.seeds).size).toBe(50);
    expect(sent.every((s) => s.seat === 0)).toBe(true);
    expect(sent.filter((s) => s.msg.type === 'hand_over')).toHaveLength(50);
    expect(checked).toBe(sent.length);
    expect(TOY_TOKENS).toHaveLength(30);
  });

  it('state messages carry exactly hand, seq, seat, view, toAct, deadline', () => {
    const { sent, room } = setup({ seed: () => 'aaaa' });
    room.seatHuman('a');
    room.fillWithAi();
    room.startHand(0);
    const st = lastState(sent, 0)!;
    expect(Object.keys(st).sort()).toEqual(['deadline', 'hand', 'seat', 'seq', 'toAct', 'type', 'view']);
    expect(st).toMatchObject({ hand: 1, seat: 0, toAct: [0], deadline: TURN_MS });
  });

  it('rejects a wrong-seat action with not_your_turn and changes nothing', () => {
    const { sent, spy, room } = setup({ seed: () => 'bbbb' });
    room.seatHuman('a');
    room.seatHuman('b');
    room.fillWithAi();
    room.startHand(0);
    const before = spy.state;
    const seq = lastState(sent, 1)!.seq;
    const n = sent.length;
    room.act(1, seq, { discard: spy.state!.hands[1][0] });
    expect(sent.slice(n)).toEqual([{ seat: 1, msg: { type: 'error', code: 'not_your_turn', seq } }]);
    expect(spy.state).toBe(before);
    expect(lastState(sent, 1)!.seq).toBe(seq);
  });

  it('refuses a client action for a seat the room has made AI, and changes nothing', () => {
    const { sent, spy, room } = setup({ seed: () => 'cccc' });
    room.seatHuman('a');
    room.seatHuman('b');
    room.fillWithAi();
    room.startHand(2); // seat 2 (AI) is due first
    const before = spy.state;
    const seq = lastState(sent, 0)!.seq;
    expect(room.isAi(2)).toBe(true);
    const n = sent.length;
    room.act(2, seq, { discard: spy.state!.hands[2][0] });
    expect(sent.slice(n)).toEqual([{ seat: 2, msg: { type: 'error', code: 'not_your_turn', seq } }]);
    expect(spy.state).toBe(before);
  });

  it('rejects an illegal or throwing action with illegal_action and changes nothing', () => {
    const throwing: RoomGameModule<ToyState> = {
      ...toyGame,
      apply(state, seat, action) { if ((action as { boom?: boolean })?.boom) throw new Error('bug'); return toyGame.apply(state, seat, action); },
    };
    const { sent, spy, room, results } = setup({ base: throwing, seed: () => 'cccc' });
    room.seatHuman('a');
    room.fillWithAi();
    room.startHand(0);
    const before = spy.state;
    const seq = lastState(sent, 0)!.seq;
    const n = sent.length;
    room.act(0, seq, { discard: spy.state!.hands[1][0] }); // another seat's token
    room.act(0, seq, { boom: true });
    expect(sent.slice(n)).toEqual([
      { seat: 0, msg: { type: 'error', code: 'illegal_action', seq } },
      { seat: 0, msg: { type: 'error', code: 'illegal_action', seq } },
    ]);
    expect(spy.state).toBe(before);
    expect(results).toEqual([]);
  });

  it('AI seats act only after aiDelayMs', () => {
    const { clock, spy, room } = setup({ seed: () => 'dddd' });
    room.seatHuman('a');
    room.fillWithAi();
    room.startHand(1); // AI seat 1 acts first
    clock.advance(AI_MS - 1);
    expect(spy.state!.turns).toBe(0);
    clock.advance(1);
    expect(spy.state!.turns).toBe(1);
  });

  it('autoplays a human who does not act within turnMs; resync resends state', () => {
    const { clock, spy, sent, room } = setup({ seed: () => 'eeee' });
    room.seatHuman('a');
    room.fillWithAi();
    room.startHand(0);
    clock.advance(TURN_MS - 1);
    expect(spy.state!.turns).toBe(0);
    clock.advance(1);
    expect(spy.state!.turns).toBe(1);
    expect(spy.state!.discards).toHaveLength(1);
    const n = sent.length;
    room.resync(0);
    expect(sent.slice(n)).toHaveLength(1);
    expect(sent[n].msg).toEqual(lastState(sent.slice(0, n), 0));
  });

  it('a stale timer does not act after the human already acted', () => {
    const { clock, spy, sent, room } = setup({ seed: () => 'ffff' });
    room.seatHuman('a');
    room.fillWithAi();
    room.startHand(0);
    const st = lastState(sent, 0)!;
    room.act(0, st.seq, { discard: (st.view as { mine: string[] }).mine[0] });
    clock.advance(AI_MS);
    clock.advance(AI_MS);
    expect(spy.state!.turns).toBe(3);
    expect(lastState(sent, 0)!.toAct).toEqual([0]);
  });

  it('voids a result whose points do not sum to 0', () => {
    const lopsided: RoomGameModule<ToyState> = { ...toyGame, settle: () => [2, -1, 0] };
    const { clock, sent, results, room } = setup({ base: lopsided, seed: () => '1234' });
    room.seatHuman('a');
    room.fillWithAi();
    room.startHand(0);
    for (let i = 0; i < 10; i++) clock.advance(TURN_MS);
    expect(results).toEqual([{ hand: 1, voided: true }]);
    expect(sent.some((s) => s.msg.type === 'hand_over')).toBe(false);
    expect(clock.pending()).toBe(0);
  });

  it('voids the hand when a module call throws', () => {
    const buggy: RoomGameModule<ToyState> = { ...toyGame, settle: () => { throw new Error('bug'); } };
    const { clock, results, room } = setup({ base: buggy, seed: () => '5678' });
    room.seatHuman('a');
    room.fillWithAi();
    room.startHand(0);
    for (let i = 0; i < 10; i++) clock.advance(TURN_MS);
    expect(results).toEqual([{ hand: 1, voided: true }]);
  });

  it('seats: lowest free seat, same key returns its seat, full, release', () => {
    const { room } = setup();
    expect(room.seatHuman('a')).toBe(0);
    expect(room.seatHuman('b')).toBe(1);
    expect(room.seatHuman('a')).toBe(0);
    expect(room.seatHuman('c')).toBe(2);
    expect(room.seatHuman('d')).toBe('full');
    room.release(1);
    expect(room.humanSeats()).toEqual([0, 2]);
    expect(room.seatHuman('d')).toBe(1);
  });
});

// ── Module hooks: nextDealer, timeoutAction, deadlineMs ───────────────────────

interface ClaimState { dealer: number; passed: number[]; by: Array<{ seat: number; how: string }> }

/** 3 seats; every non-dealer seat is due at once until it passes. */
const claimGame: RoomGameModule<ClaimState> = {
  id: 'claim',
  seats: 3,
  maxLossPoints: 1,
  newHand: (_seed, dealer) => ({ dealer, passed: [], by: [] }),
  view: (s) => ({ passed: [...s.passed] }),
  toAct: (s) => [0, 1, 2].filter((x) => x !== s.dealer && !s.passed.includes(x)),
  apply(s, seat, action) {
    const how = (action as { how?: unknown } | null)?.how;
    if (typeof how !== 'string' || how === 'bad') return { ok: false, error: 'bad action' };
    if (seat === s.dealer || s.passed.includes(seat)) return { ok: false, error: 'not due' };
    return { ok: true, state: { ...s, passed: [...s.passed, seat], by: [...s.by, { seat, how }] } };
  },
  aiAction: () => ({ how: 'ai' }),
  isOver: (s) => s.passed.length === 2,
  settle: () => [0, 0, 0],
};

function claimSetup(base: RoomGameModule<ClaimState>) {
  const clock = fakeClock();
  const spy = { state: null as ClaimState | null };
  const mod: RoomGameModule<ClaimState> = {
    ...base,
    newHand(seed, dealer) { spy.state = base.newHand(seed, dealer); return spy.state; },
    apply(state, seat, action) { const r = base.apply(state, seat, action); if (r.ok) spy.state = r.state; return r; },
  };
  const sent: Array<{ seat: number; msg: RoomMessage }> = [];
  const results: Array<{ hand: number; points?: number[]; voided?: boolean; nextDealer?: number }> = [];
  const room = new GameRoom('r2', mod, { turnMs: TURN_MS, aiDelayMs: AI_MS, seed: () => 'claim', timers: clock.timers, now: clock.now }, {
    send: (seat, msg) => sent.push({ seat, msg }),
    onHandOver: (r) => results.push(r),
  });
  return { clock, spy, sent, results, room };
}

describe('GameRoom module hooks', () => {
  const allAiHand = (base: RoomGameModule<ToyState>, dealer: number) => {
    const s = setup({ base, seed: () => 'hook' });
    s.room.fillWithAi();
    s.room.startHand(dealer);
    for (let i = 0; i < 20 && s.results.length === 0; i++) s.clock.advance(AI_MS);
    return s;
  };

  it('nextDealer comes from the module hook', () => {
    const { results } = allAiHand({ ...toyGame, nextDealer: () => 2 }, 0);
    expect(results).toHaveLength(1);
    expect(results[0].voided).toBeUndefined();
    expect(results[0].nextDealer).toBe(2);
  });

  it('nextDealer falls back to (dealer + 1) % seats', () => {
    expect(allAiHand(toyGame, 0).results[0].nextDealer).toBe(1);
    expect(allAiHand(toyGame, 1).results[0].nextDealer).toBe(2);
    expect(allAiHand(toyGame, 2).results[0].nextDealer).toBe(0);
  });

  it('a throwing or out-of-range nextDealer voids the hand', () => {
    const bad: Array<() => number> = [() => { throw new Error('bug'); }, () => 3, () => -1, () => 1.5, () => NaN, () => '1' as unknown as number];
    for (const nextDealer of bad) {
      const { results, sent } = allAiHand({ ...toyGame, nextDealer }, 0);
      expect(results).toEqual([{ hand: 1, voided: true }]);
      expect(sent.some((s) => s.msg.type === 'hand_over')).toBe(false);
    }
  });

  it('a timed-out human is played with timeoutAction; AI seats still use aiAction', () => {
    const { clock, spy, room } = claimSetup({ ...claimGame, timeoutAction: () => ({ how: 'timeout' }) });
    room.seatHuman('a'); // seat 0: dealer
    room.seatHuman('b'); // seat 1: human
    room.fillWithAi(); // seat 2: AI
    room.startHand(0);
    clock.advance(AI_MS);
    expect(spy.state!.by).toEqual([{ seat: 2, how: 'ai' }]);
    clock.advance(TURN_MS);
    expect(spy.state!.by).toEqual([{ seat: 2, how: 'ai' }, { seat: 1, how: 'timeout' }]);
  });

  it('a released human seat is also played with timeoutAction; without the hook, aiAction', () => {
    const a = claimSetup({ ...claimGame, timeoutAction: () => ({ how: 'timeout' }) });
    a.room.seatHuman('a'); a.room.seatHuman('b'); a.room.seatHuman('c');
    a.room.startHand(0);
    a.room.release(1);
    a.clock.advance(TURN_MS);
    expect(a.spy.state!.by.map((x) => x.how)).toEqual(['timeout', 'timeout']);

    const b = claimSetup(claimGame);
    b.room.seatHuman('a'); b.room.seatHuman('b'); b.room.seatHuman('c');
    b.room.startHand(0);
    b.clock.advance(TURN_MS);
    expect(b.spy.state!.by.map((x) => x.how)).toEqual(['ai', 'ai']);
  });

  it('a throwing or rejected timeoutAction voids the hand', () => {
    for (const timeoutAction of [() => { throw new Error('bug'); }, () => ({ how: 'bad' })]) {
      const { clock, results, room } = claimSetup({ ...claimGame, timeoutAction });
      room.seatHuman('a'); room.seatHuman('b'); room.seatHuman('c');
      room.startHand(0);
      clock.advance(TURN_MS);
      expect(results).toEqual([{ hand: 1, voided: true }]);
      expect(clock.pending()).toBe(0);
    }
  });

  it('deadlineMs sets the human deadline; null/undefined means turnMs', () => {
    const a = claimSetup({ ...claimGame, deadlineMs: () => 4000 });
    a.room.seatHuman('a'); a.room.seatHuman('b'); a.room.seatHuman('c');
    a.room.startHand(0);
    expect(lastState(a.sent, 1)!.deadline).toBe(4000);
    a.clock.advance(3999);
    expect(a.spy.state!.by).toEqual([]);
    a.clock.advance(1);
    expect(a.results).toHaveLength(1);

    for (const deadlineMs of [() => null, () => undefined]) {
      const b = claimSetup({ ...claimGame, deadlineMs });
      b.room.seatHuman('a'); b.room.seatHuman('b'); b.room.seatHuman('c');
      b.room.startHand(0);
      expect(lastState(b.sent, 1)!.deadline).toBe(TURN_MS);
      b.clock.advance(TURN_MS - 1);
      expect(b.spy.state!.by).toEqual([]);
      b.clock.advance(1);
      expect(b.results).toHaveLength(1);
    }
  });

  it('a throwing or invalid deadlineMs voids the hand', () => {
    const bad = [() => { throw new Error('bug'); }, () => 0, () => -5, () => 1.5, () => Infinity, () => NaN];
    for (const deadlineMs of bad) {
      const { results, room, clock } = claimSetup({ ...claimGame, deadlineMs });
      room.seatHuman('a'); room.seatHuman('b'); room.seatHuman('c');
      room.startHand(0);
      expect(results).toEqual([{ hand: 1, voided: true }]);
      expect(clock.pending()).toBe(0);
    }
  });

  it('each seat sees its own deadline when due, else the latest human deadline; null for AI only', () => {
    const { sent, room } = claimSetup({ ...claimGame, deadlineMs: (_s, seat) => (seat === 1 ? 4000 : 8000) });
    room.seatHuman('a'); room.seatHuman('b'); room.seatHuman('c');
    room.startHand(0);
    expect(lastState(sent, 0)!.deadline).toBe(8000);
    expect(lastState(sent, 1)!.deadline).toBe(4000);
    expect(lastState(sent, 2)!.deadline).toBe(8000);
    expect(lastState(sent, 1)!.toAct).toEqual([1, 2]);

    const ai = claimSetup(claimGame);
    ai.room.seatHuman('a'); // seat 0 dealer human, seats 1 and 2 AI
    ai.room.fillWithAi();
    ai.room.startHand(0);
    expect(lastState(ai.sent, 0)!.deadline).toBeNull();
  });

  it("with two seats due, seat A acting does not restart seat B's timer", () => {
    const { clock, spy, sent, results, room } = claimSetup(claimGame);
    room.seatHuman('a'); room.seatHuman('b'); room.seatHuman('c');
    room.startHand(0);
    clock.advance(6000);
    room.act(1, lastState(sent, 1)!.seq, { how: 'human' });
    expect(spy.state!.by).toEqual([{ seat: 1, how: 'human' }]);
    expect(lastState(sent, 2)!.deadline).toBe(TURN_MS);
    expect(lastState(sent, 1)!.deadline).toBe(TURN_MS);
    clock.advance(TURN_MS - 6000 - 1);
    expect(spy.state!.by).toHaveLength(1);
    clock.advance(1);
    expect(spy.state!.by).toEqual([{ seat: 1, how: 'human' }, { seat: 2, how: 'ai' }]);
    expect(results).toHaveLength(1);
    expect(clock.pending()).toBe(0);
  });
});

describe('GameRoom seq window', () => {
  function windowSetup() {
    const clock = fakeClock();
    const spy = { state: null as ClaimWindowState | null };
    const mod: RoomGameModule<ClaimWindowState> = {
      ...claimWindowGame,
      newHand(seed, dealer) { spy.state = claimWindowGame.newHand(seed, dealer); return spy.state; },
      apply(state, seat, action) { const r = claimWindowGame.apply(state, seat, action); if (r.ok) spy.state = r.state; return r; },
    };
    const sent: Array<{ seat: number; msg: RoomMessage }> = [];
    const room = new GameRoom('r3', mod, { turnMs: TURN_MS, aiDelayMs: AI_MS, seed: () => 'window', timers: clock.timers, now: clock.now }, {
      send: (seat, msg) => sent.push({ seat, msg }),
      onHandOver: () => {},
    });
    room.seatHuman('a'); // seat 0: dealer
    room.seatHuman('b'); // seat 1: human, due in the window
    room.fillWithAi(); // seat 2: AI, due in the window
    room.startHand(0);
    return { clock, spy, sent, room };
  }

  const errorsSince = (sent: Array<{ seat: number; msg: RoomMessage }>, n: number) => sent.slice(n).filter((s) => s.msg.type === 'error');

  it("applies a human's action sent with the window's opening seq after an AI declared first", () => {
    const { clock, spy, sent, room } = windowSetup();
    const opening = lastState(sent, 1)!.seq;
    expect(lastState(sent, 1)!.toAct).toEqual([1, 2]);
    clock.advance(AI_MS); // AI seat 2 declares: seq moves on
    expect(spy.state!.by).toEqual([{ seat: 2, how: 'ai' }]);
    expect(lastState(sent, 1)!.seq).toBe(opening + 1);
    const n = sent.length;
    room.act(1, opening, { how: 'human' });
    expect(errorsSince(sent, n)).toEqual([]);
    expect(spy.state!.by).toEqual([{ seat: 2, how: 'ai' }, { seat: 1, how: 'human' }]);
  });

  it('refuses a resent, too-old or future seq with stale_seq and changes nothing', () => {
    const { clock, spy, sent, room } = windowSetup();
    const opening = lastState(sent, 1)!.seq;
    clock.advance(AI_MS); // seq opening+1 (AI)
    room.act(1, opening, { how: 'human' }); // seq opening+2; seat 1's clock restarts here
    const cur = lastState(sent, 1)!.seq;
    expect(cur).toBe(opening + 2);
    const before = spy.state;
    const tries: Array<[string, number]> = [
      ['resent applied seq', opening],
      ['older than the clock start', opening + 1],
      ['above the current seq', cur + 1],
    ];
    for (const [why, seq] of tries) {
      const n = sent.length;
      room.act(1, seq, { how: 'again' });
      expect(sent.slice(n), why).toEqual([{ seat: 1, msg: { type: 'error', code: 'stale_seq', seq: cur } }]);
      expect(spy.state, why).toBe(before);
    }
    // the seat's own new clock-start seq is still accepted
    room.act(1, cur, { how: 'human2' });
    expect(spy.state!.by.map((x) => x.how)).toEqual(['ai', 'human', 'human2']);
  });
});

describe('GameRoom snapshot / restore', () => {
  const SEED = 'seed-5ec2e7-do-not-leak';

  function hooked(mod: RoomGameModule<ToyState> = toyGame) {
    const clock = fakeClock();
    const sent: Array<{ seat: number; msg: RoomMessage }> = [];
    const results: Array<{ hand: number; points?: number[]; voided?: boolean }> = [];
    let changes = 0;
    const room = new GameRoom('rs', mod, { turnMs: TURN_MS, aiDelayMs: AI_MS, seed: () => SEED, timers: clock.timers, now: clock.now }, {
      send: (seat, msg) => sent.push({ seat, msg }),
      onHandOver: (r) => results.push(r),
      onChange: () => { changes++; },
    });
    return { clock, sent, results, room, changes: () => changes };
  }

  /** Plays seat 0 (human) by discarding its last token; AI seats via the clock. Returns false when the hand ended. */
  function step(r: ReturnType<typeof hooked>): boolean {
    if (r.results.length > 0) return false;
    const st = lastState(r.sent, 0)!;
    if (st.toAct.includes(0)) {
      const mine = (st.view as { mine: string[] }).mine;
      r.room.act(0, st.seq, { discard: mine[mine.length - 1] });
    } else {
      r.clock.advance(AI_MS);
    }
    return r.results.length === 0;
  }

  it('a JSON round-tripped snapshot resumes in a new room exactly like an uninterrupted run', () => {
    const a = hooked(); // uninterrupted
    const b = hooked(); // interrupted after 3 accepted actions
    for (const r of [a, b]) { r.room.seatHuman('alice'); r.room.fillWithAi(); r.room.startHand(0); }
    for (let i = 0; i < 3; i++) { step(a); step(b); }
    expect(lastState(b.sent, 0)!.toAct).toEqual([0]);

    const snap = b.room.snapshot()!;
    expect(snap).not.toBeNull();
    const json = JSON.stringify(snap);
    expect(json).not.toContain(SEED);
    expect(snap).toMatchObject({ v: 1, hand: 1, dealer: 0, humans: [[0, 'alice']], ai: [1, 2] });
    expect(snap.due).toEqual([{ seat: 0, startSeq: snap.seq }]);

    const c = hooked();
    c.room.restore(JSON.parse(json));
    expect(c.sent).toEqual([]); // restore sends nothing; clients resync on reconnect
    expect(c.changes()).toBe(0);
    expect(c.room.inHand).toBe(true);
    expect(c.room.humanSeats()).toEqual([0]);
    expect(c.room.isAi(1) && c.room.isAi(2)).toBe(true);
    expect(c.clock.pending()).toBe(1);
    c.room.resync(0);
    const ra = lastState(a.sent, 0)!;
    const rc = lastState(c.sent, 0)!;
    expect({ ...rc, deadline: null }).toEqual({ ...ra, deadline: null });
    expect(rc.deadline).toBe(TURN_MS);

    let guard = 0;
    while (a.results.length === 0 || c.results.length === 0) {
      if (++guard > 50) throw new Error('hand did not finish');
      const sa = lastState(a.sent, 0)!;
      const sc = lastState(c.sent, 0)!;
      expect(sc.seq).toBe(sa.seq);
      expect(sc.toAct).toEqual(sa.toAct);
      expect(sc.view).toEqual(sa.view);
      step(a); step(c);
    }
    expect(c.results).toEqual(a.results);
    expect(c.results[0].points).toBeDefined();
    expect(c.sent.filter((s) => s.msg.type === 'hand_over').map((s) => s.msg))
      .toEqual(a.sent.filter((s) => s.msg.type === 'hand_over').map((s) => s.msg));
    expect(c.clock.pending()).toBe(0);
  });

  it('snapshot() is null outside a hand and no snapshot carries the seed', () => {
    const r = hooked();
    expect(r.room.snapshot()).toBeNull();
    r.room.seatHuman('a'); r.room.fillWithAi();
    r.room.startHand(1);
    while (r.results.length === 0) {
      const s = r.room.snapshot();
      expect(s).not.toBeNull();
      expect(JSON.stringify(s)).not.toContain(SEED);
      step(r);
    }
    expect(r.room.snapshot()).toBeNull();
  });

  it('the snapshot state is a copy, not the live state', () => {
    const { mod, spy } = spyModule();
    const r = hooked(mod);
    r.room.seatHuman('a'); r.room.fillWithAi(); r.room.startHand(0);
    const snap = r.room.snapshot()!;
    expect(snap.state).toEqual(spy.state);
    expect(snap.state).not.toBe(spy.state);
  });

  it('onChange fires once per accepted change, never for a refused action', () => {
    const r = hooked();
    r.room.seatHuman('a'); r.room.fillWithAi();
    r.room.startHand(0);
    expect(r.changes()).toBe(1);
    const st = lastState(r.sent, 0)!;
    r.room.act(0, st.seq, { discard: 'nope' }); // illegal
    r.room.act(1, st.seq, { discard: 'nope' }); // not your turn
    r.room.act(0, st.seq + 5, { discard: 'nope' }); // stale seq
    expect(r.changes()).toBe(1);
    let accepted = 0;
    while (step(r)) accepted++;
    accepted++; // the final action that ended the hand
    // 6 turns: each applied action counts once, the finishing one included (not twice).
    expect(accepted).toBe(6);
    expect(r.changes()).toBe(1 + 6);
    expect(r.results).toHaveLength(1);
  });

  it('onChange fires once for an autoplayed human and once for a voided hand', () => {
    const r = hooked();
    r.room.seatHuman('a'); r.room.fillWithAi();
    r.room.startHand(0);
    r.clock.advance(TURN_MS); // human autoplayed
    expect(r.changes()).toBe(2);
    const bad = hooked({ ...toyGame, settle: () => [5, 5, 5] });
    bad.room.fillWithAi();
    bad.room.startHand(0);
    expect(bad.changes()).toBe(1);
    bad.clock.advance(AI_MS * 5);
    expect(bad.changes()).toBe(6);
    bad.clock.advance(AI_MS);
    expect(bad.results).toEqual([{ hand: 1, voided: true }]);
    expect(bad.changes()).toBe(7); // the 6th action voided the hand: one change
  });

  it('a snapshot with the wrong version or a state the module rejects leaves the room empty, no timers', () => {
    const src = hooked();
    src.room.seatHuman('a'); src.room.fillWithAi(); src.room.startHand(0);
    const snap = JSON.parse(JSON.stringify(src.room.snapshot()));

    const v2 = hooked();
    v2.room.restore({ ...snap, v: 2 });
    expect(v2.room.inHand).toBe(false);
    expect(v2.room.snapshot()).toBeNull();
    expect(v2.room.humanSeats()).toEqual([]);
    expect(v2.clock.pending()).toBe(0);

    for (const broken of [
      { ...toyGame, toAct: () => { throw new Error('bad'); } },
      { ...toyGame, isOver: () => { throw new Error('bad'); } },
    ] as RoomGameModule<ToyState>[]) {
      const r = hooked(broken);
      r.room.restore(snap);
      expect(r.room.inHand).toBe(false);
      expect(r.room.humanSeats()).toEqual([]);
      expect(r.clock.pending()).toBe(0);
      expect(r.sent).toEqual([]);
      expect(r.results).toEqual([]);
    }
  });

  it('restore keeps each due seat its startSeq and re-arms AI with aiDelayMs', () => {
    const mk = () => {
      const clock = fakeClock();
      const spy = { state: null as ClaimWindowState | null };
      const mod: RoomGameModule<ClaimWindowState> = {
        ...claimWindowGame,
        apply(state, seat, action) { const r = claimWindowGame.apply(state, seat, action); if (r.ok) spy.state = r.state; return r; },
      };
      const sent: Array<{ seat: number; msg: RoomMessage }> = [];
      const room = new GameRoom('rw', mod, { turnMs: TURN_MS, aiDelayMs: AI_MS, seed: () => 'window', timers: clock.timers, now: clock.now }, {
        send: (seat, msg) => sent.push({ seat, msg }),
        onHandOver: () => {},
      });
      return { room, sent, clock, spy };
    };
    const src = mk();
    src.room.seatHuman('a'); src.room.seatHuman('b'); src.room.fillWithAi();
    src.room.startHand(0);
    const opening = lastState(src.sent, 1)!.seq;
    expect(lastState(src.sent, 1)!.toAct).toEqual([1, 2]);
    const snap: RoomSnapshot = JSON.parse(JSON.stringify(src.room.snapshot()));
    expect(snap.due).toEqual([{ seat: 1, startSeq: opening }, { seat: 2, startSeq: opening }]);

    const dst = mk();
    dst.clock.advance(123_456); // a new process: its clock is elsewhere
    dst.room.restore(snap);
    expect(dst.clock.pending()).toBe(2);
    dst.room.resync(1);
    expect(lastState(dst.sent, 1)!.deadline).toBe(123_456 + TURN_MS);
    dst.clock.advance(AI_MS - 1);
    expect(dst.spy.state).toBeNull();
    dst.clock.advance(1); // AI seat 2 declares after aiDelayMs
    expect(dst.spy.state!.by).toEqual([{ seat: 2, how: 'ai' }]);
    expect(lastState(dst.sent, 1)!.seq).toBe(opening + 1);
    const n = dst.sent.length;
    dst.room.act(1, opening, { how: 'human' }); // the window's opening seq still counts
    expect(dst.sent.slice(n).filter((s) => s.msg.type === 'error')).toEqual([]);
    expect(dst.spy.state!.by).toEqual([{ seat: 2, how: 'ai' }, { seat: 1, how: 'human' }]);
  });

  it('freeze() stops the room for good: no AI or autoplay timer fires, act() and startHand() do nothing', () => {
    const { clock, spy, sent, results, room } = setup();
    room.seatHuman('alice');
    room.fillWithAi();
    room.startHand(1); // AI seat 1 deals and acts first, after AI_MS
    const before = room.snapshot()!;
    const state = spy.state;
    expect(before.due).toEqual([{ seat: 1, startSeq: before.seq }]);
    const n = sent.length;

    room.freeze();
    expect(clock.pending()).toBe(0);
    clock.advance(AI_MS + TURN_MS * 3);
    room.act(0, before.seq, { discard: state!.hands[0][0] }); // dropped without a reply (no not_your_turn)
    room.startHand(0);

    expect(sent.length).toBe(n);
    expect(results).toEqual([]);
    expect(spy.state).toBe(state);
    expect(room.snapshot()).toEqual(before); // due seats keep their startSeq for the final save
  });
});
