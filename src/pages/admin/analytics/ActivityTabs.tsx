import { useAdminResource } from '../../../hooks/useAdmin.js';
import { BarChart, LoadingState, aggregateReferrers, type Stats } from './parts.js';

interface TabProps {
  days: number;
  excludeSelf: boolean;
}

function useStats({ days, excludeSelf }: TabProps) {
  return useAdminResource<Stats>(`/analytics/stats?days=${days}&exclude_self=${excludeSelf ? '1' : '0'}`);
}

export function OverviewTab(props: TabProps) {
  const { data: stats, error, loading } = useStats(props);
  if (!stats) return <LoadingState loading={loading} error={error} />;
  return (
    <>
      {/* Views by Day */}
      <div className="mb-6">
        <div className="bg-white rounded-xl border border-warm-200/60 p-5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-warm-400 mb-4">Views by Day</h2>
          <BarChart data={stats.byDay.map(d => ({ key: d.date.slice(5), value: d.views }))} label="views" />
        </div>
      </div>

      {/* Daily Active Users */}
      <div className="bg-white rounded-xl border border-warm-200/60 p-5 mb-6">
        <h2 className="text-xs font-bold uppercase tracking-wider text-warm-400 mb-4">Daily Active Users</h2>
        <BarChart data={(stats.dailyActiveUsers ?? []).map(d => ({ key: d.date.slice(5), value: d.users }))} label="users" color="bg-purple-400" />
      </div>

      {/* Bot traffic — captured but excluded from real-visitor numbers */}
      <div className="bg-white rounded-xl border border-warm-200/60 p-5 mb-6">
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-warm-400">Bot &amp; Crawler Traffic</h2>
          <span className="text-xs text-warm-400">excluded from numbers above · captured for the record</span>
        </div>
        <div className="flex items-baseline gap-4 mb-4">
          <span className="text-3xl font-black text-warm-900">{stats.botViews ?? 0}</span>
          <span className="text-sm text-warm-500">bot hits in last {stats.period.days}d</span>
        </div>
        {stats.botUserAgents && stats.botUserAgents.length > 0 ? (
          <div className="space-y-1">
            {stats.botUserAgents.map(b => (
              <div key={b.ua} className="flex items-center justify-between text-xs">
                <span className="text-warm-600 font-mono truncate" title={b.ua}>{b.ua.slice(0, 80)}</span>
                <span className="text-warm-900 font-bold ml-3">{b.views}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-warm-400">No bot traffic logged yet.</p>
        )}
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
    </>
  );
}
