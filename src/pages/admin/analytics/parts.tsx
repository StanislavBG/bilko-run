import type { ReactNode } from 'react';

export function normalizeReferrer(raw: string): { host: string; source: string } {
  if (!raw) return { host: '', source: 'direct' };
  let host = '';
  try {
    host = new URL(raw).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    host = raw.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
  }
  if (!host) return { host: '', source: 'direct' };
  if (host === 't.co' || host === 'twitter.com' || host === 'x.com' || host.endsWith('.twitter.com') || host.endsWith('.x.com')) return { host, source: 'twitter/x' };
  if (host === 'lnkd.in' || host === 'linkedin.com' || host.endsWith('.linkedin.com')) return { host, source: 'linkedin' };
  if (host === 'reddit.com' || host === 'old.reddit.com' || host.endsWith('.reddit.com')) return { host, source: 'reddit' };
  if (host === 'news.ycombinator.com') return { host, source: 'hackernews' };
  if (/^google\./.test(host) || host.includes('.google.')) return { host, source: 'google' };
  if (host === 'bing.com' || host.endsWith('.bing.com')) return { host, source: 'bing' };
  if (host === 'duckduckgo.com' || host.endsWith('.duckduckgo.com')) return { host, source: 'duckduckgo' };
  if (host === 'producthunt.com' || host.endsWith('.producthunt.com')) return { host, source: 'producthunt' };
  if (host === 'github.com' || host.endsWith('.github.com')) return { host, source: 'github' };
  if (host === 'bilko.run' || host.endsWith('.bilko.run')) return { host, source: 'internal' };
  return { host, source: host };
}

export function aggregateReferrers(list: Array<{ referrer: string; views: number }>): Array<{ source: string; views: number }> {
  const agg = new Map<string, number>();
  for (const r of list) {
    const { source } = normalizeReferrer(r.referrer || '');
    agg.set(source, (agg.get(source) ?? 0) + r.views);
  }
  return Array.from(agg.entries())
    .map(([source, views]) => ({ source, views }))
    .sort((a, b) => b.views - a.views);
}

export interface Stats {
  period: { days: number; since: string };
  views: number;
  botViews: number;
  botUserAgents: Array<{ ua: string; views: number }>;
  todayViews: number;
  totalRoasts: number;
  totalUsers: number;
  tokenPurchases: number;
  revenue: { single: number; bundle: number; total: number };
  byDay: Array<{ date: string; views: number }>;
  byPage: Array<{ path: string; views: number }>;
  byReferrer: Array<{ referrer: string; views: number }>;
  topUsers: Array<{ email: string; credits: number; roasts: number; last_roast: string | null; purchased: number | null }>;
  signupsByDay: Array<{ date: string; signups: number }>;
  roastsByDay: Array<{ date: string; roasts: number }>;
  recentUserRoasts: Array<{ email: string; url: string; score: number; grade: string; roast: string; created_at: string }>;
  activityFeed: Array<{ type: string; email: string; detail: string; created_at: string }>;
  toolUsage: Array<{ endpoint: string; uses: number }>;
  toolVisits: Array<{ path: string; visits: number }>;
  uniqueVisitors: number;
  topLandingPages: Array<{ path: string; unique_users: number }>;
  referrerToTool: Array<{ referrer: string; path: string; visits: number }>;
  dailyActiveUsers: Array<{ date: string; users: number }>;
  blogTraffic: Array<{ path: string; views: number }>;
  topUtms: Array<{ utm_source: string | null; utm_medium: string | null; utm_campaign: string | null; views: number; signed_in: number }>;
  byCountry: Array<{ country: string; views: number }>;
  views_prior: number;
  todayViews_prior: number;
  uniqueVisitors_prior: number;
  totalRoasts_prior: number;
  totalUsers_prior: number;
  tokenPurchases_prior: number;
  revenue_prior: { single: number; bundle: number; total: number };
}

export function StatCard({ label, value, sub, priorValue, currentNumeric }: { label: string; value: string | number; sub?: string; priorValue?: number; currentNumeric?: number }) {
  let badge: ReactNode = null;
  if (typeof priorValue === 'number' && typeof currentNumeric === 'number') {
    if (priorValue === 0 && currentNumeric === 0) {
      badge = null;
    } else if (priorValue === 0) {
      badge = <span className="inline-block ml-2 text-[10px] font-bold text-green-600">new</span>;
    } else {
      const pct = Math.round(((currentNumeric - priorValue) / priorValue) * 100);
      const up = pct >= 0;
      badge = (
        <span className={`inline-block ml-2 text-[10px] font-bold ${up ? 'text-green-600' : 'text-red-500'}`}>
          {up ? '↑' : '↓'} {Math.abs(pct)}%
        </span>
      );
    }
  }
  return (
    <div className="bg-white rounded-xl border border-warm-200/60 p-5">
      <div className="text-xs font-bold uppercase tracking-wider text-warm-400 mb-1">{label}</div>
      <div className="text-3xl font-black text-warm-900 flex items-baseline">{value}{badge}</div>
      {sub && <div className="text-xs text-warm-500 mt-1">{sub}</div>}
    </div>
  );
}

export function BarChart({ data, label: _label, color = 'bg-fire-400' }: { data: Array<{ key: string; value: number }>; label: string; color?: string }) {
  if (data.length === 0) return <p className="text-sm text-warm-400">No data yet</p>;
  const max = Math.max(...data.map(x => x.value), 1);
  return (
    <div className="space-y-1.5">
      {data.map(d => (
        <div key={d.key} className="flex items-center gap-3">
          <span className="text-xs text-warm-500 w-16 flex-shrink-0 font-mono">{d.key}</span>
          <div className="flex-1 h-4 bg-warm-50 rounded-full overflow-hidden">
            <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${Math.round((d.value / max) * 100)}%` }} />
          </div>
          <span className="text-xs font-bold text-warm-700 w-8 text-right">{d.value}</span>
        </div>
      ))}
    </div>
  );
}

export function gradeBadge(grade: string) {
  const color = grade.startsWith('A') ? 'bg-green-100 text-green-700' :
    grade.startsWith('B') ? 'bg-blue-100 text-blue-700' :
    grade.startsWith('C') ? 'bg-yellow-100 text-yellow-700' :
    grade === 'D' ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700';
  return <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg font-black text-xs ${color}`}>{grade}</span>;
}

export function activityIcon(type: string) {
  if (type === 'signup') return <span className="text-green-500" title="Signup">+</span>;
  if (type === 'purchase') return <span className="text-fire-500" title="Purchase">$</span>;
  return <span className="text-blue-500" title="Roast">R</span>;
}

export function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function LoadingState({ loading, error, label = 'stats' }: { loading: boolean; error: string | null; label?: string }) {
  if (error) return <div className="text-red-500 text-center py-12">Could not load {label}: {error}</div>;
  if (loading) return <div className="text-warm-400 text-center py-12">Loading {label}...</div>;
  return null;
}
