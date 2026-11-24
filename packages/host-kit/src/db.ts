import { useCallback, useEffect, useRef, useState } from 'react';
import { authFetch } from './auth.js';

/**
 * Bilko-DB client: a signed-in user's documents (JSON or text) and images for one app,
 * on the host's /api/db/:app API. Versions are plain HTTP: GET returns ETag "<version>",
 * writes send If-Match. See bilko-run docs/host-contract.md → Bilko-DB.
 */

const HOST = 'https://bilko.run';

/** A failed Bilko-DB call. `code` is the API's `error` field (e.g. `version_mismatch`). */
export class BilkoDbError extends Error {
  readonly status: number;
  readonly code: string;
  /** The stored version, when the API reports one (version_mismatch). */
  readonly version?: number;

  constructor(status: number, code: string, version?: number) {
    super(`Bilko-DB ${status} ${code}`);
    this.name = 'BilkoDbError';
    this.status = status;
    this.code = code;
    if (version !== undefined) this.version = version;
  }
}

export interface BilkoDocMeta {
  key: string;
  type: 'json' | 'text';
  bytes: number;
  version: number;
  updatedAt: string;
}

export interface BilkoDoc<T = unknown> {
  value: T;
  version: number;
  type: 'json' | 'text';
}

export interface BilkoPutOptions {
  /** Send the value as text/plain (value must be a string). */
  text?: boolean;
  /** Only write if the stored version is this one (If-Match). */
  ifVersion?: number;
  /** Only write if the document does not exist yet (If-None-Match: *). */
  createOnly?: boolean;
}

export interface BilkoRemoveOptions {
  /** Only delete if the stored version is this one (If-Match). */
  ifVersion?: number;
}

export interface BilkoImage {
  id: string;
  /** Absolute public link, usable in a plain <img>. */
  url: string;
  type: string;
  bytes: number;
  createdAt: string;
}

export interface BilkoDbClient {
  list(prefix?: string): Promise<BilkoDocMeta[]>;
  /** The document, or null when it does not exist. */
  get<T = unknown>(key: string): Promise<BilkoDoc<T> | null>;
  put(key: string, value: unknown, opts?: BilkoPutOptions): Promise<BilkoDocMeta>;
  /** True when deleted, false when it did not exist. */
  remove(key: string, opts?: BilkoRemoveOptions): Promise<boolean>;
  images: {
    upload(blob: Blob): Promise<BilkoImage>;
    list(): Promise<BilkoImage[]>;
    remove(id: string): Promise<boolean>;
    url(id: string): string;
  };
}

async function toError(r: Response): Promise<BilkoDbError> {
  let code = `http_${r.status}`;
  let version: number | undefined;
  try {
    const j = (await r.json()) as { error?: unknown; version?: unknown };
    if (typeof j.error === 'string') code = j.error;
    if (typeof j.version === 'number') version = j.version;
  } catch {
    // Non-JSON error body: keep the http_<status> code.
  }
  return new BilkoDbError(r.status, code, version);
}

function versionHeader(v: number): string {
  return `"${v}"`;
}

function parseEtag(h: string | null): number {
  const m = h ? /(\d+)/.exec(h) : null;
  return m ? Number(m[1]) : 0;
}

async function call(url: string, init?: RequestInit): Promise<Response> {
  const r = await authFetch(url, init);
  if (!r) throw new BilkoDbError(401, 'signed_out');
  return r;
}

async function ok(url: string, init?: RequestInit): Promise<Response> {
  const r = await call(url, init);
  if (!r.ok) throw await toError(r);
  return r;
}

/** DELETE that resolves false on 404 and throws BilkoDbError on any other failure. */
async function del(url: string, init?: RequestInit): Promise<boolean> {
  const r = await call(url, { ...init, method: 'DELETE' });
  if (r.status === 404) return false;
  if (!r.ok) throw await toError(r);
  return true;
}

const appBase = (app: string) => `${HOST}/api/db/${encodeURIComponent(app)}`;

export interface BilkoDbOptions {
  /** Use the app's team storage (/team/docs, /team/images) instead of the user's own. */
  team?: boolean;
}

/**
 * Bilko-DB client for one app. Every call needs a signed-in user (401 signed_out otherwise).
 * `{ team: true }` reads and writes the app's shared team storage (403 not_member for outsiders);
 * image links stay public at /api/db/<app>/images/<id> either way.
 */
export function bilkoDb(app: string, opts?: BilkoDbOptions): BilkoDbClient {
  const publicBase = appBase(app);
  const base = `${publicBase}${opts?.team ? '/team' : ''}`;
  const docUrl = (key: string) => `${base}/docs/${encodeURIComponent(key)}`;
  const imageUrl = (id: string) => `${publicBase}/images/${encodeURIComponent(id)}`;

  const absImage = (img: BilkoImage): BilkoImage => ({ ...img, url: imageUrl(img.id) });

  return {
    async list(prefix) {
      const qs = prefix !== undefined ? `?prefix=${encodeURIComponent(prefix)}` : '';
      const r = await ok(`${base}/docs${qs}`);
      return ((await r.json()) as { docs: BilkoDocMeta[] }).docs;
    },

    async get<T = unknown>(key: string) {
      const r = await call(docUrl(key));
      if (r.status === 404) return null;
      if (!r.ok) throw await toError(r);
      const version = parseEtag(r.headers.get('etag'));
      const isJson = (r.headers.get('content-type') ?? '').toLowerCase().startsWith('application/json');
      const body = await r.text();
      if (isJson) return { value: JSON.parse(body) as T, version, type: 'json' as const };
      return { value: body as unknown as T, version, type: 'text' as const };
    },

    async put(key, value, opts = {}) {
      const headers: Record<string, string> = {};
      let body: string;
      if (opts.text) {
        if (typeof value !== 'string') throw new TypeError('bilkoDb.put: { text: true } needs a string value');
        headers['content-type'] = 'text/plain; charset=utf-8';
        body = value;
      } else {
        headers['content-type'] = 'application/json';
        body = JSON.stringify(value);
      }
      if (opts.ifVersion !== undefined) headers['if-match'] = versionHeader(opts.ifVersion);
      if (opts.createOnly) headers['if-none-match'] = '*';
      const r = await ok(docUrl(key), { method: 'PUT', headers, body });
      return (await r.json()) as BilkoDocMeta;
    },

    async remove(key, opts = {}) {
      const headers: Record<string, string> = {};
      if (opts.ifVersion !== undefined) headers['if-match'] = versionHeader(opts.ifVersion);
      return del(docUrl(key), { headers });
    },

    images: {
      async upload(blob) {
        const r = await ok(`${base}/images`, {
          method: 'POST',
          headers: { 'content-type': blob.type || 'application/octet-stream' },
          body: blob,
        });
        return absImage((await r.json()) as BilkoImage);
      },
      async list() {
        const r = await ok(`${base}/images`);
        return ((await r.json()) as { images: BilkoImage[] }).images.map(absImage);
      },
      remove: (id) => del(`${base}/images/${encodeURIComponent(id)}`),
      url: imageUrl,
    },
  };
}

// ── bilkoTeam ────────────────────────────────────────────────────────────────

export type BilkoTeamRole = 'owner' | 'member';

export interface BilkoTeamMember {
  email: string;
  role: BilkoTeamRole;
  addedAt: string;
}

export interface BilkoTeamView {
  app: string;
  /** The caller's role; `admin` for the site admin, who manages but is not a member. */
  role: BilkoTeamRole | 'admin';
  members: BilkoTeamMember[];
}

export interface BilkoTeamSetResult {
  email: string;
  role: BilkoTeamRole;
  /** True when the member was added, false when an existing member's role changed. */
  created: boolean;
}

export interface BilkoTeam {
  /** GET /api/db/<app>/team. */
  get(): Promise<BilkoTeamView>;
  /** PUT /api/db/<app>/team/members/<email> with { role }. Owners only. */
  set(email: string, role: BilkoTeamRole): Promise<BilkoTeamSetResult>;
  /** DELETE /api/db/<app>/team/members/<email>. True when removed, false when not on the team. */
  remove(email: string): Promise<boolean>;
}

/** Manage one app's Bilko-DB team. Failures throw BilkoDbError (not_member, last_owner, team_full, …). */
export function bilkoTeam(app: string): BilkoTeam {
  const base = `${appBase(app)}/team`;
  const memberUrl = (email: string) => `${base}/members/${encodeURIComponent(email)}`;
  return {
    async get() {
      return (await (await ok(base)).json()) as BilkoTeamView;
    },
    async set(email, role) {
      const r = await ok(memberUrl(email), {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      return (await r.json()) as BilkoTeamSetResult;
    },
    remove: (email) => del(memberUrl(email)),
  };
}

// ── useDoc ────────────────────────────────────────────────────────────────────

export interface DocState<T> {
  /** The stored value, or null when the document does not exist (or has not loaded). */
  value: T | null;
  /** The version last read or written; null when the document does not exist. */
  version: number | null;
  loading: boolean;
  /** The last failure; a lost race on save is a BilkoDbError with code `version_mismatch`. */
  error: BilkoDbError | Error | null;
  /** Saves with the version last read (If-Match), or create-only when there was none. Resolves true on success. */
  save(value: T): Promise<boolean>;
  /** Deletes with the version last read (If-Match). Resolves true on success. */
  remove(): Promise<boolean>;
}

const asError = (e: unknown): BilkoDbError | Error => (e instanceof Error ? e : new Error(String(e)));

/**
 * One Bilko-DB document as React state. Writes never overwrite blindly: save sends the
 * version it last read, so a write from another tab surfaces as a `version_mismatch` error.
 * String values are stored as text, everything else as JSON. `{ team: true }` uses the
 * app's team storage; the hook reloads when the flag changes.
 */
export function useDoc<T = unknown>(app: string, key: string, opts?: BilkoDbOptions): DocState<T> {
  const team = opts?.team === true;
  const [doc, setDoc] = useState<{ value: T | null; version: number | null }>({ value: null, version: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<BilkoDbError | Error | null>(null);
  const versionRef = useRef<number | null>(null);
  versionRef.current = doc.version;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setDoc({ value: null, version: null });
    void (async () => {
      try {
        const d = await bilkoDb(app, { team }).get<T>(key);
        if (cancelled) return;
        setDoc(d ? { value: d.value, version: d.version } : { value: null, version: null });
      } catch (e) {
        if (!cancelled) setError(asError(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [app, key, team]);

  const save = useCallback(async (value: T): Promise<boolean> => {
    const v = versionRef.current;
    try {
      const meta = await bilkoDb(app, { team }).put(key, value, {
        text: typeof value === 'string',
        ...(v === null ? { createOnly: true } : { ifVersion: v }),
      });
      versionRef.current = meta.version;
      setDoc({ value, version: meta.version });
      setError(null);
      return true;
    } catch (e) {
      setError(asError(e));
      return false;
    }
  }, [app, key, team]);

  const remove = useCallback(async (): Promise<boolean> => {
    const v = versionRef.current;
    try {
      await bilkoDb(app, { team }).remove(key, v === null ? {} : { ifVersion: v });
      versionRef.current = null;
      setDoc({ value: null, version: null });
      setError(null);
      return true;
    } catch (e) {
      setError(asError(e));
      return false;
    }
  }, [app, key, team]);

  return { ...doc, loading, error, save, remove };
}
