import { useState, useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import { Navigate } from 'react-router-dom';

import { useAdminResource, useIsAdmin } from '../hooks/useAdmin.js';
import { StatCard, type Stats } from './admin/analytics/parts.js';
import { OverviewTab, UsersTab, RoastsTab, ActivityTab } from './admin/analytics/ActivityTabs.js';
import { SourcesTab, FunnelsTab, AudienceTab, ToolsTab } from './admin/analytics/GrowthTabs.js';
import { SyntheticTab, ManifestsTab } from './admin/analytics/OpsTabs.js';

const TABS = ['overview', 'sources', 'funnels', 'audience', 'users', 'roasts', 'activity', 'tools', 'manifests', 'synthetic'] as const;

export function AdminPage() {
  const { isLoaded } = useUser();
  const isAdmin = useIsAdmin();

  const [days, setDays] = useState(7);
  const [excludeSelf, setExcludeSelf] = useState(true);
  const [tab, setTab] = useState<(typeof TABS)[number]>('overview');
  const { data: stats, loading } = useAdminResource<Stats>(
    `/analytics/stats?days=${days}&exclude_self=${excludeSelf ? '1' : '0'}`,
    { enabled: isAdmin },
  );

  useEffect(() => {
    document.title = 'Admin — bilko.run';
    return () => { document.title = 'Bilko.run — Tools for Makers Who Ship'; };
  }, []);

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
            {TABS.map(t => (
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

          {tab === 'synthetic' && <SyntheticTab />}
          {tab === 'manifests' && <ManifestsTab />}
        </>
      )}
    </section>
  );
}
