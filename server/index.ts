import Fastify from 'fastify';
import cors from '@fastify/cors';
import staticPlugin from '@fastify/static';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { getDb } from './db.js';
import { registerDemoRoutes } from './routes/demos.js';
import { registerStripeRoutes } from './routes/stripe.js';
import { registerAnalyticsRoutes } from './routes/analytics.js';
import { registerLicenseRoutes } from './routes/license.js';
import { registerSocialRoutes } from './routes/social.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '4000', 10);
const isProd = process.env.NODE_ENV === 'production';
console.log(`[Boot] NODE_ENV=${process.env.NODE_ENV}, isProd=${isProd}, __dirname=${__dirname}, cwd=${process.cwd()}`);

// Init DB on startup
try {
  getDb();
  console.log('[DB] SQLite initialized');
} catch (err) {
  console.error('[DB] SQLite init failed:', err);
}

const app = Fastify({
  logger: { level: 'warn' },
  bodyLimit: 2 * 1024 * 1024, // 2MB max body
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

// Security headers
app.addHook('onSend', async (_request, reply) => {
  reply.header('X-Content-Type-Options', 'nosniff');
  reply.header('X-Frame-Options', 'DENY');
  reply.header('X-XSS-Protection', '0');
  reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (isProd) {
    reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
});

// Register API routes
registerDemoRoutes(app);
registerStripeRoutes(app);
registerAnalyticsRoutes(app);
registerLicenseRoutes(app);
registerSocialRoutes(app);

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
    await app.register(staticPlugin, {
      root: distPath,
      prefix: '/',
    });

    // SPA fallback — all non-API routes serve index.html (React Router handles routing)
    app.setNotFoundHandler(async (req, reply) => {
      if (req.url.startsWith('/api')) {
        reply.status(404).send({ error: 'Not found' });
        return;
      }
      return reply.sendFile('index.html');
    });
  }
}

try {
  await app.listen({ port: PORT, host: '0.0.0.0' });
  console.log(`ContentGrade server running on http://0.0.0.0:${PORT}`);
} catch (err) {
  console.error('Failed to start server:', err);
  process.exit(1);
}
