import type { FastifyInstance } from 'fastify';
import type { Project } from '../src/data/projectsRegistry.js';

const SELF_HOSTS = new Set(['bilko.run', 'www.bilko.run']);

/**
 * True when `url` lands on bilko.run itself. Such targets are host pages with
 * their own routes (e.g. human-for-hire -> /book, whose /projects/<slug> paths
 * bilko-profile-routes.ts already 301s) or the SPA; registering a redirect here
 * would collide with those routes (FST_ERR_DUPLICATED_ROUTE at boot) or loop.
 */
function pointsAtSelf(url: string): boolean {
  try {
    return SELF_HOSTS.has(new URL(url).hostname);
  } catch {
    // Not an absolute URL: it would resolve against bilko.run itself.
    return true;
  }
}

/**
 * 302 /projects/<slug>, /projects/<slug>/ and /projects/<slug>/index.html to
 * host.url for every external-url registry entry. Once such a slug has a
 * media-only folder under dist/projects/<slug>/, @fastify/static
 * (redirect: true) would 301 the bare path to the slash form and then 404;
 * these explicit routes outrank the static wildcard, so visitors and crawlers
 * go straight to the app while other files under the slug (card media) keep
 * being served. Targets come from the schema-validated registry, never the
 * request, so this is not an open redirect.
 */
export function registerExternalProjectRedirects(
  app: FastifyInstance,
  projects: readonly Project[],
): void {
  for (const p of projects) {
    if (p.host.kind !== 'external-url') continue;
    const target = p.host.url;
    if (pointsAtSelf(target)) continue;
    const base = `/projects/${p.slug}`;
    for (const path of [base, `${base}/`, `${base}/index.html`]) {
      app.get(path, async (_req, reply) =>
        reply.code(302).header('location', target).header('cache-control', 'public, max-age=300').send(),
      );
    }
  }
}
