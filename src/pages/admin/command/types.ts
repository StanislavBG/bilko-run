// Response shapes of the existing admin endpoints, shared by every Observability Command module.
import type { DriftStatus } from '../DriftBadge.js';
import type { TimelineItem } from '../../../lib/sessionSteps';

export interface DayRow { date: string; hits: number; visitors: number }
export interface PageRow { path: string; hits: number; visitors: number }
export interface ReferrerRow { host: string; hits: number }
export interface SlugRow { slug: string; hits: number; visitors: number }
export interface CountryRow { country: string; hits: number }
export interface DeviceRow { device: string; hits: number }
export interface BrowserRow { browser: string; hits: number }
export interface ClickRow {
  path: string;
  tag: string | null;
  label: string | null;
  href: string | null;
  clicks: number;
  visitors: number;
}
export interface RecentRow {
  ts: number;
  path: string;
  status: number;
  referrerHost: string | null;
  country: string | null;
  device: string;
  browser: string;
  os: string;
  isBot: boolean;
  ip: string | null;
  ua: string | null;
  referrer: string | null;
  visitorId: string | null;
  userEmail: string | null;
  isAdmin: boolean;
  sessionId?: string | null;
  visitorClass?: string;
}
export interface VisitorRow {
  visitorId: string;
  ip: string | null;
  country: string | null;
  device: string | null;
  browser: string | null;
  os: string | null;
  userEmail: string | null;
  isAdmin: boolean;
  hits: number;
  clicks: number;
  pages: number;
  firstSeen: number;
  lastSeen: number;
}

/** GET /api/admin/traffic */
export interface TrafficData {
  days: number;
  totals: { hits: number; visitors: number; botHits: number; notFound: number; clicks: number };
  byDay: DayRow[];
  topPages: PageRow[];
  topReferrers: ReferrerRow[];
  bySlug: SlugRow[];
  byCountry: CountryRow[];
  byDevice: DeviceRow[];
  byBrowser: BrowserRow[];
  topClicks: ClickRow[];
  byClass?: { class: string; hits: number; visitors: number }[];
  topPagesByClass?: { path: string; class: string; hits: number; visitors: number }[];
  recent: RecentRow[];
  visitors: VisitorRow[];
  earliestDate: string | null;
  generatedAt: number;
}

export interface VisitorTimelineEvent {
  ts: number;
  kind: 'hit' | 'click';
  path: string;
  status?: number;
  label?: string;
  href?: string;
  referrer?: string;
  ip: string | null;
  ua: string | null;
}
/** GET /api/admin/traffic/visitor/:id */
export interface VisitorTimeline {
  visitorId: string;
  days: number;
  events: VisitorTimelineEvent[];
  generatedAt: number;
}

export interface SessionRow {
  session_id: string;
  visitor_id: string;
  email: string | null;
  started_at: number;
  ended_at: number;
  duration_ms: number;
  landing_path: string | null;
  exit_path: string | null;
  page_count: number;
  source_bucket: string | null;
  referrer_host: string | null;
  country: string | null;
  device: string | null;
  converted: number;
  purchased: number;
  click_count: number;
  event_count: number;
  error_count: number;
  apps: string[];
}
/** GET /api/admin/sessions */
export interface SessionsList { sessions: SessionRow[] }

/** The raw `sessions` table row returned by the detail endpoint. */
export interface SessionHeadRow {
  session_id: string;
  visitor_id: string;
  email: string | null;
  started_at: number;
  ended_at: number;
  landing_path: string | null;
  exit_path: string | null;
  page_count: number | null;
  source_bucket: string | null;
  referrer_host: string | null;
  country: string | null;
  device: string | null;
  converted: number | null;
  purchased: number | null;
  click_count: number;
  event_count: number;
  error_count: number;
}
/** GET /api/admin/sessions/:id */
export interface SessionDetail {
  session: SessionHeadRow | null;
  timeline: TimelineItem[];
  apps: string[];
}

export interface AppHealth {
  app: string;
  sessions: number;
  views: number;
  clicks: number;
  events: number;
  errors: number;
  error_sessions: number;
  last_seen_ms: number;
}
export interface FlowStep { step: string; sessions: number; first_seen_ms: number }
export interface Flow { app: string; flow: string; steps: FlowStep[]; total_sessions: number }
/** GET /api/admin/flows */
export interface FlowsData { apps: AppHealth[]; flows: Flow[] }

export interface EgressRouteRow { method: string; route: string; requests: number; bytes: number; bytesPerRequest: number }
export interface EgressSlugRow { slug: string; requests: number; bytes: number; bytesPerRequest: number }
export interface EgressAssetRow { slug: string; path: string; requests: number; bytes: number }
/** GET /api/admin/egress */
export interface EgressData {
  rows: EgressRouteRow[];
  bySlug: EgressSlugRow[];
  totalBytes: number;
  assets: EgressAssetRow[];
  earliestDate: string | null;
  days: number;
  generatedAt: number;
}

/** GET /api/admin/blog-cadence */
export interface BlogCadence {
  lastPublishedAt: string | null;
  gapDays: number | null;
  targetUpperDays: number | null;
  catchupTriggerDays: number | null;
  status: 'ok' | 'warn' | 'critical' | 'unknown';
}

export interface AlertRow { kind: string; details: string }
export interface ObservabilityRow {
  slug: string;
  manifest: {
    version: string | null;
    gitSha: string | null;
    hostKit: string | null;
    builtAt: string | null;
    bundleGz: number | null;
  };
  traffic24h: number;
  bytesOut24h: number;
  errors24h: number;
  warnLogs24h: number;
  errorLogs24h: number;
  synthetic: {
    passes: number;
    fails: number;
    loadP50: number | null;
    loadP95: number | null;
    latestOk: boolean | null;
  };
  hostKitDrift: DriftStatus;
  openAlerts: AlertRow[];
  latestError: { msg: string; ts: number } | null;
}
export interface DesktopApp { app: string; installs: number; active7: number }
/** GET /api/admin/observability */
export interface ObservabilityData {
  env: 'prod' | 'dev' | 'test' | 'all';
  rows: ObservabilityRow[];
  globalAlerts?: AlertRow[];
  desktopApps: DesktopApp[];
  latestKit: string | null;
  generatedAt: number;
}

/** One grouped error from GET /api/admin/observability/errors (timestamps are epoch seconds). */
export interface ErrorGroup {
  app: string;
  signature: string;
  name: string;
  msg: string;
  count: number;
  firstSeen: number;
  lastSeen: number;
  versions: string[];
  sampleUrl: string | null;
  sampleId: number;
}
/** GET /api/admin/observability/errors */
export interface ErrorGroupsData {
  env: 'prod' | 'dev' | 'test' | 'all';
  days: number;
  app: string | null;
  totals: { errors: number; groups: number };
  groups: ErrorGroup[];
}
/** GET /api/admin/observability/errors/:id */
export interface ErrorDetailData {
  id: number;
  app: string;
  version: string | null;
  name: string | null;
  msg: string;
  stack: string | null;
  url: string | null;
  ua: string | null;
  visitor_id: string | null;
  session_id: string | null;
  context_json: unknown;
  created_at: number;
  env: string | null;
}

/** Injectable stand-in for useAdminFetch (the DEV preview serves fixtures through it). */
export type AdminFetcher = (path: string, init?: RequestInit) => Promise<Response>;

export type ModuleKey = 'globe' | 'sessions' | 'apps' | 'traffic' | 'audience' | 'clicks' | 'bandwidth';

export const MODULES: { key: ModuleKey; num: string; title: string; subtitle: string }[] = [
  { key: 'globe', num: '01', title: 'Globe', subtitle: 'traffic origin' },
  { key: 'sessions', num: '02', title: 'Sessions', subtitle: 'journeys' },
  { key: 'apps', num: '03', title: 'App health', subtitle: 'sessions · errors' },
  { key: 'traffic', num: '04', title: 'Traffic', subtitle: 'pages · referrers' },
  { key: 'audience', num: '05', title: 'Audience', subtitle: 'devices · visitors' },
  { key: 'clicks', num: '06', title: 'Top clicks', subtitle: 'elements · targets' },
  { key: 'bandwidth', num: '07', title: 'Bandwidth', subtitle: 'egress' },
];
