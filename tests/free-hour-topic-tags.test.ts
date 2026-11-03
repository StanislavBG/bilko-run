import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { initDb, dbRun, dbGet } from '../server/db.js';
import { SERVICE_SLOT_CONFIG, generateSlots } from '../shared/service-slots.js';
import { FREE_HOUR_TOPICS, parseTopicTags } from '../shared/free-hour-topics.js';

const sendMailMock = vi.hoisted(() => vi.fn());
vi.mock('../server/services/mailer.js', async (orig) => ({
  ...(await orig<typeof import('../server/services/mailer.js')>()),
  sendMail: sendMailMock,
}));
vi.mock('../server/clerk.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../server/clerk.js')>()),
  requireAdmin: vi.fn().mockResolvedValue('admin@t.dev'),
}));

let app: any;
let ipN = 0;
const post = (body: unknown) =>
  app.inject({ method: 'POST', url: '/api/services/human-for-hire/free-hour', payload: body as object, remoteAddress: `10.9.0.${++ipN}` });

beforeAll(async () => {
  await initDb();
  const { registerFreeHourRoutes } = await import('../server/routes/free-hour.js');
  const { registerAdminBookingRoutes } = await import('../server/routes/admin-bookings.js');
  app = Fastify();
  registerFreeHourRoutes(app);
  registerAdminBookingRoutes(app);
});

beforeEach(async () => {
  process.env.BILKO_INBOX = 'inbox@bilko.run';
  sendMailMock.mockReset();
  sendMailMock.mockResolvedValue({ sent: true });
  await dbRun('DELETE FROM service_bookings');
});

describe('parseTopicTags', () => {
  it('handles empty, ordering and rejects bad input', () => {
    expect(parseTopicTags(undefined)).toEqual([]);
    expect(parseTopicTags(null)).toEqual([]);
    expect(parseTopicTags([])).toEqual([]);
    expect(parseTopicTags(['Not sure yet', 'New idea'])).toEqual(['New idea', 'Not sure yet']);
    expect(parseTopicTags([...FREE_HOUR_TOPICS])).toEqual([...FREE_HOUR_TOPICS]);
    expect(parseTopicTags(['nope'])).toBeNull();
    expect(parseTopicTags(['New idea', 'New idea'])).toBeNull();
    expect(parseTopicTags('New idea')).toBeNull();
    expect(parseTopicTags({})).toBeNull();
    expect(parseTopicTags([...FREE_HOUR_TOPICS, 'New idea'])).toBeNull();
    expect(parseTopicTags([1])).toBeNull();
  });
});

describe('free hour tags', () => {
  const slot = () => generateSlots(SERVICE_SLOT_CONFIG['human-for-hire'], Date.now())[0];

  it('400s on an unknown tag', async () => {
    const res = await post({ email: 'a@example.com', startMs: slot().startMs, tags: ['bogus'] });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: 'invalid' });
  });

  it('201 stores tags and the report folds them into topic', async () => {
    const s = slot();
    const res = await post({ email: 'b@example.com', startMs: s.startMs, tags: ["Something's broken", 'New idea'], topic: 'loops' });
    expect(res.statusCode).toBe(201);
    const row: any = await dbGet('SELECT intake_json FROM service_bookings WHERE checkout_session_id = ?', res.json().cancelToken);
    expect(JSON.parse(row.intake_json)).toEqual({ topic: 'loops', tags: ['New idea', "Something's broken"] });
    const up = (await app.inject({ method: 'GET', url: '/api/admin/bookings' })).json().upcoming;
    expect(up[0].topic).toBe("New idea, Something's broken — loops");
    expect(up[0].tags).toEqual(['New idea', "Something's broken"]);
  });

  it('composes topic from either part alone and old rows', async () => {
    const now = Date.now();
    const ins = (tok: string, i: number, intake: object) => dbRun(
      `INSERT INTO service_bookings (page_slug, slug, checkout_session_id, slot_start_ms, slot_end_ms, email, intake_json, created_at)
       VALUES ('human-for-hire','free-hour',?,?,?,?,?,?)`, tok, now + (i + 1) * 86400000, now + (i + 1) * 86400000 + 3600000, `${tok}@x.com`, JSON.stringify(intake), now);
    await ins('t1', 0, { topic: '', tags: ['New idea'] });
    await ins('t2', 1, { topic: 'just note' });
    const up = (await app.inject({ method: 'GET', url: '/api/admin/bookings' })).json().upcoming;
    expect(up.map((u: any) => u.topic)).toEqual(['New idea', 'just note']);
    expect(up.map((u: any) => u.tags)).toEqual([['New idea'], []]);
  });
});
