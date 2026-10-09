import Fastify from 'fastify';
import cors from '@fastify/cors';
import compress from '@fastify/compress';
import staticPlugin from '@fastify/static';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readFileSync } from 'fs';
import { initDb, dbAll } from './db.js';
import { registerToolRoutes } from './routes/tools/index.js';
import { registerStripeRoutes } from './routes/stripe.js';
import { registerLicenseRoutes } from './routes/license.js';
import { registerAnalyticsRoutes } from './routes/analytics.js';
import { registerBlogRoutes } from './routes/blog.js';
import { registerTelemetryRoutes } from './routes/telemetry.js';
import { registerManifestsRoutes } from './routes/manifests.js';
import { registerSyntheticRoutes } from './routes/synthetic.js';
import { registerObservabilityRoutes } from './routes/admin-observability.js';
import { registerSessionManagerUsageRoutes } from './routes/admin-session-manager-usage.js';
import { registerSecretsRoutes } from './routes/admin-secrets.js';
import { registerGameRoutes } from './routes/games.js';
import { registerAcademyRoutes } from './routes/academy.js';
import { registerProjectDataRoutes } from './routes/project-data.js';
import { registerProjectEventsRoutes } from './routes/project-events.js';
import { registerProjectFeedbackRoutes } from './routes/project-feedback.js';
import { registerSmRelayRoutes } from './routes/sm-relay.js';
import { registerManualRoutes } from './routes/manual.js';
import { registerCompGrantRoutes } from './routes/admin-comp-grants.js';
import { handleUpgrade as smRelayHandleUpgrade } from './sm-relay/router.js';
import { registerSecurityHeaders } from './security-headers.js';
import { normalizeStaticMtimes, registerStaticCorsTrim, setStaticCacheHeaders } from './static-cache.js';
import { registerEgressMeter, setStaticKnownSlugs } from './egress.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '4000', 10);
const isProd = process.env.NODE_ENV === 'production';
console.log(`[Boot] NODE_ENV=${process.env.NODE_ENV}, isProd=${isProd}, __dirname=${__dirname}, cwd=${process.cwd()}`);

// Init DB before server starts accepting requests — fail closed if DB is unreachable
try {
  await initDb();
} catch (err) {
  console.error('[DB] Init failed, exiting:', err);
  process.exit(1);
}

const app = Fastify({
  logger: { level: 'warn' },
  bodyLimit: 2 * 1024 * 1024, // 2MB max body
  // Render puts clients behind a proxy; trust X-Forwarded-For so req.ip is the real
  // client IP. Without this, all clients share the proxy IP and rate limiting is
  // effectively a single global bucket.
  trustProxy: true,
});

// Raw body for Stripe webhook signature verification
app.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body, done) => {
  (req as any).rawBody = body;
  try {
    done(null, JSON.parse((body as Buffer).toString()));
  } catch (err) {
    done(err as Error, undefined);
  }
});

// CORS — restrict to bilko.run in production
await app.register(cors, {
  origin: isProd
    ? ['https://bilko.run', 'https://www.bilko.run', 'https://clerk.bilko.run', 'https://accounts.bilko.run']
    : true,
  credentials: true,
});

// Security headers (CSP + HSTS + COOP + Permissions-Policy)
registerSecurityHeaders(app);

// Registered after CORS so its onSend hook can drop the `Vary: Origin` that
// @fastify/cors stamps on every response — Cloudflare won't edge-cache
// anything that varies on a header other than Accept-Encoding, so without
// this the static tree stays DYNAMIC no matter what Cache-Control says.
registerStaticCorsTrim(app);

// Origin-side response compression. Render bills origin egress, and
// Cloudflare's edge compression only shrinks what the origin already paid to
// ship — without this, every JSON/HTML/JS/CSS response left Render at full
// uncompressed size (measured: a ~93 KB-on-the-wire snapshot response was
// costing ~733 KB of billed origin egress). Registered global (fastify-plugin
// under the hood, so it isn't encapsulated) and BEFORE the @fastify/static
// registration further down so static bundle responses flow through it too.
// Also registered after `registerSecurityHeaders` so its onSend hook — which
// injects the CSP nonce into HTML — runs first in the onSend chain and
// operates on plain text, not compressed bytes.
await app.register(compress, {
  // 1 KB: below this, gzip/brotli framing overhead and CPU cost outweigh the
  // bandwidth saved.
  threshold: 1024,
  encodings: ['br', 'gzip'],
  // @fastify/compress's default compressible-types regex doesn't match
  // `application/javascript` (only `text/*`, `*/json`, `*/xml`, `*/text`,
  // `octet-stream`) — extend it to cover the static JS bundle explicitly.
  // Also lists `application/wasm` (e.g. Godot web builds) for the same
  // reason. Note: @fastify/compress's shouldCompress() already falls back to
  // mime-db's own `compressible` flag for any type this regex misses, and
  // mime-db marks both `application/javascript` and `application/wasm` as
  // compressible — so both would compress even without these entries. They're
  // kept explicit anyway as documentation of intent, not because they're
  // load-bearing today.
  // PNG/JPEG/WebP/woff2/etc. aren't compressible per mime-db either, so they
  // pass through untouched by either path.
  customTypes: /^text\/(?!event-stream)|(?:\+|\/)json(?:;|$)|(?:\+|\/)text(?:;|$)|(?:\+|\/)xml(?:;|$)|octet-stream(?:;|$)|javascript|^application\/wasm(?:;|$)/u,
});

// Per-route egress accounting. Registered before the routes so its onSend hook
// sees every /api/* response.
registerEgressMeter(app);

// Register API routes
registerToolRoutes(app);
registerStripeRoutes(app);
registerLicenseRoutes(app);
registerBlogRoutes(app);
registerAnalyticsRoutes(app);
registerTelemetryRoutes(app);
registerManifestsRoutes(app);
registerSyntheticRoutes(app);
registerObservabilityRoutes(app);
registerSessionManagerUsageRoutes(app);
registerSecretsRoutes(app);
registerGameRoutes(app);
registerAcademyRoutes(app);
registerProjectDataRoutes(app);
registerProjectFeedbackRoutes(app);
registerSmRelayRoutes(app);
registerManualRoutes(app);
registerCompGrantRoutes(app);

// Boot-time secret age check
try {
  const secretRows = await dbAll<{ name: string; last_rotated_at: number | null }>(
    `SELECT name, last_rotated_at FROM secret_metadata`,
  );
  const nowSec = Math.floor(Date.now() / 1000);
  for (const r of secretRows) {
    if (!r.last_rotated_at) {
      app.log.warn(`secret ${r.name}: never rotated (or unknown). Run runbook.`);
      continue;
    }
    const days = (nowSec - r.last_rotated_at) / 86400;
    if (days > 180) app.log.error(`secret ${r.name}: ${Math.floor(days)} days old. ROTATE NOW.`);
    else if (days > 90) app.log.warn(`secret ${r.name}: ${Math.floor(days)} days old. Schedule rotation.`);
  }
} catch { /* non-fatal — table may not exist on very first boot before migration */ }

// Health check
app.get('/api/health', async () => ({
  status: 'alive',
  uptime: process.uptime(),
}));

// In production, serve the Vite build
if (isProd) {
  // Try multiple paths — __dirname varies between local and Render
  const candidates = [
    resolve(__dirname, '..', '..', 'dist'),  // dist-server/server/ → dist/
    resolve(process.cwd(), 'dist'),           // cwd/dist/
    resolve(__dirname, '..', 'dist'),         // one level up
  ];
  const distPath = candidates.find(p => existsSync(p)) ?? candidates[0];
  console.log(`[Static] dist at: ${distPath} (exists: ${existsSync(distPath)}, tried: ${candidates.join(', ')})`);
  if (existsSync(distPath)) {
    // Bounds static egress cardinality to the published apps in this dist —
    // see server/egress.ts setStaticKnownSlugs().
    setStaticKnownSlugs(distPath);

    // Make every ETag content-addressed before anything is served. A deploy's
    // git checkout rewrites all mtimes, and send's default ETag is
    // `W/"<size>-<mtime>"`, so without this every deploy busted every
    // visitor's cache for every unchanged file. See server/static-cache.ts.
    const norm = normalizeStaticMtimes(distPath);
    console.log(
      `[Static] mtime normalization: ${norm.changed}/${norm.files} files rewritten ` +
      `(${(norm.bytes / 1048576).toFixed(0)} MB hashed, ${norm.ms} ms)`,
    );

    await app.register(staticPlugin, {
      root: distPath,
      prefix: '/',
      // send must not emit its own Cache-Control: @fastify/static applies
      // send's headers AFTER setHeaders, so send would win the collision and
      // we'd be back to `public, max-age=0` on everything.
      cacheControl: false,
      // Per-file lifetimes — immutable for content-hashed bundles, revalidate
      // for HTML, short shared TTL for unhashed project assets.
      setHeaders: (res, path) => setStaticCacheHeaders(res, path),
      // 301 missing-trailing-slash → with-slash for directory indexes.
      // Without this, a request to `/projects/game-academy` looks for a
      // file (not a dir), 404s, and falls through to the SPA which then
      // routes via React Router → wrong page. With redirect:true the
      // client gets a 301 to `/projects/game-academy/` and serves the
      // game's `index.html` instead. Only triggers when an index.html
      // exists in the corresponding dist directory, so other routes
      // (e.g. `/products/page-roast`) are unaffected.
      redirect: true,
    });

    // Registered AFTER staticPlugin — its GET handler falls back to
    // reply.sendFile() (a staticPlugin decorator) for a slug with no synced
    // events yet, so it needs that decorator to already exist.
    registerProjectEventsRoutes(app);

    // Route-specific OG meta tags for social sharing (crawlers don't run JS)
    const indexHtml = readFileSync(resolve(distPath, 'index.html'), 'utf-8');

    // Only paths the SPA fallback can actually serve. /projects/<slug> is
    // deliberately absent: static serving 301s it to the app bundle's own
    // index.html, so it never reaches the not-found handler.
    const OG_OVERRIDES: Record<string, { title: string; description: string; url: string }> = {
      '/projects': {
        title: 'Projects — bilko.run',
        description: 'AI-powered tools for makers, marketers, and founders. PageRoast, HeadlineGrader, AdScorer, and more.',
        url: 'https://bilko.run/projects',
      },
      '/blog': {
        title: 'Blog — bilko.run',
        description: 'Lessons from building AI tools solo. Build logs, technical deep dives, and honest takes on shipping software in 2026.',
        url: 'https://bilko.run/blog',
      },
      '/pricing': {
        title: 'Pricing — bilko.run',
        description: 'Free to start. Then $1 per credit or 7 for $5. No subscriptions.',
        url: 'https://bilko.run/pricing',
      },
    };

    // Computed once at boot; the handler only does a Map lookup.
    const ogHtmlByPath = new Map<string, string>();
    for (const [path, override] of Object.entries(OG_OVERRIDES)) {
      let html = indexHtml;
      html = html.replace(/<title>[^<]*<\/title>/, `<title>${override.title}</title>`);
      html = html.replace(/(<meta\s+(?:property="og:title"|name="twitter:title")\s+content=")[^"]*(")/g, `$1${override.title}$2`);
      html = html.replace(/(<meta\s+(?:property="og:description"|name="twitter:description"|name="description")\s+content=")[^"]*(")/g, `$1${override.description}$2`);
      html = html.replace(/(<meta\s+property="og:url"\s+content=")[^"]*(")/g, `$1${override.url}$2`);
      ogHtmlByPath.set(path, html);
    }

    // SPA fallback — inject route-specific OG tags for social crawlers
    //
    // MUST `return reply.send(...)`, not a bare `reply.send(...)`. This handler
    // is async, and Fastify's wrapThenable resolves an async handler's promise
    // as soon as the function body finishes — but `reply.sent` only flips true
    // once the raw HTTP response has actually finished writing (writableEnded),
    // which happens after our async onSend hooks (CSP nonce injection, egress
    // metering) resolve. A bare `reply.send()` call lets the handler's promise
    // resolve while `reply.sent` is still false, so Fastify thinks nothing was
    // sent and calls `reply.send(undefined)` again — racing the in-flight
    // write and throwing an uncaught ERR_HTTP_HEADERS_SENT that kills the
    // process. `return reply.send(...)` makes the async function await Reply's
    // own thenable (which resolves only once the response truly ends), so
    // wrapThenable never double-sends.
    app.setNotFoundHandler(async (req, reply) => {
      if (req.url.startsWith('/api')) {
        return reply.status(404).send({ error: 'Not found' });
      }
      const path = req.url.split('?')[0];
      // Never cacheable: the onSend hook stamps a per-request CSP nonce into
      // this HTML, so a shared or reused copy would carry a nonce that no
      // longer matches the response's CSP header.
      reply.header('cache-control', 'private, no-store');
      return reply.type('text/html').send(ogHtmlByPath.get(path) ?? indexHtml);
    });
  }
}

try {
  await app.listen({ port: PORT, host: '0.0.0.0' });
  // Session Manager web-remote relay: claim WS upgrades on its path, same-origin.
  // Returns false for any other path so future upgrade handlers can coexist.
  app.server.on('upgrade', (req, socket, head) => {
    try {
      const handled = smRelayHandleUpgrade(req, socket as any, head);
      if (!handled) socket.destroy();
    } catch {
      socket.destroy();
    }
  });
  console.log(`Bilko.run server running on http://0.0.0.0:${PORT}`);

  // Graceful shutdown: app.close() runs onClose hooks (egress meter flush).
  // Render sends SIGTERM when stopping the old instance on deploy.
  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[Shutdown] ${signal} received, closing server`);
    const killer = setTimeout(() => process.exit(1), 10_000);
    killer.unref();
    app.close().then(() => process.exit(0), () => process.exit(1));
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
} catch (err) {
  console.error('Failed to start server:', err);
  process.exit(1);
}
