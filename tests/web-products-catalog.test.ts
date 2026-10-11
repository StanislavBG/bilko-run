import { describe, it, expect } from 'vitest';
import {
  MAX_RELEASE_BYTES,
  WEB_PRODUCTS,
  isValidCheckoutSessionId,
  isValidReleaseVersion,
  isValidWebProductSlug,
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
  it('has the 5 MiB cap and an empty catalog', () => {
    expect(MAX_RELEASE_BYTES).toBe(5 * 1024 * 1024);
    expect(WEB_PRODUCTS).toEqual([]);
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
