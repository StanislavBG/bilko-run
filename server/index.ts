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
import { registerStepproofRoutes } from './routes/stepproof.js';
import { registerBlogRoutes } from './routes/blog.js';

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
registerStepproofRoutes(app);
registerBlogRoutes(app);
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
      '/projects/headline-grader': {
        title: 'HeadlineGrader — Score Headlines Like a Pro Copywriter',
        description: 'AI grades your headlines against 4 proven frameworks. Get a score, diagnosis, and AI rewrites. Free.',
        url: 'https://bilko.run/projects/headline-grader',
      },
      '/projects/ad-scorer': {
        title: 'AdScorer — Grade Ad Copy Before You Spend the Budget',
        description: 'Platform-specific ad copy grading for Google, Meta, and LinkedIn. Score hook, value prop, emotion, and CTA.',
        url: 'https://bilko.run/projects/ad-scorer',
      },
      '/projects/thread-grader': {
        title: 'ThreadGrader — Score Your X/Twitter Threads',
        description: 'AI scores hook strength, tension chain, payoff, and share triggers. Plus tweet-by-tweet breakdown.',
        url: 'https://bilko.run/projects/thread-grader',
      },
      '/projects/email-forge': {
        title: 'EmailForge — AI Email Sequence Generator',
        description: 'Generate 5-email sequences using AIDA, PAS, Hormozi, Cialdini, and Storytelling frameworks. Free.',
        url: 'https://bilko.run/projects/email-forge',
      },
      '/projects/audience-decoder': {
        title: 'AudienceDecoder — Decode Who Actually Follows You',
        description: 'Paste your social content. AI identifies audience archetypes, engagement patterns, and growth opportunities.',
        url: 'https://bilko.run/projects/audience-decoder',
      },
      '/projects/stack-audit': {
        title: 'StackAudit — Find Waste in Your SaaS Stack',
        description: 'AI analyzes your tool stack for overlap, cheaper alternatives, and savings. Enterprise-grade audit for $1. No integration required.',
        url: 'https://bilko.run/projects/stack-audit',
      },
      '/projects/launch-grader': {
        title: 'LaunchGrader — Is Your Product Ready to Launch?',
        description: 'AI audits your go-to-market readiness across 5 dimensions. Score, blockers, and a verdict. $1 vs $100/mo competitors.',
        url: 'https://bilko.run/projects/launch-grader',
      },
      '/projects/stepproof': {
        title: 'Stepproof — Regression Tests for AI Pipelines',
        description: 'Write a scenario. Run it N times. See if your LLM can follow instructions. Like unit tests, but for AI.',
        url: 'https://bilko.run/projects/stepproof',
      },
      '/blog': {
        title: 'Blog — bilko.run',
        description: 'Lessons from building AI tools solo. Build logs, technical deep dives, and honest takes on shipping software in 2026.',
        url: 'https://bilko.run/blog',
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
      let html = indexHtml;
      // Replace title
      html = html.replace(/<title>[^<]*<\/title>/, `<title>${override.title}</title>`);
      // Replace all OG/Twitter title, description, url content attributes
      html = html.replace(/(<meta\s+(?:property="og:title"|name="twitter:title")\s+content=")[^"]*(")/g, `$1${override.title}$2`);
      html = html.replace(/(<meta\s+(?:property="og:description"|name="twitter:description"|name="description")\s+content=")[^"]*(")/g, `$1${override.description}$2`);
      html = html.replace(/(<meta\s+property="og:url"\s+content=")[^"]*(")/g, `$1${override.url}$2`);
      return html;
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
