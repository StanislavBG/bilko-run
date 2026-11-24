import type { FastifyInstance } from 'fastify';
import { getRegistrySnapshot } from './registry-runtime.js';

const SELF_HOSTS = new Set(['bilko.run', 'www.bilko.run']);
const PROJECT_ROOT_RE = /^\/projects\/([^/]+)(?:\/|\/index\.html)?$/;

/** The registry fields a redirect needs; fits both registry entries and hub projects. */
export interface RedirectProject {
  slug: string;
  host: { kind: string; url?: string };
}

/**
 * True when `url` lands on bilko.run itself. Such targets are host pages with
 * their own routes (e.g. human-for-hire -> /book, whose /projects/<slug> paths
 * bilko-profile-routes.ts already 301s) or the SPA; redirecting here would
 * shadow those routes or loop.
 */
function pointsAtSelf(url: string): boolean {
  try {
    return SELF_HOSTS.has(new URL(url).hostname);
  } catch {
    // Not an absolute URL: it would resolve against bilko.run itself.
    return true;
  }
}

/** host.url when `slug` is an external-url entry pointing off bilko.run, else null. */
export function externalTarget(projects: readonly RedirectProject[], slug: string): string | null {
  const p = projects.find((x) => x.slug === slug);
  if (!p || p.host.kind !== 'external-url' || typeof p.host.url !== 'string') return null;
  return pointsAtSelf(p.host.url) ? null : p.host.url;
}

/**
 * 302 GET/HEAD /projects/<slug>, /projects/<slug>/ and /projects/<slug>/index.html
 * to host.url for every external-url registry entry. Once such a slug has a
 * media-only folder under dist/projects/<slug>/, @fastify/static
 * (redirect: true) would 301 the bare path to the slash form and then 404;
 * this onRequest hook answers first, so visitors and crawlers go straight to
 * the app while other files under the slug (card media) keep being served.
 * The target is looked up in the current registry on each request (default:
 * getRegistrySnapshot()), so a new or removed external-url slug takes effect
 * without a restart. Targets come from the schema-validated registry, never
 * the request, so this is not an open redirect.
 */
export function registerExternalProjectRedirects(
  app: FastifyInstance,
  projects: readonly RedirectProject[] | (() => readonly RedirectProject[]) = getRegistrySnapshot,
): void {
  const current = typeof projects === 'function' ? projects : () => projects;
  app.addHook('onRequest', async (req, reply) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return;
    const path = req.url.split('?')[0];
    const m = PROJECT_ROOT_RE.exec(path);
    if (!m) return;
    const target = externalTarget(current(), m[1]);
    if (!target) return;
    return reply.code(302).header('location', target).header('cache-control', 'public, max-age=300').send();
  });
}
