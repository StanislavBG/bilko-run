import type { FastifyInstance } from 'fastify';
import { dbGet, dbAll, dbRun } from '../db.js';
import { requireAdmin } from '../clerk.js';

export function registerAnalyticsRoutes(app: FastifyInstance): void {
  // Fire-and-forget page view tracking — no cookies, no PII
  app.post('/api/analytics/pageview', async (req, reply) => {
    try {
      const body = req.body as { path?: string; referrer?: string; screen?: string; email?: string } | null;
      const path = (body?.path ?? '/').slice(0, 200);
      const referrer = (body?.referrer ?? '').slice(0, 500) || null;
      const screen = (body?.screen ?? '').slice(0, 20) || null;
      const email = (body?.email ?? '').slice(0, 200).toLowerCase() || null;
      const ua = ((req.headers['user-agent'] ?? '') as string).slice(0, 300) || null;
      const date = new Date().toISOString().slice(0, 10);

      if (ua && /bot|crawl|spider|slurp|facebook|twitter|linkedin|whatsapp/i.test(ua)) {
        return { ok: true };
      }

      await dbRun(
        'INSERT INTO page_views (path, referrer, country, ua, screen, email, date) VALUES (?, ?, ?, ?, ?, ?, ?)',
        path, referrer, null, ua, screen, email, date,
      );
    } catch { /* never fail */ }

    return { ok: true };
  });

  // Dashboard stats — admin only
  app.get('/api/analytics/stats', async (req, reply) => {
    if (!await requireAdmin(req, reply)) return;
    const days = parseInt(((req.query as any)?.days ?? '7'), 10);
    const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);

    const today = new Date().toISOString().slice(0, 10);

    const [
      totalViews, byDay, byPage, byReferrer, todayViews,
      totalRoasts, totalUsers, topUsers, tokenPurchases,
      signupsByDay, roastsByDay, recentUserRoasts, activityFeed,
      revenueSingle, revenueBundle, toolUsage, toolVisits,
      uniqueVisitors, topLandingPages, referrerToTool, dailyActiveUsers, blogTraffic,
    ] = await Promise.all([
      dbGet<{ n: number }>('SELECT COUNT(*) as n FROM page_views WHERE date >= ?', since),
      dbAll('SELECT date, COUNT(*) as views FROM page_views WHERE date >= ? GROUP BY date ORDER BY date', since),
      dbAll('SELECT path, COUNT(*) as views FROM page_views WHERE date >= ? GROUP BY path ORDER BY views DESC LIMIT 20', since),
      dbAll("SELECT referrer, COUNT(*) as views FROM page_views WHERE date >= ? AND referrer IS NOT NULL AND referrer != '' GROUP BY referrer ORDER BY views DESC LIMIT 20", since),
      dbGet<{ n: number }>('SELECT COUNT(*) as n FROM page_views WHERE date = ?', today),
      dbGet<{ n: number }>('SELECT COUNT(*) as n FROM roast_history'),
      dbGet<{ n: number }>('SELECT COUNT(*) as n FROM token_balances'),
      dbAll(`
        SELECT tb.email, tb.balance AS credits,
          (SELECT COUNT(*) FROM user_roasts ur WHERE ur.email = tb.email) AS roasts,
          (SELECT MAX(created_at) FROM user_roasts ur WHERE ur.email = tb.email) AS last_roast,
          (SELECT SUM(amount) FROM token_transactions tt WHERE tt.email = tb.email AND tt.reason = 'stripe_purchase') AS purchased
        FROM token_balances tb ORDER BY roasts DESC LIMIT 50
      `),
      dbGet<{ count: number }>("SELECT COUNT(*) as count FROM stripe_one_time_purchases WHERE product_key = 'pageroast_tokens'"),
      dbAll('SELECT date(created_at) as date, COUNT(*) as signups FROM token_balances WHERE date(created_at) >= ? GROUP BY date(created_at) ORDER BY date', since),
      // Roasts by day (for chart)
      dbAll('SELECT date(created_at) as date, COUNT(*) as roasts FROM user_roasts WHERE date(created_at) >= ? GROUP BY date(created_at) ORDER BY date', since),
      // Recent roasts with WHO did them
      dbAll('SELECT email, url, score, grade, roast, created_at FROM user_roasts ORDER BY created_at DESC LIMIT 30'),
      // Activity feed: recent signups + purchases + roasts interleaved
      dbAll(`
        SELECT * FROM (
          SELECT 'signup' as type, email, '' as detail, created_at FROM token_balances WHERE date(created_at) >= ?
          UNION ALL
          SELECT 'purchase' as type, email, CAST(amount AS TEXT) as detail, created_at FROM token_transactions WHERE reason = 'stripe_purchase' AND date(created_at) >= ?
          UNION ALL
          SELECT 'roast' as type, email, url as detail, created_at FROM user_roasts WHERE date(created_at) >= ?
        ) ORDER BY created_at DESC LIMIT 50
      `, since, since, since),
      // Revenue breakdown
      dbGet<{ n: number }>("SELECT COUNT(*) as n FROM stripe_one_time_purchases p JOIN token_transactions t ON t.stripe_payment_intent_id = p.stripe_payment_intent_id WHERE t.amount = 1"),
      dbGet<{ n: number }>("SELECT COUNT(*) as n FROM stripe_one_time_purchases p JOIN token_transactions t ON t.stripe_payment_intent_id = p.stripe_payment_intent_id WHERE t.amount = 7"),
      // Per-tool usage stats
      dbAll(`SELECT endpoint, SUM(count) as uses FROM usage_tracking WHERE date >= ? GROUP BY endpoint ORDER BY uses DESC`, since),
      // Per-tool page visits
      dbAll(`SELECT path, COUNT(*) as visits FROM page_views WHERE date >= ? AND path LIKE '/projects/%' GROUP BY path ORDER BY visits DESC`, since),
      // Unique visitors (distinct emails)
      dbGet<{ n: number }>(`SELECT COUNT(DISTINCT email) as n FROM page_views WHERE date >= ? AND email IS NOT NULL`, since),
      // Top landing pages (first page in session — approximate via distinct email+date)
      dbAll(`SELECT path, COUNT(DISTINCT email) as unique_users FROM page_views WHERE date >= ? AND email IS NOT NULL GROUP BY path ORDER BY unique_users DESC LIMIT 15`, since),
      // Referrer → tool conversion (which referrers lead to tool pages)
      dbAll(`SELECT referrer, path, COUNT(*) as visits FROM page_views WHERE date >= ? AND referrer IS NOT NULL AND referrer != '' AND path LIKE '/projects/%' GROUP BY referrer, path ORDER BY visits DESC LIMIT 20`, since),
      // Daily active users
      dbAll(`SELECT date, COUNT(DISTINCT email) as users FROM page_views WHERE date >= ? AND email IS NOT NULL GROUP BY date ORDER BY date`, since),
      // Blog traffic
      dbAll(`SELECT path, COUNT(*) as views FROM page_views WHERE date >= ? AND path LIKE '/blog%' GROUP BY path ORDER BY views DESC LIMIT 10`, since),
    ]);

    const singleCount = revenueSingle?.n ?? 0;
    const bundleCount = revenueBundle?.n ?? 0;

    return {
      period: { days, since },
      views: totalViews?.n ?? 0,
      todayViews: todayViews?.n ?? 0,
      totalRoasts: totalRoasts?.n ?? 0,
      totalUsers: totalUsers?.n ?? 0,
      tokenPurchases: tokenPurchases?.count ?? 0,
      revenue: { single: singleCount, bundle: bundleCount, total: singleCount * 1 + bundleCount * 5 },
      byDay,
      byPage,
      byReferrer,
      topUsers,
      signupsByDay,
      toolUsage,
      toolVisits,
      roastsByDay,
      recentUserRoasts,
      activityFeed,
      uniqueVisitors: uniqueVisitors?.n ?? 0,
      topLandingPages,
      referrerToTool,
      dailyActiveUsers,
      blogTraffic,
    };
  });
}
