import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { initDb } from '../server/db.js';
import { SERVICE_SLOT_CONFIG, generateSlots } from '../shared/service-slots.js';

const sendMailMock = vi.hoisted(() => vi.fn());
vi.mock('../server/services/mailer.js', async (orig) => ({
  ...(await orig<typeof import('../server/services/mailer.js')>()),
  sendMail: sendMailMock,
}));

const slots = () => generateSlots(SERVICE_SLOT_CONFIG['human-for-hire'], Date.now());
let ipN = 0;
let app: any;
const BASE = '/api/services/human-for-hire/free-hour';
const post = (body: unknown, url = BASE) =>
  app.inject({ method: 'POST', url, payload: body as object, remoteAddress: `10.9.0.${++ipN}` });

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(Date.UTC(2026, 10, 2, 20));
  await initDb();
  const { registerFreeHourRoutes } = await import('../server/routes/free-hour.js');
  app = Fastify();
  registerFreeHourRoutes(app);
});
afterAll(() => vi.useRealTimers());
beforeEach(() => {
  process.env.BILKO_INBOX = 'inbox@bilko.run';
  sendMailMock.mockReset();
  sendMailMock.mockResolvedValue({ sent: true });
});

describe('free hour reschedule', () => {
  it('moves the booking, freeing the old slot and claiming the new one', async () => {
    const [a, b, c] = slots();
    const booked = (await post({ email: 'mover@example.com', startMs: a.startMs })).json();
    const res = await post({ token: booked.cancelToken, startMs: b.startMs }, `${BASE}/reschedule`);
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.booking).toEqual({ startMs: b.startMs, endMs: b.endMs });
    expect(body.cancelToken).toBe(booked.cancelToken);
    expect(body.ics).toContain('DTSTART');
    expect(sendMailMock.mock.calls.at(-1)![0].subject).toContain('Rescheduled');

    const { bookingsForSession, claimedStarts } = await import('../server/services/service-bookings.js');
    const rows = await bookingsForSession(booked.cancelToken);
    expect(rows).toHaveLength(1);
    expect(rows[0].slotStartMs).toBe(b.startMs);
    const starts = await claimedStarts('human-for-hire', Date.now());
    expect(starts).toContain(b.startMs);
    expect(starts).not.toContain(a.startMs);

    // own current start is not an open slot; old slot is open again for someone else
    expect((await post({ token: booked.cancelToken, startMs: b.startMs }, `${BASE}/reschedule`)).statusCode).toBe(409);
    expect((await post({ email: 'other@example.com', startMs: a.startMs })).statusCode).toBe(201);
    void c;
  });

  it('409s when the target is taken', async () => {
    const s = slots();
    const t1 = (await post({ email: 'one@example.com', startMs: s[3].startMs })).json();
    await post({ email: 'two@example.com', startMs: s[4].startMs });
    const res = await post({ token: t1.cancelToken, startMs: s[4].startMs }, `${BASE}/reschedule`);
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe('slot_unavailable');
  });

  it('404s on an unknown token', async () => {
    const res = await post(
      { token: 'free_00000000-0000-0000-0000-000000000000', startMs: slots()[6].startMs }, `${BASE}/reschedule`,
    );
    expect(res.statusCode).toBe(404);
  });

  it('400s on a malformed token or startMs', async () => {
    expect((await post({ token: 'nope', startMs: slots()[6].startMs }, `${BASE}/reschedule`)).statusCode).toBe(400);
    expect((await post({ token: 'free_00000000-0000-0000-0000-000000000000', startMs: 'x' }, `${BASE}/reschedule`)).statusCode).toBe(400);
  });
});
