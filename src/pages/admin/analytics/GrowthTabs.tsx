import { useAdminResource } from '../../../hooks/useAdmin.js';
import { LoadingState } from './parts.js';

interface TabProps {
  days: number;
  excludeSelf: boolean;
}

function sinceDate(days: number): string {
  return new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
}

function useGrowthResource(kind: 'sources' | 'funnels', { days, excludeSelf }: TabProps) {
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
