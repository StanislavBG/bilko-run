import type { FastifyInstance } from 'fastify';
import { dbAll, dbGet } from '../db.js';
import { requireAdmin } from '../clerk.js';
import { WEB_PRODUCTS, productKind, productPageSlug, type WebProduct } from '../../shared/web-products.js';
import { HOST_PAGE_PATHS, HOST_PAGE_SLUG } from '../page-hits.js';
import { listBookings } from '../services/service-bookings.js';
import { loadOwnerIds, mineExclusionSql, type MineColumns } from '../traffic-filters.js';

const DAY_MS = 86400000;

/** The report window: sinceMs for epoch-ms columns, sinceDate (UTC YYYY-MM-DD) for date(created_at) columns. */
function windowStart(days: number): { sinceMs: number; sinceDate: string } {
  const sinceMs = Date.now() - days * DAY_MS;
  return { sinceMs, sinceDate: new Date(sinceMs).toISOString().slice(0, 10) };
}

/** Parses an integer query param, clamped to [min, max]; fallback when missing or not a number. */
function clampInt(raw: unknown, min: number, max: number, fallback: number): number {
  const n = parseInt(String(raw ?? ''), 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

/**
 * 1 when a funnel_events row (alias fe) was made by automation: flagged at write time, or its visitor or session
 * has a bot-flagged page view. Labels only; no count drops these rows.
 */
const FE_AUTOMATED = `(COALESCE(fe.is_bot, 0) = 1
  OR (fe.visitor_id IS NOT NULL AND EXISTS (SELECT 1 FROM page_views pv WHERE pv.visitor_id = fe.visitor_id AND pv.is_bot = 1))
  OR (fe.session_id IS NOT NULL AND EXISTS (SELECT 1 FROM page_views pv WHERE pv.session_id = fe.session_id AND pv.is_bot = 1)))`;
/**
 * funnel_events.is_bot defaulted to 0 on every checkout_start until commit 7adc431b went live (~6:38 PM PST
 * 2026-11-20). Unflagged rows created before this UTC time (the created_at format) were never classified, so they
 * count as unlabeled, not human. Always passed as a bound parameter.
 */
export const CHECKOUT_LABELS_SINCE = '2026-11-21 02:39:00';
/** Takes one bound arg, CHECKOUT_LABELS_SINCE, which comes before every WHERE arg. */
const SPLIT_COLS = `COUNT(*) AS n, COALESCE(SUM(CASE WHEN ${FE_AUTOMATED} THEN 1 ELSE 0 END), 0) AS automated,
  COALESCE(SUM(CASE WHEN NOT ${FE_AUTOMATED} AND fe.created_at < ? THEN 1 ELSE 0 END), 0) AS unlabeled`;
type SplitRow = { n: number; automated: number; unlabeled: number };
export type CheckoutSplit = { human: number; automated: number; unlabeled: number };

/** Every checkout_start in the window, any tool (the /buy agent offers included), split by label. */
async function checkoutStartSplit(sinceDate: string, excludeSelf: boolean): Promise<CheckoutSplit> {
  const feSelfSql = excludeSelf ? ' AND COALESCE(fe.is_admin, 0) = 0' : '';
  const all = await dbGet<SplitRow>(
    `SELECT ${SPLIT_COLS} FROM funnel_events fe
     WHERE fe.event = 'checkout_start' AND date(fe.created_at) >= ?${feSelfSql}`, CHECKOUT_LABELS_SINCE, sinceDate);
  return {
    human: (all?.n ?? 0) - (all?.automated ?? 0) - (all?.unlabeled ?? 0),
    automated: all?.automated ?? 0,
    unlabeled: all?.unlabeled ?? 0,
  };
}

// The two EXISTS terms of FE_AUTOMATED, as separate columns for labelReasons.
const FE_VISITOR_BOT_VIEW = `(fe.visitor_id IS NOT NULL AND EXISTS (SELECT 1 FROM page_views pv WHERE pv.visitor_id = fe.visitor_id AND pv.is_bot = 1))`;
const FE_SESSION_BOT_VIEW = `(fe.session_id IS NOT NULL AND EXISTS (SELECT 1 FROM page_views pv WHERE pv.session_id = fe.session_id AND pv.is_bot = 1))`;

type StartRow = {
  id: number; created_at: string | null; tool: string | null; session_id: string | null; visitor_id: string | null;
  path: string | null; metadata: string | null; is_admin: number; is_internal: number; is_bot: number;
  automated: number; visitor_bot_view: number; session_bot_view: number;
  started_at: number | null; landing_path: string | null; referrer_host: string | null; source_bucket: string | null;
  utm_source: string | null; utm_medium: string | null; utm_campaign: string | null; country: string | null;
  device: string | null; has_session: number;
};

function parseTs(createdAt: string | null): number | null {
  if (!createdAt) return null;
  const t = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(createdAt)
    ? Date.parse(createdAt.replace(' ', 'T') + 'Z')
    : Date.parse(createdAt);
  return Number.isNaN(t) ? null : t;
}

function parseMetadata(raw: string | null): unknown {
  if (raw == null || raw === '') return null;
  try { return JSON.parse(raw); } catch { return raw; }
}

/** Session ids (of `ids`) with any page view flagged is_admin = 1 or is_internal = 1. One grouped query. */
async function adminSessions(ids: string[]): Promise<Set<string>> {
  const out = new Set<string>();
  if (!ids.length) return out;
  const rows = await dbAll<{ session_id: string }>(
    `SELECT session_id FROM page_views WHERE session_id IN (${ids.map(() => '?').join(',')})
     GROUP BY session_id HAVING MAX(COALESCE(is_admin, 0)) = 1 OR MAX(COALESCE(is_internal, 0)) = 1`, ...ids);
  for (const r of rows) out.add(r.session_id);
  return out;
}

/** Sorted distinct page_hits visitor classes per session id (page_hits.session_id is the same bilko_sid). */
async function sessionVisitorClasses(ids: string[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  if (!ids.length) return out;
  const rows = await dbAll<{ session_id: string; cls: string }>(
    `SELECT DISTINCT session_id, ${HIT_CLASS_SQL} AS cls FROM page_hits WHERE session_id IN (${ids.map(() => '?').join(',')})`, ...ids);
  for (const r of rows) {
    const list = out.get(r.session_id) ?? [];
    list.push(r.cls);
    out.set(r.session_id, list);
  }
  for (const list of out.values()) list.sort();
  return out;
}

// Same owner-signal columns /api/admin/traffic uses on page_hits.
const HITS_MINE_COLS: MineColumns = { isAdmin: 'is_admin', isInternal: 'is_internal', hashId: 'visitor_id', cookieId: 'client_vid' };
// Legacy NULL-class rows derive from is_bot, as in the traffic report.
const HIT_CLASS_SQL = "COALESCE(visitor_class, CASE WHEN is_bot = 1 THEN 'script' ELSE 'human' END)";

function likePrefix(slug: string): string {
  const escaped = `/projects/${slug}/`.replace(/[\\%_]/g, (c) => `\\${c}`);
  return `${escaped}%`;
}

/** page_views filter for the page that sells p. Only placeholders are interpolated; every value is a bound arg. */
function viewsFilter(p: WebProduct, products: readonly WebProduct[]): { sql: string; args: string[] } {
  const page = productPageSlug(p);
  if (page === HOST_PAGE_SLUG) {
    return { sql: `path IN (${HOST_PAGE_PATHS.map(() => '?').join(', ')})`, args: [...HOST_PAGE_PATHS] };
  }
  // A page can hold another product's page (launch-kit/agent-factory-kit); those views are that product's.
  const nested = products.filter((q) => productPageSlug(q).startsWith(`${page}/`)).map((q) => likePrefix(productPageSlug(q)));
  return {
    sql: [`path LIKE ? ESCAPE '\\'`, ...nested.map(() => `path NOT LIKE ? ESCAPE '\\'`)].join(' AND '),
    args: [likePrefix(page), ...nested],
  };
}

export function registerAdminWebProductRoutes(
  app: FastifyInstance,
  opts: { products?: readonly WebProduct[] } = {},
): void {
  const products = opts.products ?? WEB_PRODUCTS;

  app.get('/api/admin/web-products', async (req, reply) => {
    if (!await requireAdmin(req, reply)) return;
    reply.header('Cache-Control', 'no-store');
    const days = clampInt((req.query as { days?: unknown })?.days, 1, 365, 30);
    const { sinceMs, sinceDate } = windowStart(days);
    // Owner traffic is excluded unless exclude_self=0. Test-mode (cs_test_)
    // orders and downloads are never counted: they are owner tests by construction.
    const excludeSelf = String((req.query as { exclude_self?: unknown })?.exclude_self ?? '1') !== '0';
    const selfSql = excludeSelf ? ' AND COALESCE(is_admin, 0) = 0' : '';
    const feSelfSql = excludeSelf ? ' AND COALESCE(fe.is_admin, 0) = 0' : '';
    const NOT_TEST = " AND checkout_session_id NOT LIKE 'cs\\_test\\_%' ESCAPE '\\'";

    const entries = [];
    const daily: Array<{ date: string; slug: string; views: number; checkoutStarts: number; orders: number; downloads: number }> = [];

    for (const p of products) {
      const page = viewsFilter(p, products);
      const [views, checkouts, orders, downloads, lastOrder, lastDownload, release,
        viewsByDay, checkoutsByDay, ordersByDay, downloadsByDay, outcomes] = await Promise.all([
        dbGet<{ views: number; visitors: number }>(
          `SELECT COUNT(*) AS views, COUNT(DISTINCT visitor_id) AS visitors FROM page_views
           WHERE date >= ? AND ${page.sql} AND COALESCE(is_bot, 0) = 0${selfSql}`, sinceDate, ...page.args),
        dbGet<SplitRow>(
          `SELECT ${SPLIT_COLS} FROM funnel_events fe
           WHERE fe.event = 'checkout_start' AND fe.tool = ? AND date(fe.created_at) >= ?${feSelfSql}`,
          CHECKOUT_LABELS_SINCE, p.slug, sinceDate),
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
           WHERE date >= ? AND ${page.sql} AND COALESCE(is_bot, 0) = 0${selfSql} GROUP BY date`, sinceDate, ...page.args),
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

      // Services have no zip: show upcoming bookings (and intake) instead, so the owner
      // sees them even when email is not configured.
      const serviceExtra = productKind(p) === 'service'
        ? {
          release: null,
          bookings: (await listBookings({ pageSlug: productPageSlug(p), fromMs: Date.now() - DAY_MS })).filter((b) => b.slug === p.slug).map((b) => ({
            slug: b.slug, startMs: b.slotStartMs, endMs: b.slotEndMs, email: b.email, intake: b.intake, createdAt: b.createdAt,
          })),
        }
        : {};

      entries.push({
        ...serviceExtra,
        slug: p.slug,
        name: p.name,
        displayPrice: p.displayPrice,
        version: p.release?.version ?? null,
        releaseStored: (release?.n ?? 0) > 0,
        views: views?.views ?? 0,
        uniqueVisitors: views?.visitors ?? 0,
        checkoutStarts: checkouts?.n ?? 0,
        checkoutStartsHuman: (checkouts?.n ?? 0) - (checkouts?.automated ?? 0) - (checkouts?.unlabeled ?? 0),
        checkoutStartsAutomated: checkouts?.automated ?? 0,
        checkoutStartsUnlabeled: checkouts?.unlabeled ?? 0,
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

    const checkoutStartsAll = await checkoutStartSplit(sinceDate, excludeSelf);

    // /coffee is a 302 to the Stripe Payment Link, recorded in page_hits with a visitor class.
    const mine = excludeSelf ? mineExclusionSql(await loadOwnerIds(), HITS_MINE_COLS) : { sql: '', args: [] as string[] };
    const coffee = await dbGet<{ n: number; human: number }>(
      `SELECT COUNT(*) AS n, COALESCE(SUM(CASE WHEN ${HIT_CLASS_SQL} = 'human' THEN 1 ELSE 0 END), 0) AS human
       FROM page_hits WHERE ts_ms >= ? AND path = ?${mine.sql}`, sinceMs, '/coffee', ...mine.args);
    const coffeeRedirects = { human: coffee?.human ?? 0, automated: (coffee?.n ?? 0) - (coffee?.human ?? 0) };

    return { days, excludeSelf, products: entries, daily, checkoutStartsAll, coffeeRedirects };
  });

  // One row per checkout_start in the window, labeled by the same predicates as checkoutStartsAll. Read-only.
  app.get('/api/admin/checkout-starts', async (req, reply) => {
    if (!await requireAdmin(req, reply)) return;
    reply.header('Cache-Control', 'no-store');
    const q = (req.query ?? {}) as { days?: unknown; limit?: unknown };
    const days = clampInt(q.days, 1, 365, 7);
    const limit = clampInt(q.limit, 1, 1000, 200);
    const { sinceDate } = windowStart(days);

    const [counted, all, counts, rows, ownerIds] = await Promise.all([
      checkoutStartSplit(sinceDate, true),
      checkoutStartSplit(sinceDate, false),
      dbGet<{ n: number; owner: number }>(
        `SELECT COUNT(*) AS n, COALESCE(SUM(CASE WHEN COALESCE(fe.is_admin, 0) = 1 THEN 1 ELSE 0 END), 0) AS owner
         FROM funnel_events fe WHERE fe.event = 'checkout_start' AND date(fe.created_at) >= ?`, sinceDate),
      dbAll<StartRow>(
        `SELECT fe.id, fe.created_at, fe.tool, fe.session_id, fe.visitor_id, fe.path, fe.metadata,
           COALESCE(fe.is_admin, 0) AS is_admin, COALESCE(fe.is_internal, 0) AS is_internal, COALESCE(fe.is_bot, 0) AS is_bot,
           CASE WHEN ${FE_AUTOMATED} THEN 1 ELSE 0 END AS automated,
           CASE WHEN ${FE_VISITOR_BOT_VIEW} THEN 1 ELSE 0 END AS visitor_bot_view,
           CASE WHEN ${FE_SESSION_BOT_VIEW} THEN 1 ELSE 0 END AS session_bot_view,
           s.started_at, s.landing_path, s.referrer_host, s.source_bucket, s.utm_source, s.utm_medium, s.utm_campaign,
           s.country, s.device, (s.session_id IS NOT NULL) AS has_session
         FROM funnel_events fe LEFT JOIN sessions s ON s.session_id = fe.session_id
         WHERE fe.event = 'checkout_start' AND date(fe.created_at) >= ?
         ORDER BY fe.created_at DESC, fe.id DESC LIMIT ?`, sinceDate, limit),
      loadOwnerIds(),
    ]);

    const sessionIds = [...new Set(rows.map((r) => r.session_id).filter((s): s is string => !!s))];
    const [adminSids, classes] = await Promise.all([adminSessions(sessionIds), sessionVisitorClasses(sessionIds)]);
    const ownerCookies = new Set(ownerIds.cookieIds);

    const starts = rows.map((r) => {
      const createdAt = r.created_at ?? '';
      const automated = Number(r.automated) === 1;
      const label = automated ? 'automated' : createdAt < CHECKOUT_LABELS_SINCE ? 'unlabeled' : 'human';
      const labelReasons: string[] = [];
      if (automated) {
        if (Number(r.is_bot) === 1) labelReasons.push('ua');
        if (Number(r.visitor_bot_view) === 1) labelReasons.push('visitor_bot_view');
        if (Number(r.session_bot_view) === 1) labelReasons.push('session_bot_view');
      }
      const mineReasons: string[] = [];
      if (Number(r.is_admin) === 1) mineReasons.push('owner_ip');
      if (Number(r.is_internal) === 1) mineReasons.push('internal_marker');
      if (r.visitor_id && ownerCookies.has(r.visitor_id)) mineReasons.push('owner_device');
      if (r.session_id && adminSids.has(r.session_id)) mineReasons.push('admin_session');

      const metadata = parseMetadata(r.metadata);
      const meta = metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata as Record<string, unknown> : {};
      const checkoutSessionId = typeof meta.checkout_session_id === 'string' ? meta.checkout_session_id : null;
      const source = meta.via === 'agent-buy' ? 'agent-buy' : checkoutSessionId !== null ? 'web-product' : 'client-event';
      const stripeMode = checkoutSessionId?.startsWith('cs_test_') ? 'test' : checkoutSessionId?.startsWith('cs_live_') ? 'live' : null;
      const hasSession = Number(r.has_session) === 1;

      return {
        id: r.id,
        createdAt: r.created_at,
        ts: parseTs(r.created_at),
        tool: r.tool,
        source,
        checkoutSessionId,
        stripeMode,
        path: r.path ?? (typeof meta.path === 'string' ? meta.path : null),
        label,
        labelReasons,
        counted: Number(r.is_admin) !== 1,
        mine: mineReasons.length > 0,
        mineReasons,
        visitorId: r.visitor_id,
        sessionId: r.session_id,
        session: hasSession
          ? {
            startedAt: r.started_at, landingPath: r.landing_path, referrerHost: r.referrer_host, sourceBucket: r.source_bucket,
            utmSource: r.utm_source, utmMedium: r.utm_medium, utmCampaign: r.utm_campaign, country: r.country, device: r.device,
          }
          : null,
        sessionNote: hasSession ? null : r.session_id ? 'no sessions row for this session id' : 'no session id recorded on this start',
        visitorClasses: r.session_id ? classes.get(r.session_id) ?? [] : [],
        metadata,
      };
    });

    const total = counts?.n ?? 0;
    return {
      days,
      since: sinceDate,
      labelsSince: CHECKOUT_LABELS_SINCE,
      totals: { counted, all, starts: total, ownerFlagged: counts?.owner ?? 0 },
      listed: starts.length,
      truncated: total > starts.length,
      starts,
    };
  });
}
