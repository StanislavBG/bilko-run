import type { FastifyInstance } from 'fastify';
import { dbGet, dbAll, dbRun } from '../../db.js';
import { getActiveSubscriptionLive } from '../../services/stripe.js';
import {
  getTokenBalance, grantFreeTokens, deductToken, hasTokenAccount,
} from '../../services/tokens.js';
import { requireAuth } from '../../clerk.js';
import { hashIp, enforceCallLimits, isAdminEmail } from './_shared.js';
import { roastPage } from '@bilkobibitkov/page-roast';

export function registerPageRoastRoutes(app: FastifyInstance): void {
  // ── Public stats (for social proof) ─────────────────────────────
  app.get('/api/roasts/stats', async () => {
    const total = await dbGet<{ n: number }>('SELECT COUNT(*) as n FROM roast_history');
    const users = await dbGet<{ n: number }>('SELECT COUNT(*) as n FROM token_balances');
    return { totalRoasts: total?.n ?? 0, totalUsers: users?.n ?? 0 };
  });

  // ── Recent roasts feed (public) ─────────────────────────────────
  app.get('/api/roasts/recent', async () => {
    return dbAll('SELECT url, score, grade, roast, created_at FROM roast_history ORDER BY created_at DESC LIMIT 20');
  });

  // ── User's past roasts (Clerk auth required) ──
  app.get('/api/roasts/mine', async (req, reply) => {
    const email = await requireAuth(req, reply);
    if (!email) return;
    return dbAll('SELECT id, url, score, grade, roast, created_at FROM user_roasts WHERE email = ? ORDER BY created_at DESC LIMIT 50', email);
  });

  app.get('/api/roasts/mine/:id', async (req, reply) => {
    const email = await requireAuth(req, reply);
    if (!email) return;
    const { id } = req.params as { id: string };
    const row = await dbGet<any>('SELECT * FROM user_roasts WHERE id = ? AND email = ?', parseInt(id, 10), email);
    if (!row) {
      reply.status(404);
      return { error: 'Roast not found.' };
    }
    return { ...row, result: JSON.parse(row.result_json) };
  });

  app.post('/api/demos/page-roast', async (req, reply) => {
    const body = req.body as { url?: string; email?: string } | null;
    const rawUrl = (body?.url ?? '').trim();
    if (!rawUrl) {
      reply.status(400);
      return { error: 'URL is required.' };
    }

    const email = await requireAuth(req, reply);
    if (!email) return;

    const costLimit = await enforceCallLimits({ userEmail: email, ipHash: hashIp(req.ip), isAdmin: isAdminEmail(email), appSlug: 'page-roast' });
    if (!costLimit.ok) { reply.status(costLimit.status); return { error: costLimit.reason }; }

    if (!(await hasTokenAccount(email))) {
      await grantFreeTokens(email);
    }

    const sub = await getActiveSubscriptionLive(email);
    if (!sub.isPro) {
      const balance = await getTokenBalance(email);
      if (balance < 1) {
        reply.status(402);
        return { error: 'No tokens remaining.', requiresTokens: true, balance };
      }
    }

    try {
      const result = await roastPage({
        url: rawUrl,
        apiKey: process.env.GEMINI_API_KEY!,
        mode: 'score',
      });

      const parsed = result.scores!;

      try {
        const parsedUrl = new URL(rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`);
        const domain = parsedUrl.hostname.replace(/^www\./, '');
        await dbRun('INSERT INTO roast_history (url, score, grade, roast) VALUES (?, ?, ?, ?)', domain, parsed.total_score, parsed.grade, parsed.roast);
        await dbRun('INSERT INTO user_roasts (email, url, score, grade, roast, result_json) VALUES (?, ?, ?, ?, ?, ?)',
          email, rawUrl, parsed.total_score, parsed.grade, parsed.roast, JSON.stringify(parsed),
        );
      } catch { /* best effort */ }

      const balance = sub.isPro ? await getTokenBalance(email) : (await deductToken(email, 1, 'page_roast')).balance;
      return { ...parsed, usage: { balance, gated: false } };
    } catch (err: any) {
      const status = err.code === 'SSRF' ? 400 : 500;
      const prefix = err.code === 'SSRF' ? 'Invalid URL' : 'Roast failed';
      console.error('page_roast_demo', err);
      reply.status(status);
      return { error: `${prefix}: ${err.message}` };
    }
  });

  app.post('/api/demos/page-roast/compare', async (req, reply) => {
    const body = req.body as { url_a?: string; url_b?: string; email?: string } | null;
    const rawUrlA = (body?.url_a ?? '').trim();
    const rawUrlB = (body?.url_b ?? '').trim();
    if (!rawUrlA || !rawUrlB) {
      reply.status(400);
      return { error: 'Both URLs are required.' };
    }

    const email = await requireAuth(req, reply);
    if (!email) return;

    const costLimitCmp = await enforceCallLimits({ userEmail: email, ipHash: hashIp(req.ip), isAdmin: isAdminEmail(email), appSlug: 'page-roast' });
    if (!costLimitCmp.ok) { reply.status(costLimitCmp.status); return { error: costLimitCmp.reason }; }

    if (!(await hasTokenAccount(email))) {
      await grantFreeTokens(email);
    }

    const sub = await getActiveSubscriptionLive(email);
    if (!sub.isPro) {
      const balance = await getTokenBalance(email);
      if (balance < 2) {
        reply.status(402);
        return { error: 'A/B Compare costs 2 credits. Buy credits to unlock.', requiresTokens: true, balance };
      }
    }

    try {
      const result = await roastPage({
        url: rawUrlA,
        apiKey: process.env.GEMINI_API_KEY!,
        mode: 'compare',
        compareWith: rawUrlB,
      });

      const balance = sub.isPro ? await getTokenBalance(email) : (await deductToken(email, 2, 'page_roast_compare')).balance;
      return { score_a: result.scoreA, score_b: result.scoreB, comparison: result.comparison, usage: { balance, gated: false } };
    } catch (err: any) {
      const status = err.code === 'SSRF' ? 400 : 500;
      const prefix = err.code === 'SSRF' ? 'Invalid URL' : 'Comparison failed';
      console.error('page_roast_compare', err);
      reply.status(status);
      return { error: `${prefix}: ${err.message}` };
    }
  });
}
