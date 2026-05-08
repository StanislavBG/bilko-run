import type { FastifyInstance } from 'fastify';
import { randomBytes } from 'crypto';
import { dbRun } from './db.js';

const ENFORCE = process.env.BILKO_CSP_ENFORCE === '1';

const PERMISSIONS = [
  'accelerometer=()', 'camera=()', 'geolocation=(self)', 'gyroscope=()',
  'magnetometer=()', 'microphone=(self)', 'payment=(self)', 'usb=()',
].join(', ');

function buildCsp(nonce: string): string {
  return [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' https://js.clerk.com https://js.stripe.com 'strict-dynamic'`,
    `style-src 'self' 'nonce-${nonce}'`,
    `img-src 'self' data: https://*.clerk.com https://*.stripe.com https://avatars.githubusercontent.com`,
    `font-src 'self' data:`,
    `connect-src 'self' https://*.clerk.com https://api.stripe.com`,
    `frame-src https://*.clerk.com https://js.stripe.com https://hooks.stripe.com`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self' https://*.stripe.com`,
    `frame-ancestors 'none'`,
    `report-uri /api/security/csp-report`,
    `upgrade-insecure-requests`,
  ].join('; ');
}

// In-memory rate limiter for the CSP report endpoint (60 req/min/IP).
const _cspReportCounts = new Map<string, { count: number; windowStart: number }>();
const CSP_RATE_LIMIT = 60;
const CSP_RATE_WINDOW_MS = 60_000;

function checkCspRate(ip: string): boolean {
  const now = Date.now();
  const entry = _cspReportCounts.get(ip);
  if (!entry || now - entry.windowStart > CSP_RATE_WINDOW_MS) {
    _cspReportCounts.set(ip, { count: 1, windowStart: now });
    if (_cspReportCounts.size > 2000) {
      for (const [k, v] of _cspReportCounts) {
        if (now - v.windowStart > CSP_RATE_WINDOW_MS) _cspReportCounts.delete(k);
      }
    }
    return true;
  }
  entry.count += 1;
  return entry.count <= CSP_RATE_LIMIT;
}

export function registerSecurityHeaders(app: FastifyInstance): void {
  // Parse CSP violation reports — browsers send application/csp-report (JSON body)
  app.addContentTypeParser('application/csp-report', { parseAs: 'string' }, (_req, body, done) => {
    try { done(null, JSON.parse(body as string)); } catch { done(null, {}); }
  });

  app.addHook('onRequest', async (req, reply) => {
    const nonce = randomBytes(16).toString('base64');
    (req as any).cspNonce = nonce;
    reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    reply.header('Permissions-Policy', PERMISSIONS);
    reply.header('Cross-Origin-Opener-Policy', 'same-origin');
    const cspHeader = ENFORCE ? 'Content-Security-Policy' : 'Content-Security-Policy-Report-Only';
    reply.header(cspHeader, buildCsp(nonce));
  });

  // Inject the per-request nonce onto every <script> and <style> tag in HTML responses.
  // Also injects a <meta name="csp-nonce"> for host-kit runtime CSS (e.g. emotion).
  // Handles string and Buffer payloads; streams (static files) are not rewritten here.
  app.addHook('onSend', async (req, reply, payload) => {
    const ctype = String(reply.getHeader('content-type') ?? '');
    if (!ctype.startsWith('text/html')) return payload;
    const nonce = (req as any).cspNonce as string;
    let html: string;
    if (typeof payload === 'string') {
      html = payload;
    } else if (Buffer.isBuffer(payload)) {
      html = payload.toString('utf-8');
    } else {
      return payload; // streams — nonce injection not applied
    }
    return html
      .replace(/<script(?![^>]*\bnonce=)/gi, `<script nonce="${nonce}"`)
      .replace(/<style(?![^>]*\bnonce=)/gi, `<style nonce="${nonce}"`)
      .replace(/(<head[^>]*>)/i, `$1<meta name="csp-nonce" content="${nonce}">`);
  });

  app.post('/api/security/csp-report', async (req, reply) => {
    const ip = req.ip ?? 'unknown';
    if (!checkCspRate(ip)) return reply.code(429).send();
    const body = req.body as any;
    const r = body?.['csp-report'] ?? body ?? {};
    await dbRun(
      `INSERT INTO csp_violations (blocked_uri, violated_dir, document_uri, source_file, line_number, user_agent, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      String(r['blocked-uri'] ?? '').slice(0, 500),
      String(r['violated-directive'] ?? '').slice(0, 200),
      String(r['document-uri'] ?? '').slice(0, 500),
      String(r['source-file'] ?? '').slice(0, 500),
      Number.isFinite(Number(r['line-number'])) ? Number(r['line-number']) : null,
      String(req.headers['user-agent'] ?? '').slice(0, 500),
      Math.floor(Date.now() / 1000),
    );
    return reply.code(204).send();
  });
}
