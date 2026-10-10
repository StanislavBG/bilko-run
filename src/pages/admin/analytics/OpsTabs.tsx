import { useAdminResource } from '../../../hooks/useAdmin.js';
import { DriftBadge, type DriftStatus } from '../DriftBadge.js';
import { LoadingState, timeAgo } from './parts.js';

interface SyntheticCell {
  date: string;
  ok: boolean | null;
  error?: string | null;
  loadMs?: number | null;
}

interface SyntheticGridRow {
  slug: string;
  alert: { firstFailedAt: number } | null;
  streak: number;
  latestOk: boolean | null;
  latestError: string | null;
  latestRanAt: number | null;
  p50: number | null;
  p95: number | null;
  dayGrid: SyntheticCell[];
}

interface ManifestRow {
  slug: string;
  version: string;
  hostKitVersion: string;
  hostKitDrift: DriftStatus;
  gitSha?: string;
  builtAt: string;
  bundleSizeKb: number;
}

interface ManifestsResponse {
  latestKitVersion?: string | null;
  manifests?: ManifestRow[];
}

export function SyntheticTab() {
  const { data, error, loading } = useAdminResource<{ grid?: SyntheticGridRow[] }>('/admin/synthetic/grid?days=30');
  return (
    <div className="space-y-6">
      <LoadingState loading={loading} error={error} label="synthetic runs" />
      {data && (
        <>
          {/* Open alerts */}
          {data.grid?.some((g) => g.alert) && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-5">
              <h2 className="text-xs font-bold uppercase tracking-wider text-red-500 mb-3">Open Alerts</h2>
              <div className="space-y-2">
                {data.grid.filter((g) => g.alert).map((g) => (
                  <div key={g.slug} className="flex items-center justify-between text-sm">
                    <span className="font-mono font-semibold text-red-700">{g.slug}</span>
                    <span className="text-red-500 text-xs">
                      {g.streak}× consecutive fail · since {new Date((g.alert?.firstFailedAt ?? 0) * 1000).toLocaleDateString()}
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
          {data.grid?.length === 0 && (
            <p className="text-sm text-warm-400 text-center py-8">No sibling manifests registered. Publish a sibling app first.</p>
          )}
          {data.grid?.map((g) => (
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
                {g.dayGrid.map((cell) => (
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
  );
}

export function ManifestsTab() {
  const { data, error, loading } = useAdminResource<ManifestsResponse>('/admin/manifests');
  return (
    <div className="space-y-6">
      <LoadingState loading={loading} error={error} label="manifests" />
      {data && (
        <div className="bg-white rounded-xl border border-warm-200/60 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-warm-400">Published Sibling Manifests</h2>
            {data.latestKitVersion && (
              <span className="text-xs text-warm-400">latest host-kit: <code className="font-mono text-warm-700">{data.latestKitVersion}</code></span>
            )}
          </div>
          {(data.manifests?.length ?? 0) > 0 ? (
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
                  {data.manifests?.map((m) => (
                    <tr key={m.slug} className="border-b border-warm-50">
                      <td className="py-2 px-2 font-mono text-xs text-warm-800 font-semibold">{m.slug}</td>
                      <td className="py-2 px-2 font-mono text-xs text-warm-600">{m.version}</td>
                      <td className="py-2 px-2 font-mono text-xs text-warm-600">{m.hostKitVersion}</td>
                      <td className="py-2 px-2">
                        <DriftBadge drift={m.hostKitDrift} />
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
  );
}
