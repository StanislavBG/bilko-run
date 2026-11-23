// Envelope store: opaque ciphertext is split into 1 MiB chunk rows and read back byte-identical,
// stored once per (box, client report id) even under a concurrent race, refused when the box is
// full, and removed on ack, on device unpair and after the TTL, chunks included.
import crypto from 'node:crypto';
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { initDb, dbRun, dbGet } from '../server/db.js';
import {
  ENVELOPE_CHUNK_BYTES, MAX_BOX_ENVELOPES, MAX_BOX_BYTES, ENVELOPE_TTL_MS,
  createBox, getBox, storeEnvelope, listEnvelopes, readEnvelope, deleteEnvelope,
  deleteBoxesForDevice, purgeExpiredEnvelopes,
} from '../server/sm-relay/boxes.js';

const USER = 'envelope-owner@test.com';
const ORIGIN = 'https://example.com';

function rawP256Point(): string {
  const { publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const der = publicKey.export({ format: 'der', type: 'spki' });
  return der.subarray(der.length - 65).toString('base64url');
}
const KEY = rawP256Point();

async function makeBox(deviceId = 'dev-1') {
  const box = await createBox({ userId: USER, deviceId, label: 'Site', publicKey: KEY, allowedOrigins: [ORIGIN] });
  if (!box) throw new Error('box not created');
  return box.boxId;
}

async function count(sql: string, ...args: unknown[]): Promise<number> {
  const row = await dbGet<{ n: number }>(sql, ...args);
  return Number(row?.n ?? 0);
}
const chunkCount = (envelopeId: string) =>
  count('SELECT COUNT(*) AS n FROM sm_relay_envelope_chunks WHERE envelope_id = ?', envelopeId);
const allChunks = () => count('SELECT COUNT(*) AS n FROM sm_relay_envelope_chunks');
const allEnvelopes = () => count('SELECT COUNT(*) AS n FROM sm_relay_envelopes');

async function insertRawEnvelopes(boxId: string, n: number, bytesEach: number, receivedAt = 1) {
  await dbRun(
    `WITH RECURSIVE seq(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM seq WHERE i < ?)
     INSERT INTO sm_relay_envelopes
       (envelope_id, box_id, host_id, client_report_id, origin, bytes, chunks, received_at)
     SELECT 'raw-' || ? || '-' || i, ?, 'FB-R' || i, 'raw-report-' || i, ?, ?, 0, ? FROM seq`,
    n, boxId, boxId, ORIGIN, bytesEach, receivedAt,
  );
}

beforeAll(async () => {
  await initDb();
});

beforeEach(async () => {
  await dbRun('DELETE FROM sm_relay_envelope_chunks');
  await dbRun('DELETE FROM sm_relay_envelopes');
  await dbRun('DELETE FROM sm_relay_boxes');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('storeEnvelope', () => {
  it('stores a 2.5 MiB body as 3 chunks, then the envelope row, and reads it back byte-identical', async () => {
    const boxId = await makeBox();
    const body = crypto.randomBytes(Math.floor(2.5 * ENVELOPE_CHUNK_BYTES));
    const res = await storeEnvelope({ boxId, clientReportId: 'r-1', origin: ORIGIN, body, now: 5000 });
    expect(res.kind).toBe('created');
    if (res.kind !== 'created') return;
    expect(res.hostId).toMatch(/^FB-[0-9A-Z]{5}$/);
    expect(await chunkCount(res.envelopeId)).toBe(3);
    const row = await dbGet<{ bytes: number; chunks: number }>(
      'SELECT bytes, chunks FROM sm_relay_envelopes WHERE envelope_id = ?', res.envelopeId,
    );
    expect(Number(row?.bytes)).toBe(body.length);
    expect(Number(row?.chunks)).toBe(3);
    expect((await getBox(boxId))?.lastReceivedAt).toBe(5000);

    const back = await readEnvelope(boxId, res.envelopeId);
    expect(back).toBeInstanceOf(Buffer);
    expect(back!.equals(body)).toBe(true);
  });

  it('writes exactly one chunk for a body of exactly ENVELOPE_CHUNK_BYTES', async () => {
    const boxId = await makeBox();
    const res = await storeEnvelope({ boxId, clientReportId: 'r-1', origin: ORIGIN, body: Buffer.alloc(ENVELOPE_CHUNK_BYTES, 7) });
    if (res.kind !== 'created') throw new Error(res.kind);
    expect(await chunkCount(res.envelopeId)).toBe(1);
  });

  it('a repeat of the same client report id is a duplicate with the first host id and writes nothing', async () => {
    const boxId = await makeBox();
    const first = await storeEnvelope({ boxId, clientReportId: 'r-1', origin: ORIGIN, body: Buffer.from('a'), now: 100 });
    if (first.kind !== 'created') throw new Error(first.kind);
    const second = await storeEnvelope({ boxId, clientReportId: 'r-1', origin: ORIGIN, body: Buffer.from('bb'), now: 200 });
    expect(second).toEqual({ kind: 'duplicate', hostId: first.hostId });
    expect(await allEnvelopes()).toBe(1);
    expect(await allChunks()).toBe(1);
    expect((await getBox(boxId))?.lastReceivedAt).toBe(100);
  });

  it('the same client report id in another box is a separate envelope', async () => {
    const a = await makeBox('dev-1');
    const b = await makeBox('dev-2');
    expect((await storeEnvelope({ boxId: a, clientReportId: 'r-1', origin: ORIGIN, body: Buffer.from('x') })).kind).toBe('created');
    expect((await storeEnvelope({ boxId: b, clientReportId: 'r-1', origin: ORIGIN, body: Buffer.from('x') })).kind).toBe('created');
  });

  it('a concurrent duplicate that loses the UNIQUE race deletes its chunks and returns the winner', async () => {
    const boxId = await makeBox();
    const body = crypto.randomBytes(ENVELOPE_CHUNK_BYTES + 10);
    const results = await Promise.all(
      Array.from({ length: 4 }, () => storeEnvelope({ boxId, clientReportId: 'race', origin: ORIGIN, body })),
    );
    const created = results.filter((r) => r.kind === 'created');
    expect(created).toHaveLength(1);
    const winner = created[0] as { kind: 'created'; envelopeId: string; hostId: string };
    for (const r of results) {
      if (r.kind !== 'created') expect(r).toEqual({ kind: 'duplicate', hostId: winner.hostId });
    }
    expect(await allEnvelopes()).toBe(1);
    expect(await allChunks()).toBe(2);
    expect(await chunkCount(winner.envelopeId)).toBe(2);
  });

  it('a lost race found after the pre-check deletes the chunks it wrote and returns the winner', async () => {
    const boxId = await makeBox();
    // The envelope id is drawn after the duplicate pre-check; the winner's row lands right then,
    // before this attempt writes its chunks and its envelope row.
    const realUuid = crypto.randomUUID.bind(crypto);
    let winnerInsert: Promise<unknown> | null = null;
    vi.spyOn(crypto, 'randomUUID').mockImplementation(() => {
      winnerInsert ??= dbRun(
        `INSERT INTO sm_relay_envelopes
           (envelope_id, box_id, host_id, client_report_id, origin, bytes, chunks, received_at)
         VALUES ('winner', ?, 'FB-WWWWW', 'late', ?, 1, 0, 1)`,
        boxId, ORIGIN,
      );
      return realUuid();
    });
    const res = await storeEnvelope({
      boxId, clientReportId: 'late', origin: ORIGIN, body: crypto.randomBytes(ENVELOPE_CHUNK_BYTES + 1),
    });
    await winnerInsert;
    expect(res).toEqual({ kind: 'duplicate', hostId: 'FB-WWWWW' });
    expect(await allChunks()).toBe(0);
    expect(await allEnvelopes()).toBe(1);
  });

  it('retries a host id collision with a fresh id', async () => {
    const boxId = await makeBox();
    // All-zero random bytes map to FB-00000; pre-insert a row holding that host id.
    await dbRun(
      `INSERT INTO sm_relay_envelopes
         (envelope_id, box_id, host_id, client_report_id, origin, bytes, chunks, received_at)
       VALUES ('taken', ?, 'FB-00000', 'other', ?, 1, 0, 1)`,
      boxId, ORIGIN,
    );
    const real = crypto.randomBytes.bind(crypto);
    let hostDraws = 0;
    vi.spyOn(crypto, 'randomBytes').mockImplementation(((n: number) => {
      if (n === 5) {
        hostDraws++;
        if (hostDraws <= 2) return Buffer.alloc(5, 0);
      }
      return real(n);
    }) as typeof crypto.randomBytes);
    const res = await storeEnvelope({ boxId, clientReportId: 'r-1', origin: ORIGIN, body: Buffer.from('abc') });
    if (res.kind !== 'created') throw new Error(res.kind);
    expect(hostDraws).toBe(3);
    expect(res.hostId).not.toBe('FB-00000');
    expect(await chunkCount(res.envelopeId)).toBe(1);
    expect((await readEnvelope(boxId, res.envelopeId))!.toString()).toBe('abc');
  });

  it('throws after 5 host id collisions and leaves no chunks behind', async () => {
    const boxId = await makeBox();
    await dbRun(
      `INSERT INTO sm_relay_envelopes
         (envelope_id, box_id, host_id, client_report_id, origin, bytes, chunks, received_at)
       VALUES ('taken', ?, 'FB-00000', 'other', ?, 1, 0, 1)`,
      boxId, ORIGIN,
    );
    const real = crypto.randomBytes.bind(crypto);
    vi.spyOn(crypto, 'randomBytes').mockImplementation(((n: number) =>
      n === 5 ? Buffer.alloc(5, 0) : real(n)) as typeof crypto.randomBytes);
    await expect(storeEnvelope({ boxId, clientReportId: 'r-1', origin: ORIGIN, body: Buffer.from('abc') }))
      .rejects.toThrow(/no free host id/);
    expect(await allChunks()).toBe(0);
    expect(await allEnvelopes()).toBe(1);
  });

  it('is full at MAX_BOX_ENVELOPES envelopes and writes nothing', async () => {
    const boxId = await makeBox();
    await insertRawEnvelopes(boxId, MAX_BOX_ENVELOPES, 1);
    const res = await storeEnvelope({ boxId, clientReportId: 'r-new', origin: ORIGIN, body: Buffer.from('x') });
    expect(res).toEqual({ kind: 'full' });
    expect(await allEnvelopes()).toBe(MAX_BOX_ENVELOPES);
    expect(await allChunks()).toBe(0);
    expect((await getBox(boxId))?.lastReceivedAt).toBeNull();
  });

  it('is full when stored bytes plus the body would exceed MAX_BOX_BYTES, and accepts an exact fit', async () => {
    const boxId = await makeBox();
    await insertRawEnvelopes(boxId, 1, MAX_BOX_BYTES - 10);
    const over = await storeEnvelope({ boxId, clientReportId: 'over', origin: ORIGIN, body: Buffer.alloc(11) });
    expect(over).toEqual({ kind: 'full' });
    expect(await allChunks()).toBe(0);
    const fit = await storeEnvelope({ boxId, clientReportId: 'fit', origin: ORIGIN, body: Buffer.alloc(10) });
    expect(fit.kind).toBe('created');
  });

  it('a duplicate wins over full', async () => {
    const boxId = await makeBox();
    await insertRawEnvelopes(boxId, MAX_BOX_ENVELOPES, 1);
    const res = await storeEnvelope({ boxId, clientReportId: 'raw-report-1', origin: ORIGIN, body: Buffer.from('x') });
    expect(res).toEqual({ kind: 'duplicate', hostId: 'FB-R1' });
  });
});

describe('list / read / delete', () => {
  it('lists at most limit envelopes oldest first with their metadata', async () => {
    const boxId = await makeBox();
    const ids: string[] = [];
    for (const [i, t] of [[1, 300], [2, 100], [3, 200]] as const) {
      const r = await storeEnvelope({ boxId, clientReportId: `r-${i}`, origin: ORIGIN, body: Buffer.alloc(i), now: t });
      if (r.kind !== 'created') throw new Error(r.kind);
      ids[i] = r.envelopeId;
    }
    const all = await listEnvelopes(boxId, 10);
    expect(all.map((e) => e.clientReportId)).toEqual(['r-2', 'r-3', 'r-1']);
    expect(all[0]).toEqual({
      envelopeId: ids[2], hostId: expect.stringMatching(/^FB-/), clientReportId: 'r-2',
      receivedAt: 100, origin: ORIGIN, bytes: 2,
    });
    expect((await listEnvelopes(boxId, 2)).map((e) => e.clientReportId)).toEqual(['r-2', 'r-3']);
  });

  it('readEnvelope is null for an unknown id or another box', async () => {
    const a = await makeBox('dev-1');
    const b = await makeBox('dev-2');
    const r = await storeEnvelope({ boxId: a, clientReportId: 'r', origin: ORIGIN, body: Buffer.from('secret') });
    if (r.kind !== 'created') throw new Error(r.kind);
    expect(await readEnvelope(a, 'nope')).toBeNull();
    expect(await readEnvelope(b, r.envelopeId)).toBeNull();
    expect(await deleteEnvelope(b, r.envelopeId)).toBe(false);
  });

  it('deleteEnvelope returns true once, removes its chunks, then false', async () => {
    const boxId = await makeBox();
    const r = await storeEnvelope({ boxId, clientReportId: 'r', origin: ORIGIN, body: crypto.randomBytes(ENVELOPE_CHUNK_BYTES * 2 + 1) });
    if (r.kind !== 'created') throw new Error(r.kind);
    expect(await chunkCount(r.envelopeId)).toBe(3);
    expect(await deleteEnvelope(boxId, r.envelopeId)).toBe(true);
    expect(await chunkCount(r.envelopeId)).toBe(0);
    expect(await readEnvelope(boxId, r.envelopeId)).toBeNull();
    expect(await deleteEnvelope(boxId, r.envelopeId)).toBe(false);
  });
});

describe('deleteBoxesForDevice', () => {
  it('removes every box of the device with envelopes and chunks, and leaves other devices alone', async () => {
    const a1 = await makeBox('dev-1');
    const a2 = await makeBox('dev-1');
    const other = await makeBox('dev-2');
    for (const boxId of [a1, a2, other]) {
      await storeEnvelope({ boxId, clientReportId: 'r', origin: ORIGIN, body: Buffer.from(boxId) });
    }
    expect(await deleteBoxesForDevice('dev-1')).toBe(2);
    expect(await getBox(a1)).toBeNull();
    expect(await getBox(a2)).toBeNull();
    expect(await getBox(other)).not.toBeNull();
    expect(await allEnvelopes()).toBe(1);
    expect(await allChunks()).toBe(1);
    expect(await deleteBoxesForDevice('dev-1')).toBe(0);
  });
});

describe('purgeExpiredEnvelopes', () => {
  it('removes envelopes received before now - ttl with their chunks and returns the count', async () => {
    const boxId = await makeBox();
    const now = 100 * ENVELOPE_TTL_MS;
    const old = await storeEnvelope({ boxId, clientReportId: 'old', origin: ORIGIN, body: Buffer.from('o'), now: now - ENVELOPE_TTL_MS - 1 });
    const edge = await storeEnvelope({ boxId, clientReportId: 'edge', origin: ORIGIN, body: Buffer.from('e'), now: now - ENVELOPE_TTL_MS });
    const fresh = await storeEnvelope({ boxId, clientReportId: 'fresh', origin: ORIGIN, body: Buffer.from('f'), now });
    if (old.kind !== 'created' || edge.kind !== 'created' || fresh.kind !== 'created') throw new Error('store');
    expect(await purgeExpiredEnvelopes(now)).toBe(1);
    expect(await chunkCount(old.envelopeId)).toBe(0);
    expect((await listEnvelopes(boxId, 10)).map((e) => e.clientReportId)).toEqual(['edge', 'fresh']);
    expect(await purgeExpiredEnvelopes(now, 0)).toBe(1);
    expect((await listEnvelopes(boxId, 10)).map((e) => e.clientReportId)).toEqual(['fresh']);
    expect(await allChunks()).toBe(1);
  });
});
