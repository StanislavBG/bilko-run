import type { FastifyInstance } from 'fastify';
import { dbAll } from '../db.js';
import { requireAdmin } from '../clerk.js';

interface RunRow {
  slug: string;
  ok: number;
  http_status: number | null;
  load_ms: number | null;
  error_msg: string | null;
  ran_at: number;
  date_str: string;
}

interface AlertRow {
  slug: string;
  first_failed_at: number;
  notified_at: number | null;
}

export function registerSyntheticRoutes(app: FastifyInstance): void {
  app.get('/api/admin/synthetic/grid', async (req, reply) => {
    const email = await requireAdmin(req, reply);
    if (!email) return;

    const daysParam = parseInt((req.query as any).days ?? '30', 10);
    const days = Math.min(Math.max(daysParam, 1), 90);
    const since = Math.floor(Date.now() / 1000) - days * 86400;

    const [runs, alerts, manifests] = await Promise.all([
      dbAll<RunRow>(
        `SELECT slug, ok, http_status, load_ms, error_msg, ran_at,
                date(ran_at, 'unixepoch') as date_str
         FROM synthetic_runs
         WHERE ran_at >= ?
         ORDER BY slug, ran_at DESC`,
        since,
      ),
      dbAll<AlertRow>(
        `SELECT slug, first_failed_at, notified_at
         FROM synthetic_alerts
         WHERE resolved_at IS NULL`,
      ),
      dbAll<{ slug: string }>(
        `SELECT slug FROM app_manifests ORDER BY slug`,
      ),
    ]);

    // Build slug → runs map
    const slugRuns = new Map<string, RunRow[]>();
    for (const r of runs) {
      const list = slugRuns.get(r.slug) ?? [];
      list.push(r);
      slugRuns.set(r.slug, list);
    }

    const alertMap = new Map(alerts.map(a => [a.slug, a]));
    const allSlugs = Array.from(new Set([...manifests.map(m => m.slug), ...slugRuns.keys()]));

    const grid = allSlugs.map(slug => {
      const slugRunList = slugRuns.get(slug) ?? [];

      // Collapse runs per day — day is ok if any run that day was ok
      const dayMap = new Map<string, { ok: boolean; loadMs: number | null; error: string | null }>();
      for (const r of slugRunList) {
        const existing = dayMap.get(r.date_str);
        if (!existing) {
          dayMap.set(r.date_str, { ok: r.ok === 1, loadMs: r.load_ms ?? null, error: r.error_msg ?? null });
        } else if (r.ok === 1 && !existing.ok) {
          dayMap.set(r.date_str, { ok: true, loadMs: r.load_ms ?? null, error: null });
        }
      }

      // Generate ordered day cells oldest→newest
      const dayGrid: Array<{ date: string; ok: boolean | null; loadMs: number | null; error: string | null }> = [];
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000);
        const dateStr = d.toISOString().slice(0, 10);
        const cell = dayMap.get(dateStr);
        dayGrid.push({ date: dateStr, ok: cell?.ok ?? null, loadMs: cell?.loadMs ?? null, error: cell?.error ?? null });
      }

      // Consecutive failure streak from most-recent runs
      let streak = 0;
      for (const r of slugRunList) {
        if (r.ok === 0) streak++;
        else break;
      }

      // Latency percentiles
      const latencies = slugRunList.map(r => r.load_ms ?? 0).filter(v => v > 0).sort((a, b) => a - b);
      const p50 = latencies.length ? latencies[Math.floor(latencies.length * 0.5)] : null;
      const p95 = latencies.length ? latencies[Math.floor(latencies.length * 0.95)] : null;

      const latest = slugRunList[0] ?? null;
      const alert = alertMap.get(slug);

      return {
        slug,
        dayGrid,
        streak,
        p50,
        p95,
        latestOk: latest ? latest.ok === 1 : null,
        latestError: latest?.error_msg ?? null,
        latestRanAt: latest?.ran_at ?? null,
        alert: alert
          ? { firstFailedAt: alert.first_failed_at, notifiedAt: alert.notified_at }
          : null,
      };
    });

    return reply.send({ grid, days });
  });
}
