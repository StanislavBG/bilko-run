import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@clerk/clerk-react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { useAdminFetch, useIsAdmin } from '../../hooks/useAdmin.js';
import { fmtMmSs, fmtTime, shortId } from '../../lib/format';
import { SessionsPanel } from './SessionsPanel.js';
import { SessionPlayer } from './SessionPlayer.js';
import type { TimelineItem } from '../../lib/sessionSteps';

interface SessionHead {
  visitor_id?: string;
  email?: string | null;
  started_at?: number;
  ended_at?: number;
  landing_path?: string | null;
  exit_path?: string | null;
  apps?: string[];
}

const LINK = 'text-xs font-semibold text-fire-600 hover:underline dark:text-fire-400';

type DetailState =
  | { status: 'loading' }
  | { status: 'notfound' }
  | { status: 'error'; message: string }
  | { status: 'ok'; session: SessionHead | null; timeline: TimelineItem[] };

function SessionDetailView({ id }: { id: string }) {
  const adminFetch = useAdminFetch();
  const [searchParams, setSearchParams] = useSearchParams();
  const [state, setState] = useState<DetailState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    (async () => {
      try {
        const res = await adminFetch(`/admin/sessions/${encodeURIComponent(id)}`);
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
  }, [adminFetch, id]);

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

  const back = <Link className={LINK} to="/admin/sessions">← All sessions</Link>;

  if (state.status === 'loading') return <div className="text-warm-400 text-center py-16 dark:text-warm-500">Loading session…</div>;
  if (state.status === 'notfound') {
    return <div className="space-y-3 py-8 text-center"><p className="text-warm-600 font-semibold dark:text-warm-300">Session not found</p>{back}</div>;
  }
  if (state.status === 'error') {
    return <div className="space-y-3 py-8 text-center"><p className="text-red-500 text-sm dark:text-red-400">{state.message}</p>{back}</div>;
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
    ['Apps', session?.apps?.length ? session.apps.join(', ') : '—'],
  ];

  return (
    <div className="space-y-6">
      <div>{back}</div>
      <div className="rounded-xl border border-warm-200/60 bg-white dark:border-warm-700 dark:bg-warm-900 px-4 py-3 grid grid-cols-2 md:grid-cols-3 gap-3">
        {fields.map(([k, v]) => (
          <div key={k}>
            <div className="text-[10px] font-bold text-warm-400 uppercase tracking-wide dark:text-warm-500">{k}</div>
            <div className="font-mono text-xs text-warm-700 break-all dark:text-warm-300" title={k === 'User' ? session?.visitor_id : undefined}>{v}</div>
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
  if (!isLoaded) return <div className="text-warm-400 text-center py-16 dark:text-warm-500">Loading…</div>;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {id ? <SessionDetailView id={id} /> : <SessionsPanel />}
    </div>
  );
}
