import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { DriftBadge } from '../DriftBadge.js';
import { C, FONT, MonoLabel, fmtMB, fmtNum } from './theme.js';
import type { Source } from './useCommandData.js';
import type { Flow, FlowsData, ObservabilityData, ObservabilityRow } from './types.js';

const RECENT_MS = 48 * 3_600_000;

export interface AppTile {
  name: string;
  sessions: number;
  views: number;
  clicks: number;
  events: number;
  errors: number;
  lastSeenMs: number;
  led: string;
  bg: string;
  border: string;
  status: string;
  statusTone: string;
}


const fmtLast = (ms: number): string => {
  const d = new Date(ms);
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
};

/** Flow apps merged by slug with manifest-only obs rows, sorted by sessions desc. */
export function appTiles(flows: FlowsData | null, obs: ObservabilityData | null, nowMs: number): AppTile[] {
  const tiles: AppTile[] = [];
  const seen = new Set<string>();
  const push = (name: string, s: number, v: number, c: number, e: number, errors: number, last: number) => {
    const act = Math.min(1, Math.sqrt((s + v + c + e / 10) / 400));
    const recent = last > 0 && nowMs - last <= RECENT_MS;
    const lastLabel = last > 0 ? fmtLast(last) : '—';
    tiles.push({
      name, sessions: s, views: v, clicks: c, events: e, errors, lastSeenMs: last,
      led: errors ? C.red : recent ? C.green : C.slate,
      bg: errors ? 'rgba(255,90,74,.10)' : `rgba(242,106,46,${(0.03 + 0.2 * act).toFixed(3)})`,
      border: errors ? 'rgba(255,90,74,.55)' : C.line,
      status: `${errors ? `${errors} ERRORS` : recent ? 'ACTIVE' : 'IDLE'} · ${lastLabel}`,
      statusTone: errors ? C.redSoft : recent ? C.green : C.faint,
    });
  };
  for (const a of flows?.apps ?? []) {
    seen.add(a.app);
    push(a.app, a.sessions, a.views, a.clicks, a.events, a.errors, a.last_seen_ms);
  }
  for (const r of obs?.rows ?? []) {
    if (!seen.has(r.slug)) {
      seen.add(r.slug);
      push(r.slug, 0, 0, 0, 0, 0, 0);
    }
  }
  return tiles.sort((a, b) => b.sessions - a.sessions);
}

export function appsSubtitle(tiles: AppTile[]): { sub: string; tone?: 'muted' | 'err' } {
  const n = tiles.filter(t => t.errors > 0).length;
  return n > 0 ? { sub: `${n} erroring`, tone: 'err' } : { sub: `${tiles.length} apps` };
}

function Note({ color = C.faint, children }: { color?: string; children: ReactNode }) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, textAlign: 'center', font: `400 11px/1.4 ${FONT.mono}`, letterSpacing: '.1em', textTransform: 'uppercase', color }}>
      {children}
    </div>
  );
}

function Led({ color, size }: { color: string; size: number }) {
  return <span style={{ width: size, height: size, borderRadius: '50%', flex: 'none', background: color, boxShadow: `0 0 ${size}px ${color}` }} />;
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
      <MonoLabel>{label}</MonoLabel>
      <span style={{ font: `500 11.5px/1.3 ${FONT.mono}`, color: C.text, wordBreak: 'break-word' }}>{children}</span>
    </div>
  );
}

const ms = (n: number | null): string => (n === null ? '—' : `${Math.round(n)}ms`);

function FunnelList({ flows }: { flows: Flow[] }) {
  if (flows.length === 0) {
    return <span style={{ font: `400 10.5px/1.4 ${FONT.mono}`, color: C.faint }}>No funnels tagged for this app.</span>;
  }
  return (
    <>
      {flows.map(f => {
        const top = f.steps[0]?.sessions ?? 0;
        return (
          <div key={f.flow} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', font: `500 10.5px/1 ${FONT.mono}`, color: C.sand }}>
              <span>{f.flow}</span>
              <span style={{ color: C.faint }}>{fmtNum(f.total_sessions)} sessions</span>
            </div>
            {f.steps.map(s => {
              const pct = top > 0 ? Math.round((s.sessions / top) * 100) : 0;
              return (
                <div key={s.step} style={{ font: `400 10px/1 ${FONT.mono}`, color: C.text }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 3 }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.step}>{s.step || '—'}</span>
                    <span style={{ flex: 'none', color: C.muted }}>{fmtNum(s.sessions)} · {pct}%</span>
                  </div>
                  <div style={{ height: 4, borderRadius: 2, background: C.line }}>
                    <div style={{ height: 4, borderRadius: 2, background: C.orange, width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </>
  );
}

function ManifestFacts({ row }: { row: ObservabilityRow | undefined }) {
  if (!row) {
    return <span style={{ font: `400 10.5px/1.4 ${FONT.mono}`, color: C.faint }}>No manifest for this app.</span>;
  }
  const m = row.manifest;
  const syn = row.synthetic;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 12 }}>
      <Fact label="Version">{m.version ?? '—'}</Fact>
      <Fact label="Git sha">{m.gitSha ? m.gitSha.slice(0, 8) : '—'}</Fact>
      <Fact label="Host-kit">{m.hostKit ?? '—'} <DriftBadge drift={row.hostKitDrift} /></Fact>
      <Fact label="Bundle (gz)">{m.bundleGz === null ? '—' : fmtMB(m.bundleGz)}</Fact>
      <Fact label="Synthetic">
        <span style={{ color: C.green }}>{syn.passes} pass</span> / <span style={{ color: syn.fails ? C.red : C.muted }}>{syn.fails} fail</span>
      </Fact>
      <Fact label="Load avg / max">{ms(syn.loadP50)} / {ms(syn.loadP95)}</Fact>
      <div style={{ gridColumn: '1 / -1' }}>
        <Fact label="Latest error">
          {row.latestError
            ? <span style={{ color: C.redSoft }}>{row.latestError.msg} · {new Date(row.latestError.ts).toLocaleString()}</span>
            : '—'}
        </Fact>
      </div>
      <div style={{ gridColumn: '1 / -1' }}>
        <Fact label={`Open alerts (${row.openAlerts.length})`}>
          {row.openAlerts.length === 0
            ? '—'
            : row.openAlerts.map((a, i) => <div key={i} style={{ color: C.amber }}>{a.kind}: {a.details}</div>)}
        </Fact>
      </div>
    </div>
  );
}

function DetailSheet({ tile, flows, row, onClose }: { tile: AppTile; flows: Flow[]; row: ObservabilityRow | undefined; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);
  return (
    <div
      onClick={e => e.stopPropagation()}
      style={{ position: 'absolute', inset: 0, zIndex: 5, background: C.panel, display: 'flex', flexDirection: 'column', minHeight: 0 }}
    >
      <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: `1px solid ${C.line}` }}>
        <Led color={tile.led} size={7} />
        <span style={{ font: `600 13px/1 ${FONT.mono}`, color: C.ink }}>{tile.name}</span>
        <span style={{ font: `400 9px/1 ${FONT.mono}`, letterSpacing: '.06em', color: tile.statusTone }}>{tile.status}</span>
        <button
          type="button"
          aria-label="Close detail"
          onClick={onClose}
          style={{ marginLeft: 'auto', cursor: 'pointer', border: `1px solid ${C.line}`, borderRadius: 2, background: C.card, color: C.muted, padding: '5px 8px', font: `500 10px/1 ${FONT.mono}`, letterSpacing: '.1em' }}
        >
          CLOSE
        </button>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 14, display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 20, alignContent: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <MonoLabel>Funnels</MonoLabel>
          <FunnelList flows={flows} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <MonoLabel>Manifest · synthetic · drift</MonoLabel>
          <ManifestFacts row={row} />
        </div>
      </div>
    </div>
  );
}

export function AppsModule({ stage, flows, obs }: { stage: boolean; flows: Source<FlowsData>; obs: Source<ObservabilityData> }) {
  const [sel, setSel] = useState<string | null>(null);
  const [nowMs] = useState(() => Date.now());
  const tiles = useMemo(() => appTiles(flows.data, obs.data, nowMs), [flows.data, obs.data, nowMs]);

  if (!flows.data && !obs.data) {
    if (flows.error || obs.error) return <Note color={C.redSoft}>{flows.error ?? obs.error}</Note>;
    return <Note>loading</Note>;
  }
  if (tiles.length === 0) return <Note>no app activity</Note>;

  if (!stage) {
    return (
      <div style={{ position: 'absolute', inset: 0, padding: '10px 12px', display: 'grid', gridTemplateColumns: 'repeat(5,minmax(0,1fr))', gridAutoRows: 'minmax(0,1fr)', gap: 4 }}>
        {tiles.map(t => (
          <div key={t.name} style={{ background: t.bg, border: `1px solid ${t.border}`, borderRadius: 2, padding: 5, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minWidth: 0, overflow: 'hidden' }}>
            <Led color={t.led} size={5} />
            <span style={{ font: `500 8.5px/1.1 ${FONT.mono}`, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</span>
          </div>
        ))}
      </div>
    );
  }

  const selTile = sel ? tiles.find(t => t.name === sel) : undefined;
  const stat = (label: string, value: number, color: string = C.text) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
      <span style={{ whiteSpace: 'nowrap' }}>{label}</span>
      <span style={{ fontSize: 11, color, whiteSpace: 'nowrap', }} title={fmtNum(value)}>{fmtNum(value)}</span>
    </div>
  );
  return (
    <>
      <div style={{ position: 'absolute', inset: 0, padding: 12, display: 'grid', gridTemplateColumns: 'repeat(5,minmax(0,1fr))', gridAutoRows: 'minmax(0,1fr)', gap: 6, overflow: 'auto' }}>
        {tiles.map(t => (
          <button
            key={t.name}
            type="button"
            onClick={e => { e.stopPropagation(); setSel(t.name); }}
            style={{ position: 'relative', textAlign: 'left', cursor: 'pointer', background: t.bg, border: `1px solid ${t.border}`, borderRadius: 3, padding: '9px 11px', display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0, minHeight: 0, overflow: 'hidden', color: 'inherit' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
              <Led color={t.led} size={6} />
              <span style={{ font: `600 11px/1.2 ${FONT.mono}`, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ font: `600 26px/1 ${FONT.sans}`, color: C.ink }}>{fmtNum(t.sessions)}</span>
              <span style={{ font: `400 9.5px/1 ${FONT.mono}`, color: C.muted }}>sessions</span>
            </div>
            <div style={{ marginTop: 'auto', display: 'grid', gridTemplateColumns: 'repeat(4,auto)', justifyContent: 'space-between', gap: 2, font: `400 9px/1 ${FONT.mono}`, color: C.faint }}>
              {stat('VIEW', t.views)}
              {stat('CLK', t.clicks)}
              {stat('EVT', t.events)}
              {stat('ERR', t.errors, t.errors ? C.red : C.faint)}
            </div>
            <span style={{ font: `400 9px/1 ${FONT.mono}`, letterSpacing: '.06em', color: t.statusTone, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.status}</span>
          </button>
        ))}
      </div>
      {selTile && (
        <DetailSheet
          tile={selTile}
          flows={(flows.data?.flows ?? []).filter(f => f.app === selTile.name)}
          row={obs.data?.rows.find(r => r.slug === selTile.name)}
          onClose={() => setSel(null)}
        />
      )}
    </>
  );
}
