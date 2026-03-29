/**
 * Analytics routes — metrics, telemetry, conversion funnel
 *
 * Endpoints:
 *   POST /api/telemetry             — receive CLI usage events (fire-and-forget, always 200)
 *   POST /api/analytics/event       — record frontend funnel events
 *   GET  /api/analytics/summary     — aggregated metrics for operator dashboard
 *   GET  /api/analytics/npm-stats   — latest npm + GitHub traffic snapshot from data/metrics.json
 *   GET  /api/analytics/funnel      — funnel breakdown by day (last 30d)
 */
import type { FastifyInstance } from 'fastify';
import { createHash } from 'crypto';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getDb } from '../db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const METRICS_PATH = resolve(__dirname, '../../data/metrics.json');

const ALLOWED_FUNNEL_EVENTS = new Set([
  'free_limit_hit',
  'upgrade_clicked',
  'checkout_started',
  'checkout_completed',
  'pro_unlocked',
  'email_captured',
  'tool_used',
]);

function hashIp(ip: string): string {
  return createHash('sha256').update(ip).digest('hex');
}

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

function sevenDaysAgo(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
}

function thirtyDaysAgo(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

export function registerAnalyticsRoutes(app: FastifyInstance): void {

  // ── Lightweight ping — fire-and-forget per CLI run ────────────────────────
  // Receives { command, version, timestamp, anonymous_id } from CLI.
  // No PII. Maps anonymous_id → install_id for unique user counts.
  // Always returns 200 — never interrupt a CLI session.

  app.post('/api/ping', async (req) => {
    try {
      const body = req.body as Record<string, unknown> | null;
      const anonymousId = body?.anonymous_id ? String(body.anonymous_id).slice(0, 64) : null;
      if (!anonymousId) return { ok: true };

      const db = getDb();
      const b = body as Record<string, unknown>;
      db.prepare(`
        INSERT INTO cli_telemetry
          (install_id, event, command, version, platform, created_at)
        VALUES (?, 'ping', ?, ?, ?, CURRENT_TIMESTAMP)
      `).run(
        anonymousId,
        b.command ? String(b.command).slice(0, 64) : null,
        b.version ? String(b.version).slice(0, 32) : null,
        b.platform ? String(b.platform).slice(0, 32) : null,
      );
    } catch {
      // never fail — telemetry is non-critical
    }
    return { ok: true };
  });

  // ── Preflight Suite telemetry — fire-and-forget ping per CLI run ─────────
  // Accepts: { event, package, command, version, node_version, platform, anonymous_id }
  // No PII. Never stores IP addresses. Always returns 200.

  app.post('/telemetry', async (req) => {
    try {
      const body = req.body as Record<string, unknown> | null;
      const anonymousId = body?.anonymous_id ? String(body.anonymous_id).slice(0, 64) : null;
      if (!anonymousId) return { ok: true };

      const db = getDb();
      db.prepare(`
        INSERT INTO cli_telemetry
          (install_id, package, event, command, version, platform, node_version, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).run(
        anonymousId,
        body?.package ? String(body.package).slice(0, 64) : null,
        body?.event ? String(body.event).slice(0, 64) : 'command_run',
        body?.command ? String(body.command).slice(0, 64) : null,
        body?.version ? String(body.version).slice(0, 32) : null,
        body?.platform ? String(body.platform).slice(0, 32) : null,
        body?.node_version ? String(body.node_version).slice(0, 32) : null,
      );
    } catch {
      // never fail — telemetry is non-critical
    }
    return { ok: true };
  });

  // ── Preflight Suite telemetry/events — the endpoint all CLI tools point to ─
  // stepproof, agent-comply, agent-gate, agent-trace all POST here.
  // Accepts camelCase fields (installId, nodeVersion) as sent by the CLIs.
  // Always returns 200 — fire-and-forget compatible.

  app.post('/api/telemetry/events', async (req) => {
    try {
      const body = req.body as Record<string, unknown> | null;
      const installId = body?.installId ?? body?.install_id;
      if (!body || typeof installId !== 'string' || !installId) {
        return { ok: true };
      }

      const db = getDb();
      db.prepare(`
        INSERT INTO cli_telemetry
          (install_id, package, event, command, success, version, platform, node_version, exit_code, duration_ms, outcome)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        String(installId).slice(0, 64),
        body.package ? String(body.package).slice(0, 64) : null,
        body.event ? String(body.event).slice(0, 64) : 'run',
        body.command ? String(body.command).slice(0, 64) : null,
        typeof body.success === 'boolean' ? (body.success ? 1 : 0) : null,
        body.version ? String(body.version).slice(0, 32) : null,
        body.platform ? String(body.platform).slice(0, 32) : null,
        (body.nodeVersion ?? body.node_version) ? String(body.nodeVersion ?? body.node_version).slice(0, 32) : null,
        typeof body.exit_code === 'number' ? body.exit_code : null,
        typeof body.duration_ms === 'number' ? Math.round(body.duration_ms) : null,
        body.outcome ? String(body.outcome).slice(0, 64) : null,
      );
    } catch {
      // never fail — telemetry is non-critical
    }
    return { ok: true };
  });

  // ── CLI telemetry receiver ────────────────────────────────────────────────
  // Receives events from CLI users who have opted in to telemetry.
  // Always returns 200 — never interrupt a CLI session for analytics.

  app.post('/api/telemetry', async (req) => {
    try {
      const body = req.body as Record<string, unknown> | null;
      if (!body || typeof body.install_id !== 'string' || !body.install_id) {
        return { ok: true }; // silently accept malformed — never fail callers
      }

      const db = getDb();
      db.prepare(`
        INSERT INTO cli_telemetry
          (install_id, event, command, is_pro, duration_ms, success, exit_code, score, content_type, version, platform, node_version, run_count_bucket, tier, run_count)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        String(body.install_id).slice(0, 64),
        String(body.event ?? 'unknown').slice(0, 64),
        body.command ? String(body.command).slice(0, 64) : null,
        typeof body.is_pro === 'boolean' ? (body.is_pro ? 1 : 0) : null,
        typeof body.duration_ms === 'number' ? Math.round(body.duration_ms) : null,
        typeof body.success === 'boolean' ? (body.success ? 1 : 0) : null,
        typeof body.exit_code === 'number' ? body.exit_code : null,
        typeof body.score === 'number' ? body.score : null,
        body.content_type ? String(body.content_type).slice(0, 64) : null,
        body.version ? String(body.version).slice(0, 32) : null,
        body.platform ? String(body.platform).slice(0, 32) : null,
        body.nodeVersion ? String(body.nodeVersion).slice(0, 32) : null,
        body.run_count_bucket ? String(body.run_count_bucket).slice(0, 10) : null,
        body.tier ? String(body.tier).slice(0, 32) : null,
        typeof body.run_count === 'number' ? body.run_count : null,
      );
    } catch {
      // never fail — telemetry is non-critical
    }
    return { ok: true };
  });

  // ── Frontend funnel event recorder ───────────────────────────────────────
  // Tracks conversion funnel: free_limit_hit → upgrade_clicked → checkout_started → checkout_completed

  app.post('/api/analytics/event', async (req) => {
    const body = req.body as { event?: string; tool?: string; email?: string; metadata?: Record<string, unknown> } | null;
    const event = (body?.event ?? '').trim();

    if (!ALLOWED_FUNNEL_EVENTS.has(event)) {
      return { ok: false, error: 'Unknown event type' };
    }

    try {
      const db = getDb();
      const ipHash = hashIp(req.ip);
      const email = body?.email ? String(body.email).slice(0, 255).toLowerCase() : null;
      const tool = body?.tool ? String(body.tool).slice(0, 64) : null;
      const metadata = body?.metadata ? JSON.stringify(body.metadata).slice(0, 1000) : null;

      db.prepare(`
        INSERT INTO funnel_events (event, ip_hash, tool, email, metadata)
        VALUES (?, ?, ?, ?, ?)
      `).run(event, ipHash, tool, email, metadata);
    } catch {
      // silently accept — never fail the frontend
    }

    return { ok: true };
  });

  // ── Analytics summary ─────────────────────────────────────────────────────
  // Aggregated metrics for the operator dashboard.
  // Returns: funnel, cli commands, tool usage, conversions.

  app.get('/api/analytics/summary', async (_req, reply) => {
    try {
      const db = getDb();
      const since30 = thirtyDaysAgo();
      const since7 = sevenDaysAgo();
      const today = todayUTC();

      // Funnel: last 30 days
      const funnelRows = db.prepare(`
        SELECT event, COUNT(*) as count
        FROM funnel_events
        WHERE date(created_at) >= ?
        GROUP BY event
      `).all(since30) as { event: string; count: number }[];

      const funnel: Record<string, number> = {};
      for (const r of funnelRows) funnel[r.event] = r.count;

      // Conversion rate: upgrade_clicked → checkout_completed
      const upgradeClicked = funnel['upgrade_clicked'] ?? 0;
      const checkoutCompleted = funnel['checkout_completed'] ?? 0;
      const conversionRate = upgradeClicked > 0
        ? Math.round((checkoutCompleted / upgradeClicked) * 100)
        : 0;

      // CLI: unique installs, commands, success rate (last 30 days)
      const cliStats = db.prepare(`
        SELECT
          COUNT(DISTINCT install_id) as unique_installs,
          COUNT(*) as total_commands,
          SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful,
          SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failed,
          AVG(duration_ms) as avg_duration_ms
        FROM cli_telemetry
        WHERE date(created_at) >= ?
      `).get(since30) as {
        unique_installs: number;
        total_commands: number;
        successful: number;
        failed: number;
        avg_duration_ms: number | null;
      };

      // CLI: commands by type
      const commandBreakdown = db.prepare(`
        SELECT command, COUNT(*) as count, AVG(duration_ms) as avg_ms
        FROM cli_telemetry
        WHERE date(created_at) >= ? AND command IS NOT NULL
        GROUP BY command
        ORDER BY count DESC
      `).all(since30) as { command: string; count: number; avg_ms: number }[];

      // Tool usage from usage_tracking (web dashboard tools)
      const toolUsage7d = db.prepare(`
        SELECT endpoint, SUM(count) as total
        FROM usage_tracking
        WHERE date >= ?
        GROUP BY endpoint
        ORDER BY total DESC
      `).all(since7) as { endpoint: string; total: number }[];

      const toolUsage30d = db.prepare(`
        SELECT endpoint, SUM(count) as total
        FROM usage_tracking
        WHERE date >= ?
        GROUP BY endpoint
        ORDER BY total DESC
      `).all(since30) as { endpoint: string; total: number }[];

      // Daily active unique IPs (last 7 days, web tools)
      const dau7d = db.prepare(`
        SELECT date, COUNT(DISTINCT ip_hash) as unique_ips, SUM(count) as requests
        FROM usage_tracking
        WHERE date >= ?
        GROUP BY date
        ORDER BY date DESC
      `).all(since7) as { date: string; unique_ips: number; requests: number }[];

      // Today's usage
      const todayUsage = db.prepare(`
        SELECT SUM(count) as total, COUNT(DISTINCT ip_hash) as unique_ips
        FROM usage_tracking
        WHERE date = ?
      `).get(today) as { total: number; unique_ips: number } | undefined;

      // Email captures (leads)
      const emailCaptures = db.prepare(`
        SELECT COUNT(*) as total, COUNT(DISTINCT email) as unique_emails
        FROM email_captures
        WHERE date(created_at) >= ?
      `).get(since30) as { total: number; unique_emails: number };

      // CLI conversion funnel — how many times each conversion event fired from the CLI
      const cliConversionRows = db.prepare(`
        SELECT event, COUNT(*) as count, COUNT(DISTINCT install_id) as unique_installs
        FROM cli_telemetry
        WHERE date(created_at) >= ?
          AND event IN ('free_limit_hit', 'upgrade_prompt_shown')
        GROUP BY event
      `).all(since30) as { event: string; count: number; unique_installs: number }[];

      const cliConversion: Record<string, { count: number; unique_installs: number }> = {};
      for (const r of cliConversionRows) {
        cliConversion[r.event] = { count: r.count, unique_installs: r.unique_installs };
      }

      // Daily CLI conversion trend (last 7d) — shows upgrade prompt impression volume
      const cliConversionTrend = db.prepare(`
        SELECT date(created_at) as date, event, COUNT(*) as count
        FROM cli_telemetry
        WHERE date(created_at) >= ?
          AND event IN ('free_limit_hit', 'upgrade_prompt_shown')
        GROUP BY date(created_at), event
        ORDER BY date(created_at) DESC
      `).all(sevenDaysAgo()) as { date: string; event: string; count: number }[];

      return {
        period: { from: since30, to: today },
        funnel: {
          events: funnel,
          conversion_rate_pct: conversionRate,
          free_limit_hits_30d: funnel['free_limit_hit'] ?? 0,
          upgrade_clicks_30d: upgradeClicked,
          checkout_completions_30d: checkoutCompleted,
        },
        cli: {
          unique_installs_30d: cliStats?.unique_installs ?? 0,
          total_commands_30d: cliStats?.total_commands ?? 0,
          success_rate_pct: cliStats?.total_commands > 0
            ? Math.round(((cliStats.successful ?? 0) / cliStats.total_commands) * 100)
            : 0,
          avg_duration_ms: cliStats?.avg_duration_ms ? Math.round(cliStats.avg_duration_ms) : null,
          command_breakdown: commandBreakdown,
          conversion: {
            free_limit_hits_30d: cliConversion['free_limit_hit']?.count ?? 0,
            free_limit_unique_installs_30d: cliConversion['free_limit_hit']?.unique_installs ?? 0,
            upgrade_prompts_shown_30d: cliConversion['upgrade_prompt_shown']?.count ?? 0,
            upgrade_prompt_unique_installs_30d: cliConversion['upgrade_prompt_shown']?.unique_installs ?? 0,
            trend_7d: cliConversionTrend,
          },
        },
        web: {
          tool_usage_7d: toolUsage7d,
          tool_usage_30d: toolUsage30d,
          daily_active_users_7d: dau7d,
          today: {
            total_requests: todayUsage?.total ?? 0,
            unique_ips: todayUsage?.unique_ips ?? 0,
          },
        },
        leads: {
          email_captures_30d: emailCaptures?.total ?? 0,
          unique_emails_30d: emailCaptures?.unique_emails ?? 0,
        },
        generated_at: new Date().toISOString(),
      };
    } catch (err) {
      reply.status(500);
      return { error: 'Failed to fetch analytics', detail: String(err) };
    }
  });

  // ── npm + GitHub traffic snapshot ─────────────────────────────────────────
  // Reads data/metrics.json written by scripts/metrics.js (npm + GitHub API).
  // Returns the latest snapshot (last entry in the array), or a 204 if no data yet.

  app.get('/api/analytics/npm-stats', async (_req, reply) => {
    try {
      if (!existsSync(METRICS_PATH)) {
        reply.status(204);
        return { message: 'No metrics snapshot yet. Run: npm run metrics' };
      }
      const raw = readFileSync(METRICS_PATH, 'utf8').trim();
      if (!raw) {
        reply.status(204);
        return { message: 'Metrics file is empty.' };
      }
      const snapshots: unknown[] = JSON.parse(raw);
      if (!Array.isArray(snapshots) || snapshots.length === 0) {
        reply.status(204);
        return { message: 'No snapshots in metrics file.' };
      }
      // Return latest snapshot + history summary
      const latest = snapshots[snapshots.length - 1] as Record<string, unknown>;
      return {
        latest,
        snapshot_count: snapshots.length,
        oldest_snapshot: (snapshots[0] as Record<string, unknown>).timestamp ?? null,
        newest_snapshot: latest.timestamp ?? null,
      };
    } catch (err) {
      reply.status(500);
      return { error: 'Failed to read metrics snapshot', detail: String(err) };
    }
  });

  // ── Recent funnel events (for debugging/operator view) ────────────────────

  app.get('/api/analytics/funnel', async (_req, reply) => {
    try {
      const db = getDb();
      const rows = db.prepare(`
        SELECT event, tool, date(created_at) as date, COUNT(*) as count
        FROM funnel_events
        WHERE date(created_at) >= ?
        GROUP BY event, tool, date(created_at)
        ORDER BY date(created_at) DESC, event
      `).all(thirtyDaysAgo()) as { event: string; tool: string; date: string; count: number }[];

      return { funnel_by_day: rows };
    } catch (err) {
      reply.status(500);
      return { error: String(err) };
    }
  });

  // ── npm download stats (proxied from npm registry) ────────────────────────
  // Fetches public download counts for the content-grade npm package.
  // Cached server-side for 1 hour to avoid hammering the npm API.

  let _npmCache: { data: unknown; fetchedAt: number } | null = null;
  const NPM_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

  app.get('/api/analytics/npm-downloads', async (_req, reply) => {
    try {
      const now = Date.now();
      if (_npmCache && (now - _npmCache.fetchedAt) < NPM_CACHE_TTL_MS) {
        return _npmCache.data;
      }

      const [lastWeek, lastMonth, lastYear] = await Promise.all([
        fetch('https://api.npmjs.org/downloads/point/last-week/content-grade').then(r => r.json()).catch(() => null),
        fetch('https://api.npmjs.org/downloads/point/last-month/content-grade').then(r => r.json()).catch(() => null),
        fetch('https://api.npmjs.org/downloads/point/last-year/content-grade').then(r => r.json()).catch(() => null),
      ]);

      // Daily breakdown for the last 30 days
      const daily = await fetch('https://api.npmjs.org/downloads/range/last-month/content-grade')
        .then(r => r.json())
        .catch(() => null);

      const result = {
        last_week: lastWeek?.downloads ?? null,
        last_month: lastMonth?.downloads ?? null,
        last_year: lastYear?.downloads ?? null,
        daily_30d: daily?.downloads ?? [],
        fetched_at: new Date().toISOString(),
      };

      _npmCache = { data: result, fetchedAt: now };
      return result;
    } catch (err) {
      reply.status(500);
      return { error: 'Failed to fetch npm stats', detail: String(err) };
    }
  });
}
