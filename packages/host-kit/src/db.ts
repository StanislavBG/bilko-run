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

/** Bilko-DB client for one app. Every call needs a signed-in user (401 signed_out otherwise). */
export function bilkoDb(app: string): BilkoDbClient {
  const base = `${HOST}/api/db/${encodeURIComponent(app)}`;
  const docUrl = (key: string) => `${base}/docs/${encodeURIComponent(key)}`;
  const imageUrl = (id: string) => `${base}/images/${encodeURIComponent(id)}`;

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
      const r = await call(docUrl(key), { method: 'DELETE', headers });
      if (r.status === 404) return false;
      if (!r.ok) throw await toError(r);
      return true;
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
      async remove(id) {
        const r = await call(imageUrl(id), { method: 'DELETE' });
        if (r.status === 404) return false;
        if (!r.ok) throw await toError(r);
        return true;
      },
      url: imageUrl,
    },
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
 * String values are stored as text, everything else as JSON.
 */
export function useDoc<T = unknown>(app: string, key: string): DocState<T> {
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
        const d = await bilkoDb(app).get<T>(key);
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
  }, [app, key]);

  const save = useCallback(async (value: T): Promise<boolean> => {
    const v = versionRef.current;
    try {
      const meta = await bilkoDb(app).put(key, value, {
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
  }, [app, key]);

  const remove = useCallback(async (): Promise<boolean> => {
    const v = versionRef.current;
    try {
      await bilkoDb(app).remove(key, v === null ? {} : { ifVersion: v });
      versionRef.current = null;
      setDoc({ value: null, version: null });
      setError(null);
      return true;
    } catch (e) {
      setError(asError(e));
      return false;
    }
  }, [app, key]);

  return { ...doc, loading, error, save, remove };
}
