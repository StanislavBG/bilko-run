// Play-currency catalog: stake tiers, currency packs (USD + MYR prices and
// Apple product ids) and cosmetic items for each hosted game that uses a play
// currency. Today that is only Three Winds (taels).
// Pure module: no fs/env/server imports (the client bundle imports it too).

export interface PlayTier {
  id: string;
  name: string;
  /** Currency per point at this table. */
  stake: number;
  seats: number;
}

export interface PlayPack {
  id: string;
  name: string;
  taels: number;
  usdCents: number;
  myrSen: number;
  appleProductId: string;
}

export interface PlayItem {
  id: string;
  name: string;
  /** Price in the app's play currency. */
  price: number;
  defaultOwned?: boolean;
  /** Most copies that can ever be sold. */
  limit?: number;
}

export interface PlayApp {
  currency: string;
  signupGrant: number;
  tiers: PlayTier[];
  packs: PlayPack[];
  items: PlayItem[];
}

export const PLAY_APPS: Record<string, PlayApp> = {
  threewinds: {
    currency: 'taels',
    signupGrant: 5000,
    tiers: [
      { id: 'tea', name: 'Tea Pavilion', stake: 5, seats: 3 },
      { id: 'jade', name: 'Jade Room', stake: 25, seats: 3 },
      { id: 'peony', name: 'Peony Lounge', stake: 100, seats: 3 },
      { id: 'imperial', name: 'Imperial Suite', stake: 500, seats: 3 },
    ],
    packs: [
      { id: 'pouch', name: 'A pouch', taels: 5000, usdCents: 99, myrSen: 490, appleProductId: 'threewinds.taels.pouch' },
      { id: 'purse', name: 'A purse', taels: 26000, usdCents: 499, myrSen: 2290, appleProductId: 'threewinds.taels.purse' },
      { id: 'box', name: 'A brocade box', taels: 55000, usdCents: 999, myrSen: 4490, appleProductId: 'threewinds.taels.box' },
      { id: 'chest', name: 'A treasure chest', taels: 115000, usdCents: 1999, myrSen: 8990, appleProductId: 'threewinds.taels.chest' },
      { id: 'cabinet', name: 'A silver cabinet', taels: 300000, usdCents: 4999, myrSen: 22990, appleProductId: 'threewinds.taels.cabinet' },
      { id: 'vault', name: 'The vault', taels: 650000, usdCents: 9999, myrSen: 44990, appleProductId: 'threewinds.taels.vault' },
    ],
    items: [
      { id: 'ivory', name: 'The Ivory Set', price: 0, defaultOwned: true },
      { id: 'pearl', name: 'The Pearl Set', price: 18888, limit: 888 },
      { id: 'lacquer', name: 'The Lacquer Set', price: 8888 },
      { id: 'jade', name: 'The Jade Set', price: 6888 },
      { id: 'ink', name: 'The Ink Set', price: 3888 },
    ],
  },
};

function playApp(app: string): PlayApp | undefined {
  return Object.prototype.hasOwnProperty.call(PLAY_APPS, app) ? PLAY_APPS[app] : undefined;
}

export function findTier(app: string, tierId: string): PlayTier | undefined {
  return playApp(app)?.tiers.find(t => t.id === tierId);
}

export function findPack(app: string, packId: string): PlayPack | undefined {
  return playApp(app)?.packs.find(p => p.id === packId);
}

export function findPackByAppleProduct(app: string, productId: string): PlayPack | undefined {
  return playApp(app)?.packs.find(p => p.appleProductId === productId);
}

export function findItem(app: string, itemId: string): PlayItem | undefined {
  return playApp(app)?.items.find(i => i.id === itemId);
}
