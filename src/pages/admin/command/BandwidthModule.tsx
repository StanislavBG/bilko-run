import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useAdminFetch } from '../../../hooks/useAdmin.js';
import { formatBytes } from '../../../lib/format.js';
import { C, FONT, fmtMB, fmtNum } from './theme.js';
import type { Source } from './useCommandData.js';
import type { EgressAssetRow, EgressData } from './types.js';

const MB = 1024 * 1024;
const COMPACT_N = 5;
const PROJECT_GRID = 'minmax(0,1fr) 52px 70px 56px';
const ROUTE_GRID = '38px minmax(0,1fr) 52px 70px 56px';
const ellipsis = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } as const;
const headStyle = { display: 'grid', gap: 8, paddingBottom: 7, borderBottom: `1px solid ${C.line}`, font: `500 9.5px/1 ${FONT.mono}`, letterSpacing: '.14em', color: C.faint } as const;
const rowStyle = { flex: 'none', position: 'relative', display: 'grid', gap: 8, alignItems: 'center', height: 25, borderBottom: `1px solid ${C.rule}`, font: `400 10.5px/1 ${FONT.mono}`, color: C.text } as const;

export interface EgressSegment { label: string; bytes: number; color: string; tooltip?: string }
export interface EgressInsight {
  topSlug: string;
  byteShare: number;
  reqShare: number;
  perReq: number;
  segments: [EgressSegment, EgressSegment, EgressSegment];
}

/** Top-project concentration for the stage insight and share bar; null when there are no bytes. */
export function egressInsight(egress: EgressData): EgressInsight | null {
  const total = egress.totalBytes;
  if (!(total > 0) || egress.bySlug.length === 0) return null;
  const sorted = [...egress.bySlug].sort((a, b) => b.bytes - a.bytes);
  const [top, second, ...others] = sorted;
  const totalReq = sorted.reduce((a, r) => a + r.requests, 0);
  const secondBytes = second?.bytes ?? 0;
  const restBytes = Math.max(0, total - top.bytes - secondBytes);
  return {
    topSlug: top.slug,
    byteShare: top.bytes / total,
    reqShare: totalReq > 0 ? top.requests / totalReq : 0,
    perReq: top.bytesPerRequest,
    segments: [
      { label: top.slug, bytes: top.bytes, color: C.orange },
      { label: second?.slug ?? '', bytes: secondBytes, color: C.amber },
      { label: `${others.length} other${others.length === 1 ? '' : 's'}`, bytes: restBytes, color: C.slate, tooltip: `${others.length} other${others.length === 1 ? '' : 's'} · ${fmtMB(restBytes)}` },
    ],
  };
}

const pct = (f: number): string => `${Math.round(f * 100)}%`;
const mbParts = (bytes: number): { n: string; unit: string } => {
  const [n, unit] = fmtMB(bytes).split(' ');
  return { n, unit: unit ?? '' };
};

function Note({ color = C.faint, children }: { color?: string; children: ReactNode }) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, textAlign: 'center', font: `400 11px/1.4 ${FONT.mono}`, letterSpacing: '.1em', textTransform: 'uppercase', color }}>
      {children}
    </div>
  );
}

function ShareBar({ segments, height }: { segments: EgressInsight['segments']; height: number }) {
  return (
    <div style={{ display: 'flex', height, gap: 2 }}>
      {segments.filter(s => s.bytes > 0).map((s, i) => (
        <div
          key={i}
          title={s.tooltip}
          style={{ flex: s.bytes, background: s.color, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10, padding: i === 0 ? '0 12px' : i === 1 ? '0 8px' : 0, overflow: 'hidden', font: `600 11px/1 ${FONT.mono}`, color: C.bg, whiteSpace: 'nowrap' }}
        >
          {height > 20 && i < 2 && (
            <>
              {s.label}
              {i === 0 && <span style={{ fontWeight: 400 }}>{fmtMB(s.bytes)}</span>}
            </>
          )}
        </div>
      ))}
    </div>
  );
}

const perColor = (perReq: number): string => (perReq >= MB ? C.amber : C.muted);

export function BandwidthModule({ stage, egress, days }: { stage: boolean; egress: Source<EgressData>; days: number }) {
  const adminFetch = useAdminFetch();
  const [selected, setSelected] = useState<string | null>(null);
  const [assets, setAssets] = useState<EgressAssetRow[] | null>(null);
  const [assetsError, setAssetsError] = useState(false);
  const reqId = useRef(0);

  // A new window invalidates the open drilldown.
  useEffect(() => {
    reqId.current++;
    setSelected(null);
    setAssets(null);
  }, [days]);

  const open = async (slug: string) => {
    const id = ++reqId.current;
    setSelected(slug);
    setAssets(null);
    setAssetsError(false);
    try {
      const res = await adminFetch(`/admin/egress?days=${days}&slug=${encodeURIComponent(slug)}`);
      if (!res.ok) throw new Error(String(res.status));
      const body = (await res.json()) as EgressData;
      if (id === reqId.current) setAssets(body.assets);
    } catch {
      if (id === reqId.current) setAssetsError(true);
    }
  };
  const back = () => {
    reqId.current++;
    setSelected(null);
    setAssets(null);
  };

  const e = egress.data;
  if (!e) {
    if (egress.error) return <Note color={C.redSoft}>{egress.error}</Note>;
    return <Note>loading</Note>;
  }
  if (e.earliestDate === null) return <Note>metering never ran</Note>;
  const insight = egressInsight(e);
  if (!insight) return <Note>no traffic in window</Note>;

  const total = mbParts(e.totalBytes);

  if (!stage) {
    const top = [...e.bySlug].sort((a, b) => b.bytes - a.bytes).slice(0, COMPACT_N);
    return (
      <div style={{ position: 'absolute', inset: 0, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 9 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ font: `600 26px/1 ${FONT.sans}`, color: C.ink }}>{total.n}</span>
          <span style={{ font: `400 10px/1 ${FONT.mono}`, color: C.muted }}>{total.unit} egress</span>
        </div>
        <ShareBar segments={insight.segments} height={8} />
        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {top.map(r => (
            <div key={r.slug} style={{ flex: 'none', display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 64px', gap: 8, alignItems: 'center', height: 22, borderTop: `1px solid ${C.rule}`, font: `400 10.5px/1 ${FONT.mono}`, color: C.text }}>
              <span style={ellipsis}>{r.slug}</span>
              <span style={{ textAlign: 'right', color: C.muted }}>{formatBytes(r.bytes)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const slugs = [...e.bySlug].sort((a, b) => b.bytes - a.bytes);
  const maxSlug = slugs[0]?.bytes ?? 0;
  const maxRoute = Math.max(0, ...e.rows.map(r => r.bytes));
  const w = (v: number, max: number) => `${max > 0 ? (v / max) * 100 : 0}%`;

  return (
    <div style={{ position: 'absolute', inset: 0, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 14, overflow: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <span style={{ font: `600 34px/1 ${FONT.sans}`, color: C.ink }}>
          {total.n}<span style={{ fontSize: 15, color: C.muted }}> {total.unit}</span>
        </span>
        <span style={{ font: `400 11px/1.3 ${FONT.mono}`, color: C.amber }}>
          {insight.topSlug} serves {pct(insight.byteShare)} of all bytes from {pct(insight.reqShare)} of requests — {formatBytes(insight.perReq)} per request.
        </span>
      </div>
      <ShareBar segments={insight.segments} height={46} />
      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'auto' }}>
          {selected === null ? (
            <>
              <div style={{ ...headStyle, gridTemplateColumns: PROJECT_GRID }}>
                <span>PROJECT</span><span style={{ textAlign: 'right' }}>REQ</span><span style={{ textAlign: 'right' }}>BYTES</span><span style={{ textAlign: 'right' }}>/REQ</span>
              </div>
              {slugs.map(r => (
                <div key={r.slug} onClick={() => void open(r.slug)} style={{ ...rowStyle, gridTemplateColumns: PROJECT_GRID, cursor: 'pointer' }}>
                  <div style={{ position: 'absolute', left: 0, bottom: 0, height: 2, width: w(r.bytes, maxSlug), background: 'rgba(242,106,46,.6)' }} />
                  <span style={ellipsis}>{r.slug}</span>
                  <span style={{ textAlign: 'right', color: C.muted }}>{fmtNum(r.requests)}</span>
                  <span style={{ textAlign: 'right' }}>{formatBytes(r.bytes)}</span>
                  <span style={{ textAlign: 'right', color: perColor(r.bytesPerRequest) }}>{formatBytes(r.bytesPerRequest)}</span>
                </div>
              ))}
            </>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 7, borderBottom: `1px solid ${C.line}`, font: `500 9.5px/1 ${FONT.mono}`, letterSpacing: '.14em', color: C.faint }}>
                <button type="button" onClick={back} style={{ border: 0, padding: 0, background: 'transparent', cursor: 'pointer', font: 'inherit', letterSpacing: 'inherit', color: C.orange }}>← BACK</button>
                <span>TOP FILES</span><span style={{ color: C.text, ...ellipsis }}>{selected}</span>
              </div>
              {assetsError && <div style={{ padding: 12, font: `400 10.5px/1 ${FONT.mono}`, color: C.redSoft }}>failed to load files</div>}
              {!assetsError && assets === null && <div style={{ padding: 12, font: `400 10.5px/1 ${FONT.mono}`, color: C.faint }}>loading</div>}
              {assets !== null && assets.length === 0 && <div style={{ padding: 12, font: `400 10.5px/1 ${FONT.mono}`, color: C.faint }}>no per-file data in window</div>}
              {assets?.map(a => (
                <div key={a.path} style={{ ...rowStyle, gridTemplateColumns: 'minmax(0,1fr) 52px 70px', fontStyle: a.path === '_rest' ? 'italic' : 'normal' }}>
                  <span style={ellipsis}>{a.path === '_rest' ? 'everything else' : a.path}</span>
                  <span style={{ textAlign: 'right', color: C.muted }}>{fmtNum(a.requests)}</span>
                  <span style={{ textAlign: 'right' }}>{formatBytes(a.bytes)}</span>
                </div>
              ))}
            </>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'auto' }}>
          <div style={{ ...headStyle, gridTemplateColumns: ROUTE_GRID }}>
            <span>VERB</span><span>ROUTE</span><span style={{ textAlign: 'right' }}>REQ</span><span style={{ textAlign: 'right' }}>BYTES</span><span style={{ textAlign: 'right' }}>/REQ</span>
          </div>
          {e.rows.map(r => (
            <div key={`${r.method}:${r.route}`} style={{ ...rowStyle, gridTemplateColumns: ROUTE_GRID }}>
              <div style={{ position: 'absolute', left: 0, bottom: 0, height: 2, width: w(r.bytes, maxRoute), background: 'rgba(244,185,66,.55)' }} />
              <span style={{ color: r.method === 'POST' ? C.amber : C.muted }}>{r.method}</span>
              <span style={ellipsis}>{r.route}</span>
              <span style={{ textAlign: 'right', color: C.muted }}>{fmtNum(r.requests)}</span>
              <span style={{ textAlign: 'right' }}>{formatBytes(r.bytes)}</span>
              <span style={{ textAlign: 'right', color: perColor(r.bytesPerRequest) }}>{formatBytes(r.bytesPerRequest)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
