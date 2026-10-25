import { vi, describe, it, expect, beforeAll, beforeEach } from 'vitest';

// A $5/yr Git Viewer subscription must never read as a site-wide pro plan:
// that would unlock every paid AI tool for $5.
const subsList = vi.fn();
vi.mock('stripe', () => ({
  default: class {
    customers = { list: vi.fn().mockResolvedValue({ data: [] }) };
    subscriptions = { list: subsList };
  },
}));

process.env.STRIPE_SECRET_KEY = 'sk_test_x';
process.env.STRIPE_PRICE_GITVIEWER = 'price_gv';

const { initDb, dbRun } = await import('../server/db.js');
const { getActiveSubscriptionLive, getSubscriptionTier, upsertCustomer, priceToPlanTier } =
  await import('../server/services/stripe.js');

const { entryForPriceId } = await import('../shared/product-catalog.js');

// Committed live prices: the $5/yr default and the retired $5/mo price.
const YEARLY = 'price_1UUDkTR6w0VtQRLTdMok0qzl';
const MONTHLY_LEGACY = 'price_1UPDEjR6w0VtQRLT1SKNJ3T1';

const sub = (id: string, price: string) => ({ id, current_period_end: 0, items: { data: [{ price: { id: price } }] } });

beforeAll(async () => { await initDb(); });
beforeEach(async () => {
  await dbRun('DELETE FROM stripe_subscriptions');
  subsList.mockReset();
});

describe('git_viewer subscription entitlement', () => {
  it('priceToPlanTier maps STRIPE_PRICE_GITVIEWER to git_viewer', () => {
    expect(priceToPlanTier('price_gv')).toBe('git_viewer');
  });

  it('with STRIPE_PRICE_GITVIEWER unset, the yearly default and the retired monthly price map to git_viewer', () => {
    const saved = process.env.STRIPE_PRICE_GITVIEWER;
    delete process.env.STRIPE_PRICE_GITVIEWER;
    try {
      for (const price of [YEARLY, MONTHLY_LEGACY]) {
        expect(priceToPlanTier(price)).toBe('git_viewer');
        expect(entryForPriceId(price, {})?.productKey).toBe('git_viewer');
      }
      expect(priceToPlanTier('price_other')).toBe('pro');
    } finally {
      process.env.STRIPE_PRICE_GITVIEWER = saved;
    }
  });

  it('with STRIPE_PRICE_GITVIEWER set elsewhere, the yearly default and retired monthly price still map to git_viewer', () => {
    // An unmatched price falls through to 'pro', which would unlock every AI tool.
    expect(priceToPlanTier(YEARLY)).toBe('git_viewer');
    expect(priceToPlanTier(MONTHLY_LEGACY)).toBe('git_viewer');
    expect(entryForPriceId(MONTHLY_LEGACY, { STRIPE_PRICE_GITVIEWER: 'price_gv' })?.productKey).toBe('git_viewer');
  });

  it.each([
    ['yearly', YEARLY, 'gv-year@x.com'],
    ['retired monthly', MONTHLY_LEGACY, 'gv-month@x.com'],
  ])('a live subscription on the %s price: gitViewer true, isPro false', async (_label, price, email) => {
    await upsertCustomer(email, `cus_${email}`);
    subsList.mockResolvedValue({ data: [sub(`sub_${email}`, price)] });
    expect(await getActiveSubscriptionLive(email)).toEqual({ isPro: false, tier: 'free', gitViewer: true });
    expect(await getSubscriptionTier(email)).toBe('free');
  });

  it('git_viewer alone: gitViewer true, isPro false, DB tier stays free', async () => {
    await upsertCustomer('gv@x.com', 'cus_gv');
    subsList.mockResolvedValue({ data: [sub('sub_gv', 'price_gv')] });
    expect(await getActiveSubscriptionLive('gv@x.com')).toEqual({ isPro: false, tier: 'free', gitViewer: true });
    expect(await getSubscriptionTier('gv@x.com')).toBe('free');
  });

  it('pro + git_viewer: both flags, tier pro', async () => {
    await upsertCustomer('both@x.com', 'cus_both');
    subsList.mockResolvedValue({ data: [sub('sub_gv2', 'price_gv'), sub('sub_pro', 'price_pro')] });
    expect(await getActiveSubscriptionLive('both@x.com')).toEqual({ isPro: true, tier: 'pro', gitViewer: true });
  });
});
