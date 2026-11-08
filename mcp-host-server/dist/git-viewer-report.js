// git_viewer_report: hosted Git Viewer portfolios and git_viewer subscriptions in one call, read through the bilko.run
// admin API. The host route (server/routes/admin-git-viewer.ts) decides what the totals leave out and never sends an
// email; this tool passes its body through with the base URL it queried.
import { adminGet, baseUrl } from './errors-report.js';
import { ADMIN_KEY } from './report-tools.js';
import { ok, err } from './tool-result.js';
export const GIT_VIEWER_PROFILES_PATH = '/api/admin/git-viewer/profiles';
/** GET /api/admin/git-viewer/profiles with the admin key: the host's body plus `source`, the base URL queried. */
export async function gitViewerReport() {
    const body = await adminGet(GIT_VIEWER_PROFILES_PATH);
    if (!body)
        throw new Error(`bilko.run returned 404 for ${GIT_VIEWER_PROFILES_PATH}`);
    const b = (typeof body === 'object' ? body : {});
    return { source: baseUrl(), ...b };
}
export function registerGitViewerReportTool(server) {
    // 14) git_viewer_report ────────────────────────────────────────────────
    server.registerTool('git_viewer_report', {
        title: 'Git Viewer portfolios and subscriptions',
        description: `Read-only. Calls the bilko.run admin API (GET ${GIT_VIEWER_PROFILES_PATH}) ${ADMIN_KEY}. Returns the hosted Git Viewer portfolios (git_viewer_profiles) and the git_viewer subscriptions in one call. ` +
            '`totals`: all, byTier { free, paid }, claimed, unclaimed and byBuiltBy { owner, automation, visitor, showcase, unknown }. ' +
            "Excluded from totals: the showcase logins (SHOWCASE_LOGINS in the host's server/routes/tools/git-viewer.ts, the owner's own portfolio, which the host keeps built whether or not anyone asked), matched by login. Nothing else is excluded: the owner's and automation's builds are counted and split out in byBuiltBy " +
            "(owner: first built by an admin account or one of the owner's devices; automation: by a non-human user agent or a device with a bot page view in the last 24h; visitor: anyone else; showcase: seeded by the refresh loop; unknown: built before 2026-11-07, when the class was first stamped). " +
            '`subscriptions`: { active, total } over every stripe_subscriptions row with plan_tier git_viewer; active means status active. Nothing is excluded, the owner\'s own subscriptions included. ' +
            '`rows`: every portfolio, the showcase logins included and flagged showcase: true, as { login, tier, claimed, showcase, builtBy, createdAt, updatedAt }, newest first by createdAt (rows without one last), at most 500. Dates are ISO; null means unset (updatedAt null: claimed but never built). ' +
            'Never returns an email, a portfolio payload or a repo allowlist. The top-level `source` field is the base URL queried.',
        inputSchema: {},
    }, async () => {
        try {
            return ok(JSON.stringify(await gitViewerReport(), null, 2));
        }
        catch (e) {
            return err(e.message);
        }
    });
}
