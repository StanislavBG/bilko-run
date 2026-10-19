import { useEffect, useRef, useState, type CSSProperties, type SyntheticEvent } from 'react';
import {
  FLIP_DESTS, angDiff, isLit, sectorIndexAt, stepSweep,
  type FlipDest, type RadarItem, type RadarSector,
} from '../../data/homeRadar.js';

export interface RadarDialProps {
  items: readonly RadarItem[];
  sectors: readonly RadarSector[];
  size: number;
  lockedSector: 0 | 1 | 2 | null;
  sweepSeconds?: number;
  onSectorChange: (i: 0 | 1 | 2) => void;
  onLitChange: (litIds: ReadonlySet<string>, focusId: string | null) => void;
  onLock: (i: 0 | 1 | 2) => void;
  onUnlock: () => void;
  onFlip: (dest: FlipDest, e?: SyntheticEvent) => void;
}

interface View { sec: 0 | 1 | 2; lit: ReadonlySet<string>; focusId: string | null; labelId: string | null; mode: string }

interface Mouse { b: number; inside: boolean; focus: number }

const DIAL = 520;
const HALF = 260;
const MONO = "'JetBrains Mono',monospace";
const EMPTY: ReadonlySet<string> = new Set();

const viewKey = (v: View) => `${v.sec}|${[...v.lit].join(',')}|${v.focusId ?? ''}|${v.labelId ?? ''}|${v.mode}`;

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function RadarDial(props: RadarDialProps) {
  const { items, sectors, size, lockedSector } = props;
  const propsRef = useRef(props);
  propsRef.current = props;

  const sweepRef = useRef<HTMLDivElement>(null);
  const mouseRef = useRef<Mouse | null>(null);
  const angRef = useRef<number>(lockedSector !== null ? sectors[lockedSector].mid : sectors[0].mid);
  const secRef = useRef<number>(-1);
  const keyRef = useRef('');
  const [reduced, setReduced] = useState(prefersReducedMotion);
  const [view, setView] = useState<View>({ sec: sectorIndexAt(angRef.current), lit: EMPTY, focusId: null, labelId: null, mode: 'Auto sweep' });

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setReduced(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  useEffect(() => {
    let raf = 0;
    let last = 0;
    const tick = (now: number) => {
      const p = propsRef.current;
      const dt = Math.min(0.1, last ? (now - last) / 1000 : 0);
      last = now;
      const period = Math.max(4, Math.min(16, Number(p.sweepSeconds) || 9));
      const m = mouseRef.current;
      const inside = !!m && m.inside;
      const focus = inside && m.focus >= 0 ? p.items[m.focus] : undefined;
      const locked = p.lockedSector;
      let target: number | null = null;
      if (locked !== null) target = p.sectors[locked].mid;
      if (inside) target = focus ? focus.b : m.b;
      const park = target === null && reduced;
      if (park) target = p.sectors[sectorIndexAt(angRef.current)].mid;
      const ang = stepSweep(angRef.current, dt, period, target);
      angRef.current = ang;
      if (sweepRef.current) sweepRef.current.style.transform = `rotate(${ang}deg)`;

      const manual = inside || locked !== null;
      const lit = new Set<string>();
      let labelId: string | null = null;
      let best = Infinity;
      for (const it of p.items) {
        const isFocus = focus === it;
        if (isFocus || isLit(it, ang, period, manual)) {
          lit.add(it.id);
          const score = manual ? angDiff(ang, it.b) : ((ang - it.b + 360) % 360) / (360 / period);
          if (score < best) { best = score; labelId = it.id; }
        }
      }
      if (focus) labelId = focus.id;
      const mode = focus ? `Locked · ${focus.lab}`
        : manual ? `Exploring · ${String(Math.round(ang) % 360).padStart(3, '0')}°` : 'Auto sweep';
      const next: View = { sec: sectorIndexAt(ang), lit, focusId: focus ? focus.id : null, labelId, mode };
      const key = viewKey(next);
      if (key !== keyRef.current) {
        const prevKey = keyRef.current;
        keyRef.current = key;
        setView(next);
        if (next.sec !== secRef.current) { secRef.current = next.sec; p.onSectorChange(next.sec); }
        const litPart = (k: string) => k.split('|').slice(1, 3).join('|');
        if (litPart(prevKey) !== litPart(key)) p.onLitChange(next.lit, next.focusId);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduced]);

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const k = r.width / DIAL;
    const x = (e.clientX - r.left) / k - HALF;
    const y = (e.clientY - r.top) / k - HALF;
    let b = (Math.atan2(x, -y) * 180) / Math.PI;
    if (b < 0) b += 360;
    let focus = -1;
    let fd = 34;
    items.forEach((it, i) => {
      const dd = Math.hypot(it.x - HALF - x, it.y - HALF - y);
      if (dd < fd) { fd = dd; focus = i; }
    });
    mouseRef.current = { b, inside: Math.hypot(x, y) <= 280, focus };
  };
  const onLeave = () => { mouseRef.current = null; };
  const onClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const m = mouseRef.current;
    if (!m || !m.inside || m.focus >= 0) return;
    props.onFlip(FLIP_DESTS[sectors[sectorIndexAt(angRef.current)].key], e);
  };

  const sec = sectors[lockedSector ?? view.sec];
  const focusing = view.focusId !== null;
  const manual = focusing || lockedSector !== null || view.mode.startsWith('Exploring');
  const modeBg = focusing ? '#a83818' : manual ? '#1a1612' : '#ede6d6';
  const modeFg = focusing || manual ? '#f5f0e6' : '#5d5648';
  const labelStyle = (c: string): CSSProperties => ({ position: 'absolute', font: `500 10px ${MONO}`, letterSpacing: '.1em', color: c });
  const axis = (deg: number): CSSProperties => ({ position: 'absolute', left: '50%', top: '50%', width: 260, height: 1, background: '#9c937f', transformOrigin: '0 50%', transform: `rotate(${deg}deg)` });
  const trans = reduced ? 'none' : undefined;

  return (
    <div
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      onClick={onClick}
      style={{ flex: `0 0 ${size}px`, position: 'relative', width: size, height: size, cursor: 'crosshair' }}
    >
      <div style={{ position: 'absolute', left: 0, top: 0, width: DIAL, height: DIAL, transformOrigin: '0 0', transform: `scale(${size / DIAL})` }}>
        <span style={{ position: 'absolute', left: 472, top: 48, transform: 'translate(-50%,-50%)', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 999, background: modeBg, color: modeFg, font: `700 10px ${MONO}`, letterSpacing: '.12em', textTransform: 'uppercase', zIndex: 5, transition: trans ?? 'background .3s,color .3s' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />
          {view.mode}
        </span>
        <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: `conic-gradient(from ${sec.start}deg, rgba(168,56,24,.06) 0deg ${sec.span}deg, transparent ${sec.span}deg)` }} />
        <div style={{ position: 'absolute', inset: 0, border: '1px solid #d4ccb8', borderRadius: '50%' }} />
        <div style={{ position: 'absolute', inset: 87, border: '1px solid #e3dcc8', borderRadius: '50%' }} />
        <div style={{ position: 'absolute', inset: 173, border: '1px solid #e3dcc8', borderRadius: '50%' }} />
        <div style={axis(-90)} />
        <div style={axis(90)} />
        <div style={axis(180)} />
        <span style={{ ...labelStyle('#9c937f'), left: '50%', top: -22, transform: 'translateX(-50%)' }}>000</span>
        <span style={{ ...labelStyle('#9c937f'), right: -30, top: '50%', transform: 'translateY(-50%)' }}>090</span>
        <span style={{ ...labelStyle('#9c937f'), left: '50%', bottom: -22, transform: 'translateX(-50%)' }}>180</span>
        <span style={{ ...labelStyle('#9c937f'), left: -30, top: '50%', transform: 'translateY(-50%)' }}>270</span>
        {sectors.map((s, i) => {
          const active = i === (lockedSector ?? view.sec);
          const dest = FLIP_DESTS[s.key];
          return (
            <a
              key={s.key}
              href={dest.url}
              data-track={`home-radar-sector-${s.key}`}
              onMouseEnter={() => props.onLock(i as 0 | 1 | 2)}
              onMouseLeave={() => props.onUnlock()}
              onClick={e => { e.preventDefault(); e.stopPropagation(); props.onFlip(dest, e); }}
              style={{ position: 'absolute', left: s.lx, top: s.ly, transform: 'translate(-50%,-50%)', whiteSpace: 'nowrap', padding: '5px 11px', border: `1px solid ${active ? s.col : '#9c937f'}`, borderRadius: 999, background: '#f5f0e6', font: `700 10.5px ${MONO}`, letterSpacing: '.14em', textTransform: 'uppercase', color: active ? '#1a1612' : '#5d5648', zIndex: 4, transition: trans ?? 'color .4s,border-color .4s' }}
            >
              {s.k}
            </a>
          );
        })}
        <div
          ref={sweepRef}
          style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'conic-gradient(from 0deg, rgba(168,56,24,0) 0deg, rgba(168,56,24,0) 280deg, rgba(168,56,24,.2) 359deg, rgba(168,56,24,0) 360deg)', pointerEvents: 'none', transform: `rotate(${angRef.current}deg)` }}
        >
          <div style={{ position: 'absolute', left: '50%', top: 0, width: 2, height: '50%', marginLeft: -1, background: '#a83818' }} />
        </div>
        <div style={{ position: 'absolute', left: 226, top: 226, width: 68, height: 68, borderRadius: '50%', background: '#a83818', boxShadow: '0 0 40px rgba(168,56,24,.45)', display: 'grid', placeItems: 'center', fontFamily: "'Source Serif 4',serif", fontStyle: 'italic', fontSize: 32, color: '#f5f0e6', zIndex: 2 }}>B</div>
        {items.map(it => {
          const lit = view.lit.has(it.id);
          const focused = view.focusId === it.id;
          return (
            <a
              key={it.id}
              href={it.href}
              aria-label={`${it.name} — ${it.sub}`}
              data-track={it.track}
              onClick={e => {
                if (!it.dest) return;
                e.preventDefault();
                e.stopPropagation();
                props.onFlip(it.dest, e);
              }}
              style={{ position: 'absolute', left: it.x, top: it.y, width: 0, height: 0, zIndex: 3 }}
            >
              <span style={{ position: 'absolute', left: -16, top: -16, width: 32, height: 32, borderRadius: '50%', border: `1.5px solid ${it.col}`, opacity: focused ? 1 : 0, transform: `scale(${focused ? 1 : 0.4})`, transition: trans ?? 'opacity .25s,transform .25s' }} />
              <span style={{ position: 'absolute', left: -6, top: -6, width: 12, height: 12, borderRadius: '50%', background: it.col, opacity: lit ? 1 : 0.35, boxShadow: `0 0 ${lit ? 12 : 0}px ${it.col}`, transition: trans ?? 'opacity .9s,box-shadow .9s' }} />
              <span style={{ position: 'absolute', left: 0, top: 12, transform: 'translateX(-50%)', whiteSpace: 'nowrap', padding: '2px 6px', background: '#f5f0e6', font: `500 10.5px ${MONO}`, letterSpacing: '.1em', textTransform: 'uppercase', color: '#1a1612', opacity: view.labelId === it.id && lit ? 1 : 0, transition: trans ?? 'opacity .5s' }}>{it.lab}</span>
            </a>
          );
        })}
      </div>
    </div>
  );
}
