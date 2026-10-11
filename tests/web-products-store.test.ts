import { describe, it, expect, beforeAll } from 'vitest';
import { createHash } from 'node:crypto';
import { dbAll, initDb } from '../server/db.js';
import {
  recordOrder, findOrder, hasOrderForEmail, recordDownload, countSessionDownloads,
  storeRelease, getRelease,
} from '../server/services/web-products.js';
import type { WebProduct } from '../shared/web-products.js';

beforeAll(async () => { await initDb(); });

const BYTES = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 1, 2, 255, 254, 128, 7]);
const SHA = createHash('sha256').update(BYTES).digest('hex');

const product: WebProduct = {
  slug: 'fixture-pack',
  name: 'Fixture',
  productKey: 'wp_fixture_pack',
  priceEnvVar: 'STRIPE_PRICE_WP_FIXTURE_PACK',
  displayPrice: '$9',
  downloadLimit: 3,
  release: { version: '1.0.0', filename: 'fixture-1.0.0.zip', bytes: BYTES.length, sha256: SHA },
};

describe('orders', () => {
  it('is idempotent and looks up emails case-insensitively', async () => {
    const o = {
      checkoutSessionId: 'cs_test_order1', slug: 'fixture-pack', email: '  Buyer@Example.COM ',
      amountTotal: 900, currency: 'usd', paymentStatus: 'paid',
    };
    await recordOrder(o);
    await recordOrder({ ...o, amountTotal: 1 });
    const rows = await dbAll('SELECT * FROM web_product_orders WHERE checkout_session_id = ?', 'cs_test_order1');
    expect(rows).toHaveLength(1);
    const found = await findOrder('fixture-pack', 'cs_test_order1');
    expect(found?.email).toBe('buyer@example.com');
    expect(found?.amount_total).toBe(900);
    expect(await findOrder('other', 'cs_test_order1')).toBeNull();
    expect(await hasOrderForEmail('fixture-pack', 'BUYER@example.com')).toBe(true);
    expect(await hasOrderForEmail('fixture-pack', 'nobody@example.com')).toBe(false);
    expect(await hasOrderForEmail('other', 'buyer@example.com')).toBe(false);
  });
});

describe('downloads', () => {
  it('counts per checkout session', async () => {
    const base = { slug: 'fixture-pack', version: '1.0.0', email: null, ipHash: 'h' };
    await recordDownload({ ...base, checkoutSessionId: 'cs_test_a', via: 'session' });
    await recordDownload({ ...base, checkoutSessionId: 'cs_test_a', via: 'session' });
    await recordDownload({ ...base, checkoutSessionId: 'cs_test_b', via: 'session' });
    expect(await countSessionDownloads('fixture-pack', 'cs_test_a')).toBe(2);
    expect(await countSessionDownloads('fixture-pack', 'cs_test_b')).toBe(1);
    expect(await countSessionDownloads('fixture-pack', 'cs_test_none')).toBe(0);
  });
});

describe('releases', () => {
  it('returns undeclared for no release or another version', async () => {
    expect(await storeRelease({ ...product, release: null }, '1.0.0', BYTES)).toBe('undeclared');
    expect(await storeRelease(product, '2.0.0', BYTES)).toBe('undeclared');
  });

  it('rejects mismatched bytes and stores nothing', async () => {
    const wrongSameLen = Buffer.from(BYTES);
    wrongSameLen[0] ^= 0xff;
    expect(await storeRelease(product, '1.0.0', wrongSameLen)).toBe('mismatch');
    expect(await storeRelease(product, '1.0.0', Buffer.concat([BYTES, Buffer.from([1])]))).toBe('mismatch');
    expect(await dbAll('SELECT 1 FROM web_product_releases WHERE slug = ?', 'fixture-pack')).toHaveLength(0);
    expect(await getRelease('fixture-pack', '1.0.0')).toBeNull();
  });

  it('stores once, then reports exists, and returns identical bytes', async () => {
    expect(await storeRelease(product, '1.0.0', BYTES)).toBe('stored');
    expect(await storeRelease(product, '1.0.0', BYTES)).toBe('exists');
    const rel = await getRelease('fixture-pack', '1.0.0');
    expect(rel).not.toBeNull();
    expect(Buffer.isBuffer(rel!.content)).toBe(true);
    expect(rel!.content.equals(BYTES)).toBe(true);
    expect(rel!.filename).toBe('fixture-1.0.0.zip');
    expect(rel!.sha256).toBe(SHA);
    expect(rel!.bytes).toBe(BYTES.length);
  });
});
