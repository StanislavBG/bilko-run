/**
 * Loader for blog seed posts: one markdown file per post under `content/blog/`,
 * YAML frontmatter between `---` fences, markdown body after the closing fence.
 */

import { existsSync, readFileSync, readdirSync } from 'fs';
import { resolve, join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { load as loadYaml, JSON_SCHEMA } from 'js-yaml';
import { z } from 'zod';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface SeedBlogPost {
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  category: string;
  published: boolean;
  published_at: string | null;
  order: number;
}

const frontmatterSchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  excerpt: z.string().min(1),
  category: z.string().min(1),
  published: z.boolean(),
  published_at: z.string().min(1).nullable(),
  order: z.number().finite(),
});

/** Same candidate shape as server/services/manual.ts: tsx vs dist-server. */
function blogRoot(): string {
  const candidates = [
    resolve(process.cwd(), 'content', 'blog'),
    resolve(__dirname, '..', 'content', 'blog'),
    resolve(__dirname, '..', '..', 'content', 'blog'),
  ];
  return candidates.find(existsSync) ?? candidates[0];
}

const FENCE = /^---[ \t]*$/;

function splitFrontmatter(raw: string, file: string): { yaml: string; body: string } {
  const lines = raw.replace(/^﻿/, '').split(/\r?\n/);
  if (!FENCE.test(lines[0] ?? '')) {
    throw new Error(`${file}: missing opening '---' frontmatter fence`);
  }
  const close = lines.findIndex((l, i) => i > 0 && FENCE.test(l));
  if (close === -1) {
    throw new Error(`${file}: missing closing '---' frontmatter fence`);
  }
  return {
    yaml: lines.slice(1, close).join('\n'),
    body: lines.slice(close + 1).join('\n').replace(/^\n+/, ''),
  };
}

function parsePost(file: string, raw: string): SeedBlogPost {
  const { yaml, body } = splitFrontmatter(raw, file);
  let data: unknown;
  try {
    // JSON_SCHEMA keeps unquoted dates as strings instead of Date objects.
    data = loadYaml(yaml, { schema: JSON_SCHEMA });
  } catch (err) {
    throw new Error(`${file}: invalid YAML frontmatter: ${(err as Error).message}`);
  }
  const parsed = frontmatterSchema.safeParse(data ?? {});
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(`${file}: invalid field '${issue.path.join('.') || '(root)'}': ${issue.message}`);
  }
  if (!body.trim()) throw new Error(`${file}: empty body`);
  return { ...parsed.data, content: body };
}

export function loadBlogPosts(dir: string = blogRoot()): SeedBlogPost[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter(f => f.endsWith('.md'))
    .sort()
    .map(f => parsePost(f, readFileSync(join(dir, f), 'utf8')))
    .sort((a, b) => a.order - b.order);
}
