import type { CSSProperties, ReactNode } from 'react';
import { C, FONT, UnderlineBar, fmtNum } from './theme.js';
import type { Source } from './useCommandData.js';
import type { DayRow, TrafficData } from './types.js';

const PROBE = /wp-admin|\.php|\.env|xmlrpc/;
const NARROW_AFTER = 14;

export const trafficSubtitle = (): string => 'pages · referrers';

const mmdd = (date: string): string => date.slice(5, 10);

function Note({ color = C.faint, children }: { color?: string; children: ReactNode }) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, textAlign: 'center', font: `400 11px/1.4 ${FONT.mono}`, letterSpacing: '.1em', textTransform: 'uppercase', color }}>
      {children}
    </div>
  );
}

const pct = (v: number, max: number): number => (max > 0 ? (v / max) * 100 : 0);


function RankTable({ title, cols, rows, barColor }: {
  title: string;
  cols: { label: string; width: number }[];
  rows: { name: string; vals: (string | number)[]; frac: number; probe?: boolean }[];
  barColor: string;
}) {
  const grid: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: `minmax(0,1fr) ${cols.map(c => `${c.width}px`).join(' ')}`,
    gap: 8,
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
      <div style={{ ...grid, paddingBottom: 6, borderBottom: `1px solid ${C.line}`, font: `500 9.5px/1 ${FONT.mono}`, letterSpacing: '.14em', color: C.faint }}>
        <span>{title}</span>
        {cols.map(c => <span key={c.label} style={{ textAlign: 'right' }}>{c.label}</span>)}
      </div>
      {rows.map((r, i) => (
        <div key={`${r.name}-${i}`} style={{ ...grid, flex: 'none', position: 'relative', alignItems: 'center', height: 24, font: `400 10.5px/1 ${FONT.mono}`, color: C.text, borderBottom: `1px solid ${C.rule}` }}>
          <UnderlineBar pct={r.frac * 100} color={barColor} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: r.probe ? C.redSoft : C.text }}>{r.name}</span>
          {r.vals.map((v, j) => (
            <span key={j} style={{ textAlign: 'right', color: j === 0 ? C.text : C.muted }}>{v}</span>
          ))}
        </div>
      ))}
    </div>
  );
}

function Stage({ t }: { t: TrafficData }) {
  const days = t.byDay;
  const peak = days.reduce<DayRow | null>((m, d) => (!m || d.hits > m.hits ? d : m), null);
  const maxHits = peak?.hits ?? 0;
  const maxUv = days.reduce((m, d) => Math.max(m, d.visitors), 0);
  const narrow = days.length > NARROW_AFTER;
  const labelEvery = narrow ? Math.ceil(days.length / 10) : 1;
  const pages = t.topPages.slice(0, 9);
  const refs = t.topReferrers.slice(0, 7);
  const projects = t.bySlug.slice(0, 10);
  const maxPage = pages.reduce((m, r) => Math.max(m, r.hits), 0);
  const maxRef = refs.reduce((m, r) => Math.max(m, r.hits), 0);
  const maxProj = projects.reduce((m, r) => Math.max(m, r.hits), 0);

  return (
    <>
      <div style={{ position: 'absolute', inset: 0, padding: '14px 16px', display: 'grid', gridTemplateRows: 'minmax(0,1.05fr) minmax(0,1fr)', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, font: `500 10px/1 ${FONT.mono}`, letterSpacing: '.14em', color: C.muted }}>
            <span>HITS PER DAY</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: C.faint }}><span style={{ width: 8, height: 8, background: C.orange }} />hits</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: C.faint }}><span style={{ width: 10, height: 2, background: C.amber }} />unique visitors</span>
            {peak && <span style={{ marginLeft: 'auto', color: C.faint }}>PEAK {mmdd(peak.date)} · {fmtNum(peak.hits)}</span>}
          </div>
          <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: `repeat(${days.length},minmax(0,1fr))`, gap: narrow ? 4 : 14 }}>
            {days.map((d, i) => (
              <div key={d.date} style={{ display: 'flex', flexDirection: 'column', gap: 6, minHeight: 0, minWidth: 0 }}>
                {!narrow && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', font: `400 10.5px/1 ${FONT.mono}` }}>
                    <span style={{ color: C.ink }}>{fmtNum(d.hits)}</span>
                    <span style={{ color: C.amber }}>{fmtNum(d.visitors)} uv</span>
                  </div>
                )}
                <div title={`${d.date}: ${fmtNum(d.hits)} hits · ${fmtNum(d.visitors)} uv`} style={{ flex: 1, position: 'relative', background: '#18140f', borderBottom: `1px solid ${C.lineStrong}` }}>
                  <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: `${pct(d.hits, maxHits)}%`, background: C.orange, opacity: 0.9 }} />
                  <div style={{ position: 'absolute', left: narrow ? -1 : -5, right: narrow ? -1 : -5, bottom: `calc(${pct(d.visitors, maxUv)}% - 1px)`, height: 2, background: C.amber, boxShadow: '0 0 6px rgba(244,185,66,.6)' }} />
                </div>
                <span style={{ height: 10, font: `400 10px/1 ${FONT.mono}`, color: C.muted, whiteSpace: 'nowrap', overflow: 'visible' }}>
                  {i % labelEvery === 0 ? mmdd(d.date) : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.3fr) minmax(0,1fr) minmax(0,1fr)', gap: 18, minHeight: 0 }}>
          <RankTable
            title="TOP PAGES"
            cols={[{ label: 'HITS', width: 40 }, { label: 'UV', width: 34 }]}
            rows={pages.map(r => ({ name: r.path, vals: [fmtNum(r.hits), fmtNum(r.visitors)], frac: maxPage ? r.hits / maxPage : 0, probe: PROBE.test(r.path) }))}
            barColor="rgba(242,106,46,.55)"
          />
          <RankTable
            title="REFERRERS"
            cols={[{ label: 'HITS', width: 34 }]}
            rows={refs.map(r => ({ name: r.host, vals: [fmtNum(r.hits)], frac: maxRef ? r.hits / maxRef : 0 }))}
            barColor="rgba(244,185,66,.6)"
          />
          <RankTable
            title="PROJECTS"
            cols={[{ label: 'HITS', width: 34 }, { label: 'UV', width: 28 }]}
            rows={projects.map(r => ({ name: r.slug, vals: [fmtNum(r.hits), fmtNum(r.visitors)], frac: maxProj ? r.hits / maxProj : 0 }))}
            barColor="rgba(111,191,138,.55)"
          />
        </div>
      </div>
      <div style={{ position: 'absolute', inset: 0, border: `1px solid ${C.stageOutline}`, pointerEvents: 'none' }} />
    </>
  );
}

function Compact({ t }: { t: TrafficData }) {
  const days = t.byDay;
  const maxHits = days.reduce((m, d) => Math.max(m, d.hits), 0);
  const maxUv = days.reduce((m, d) => Math.max(m, d.visitors), 0);
  const top = t.topReferrers[0];
  return (
    <div style={{ position: 'absolute', inset: 0, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ font: `600 26px/1 ${FONT.sans}`, color: C.ink }}>{fmtNum(t.totals.hits)}</span>
        <span style={{ font: `400 10px/1 ${FONT.mono}`, color: C.muted }}>hits · {t.days}d</span>
        {top && <span style={{ marginLeft: 'auto', font: `400 10px/1 ${FONT.mono}`, color: C.amber, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{top.host} top ref</span>}
      </div>
      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: `repeat(${days.length},minmax(0,1fr))`, gap: days.length > NARROW_AFTER ? 2 : 5 }}>
        {days.map(d => (
          <div key={d.date} style={{ display: 'flex', flexDirection: 'column', gap: 4, minHeight: 0 }}>
            <div style={{ flex: 1, position: 'relative', background: '#18140f' }}>
              <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: `${Math.max(3, pct(d.hits, maxHits))}%`, background: C.orange }} />
              <div style={{ position: 'absolute', left: -2, right: -2, bottom: `calc(${pct(d.visitors, maxUv)}% - 1px)`, height: 2, background: C.amber }} />
            </div>
            {days.length <= NARROW_AFTER && (
              <span style={{ font: `400 9px/1 ${FONT.mono}`, color: C.muted, textAlign: 'center' }}>{d.date.slice(8, 10)}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function TrafficModule({ stage, traffic }: { stage: boolean; traffic: Source<TrafficData> }) {
  const t = traffic.data;
  if (!t) {
    if (traffic.error) return <Note color={C.redSoft}>{traffic.error}</Note>;
    return <Note>loading</Note>;
  }
  if (t.byDay.length === 0 && t.totals.hits === 0) return <Note>no traffic in window</Note>;
  return stage ? <Stage t={t} /> : <Compact t={t} />;
}
