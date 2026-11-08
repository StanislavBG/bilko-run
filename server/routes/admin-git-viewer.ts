import type { FastifyInstance } from 'fastify';
import { dbAll, dbGet } from '../db.js';
import { requireAdmin } from '../clerk.js';
import { GIT_VIEWER_TIER } from '../services/stripe.js';
import { BUILT_BY, SHOWCASE_LOGINS, type BuiltBy } from './tools/git-viewer.js';

// GET /api/admin/git-viewer/profiles: hosted Git Viewer portfolios (git_viewer_profiles, written by
// server/routes/tools/git-viewer.ts) and git_viewer subscriptions in one read, so "how many portfolios did
// someone else build, and how many subscriptions exist" needs no forensic pass. A GET, so the read-only admin
// API key works: the bilko-host git_viewer_report tool calls it.
//
// Built means a non-empty payload (LENGTH(payload) > 0, never the payload itself). updated_at cannot tell:
// a claim's placeholder has updated_at 0 and payload '', but the 2026-10-14 free-tier migration
// (server/db.ts) also zeroed updated_at on every cached free row, built ones included.
//
//   totals         every row except the SHOWCASE_LOGINS (the owner's own portfolio, which the refresh loop
//                  keeps built whether or not anyone asked, at the paid tier when GITHUB_TOKEN is set): all,
//                  built/neverBuilt, byTier, claimed/unclaimed, byBuiltBy { owner, automation, visitor,
//                  unknown } and showcaseStamped (rows stamped 'showcase' whose login has since left
//                  SHOWCASE_LOGINS). The exclusion is by login, not by built_by. unknown is NULL built_by,
//                  i.e. rows built before the 12:07 AM PST 2026-11-08 deploy that started stamping it.
//   showcase       the SHOWCASE_LOGINS rows themselves: { logins, rows, built }.
//   subscriptions  stripe_subscriptions rows with plan_tier GIT_VIEWER_TIER: active (status 'active', as
//                  hasGitViewerSubscriptionDb reads it) and total. Nothing is excluded here.
//   rows           every login, the showcase ones flagged, newest first by created_at (rows with no
//                  created_at last, most recently updated first), at most ROW_LIMIT, each with built. Dates are
//                  ISO; a 0 or NULL date is null (updatedAt null: updated_at 0, a claim placeholder or a free
//                  row zeroed on 2026-10-14; built tells them apart).
//
// owner_email, payload and allowlist are never selected: claimed and built are computed in SQL, so no email or
// payload can leave.

const ROW_LIMIT = 500;

/** A claimed row has an owner (the claim route sets owner_email; tierFor and the IP-limit exemption test it the same way). */
const CLAIMED_SQL = "(owner_email IS NOT NULL AND owner_email <> '')";
/** A built row has a portfolio payload; selected as a length so the payload itself never leaves SQLite. */
const BUILT_SQL = '(COALESCE(LENGTH(payload), 0) > 0)';

interface TotalsRow {
  all_rows: number;
  built: number;
  free: number;
  paid: number;
  claimed: number;
  owner: number;
  automation: number;
  visitor: number;
  showcase: number;
}

interface ShowcaseRow {
  all_rows: number;
  built: number;
}

interface ProfileListRow {
  login: string;
  tier: 'free' | 'paid';
  claimed: number;
  built: number;
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
    const marks = showcase.map(() => '?').join(', ');
    const notShowcase = showcase.length ? `WHERE LOWER(login) NOT IN (${marks})` : '';
    const [t, sc, subs, rows] = await Promise.all([
      dbGet<TotalsRow>(
        `SELECT COUNT(*) AS all_rows,
                COUNT(CASE WHEN ${BUILT_SQL} THEN 1 END) AS built,
                COUNT(CASE WHEN tier = 'free' THEN 1 END) AS free,
                COUNT(CASE WHEN tier = 'paid' THEN 1 END) AS paid,
                COUNT(CASE WHEN ${CLAIMED_SQL} THEN 1 END) AS claimed,
                COUNT(CASE WHEN built_by = 'owner' THEN 1 END) AS owner,
                COUNT(CASE WHEN built_by = 'automation' THEN 1 END) AS automation,
                COUNT(CASE WHEN built_by = 'visitor' THEN 1 END) AS visitor,
                COUNT(CASE WHEN built_by = 'showcase' THEN 1 END) AS showcase
           FROM git_viewer_profiles ${notShowcase}`,
        ...showcase,
      ),
      showcase.length
        ? dbGet<ShowcaseRow>(
          `SELECT COUNT(*) AS all_rows, COUNT(CASE WHEN ${BUILT_SQL} THEN 1 END) AS built
             FROM git_viewer_profiles WHERE LOWER(login) IN (${marks})`,
          ...showcase,
        )
        : Promise.resolve(undefined),
      dbGet<{ active: number; total: number }>(
        `SELECT COUNT(CASE WHEN status = 'active' THEN 1 END) AS active, COUNT(*) AS total
           FROM stripe_subscriptions WHERE plan_tier = ?`,
        GIT_VIEWER_TIER,
      ),
      dbAll<ProfileListRow>(
        `SELECT login, tier, ${CLAIMED_SQL} AS claimed, ${BUILT_SQL} AS built, built_by, created_at, updated_at
           FROM git_viewer_profiles
          ORDER BY COALESCE(created_at, 0) = 0, created_at DESC, updated_at DESC, login
          LIMIT ?`,
        ROW_LIMIT,
      ),
    ]);

    const all = Number(t?.all_rows ?? 0);
    const built = Number(t?.built ?? 0);
    const claimed = Number(t?.claimed ?? 0);
    const byBuiltBy = {
      owner: Number(t?.owner ?? 0),
      automation: Number(t?.automation ?? 0),
      visitor: Number(t?.visitor ?? 0),
    };
    const showcaseStamped = Number(t?.showcase ?? 0);
    const known = byBuiltBy.owner + byBuiltBy.automation + byBuiltBy.visitor + showcaseStamped;
    return {
      totals: {
        all,
        built,
        neverBuilt: all - built,
        byTier: { free: Number(t?.free ?? 0), paid: Number(t?.paid ?? 0) },
        claimed,
        unclaimed: all - claimed,
        byBuiltBy: { ...byBuiltBy, unknown: all - known },
        showcaseStamped,
      },
      showcase: { logins: showcase.length, rows: Number(sc?.all_rows ?? 0), built: Number(sc?.built ?? 0) },
      subscriptions: { active: Number(subs?.active ?? 0), total: Number(subs?.total ?? 0) },
      rows: rows.map((r) => ({
        login: r.login,
        tier: r.tier,
        built: Number(r.built) === 1,
        claimed: Number(r.claimed) === 1,
        showcase: showcase.includes(String(r.login).toLowerCase()),
        builtBy: isBuiltBy(r.built_by) ? r.built_by : null,
        createdAt: isoOrNull(r.created_at),
        updatedAt: isoOrNull(r.updated_at),
      })),
    };
  });
}
