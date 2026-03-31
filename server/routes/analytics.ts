import type { FastifyInstance } from 'fastify';
import { getDb } from '../db.js';

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

      getDb().prepare(
        'INSERT INTO page_views (path, referrer, country, ua, screen, date) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(path, referrer, null, ua, screen, date);
    } catch { /* never fail */ }

    return { ok: true };
  });

  // Dashboard stats — internal use
  app.get('/api/analytics/stats', async (req) => {
    const db = getDb();
    const days = parseInt(((req.query as any)?.days ?? '7'), 10);
    const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);

    const totalViews = db.prepare(
      'SELECT COUNT(*) as n FROM page_views WHERE date >= ?'
    ).get(since) as { n: number };

    const byDay = db.prepare(
      'SELECT date, COUNT(*) as views FROM page_views WHERE date >= ? GROUP BY date ORDER BY date'
    ).all(since);

    const byPage = db.prepare(
      'SELECT path, COUNT(*) as views FROM page_views WHERE date >= ? GROUP BY path ORDER BY views DESC LIMIT 20'
    ).all(since);

    const byReferrer = db.prepare(
      'SELECT referrer, COUNT(*) as views FROM page_views WHERE date >= ? AND referrer IS NOT NULL AND referrer != \'\' GROUP BY referrer ORDER BY views DESC LIMIT 20'
    ).all(since);

    const today = new Date().toISOString().slice(0, 10);
    const todayViews = db.prepare(
      'SELECT COUNT(*) as n FROM page_views WHERE date = ?'
    ).get(today) as { n: number };

    const totalRoasts = db.prepare('SELECT COUNT(*) as n FROM roast_history').get() as { n: number };
    const totalUsers = db.prepare('SELECT COUNT(*) as n FROM token_balances').get() as { n: number };

    return {
      period: { days, since },
      views: totalViews.n,
      todayViews: todayViews.n,
      totalRoasts: totalRoasts.n,
      totalUsers: totalUsers.n,
      byDay,
      byPage,
      byReferrer,
    };
  });
}
