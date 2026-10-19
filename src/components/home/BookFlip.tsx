import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';

export interface FlipDest {
  key: string;
  path: string;
  eyebrow: string;
  title: string;
  lede: string;
  url: string;
  spa: boolean;
  spines: boolean;
}

type Phase = 'idle' | 'out';

const FLIP_MS = 950;

/** Remove flip classes without letting the page animate back (no transition on reset). */
function resetFlipClasses(removeArmed: boolean): void {
  const cl = document.body.classList;
  cl.add('bk-flip-reset');
  cl.remove('bk-flip-out');
  if (removeArmed) cl.remove('bk-flip-armed');
  void document.body.offsetHeight; // force reflow so the un-flipped state paints without a transition
  requestAnimationFrame(() => document.body.classList.remove('bk-flip-reset'));
}

export function useBookFlip(): {
  phase: Phase;
  dest: FlipDest | null;
  flip: (dest: FlipDest) => void;
} {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>('idle');
  const [dest, setDest] = useState<FlipDest | null>(null);
  const busy = useRef(false);
  const timers = useRef<number[]>([]);
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  useEffect(() => {
    document.body.classList.add('bk-flip-armed');
    const onPageShow = (e: PageTransitionEvent) => {
      if (!e.persisted) return;
      busy.current = false;
      setPhase('idle');
      setDest(null);
      resetFlipClasses(false);
    };
    window.addEventListener('pageshow', onPageShow);
    return () => {
      window.removeEventListener('pageshow', onPageShow);
      timers.current.forEach((t) => window.clearTimeout(t));
      timers.current = [];
      busy.current = false;
      resetFlipClasses(true);
    };
  }, []);

  const flip = useCallback((d: FlipDest) => {
    if (busy.current) return;
    busy.current = true;
    const go = () => {
      if (d.spa) navigateRef.current(d.url);
      else window.location.assign(d.url);
    };
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || window.innerWidth < 900) {
      go();
      return;
    }
    setDest(d);
    setPhase('out');
    document.body.classList.add('bk-flip-out');
    timers.current.push(window.setTimeout(go, FLIP_MS));
  }, []);

  return { phase, dest, flip };
}

const MONO = "'JetBrains Mono', monospace";
const SERIF = "'Source Serif 4', serif";

const SPINES: ReadonlyArray<{ flex: number; h: number }> = [
  { flex: 1, h: 78 },
  { flex: 1, h: 84 },
  { flex: 1.2, h: 90 },
  { flex: 3.4, h: 100 },
  { flex: 1.2, h: 90 },
  { flex: 1, h: 84 },
  { flex: 1, h: 78 },
];

const ROW_WIDTHS = ['62%', '48%', '70%', '40%'];

export function FlipDestination(props: {
  dest: FlipDest | null;
  phase: Phase;
  spineLabels: readonly string[];
}) {
  const { dest, phase, spineLabels } = props;
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (phase !== 'out') {
      setLoaded(false);
      return;
    }
    const id = requestAnimationFrame(() => setLoaded(true));
    return () => cancelAnimationFrame(id);
  }, [phase]);

  if (phase !== 'out' || !dest || typeof document === 'undefined') return null;

  const labels = spineLabels.slice(0, 6);
  let sideIdx = 0;

  const layer: CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: 0,
    background: '#f5f0e6',
    display: 'flex',
    flexDirection: 'column',
    pointerEvents: 'none',
  };

  return createPortal(
    <div aria-hidden="true" data-screen-label="Destination" style={layer}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '18px 56px',
          borderBottom: '1px solid #d4ccb8',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: SERIF, fontSize: 22 }}>
          <span
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: '#1a1612',
              color: '#f5f0e6',
              display: 'grid',
              placeItems: 'center',
              fontStyle: 'italic',
              fontSize: 17,
            }}
          >
            B
          </span>
          Bilko Bibitkov
        </span>
        <span
          style={{
            fontFamily: MONO,
            fontSize: 11,
            letterSpacing: '.12em',
            textTransform: 'uppercase',
            color: '#5d5648',
          }}
        >
          {dest.path}
        </span>
      </div>
      <div
        style={{
          padding: '44px 56px 32px',
          borderBottom: '1px solid #d4ccb8',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <span
          style={{
            fontFamily: MONO,
            fontSize: 11,
            letterSpacing: '.18em',
            textTransform: 'uppercase',
            color: '#5d5648',
          }}
        >
          {dest.eyebrow}
        </span>
        <span
          style={{
            fontFamily: SERIF,
            fontSize: 'clamp(48px,7vw,88px)',
            lineHeight: 0.95,
            letterSpacing: '-.025em',
          }}
        >
          {dest.title}
        </span>
        <span style={{ maxWidth: 640, fontSize: 18, lineHeight: 1.5, color: '#3a342b' }}>{dest.lede}</span>
      </div>
      <div
        style={{
          flex: 1,
          minHeight: 0,
          padding: '32px 56px',
          display: 'flex',
          gap: 10,
          alignItems: 'flex-end',
          overflow: 'hidden',
        }}
      >
        {dest.spines ? (
          <div style={{ flex: 1, display: 'flex', gap: 8, alignItems: 'flex-end', height: '100%' }}>
            {SPINES.map((s, i) => {
              const hero = s.h === 100;
              const label = hero ? undefined : labels[sideIdx++];
              return (
                <div
                  key={i}
                  style={{
                    flex: s.flex,
                    height: `${s.h}%`,
                    border: `1px solid ${hero ? '#9c937f' : '#2a241c'}`,
                    background: hero ? '#f5f0e6' : '#ede6d6',
                    overflow: 'hidden',
                    display: 'flex',
                    justifyContent: 'center',
                    padding: '14px 0',
                  }}
                >
                  {label && (
                    <span
                      style={{
                        fontFamily: SERIF,
                        fontSize: 15,
                        color: '#1a1612',
                        writingMode: 'vertical-rl',
                        transform: 'rotate(180deg)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {label}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ flex: 1, alignSelf: 'flex-start', display: 'flex', flexDirection: 'column' }}>
            {ROW_WIDTHS.map((w) => (
              <div
                key={w}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '100px 1fr 100px',
                  gap: 24,
                  padding: '22px 0',
                  borderBottom: '1px solid #d4ccb8',
                }}
              >
                <span style={{ height: 10, background: '#e3dcc8' }} />
                <span style={{ height: 22, width: w, background: '#e3dcc8' }} />
                <span style={{ height: 10, background: '#e3dcc8' }} />
              </div>
            ))}
          </div>
        )}
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '16px 56px 20px',
          fontFamily: MONO,
          fontSize: 11,
          letterSpacing: '.12em',
          textTransform: 'uppercase',
          color: '#5d5648',
        }}
      >
        <span style={{ whiteSpace: 'nowrap' }}>{`Opening ${dest.path}`}</span>
        <div style={{ flex: 1, height: 3, background: '#e3dcc8', overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              width: loaded ? '100%' : '0%',
              background: '#a83818',
              transition: 'width 1.6s cubic-bezier(.3,.6,.2,1)',
            }}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}
