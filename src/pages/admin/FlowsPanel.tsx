import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { fmtTime } from '../../lib/format';

const API = import.meta.env.VITE_API_URL || '/api';

interface AppHealth {
  app: string;
  sessions: number;
  views: number;
  clicks: number;
  events: number;
  errors: number;
  error_sessions: number;
  last_seen_ms: number;
}
interface FlowStep { step: string; sessions: number; first_seen_ms: number }
interface Flow { app: string; flow: string; steps: FlowStep[]; total_sessions: number }
interface FlowsResponse { apps: AppHealth[]; flows: Flow[] }

const TH = 'px-4 py-3 text-xs font-bold text-warm-400 uppercase tracking-wide';
const SELECT = 'px-2.5 py-1 text-xs rounded-lg border border-warm-200 bg-white text-warm-700';

// Per-app health (sessions/views/clicks/events/errors) plus a step funnel for
// each primary flow an app tags with trackFlow.
export function FlowsPanel() {
  const { getToken } = useAuth();
  const [days, setDays] = useState(7);
  const [app, setApp] = useState('');
  const [data, setData] = useState<FlowsResponse | null>(null);
  const [appOptions, setAppOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const token = await getToken();
        const qs = new URLSearchParams({ days: String(days) });
        if (app) qs.set('app', app);
        const res = await fetch(`${API}/admin/flows?${qs}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (cancelled) return;
        if (!res.ok) { setError(`Failed to load flows (HTTP ${res.status})`); return; }
        const body: FlowsResponse = await res.json();
        if (cancelled) return;
        const apps = Array.isArray(body?.apps) ? body.apps : [];
        setData({ apps, flows: Array.isArray(body?.flows) ? body.flows : [] });
        // Keep every app ever seen so filtering to one doesn't empty the select.
        setAppOptions(prev => [...new Set([...prev, ...apps.map(a => a.app)])].sort());
        setError(null);
      } catch {
        if (!cancelled) setError('Network error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [getToken, days, app]);

  const apps = data?.apps ?? [];
  const flows = data?.flows ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-warm-900">App health &amp; flows</h2>
          <p className="text-warm-500 text-sm mt-1">
            Traffic and errors per app, and how far sessions get through each tagged primary flow.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select className={SELECT} value={app} onChange={e => setApp(e.target.value)} aria-label="App filter">
            <option value="">All apps</option>
            {appOptions.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
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
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}
      {loading && !data && !error && <div className="text-warm-400 text-center py-16">Loading flows…</div>}

      {data && (
        <>
          <div className="overflow-x-auto rounded-xl border border-warm-200/60 bg-white">
            <div className="px-4 py-3 border-b border-warm-100 text-xs font-bold text-warm-600 uppercase tracking-wide">
              App health (click an app to filter)
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-warm-100">
                  {['App', 'Sessions', 'Views', 'Clicks', 'Events', 'Errors', 'Last seen'].map((h, i) => (
                    <th key={h} className={`${TH} ${i >= 1 && i <= 5 ? 'text-right' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {apps.map(a => (
                  <tr
                    key={a.app}
                    onClick={() => setApp(a.app)}
                    className={`border-b border-warm-50 hover:bg-warm-50/50 transition-colors cursor-pointer ${
                      app === a.app ? 'bg-fire-50' : ''
                    }`}
                  >
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-warm-800">{a.app}</td>
                    <td className="px-4 py-3 font-mono text-xs text-warm-700 text-right">{a.sessions.toLocaleString()}</td>
                    <td className="px-4 py-3 font-mono text-xs text-warm-700 text-right">{a.views.toLocaleString()}</td>
                    <td className="px-4 py-3 font-mono text-xs text-warm-700 text-right">{a.clicks.toLocaleString()}</td>
                    <td className="px-4 py-3 font-mono text-xs text-warm-700 text-right">{a.events.toLocaleString()}</td>
                    <td className={`px-4 py-3 font-mono text-xs text-right ${a.errors > 0 ? 'text-red-500 font-bold bg-red-50' : 'text-warm-700'}`}>
                      {a.errors.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-warm-700 whitespace-nowrap">{fmtTime(a.last_seen_ms)}</td>
                  </tr>
                ))}
                {apps.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-8 text-warm-400 text-sm">No app activity in this window</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {flows.length === 0 ? (
            <div className="rounded-xl border border-warm-200/60 bg-white text-center py-8 px-4 text-warm-400 text-sm">
              No flows are tagged yet. Apps tag a primary flow with{' '}
              <code className="font-mono text-xs">trackFlow</code> — see{' '}
              <code className="font-mono text-xs">docs/observability.md</code>.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {flows.map(f => {
                const top = f.steps[0]?.sessions ?? 0;
                return (
                  <div key={`${f.app}:${f.flow}`} className="rounded-xl border border-warm-200/60 bg-white">
                    <div className="px-4 py-3 border-b border-warm-100 flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-warm-600 uppercase tracking-wide">
                        {f.app} · <span className="font-mono normal-case">{f.flow}</span>
                      </span>
                      <span className="text-xs text-warm-500">{f.total_sessions.toLocaleString()} sessions</span>
                    </div>
                    <ol className="px-4 py-3 space-y-2">
                      {f.steps.map(s => {
                        const pct = top > 0 ? Math.round((s.sessions / top) * 100) : 0;
                        return (
                          <li key={s.step} className="text-xs font-mono text-warm-700">
                            <div className="flex justify-between gap-2 mb-0.5">
                              <span className="truncate" title={s.step}>{s.step || '—'}</span>
                              <span className="shrink-0 text-warm-500">{s.sessions.toLocaleString()} · {pct}%</span>
                            </div>
                            <div className="h-2 rounded bg-warm-100">
                              <div className="h-2 rounded bg-fire-500" style={{ width: `${pct}%` }} />
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
