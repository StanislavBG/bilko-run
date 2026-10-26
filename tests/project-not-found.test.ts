import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { projectNotFound } from '../server/project-not-found';

let dist: string;

beforeAll(() => {
  dist = mkdtempSync(join(tmpdir(), 'pnf-'));
  mkdirSync(join(dist, 'projects', 'academy'), { recursive: true });
  writeFileSync(join(dist, 'projects', 'academy', 'index.html'), '<html></html>');
  mkdirSync(join(dist, 'projects', 'custom'), { recursive: true });
  writeFileSync(join(dist, 'projects', 'custom', 'index.html'), '<html></html>');
  writeFileSync(join(dist, 'projects', 'custom', '404.html'), '<h1>nope</h1>');
  mkdirSync(join(dist, 'projects', 'draft'), { recursive: true });
});

afterAll(() => rmSync(dist, { recursive: true, force: true }));

describe('projectNotFound', () => {
  it('published deep page path -> page, published', () => {
    expect(projectNotFound('/projects/academy/does-not-exist', dist)).toEqual({
      kind: 'page', slug: 'academy', published: true,
    });
  });

  it('published bundle with 404.html -> sibling-404', () => {
    expect(projectNotFound('/projects/custom/missing/page', dist)).toEqual({
      kind: 'sibling-404', file: resolve(dist, 'projects', 'custom', '404.html'),
    });
  });

  it('asset path -> plain', () => {
    expect(projectNotFound('/projects/academy/assets/x.js', dist)).toEqual({ kind: 'plain' });
  });

  it('ignores the query string', () => {
    expect(projectNotFound('/projects/academy/assets/x.js?v=1', dist)).toEqual({ kind: 'plain' });
  });

  it('unpublished slug deep path -> page, unpublished', () => {
    expect(projectNotFound('/projects/draft/foo', dist)).toEqual({
      kind: 'page', slug: 'draft', published: false,
    });
  });

  it('unknown slug -> page, unpublished', () => {
    expect(projectNotFound('/projects/nope/foo', dist)).toEqual({
      kind: 'page', slug: 'nope', published: false,
    });
  });

  it('roots and index.html -> null', () => {
    expect(projectNotFound('/projects/academy/', dist)).toBeNull();
    expect(projectNotFound('/projects/academy/index.html', dist)).toBeNull();
  });

  it('non-project paths -> null', () => {
    expect(projectNotFound('/blog/x', dist)).toBeNull();
    expect(projectNotFound('/projects', dist)).toBeNull();
  });

  it('uppercase or dotted slug -> null', () => {
    expect(projectNotFound('/projects/Academy/foo', dist)).toBeNull();
    expect(projectNotFound('/projects/aca.demy/foo', dist)).toBeNull();
  });
});
