// Bilko credits menu: the wallet top-ups plus the one item credits can buy
// (the Agent Factory Kit download). Pure module: no fs/env/server imports.

export const WALLET_TOPUP_CENTS = [300, 500, 1000] as const;
export const PRODUCT_PRICE_CEILING_CENTS = 1000;

export type MenuKind = 'download';

export interface MenuIntakeField {
  key: string;
  label: string;
  required: boolean;
  maxLength: number;
  kind: 'text';
}

export interface MenuItem {
  id: string;
  name: string;
  summary: string;
  whatYouGet: string;
  priceCents: number;
  kind: MenuKind;
  intake: MenuIntakeField[];
  downloadSlug?: string;
}

export const MENU_ITEMS: MenuItem[] = [
  {
    id: 'agent-factory-kit',
    name: 'Bilko Agent Factory Kit',
    summary: 'The kit Bilko uses to run agents on PRDs, as a download.',
    whatYouGet: 'A download of the Bilko Agent Factory Kit, delivered right after payment.',
    priceCents: 300,
    kind: 'download',
    downloadSlug: 'agent-factory-kit',
    intake: [],
  },
];

export function menuItemById(id: string): MenuItem | undefined {
  return MENU_ITEMS.find(i => i.id === id);
}

/** '$0.50', '$1', '$3', '$4.50' */
export function formatCents(cents: number): string {
  const dollars = cents / 100;
  return Number.isInteger(dollars) ? `$${dollars}` : `$${dollars.toFixed(2)}`;
}

export function menuPayload() {
  return {
    topups: WALLET_TOPUP_CENTS.map(cents => ({ cents, price: formatCents(cents) })),
    items: MENU_ITEMS.map(i => ({
      id: i.id,
      name: i.name,
      summary: i.summary,
      whatYouGet: i.whatYouGet,
      price: formatCents(i.priceCents),
      priceCents: i.priceCents,
      kind: i.kind,
      intake: i.intake,
    })),
  };
}

/** Validates raw intake against the item's fields. Returns trimmed values or null. */
export function parseMenuIntake(item: MenuItem, raw: unknown): Record<string, string> | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const input = raw as Record<string, unknown>;
  const allowed = new Set(item.intake.map(f => f.key));
  for (const key of Object.keys(input)) {
    if (!allowed.has(key)) return null;
  }
  const out: Record<string, string> = {};
  for (const field of item.intake) {
    const v = input[field.key];
    if (v === undefined || v === null) {
      if (field.required) return null;
      continue;
    }
    if (typeof v !== 'string') return null;
    const value = v.trim();
    if (value === '') {
      if (field.required) return null;
      continue;
    }
    if (value.length > field.maxLength) return null;
    out[field.key] = value;
  }
  return out;
}
