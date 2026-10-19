import { useEffect, type ReactNode } from 'react';
import { formatBytes } from '../../../lib/format.js';

/** Color tokens from docs/design/observability-command/README.md. */
export const C = {
  bg: '#0b0907',
  grid: 'rgba(245,240,230,.022)',
  panel: '#13100c',
  globe: '#100d0a',
  well: '#0f0d0a',
  card: '#1a1612',
  line: '#2a241c',
  rule: '#1f1a14',
  lineStrong: '#3a332a',
  ink: '#f5f0e6',
  text: '#e8e0cf',
  muted: '#9c937f',
  faint: '#6d6555',
  orange: '#f26a2e',
  amber: '#f4b942',
  green: '#6fbf8a',
  red: '#ff5a4a',
  redSoft: '#ff8a7a',
  slate: '#5d5648',
  sand: '#b8ae98',
  errBg: '#1a0f0b',
  errBorder: 'rgba(255,90,74,.45)',
  stageOutline: 'rgba(242,106,46,.5)',
} as const;

export const FONT = {
  sans: "'Inter Tight', system-ui, sans-serif",
  mono: "'JetBrains Mono', ui-monospace, monospace",
  serif: "'Source Serif 4', Georgia, serif",
} as const;

const FONTS_LINK_ID = 'obs-command-fonts';
const FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700' +
  '&family=JetBrains+Mono:wght@400;500;600&family=Source+Serif+4:ital,wght@0,400;0,600;1,400&display=swap';

/** Appends the Google Fonts stylesheet once; re-mounts reuse the existing link. */
export function useCommandFonts(): void {
  useEffect(() => {
    if (document.getElementById(FONTS_LINK_ID)) return;
    const link = document.createElement('link');
    link.id = FONTS_LINK_ID;
    link.rel = 'stylesheet';
    link.href = FONTS_HREF;
    document.head.appendChild(link);
  }, []);
}

// Formatters

export const fmtNum = (n: number): string => n.toLocaleString('en-US');

/** Bytes as '336.4 MB' / '12 KB'; GB and B fall through to formatBytes. */
export const fmtMB = (bytes: number): string => formatBytes(bytes);

/** Milliseconds as m:ss. */
export const fmtDur = (ms: number): string => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const p2 = (n: number) => String(n).padStart(2, '0');

/** Date as 24h HH:MM:SS. */
export const fmtClock = (d: Date): string => `${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;

/** Epoch ms as MM/DD. */
export const fmtDay = (ms: number): string => {
  const d = new Date(ms);
  return `${p2(d.getMonth() + 1)}/${p2(d.getDate())}`;
};

// Presentational primitives

export function MonoLabel({ children, color = C.faint, size = 9.5 }: { children: ReactNode; color?: string; size?: number }) {
  return (
    <span
      style={{
        font: `500 ${size}px/1 ${FONT.mono}`,
        letterSpacing: '.16em',
        textTransform: 'uppercase',
        color,
      }}
    >
      {children}
    </span>
  );
}

/** Segmented control; the active option is orange on near-black. */
export function Seg<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 2,
        padding: 2,
        border: `1px solid ${C.line}`,
        borderRadius: 3,
        background: C.panel,
      }}
    >
      {options.map(o => (
        <button
          key={o}
          type="button"
          onClick={e => {
            e.stopPropagation();
            onChange(o);
          }}
          style={{
            border: 0,
            margin: 0,
            cursor: 'pointer',
            padding: '5px 8px',
            borderRadius: 2,
            font: `500 10px/1 ${FONT.mono}`,
            letterSpacing: '.1em',
            background: o === value ? C.orange : 'transparent',
            color: o === value ? C.bg : C.muted,
          }}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

/** 2px bar pinned to the bottom of a positioned row; `pct` is 0-100. */
export function UnderlineBar({ pct, color = C.orange }: { pct: number; color?: string }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        bottom: 0,
        height: 2,
        width: `${Math.max(0, Math.min(100, pct))}%`,
        background: color,
        opacity: 0.8,
      }}
    />
  );
}

export interface DonutSegment { label: string; value: number; color: string }

/** Conic-gradient ring with a centered label; `inset` is the ring thickness in px. */
export function Donut({
  segments,
  size = 150,
  inset = 18,
  center,
  centerLabel,
}: {
  segments: DonutSegment[];
  size?: number;
  inset?: number;
  center?: ReactNode;
  centerLabel?: ReactNode;
}) {
  const total = segments.reduce((a, s) => a + s.value, 0);
  let acc = 0;
  const stops = total > 0
    ? segments
        .filter(s => s.value > 0)
        .map(s => {
          const from = (acc / total) * 100;
          acc += s.value;
          return `${s.color} ${from}% ${(acc / total) * 100}%`;
        })
        .join(',')
    : `${C.line} 0 100%`;
  return (
    <div
      style={{
        flex: 'none',
        width: size,
        height: size,
        borderRadius: '50%',
        position: 'relative',
        background: `conic-gradient(${stops})`,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset,
          borderRadius: '50%',
          background: C.well,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
        }}
      >
        {center != null && (
          <span style={{ font: `600 ${size >= 120 ? 26 : 16}px/1 ${FONT.sans}`, color: C.ink }}>{center}</span>
        )}
        {centerLabel != null && (
          <span style={{ font: `400 9.5px/1 ${FONT.mono}`, color: C.muted, letterSpacing: '.12em' }}>{centerLabel}</span>
        )}
      </div>
    </div>
  );
}

/** Status LED plus mono label, e.g. `ONLINE` / `3 ALERTS` / `STALE`. */
export function StatusLine({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, boxShadow: `0 0 8px ${color}` }} />
      <span style={{ font: `500 10px/1 ${FONT.mono}`, letterSpacing: '.16em', color }}>{children}</span>
    </span>
  );
}
