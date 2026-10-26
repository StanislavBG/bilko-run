import { describe, it, expect, beforeAll } from 'vitest';
import Fastify from 'fastify';
import { initDb, dbRun, dbGet } from '../server/db.js';
import { registerEgressMeter } from '../server/egress.js';
import http from 'http';
import { Readable } from 'stream';
import type { AddressInfo } from 'net';
import { createShutdown, drainWindowMs, shutdownCapMs, DEFAULT_DRAIN_SECONDS } from '../server/shutdown.js';

// Render stops the old instance with SIGTERM; server/index.ts turns that into
// app.close(). This proves close() runs the egress onClose hook and persists
// counts that the 60s timer has not flushed yet.
describe('app.close() flushes pending egress counts', () => {
  const app = Fastify({ logger: false });
  registerEgressMeter(app); // default: timer + onClose flush enabled
  app.get('/api/shutdown-probe', async () => ({ ok: true }));

  beforeAll(async () => {
    await initDb();
    await dbRun('DELETE FROM api_egress_daily');
    await app.ready();
  });

  it('writes in-memory counts to the DB on close', async () => {
    await app.inject({ method: 'GET', url: '/api/shutdown-probe' });
    const before = await dbGet('SELECT route FROM api_egress_daily WHERE route = ?', '/api/shutdown-probe');
    expect(before).toBeFalsy();

    await app.close();

    const row = await dbGet<{ requests: number }>(
      'SELECT requests FROM api_egress_daily WHERE route = ?', '/api/shutdown-probe',
    );
    expect(row?.requests).toBe(1);
  });
});


describe('deploy drain (server/shutdown.ts)', () => {
  it('parses SHUTDOWN_DRAIN_SECONDS with a safe default', () => {
    expect(drainWindowMs(undefined)).toBe(DEFAULT_DRAIN_SECONDS * 1000);
    expect(drainWindowMs('')).toBe(DEFAULT_DRAIN_SECONDS * 1000);
    expect(drainWindowMs('nope')).toBe(DEFAULT_DRAIN_SECONDS * 1000);
    expect(drainWindowMs('-5')).toBe(DEFAULT_DRAIN_SECONDS * 1000);
    expect(drainWindowMs('45')).toBe(45_000);
    expect(drainWindowMs('99999')).toBe(3_600_000);
  });

  it('drains on SIGTERM but keeps Ctrl-C short', () => {
    expect(shutdownCapMs('SIGTERM', 290_000)).toBe(290_000);
    expect(shutdownCapMs('SIGINT', 290_000)).toBe(10_000);
  });

  it('lets an in-flight download finish before exiting', async () => {
    const app = Fastify({ logger: false });
    const CHUNKS = 8;
    app.get('/big.bin', async (_req, reply) => {
      let sent = 0;
      const body = new Readable({
        read() {
          setTimeout(() => this.push(sent++ < CHUNKS ? Buffer.alloc(64 * 1024, 1) : null), 50);
        },
      });
      return reply.type('application/octet-stream').send(body);
    });
    await app.listen({ port: 0, host: '127.0.0.1' });
    const { port } = app.server.address() as AddressInfo;

    const exits: number[] = [];
    const shutdown = createShutdown(app, { drainMs: 5_000, exit: code => exits.push(code), log: () => {} });

    const received = await new Promise<number>((resolve, reject) => {
      http.get({ port, host: '127.0.0.1', path: '/big.bin' }, res => {
        let bytes = 0;
        let signalled = false;
        res.on('data', (chunk: Buffer) => {
          bytes += chunk.length;
          // SIGTERM lands mid-body, like a deploy during a game load.
          if (!signalled) { signalled = true; shutdown('SIGTERM'); }
        });
        res.on('end', () => resolve(bytes));
        res.on('error', reject);
      }).on('error', reject);
    });

    expect(received).toBe(CHUNKS * 64 * 1024);
    await new Promise(r => setTimeout(r, 1_500));
    expect(exits).toEqual([0]);
  });

  it('exits at once on a second signal', () => {
    const exits: number[] = [];
    const shutdown = createShutdown({ close: () => new Promise(() => {}) }, {
      drainMs: 60_000, exit: code => exits.push(code), log: () => {},
    });
    shutdown('SIGTERM');
    expect(exits).toEqual([]);
    shutdown('SIGTERM');
    expect(exits).toEqual([1]);
  });
});
