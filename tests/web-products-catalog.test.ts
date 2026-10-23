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
  productsIncluding,
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
  amountCents: 900,
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
    expect(WEB_PRODUCTS).toHaveLength(2);
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
      amountCents: 100,
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

  it('reports a bad amountCents and a displayPrice that does not match it', () => {
    for (const amountCents of [0, -5, 9.5, NaN]) {
      expect(validateWebProducts([{ ...demo, amountCents }]).join('\n')).toContain('amountCents must be a positive integer');
    }
    expect(validateWebProducts([{ ...demo, displayPrice: '$10' }]).join('\n')).toContain('displayPrice must be $9');
    expect(validateWebProducts([{ ...demo, amountCents: 950, displayPrice: '$9.50' }])).toEqual([]);
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
  amountCents: 7500,
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
    expect(validateWebProducts([{ ...svc, pageSlug: 'launch-kit/agent-factory-kit' }])).toEqual([]);
    for (const bad of ['a/b/c', 'a//b', '/a', 'a/', 'a/../b']) {
      expect(validateWebProducts([{ ...svc, pageSlug: bad }]).join()).toContain('pageSlug');
    }
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

  it('no Human For Hire ladder products remain', () => {
    expect(WEB_PRODUCTS.filter((p) => p.slug.startsWith('hfh-'))).toEqual([]);
  });

  it('persona rule: no owner name or email in the catalog', () => {
    expect(validateWebProducts(WEB_PRODUCTS)).toEqual([]);
    const blob = JSON.stringify(WEB_PRODUCTS).toLowerCase();
    expect(blob).not.toContain('stanislav');
    expect(blob).not.toContain('gmail');
  });
});

describe('includes and preview', () => {
  const pv = { version: '1.0.0', filename: 'demo-preview-1.0.0.zip', bytes: 100, sha256: SHA };
  const bundle: WebProduct = { ...svc, includes: ['demo-pack'] };

  it('declares the agent-factory-kit product', () => {
    const k = webProductBySlug('agent-factory-kit')!;
    expect([k.name, k.productKey, k.priceEnvVar, k.displayPrice, k.downloadLimit]).toEqual([
      'Bilko Agent Factory Kit', 'wp_agent_factory_kit', 'STRIPE_PRICE_WP_AGENT_FACTORY_KIT', '$3', 20,
    ]);
    expect(k.defaultPriceId).toBeUndefined();
    expect(k.release).toEqual({
      version: '1.0.0', filename: 'bilko-agent-factory-kit-1.0.0.zip', bytes: 60099,
      sha256: 'c5fe49c81d94ab91e561bdb2be7f63e38a2dfd233e3f1ea636f8f33d77b0db08',
    });
    expect(k.preview).toEqual({
      version: '1.0.0', filename: 'agent-factory-kit-preview-1.0.0.zip', bytes: 3392,
      sha256: '9a21261fee8f61821b3ba7a9c01bb57c16771eaa33fd4a1e1bc4edee01d56e3d',
    });
    expect(productPageSlug(k)).toBe('launch-kit/agent-factory-kit');
    expect(k.amountCents).toBe(300);
  });

  it('includes: valid slug of a download product passes', () => {
    expect(validateWebProducts([demo, bundle])).toEqual([]);
  });

  it('includes: unknown slug fails', () => {
    const msgs = validateWebProducts([{ ...svc, includes: ['nope'] }]);
    expect(msgs).toHaveLength(1);
    expect(msgs[0]).toContain('[svc-one] includes');
  });

  it('includes: service target fails', () => {
    const svc2: WebProduct = { ...svc, slug: 'svc-two', productKey: 'wp_svc_two', priceEnvVar: 'STRIPE_PRICE_WP_SVC_TWO' };
    const msgs = validateWebProducts([svc2, { ...svc, includes: ['svc-two'] }]);
    expect(msgs).toHaveLength(1);
    expect(msgs[0]).toContain('download');
  });

  it('includes: self-include fails', () => {
    const msgs = validateWebProducts([{ ...demo, includes: ['demo-pack'] }]);
    expect(msgs.join()).toContain('[demo-pack] includes');
    expect(msgs.join()).toContain('itself');
  });

  it('preview: valid download preview passes', () => {
    expect(validateWebProducts([{ ...demo, preview: pv }])).toEqual([]);
    expect(validateWebProducts([{ ...demo, preview: null }])).toEqual([]);
  });

  it('preview: bad fields fail with one problem each', () => {
    const msgs = validateWebProducts([
      { ...demo, preview: { version: '1.0', filename: 'x.tar', bytes: 0, sha256: 'ABC' } },
    ]);
    expect(msgs).toHaveLength(4);
    for (const m of msgs) expect(m).toContain('[demo-pack] preview');
  });

  it('preview: not allowed on services', () => {
    const msgs = validateWebProducts([{ ...svc, preview: pv }]);
    expect(msgs).toHaveLength(1);
    expect(msgs[0]).toContain('preview');
  });

  it('productsIncluding returns products whose includes contains the slug', () => {
    const l = [demo, bundle, other];
    expect(productsIncluding('demo-pack', l)).toEqual([bundle]);
    expect(productsIncluding('other', l)).toEqual([]);
    expect(productsIncluding('agent-factory-kit')).toEqual([]);
  });
});
