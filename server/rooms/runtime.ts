// Authoritative game room — a game-agnostic server-side runner for a pluggable
// RoomGameModule (Three Winds mahjong first). The server deals from a secret
// seed, sends each seat only module.view(state, seat), validates every action
// through the module, and plays AI seats and timed-out humans.
// No sockets, tickets or DB here: send/onHandOver, timers and the clock are
// injected, so the room is fully unit-testable (tests/rooms-runtime.test.ts).
// The raw state and the seed never leave this class, except the state inside
// snapshot(), which is for server-side storage only (never send it to a client).
// A module used with snapshot()/restore() must keep its state plain JSON: it has to
// survive a JSON round trip unchanged (the Three Winds RoomState is plain JSON).
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
  /** After every accepted state change (hand started, action applied or autoplayed, hand finished or voided): time to save a snapshot. */
  onChange?(): void;
}

/**
 * A live hand as plain JSON, so it can resume in a new process. Server-only, like the
 * raw state: it holds every seat's concealed data. It never holds the seed.
 * due: each seat whose timer was armed, with the seq its clock started at.
 */
export type RoomSnapshot = {
  v: 1;
  hand: number;
  seq: number;
  dealer: number;
  state: unknown;
  humans: Array<[number, string]>;
  ai: number[];
  due: Array<{ seat: number; startSeq: number }>;
};

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
  /**
   * seat → its armed autoplay timer; a seat keeps it while it stays due.
   * startSeq is the seq when this clock started: the oldest seq the seat may still act on.
   */
  private readonly seatTimers = new Map<number, { handle: unknown; deadline: number; token: number; startSeq: number }>();
  private nextToken = 0;
  /** Set by freeze(): the room never changes again. */
  private frozen = false;

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
    if (this.frozen) return;
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
    if (this.frozen) return; // dropped without a reply: the client resends after the table resumes
    if (this.state === null) return this.sendError(seat, 'no_hand');
    // A seat released to AI is the house's now: a stale socket must not steer it.
    if (this.ai.has(seat)) return this.sendError(seat, 'not_your_turn');
    if (!this.toActNow.includes(seat)) return this.sendError(seat, 'not_your_turn');
    // Any seq since the seat's own clock started: another seat's move in between does
    // not change this seat's decision, and its own applied action restarts the clock.
    const startSeq = this.seatTimers.get(seat)?.startSeq ?? this.seq;
    if (!Number.isInteger(seq) || seq < startSeq || seq > this.seq) return this.sendError(seat, 'stale_seq');
    this.applyAction(seat, action, true);
  }

  /** Resends a seat its current state (reconnect). */
  resync(seat: number): void {
    if (this.state === null || !this.humans.has(seat)) return;
    const msg = this.stateMessage(seat);
    if (msg) this.hooks.send(seat, msg);
  }

  // ── Persistence ──────────────────────────────────────────────────────────

  /**
   * Stops the room for good (deploy drain, before its final save): every timer is
   * cleared, and act(), startHand() and autoplay do nothing from now on, so snapshot()
   * stays exactly the state the seats last saw. Due seats keep their startSeq for snapshot().
   */
  freeze(): void {
    this.frozen = true;
    for (const t of this.seatTimers.values()) this.timers.clear(t.handle);
  }

  /** The live hand as JSON-safe data for server-side storage; null outside a hand (or if the state is not JSON). */
  snapshot(): RoomSnapshot | null {
    if (this.state === null) return null;
    let state: unknown;
    try {
      state = JSON.parse(JSON.stringify(this.state));
    } catch {
      return null;
    }
    const due: RoomSnapshot['due'] = [];
    for (const seat of this.toActNow) {
      const t = this.seatTimers.get(seat);
      if (t) due.push({ seat, startSeq: t.startSeq });
    }
    return {
      v: 1,
      hand: this.hand,
      seq: this.seq,
      dealer: this.dealer,
      state,
      humans: [...this.humans].sort((a, b) => a[0] - b[0]),
      ai: [...this.ai].sort((a, b) => a - b),
      due,
    };
  }

  /**
   * Loads a snapshot into this room, replacing anything it held, and arms a fresh timer
   * for every seat to act (AI: aiDelayMs; human: deadlineMs or turnMs), keeping each
   * seat's startSeq. Sends nothing: clients resync on reconnect. A snapshot that does
   * not check out, or a state the module rejects, leaves the room empty with no timers.
   */
  restore(snap: RoomSnapshot): void {
    this.clearTimers();
    this.state = null;
    this.#seed = null;
    this.toActNow = [];
    this.humans.clear();
    this.ai.clear();
    const parsed = this.parseSnapshot(snap);
    if (!parsed) return;
    const state = snap.state as S;
    let toAct: number[];
    try {
      if (this.module.isOver(state)) return;
      toAct = this.module.toAct(state);
    } catch {
      return;
    }
    if (!Array.isArray(toAct) || toAct.length === 0) return;
    const seats = this.module.seats;
    if (!toAct.every((x) => Number.isInteger(x) && x >= 0 && x < seats)) return;
    const startSeqs = new Map(snap.due.map((d) => [d.seat, d.startSeq] as const));
    const fresh = new Map<number, number>();
    for (const seat of toAct) {
      let ms: number;
      if (parsed.ai.has(seat)) {
        ms = this.opts.aiDelayMs;
      } else {
        let hook: unknown;
        try {
          hook = this.module.deadlineMs ? this.module.deadlineMs(state, seat) : undefined;
        } catch {
          return;
        }
        if (hook === null || hook === undefined) ms = this.opts.turnMs;
        else if (typeof hook === 'number' && Number.isInteger(hook) && hook > 0) ms = hook;
        else return;
      }
      fresh.set(seat, ms);
    }
    this.state = state;
    this.hand = snap.hand;
    this.seq = snap.seq;
    this.dealer = snap.dealer;
    for (const [seat, key] of parsed.humans) this.humans.set(seat, key);
    for (const seat of parsed.ai) this.ai.add(seat);
    this.toActNow = [...toAct];
    const now = this.now();
    for (const [seat, ms] of fresh) {
      const token = ++this.nextToken;
      const handle = this.timers.set(() => this.autoplay(seat, token), ms);
      this.seatTimers.set(seat, { handle, deadline: now + ms, token, startSeq: startSeqs.get(seat) ?? this.seq });
    }
  }

  private parseSnapshot(snap: RoomSnapshot): { humans: Map<number, string>; ai: Set<number> } | null {
    if (!snap || typeof snap !== 'object' || snap.v !== 1) return null;
    const seats = this.module.seats;
    const isSeat = (x: unknown): x is number => Number.isInteger(x) && (x as number) >= 0 && (x as number) < seats;
    const isCount = (x: unknown) => Number.isInteger(x) && (x as number) >= 0;
    if (!isCount(snap.hand) || !isCount(snap.seq) || !isSeat(snap.dealer)) return null;
    if (snap.state === null || snap.state === undefined) return null;
    if (!Array.isArray(snap.humans) || !Array.isArray(snap.ai) || !Array.isArray(snap.due)) return null;
    const humans = new Map<number, string>();
    for (const h of snap.humans) {
      if (!Array.isArray(h) || !isSeat(h[0]) || typeof h[1] !== 'string' || humans.has(h[0])) return null;
      humans.set(h[0], h[1]);
    }
    const ai = new Set<number>();
    for (const seat of snap.ai) {
      if (!isSeat(seat) || humans.has(seat)) return null;
      ai.add(seat);
    }
    for (const d of snap.due) {
      if (!d || typeof d !== 'object' || !isSeat(d.seat) || !isCount(d.startSeq) || d.startSeq > snap.seq) return null;
    }
    return { humans, ai };
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
      this.seatTimers.set(seat, { handle, deadline: now + ms, token, startSeq: this.seq });
    }
    // A false broadcast voided the hand, and voidHand already reported the change.
    if (this.broadcastState()) this.hooks.onChange?.();
  }

  private autoplay(seat: number, token: number): void {
    if (this.frozen || this.state === null || !this.toActNow.includes(seat) || this.seatTimers.get(seat)?.token !== token) return;
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
    this.hooks.onChange?.();
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
    this.hooks.onChange?.();
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
