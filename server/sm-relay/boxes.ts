// Sealed drop boxes for the Session Manager website feedback widget. A box belongs to one
// paired device of one account (user_id = the Clerk email on sm_relay_devices) and holds only
// an opaque P-256 public key: the host never sees a private key or a decrypted report.
// Times are epoch milliseconds here; the routes format them.
import crypto from 'node:crypto';
import { dbAll, dbGet, dbRun } from '../db.js';

export const MAX_BOXES_PER_ACCOUNT = 25;
export const ENVELOPE_CHUNK_BYTES = 1048576;
export const MAX_ENVELOPE_BYTES = 12 * 1048576;
export const MAX_BOX_ENVELOPES = 500;
export const MAX_BOX_BYTES = 200 * 1048576;
export const ENVELOPE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const MAX_ORIGINS = 10;
const MAX_LABEL_CHARS = 80;
const CREATE_ATTEMPTS = 5;

export type BoxState = 'open' | 'paused';

export interface BoxRecord {
  boxId: string;
  userId: string;
  deviceId: string;
  label: string;
  publicKey: string;
  allowedOrigins: string[];
  state: BoxState;
  createdAt: number;
  lastReceivedAt: number | null;
}

export type BoxListRow = BoxRecord & { pending: number; pendingBytes: number };

// ── Ids ──────────────────────────────────────────────────────────────────────

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** 32 symbols, so each random byte's low 5 bits map uniformly. */
function crockford(len: number): string {
  const bytes = crypto.randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) out += CROCKFORD[bytes[i] & 31];
  return out;
}

export function newBoxId(): string {
  return crockford(8);
}

export function newHostId(): string {
  return `FB-${crockford(5)}`;
}

// ── Validators ───────────────────────────────────────────────────────────────

const BASE64URL_RE = /^[A-Za-z0-9_-]+$/;

/** Unpadded base64url of a 65-byte uncompressed P-256 point that is on the curve. */
export function parseBoxPublicKey(v: unknown): string | null {
  if (typeof v !== 'string' || !BASE64URL_RE.test(v)) return null;
  const raw = Buffer.from(v, 'base64url');
  if (raw.length !== 65 || raw[0] !== 0x04) return null;
  if (raw.toString('base64url') !== v) return null;
  try {
    crypto.createPublicKey({
      key: {
        kty: 'EC',
        crv: 'P-256',
        x: raw.subarray(1, 33).toString('base64url'),
        y: raw.subarray(33, 65).toString('base64url'),
      },
      format: 'jwk',
    });
  } catch {
    return null;
  }
  return v;
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);

/** 1-10 bare origins (https:, or http: on localhost / 127.0.0.1), deduplicated. */
export function parseAllowedOrigins(v: unknown): string[] | null {
  if (!Array.isArray(v) || v.length < 1 || v.length > MAX_ORIGINS) return null;
  const out: string[] = [];
  for (const s of v) {
    // WHATWG URL parses https://*.example.com as a literal host; wildcards are never allowed.
    if (typeof s !== 'string' || s.includes('*')) return null;
    let url: URL;
    try {
      url = new URL(s);
    } catch {
      return null;
    }
    if (url.origin !== s) return null;
    const ok = url.protocol === 'https:' || (url.protocol === 'http:' && LOCAL_HOSTS.has(url.hostname));
    if (!ok) return null;
    if (!out.includes(s)) out.push(s);
  }
  return out;
}

export function parseBoxLabel(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const label = v.trim();
  if (label.length < 1 || label.length > MAX_LABEL_CHARS) return null;
  return label;
}

// ── Store ────────────────────────────────────────────────────────────────────

interface BoxRow {
  box_id: string;
  user_id: string;
  device_id: string;
  label: string;
  public_key: string;
  allowed_origins: string;
  state: string;
  created_at: number;
  last_received_at: number | null;
}

interface BoxListDbRow extends BoxRow {
  pending: number | null;
  pending_bytes: number | null;
}

const BOX_COLS =
  'box_id, user_id, device_id, label, public_key, allowed_origins, state, created_at, last_received_at';

function toBox(row: BoxRow): BoxRecord {
  return {
    boxId: row.box_id,
    userId: row.user_id,
    deviceId: row.device_id,
    label: row.label,
    publicKey: row.public_key,
    allowedOrigins: JSON.parse(row.allowed_origins) as string[],
    state: row.state === 'paused' ? 'paused' : 'open',
    createdAt: Number(row.created_at),
    lastReceivedAt: row.last_received_at == null ? null : Number(row.last_received_at),
  };
}

function isPrimaryKeyCollision(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /UNIQUE constraint failed: sm_relay_boxes\.box_id|SQLITE_CONSTRAINT_PRIMARYKEY/.test(msg);
}

export interface CreateBoxInput {
  userId: string;
  deviceId: string;
  label: string;
  publicKey: string;
  allowedOrigins: string[];
  now?: number;
}

/**
 * Returns null when the account already holds MAX_BOXES_PER_ACCOUNT boxes. The cap check and
 * the insert are one statement, so two concurrent creates cannot both pass the check.
 */
export async function createBox(input: CreateBoxInput): Promise<BoxRecord | null> {
  const now = input.now ?? Date.now();
  const origins = JSON.stringify(input.allowedOrigins);
  for (let attempt = 0; attempt < CREATE_ATTEMPTS; attempt++) {
    const boxId = newBoxId();
    try {
      const { changes } = await dbRun(
        `INSERT INTO sm_relay_boxes (${BOX_COLS})
         SELECT ?, ?, ?, ?, ?, ?, 'open', ?, NULL
         WHERE (SELECT COUNT(*) FROM sm_relay_boxes WHERE user_id = ?) < ?`,
        boxId, input.userId, input.deviceId, input.label, input.publicKey, origins, now,
        input.userId, MAX_BOXES_PER_ACCOUNT,
      );
      if (changes === 0) return null;
      return {
        boxId,
        userId: input.userId,
        deviceId: input.deviceId,
        label: input.label,
        publicKey: input.publicKey,
        allowedOrigins: [...input.allowedOrigins],
        state: 'open',
        createdAt: now,
        lastReceivedAt: null,
      };
    } catch (err) {
      if (!isPrimaryKeyCollision(err)) throw err;
    }
  }
  throw new Error(`sm-relay: no free box id after ${CREATE_ATTEMPTS} attempts`);
}

export async function getBox(boxId: string): Promise<BoxRecord | null> {
  const row = await dbGet<BoxRow>(`SELECT ${BOX_COLS} FROM sm_relay_boxes WHERE box_id = ?`, boxId);
  return row ? toBox(row) : null;
}

export async function listBoxes(opts: { userId: string; deviceId?: string }): Promise<BoxListRow[]> {
  const cols = BOX_COLS.split(', ').map((c) => `b.${c}`).join(', ');
  const deviceClause = opts.deviceId === undefined ? '' : ' AND b.device_id = ?';
  const args: unknown[] = [opts.userId];
  if (opts.deviceId !== undefined) args.push(opts.deviceId);
  const rows = await dbAll<BoxListDbRow>(
    `SELECT ${cols}, e.pending AS pending, e.pending_bytes AS pending_bytes
     FROM sm_relay_boxes b
     LEFT JOIN (
       SELECT box_id, COUNT(*) AS pending, SUM(bytes) AS pending_bytes
       FROM sm_relay_envelopes GROUP BY box_id
     ) e ON e.box_id = b.box_id
     WHERE b.user_id = ?${deviceClause}
     ORDER BY b.created_at, b.box_id`,
    ...args,
  );
  return rows.map((r) => ({
    ...toBox(r),
    pending: Number(r.pending ?? 0),
    pendingBytes: Number(r.pending_bytes ?? 0),
  }));
}

export interface BoxPatch {
  label?: string;
  allowedOrigins?: string[];
  state?: BoxState;
}

/** Returns the updated box, or null when it does not exist. An empty patch just reads it. */
export async function updateBox(boxId: string, patch: BoxPatch): Promise<BoxRecord | null> {
  const sets: string[] = [];
  const args: unknown[] = [];
  if (patch.label !== undefined) {
    sets.push('label = ?');
    args.push(patch.label);
  }
  if (patch.allowedOrigins !== undefined) {
    sets.push('allowed_origins = ?');
    args.push(JSON.stringify(patch.allowedOrigins));
  }
  if (patch.state !== undefined) {
    sets.push('state = ?');
    args.push(patch.state);
  }
  if (sets.length === 0) return getBox(boxId);
  const row = await dbGet<BoxRow>(
    `UPDATE sm_relay_boxes SET ${sets.join(', ')} WHERE box_id = ? RETURNING ${BOX_COLS}`,
    ...args, boxId,
  );
  return row ? toBox(row) : null;
}

/** Removes the box's chunks, then its envelopes, then the box row. */
export async function deleteBox(boxId: string): Promise<boolean> {
  await dbRun(
    `DELETE FROM sm_relay_envelope_chunks
     WHERE envelope_id IN (SELECT envelope_id FROM sm_relay_envelopes WHERE box_id = ?)`,
    boxId,
  );
  await dbRun('DELETE FROM sm_relay_envelopes WHERE box_id = ?', boxId);
  const { changes } = await dbRun('DELETE FROM sm_relay_boxes WHERE box_id = ?', boxId);
  return changes > 0;
}

// ── Envelopes ────────────────────────────────────────────────────────────────
// An envelope is opaque ciphertext. Its bytes are only split into chunk rows and joined back:
// never decoded, parsed, hashed or logged.

const HOST_ID_ATTEMPTS = 5;

export interface StoreEnvelopeInput {
  boxId: string;
  clientReportId: string;
  origin: string;
  body: Buffer;
  now?: number;
}

export type StoreEnvelopeResult =
  | { kind: 'created'; envelopeId: string; hostId: string }
  | { kind: 'duplicate'; hostId: string }
  | { kind: 'full' };

export interface EnvelopeListRow {
  envelopeId: string;
  hostId: string;
  clientReportId: string;
  receivedAt: number;
  origin: string;
  bytes: number;
}

interface EnvelopeDbRow {
  envelope_id: string;
  host_id: string;
  client_report_id: string;
  received_at: number;
  origin: string;
  bytes: number;
}

function constraintMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function isHostIdCollision(err: unknown): boolean {
  return /UNIQUE constraint failed: sm_relay_envelopes\.box_id, sm_relay_envelopes\.host_id/.test(
    constraintMessage(err),
  );
}

function isClientReportCollision(err: unknown): boolean {
  return /UNIQUE constraint failed: sm_relay_envelopes\.box_id, sm_relay_envelopes\.client_report_id/.test(
    constraintMessage(err),
  );
}

/** libsql returns BLOBs as ArrayBuffer (remote) or Uint8Array (local). */
function blobToBuffer(raw: unknown): Buffer {
  if (raw instanceof ArrayBuffer) return Buffer.from(new Uint8Array(raw));
  const u = raw as Uint8Array;
  return Buffer.from(u.buffer, u.byteOffset, u.byteLength);
}

async function findByClientReport(boxId: string, clientReportId: string): Promise<string | null> {
  const row = await dbGet<{ host_id: string }>(
    'SELECT host_id FROM sm_relay_envelopes WHERE box_id = ? AND client_report_id = ?',
    boxId, clientReportId,
  );
  return row ? row.host_id : null;
}

async function boxHasRoom(boxId: string, bytes: number): Promise<boolean> {
  const row = await dbGet<{ n: number; total: number | null }>(
    'SELECT COUNT(*) AS n, SUM(bytes) AS total FROM sm_relay_envelopes WHERE box_id = ?',
    boxId,
  );
  const n = Number(row?.n ?? 0);
  const total = Number(row?.total ?? 0);
  return n < MAX_BOX_ENVELOPES && total + bytes <= MAX_BOX_BYTES;
}

async function deleteChunks(envelopeId: string): Promise<void> {
  await dbRun('DELETE FROM sm_relay_envelope_chunks WHERE envelope_id = ?', envelopeId);
}

/**
 * Idempotent per (boxId, clientReportId). Order: duplicate check, quota check, chunk rows,
 * envelope row (which re-checks the quota in the same statement), then last_received_at.
 */
export async function storeEnvelope(input: StoreEnvelopeInput): Promise<StoreEnvelopeResult> {
  const { boxId, clientReportId, origin, body } = input;
  const now = input.now ?? Date.now();
  const bytes = body.length;

  const existing = await findByClientReport(boxId, clientReportId);
  if (existing !== null) return { kind: 'duplicate', hostId: existing };
  if (!(await boxHasRoom(boxId, bytes))) return { kind: 'full' };

  const envelopeId = crypto.randomUUID();
  const chunks = Math.ceil(bytes / ENVELOPE_CHUNK_BYTES);
  try {
    for (let idx = 0; idx < chunks; idx++) {
      const part = body.subarray(idx * ENVELOPE_CHUNK_BYTES, (idx + 1) * ENVELOPE_CHUNK_BYTES);
      await dbRun(
        'INSERT INTO sm_relay_envelope_chunks (envelope_id, idx, content) VALUES (?, ?, ?)',
        envelopeId, idx, part,
      );
    }

    for (let attempt = 0; attempt < HOST_ID_ATTEMPTS; attempt++) {
      const hostId = newHostId();
      try {
        const { changes } = await dbRun(
          `INSERT INTO sm_relay_envelopes
             (envelope_id, box_id, host_id, client_report_id, origin, bytes, chunks, received_at)
           SELECT ?, ?, ?, ?, ?, ?, ?, ?
           WHERE (SELECT COUNT(*) FROM sm_relay_envelopes WHERE box_id = ?) < ?
             AND (SELECT COALESCE(SUM(bytes), 0) FROM sm_relay_envelopes WHERE box_id = ?) + ? <= ?`,
          envelopeId, boxId, hostId, clientReportId, origin, bytes, chunks, now,
          boxId, MAX_BOX_ENVELOPES, boxId, bytes, MAX_BOX_BYTES,
        );
        if (changes === 0) {
          await deleteChunks(envelopeId);
          return { kind: 'full' };
        }
        await dbRun('UPDATE sm_relay_boxes SET last_received_at = ? WHERE box_id = ?', now, boxId);
        return { kind: 'created', envelopeId, hostId };
      } catch (err) {
        if (isClientReportCollision(err)) {
          await deleteChunks(envelopeId);
          const winner = await findByClientReport(boxId, clientReportId);
          if (winner === null) throw err;
          return { kind: 'duplicate', hostId: winner };
        }
        if (!isHostIdCollision(err)) throw err;
      }
    }
    throw new Error(`sm-relay: no free host id after ${HOST_ID_ATTEMPTS} attempts`);
  } catch (err) {
    await deleteChunks(envelopeId);
    throw err;
  }
}

/** At most `limit` envelopes of the box, oldest first. */
export async function listEnvelopes(boxId: string, limit: number): Promise<EnvelopeListRow[]> {
  const rows = await dbAll<EnvelopeDbRow>(
    `SELECT envelope_id, host_id, client_report_id, received_at, origin, bytes
     FROM sm_relay_envelopes WHERE box_id = ?
     ORDER BY received_at, envelope_id LIMIT ?`,
    boxId, Math.max(0, Math.floor(limit)),
  );
  return rows.map((r) => ({
    envelopeId: r.envelope_id,
    hostId: r.host_id,
    clientReportId: r.client_report_id,
    receivedAt: Number(r.received_at),
    origin: r.origin,
    bytes: Number(r.bytes),
  }));
}

/** The exact stored bytes, or null when the envelope is not in this box. */
export async function readEnvelope(boxId: string, envelopeId: string): Promise<Buffer | null> {
  const row = await dbGet<{ bytes: number }>(
    'SELECT bytes FROM sm_relay_envelopes WHERE box_id = ? AND envelope_id = ?',
    boxId, envelopeId,
  );
  if (!row) return null;
  const parts = await dbAll<{ idx: number; content: unknown }>(
    'SELECT idx, content FROM sm_relay_envelope_chunks WHERE envelope_id = ? ORDER BY idx',
    envelopeId,
  );
  const content = Buffer.concat(
    parts
      .filter((p) => p.content != null)
      .sort((a, b) => Number(a.idx) - Number(b.idx))
      .map((p) => blobToBuffer(p.content)),
  );
  if (content.length !== Number(row.bytes)) return null;
  return content;
}

/** True once: removes the envelope row and its chunks. */
export async function deleteEnvelope(boxId: string, envelopeId: string): Promise<boolean> {
  const { changes } = await dbRun(
    'DELETE FROM sm_relay_envelopes WHERE box_id = ? AND envelope_id = ?',
    boxId, envelopeId,
  );
  if (changes === 0) return false;
  await deleteChunks(envelopeId);
  return true;
}

/** Removes every box of the device with its envelopes and chunks; returns the box count. */
export async function deleteBoxesForDevice(deviceId: string): Promise<number> {
  await dbRun(
    `DELETE FROM sm_relay_envelope_chunks
     WHERE envelope_id IN (
       SELECT e.envelope_id FROM sm_relay_envelopes e
       JOIN sm_relay_boxes b ON b.box_id = e.box_id
       WHERE b.device_id = ?
     )`,
    deviceId,
  );
  await dbRun(
    'DELETE FROM sm_relay_envelopes WHERE box_id IN (SELECT box_id FROM sm_relay_boxes WHERE device_id = ?)',
    deviceId,
  );
  const { changes } = await dbRun('DELETE FROM sm_relay_boxes WHERE device_id = ?', deviceId);
  return changes;
}

/** Removes envelopes (and their chunks) received before now - ttlMs; returns the count. */
export async function purgeExpiredEnvelopes(now: number, ttlMs: number = ENVELOPE_TTL_MS): Promise<number> {
  const cutoff = now - ttlMs;
  await dbRun(
    `DELETE FROM sm_relay_envelope_chunks
     WHERE envelope_id IN (SELECT envelope_id FROM sm_relay_envelopes WHERE received_at < ?)`,
    cutoff,
  );
  const { changes } = await dbRun('DELETE FROM sm_relay_envelopes WHERE received_at < ?', cutoff);
  return changes;
}
