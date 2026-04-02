import type { FastifyInstance } from 'fastify';
import { dbGet, dbAll, dbRun } from '../db.js';
import { requireAdmin } from '../clerk.js';

export function registerAnalyticsRoutes(app: FastifyInstance): void {
  // Fire-and-forget page view tracking — no cookies, no PII
  app.post('/api/analytics/pageview', async (req, reply) => {
    try {
      const body = req.body as { path?: string; referrer?: string; screen?: string } | null;
      const path = (body?.path ?? '/').slice(0, 200);
      const referrer = (body?.referrer ?? '').slice(0, 500) || null;
      const screen = (body?.screen ?? '').slice(0, 20) || null;
      const ua = ((req.headers['user-agent'] ?? '') as string).slice(0, 300) || null;
      const date = new Date().toISOString().slice(0, 10);

      // Skip bots
      if (ua && /bot|crawl|spider|slurp|facebook|twitter|linkedin|whatsapp/i.test(ua)) {
        return { ok: true };
      }

      await dbRun(
        'INSERT INTO page_views (path, referrer, country, ua, screen, date) VALUES (?, ?, ?, ?, ?, ?)',
        path, referrer, null, ua, screen, date,
      );
    } catch { /* never fail */ }

    return { ok: true };
  });

  // Dashboard stats — admin only
  app.get('/api/analytics/stats', async (req, reply) => {
    if (!await requireAdmin(req, reply)) return;
    const days = parseInt(((req.query as any)?.days ?? '7'), 10);
    const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);

    const totalViews = await dbGet<{ n: number }>('SELECT COUNT(*) as n FROM page_views WHERE date >= ?', since);
    const byDay = await dbAll('SELECT date, COUNT(*) as views FROM page_views WHERE date >= ? GROUP BY date ORDER BY date', since);
    const byPage = await dbAll('SELECT path, COUNT(*) as views FROM page_views WHERE date >= ? GROUP BY path ORDER BY views DESC LIMIT 20', since);
    const byReferrer = await dbAll("SELECT referrer, COUNT(*) as views FROM page_views WHERE date >= ? AND referrer IS NOT NULL AND referrer != '' GROUP BY referrer ORDER BY views DESC LIMIT 20", since);

    const today = new Date().toISOString().slice(0, 10);
    const todayViews = await dbGet<{ n: number }>('SELECT COUNT(*) as n FROM page_views WHERE date = ?', today);
    const totalRoasts = await dbGet<{ n: number }>('SELECT COUNT(*) as n FROM roast_history');
    const totalUsers = await dbGet<{ n: number }>('SELECT COUNT(*) as n FROM token_balances');

    const topUsers = await dbAll(`
      SELECT
        tb.email,
        tb.balance AS credits,
        (SELECT COUNT(*) FROM user_roasts ur WHERE ur.email = tb.email) AS roasts,
        (SELECT MAX(created_at) FROM user_roasts ur WHERE ur.email = tb.email) AS last_roast
      FROM token_balances tb
      ORDER BY roasts DESC
      LIMIT 50
    `);

    const tokenPurchases = await dbGet<{ count: number }>(
      "SELECT COUNT(*) as count FROM stripe_one_time_purchases WHERE product_key = 'pageroast_tokens'",
    );

    const signupsByDay = await dbAll(
      'SELECT date(created_at) as date, COUNT(*) as signups FROM token_balances WHERE date(created_at) >= ? GROUP BY date(created_at) ORDER BY date',
      since,
    );

    return {
      period: { days, since },
      views: totalViews?.n ?? 0,
      todayViews: todayViews?.n ?? 0,
      totalRoasts: totalRoasts?.n ?? 0,
      totalUsers: totalUsers?.n ?? 0,
      tokenPurchases: tokenPurchases?.count ?? 0,
      byDay,
      byPage,
      byReferrer,
      topUsers,
      signupsByDay,
    };
  });
}
