import Fastify from 'fastify';
import cors from '@fastify/cors';
import staticPlugin from '@fastify/static';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readFileSync } from 'fs';
import { initDb } from './db.js';
import { registerDemoRoutes } from './routes/demos.js';
import { registerStripeRoutes } from './routes/stripe.js';
import { registerLicenseRoutes } from './routes/license.js';
import { registerSocialRoutes } from './routes/social.js';
import { registerAnalyticsRoutes } from './routes/analytics.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '4000', 10);
const isProd = process.env.NODE_ENV === 'production';
console.log(`[Boot] NODE_ENV=${process.env.NODE_ENV}, isProd=${isProd}, __dirname=${__dirname}, cwd=${process.cwd()}`);

// Init DB before server starts accepting requests
try {
  await initDb();
} catch (err) {
  console.error('[DB] Init failed:', err);
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
registerLicenseRoutes(app);
registerSocialRoutes(app);
registerAnalyticsRoutes(app);

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

    // Route-specific OG meta tags for social sharing (crawlers don't run JS)
    const indexHtml = readFileSync(resolve(distPath, 'index.html'), 'utf-8');

    const OG_OVERRIDES: Record<string, { title: string; description: string; url: string }> = {
      '/projects/page-roast': {
        title: 'PageRoast — Get Your Landing Page Roasted by AI 🔥',
        description: 'Paste a URL. AI scores your page across 4 CRO frameworks and delivers a savage one-liner you\'ll want to screenshot. Free.',
        url: 'https://bilko.run/projects/page-roast',
      },
      '/projects': {
        title: 'Projects — bilko.run',
        description: 'AI-powered tools for makers, marketers, and founders. PageRoast, HeadlineGrader, AdScorer, and more.',
        url: 'https://bilko.run/projects',
      },
      '/pricing': {
        title: 'Pricing — bilko.run',
        description: '1 free roast on sign-up. Then $1 per credit or 7 for $5. No subscriptions.',
        url: 'https://bilko.run/pricing',
      },
    };

    function serveWithOg(path: string): string {
      const override = OG_OVERRIDES[path];
      if (!override) return indexHtml;
      return indexHtml
        .replace(/<title>[^<]*<\/title>/, `<title>${override.title}</title>`)
        .replace(/content="Bilko\.run — Tools for Makers Who Ship"/, `content="${override.title}"`)
        .replace(/content="Free AI-powered tools for solopreneurs[^"]*"/, `content="${override.description}"`)
        .replace(/content="AI tools for solopreneurs\.[^"]*"/, `content="${override.description}"`)
        .replace(/content="https:\/\/bilko\.run"/, `content="${override.url}"`)
        .replace(/content="PageRoast — Get Your Landing Page Roasted by AI"/, `content="${override.title}"`)
        .replace(/content="Paste a URL\. AI scores your page across 4 CRO frameworks and delivers a savage one-liner\. Free\."/, `content="${override.description}"`);
    }

    // SPA fallback — inject route-specific OG tags for social crawlers
    app.setNotFoundHandler(async (req, reply) => {
      if (req.url.startsWith('/api')) {
        reply.status(404).send({ error: 'Not found' });
        return;
      }
      const path = req.url.split('?')[0];
      reply.type('text/html').send(serveWithOg(path));
    });
  }
}

try {
  await app.listen({ port: PORT, host: '0.0.0.0' });
  console.log(`Bilko.run server running on http://0.0.0.0:${PORT}`);
} catch (err) {
  console.error('Failed to start server:', err);
  process.exit(1);
}
