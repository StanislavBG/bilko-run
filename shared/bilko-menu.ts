// Bilko services menu (D-2026-10-20-14): single source for menu prices and
// wallet top-ups. Pure module: no fs/env/server imports.

export const WALLET_TOPUP_CENTS = [300, 500, 1000] as const;
export const MENU_PRICE_CEILING_CENTS = 1000;
export const MENU_DAILY_ASYNC_CAP = 6;

export type MenuKind = 'async' | 'download' | 'live';

export interface MenuIntakeField {
  key: string;
  label: string;
  required: boolean;
  maxLength: number;
  kind: 'text' | 'url';
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

const ASYNC_DELIVERY =
  "Written delivery by email within 48 hours, drafted by Bilko's agents and reviewed before sending. Best effort; no guaranteed results.";

export const MENU_ITEMS: MenuItem[] = [
  {
    id: 'ask-bilko',
    name: 'Ask Bilko',
    summary: 'One question about building with AI agents, answered in writing.',
    whatYouGet: ASYNC_DELIVERY,
    priceCents: 50,
    kind: 'async',
    intake: [{ key: 'question', label: 'Your question', required: true, maxLength: 2000, kind: 'text' }],
  },
  {
    id: 'claude-md-review',
    name: 'CLAUDE.md or persona review',
    summary: 'A written review of your CLAUDE.md or agent persona file with concrete fixes.',
    whatYouGet: ASYNC_DELIVERY,
    priceCents: 100,
    kind: 'async',
    intake: [
      { key: 'document', label: 'Paste your CLAUDE.md or persona', required: true, maxLength: 20000, kind: 'text' },
      { key: 'context', label: 'Context (optional)', required: false, maxLength: 1000, kind: 'text' },
    ],
  },
  {
    id: 'prd-review',
    name: 'PRD review with acceptance criteria',
    summary: 'A written review of your PRD, with tightened acceptance criteria an agent can verify.',
    whatYouGet: ASYNC_DELIVERY,
    priceCents: 100,
    kind: 'async',
    intake: [{ key: 'prd', label: 'Paste your PRD', required: true, maxLength: 20000, kind: 'text' }],
  },
  {
    id: 'agent-postmortem',
    name: 'Agent-run post-mortem',
    summary: 'A written post-mortem of an agent run that went wrong: what happened and how to prevent it.',
    whatYouGet: ASYNC_DELIVERY,
    priceCents: 200,
    kind: 'async',
    intake: [
      { key: 'log', label: 'Paste the run log or transcript', required: true, maxLength: 30000, kind: 'text' },
      { key: 'goal', label: 'What the run was meant to do (optional)', required: false, maxLength: 1000, kind: 'text' },
    ],
  },
  {
    id: 'repo-audit',
    name: 'Repo agent-readiness audit',
    summary: 'A written audit of how well a public GitHub repo works with coding agents.',
    whatYouGet: ASYNC_DELIVERY,
    priceCents: 300,
    kind: 'async',
    intake: [{ key: 'repoUrl', label: 'GitHub repo URL', required: true, maxLength: 300, kind: 'url' }],
  },
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
  {
    id: 'live-call',
    name: 'Live 30-minute call',
    summary: 'A live call to talk through your agent setup.',
    whatYouGet: 'A 30-minute live call. 3 slots a week. Best effort; no guaranteed results.',
    priceCents: 900,
    kind: 'live',
    intake: [{ key: 'topic', label: 'What do you want to talk about?', required: true, maxLength: 2000, kind: 'text' }],
  },
];

export function menuItemById(id: string): MenuItem | undefined {
  return MENU_ITEMS.find(i => i.id === id);
}

/** '$0.50', '$1', '$3', '$9', '$4.50' */
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

const GITHUB_REPO_RE = /^https:\/\/github\.com\/[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\/[A-Za-z0-9._-]+?(?:\.git|\/)?$/;

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
    if (field.kind === 'url' && !GITHUB_REPO_RE.test(value)) return null;
    out[field.key] = value;
  }
  return out;
}
