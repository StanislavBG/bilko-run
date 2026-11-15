// Authoritative game room — a game-agnostic server-side runner for a pluggable
// RoomGameModule (Three Winds mahjong first). The server deals from a secret
// seed, sends each seat only module.view(state, seat), validates every action
// through the module, and plays AI seats and timed-out humans.
// No sockets, tickets or DB here: send/onHandOver, timers and the clock are
// injected, so the room is fully unit-testable (tests/rooms-runtime.test.ts).
// The raw state and the seed never leave this class.
import crypto from 'node:crypto';

export interface RoomGameModule<S> {
  id: string;
  seats: number;
  /** Most points one seat can lose in one hand (the wallet escrows this). */
  maxLossPoints: number;
  newHand(seed: string, dealer: number): S;
  /** What one seat may see. Must not include other seats' concealed data. */
  view(state: S, seat: number): unknown;
  toAct(state: S): number[];
  apply(state: S, seat: number, action: unknown): { ok: true; state: S } | { ok: false; error: string };
  aiAction(state: S, seat: number): unknown;
  isOver(state: S): boolean;
  /** Per-seat points; must be integers summing to 0. */
  settle(state: S): number[];
}

export type RoomErrorCode = 'illegal_action' | 'not_your_turn' | 'stale_seq' | 'no_hand';

export type RoomMessage =
  | { type: 'state'; hand: number; seq: number; seat: number; view: unknown; toAct: number[]; deadline: number | null }
  | { type: 'error'; code: RoomErrorCode; seq: number }
  | { type: 'hand_over'; hand: number; view: unknown; points: number[] };

export interface RoomTimers {
  set(fn: () => void, ms: number): unknown;
  clear(h: unknown): void;
}

export interface GameRoomOptions {
  turnMs: number;
  aiDelayMs: number;
  seed?: () => string;
  timers?: RoomTimers;
  now?: () => number;
}

export interface HandResult { hand: number; points?: number[]; voided?: boolean }

export interface GameRoomHooks {
  send(seat: number, msg: RoomMessage): void;
  onHandOver(r: HandResult): void;
}

const defaultTimers: RoomTimers = {
  set: (fn, ms) => setTimeout(fn, ms),
  clear: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
};

export class GameRoom<S> {
  readonly id: string;
  private readonly module: RoomGameModule<S>;
  private readonly opts: GameRoomOptions;
  private readonly hooks: GameRoomHooks;
  private readonly timers: RoomTimers;
  private readonly now: () => number;

  /** seat → human key */
  private readonly humans = new Map<number, string>();
  private readonly ai = new Set<number>();

  private state: S | null = null;
  #seed: string | null = null;
  private hand = 0;
  private seq = 0;
  private toActNow: number[] = [];
  private deadline: number | null = null;
  private pending: unknown[] = [];

  constructor(id: string, module: RoomGameModule<S>, opts: GameRoomOptions, hooks: GameRoomHooks) {
    this.id = id;
    this.module = module;
    this.opts = opts;
    this.hooks = hooks;
    this.timers = opts.timers ?? defaultTimers;
    this.now = opts.now ?? Date.now;
  }

  // ── Seats ────────────────────────────────────────────────────────────────

  /** Lowest free seat; the same key gets its seat back. */
  seatHuman(key: string): number | 'full' {
    for (const [seat, k] of this.humans) if (k === key) return seat;
    for (let seat = 0; seat < this.module.seats; seat++) {
      if (!this.humans.has(seat) && !this.ai.has(seat)) {
        this.humans.set(seat, key);
        return seat;
      }
    }
    return 'full';
  }

  fillWithAi(): void {
    for (let seat = 0; seat < this.module.seats; seat++) if (!this.humans.has(seat)) this.ai.add(seat);
  }

  isAi(seat: number): boolean {
    return this.ai.has(seat);
  }

  humanSeats(): number[] {
    return [...this.humans.keys()].sort((a, b) => a - b);
  }

  /** Frees a human seat. During a hand its turns are autoplayed after turnMs. */
  release(seat: number): void {
    this.humans.delete(seat);
  }

  get inHand(): boolean {
    return this.state !== null;
  }

  // ── Hand lifecycle ───────────────────────────────────────────────────────

  startHand(dealer = 0): void {
    this.clearTimers();
    this.hand++;
    this.seq++;
    this.#seed = this.opts.seed?.() ?? crypto.randomBytes(16).toString('hex');
    try {
      this.state = this.module.newHand(this.#seed, dealer);
    } catch {
      this.state = null;
      this.voidHand();
      return;
    }
    this.advance();
  }

  act(seat: number, seq: number, action: unknown): void {
    if (this.state === null) return this.sendError(seat, 'no_hand');
    if (!this.toActNow.includes(seat)) return this.sendError(seat, 'not_your_turn');
    if (seq !== this.seq) return this.sendError(seat, 'stale_seq');
    this.applyAction(seat, action, true);
  }

  /** Resends a seat its current state (reconnect). */
  resync(seat: number): void {
    if (this.state === null || !this.humans.has(seat)) return;
    const msg = this.stateMessage(seat);
    if (msg) this.hooks.send(seat, msg);
  }

  // ── Internals ────────────────────────────────────────────────────────────

  private applyAction(seat: number, action: unknown, fromClient: boolean): void {
    if (this.state === null) return;
    let r: ReturnType<RoomGameModule<S>['apply']>;
    try {
      r = this.module.apply(this.state, seat, action);
    } catch {
      r = { ok: false, error: 'module threw' };
    }
    if (!r.ok) {
      if (fromClient) this.sendError(seat, 'illegal_action');
      else this.voidHand(); // the module rejected its own aiAction: the hand cannot continue
      return;
    }
    this.state = r.state;
    this.seq++;
    this.advance();
  }

  /** After a state change: finish the hand, or broadcast and arm timers. */
  private advance(): void {
    this.clearTimers();
    if (this.state === null) return;
    let over: boolean;
    let toAct: number[];
    try {
      over = this.module.isOver(this.state);
      toAct = over ? [] : this.module.toAct(this.state);
    } catch {
      return this.voidHand();
    }
    if (over) return this.finishHand();
    if (!Array.isArray(toAct) || toAct.length === 0) return this.voidHand(); // stuck hand
    this.toActNow = [...toAct];
    const humanToAct = toAct.some((s) => !this.ai.has(s));
    this.deadline = humanToAct ? this.now() + this.opts.turnMs : null;
    if (!this.broadcastState()) return;
    const seqAtArm = this.seq;
    for (const seat of toAct) {
      const ms = this.ai.has(seat) ? this.opts.aiDelayMs : this.opts.turnMs;
      this.pending.push(this.timers.set(() => this.autoplay(seat, seqAtArm), ms));
    }
  }

  private autoplay(seat: number, seqAtArm: number): void {
    if (this.state === null || this.seq !== seqAtArm || !this.toActNow.includes(seat)) return;
    let action: unknown;
    try {
      action = this.module.aiAction(this.state, seat);
    } catch {
      return this.voidHand();
    }
    this.applyAction(seat, action, false);
  }

  private stateMessage(seat: number): RoomMessage | null {
    if (this.state === null) return null;
    let view: unknown;
    try {
      view = this.module.view(this.state, seat);
    } catch {
      this.voidHand();
      return null;
    }
    return { type: 'state', hand: this.hand, seq: this.seq, seat, view, toAct: [...this.toActNow], deadline: this.deadline };
  }

  /** Sends each human seat its view. AI seats receive nothing. False if the hand was voided. */
  private broadcastState(): boolean {
    const msgs: Array<[number, RoomMessage]> = [];
    for (const seat of this.humanSeats()) {
      const msg = this.stateMessage(seat);
      if (!msg) return false;
      msgs.push([seat, msg]);
    }
    for (const [seat, msg] of msgs) this.hooks.send(seat, msg);
    return true;
  }

  private finishHand(): void {
    const state = this.state;
    if (state === null) return;
    let points: number[];
    const views: Array<[number, unknown]> = [];
    try {
      points = this.module.settle(state);
      for (const seat of this.humanSeats()) views.push([seat, this.module.view(state, seat)]);
    } catch {
      return this.voidHand();
    }
    if (!this.validPoints(points)) return this.voidHand();
    const hand = this.hand;
    this.endHand();
    for (const [seat, view] of views) this.hooks.send(seat, { type: 'hand_over', hand, view, points: [...points] });
    this.hooks.onHandOver({ hand, points: [...points] });
  }

  private validPoints(points: unknown): points is number[] {
    if (!Array.isArray(points) || points.length !== this.module.seats) return false;
    if (!points.every((p) => Number.isInteger(p))) return false;
    if (points.some((p) => p < -this.module.maxLossPoints)) return false;
    return points.reduce((a, b) => a + b, 0) === 0;
  }

  private voidHand(): void {
    const hand = this.hand;
    this.endHand();
    this.hooks.onHandOver({ hand, voided: true });
  }

  private endHand(): void {
    this.clearTimers();
    this.state = null;
    this.#seed = null;
    this.toActNow = [];
    this.deadline = null;
  }

  private sendError(seat: number, code: RoomErrorCode): void {
    this.hooks.send(seat, { type: 'error', code, seq: this.seq });
  }

  private clearTimers(): void {
    for (const h of this.pending) this.timers.clear(h);
    this.pending = [];
  }
}
