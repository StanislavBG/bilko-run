import type { FastifyInstance } from 'fastify';
import { dbAll, dbGet } from '../db.js';
import { requireAdmin } from '../clerk.js';
import { WEB_PRODUCTS, type WebProduct } from '../../shared/web-products.js';

const DAY_MS = 86400000;

function likePrefix(slug: string): string {
  const escaped = `/projects/${slug}/`.replace(/[\\%_]/g, (c) => `\\${c}`);
  return `${escaped}%`;
}

export function registerAdminWebProductRoutes(
  app: FastifyInstance,
  opts: { products?: readonly WebProduct[] } = {},
): void {
  const products = opts.products ?? WEB_PRODUCTS;

  app.get('/api/admin/web-products', async (req, reply) => {
    if (!await requireAdmin(req, reply)) return;
    reply.header('Cache-Control', 'no-store');
    const rawDays = parseInt(String((req.query as { days?: unknown })?.days ?? ''), 10);
    const days = Number.isFinite(rawDays) ? Math.min(365, Math.max(1, rawDays)) : 30;
    const sinceMs = Date.now() - days * DAY_MS;
    const sinceDate = new Date(sinceMs).toISOString().slice(0, 10);

    const entries = [];
    const daily: Array<{ date: string; slug: string; views: number; checkoutStarts: number; orders: number; downloads: number }> = [];

    for (const p of products) {
      const pattern = likePrefix(p.slug);
      const [views, checkouts, orders, downloads, lastOrder, lastDownload, release,
        viewsByDay, checkoutsByDay, ordersByDay, downloadsByDay] = await Promise.all([
        dbGet<{ views: number; visitors: number }>(
          `SELECT COUNT(*) AS views, COUNT(DISTINCT visitor_id) AS visitors FROM page_views
           WHERE date >= ? AND path LIKE ? ESCAPE '\\' AND COALESCE(is_bot, 0) = 0`, sinceDate, pattern),
        dbGet<{ n: number }>(
          `SELECT COUNT(*) AS n FROM funnel_events WHERE event = 'checkout_start' AND tool = ? AND date(created_at) >= ?`,
          p.slug, sinceDate),
        dbGet<{ n: number; revenue: number }>(
          `SELECT COUNT(*) AS n, COALESCE(SUM(amount_total), 0) AS revenue FROM web_product_orders WHERE slug = ? AND created_at >= ?`,
          p.slug, sinceMs),
        dbGet<{ n: number; sessions: number }>(
          `SELECT COUNT(*) AS n, COUNT(DISTINCT checkout_session_id) AS sessions FROM web_product_downloads WHERE slug = ? AND created_at >= ?`,
          p.slug, sinceMs),
        dbGet<{ t: number | null }>(`SELECT MAX(created_at) AS t FROM web_product_orders WHERE slug = ?`, p.slug),
        dbGet<{ t: number | null }>(`SELECT MAX(created_at) AS t FROM web_product_downloads WHERE slug = ?`, p.slug),
        p.release
          ? dbGet<{ n: number }>(`SELECT COUNT(*) AS n FROM web_product_releases WHERE slug = ? AND version = ?`, p.slug, p.release.version)
          : Promise.resolve(null),
        dbAll<{ d: string; n: number }>(
          `SELECT date AS d, COUNT(*) AS n FROM page_views
           WHERE date >= ? AND path LIKE ? ESCAPE '\\' AND COALESCE(is_bot, 0) = 0 GROUP BY date`, sinceDate, pattern),
        dbAll<{ d: string; n: number }>(
          `SELECT date(created_at) AS d, COUNT(*) AS n FROM funnel_events
           WHERE event = 'checkout_start' AND tool = ? AND date(created_at) >= ? GROUP BY d`, p.slug, sinceDate),
        dbAll<{ d: string; n: number }>(
          `SELECT date(created_at / 1000, 'unixepoch') AS d, COUNT(*) AS n FROM web_product_orders
           WHERE slug = ? AND created_at >= ? GROUP BY d`, p.slug, sinceMs),
        dbAll<{ d: string; n: number }>(
          `SELECT date(created_at / 1000, 'unixepoch') AS d, COUNT(*) AS n FROM web_product_downloads
           WHERE slug = ? AND created_at >= ? GROUP BY d`, p.slug, sinceMs),
      ]);

      entries.push({
        slug: p.slug,
        name: p.name,
        displayPrice: p.displayPrice,
        version: p.release?.version ?? null,
        releaseStored: (release?.n ?? 0) > 0,
        views: views?.views ?? 0,
        uniqueVisitors: views?.visitors ?? 0,
        checkoutStarts: checkouts?.n ?? 0,
        orders: orders?.n ?? 0,
        revenueCents: orders?.revenue ?? 0,
        downloads: downloads?.n ?? 0,
        uniqueDownloadSessions: downloads?.sessions ?? 0,
        lastOrderAt: lastOrder?.t ?? null,
        lastDownloadAt: lastDownload?.t ?? null,
      });

      const rows = new Map<string, { date: string; slug: string; views: number; checkoutStarts: number; orders: number; downloads: number }>();
      const row = (date: string) => {
        let r = rows.get(date);
        if (!r) { r = { date, slug: p.slug, views: 0, checkoutStarts: 0, orders: 0, downloads: 0 }; rows.set(date, r); }
        return r;
      };
      for (const r of viewsByDay) row(r.d).views = r.n;
      for (const r of checkoutsByDay) row(r.d).checkoutStarts = r.n;
      for (const r of ordersByDay) row(r.d).orders = r.n;
      for (const r of downloadsByDay) row(r.d).downloads = r.n;
      daily.push(...[...rows.values()].sort((a, b) => a.date.localeCompare(b.date)));
    }

    return { days, products: entries, daily };
  });
}
