import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';

const API = import.meta.env.VITE_API_URL || '/api';

interface DayRow { date: string; hits: number; visitors: number }
interface PageRow { path: string; hits: number; visitors: number }
interface ReferrerRow { host: string; hits: number }
interface SlugRow { slug: string; hits: number; visitors: number }
interface CountryRow { country: string; hits: number }
interface DeviceRow { device: string; hits: number }
interface BrowserRow { browser: string; hits: number }
interface ClickRow { path: string; tag: string | null; label: string | null; href: string | null; clicks: number; visitors: number }
interface RecentRow {
  ts: number;
  path: string;
  status: number;
  referrerHost: string | null;
  country: string | null;
  device: string;
  browser: string;
  os: string;
  isBot: boolean;
}

interface TrafficResponse {
  days: number;
  totals: { hits: number; visitors: number; botHits: number; notFound: number; clicks: number };
  byDay: DayRow[];
  topPages: PageRow[];
  topReferrers: ReferrerRow[];
  bySlug: SlugRow[];
  byCountry: CountryRow[];
  byDevice: DeviceRow[];
  byBrowser: BrowserRow[];
  topClicks: ClickRow[];
  recent: RecentRow[];
  earliestDate: string | null;
  generatedAt: number;
}

const TH = 'px-4 py-3 text-xs font-bold text-warm-400 uppercase tracking-wide';

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-warm-200/60 bg-white px-4 py-3">
      <div className="text-xs font-bold text-warm-400 uppercase tracking-wide">{label}</div>
      <div className="text-2xl font-extrabold text-warm-900 mt-1">{value.toLocaleString()}</div>
    </div>
  );
}

interface Col<T> { header: string; align?: 'right'; render: (row: T) => React.ReactNode }

function DataTable<T>({ title, rows, cols, rowKey, emptyText, onRowClick, selectedKey }: {
  title: string;
  rows: T[];
  cols: Col<T>[];
  rowKey: (row: T) => string;
  emptyText: string;
  onRowClick?: (row: T) => void;
  selectedKey?: string | null;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-warm-200/60 bg-white">
      <div className="px-4 py-3 border-b border-warm-100 text-xs font-bold text-warm-600 uppercase tracking-wide">
        {title}
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-warm-100">
            {cols.map(c => (
              <th key={c.header} className={`${TH} ${c.align === 'right' ? 'text-right' : 'text-left'}`}>{c.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => {
            const key = rowKey(row);
            return (
              <tr
                key={key}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={`border-b border-warm-50 hover:bg-warm-50/50 transition-colors ${
                  onRowClick ? 'cursor-pointer' : ''
                } ${selectedKey === key ? 'bg-fire-50' : ''}`}
              >
                {cols.map(c => (
                  <td
                    key={c.header}
                    className={`px-4 py-3 font-mono text-xs text-warm-700 ${c.align === 'right' ? 'text-right' : ''}`}
                  >
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr><td colSpan={cols.length} className="text-center py-8 text-warm-400 text-sm">{emptyText}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// Server-side page hits (page_hits table) — who visits which pages. Human
// aggregates exclude bots and error responses; the recent list includes bots.
export function TrafficPanel() {
  const { getToken } = useAuth();
  const [data, setData] = useState<TrafficResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(7);
  const [slug, setSlug] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const token = await getToken();
      const slugParam = slug ? `&slug=${encodeURIComponent(slug)}` : '';
      const res = await fetch(`${API}/admin/traffic?days=${days}${slugParam}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) { setError(`Failed to load traffic data (HTTP ${res.status})`); return; }
      const body: TrafficResponse = await res.json();
      setData(body);
      setError(null);
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, [getToken, days, slug]);

  useEffect(() => { load(); }, [load]);

  const empty = data
    ? `No hits recorded yet${data.earliestDate ? ` — recording since ${data.earliestDate}` : ''}`
    : '';
  const maxDayHits = data ? Math.max(1, ...data.byDay.map(d => d.hits)) : 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-extrabold text-warm-900">Traffic</h2>
          <p className="text-warm-500 text-sm mt-1">
            Who visits which pages — recorded server-side on every HTML response.
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

      {slug && (
        <button
          onClick={() => setSlug(null)}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-fire-100 text-fire-700 hover:bg-fire-200"
        >
          Filtered to <span className="font-mono">{slug}</span> ×
        </button>
      )}

      {error && <p className="text-red-500 text-sm">{error}</p>}
      {loading && !data && !error && <div className="text-warm-400 text-center py-16">Loading traffic…</div>}

      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Stat label="Hits" value={data.totals.hits} />
            <Stat label="Unique visitors" value={data.totals.visitors} />
            <Stat label="Bot hits" value={data.totals.botHits} />
            <Stat label="404s" value={data.totals.notFound} />
            <Stat label="Clicks" value={data.totals.clicks} />
          </div>

          <div className="rounded-xl border border-warm-200/60 bg-white">
            <div className="px-4 py-3 border-b border-warm-100 text-xs font-bold text-warm-600 uppercase tracking-wide">
              Hits per day
            </div>
            <div className="px-4 py-3 space-y-1.5">
              {data.byDay.map(d => (
                <div key={d.date} className="flex items-center gap-3 text-xs">
                  <span className="w-24 font-mono text-warm-500">{d.date}</span>
                  <div className="flex-1 h-3 bg-warm-50 rounded">
                    <div className="h-3 bg-fire-500 rounded" style={{ width: `${(d.hits / maxDayHits) * 100}%` }} />
                  </div>
                  <span className="w-28 text-right font-mono text-warm-700">
                    {d.hits.toLocaleString()} · {d.visitors.toLocaleString()} uv
                  </span>
                </div>
              ))}
              {data.byDay.length === 0 && (
                <p className="text-center py-5 text-warm-400 text-sm">{empty}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <DataTable
              title="Top pages"
              rows={data.topPages}
              rowKey={r => r.path}
              emptyText={empty}
              cols={[
                { header: 'Path', render: r => r.path },
                { header: 'Hits', align: 'right', render: r => r.hits.toLocaleString() },
                { header: 'Visitors', align: 'right', render: r => r.visitors.toLocaleString() },
              ]}
            />
            <DataTable
              title="Top referrers"
              rows={data.topReferrers}
              rowKey={r => r.host}
              emptyText={empty}
              cols={[
                { header: 'Referrer', render: r => r.host },
                { header: 'Hits', align: 'right', render: r => r.hits.toLocaleString() },
              ]}
            />
            <DataTable
              title="Projects (click to filter)"
              rows={data.bySlug}
              rowKey={r => r.slug}
              emptyText={empty}
              onRowClick={r => setSlug(r.slug)}
              selectedKey={slug}
              cols={[
                { header: 'Project', render: r => r.slug },
                { header: 'Hits', align: 'right', render: r => r.hits.toLocaleString() },
                { header: 'Visitors', align: 'right', render: r => r.visitors.toLocaleString() },
              ]}
            />
            <DataTable
              title="Countries"
              rows={data.byCountry}
              rowKey={r => r.country}
              emptyText={empty}
              cols={[
                { header: 'Country', render: r => r.country },
                { header: 'Hits', align: 'right', render: r => r.hits.toLocaleString() },
              ]}
            />
            <DataTable
              title="Devices"
              rows={data.byDevice}
              rowKey={r => r.device}
              emptyText={empty}
              cols={[
                { header: 'Device', render: r => r.device },
                { header: 'Hits', align: 'right', render: r => r.hits.toLocaleString() },
              ]}
            />
            <DataTable
              title="Browsers"
              rows={data.byBrowser}
              rowKey={r => r.browser}
              emptyText={empty}
              cols={[
                { header: 'Browser', render: r => r.browser },
                { header: 'Hits', align: 'right', render: r => r.hits.toLocaleString() },
              ]}
            />
          </div>

          <DataTable
            title="Top clicks"
            rows={data.topClicks}
            rowKey={r => `${r.path}|${r.tag}|${r.label}|${r.href}`}
            emptyText="No clicks recorded yet"
            cols={[
              { header: 'Page', render: r => r.path },
              { header: 'Element', render: r => r.label || r.tag || '—' },
              { header: 'Target', render: r => r.href ?? '—' },
              { header: 'Clicks', align: 'right', render: r => r.clicks.toLocaleString() },
              { header: 'Visitors', align: 'right', render: r => r.visitors.toLocaleString() },
            ]}
          />

          <div className="overflow-x-auto rounded-xl border border-warm-200/60 bg-white">
            <div className="px-4 py-3 border-b border-warm-100 text-xs font-bold text-warm-600 uppercase tracking-wide">
              Recent hits
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-warm-100">
                  {['Time', 'Path', 'Status', 'Referrer', 'Country', 'Device', 'Browser', 'OS'].map(h => (
                    <th key={h} className={`${TH} text-left`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.recent.map((r, i) => (
                  <tr
                    key={`${r.ts}:${i}`}
                    className={`border-b border-warm-50 ${r.isBot ? 'bg-warm-50 text-warm-400 italic' : 'text-warm-700'}`}
                  >
                    <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">{new Date(r.ts).toLocaleString()}</td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {r.path}
                      {r.isBot && (
                        <span className="ml-2 px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700 text-[10px] font-bold not-italic">BOT</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{r.status}</td>
                    <td className="px-4 py-3 font-mono text-xs">{r.referrerHost ?? '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs">{r.country ?? '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs">{r.device}</td>
                    <td className="px-4 py-3 font-mono text-xs">{r.browser}</td>
                    <td className="px-4 py-3 font-mono text-xs">{r.os}</td>
                  </tr>
                ))}
                {data.recent.length === 0 && (
                  <tr><td colSpan={8} className="text-center py-8 text-warm-400 text-sm">{empty}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
