// Decides whether an owner-uploaded card media file may be stored: only when a
// registry entry's listing points at exactly /projects/<slug>/_media/<file>.
// The deployed registry is checked first; then the registry on GitHub main, so
// bytes can land seconds after the owner's MCP pushes the registry instead of
// after a deploy. The GitHub URL is a fixed constant — nothing from the request
// is ever put into it.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CardMediaField } from '../../shared/listing-media.js';

type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;
type RegistryEntry = Record<string, unknown>;

export interface ListingMediaDeclaredDeps {
  fetch?: FetchFn;
  deployed?: RegistryEntry[];
}

export const GITHUB_REGISTRY_URL =
  'https://api.github.com/repos/StanislavBG/bilko-run/contents/src/data/standalone-projects.json?ref=main';
const GITHUB_TIMEOUT_MS = 10_000;
const GITHUB_CACHE_MS = 30_000;

const SLUG_RE = /^[a-z0-9-]+$/;
const FILE_RE = /^[0-9a-f]{64}\.(png|mp4|webm)$/;
const FIELDS: readonly CardMediaField[] = ['icon', 'shareImage', 'video'];

let deployedRegistry: RegistryEntry[] | undefined;

/** Raw deployed registry array, read once at first use (same lookup as og-meta). */
function loadDeployed(): RegistryEntry[] {
  if (deployedRegistry) return deployedRegistry;
  const rel = 'src/data/standalone-projects.json';
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [resolve(process.cwd(), rel), resolve(here, '..', '..', rel), resolve(here, '..', rel)];
  const found = candidates.find((p) => existsSync(p));
  if (!found) {
    console.error(`[listing-media] deployed registry not found; tried ${candidates.join(', ')}`);
    return [];
  }
  const raw = JSON.parse(readFileSync(found, 'utf-8')) as unknown;
  deployedRegistry = Array.isArray(raw) ? (raw as RegistryEntry[]) : [];
  return deployedRegistry;
}

// Cache per fetch function so injected fetches (tests) never share results.
const githubCache = new WeakMap<FetchFn, { at: number; entries: Promise<RegistryEntry[] | null> }>();

async function fetchGithubRegistry(fetchFn: FetchFn): Promise<RegistryEntry[] | null> {
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
    return Array.isArray(raw) ? (raw as RegistryEntry[]) : null;
  } catch {
    return null;
  }
}

/** GitHub main registry, cached at most 30 s. A failure is not cached and reads as null. */
function githubRegistry(fetchFn: FetchFn): Promise<RegistryEntry[] | null> {
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

function fieldIn(entries: RegistryEntry[], slug: string, path: string): CardMediaField | undefined {
  const entry = entries.find((e) => e && typeof e === 'object' && e.slug === slug);
  const listing = entry?.listing;
  if (!listing || typeof listing !== 'object') return undefined;
  const l = listing as Record<string, unknown>;
  return FIELDS.find((f) => l[f] === path);
}

const defaultFetch: FetchFn = (url, init) => globalThis.fetch(url, init);

export async function isListingMediaDeclared(
  slug: string,
  file: string,
  deps: ListingMediaDeclaredDeps = {},
): Promise<CardMediaField | undefined> {
  if (!SLUG_RE.test(slug) || !FILE_RE.test(file)) return undefined;
  const path = `/projects/${slug}/_media/${file}`;
  const deployed = fieldIn(deps.deployed ?? loadDeployed(), slug, path);
  if (deployed) return deployed;
  const remote = await githubRegistry(deps.fetch ?? defaultFetch);
  return remote ? fieldIn(remote, slug, path) : undefined;
}
