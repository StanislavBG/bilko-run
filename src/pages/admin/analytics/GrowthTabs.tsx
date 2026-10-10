import { useMemo } from 'react';
import { useAdminResource } from '../../../hooks/useAdmin.js';
import { PROJECTS } from '../../../data/projectsRegistry.js';
import { LoadingState, aggregateReferrers, type Stats } from './parts.js';

interface TabProps {
  days: number;
  excludeSelf: boolean;
}

function sinceDate(days: number): string {
  return new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
}

function useGrowthResource(kind: 'sources' | 'funnels' | 'audience', { days, excludeSelf }: TabProps) {
  return useAdminResource<any>(`/analytics/${kind}?since=${sinceDate(days)}&exclude_self=${excludeSelf ? '1' : '0'}`);
}

export function SourcesTab(props: TabProps) {
  const { data: sourcesData, error, loading } = useGrowthResource('sources', props);
  if (!sourcesData) return <LoadingState loading={loading} error={error} label="sources" />;
  return (
    <div className="space-y-6">
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
    </div>
  );
}

export function FunnelsTab(props: TabProps) {
  const { data: funnelsData, error, loading } = useGrowthResource('funnels', props);
  if (!funnelsData) return <LoadingState loading={loading} error={error} label="funnels" />;
  return (
    <div className="space-y-6">
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
    </div>
  );
}

export function AudienceTab(props: TabProps) {
  const { data: audienceData, error, loading } = useGrowthResource('audience', props);
  if (!audienceData) return <LoadingState loading={loading} error={error} label="audience" />;
  return (
    <div className="space-y-6">
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
    </div>
  );
}

const maxOf = (xs: number[]) => Math.max(...xs, 1);

export function ToolsTab({ days, excludeSelf }: TabProps) {
  const { data: stats, error, loading } = useAdminResource<Stats>(`/analytics/stats?days=${days}&exclude_self=${excludeSelf ? '1' : '0'}`);
  const maxUses = useMemo(() => maxOf((stats?.toolUsage ?? []).map(x => x.uses)), [stats]);
  const maxVisits = useMemo(() => maxOf((stats?.toolVisits ?? []).map(x => x.visits)), [stats]);
  const projects = useMemo(() => PROJECTS.filter(p => p.status !== 'archived'), []);
  if (!stats) return <LoadingState loading={loading} error={error} label="tools" />;
  return (
    <div className="space-y-6">
        {/* Tool API Usage */}
        <div className="bg-white rounded-xl border border-warm-200/60 p-5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-warm-400 mb-4">
            Tool API Usage ({days}d)
          </h2>
          {stats.toolUsage && stats.toolUsage.length > 0 ? (
            <div className="space-y-2">
              {stats.toolUsage.map(t => {
                const pct = Math.round((t.uses / maxUses) * 100);
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
                const pct = Math.round((t.visits / maxVisits) * 100);
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

      {/* Project Health Summary (from the registry) */}
      <div className="bg-white rounded-xl border border-warm-200/60 p-5">
        <h2 className="text-xs font-bold uppercase tracking-wider text-warm-400 mb-4">All Projects</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {projects.map(p => (
            <div key={p.slug} className="border border-warm-100 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className={`w-2 h-2 rounded-full ${p.status === 'live' ? 'bg-green-500' : 'bg-warm-300'}`} />
                <span className="text-sm font-bold text-warm-800">{p.name}</span>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-warm-400">{p.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
