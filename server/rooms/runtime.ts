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
  /** Seat that deals the next hand; default (this hand's dealer + 1) % seats. */
  nextDealer?(state: S): number;
  /** Action for a timed-out human seat (connected or not); default aiAction. */
  timeoutAction?(state: S, seat: number): unknown;
  /** Ms a human seat has to act now (null/undefined = turnMs); must not depend on concealed data, since every seat sees when a seat is autoplayed. */
  deadlineMs?(state: S, seat: number): number | null | undefined;
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

export interface HandResult { hand: number; points?: number[]; voided?: boolean; nextDealer?: number }

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
  private dealer = 0;
  private toActNow: number[] = [];
  /** seat → its armed autoplay timer; a seat keeps it while it stays due. */
  private readonly seatTimers = new Map<number, { handle: unknown; deadline: number; token: number }>();
  private nextToken = 0;

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
    this.dealer = dealer;
    try {
      this.state = this.module.newHand(this.#seed, dealer);
    } catch {
      this.state = null;
      this.voidHand();
      return;
    }
    this.advance(null);
  }

  act(seat: number, seq: number, action: unknown): void {
    if (this.state === null) return this.sendError(seat, 'no_hand');
    // A seat released to AI is the house's now: a stale socket must not steer it.
    if (this.ai.has(seat)) return this.sendError(seat, 'not_your_turn');
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
    this.advance(seat);
  }

  /**
   * After a state change: finish the hand, or broadcast and arm timers.
   * A seat that stays due keeps its timer; the actor and newly due seats get a fresh one.
   */
  private advance(actor: number | null): void {
    if (this.state === null) return this.clearTimers();
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
    const due = [...toAct];
    // Work out every fresh deadline before touching timers, so a bad deadlineMs voids cleanly.
    const now = this.now();
    const fresh = new Map<number, number>();
    for (const seat of due) {
      if (this.seatTimers.has(seat) && seat !== actor) continue;
      let ms: number;
      if (this.ai.has(seat)) {
        ms = this.opts.aiDelayMs;
      } else {
        let hook: unknown;
        try {
          hook = this.module.deadlineMs ? this.module.deadlineMs(this.state, seat) : undefined;
        } catch {
          return this.voidHand();
        }
        if (hook === null || hook === undefined) ms = this.opts.turnMs;
        else if (typeof hook === 'number' && Number.isInteger(hook) && hook > 0) ms = hook;
        else return this.voidHand();
      }
      fresh.set(seat, ms);
    }
    for (const [seat, t] of [...this.seatTimers]) {
      if (!due.includes(seat) || fresh.has(seat)) {
        this.timers.clear(t.handle);
        this.seatTimers.delete(seat);
      }
    }
    this.toActNow = due;
    for (const [seat, ms] of fresh) {
      const token = ++this.nextToken;
      const handle = this.timers.set(() => this.autoplay(seat, token), ms);
      this.seatTimers.set(seat, { handle, deadline: now + ms, token });
    }
    this.broadcastState();
  }

  private autoplay(seat: number, token: number): void {
    if (this.state === null || !this.toActNow.includes(seat) || this.seatTimers.get(seat)?.token !== token) return;
    this.seatTimers.delete(seat);
    let action: unknown;
    try {
      action = !this.ai.has(seat) && this.module.timeoutAction
        ? this.module.timeoutAction(this.state, seat)
        : this.module.aiAction(this.state, seat);
    } catch {
      return this.voidHand();
    }
    this.applyAction(seat, action, false);
  }

  /** The seat's own deadline when it is a due human; else the latest due human deadline; null if only AI are due. */
  private deadlineFor(seat: number): number | null {
    const own = this.seatTimers.get(seat);
    if (own && !this.ai.has(seat) && this.toActNow.includes(seat)) return own.deadline;
    let latest: number | null = null;
    for (const s of this.toActNow) {
      const t = this.seatTimers.get(s);
      if (t && !this.ai.has(s) && (latest === null || t.deadline > latest)) latest = t.deadline;
    }
    return latest;
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
    return { type: 'state', hand: this.hand, seq: this.seq, seat, view, toAct: [...this.toActNow], deadline: this.deadlineFor(seat) };
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
    let nextDealer: unknown;
    const views: Array<[number, unknown]> = [];
    try {
      points = this.module.settle(state);
      nextDealer = this.module.nextDealer ? this.module.nextDealer(state) : (this.dealer + 1) % this.module.seats;
      for (const seat of this.humanSeats()) views.push([seat, this.module.view(state, seat)]);
    } catch {
      return this.voidHand();
    }
    if (!this.validPoints(points)) return this.voidHand();
    if (!Number.isInteger(nextDealer) || (nextDealer as number) < 0 || (nextDealer as number) >= this.module.seats) return this.voidHand();
    const hand = this.hand;
    this.endHand();
    for (const [seat, view] of views) this.hooks.send(seat, { type: 'hand_over', hand, view, points: [...points] });
    this.hooks.onHandOver({ hand, points: [...points], nextDealer: nextDealer as number });
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
  }

  private sendError(seat: number, code: RoomErrorCode): void {
    this.hooks.send(seat, { type: 'error', code, seq: this.seq });
  }

  private clearTimers(): void {
    for (const t of this.seatTimers.values()) this.timers.clear(t.handle);
    this.seatTimers.clear();
  }
}
