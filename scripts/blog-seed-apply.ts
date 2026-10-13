/**
 * Deterministic file writes for scripts/blog-seed.sh (blog-from-git phase 7, "seed").
 *
 *   pnpm tsx scripts/blog-seed-apply.ts --bundle <abs_dir> --root <repo_root> [--now <ISO>]
 *
 * Reads <bundle>/post.md (+ images/), writes content/blog/<slug>.md in the loader's format
 * (server/blog-posts.ts), copies images to public/blog-images/<slug>/, and updates
 * blog-ledger.md. Prints one JSON line on stdout: {"slug","published_at","paths":[...]}.
 * Exit 0 ok, 2 bad bundle. It never touches git.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSON_SCHEMA, load as loadYaml } from 'js-yaml';

const FENCE = /^---[ \t]*$/;
const LEDGER_REL = '.claude/skills/blog-from-git/blog-ledger.md';

export interface BundlePost {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  publishedAt: string | null;
  project: string | null;
  tone: string | null;
  body: string;
}

export class BundleError extends Error {}

export function parseBundlePost(raw: string): BundlePost {
  const lines = raw.replace(/^﻿/, '').split(/\r?\n/);
  if (!FENCE.test(lines[0] ?? '')) throw new BundleError('post.md has no opening --- fence');
  const close = lines.findIndex((l, i) => i > 0 && FENCE.test(l));
  if (close === -1) throw new BundleError('post.md frontmatter is not closed with ---');
  let data: Record<string, unknown>;
  try {
    data = (loadYaml(lines.slice(1, close).join('\n'), { schema: JSON_SCHEMA }) ?? {}) as Record<string, unknown>;
  } catch (err) {
    throw new BundleError(`invalid YAML frontmatter: ${(err as Error).message}`);
  }
  const str = (k: string): string | null => {
    const v = data[k];
    return typeof v === 'string' && v.trim() ? v.trim() : null;
  };
  for (const key of ['slug', 'title', 'excerpt', 'category']) {
    if (!str(key)) throw new BundleError(`post.md frontmatter is missing '${key}'`);
  }
  const slug = str('slug')!;
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) throw new BundleError(`slug '${slug}' must be lowercase letters, digits and -`);
  const publishedAt = str('published_at');
  if (publishedAt && Number.isNaN(new Date(publishedAt).getTime())) {
    throw new BundleError(`published_at '${publishedAt}' is not a valid date`);
  }
  // Body is kept verbatim (human edits preserved); only the blank lines right after the fence go.
  const body = lines.slice(close + 1).join('\n').replace(/^\n+/, '');
  if (!body.trim()) throw new BundleError('post.md has no body');
  return {
    slug,
    title: str('title')!,
    excerpt: str('excerpt')!,
    category: str('category')!,
    publishedAt: publishedAt ? new Date(publishedAt).toISOString() : null,
    project: str('project'),
    tone: str('tone'),
    body,
  };
}

export function buildPostFile(post: BundlePost, publishedAt: string, order: number): string {
  const q = (s: string) => JSON.stringify(s); // JSON strings are valid double-quoted YAML
  return [
    '---',
    `slug: ${q(post.slug)}`,
    `title: ${q(post.title)}`,
    `excerpt: ${q(post.excerpt)}`,
    `category: ${q(post.category)}`,
    'published: true',
    `published_at: ${q(publishedAt)}`,
    `order: ${order}`,
    '---',
    '',
    post.body.endsWith('\n') ? post.body : `${post.body}\n`,
  ].join('\n');
}

function recentProjects(ledger: string, n: number): string[] {
  const out: string[] = [];
  let inTable = false;
  for (const line of ledger.split('\n')) {
    if (/^\|[-| ]+\|\s*$/.test(line)) { inTable = true; continue; }
    if (!inTable) continue;
    if (!line.startsWith('|')) break;
    const project = (line.split('|')[3] ?? '').trim().replace(/\s*\(.*$/, '');
    if (project) out.push(project);
    if (out.length === n) break;
  }
  return out;
}

export function updateLedger(
  ledger: string,
  entry: { date: string; slug: string; project: string; onTile: boolean; tone: string },
): string {
  const lines = ledger.split('\n');
  const sep = lines.findIndex((l) => /^\|[-| ]+\|\s*$/.test(l));
  if (sep === -1) throw new Error('blog-ledger.md: rotation table separator not found');
  const row = `| ${entry.date} | ${entry.slug} | ${entry.project} | ${entry.onTile ? '✅' : '❌ no tile'} | ${entry.tone} |`;
  lines.splice(sep + 1, 0, row);
  let text = lines.join('\n');

  const last = new RegExp('^- \\*\\*Last project covered:\\*\\*[^\\n]*\\n(?:[ ]{2}[^\\n]*\\n)*', 'm');
  const cool = new RegExp('^- \\*\\*Cooling off[^\\n]*\\n(?:[ ]{2}[^\\n]*\\n)*', 'm');
  if (!last.test(text) || !cool.test(text)) throw new Error('blog-ledger.md: rotation-state block not found');
  const tile = entry.onTile ? 'on-list, ✅ tile' : 'off-list, no tile';
  text = text.replace(
    last,
    () => `- **Last project covered:** ${entry.project} (${tile}), post \`${entry.slug}\` seeded ${entry.date} by scripts/blog-seed.sh.\n`,
  );
  text = text.replace(
    cool,
    () => `- **Cooling off (last 3 ledger rows — ineligible as next primary subject):** ${recentProjects(text, 3).join(', ')}.\n`,
  );
  return text;
}

function maxOrder(blogDir: string): number {
  let max = 0;
  for (const f of readdirSync(blogDir)) {
    if (!f.endsWith('.md')) continue;
    const m = /^order:\s*(-?\d+(?:\.\d+)?)\s*$/m.exec(readFileSync(path.join(blogDir, f), 'utf-8').split(/^---[ \t]*$/m)[1] ?? '');
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max;
}

function onTile(root: string, slug: string): boolean {
  try {
    const reg = JSON.parse(readFileSync(path.join(root, 'src/data/standalone-projects.json'), 'utf-8')) as Array<{ slug: string }>;
    return reg.some((p) => p.slug === slug);
  } catch {
    return false;
  }
}

export function applyBundle(bundle: string, root: string, now: Date): { slug: string; published_at: string; paths: string[] } {
  const postFile = path.join(bundle, 'post.md');
  if (!existsSync(postFile)) throw new BundleError(`${postFile} not found`);
  const post = parseBundlePost(readFileSync(postFile, 'utf-8'));
  const blogDir = path.join(root, 'content/blog');
  const target = path.join(blogDir, `${post.slug}.md`);
  if (existsSync(target)) throw new BundleError(`content/blog/${post.slug}.md already exists`);
  const publishedAt = post.publishedAt ?? now.toISOString();

  mkdirSync(blogDir, { recursive: true });
  writeFileSync(target, buildPostFile(post, publishedAt, maxOrder(blogDir) + 1));
  const paths = [`content/blog/${post.slug}.md`];

  const imagesIn = path.join(bundle, 'images');
  if (existsSync(imagesIn) && readdirSync(imagesIn).length > 0) {
    const imagesOut = path.join(root, 'public/blog-images', post.slug);
    mkdirSync(imagesOut, { recursive: true });
    for (const f of readdirSync(imagesIn)) copyFileSync(path.join(imagesIn, f), path.join(imagesOut, f));
    paths.push(`public/blog-images/${post.slug}/`);
  }

  const ledgerPath = path.join(root, LEDGER_REL);
  writeFileSync(
    ledgerPath,
    updateLedger(readFileSync(ledgerPath, 'utf-8'), {
      date: publishedAt.slice(0, 10),
      slug: post.slug,
      project: post.project ?? post.slug,
      onTile: onTile(root, post.project ?? post.slug),
      tone: post.tone ?? 'unspecified (burrow)',
    }),
  );
  paths.push(LEDGER_REL);
  return { slug: post.slug, published_at: publishedAt, paths };
}

function main(): void {
  const args = process.argv.slice(2);
  const get = (k: string) => (args.includes(k) ? args[args.indexOf(k) + 1] : undefined);
  const bundle = get('--bundle');
  const root = get('--root');
  if (!bundle || !root) {
    console.error('usage: blog-seed-apply.ts --bundle <abs_dir> --root <repo_root> [--now <ISO>]');
    process.exit(2);
  }
  try {
    console.log(JSON.stringify(applyBundle(bundle, root, get('--now') ? new Date(get('--now')!) : new Date())));
  } catch (err) {
    console.error(`blog-seed-apply: ${(err as Error).message}`);
    process.exit(err instanceof BundleError ? 2 : 1);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
