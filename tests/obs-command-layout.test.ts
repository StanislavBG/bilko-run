import { describe, it, expect } from 'vitest';
import { swapToStage, layoutGrid, DEFAULT_POS } from '../src/pages/admin/command/CommandShell.js';
import { MODULES } from '../src/pages/admin/command/types.js';

describe('swapToStage', () => {
  it('exchanges the key slot with the current stage module', () => {
    const next = swapToStage(DEFAULT_POS, 'apps');
    expect(next.apps).toBe('stage');
    expect(next.globe).toBe('l1');
    expect(DEFAULT_POS.globe).toBe('stage');
  });

  it('is a no-op when the key is already on stage', () => {
    expect(swapToStage(DEFAULT_POS, 'globe')).toEqual(DEFAULT_POS);
  });

  it('leaves every key in exactly one slot after any swap chain', () => {
    let pos = DEFAULT_POS;
    for (const m of MODULES) pos = swapToStage(pos, m.key);
    const slots = Object.values(pos);
    expect(new Set(slots).size).toBe(7);
    expect(slots.filter(s => s === 'stage')).toHaveLength(1);
  });
});

describe('layoutGrid', () => {
  it('rails', () => {
    const g = layoutGrid('rails', false);
    expect(g.cols).toBe('300px minmax(0,1fr) 340px');
    expect(g.rows).toBe('repeat(3,minmax(0,1fr))');
    expect(g.slots.stage).toEqual(['2', '1 / 4']);
    expect(g.slots.r3).toEqual(['3', '3']);
  });
  it('dock', () => {
    const g = layoutGrid('dock', false);
    expect(g.cols).toBe('repeat(6,minmax(0,1fr))');
    expect(g.rows).toBe('minmax(0,1fr) 230px');
    expect(g.slots.stage).toEqual(['1 / 7', '1']);
    expect(g.slots.l2).toEqual(['2', '2']);
  });
  it('wing', () => {
    const g = layoutGrid('wing', false);
    expect(g.cols).toBe('minmax(0,1fr) 300px 300px');
    expect(g.slots.stage).toEqual(['1', '1 / 4']);
    expect(g.slots.r1).toEqual(['3', '1']);
  });
  it('max shows only the stage regardless of layout', () => {
    const g = layoutGrid('dock', true);
    expect(g.cols).toBe('minmax(0,1fr)');
    expect(g.rows).toBe('minmax(0,1fr)');
    expect(Object.keys(g.slots)).toEqual(['stage']);
  });
});
