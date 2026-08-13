import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync } from 'fs';
import { execSync, spawn, type ChildProcessWithoutNullStreams } from 'child_process';
import { resolve } from 'path';

// Regression test for a crash loop: the production server's SPA-fallback
// setNotFoundHandler (server/index.ts) is an `async` handler. When it calls
// `reply.send(...)` without `return`ing it, Fastify's wrapThenable resolves
// the handler's promise as soon as the function body finishes — but
// `reply.sent` only flips true once the raw HTTP response has actually
// finished writing, which happens after our async onSend hooks (CSP nonce
// injection, egress metering) resolve. That race let Fastify believe nothing
// was sent and call `reply.send(undefined)` a second time, throwing an
// uncaught ERR_HTTP_HEADERS_SENT that killed the whole process.
//
// This boots the REAL built server as a child process (not an in-process
// Fastify reimplementation) so it exercises the actual production wiring —
// static plugin, security-headers, egress hooks, and the notFoundHandler —
// exactly as Render runs it.

const repoRoot = resolve(__dirname, '..');
const serverEntry = resolve(repoRoot, 'dist-server/server/index.js');
const PORT = 34781;
const BASE = `http://127.0.0.1:${PORT}`;

let child: ChildProcessWithoutNullStreams;

async function waitForHealth(timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastErr: unknown;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/api/health`);
      if (res.ok) return;
    } catch (err) {
      lastErr = err;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Server did not become healthy in time: ${String(lastErr)}`);
}

beforeAll(async () => {
  if (!existsSync(serverEntry)) {
    execSync('pnpm build', { cwd: repoRoot, stdio: 'inherit' });
  }

  child = spawn('node', [serverEntry], {
    cwd: repoRoot,
    env: { ...process.env, NODE_ENV: 'production', PORT: String(PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  await waitForHealth(15_000);
}, 60_000);

afterAll(() => {
  child?.kill();
});

describe('unmatched /projects/ paths do not crash the production process', () => {
  it('unmatched path under an unknown slug returns a response and the process survives', async () => {
    const res = await fetch(`${BASE}/projects/fake-app-xyz/nope.js`);
    expect(res.status).toBeGreaterThanOrEqual(200);
    expect(res.status).toBeLessThan(500);

    const health = await fetch(`${BASE}/api/health`);
    expect(health.status).toBe(200);
  });

  it('unmatched path directly under /projects/ (no trailing segment) survives', async () => {
    const res = await fetch(`${BASE}/projects/fake-app-xyz`);
    expect(res.status).toBeGreaterThanOrEqual(200);
    expect(res.status).toBeLessThan(500);

    const health = await fetch(`${BASE}/api/health`);
    expect(health.status).toBe(200);
  });

  it('a real slug with a missing file survives', async () => {
    const res = await fetch(`${BASE}/projects/local-score/nope.js`);
    expect(res.status).toBeGreaterThanOrEqual(200);
    expect(res.status).toBeLessThan(500);

    const health = await fetch(`${BASE}/api/health`);
    expect(health.status).toBe(200);
  });

  it('the trailing-slash redirect for a real slug survives', async () => {
    const res = await fetch(`${BASE}/projects/local-score`, { redirect: 'manual' });
    expect(res.status).toBe(301);

    const health = await fetch(`${BASE}/api/health`);
    expect(health.status).toBe(200);
  });

  it('an unrelated unmatched top-level path survives', async () => {
    const res = await fetch(`${BASE}/totally-unknown-xyz.js`);
    expect(res.status).toBeGreaterThanOrEqual(200);
    expect(res.status).toBeLessThan(500);

    const health = await fetch(`${BASE}/api/health`);
    expect(health.status).toBe(200);
  });
});
