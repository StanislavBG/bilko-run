// Persistence for service bookings: a paid checkout session claims an open slot.
// A slot is claimable once (UNIQUE(page_slug, slot_start_ms)); a session may hold at
// most `sessionsPerMonth` bookings per Pacific Time calendar month.
import { dbAll, dbTransaction, txGet, txRun } from '../db.js';

export interface ServiceBooking {
  id: number;
  pageSlug: string;
  slug: string;
  checkoutSessionId: string;
  slotStartMs: number;
  slotEndMs: number;
  email: string;
  intake: unknown;
  createdAt: number;
}

interface BookingRow {
  id: number;
  page_slug: string;
  slug: string;
  checkout_session_id: string;
  slot_start_ms: number;
  slot_end_ms: number;
  email: string;
  intake_json: string;
  created_at: number;
}

export interface ClaimSlotInput {
  pageSlug: string;
  slug: string;
  checkoutSessionId: string;
  startMs: number;
  endMs: number;
  email: string;
  intake: unknown;
  sessionsPerMonth: number;
}

export type ClaimSlotResult =
  | { status: 'ok'; booking: ServiceBooking }
  | { status: 'taken' }
  | { status: 'limit' };

const ptMonth = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit',
});

function ptMonthKey(ms: number): string {
  const parts = ptMonth.formatToParts(new Date(ms));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}`;
}

function toBooking(r: BookingRow): ServiceBooking {
  return {
    id: Number(r.id),
    pageSlug: r.page_slug,
    slug: r.slug,
    checkoutSessionId: r.checkout_session_id,
    slotStartMs: Number(r.slot_start_ms),
    slotEndMs: Number(r.slot_end_ms),
    email: r.email,
    intake: JSON.parse(r.intake_json),
    createdAt: Number(r.created_at),
  };
}

function isUniqueViolation(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return msg.includes('UNIQUE');
}

// A local libSQL file allows one open write transaction per process; a second
// concurrent dbTransaction fails with SQLITE_BUSY. Serialize claims in-process;
// UNIQUE(page_slug, slot_start_ms) remains the cross-instance guarantee.
let claimQueue: Promise<unknown> = Promise.resolve();

export function claimSlot(i: ClaimSlotInput): Promise<ClaimSlotResult> {
  const run = claimQueue.then(() => claimSlotUnlocked(i));
  claimQueue = run.catch(() => undefined);
  return run;
}

async function claimSlotUnlocked(i: ClaimSlotInput): Promise<ClaimSlotResult> {
  const email = i.email.trim().toLowerCase();
  const createdAt = Date.now();
  const month = ptMonthKey(i.startMs);
  try {
    return await dbTransaction<ClaimSlotResult>(async (tx) => {
      const mine = await tx.execute({
        sql: 'SELECT slot_start_ms FROM service_bookings WHERE checkout_session_id = ?',
        args: [i.checkoutSessionId],
      });
      const used = mine.rows.filter((r) => ptMonthKey(Number(r.slot_start_ms)) === month).length;
      if (used >= i.sessionsPerMonth) return { status: 'limit' };

      await txRun(
        tx,
        `INSERT INTO service_bookings
           (page_slug, slug, checkout_session_id, slot_start_ms, slot_end_ms, email, intake_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        i.pageSlug, i.slug, i.checkoutSessionId, i.startMs, i.endMs, email,
        JSON.stringify(i.intake ?? null), createdAt,
      );
      const row = await txGet<BookingRow>(
        tx,
        'SELECT * FROM service_bookings WHERE page_slug = ? AND slot_start_ms = ?',
        i.pageSlug, i.startMs,
      );
      return { status: 'ok', booking: toBooking(row as BookingRow) };
    });
  } catch (e) {
    if (isUniqueViolation(e)) return { status: 'taken' };
    throw e;
  }
}

export async function claimedStarts(pageSlug: string, fromMs: number): Promise<number[]> {
  const rows = await dbAll<{ slot_start_ms: number }>(
    'SELECT slot_start_ms FROM service_bookings WHERE page_slug = ? AND slot_start_ms >= ? ORDER BY slot_start_ms',
    pageSlug, fromMs,
  );
  return rows.map((r) => Number(r.slot_start_ms));
}

export async function bookingsForSession(checkoutSessionId: string): Promise<ServiceBooking[]> {
  const rows = await dbAll<BookingRow>(
    'SELECT * FROM service_bookings WHERE checkout_session_id = ? ORDER BY slot_start_ms',
    checkoutSessionId,
  );
  return rows.map(toBooking);
}

export async function listBookings(o: { pageSlug: string; fromMs: number }): Promise<ServiceBooking[]> {
  const rows = await dbAll<BookingRow>(
    'SELECT * FROM service_bookings WHERE page_slug = ? AND slot_start_ms >= ? ORDER BY slot_start_ms',
    o.pageSlug, o.fromMs,
  );
  return rows.map(toBooking);
}
