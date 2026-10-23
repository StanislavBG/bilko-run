import { describe, expect, it } from 'vitest';
import {
  MENU_ITEMS,
  MENU_PRICE_CEILING_CENTS,
  WALLET_TOPUP_CENTS,
  formatCents,
  menuItemById,
  menuPayload,
  parseMenuIntake,
} from '../shared/bilko-menu';

const item = (id: string) => menuItemById(id)!;

describe('bilko menu catalog', () => {
  it('has the seven ids and prices', () => {
    expect(MENU_ITEMS.map(i => [i.id, i.priceCents, i.kind])).toEqual([
      ['ask-bilko', 50, 'async'],
      ['claude-md-review', 100, 'async'],
      ['prd-review', 100, 'async'],
      ['agent-postmortem', 200, 'async'],
      ['repo-audit', 300, 'async'],
      ['agent-factory-kit', 300, 'download'],
      ['live-call', 900, 'live'],
    ]);
    expect(item('agent-factory-kit').downloadSlug).toBe('agent-factory-kit');
    expect([...WALLET_TOPUP_CENTS]).toEqual([300, 500, 1000]);
  });

  it('respects the price ceiling and id format', () => {
    for (const i of MENU_ITEMS) expect(i.priceCents).toBeLessThanOrEqual(MENU_PRICE_CEILING_CENTS);
    const ids = MENU_ITEMS.map(i => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it('formats cents', () => {
    expect(formatCents(50)).toBe('$0.50');
    expect(formatCents(100)).toBe('$1');
    expect(formatCents(300)).toBe('$3');
    expect(formatCents(900)).toBe('$9');
    expect(formatCents(450)).toBe('$4.50');
  });

  it('builds the payload', () => {
    const p = menuPayload();
    expect(p.topups).toEqual([
      { cents: 300, price: '$3' },
      { cents: 500, price: '$5' },
      { cents: 1000, price: '$10' },
    ]);
    expect(p.items).toHaveLength(7);
    expect(p.items[0]).toMatchObject({ id: 'ask-bilko', price: '$0.50', priceCents: 50, kind: 'async' });
  });

  it('accepts valid intake and trims', () => {
    expect(parseMenuIntake(item('ask-bilko'), { question: '  hi there  ' })).toEqual({ question: 'hi there' });
    expect(parseMenuIntake(item('claude-md-review'), { document: 'doc' })).toEqual({ document: 'doc' });
    expect(parseMenuIntake(item('agent-factory-kit'), {})).toEqual({});
    for (const url of [
      'https://github.com/foo/bar',
      'https://github.com/foo/bar/',
      'https://github.com/foo/bar.git',
    ]) {
      expect(parseMenuIntake(item('repo-audit'), { repoUrl: url })).toEqual({ repoUrl: url });
    }
  });

  it('rejects bad intake', () => {
    const repo = item('repo-audit');
    expect(parseMenuIntake(repo, { repoUrl: 'http://github.com/foo/bar' })).toBeNull();
    expect(parseMenuIntake(repo, { repoUrl: 'https://gitlab.com/foo/bar' })).toBeNull();
    expect(parseMenuIntake(repo, { repoUrl: 'javascript:alert(1)' })).toBeNull();
    expect(parseMenuIntake(repo, { repoUrl: 'https://github.com/foo' })).toBeNull();
    expect(parseMenuIntake(repo, {})).toBeNull();
    expect(parseMenuIntake(item('ask-bilko'), { question: 'x', extra: 'y' })).toBeNull();
    expect(parseMenuIntake(item('ask-bilko'), { question: '   ' })).toBeNull();
    expect(parseMenuIntake(item('claude-md-review'), { document: 'a'.repeat(20001) })).toBeNull();
    expect(parseMenuIntake(item('agent-factory-kit'), { x: '1' })).toBeNull();
  });
});
