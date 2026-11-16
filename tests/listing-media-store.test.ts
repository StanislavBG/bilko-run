import { describe, it, expect, beforeAll } from 'vitest';
import { createHash } from 'node:crypto';
import { dbAll, dbRun, initDb } from '../server/db.js';
import {
  storeListingMedia, getListingMedia, getListingMediaMeta,
} from '../server/services/listing-media.js';

beforeAll(async () => { await initDb(); });

const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');

function ascii(s: string): Buffer {
  return Buffer.from(s, 'latin1');
}

/** ISO BMFF box: u32 size + 4-char type + payload. */
function box(type: string, ...payload: Buffer[]): Buffer {
  const body = Buffer.concat(payload);
  const head = Buffer.alloc(8);
  head.writeUInt32BE(8 + body.length, 0);
  head.write(type, 4, 'latin1');
  return Buffer.concat([head, body]);
}

function hdlr(handler: string): Buffer {
  return box('hdlr', Buffer.alloc(8), ascii(handler), Buffer.alloc(12), ascii('h\0'));
}

function trak(handler: string): Buffer {
  return box('trak', box('tkhd', Buffer.alloc(84)), box('mdia', box('mdhd', Buffer.alloc(24)), hdlr(handler)));
}

const ftyp = box('ftyp', ascii('isom'), Buffer.alloc(4), ascii('isomavc1'));

function pseudoRandom(n: number, seed: number): Buffer {
  const out = Buffer.alloc(n);
  let x = seed >>> 0 || 1;
  for (let i = 0; i < n; i++) {
    x ^= x << 13; x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5; x >>>= 0;
    out[i] = x & 0xff;
  }
  return out;
}

/** MP4 with the given track handlers followed by an mdat of `mdatBytes` payload. */
function mp4(handlers: string[], mdatBytes: number, seed = 7): Buffer {
  return Buffer.concat([
    ftyp,
    box('moov', box('mvhd', Buffer.alloc(100)), ...handlers.map(trak)),
    box('mdat', pseudoRandom(mdatBytes, seed)),
  ]);
}

function png(width: number, height: number): Buffer {
  const b = Buffer.alloc(64);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
  b.writeUInt32BE(13, 8);
  b.write('IHDR', 12, 'latin1');
  b.writeUInt32BE(width, 16);
  b.writeUInt32BE(height, 20);
  return b;
}

describe('storeListingMedia / getListingMedia', () => {
  it('round-trips a 2.5 MiB MP4 over 3 chunks and reports exists on a second store', async () => {
    const buf = mp4(['vide', 'soun'], Math.floor(2.5 * 1024 * 1024));
    const file = `${sha(buf)}.mp4`;
    expect(await storeListingMedia('lm-roundtrip', file, 'video', buf)).toBe('stored');

    const chunks = await dbAll<{ idx: number; n: number }>(
      'SELECT idx, length(content) AS n FROM listing_media_chunks WHERE slug = ? AND file = ? ORDER BY idx',
      'lm-roundtrip', file,
    );
    expect(chunks.map((c) => Number(c.idx))).toEqual([0, 1, 2]);
    for (const c of chunks) expect(Number(c.n)).toBeLessThanOrEqual(1048576);

    const got = await getListingMedia('lm-roundtrip', file);
    expect(got).not.toBeNull();
    expect(got!.bytes).toBe(buf.length);
    expect(got!.contentType).toBe('video/mp4');
    expect(got!.hasAudio).toBe(true);
    expect(Buffer.compare(got!.content, buf)).toBe(0);

    expect(await storeListingMedia('lm-roundtrip', file, 'video', buf)).toBe('exists');
  });

  it('flags audio only for an MP4 with a sound track', async () => {
    const silent = mp4(['vide'], 1000, 11);
    const silentFile = `${sha(silent)}.mp4`;
    expect(await storeListingMedia('lm-audio', silentFile, 'video', silent)).toBe('stored');
    expect((await getListingMediaMeta('lm-audio', silentFile))?.hasAudio).toBe(false);

    const loud = mp4(['vide', 'soun'], 1000, 12);
    const loudFile = `${sha(loud)}.mp4`;
    expect(await storeListingMedia('lm-audio', loudFile, 'video', loud)).toBe('stored');
    expect((await getListingMediaMeta('lm-audio', loudFile))?.hasAudio).toBe(true);
  });

  it('rejects a hash mismatch, a bad name, an oversize video and a 1199x630 shareImage', async () => {
    const buf = mp4(['vide'], 100, 3);
    const wrong = `${'0'.repeat(64)}.mp4`;
    expect(await storeListingMedia('lm-reject', wrong, 'video', buf)).toHaveProperty('error');
    expect(await storeListingMedia('lm-reject', `${sha(buf).toUpperCase()}.mp4`, 'video', buf)).toHaveProperty('error');
    expect(await storeListingMedia('lm-reject', `${sha(buf)}.mov`, 'video', buf)).toHaveProperty('error');

    const big = mp4(['vide'], 8388608, 4);
    const bigRes = await storeListingMedia('lm-reject', `${sha(big)}.mp4`, 'video', big);
    expect(bigRes).toHaveProperty('error');
    expect((bigRes as { error: string }).error).toMatch(/8 MB/);

    const share = png(1199, 630);
    const shareRes = await storeListingMedia('lm-reject', `${sha(share)}.png`, 'shareImage', share);
    expect((shareRes as { error: string }).error).toMatch(/1199x630/);

    const okShare = png(1200, 630);
    expect(await storeListingMedia('lm-reject', `${sha(okShare)}.png`, 'shareImage', okShare)).toBe('stored');
    expect(await storeListingMedia('lm-reject', `${sha(okShare)}.png`, 'video', okShare)).toHaveProperty('error');

    const rows = await dbAll('SELECT file FROM listing_media WHERE slug = ?', 'lm-reject');
    expect(rows).toHaveLength(1);
    const orphanChunks = await dbAll(
      'SELECT 1 FROM listing_media_chunks WHERE slug = ? AND file <> ?', 'lm-reject', `${sha(okShare)}.png`,
    );
    expect(orphanChunks).toHaveLength(0);
  });

  it('returns null when stored bytes no longer match the name', async () => {
    const buf = mp4(['vide'], 5000, 21);
    const file = `${sha(buf)}.mp4`;
    expect(await storeListingMedia('lm-corrupt', file, 'video', buf)).toBe('stored');
    await dbRun(
      'UPDATE listing_media_chunks SET content = ? WHERE slug = ? AND file = ? AND idx = 0',
      Buffer.alloc(buf.length, 1), 'lm-corrupt', file,
    );
    expect(await getListingMedia('lm-corrupt', file)).toBeNull();
  });

  it('returns meta without reading chunks', async () => {
    const buf = mp4(['vide', 'soun'], 3000, 31);
    const file = `${sha(buf)}.mp4`;
    expect(await storeListingMedia('lm-meta', file, 'video', buf)).toBe('stored');
    await dbRun('DELETE FROM listing_media_chunks WHERE slug = ? AND file = ?', 'lm-meta', file);
    expect(await getListingMediaMeta('lm-meta', file)).toEqual({
      bytes: buf.length, hasAudio: true, contentType: 'video/mp4',
    });
    expect(await getListingMediaMeta('lm-meta', `${'a'.repeat(64)}.mp4`)).toBeNull();
    expect(await getListingMedia('lm-meta', `${'a'.repeat(64)}.mp4`)).toBeNull();
  });
});
