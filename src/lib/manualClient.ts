/**
 * Browser client for the Session Manager Field Manual — free to read and
 * download as of release 2.0.1.
 *
 * The chapter call takes a Clerk `getToken` rather than reading auth state
 * itself, so this module stays testable with a plain stub and has no React or
 * Clerk import. See server/routes/manual.ts for the route contract.
 */

import { API } from '../data/api.js';
import type { ManualToc } from '../../shared/manual-catalog.js';

export type TokenGetter = () => Promise<string | null>;

export interface ManualChapterBody {
  version: string;
  slug: string;
  title: string;
  html: string;
}

/**
 * A chapter the server withheld with a 402. Every chapter is free since 2.0.1,
 * so this only happens if a release marks one non-free again — the reader
 * shows it as unavailable, never as something to buy.
 */
export interface ManualChapterUnavailable {
  locked: true;
  title: string;
  blurb: string;
}

interface ClientOptions {
  fetchImpl?: typeof fetch;
}

/**
 * How long a chapter request waits for a sign-in token before going without.
 * Clerk's `getToken` waits for Clerk to finish loading and never rejects, so a
 * blocked, failing or slow Clerk (a privacy extension, an outage, a preview
 * origin its production keys refuse) would otherwise hold every chapter of a
 * free manual on "Loading chapter…" forever.
 */
export const TOKEN_WAIT_MS = 1500;

async function authHeaders(getToken: TokenGetter): Promise<Record<string, string>> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const token = await Promise.race([
    Promise.resolve().then(getToken).catch(() => null),
    new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), TOKEN_WAIT_MS); }),
  ]);
  clearTimeout(timer);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Public table of contents. */
export async function fetchManualToc(
  opts: ClientOptions = {},
): Promise<{ toc: ManualToc } | null> {
  const f = opts.fetchImpl ?? fetch;
  try {
    const res = await f(`${API}/manual/toc`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * One chapter's body. The bearer token is forwarded when there is one, so a
 * pre-2.0.1 buyer can still read a chapter a release marks non-free — but the
 * request never waits on sign-in for longer than TOKEN_WAIT_MS.
 */
export async function fetchManualChapter(
  slug: string,
  getToken: TokenGetter,
  opts: ClientOptions = {},
): Promise<ManualChapterBody | ManualChapterUnavailable | null> {
  const f = opts.fetchImpl ?? fetch;
  try {
    const res = await f(`${API}/manual/chapter/${encodeURIComponent(slug)}`, {
      headers: await authHeaders(getToken),
    });
    const data = await res.json().catch(() => null);
    // 402 carries the chapter's title and blurb — keep it distinct from a failure.
    if (res.status === 402 && data?.locked) return data as ManualChapterUnavailable;
    if (!res.ok) return null;
    return data as ManualChapterBody;
  } catch {
    return null;
  }
}

/**
 * Where a manual asset (PDF, offline HTML) downloads from. Downloads need no
 * account, so this is a plain link target: the server answers with
 * `Content-Disposition: attachment` and the browser saves the file.
 */
export function manualDownloadUrl(assetId: string): string {
  return `${API}/manual/download/${encodeURIComponent(assetId)}`;
}
