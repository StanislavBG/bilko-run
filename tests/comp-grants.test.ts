import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { dbRun, initDb } from '../server/db.js';
import {
  grantComp, revokeComp, listCompGrants, isCompPurchase, compPaymentIntentId,
} from '../server/services/comp-grants.js';
import { hasPurchased, saveOneTimePurchase } from '../server/services/stripe.js';
import { isEntitledToManual } from '../server/services/manual.js';
import { MANUAL_PRODUCT_KEY } from '../shared/manual-catalog.js';

beforeAll(async () => { await initDb(); });

beforeEach(async () => {
  await dbRun('DELETE FROM stripe_one_time_purchases');
  await dbRun('DELETE FROM comp_grants');
});

const OWNER = 'bilkobibitkov2000@gmail.com';

describe('comp grants', () => {
  it('unlocks the Field Manual for the owner', async () => {
    expect(await isEntitledToManual(OWNER)).toBe(false);
    const r = await grantComp({
      email: OWNER, productKey: MANUAL_PRODUCT_KEY,
      reason: 'Owner QA', grantedBy: 'system:test',
    });
    expect(r.created).toBe(true);
    expect(await isEntitledToManual(OWNER)).toBe(true);
  });

  it('lowercases the email so the exact-match lookup finds it', async () => {
    await grantComp({
      email: '  BilkoBibitkov2000@Gmail.com  ', productKey: MANUAL_PRODUCT_KEY,
      reason: 'case test', grantedBy: 'system:test',
    });
    expect(await hasPurchased(OWNER, MANUAL_PRODUCT_KEY)).toBe(true);
    expect(await isEntitledToManual('BILKOBIBITKOV2000@GMAIL.COM')).toBe(true);
  });

  it('is idempotent — re-granting does not duplicate or fail', async () => {
    await grantComp({ email: OWNER, productKey: MANUAL_PRODUCT_KEY, reason: 'first', grantedBy: 'a@b.com' });
    const second = await grantComp({ email: OWNER, productKey: MANUAL_PRODUCT_KEY, reason: 'second', grantedBy: 'a@b.com' });
    expect(second.created).toBe(false);
    const grants = await listCompGrants();
    expect(grants).toHaveLength(1);
    expect(grants[0].reason).toBe('second');
    expect(await isEntitledToManual(OWNER)).toBe(true);
  });

  it('records an audit row with reason and grantor', async () => {
    await grantComp({ email: 'r@x.com', productKey: MANUAL_PRODUCT_KEY, reason: 'press copy', grantedBy: 'Admin@X.com' });
    const [g] = await listCompGrants();
    expect(g).toMatchObject({
      email: 'r@x.com', product_key: MANUAL_PRODUCT_KEY,
      reason: 'press copy', granted_by: 'admin@x.com', revoked_at: null,
    });
  });

  it('requires a reason', async () => {
    await expect(grantComp({
      email: 'r@x.com', productKey: MANUAL_PRODUCT_KEY, reason: '  ', grantedBy: 'a@b.com',
    })).rejects.toThrow(/reason/i);
  });

  it('uses sentinel ids that cannot collide with real Stripe ids', async () => {
    await grantComp({ email: OWNER, productKey: MANUAL_PRODUCT_KEY, reason: 'qa', grantedBy: 'a@b.com' });
    const id = compPaymentIntentId(MANUAL_PRODUCT_KEY, OWNER);
    expect(id.startsWith('pi_')).toBe(false);
    expect(id.startsWith('cus_')).toBe(false);
    expect(isCompPurchase(id)).toBe(true);
    expect(isCompPurchase('pi_3RealStripeIntent')).toBe(false);
  });

  it('gives two different comps distinct payment-intent sentinels', async () => {
    await grantComp({ email: 'a@x.com', productKey: MANUAL_PRODUCT_KEY, reason: 'qa', grantedBy: 'a@b.com' });
    await grantComp({ email: 'b@x.com', productKey: MANUAL_PRODUCT_KEY, reason: 'qa', grantedBy: 'a@b.com' });
    expect(await hasPurchased('a@x.com', MANUAL_PRODUCT_KEY)).toBe(true);
    expect(await hasPurchased('b@x.com', MANUAL_PRODUCT_KEY)).toBe(true);
  });

  it('revokes a comp and marks the audit row', async () => {
    await grantComp({ email: OWNER, productKey: MANUAL_PRODUCT_KEY, reason: 'qa', grantedBy: 'a@b.com' });
    expect(await revokeComp({ email: OWNER, productKey: MANUAL_PRODUCT_KEY, revokedBy: 'a@b.com' })).toEqual({ ok: true });
    expect(await isEntitledToManual(OWNER)).toBe(false);
    const [g] = await listCompGrants();
    expect(g.revoked_at).toBeTruthy();
    expect(g.revoked_by).toBe('a@b.com');
  });

  it('refuses to revoke a real Stripe purchase', async () => {
    await saveOneTimePurchase({
      email: 'paid@x.com', stripe_customer_id: 'cus_real',
      stripe_payment_intent_id: 'pi_real', product_key: MANUAL_PRODUCT_KEY,
    });
    const r = await revokeComp({ email: 'paid@x.com', productKey: MANUAL_PRODUCT_KEY, revokedBy: 'a@b.com' });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/Stripe/);
    expect(await isEntitledToManual('paid@x.com')).toBe(true);
  });

  it('leaves an existing real purchase intact when re-granted as a comp', async () => {
    await saveOneTimePurchase({
      email: 'paid@x.com', stripe_customer_id: 'cus_real',
      stripe_payment_intent_id: 'pi_real', product_key: MANUAL_PRODUCT_KEY,
    });
    const r = await grantComp({ email: 'paid@x.com', productKey: MANUAL_PRODUCT_KEY, reason: 'support', grantedBy: 'a@b.com' });
    expect(r.created).toBe(false);
    expect(await isEntitledToManual('paid@x.com')).toBe(true);
  });
});
