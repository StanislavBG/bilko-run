import type { ReactNode } from 'react';
import { C, FONT, fmtNum } from './theme.js';
import type { Source } from './useCommandData.js';
import type { ClickRow, TrafficData } from './types.js';

const COMPACT_N = 6;
const STAGE_GRID = 'minmax(0,1fr) minmax(0,1.1fr) 90px minmax(0,1.2fr) 50px';
const ellipsis = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } as const;

/** Header subtitle, e.g. '882 total'. */
export const clicksSubtitle = (traffic: Source<TrafficData>): string =>
  traffic.data ? `${fmtNum(traffic.data.totals.clicks)} total` : '';

function Note({ color = C.faint, children }: { color?: string; children: ReactNode }) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, textAlign: 'center', font: `400 11px/1.4 ${FONT.mono}`, letterSpacing: '.1em', textTransform: 'uppercase', color }}>
      {children}
    </div>
  );
}

/** Label, or the tag when the label is empty. */
const elementOf = (r: ClickRow): string => r.label?.trim() || r.tag || '—';

/** Path portion of the href, or '—'. */
function targetOf(href: string | null): string {
  if (!href) return '—';
  try {
    return new URL(href, 'http://x.invalid').pathname || '/';
  } catch {
    return href;
  }
}

const barPct = (clicks: number, max: number): number => (max > 0 ? (clicks / max) * 100 : 0);

export function ClicksModule({ stage, traffic }: { stage: boolean; traffic: Source<TrafficData> }) {
  const t = traffic.data;
  if (!t) {
    if (traffic.error) return <Note color={C.redSoft}>{traffic.error}</Note>;
    return <Note>loading</Note>;
  }
  const rows = t.topClicks;
  if (rows.length === 0) return <Note>no clicks in window</Note>;
  const max = Math.max(...rows.map(r => r.clicks));

  if (stage) {
    return (
      <div style={{ position: 'absolute', inset: 0, padding: '14px 16px', display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: STAGE_GRID, gap: 12, paddingBottom: 8, borderBottom: `1px solid ${C.line}`, font: `500 9.5px/1 ${FONT.mono}`, letterSpacing: '.14em', color: C.faint }}>
          <span>PAGE</span><span>ELEMENT</span><span>TARGET</span><span>CLICKS</span><span style={{ textAlign: 'right' }}>UV</span>
        </div>
        {rows.map((r, i) => (
          <div key={`${r.path}|${r.tag}|${r.label}|${r.href}|${i}`} style={{ flex: 'none', display: 'grid', gridTemplateColumns: STAGE_GRID, gap: 12, alignItems: 'center', height: 32, borderBottom: `1px solid ${C.rule}`, font: `400 11px/1.4 ${FONT.mono}`, color: C.text }}>
            <span style={{ color: C.muted, ...ellipsis }}>{r.path}</span>
            <span style={{ color: C.ink, ...ellipsis }}>{elementOf(r)}</span>
            <span style={{ color: C.faint, ...ellipsis }}>{targetOf(r.href)}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ height: 6, width: `${barPct(r.clicks, max)}%`, background: C.orange, opacity: 0.85 }} />
              <span>{fmtNum(r.clicks)}</span>
            </div>
            <span style={{ textAlign: 'right', color: C.muted }}>{fmtNum(r.visitors)}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{ position: 'absolute', inset: 0, padding: '8px 12px', display: 'flex', flexDirection: 'column', justifyContent: 'space-around' }}>
      {rows.slice(0, COMPACT_N).map((r, i) => (
        <div key={`${r.path}|${r.tag}|${r.label}|${r.href}|${i}`} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', gap: 8, font: `400 10.5px/1.4 ${FONT.mono}` }}>
            <span style={{ color: C.text, ...ellipsis }}>{elementOf(r)}</span>
            <span style={{ color: C.faint, flex: 1, ...ellipsis }}>{r.path}</span>
            <span style={{ color: C.ink }}>{fmtNum(r.clicks)}</span>
          </div>
          <div style={{ height: 3, background: C.rule }}>
            <div style={{ height: '100%', width: `${barPct(r.clicks, max)}%`, background: C.orange }} />
          </div>
        </div>
      ))}
    </div>
  );
}
