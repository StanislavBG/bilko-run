import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { createHash } from 'node:crypto';
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

function setStatus(id: string, body: unknown, token: string | null = TOKEN, slug = SLUG) {
  ipSeq += 1;
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'x-forwarded-for': `10.3.0.${ipSeq}`,
  };
  if (token) headers['authorization'] = `Bearer ${token}`;
  return app.inject({
    method: 'POST',
    url: `/api/projects/${slug}/feedback/${id}/status`,
    headers,
    body: JSON.stringify(body),
  });
}

function lookup(body: unknown, slug = SLUG) {
  ipSeq += 1;
  return app.inject({
    method: 'POST',
    url: `/api/projects/${slug}/feedback/status-lookup`,
    headers: { 'content-type': 'application/json', 'x-forwarded-for': `10.4.0.${ipSeq}` },
    body: JSON.stringify(body),
  });
}

describe('submit receipt', () => {
  it('returns a 32-byte base64url receipt and stores only its sha256', async () => {
    const res = await submit({});
    expect(res.statusCode).toBe(201);
    const { id, receipt } = res.json() as { id: string; receipt: string };
    expect(receipt).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Buffer.from(receipt, 'base64url')).toHaveLength(32);

    const row = (await dbGet('SELECT * FROM project_feedback WHERE id = ?', id)) as Record<string, unknown>;
    expect(row.receipt_hash).toBe(createHash('sha256').update(receipt).digest('hex'));
    expect(Object.values(row)).not.toContain(receipt);
  });
});

describe('status route', () => {
  it('requires a bearer token', async () => {
    const id = (await submit({})).json().id as string;
    expect((await setStatus(id, { status: 'resolved' }, null)).statusCode).toBe(401);
    expect((await setStatus(id, { status: 'resolved' }, 'wrong')).statusCode).toBe(401);
  });

  it('rejects a bad status or note', async () => {
    const id = (await submit({})).json().id as string;
    expect((await setStatus(id, { status: 'done' })).statusCode).toBe(400);
    expect((await setStatus(id, {})).statusCode).toBe(400);
    expect((await setStatus(id, { status: 'resolved', note: 'x'.repeat(501) })).statusCode).toBe(400);
    expect((await setStatus(id, { status: 'resolved', note: 42 })).statusCode).toBe(400);
  });

  it('404s on an unknown id and on another project\'s row', async () => {
    expect((await setStatus('fb_nope', { status: 'resolved' })).statusCode).toBe(404);
    const id = (await submit({})).json().id as string;
    expect((await setStatus(id, { status: 'resolved' }, TOKEN, 'other-project')).statusCode).toBe(404);
  });

  it('sets status and surfaces it through GET; default is open', async () => {
    const id = (await submit({})).json().id as string;
    expect(pullItems(await pull())[0].status).toEqual({ value: 'open', note: null, at: null });

    const res = await setStatus(id, { status: 'in_progress', note: 'on it' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ id, status: 'in_progress', note: 'on it' });
    expect(new Date(res.json().statusAt).toISOString()).toBe(res.json().statusAt);

    const item = pullItems(await pull())[0];
    expect(item.status.value).toBe('in_progress');
    expect(item.status.note).toBe('on it');
    expect(item.status.at).toBe(res.json().statusAt);
  });
});

describe('status lookup', () => {
  it('returns status only for matching receipts and never content', async () => {
    const a = (await submit({})).json() as { id: string; receipt: string };
    const b = (await submit({})).json() as { id: string; receipt: string };
    await setStatus(a.id, { status: 'resolved', note: 'fixed in 1.2' });

    const res = await lookup({
      items: [
        a,
        { id: b.id, receipt: a.receipt }, // wrong receipt for b
        { id: 'fb_nope', receipt: a.receipt }, // unknown id
      ],
    });
    expect(res.statusCode).toBe(200);
    const items = res.json().items as Record<string, unknown>[];
    expect(items).toHaveLength(1);
    expect(items[0]).toEqual({ id: a.id, status: 'resolved', note: 'fixed in 1.2', statusAt: expect.any(String) });
    expect(res.payload).not.toContain('Test title');
    expect(res.payload).not.toContain('Test description');

    const open = (await lookup({ items: [b] })).json().items;
    expect(open).toEqual([{ id: b.id, status: 'open', note: null, statusAt: null }]);
  });

  it('is slug-scoped', async () => {
    const a = (await submit({})).json() as { id: string; receipt: string };
    expect((await lookup({ items: [a] }, 'other-project')).json().items).toEqual([]);
  });

  it('never returns pre-receipt rows', async () => {
    const id = (await submit({})).json().id as string;
    await dbRun('UPDATE project_feedback SET receipt_hash = NULL WHERE id = ?', id);
    expect((await lookup({ items: [{ id, receipt: 'anything' }] })).json().items).toEqual([]);
  });

  it('validates the item list', async () => {
    expect((await lookup({})).statusCode).toBe(400);
    expect((await lookup({ items: [] })).statusCode).toBe(400);
    const tooMany = Array.from({ length: 101 }, (_, i) => ({ id: `fb_${i}`, receipt: 'r' }));
    expect((await lookup({ items: tooMany })).statusCode).toBe(400);
    expect((await lookup({ items: [{ id: 'fb_1' }] })).statusCode).toBe(400);
    expect((await lookup({ items: [{ id: 'fb_1', receipt: 'r'.repeat(201) }] })).statusCode).toBe(400);
  });
});

describe('status rides the moderatedSince cursor', () => {
  it('re-admits an already-pulled row whose status changed', async () => {
    const id = (await submit({})).json().id as string;
    const first = (await pull()).json();
    const nextSince = first.nextSince as string;
    const q = `?since=${encodeURIComponent(nextSince)}&moderatedSince=1970-01-01T00:00:00Z`;
    expect(pullItems(await pull(q))).toHaveLength(0);

    const statusAt = (await setStatus(id, { status: 'wontfix' })).json().statusAt as string;

    const res = await pull(q);
    expect(pullItems(res)).toHaveLength(1);
    expect(pullItems(res)[0].status.value).toBe('wontfix');
    expect(res.json().nextModeratedSince).toBe(statusAt);
  });
});

describe('images=none', () => {
  const dataUrl = `data:image/png;base64,${'A'.repeat(20_000)}`;

  it('drops the payload but keeps the metadata, shrinking the response', async () => {
    await submit({ image: { dataUrl, mime: 'image/png' } });

    const full = await pull();
    const lean = await pull('?images=none');

    expect(pullItems(full)[0].image.dataUrl).toContain('data:image/png');
    expect(pullItems(lean)[0].image.dataUrl).toBeNull();
    // Metadata survives, so the caller still knows a blob exists and how big.
    expect(pullItems(lean)[0].image.bytes).toBe(dataUrl.length);
    expect(pullItems(lean)[0].image.mime).toBe('image/png');
    expect(lean.payload.length).toBeLessThan(full.payload.length / 10);
  });

  it('items with no image are unaffected', async () => {
    await submit({});
    expect(pullItems(await pull('?images=none'))[0].image).toBeNull();
  });

  it('returns the exact item shape for an image row and a no-image row', async () => {
    const withImg = await submit({ title: 'With image', image: { dataUrl, mime: 'image/png' } });
    const noImg = await submit({ title: 'No image' });
    const items = pullItems(await pull('?images=none'));
    const byId = (id: string) => items.find((i) => i.id === id);
    const base = {
      route: null,
      type: 'feedback',
      description: 'Test description',
      target: { kind: 'component', id: 'equity-curve', label: null },
      client: null,
      snapshotGeneratedAt: null,
      parentId: null,
      moderation: null,
      status: { value: 'open', note: null, at: null },
    };
    expect(byId(withImg.json().id)).toEqual({
      ...base,
      id: withImg.json().id,
      receivedAt: expect.any(String),
      title: 'With image',
      image: { dataUrl: null, mime: 'image/png', bytes: dataUrl.length },
    });
    expect(byId(noImg.json().id)).toEqual({
      ...base,
      id: noImg.json().id,
      receivedAt: expect.any(String),
      title: 'No image',
      image: null,
    });
  });
});

interface Item {
  title: string;
  parentId: string | null;
  image: { dataUrl: string | null; mime: string | null; bytes: number } | null;
  moderation: { action: string; reason: string | null } | null;
  status: { value: string; note: string | null; at: string | null };
}
function pullItems(res: { json: () => unknown }): Item[] {
  return (res.json() as { items: Item[] }).items;
}
