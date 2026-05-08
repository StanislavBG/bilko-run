import { useState, useEffect, useCallback, useRef } from 'react';
import { useUser, useAuth } from '@clerk/clerk-react';
import { Navigate } from 'react-router-dom';
import { ADMIN_EMAILS } from '../../constants.js';

const API = import.meta.env.VITE_API_URL || '/api';

type DriftStatus = 'current' | 'minor_behind' | 'major_behind' | 'unknown';

interface Row {
  slug: string;
  manifest: {
    version: string | null;
    gitSha: string | null;
    hostKit: string | null;
    builtAt: string | null;
    bundleGz: number | null;
  };
  traffic24h: number;
  errors24h: number;
  warnLogs24h: number;
  errorLogs24h: number;
  synthetic: {
    passes: number;
    fails: number;
    loadP50: number | null;
    loadP95: number | null;
    latestOk: boolean | null;
  };
  hostKitDrift: DriftStatus;
  openAlerts: { kind: string; details: string }[];
  latestError: { msg: string; ts: number } | null;
}

interface ObservabilityResponse {
  rows: Row[];
  latestKit: string | null;
  generatedAt: number;
}

type SortKey = 'slug' | 'errors24h' | 'loadP50' | 'hostKitDrift';

const DRIFT_ORDER: Record<DriftStatus, number> = {
  current: 0, minor_behind: 1, major_behind: 2, unknown: 3,
};

const REFRESH_OPTIONS = [
  { label: '30s', ms: 30_000 },
  { label: '1m',  ms: 60_000 },
  { label: '5m',  ms: 300_000 },
  { label: 'Off', ms: 0 },
] as const;

const SORT_COLS: { key: SortKey; label: string }[] = [
  { key: 'slug',         label: 'App' },
  { key: 'errors24h',   label: 'Errors 24h' },
  { key: 'loadP50',     label: 'Latency p50' },
  { key: 'hostKitDrift', label: 'Kit Drift' },
];

function rowHasData(row: Row): boolean {
  return row.synthetic.latestOk !== null || row.errors24h > 0 || row.traffic24h > 0;
}

function statusPill(row: Row): { color: string; label: string } {
  if (!rowHasData(row)) return { color: 'bg-warm-100 text-warm-400', label: '—' };
  if (row.synthetic.latestOk === false || row.errors24h > 50)
    return { color: 'bg-red-100 text-red-700', label: 'Alert' };
  if (row.synthetic.latestOk === null || (row.errors24h >= 5 && row.errors24h <= 50))
    return { color: 'bg-yellow-100 text-yellow-700', label: 'Warn' };
  return { color: 'bg-green-100 text-green-700', label: 'OK' };
}

function fmtBytes(bytes: number | null): string {
  if (bytes === null) return '—';
  return `${Math.round(bytes / 1024)} KB`;
}

function fmtMs(ms: number | null): string {
  if (ms === null) return '—';
  return `${Math.round(ms)}ms`;
}

function fmtCount(n: number, hasData: boolean): string {
  if (!hasData && n === 0) return '—';
  return n.toLocaleString();
}

function DriftBadge({ drift }: { drift: DriftStatus }) {
  if (drift === 'current')
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700">current</span>;
  if (drift === 'minor_behind')
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-yellow-100 text-yellow-700">-1 minor</span>;
  if (drift === 'major_behind')
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">outdated</span>;
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-warm-100 text-warm-500">unknown</span>;
}

export function ObservabilityPage() {
  const { user, isLoaded } = useUser();
  const { getToken } = useAuth();
  const email = user?.primaryEmailAddress?.emailAddress?.toLowerCase() ?? '';
  const isAdmin = ADMIN_EMAILS.includes(email);

  const [data, setData] = useState<ObservabilityResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshMs, setRefreshMs] = useState(30_000);
  const [sortKey, setSortKey] = useState<SortKey>('slug');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await fetch(`${API}/admin/observability`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) { setError('Failed to load observability data'); return; }
      setData(await res.json());
      setError(null);
    } catch {
      setError('Network error');
    }
  }, [getToken]);

  useEffect(() => {
    if (!isAdmin) return;
    load().finally(() => setLoading(false));
  }, [isAdmin, load]);

  useEffect(() => {
    if (!isAdmin) return;
    if (timerRef.current) clearInterval(timerRef.current);
    if (refreshMs > 0) {
      timerRef.current = setInterval(() => load(), refreshMs);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isAdmin, refreshMs, load]);

  useEffect(() => {
    document.title = 'Observability — bilko.run';
    return () => { document.title = 'Bilko.run — Tools for Makers Who Ship'; };
  }, []);

  if (isLoaded && !isAdmin) return <Navigate to="/" replace />;
  if (!isLoaded) return <div className="p-12 text-center text-warm-400">Loading...</div>;

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  }

  function sortedRows(): Row[] {
    if (!data?.rows) return [];
    return [...data.rows].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'slug') {
        cmp = a.slug.localeCompare(b.slug);
      } else if (sortKey === 'errors24h') {
        cmp = a.errors24h - b.errors24h;
      } else if (sortKey === 'loadP50') {
        const ap = a.synthetic.loadP50 ?? Infinity;
        const bp = b.synthetic.loadP50 ?? Infinity;
        cmp = ap - bp;
      } else if (sortKey === 'hostKitDrift') {
        cmp = (DRIFT_ORDER[a.hostKitDrift] ?? 3) - (DRIFT_ORDER[b.hostKitDrift] ?? 3);
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }

  const openAlertCount = data?.rows.reduce((acc, r) => acc + r.openAlerts.length, 0) ?? 0;
  const rows = sortedRows();

  return (
    <div className="max-w-7xl mx-auto px-4 py-10 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-warm-900">Observability</h1>
          <p className="text-warm-500 text-sm mt-1">
            {data
              ? `Updated ${new Date(data.generatedAt * 1000).toLocaleTimeString()} · 24h window`
              : 'Loading…'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {openAlertCount > 0 && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700">
              {openAlertCount} alert{openAlertCount !== 1 ? 's' : ''}
            </span>
          )}
          <div className="flex items-center gap-1">
            <span className="text-xs text-warm-500 mr-1">Refresh:</span>
            {REFRESH_OPTIONS.map(opt => (
              <button
                key={opt.label}
                onClick={() => setRefreshMs(opt.ms)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                  refreshMs === opt.ms
                    ? 'bg-fire-500 text-white'
                    : 'bg-warm-100 text-warm-600 hover:bg-warm-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}
      {loading && <div className="text-warm-400 text-center py-16">Loading…</div>}

      {data && (
        <>
          <div className="overflow-x-auto rounded-xl border border-warm-200/60 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-warm-100 text-xs font-bold text-warm-400 uppercase tracking-wide">
                  <th className="text-left px-4 py-3">Status</th>
                  {SORT_COLS.map(({ key, label }) => (
                    <th
                      key={key}
                      className="text-left px-4 py-3 cursor-pointer select-none hover:text-warm-700 transition-colors"
                      onClick={() => toggleSort(key)}
                    >
                      {label} {sortKey === key ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                    </th>
                  ))}
                  <th className="text-left px-4 py-3">Version / SHA</th>
                  <th className="text-right px-4 py-3">Traffic</th>
                  <th className="text-right px-4 py-3">Warn logs</th>
                  <th className="text-right px-4 py-3">Synth%</th>
                  <th className="text-right px-4 py-3">p95</th>
                  <th className="text-right px-4 py-3">Bundle</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => {
                  const hasData = rowHasData(row);
                  const pill = statusPill(row);
                  const synthTotal = row.synthetic.passes + row.synthetic.fails;
                  const passRate = synthTotal > 0
                    ? Math.round((row.synthetic.passes / synthTotal) * 100)
                    : null;
                  const errorTitle = row.latestError
                    ? `Latest error: ${row.latestError.msg}`
                    : undefined;

                  return (
                    <tr
                      key={row.slug}
                      className="border-b border-warm-50 hover:bg-warm-50/50 transition-colors"
                      title={errorTitle}
                    >
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${pill.color}`}>
                          {pill.label}
                        </span>
                      </td>
                      {/* Slug — sortable, links to live URL */}
                      <td className="px-4 py-3">
                        <a
                          href={`/projects/${row.slug}/`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-xs font-semibold text-warm-800 hover:text-fire-600 transition-colors"
                        >
                          {row.slug}
                        </a>
                        {row.openAlerts.length > 0 && (
                          <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-100 text-red-600">
                            {row.openAlerts.length}
                          </span>
                        )}
                      </td>
                      {/* Errors 24h — sortable */}
                      <td className="px-4 py-3">
                        <span className={`font-mono text-xs ${
                          row.errors24h > 50 ? 'text-red-600 font-bold'
                          : row.errors24h >= 5 ? 'text-yellow-600'
                          : 'text-warm-700'
                        }`}>
                          {fmtCount(row.errors24h, hasData)}
                        </span>
                      </td>
                      {/* Latency p50 — sortable */}
                      <td className="px-4 py-3 font-mono text-xs text-warm-600">
                        {fmtMs(row.synthetic.loadP50)}
                      </td>
                      {/* Kit drift — sortable */}
                      <td className="px-4 py-3">
                        <DriftBadge drift={row.hostKitDrift} />
                      </td>
                      {/* Version + SHA */}
                      <td className="px-4 py-3">
                        <div className="font-mono text-xs text-warm-700">{row.manifest.version ?? '—'}</div>
                        {row.manifest.gitSha && (
                          <div className="font-mono text-[10px] text-warm-400">{row.manifest.gitSha.slice(0, 7)}</div>
                        )}
                      </td>
                      {/* Traffic */}
                      <td className="px-4 py-3 text-right font-mono text-xs text-warm-700">
                        {fmtCount(row.traffic24h, hasData)}
                      </td>
                      {/* Warn logs */}
                      <td className="px-4 py-3 text-right font-mono text-xs">
                        <span className={`${(row.warnLogs24h + row.errorLogs24h) > 0 ? 'text-yellow-600' : 'text-warm-500'}`}>
                          {fmtCount(row.warnLogs24h + row.errorLogs24h, hasData)}
                        </span>
                      </td>
                      {/* Synth pass rate */}
                      <td className="px-4 py-3 text-right font-mono text-xs">
                        {passRate !== null ? (
                          <span className={`font-semibold ${
                            passRate === 100 ? 'text-green-600'
                            : passRate >= 80 ? 'text-yellow-600'
                            : 'text-red-600'
                          }`}>
                            {passRate}%
                          </span>
                        ) : (
                          <span className="text-warm-400">—</span>
                        )}
                      </td>
                      {/* p95 */}
                      <td className="px-4 py-3 text-right font-mono text-xs text-warm-500">
                        {fmtMs(row.synthetic.loadP95)}
                      </td>
                      {/* Bundle */}
                      <td className="px-4 py-3 text-right font-mono text-xs text-warm-600">
                        {fmtBytes(row.manifest.bundleGz)}
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={11} className="text-center py-12 text-warm-400 text-sm">
                      No manifests published yet. Run{' '}
                      <code className="font-mono text-xs">emit-manifest.mjs</code> from a sibling
                      app to populate this dashboard.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {data.latestKit && (
            <p className="text-xs text-warm-400">
              Latest host-kit: <code className="font-mono">{data.latestKit}</code>
            </p>
          )}
        </>
      )}
    </div>
  );
}
