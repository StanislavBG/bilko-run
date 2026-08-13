import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { initDb, dbRun, dbGet } from '../server/db.js';
import { registerProjectFeedbackRoutes } from '../server/routes/project-feedback.js';

const TOKEN = 'test-snapshot-token';
process.env.PROJECT_SNAPSHOT_TOKEN = TOKEN;

const app = Fastify({ logger: false, bodyLimit: 8 * 1024 * 1024 });
registerProjectFeedbackRoutes(app);

beforeAll(async () => {
  await initDb();
  await app.ready();
});

beforeEach(async () => {
  await dbRun('DELETE FROM project_feedback');
});

const SLUG = 'social-signals-trader';
const URL = `/api/projects/${SLUG}/feedback`;

// The public POST is per-IP rate limited (10/min) and the bucket is
// process-global, so every submit here uses a distinct synthetic IP.
let ipSeq = 0;
function submit(body: Record<string, unknown>) {
  ipSeq += 1;
  return app.inject({
    method: 'POST',
    url: URL,
    headers: { 'content-type': 'application/json', 'x-forwarded-for': `10.0.0.${ipSeq}` },
    body: JSON.stringify({
      target: { kind: 'component', id: 'equity-curve' },
      type: 'feedback',
      title: 'Test title',
      description: 'Test description',
      ...body,
    }),
  });
}

function pull(query = '') {
  return app.inject({
    method: 'GET',
    url: `${URL}${query}`,
    headers: { authorization: `Bearer ${TOKEN}` },
  });
}

function moderate(id: string, body: unknown, token: string | null = TOKEN) {
  ipSeq += 1;
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'x-forwarded-for': `10.1.0.${ipSeq}`,
  };
  if (token) headers['authorization'] = `Bearer ${token}`;
  return app.inject({
    method: 'POST',
    url: `${URL}/${id}/moderate`,
    headers,
    body: JSON.stringify(body),
  });
}

describe('parentId passthrough', () => {
  it('stores a submitted parentId and echoes it back on GET', async () => {
    const parent = await submit({});
    const parentId = parent.json().id as string;

    const child = await submit({ parentId, title: 'A reply' });
    expect(child.statusCode).toBe(201);
    expect(child.json().parentId).toBe(parentId);

    const items = pullItems(await pull());
    const reply = items.find((i) => i.title === 'A reply');
    expect(reply.parentId).toBe(parentId);
  });

  it('treats parentId as opaque — a dangling id is stored unchanged', async () => {
    await submit({ parentId: 'fb_does_not_exist' });
    const items = pullItems(await pull());
    expect(items[0].parentId).toBe('fb_does_not_exist');
  });

  it('omitting parentId yields null, not undefined', async () => {
    const res = await submit({});
    expect(res.json().parentId).toBeNull();
    expect(pullItems(await pull())[0].parentId).toBeNull();
  });
});

describe('moderation route', () => {
  it('requires a bearer token', async () => {
    const id = (await submit({})).json().id as string;
    expect((await moderate(id, { action: 'archive' }, null)).statusCode).toBe(401);
    expect((await moderate(id, { action: 'archive' }, 'wrong')).statusCode).toBe(401);
  });

  it('rejects an unknown action', async () => {
    const id = (await submit({})).json().id as string;
    expect((await moderate(id, { action: 'nuke' })).statusCode).toBe(400);
  });

  it('404s on an unknown feedback id', async () => {
    expect((await moderate('fb_nope', { action: 'archive' })).statusCode).toBe(404);
  });

  it('archives and surfaces the state through GET', async () => {
    const id = (await submit({})).json().id as string;
    const res = await moderate(id, { action: 'archive', reason: 'stale topic' });
    expect(res.statusCode).toBe(200);
    expect(res.json().action).toBe('archive');
    expect(typeof res.json().moderatedAt).toBe('string');

    const item = pullItems(await pull())[0];
    expect(item.moderation.action).toBe('archived');
    expect(item.moderation.reason).toBe('stale topic');
  });

  it('delete HIDES rather than purges, so the puller cannot resurrect it', async () => {
    const id = (await submit({})).json().id as string;
    expect((await moderate(id, { action: 'delete' })).statusCode).toBe(200);

    const row = await dbGet('SELECT id, moderation_action FROM project_feedback WHERE id = ?', id);
    expect(row).toBeTruthy();
    expect((row as { moderation_action: string }).moderation_action).toBe('deleted');

    expect(pullItems(await pull())[0].moderation.action).toBe('deleted');
  });

  it('unarchive and restore clear the state', async () => {
    const id = (await submit({})).json().id as string;
    await moderate(id, { action: 'delete' });
    expect((await moderate(id, { action: 'restore' })).statusCode).toBe(200);
    expect(pullItems(await pull())[0].moderation).toBeNull();

    await moderate(id, { action: 'archive' });
    await moderate(id, { action: 'unarchive' });
    expect(pullItems(await pull())[0].moderation).toBeNull();
  });

  it('cannot moderate another project\'s row', async () => {
    const id = (await submit({})).json().id as string;
    const res = await app.inject({
      method: 'POST',
      url: `/api/projects/other-project/feedback/${id}/moderate`,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${TOKEN}`, 'x-forwarded-for': '10.2.0.1' },
      body: JSON.stringify({ action: 'archive' }),
    });
    expect(res.statusCode).toBe(404);
  });
});

describe('moderatedSince cursor', () => {
  it('re-admits an already-pulled row whose moderation changed', async () => {
    const id = (await submit({})).json().id as string;
    const first = await pull();
    const nextSince = first.json().nextSince as string;

    // Incremental pull with only the created_at cursor sees nothing new.
    expect(pullItems(await pull(`?since=${encodeURIComponent(nextSince)}`))).toHaveLength(0);

    await moderate(id, { action: 'archive' });

    // Same cursor, plus the moderation cursor → the row comes back.
    const again = pullItems(await pull(`?since=${encodeURIComponent(nextSince)}&moderatedSince=1970-01-01T00:00:00Z`));
    expect(again).toHaveLength(1);
    expect(again[0].moderation.action).toBe('archived');
  });

  it('never regresses nextSince when a page holds only re-admitted rows', async () => {
    const id = (await submit({})).json().id as string;
    const nextSince = (await pull()).json().nextSince as string;
    await moderate(id, { action: 'archive' });

    const res = await pull(`?since=${encodeURIComponent(nextSince)}&moderatedSince=1970-01-01T00:00:00Z`);
    expect(new Date(res.json().nextSince as string).getTime()).toBeGreaterThanOrEqual(new Date(nextSince).getTime());
    expect(typeof res.json().nextModeratedSince).toBe('string');
  });
});

interface Item { title: string; parentId: string | null; moderation: { action: string; reason: string | null } | null }
function pullItems(res: { json: () => unknown }): Item[] {
  return (res.json() as { items: Item[] }).items;
}
