import type { FastifyInstance } from 'fastify';
import { dbAll, dbGet } from '../db.js';
import { requireAdmin } from '../clerk.js';
import { GIT_VIEWER_TIER } from '../services/stripe.js';
import { SHOWCASE_LOGINS } from './tools/git-viewer.js';

// GET /api/admin/git-viewer/profiles: hosted Git Viewer portfolios (git_viewer_profiles, written by
// server/routes/tools/git-viewer.ts) and git_viewer subscriptions in one read, so "how many portfolios did
// someone else build, and how many subscriptions exist" needs no forensic pass. A GET, so the read-only admin
// API key works: the bilko-host git_viewer_report tool calls it.
//
//   totals         every row except the SHOWCASE_LOGINS (the owner's own portfolio, which the refresh loop
//                  keeps built whether or not anyone asked, at the paid tier when GITHUB_TOKEN is set): all,
//                  byTier, claimed/unclaimed, byBuiltBy. The exclusion is by login, not by built_by. unknown
//                  is NULL built_by, i.e. rows built before 2026-11-07.
//   subscriptions  stripe_subscriptions rows with plan_tier GIT_VIEWER_TIER: active (status 'active', as
//                  hasGitViewerSubscriptionDb reads it) and total. Nothing is excluded here.
//   rows           every login, the showcase ones flagged, newest first by created_at (rows with no
//                  created_at last, most recently updated first), at most ROW_LIMIT. Dates are ISO; a 0 or
//                  NULL date is null (updated_at 0 is a claim placeholder that was never built).
//
// owner_email, payload and allowlist are never selected: claimed is computed in SQL, so no email can leave.

const ROW_LIMIT = 500;
const BUILT_BY = ['owner', 'automation', 'visitor', 'showcase'] as const;
type BuiltBy = (typeof BUILT_BY)[number];

/** A claimed row has an owner (the claim route sets owner_email; tierFor and the IP-limit exemption test it the same way). */
const CLAIMED_SQL = "(owner_email IS NOT NULL AND owner_email <> '')";

interface TotalsRow {
  all_rows: number;
  free: number;
  paid: number;
  claimed: number;
  owner: number;
  automation: number;
  visitor: number;
  showcase: number;
}

interface ProfileListRow {
  login: string;
  tier: 'free' | 'paid';
  claimed: number;
  built_by: string | null;
  created_at: number | null;
  updated_at: number | null;
}

function isBuiltBy(v: unknown): v is BuiltBy {
  return typeof v === 'string' && (BUILT_BY as readonly string[]).includes(v);
}

/** Unix seconds as an ISO string; null for 0, NULL or anything that is not a real time. */
function isoOrNull(sec: unknown): string | null {
  const n = Number(sec);
  if (sec == null || !Number.isFinite(n) || n <= 0) return null;
  const d = new Date(n * 1000);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function registerAdminGitViewerRoutes(app: FastifyInstance): void {
  app.get('/api/admin/git-viewer/profiles', async (req, reply) => {
    if (!await requireAdmin(req, reply)) return;
    reply.header('Cache-Control', 'no-store');

    const showcase = SHOWCASE_LOGINS.map((l) => l.toLowerCase());
    const notShowcase = showcase.length ? `WHERE LOWER(login) NOT IN (${showcase.map(() => '?').join(', ')})` : '';
    const t = await dbGet<TotalsRow>(
      `SELECT COUNT(*) AS all_rows,
              COUNT(CASE WHEN tier = 'free' THEN 1 END) AS free,
              COUNT(CASE WHEN tier = 'paid' THEN 1 END) AS paid,
              COUNT(CASE WHEN ${CLAIMED_SQL} THEN 1 END) AS claimed,
              COUNT(CASE WHEN built_by = 'owner' THEN 1 END) AS owner,
              COUNT(CASE WHEN built_by = 'automation' THEN 1 END) AS automation,
              COUNT(CASE WHEN built_by = 'visitor' THEN 1 END) AS visitor,
              COUNT(CASE WHEN built_by = 'showcase' THEN 1 END) AS showcase
         FROM git_viewer_profiles ${notShowcase}`,
      ...showcase,
    );
    const subs = await dbGet<{ active: number; total: number }>(
      `SELECT COUNT(CASE WHEN status = 'active' THEN 1 END) AS active, COUNT(*) AS total
         FROM stripe_subscriptions WHERE plan_tier = ?`,
      GIT_VIEWER_TIER,
    );
    const rows = await dbAll<ProfileListRow>(
      `SELECT login, tier, ${CLAIMED_SQL} AS claimed, built_by, created_at, updated_at
         FROM git_viewer_profiles
        ORDER BY COALESCE(created_at, 0) = 0, created_at DESC, updated_at DESC, login
        LIMIT ?`,
      ROW_LIMIT,
    );

    const all = Number(t?.all_rows ?? 0);
    const claimed = Number(t?.claimed ?? 0);
    const byBuiltBy = {
      owner: Number(t?.owner ?? 0),
      automation: Number(t?.automation ?? 0),
      visitor: Number(t?.visitor ?? 0),
      showcase: Number(t?.showcase ?? 0),
    };
    const known = byBuiltBy.owner + byBuiltBy.automation + byBuiltBy.visitor + byBuiltBy.showcase;
    return {
      totals: {
        all,
        byTier: { free: Number(t?.free ?? 0), paid: Number(t?.paid ?? 0) },
        claimed,
        unclaimed: all - claimed,
        byBuiltBy: { ...byBuiltBy, unknown: all - known },
      },
      subscriptions: { active: Number(subs?.active ?? 0), total: Number(subs?.total ?? 0) },
      rows: rows.map((r) => ({
        login: r.login,
        tier: r.tier,
        claimed: Number(r.claimed) === 1,
        showcase: showcase.includes(String(r.login).toLowerCase()),
        builtBy: isBuiltBy(r.built_by) ? r.built_by : null,
        createdAt: isoOrNull(r.created_at),
        updatedAt: isoOrNull(r.updated_at),
      })),
    };
  });
}
