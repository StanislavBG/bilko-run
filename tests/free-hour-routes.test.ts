import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { initDb } from '../server/db.js';
import { SERVICE_SLOT_CONFIG, generateSlots } from '../shared/service-slots.js';
import { identityHits } from './identity-denylist.js';

const sendMailMock = vi.hoisted(() => vi.fn());
vi.mock('../server/services/mailer.js', async (orig) => ({
  ...(await orig<typeof import('../server/services/mailer.js')>()),
  sendMail: sendMailMock,
}));

const slots = () => generateSlots(SERVICE_SLOT_CONFIG['human-for-hire'], Date.now());
let ipN = 0;
let app: any;
const post = (body: unknown, url = '/api/services/human-for-hire/free-hour', ip?: string) =>
  app.inject({ method: 'POST', url, payload: body as object, remoteAddress: ip ?? `10.2.0.${++ipN}` });

beforeAll(async () => {
  await initDb();
  const { registerFreeHourRoutes } = await import('../server/routes/free-hour.js');
  const { registerServiceBookingRoutes } = await import('../server/routes/service-bookings.js');
  app = Fastify();
  registerServiceBookingRoutes(app);
  registerFreeHourRoutes(app);
});

beforeEach(() => {
  process.env.RESEND_API_KEY = 're_fake';
  process.env.MAIL_FROM = 'Bilko <hi@bilko.run>';
  process.env.BILKO_INBOX = 'inbox@bilko.run';
  sendMailMock.mockReset();
  sendMailMock.mockResolvedValue({ sent: true });
});

describe('free hour routes', () => {
  it('books a slot signed out, mails the booker and the inbox', async () => {
    const s = slots()[0];
    const res = await post({ email: 'Pat@Example.com', startMs: s.startMs, topic: 'my agent loops' });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.booking).toEqual({ startMs: s.startMs, endMs: s.endMs });
    expect(body.emailed).toBe(true);
    expect(body.cancelToken).toMatch(/^free_/);
    expect(body.ics).toContain('DTSTART');
    expect(sendMailMock).toHaveBeenCalledTimes(2);
    const [toBooker, toInbox] = sendMailMock.mock.calls.map((c) => c[0]);
    expect(toBooker.to).toBe('Pat@Example.com');
    expect(toBooker.attachments[0].filename).toBe('bilko-session.ics');
    const ics = Buffer.from(toBooker.attachments[0].content, 'base64').toString('utf8');
    const stamp = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    expect(ics).toContain(`DTSTART:${stamp(s.startMs)}`);
    expect(ics).toContain(`DTEND:${stamp(s.startMs + 60 * 60_000)}`);
    expect(toInbox.to).toBe('inbox@bilko.run');
    expect(toInbox.text).toContain('my agent loops');
    expect(identityHits(res.body + toBooker.text + toInbox.text)).toEqual([]);
    const { dbGet } = await import('../server/db.js');
    const row: any = await dbGet('SELECT * FROM service_bookings WHERE checkout_session_id = ?', body.cancelToken);
    expect(row.page_slug).toBe('human-for-hire');
    expect(row.slug).toBe('free-hour');
  });

  it('keeps the booking when mail fails', async () => {
    sendMailMock.mockRejectedValue(new Error('boom'));
    const s = slots()[1];
    const res = await post({ email: 'fail@example.com', startMs: s.startMs });
    expect(res.statusCode).toBe(201);
    expect(res.json().emailed).toBe(false);
    expect(res.json().ics).toContain('DTSTART');
  });

  it('refuses a repeat email in another case, and bad slots', async () => {
    const s = slots()[2];
    expect((await post({ email: 'dup@example.com', startMs: s.startMs })).statusCode).toBe(201);
    sendMailMock.mockClear();
    const again = await post({ email: 'DUP@Example.com', startMs: slots()[3].startMs });
    expect(again.statusCode).toBe(409);
    expect(again.json()).toEqual({ error: 'already_booked' });
    expect(sendMailMock).not.toHaveBeenCalled();
    const taken = await post({ email: 'other@example.com', startMs: s.startMs });
    expect(taken.json()).toEqual({ error: 'slot_unavailable' });
    expect((await post({ email: 'o2@example.com', startMs: s.startMs + 1 })).json()).toEqual({ error: 'slot_unavailable' });
  });

  it('rejects invalid input', async () => {
    const s = slots()[4];
    for (const body of [
      { email: 'nope', startMs: s.startMs },
      { email: 'a@example.com', startMs: s.startMs, website: 'x' },
      { email: 'a@example.com', startMs: s.startMs, topic: 'x'.repeat(2001) },
      { email: 'a@example.com', startMs: 1.5 },
      { email: 'a@example.com', startMs: '5' },
    ]) {
      const r = await post(body);
      expect(r.statusCode).toBe(400);
      expect(r.json()).toEqual({ error: 'invalid' });
    }
  });

  it('rate limits the 7th post from one IP', async () => {
    const ip = '10.9.9.9';
    for (let i = 0; i < 6; i++) expect((await post({ email: 'bad' }, undefined, ip)).statusCode).toBe(400);
    expect((await post({ email: 'bad' }, undefined, ip)).statusCode).toBe(429);
  });

  it('refuses with 503 when mail is unset and writes no row', async () => {
    delete process.env.RESEND_API_KEY;
    const s = slots()[5];
    const r = await post({ email: 'nomail@example.com', startMs: s.startMs });
    expect(r.statusCode).toBe(503);
    expect(r.json()).toEqual({ error: 'booking_unavailable' });
    process.env.RESEND_API_KEY = 're_fake';
    const open = (await app.inject({ method: 'GET', url: '/api/services/human-for-hire/slots' })).json().slots;
    expect(open.some((x: any) => x.startMs === s.startMs)).toBe(true);
  });

  it('dryRun checks without writing or mailing', async () => {
    const s = slots()[6];
    const url = '/api/services/human-for-hire/free-hour?dryRun=1';
    const r = await post({ email: 'dry@example.com', startMs: s.startMs }, url);
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ dryRun: true });
    expect(sendMailMock).not.toHaveBeenCalled();
    expect((await post({ email: 'dry@example.com', startMs: s.startMs })).statusCode).toBe(201);
    const dup = await post({ email: 'dry@example.com', startMs: slots()[7].startMs }, url);
    expect(dup.statusCode).toBe(409);
    expect(dup.json()).toEqual({ error: 'already_booked' });
    expect((await post({ email: 'd2@example.com', startMs: s.startMs }, url)).json()).toEqual({ error: 'slot_unavailable' });
  });

  it('cancels with a token and frees the slot', async () => {
    const s = slots()[8];
    const booked = await post({ email: 'cancel@example.com', startMs: s.startMs });
    const token = booked.json().cancelToken;
    sendMailMock.mockClear();
    const cancel = '/api/services/human-for-hire/free-hour/cancel';
    expect((await post({ token: 'bad' }, cancel)).statusCode).toBe(400);
    expect((await post({ token: 'free_' + '0'.repeat(36) }, cancel)).statusCode).toBe(404);
    const ok = await post({ token }, cancel);
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toEqual({ cancelled: true });
    expect(sendMailMock).toHaveBeenCalledTimes(1);
    expect(sendMailMock.mock.calls[0][0].to).toBe('inbox@bilko.run');
    expect(identityHits(sendMailMock.mock.calls[0][0].text)).toEqual([]);
    const open = (await app.inject({ method: 'GET', url: '/api/services/human-for-hire/slots' })).json().slots;
    expect(open.some((x: any) => x.startMs === s.startMs)).toBe(true);
    expect((await post({ token }, cancel)).statusCode).toBe(404);
  });
});
