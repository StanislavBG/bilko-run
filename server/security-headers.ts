import type { FastifyInstance } from 'fastify';
import { randomBytes } from 'crypto';
import { dbRun } from './db.js';

const ENFORCE = process.env.BILKO_CSP_ENFORCE === '1';

const PERMISSIONS = [
  'accelerometer=()', 'camera=()', 'geolocation=(self)', 'gyroscope=()',
  'magnetometer=()', 'microphone=(self)', 'payment=(self)', 'usb=()',
].join(', ');

// Origins the site actually uses. Every one of these was added because a real
// page load reported a violation against it — a policy that forbids something
// the app genuinely loads doesn't harden anything, it just turns each page view
// into a burst of report POSTs (a single `/` load was generating 26 of them).
//
// - fonts.googleapis.com / fonts.gstatic.com: the Google Fonts <link> in
//   index.html (Instrument Serif, Inter, JetBrains Mono, Caveat) and the .woff2
//   files it pulls. Roughly 20 of those 26 reports per load were fonts alone.
// - clerk.bilko.run: Clerk's Frontend API is CNAME'd onto our own domain, so
//   `https://*.clerk.com` never matches it — every Clerk XHR was a violation.
const FONT_CSS_ORIGIN = 'https://fonts.googleapis.com';
const FONT_FILE_ORIGIN = 'https://fonts.gstatic.com';
const CLERK_FAPI_ORIGIN = 'https://clerk.bilko.run';

function buildCsp(nonce: string): string {
  const directives = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' https://js.clerk.com https://js.stripe.com ${CLERK_FAPI_ORIGIN} 'strict-dynamic'`,
    `style-src 'self' 'nonce-${nonce}' ${FONT_CSS_ORIGIN}`,
    // React renders `style={{...}}` as inline style ATTRIBUTES, which a nonce
    // can never cover (nonces apply to elements). Without this the app emits a
    // handful of style-src reports on every render pass. style-src-attr is
    // scoped to attributes only, so <style> elements stay nonce-gated.
    `style-src-attr 'unsafe-inline'`,
    `img-src 'self' data: https://*.clerk.com https://*.stripe.com https://avatars.githubusercontent.com`,
    `font-src 'self' data: ${FONT_FILE_ORIGIN}`,
    `connect-src 'self' https://*.clerk.com ${CLERK_FAPI_ORIGIN} https://api.stripe.com`,
    `frame-src https://*.clerk.com https://js.stripe.com https://hooks.stripe.com`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self' https://*.stripe.com`,
    `frame-ancestors 'none'`,
    `report-uri /api/security/csp-report`,
  ];
  // Browsers ignore upgrade-insecure-requests in a report-only policy and log a
  // console error saying so — emit it only when the policy is enforced.
  if (ENFORCE) directives.push(`upgrade-insecure-requests`);
  return directives.join('; ');
}

// In-memory rate limiter for the CSP report endpoint (10 req/min/IP).
//
// Browsers fire one report per distinct violation per page load and we cannot
// turn that off from the server — the only real lever is not violating the
// policy. This limiter plus the fingerprint dedupe below exist so that if the
// policy regresses again, the blast radius is a rejected POST rather than
// thousands of DB writes. 10/min is ample: a correct policy reports ~0, and a
// first-time-broken one only needs a handful of samples to be diagnosable.
const _cspReportCounts = new Map<string, { count: number; windowStart: number }>();
const CSP_RATE_LIMIT = 10;
const CSP_RATE_WINDOW_MS = 60_000;

// Fingerprint dedupe: one row per distinct (directive, blocked, document) per
// hour, globally. A broken directive is one fact, not one fact per visitor.
const CSP_DEDUPE_WINDOW_MS = 60 * 60_000;
const CSP_DEDUPE_MAX_KEYS = 500;
const _cspSeen = new Map<string, number>();

function shouldPersistViolation(fingerprint: string): boolean {
  const now = Date.now();
  const last = _cspSeen.get(fingerprint);
  if (last !== undefined && now - last < CSP_DEDUPE_WINDOW_MS) return false;
  if (_cspSeen.size >= CSP_DEDUPE_MAX_KEYS) {
    for (const [k, t] of _cspSeen) {
      if (now - t >= CSP_DEDUPE_WINDOW_MS) _cspSeen.delete(k);
    }
    // Still full of live entries — a genuinely novel flood. Drop rather than
    // grow the map without bound; the rate limiter is the outer guard.
    if (_cspSeen.size >= CSP_DEDUPE_MAX_KEYS) return false;
  }
  _cspSeen.set(fingerprint, now);
  return true;
}

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
  //
  // Streams are buffered rather than skipped. @fastify/static serves the SPA
  // shell (`GET /`) and every static-path project's index.html as a stream, so
  // skipping streams meant the nonce was never actually injected in production
  // — `curl https://bilko.run/ | grep nonce` came back empty, and with
  // 'strict-dynamic' in script-src that made the app's own bundle a violation
  // on every single page load. HTML documents are small; buffering them is
  // cheap and it's the only way the nonce reaches the markup it's issued for.
  app.addHook('onSend', async (req, reply, payload) => {
    const ctype = String(reply.getHeader('content-type') ?? '');
    if (!ctype.startsWith('text/html')) return payload;
    const nonce = (req as any).cspNonce as string;
    let html: string;
    if (typeof payload === 'string') {
      html = payload;
    } else if (Buffer.isBuffer(payload)) {
      html = payload.toString('utf-8');
    } else if (payload && typeof (payload as any).pipe === 'function') {
      const chunks: Buffer[] = [];
      for await (const chunk of payload as AsyncIterable<Buffer | string>) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
      }
      html = Buffer.concat(chunks).toString('utf-8');
    } else {
      return payload;
    }
    // Length changes once the nonce attributes are spliced in; a stale
    // Content-Length from @fastify/static would truncate the response.
    reply.removeHeader('content-length');
    // The response now embeds a per-request nonce, so no shared cache may
    // hand this body to a second visitor whose CSP header carries a different
    // one. @fastify/static's own Cache-Control for HTML is set before this.
    reply.header('cache-control', 'private, no-store');
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
    const fingerprint = [
      String(r['violated-directive'] ?? ''),
      String(r['blocked-uri'] ?? ''),
      String(r['document-uri'] ?? ''),
    ].join('|');
    if (!shouldPersistViolation(fingerprint)) return reply.code(204).send();
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
