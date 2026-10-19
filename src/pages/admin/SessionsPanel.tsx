import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAdminFetch } from '../../hooks/useAdmin.js';
import { fmtMmSs, fmtTime, shortId } from '../../lib/format';

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

const TH = 'px-4 py-3 text-xs font-bold text-warm-400 uppercase tracking-wide dark:text-warm-500';
const INPUT = 'px-2.5 py-1 text-xs rounded-lg border border-warm-200 bg-white text-warm-700 w-40 dark:border-warm-700 dark:bg-warm-900 dark:text-warm-300';

// Cross-app session list; each row opens the per-session journey in Session View.
export function SessionsPanel() {
  const adminFetch = useAdminFetch();
  const [days, setDays] = useState(1);
  const [email, setEmail] = useState('');
  const [visitor, setVisitor] = useState('');
  const [app, setApp] = useState('');
  const [data, setData] = useState<SessionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const qs = new URLSearchParams({ days: String(days) });
        if (email.trim()) qs.set('email', email.trim());
        if (visitor.trim()) qs.set('visitor', visitor.trim());
        if (app.trim()) qs.set('app', app.trim());
        const res = await adminFetch(`/admin/sessions?${qs}`);
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
  }, [adminFetch, days, email, visitor, app]);

  const sessions = data?.sessions ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-warm-900 dark:text-warm-50">Sessions</h2>
          <p className="text-warm-500 text-sm mt-1 dark:text-warm-400">
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
                days === d ? 'bg-fire-500 text-white' : 'bg-warm-100 text-warm-600 hover:bg-warm-200 dark:bg-warm-800 dark:text-warm-300 dark:hover:bg-warm-700'
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
      {loading && !data && !error && <div className="text-warm-400 text-center py-16 dark:text-warm-500">Loading sessions…</div>}

      {data && (
        <div className="overflow-x-auto rounded-xl border border-warm-200/60 bg-white dark:border-warm-700 dark:bg-warm-900">
          <div className="px-4 py-3 border-b border-warm-100 dark:border-warm-800 text-xs font-bold text-warm-600 uppercase tracking-wide dark:text-warm-300">
            Recent sessions
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-warm-100 dark:border-warm-800">
                {['Started', 'User', 'Landing → Exit', 'Apps', 'Pages', 'Clicks', 'Events', 'Errors', 'Duration', ''].map((h, i) => (
                  <th key={h || 'link'} className={`${TH} ${i >= 4 && i <= 7 ? 'text-right' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sessions.map(s => (
                <tr key={s.session_id} className="border-b border-warm-50 hover:bg-warm-50/50 transition-colors dark:border-warm-800 dark:hover:bg-warm-800/50">
                  <td className="px-4 py-3 font-mono text-xs text-warm-700 dark:text-warm-300 whitespace-nowrap">{fmtTime(s.started_at)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-warm-700 dark:text-warm-300" title={s.visitor_id}>{s.email ?? shortId(s.visitor_id)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-warm-700 dark:text-warm-300">
                    {s.landing_path ?? '—'} → {s.exit_path ?? '—'}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-warm-700 dark:text-warm-300">
                    {s.apps.length === 0 ? '—' : s.apps.map(a => (
                      <span key={a} className="mr-1 px-1.5 py-0.5 rounded bg-warm-100 text-warm-600 dark:bg-warm-800 dark:text-warm-300 text-[10px] font-bold">{a}</span>
                    ))}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-warm-700 dark:text-warm-300 text-right">{s.page_count.toLocaleString()}</td>
                  <td className="px-4 py-3 font-mono text-xs text-warm-700 dark:text-warm-300 text-right">{s.click_count.toLocaleString()}</td>
                  <td className="px-4 py-3 font-mono text-xs text-warm-700 dark:text-warm-300 text-right">{s.event_count.toLocaleString()}</td>
                  <td className={`px-4 py-3 font-mono text-xs text-right ${s.error_count > 0 ? 'text-red-500 font-bold' : 'text-warm-700 dark:text-warm-300'}`}>
                    {s.error_count.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-warm-700 dark:text-warm-300 whitespace-nowrap">{fmtMmSs(s.duration_ms)}</td>
                  <td className="px-4 py-3 text-xs whitespace-nowrap">
                    <Link
                      to={`/admin/sessions/${encodeURIComponent(s.session_id)}`}
                      className="font-semibold text-fire-600 hover:underline dark:text-fire-400"
                    >
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
              {sessions.length === 0 && (
                <tr><td colSpan={10} className="text-center py-8 text-warm-400 text-sm dark:text-warm-500">No sessions in this window</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
