import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useAdminFetch } from '../../../hooks/useAdmin.js';
import { C, Donut, FONT, MonoLabel, fmtClock, fmtDay, fmtNum, type DonutSegment } from './theme.js';
import type { Source } from './useCommandData.js';
import type { AdminFetcher, TrafficData, VisitorRow, VisitorTimeline } from './types.js';

const PALETTE = [C.orange, C.slate, C.amber, C.green] as const;
const TOP_N = 4;
const GRID = '86px 130px 34px 64px minmax(0,1fr) 46px 46px 92px';

export interface DonutResult {
  segments: DonutSegment[];
  /** Share of the largest segment, as a whole percent. */
  topPct: number;
  topLabel: string;
}

/** Top 4 named rows by hits plus one 'other' bucket (real 'other'/empty rows merge into it), colored from the README palette. */
export function donutSegments<T extends { hits: number }>(rows: T[], key: keyof T & string): DonutResult {
  const isOther = (r: T): boolean => {
    const k = r[key];
    return k == null || String(k).trim() === '' || String(k).trim().toLowerCase() === 'other';
  };
  const live = rows.filter(r => r.hits > 0);
  const named = live.filter(r => !isOther(r)).sort((a, b) => b.hits - a.hits);
  const segments: DonutSegment[] = named.slice(0, TOP_N).map((r, i) => ({
    label: String(r[key]),
    value: r.hits,
    color: PALETTE[i],
  }));
  const other =
    named.slice(TOP_N).reduce((a, r) => a + r.hits, 0) +
    live.filter(isOther).reduce((a, r) => a + r.hits, 0);
  if (other > 0) segments.push({ label: 'other', value: other, color: C.sand });
  const total = segments.reduce((a, s) => a + s.value, 0);
  const top = segments.slice(0, named.length > 0 ? Math.min(named.length, TOP_N) : 0)
    .reduce<DonutSegment | null>((m, s) => (!m || s.value > m.value ? s : m), null);
  return {
    segments,
    topPct: top && total > 0 ? Math.round((top.value / total) * 100) : 0,
    topLabel: top?.label ?? '',
  };
}

function Note({ color = C.faint, children }: { color?: string; children: ReactNode }) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, textAlign: 'center', font: `400 11px/1.4 ${FONT.mono}`, letterSpacing: '.1em', textTransform: 'uppercase', color }}>
      {children}
    </div>
  );
}

const idPrefix = (id: string): string => (id.length > 8 ? id.slice(0, 8) : id);
const fmtSeen = (ts: number): string => `${fmtDay(ts)} ${fmtClock(new Date(ts)).slice(0, 5)}`;

function DonutCard({ title, d }: { title: string; d: DonutResult }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 22, padding: 16, background: C.well, border: `1px solid ${C.line}`, borderRadius: 3 }}>
      <Donut segments={d.segments} size={150} inset={18} center={`${d.topPct}%`} centerLabel={d.topLabel.toUpperCase()} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 9, font: `400 11px/1.4 ${FONT.mono}`, color: C.text }}>
        <MonoLabel color={C.muted}>{title}</MonoLabel>
        {d.segments.map((s, i) => (
          <div key={`${s.label}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 8, height: 8, background: s.color, flex: 'none' }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.label}</span>
            <span style={{ marginLeft: 'auto' }}>{fmtNum(s.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Timeline({ visitorId, days, onBack, fetcher }: { visitorId: string; days: number; onBack: () => void; fetcher?: AdminFetcher }) {
  const realFetch = useAdminFetch();
  const adminFetch = fetcher ?? realFetch;
  const [tl, setTl] = useState<VisitorTimeline | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const latest = useRef(visitorId);

  useEffect(() => {
    latest.current = visitorId;
    setTl(null);
    setErr(null);
    (async () => {
      try {
        const res = await adminFetch(`/admin/traffic/visitor/${encodeURIComponent(visitorId)}?days=${days}`);
        if (!res.ok) throw new Error(`Failed to load visitor timeline (HTTP ${res.status})`);
        const body = (await res.json()) as VisitorTimeline;
        if (latest.current === visitorId) setTl(body);
      } catch (e) {
        if (latest.current === visitorId) setErr(e instanceof Error ? e.message : 'Network error');
      }
    })();
    return () => {
      // Marks this response stale if the visitor or window changes (or on unmount).
      if (latest.current === visitorId) latest.current = '';
    };
  }, [adminFetch, visitorId, days]);

  const cols = '110px 48px minmax(0,1fr) 60px';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 8, borderBottom: `1px solid ${C.line}` }}>
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onBack(); }}
          style={{ border: `1px solid ${C.line}`, background: C.panel, color: C.muted, cursor: 'pointer', padding: '5px 8px', borderRadius: 2, font: `500 10px/1 ${FONT.mono}`, letterSpacing: '.1em' }}
        >
          ← BACK
        </button>
        <MonoLabel color={C.muted}>VISITOR TIMELINE</MonoLabel>
        <span title={visitorId} style={{ font: `400 10.5px/1.4 ${FONT.mono}`, color: C.orange }}>{idPrefix(visitorId)}</span>
      </div>
      <div style={{ position: 'relative', flex: 1, minHeight: 0, overflow: 'auto' }}>
        {err && <Note color={C.redSoft}>{err}</Note>}
        {!err && !tl && <Note>loading</Note>}
        {tl && tl.events.length === 0 && <Note>no events for this visitor in this window</Note>}
        {tl && tl.events.length > 0 && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 10, padding: '8px 0 7px', font: `500 9.5px/1 ${FONT.mono}`, letterSpacing: '.14em', color: C.faint }}>
              <span>TIME</span><span>KIND</span><span>PATH / LABEL</span><span style={{ textAlign: 'right' }}>STATUS</span>
            </div>
            {tl.events.map((e, i) => (
              <div key={`${e.ts}:${i}`} style={{ display: 'grid', gridTemplateColumns: cols, gap: 10, alignItems: 'center', height: 25, borderBottom: `1px solid ${C.rule}`, font: `400 10.5px/1.4 ${FONT.mono}`, color: C.text }}>
                <span style={{ color: C.muted }}>{fmtDay(e.ts)} {fmtClock(new Date(e.ts))}</span>
                <span style={{ color: e.kind === 'click' ? C.amber : C.muted }}>{e.kind}</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {e.path}
                  {e.kind === 'click' && e.label ? <span style={{ color: C.muted }}> · {e.label}</span> : null}
                </span>
                <span style={{ textAlign: 'right', color: e.status != null && e.status >= 400 ? C.redSoft : C.muted }}>{e.kind === 'hit' ? (e.status ?? '—') : '—'}</span>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function VisitorTable({ rows, onPick }: { rows: VisitorRow[]; onPick: (id: string) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateColumns: GRID, gap: 10, paddingBottom: 7, borderBottom: `1px solid ${C.line}`, font: `500 9.5px/1 ${FONT.mono}`, letterSpacing: '.14em', color: C.faint }}>
        <span>VISITOR</span><span>IP</span><span>CC</span><span>DEVICE</span><span>EMAIL</span>
        <span style={{ textAlign: 'right' }}>HITS</span><span style={{ textAlign: 'right' }}>PAGES</span><span style={{ textAlign: 'right' }}>LAST SEEN</span>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {rows.map(v => (
          <div
            key={v.visitorId}
            onClick={e => { e.stopPropagation(); onPick(v.visitorId); }}
            style={{ display: 'grid', gridTemplateColumns: GRID, gap: 10, alignItems: 'center', height: 27, borderBottom: `1px solid ${C.rule}`, font: `400 10.5px/1.4 ${FONT.mono}`, color: C.text, cursor: 'pointer' }}
          >
            <span title={v.visitorId} style={{ color: v.userEmail ? C.orange : C.text }}>{idPrefix(v.visitorId)}</span>
            <span style={{ color: C.muted }}>{v.ip ?? '—'}</span>
            <span>{v.country ?? '—'}</span>
            <span style={{ color: C.muted }}>{v.device ?? '—'}</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: C.muted }}>{v.userEmail ?? '—'}</span>
            <span style={{ textAlign: 'right' }}>{fmtNum(v.hits)}</span>
            <span style={{ textAlign: 'right' }}>{fmtNum(v.pages)}</span>
            <span style={{ textAlign: 'right', color: C.muted }}>{fmtSeen(v.lastSeen)}</span>
          </div>
        ))}
        {rows.length === 0 && <div style={{ padding: 16, textAlign: 'center', font: `400 11px/1.4 ${FONT.mono}`, color: C.faint }}>NO VISITORS</div>}
      </div>
    </div>
  );
}

function Stage({ t, days, fetcher }: { t: TrafficData; days: number; fetcher?: AdminFetcher }) {
  const [selected, setSelected] = useState<string | null>(null);
  const device = donutSegments(t.byDevice, 'device');
  const browser = donutSegments(t.byBrowser, 'browser');
  return (
    <div style={{ position: 'absolute', inset: 0, padding: '14px 16px', display: 'grid', gridTemplateRows: 'auto minmax(0,1fr)', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 12 }}>
        <DonutCard title="DEVICES" d={device} />
        <DonutCard title="BROWSERS" d={browser} />
      </div>
      {selected
        ? <Timeline visitorId={selected} days={days} onBack={() => setSelected(null)} fetcher={fetcher} />
        : <VisitorTable rows={t.visitors ?? []} onPick={setSelected} />}
    </div>
  );
}

function Compact({ t }: { t: TrafficData }) {
  const items = [
    { d: donutSegments(t.byDevice, 'device') },
    { d: donutSegments(t.byBrowser, 'browser') },
  ];
  return (
    <div style={{ position: 'absolute', inset: 0, padding: '10px 12px', display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 10, alignItems: 'center' }}>
      {items.map(({ d }, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <Donut segments={d.segments} size={84} inset={11} center={`${d.topPct}%`} />
          <span style={{ font: `400 10px/1.4 ${FONT.mono}`, color: C.muted }}>{d.topLabel.toLowerCase()}</span>
        </div>
      ))}
    </div>
  );
}

export function AudienceModule({ stage, traffic, days, fetcher }: { stage: boolean; traffic: Source<TrafficData>; days: number; fetcher?: AdminFetcher }) {
  const t = traffic.data;
  if (!t) {
    if (traffic.error) return <Note color={C.redSoft}>{traffic.error}</Note>;
    return <Note>loading</Note>;
  }
  if (t.byDevice.length === 0 && t.byBrowser.length === 0 && (t.visitors ?? []).length === 0) {
    return <Note>no visitors in window</Note>;
  }
  return stage ? <Stage t={t} days={days} fetcher={fetcher} /> : <Compact t={t} />;
}
