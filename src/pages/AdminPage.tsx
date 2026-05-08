import { useState, useEffect, type ReactNode } from 'react';
import { useUser, useAuth } from '@clerk/clerk-react';
import { Navigate } from 'react-router-dom';

import { ADMIN_EMAILS } from '../constants.js';

const API = import.meta.env.VITE_API_URL || '/api';

function normalizeReferrer(raw: string): { host: string; source: string } {
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

function aggregateReferrers(list: Array<{ referrer: string; views: number }>): Array<{ source: string; views: number }> {
  const agg = new Map<string, number>();
  for (const r of list) {
    const { source } = normalizeReferrer(r.referrer || '');
    agg.set(source, (agg.get(source) ?? 0) + r.views);
  }
  return Array.from(agg.entries())
    .map(([source, views]) => ({ source, views }))
    .sort((a, b) => b.views - a.views);
}

interface Stats {
  period: { days: number; since: string };
  views: number;
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

function StatCard({ label, value, sub, priorValue, currentNumeric }: { label: string; value: string | number; sub?: string; priorValue?: number; currentNumeric?: number }) {
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

function BarChart({ data, label, color = 'bg-fire-400' }: { data: Array<{ key: string; value: number }>; label: string; color?: string }) {
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

function gradeBadge(grade: string) {
  const color = grade.startsWith('A') ? 'bg-green-100 text-green-700' :
    grade.startsWith('B') ? 'bg-blue-100 text-blue-700' :
    grade.startsWith('C') ? 'bg-yellow-100 text-yellow-700' :
    grade === 'D' ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700';
  return <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg font-black text-xs ${color}`}>{grade}</span>;
}

function activityIcon(type: string) {
  if (type === 'signup') return <span className="text-green-500" title="Signup">+</span>;
  if (type === 'purchase') return <span className="text-fire-500" title="Purchase">$</span>;
  return <span className="text-blue-500" title="Roast">R</span>;
}

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function AdminPage() {
  const { user, isLoaded } = useUser();
  const { getToken } = useAuth();
  const email = user?.primaryEmailAddress?.emailAddress?.toLowerCase() ?? '';
  const isAdmin = ADMIN_EMAILS.includes(email);

  const [days, setDays] = useState(7);
  const [excludeSelf, setExcludeSelf] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'overview' | 'users' | 'roasts' | 'activity' | 'tools' | 'sources' | 'funnels' | 'audience' | 'manifests'>('overview');
  const [sourcesData, setSourcesData] = useState<any | null>(null);
  const [funnelsData, setFunnelsData] = useState<any | null>(null);
  const [audienceData, setAudienceData] = useState<any | null>(null);
  const [manifestsData, setManifestsData] = useState<any | null>(null);

  useEffect(() => {
    document.title = 'Admin — bilko.run';
    return () => { document.title = 'Bilko.run — Tools for Makers Who Ship'; };
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    setLoading(true);
    (async () => {
      const token = await getToken();
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const excl = excludeSelf ? '1' : '0';
      const s = await fetch(`${API}/analytics/stats?days=${days}&exclude_self=${excl}`, { headers }).then(res => res.json());
      setStats(s);
      // Reset lazy tab caches when filters change
      setSourcesData(null); setFunnelsData(null); setAudienceData(null); setManifestsData(null);
    })().catch(() => {}).finally(() => setLoading(false));
  }, [isAdmin, days, excludeSelf]);

  const sinceParam = (() => { const d = new Date(Date.now() - days * 86400000); return d.toISOString().slice(0, 10); })();

  useEffect(() => {
    if (!isAdmin || tab !== 'sources' || sourcesData) return;
    (async () => {
      const token = await getToken();
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const data = await fetch(`${API}/analytics/sources?since=${sinceParam}&exclude_self=${excludeSelf ? '1' : '0'}`, { headers }).then(r => r.json());
      setSourcesData(data);
    })().catch(() => {});
  }, [isAdmin, tab, sourcesData, sinceParam, excludeSelf]);

  useEffect(() => {
    if (!isAdmin || tab !== 'funnels' || funnelsData) return;
    (async () => {
      const token = await getToken();
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const data = await fetch(`${API}/analytics/funnels?since=${sinceParam}&exclude_self=${excludeSelf ? '1' : '0'}`, { headers }).then(r => r.json());
      setFunnelsData(data);
    })().catch(() => {});
  }, [isAdmin, tab, funnelsData, sinceParam, excludeSelf]);

  useEffect(() => {
    if (!isAdmin || tab !== 'audience' || audienceData) return;
    (async () => {
      const token = await getToken();
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const data = await fetch(`${API}/analytics/audience?since=${sinceParam}&exclude_self=${excludeSelf ? '1' : '0'}`, { headers }).then(r => r.json());
      setAudienceData(data);
    })().catch(() => {});
  }, [isAdmin, tab, audienceData, sinceParam, excludeSelf]);

  useEffect(() => {
    if (!isAdmin || tab !== 'manifests' || manifestsData) return;
    (async () => {
      const token = await getToken();
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const data = await fetch(`${API}/admin/manifests`, { headers }).then(r => r.json());
      setManifestsData(data);
    })().catch(() => {});
  }, [isAdmin, tab, manifestsData]);

  if (isLoaded && !isAdmin) return <Navigate to="/" replace />;
  if (!isLoaded) return <div className="p-12 text-center text-warm-400">Loading...</div>;

  return (
    <section className="max-w-6xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-extrabold text-warm-900">Admin Dashboard</h1>
        <div className="flex gap-2 items-center">
          <label className="flex items-center gap-2 text-xs font-semibold text-warm-600 mr-2 cursor-pointer">
            <input type="checkbox" checked={excludeSelf} onChange={e => setExcludeSelf(e.target.checked)} className="accent-fire-500" />
            Exclude admin/bot
          </label>
          {[1, 7, 30, 90].map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                days === d ? 'bg-fire-500 text-white' : 'bg-warm-100 text-warm-600 hover:bg-warm-200'
              }`}
            >
              {d === 1 ? 'Today' : `${d}d`}
            </button>
          ))}
        </div>
      </div>

      {loading && <div className="text-warm-400 text-center py-12">Loading stats...</div>}

      {stats && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
            <StatCard label="Views Today" value={stats.todayViews} currentNumeric={stats.todayViews} priorValue={stats.todayViews_prior} />
            <StatCard label={`Views (${days}d)`} value={stats.views} currentNumeric={stats.views} priorValue={stats.views_prior} />
            <StatCard label="Unique Visitors" value={stats.uniqueVisitors} sub={`${days}d with email`} currentNumeric={stats.uniqueVisitors} priorValue={stats.uniqueVisitors_prior} />
            <StatCard label="Total Roasts" value={stats.totalRoasts} currentNumeric={stats.totalRoasts} priorValue={stats.totalRoasts_prior} />
            <StatCard label="Total Users" value={stats.totalUsers} currentNumeric={stats.totalUsers} priorValue={stats.totalUsers_prior} />
            <StatCard label="Purchases" value={stats.tokenPurchases} sub={`${stats.revenue.single} single + ${stats.revenue.bundle} bundle`} currentNumeric={stats.tokenPurchases} priorValue={stats.tokenPurchases_prior} />
            <StatCard label="Revenue" value={`$${stats.revenue.total}`} sub={`$${stats.revenue.single} + $${stats.revenue.bundle * 5}`} currentNumeric={stats.revenue.total} priorValue={stats.revenue_prior.total} />
          </div>

          {/* Tab Nav */}
          <div className="flex gap-1 bg-warm-100 rounded-xl p-1 mb-6 w-fit">
            {(['overview', 'sources', 'funnels', 'audience', 'users', 'roasts', 'activity', 'tools', 'manifests'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all capitalize ${
                  tab === t ? 'bg-white text-warm-900 shadow-sm' : 'text-warm-500 hover:text-warm-700'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* ── Overview Tab ── */}
          {tab === 'overview' && (
            <>
              {/* Views + Roasts by Day side by side */}
              <div className="grid md:grid-cols-2 gap-6 mb-6">
                <div className="bg-white rounded-xl border border-warm-200/60 p-5">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-warm-400 mb-4">Views by Day</h2>
                  <BarChart data={stats.byDay.map(d => ({ key: d.date.slice(5), value: d.views }))} label="views" />
                </div>
                <div className="bg-white rounded-xl border border-warm-200/60 p-5">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-warm-400 mb-4">Roasts by Day</h2>
                  <BarChart
                    data={stats.roastsByDay.map(d => ({ key: d.date.slice(5), value: d.roasts }))}
                    label="roasts"
                    color="bg-fire-500"
                  />
                </div>
              </div>

              {/* Daily Active Users */}
              <div className="bg-white rounded-xl border border-warm-200/60 p-5 mb-6">
                <h2 className="text-xs font-bold uppercase tracking-wider text-warm-400 mb-4">Daily Active Users</h2>
                <BarChart data={(stats.dailyActiveUsers ?? []).map(d => ({ key: d.date.slice(5), value: d.users }))} label="users" color="bg-purple-400" />
              </div>

              {/* Pages + Referrers */}
              <div className="grid md:grid-cols-2 gap-6 mb-6">
                <div className="bg-white rounded-xl border border-warm-200/60 p-5">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-warm-400 mb-4">Top Pages</h2>
                  <div className="space-y-2">
                    {stats.byPage.map(p => (
                      <div key={p.path} className="flex items-center justify-between">
                        <span className="text-sm text-warm-700 truncate">{p.path}</span>
                        <span className="text-sm font-bold text-warm-900 ml-3">{p.views}</span>
                      </div>
                    ))}
                    {stats.byPage.length === 0 && <p className="text-sm text-warm-400">No data</p>}
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-warm-200/60 p-5">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-warm-400 mb-4">Top Referrers</h2>
                  <div className="space-y-2">
                    {aggregateReferrers(stats.byReferrer).map(r => (
                      <div key={r.source} className="flex items-center justify-between">
                        <span className="text-sm text-warm-700 truncate">{r.source}</span>
                        <span className="text-sm font-bold text-warm-900 ml-3">{r.views}</span>
                      </div>
                    ))}
                    {stats.byReferrer.length === 0 && <p className="text-sm text-warm-400">No referrer data</p>}
                  </div>
                </div>
              </div>

              {/* UTM Campaigns + Countries */}
              <div className="grid md:grid-cols-2 gap-6 mb-6">
                <div className="bg-white rounded-xl border border-warm-200/60 p-5">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-warm-400 mb-4">Top UTM Campaigns</h2>
                  {stats.topUtms && stats.topUtms.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-warm-100">
                            <th className="text-left py-1 px-2 text-xs font-bold text-warm-400">Source</th>
                            <th className="text-left py-1 px-2 text-xs font-bold text-warm-400">Medium</th>
                            <th className="text-left py-1 px-2 text-xs font-bold text-warm-400">Campaign</th>
                            <th className="text-right py-1 px-2 text-xs font-bold text-warm-400">Views</th>
                            <th className="text-right py-1 px-2 text-xs font-bold text-warm-400">Signed In</th>
                          </tr>
                        </thead>
                        <tbody>
                          {stats.topUtms.map((u, i) => (
                            <tr key={i} className="border-b border-warm-50">
                              <td className="py-1.5 px-2 text-warm-800 font-medium truncate max-w-[100px]">{u.utm_source ?? '—'}</td>
                              <td className="py-1.5 px-2 text-warm-600 truncate max-w-[80px]">{u.utm_medium ?? '—'}</td>
                              <td className="py-1.5 px-2 text-warm-600 truncate max-w-[120px]">{u.utm_campaign ?? '—'}</td>
                              <td className="py-1.5 px-2 text-right font-bold text-warm-900">{u.views}</td>
                              <td className="py-1.5 px-2 text-right text-warm-600">{u.signed_in}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-warm-400">No UTM data yet</p>
                  )}
                </div>

                <div className="bg-white rounded-xl border border-warm-200/60 p-5">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-warm-400 mb-4">Views by Country</h2>
                  {stats.byCountry && stats.byCountry.length > 0 ? (
                    (() => {
                      const total = stats.byCountry.reduce((s, c) => s + c.views, 0) || 1;
                      return (
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-warm-100">
                              <th className="text-left py-1 px-2 text-xs font-bold text-warm-400">Country</th>
                              <th className="text-right py-1 px-2 text-xs font-bold text-warm-400">Views</th>
                              <th className="text-right py-1 px-2 text-xs font-bold text-warm-400">%</th>
                            </tr>
                          </thead>
                          <tbody>
                            {stats.byCountry.map(c => (
                              <tr key={c.country} className="border-b border-warm-50">
                                <td className="py-1.5 px-2 text-warm-800 font-medium">{c.country}</td>
                                <td className="py-1.5 px-2 text-right font-bold text-warm-900">{c.views}</td>
                                <td className="py-1.5 px-2 text-right text-warm-600">{Math.round((c.views / total) * 100)}%</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      );
                    })()
                  ) : (
                    <p className="text-sm text-warm-400">No country data yet</p>
                  )}
                </div>
              </div>

              {/* Signups by Day */}
              {stats.signupsByDay.length > 0 && (
                <div className="bg-white rounded-xl border border-warm-200/60 p-5 mb-6">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-warm-400 mb-4">Signups by Day</h2>
                  <BarChart
                    data={stats.signupsByDay.map(d => ({ key: d.date.slice(5), value: d.signups }))}
                    label="signups"
                    color="bg-green-400"
                  />
                </div>
              )}
            </>
          )}

          {/* ── Users Tab ── */}
          {tab === 'users' && stats.topUsers.length > 0 && (
            <div className="bg-white rounded-xl border border-warm-200/60 p-5">
              <h2 className="text-xs font-bold uppercase tracking-wider text-warm-400 mb-4">
                All Users ({stats.topUsers.length})
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-warm-100">
                      <th className="text-left py-2 px-2 text-xs font-bold text-warm-400 uppercase">Email</th>
                      <th className="text-right py-2 px-2 text-xs font-bold text-warm-400 uppercase">Roasts</th>
                      <th className="text-right py-2 px-2 text-xs font-bold text-warm-400 uppercase">Credits</th>
                      <th className="text-right py-2 px-2 text-xs font-bold text-warm-400 uppercase">Purchased</th>
                      <th className="text-right py-2 px-2 text-xs font-bold text-warm-400 uppercase">Last Active</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.topUsers.map(u => (
                      <tr key={u.email} className="border-b border-warm-50 hover:bg-warm-50">
                        <td className="py-2 px-2 text-warm-800 font-medium truncate max-w-[220px]">{u.email}</td>
                        <td className="py-2 px-2 text-right font-bold text-warm-900">{u.roasts}</td>
                        <td className="py-2 px-2 text-right">
                          <span className={u.credits === 0 ? 'text-red-500 font-bold' : 'text-warm-600'}>{u.credits}</span>
                        </td>
                        <td className="py-2 px-2 text-right">
                          {u.purchased ? (
                            <span className="text-green-600 font-bold">{u.purchased} cr</span>
                          ) : (
                            <span className="text-warm-300">free</span>
                          )}
                        </td>
                        <td className="py-2 px-2 text-right text-xs text-warm-400">
                          {u.last_roast ? timeAgo(u.last_roast) : 'Never'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Roasts Tab ── */}
          {tab === 'roasts' && (
            <div className="bg-white rounded-xl border border-warm-200/60 p-5">
              <h2 className="text-xs font-bold uppercase tracking-wider text-warm-400 mb-4">
                Recent Roasts (with user)
              </h2>
              <div className="space-y-2">
                {stats.recentUserRoasts.map((r, i) => (
                  <div key={i} className="flex items-center gap-3 py-2.5 border-b border-warm-100 last:border-0">
                    {gradeBadge(r.grade)}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-warm-800 truncate">{r.url.replace(/^https?:\/\//, '').replace(/\/$/, '')}</span>
                        <span className="text-xs font-bold text-warm-500">{r.score}/100</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-fire-600 font-medium">{r.email}</span>
                        <span className="text-xs text-warm-300">&middot;</span>
                        <span className="text-xs text-warm-400 italic truncate">&ldquo;{r.roast}&rdquo;</span>
                      </div>
                    </div>
                    <span className="text-xs text-warm-400 flex-shrink-0">{timeAgo(r.created_at)}</span>
                  </div>
                ))}
                {stats.recentUserRoasts.length === 0 && <p className="text-sm text-warm-400">No roasts yet</p>}
              </div>
            </div>
          )}

          {/* ── Activity Tab ── */}
          {tab === 'activity' && (
            <div className="bg-white rounded-xl border border-warm-200/60 p-5">
              <h2 className="text-xs font-bold uppercase tracking-wider text-warm-400 mb-4">
                Activity Feed ({days}d)
              </h2>
              <div className="space-y-1">
                {stats.activityFeed.map((a, i) => (
                  <div key={i} className="flex items-center gap-3 py-2 border-b border-warm-50 last:border-0">
                    <div className="w-7 h-7 rounded-full bg-warm-100 flex items-center justify-center text-sm font-black">
                      {activityIcon(a.type)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-sm text-warm-800 font-medium">{a.email}</span>
                      <span className="text-sm text-warm-400 ml-2">
                        {a.type === 'signup' && 'signed up'}
                        {a.type === 'purchase' && `purchased ${a.detail} credits`}
                        {a.type === 'roast' && (
                          <>roasted <span className="text-warm-600">{a.detail.replace(/^https?:\/\//, '').replace(/\/$/, '').slice(0, 40)}</span></>
                        )}
                      </span>
                    </div>
                    <span className="text-xs text-warm-400 flex-shrink-0">{timeAgo(a.created_at)}</span>
                  </div>
                ))}
                {stats.activityFeed.length === 0 && <p className="text-sm text-warm-400">No activity in this period</p>}
              </div>
            </div>
          )}

          {/* ── Sources Tab ── */}
          {tab === 'sources' && (
            <div className="space-y-6">
              {!sourcesData && <div className="text-warm-400 text-center py-12">Loading sources...</div>}
              {sourcesData && (
                <>
                  <div className="bg-white rounded-xl border border-warm-200/60 p-5">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-warm-400 mb-4">Traffic by Source Bucket</h2>
                    {sourcesData.byBucket && sourcesData.byBucket.length > 0 ? (
                      (() => {
                        const total = sourcesData.byBucket.reduce((s: number, x: any) => s + x.views, 0) || 1;
                        return (
                          <div className="space-y-2">
                            {sourcesData.byBucket.map((b: any) => (
                              <div key={b.bucket} className="flex items-center gap-3">
                                <span className="text-sm text-warm-700 w-24 flex-shrink-0 font-medium capitalize">{b.bucket}</span>
                                <div className="flex-1 h-4 bg-warm-50 rounded-full overflow-hidden">
                                  <div className="h-full bg-fire-400 rounded-full" style={{ width: `${Math.round((b.views / total) * 100)}%` }} />
                                </div>
                                <span className="text-sm font-bold text-warm-900 w-16 text-right">{b.views} ({Math.round((b.views / total) * 100)}%)</span>
                              </div>
                            ))}
                          </div>
                        );
                      })()
                    ) : <p className="text-sm text-warm-400">No data yet</p>}
                  </div>

                  <div className="bg-white rounded-xl border border-warm-200/60 p-5">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-warm-400 mb-4">Top Referrer Hosts</h2>
                    {sourcesData.byHost && sourcesData.byHost.length > 0 ? (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-warm-100">
                            <th className="text-left py-1 px-2 text-xs font-bold text-warm-400">Host</th>
                            <th className="text-left py-1 px-2 text-xs font-bold text-warm-400">Bucket</th>
                            <th className="text-right py-1 px-2 text-xs font-bold text-warm-400">Views</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sourcesData.byHost.map((h: any, i: number) => (
                            <tr key={i} className="border-b border-warm-50">
                              <td className="py-1.5 px-2 text-warm-800 font-medium truncate max-w-[200px]">{h.host}</td>
                              <td className="py-1.5 px-2 text-warm-600 capitalize">{h.bucket}</td>
                              <td className="py-1.5 px-2 text-right font-bold text-warm-900">{h.views}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : <p className="text-sm text-warm-400">No data yet</p>}
                  </div>

                  <div className="bg-white rounded-xl border border-warm-200/60 p-5">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-warm-400 mb-4">UTM Rollup</h2>
                    {sourcesData.byUtm && sourcesData.byUtm.length > 0 ? (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-warm-100">
                            <th className="text-left py-1 px-2 text-xs font-bold text-warm-400">Source</th>
                            <th className="text-left py-1 px-2 text-xs font-bold text-warm-400">Medium</th>
                            <th className="text-left py-1 px-2 text-xs font-bold text-warm-400">Campaign</th>
                            <th className="text-right py-1 px-2 text-xs font-bold text-warm-400">Views</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sourcesData.byUtm.map((u: any, i: number) => (
                            <tr key={i} className="border-b border-warm-50">
                              <td className="py-1.5 px-2 text-warm-800 font-medium truncate max-w-[100px]">{u.utm_source ?? '—'}</td>
                              <td className="py-1.5 px-2 text-warm-600 truncate max-w-[80px]">{u.utm_medium ?? '—'}</td>
                              <td className="py-1.5 px-2 text-warm-600 truncate max-w-[140px]">{u.utm_campaign ?? '—'}</td>
                              <td className="py-1.5 px-2 text-right font-bold text-warm-900">{u.views}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : <p className="text-sm text-warm-400">No UTM data yet</p>}
                  </div>

                  <div className="bg-white rounded-xl border border-warm-200/60 p-5">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-warm-400 mb-4">Top Converting Referrers</h2>
                    {sourcesData.topConverting && sourcesData.topConverting.length > 0 ? (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-warm-100">
                            <th className="text-left py-1 px-2 text-xs font-bold text-warm-400">Host</th>
                            <th className="text-left py-1 px-2 text-xs font-bold text-warm-400">Bucket</th>
                            <th className="text-right py-1 px-2 text-xs font-bold text-warm-400">Sessions</th>
                            <th className="text-right py-1 px-2 text-xs font-bold text-warm-400">Converted</th>
                            <th className="text-right py-1 px-2 text-xs font-bold text-warm-400">Purchased</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sourcesData.topConverting.map((r: any, i: number) => (
                            <tr key={i} className="border-b border-warm-50">
                              <td className="py-1.5 px-2 text-warm-800 font-medium truncate max-w-[180px]">{r.host}</td>
                              <td className="py-1.5 px-2 text-warm-600 capitalize">{r.bucket}</td>
                              <td className="py-1.5 px-2 text-right text-warm-800">{r.sessions}</td>
                              <td className="py-1.5 px-2 text-right font-bold text-warm-900">{r.converted ?? 0}</td>
                              <td className="py-1.5 px-2 text-right text-green-600 font-bold">{r.purchased ?? 0}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : <p className="text-sm text-warm-400">No conversion data yet</p>}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Funnels Tab ── */}
          {tab === 'funnels' && (
            <div className="space-y-6">
              {!funnelsData && <div className="text-warm-400 text-center py-12">Loading funnels...</div>}
              {funnelsData && (
                <>
                  <div className="bg-white rounded-xl border border-warm-200/60 p-5">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-warm-400 mb-4">Per-Tool Funnel</h2>
                    {funnelsData.funnels && funnelsData.funnels.length > 0 ? (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-warm-100">
                            <th className="text-left py-1 px-2 text-xs font-bold text-warm-400">Tool</th>
                            <th className="text-right py-1 px-2 text-xs font-bold text-warm-400">Views</th>
                            <th className="text-right py-1 px-2 text-xs font-bold text-warm-400">Starts</th>
                            <th className="text-right py-1 px-2 text-xs font-bold text-warm-400">Success</th>
                            <th className="text-right py-1 px-2 text-xs font-bold text-warm-400">Errors</th>
                            <th className="text-right py-1 px-2 text-xs font-bold text-warm-400">Paywall</th>
                            <th className="text-right py-1 px-2 text-xs font-bold text-warm-400">Start%</th>
                            <th className="text-right py-1 px-2 text-xs font-bold text-warm-400">Succ%</th>
                          </tr>
                        </thead>
                        <tbody>
                          {funnelsData.funnels.map((f: any, i: number) => (
                            <tr key={i} className="border-b border-warm-50">
                              <td className="py-1.5 px-2 text-warm-800 font-medium">{f.tool}</td>
                              <td className="py-1.5 px-2 text-right text-warm-800">{f.views}</td>
                              <td className="py-1.5 px-2 text-right text-warm-800">{f.starts}</td>
                              <td className="py-1.5 px-2 text-right font-bold text-warm-900">{f.successes}</td>
                              <td className="py-1.5 px-2 text-right text-red-500">{f.errors}</td>
                              <td className="py-1.5 px-2 text-right text-orange-500">{f.paywalls}</td>
                              <td className="py-1.5 px-2 text-right text-warm-600">{Math.round(f.start_rate * 100)}%</td>
                              <td className="py-1.5 px-2 text-right text-warm-600">{Math.round(f.success_rate * 100)}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : <p className="text-sm text-warm-400">No funnel data yet</p>}
                  </div>

                  <div className="bg-white rounded-xl border border-warm-200/60 p-5">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-warm-400 mb-4">Event Drop-off</h2>
                    {funnelsData.dropOff && funnelsData.dropOff.length > 0 ? (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-warm-100">
                            <th className="text-left py-1 px-2 text-xs font-bold text-warm-400">Event</th>
                            <th className="text-right py-1 px-2 text-xs font-bold text-warm-400">Count</th>
                            <th className="text-right py-1 px-2 text-xs font-bold text-warm-400">Unique Visitors</th>
                          </tr>
                        </thead>
                        <tbody>
                          {funnelsData.dropOff.map((d: any, i: number) => (
                            <tr key={i} className="border-b border-warm-50">
                              <td className="py-1.5 px-2 text-warm-800 font-mono text-xs">{d.event}</td>
                              <td className="py-1.5 px-2 text-right font-bold text-warm-900">{d.n}</td>
                              <td className="py-1.5 px-2 text-right text-warm-600">{d.visitors}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : <p className="text-sm text-warm-400">No event data yet</p>}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Audience Tab ── */}
          {tab === 'audience' && (
            <div className="space-y-6">
              {!audienceData && <div className="text-warm-400 text-center py-12">Loading audience...</div>}
              {audienceData && (
                <>
                  <div className="bg-white rounded-xl border border-warm-200/60 p-5">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-warm-400 mb-4">New vs Returning (by day)</h2>
                    {audienceData.newVsReturning && audienceData.newVsReturning.length > 0 ? (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-warm-100">
                            <th className="text-left py-1 px-2 text-xs font-bold text-warm-400">Date</th>
                            <th className="text-right py-1 px-2 text-xs font-bold text-warm-400">New</th>
                            <th className="text-right py-1 px-2 text-xs font-bold text-warm-400">Returning</th>
                          </tr>
                        </thead>
                        <tbody>
                          {audienceData.newVsReturning.map((d: any) => (
                            <tr key={d.date} className="border-b border-warm-50">
                              <td className="py-1.5 px-2 text-warm-800 font-mono text-xs">{d.date}</td>
                              <td className="py-1.5 px-2 text-right text-green-600 font-bold">{d.new_visitors}</td>
                              <td className="py-1.5 px-2 text-right text-blue-600">{d.returning_visitors}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : <p className="text-sm text-warm-400">No visitor data yet</p>}
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="bg-white rounded-xl border border-warm-200/60 p-5">
                      <h2 className="text-xs font-bold uppercase tracking-wider text-warm-400 mb-4">By Device</h2>
                      {audienceData.byDevice && audienceData.byDevice.length > 0 ? (
                        <div className="space-y-2">
                          {audienceData.byDevice.map((d: any) => (
                            <div key={d.device} className="flex items-center justify-between">
                              <span className="text-sm text-warm-700 capitalize">{d.device}</span>
                              <span className="text-sm font-bold text-warm-900">{d.views}</span>
                            </div>
                          ))}
                        </div>
                      ) : <p className="text-sm text-warm-400">No data</p>}
                    </div>

                    <div className="bg-white rounded-xl border border-warm-200/60 p-5">
                      <h2 className="text-xs font-bold uppercase tracking-wider text-warm-400 mb-4">By Browser</h2>
                      {audienceData.byBrowser && audienceData.byBrowser.length > 0 ? (
                        <div className="space-y-2">
                          {audienceData.byBrowser.map((b: any) => (
                            <div key={b.browser} className="flex items-center justify-between">
                              <span className="text-sm text-warm-700">{b.browser}</span>
                              <span className="text-sm font-bold text-warm-900">{b.views}</span>
                            </div>
                          ))}
                        </div>
                      ) : <p className="text-sm text-warm-400">No data</p>}
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-warm-200/60 p-5">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-warm-400 mb-4">By Country</h2>
                    {audienceData.byCountry && audienceData.byCountry.length > 0 ? (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-warm-100">
                            <th className="text-left py-1 px-2 text-xs font-bold text-warm-400">Country</th>
                            <th className="text-right py-1 px-2 text-xs font-bold text-warm-400">Views</th>
                          </tr>
                        </thead>
                        <tbody>
                          {audienceData.byCountry.map((c: any) => (
                            <tr key={c.country} className="border-b border-warm-50">
                              <td className="py-1.5 px-2 text-warm-800 font-medium">{c.country}</td>
                              <td className="py-1.5 px-2 text-right font-bold text-warm-900">{c.views}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : <p className="text-sm text-warm-400">No country data</p>}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Tools Tab ── */}
          {tab === 'tools' && (
            <div className="space-y-6">
              {/* Tool API Usage */}
              <div className="bg-white rounded-xl border border-warm-200/60 p-5">
                <h2 className="text-xs font-bold uppercase tracking-wider text-warm-400 mb-4">
                  Tool API Usage ({days}d)
                </h2>
                {stats.toolUsage && stats.toolUsage.length > 0 ? (
                  <div className="space-y-2">
                    {stats.toolUsage.map(t => {
                      const max = Math.max(...stats.toolUsage.map(x => x.uses), 1);
                      const pct = Math.round((t.uses / max) * 100);
                      const name = t.endpoint.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                      return (
                        <div key={t.endpoint} className="flex items-center gap-3">
                          <span className="text-sm text-warm-700 w-36 flex-shrink-0 truncate font-medium">{name}</span>
                          <div className="flex-1 h-4 bg-warm-50 rounded-full overflow-hidden">
                            <div className="h-full bg-fire-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-sm font-bold text-warm-900 w-12 text-right">{t.uses}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-warm-400">No tool usage data yet</p>
                )}
              </div>

              {/* Tool Page Visits */}
              <div className="bg-white rounded-xl border border-warm-200/60 p-5">
                <h2 className="text-xs font-bold uppercase tracking-wider text-warm-400 mb-4">
                  Tool Page Visits ({days}d)
                </h2>
                {stats.toolVisits && stats.toolVisits.length > 0 ? (
                  <div className="space-y-2">
                    {stats.toolVisits.map(t => {
                      const max = Math.max(...stats.toolVisits.map(x => x.visits), 1);
                      const pct = Math.round((t.visits / max) * 100);
                      const name = t.path.replace('/projects/', '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                      return (
                        <div key={t.path} className="flex items-center gap-3">
                          <span className="text-sm text-warm-700 w-36 flex-shrink-0 truncate font-medium">{name}</span>
                          <div className="flex-1 h-4 bg-warm-50 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-sm font-bold text-warm-900 w-12 text-right">{t.visits}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-warm-400">No tool visit data yet</p>
                )}
              </div>

              {/* Referrers → Tools */}
              <div className="bg-white rounded-xl border border-warm-200/60 p-5">
                <h2 className="text-xs font-bold uppercase tracking-wider text-warm-400 mb-4">
                  Top Referrers ({days}d)
                </h2>
                {stats.byReferrer && stats.byReferrer.length > 0 ? (
                  <div className="space-y-2">
                    {aggregateReferrers(stats.byReferrer).slice(0, 10).map(r => (
                      <div key={r.source} className="flex items-center justify-between">
                        <span className="text-sm text-warm-700 truncate">{r.source}</span>
                        <span className="text-sm font-bold text-warm-900 ml-3">{r.views}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-warm-400">No referrer data yet</p>
                )}
              </div>

              {/* Referrer → Tool Mapping */}
              <div className="bg-white rounded-xl border border-warm-200/60 p-5">
                <h2 className="text-xs font-bold uppercase tracking-wider text-warm-400 mb-4">
                  Referrer → Tool ({days}d)
                </h2>
                {stats.referrerToTool && stats.referrerToTool.length > 0 ? (
                  <div className="space-y-2 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-warm-100">
                          <th className="text-left py-1 px-2 text-xs font-bold text-warm-400">Referrer</th>
                          <th className="text-left py-1 px-2 text-xs font-bold text-warm-400">Tool</th>
                          <th className="text-right py-1 px-2 text-xs font-bold text-warm-400">Visits</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.referrerToTool.map((r: any, i: number) => (
                          <tr key={i} className="border-b border-warm-50">
                            <td className="py-1.5 px-2 text-warm-600 truncate max-w-[150px]">{r.referrer.replace(/^https?:\/\//, '').replace(/\/$/, '')}</td>
                            <td className="py-1.5 px-2 text-warm-800 font-medium">{r.path.replace('/projects/', '').replace(/-/g, ' ')}</td>
                            <td className="py-1.5 px-2 text-right font-bold text-warm-900">{r.visits}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-warm-400">No referrer→tool data yet</p>
                )}
              </div>

              {/* Blog Traffic */}
              <div className="bg-white rounded-xl border border-warm-200/60 p-5">
                <h2 className="text-xs font-bold uppercase tracking-wider text-warm-400 mb-4">Blog Traffic ({days}d)</h2>
                {stats.blogTraffic && stats.blogTraffic.length > 0 ? (
                  <div className="space-y-2">
                    {stats.blogTraffic.map((b: any) => (
                      <div key={b.path} className="flex items-center justify-between">
                        <span className="text-sm text-warm-700 truncate">{b.path.replace('/blog/', '').replace(/-/g, ' ')}</span>
                        <span className="text-sm font-bold text-warm-900 ml-3">{b.views}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-warm-400">No blog traffic yet</p>
                )}
              </div>

              {/* Tool Health Summary */}
              <div className="bg-white rounded-xl border border-warm-200/60 p-5">
                <h2 className="text-xs font-bold uppercase tracking-wider text-warm-400 mb-4">All Projects</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { name: 'PageRoast', status: 'live', path: '/projects/page-roast/' },
                    { name: 'HeadlineGrader', status: 'live', path: '/projects/headline-grader/' },
                    { name: 'AdScorer', status: 'live', path: '/projects/ad-scorer/' },
                    { name: 'ThreadGrader', status: 'live', path: '/projects/thread-grader/' },
                    { name: 'EmailForge', status: 'live', path: '/projects/email-forge/' },
                    { name: 'AudienceDecoder', status: 'live', path: '/projects/audience-decoder/' },
                    { name: 'Stepproof', status: 'live', path: '/projects/stepproof/' },
                    { name: 'LaunchGrader', status: 'live', path: '/projects/launch-grader/' },
                    { name: 'StackAudit', status: 'live', path: '/projects/stack-audit/' },
                    { name: 'LocalScore', status: 'live', path: '/projects/local-score/' },
                    { name: 'AgentTrace', status: 'cli', path: '' },
                  ].map(p => (
                    <div key={p.name} className="border border-warm-100 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`w-2 h-2 rounded-full ${p.status === 'live' ? 'bg-green-500' : 'bg-warm-300'}`} />
                        <span className="text-sm font-bold text-warm-800">{p.name}</span>
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-warm-400">
                        {p.status === 'live' ? 'LIVE' : 'CLI ONLY'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          {/* ── Manifests Tab ── */}
          {tab === 'manifests' && (
            <div className="space-y-6">
              {!manifestsData && <div className="text-warm-400 text-center py-12">Loading manifests...</div>}
              {manifestsData && (
                <div className="bg-white rounded-xl border border-warm-200/60 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-warm-400">Published Sibling Manifests</h2>
                    {manifestsData.latestKitVersion && (
                      <span className="text-xs text-warm-400">latest host-kit: <code className="font-mono text-warm-700">{manifestsData.latestKitVersion}</code></span>
                    )}
                  </div>
                  {manifestsData.manifests?.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-warm-100">
                            <th className="text-left py-1.5 px-2 text-xs font-bold text-warm-400">Slug</th>
                            <th className="text-left py-1.5 px-2 text-xs font-bold text-warm-400">Version</th>
                            <th className="text-left py-1.5 px-2 text-xs font-bold text-warm-400">Host-Kit</th>
                            <th className="text-left py-1.5 px-2 text-xs font-bold text-warm-400">Drift</th>
                            <th className="text-left py-1.5 px-2 text-xs font-bold text-warm-400">Git SHA</th>
                            <th className="text-left py-1.5 px-2 text-xs font-bold text-warm-400">Built</th>
                            <th className="text-right py-1.5 px-2 text-xs font-bold text-warm-400">Size (gz)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {manifestsData.manifests.map((m: any) => (
                            <tr key={m.slug} className="border-b border-warm-50">
                              <td className="py-2 px-2 font-mono text-xs text-warm-800 font-semibold">{m.slug}</td>
                              <td className="py-2 px-2 font-mono text-xs text-warm-600">{m.version}</td>
                              <td className="py-2 px-2 font-mono text-xs text-warm-600">{m.hostKitVersion}</td>
                              <td className="py-2 px-2">
                                {m.hostKitDrift === 'current' && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700">current</span>
                                )}
                                {m.hostKitDrift === 'minor_behind' && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-yellow-100 text-yellow-700">-1 minor</span>
                                )}
                                {m.hostKitDrift === 'major_behind' && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">outdated</span>
                                )}
                              </td>
                              <td className="py-2 px-2 font-mono text-xs text-warm-500">{m.gitSha?.slice(0, 7)}</td>
                              <td className="py-2 px-2 text-xs text-warm-500">{timeAgo(m.builtAt)}</td>
                              <td className="py-2 px-2 text-right text-xs text-warm-600 font-mono">{m.bundleSizeKb} KB</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-warm-400">No manifests yet. Build and publish a sibling app with <code className="font-mono text-xs">emit-manifest.mjs</code> to populate this table.</p>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
