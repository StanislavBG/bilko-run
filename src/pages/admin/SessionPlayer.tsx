import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import type { KeyboardEvent } from 'react';
import { buildSessionSteps, filterSteps } from '../../lib/sessionSteps';
import type { TimelineItem, Step } from '../../lib/sessionSteps';

const fmtMmSs = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const KIND_STYLE: Record<TimelineItem['kind'], string> = {
  view: 'bg-warm-100 text-warm-600 dark:bg-warm-800 dark:text-warm-300',
  click: 'bg-fire-100 text-fire-700 dark:bg-fire-900/40 dark:text-fire-300',
  event: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  error: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

const SPEEDS = [1, 2, 4] as const;
const BTN = 'px-2.5 py-1 text-xs font-semibold rounded-lg bg-warm-100 text-warm-600 hover:bg-warm-200 disabled:opacity-40 dark:bg-warm-800 dark:text-warm-300 dark:hover:bg-warm-700';
const BTN_ON = 'px-2.5 py-1 text-xs font-semibold rounded-lg bg-fire-500 text-white';

export interface SessionPlayerProps {
  timeline: TimelineItem[];
  startedAt?: number;
  initialStep?: number;
  onStepChange?: (index: number) => void;
}

// Step-through player for one session: journey strip, current-step card,
// numbered step list and Prev/Next/Play controls.
export function SessionPlayer({ timeline, startedAt, initialStep = 0, onStepChange }: SessionPlayerProps) {
  const { steps: allSteps, pages } = useMemo(() => buildSessionSteps(timeline, startedAt), [timeline, startedAt]);
  const [mode, setMode] = useState<'all' | 'clicks'>('all');
  const steps = useMemo(() => filterSteps(allSteps, mode), [allSteps, mode]);
  const last = Math.max(0, steps.length - 1);

  const [rawIdx, setIdx] = useState(initialStep);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const idx = Math.min(Math.max(0, rawIdx), last);

  const listRef = useRef<HTMLOListElement>(null);
  const activeRef = useRef<HTMLLIElement>(null);
  const onChangeRef = useRef(onStepChange);
  onChangeRef.current = onStepChange;
  const prevIdx = useRef<number | null>(null);

  // Fire onStepChange on every change of the effective step (not on mount).
  useEffect(() => {
    if (prevIdx.current !== null && prevIdx.current !== idx) onChangeRef.current?.(idx);
    prevIdx.current = idx;
  }, [idx]);

  // Auto-advance; the interval is cleared on unmount, pause, or reaching the end.
  useEffect(() => {
    if (!playing) return;
    if (idx >= last) { setPlaying(false); return; }
    const timer = setInterval(() => setIdx(i => Math.min(i + 1, last)), 1000 / speed);
    return () => clearInterval(timer);
  }, [playing, speed, idx, last]);

  // Keep the active list item visible without scrolling the whole page.
  useEffect(() => {
    const list = listRef.current;
    const el = activeRef.current;
    if (!list || !el) return;
    if (el.offsetTop < list.scrollTop) list.scrollTop = el.offsetTop;
    else if (el.offsetTop + el.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTop = el.offsetTop + el.offsetHeight - list.clientHeight;
    }
  }, [idx, steps]);

  const go = useCallback((i: number) => setIdx(Math.min(Math.max(0, i), last)), [last]);

  const togglePlay = () => {
    if (!playing && idx >= last) setIdx(0);
    setPlaying(p => !p);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(idx - 1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); go(idx + 1); }
    else if (e.key === ' ' || e.key === 'Spacebar') {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'BUTTON' || tag === 'SELECT') return;
      e.preventDefault();
      togglePlay();
    }
  };

  const jumpToPage = (pageIndex: number) => {
    const target = pages[pageIndex];
    if (!target) return;
    let pos = steps.findIndex(s => s.index === target.firstStepIndex);
    if (pos < 0) pos = steps.findIndex(s => s.pageIndex === pageIndex);
    if (pos >= 0) go(pos);
  };

  if (allSteps.length === 0) {
    return (
      <div className="text-center py-8 text-warm-400 text-sm dark:text-warm-500">
        No recorded activity for this session
      </div>
    );
  }

  const cur: Step | undefined = steps[idx];

  return (
    <div
      tabIndex={0}
      onKeyDown={onKeyDown}
      className="space-y-4 p-4 outline-none focus-visible:ring-2 focus-visible:ring-fire-400 rounded-xl"
    >
      {/* Journey strip */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {pages.map((p, i) => (
          <div key={p.index} className="flex items-center gap-1 shrink-0">
            {i > 0 && <span className="text-warm-300 dark:text-warm-600">→</span>}
            <button
              onClick={() => jumpToPage(p.index)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-mono text-left border transition-colors ${
                cur && cur.pageIndex === p.index
                  ? 'bg-fire-50 border-fire-300 text-fire-700 dark:bg-fire-900/30 dark:border-fire-700 dark:text-fire-300'
                  : 'bg-white border-warm-200 text-warm-700 hover:bg-warm-50 dark:bg-warm-900 dark:border-warm-700 dark:text-warm-300 dark:hover:bg-warm-800'
              }`}
            >
              <div className="max-w-[12rem] truncate font-bold" title={p.path}>{p.path}</div>
              <div className="text-[10px] text-warm-500 dark:text-warm-400">
                {fmtMmSs(p.dwellMs)} · {p.clickCount} {p.clickCount === 1 ? 'click' : 'clicks'}
              </div>
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-1">
        <span className="text-xs text-warm-500 mr-1 dark:text-warm-400">Show:</span>
        <button onClick={() => setMode('all')} className={mode === 'all' ? BTN_ON : BTN}>All</button>
        <button onClick={() => setMode('clicks')} className={mode === 'clicks' ? BTN_ON : BTN}>Clicks only</button>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        {/* Step card + controls */}
        <div className="flex-1 min-w-0 space-y-3">
          <div className="rounded-xl border border-warm-200/60 bg-white p-5 space-y-3 dark:border-warm-700 dark:bg-warm-900">
            {cur ? (
              <>
                <div className="flex items-center gap-3 text-xs font-mono text-warm-500 dark:text-warm-400">
                  <span className="font-bold">Step {idx + 1} of {steps.length}</span>
                  <span>+{fmtMmSs(cur.offsetMs)}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${KIND_STYLE[cur.kind]}`}>{cur.kind}</span>
                  {cur.count > 1 && <span className="font-bold text-fire-600 dark:text-fire-400">x{cur.count}</span>}
                </div>
                <div className={`text-lg font-extrabold break-words ${
                  cur.kind === 'error' ? 'text-red-600 dark:text-red-400' : 'text-warm-900 dark:text-warm-50'
                }`}>
                  {cur.title}
                </div>
                <div className="text-xs font-mono text-warm-600 break-all dark:text-warm-300">{cur.path}</div>
                {cur.detail && (
                  <div className={`text-xs font-mono break-all ${
                    cur.kind === 'error' ? 'text-red-500' : 'text-warm-500 dark:text-warm-400'
                  }`}>
                    {cur.detail}
                  </div>
                )}
              </>
            ) : (
              <div className="text-warm-400 text-sm dark:text-warm-500">No steps match this filter</div>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => go(idx - 1)} disabled={idx <= 0} className={BTN}>Prev</button>
            <button onClick={togglePlay} disabled={steps.length === 0} className={playing ? BTN_ON : BTN}>
              {playing ? 'Pause' : 'Play'}
            </button>
            <button onClick={() => go(idx + 1)} disabled={idx >= last} className={BTN}>Next</button>
            <select
              value={speed}
              onChange={e => setSpeed(Number(e.target.value) as (typeof SPEEDS)[number])}
              aria-label="Playback speed"
              className="px-2 py-1 text-xs rounded-lg border border-warm-200 bg-white text-warm-700 dark:border-warm-700 dark:bg-warm-900 dark:text-warm-300"
            >
              {SPEEDS.map(s => <option key={s} value={s}>{s}x</option>)}
            </select>
          </div>
        </div>

        {/* Step list */}
        <ol
          ref={listRef}
          className="relative md:w-80 max-h-80 overflow-y-auto rounded-xl border border-warm-200/60 bg-white divide-y divide-warm-50 dark:border-warm-700 dark:bg-warm-900 dark:divide-warm-800"
        >
          {steps.map((s, i) => (
            <li
              key={s.index}
              ref={i === idx ? activeRef : undefined}
              onClick={() => go(i)}
              className={`flex items-center gap-2 px-3 py-2 text-xs font-mono cursor-pointer transition-colors ${
                i === idx
                  ? 'bg-fire-50 text-fire-700 dark:bg-fire-900/30 dark:text-fire-300'
                  : 'text-warm-700 hover:bg-warm-50/50 dark:text-warm-300 dark:hover:bg-warm-800'
              }`}
            >
              <span className="w-6 shrink-0 text-right text-warm-400 dark:text-warm-500">{i + 1}</span>
              <span className={`shrink-0 px-1 py-0.5 rounded text-[10px] font-bold ${KIND_STYLE[s.kind]}`}>{s.kind}</span>
              <span className={`truncate ${s.kind === 'error' ? 'text-red-500' : ''}`} title={s.title}>
                {s.title}{s.count > 1 ? ` x${s.count}` : ''}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
