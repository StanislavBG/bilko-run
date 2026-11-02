import { describe, expect, it } from 'vitest';
import {
  MENU_ITEMS,
  PRODUCT_PRICE_CEILING_CENTS,
  WALLET_TOPUP_CENTS,
  formatCents,
  menuItemById,
  menuPayload,
  parseMenuIntake,
} from '../shared/bilko-menu';

const item = (id: string) => menuItemById(id)!;

describe('bilko menu catalog', () => {
  it('holds only the Agent Factory Kit', () => {
    expect(MENU_ITEMS.map(i => [i.id, i.priceCents, i.kind])).toEqual([['agent-factory-kit', 300, 'download']]);
    expect(item('agent-factory-kit').downloadSlug).toBe('agent-factory-kit');
    expect([...WALLET_TOPUP_CENTS]).toEqual([300, 500, 1000]);
  });

  it('respects the price ceiling and id format', () => {
    for (const i of MENU_ITEMS) expect(i.priceCents).toBeLessThanOrEqual(PRODUCT_PRICE_CEILING_CENTS);
    const ids = MENU_ITEMS.map(i => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it('formats cents', () => {
    expect(formatCents(50)).toBe('$0.50');
    expect(formatCents(100)).toBe('$1');
    expect(formatCents(300)).toBe('$3');
    expect(formatCents(450)).toBe('$4.50');
  });

  it('builds the payload', () => {
    const p = menuPayload();
    expect(p.topups).toEqual([
      { cents: 300, price: '$3' },
      { cents: 500, price: '$5' },
      { cents: 1000, price: '$10' },
    ]);
    expect(p.items).toHaveLength(1);
    expect(p.items[0]).toMatchObject({ id: 'agent-factory-kit', price: '$3', priceCents: 300, kind: 'download' });
  });

  it('accepts valid intake and trims', () => {
    expect(parseMenuIntake(item('agent-factory-kit'), {})).toEqual({});
    const field = { key: 'q', label: 'Q', required: true, maxLength: 10, kind: 'text' as const };
    const fake = { ...item('agent-factory-kit'), intake: [field] };
    expect(parseMenuIntake(fake, { q: '  hi  ' })).toEqual({ q: 'hi' });
  });

  it('rejects bad intake', () => {
    expect(parseMenuIntake(item('agent-factory-kit'), { x: '1' })).toBeNull();
    const field = { key: 'q', label: 'Q', required: true, maxLength: 10, kind: 'text' as const };
    const fake = { ...item('agent-factory-kit'), intake: [field] };
    expect(parseMenuIntake(fake, {})).toBeNull();
    expect(parseMenuIntake(fake, { q: '   ' })).toBeNull();
    expect(parseMenuIntake(fake, { q: 'a'.repeat(11) })).toBeNull();
    expect(parseMenuIntake(fake, { q: 'x', extra: 'y' })).toBeNull();
  });
});
