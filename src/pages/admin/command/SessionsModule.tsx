import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import { useAdminFetch } from '../../../hooks/useAdmin.js';
import { buildSessionSteps, type Step } from '../../../lib/sessionSteps';
import type { SessionDetail, SessionRow, SessionsList } from './types.js';
import { C, FONT, Seg, fmtDay, fmtDur, MonoLabel } from './theme.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SPEEDS = ['1x', '2x', '4x'] as const;
type Speed = (typeof SPEEDS)[number];

const KIND_CHIP: Record<Step['kind'], { bg: string; fg: string }> = {
  view: { bg: 'rgba(244,185,66,.14)', fg: C.amber },
  click: { bg: 'rgba(242,106,46,.16)', fg: C.orange },
  event: { bg: 'rgba(111,191,138,.14)', fg: C.green },
  error: { bg: 'rgba(255,90,74,.16)', fg: C.red },
};

const p2 = (n: number) => String(n).padStart(2, '0');
const fmtHM = (ms: number) => {
  const d = new Date(ms);
  return `${p2(d.getHours())}:${p2(d.getMinutes())}`;
};
const shortVisitor = (id: string) => id.slice(0, 8);
const who = (s: { email: string | null; visitor_id: string }) => s.email ?? shortVisitor(s.visitor_id);
const flowOf = (s: SessionRow) =>
  `${s.landing_path ?? '—'} → ${s.exit_path ?? '—'}${s.apps.length ? `  · ${s.apps.join(', ')}` : ''}`;

function filterParam(q: string): string {
  const v = q.trim();
  if (!v) return '';
  if (v.includes('@')) return `&email=${encodeURIComponent(v)}`;
  if (UUID_RE.test(v)) return `&visitor=${encodeURIComponent(v)}`;
  return `&app=${encodeURIComponent(v)}`;
}

function Note({ color = C.faint, children }: { color?: string; children: ReactNode }) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, textAlign: 'center', font: `400 11px/1.4 ${FONT.mono}`, letterSpacing: '.1em', textTransform: 'uppercase', color }}>
      {children}
    </div>
  );
}

function Fact({ label, value, color = C.text }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
      <MonoLabel size={9}>{label}</MonoLabel>
      <span style={{ font: `400 11px/1.2 ${FONT.mono}`, color, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
    </div>
  );
}

const btn: CSSProperties = {
  margin: 0,
  cursor: 'pointer',
  padding: '7px 12px',
  border: `1px solid ${C.lineStrong}`,
  borderRadius: 3,
  background: 'transparent',
  color: C.text,
  font: `500 10.5px/1 ${FONT.mono}`,
  letterSpacing: '.1em',
};

export function SessionsModule({ stage, days }: { stage: boolean; days: number }) {
  const adminFetch = useAdminFetch();
  const { user } = useUser();
  const myEmail = user?.primaryEmailAddress?.emailAddress?.toLowerCase() ?? null;

  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [list, setList] = useState<SessionRow[] | null>(null);
  const [listErr, setListErr] = useState<string | null>(null);
  const [selId, setSelId] = useState<string | null>(null);
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [detailErr, setDetailErr] = useState<string | null>(null);
  const [stepIdx, setStepIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<Speed>('1x');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    let cancelled = false;
    setListErr(null);
    void (async () => {
      try {
        const res = await adminFetch(`/admin/sessions?days=${days}${filterParam(debouncedQ)}`);
        if (cancelled) return;
        if (!res.ok) { setListErr(`sessions failed (HTTP ${res.status})`); return; }
        const body = (await res.json()) as SessionsList;
        if (cancelled) return;
        setList(Array.isArray(body?.sessions) ? body.sessions : []);
      } catch {
        if (!cancelled) setListErr('network error');
      }
    })();
    return () => { cancelled = true; };
  }, [adminFetch, days, debouncedQ]);

  // First row auto-selected; keep the selection while it stays in the list.
  useEffect(() => {
    if (!list) return;
    setSelId(cur => (cur && list.some(s => s.session_id === cur) ? cur : list[0]?.session_id ?? null));
  }, [list]);

  useEffect(() => {
    setStepIdx(0);
    setPlaying(false);
    setDetail(null);
    setDetailErr(null);
    if (!selId) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await adminFetch(`/admin/sessions/${encodeURIComponent(selId)}`);
        if (cancelled) return;
        if (!res.ok) { setDetailErr(`journey failed (HTTP ${res.status})`); return; }
        const body = (await res.json()) as SessionDetail;
        if (!cancelled) setDetail(body);
      } catch {
        if (!cancelled) setDetailErr('network error');
      }
    })();
    return () => { cancelled = true; };
  }, [adminFetch, selId]);

  const steps = useMemo(
    () => (detail?.session ? buildSessionSteps(detail.timeline, detail.session.started_at).steps : []),
    [detail],
  );
  const last = steps.length - 1;
  const cur = steps[Math.min(stepIdx, Math.max(last, 0))];

  // One step per 1000ms/speed; stops at the last step.
  useEffect(() => {
    if (!playing) return;
    if (stepIdx >= last) { setPlaying(false); return; }
    const ms = 1000 / Number.parseInt(speed, 10);
    const t = setTimeout(() => setStepIdx(i => Math.min(i + 1, last)), ms);
    return () => clearTimeout(t);
  }, [playing, stepIdx, last, speed]);

  const togglePlay = useCallback(() => {
    if (last < 0) return;
    setPlaying(p => {
      if (!p && stepIdx >= last) setStepIdx(0);
      return !p;
    });
  }, [last, stepIdx]);

  useEffect(() => {
    if (!stage) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      e.preventDefault();
      togglePlay();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [stage, togglePlay]);

  if (listErr && !list) return <Note color={C.redSoft}>{listErr}</Note>;
  if (!list) return <Note>loading</Note>;

  if (!stage) {
    const top = list.slice(0, 7);
    return (
      <div style={{ position: 'absolute', inset: 0, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ font: `600 26px/1 ${FONT.sans}`, color: C.ink }}>{list.length}</span>
          <span style={{ font: `400 10px/1 ${FONT.mono}`, color: C.muted }}>sessions</span>
          {list[0] && <span style={{ marginLeft: 'auto', font: `400 10px/1 ${FONT.mono}`, color: C.green }}>last {fmtHM(list[0].started_at)}</span>}
        </div>
        {list.length === 0 ? (
          <Note>no sessions in window</Note>
        ) : (
          <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {top.map(s => (
              <div key={s.session_id} style={{ flex: 'none', display: 'grid', gridTemplateColumns: '52px minmax(0,1fr) 40px', gap: 8, alignItems: 'center', height: 24, borderTop: `1px solid ${C.rule}`, font: `400 10.5px/1 ${FONT.mono}` }}>
                <span style={{ color: C.muted }}>{fmtHM(s.started_at)}</span>
                <span style={{ color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{flowOf(s)}</span>
                <span style={{ color: C.ink, textAlign: 'right' }}>{fmtDur(s.duration_ms)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  const selRow = list.find(s => s.session_id === selId) ?? null;
  const head = detail?.session ?? null;
  const prog = last > 0 ? Math.min(stepIdx, last) / last : 0;

  return (
    <div style={{ position: 'absolute', inset: 0, padding: 12, display: 'grid', gridTemplateColumns: 'minmax(0,.92fr) minmax(0,1.08fr)', gap: 12 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="filter · email, visitor id, app"
            style={{ flex: 1, minWidth: 0, height: 28, padding: '0 10px', background: C.well, border: `1px solid ${C.line}`, borderRadius: 3, color: C.text, font: `400 11px/1 ${FONT.mono}`, outline: 'none' }}
          />
          <span style={{ font: `400 10px/1 ${FONT.mono}`, color: C.muted, whiteSpace: 'nowrap' }}>{list.length} / {list.length}</span>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', borderTop: `1px solid ${C.line}`, position: 'relative' }}>
          {listErr && <div style={{ padding: 6, font: `400 10px/1.3 ${FONT.mono}`, color: C.redSoft }}>{listErr}</div>}
          {list.length === 0 && <Note>no sessions in window</Note>}
          {list.map(s => {
            const sel = s.session_id === selId;
            const you = !!myEmail && s.email?.toLowerCase() === myEmail;
            return (
              <div
                key={s.session_id}
                onClick={() => setSelId(s.session_id)}
                style={{ flex: 'none', display: 'grid', gridTemplateColumns: '58px minmax(0,1fr) 46px', columnGap: 10, rowGap: 4, padding: '7px 8px', borderBottom: `1px solid ${C.rule}`, cursor: 'pointer', background: sel ? 'rgba(242,106,46,.08)' : 'transparent', boxShadow: sel ? `inset 2px 0 0 ${C.orange}` : 'none' }}
              >
                <span style={{ font: `400 10.5px/1.2 ${FONT.mono}`, color: C.muted }}>{fmtHM(s.started_at)}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                  <span style={{ font: `500 11px/1.2 ${FONT.mono}`, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.visitor_id}>{who(s)}</span>
                  {you && <span style={{ flex: 'none', font: `600 8.5px/1 ${FONT.mono}`, padding: '2px 4px', borderRadius: 2, background: 'rgba(242,106,46,.18)', color: C.orange }}>YOU</span>}
                </span>
                <span style={{ font: `500 11px/1.2 ${FONT.mono}`, color: C.ink, textAlign: 'right' }}>{fmtDur(s.duration_ms)}</span>
                <span style={{ font: `400 9.5px/1.2 ${FONT.mono}`, color: C.faint }}>{fmtDay(s.started_at)}</span>
                <span style={{ font: `400 10.5px/1.2 ${FONT.mono}`, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{flowOf(s)}</span>
                <span style={{ font: `400 9.5px/1.2 ${FONT.mono}`, color: C.muted, textAlign: 'right' }}>P{s.page_count} C{s.click_count} E{s.event_count}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0, background: C.well, border: `1px solid ${C.line}`, borderRadius: 3, padding: 14 }}>
        {!selRow && !detailErr && <Note>select a session</Note>}
        {detailErr && <Note color={C.redSoft}>{detailErr}</Note>}
        {selRow && !detailErr && !detail && <Note>loading</Note>}
        {selRow && detail && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: '10px 14px' }}>
              <Fact label="USER" value={who(selRow)} />
              <Fact label="STARTED" value={`${fmtDay(selRow.started_at)} ${fmtHM(selRow.started_at)}`} />
              <Fact label="DURATION" value={fmtDur(selRow.duration_ms)} />
              <Fact label="LANDING" value={head?.landing_path ?? selRow.landing_path ?? '—'} />
              <Fact label="EXIT" value={head?.exit_path ?? selRow.exit_path ?? '—'} />
              <Fact label="APP" value={detail.apps.length ? detail.apps.join(', ') : '—'} color={C.amber} />
            </div>
            {steps.length === 0 || !cur ? (
              <div style={{ flex: 1, position: 'relative' }}><Note>no steps recorded</Note></div>
            ) : (
              <>
                <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
                  <div style={{ position: 'absolute', left: 7, right: 7, top: '50%', height: 1, background: C.line }} />
                  <div style={{ position: 'absolute', left: 7, top: '50%', height: 1, background: C.orange, width: `calc((100% - 14px) * ${prog.toFixed(3)})` }} />
                  {steps.map(p => {
                    const on = p.index === stepIdx;
                    const past = p.index < stepIdx;
                    return (
                      <button
                        key={p.index}
                        type="button"
                        title={p.title}
                        onClick={() => { setStepIdx(p.index); setPlaying(false); }}
                        style={{ position: 'relative', width: 14, height: 14, flex: 'none', margin: 0, padding: 0, cursor: 'pointer', border: `1px solid ${on ? C.orange : past ? C.slate : C.lineStrong}`, background: on ? C.orange : past ? C.slate : C.well, borderRadius: p.kind === 'view' ? 2 : '50%', boxShadow: on ? '0 0 0 3px rgba(242,106,46,.22), 0 0 12px rgba(242,106,46,.6)' : 'none' }}
                      />
                    );
                  })}
                </div>
                <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 3, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, font: `500 10.5px/1 ${FONT.mono}`, color: C.muted }}>
                    <span style={{ color: C.text }}>STEP {p2(cur.index + 1)} / {p2(steps.length)}</span>
                    <span>+{fmtDur(cur.offsetMs)}</span>
                    <span style={{ padding: '3px 6px', borderRadius: 2, background: KIND_CHIP[cur.kind].bg, color: KIND_CHIP[cur.kind].fg }}>{cur.kind.toUpperCase()}</span>
                  </div>
                  <div style={{ font: `600 22px/1.15 ${FONT.sans}`, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cur.title}</div>
                  <div style={{ font: `400 11px/1.3 ${FONT.mono}`, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cur.detail || `on ${cur.path}`}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button type="button" style={btn} onClick={() => { setStepIdx(i => Math.max(0, i - 1)); setPlaying(false); }}>◂ PREV</button>
                  <button type="button" style={{ ...btn, padding: '7px 16px', border: `1px solid ${C.orange}`, background: C.orange, color: C.bg, fontWeight: 600 }} onClick={togglePlay}>{playing ? '❚❚ PAUSE' : '▶ PLAY'}</button>
                  <button type="button" style={btn} onClick={() => { setStepIdx(i => Math.min(last, i + 1)); setPlaying(false); }}>NEXT ▸</button>
                  <div style={{ marginLeft: 6 }}><Seg options={SPEEDS} value={speed} onChange={setSpeed} /></div>
                  <span style={{ marginLeft: 'auto', font: `400 10px/1 ${FONT.mono}`, color: C.faint }}>SPACE play</span>
                </div>
                <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', borderTop: `1px solid ${C.line}` }}>
                  {steps.map(p => (
                    <div
                      key={p.index}
                      onClick={() => { setStepIdx(p.index); setPlaying(false); }}
                      style={{ flex: 'none', display: 'grid', gridTemplateColumns: '22px 46px minmax(0,1fr) 44px', gap: 8, alignItems: 'center', height: 24, padding: '0 6px', cursor: 'pointer', background: p.index === stepIdx ? C.rule : 'transparent', font: `400 10.5px/1 ${FONT.mono}`, color: p.index <= stepIdx ? C.text : C.faint }}
                    >
                      <span style={{ color: C.faint }}>{p2(p.index + 1)}</span>
                      <span style={{ justifySelf: 'start', padding: '2px 5px', borderRadius: 2, fontSize: 9.5, background: KIND_CHIP[p.kind].bg, color: KIND_CHIP[p.kind].fg }}>{p.kind}</span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</span>
                      <span style={{ textAlign: 'right', color: C.faint }}>+{fmtDur(p.offsetMs)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
            <Link
              to={`/admin/sessions/${encodeURIComponent(selRow.session_id)}`}
              style={{ font: `500 10px/1 ${FONT.mono}`, letterSpacing: '.12em', color: C.orange, textDecoration: 'none' }}
            >
              OPEN IN SESSION VIEW →
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
