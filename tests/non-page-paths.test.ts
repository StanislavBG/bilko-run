import { describe, it, expect } from 'vitest';
import { isProbePath, isNonPagePath } from '../server/non-page-paths.js';

const PROBES = [
  '/.env', '/.env.production', '/.git/HEAD', '/.git/config', '/.aws/credentials',
  '/.docker/config.json', '/.dev.vars', '/.pypirc',
  '/wp-config.php', '/index.PHP', '/wp-config.php.bak', '/wp-config.php.old', '/wp-config.php.save',
  '/default.asp', '/default.aspx', '/login.jsp', '/cgi-bin/test.cgi', '/site.bak', '/backup.old',
  '/file.save', '/dump.sql', '/php.ini', '/prod.env',
  '/config.json', '/api/config.yml', '/config.yaml', '/secrets.json', '/credentials',
  '/credentials.json', '/docker-compose.yml',
  '/wp-config.php?x=1', '/WP-CONFIG.PHP',
];

const NOT_PROBES = [
  '/', '/book', '/projects/git-viewer/', '/blog/some-post', '/.well-known/security.txt',
  '/products/session-manager', '/demos/page-roast', '/manual/getting-started',
];

// Every literal route in src/App.tsx, with :params and * replaced by dot-free samples.
const SPA_ROUTES = [
  '/content-tools', '/', '/projects', '/products', '/products/sample', '/sample', '/projects/sample',
  '/games', '/studio', '/packages', '/workflows', '/blog', '/blog/some-post', '/pricing', '/privacy',
  '/terms', '/admin', '/admin/cost', '/admin/sessions', '/admin/sessions/abc123', '/admin/secrets',
  '/academy', '/academy/sample', '/contact', '/book', '/bilko', '/hire', '/human-for-hire', '/forum',
  '/forum/new', '/forum/t/42', '/work/42', '/manual', '/manual/getting-started',
  '/products/session-manager', '/products/session-manager/manual', '/admin/observability',
  '/admin/observability/preview', '/app', '/app/sample', '/projects/git-viewer/',
];

const ASSETS = ['/assets/index-CITjUwYq.js', '/early-adopters.html', '/favicon.ico', '/foo.txt'];

describe('isProbePath', () => {
  it.each(PROBES)('flags %s', (p) => expect(isProbePath(p)).toBe(true));
  it.each(NOT_PROBES)('does not flag %s', (p) => expect(isProbePath(p)).toBe(false));
  it('ignores hash', () => expect(isProbePath('/wp-config.php#a')).toBe(true));
  it('does not flag plain assets', () => {
    for (const p of ASSETS) expect(isProbePath(p)).toBe(false);
  });
  it('treats empty and non-string input as false without throwing', () => {
    for (const v of ['', undefined, null, 42, {}, []]) expect(isProbePath(v as unknown as string)).toBe(false);
  });
});

describe('isNonPagePath', () => {
  it.each(PROBES)('is true for probe %s', (p) => expect(isNonPagePath(p)).toBe(true));
  it.each(ASSETS)('is true for file %s', (p) => expect(isNonPagePath(p)).toBe(true));
  it.each(SPA_ROUTES)('is false for SPA route %s', (p) => expect(isNonPagePath(p)).toBe(false));
  it('ignores query strings on pages', () => expect(isNonPagePath('/blog/some-post?ref=x.y')).toBe(false));
  it('treats empty and non-string input as false without throwing', () => {
    for (const v of ['', undefined, null, 42, {}, []]) expect(isNonPagePath(v as unknown as string)).toBe(false);
  });
});
