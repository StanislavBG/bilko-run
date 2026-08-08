/**
 * Browser client for the paid Session Manager Field Manual.
 *
 * Every authed call takes a Clerk `getToken` rather than reading auth state
 * itself, so this module stays testable with a plain stub and has no React
 * or Clerk import. See server/routes/manual.ts for the route contract.
 */

import { API } from '../data/api.js';
import type { ManualToc } from '../../shared/manual-catalog.js';

export type TokenGetter = () => Promise<string | null>;

export interface ManualStatus {
  email: string;
  entitled: boolean;
  published: boolean;
  priceLabel: string;
  toc: ManualToc | null;
}

export interface ManualChapterBody {
  version: string;
  slug: string;
  title: string;
  html: string;
}

/** A paid chapter the caller isn't entitled to — the paywall, not an error. */
export interface ManualChapterLocked {
  locked: true;
  signedIn: boolean;
  priceLabel: string;
  title: string;
  blurb: string;
}

export interface ManualDownload {
  filename: string;
  bytes: number;
}

interface ClientOptions {
  fetchImpl?: typeof fetch;
}

async function authHeaders(getToken: TokenGetter): Promise<Record<string, string>> {
  const token = await getToken().catch(() => null);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Public table of contents — safe to render to anonymous visitors. */
export async function fetchManualToc(
  opts: ClientOptions = {},
): Promise<{ priceLabel: string; toc: ManualToc } | null> {
  const f = opts.fetchImpl ?? fetch;
  try {
    const res = await f(`${API}/manual/toc`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** Signed-in view: entitlement + the same toc. Null when not signed in. */
export async function fetchManualStatus(
  getToken: TokenGetter,
  opts: ClientOptions = {},
): Promise<ManualStatus | null> {
  const f = opts.fetchImpl ?? fetch;
  try {
    const res = await f(`${API}/manual/status`, { headers: await authHeaders(getToken) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchManualChapter(
  slug: string,
  getToken: TokenGetter,
  opts: ClientOptions = {},
): Promise<ManualChapterBody | ManualChapterLocked | null> {
  const f = opts.fetchImpl ?? fetch;
  try {
    const res = await f(`${API}/manual/chapter/${encodeURIComponent(slug)}`, {
      headers: await authHeaders(getToken),
    });
    const data = await res.json().catch(() => null);
    // 402 is the paywall and carries a usable body — don't collapse it to null.
    if (res.status === 402 && data?.locked) return data as ManualChapterLocked;
    if (!res.ok) return null;
    return data as ManualChapterBody;
  } catch {
    return null;
  }
}

/** Injectable so tests don't need a DOM; defaults to a real anchor click. */
export interface SaveBlobFn {
  (blob: Blob, filename: string): void;
}

const defaultSaveBlob: SaveBlobFn = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Release the object URL on the next tick — revoking synchronously can race
  // the browser's own read of the blob in some engines.
  setTimeout(() => URL.revokeObjectURL(url), 0);
};

/**
 * Downloads a manual asset and saves it to disk.
 *
 * Fetches WITH the Clerk bearer header rather than navigating the browser at a
 * signed URL. That's why the server needs no download token and no signing
 * secret: entitlement is re-checked server-side on this very request, against
 * the persisted purchase row. Assets are a few hundred KB, so buffering one in
 * memory is not a concern.
 */
export async function downloadManualAsset(
  assetId: string,
  getToken: TokenGetter,
  opts: ClientOptions & { saveBlob?: SaveBlobFn } = {},
): Promise<{ ok: true; download: ManualDownload } | { ok: false; error: string }> {
  const f = opts.fetchImpl ?? fetch;
  const save = opts.saveBlob ?? defaultSaveBlob;
  try {
    const res = await f(`${API}/manual/download/${encodeURIComponent(assetId)}`, {
      headers: await authHeaders(getToken),
    });

    if (!res.ok) {
      // The error body is JSON even though a success is binary.
      const data = await res.json().catch(() => null);
      return { ok: false, error: data?.error ?? 'Download failed. Please try again.' };
    }

    const blob = await res.blob();
    const filename = filenameFromDisposition(res.headers.get('content-disposition')) ?? assetId;
    save(blob, filename);
    return { ok: true, download: { filename, bytes: blob.size } };
  } catch {
    return { ok: false, error: 'Network error — please try again.' };
  }
}

/** Pulls `filename="..."` out of a Content-Disposition header, if present. */
export function filenameFromDisposition(header: string | null): string | null {
  if (!header) return null;
  const match = /filename="([^"]+)"/.exec(header);
  return match ? match[1] : null;
}
