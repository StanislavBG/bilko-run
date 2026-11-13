// The visitor-analytics report tools: traffic_report, funnel_report, flows_report and sessions_report. Siblings read
// their funnels through these, so each one counts real visitors by default (the owner and automation left out), names
// exactly what it excludes, and has a raw opt-out. The exclusions themselves live in the host: server/traffic-filters.ts,
// server/routes/admin-sessions.ts, server/routes/admin-observability.ts and server/routes/admin-funnel.ts.
// flows_report also counts prod telemetry only (env=prod) unless asked; that filter is server/routes/telemetry.ts.

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { baseUrl, trafficReport, funnelReport, flowsReport, sessionsReport, sessionDetail, SESSION_ID_RE } from './errors-report.js';
import { ok, err } from './tool-result.js';

export const ADMIN_KEY = 'with the admin key (BILKO_ADMIN_KEY or ~/.config/bilko-host/admin-key)';
const APP_SLUG = /^[a-z0-9][a-z0-9._-]{0,59}$/i;

/** Who mine=exclude drops. */
const OWNER =
  "the owner: rows flagged is_admin (signed in as admin), every device seen signed in as admin in the last 30 days, every device marked as the owner's on /admin/secrets (any age), and every row sent with the bilko_internal marker (cookie or ?bilko_internal=1, see the host contract's Internal traffic marker)";

/** What bots=exclude drops on /api/admin/flows and /api/admin/sessions. */
const BOTS =
  "UA-flagged automation: page views and clicks whose user agent is a crawler, script, AI agent or API client (HeadlessChrome and Playwright included) or whose browser reported navigator.webdriver, and telemetry events and errors whose request user agent is not a person's browser (the telemetry UA class)";

/** Which sessions mine=exclude drops on /api/admin/sessions. */
const OWNER_SESSIONS =
  "every session with a signed-in admin (is_admin) page view, or from a device seen signed in as admin in the last 30 days or marked as the owner's on /admin/secrets (any age), or with a page view sent with the bilko_internal marker";

const NOT_CAUGHT =
  'Automation that shows a normal browser user agent without navigator.webdriver, on a device never signed in as admin or marked, still counts unless it sends the bilko_internal marker (docs/host-contract.md#internal-traffic-marker).';

const ECHO =
  '`filters` echoes what the host applied ({ mine, bots }); null means a host older than these filters, which applied neither.';

/**
 * What flows_report's env filter keeps (server/routes/telemetry.ts envPredicate) and where a record's env comes from
 * (packages/host-kit/src/telemetry.ts resolveEnv).
 */
const ENV_FILTER =
  'env defaults to prod and is always sent (env=prod), so local dev and automated test runs stay out. ' +
  'host-kit 0.11.0+ stamps every telemetry record with env: prod on bilko.run (automation there included, left to the bots filter); anywhere else, test when the browser reports navigator.webdriver (Playwright and other automation runs) and dev otherwise (localhost and other dev servers). ' +
  'Rows without env, from host-kit before 0.11.0 and other clients, count as prod, so localhost runs on an older host-kit still count until it is upgraded. ' +
  "env: 'dev' or 'test' counts only that env; env: 'all' turns the filter off. " +
  'env covers telemetry events, errors and flow steps; page views and clicks carry no env (only the bilko.run beacon writes them).';

const FLOWS_ECHO =
  '`filters` echoes what the host applied ({ mine, bots, env }). An echo without env means a host older than the env filter, which counted every env; null means a host older than all three filters, which applied none.';

const SOURCE = 'The top-level `source` field is the base URL queried.';

export function registerReportTools(server: McpServer): void {
  // 10) traffic_report ───────────────────────────────────────────────────
  server.registerTool(
    'traffic_report',
    {
      title: 'Visitor traffic report',
      description:
        `Read-only. Calls the bilko.run admin API (GET /api/admin/traffic) ${ADMIN_KEY}. Returns, for a trailing window: human vs bot visitors and hits, human visitors seen only once (undeclared-bot/bounce signal), bilko_vid cookie uniques, per-page and per-project hits + uniques, a per-visitor-class breakdown (\`byClass\`, \`topPagesByClass\`: human, search_crawler, ai_crawler, ai_user_agent, api_client, script), top referrers, countries, devices, and the date each metric became valid. ` +
        'Visitors are a salted IP+user-agent hash, not a cookie. Per-visitor IP/UA/email rows are omitted. ' +
        '`visitors.confirmed` counts human visitors whose browser ran the page script or kept the bilko_vid cookie, and `visitors.unverified` is the rest of `visitors.human` (both null from an older host). ' +
        `excludeSelf defaults to true and sends mine=exclude, which drops ${OWNER} from every count; excludeSelf: false sends mine=include. ` +
        'includeBots defaults to true and sends bots=include, because the human aggregates already exclude bot hits (UA-flagged, HeadlessChrome/Playwright included, or re-flagged after a navigator.webdriver page view); includeBots: false sends bots=exclude, which only trims byClass/topPagesByClass to the non-bot classes. ' +
        "`window` echoes the request. `filters` echoes what the host applied ({ mine, bots, mineHits: the owner's human hits in the window }); null from a host older than these filters. " +
        SOURCE,
      inputSchema: {
        days: z.number().int().positive().default(30).describe('Trailing window in days. Default 30 (host caps at 90).'),
        slug: z.string().optional().describe('Restrict to one /projects/<slug>/ app.'),
        excludeSelf: z
          .boolean()
          .default(true)
          .describe("Drop the owner's own traffic (sends mine=exclude). Default true; false sends mine=include."),
        includeBots: z
          .boolean()
          .default(true)
          .describe(
            'Keep the bot classes in byClass/topPagesByClass (sends bots=include). Default true; false sends bots=exclude. The human aggregates exclude bots either way.',
          ),
      },
    },
    async ({ days, slug, excludeSelf, includeBots }) => {
      try {
        return ok(JSON.stringify(await trafficReport({ days, slug, excludeSelf, includeBots }), null, 2));
      } catch (e: unknown) {
        return err((e as Error).message);
      }
    },
  );

  // 11) funnel_report ────────────────────────────────────────────────────
  server.registerTool(
    'funnel_report',
    {
      title: 'Per-UTM revenue funnel',
      description:
        `Read-only. Calls the bilko.run admin API (GET /api/admin/funnel) ${ADMIN_KEY}. Returns, for sessions since a date that landed with the given utm_source or viewed a page tagged with it (in-site links such as utm_source=session-manager): visits (sessions), sign_ins, checkout_start, paid (visitors), booked (paid service bookings) and free_hours_booked (free-hour bookings, never part of booked). ` +
        "The owner and bots are always excluded, as the host does by default (this tool sends neither exclude_self=0 nor include_bots=1, so there is no opt-out): sessions with a signed-in admin (is_admin) page view, sessions from a device seen signed in as admin in the last 30 days or marked as the owner's on /admin/secrets (by bilko_vid cookie id), the owner's own checkout_start and free-hour events, anything under an admin email (sessions, sign-ins, orders, bookings), and sessions with a bot-flagged page view (UA-flagged, HeadlessChrome/Playwright included, or navigator.webdriver). " +
        SOURCE,
      inputSchema: {
        utmSource: z.string().min(1).describe('utm_source to attribute, e.g. "burrow".'),
        since: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('Start date YYYY-MM-DD (UTC). Host default: 7 days ago.'),
      },
    },
    async ({ utmSource, since }) => {
      try {
        return ok(JSON.stringify(await funnelReport({ utmSource, since }), null, 2));
      } catch (e: unknown) {
        return err((e as Error).message);
      }
    },
  );

  // 12) flows_report ─────────────────────────────────────────────────────
  server.registerTool(
    'flows_report',
    {
      title: 'Per-app flows',
      description:
        `Read-only. Calls the bilko.run admin API (GET /api/admin/flows) ${ADMIN_KEY}. Returns per-app sessions, views, clicks, events and errors, and per-flow step counts, so a sibling can see page- or lesson-level drop-off. ` +
        'Counts real visitors by default: it sends mine=exclude&bots=exclude. ' +
        `mine=exclude drops ${OWNER}, plus events and errors from any session with an admin page view. ` +
        `bots=exclude drops ${BOTS}, plus events and errors from any session with a bot-flagged page view. ` +
        'Opt-outs: includeMine: true sends mine=include and includeBots: true sends bots=include (both default false). ' +
        `${ENV_FILTER} ${NOT_CAUGHT} ${FLOWS_ECHO} ${SOURCE}`,
      inputSchema: {
        days: z.number().int().min(1).max(30).optional().describe('Window in days (1-30). Host default 7.'),
        app: z.string().regex(APP_SLUG).optional().describe('Limit to one app slug, e.g. "academy".'),
        includeMine: z
          .boolean()
          .default(false)
          .describe("Count the owner's own sessions (sends mine=include). Default false: mine=exclude."),
        includeBots: z
          .boolean()
          .default(false)
          .describe('Count UA-flagged automation (sends bots=include). Default false: bots=exclude.'),
        env: z
          .enum(['prod', 'dev', 'test', 'all'])
          .default('prod')
          .describe(
            "Telemetry env to count (sends env=<value>). Default prod: rows tagged prod plus rows without env. 'dev' or 'test' reads only that env; 'all' turns the filter off.",
          ),
      },
    },
    async ({ days, app, includeMine, includeBots, env }) => {
      try {
        return ok(JSON.stringify(await flowsReport({ days, app, includeMine, includeBots, env }), null, 2));
      } catch (e: unknown) {
        return err((e as Error).message);
      }
    },
  );

  // 13) sessions_report ──────────────────────────────────────────────────
  server.registerTool(
    'sessions_report',
    {
      title: 'Per-session audit',
      description:
        `Read-only. Calls the bilko.run admin API (GET /api/admin/sessions, and GET /api/admin/sessions/:id for timelines) ${ADMIN_KEY}. ` +
        "Lists the newest sessions in the window, each with session_id, visitor_id, started_at, ended_at, duration_ms, landing_path, exit_path, page_count, source_bucket, referrer_host, utm_*, country, device, converted, purchased, click/event/error counts, apps, and the host's mine and bot flags. " +
        "timeline: true adds each listed session's timeline (at most 50 sessions, fetched 5 at a time). A listed session whose legacy id is not a UUID keeps its row with timeline: [] and a timeline_note. sessionId returns that one session and its timeline instead of a list. " +
        'Timeline items: view (path, referrer_host), click (path, label, href, track_name), event (name, app, path, props), error (app, name, msg). ' +
        `Counts real visitors by default, as flows_report does: it sends mine=exclude&bots=exclude. mine=exclude drops the owner: ${OWNER_SESSIONS}. ` +
        `bots=exclude drops every session with a bot-flagged page view, event or error (${BOTS}). ` +
        'Opt-outs: includeMine: true sends mine=include and includeBots: true sends bots=include (both default false). ' +
        'Never returns an email: fields are allowlisted (the host rows carry email; it is not copied), event props lose every key that names an email or is an email address, at any depth, and an email address inside any string becomes [email]. ' +
        `${NOT_CAUGHT} ${ECHO} ${SOURCE}`,
      inputSchema: {
        sessionId: z
          .string()
          .regex(SESSION_ID_RE)
          .optional()
          .describe('One session id (a UUID, as listed by this tool). Returns that session and its timeline; the other params are ignored.'),
        days: z.number().int().min(1).max(30).optional().describe('Window in days (1-30). Host default 1.'),
        app: z
          .string()
          .regex(APP_SLUG)
          .optional()
          .describe("Only sessions that viewed /projects/<app>/ or /products/<app>, or sent that app's telemetry."),
        limit: z
          .number()
          .int()
          .min(1)
          .max(200)
          .optional()
          .describe('Max sessions, newest first (1-200; host default 50). At most 50 with timeline.'),
        includeMine: z
          .boolean()
          .default(false)
          .describe("Include the owner's own sessions (sends mine=include). Default false: mine=exclude."),
        includeBots: z
          .boolean()
          .default(false)
          .describe('Include UA-flagged automation (sends bots=include). Default false: bots=exclude.'),
        timeline: z.boolean().default(false).describe("Add each listed session's timeline (at most 50 sessions). Default false."),
      },
    },
    async ({ sessionId, days, app, limit, includeMine, includeBots, timeline }) => {
      try {
        if (sessionId) {
          const detail = await sessionDetail(sessionId);
          if (!detail) return err(`session ${sessionId} not found`);
          return ok(JSON.stringify({ source: baseUrl(), ...detail }, null, 2));
        }
        return ok(JSON.stringify(await sessionsReport({ days, app, limit, includeMine, includeBots, timeline }), null, 2));
      } catch (e: unknown) {
        return err((e as Error).message);
      }
    },
  );
}
