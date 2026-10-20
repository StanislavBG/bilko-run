// DEV-only preview of the Observability Command console fed by the design prototype's sample data (no auth, no network).
import { useEffect, useMemo, useState } from 'react';
import { CommandShell, type RefreshOpt, type WindowOpt } from './CommandShell.js';
import { KpiStrip, Ticker } from './KpiStrip.js';
import { AppsModule, appTiles, appsSubtitle } from './AppsModule.js';
import { AudienceModule } from './AudienceModule.js';
import { BandwidthModule } from './BandwidthModule.js';
import { ClicksModule, clicksSubtitle } from './ClicksModule.js';
import { GlobeModule } from './GlobeModule.js';
import { SessionsModule } from './SessionsModule.js';
import { TrafficModule, trafficSubtitle } from './TrafficModule.js';
import { deriveKpis, deriveStatus } from './useCommandData.js';
import type {
  AdminFetcher, BlogCadence, EgressData, ErrorDetailData, ErrorGroupsData, FlowsData, ModuleKey, ObservabilityData, RecentRow,
  SessionDetail, SessionRow, TrafficData, VisitorTimeline,
} from './types.js';

const MB = 1024 * 1024;
const YEAR = 2026;
const hms = (s: string, md: string): number => {
  const [m, d] = md.split('/').map(Number);
  const [hh, mm, ss = 0] = s.split(':').map(Number);
  return new Date(YEAR, m - 1, d, hh, mm, ss).getTime();
};
const mmss = (s: string): number => {
  const [m, sec] = s.split(':').map(Number);
  return (m * 60 + sec) * 1000;
};

// Converted from the prototype's D block (Observability Command.dc.html lines 488-514).
const COUNTRIES: [string, number][] = [['US', 670], ['NL', 557], ['KR', 423], ['PL', 397], ['IN', 229], ['AU', 218], ['DE', 69], ['BE', 40], ['ID', 39], ['SE', 32], ['FR', 21], ['SG', 12], ['GB', 8], ['CN', 8], ['CA', 8], ['BR', 6], ['SI', 4], ['LT', 3], ['UA', 2], ['TW', 2], ['CH', 2], ['TR', 1]];
const DAYS: [string, number, number][] = [['13', 545, 34], ['14', 552, 68], ['15', 214, 36], ['16', 415, 40], ['17', 750, 48], ['18', 276, 46], ['19', 7, 4]];
const PAGES: [string, number, number][] = [['/', 393, 136], ['/wp-admin/install.php', 68, 2], ['/projects/git-viewer/', 67, 3], ['/projects/game-academy/', 61, 2], ['/projects/session-manager/', 49, 7], ['/projects/', 38, 12], ['/icon.svg', 32, 4], ['/products/session-manager', 20, 11], ['/favicon.ico', 17, 9]];
const REFS: [string, number][] = [['linkedin.com', 7], ['t.co', 4], ['accounts.google.com', 4], ['google.com', 3], ['google.com.hk', 1], ['facebook.com', 1], ['duckduckgo.com', 1]];
const PROJECTS: [string, number, number][] = [['game-academy', 93, 2], ['git-viewer', 67, 3], ['session-manager', 55, 13], ['escape-velocity', 13, 6], ['launch-kit', 13, 3], ['outdoor-hours', 7, 3], ['social-signals-trader', 5, 2], ['academy', 4, 4], ['sudoku', 2, 1], ['fizzpop', 1, 1]];
const APPS: [string, number, number, number, number, number, string][] = [['session-manager', 63, 20, 165, 1519, 20, '10/18 16:43'], ['launch-kit', 12, 12, 9, 14, 0, '10/17 09:49'], ['game-academy', 7, 57, 45, 12, 0, '10/18 14:45'], ['escape-velocity', 4, 0, 28, 74, 0, '10/16 23:37'], ['academy', 3, 0, 13, 6, 0, '10/15 09:48'], ['outdoor-hours', 1, 2, 35, 0, 0, '10/18 19:03'], ['ad-scorer', 1, 0, 0, 1, 0, '10/13 19:00'], ['audience-decoder', 1, 0, 0, 1, 0, '10/13 19:00'], ['email-forge', 1, 0, 0, 1, 0, '10/13 19:00'], ['headline-grader', 1, 0, 0, 1, 0, '10/13 19:00'], ['launch-grader', 1, 0, 0, 1, 0, '10/13 19:00'], ['local-score', 1, 0, 0, 1, 0, '10/13 18:59'], ['page-roast', 1, 0, 0, 1, 0, '10/13 18:59'], ['stack-audit', 1, 0, 0, 1, 0, '10/13 19:00'], ['stepproof', 1, 0, 0, 1, 0, '10/13 19:00'], ['thread-grader', 1, 0, 0, 1, 0, '10/13 19:00'], ['fizzpop', 0, 0, 8, 0, 0, '10/14 08:35'], ['git-viewer', 0, 0, 2, 3, 0, '10/16 23:14'], ['social-signals-trader', 0, 0, 7, 0, 0, '10/15 22:24'], ['sudoku', 0, 0, 6, 0, 0, '10/14 08:33']];
const SESSIONS: [string, string, string, string, string, string, number, number, number, string][] = [
  ['19:01:15', '10/18', 'bilkobibitkov2000@gmail.com', '/', '/', 'outdoor-hours', 5, 8, 0, '18:27'],
  ['16:21:11', '10/18', 'bilkobibitkov2000@gmail.com', '/projects/session-manager/', '/projects/session-manager/', 'session-manager', 2, 11, 0, '21:59'],
  ['14:44:25', '10/18', 'c0417740…', '/', '/', '', 1, 0, 1, '0:00'],
  ['11:44:52', '10/18', 'c0417740…', '/', '/', '', 1, 0, 0, '0:00'],
  ['11:33:00', '10/18', 'c0417740…', '/', '/', '', 4, 0, 4, '8:27'],
  ['11:08:14', '10/18', 'bilkobibitkov2000@gmail.com', '/', '/projects', '', 3, 0, 0, '0:43'],
  ['07:39:11', '10/18', '0f5a2ae6…', '/', '/projects/', '', 3, 0, 2, '0:11'],
  ['07:39:08', '10/18', '0f5a2ae6…', '/', '/', '', 1, 0, 0, '0:00'],
  ['21:39:26', '10/17', 'bilkobibitkov2000@gmail.com', '/', '/projects', '', 2, 0, 5, '0:01'],
  ['21:30:42', '10/17', 'bilkobibitkov2000@gmail.com', '/', '/blog/the-family-screen-that-opens-your-mail-for-you', '', 3, 0, 0, '0:12'],
  ['20:27:45', '10/17', 'bilkobibitkov2000@gmail.com', '/', '/admin/observability', '', 3, 0, 0, '8:22'],
];
const JOURNEY: [string, string, string, string?][] = [['view', '/projects/session-manager/', '+0:00', '← https://bilko.run/projects?p=session-manager'], ['click', 'Got it', '+0:14'], ['click', 'Bilko-Game-Academy · Bilko-Game…', '+1:02'], ['click', 'New session in Bilko-Game-Academy', '+2:40'], ['click', 'Dictate prompt', '+4:05'], ['click', 'Dictate prompt', '+6:31'], ['click', 'Dictate prompt', '+9:12'], ['click', 'Start', '+11:48'], ['click', 'Game Implementation feature · …', '+14:20'], ['click', 'Refresh', '+17:55'], ['click', 'Back', '+20:41'], ['click', 'Refresh', '+21:59']];
const CLICKS: [string, string, string, number, number][] = [['/projects', 'Next project', '—', 58, 4], ['/projects', 'Previous project', '—', 52, 4], ['/projects/', 'Next project', '—', 48, 1], ['/projects/session-manager/', 'Refresh', '—', 39, 2], ['/projects/session-manager/', 'Got it', '—', 25, 2], ['/projects/session-manager/', 'Back', '—', 21, 2], ['/', 'Projects', '/projects', 20, 6], ['/projects/', 'Previous project', '—', 17, 1], ['/projects', 'Full story', '—', 14, 5], ['/projects/', 'Open Social Signals Trader', '—', 14, 4], ['/projects', 'Open Weather', '—', 12, 4], ['/projects/', 'Open Family Frame', '—', 12, 3], ['/projects', 'Open Git Viewer', '—', 11, 2], ['/projects', 'Open →', '—', 11, 5], ['/projects/', 'Open Session Manager', '—', 11, 4]];
const BW: [string, number, number, string][] = [['escape-velocity', 143, 266.0, '1.9 MB'], ['_host', 4985, 57.2, '12 KB'], ['game-academy', 520, 5.0, '10 KB'], ['session-manager', 239, 2.3, '10 KB'], ['social-signals-trader', 137, 1.6, '12 KB'], ['launch-kit', 105, 1.3, '13 KB'], ['academy', 59, 0.994, '17 KB'], ['git-viewer', 115, 0.749, '7 KB'], ['outdoor-hours', 20, 0.326, '16 KB'], ['fizzpop', 31, 0.294, '9 KB'], ['sudoku', 30, 0.199, '7 KB'], ['_other', 104, 0.125, '1 KB'], ['mindswiffer', 14, 0.117, '8 KB']];
const ROUTES: [string, string, number, number][] = [['GET', 'static:escape-velocity', 131, 266.0], ['GET', 'static:_host', 4745, 56.8], ['GET', 'static:game-academy', 517, 5.0], ['GET', 'static:session-manager', 237, 2.3], ['GET', '/api/projects/:slug/snapshot', 12, 1.7], ['GET', 'static:social-signals-trader', 137, 1.6], ['GET', 'static:launch-kit', 105, 1.3], ['GET', 'static:academy', 57, 0.994], ['GET', 'static:git-viewer', 115, 0.749], ['GET', '/api/git-viewer/u/:login', 231, 0.698], ['GET', '/api/projects', 208, 0.497], ['GET', '/api/blog', 51, 0.429], ['POST', 'static:_host', 106, 0.357]];
const VISITORS: [string, string, string, string, string, number, number, string][] = [['5ac9e226…', '45.138.12.22', 'PL', 'desktop', '—', 394, 329, '10/13 15:09'], ['7b0fdf6a…', '45.148.10.74', 'NL', 'desktop', '—', 343, 343, '10/17 05:58'], ['fcc63981…', '50.47.212.159', 'US', 'desktop', 'bilkobibitkov2000@gmail.com', 161, 22, '10/18 19:03'], ['8783349b…', '20.214.147.109', 'KR', 'other', '—', 134, 121, '10/17 16:31'], ['75414094…', '74.225.203.7', 'IN', 'other', '—', 127, 124, '10/14 10:33'], ['01b26763…', '20.92.72.133', 'AU', 'other', '—', 119, 119, '10/17 21:55'], ['b19d2969…', '20.194.17.163', 'KR', 'other', '—', 107, 107, '10/15 20:34'], ['a9c93b5b…', '20.207.202.183', 'IN', 'other', '—', 101, 99, '10/15 08:34']];
const HITS: [string, string, string, string, string][] = [['19:03:00', '/favicon.ico', 'US', 'desktop/Firefox/Linux', ''], ['19:02:59', '/projects/outdoor-hours/', 'US', 'desktop/Firefox/Linux', ''], ['19:01:15', '/', 'US', 'desktop/Firefox/Linux', ''], ['18:35:30', '/wp-admin/install.php', 'DE', 'desktop/other', 'PROBE'], ['18:25:34', '/', 'US', 'desktop/other', ''], ['17:50:22', '/projects/academy/', 'US', 'desktop/other', 'BOT'], ['17:27:56', '/projects/outdoor-hours/', 'US', 'desktop/Chrome/Linux', ''], ['17:27:12', '/', 'US', 'desktop/other', '']];

const NOW = hms('19:05:00', '10/19');
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const bytes = (mb: number) => Math.round(mb * MB);

/** 7 entries for 1D/7D, 30 for 30D (the 30D fixture stresses the traffic chart and its labels). */
function byDay(n: number): TrafficData['byDay'] {
  if (n <= 7) return DAYS.map(([d, hits, visitors]) => ({ date: `${YEAR}-10-${d}`, hits, visitors }));
  return Array.from({ length: n }, (_, i) => {
    const date = new Date(YEAR, 9, 19 - (n - 1 - i));
    const [, h, v] = DAYS[i % DAYS.length];
    return { date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`, hits: h + (i * 37) % 90, visitors: v + (i * 7) % 20 };
  });
}

function trafficFixture(days: number): TrafficData {
  const recent: RecentRow[] = HITS.map(([t, path, country, dev, flag]) => {
    const [device, browser = 'other', os = 'other'] = dev.split('/');
    return {
      ts: hms(t, '10/18'), path, status: flag === 'PROBE' ? 404 : 200, referrerHost: null, country, device, browser, os,
      isBot: flag === 'BOT', ip: null, ua: null, referrer: null, visitorId: null, userEmail: null, isAdmin: false,
    };
  });
  return {
    days,
    totals: { hits: sum(COUNTRIES.map(c => c[1])) + 0, visitors: 136, botHits: 392, notFound: 71, clicks: sum(CLICKS.map(c => c[3])) },
    byDay: byDay(days > 7 ? 30 : 7),
    topPages: PAGES.map(([path, hits, visitors]) => ({ path, hits, visitors })),
    topReferrers: REFS.map(([host, hits]) => ({ host, hits })),
    bySlug: PROJECTS.map(([slug, hits, visitors]) => ({ slug, hits, visitors })),
    byCountry: COUNTRIES.map(([country, hits]) => ({ country, hits })),
    byDevice: [{ device: 'desktop', hits: 1620 }, { device: 'other', hits: 790 }, { device: 'mobile', hits: 410 }, { device: 'tablet', hits: 35 }],
    byBrowser: [{ browser: 'other', hits: 1500 }, { browser: 'Chrome', hits: 760 }, { browser: 'Firefox', hits: 310 }, { browser: 'Safari', hits: 190 }, { browser: 'Edge', hits: 95 }],
    topClicks: CLICKS.map(([path, label, href, clicks, visitors]) => ({ path, tag: 'button', label, href: href === '—' ? null : href, clicks, visitors })),
    recent,
    visitors: VISITORS.map(([id, ip, country, device, email, hits, pages, last]) => ({
      visitorId: id, ip, country, device, browser: null, os: null, userEmail: email === '—' ? null : email, isAdmin: false,
      hits, clicks: Math.max(0, hits - pages), pages, firstSeen: hms('00:00', last.split(' ')[0]), lastSeen: hms(last.split(' ')[1], last.split(' ')[0]),
    })),
    earliestDate: `${YEAR}-10-13`,
    generatedAt: NOW,
  };
}

const flowsFixture: FlowsData = {
  apps: APPS.map(([app, sessions, views, clicks, events, errors, last]) => {
    const [md, t] = last.split(' ');
    return { app, sessions, views, clicks, events, errors, error_sessions: Math.min(errors, sessions), last_seen_ms: hms(t, md) };
  }),
  flows: [
    { app: 'session-manager', flow: 'onboarding', total_sessions: 63, steps: [{ step: 'landing', sessions: 63, first_seen_ms: NOW - 9e8 }, { step: 'download', sessions: 31, first_seen_ms: NOW - 8e8 }, { step: 'first-run', sessions: 12, first_seen_ms: NOW - 7e8 }] },
  ],
};

const obsFixture: ObservabilityData = {
  env: 'prod',
  rows: APPS.slice(0, 8).map(([slug, , , , , errors], i) => ({
    slug,
    manifest: { version: '1.4.' + i, gitSha: 'a1b2c3d', hostKit: '0.9.0', builtAt: new Date(NOW - 864e5).toISOString(), bundleGz: 180_000 },
    traffic24h: 40, bytesOut24h: 2 * MB, errors24h: errors, warnLogs24h: 0, errorLogs24h: 0,
    synthetic: { passes: 9, fails: i === 3 ? 1 : 0, loadP50: 420, loadP95: 910, latestOk: i !== 3 },
    hostKitDrift: i % 3 === 0 ? 'current' : 'minor_behind',
    openAlerts: [],
    latestError: errors > 0 ? { msg: 'TypeError: x is undefined', ts: NOW - 3e6 } : null,
  })),
  desktopApps: [],
  latestKit: '0.9.0',
  generatedAt: NOW,
};

const blogFixture: BlogCadence = { lastPublishedAt: new Date(NOW - 2 * 864e5).toISOString(), gapDays: 2, targetUpperDays: 4, catchupTriggerDays: 7, status: 'ok' };

function egressFixture(days: number): EgressData {
  const total = sum(BW.map(b => bytes(b[2])));
  return {
    rows: ROUTES.map(([method, route, requests, mb]) => ({ method, route, requests, bytes: bytes(mb), bytesPerRequest: Math.round(bytes(mb) / requests) })),
    bySlug: BW.map(([slug, requests, mb]) => ({ slug, requests, bytes: bytes(mb), bytesPerRequest: Math.round(bytes(mb) / requests) })),
    totalBytes: total,
    assets: [],
    earliestDate: `${YEAR}-10-13`,
    days,
    generatedAt: NOW,
  };
}

const sessionRows: SessionRow[] = SESSIONS.map(([t, md, who, landing, exit, app, pages, clicks, errors, dur], i) => {
  const started = hms(t, md);
  const duration = mmss(dur);
  const email = who.includes('@') ? who : null;
  return {
    session_id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
    visitor_id: email ? 'fcc63981-0000-4000-8000-000000000000' : `${who.replace('…', '')}-0000-4000-8000-000000000000`,
    email, started_at: started, ended_at: started + duration, duration_ms: duration, landing_path: landing, exit_path: exit,
    page_count: pages, source_bucket: 'direct', referrer_host: null, country: 'US', device: 'desktop', converted: 0, purchased: 0,
    click_count: clicks, event_count: errors, error_count: errors, apps: app ? [app] : [],
  };
});

function sessionDetail(id: string): SessionDetail {
  const row = sessionRows.find(r => r.session_id === id) ?? sessionRows[0];
  const base = row.started_at;
  const off = (s: string) => { const [m, sec] = s.slice(1).split(':').map(Number); return base + (m * 60 + sec) * 1000; };
  const timeline: SessionDetail['timeline'] = JOURNEY.map(([kind, label, at, ref]) =>
    kind === 'view'
      ? { ts: off(at), kind: 'view' as const, path: label, referrer: ref ? ref.replace('← ', '') : null }
      : { ts: off(at), kind: 'click' as const, path: row.landing_path ?? '/', label, href: null, track_name: null });
  const { apps, duration_ms: _d, ...head } = row;
  return { session: { ...head, converted: 0, purchased: 0 }, timeline, apps };
}

function visitorTimeline(id: string, days: number): VisitorTimeline {
  const events = Array.from({ length: 14 }, (_, i) => ({
    ts: NOW - (i + 1) * 17 * 60_000,
    kind: i % 3 === 2 ? ('click' as const) : ('hit' as const),
    path: PAGES[i % PAGES.length][0],
    status: i === 5 ? 404 : 200,
    label: i % 3 === 2 ? 'Next project' : undefined,
    ip: '50.47.212.159',
    ua: null,
  }));
  return { visitorId: id, days, events, generatedAt: NOW };
}

const SEC = Math.floor(NOW / 1000);
const STACK = `TypeError: x is undefined
    at render (app.js:120:14)
    at update (app.js:88:3)
    at HTMLButtonElement.onclick (app.js:41:9)`;
const errorGroups = (app: string, days: number): ErrorGroupsData => ({
  env: 'prod', days, app,
  totals: { errors: 14, groups: 3 },
  groups: [
    { app, signature: 'TypeError|TypeError: x is undefined', name: 'TypeError', msg: 'x is undefined', count: 9, firstSeen: SEC - 80_000, lastSeen: SEC - 3_000, versions: ['1.4.0', '1.4.1'], sampleUrl: 'https://bilko.run/projects/' + app + '/', sampleId: 101 },
    { app, signature: 'RangeError|', name: 'RangeError', msg: 'Invalid array length', count: 4, firstSeen: SEC - 50_000, lastSeen: SEC - 9_000, versions: ['1.4.1'], sampleUrl: null, sampleId: 102 },
    { app, signature: 'Error|', name: 'Error', msg: 'Network request failed', count: 1, firstSeen: SEC - 20_000, lastSeen: SEC - 20_000, versions: [], sampleUrl: null, sampleId: 103 },
  ],
});
const errorDetail = (id: number): ErrorDetailData => ({
  id, app: 'session-manager', version: '1.4.1', name: id === 101 ? 'TypeError' : 'Error',
  msg: id === 101 ? 'x is undefined' : 'Network request failed',
  stack: id === 101 ? STACK : 'Error: Network request failed\n    at fetchAll (app.js:9:1)',
  url: 'https://bilko.run/projects/session-manager/', ua: 'Mozilla/5.0 (X11; Linux x86_64) Firefox/131.0',
  visitor_id: null, session_id: '00000000-0000-4000-8000-000000000001', context_json: null, created_at: SEC - 3_000, env: 'prod',
});

const json = (body: unknown): Response => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

/** Serves the self-fetching modules' endpoints from fixtures. */
export const previewFetcher: AdminFetcher = async (path) => {
  const url = new URL(path, 'http://preview.local');
  const p = url.pathname;
  const days = Number(url.searchParams.get('days') ?? 7);
  if (p === '/admin/sessions') return json({ sessions: sessionRows });
  if (p.startsWith('/admin/sessions/')) return json(sessionDetail(decodeURIComponent(p.slice('/admin/sessions/'.length))));
  if (p.startsWith('/admin/traffic/visitor/')) return json(visitorTimeline(decodeURIComponent(p.slice('/admin/traffic/visitor/'.length)), days));
  if (p === '/admin/observability/errors') return json(errorGroups(url.searchParams.get('app') ?? 'app', days));
  if (p.startsWith('/admin/observability/errors/')) return json(errorDetail(Number(p.slice('/admin/observability/errors/'.length))));
  if (p === '/admin/egress') {
    const slug = url.searchParams.get('slug');
    const e = egressFixture(days);
    if (slug) e.assets = [['/assets/world.glb', 1.9], ['/assets/music.ogg', 0.6], ['/index.js', 0.2]].map(([a, mb]) => ({ slug, path: a as string, requests: 40, bytes: bytes(mb as number) }));
    return json(e);
  }
  return new Response('not found', { status: 404 });
};

const WINDOW_DAYS: Record<WindowOpt, number> = { '1D': 1, '7D': 7, '30D': 30 };
const noData = { error: null } as const;

export function PreviewPage() {
  const [win, setWin] = useState<WindowOpt>('7D');
  const [refresh, setRefresh] = useState<RefreshOpt>('5M');
  const days = WINDOW_DAYS[win];

  useEffect(() => {
    document.title = 'Observability preview — bilko.run';
  }, []);

  const traffic = useMemo(() => ({ data: trafficFixture(days), ...noData }), [days]);
  const egress = useMemo(() => ({ data: egressFixture(days), ...noData }), [days]);
  const flows = useMemo(() => ({ data: flowsFixture, ...noData }), []);
  const obs = useMemo(() => ({ data: obsFixture, ...noData }), []);
  const tiles = useMemo(() => appTiles(flowsFixture, obsFixture, NOW), []);
  const kpis = useMemo(() => deriveKpis(traffic.data, flowsFixture, egress.data, blogFixture), [traffic, egress]);
  const led = deriveStatus(obsFixture, false);

  const render = (key: ModuleKey, stage: boolean) => {
    switch (key) {
      case 'globe': return <GlobeModule stage={stage} traffic={traffic.data} pingCountries={[]} />;
      case 'sessions': return <SessionsModule stage={stage} days={Math.min(30, days)} fetcher={previewFetcher} />;
      case 'apps': return <AppsModule stage={stage} flows={flows} obs={obs} fetcher={previewFetcher} />;
      case 'traffic': return <TrafficModule stage={stage} traffic={traffic} />;
      case 'audience': return <AudienceModule stage={stage} traffic={traffic} days={days} fetcher={previewFetcher} />;
      case 'clicks': return <ClicksModule stage={stage} traffic={traffic} />;
      case 'bandwidth': return <BandwidthModule stage={stage} egress={egress} days={days} fetcher={previewFetcher} />;
    }
  };

  return (
    <CommandShell
      layout="rails"
      window={win}
      onWindow={setWin}
      refresh={refresh}
      onRefresh={setRefresh}
      status={{ label: led.label, tone: led.tone === 'amber' ? 'warn' : led.tone === 'red' ? 'err' : 'ok' }}
      kpis={<KpiStrip tiles={kpis} />}
      ticker={<Ticker recent={traffic.data.recent} />}
      headers={{
        globe: { sub: 'traffic origin' },
        sessions: { sub: 'journeys' },
        apps: appsSubtitle(tiles),
        traffic: { sub: trafficSubtitle() },
        audience: { sub: 'devices · visitors' },
        clicks: { sub: clicksSubtitle(traffic) },
        bandwidth: { sub: 'egress' },
      }}
      render={render}
    />
  );
}
