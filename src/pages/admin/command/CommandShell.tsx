import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { C, FONT, MonoLabel, Seg, StatusLine, fmtClock, useCommandFonts } from './theme.js';
import { MODULES, type ModuleKey } from './types.js';

export type LayoutName = 'rails' | 'dock' | 'wing';
export type WindowOpt = '1D' | '7D' | '30D';
export type RefreshOpt = '30S' | '1M' | '5M' | 'OFF';
export type SlotName = 'stage' | 'l1' | 'l2' | 'l3' | 'r1' | 'r2' | 'r3';
export type Positions = Record<ModuleKey, SlotName>;
export interface GridSpec { cols: string; rows: string; slots: Partial<Record<SlotName, [string, string]>> }

export const DEFAULT_POS: Positions = {
  globe: 'stage', apps: 'l1', traffic: 'l2', audience: 'l3', sessions: 'r1', clicks: 'r2', bandwidth: 'r3',
};

// Copied from the prototype's LAY table: slot -> [grid-column, grid-row].
const LAY: Record<LayoutName | 'max', GridSpec> = {
  rails: { cols: '300px minmax(0,1fr) 340px', rows: 'repeat(3,minmax(0,1fr))', slots: { stage: ['2', '1 / 4'], l1: ['1', '1'], l2: ['1', '2'], l3: ['1', '3'], r1: ['3', '1'], r2: ['3', '2'], r3: ['3', '3'] } },
  dock: { cols: 'repeat(6,minmax(0,1fr))', rows: 'minmax(0,1fr) 230px', slots: { stage: ['1 / 7', '1'], l1: ['1', '2'], l2: ['2', '2'], l3: ['3', '2'], r1: ['4', '2'], r2: ['5', '2'], r3: ['6', '2'] } },
  wing: { cols: 'minmax(0,1fr) 300px 300px', rows: 'repeat(3,minmax(0,1fr))', slots: { stage: ['1', '1 / 4'], l1: ['2', '1'], l2: ['2', '2'], l3: ['2', '3'], r1: ['3', '1'], r2: ['3', '2'], r3: ['3', '3'] } },
  max: { cols: 'minmax(0,1fr)', rows: 'minmax(0,1fr)', slots: { stage: ['1', '1'] } },
};

export function layoutGrid(layout: LayoutName, max: boolean): GridSpec {
  return max ? LAY.max : LAY[layout] ?? LAY.rails;
}

/** Exchanges the key's slot with whichever module is on stage; no-op if already on stage. */
export function swapToStage(pos: Positions, key: ModuleKey): Positions {
  if (pos[key] === 'stage') return pos;
  const cur = (Object.keys(pos) as ModuleKey[]).find(k => pos[k] === 'stage');
  if (!cur) return { ...pos, [key]: 'stage' };
  return { ...pos, [cur]: pos[key], [key]: 'stage' };
}

const STORAGE_KEY = 'obs-cmd:v1';
const LAYOUTS: LayoutName[] = ['rails', 'dock', 'wing'];
const WINDOWS: readonly WindowOpt[] = ['1D', '7D', '30D'];
const REFRESHES: readonly RefreshOpt[] = ['30S', '1M', '5M', 'OFF'];

interface Persisted { layout?: LayoutName; pos?: Positions; window?: WindowOpt }

function loadPersisted(): Persisted {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Persisted;
    const out: Persisted = {};
    if (raw.layout && LAYOUTS.includes(raw.layout)) out.layout = raw.layout;
    if (raw.window && WINDOWS.includes(raw.window)) out.window = raw.window;
    const p = raw.pos;
    if (p && MODULES.every(m => typeof p[m.key] === 'string')) {
      const slots = MODULES.map(m => p[m.key]);
      const valid = new Set<string>(Object.values(DEFAULT_POS));
      if (new Set(slots).size === 7 && slots.every(s => valid.has(s))) out.pos = p;
    }
    return out;
  } catch {
    return {};
  }
}

function savePersisted(patch: Persisted): void {
  try {
    const cur = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...cur, ...patch }));
  } catch {
    /* storage unavailable or corrupt: persistence is best-effort */
  }
}

/** Runs the state update inside a view transition when supported and motion is allowed. */
function withTransition(update: () => void): void {
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (doc.startViewTransition && !reduce) doc.startViewTransition(update);
  else update();
}

export interface CommandShellProps {
  layout: LayoutName;
  onLayout?: (l: LayoutName) => void;
  window: WindowOpt;
  onWindow: (w: WindowOpt) => void;
  refresh: RefreshOpt;
  onRefresh: (r: RefreshOpt) => void;
  status: { label: string; tone: 'ok' | 'warn' | 'err' };
  kpis: ReactNode;
  ticker: ReactNode;
  headers: Record<ModuleKey, { sub: string; tone?: 'muted' | 'err' }>;
  render: (key: ModuleKey, stage: boolean) => ReactNode;
}

const TONE = { ok: C.green, warn: C.amber, err: C.red } as const;
const labelBase = `500 10px/1 ${FONT.mono}`;

export function CommandShell(props: CommandShellProps) {
  const { window: win, onWindow, refresh, onRefresh, status, kpis, ticker, headers, render, onLayout } = props;
  useCommandFonts();

  const [initial] = useState(loadPersisted);
  const [layout, setLayout] = useState<LayoutName>(initial.layout ?? props.layout);
  const [pos, setPos] = useState<Positions>(initial.pos ?? DEFAULT_POS);
  const [max, setMax] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [wide, setWide] = useState(() => window.innerWidth >= 1360);
  useEffect(() => {
    const onResize = () => setWide(window.innerWidth >= 1360);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Adopt the persisted window once; afterwards the prop is the source of truth.
  const onWindowRef = useRef(onWindow);
  onWindowRef.current = onWindow;
  useEffect(() => {
    if (initial.window && initial.window !== win) onWindowRef.current(initial.window);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => savePersisted({ window: win }), [win]);
  useEffect(() => savePersisted({ layout, pos }), [layout, pos]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const focus = useCallback((key: ModuleKey) => {
    withTransition(() => setPos(p => swapToStage(p, key)));
  }, []);
  const toggleMax = useCallback(() => withTransition(() => setMax(m => !m)), []);
  const pickLayout = (l: LayoutName) => {
    withTransition(() => {
      setLayout(l);
      setMax(false);
    });
    onLayout?.(l);
  };

  const maxRef = useRef(max);
  maxRef.current = max;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const i = '1234567'.indexOf(e.key);
      if (e.key.length === 1 && i >= 0) focus(MODULES[i].key);
      else if (e.key === 'f' || e.key === 'F') toggleMax();
      else if (e.key === 'Escape' && maxRef.current) toggleMax();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [focus, toggleMax]);

  const grid = layoutGrid(layout, max);

  const rootStyle: CSSProperties = {
    position: 'relative',
    width: '100vw',
    height: '100vh',
    minWidth: 1280,
    minHeight: 760,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: '10px 12px',
    boxSizing: 'border-box',
    overflow: 'hidden',
    backgroundColor: C.bg,
    backgroundImage: `linear-gradient(${C.grid} 1px,transparent 1px),linear-gradient(90deg,${C.grid} 1px,transparent 1px)`,
    backgroundSize: '32px 32px',
    fontFamily: FONT.sans,
  };

  const ctl = (label: string, node: ReactNode) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <MonoLabel>{label}</MonoLabel>
      {node}
    </div>
  );

  return (
    <div style={{ width: '100%', height: '100vh', overflow: 'auto', background: C.bg }}>
      <div style={rootStyle}>
        <div style={{ flex: 'none', height: 38, display: 'flex', alignItems: 'center', gap: 10, padding: '0 2px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, overflow: 'hidden', flex: 'none' }}>
            <div
              style={{
                width: 26, height: 26, borderRadius: '50%', background: C.ink, color: C.bg, display: 'grid', placeItems: 'center',
                font: `600 14px/1 ${FONT.serif}`, boxShadow: `0 0 0 2px ${C.bg},0 0 0 3px ${C.orange}`,
              }}
            >
              B
            </div>
            <div style={{ font: `400 19px/1 ${FONT.serif}`, color: C.ink, letterSpacing: '-.01em', whiteSpace: 'nowrap', flex: 'none' }}>
              Bilko <span style={{ fontStyle: 'italic', color: C.orange }}>Bibitkov</span>
            </div>
            <div style={{ width: 1, height: 18, background: C.line }} />
            <div style={{ font: `500 11px/1 ${FONT.mono}`, letterSpacing: '.22em', color: C.text, whiteSpace: 'nowrap' }}>OBSERVABILITY</div>
            {wide && <div style={{ font: `400 10px/1 ${FONT.mono}`, letterSpacing: '.14em', color: C.faint, whiteSpace: 'nowrap', flex: 'none' }}>{'// COMMAND'}</div>}
          </div>
          <div style={{ flex: 1, minWidth: 0 }} />
          {ctl('LAYOUT', (
            <Seg
              options={['RAILS', 'DOCK', 'WING'] as const}
              value={layout.toUpperCase() as 'RAILS' | 'DOCK' | 'WING'}
              onChange={o => pickLayout(o.toLowerCase() as LayoutName)}
            />
          ))}
          {ctl('WINDOW', <Seg options={WINDOWS} value={win} onChange={onWindow} />)}
          {ctl('REFRESH', <Seg options={REFRESHES} value={refresh} onChange={onRefresh} />)}
          <button
            type="button"
            onClick={toggleMax}
            style={{
              border: `1px solid ${C.lineStrong}`, margin: 0, cursor: 'pointer', padding: '6px 10px', borderRadius: 3,
              background: C.panel, color: C.text, font: labelBase, letterSpacing: '.12em', whiteSpace: 'nowrap',
            }}
          >
            {max ? '⤡ RESTORE' : '⤢ FOCUS'}
          </button>
          <div style={{ paddingLeft: 4 }}>
            <StatusLine color={TONE[status.tone]}>{status.label}</StatusLine>
          </div>
          <div style={{ font: `500 13px/1 ${FONT.mono}`, color: C.ink, fontVariantNumeric: 'tabular-nums', minWidth: 66, textAlign: 'right' }}>
            {fmtClock(now)}
          </div>
          <Link
            to="/admin/sessions"
            style={{ font: labelBase, letterSpacing: '.12em', color: C.muted, textDecoration: 'none', border: `1px solid ${C.line}`, borderRadius: 3, padding: '6px 10px', whiteSpace: 'nowrap' }}
          >
            SESSION VIEW
          </Link>
        </div>

        {kpis}

        <div
          style={{
            flex: 1, minHeight: 0, display: 'grid', gap: 8, gridTemplateColumns: grid.cols, gridTemplateRows: grid.rows,
          }}
        >
          {MODULES.map((m, i) => {
            const slot = grid.slots[pos[m.key]];
            const stage = pos[m.key] === 'stage';
            const h = headers[m.key];
            const hint = stage ? (max ? 'FOCUSED · ESC' : 'ON STAGE · F') : `[${i + 1}] ⤢`;
            return (
              <div
                key={m.key}
                onClick={stage ? undefined : () => focus(m.key)}
                style={{
                  gridColumn: slot?.[0] ?? '1',
                  gridRow: slot?.[1] ?? '1',
                  display: slot ? 'flex' : 'none',
                  flexDirection: 'column',
                  minWidth: 0,
                  minHeight: 0,
                  position: 'relative',
                  background: C.globe,
                  border: `1px solid ${C.line}`,
                  borderRadius: 3,
                  overflow: 'hidden',
                  outline: stage ? `1px solid ${C.stageOutline}` : undefined,
                  outlineOffset: -1,
                  viewTransitionName: `m-${m.key}`,
                  cursor: stage ? 'default' : 'pointer',
                } as CSSProperties}
              >
                <div
                  style={{
                    flex: 'none', height: 28, display: 'flex', alignItems: 'center', gap: 8, padding: '0 10px',
                    borderBottom: `1px solid ${C.line}`, font: labelBase, letterSpacing: '.14em', textTransform: 'uppercase', color: C.muted, whiteSpace: 'nowrap', overflow: 'hidden',
                  }}
                >
                  <span style={{ color: C.orange }}>{m.num}</span>
                  <span style={{ flex: 'none', color: C.text }}>{m.title}</span>
                  <span style={{ flex: '0 1 auto', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', color: h?.tone === 'err' ? C.red : C.faint }}>{h?.sub ?? m.subtitle}</span>
                  <span style={{ flex: 'none', marginLeft: 'auto', color: C.faint }}>{hint}</span>
                </div>
                <div style={{ flex: 1, minHeight: 0, position: 'relative', display: 'flex', flexDirection: 'column' }}>
                  {render(m.key, stage)}
                </div>
              </div>
            );
          })}
        </div>

        <div
          style={{
            flex: 'none', height: 28, display: 'flex', alignItems: 'center', gap: 14, border: `1px solid ${C.line}`,
            borderRadius: 3, background: C.globe, padding: '0 10px', overflow: 'hidden',
          }}
        >
          <span style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 7, font: labelBase, letterSpacing: '.16em', color: C.orange }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.orange, boxShadow: `0 0 8px ${C.orange}` }} />
            RECENT HITS
          </span>
          <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', position: 'relative' }}>{ticker}</div>
          <span style={{ flex: 'none', font: `400 10px/1 ${FONT.mono}`, letterSpacing: '.08em', color: C.faint }}>1–7 SWAP · F FOCUS · ESC</span>
        </div>

        <div
          style={{
            position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 40,
            background: 'repeating-linear-gradient(0deg,rgba(0,0,0,.16) 0 1px,transparent 1px 3px)',
          }}
        />
      </div>
    </div>
  );
}
