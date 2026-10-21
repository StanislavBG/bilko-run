import { describe, it, expect, beforeAll } from 'vitest';
import { initDb } from '../server/db.js';
import {
  claimSlot, claimedStarts, bookingsForSession, listBookings,
} from '../server/services/service-bookings.js';

beforeAll(async () => { await initDb(); });

const HOUR = 3_600_000;
// 2026-03-10 18:00 UTC = 11:00 PDT
const T0 = Date.UTC(2026, 2, 10, 18, 0, 0);

function input(over: Partial<Parameters<typeof claimSlot>[0]> = {}): Parameters<typeof claimSlot>[0] {
  return {
    pageSlug: 'p-basic', slug: 'consult', checkoutSessionId: 'cs_basic', startMs: T0,
    endMs: T0 + HOUR, email: 'a@example.com', intake: { goal: 'ship' }, sessionsPerMonth: 1,
    ...over,
  };
}

describe('claimSlot', () => {
  it('claims an open slot, then reports it taken', async () => {
    const first = await claimSlot(input({ pageSlug: 'p-taken' }));
    expect(first.status).toBe('ok');
    const second = await claimSlot(input({ pageSlug: 'p-taken', checkoutSessionId: 'cs_other' }));
    expect(second.status).toBe('taken');
  });

  it('lets exactly one of two concurrent claims win', async () => {
    const results = await Promise.all([
      claimSlot(input({ pageSlug: 'p-race', checkoutSessionId: 'cs_r1' })),
      claimSlot(input({ pageSlug: 'p-race', checkoutSessionId: 'cs_r2' })),
    ]);
    expect(results.filter((r) => r.status === 'ok')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'taken')).toHaveLength(1);
  });

  it('enforces sessionsPerMonth in the PT calendar month', async () => {
    const base = { pageSlug: 'p-limit', checkoutSessionId: 'cs_limit1' };
    expect((await claimSlot(input({ ...base, sessionsPerMonth: 1 }))).status).toBe('ok');
    expect((await claimSlot(input({ ...base, startMs: T0 + 24 * HOUR, endMs: T0 + 25 * HOUR, sessionsPerMonth: 1 }))).status).toBe('limit');

    const b2 = { pageSlug: 'p-limit2', checkoutSessionId: 'cs_limit2' };
    expect((await claimSlot(input({ ...b2, sessionsPerMonth: 2 }))).status).toBe('ok');
    expect((await claimSlot(input({ ...b2, startMs: T0 + 24 * HOUR, endMs: T0 + 25 * HOUR, sessionsPerMonth: 2 }))).status).toBe('ok');
    expect((await claimSlot(input({ ...b2, startMs: T0 + 48 * HOUR, endMs: T0 + 49 * HOUR, sessionsPerMonth: 2 }))).status).toBe('limit');

    // A different PT month is not counted.
    const nextMonth = Date.UTC(2026, 3, 10, 18, 0, 0);
    expect((await claimSlot(input({ ...base, startMs: nextMonth, endMs: nextMonth + HOUR, sessionsPerMonth: 1 }))).status).toBe('ok');
  });

  it('uses Pacific Time for month boundaries', async () => {
    // 2026-04-01 03:00 UTC is still 2026-03-31 in PT (March).
    const edge = Date.UTC(2026, 3, 1, 3, 0, 0);
    const base = { pageSlug: 'p-edge', checkoutSessionId: 'cs_edge' };
    expect((await claimSlot(input({ ...base, startMs: T0, endMs: T0 + HOUR }))).status).toBe('ok');
    expect((await claimSlot(input({ ...base, startMs: edge, endMs: edge + HOUR }))).status).toBe('limit');
  });
});

describe('reads', () => {
  it('claimedStarts filters by fromMs', async () => {
    await claimSlot(input({ pageSlug: 'p-from', checkoutSessionId: 'cs_f', startMs: T0, endMs: T0 + HOUR, sessionsPerMonth: 5 }));
    await claimSlot(input({ pageSlug: 'p-from', checkoutSessionId: 'cs_f', startMs: T0 + 2 * HOUR, endMs: T0 + 3 * HOUR, sessionsPerMonth: 5 }));
    expect(await claimedStarts('p-from', 0)).toEqual([T0, T0 + 2 * HOUR]);
    expect(await claimedStarts('p-from', T0 + HOUR)).toEqual([T0 + 2 * HOUR]);
    expect(await claimedStarts('p-none', 0)).toEqual([]);
  });

  it('round-trips intake as JSON and lists bookings', async () => {
    const intake = { goal: 'agents', links: ['a', 'b'], n: 3, nested: { ok: true } };
    const res = await claimSlot(input({ pageSlug: 'p-intake', checkoutSessionId: 'cs_i', intake }));
    expect(res.status).toBe('ok');
    const mine = await bookingsForSession('cs_i');
    expect(mine).toHaveLength(1);
    expect(mine[0].intake).toEqual(intake);
    expect(mine[0].email).toBe('a@example.com');
    const all = await listBookings({ pageSlug: 'p-intake', fromMs: 0 });
    expect(all).toHaveLength(1);
    expect(all[0].intake).toEqual(intake);
    expect(await listBookings({ pageSlug: 'p-intake', fromMs: T0 + 1 })).toHaveLength(0);
  });
});
