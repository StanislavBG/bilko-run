import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { blogVideoUrl, scanBlogVideos } from '../server/blog-videos.js';

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'blog-videos-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function makeDir(name: string, withIndex: boolean): void {
  mkdirSync(join(root, name), { recursive: true });
  if (withIndex) writeFileSync(join(root, name, 'index.html'), '<html></html>');
}

describe('scanBlogVideos', () => {
  it('finds a valid slug dir containing index.html', () => {
    makeDir('my-post-1', true);
    expect(scanBlogVideos(root)).toEqual(new Set(['my-post-1']));
  });

  it('ignores a dir without index.html', () => {
    makeDir('no-index', false);
    expect(scanBlogVideos(root).size).toBe(0);
  });

  it('ignores dirs with uppercase or dots in the name', () => {
    makeDir('Upper-Case', true);
    makeDir('has.dot', true);
    expect(scanBlogVideos(root).size).toBe(0);
  });

  it('ignores plain files in the root', () => {
    writeFileSync(join(root, 'stray'), 'x');
    expect(scanBlogVideos(root).size).toBe(0);
  });

  it('returns an empty set when the root does not exist', () => {
    expect(scanBlogVideos(join(root, 'missing')).size).toBe(0);
  });
});

describe('blogVideoUrl', () => {
  it('returns the URL when the slug has a video', () => {
    expect(blogVideoUrl('a-post', new Set(['a-post']))).toBe('/blog-videos/a-post/');
  });

  it('returns null when it does not', () => {
    expect(blogVideoUrl('other', new Set(['a-post']))).toBeNull();
  });
});
