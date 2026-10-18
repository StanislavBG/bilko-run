import { describe, it, expect } from 'vitest';
import { buildSessionSteps, filterSteps, type TimelineItem } from '../src/lib/sessionSteps';

const view = (ts: number, path: string): TimelineItem => ({ ts, kind: 'view', path, referrer: null });
const click = (
  ts: number, path: string,
  o: { label?: string | null; href?: string | null; track_name?: string | null } = {},
): TimelineItem => ({ ts, kind: 'click', path, label: o.label ?? null, href: o.href ?? null, track_name: o.track_name ?? null });

describe('buildSessionSteps', () => {
  it('returns empty arrays for empty input', () => {
    expect(buildSessionSteps([])).toEqual({ steps: [], pages: [] });
  });

  it('sorts unsorted input and measures offsets from startedAt or first item', () => {
    const items = [click(5000, '/a', { label: 'x' }), view(1000, '/a')];
    const r = buildSessionSteps(items);
    expect(r.steps.map((s) => s.kind)).toEqual(['view', 'click']);
    expect(r.steps.map((s) => s.offsetMs)).toEqual([0, 4000]);
    expect(buildSessionSteps(items, 500).steps.map((s) => s.offsetMs)).toEqual([500, 4500]);
  });

  it('drops a view duplicating the current page', () => {
    const r = buildSessionSteps([view(0, '/a'), view(10, '/a'), view(20, '/b')]);
    expect(r.steps.map((s) => s.path)).toEqual(['/a', '/b']);
    expect(r.steps.map((s) => s.index)).toEqual([0, 1]);
  });

  it('collapses double clicks into one step with count 2', () => {
    const r = buildSessionSteps([
      view(0, '/a'),
      click(100, '/a', { label: 'Buy' }),
      click(600, '/a', { label: 'Buy' }),
      click(5000, '/a', { label: 'Buy' }),
    ]);
    const clicks = r.steps.filter((s) => s.kind === 'click');
    expect(clicks.map((s) => s.count)).toEqual([2, 1]);
  });

  it('applies title fallbacks', () => {
    const r = buildSessionSteps([
      click(0, '/a', { track_name: 'cta', label: 'L', href: '/h' }),
      click(2000, '/a', { label: 'L' }),
      click(4000, '/a', { href: '/h' }),
      click(6000, '/a'),
      { ts: 7000, kind: 'event', name: 'signup', app: null, path: null, props: null },
      { ts: 8000, kind: 'error', app: 'x', name: null, msg: 'boom', url: null },
    ]);
    expect(r.steps.map((s) => s.title)).toEqual(['cta', 'L', '/h', '(unlabeled click)', 'signup', 'Error: boom']);
    expect(r.steps[0].detail).toBe('/h');
  });

  it('computes page dwell and click counts', () => {
    const r = buildSessionSteps([
      view(0, '/a'),
      click(1000, '/a', { label: 'one' }),
      click(3000, '/a', { label: 'two' }),
      view(10000, '/b'),
      click(12000, '/b', { label: 'three' }),
    ]);
    expect(r.pages.map((p) => [p.path, p.dwellMs, p.clickCount, p.firstStepIndex])).toEqual([
      ['/a', 10000, 2, 0],
      ['/b', 2000, 1, 3],
    ]);
    expect(r.steps.map((s) => s.pageIndex)).toEqual([0, 0, 0, 1, 1]);
  });

  it('starts a new page for a click on a different path', () => {
    const r = buildSessionSteps([view(0, '/a'), click(500, '/b', { label: 'x' })]);
    expect(r.pages.map((p) => p.path)).toEqual(['/a', '/b']);
  });
});

describe('filterSteps', () => {
  it('keeps clicks and views in clicks mode', () => {
    const { steps } = buildSessionSteps([
      view(0, '/a'),
      { ts: 10, kind: 'event', name: 'e', app: null, path: null, props: null },
      click(20, '/a', { label: 'x' }),
    ]);
    expect(filterSteps(steps, 'all')).toHaveLength(3);
    expect(filterSteps(steps, 'clicks').map((s) => s.kind)).toEqual(['view', 'click']);
  });
});
