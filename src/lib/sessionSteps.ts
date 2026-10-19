// Pure helpers that turn the merged session timeline from
// GET /api/admin/sessions/:id into numbered steps and page visits.

import type { TimelineItem } from '../../shared/session-timeline';

export type { TimelineItem };

export interface Step {
  index: number;
  ts: number;
  offsetMs: number;
  kind: TimelineItem['kind'];
  path: string;
  title: string;
  detail: string;
  pageIndex: number;
  count: number;
}

export interface PageVisit {
  index: number;
  path: string;
  enteredAt: number;
  dwellMs: number;
  clickCount: number;
  firstStepIndex: number;
}

const COLLAPSE_WINDOW_MS = 1000;
const NO_PAGE = '(before first page)';

export function buildSessionSteps(
  timeline: TimelineItem[],
  startedAt?: number,
): { steps: Step[]; pages: PageVisit[] } {
  if (timeline.length === 0) return { steps: [], pages: [] };

  // Array.prototype.sort is stable.
  const sorted = [...timeline].sort((a, b) => a.ts - b.ts);
  const base = startedAt ?? sorted[0].ts;

  const steps: Step[] = [];
  const pages: PageVisit[] = [];
  let lastClickKey: string | null = null;
  let lastClickTs = 0;

  const startPage = (path: string, ts: number) => {
    pages.push({ index: pages.length, path, enteredAt: ts, dwellMs: 0, clickCount: 0, firstStepIndex: steps.length });
  };

  for (const item of sorted) {
    const current = pages[pages.length - 1];

    if (item.kind === 'view') {
      if (current && current.path === item.path) continue;
      startPage(item.path, item.ts);
    } else if (item.kind === 'click') {
      if (!current || current.path !== item.path) startPage(item.path, item.ts);
    } else if (item.kind === 'event') {
      if (item.path && (!current || current.path !== item.path)) startPage(item.path, item.ts);
      else if (!current) startPage(NO_PAGE, item.ts);
    } else if (!current) {
      startPage(NO_PAGE, item.ts);
    }

    const page = pages[pages.length - 1];

    if (item.kind === 'click') {
      const title = item.track_name ?? item.label ?? item.href ?? '(unlabeled click)';
      const key = `${item.path}\u0000${item.track_name ?? item.label ?? ''}`;
      const prev = steps[steps.length - 1];
      if (
        prev && prev.kind === 'click' && prev.pageIndex === page.index &&
        lastClickKey === key && item.ts - lastClickTs <= COLLAPSE_WINDOW_MS
      ) {
        prev.count += 1;
        lastClickTs = item.ts;
        continue;
      }
      lastClickKey = key;
      lastClickTs = item.ts;
      steps.push({
        index: steps.length, ts: item.ts, offsetMs: item.ts - base, kind: 'click',
        path: item.path, title, detail: item.href ?? '', pageIndex: page.index, count: 1,
      });
      page.clickCount += 1;
      continue;
    }

    let title: string;
    let detail: string;
    let path: string;
    if (item.kind === 'view') {
      title = item.path;
      detail = item.referrer ? `← ${item.referrer}` : '';
      path = item.path;
    } else if (item.kind === 'event') {
      title = item.name;
      detail = item.app ?? '';
      path = item.path ?? page.path;
    } else {
      title = `Error: ${item.msg}`;
      detail = item.url ?? '';
      path = page.path;
    }
    steps.push({
      index: steps.length, ts: item.ts, offsetMs: item.ts - base, kind: item.kind,
      path, title, detail, pageIndex: page.index, count: 1,
    });
  }

  const lastTs = steps.length ? steps[steps.length - 1].ts : 0;
  pages.forEach((p, i) => {
    const end = i + 1 < pages.length ? pages[i + 1].enteredAt : lastTs;
    p.dwellMs = Math.max(0, end - p.enteredAt);
  });

  return { steps, pages };
}

export function filterSteps(steps: Step[], mode: 'all' | 'clicks'): Step[] {
  if (mode === 'all') return steps;
  return steps.filter((s) => s.kind === 'click' || s.kind === 'view');
}
