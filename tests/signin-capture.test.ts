import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import { initDb, dbAll, dbGet, dbRun } from '../server/db.js';

const auth = vi.hoisted(() => ({ email: 'Visitor@t.dev' as string | null, admin: true }));

vi.mock('../server/clerk.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../server/clerk.js')>();
  return {
    ...original,
    requireAuth: vi.fn().mockImplementation(async (_req: unknown, reply: any) => {
      if (auth.email) return auth.email;
      reply.status(401).send({ error: 'Sign in required.' });
      return null;
    }),
    requireAdmin: vi.fn().mockImplementation(async (_req: unknown, reply: any) => {
      if (auth.admin) return 'admin@t.dev';
      reply.status(403).send({ error: 'Admin access required.' });
      return null;
    }),
  };
});

import { registerSigninCaptureRoutes, signupsCsv } from '../server/routes/signin-capture.js';
import { signinSourceForPath } from '../shared/signin-capture.js';

const app = Fastify({ logger: false });
registerSigninCaptureRoutes(app);

const capture = (body: unknown) => app.inject({ method: 'POST', url: '/api/signin-capture', payload: body as any });

beforeAll(async () => {
  await initDb();
  await app.ready();
});

beforeEach(async () => {
  auth.email = 'Visitor@t.dev';
  auth.admin = true;
  await dbRun('DELETE FROM signin_captures');
  await dbRun('DELETE FROM funnel_events');
});

describe('POST /api/signin-capture', () => {
  it('requires a signed-in account', async () => {
    auth.email = null;
    const res = await capture({ source: 'manual' });
    expect(res.statusCode).toBe(401);
    expect(await dbAll('SELECT * FROM signin_captures')).toHaveLength(0);
  });

  it('rejects an unknown source', async () => {
    const res = await capture({ source: 'elsewhere' });
    expect(res.statusCode).toBe(400);
  });

  it('records the source with consent OFF by default and logs signin_completed once', async () => {
    const res = await capture({ source: 'session-manager' });
    expect(res.json()).toMatchObject({ ok: true, created: true, source: 'session-manager', consent: false });
    const row = await dbGet<{ email: string; consent: number; consent_at: number | null }>('SELECT * FROM signin_captures');
    expect(row).toMatchObject({ email: 'visitor@t.dev', consent: 0, consent_at: null });

    await capture({ source: 'session-manager' });
    const events = await dbAll<{ event: string; tool: string }>('SELECT event, tool FROM funnel_events');
    expect(events).toEqual([{ event: 'signin_completed', tool: 'session-manager' }]);
  });

  it('only a literal true counts as consent', async () => {
    await capture({ source: 'manual', consent: 'yes' });
    expect((await dbGet<{ consent: number }>('SELECT consent FROM signin_captures'))?.consent).toBe(0);
  });

  it('stores consent with a timestamp when ticked', async () => {
    const before = Date.now();
    const res = await capture({ source: 'manual', consent: true });
    expect(res.json()).toMatchObject({ consent: true });
    const row = await dbGet<{ consent: number; consent_at: number }>('SELECT * FROM signin_captures');
    expect(row?.consent).toBe(1);
    expect(row?.consent_at).toBeGreaterThanOrEqual(before);
  });

  it('keeps the first source; a later tick upgrades consent, an untick never revokes it', async () => {
    await capture({ source: 'manual' });
    await capture({ source: 'human-for-hire', consent: true });
    let row = await dbGet<{ source: string; consent: number }>('SELECT * FROM signin_captures');
    expect(row).toMatchObject({ source: 'manual', consent: 1 });
    await capture({ source: 'manual', consent: false });
    row = await dbGet<{ source: string; consent: number }>('SELECT * FROM signin_captures');
    expect(row?.consent).toBe(1);
  });
});

describe('admin signups', () => {
  beforeEach(async () => {
    await capture({ source: 'manual', consent: true });
    auth.email = 'b@t.dev';
    await capture({ source: 'session-manager' });
    await dbRun("INSERT INTO funnel_events (event, tool) VALUES ('prompt_shown', 'manual'), ('prompt_shown', 'manual'), ('prompt_dismissed', 'manual')");
  });

  it('is admin-only, JSON and CSV', async () => {
    auth.admin = false;
    expect((await app.inject({ method: 'GET', url: '/api/admin/signups' })).statusCode).toBe(403);
    expect((await app.inject({ method: 'GET', url: '/api/admin/signups.csv' })).statusCode).toBe(403);
  });

  it('breaks signups down by source and consent with the prompt funnel', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/signups?days=7' });
    const body = res.json();
    expect(body).toMatchObject({ total: 2, consented: 1 });
    expect(body.bySource.find((s: any) => s.source === 'manual')).toEqual({
      source: 'manual', signups: 1, consented: 1, promptShown: 2, promptDismissed: 1, signinCompleted: 1,
    });
    expect(body.bySource.find((s: any) => s.source === 'session-manager')).toMatchObject({ signups: 1, consented: 0 });
    expect(body.rows).toHaveLength(2);
  });

  it('exports CSV as an attachment', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/signups.csv' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('attachment');
    const lines = res.body.trim().split('\r\n');
    expect(lines[0]).toBe('email,source,consent,consent_at,signed_up_at');
    expect(lines[1]).toMatch(/^visitor@t\.dev,manual,yes,\d{4}-/);
    expect(lines[2]).toMatch(/^b@t\.dev,session-manager,no,,\d{4}-/);
  });

  it('defuses formula injection and quotes CSV fields', () => {
    const csv = signupsCsv([{ email: '=HYPERLINK("x"),a', source: 'manual', consent: 0, consent_at: null, created_at: 0 }]);
    expect(csv.split('\r\n')[1]).toBe(`"'=HYPERLINK(""x""),a",manual,no,,`);
  });
});

describe('signinSourceForPath', () => {
  it('maps only the three capture pages', () => {
    expect(signinSourceForPath('/products/session-manager')).toBe('session-manager');
    expect(signinSourceForPath('/products/session-manager/manual')).toBe('manual');
    expect(signinSourceForPath('/projects/human-for-hire/')).toBe('human-for-hire');
    expect(signinSourceForPath('/blog')).toBeNull();
  });
});
