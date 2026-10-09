import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const SLUG_RE = /^[a-z0-9-]+$/;

/** Slugs of subdirectories of `root` that match the slug shape and contain an index.html. Never throws. */
export function scanBlogVideos(root: string): Set<string> {
  const slugs = new Set<string>();
  try {
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      if (!entry.isDirectory() || !SLUG_RE.test(entry.name)) continue;
      if (existsSync(join(root, entry.name, 'index.html'))) slugs.add(entry.name);
    }
  } catch {
    return new Set();
  }
  return slugs;
}

export function blogVideoUrl(slug: string, slugs: Set<string>): string | null {
  return slugs.has(slug) ? `/blog-videos/${slug}/` : null;
}
