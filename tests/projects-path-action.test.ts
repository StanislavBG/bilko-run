import { describe, it, expect } from 'vitest';
import { projectsPathAction } from '../src/lib/projectPaths.js';
import type { Project } from '../src/data/projectsRegistry.js';

// Routing guard for the /projects/<slug>/ <-> /products/<slug>/ loop: the SPA
// only renders a static-path project's own path when its bundle is missing, so
// that path must end on a terminal page instead of bouncing to /products.
const base = { name: 'X', tagline: '', category: 'Game', status: 'postponed', year: 2026 } as const;
const PROJECTS: Project[] = [
  { ...base, slug: 'game-academy', host: { kind: 'static-path', path: '/projects/game-academy/' } } as Project,
  { ...base, slug: 'ext', host: { kind: 'external-url', url: 'https://example.com/' } } as Project,
  { ...base, slug: 'session-manager', host: { kind: 'react-route', path: '/products/session-manager' } },
];

describe('projectsPathAction', () => {
  it('static-path root reached by the SPA renders the unpublished page, never a redirect', () => {
    for (const path of ['/projects/game-academy/', '/projects/game-academy/index.html', '/projects/game-academy/deep/x']) {
      const a = projectsPathAction(path, PROJECTS);
      expect(a.kind).toBe('unpublished');
    }
  });

  it('static-path without trailing slash hops once to the canonical path', () => {
    expect(projectsPathAction('/projects/game-academy', PROJECTS)).toEqual({ kind: 'hard-navigate', to: '/projects/game-academy/' });
  });

  it('external-url goes straight to its URL', () => {
    expect(projectsPathAction('/projects/ext', PROJECTS)).toEqual({ kind: 'hard-navigate', to: 'https://example.com/' });
  });

  it('react-route and unknown slugs canonicalize to /products', () => {
    expect(projectsPathAction('/projects/session-manager/manual', PROJECTS)).toEqual({ kind: 'navigate', to: '/products/session-manager/manual' });
    expect(projectsPathAction('/projects/nope', PROJECTS)).toEqual({ kind: 'navigate', to: '/products/nope' });
  });
});
