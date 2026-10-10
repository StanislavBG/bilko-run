import { useState, useEffect } from 'react';
import { useUser, useAuth } from '@clerk/clerk-react';
import { Navigate } from 'react-router-dom';

import { ADMIN_EMAILS } from '../constants.js';
import { StatCard, timeAgo, type Stats } from './admin/analytics/parts.js';
import { OverviewTab, UsersTab, RoastsTab, ActivityTab } from './admin/analytics/ActivityTabs.js';
import { SourcesTab, FunnelsTab, AudienceTab, ToolsTab } from './admin/analytics/GrowthTabs.js';

const API = import.meta.env.VITE_API_URL || '/api';

export function AdminPage() {
  const { user, isLoaded } = useUser();
  const { getToken } = useAuth();
  const email = user?.primaryEmailAddress?.emailAddress?.toLowerCase() ?? '';
  const isAdmin = ADMIN_EMAILS.includes(email);

  const [days, setDays] = useState(7);
  const [excludeSelf, setExcludeSelf] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'overview' | 'users' | 'roasts' | 'activity' | 'tools' | 'sources' | 'funnels' | 'audience' | 'manifests' | 'synthetic'>('overview');
  const [manifestsData, setManifestsData] = useState<any | null>(null);
  const [syntheticData, setSyntheticData] = useState<any | null>(null);

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
      setManifestsData(null); setSyntheticData(null);
    })().catch(() => {}).finally(() => setLoading(false));
  }, [isAdmin, days, excludeSelf]);

  useEffect(() => {
    if (!isAdmin || tab !== 'manifests' || manifestsData) return;
    (async () => {
      const token = await getToken();
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const data = await fetch(`${API}/admin/manifests`, { headers }).then(r => r.json());
      setManifestsData(data);
    })().catch(() => {});
  }, [isAdmin, tab, manifestsData]);

  useEffect(() => {
    if (!isAdmin || tab !== 'synthetic' || syntheticData) return;
    (async () => {
      const token = await getToken();
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const data = await fetch(`${API}/admin/synthetic/grid?days=30`, { headers }).then(r => r.json());
      setSyntheticData(data);
    })().catch(() => {});
  }, [isAdmin, tab, syntheticData]);

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
            {(['overview', 'sources', 'funnels', 'audience', 'users', 'roasts', 'activity', 'tools', 'manifests', 'synthetic'] as const).map(t => (
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

          {tab === 'overview' && <OverviewTab days={days} excludeSelf={excludeSelf} />}
          {tab === 'users' && <UsersTab days={days} excludeSelf={excludeSelf} />}
          {tab === 'roasts' && <RoastsTab days={days} excludeSelf={excludeSelf} />}
          {tab === 'activity' && <ActivityTab days={days} excludeSelf={excludeSelf} />}

          {tab === 'sources' && <SourcesTab days={days} excludeSelf={excludeSelf} />}
          {tab === 'funnels' && <FunnelsTab days={days} excludeSelf={excludeSelf} />}
          {tab === 'audience' && <AudienceTab days={days} excludeSelf={excludeSelf} />}
          {tab === 'tools' && <ToolsTab days={days} excludeSelf={excludeSelf} />}

          {/* ── Synthetic Tab ── */}
          {tab === 'synthetic' && (
            <div className="space-y-6">
              {!syntheticData && <div className="text-warm-400 text-center py-12">Loading synthetic runs...</div>}
              {syntheticData && (
                <>
                  {/* Open alerts */}
                  {syntheticData.grid?.some((g: any) => g.alert) && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-5">
                      <h2 className="text-xs font-bold uppercase tracking-wider text-red-500 mb-3">Open Alerts</h2>
                      <div className="space-y-2">
                        {syntheticData.grid.filter((g: any) => g.alert).map((g: any) => (
                          <div key={g.slug} className="flex items-center justify-between text-sm">
                            <span className="font-mono font-semibold text-red-700">{g.slug}</span>
                            <span className="text-red-500 text-xs">
                              {g.streak}× consecutive fail · since {new Date(g.alert.firstFailedAt * 1000).toLocaleDateString()}
                            </span>
                            {g.latestError && (
                              <span className="text-xs text-red-400 truncate max-w-xs ml-3">{g.latestError}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Per-sibling grids */}
                  {syntheticData.grid?.length === 0 && (
                    <p className="text-sm text-warm-400 text-center py-8">No sibling manifests registered. Publish a sibling app first.</p>
                  )}
                  {syntheticData.grid?.map((g: any) => (
                    <div key={g.slug} className="bg-white rounded-xl border border-warm-200/60 p-5">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <span className={`w-2.5 h-2.5 rounded-full ${g.latestOk === true ? 'bg-green-500' : g.latestOk === false ? 'bg-red-500' : 'bg-warm-300'}`} />
                          <span className="font-mono font-bold text-warm-800 text-sm">{g.slug}</span>
                          {g.streak > 0 && (
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-red-100 text-red-600">
                              {g.streak}× fail streak
                            </span>
                          )}
                        </div>
                        <div className="flex gap-4 text-xs text-warm-400">
                          {g.p50 != null && <span>p50 {g.p50}ms</span>}
                          {g.p95 != null && <span>p95 {g.p95}ms</span>}
                          {g.latestRanAt && (
                            <span>last run {new Date(g.latestRanAt * 1000).toLocaleString()}</span>
                          )}
                        </div>
                      </div>

                      {/* 30-day grid */}
                      <div className="flex gap-0.5 flex-wrap">
                        {g.dayGrid.map((cell: any) => (
                          <div
                            key={cell.date}
                            title={`${cell.date}${cell.ok === null ? ' — no data' : cell.ok ? ' — pass' : ` — fail${cell.error ? ': ' + cell.error : ''}`}${cell.loadMs ? ` (${cell.loadMs}ms)` : ''}`}
                            className={`w-3.5 h-3.5 rounded-sm cursor-default ${
                              cell.ok === null ? 'bg-warm-100' : cell.ok ? 'bg-green-400' : 'bg-red-400'
                            }`}
                          />
                        ))}
                      </div>

                      {g.latestError && (
                        <p className="mt-2 text-xs text-red-500 font-mono truncate">{g.latestError}</p>
                      )}
                    </div>
                  ))}
                </>
              )}
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
