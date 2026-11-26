// Decides whether an owner-uploaded card media file may be stored: only when a
// registry entry's listing points at exactly /projects/<slug>/_media/<file>.
// The registry snapshot (server/registry-runtime.ts) is checked first: a
// listing change written through the registry API refreshes it, so bytes can
// land as soon as the declaration does.
// Fallback: the registry file on GitHub main, for media declared by a bilko-host
// MCP process started before it wrote through the registry API. The registry-file
// retirement plan removes it. The URL is a fixed constant; nothing from the request goes in it.
import type { CardMediaField } from '../../shared/listing-media.js';
import { getRegistrySnapshot } from '../registry-runtime.js';

type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

export interface ListingMediaDeclaredDeps {
  /** Registry entries to check instead of the live snapshot (tests). */
  registry?: readonly unknown[];
  /** Fetch used for the GitHub-main fallback (tests). */
  fetch?: FetchFn;
}

export const GITHUB_REGISTRY_URL =
  'https://api.github.com/repos/StanislavBG/bilko-run/contents/src/data/standalone-projects.json?ref=main';
const GITHUB_TIMEOUT_MS = 10_000;
const GITHUB_CACHE_MS = 30_000;

const SLUG_RE = /^[a-z0-9-]+$/;
const FILE_RE = /^[0-9a-f]{64}\.(png|mp4|webm)$/;
const FIELDS: readonly CardMediaField[] = ['icon', 'shareImage', 'video'];

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function fieldIn(entries: readonly unknown[], slug: string, path: string): CardMediaField | undefined {
  const entry = entries.find((e) => isRecord(e) && e.slug === slug);
  const listing = isRecord(entry) ? entry.listing : undefined;
  if (!isRecord(listing)) return undefined;
  return FIELDS.find((f) => listing[f] === path);
}

async function fetchGithubRegistry(fetchFn: FetchFn): Promise<readonly unknown[] | null> {
  try {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.raw+json',
      'User-Agent': 'bilko-run',
    };
    const token = process.env.GITHUB_TOKEN;
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetchFn(GITHUB_REGISTRY_URL, { headers, signal: AbortSignal.timeout(GITHUB_TIMEOUT_MS) });
    if (!res.ok) return null;
    const raw = (await res.json()) as unknown;
    return Array.isArray(raw) ? raw : null;
  } catch {
    return null;
  }
}

// Cache per fetch function so injected fetches (tests) never share results.
const githubCache = new WeakMap<FetchFn, { at: number; entries: Promise<readonly unknown[] | null> }>();

/** GitHub main registry, cached at most 30 s. A failure is not cached and reads as null. */
function githubRegistry(fetchFn: FetchFn): Promise<readonly unknown[] | null> {
  const now = Date.now();
  const hit = githubCache.get(fetchFn);
  if (hit && now - hit.at < GITHUB_CACHE_MS) return hit.entries;
  const entries = fetchGithubRegistry(fetchFn);
  githubCache.set(fetchFn, { at: now, entries });
  void entries.then((e) => {
    if (e === null && githubCache.get(fetchFn)?.entries === entries) githubCache.delete(fetchFn);
  });
  return entries;
}

const defaultFetch: FetchFn = (url, init) => globalThis.fetch(url, init);

export async function isListingMediaDeclared(
  slug: string,
  file: string,
  deps: ListingMediaDeclaredDeps = {},
): Promise<CardMediaField | undefined> {
  if (!SLUG_RE.test(slug) || !FILE_RE.test(file)) return undefined;
  const path = `/projects/${slug}/_media/${file}`;
  const local = fieldIn(deps.registry ?? getRegistrySnapshot(), slug, path);
  if (local) return local;
  const remote = await githubRegistry(deps.fetch ?? defaultFetch);
  return remote ? fieldIn(remote, slug, path) : undefined;
}
