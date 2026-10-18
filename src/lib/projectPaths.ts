import type { Project } from '../data/projectsRegistry.js';

/**
 * What the SPA should do when it is asked to render a /projects/* path.
 *
 * Fastify serves every published static-path bundle (and 301s the no-slash
 * form) before the SPA sees the request, so the SPA only renders a static-path
 * project's own path when that bundle is NOT published. Redirecting to
 * /products/<slug> from there loops: MaybeStandaloneRedirect hard-navigates
 * straight back to the static path. Such paths must end on a terminal page.
 */
export type ProjectsPathAction =
  | { kind: 'navigate'; to: string }
  | { kind: 'hard-navigate'; to: string }
  | { kind: 'unpublished'; project: Project };

export function projectsPathAction(pathname: string, projects: readonly Project[]): ProjectsPathAction {
  const slug = pathname.split('/')[2] ?? '';
  const project = projects.find(p => p.slug === slug);
  if (project?.host.kind === 'external-url') return { kind: 'hard-navigate', to: project.host.url };
  if (project?.host.kind === 'static-path') {
    const root = project.host.path;
    // Already at (or under) the static path and still in the SPA → no bundle.
    if (pathname.startsWith(root)) {
      return { kind: 'unpublished', project };
    }
    // /projects/<slug> without the slash: the server 301s published bundles,
    // so this is dev or an unpublished bundle — one hop to the canonical path.
    return { kind: 'hard-navigate', to: root };
  }
  return { kind: 'navigate', to: pathname.replace(/^\/projects/, '/products') };
}
