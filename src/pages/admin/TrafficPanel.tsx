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
  ip: string | null;
  ua: string | null;
  referrer: string | null;
  visitorId: string | null;
  userEmail: string | null;
  isAdmin: boolean;
}
interface VisitorRow {
  visitorId: string;
  ip: string | null;
  country: string | null;
  device: string | null;
  browser: string | null;
  os: string | null;
  userEmail: string | null;
  isAdmin: boolean;
  hits: number;
  clicks: number;
  pages: number;
  firstSeen: number;
  lastSeen: number;
}
interface TimelineEvent {
  ts: number;
  kind: 'hit' | 'click';
  path: string;
  status?: number;
  label?: string;
  href?: string;
  referrer?: string;
  ip: string | null;
  ua: string | null;
}
interface VisitorResponse { visitorId: string; days: number; events: TimelineEvent[]; generatedAt: number }

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
  visitors: VisitorRow[];
  earliestDate: string | null;
  generatedAt: number;
}

const fmtTime = (ts: number) => new Date(ts).toLocaleString(undefined, { timeZoneName: 'short' });
const shortId = (id: string) => (id.length > 10 ? `${id.slice(0, 8)}…` : id);

function YouBadge() {
  return (
    <span className="ml-2 px-1.5 py-0.5 rounded bg-fire-100 text-fire-700 text-[10px] font-bold not-italic">you</span>
  );
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
  const [hideSelf, setHideSelf] = useState(false);
  const [selectedVisitor, setSelectedVisitor] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<VisitorResponse | null>(null);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineError, setTimelineError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const token = await getToken();
      const slugParam = slug ? `&slug=${encodeURIComponent(slug)}` : '';
      const selfParam = hideSelf ? '&self=exclude' : '';
      const res = await fetch(`${API}/admin/traffic?days=${days}${slugParam}${selfParam}`, {
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
  }, [getToken, days, slug, hideSelf]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!selectedVisitor) return;
    let cancelled = false;
    setTimelineLoading(true);
    setTimelineError(null);
    setTimeline(null);
    (async () => {
      try {
        const token = await getToken();
        const res = await fetch(`${API}/admin/traffic/visitor/${encodeURIComponent(selectedVisitor)}?days=${days}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (cancelled) return;
        if (!res.ok) { setTimelineError(`Failed to load visitor timeline (HTTP ${res.status})`); return; }
        const body: VisitorResponse = await res.json();
        if (!cancelled) setTimeline(body);
      } catch {
        if (!cancelled) setTimelineError('Network error');
      } finally {
        if (!cancelled) setTimelineLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedVisitor, days, getToken]);

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

      <label className="inline-flex items-center gap-2 text-xs text-warm-600 cursor-pointer">
        <input type="checkbox" checked={hideSelf} onChange={e => setHideSelf(e.target.checked)} />
        Hide my own traffic
      </label>

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

          <DataTable
            title="Visitors (click for timeline)"
            rows={data.visitors ?? []}
            rowKey={r => r.visitorId}
            emptyText={empty}
            onRowClick={r => setSelectedVisitor(r.visitorId)}
            selectedKey={selectedVisitor}
            cols={[
              { header: 'Visitor', render: r => <span title={r.visitorId}>{shortId(r.visitorId)}{r.isAdmin && <YouBadge />}</span> },
              { header: 'IP', render: r => r.ip ?? '—' },
              { header: 'Country', render: r => r.country ?? '—' },
              { header: 'Device', render: r => r.device ?? '—' },
              { header: 'Email', render: r => r.userEmail ?? '—' },
              { header: 'Hits', align: 'right', render: r => r.hits.toLocaleString() },
              { header: 'Clicks', align: 'right', render: r => r.clicks.toLocaleString() },
              { header: 'Pages', align: 'right', render: r => r.pages.toLocaleString() },
              { header: 'First seen', render: r => fmtTime(r.firstSeen) },
              { header: 'Last seen', render: r => fmtTime(r.lastSeen) },
            ]}
          />

          {selectedVisitor && (
            <div className="rounded-xl border border-warm-200/60 bg-white">
              <div className="px-4 py-3 border-b border-warm-100 flex items-center justify-between">
                <span className="text-xs font-bold text-warm-600 uppercase tracking-wide">
                  Visitor timeline <span className="font-mono normal-case" title={selectedVisitor}>{shortId(selectedVisitor)}</span>
                </span>
                <button
                  onClick={() => { setSelectedVisitor(null); setTimeline(null); }}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-warm-100 text-warm-600 hover:bg-warm-200"
                >
                  Close ×
                </button>
              </div>
              {timelineError && <p className="text-red-500 text-sm px-4 py-3">{timelineError}</p>}
              {timelineLoading && <div className="text-warm-400 text-center py-8">Loading timeline…</div>}
              {timeline && (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-warm-100">
                      {['Time', 'Event', 'Path', 'Detail', 'IP'].map(h => (
                        <th key={h} className={`${TH} text-left`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {timeline.events.map((e, i) => (
                      <tr key={`${e.ts}:${i}`} className="border-b border-warm-50 text-warm-700">
                        <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">{fmtTime(e.ts)}</td>
                        <td className="px-4 py-3 font-mono text-xs">{e.kind}</td>
                        <td className="px-4 py-3 font-mono text-xs" title={e.ua ?? undefined}>{e.path}</td>
                        <td className="px-4 py-3 font-mono text-xs">
                          {e.kind === 'hit'
                            ? `${e.status ?? ''}${e.referrer ? ` ← ${e.referrer}` : ''}`
                            : `${e.label ?? '—'}${e.href ? ` → ${e.href}` : ''}`}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">{e.ip ?? '—'}</td>
                      </tr>
                    ))}
                    {timeline.events.length === 0 && (
                      <tr><td colSpan={5} className="text-center py-8 text-warm-400 text-sm">No events for this visitor in this window</td></tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          )}

          <DataTable
            title="Recent hits"
            rows={data.recent}
            rowKey={r => `${r.ts}:${r.path}:${r.visitorId}:${r.ip}`}
            emptyText={empty}
            cols={[
              { header: 'Time', render: r => <span className="whitespace-nowrap">{fmtTime(r.ts)}</span> },
              {
                header: 'Path',
                render: r => (
                  <span className={r.isBot ? 'text-warm-400 italic' : ''}>
                    {r.path}
                    {r.isBot && (
                      <span className="ml-2 px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700 text-[10px] font-bold not-italic">BOT</span>
                    )}
                  </span>
                ),
              },
              { header: 'Status', render: r => r.status },
              { header: 'IP', render: r => r.ip ?? '—' },
              { header: 'Country', render: r => r.country ?? '—' },
              { header: 'Device / Browser / OS', render: r => <span title={r.ua ?? undefined}>{r.device} / {r.browser} / {r.os}</span> },
              { header: 'Referrer', render: r => <span title={r.referrer ?? undefined}>{r.referrerHost ?? '—'}</span> },
              { header: 'Email', render: r => r.userEmail ?? '—' },
              {
                header: 'Visitor',
                render: r => r.visitorId ? (
                  <>
                    <button
                      onClick={() => setSelectedVisitor(r.visitorId)}
                      title={r.visitorId}
                      className="underline text-fire-700 hover:text-fire-500"
                    >
                      {shortId(r.visitorId)}
                    </button>
                    {r.isAdmin && <YouBadge />}
                  </>
                ) : <>{'—'}{r.isAdmin && <YouBadge />}</>,
              },
            ]}
          />
        </>
      )}
    </div>
  );
}
