import { useState, useEffect } from 'react';
import { useUser, useAuth } from '@clerk/clerk-react';
import { Navigate } from 'react-router-dom';

const API = import.meta.env.VITE_API_URL || '/api';
const ADMIN_EMAILS = ['bilkobibitkov2000@gmail.com'];

interface Stats {
  period: { days: number; since: string };
  views: number;
  todayViews: number;
  totalRoasts: number;
  totalUsers: number;
  byDay: Array<{ date: string; views: number }>;
  byPage: Array<{ path: string; views: number }>;
  byReferrer: Array<{ referrer: string; views: number }>;
}

interface RecentRoast {
  url: string;
  score: number;
  grade: string;
  roast: string;
  created_at: string;
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

export function AdminPage() {
  const { user, isLoaded } = useUser();
  const { getToken } = useAuth();
  const email = user?.primaryEmailAddress?.emailAddress?.toLowerCase() ?? '';
  const isAdmin = ADMIN_EMAILS.includes(email);

  const [days, setDays] = useState(7);
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentRoasts, setRecentRoasts] = useState<RecentRoast[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = 'Admin — bilko.run';
    return () => { document.title = 'Bilko.run — Tools for Makers Who Ship'; };
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    setLoading(true);
    Promise.all([
      fetch(`${API}/analytics/stats?days=${days}`).then(r => r.json()),
      fetch(`${API}/roasts/recent`).then(r => r.json()),
    ]).then(([s, r]) => {
      setStats(s);
      if (Array.isArray(r)) setRecentRoasts(r);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [isAdmin, days]);

  if (isLoaded && !isAdmin) return <Navigate to="/" replace />;
  if (!isLoaded) return <div className="p-12 text-center text-warm-400">Loading...</div>;

  return (
    <section className="max-w-5xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8">
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatCard label="Views Today" value={stats.todayViews} />
            <StatCard label={`Views (${days}d)`} value={stats.views} />
            <StatCard label="Total Roasts" value={stats.totalRoasts} />
            <StatCard label="Total Users" value={stats.totalUsers} />
          </div>

          {/* Views by Day */}
          <div className="bg-white rounded-xl border border-warm-200/60 p-5 mb-6">
            <h2 className="text-xs font-bold uppercase tracking-wider text-warm-400 mb-4">Views by Day</h2>
            {stats.byDay.length === 0 ? (
              <p className="text-sm text-warm-400">No data yet</p>
            ) : (
              <div className="space-y-2">
                {stats.byDay.map(d => {
                  const max = Math.max(...stats.byDay.map(x => x.views), 1);
                  const pct = Math.round((d.views / max) * 100);
                  return (
                    <div key={d.date} className="flex items-center gap-3">
                      <span className="text-xs text-warm-500 w-20 flex-shrink-0 font-mono">{d.date.slice(5)}</span>
                      <div className="flex-1 h-5 bg-warm-50 rounded-full overflow-hidden">
                        <div className="h-full bg-fire-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs font-bold text-warm-700 w-10 text-right">{d.views}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Two columns: Pages + Referrers */}
          <div className="grid md:grid-cols-2 gap-6 mb-8">
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
        </>
      )}

      {/* Recent Roasts Log */}
      <div className="bg-white rounded-xl border border-warm-200/60 p-5">
        <h2 className="text-xs font-bold uppercase tracking-wider text-warm-400 mb-4">Recent Roasts (All Users)</h2>
        <div className="space-y-2">
          {recentRoasts.map((r, i) => (
            <div key={i} className="flex items-center gap-3 py-2 border-b border-warm-100 last:border-0">
              <div className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center font-black text-xs ${
                r.grade.startsWith('A') ? 'bg-green-100 text-green-700' :
                r.grade.startsWith('B') ? 'bg-blue-100 text-blue-700' :
                r.grade.startsWith('C') ? 'bg-yellow-100 text-yellow-700' :
                r.grade === 'D' ? 'bg-orange-100 text-orange-700' :
                'bg-red-100 text-red-700'
              }`}>
                {r.grade}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-warm-800">{r.url}</span>
                  <span className="text-xs text-warm-400">{r.score}/100</span>
                </div>
                <p className="text-xs text-warm-500 truncate italic">{r.roast}</p>
              </div>
              <span className="text-xs text-warm-400 flex-shrink-0">{r.created_at?.slice(0, 16)}</span>
            </div>
          ))}
          {recentRoasts.length === 0 && <p className="text-sm text-warm-400">No roasts yet</p>}
        </div>
      </div>
    </section>
  );
}
