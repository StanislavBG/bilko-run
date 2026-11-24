import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { crc32, deflateSync } from 'node:zlib';
import { dbAll, dbGet, dbRun, initDb } from '../server/db.js';
import {
  IMAGE_MAX_BYTES, IMAGE_CHUNK_BYTES, USER_QUOTA_BYTES,
  putImage, getImage, listImages, deleteImage, usedBytes, putDoc, stripImageMetadata,
} from '../server/services/bilko-db.js';

const APP = 'photo-app';
const APP2 = 'other-app';
const USER = 'a@example.com';
const USER2 = 'b@example.com';

// ---------- image builders ----------

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td) >>> 0);
  return Buffer.concat([len, td, crc]);
}

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function ihdr(w: number, h: number): Buffer {
  const d = Buffer.alloc(13);
  d.writeUInt32BE(w, 0);
  d.writeUInt32BE(h, 4);
  d[8] = 8; // bit depth
  d[9] = 0; // grayscale
  return pngChunk('IHDR', d);
}

function makePng(extra: Buffer[] = [], idatData?: Buffer): Buffer {
  const idat = idatData ?? deflateSync(Buffer.from([0, 0x80]));
  return Buffer.concat([PNG_SIG, ihdr(1, 1), ...extra, pngChunk('IDAT', idat), pngChunk('IEND', Buffer.alloc(0))]);
}

function jpegSegment(marker: number, payload: Buffer): Buffer {
  const head = Buffer.from([0xff, marker, 0, 0]);
  head.writeUInt16BE(payload.length + 2, 2);
  return Buffer.concat([head, payload]);
}

const APP0 = jpegSegment(0xe0, Buffer.from([0x4a, 0x46, 0x49, 0x46, 0x00, 1, 1, 0, 0, 1, 0, 1, 0, 0]));
const DQT = jpegSegment(0xdb, Buffer.concat([Buffer.from([0]), Buffer.alloc(64, 1)]));
function sof0(w: number, h: number): Buffer {
  const p = Buffer.from([8, 0, 0, 0, 0, 1, 1, 0x11, 0]);
  p.writeUInt16BE(h, 1);
  p.writeUInt16BE(w, 3);
  return jpegSegment(0xc0, p);
}
const SOS = jpegSegment(0xda, Buffer.from([1, 1, 0, 0, 63, 0]));
const SCAN = Buffer.from([0x12, 0xff, 0x00, 0x34, 0xff, 0xd0, 0x56]);
const EOI = Buffer.from([0xff, 0xd9]);
const EXIF_APP1 = jpegSegment(0xe1, Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), Buffer.from('MM\0*GPS-LAT-37.77', 'latin1')]));
const XMP_APP1 = jpegSegment(0xe1, Buffer.concat([Buffer.from('http://ns.adobe.com/xap/1.0/\0', 'latin1'), Buffer.from('<x:xmpmeta>Canon</x:xmpmeta>')]));

function makeJpeg(app1: Buffer[] = [], w = 640, h = 480): Buffer {
  return Buffer.concat([Buffer.from([0xff, 0xd8]), APP0, ...app1, DQT, sof0(w, h), SOS, SCAN, EOI]);
}

function makeWebp(): Buffer {
  // RIFF container with a minimal 1x1 VP8L lossless bitstream.
  const vp8l = Buffer.from([0x2f, 0x00, 0x00, 0x00, 0x00, 0x07, 0x00, 0x00, 0x00, 0x00]);
  const chunkHead = Buffer.alloc(8);
  chunkHead.write('VP8L', 0, 'latin1');
  chunkHead.writeUInt32LE(vp8l.length, 4);
  const body = Buffer.concat([Buffer.from('WEBP', 'latin1'), chunkHead, vp8l]);
  const riff = Buffer.alloc(8);
  riff.write('RIFF', 0, 'latin1');
  riff.writeUInt32LE(body.length, 4);
  return Buffer.concat([riff, body]);
}

// The classic 1x1 transparent GIF89a.
const GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

function jpegSegments(buf: Buffer): Array<{ marker: number; seg: Buffer }> {
  const out: Array<{ marker: number; seg: Buffer }> = [];
  let i = 2;
  while (i < buf.length) {
    const marker = buf[i + 1]!;
    if (marker === 0xda) break;
    const len = buf.readUInt16BE(i + 2);
    out.push({ marker, seg: buf.subarray(i, i + 2 + len) });
    i += 2 + len;
  }
  return out;
}

function pngChunkTypes(buf: Buffer): string[] {
  const out: string[] = [];
  let i = 8;
  while (i < buf.length) {
    const len = buf.readUInt32BE(i);
    out.push(buf.toString('latin1', i + 4, i + 8));
    i += 12 + len;
  }
  return out;
}

beforeAll(async () => {
  await initDb();
});

async function clearStore(): Promise<void> {
  await dbRun('DELETE FROM bilko_db_docs');
  await dbRun('DELETE FROM bilko_db_images');
  await dbRun('DELETE FROM bilko_db_image_chunks');
}

beforeEach(clearStore);
afterAll(clearStore);

describe('schema', () => {
  it('creates bilko_db_images with an (app, user_email) index', async () => {
    const cols = await dbAll<{ name: string; pk: number }>(`PRAGMA table_info(bilko_db_images)`);
    expect(cols.map((c) => c.name).sort()).toEqual(
      ['app', 'bytes', 'chunks', 'created_at', 'id', 'type', 'user_email'].sort(),
    );
    expect(cols.filter((c) => Number(c.pk) > 0).map((c) => c.name)).toEqual(['id']);
    const idx = await dbAll<{ name: string }>(`PRAGMA index_list(bilko_db_images)`);
    const infos = await Promise.all(idx.map((i) => dbAll<{ name: string }>(`PRAGMA index_info("${i.name}")`)));
    expect(infos.some((c) => c.length === 2 && c[0]!.name === 'app' && c[1]!.name === 'user_email')).toBe(true);
  });

  it('creates bilko_db_image_chunks keyed by (id, idx)', async () => {
    const cols = await dbAll<{ name: string; pk: number }>(`PRAGMA table_info(bilko_db_image_chunks)`);
    expect(cols.map((c) => c.name).sort()).toEqual(['content', 'id', 'idx']);
    expect(cols.filter((c) => Number(c.pk) > 0).sort((a, b) => Number(a.pk) - Number(b.pk)).map((c) => c.name))
      .toEqual(['id', 'idx']);
  });
});

describe('putImage', () => {
  it('constants', () => {
    expect(IMAGE_MAX_BYTES).toBe(10_485_760);
    expect(IMAGE_CHUNK_BYTES).toBe(1_048_576);
  });

  it.each([
    ['image/png', makePng()],
    ['image/jpeg', makeJpeg()],
    ['image/webp', makeWebp()],
    ['image/gif', GIF],
  ] as const)('stores a valid %s and reads it back', async (type, bytes) => {
    const before = Date.now();
    const r = await putImage({ app: APP, user: USER, bytes, type });
    if ('error' in r) throw new Error(r.error);
    expect(r.id).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(r.type).toBe(type);
    expect(r.bytes).toBe(bytes.length);
    expect(r.createdAt).toBeGreaterThanOrEqual(before);
    const got = await getImage(r.id);
    expect(got).toEqual({ app: APP, user: USER, type, bytes });
  });

  it('gives each image a distinct id', async () => {
    const ids = new Set<string>();
    for (let i = 0; i < 5; i++) {
      const r = await putImage({ app: APP, user: USER, bytes: GIF, type: 'image/gif' });
      if ('error' in r) throw new Error(r.error);
      ids.add(r.id);
    }
    expect(ids.size).toBe(5);
  });

  it('rejects a spoofed type (magic bytes do not match)', async () => {
    expect(await putImage({ app: APP, user: USER, bytes: makePng(), type: 'image/jpeg' })).toEqual({ error: 'bad_image' });
    expect(await putImage({ app: APP, user: USER, bytes: makeJpeg(), type: 'image/png' })).toEqual({ error: 'bad_image' });
    expect(await putImage({ app: APP, user: USER, bytes: GIF, type: 'image/webp' })).toEqual({ error: 'bad_image' });
    expect(await putImage({ app: APP, user: USER, bytes: makeWebp(), type: 'image/gif' })).toEqual({ error: 'bad_image' });
    expect(await putImage({ app: APP, user: USER, bytes: Buffer.from('<svg/>'), type: 'image/png' })).toEqual({ error: 'bad_image' });
  });

  it('rejects other types, empty bytes and a truncated structure', async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>');
    expect(await putImage({ app: APP, user: USER, bytes: svg, type: 'image/svg+xml' as never })).toEqual({ error: 'bad_image' });
    expect(await putImage({ app: APP, user: USER, bytes: Buffer.alloc(0), type: 'image/png' })).toEqual({ error: 'bad_image' });
    const png = makePng();
    expect(await putImage({ app: APP, user: USER, bytes: png.subarray(0, 20), type: 'image/png' })).toEqual({ error: 'bad_image' });
    const jpeg = makeJpeg([EXIF_APP1]);
    expect(await putImage({ app: APP, user: USER, bytes: jpeg.subarray(0, 30), type: 'image/jpeg' })).toEqual({ error: 'bad_image' });
    expect(await dbAll('SELECT id FROM bilko_db_images')).toEqual([]);
  });

  it('rejects an image over IMAGE_MAX_BYTES with too_large', async () => {
    const big = makePng([], Buffer.alloc(IMAGE_MAX_BYTES));
    expect(await putImage({ app: APP, user: USER, bytes: big, type: 'image/png' })).toEqual({ error: 'too_large' });
    expect(await dbAll('SELECT id FROM bilko_db_image_chunks')).toEqual([]);
  });

  it('accepts an image of exactly IMAGE_MAX_BYTES', async () => {
    const base = makePng([], Buffer.alloc(0)).length;
    const exact = makePng([], Buffer.alloc(IMAGE_MAX_BYTES - base));
    expect(exact.length).toBe(IMAGE_MAX_BYTES);
    const r = await putImage({ app: APP, user: USER, bytes: exact, type: 'image/png' });
    if ('error' in r) throw new Error(r.error);
    expect(r.bytes).toBe(IMAGE_MAX_BYTES);
  });

  it('counts documents and images in the same quota', async () => {
    const png = makePng();
    // Documents fill the quota up to one byte short of this image.
    await dbRun(
      `INSERT INTO bilko_db_docs (app, user_email, key, kind, body, bytes, version, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      APP2, USER, 'filler', 'text', 'x', USER_QUOTA_BYTES - png.length + 1, 1, 0,
    );
    expect(await putImage({ app: APP, user: USER, bytes: png, type: 'image/png' })).toEqual({ error: 'quota_exceeded' });
    // Another user is unaffected.
    expect('id' in (await putImage({ app: APP, user: USER2, bytes: png, type: 'image/png' }))).toBe(true);
    // Exactly at the quota is allowed.
    await dbRun(`UPDATE bilko_db_docs SET bytes = ? WHERE key = 'filler'`, USER_QUOTA_BYTES - png.length);
    const ok = await putImage({ app: APP, user: USER, bytes: png, type: 'image/png' });
    expect('id' in ok).toBe(true);
    expect(await usedBytes(USER)).toBe(USER_QUOTA_BYTES);
    // Images now block documents too.
    expect(await putDoc({ app: APP, user: USER, key: 'k', kind: 'text', body: 'x' })).toEqual({ error: 'quota_exceeded' });
  });

  it('stores a 3-chunk image as <= 1 MiB chunks and reads it back identical', async () => {
    const data = Buffer.alloc(2 * IMAGE_CHUNK_BYTES + 12345);
    for (let i = 0; i < data.length; i++) data[i] = (i * 31 + 7) & 0xff;
    const png = makePng([], data);
    const r = await putImage({ app: APP, user: USER, bytes: png, type: 'image/png' });
    if ('error' in r) throw new Error(r.error);
    const rows = await dbAll<{ idx: number; n: number }>(
      'SELECT idx, length(content) AS n FROM bilko_db_image_chunks WHERE id = ? ORDER BY idx', r.id,
    );
    expect(rows.map((x) => Number(x.idx))).toEqual([0, 1, 2]);
    for (const x of rows) expect(Number(x.n)).toBeLessThanOrEqual(IMAGE_CHUNK_BYTES);
    const meta = await dbGet<{ chunks: number; bytes: number }>('SELECT chunks, bytes FROM bilko_db_images WHERE id = ?', r.id);
    expect(Number(meta!.chunks)).toBe(3);
    expect(Number(meta!.bytes)).toBe(png.length);
    const got = await getImage(r.id);
    expect(got!.bytes.equals(png)).toBe(true);
  });

  it('an image row without its chunks is not visible before the row is written (row last)', async () => {
    // Chunks alone (as if a write died before the row) are not an image and do not count.
    await dbRun('INSERT INTO bilko_db_image_chunks (id, idx, content) VALUES (?, ?, ?)', 'orphan', 0, Buffer.from([1]));
    expect(await getImage('orphan')).toBeNull();
    expect(await listImages({ app: APP, user: USER })).toEqual([]);
    expect(await usedBytes(USER)).toBe(0);
  });
});

describe('metadata stripping', () => {
  it('removes JPEG Exif and XMP APP1 segments, keeps the rest byte for byte with SOF dimensions', async () => {
    const withMeta = makeJpeg([EXIF_APP1, XMP_APP1], 1234, 567);
    const clean = makeJpeg([], 1234, 567);
    const r = await putImage({ app: APP, user: USER, bytes: withMeta, type: 'image/jpeg' });
    if ('error' in r) throw new Error(r.error);
    expect(r.bytes).toBe(clean.length);
    const got = await getImage(r.id);
    expect(got!.bytes.equals(clean)).toBe(true);
    const segs = jpegSegments(got!.bytes);
    expect(segs.some((s) => s.marker === 0xe1)).toBe(false);
    expect(got!.bytes.includes(Buffer.from('Exif'))).toBe(false);
    expect(got!.bytes.includes(Buffer.from('xmpmeta'))).toBe(false);
    const sof = segs.find((s) => s.marker === 0xc0)!.seg;
    expect(sof.readUInt16BE(5)).toBe(567);
    expect(sof.readUInt16BE(7)).toBe(1234);
    // Scan data after SOS is untouched, including its stuffed and RST bytes.
    expect(got!.bytes.subarray(got!.bytes.length - SCAN.length - 2).equals(Buffer.concat([SCAN, EOI]))).toBe(true);
    expect(await usedBytes(USER)).toBe(clean.length);
  });

  it('removes PNG eXIf chunks and keeps every other chunk and CRC unchanged', async () => {
    const text = pngChunk('tEXt', Buffer.from('Comment\0hello', 'latin1'));
    const exif = pngChunk('eXIf', Buffer.from('MM\0*GPS', 'latin1'));
    const withMeta = makePng([text, exif]);
    const clean = makePng([text]);
    const r = await putImage({ app: APP, user: USER, bytes: withMeta, type: 'image/png' });
    if ('error' in r) throw new Error(r.error);
    expect(r.bytes).toBe(clean.length);
    const got = await getImage(r.id);
    expect(got!.bytes.equals(clean)).toBe(true);
    expect(pngChunkTypes(got!.bytes)).toEqual(['IHDR', 'tEXt', 'IDAT', 'IEND']);
  });

  it('leaves images without metadata unchanged', () => {
    for (const [type, b] of [['image/png', makePng()], ['image/jpeg', makeJpeg()], ['image/webp', makeWebp()], ['image/gif', GIF]] as const) {
      const out = stripImageMetadata(type, b);
      expect(out && out.equals(b)).toBe(true);
    }
  });
});

describe('getImage / listImages / deleteImage', () => {
  it('getImage returns null for an unknown id', async () => {
    expect(await getImage('nope')).toBeNull();
  });

  it('listImages is per user per app', async () => {
    const a = await putImage({ app: APP, user: USER, bytes: GIF, type: 'image/gif' });
    const b = await putImage({ app: APP, user: USER, bytes: makePng(), type: 'image/png' });
    await putImage({ app: APP2, user: USER, bytes: GIF, type: 'image/gif' });
    await putImage({ app: APP, user: USER2, bytes: GIF, type: 'image/gif' });
    if ('error' in a || 'error' in b) throw new Error('put failed');
    const list = await listImages({ app: APP, user: USER });
    expect(list.map((x) => x.id).sort()).toEqual([a.id, b.id].sort());
    expect(list.find((x) => x.id === a.id)).toEqual(a);
    expect(list.find((x) => x.id === b.id)).toEqual(b);
  });

  it('deleteImage removes chunks and row for the owner only', async () => {
    const r = await putImage({ app: APP, user: USER, bytes: makePng(), type: 'image/png' });
    if ('error' in r) throw new Error(r.error);
    expect(await deleteImage({ app: APP, user: USER2, id: r.id })).toEqual({ deleted: false });
    expect(await deleteImage({ app: APP2, user: USER, id: r.id })).toEqual({ deleted: false });
    expect(await getImage(r.id)).not.toBeNull();
    expect((await dbAll('SELECT idx FROM bilko_db_image_chunks WHERE id = ?', r.id)).length).toBe(1);

    expect(await deleteImage({ app: APP, user: USER, id: r.id })).toEqual({ deleted: true });
    expect(await getImage(r.id)).toBeNull();
    expect(await dbAll('SELECT idx FROM bilko_db_image_chunks WHERE id = ?', r.id)).toEqual([]);
    expect(await usedBytes(USER)).toBe(0);
    expect(await deleteImage({ app: APP, user: USER, id: r.id })).toEqual({ deleted: false });
  });

  it('usedBytes counts images and documents together', async () => {
    const png = makePng();
    await putImage({ app: APP, user: USER, bytes: png, type: 'image/png' });
    await putDoc({ app: APP2, user: USER, key: 'k', kind: 'text', body: 'hello' });
    expect(await usedBytes(USER)).toBe(png.length + 5);
    expect(await usedBytes(USER2)).toBe(0);
  });
});
