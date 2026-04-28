/**
 * Custom SVG diagrams for the Academy. All animations are native SMIL —
 * no JS, no libraries — so they pause naturally if the user prefers
 * reduced motion (we respect that via the .pf-diagram CSS).
 */
import type { ReactNode } from 'react';

interface FrameProps {
  caption: string;
  children: ReactNode;
  ratio?: string;
}

export function DiagramFrame({ caption, children, ratio = '16/9' }: FrameProps) {
  return (
    <figure className="pf-diagram">
      <div className="pf-diagram-stage" style={{ aspectRatio: ratio }}>
        {children}
      </div>
      <figcaption>{caption}</figcaption>
    </figure>
  );
}

/* ── 1. Tokenizer ──────────────────────────────────────────────── */
export function DiagramTokenizer() {
  const tokens = [
    { text: 'Hey', x: 60,  w: 56, color: 'var(--pf-accent)' },
    { text: ',',   x: 122, w: 22, color: 'var(--pf-blue)' },
    { text: ' I',  x: 150, w: 32, color: 'var(--pf-accent)' },
    { text: ' build', x: 188, w: 78, color: 'var(--pf-ink)' },
    { text: ' AI',    x: 272, w: 44, color: 'var(--pf-accent)' },
    { text: ' things',x: 322, w: 86, color: 'var(--pf-ink)' },
    { text: '.',      x: 414, w: 22, color: 'var(--pf-blue)' },
  ];
  return (
    <DiagramFrame caption="A sentence isn't read as words — it's chunked into tokens, each one a number the model has seen millions of times before.">
      <svg viewBox="0 0 480 200" width="100%" height="100%">
        <defs>
          <marker id="arrow1" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--pf-ink-3)" />
          </marker>
        </defs>
        {/* input string */}
        <text x="20" y="40" fontFamily="var(--pf-font-mono)" fontSize="13" fill="var(--pf-ink-3)">input</text>
        <rect x="20" y="50" width="440" height="36" fill="none" stroke="var(--pf-rule-2)" strokeDasharray="4 4" />
        <text x="40" y="74" fontFamily="var(--pf-font-display)" fontSize="20" fill="var(--pf-ink)">"Hey, I build AI things."</text>
        {/* arrow */}
        <line x1="240" y1="92" x2="240" y2="116" stroke="var(--pf-ink-3)" strokeWidth="1.2" markerEnd="url(#arrow1)" />
        {/* tokens with stagger */}
        <text x="20" y="138" fontFamily="var(--pf-font-mono)" fontSize="13" fill="var(--pf-ink-3)">tokens</text>
        {tokens.map((t, i) => (
          <g key={i}>
            <rect
              x={t.x} y="148" width={t.w} height="36"
              fill={t.color} opacity="0.18" stroke={t.color} strokeWidth="1.2"
            >
              <animate attributeName="opacity" values="0;0.18;0.18" keyTimes="0;0.6;1" dur="3.2s" begin={`${i * 0.18}s`} repeatCount="indefinite" />
            </rect>
            <text
              x={t.x + t.w / 2} y="172" textAnchor="middle"
              fontFamily="var(--pf-font-mono)" fontSize="12" fill="var(--pf-ink)"
            >
              <animate attributeName="opacity" values="0;1;1" keyTimes="0;0.6;1" dur="3.2s" begin={`${i * 0.18}s`} repeatCount="indefinite" />
              {t.text.trim() || ' '}
            </text>
          </g>
        ))}
      </svg>
    </DiagramFrame>
  );
}

/* ── 2. Next-token probabilities ───────────────────────────────── */
export function DiagramNextToken() {
  const candidates = [
    { token: ' humans', p: 0.42 },
    { token: ' people', p: 0.21 },
    { token: ' users',  p: 0.15 },
    { token: ' the',    p: 0.09 },
    { token: ' you',    p: 0.06 },
  ];
  const max = 0.42;
  return (
    <DiagramFrame caption="The model doesn't choose a word. It samples from a probability distribution over every token it knows. The same prompt can pick a different word next time.">
      <svg viewBox="0 0 480 240" width="100%" height="100%">
        <text x="20" y="28" fontFamily="var(--pf-font-mono)" fontSize="12" fill="var(--pf-ink-3)" letterSpacing="0.1em">PROMPT</text>
        <text x="20" y="56" fontFamily="var(--pf-font-display)" fontSize="22" fill="var(--pf-ink)">"I build AI things for…"</text>

        <text x="20" y="92" fontFamily="var(--pf-font-mono)" fontSize="11" fill="var(--pf-ink-3)" letterSpacing="0.1em">TOP 5 CANDIDATES</text>

        {candidates.map((c, i) => {
          const y = 110 + i * 26;
          const w = (c.p / max) * 320;
          const isPicked = i === 0;
          return (
            <g key={i}>
              <text x="20" y={y + 14} fontFamily="var(--pf-font-mono)" fontSize="13" fill="var(--pf-ink-2)">{c.token}</text>
              <rect x="120" y={y} width="0" height="18" fill={isPicked ? 'var(--pf-accent)' : 'var(--pf-ink-3)'} opacity={isPicked ? 1 : 0.4}>
                <animate attributeName="width" from="0" to={w} dur="0.6s" begin={`${0.6 + i * 0.18}s`} fill="freeze" />
              </rect>
              <text x={130 + w} y={y + 13} fontFamily="var(--pf-font-mono)" fontSize="11" fill="var(--pf-ink-3)" opacity="0">
                <animate attributeName="opacity" from="0" to="1" dur="0.4s" begin={`${1.0 + i * 0.18}s`} fill="freeze" />
                {c.p.toFixed(2)}
              </text>
              {isPicked && (
                <circle cx="106" cy={y + 9} r="5" fill="var(--pf-accent)" opacity="0">
                  <animate attributeName="opacity" from="0" to="1" dur="0.3s" begin="2.4s" fill="freeze" />
                </circle>
              )}
            </g>
          );
        })}
      </svg>
    </DiagramFrame>
  );
}

/* ── 3. Context window slider ──────────────────────────────────── */
export function DiagramContextWindow() {
  return (
    <DiagramFrame caption="The model doesn't 'remember' a conversation — it re-reads everything inside a fixed-size window every turn. Words that fall off the left edge stop existing.">
      <svg viewBox="0 0 480 200" width="100%" height="100%">
        <text x="20" y="28" fontFamily="var(--pf-font-mono)" fontSize="11" fill="var(--pf-ink-3)" letterSpacing="0.1em">CONTEXT WINDOW · 8K TOKENS</text>
        {/* document strip */}
        <rect x="20" y="60" width="900" height="48" fill="var(--pf-paper)" stroke="var(--pf-rule-2)">
          <animate attributeName="x" values="20;-460;20" keyTimes="0;0.5;1" dur="9s" repeatCount="indefinite" />
        </rect>
        {/* hatching */}
        {[...Array(60)].map((_, i) => (
          <line key={i} x1={28 + i * 15} y1="60" x2={28 + i * 15} y2="108" stroke="var(--pf-ink)" strokeWidth="0.4" opacity="0.18">
            <animate attributeName="x1" values={`${28 + i * 15};${-452 + i * 15};${28 + i * 15}`} keyTimes="0;0.5;1" dur="9s" repeatCount="indefinite" />
            <animate attributeName="x2" values={`${28 + i * 15};${-452 + i * 15};${28 + i * 15}`} keyTimes="0;0.5;1" dur="9s" repeatCount="indefinite" />
          </line>
        ))}
        {/* viewport mask */}
        <rect x="160" y="48" width="220" height="72" fill="none" stroke="var(--pf-accent)" strokeWidth="2" />
        <text x="270" y="42" textAnchor="middle" fontFamily="var(--pf-font-mono)" fontSize="11" fill="var(--pf-accent)" letterSpacing="0.1em">VISIBLE NOW</text>
        {/* falling-off label */}
        <text x="40" y="148" fontFamily="var(--pf-font-mono)" fontSize="10" fill="var(--pf-ink-3)" letterSpacing="0.1em">FALLS OFF →</text>
        <text x="380" y="148" fontFamily="var(--pf-font-mono)" fontSize="10" fill="var(--pf-ink-3)" letterSpacing="0.1em" textAnchor="end">← MOST RECENT</text>
        {/* a "lost" token blinking out */}
        <g>
          <rect x="62" y="70" width="36" height="28" fill="var(--pf-ink)" opacity="0.7">
            <animate attributeName="opacity" values="0.7;0.7;0;0" keyTimes="0;0.3;0.45;1" dur="9s" repeatCount="indefinite" />
            <animate attributeName="x" values="62;-558;62" keyTimes="0;0.5;1" dur="9s" repeatCount="indefinite" />
          </rect>
        </g>
      </svg>
    </DiagramFrame>
  );
}

/* ── 4. Lookup vs Predict (hallucination) ──────────────────────── */
export function DiagramHallucination() {
  return (
    <DiagramFrame caption="A database returns 'I don't know.' A language model returns the most plausible-sounding answer. Both can sound confident; only one is grounded.">
      <svg viewBox="0 0 480 240" width="100%" height="100%">
        {/* shared question */}
        <rect x="180" y="14" width="120" height="32" fill="none" stroke="var(--pf-ink)" />
        <text x="240" y="34" textAnchor="middle" fontFamily="var(--pf-font-mono)" fontSize="11" fill="var(--pf-ink)">"Year of X?"</text>

        {/* left path: lookup */}
        <path d="M 200 46 Q 110 70 110 100" fill="none" stroke="var(--pf-blue)" strokeWidth="1.5" markerEnd="url(#arrow2)" />
        <rect x="40" y="100" width="140" height="60" fill="var(--pf-paper)" stroke="var(--pf-blue)" />
        <text x="110" y="122" textAnchor="middle" fontFamily="var(--pf-font-mono)" fontSize="11" fill="var(--pf-blue)" letterSpacing="0.1em">DATABASE</text>
        <text x="110" y="146" textAnchor="middle" fontFamily="var(--pf-font-display)" fontSize="18" fill="var(--pf-ink)" fontStyle="italic">no row → null</text>
        <rect x="40" y="180" width="140" height="40" fill="var(--pf-blue)" opacity="0.12" stroke="var(--pf-blue)" />
        <text x="110" y="205" textAnchor="middle" fontFamily="var(--pf-font-mono)" fontSize="12" fill="var(--pf-blue)">"I don't know."</text>

        {/* right path: predict */}
        <path d="M 280 46 Q 370 70 370 100" fill="none" stroke="var(--pf-accent)" strokeWidth="1.5" markerEnd="url(#arrow2)" />
        <rect x="300" y="100" width="140" height="60" fill="var(--pf-paper)" stroke="var(--pf-accent)" />
        <text x="370" y="122" textAnchor="middle" fontFamily="var(--pf-font-mono)" fontSize="11" fill="var(--pf-accent)" letterSpacing="0.1em">LANGUAGE MODEL</text>
        <text x="370" y="146" textAnchor="middle" fontFamily="var(--pf-font-display)" fontSize="18" fill="var(--pf-ink)" fontStyle="italic">most likely string</text>
        <rect x="300" y="180" width="140" height="40" fill="var(--pf-accent)" opacity="0.18" stroke="var(--pf-accent)" />
        <text x="370" y="205" textAnchor="middle" fontFamily="var(--pf-font-mono)" fontSize="12" fill="var(--pf-ink)">"It was 1847."</text>
        {/* warning blink on the made-up answer */}
        <text x="370" y="222" textAnchor="middle" fontFamily="var(--pf-font-mono)" fontSize="9" fill="var(--pf-accent)" letterSpacing="0.1em">
          <animate attributeName="opacity" values="0;1;1;0;0;1" keyTimes="0;0.1;0.3;0.4;0.7;1" dur="3s" repeatCount="indefinite" />
          (NOT VERIFIED)
        </text>

        <defs>
          <marker id="arrow2" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
          </marker>
        </defs>
      </svg>
    </DiagramFrame>
  );
}

/* ── 5. Temperature dial ───────────────────────────────────────── */
export function DiagramTemperature() {
  // Three sample outputs at temps 0.0 / 0.7 / 1.4 from the same prompt.
  return (
    <DiagramFrame caption="Temperature is a single number that decides how spicy the dice are. Zero gives you the same boring answer every time. High numbers give you accidental brilliance — and accidental nonsense.">
      <svg viewBox="0 0 480 240" width="100%" height="100%">
        <text x="20" y="28" fontFamily="var(--pf-font-mono)" fontSize="11" fill="var(--pf-ink-3)" letterSpacing="0.1em">PROMPT · "Write a one-line bio for a builder."</text>
        {[
          { t: '0.0', label: 'cold', y: 56,  text: 'A builder who ships small useful things.', col: 'var(--pf-blue)' },
          { t: '0.7', label: 'mid',  y: 116, text: 'Builder of stubborn experiments and unsentimental tools.', col: 'var(--pf-ink)' },
          { t: '1.4', label: 'hot',  y: 176, text: 'A workshop in human form. Some days a typewriter; some days a kiln.', col: 'var(--pf-accent)' },
        ].map((row, i) => (
          <g key={i}>
            <text x="20" y={row.y} fontFamily="var(--pf-font-mono)" fontSize="13" fill={row.col}>{row.t}</text>
            <text x="60" y={row.y} fontFamily="var(--pf-font-mono)" fontSize="10" fill="var(--pf-ink-3)" letterSpacing="0.1em">{row.label.toUpperCase()}</text>
            {/* dial */}
            <circle cx="120" cy={row.y - 5} r="10" fill="none" stroke={row.col} strokeWidth="1.4" />
            <line x1="120" y1={row.y - 5} x2={120 + Math.cos((-90 + parseFloat(row.t) * 60) * Math.PI / 180) * 8} y2={row.y - 5 + Math.sin((-90 + parseFloat(row.t) * 60) * Math.PI / 180) * 8} stroke={row.col} strokeWidth="2">
              <animate attributeName="x2" values={`${120 + Math.cos((-90 + parseFloat(row.t) * 60) * Math.PI / 180) * 8};${120 + Math.cos((-90 + parseFloat(row.t) * 60 + (i === 2 ? 14 : i === 1 ? 6 : 0)) * Math.PI / 180) * 8};${120 + Math.cos((-90 + parseFloat(row.t) * 60) * Math.PI / 180) * 8}`} dur="4s" repeatCount="indefinite" />
            </line>
            <line x1="142" y1={row.y - 5} x2="160" y2={row.y - 5} stroke={row.col} strokeWidth="1" />
            <text x="170" y={row.y} fontFamily="var(--pf-font-display)" fontSize="16" fill="var(--pf-ink)" fontStyle="italic">{row.text}</text>
          </g>
        ))}
      </svg>
    </DiagramFrame>
  );
}

/* ── Generic curriculum-step diagram, used by stub lessons ─────── */
interface StepRingProps {
  steps: readonly string[];
  active: number;
}
export function DiagramStepRing({ steps, active }: StepRingProps) {
  const cx = 240;
  const cy = 110;
  const r = 80;
  return (
    <DiagramFrame caption="The arc of the lesson, at a glance." ratio="2/1">
      <svg viewBox="0 0 480 220" width="100%" height="100%">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--pf-rule-2)" strokeDasharray="2 4" />
        {steps.map((s, i) => {
          const angle = (-Math.PI / 2) + (i * 2 * Math.PI / steps.length);
          const x = cx + Math.cos(angle) * r;
          const y = cy + Math.sin(angle) * r;
          const isActive = i === active;
          return (
            <g key={i}>
              <circle cx={x} cy={y} r={isActive ? 12 : 7} fill={isActive ? 'var(--pf-accent)' : 'var(--pf-ink)'} />
              {isActive && (
                <circle cx={x} cy={y} r="20" fill="none" stroke="var(--pf-accent)" strokeWidth="1">
                  <animate attributeName="r" values="14;28;14" dur="2.4s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="1;0;1" dur="2.4s" repeatCount="indefinite" />
                </circle>
              )}
              <text
                x={x + Math.cos(angle) * 28}
                y={y + Math.sin(angle) * 28 + 4}
                textAnchor="middle"
                fontFamily="var(--pf-font-mono)" fontSize="11"
                fill={isActive ? 'var(--pf-ink)' : 'var(--pf-ink-3)'}
              >
                {s}
              </text>
            </g>
          );
        })}
      </svg>
    </DiagramFrame>
  );
}
