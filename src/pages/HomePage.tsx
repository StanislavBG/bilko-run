import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { PUBLIC_CARDS } from '../data/projectsView.js';
import {
  FLIP_DESTS, RADAR_SECTORS, buildRadarItems, radarSize,
  type FlipDest,
} from '../data/homeRadar.js';
import { RadarDial } from '../components/home/RadarDial.js';
import { FlipDestination, useBookFlip } from '../components/home/BookFlip.js';
import { trackFlow } from '../lib/telemetry.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import '../styles/home-radar.css';

const API = import.meta.env.VITE_API_URL || '/api';
const SPINE_LABELS = PUBLIC_CARDS.map(c => c.name);
const SECTOR_KEYS = ['projects', 'blog', 'contact'] as const;
const KEY_TO_SECTOR: Record<string, (typeof SECTOR_KEYS)[number]> = { '1': 'projects', '2': 'blog', '3': 'contact' };
const EMPTY_IDS: ReadonlySet<string> = new Set();

interface PostRef { slug: string; title: string }

export function HomePage() {
  useDocumentTitle('Bilko Bibitkov — small AI tools');

  const { phase, dest, flip } = useBookFlip();
  const [posts, setPosts] = useState<PostRef[]>([]);
  const [lock, setLock] = useState<0 | 1 | 2 | null>(null);
  const [sweepSec, setSweepSec] = useState<0 | 1 | 2>(0);
  const [lit, setLit] = useState<ReadonlySet<string>>(EMPTY_IDS);
  const [paused, setPaused] = useState(false);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const [dims, setDims] = useState(() => radarSize(window.innerWidth, window.innerHeight));

  const hero = useRef<HTMLElement>(null);
  const crossX = useRef<HTMLDivElement>(null);
  const crossY = useRef<HTMLDivElement>(null);
  const crossRead = useRef<HTMLDivElement>(null);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  const { items, counts } = useMemo(() => buildRadarItems({ projects: PUBLIC_CARDS, posts }), [posts]);
  const si = lock ?? sweepSec;
  const sector = RADAR_SECTORS[si];

  useEffect(() => {
    document.body.classList.add('hub-route');
    return () => document.body.classList.remove('hub-route');
  }, []);

  useEffect(() => {
    let alive = true;
    fetch(`${API}/blog`)
      .then(r => r.json())
      .then(d => {
        if (!alive || !Array.isArray(d)) return;
        setPosts(d.slice(0, 5).filter((p): p is PostRef => typeof p?.slug === 'string' && typeof p?.title === 'string')
          .map(p => ({ slug: p.slug, title: p.title })));
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const onResize = () => setDims(radarSize(window.innerWidth, window.innerHeight));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const doFlip = useCallback((d: FlipDest) => {
    trackFlow('explore', 'home-flip', { to: d.key });
    flip(d);
  }, [flip]);
  const flipRef = useRef(doFlip);
  flipRef.current = doFlip;

  useEffect(() => {
    const go = (key: (typeof SECTOR_KEYS)[number]) => flipRef.current(FLIP_DESTS[key]);
    const onKey = (e: KeyboardEvent) => {
      if (phaseRef.current !== 'idle' || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target instanceof HTMLElement ? e.target : null;
      if (t?.closest('input, textarea, [contenteditable=""], [contenteditable="true"]')) return;
      if (KEY_TO_SECTOR[e.key]) { e.preventDefault(); go(KEY_TO_SECTOR[e.key]); return; }
      if (e.key === 'ArrowDown' || e.key === 'PageDown') { e.preventDefault(); go('projects'); return; }
      if (e.key === ' ' || e.code === 'Space') {
        if (t?.closest('a, button')) return;
        e.preventDefault();
        go('projects');
      }
    };
    const onWheel = (e: WheelEvent) => {
      if (phaseRef.current !== 'idle' || e.deltaY <= 24) return;
      e.preventDefault();
      go('projects');
    };
    const onClick = (e: MouseEvent) => {
      const el = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-home-flip]') : null;
      const key = el?.dataset.homeFlip;
      if (!key || !(key in FLIP_DESTS)) return;
      e.preventDefault();
      e.stopPropagation();
      if (phaseRef.current === 'idle') go(key as (typeof SECTOR_KEYS)[number]);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('wheel', onWheel, { passive: false });
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('wheel', onWheel);
      document.removeEventListener('click', onClick, true);
    };
  }, []);

  const onMove = (e: React.MouseEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    if (crossX.current) crossX.current.style.top = `${y}px`;
    if (crossY.current) crossY.current.style.left = `${x}px`;
    if (crossRead.current) {
      crossRead.current.style.left = `${x + 10}px`;
      crossRead.current.style.top = `${y + 8}px`;
      crossRead.current.textContent = `X ${(x / r.width).toFixed(3)} · Y ${(y / r.height).toFixed(3)}`;
    }
    [crossX, crossY, crossRead].forEach(ref => ref.current?.classList.remove('hr-cross-hide'));
  };
  const onLeave = () => [crossX, crossY, crossRead].forEach(ref => ref.current?.classList.add('hr-cross-hide'));
  const crossHide = phase !== 'idle' ? ' hr-cross-hide' : '';

  const secItems = items.filter(it => it.sec === si);
  const secCol = (s: number) => ({ '--hr-col': RADAR_SECTORS[s].col }) as CSSProperties;

  return (
    <section ref={hero} className="hr-hero" onMouseMove={onMove} onMouseLeave={onLeave}>
      <div ref={crossX} className={`hr-cross-x hr-cross-hide${crossHide}`} />
      <div ref={crossY} className={`hr-cross-y hr-cross-hide${crossHide}`} />
      <div ref={crossRead} className={`hr-cross-read hr-cross-hide${crossHide}`}>X 0.000 · Y 0.000</div>
      <div className="hr-inner">
        <div className="hr-left">
          <span className="hr-eyebrow"><span className="hr-dot" />On air · studio of one</span>
          <h1 className="hr-h1">Make. Ship. <em>Write it down.</em></h1>
          <p className="hr-lede">
            Small AI tools built in the open. Use the projects, read the build logs, send a message.
          </p>
          <div className="hr-rows" onMouseLeave={() => setLock(null)}>
            {RADAR_SECTORS.map((s, i) => (
              <a
                key={s.key}
                href={FLIP_DESTS[s.key].url}
                className={`hr-row${si === i ? ' is-on' : ''}`}
                style={secCol(i)}
                data-track={`home-sector-${s.key}`}
                onMouseEnter={() => setLock(i as 0 | 1 | 2)}
                onClick={e => { e.preventDefault(); doFlip(FLIP_DESTS[s.key]); }}
              >
                <span className="hr-row-no">{s.no}</span>
                <span className="hr-row-name">{s.k}</span>
                <span className="hr-row-count">{counts[i]} ↗</span>
              </a>
            ))}
          </div>
        </div>
        <RadarDial
          items={items}
          sectors={RADAR_SECTORS}
          size={dims.size}
          lockedSector={lock}
          paused={paused}
          highlightId={highlight}
          onSectorChange={setSweepSec}
          onLitChange={(ids, f) => { setLit(ids); setFocus(f); }}
          onLock={setLock}
          onUnlock={() => setLock(null)}
          onFlip={doFlip}
        />
        {dims.showReadout && (
          <div
            className="hr-readout"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => { setPaused(false); setHighlight(null); }}
            onFocus={() => setPaused(true)}
            onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setPaused(false); }}
          >
            <div className="hr-readout-top">
              <span style={{ color: '#a83818' }}>Sector {sector.no}{lock !== null || focus !== null ? ' · manual' : ''}</span>
              <span className="hr-readout-count">{counts[si]}</span>
            </div>
            <h2 className="hr-readout-name">{sector.k}</h2>
            <div className="hr-items">
              {secItems.map(it => (
                <a
                  key={it.id}
                  href={it.href}
                  className={`hr-item${focus === it.id ? ' is-focus' : lit.has(it.id) ? ' is-lit' : ''}`}
                  onMouseEnter={() => setHighlight(it.id)}
                  onMouseLeave={() => setHighlight(null)}
                  onClick={e => { if (it.dest) { e.preventDefault(); doFlip(it.dest); } }}
                >
                  <span className="hr-item-name">{it.name}</span>
                  <small>{it.sub}</small>
                </a>
              ))}
              {si === 1 && secItems.length === 0 && <span className="hr-item"><span className="hr-item-name">Weekly logs</span></span>}
            </div>
            <button type="button" className="hr-cta" data-track={`home-cta-${sector.key}`} onClick={() => doFlip(FLIP_DESTS[sector.key])}>
              {sector.cta} →
            </button>
          </div>
        )}
      </div>
      <FlipDestination dest={dest} phase={phase} spineLabels={SPINE_LABELS} />
    </section>
  );
}

