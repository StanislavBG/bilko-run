import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth, useUser } from '@clerk/clerk-react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { useIsAdmin } from '../../hooks/useAdmin.js';
import { API_BASE } from '../../constants.js';
import { SessionPlayer } from './SessionPlayer.js';
import type { TimelineItem } from '../../lib/sessionSteps';

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
  apps: string[];
}

interface SessionHead {
  visitor_id?: string;
  email?: string | null;
  started_at?: number;
  ended_at?: number;
  landing_path?: string | null;
  exit_path?: string | null;
}

const fmtTime = (ts: number) => new Date(ts).toLocaleString(undefined, { timeZoneName: 'short' });
const shortId = (id: string) => (id.length > 10 ? `${id.slice(0, 8)}…` : id);
const fmtMmSs = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const TH = 'px-4 py-3 text-xs font-bold text-warm-400 uppercase tracking-wide';
const INPUT = 'px-2.5 py-1 text-xs rounded-lg border border-warm-200 bg-white text-warm-700 w-40';
const LINK = 'text-xs font-semibold text-fire-600 hover:underline';

function SessionPicker() {
  const { getToken } = useAuth();
  const [days, setDays] = useState(1);
  const [email, setEmail] = useState('');
  const [visitor, setVisitor] = useState('');
  const [app, setApp] = useState('');
  const [sessions, setSessions] = useState<SessionRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const token = await getToken();
        const qs = new URLSearchParams({ days: String(days) });
        if (email.trim()) qs.set('email', email.trim());
        if (visitor.trim()) qs.set('visitor', visitor.trim());
        if (app.trim()) qs.set('app', app.trim());
        const res = await fetch(`${API_BASE}/admin/sessions?${qs}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (cancelled) return;
        if (!res.ok) { setError(`Failed to load sessions (HTTP ${res.status})`); return; }
        const body = await res.json();
        if (cancelled) return;
        setSessions(Array.isArray(body?.sessions) ? body.sessions : []);
        setError(null);
      } catch {
        if (!cancelled) setError('Network error');
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [getToken, days, email, visitor, app]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-warm-900">Session View</h1>
          <p className="text-warm-500 text-sm mt-1">Pick a session to step through what the visitor did, in order.</p>
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
      {!sessions && !error && <div className="text-warm-400 text-center py-16">Loading sessions…</div>}

      {sessions && (
        <div className="overflow-x-auto rounded-xl border border-warm-200/60 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-warm-100">
                {['Started', 'User', 'Landing → Exit', 'Pages', 'Clicks', 'Duration', ''].map((h, i) => (
                  <th key={h || 'open'} className={`${TH} ${i === 3 || i === 4 ? 'text-right' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sessions.map(s => (
                <tr key={s.session_id} className="border-b border-warm-50 hover:bg-warm-50/50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-warm-700 whitespace-nowrap">{fmtTime(s.started_at)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-warm-700" title={s.visitor_id}>{s.email ?? shortId(s.visitor_id)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-warm-700">{s.landing_path ?? '—'} → {s.exit_path ?? '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs text-warm-700 text-right">{s.page_count.toLocaleString()}</td>
                  <td className="px-4 py-3 font-mono text-xs text-warm-700 text-right">{s.click_count.toLocaleString()}</td>
                  <td className="px-4 py-3 font-mono text-xs text-warm-700 whitespace-nowrap">{fmtMmSs(s.duration_ms)}</td>
                  <td className="px-4 py-3">
                    <Link className={LINK} to={`/admin/sessions/${encodeURIComponent(s.session_id)}`}>View →</Link>
                  </td>
                </tr>
              ))}
              {sessions.length === 0 && (
                <tr><td colSpan={7} className="text-center py-8 text-warm-400 text-sm">No sessions in this window</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

type DetailState =
  | { status: 'loading' }
  | { status: 'notfound' }
  | { status: 'error'; message: string }
  | { status: 'ok'; session: SessionHead | null; timeline: TimelineItem[] };

function SessionDetailView({ id }: { id: string }) {
  const { getToken } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [state, setState] = useState<DetailState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    (async () => {
      try {
        const token = await getToken();
        const res = await fetch(`${API_BASE}/admin/sessions/${encodeURIComponent(id)}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (cancelled) return;
        if (res.status === 404 || res.status === 400) { setState({ status: 'notfound' }); return; }
        if (!res.ok) { setState({ status: 'error', message: `Failed to load session (HTTP ${res.status})` }); return; }
        const body = await res.json();
        if (cancelled) return;
        setState({
          status: 'ok',
          session: body?.session ?? null,
          timeline: Array.isArray(body?.timeline) ? body.timeline : [],
        });
      } catch {
        if (!cancelled) setState({ status: 'error', message: 'Network error' });
      }
    })();
    return () => { cancelled = true; };
  }, [getToken, id]);

  const parsedStep = Number.parseInt(searchParams.get('step') ?? '', 10);
  // Read once per session load: later URL updates come from the player itself.
  const initialStep = Number.isFinite(parsedStep) && parsedStep > 0 ? parsedStep : 0;
  const onStepChange = useCallback((i: number) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('step', String(i));
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const timeline = state.status === 'ok' ? state.timeline : null;
  const apps = useMemo(() => {
    const set = new Set<string>();
    for (const e of timeline ?? []) {
      if ((e.kind === 'event' || e.kind === 'error') && e.app) set.add(e.app);
    }
    return [...set].sort();
  }, [timeline]);

  const back = <Link className={LINK} to="/admin/sessions">← All sessions</Link>;

  if (state.status === 'loading') return <div className="text-warm-400 text-center py-16">Loading session…</div>;
  if (state.status === 'notfound') {
    return <div className="space-y-3 py-8 text-center"><p className="text-warm-600 font-semibold">Session not found</p>{back}</div>;
  }
  if (state.status === 'error') {
    return <div className="space-y-3 py-8 text-center"><p className="text-red-500 text-sm">{state.message}</p>{back}</div>;
  }

  const { session, timeline: tl } = state;
  const startedAt = session?.started_at ?? tl[0]?.ts;
  const endedAt = session?.ended_at ?? tl[tl.length - 1]?.ts;
  const duration = startedAt != null && endedAt != null ? endedAt - startedAt : null;
  const user = session?.email ?? (session?.visitor_id ? shortId(session.visitor_id) : '—');

  const fields: [string, string][] = [
    ['User', user],
    ['Started', startedAt != null ? fmtTime(startedAt) : '—'],
    ['Duration', duration != null ? fmtMmSs(duration) : '—'],
    ['Landing', session?.landing_path ?? '—'],
    ['Exit', session?.exit_path ?? '—'],
    ['Apps', apps.length ? apps.join(', ') : '—'],
  ];

  return (
    <div className="space-y-6">
      <div>{back}</div>
      <div className="rounded-xl border border-warm-200/60 bg-white px-4 py-3 grid grid-cols-2 md:grid-cols-3 gap-3">
        {fields.map(([k, v]) => (
          <div key={k}>
            <div className="text-[10px] font-bold text-warm-400 uppercase tracking-wide">{k}</div>
            <div className="font-mono text-xs text-warm-700 break-all" title={k === 'User' ? session?.visitor_id : undefined}>{v}</div>
          </div>
        ))}
      </div>
      <SessionPlayer timeline={tl} startedAt={startedAt} initialStep={initialStep} onStepChange={onStepChange} />
    </div>
  );
}

export function SessionViewPage() {
  const { isLoaded } = useUser();
  const isAdmin = useIsAdmin();
  const { id } = useParams<{ id: string }>();

  if (isLoaded && !isAdmin) return <Navigate to="/" replace />;
  if (!isLoaded) return <div className="text-warm-400 text-center py-16">Loading…</div>;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {id ? <SessionDetailView id={id} /> : <SessionPicker />}
    </div>
  );
}
