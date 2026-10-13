// Pure math + view-model helpers for the /projects "Projects Ring" page.
// Mirrors docs/design/projects-ring/Projects Ring.dc.html (wrap, meta, renderVals).
import { lastWorkedLabel, type HubCard } from './projectsView.js';

export const RING_DOTS = ['#a83818', '#1a1612', '#2e5a3e'] as const;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Signed shortest ring distance from `active` to `i`, in [-n/2, n/2]. */
export function ringOffset(i: number, active: number, n: number): number {
  let k = (((i - active) % n) + n) % n;
  if (k > n / 2) k -= n;
  return k;
}

export function heroBox(stageW: number): { left: number; width: number } {
  const width = Math.round(clamp(stageW * 0.44, 460, 680));
  return { left: Math.round((stageW - width) / 2), width };
}

export interface SpineGeom {
  x: number;
  w: number;
  h: number;
  opacity: number;
  fontPx: number;
  hidden: boolean;
}

const HERO_GAP = 8;
const SPINE_GAP = 6;
const MAX_J = 30;

const STAGE_MARGIN = 8;
const MAX_SIDE = 29;

/** Factor (>1) that stretches `count` spines to fill `available` px; 1 when they already reach it. */
function sideScale(count: number, available: number, falloff: number): number {
  if (count <= 0 || available <= 0) return 1;
  let sum = 0;
  for (let m = 1; m <= count; m++) sum += 64 * Math.pow(falloff, m - 1);
  const gaps = SPINE_GAP * (count - 1);
  return sum + gaps < available ? (available - gaps) / sum : 1;
}

/** `n` (card count), when given, widens a side's spines to fill the stage when there are too few to reach it. */
export function spineGeom(
  k: number,
  stageW: number,
  stageH: number,
  falloff = 0.9,
  n?: number,
): SpineGeom {
  const base = Math.max(120, stageH - 40);
  if (k === 0) {
    return { x: stageW / 2 - 32, w: 64, h: base, opacity: 0, fontPx: 22, hidden: true };
  }
  const { left, width } = heroBox(stageW);
  const heroRight = left + width;
  const j = Math.abs(k);
  const jj = Math.min(j, MAX_J);
  let scale = 1;
  if (n !== undefined) {
    const count = k > 0 ? Math.min(MAX_SIDE, Math.floor(n / 2)) : Math.min(MAX_SIDE, n - 1 - Math.floor(n / 2));
    scale = sideScale(count, left - HERO_GAP - STAGE_MARGIN, falloff);
  }
  const spineW = (m: number) => 64 * Math.pow(falloff, m - 1) * scale;
  let cum = HERO_GAP;
  for (let m = 1; m < jj; m++) cum += spineW(m) + SPINE_GAP;
  const w = spineW(jj);
  const x = k > 0 ? heroRight + cum : left - cum - w;
  const off = k > 0 ? x > stageW : x + w < 0;
  const hidden = off || j > 29;
  return {
    x,
    w,
    h: base * Math.pow(0.95, jj),
    opacity: hidden ? 0 : Math.max(0.25, 1 - (j - 1) * 0.06),
    fontPx: Math.max(11, Math.round(22 * Math.pow(0.93, jj - 1))),
    hidden,
  };
}

export function tickStyle(d: number): { h: number; color: string } {
  if (d === 0) return { h: 28, color: '#a83818' };
  if (d <= 6) return { h: 16, color: '#5d5648' };
  return { h: 8, color: '#d4ccb8' };
}

export const pad3 = (i: number): string => String(i + 1).padStart(3, '0');

export function ringStats(card: HubCard): { v: string; l: string }[] {
  const out: { v: string; l: string }[] = [];
  if (card.metric) out.push({ v: card.metric, l: (card.metricLabel ?? '').toUpperCase() });
  if (card.lang) out.push({ v: card.lang, l: 'PRIMARY LANG' });
  const updated = lastWorkedLabel(card);
  if (updated) out.push({ v: updated, l: 'UPDATED' });
  return out;
}
