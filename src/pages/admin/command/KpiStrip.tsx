import { C, FONT, fmtClock } from './theme.js';
import type { KpiTile, Tone } from './useCommandData.js';
import type { RecentRow } from './types.js';

const SUB_COLOR: Record<Tone, string> = { neutral: C.muted, green: C.green, amber: C.amber, red: C.redSoft };

function Spark({ values }: { values: number[] }) {
  const last = values.slice(-7);
  const max = Math.max(1, ...last);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 20, flex: 1 }}>
      {last.map((v, i) => (
        <div key={i} style={{ flex: 1, height: `${Math.max(6, Math.round((v / max) * 100))}%`, background: C.orange, opacity: 0.85 }} />
      ))}
    </div>
  );
}

function Tile({ tile }: { tile: KpiTile }) {
  // Only the ERRORS tile gets the red card treatment; other red tiles just tint the sub-label.
  const err = tile.tone === 'red' && tile.label === 'ERRORS';
  const m = /^(.*\S)\s+([A-Za-z]+)$/.exec(tile.value);
  return (
    <div
      style={{
        background: err ? C.errBg : C.panel,
        border: `1px solid ${err ? C.errBorder : C.line}`,
        borderRadius: 3,
        padding: '8px 10px',
        display: 'flex',
        flexDirection: 'column',
        gap: 5,
        minWidth: 0,
      }}
    >
      <span style={{ font: `500 9.5px/1 ${FONT.mono}`, letterSpacing: '.14em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: err ? C.redSoft : C.muted }}>{tile.label}</span>
      <div style={{ display: 'flex', alignItems: tile.spark ? 'flex-end' : 'baseline', gap: tile.spark ? 8 : 6, minWidth: 0 }}>
        <span style={{ font: `600 24px/1 ${FONT.sans}`, color: err ? C.red : C.ink, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
          {m ? <>{m[1]}<span style={{ fontSize: 13, color: C.muted }}> {m[2]}</span></> : tile.value}
        </span>
        {tile.spark && tile.spark.length > 0 ? (
          <Spark values={tile.spark} />
        ) : tile.sub ? (
          <span title={tile.sub} style={{ font: `400 9.5px/1.3 ${FONT.mono}`, color: err ? C.redSoft : SUB_COLOR[tile.tone], whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
            {tile.sub}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function KpiStrip({ tiles }: { tiles: KpiTile[] }) {
  return (
    <div style={{ flex: 'none', display: 'grid', gridTemplateColumns: 'repeat(9,minmax(0,1fr))', gap: 8 }}>
      {tiles.map((t) => <Tile key={t.label} tile={t} />)}
    </div>
  );
}

const TICKER_CSS =
  '@keyframes obsTicker{from{transform:translateX(0)}to{transform:translateX(-50%)}}' +
  '.obs-ticker-track{animation:obsTicker 50s linear infinite}' +
  '@media (prefers-reduced-motion: reduce){.obs-ticker-track{animation:none}}';

/** Keyframes are injected once into <head>, not rendered per component instance. */
function ensureTickerStyle(): void {
  if (typeof document === 'undefined' || document.getElementById('obs-ticker-style')) return;
  const el = document.createElement('style');
  el.id = 'obs-ticker-style';
  el.textContent = TICKER_CSS;
  document.head.appendChild(el);
}

function TickerItem({ r }: { r: RecentRow }) {
  const bad = r.status >= 400;
  const badge = r.isBot ? 'BOT' : bad ? String(r.status) : null;
  return (
    <span style={{ display: 'inline-flex', gap: 10, alignItems: 'center', font: `400 10.5px/1 ${FONT.mono}`, color: C.muted, whiteSpace: 'nowrap' }}>
      <span style={{ color: C.faint }}>{fmtClock(new Date(r.ts))}</span>
      <span style={{ color: bad ? C.red : C.green }}>{r.status}</span>
      <span style={{ color: r.isBot ? C.amber : C.text }}>{r.path}</span>
      <span>{r.country ?? '—'}</span>
      <span style={{ color: C.faint }}>{r.device}/{r.browser}/{r.os}</span>
      {badge && (
        <span style={{ padding: '2px 5px', borderRadius: 2, background: r.isBot ? 'rgba(244,185,66,.16)' : 'rgba(255,90,74,.16)', color: r.isBot ? C.amber : C.redSoft, fontSize: 9 }}>
          {badge}
        </span>
      )}
    </span>
  );
}

/** Scrolling track only; CommandShell wraps it in the bordered bar with the RECENT HITS label and key hint. */
export function Ticker({ recent }: { recent: RecentRow[] }) {
  ensureTickerStyle();
  const all = [...recent, ...recent];
  if (recent.length === 0) return <span style={{ font: `400 10.5px/1 ${FONT.mono}`, color: C.faint }}>no hits in window</span>;
  return (
    <div className="obs-ticker-track" style={{ display: 'flex', gap: 40, width: 'max-content' }}>
      {all.map((r, i) => <TickerItem key={i} r={r} />)}
    </div>
  );
}
