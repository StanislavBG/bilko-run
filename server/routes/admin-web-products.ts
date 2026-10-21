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
    // Owner traffic is excluded unless exclude_self=0. Test-mode (cs_test_)
    // orders and downloads are never counted: they are owner tests by construction.
    const excludeSelf = String((req.query as { exclude_self?: unknown })?.exclude_self ?? '1') !== '0';
    const selfSql = excludeSelf ? ' AND COALESCE(is_admin, 0) = 0' : '';
    const NOT_TEST = " AND checkout_session_id NOT LIKE 'cs\\_test\\_%' ESCAPE '\\'";

    const entries = [];
    const daily: Array<{ date: string; slug: string; views: number; checkoutStarts: number; orders: number; downloads: number }> = [];

    for (const p of products) {
      const pattern = likePrefix(p.slug);
      const [views, checkouts, orders, downloads, lastOrder, lastDownload, release,
        viewsByDay, checkoutsByDay, ordersByDay, downloadsByDay, outcomes] = await Promise.all([
        dbGet<{ views: number; visitors: number }>(
          `SELECT COUNT(*) AS views, COUNT(DISTINCT visitor_id) AS visitors FROM page_views
           WHERE date >= ? AND path LIKE ? ESCAPE '\\' AND COALESCE(is_bot, 0) = 0${selfSql}`, sinceDate, pattern),
        dbGet<{ n: number }>(
          `SELECT COUNT(*) AS n FROM funnel_events WHERE event = 'checkout_start' AND tool = ? AND date(created_at) >= ?${selfSql}`,
          p.slug, sinceDate),
        dbGet<{ n: number; revenue: number }>(
          `SELECT COUNT(*) AS n, COALESCE(SUM(amount_total), 0) AS revenue FROM web_product_orders WHERE slug = ? AND created_at >= ?${NOT_TEST}`,
          p.slug, sinceMs),
        dbGet<{ n: number; sessions: number }>(
          `SELECT COUNT(*) AS n, COUNT(DISTINCT checkout_session_id) AS sessions FROM web_product_downloads WHERE slug = ? AND created_at >= ?${NOT_TEST}`,
          p.slug, sinceMs),
        dbGet<{ t: number | null }>(`SELECT MAX(created_at) AS t FROM web_product_orders WHERE slug = ?${NOT_TEST}`, p.slug),
        dbGet<{ t: number | null }>(`SELECT MAX(created_at) AS t FROM web_product_downloads WHERE slug = ?${NOT_TEST}`, p.slug),
        p.release
          ? dbGet<{ n: number }>(`SELECT COUNT(*) AS n FROM web_product_releases WHERE slug = ? AND version = ?`, p.slug, p.release.version)
          : Promise.resolve(null),
        dbAll<{ d: string; n: number }>(
          `SELECT date AS d, COUNT(*) AS n FROM page_views
           WHERE date >= ? AND path LIKE ? ESCAPE '\\' AND COALESCE(is_bot, 0) = 0${selfSql} GROUP BY date`, sinceDate, pattern),
        dbAll<{ d: string; n: number }>(
          `SELECT date(created_at) AS d, COUNT(*) AS n FROM funnel_events
           WHERE event = 'checkout_start' AND tool = ? AND date(created_at) >= ?${selfSql} GROUP BY d`, p.slug, sinceDate),
        dbAll<{ d: string; n: number }>(
          `SELECT date(created_at / 1000, 'unixepoch') AS d, COUNT(*) AS n FROM web_product_orders
           WHERE slug = ? AND created_at >= ?${NOT_TEST} GROUP BY d`, p.slug, sinceMs),
        dbAll<{ d: string; n: number }>(
          `SELECT date(created_at / 1000, 'unixepoch') AS d, COUNT(*) AS n FROM web_product_downloads
           WHERE slug = ? AND created_at >= ?${NOT_TEST} GROUP BY d`, p.slug, sinceMs),
        // Written by the Stripe webhook, which already skips owner/test sessions.
        dbAll<{ event: string; n: number }>(
          `SELECT event, COUNT(*) AS n FROM funnel_events
           WHERE event IN ('checkout_expired', 'checkout_recovered') AND tool = ? AND date(created_at) >= ? GROUP BY event`,
          p.slug, sinceDate),
      ]);
      const outcome = (e: string) => outcomes.find((o) => o.event === e)?.n ?? 0;

      entries.push({
        slug: p.slug,
        name: p.name,
        displayPrice: p.displayPrice,
        version: p.release?.version ?? null,
        releaseStored: (release?.n ?? 0) > 0,
        views: views?.views ?? 0,
        uniqueVisitors: views?.visitors ?? 0,
        checkoutStarts: checkouts?.n ?? 0,
        checkoutsExpired: outcome('checkout_expired'),
        checkoutsRecovered: outcome('checkout_recovered'),
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

    return { days, excludeSelf, products: entries, daily };
  });
}
