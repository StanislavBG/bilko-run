import { useState, useEffect } from 'react';
import { useUser, useAuth } from '@clerk/clerk-react';
import { Navigate } from 'react-router-dom';

import { ADMIN_EMAILS } from '../constants.js';

const API = import.meta.env.VITE_API_URL || '/api';

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
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-warm-200/60 p-5">
      <div className="text-xs font-bold uppercase tracking-wider text-warm-400 mb-1">{label}</div>
      <div className="text-3xl font-black text-warm-900">{value}</div>
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
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'overview' | 'users' | 'roasts' | 'activity'>('overview');

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
      const s = await fetch(`${API}/analytics/stats?days=${days}`, { headers }).then(res => res.json());
      setStats(s);
    })().catch(() => {}).finally(() => setLoading(false));
  }, [isAdmin, days]);

  if (isLoaded && !isAdmin) return <Navigate to="/" replace />;
  if (!isLoaded) return <div className="p-12 text-center text-warm-400">Loading...</div>;

  return (
    <section className="max-w-6xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-extrabold text-warm-900">Admin Dashboard</h1>
        <div className="flex gap-2">
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
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
            <StatCard label="Views Today" value={stats.todayViews} />
            <StatCard label={`Views (${days}d)`} value={stats.views} />
            <StatCard label="Total Roasts" value={stats.totalRoasts} />
            <StatCard label="Total Users" value={stats.totalUsers} />
            <StatCard label="Purchases" value={stats.tokenPurchases} sub={`${stats.revenue.single} single + ${stats.revenue.bundle} bundle`} />
            <StatCard label="Revenue" value={`$${stats.revenue.total}`} sub={`$${stats.revenue.single} + $${stats.revenue.bundle * 5}`} />
          </div>

          {/* Tab Nav */}
          <div className="flex gap-1 bg-warm-100 rounded-xl p-1 mb-6 w-fit">
            {(['overview', 'users', 'roasts', 'activity'] as const).map(t => (
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
                    {stats.byReferrer.map(r => (
                      <div key={r.referrer} className="flex items-center justify-between">
                        <span className="text-sm text-warm-700 truncate">{r.referrer.replace(/^https?:\/\//, '').replace(/\/$/, '')}</span>
                        <span className="text-sm font-bold text-warm-900 ml-3">{r.views}</span>
                      </div>
                    ))}
                    {stats.byReferrer.length === 0 && <p className="text-sm text-warm-400">No referrer data</p>}
                  </div>
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
        </>
      )}
    </section>
  );
}
