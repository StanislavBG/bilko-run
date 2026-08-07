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
  url: string;
  filename: string;
  bytes: number;
  expiresInSeconds: number;
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

/**
 * Mints a short-lived signed URL and hands it back. The caller navigates to it;
 * the URL carries its own token so no auth header is needed on the download.
 */
export async function requestManualDownload(
  assetId: string,
  getToken: TokenGetter,
  opts: ClientOptions = {},
): Promise<{ ok: true; download: ManualDownload } | { ok: false; error: string }> {
  const f = opts.fetchImpl ?? fetch;
  try {
    const res = await f(`${API}/manual/download-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeaders(getToken)) },
      body: JSON.stringify({ assetId }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.url) {
      return { ok: false, error: data?.error ?? 'Download failed. Please try again.' };
    }
    return { ok: true, download: data as ManualDownload };
  } catch {
    return { ok: false, error: 'Network error — please try again.' };
  }
}
