import { describe, it, expect } from 'vitest';
import {
  MAX_RELEASE_BYTES,
  WEB_PRODUCTS,
  isValidCheckoutSessionId,
  isValidReleaseVersion,
  isValidWebProductSlug,
  productBilling,
  productKind,
  productPageSlug,
  resolveWebProductPriceId,
  validateWebProducts,
  webProductBySlug,
  webProductForPriceId,
  type WebProduct,
} from '../shared/web-products.js';

const SHA = 'a'.repeat(64);

const demo: WebProduct = {
  slug: 'demo-pack',
  name: 'Demo Pack',
  productKey: 'wp_demo_pack',
  priceEnvVar: 'STRIPE_PRICE_WP_DEMO_PACK',
  defaultPriceId: 'price_demo',
  displayPrice: '$9',
  downloadLimit: 20,
  release: { version: '1.0.0', filename: 'demo-pack-1.0.0.zip', bytes: 1234, sha256: SHA },
};
const other: WebProduct = {
  ...demo,
  slug: 'other',
  productKey: 'wp_other',
  priceEnvVar: 'STRIPE_PRICE_WP_OTHER',
  defaultPriceId: undefined,
  release: null,
};
const list = [demo, other];

describe('catalog constants', () => {
  it('has the 5 MiB cap and a valid catalog', () => {
    expect(MAX_RELEASE_BYTES).toBe(5 * 1024 * 1024);
    expect(WEB_PRODUCTS).toHaveLength(4);
    expect(validateWebProducts(WEB_PRODUCTS)).toEqual([]);
  });

  it('declares the launch-kit product', () => {
    expect(webProductBySlug('launch-kit')?.productKey).toBe('wp_launch_kit');
    expect(validateWebProducts(WEB_PRODUCTS)).toEqual([]);
  });
});

describe('lookups', () => {
  it('finds by slug', () => {
    expect(webProductBySlug('demo-pack', list)).toBe(demo);
    expect(webProductBySlug('nope', list)).toBeUndefined();
    expect(webProductBySlug('demo-pack')).toBeUndefined();
  });

  it('resolves price id: env beats default', () => {
    expect(resolveWebProductPriceId(demo, {})).toBe('price_demo');
    expect(resolveWebProductPriceId(demo, { STRIPE_PRICE_WP_DEMO_PACK: 'price_env' })).toBe('price_env');
    expect(resolveWebProductPriceId(demo, { STRIPE_PRICE_WP_DEMO_PACK: '' })).toBe('price_demo');
    expect(resolveWebProductPriceId(other, {})).toBeUndefined();
  });

  it('finds product by price id', () => {
    expect(webProductForPriceId('price_demo', {}, list)).toBe(demo);
    expect(webProductForPriceId('price_x', { STRIPE_PRICE_WP_OTHER: 'price_x' }, list)).toBe(other);
    expect(webProductForPriceId('price_demo', { STRIPE_PRICE_WP_DEMO_PACK: 'price_env' }, list)).toBeUndefined();
    expect(webProductForPriceId(undefined, {}, list)).toBeUndefined();
    expect(webProductForPriceId('', {}, list)).toBeUndefined();
    expect(webProductForPriceId('price_demo', {})).toBeUndefined();
  });
});

describe('validators', () => {
  it('slug', () => {
    for (const ok of ['a', 'demo-pack', 'x1', 'a-b-c', 'a'.repeat(40)]) {
      expect(isValidWebProductSlug(ok)).toBe(true);
    }
    for (const bad of ['../x', 'A', '-x', 'x-', '', 'a b', 'a/b', 'a'.repeat(41)]) {
      expect(isValidWebProductSlug(bad)).toBe(false);
    }
    expect(isValidWebProductSlug(undefined)).toBe(false);
  });

  it('checkout session id', () => {
    expect(isValidCheckoutSessionId('cs_test_a1B2c3D4e5F6')).toBe(true);
    expect(isValidCheckoutSessionId('cs_live_' + 'x'.repeat(250))).toBe(true);
    for (const bad of [
      'cs_test_short',
      'cs_dev_a1B2c3D4e5F6',
      'cs_test_a1B2c3/D4e5F6',
      'cs_test_a1B2c3%2FD4e5',
      'cs_test_a1B2c3 D4e5F6',
      'cs_live_' + 'x'.repeat(251),
      '',
    ]) {
      expect(isValidCheckoutSessionId(bad)).toBe(false);
    }
    expect(isValidCheckoutSessionId(null)).toBe(false);
  });

  it('release version', () => {
    for (const ok of ['1.0.0', '0.0.1', '1234.5678.9012']) expect(isValidReleaseVersion(ok)).toBe(true);
    for (const bad of ['1.0', '1.0.0.0', 'v1.0.0', '12345.0.0', '1.0.0-beta', '']) {
      expect(isValidReleaseVersion(bad)).toBe(false);
    }
  });
});

describe('validateWebProducts', () => {
  it('accepts a good fixture list', () => {
    expect(validateWebProducts(list)).toEqual([]);
  });

  it('accepts hyphenated slug with underscored key', () => {
    expect(validateWebProducts([demo])).toEqual([]);
  });

  it('reports each problem', () => {
    const bad: WebProduct = {
      slug: 'Bad_Slug',
      name: 'Bad',
      productKey: 'wrong',
      priceEnvVar: 'STRIPE_PRICE_NOPE',
      displayPrice: '$1',
      downloadLimit: 0,
      release: { version: '1.0', filename: '../evil.tar', bytes: MAX_RELEASE_BYTES + 1, sha256: 'ABC' },
    };
    const msgs = validateWebProducts([demo, demo, bad]);
    const joined = msgs.join('\n');
    expect(joined).toContain('duplicate slug');
    expect(joined).toContain('invalid slug');
    expect(joined).toContain('productKey');
    expect(joined).toContain('priceEnvVar');
    expect(joined).toContain('downloadLimit');
    expect(joined).toContain('release version invalid');
    expect(joined).toContain('release filename invalid');
    expect(joined).toContain('release bytes');
    expect(joined).toContain('release sha256 invalid');
    expect(msgs).toHaveLength(9);
  });

  it('rejects non-integer and out-of-range numbers', () => {
    const r = demo.release!;
    expect(validateWebProducts([{ ...demo, downloadLimit: 101 }])).toHaveLength(1);
    expect(validateWebProducts([{ ...demo, downloadLimit: 1.5 }])).toHaveLength(1);
    expect(validateWebProducts([{ ...demo, downloadLimit: 100 }])).toEqual([]);
    expect(validateWebProducts([{ ...demo, release: { ...r, bytes: 0 } }])).toHaveLength(1);
    expect(validateWebProducts([{ ...demo, release: { ...r, bytes: 1.5 } }])).toHaveLength(1);
    expect(validateWebProducts([{ ...demo, release: { ...r, bytes: MAX_RELEASE_BYTES } }])).toEqual([]);
  });
});

const svc: WebProduct = {
  slug: 'svc-one',
  name: 'Service One',
  productKey: 'wp_svc_one',
  priceEnvVar: 'STRIPE_PRICE_WP_SVC_ONE',
  displayPrice: '$75',
  downloadLimit: 0,
  release: null,
  kind: 'service',
};

describe('service products', () => {
  it('helper defaults', () => {
    expect(productKind(demo)).toBe('download');
    expect(productKind(svc)).toBe('service');
    expect(productBilling(demo)).toBe('one_time');
    expect(productBilling({ ...svc, billing: 'month' })).toBe('month');
    expect(productPageSlug(demo)).toBe('demo-pack');
    expect(productPageSlug({ ...svc, pageSlug: 'human-for-hire' })).toBe('human-for-hire');
  });

  it('service: release null and downloadLimit 0 ok; release present fails', () => {
    expect(validateWebProducts([svc])).toEqual([]);
    expect(validateWebProducts([{ ...svc, release: demo.release }]).join()).toContain('release');
    expect(validateWebProducts([{ ...svc, downloadLimit: 101 }])).toHaveLength(1);
  });

  it('download products still need downloadLimit 1..100', () => {
    expect(validateWebProducts([{ ...demo, downloadLimit: 0 }])).toHaveLength(1);
  });

  it('billing month only on services', () => {
    expect(validateWebProducts([{ ...svc, billing: 'month' }])).toEqual([]);
    expect(validateWebProducts([{ ...demo, billing: 'month' }]).join()).toContain('billing');
  });

  it('pageSlug must be a valid slug', () => {
    expect(validateWebProducts([{ ...svc, pageSlug: 'human-for-hire' }])).toEqual([]);
    expect(validateWebProducts([{ ...svc, pageSlug: '../x' }]).join()).toContain('pageSlug');
  });

  it('foundingCouponEnvVar format and requires foundingDisplayPrice', () => {
    const ok = { ...svc, foundingCouponEnvVar: 'STRIPE_COUPON_WP_X', foundingDisplayPrice: '$1' };
    expect(validateWebProducts([ok])).toEqual([]);
    expect(validateWebProducts([{ ...ok, foundingCouponEnvVar: 'COUPON_X' }]).join()).toContain('foundingCouponEnvVar');
    expect(validateWebProducts([{ ...ok, foundingDisplayPrice: undefined }]).join()).toContain('foundingDisplayPrice');
  });

  it('maxOrders and sessionsPerMonth are integers 1..100', () => {
    expect(validateWebProducts([{ ...svc, maxOrders: 2, sessionsPerMonth: 2 }])).toEqual([]);
    expect(validateWebProducts([{ ...svc, maxOrders: 0 }]).join()).toContain('maxOrders');
    expect(validateWebProducts([{ ...svc, maxOrders: 1.5 }]).join()).toContain('maxOrders');
    expect(validateWebProducts([{ ...svc, sessionsPerMonth: 101 }]).join()).toContain('sessionsPerMonth');
  });

  it('declares the three Human For Hire offers', () => {
    const u = webProductBySlug('hfh-unstick')!;
    const f = webProductBySlug('hfh-factory-setup')!;
    const m = webProductBySlug('hfh-fractional')!;
    expect([u.name, u.displayPrice, u.sessionsPerMonth]).toEqual(['Unstick my agents', '$75', 1]);
    expect([f.name, f.displayPrice, f.foundingDisplayPrice, f.foundingCouponEnvVar]).toEqual([
      'Agent Factory Setup', '$225', '$125', 'STRIPE_COUPON_WP_HFH_FOUNDING',
    ]);
    expect([m.name, m.displayPrice, m.billing, m.maxOrders, m.sessionsPerMonth]).toEqual([
      'Fractional Agent Ops', '$750', 'month', 2, 2,
    ]);
    for (const p of [u, f, m]) {
      expect(productKind(p)).toBe('service');
      expect(productPageSlug(p)).toBe('human-for-hire');
      expect(p.release).toBeNull();
      expect(p.downloadLimit).toBe(0);
      expect(p.defaultPriceId).toBeUndefined();
    }
  });

  it('persona rule: no owner name or email in the catalog', () => {
    expect(validateWebProducts(WEB_PRODUCTS)).toEqual([]);
    const blob = JSON.stringify(WEB_PRODUCTS).toLowerCase();
    expect(blob).not.toContain('stanislav');
    expect(blob).not.toContain('gmail');
  });
});
