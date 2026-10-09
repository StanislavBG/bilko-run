import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { loadBlogPosts } from '../server/blog-posts.js';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'blog-posts-'));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function post(
  file: string,
  over: Record<string, string | null> = {},
  body = 'Hello body.\n',
): void {
  const fields: Record<string, string | null> = {
    slug: file.replace(/\.md$/, ''),
    title: 'A Title',
    excerpt: 'An excerpt.',
    category: 'build-log',
    published: 'true',
    published_at: '2026-01-02',
    order: '1',
    ...over,
  };
  const fm = Object.entries(fields)
    .filter(([, v]) => v !== null)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');
  writeFileSync(join(dir, file), `---\n${fm}\n---\n\n${body}`);
}

describe('loadBlogPosts', () => {
  it('parses a valid post', () => {
    post('one.md');
    expect(loadBlogPosts(dir)).toEqual([
      {
        slug: 'one',
        title: 'A Title',
        excerpt: 'An excerpt.',
        content: 'Hello body.\n',
        category: 'build-log',
        published: true,
        published_at: '2026-01-02',
        order: 1,
      },
    ]);
  });

  it('sorts by order', () => {
    post('a.md', { order: '3' });
    post('b.md', { order: '1' });
    post('c.md', { order: '2' });
    expect(loadBlogPosts(dir).map(p => p.slug)).toEqual(['b', 'c', 'a']);
  });

  it('names the file and field when a required field is missing', () => {
    post('bad.md', { title: null });
    expect(() => loadBlogPosts(dir)).toThrow(/bad\.md.*title/);
  });

  it('handles titles with colons and quotes', () => {
    post('q.md', { title: `'Ship it: the "real" story'` });
    expect(loadBlogPosts(dir)[0].title).toBe('Ship it: the "real" story');
  });

  it('keeps later --- lines in the body', () => {
    post('hr.md', {}, 'Top\n\n---\n\nBottom\n');
    expect(loadBlogPosts(dir)[0].content).toBe('Top\n\n---\n\nBottom\n');
  });

  it('ignores non-.md files', () => {
    post('ok.md');
    writeFileSync(join(dir, 'notes.txt'), 'not a post');
    writeFileSync(join(dir, 'broken.json'), '{');
    expect(loadBlogPosts(dir).map(p => p.slug)).toEqual(['ok']);
  });
});
