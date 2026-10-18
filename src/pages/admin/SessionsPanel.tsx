import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';

const API = import.meta.env.VITE_API_URL || '/api';

interface SessionRow {
  session_id: string;
  visitor_id: string;
  email: string | null;
  started_at: number;
  ended_at: number;
  duration_ms: number;
  landing_path: string | null;
  exit_path: string | null;
  page_count: number;
  click_count: number;
  event_count: number;
  error_count: number;
  apps: string[];
}
interface SessionsResponse { sessions: SessionRow[] }

type TimelineItem =
  | { ts: number; kind: 'view'; path: string; referrer: string | null }
  | { ts: number; kind: 'click'; path: string; label: string | null; href: string | null; track_name: string | null }
  | { ts: number; kind: 'event'; name: string; app: string | null; path: string | null; props: unknown }
  | { ts: number; kind: 'error'; app: string; name: string | null; msg: string; url: string | null };
interface SessionDetail {
  session: { started_at: number } | null;
  timeline: TimelineItem[];
}

const fmtTime = (ts: number) => new Date(ts).toLocaleString(undefined, { timeZoneName: 'short' });
const shortId = (id: string) => (id.length > 10 ? `${id.slice(0, 8)}…` : id);
const fmtMmSs = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const TH = 'px-4 py-3 text-xs font-bold text-warm-400 uppercase tracking-wide';
const INPUT = 'px-2.5 py-1 text-xs rounded-lg border border-warm-200 bg-white text-warm-700 w-40';

const KIND_STYLE: Record<TimelineItem['kind'], string> = {
  view: 'bg-warm-100 text-warm-600',
  click: 'bg-fire-100 text-fire-700',
  event: 'bg-yellow-100 text-yellow-700',
  error: 'bg-red-100 text-red-700',
};

function describe(e: TimelineItem): string {
  switch (e.kind) {
    case 'view': return e.referrer ? `← ${e.referrer}` : '';
    case 'click':
      return [e.track_name ? `[${e.track_name}]` : '', e.label ?? '', e.href ? `→ ${e.href}` : '']
        .filter(Boolean).join(' ') || '—';
    case 'event': return e.name;
    case 'error': return `${e.name ? `${e.name}: ` : ''}${e.msg}`;
  }
}

function entryPath(e: TimelineItem): string {
  if (e.kind === 'event') return e.path ?? e.app ?? '—';
  if (e.kind === 'error') return e.url ?? e.app;
  return e.path;
}

// Cross-app session list + per-session journey (page_views, click_events,
// funnel_events and app_errors joined by the shared session id).
export function SessionsPanel() {
  const { getToken } = useAuth();
  const [days, setDays] = useState(1);
  const [email, setEmail] = useState('');
  const [visitor, setVisitor] = useState('');
  const [app, setApp] = useState('');
  const [data, setData] = useState<SessionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<SessionRow | null>(null);
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const token = await getToken();
        const qs = new URLSearchParams({ days: String(days) });
        if (email.trim()) qs.set('email', email.trim());
        if (visitor.trim()) qs.set('visitor', visitor.trim());
        if (app.trim()) qs.set('app', app.trim());
        const res = await fetch(`${API}/admin/sessions?${qs}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (cancelled) return;
        if (!res.ok) { setError(`Failed to load sessions (HTTP ${res.status})`); return; }
        const body: SessionsResponse = await res.json();
        if (cancelled) return;
        setData({ sessions: Array.isArray(body?.sessions) ? body.sessions : [] });
        setError(null);
      } catch {
        if (!cancelled) setError('Network error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [getToken, days, email, visitor, app]);

  const selectedId = selected?.session_id ?? null;
  const loadDetail = useCallback(async (id: string, isCancelled: () => boolean) => {
    try {
      const token = await getToken();
      const res = await fetch(`${API}/admin/sessions/${encodeURIComponent(id)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (isCancelled()) return;
      if (!res.ok) { setDetailError(`Failed to load session (HTTP ${res.status})`); return; }
      const body: SessionDetail = await res.json();
      if (!isCancelled()) setDetail({ session: body?.session ?? null, timeline: Array.isArray(body?.timeline) ? body.timeline : [] });
    } catch {
      if (!isCancelled()) setDetailError('Network error');
    } finally {
      if (!isCancelled()) setDetailLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    setDetailLoading(true);
    setDetailError(null);
    setDetail(null);
    loadDetail(selectedId, () => cancelled);
    return () => { cancelled = true; };
  }, [selectedId, loadDetail]);

  const sessions = data?.sessions ?? [];
  const startTs = detail?.session?.started_at ?? selected?.started_at ?? detail?.timeline[0]?.ts ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-warm-900">Sessions</h2>
          <p className="text-warm-500 text-sm mt-1">
            Where each visitor landed, where they went and what they clicked — across the host and every app.
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

      <div className="flex items-center gap-2 flex-wrap">
        <input className={INPUT} placeholder="email" value={email} onChange={e => setEmail(e.target.value)} />
        <input className={INPUT} placeholder="visitor id" value={visitor} onChange={e => setVisitor(e.target.value)} />
        <input className={INPUT} placeholder="app (slug)" value={app} onChange={e => setApp(e.target.value)} />
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}
      {loading && !data && !error && <div className="text-warm-400 text-center py-16">Loading sessions…</div>}

      {data && (
        <div className="overflow-x-auto rounded-xl border border-warm-200/60 bg-white">
          <div className="px-4 py-3 border-b border-warm-100 text-xs font-bold text-warm-600 uppercase tracking-wide">
            Recent sessions (click for journey)
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-warm-100">
                {['Started', 'User', 'Landing → Exit', 'Apps', 'Pages', 'Clicks', 'Events', 'Errors', 'Duration'].map((h, i) => (
                  <th key={h} className={`${TH} ${i >= 4 && i <= 7 ? 'text-right' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sessions.map(s => (
                <tr
                  key={s.session_id}
                  onClick={() => setSelected(s)}
                  className={`border-b border-warm-50 hover:bg-warm-50/50 transition-colors cursor-pointer ${
                    selectedId === s.session_id ? 'bg-fire-50' : ''
                  }`}
                >
                  <td className="px-4 py-3 font-mono text-xs text-warm-700 whitespace-nowrap">{fmtTime(s.started_at)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-warm-700" title={s.visitor_id}>{s.email ?? shortId(s.visitor_id)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-warm-700">
                    {s.landing_path ?? '—'} → {s.exit_path ?? '—'}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-warm-700">
                    {s.apps.length === 0 ? '—' : s.apps.map(a => (
                      <span key={a} className="mr-1 px-1.5 py-0.5 rounded bg-warm-100 text-warm-600 text-[10px] font-bold">{a}</span>
                    ))}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-warm-700 text-right">{s.page_count.toLocaleString()}</td>
                  <td className="px-4 py-3 font-mono text-xs text-warm-700 text-right">{s.click_count.toLocaleString()}</td>
                  <td className="px-4 py-3 font-mono text-xs text-warm-700 text-right">{s.event_count.toLocaleString()}</td>
                  <td className={`px-4 py-3 font-mono text-xs text-right ${s.error_count > 0 ? 'text-red-500 font-bold' : 'text-warm-700'}`}>
                    {s.error_count.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-warm-700 whitespace-nowrap">{fmtMmSs(s.duration_ms)}</td>
                </tr>
              ))}
              {sessions.length === 0 && (
                <tr><td colSpan={9} className="text-center py-8 text-warm-400 text-sm">No sessions in this window</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <div className="rounded-xl border border-warm-200/60 bg-white">
          <div className="px-4 py-3 border-b border-warm-100 flex items-center justify-between">
            <span className="text-xs font-bold text-warm-600 uppercase tracking-wide">
              Session journey <span className="font-mono normal-case" title={selected.session_id}>{shortId(selected.session_id)}</span>
            </span>
            <button
              onClick={() => { setSelected(null); setDetail(null); }}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-warm-100 text-warm-600 hover:bg-warm-200"
            >
              Close ×
            </button>
          </div>
          {detailError && <p className="text-red-500 text-sm px-4 py-3">{detailError}</p>}
          {detailLoading && <div className="text-warm-400 text-center py-8">Loading journey…</div>}
          {detail && (
            <ol className="px-4 py-3 space-y-2 border-l-2 border-warm-100 ml-4 my-2">
              {detail.timeline.map((e, i) => (
                <li key={`${e.ts}:${i}`} className="flex items-start gap-3 text-xs font-mono text-warm-700">
                  <span className="w-12 shrink-0 text-warm-500">+{fmtMmSs(e.ts - startTs)}</span>
                  <span className={`w-12 shrink-0 text-center px-1.5 py-0.5 rounded text-[10px] font-bold ${KIND_STYLE[e.kind]}`}>
                    {e.kind}
                  </span>
                  <span className="shrink-0 max-w-[16rem] truncate" title={entryPath(e)}>{entryPath(e)}</span>
                  <span className={`break-all ${e.kind === 'error' ? 'text-red-500' : 'text-warm-500'}`}>{describe(e)}</span>
                </li>
              ))}
              {detail.timeline.length === 0 && (
                <li className="text-center py-5 text-warm-400 text-sm list-none">No events for this session</li>
              )}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}
