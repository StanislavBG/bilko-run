import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';

const API = import.meta.env.VITE_API_URL || '/api';

interface RouteRow { method: string; route: string; requests: number; bytes: number; bytesPerRequest: number }
interface SlugRow { slug: string; requests: number; bytes: number; bytesPerRequest: number }
interface AssetRow { slug: string; path: string; requests: number; bytes: number }

interface EgressResponse {
  rows: RouteRow[];
  bySlug: SlugRow[];
  totalBytes: number;
  assets: AssetRow[];
  earliestDate: string | null;
  days: number;
  generatedAt: number;
}

function fmtBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

// This view answers "where are the bytes going" over the egress tables
// directly — it is deliberately NOT keyed off app_manifests, so a project
// with traffic and no published manifest still shows up here, and static
// host chrome (`_host`) / unrecognised slugs (`_other`) surface as their
// own rows instead of being dropped.
export function BandwidthPanel() {
  const { getToken } = useAuth();
  const [data, setData] = useState<EgressResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(7);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [assets, setAssets] = useState<AssetRow[] | null>(null);

  const load = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await fetch(`${API}/admin/egress?days=${days}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) { setError('Failed to load bandwidth data'); return; }
      const body: EgressResponse = await res.json();
      setData(body);
      setError(null);
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, [getToken, days]);

  useEffect(() => { load(); }, [load]);

  const loadAssetsForSlug = useCallback(async (slug: string) => {
    setSelectedSlug(slug);
    setAssets(null);
    try {
      const token = await getToken();
      const res = await fetch(`${API}/admin/egress?days=${days}&slug=${encodeURIComponent(slug)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) return;
      const body: EgressResponse = await res.json();
      // Guard against a slower earlier request resolving after a later click
      // switched the selection — only apply the response if it's still current.
      setSelectedSlug(current => {
        if (current === slug) setAssets(body.assets);
        return current;
      });
    } catch {
      // Drilldown failure isn't worth a top-level error banner.
    }
  }, [getToken, days]);

  if (loading) return <div className="text-warm-400 text-center py-16">Loading bandwidth…</div>;
  if (error) return <p className="text-red-500 text-sm">{error}</p>;
  if (!data) return null;

  // "Metering never ran" (table has zero rows, ever) reads very differently
  // from "ran fine, nothing in this window" — conflating the two makes a
  // healthy-but-quiet window look like a broken pipeline.
  const meteringNeverRan = data.earliestDate === null;
  const noTrafficInWindow = !meteringNeverRan && data.bySlug.length === 0 && data.rows.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-extrabold text-warm-900">Bandwidth</h2>
          <p className="text-warm-500 text-sm mt-1">
            Where the bytes actually go — driven by egress tables, not manifests.
          </p>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-warm-500 mr-1">Window:</span>
          {[1, 7, 30].map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                days === d ? 'bg-fire-500 text-white' : 'bg-warm-100 text-warm-600 hover:bg-warm-200'
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {meteringNeverRan && (
        <p className="text-sm text-warm-400 bg-warm-50 rounded-lg px-4 py-3">
          Bandwidth metering has not started — <code className="font-mono text-xs">api_egress_daily</code> has
          no rows in this database at all. This is not an error; it means no request has ever been flushed
          through the meter here (fresh/local DB, or the 60s flush hasn't run yet).
        </p>
      )}

      {noTrafficInWindow && (
        <p className="text-sm text-warm-400 bg-warm-50 rounded-lg px-4 py-3">
          No traffic recorded in the last {days}d — metering has been running since{' '}
          <code className="font-mono text-xs">{data.earliestDate}</code>, there's just nothing in this window.
          Try a wider window.
        </p>
      )}

      {!meteringNeverRan && !noTrafficInWindow && (
        <>
          <p className="text-xs text-warm-400">
            <code className="font-mono">static:_host</code> currently absorbs some top-level static
            directories that belong to real projects (e.g. a project's data tree served outside{' '}
            <code className="font-mono">/projects/&lt;slug&gt;/</code>) — treat it as inflated, not
            purely host chrome. <code className="font-mono">static:_other</code> is traffic to an
            unrecognised project slug.
          </p>

          {/* Per-project bandwidth — from api_egress_daily's static:<slug> rows, no manifest join */}
          <div className="overflow-x-auto rounded-xl border border-warm-200/60 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-warm-100 text-xs font-bold text-warm-400 uppercase tracking-wide">
                  <th className="text-left px-4 py-3">Project (static:slug)</th>
                  <th className="text-right px-4 py-3">Requests</th>
                  <th className="text-right px-4 py-3">Bytes</th>
                  <th className="text-right px-4 py-3">Bytes / req</th>
                </tr>
              </thead>
              <tbody>
                {data.bySlug.map(row => (
                  <tr
                    key={row.slug}
                    onClick={() => loadAssetsForSlug(row.slug)}
                    className={`border-b border-warm-50 hover:bg-warm-50/50 transition-colors cursor-pointer ${
                      selectedSlug === row.slug ? 'bg-fire-50' : ''
                    }`}
                  >
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-warm-800">{row.slug}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-warm-700">{row.requests.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-warm-700">{fmtBytes(row.bytes)}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-warm-500">{fmtBytes(row.bytesPerRequest)}</td>
                  </tr>
                ))}
                {data.bySlug.length === 0 && (
                  <tr><td colSpan={4} className="text-center py-8 text-warm-400 text-sm">No static egress in this window.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Per-file drilldown for the selected project */}
          {selectedSlug && (
            <div className="overflow-x-auto rounded-xl border border-warm-200/60 bg-white">
              <div className="px-4 py-3 border-b border-warm-100 text-xs font-bold text-warm-600 uppercase tracking-wide">
                Top files — <span className="font-mono normal-case">{selectedSlug}</span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-warm-100 text-xs font-bold text-warm-400 uppercase tracking-wide">
                    <th className="text-left px-4 py-3">Path</th>
                    <th className="text-right px-4 py-3">Requests</th>
                    <th className="text-right px-4 py-3">Bytes</th>
                  </tr>
                </thead>
                <tbody>
                  {assets === null && (
                    <tr><td colSpan={3} className="text-center py-8 text-warm-400 text-sm">Loading…</td></tr>
                  )}
                  {assets?.map(a => (
                    <tr key={a.path} className={`border-b border-warm-50 ${a.path === '_rest' ? 'italic' : ''}`}>
                      <td className="px-4 py-3 font-mono text-xs text-warm-700">
                        {a.path === '_rest' ? 'everything else (folded, not top 50)' : a.path}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-warm-700">{a.requests.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-warm-700">{fmtBytes(a.bytes)}</td>
                    </tr>
                  ))}
                  {assets !== null && assets.length === 0 && (
                    <tr><td colSpan={3} className="text-center py-8 text-warm-400 text-sm">No per-file data for this project in this window.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Top routes by bytes — the /api/* GET /api/admin/egress data, now with a UI */}
          <div className="overflow-x-auto rounded-xl border border-warm-200/60 bg-white">
            <div className="px-4 py-3 border-b border-warm-100 text-xs font-bold text-warm-600 uppercase tracking-wide">
              Top routes by bytes
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-warm-100 text-xs font-bold text-warm-400 uppercase tracking-wide">
                  <th className="text-left px-4 py-3">Method</th>
                  <th className="text-left px-4 py-3">Route</th>
                  <th className="text-right px-4 py-3">Requests</th>
                  <th className="text-right px-4 py-3">Bytes</th>
                  <th className="text-right px-4 py-3">Bytes / req</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map(row => (
                  <tr key={`${row.method}:${row.route}`} className="border-b border-warm-50">
                    <td className="px-4 py-3 font-mono text-xs text-warm-500">{row.method}</td>
                    <td className="px-4 py-3 font-mono text-xs text-warm-800">{row.route}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-warm-700">{row.requests.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-warm-700">{fmtBytes(row.bytes)}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-warm-500">{fmtBytes(row.bytesPerRequest)}</td>
                  </tr>
                ))}
                {data.rows.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-8 text-warm-400 text-sm">No route egress in this window.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
