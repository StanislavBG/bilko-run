import { existsSync } from 'fs';
import { resolve } from 'path';

export type ProjectNotFound =
  | { kind: 'sibling-404'; file: string }
  | { kind: 'plain' }
  | { kind: 'page'; slug: string; published: boolean };

const DEEP_PATH = /^\/projects\/([a-z0-9-]+)\/(.+)$/;

/**
 * Classifies an unserved path deeper than a /projects/<slug>/ root.
 * Returns null when the path is not under /projects/<slug>/<something>
 * (roots, index.html, odd slugs and non-project paths keep their old behavior).
 */
export function projectNotFound(path: string, distPath: string): ProjectNotFound | null {
  const clean = path.split('?')[0];
  const m = DEEP_PATH.exec(clean);
  if (!m) return null;
  const [, slug, rest] = m;
  if (rest === 'index.html') return null;

  const dir = resolve(distPath, 'projects', slug);
  const published = existsSync(resolve(dir, 'index.html'));
  if (published) {
    const file = resolve(dir, '404.html');
    if (existsSync(file)) return { kind: 'sibling-404', file };
  }
  const last = rest.split('/').filter(Boolean).pop() ?? '';
  if (/\.[a-z0-9]{1,8}$/i.test(last)) return { kind: 'plain' };
  return { kind: 'page', slug, published };
}
