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
