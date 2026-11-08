import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import Fastify from 'fastify';
import { initDb, dbAll } from '../server/db.js';
import { registerTelemetryRoutes } from '../server/routes/telemetry.js';

const sent: { url: string; body: string }[] = [];

async function load() {
  return import('../src/lib/telemetry');
}

const evt = () => JSON.parse(sent[0].body).batch[0];

describe('host trackFlow', () => {
  // Browser globals for the host client lib; unstubbed after each test so the
  // server-side ingest tests below run against real Node globals.
  beforeEach(() => {
    sent.length = 0;
    vi.stubGlobal('navigator', {
      sendBeacon: (url: string, blob: Blob) => {
        sent.push({ url, body: (blob as unknown as { __b: string }).__b });
        return true;
      },
    });
    vi.stubGlobal('Blob', class { __b: string; constructor(parts: string[]) { this.__b = parts.join(''); } });
    vi.stubGlobal('location', { pathname: '/pricing', protocol: 'https:' });
    vi.stubGlobal('document', { cookie: '' });
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {} });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends the host-kit payload shape to /api/telemetry/event', async () => {
    const { trackFlow } = await load();
    trackFlow('download', 'click', { plan: 'x' });
    expect(sent).toHaveLength(1);
    expect(sent[0].url).toBe('/api/telemetry/event');
    const e = evt();
    expect(e.app).toBe('bilko');
    expect(e.name).toBe('download.click');
    expect(typeof e.visitor_id).toBe('string');
    expect(typeof e.session_id).toBe('string');
    expect(typeof e.ts).toBe('number');
    expect(e.props).toEqual({ plan: 'x', flow: 'download', step: 'click', path: '/pricing' });
  });

  it('drops invalid flow or step names', async () => {
    const { trackFlow } = await load();
    trackFlow('Bad Flow', 'click');
    trackFlow('ok', '-bad');
    trackFlow('ok', 'a'.repeat(41));
    expect(sent).toHaveLength(0);
  });

  it('redacts sensitive prop keys', async () => {
    const { trackFlow } = await load();
    trackFlow('buy', 'start', { email: 'a@b.c', apiKey: 'k', ok: 1 });
    const p = evt().props;
    expect(p.email).toBe('[redacted]');
    expect(p.apiKey).toBe('[redacted]');
    expect(p.ok).toBe(1);
  });
});

describe('host-kit env on POST /api/telemetry/event', () => {
  const app = Fastify({ trustProxy: true, logger: false });
  registerTelemetryRoutes(app, { scheduledPrune: false });

  beforeAll(async () => {
    await initDb();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("stores funnel_events.env 'dev' for env 'dev' and NULL for env 'bogus'", async () => {
    // Record shape as host-kit's track() sends it from a localhost dev server.
    const rec = (name: string, env: string) => ({
      app: 'host-kit-env', name, env, ts: Date.now(),
      visitor_id: '44444444-4444-4444-8444-444444444444',
      session_id: '55555555-5555-4555-8555-555555555555',
      props: { path: '/' },
    });
    const res = await app.inject({
      method: 'POST',
      url: '/api/telemetry/event',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '10.77.0.1' },
      body: JSON.stringify({ batch: [rec('dev.view', 'dev'), rec('bogus.view', 'bogus')] }),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, ingested: 2 });
    const rows = await dbAll<{ event: string; env: string | null }>(
      'SELECT event, env FROM funnel_events WHERE tool = ? ORDER BY id',
      'host-kit-env',
    );
    expect(rows).toEqual([
      { event: 'dev.view', env: 'dev' },
      { event: 'bogus.view', env: null },
    ]);
  });
});
