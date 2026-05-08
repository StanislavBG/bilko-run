import type { FastifyInstance } from 'fastify';
import { dbGet, dbAll, dbRun } from '../db.js';
import { requireAdmin, ADMIN_EMAILS } from '../clerk.js';
import { classifyReferrer, parseUa, isBot } from '../services/analytics.js';
import { PRODUCT_KEYS } from '../../shared/product-catalog.js';

// Event allowlist (must match client-side enum).
// `checkout_success` is intentionally NOT client-settable — only the Stripe
// webhook handler server-side may flip sessions.purchased.
const ALLOWED_EVENTS = new Set([
  'view_tool', 'submit_start', 'submit_success', 'submit_error',
  'paywall_shown', 'signin_click', 'signup_complete',
  'checkout_start', 'credit_spent',
  'result_copied', 'result_shared', 'cross_promo_click',
  'free_limit_hit', 'not_found',
]);

// Dual-key rate limiter (in-memory): both visitor_id AND IP must stay under cap.
// visitor_id alone is bypassable (client-controlled localStorage); IP catches rotation.
const _eventCounts = new Map<string, { count: number; windowStart: number }>();
const EVENT_RATE_LIMIT_VISITOR = 120; // per minute per visitor
const EVENT_RATE_LIMIT_IP = 600;      // per minute per IP (allows shared networks)
const EVENT_RATE_WINDOW_MS = 60_000;

function bumpAndCheck(key: string, limit: number): boolean {
  const now = Date.now();
  const entry = _eventCounts.get(key);
  if (!entry || now - entry.windowStart > EVENT_RATE_WINDOW_MS) {
    _eventCounts.set(key, { count: 1, windowStart: now });
    if (_eventCounts.size > 5000) {
      for (const [k, v] of _eventCounts) {
        if (now - v.windowStart > EVENT_RATE_WINDOW_MS) _eventCounts.delete(k);
      }
    }
    return true;
  }
  entry.count += 1;
  return entry.count <= limit;
}

function checkEventRate(visitorId: string | null, ip: string | null): boolean {
  const ipOk = ip ? bumpAndCheck(`ip:${ip}`, EVENT_RATE_LIMIT_IP) : true;
  const vOk = visitorId ? bumpAndCheck(`v:${visitorId}`, EVENT_RATE_LIMIT_VISITOR) : true;
  return ipOk && vOk;
}

// Cap the whole dashboard Promise.all — if any underlying query stalls, the
// admin sees a 504 instead of a spinner that never returns.
async function raceTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  try { return await Promise.race([p, timeout]); }
  finally { clearTimeout(timer!); }
}

function parseRefHost(raw: string | null): string | null {
  if (!raw) return null;
  try {
    return new URL(raw).hostname.toLowerCase().replace(/^www\./, '') || null;
  } catch {
    // If it's already just a host
    return raw.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0] || null;
  }
}

export function registerAnalyticsRoutes(app: FastifyInstance): void {
  // Fire-and-forget page view tracking — no cookies, no PII
  app.post('/api/analytics/pageview', async (req) => {
    try {
      const body = req.body as {
        path?: string; referrer?: string; screen?: string; email?: string;
        utm_source?: string; utm_medium?: string; utm_campaign?: string; utm_term?: string; utm_content?: string;
        visitor_id?: string; session_id?: string;
      } | null;
      const path = (body?.path ?? '/').slice(0, 200);
      const referrer = (body?.referrer ?? '').slice(0, 500) || null;
      const screen = (body?.screen ?? '').slice(0, 20) || null;
      const email = (body?.email ?? '').slice(0, 200).toLowerCase() || null;
      const ua = ((req.headers['user-agent'] ?? '') as string).slice(0, 300) || '';
      const date = new Date().toISOString().slice(0, 10);
      const nowMs = Date.now();
      const utmSource = (body?.utm_source ?? '').slice(0, 100) || null;
      const utmMedium = (body?.utm_medium ?? '').slice(0, 100) || null;
      const utmCampaign = (body?.utm_campaign ?? '').slice(0, 200) || null;
      const utmTerm = (body?.utm_term ?? '').slice(0, 200) || null;
      const utmContent = (body?.utm_content ?? '').slice(0, 200) || null;
      const country = ((req.headers['cf-ipcountry'] ?? req.headers['x-vercel-ip-country'] ?? req.headers['x-country'] ?? null) as string | null) || null;
      const visitorId = (body?.visitor_id ?? '').slice(0, 64) || null;
      const sessionId = (body?.session_id ?? '').slice(0, 64) || null;

      const bot = isBot(ua) ? 1 : 0;
      if (bot) return { ok: true };

      const refHost = parseRefHost(referrer);
      const { bucket: sourceBucket } = await classifyReferrer(refHost);
      const { device, browser, os } = parseUa(ua);
      const isAdmin = email && ADMIN_EMAILS.includes(email) ? 1 : 0;

      // Check if visitor is new (before insert)
      let isNewVisitor = 0;
      if (visitorId) {
        const existing = await dbGet<{ x: number }>('SELECT 1 as x FROM page_views WHERE visitor_id = ? LIMIT 1', visitorId);
        isNewVisitor = existing ? 0 : 1;
      }

      await dbRun(
        `INSERT INTO page_views (
          path, referrer, country, ua, screen, email, date,
          utm_source, utm_medium, utm_campaign, utm_term, utm_content,
          visitor_id, session_id, is_new_visitor, referrer_host, source_bucket,
          device, browser, os, is_bot, is_admin, created_at_ms
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        path, referrer, country, ua || null, screen, email, date,
        utmSource, utmMedium, utmCampaign, utmTerm, utmContent,
        visitorId, sessionId, isNewVisitor, refHost, sourceBucket,
        device, browser, os, bot, isAdmin, nowMs,
      );

      // Upsert session
      if (sessionId && visitorId) {
        await dbRun(
          `INSERT INTO sessions (
            session_id, visitor_id, started_at, ended_at, landing_path, exit_path, page_count,
            utm_source, utm_medium, utm_campaign, source_bucket, referrer_host, country, device, email
          ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(session_id) DO UPDATE SET
            ended_at = excluded.ended_at,
            exit_path = excluded.exit_path,
            page_count = sessions.page_count + 1,
            email = COALESCE(sessions.email, excluded.email)`,
          sessionId, visitorId, nowMs, nowMs, path, path,
          utmSource, utmMedium, utmCampaign, sourceBucket, refHost, country, device, email,
        );
      }
    } catch { /* never fail */ }

    return { ok: true };
  });

  // Client-side funnel events
  app.post('/api/analytics/event', async (req, reply) => {
    try {
      const body = req.body as {
        event?: string; tool?: string; path?: string;
        visitor_id?: string; session_id?: string; metadata?: unknown;
      } | null;
      const event = (body?.event ?? '').slice(0, 40);
      if (!ALLOWED_EVENTS.has(event)) {
        reply.status(400);
        return { error: 'Unknown event' };
      }
      const visitorId = (body?.visitor_id ?? '').slice(0, 64) || null;
      const sessionId = (body?.session_id ?? '').slice(0, 64) || null;
      const tool = (body?.tool ?? '').slice(0, 80) || null;
      const path = (body?.path ?? '').slice(0, 200) || null;

      const ip = (req.ip as string | undefined) ?? null;
      if (!checkEventRate(visitorId, ip)) {
        return { ok: true, throttled: true };
      }

      let metadata: string | null = null;
      if (body?.metadata != null) {
        try { metadata = JSON.stringify(body.metadata).slice(0, 2000); } catch { metadata = null; }
      }

      await dbRun(
        'INSERT INTO funnel_events (event, ip_hash, tool, email, metadata, session_id, visitor_id, path) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        event, null, tool, null, metadata, sessionId, visitorId, path,
      );

      // Flip sessions.converted only when the visitor_id on the request matches
      // the visitor_id that originally created the session — prevents cross-session flag forgery.
      if (sessionId && visitorId && event === 'credit_spent') {
        await dbRun(
          'UPDATE sessions SET converted = 1 WHERE session_id = ? AND visitor_id = ?',
          sessionId, visitorId,
        );
      }
    } catch { /* never fail */ }
    return { ok: true };
  });

  // Dashboard stats — admin only
  app.get('/api/analytics/stats', async (req, reply) => {
    if (!await requireAdmin(req, reply)) return;
    const days = parseInt(((req.query as any)?.days ?? '7'), 10);
    const { excludeAdmins, adminArgs } = buildAdminExclusion(req);
    const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
    const priorSince = new Date(Date.now() - days * 2 * 86400000).toISOString().slice(0, 10);
    const priorUntil = since; // prior window is [priorSince, since)

    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    const [
      totalViews, byDay, byPage, byReferrer, todayViews,
      totalRoasts, totalUsers, topUsers, tokenPurchases,
      signupsByDay, roastsByDay, recentUserRoasts, activityFeed,
      revenueSingle, revenueBundle, toolUsage, toolVisits,
      uniqueVisitors, topLandingPages, referrerToTool, dailyActiveUsers, blogTraffic,
      topUtms, byCountry,
      // prior-period KPIs
      priorTotalViews, priorTodayViews, priorUniqueVisitors,
      priorTotalRoasts, priorTotalUsers, priorTokenPurchases,
      priorRevenueSingle, priorRevenueBundle,
    ] = await raceTimeout(Promise.all([
      dbGet<{ n: number }>(`SELECT COUNT(*) as n FROM page_views WHERE date >= ?${excludeAdmins}`, since, ...adminArgs),
      dbAll(`SELECT date, COUNT(*) as views FROM page_views WHERE date >= ?${excludeAdmins} GROUP BY date ORDER BY date`, since, ...adminArgs),
      dbAll(`SELECT path, COUNT(*) as views FROM page_views WHERE date >= ?${excludeAdmins} GROUP BY path ORDER BY views DESC LIMIT 20`, since, ...adminArgs),
      dbAll(`SELECT referrer, COUNT(*) as views FROM page_views WHERE date >= ? AND referrer IS NOT NULL AND referrer != ''${excludeAdmins} GROUP BY referrer ORDER BY views DESC LIMIT 20`, since, ...adminArgs),
      dbGet<{ n: number }>(`SELECT COUNT(*) as n FROM page_views WHERE date = ?${excludeAdmins}`, today, ...adminArgs),
      dbGet<{ n: number }>('SELECT COUNT(*) as n FROM roast_history'),
      dbGet<{ n: number }>('SELECT COUNT(*) as n FROM token_balances'),
      dbAll(`
        SELECT tb.email, tb.balance AS credits,
          (SELECT COUNT(*) FROM user_roasts ur WHERE ur.email = tb.email) AS roasts,
          (SELECT MAX(created_at) FROM user_roasts ur WHERE ur.email = tb.email) AS last_roast,
          (SELECT SUM(amount) FROM token_transactions tt WHERE tt.email = tb.email AND tt.reason = 'stripe_purchase') AS purchased
        FROM token_balances tb ORDER BY roasts DESC LIMIT 50
      `),
      dbGet<{ count: number }>('SELECT COUNT(*) as count FROM stripe_one_time_purchases WHERE product_key = ?', PRODUCT_KEYS.PAGEROAST_TOKENS),
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
      dbAll(`SELECT path, COUNT(*) as visits FROM page_views WHERE date >= ? AND path LIKE '/projects/%'${excludeAdmins} GROUP BY path ORDER BY visits DESC`, since, ...adminArgs),
      // Unique visitors (distinct emails)
      dbGet<{ n: number }>(`SELECT COUNT(DISTINCT email) as n FROM page_views WHERE date >= ? AND email IS NOT NULL${excludeAdmins}`, since, ...adminArgs),
      // Top landing pages (from sessions table — falls back to legacy logic if sessions empty)
      dbAll(`SELECT landing_path as path, COUNT(*) as sessions FROM sessions WHERE started_at >= ? GROUP BY landing_path ORDER BY sessions DESC LIMIT 15`, Date.now() - days * 86400000),
      // Referrer → tool conversion (which referrers lead to tool pages)
      dbAll(`SELECT referrer, path, COUNT(*) as visits FROM page_views WHERE date >= ? AND referrer IS NOT NULL AND referrer != '' AND path LIKE '/projects/%'${excludeAdmins} GROUP BY referrer, path ORDER BY visits DESC LIMIT 20`, since, ...adminArgs),
      // Daily active users
      dbAll(`SELECT date, COUNT(DISTINCT email) as users FROM page_views WHERE date >= ? AND email IS NOT NULL${excludeAdmins} GROUP BY date ORDER BY date`, since, ...adminArgs),
      // Blog traffic
      dbAll(`SELECT path, COUNT(*) as views FROM page_views WHERE date >= ? AND path LIKE '/blog%'${excludeAdmins} GROUP BY path ORDER BY views DESC LIMIT 10`, since, ...adminArgs),
      // Top UTM campaigns
      dbAll(`SELECT utm_source, utm_medium, utm_campaign, COUNT(*) AS views, COUNT(DISTINCT email) AS signed_in FROM page_views WHERE date >= ? AND utm_source IS NOT NULL${excludeAdmins} GROUP BY utm_source, utm_medium, utm_campaign ORDER BY views DESC LIMIT 20`, since, ...adminArgs),
      // Views by country
      dbAll(`SELECT country, COUNT(*) as views FROM page_views WHERE date >= ? AND country IS NOT NULL AND country != ''${excludeAdmins} GROUP BY country ORDER BY views DESC LIMIT 15`, since, ...adminArgs),
      // Prior-period KPIs
      dbGet<{ n: number }>(`SELECT COUNT(*) as n FROM page_views WHERE date >= ? AND date < ?${excludeAdmins}`, priorSince, priorUntil, ...adminArgs),
      dbGet<{ n: number }>(`SELECT COUNT(*) as n FROM page_views WHERE date = ?${excludeAdmins}`, yesterday, ...adminArgs),
      dbGet<{ n: number }>(`SELECT COUNT(DISTINCT email) as n FROM page_views WHERE date >= ? AND date < ? AND email IS NOT NULL${excludeAdmins}`, priorSince, priorUntil, ...adminArgs),
      dbGet<{ n: number }>('SELECT COUNT(*) as n FROM roast_history WHERE date(created_at) >= ? AND date(created_at) < ?', priorSince, priorUntil),
      dbGet<{ n: number }>('SELECT COUNT(*) as n FROM token_balances WHERE date(created_at) >= ? AND date(created_at) < ?', priorSince, priorUntil),
      dbGet<{ count: number }>('SELECT COUNT(*) as count FROM stripe_one_time_purchases WHERE product_key = ? AND date(created_at) >= ? AND date(created_at) < ?', PRODUCT_KEYS.PAGEROAST_TOKENS, priorSince, priorUntil),
      dbGet<{ n: number }>("SELECT COUNT(*) as n FROM stripe_one_time_purchases p JOIN token_transactions t ON t.stripe_payment_intent_id = p.stripe_payment_intent_id WHERE t.amount = 1 AND date(p.created_at) >= ? AND date(p.created_at) < ?", priorSince, priorUntil),
      dbGet<{ n: number }>("SELECT COUNT(*) as n FROM stripe_one_time_purchases p JOIN token_transactions t ON t.stripe_payment_intent_id = p.stripe_payment_intent_id WHERE t.amount = 7 AND date(p.created_at) >= ? AND date(p.created_at) < ?", priorSince, priorUntil),
    ]), 15000, 'admin /stats');

    const singleCount = revenueSingle?.n ?? 0;
    const bundleCount = revenueBundle?.n ?? 0;
    const priorSingleCount = priorRevenueSingle?.n ?? 0;
    const priorBundleCount = priorRevenueBundle?.n ?? 0;

    return {
      period: { days, since },
      views: totalViews?.n ?? 0,
      todayViews: todayViews?.n ?? 0,
      totalRoasts: totalRoasts?.n ?? 0,
      totalUsers: totalUsers?.n ?? 0,
      tokenPurchases: tokenPurchases?.count ?? 0,
      revenue: { single: singleCount, bundle: bundleCount, total: singleCount * 1 + bundleCount * 5 },
      // Prior-period deltas
      views_prior: priorTotalViews?.n ?? 0,
      todayViews_prior: priorTodayViews?.n ?? 0,
      uniqueVisitors_prior: priorUniqueVisitors?.n ?? 0,
      totalRoasts_prior: priorTotalRoasts?.n ?? 0,
      totalUsers_prior: priorTotalUsers?.n ?? 0,
      tokenPurchases_prior: priorTokenPurchases?.count ?? 0,
      revenue_prior: { single: priorSingleCount, bundle: priorBundleCount, total: priorSingleCount * 1 + priorBundleCount * 5 },
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
      topUtms,
      byCountry,
    };
  });

  // ── New split endpoints ────────────────────────────────────────────────

  function buildAdminExclusion(req: any): { excludeAdmins: string; adminArgs: unknown[]; since: string; sinceMs: number } {
    const sinceParam = (req.query as any)?.since;
    const excludeSelf = ((req.query as any)?.exclude_self ?? '1') !== '0';
    const days = 30;
    const since = typeof sinceParam === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(sinceParam)
      ? sinceParam
      : new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
    const sinceMs = new Date(since + 'T00:00:00Z').getTime();

    const placeholders = ADMIN_EMAILS.map(() => '?').join(', ');
    const excludeAdmins = !excludeSelf || ADMIN_EMAILS.length === 0
      ? ''
      : ` AND (email IS NULL OR email NOT IN (${placeholders}))`;
    const adminArgs: unknown[] = excludeSelf ? ADMIN_EMAILS.map(e => e.toLowerCase()) : [];
    return { excludeAdmins, adminArgs, since, sinceMs };
  }

  // Sources widget data
  app.get('/api/analytics/sources', async (req, reply) => {
    if (!await requireAdmin(req, reply)) return;
    const { excludeAdmins, adminArgs, since } = buildAdminExclusion(req);

    const [byBucket, byHost, byUtm, topConverting] = await Promise.all([
      dbAll(`SELECT COALESCE(source_bucket, 'direct') as bucket, COUNT(*) as views FROM page_views WHERE date >= ?${excludeAdmins} GROUP BY bucket ORDER BY views DESC`, since, ...adminArgs),
      dbAll(`SELECT COALESCE(referrer_host, '(direct)') as host, COALESCE(source_bucket, 'direct') as bucket, COUNT(*) as views FROM page_views WHERE date >= ?${excludeAdmins} GROUP BY host, bucket ORDER BY views DESC LIMIT 25`, since, ...adminArgs),
      dbAll(`SELECT utm_source, utm_medium, utm_campaign, COUNT(*) AS views, COUNT(DISTINCT email) AS signed_in FROM page_views WHERE date >= ? AND utm_source IS NOT NULL${excludeAdmins} GROUP BY utm_source, utm_medium, utm_campaign ORDER BY views DESC LIMIT 20`, since, ...adminArgs),
      // Top converting referrers: join sessions on converted flag
      dbAll(`SELECT COALESCE(referrer_host, '(direct)') as host, COALESCE(source_bucket, 'direct') as bucket,
              COUNT(*) as sessions, SUM(converted) as converted, SUM(purchased) as purchased
            FROM sessions WHERE started_at >= ?
            GROUP BY host, bucket
            HAVING sessions >= 1
            ORDER BY converted DESC, sessions DESC LIMIT 20`,
        new Date(since + 'T00:00:00Z').getTime()),
    ]);

    return { byBucket, byHost, byUtm, topConverting };
  });

  // Funnels widget data
  app.get('/api/analytics/funnels', async (req, reply) => {
    if (!await requireAdmin(req, reply)) return;
    const { since } = buildAdminExclusion(req);
    const sinceDt = since + 'T00:00:00Z';

    const [perToolEvents, dropOff] = await Promise.all([
      // Per-tool funnel counts
      dbAll(`SELECT tool, event, COUNT(*) as n FROM funnel_events
             WHERE created_at >= ? AND tool IS NOT NULL
             GROUP BY tool, event ORDER BY tool, event`, sinceDt),
      // Overall drop-off table (global counts per event)
      dbAll(`SELECT event, COUNT(*) as n, COUNT(DISTINCT visitor_id) as visitors
             FROM funnel_events WHERE created_at >= ?
             GROUP BY event ORDER BY n DESC`, sinceDt),
    ]);

    // Roll up into per-tool funnels
    const tools = new Map<string, Record<string, number>>();
    for (const row of perToolEvents as Array<{ tool: string; event: string; n: number }>) {
      if (!tools.has(row.tool)) tools.set(row.tool, {});
      tools.get(row.tool)![row.event] = row.n;
    }
    const funnels = Array.from(tools.entries()).map(([tool, events]) => {
      const views = events.view_tool ?? 0;
      const starts = events.submit_start ?? 0;
      const successes = events.submit_success ?? 0;
      const errors = events.submit_error ?? 0;
      const paywalls = events.paywall_shown ?? 0;
      return {
        tool, views, starts, successes, errors, paywalls,
        start_rate: views > 0 ? starts / views : 0,
        success_rate: starts > 0 ? successes / starts : 0,
      };
    }).sort((a, b) => b.views - a.views);

    return { funnels, dropOff };
  });

  // Audience widget data
  app.get('/api/analytics/audience', async (req, reply) => {
    if (!await requireAdmin(req, reply)) return;
    const { excludeAdmins, adminArgs, since } = buildAdminExclusion(req);

    const [newVsReturning, byCountry, byDevice, byBrowser] = await Promise.all([
      dbAll(`SELECT date,
               SUM(CASE WHEN is_new_visitor = 1 THEN 1 ELSE 0 END) as new_visitors,
               SUM(CASE WHEN is_new_visitor = 0 THEN 1 ELSE 0 END) as returning_visitors
             FROM page_views WHERE date >= ?${excludeAdmins}
             GROUP BY date ORDER BY date`, since, ...adminArgs),
      dbAll(`SELECT country, COUNT(*) as views FROM page_views WHERE date >= ? AND country IS NOT NULL AND country != ''${excludeAdmins} GROUP BY country ORDER BY views DESC LIMIT 20`, since, ...adminArgs),
      dbAll(`SELECT COALESCE(device, 'other') as device, COUNT(*) as views FROM page_views WHERE date >= ?${excludeAdmins} GROUP BY device ORDER BY views DESC`, since, ...adminArgs),
      dbAll(`SELECT COALESCE(browser, 'other') as browser, COUNT(*) as views FROM page_views WHERE date >= ?${excludeAdmins} GROUP BY browser ORDER BY views DESC LIMIT 10`, since, ...adminArgs),
    ]);

    return { newVsReturning, byCountry, byDevice, byBrowser };
  });

  // Cost controls dashboard
  app.get('/api/admin/cost', async (req, reply) => {
    if (!await requireAdmin(req, reply)) return;
    const today = new Date().toISOString().slice(0, 10);
    const since30 = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

    const [todayTotal, byTool, byDay, openAlerts, ceilings] = await Promise.all([
      dbGet<{ total: number; estimated_cost: number }>(
        `SELECT SUM(calls) AS total, ROUND(SUM(calls) * 0.001, 2) AS estimated_cost FROM usage_daily WHERE date = ?`, today,
      ),
      dbAll(
        `SELECT app_slug, SUM(calls) AS calls FROM usage_daily WHERE date = ? GROUP BY app_slug ORDER BY calls DESC LIMIT 10`, today,
      ),
      dbAll(
        `SELECT date, SUM(calls) AS calls, ROUND(SUM(calls) * 0.001, 2) AS estimated_cost FROM usage_daily WHERE date >= ? GROUP BY date ORDER BY date`, since30,
      ),
      dbAll(
        `SELECT * FROM cost_alerts WHERE resolved_at IS NULL ORDER BY created_at DESC LIMIT 50`,
      ),
      dbAll(`SELECT * FROM app_spend_ceilings ORDER BY app_slug`),
    ]);

    return { todayTotal, byTool, byDay, openAlerts, ceilings };
  });

  app.post('/api/admin/cost/resolve-alert', async (req, reply) => {
    if (!await requireAdmin(req, reply)) return;
    const { id } = req.body as { id?: number };
    if (!id) { reply.status(400); return { error: 'id required' }; }
    await dbRun(`UPDATE cost_alerts SET resolved_at = ? WHERE id = ?`, Math.floor(Date.now() / 1000), id);
    return { ok: true };
  });

  app.post('/api/admin/spend-ceiling', async (req, reply) => {
    if (!await requireAdmin(req, reply)) return;
    const { app_slug, max_calls_per_day } = req.body as { app_slug?: string; max_calls_per_day?: number };
    if (!app_slug || !max_calls_per_day || max_calls_per_day < 1) {
      reply.status(400); return { error: 'app_slug and positive max_calls_per_day required' };
    }
    await dbRun(
      `INSERT INTO app_spend_ceilings (app_slug, max_calls_per_day, updated_at) VALUES (?, ?, ?) ON CONFLICT(app_slug) DO UPDATE SET max_calls_per_day = excluded.max_calls_per_day, updated_at = excluded.updated_at`,
      app_slug, max_calls_per_day, Math.floor(Date.now() / 1000),
    );
    return { ok: true };
  });

  // Revenue widget data
  app.get('/api/analytics/revenue', async (req, reply) => {
    if (!await requireAdmin(req, reply)) return;
    const { since } = buildAdminExclusion(req);

    const daily = await dbAll(
      `SELECT date(p.created_at) as date,
          SUM(CASE WHEN t.amount = 1 THEN 1 ELSE 5 END) as revenue,
          COUNT(*) as purchases
        FROM stripe_one_time_purchases p
        JOIN token_transactions t ON t.stripe_payment_intent_id = p.stripe_payment_intent_id
        WHERE date(p.created_at) >= ?
        GROUP BY date(p.created_at) ORDER BY date`,
      since,
    ) as Array<{ date: string; revenue: number; purchases: number }>;

    let cum = 0;
    const cumulative = daily.map(d => ({ date: d.date, revenue: d.revenue, cumulative: (cum += d.revenue), purchases: d.purchases }));

    return { daily, cumulative };
  });
}
