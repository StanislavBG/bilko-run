import { describe, it, expect, vi } from 'vitest';
import { SlugSchema } from '../mcp-host-server/src/contract/registry.js';
import {
  APP_BACKEND_SLUG_RE,
  buildUpstreamUrl,
  forwardRequestHeaders,
  matchAppBackend,
  parseAppBackends,
  type AppBackend,
} from '../server/app-backends/config.js';

const demo: AppBackend = { slug: 'demo-app', origin: 'https://demo.example.com', prefix: '/projects/demo-app/api/' };
const local: AppBackend = { slug: 'other-app', origin: 'http://127.0.0.1:4100', prefix: '/projects/other-app/api/' };

describe('parseAppBackends', () => {
  it('returns [] for empty input', () => {
    for (const raw of [undefined, '', '   ', ' , ,']) {
      const warn = vi.fn();
      expect(parseAppBackends(raw, warn)).toEqual([]);
      expect(warn).not.toHaveBeenCalled();
    }
  });

  it('parses entries in env order, origin without trailing slash', () => {
    const warn = vi.fn();
    expect(parseAppBackends('demo-app=https://demo.example.com, other-app=https://other.example.com/', warn)).toEqual([
      { slug: 'demo-app', origin: 'https://demo.example.com', prefix: '/projects/demo-app/api/' },
      { slug: 'other-app', origin: 'https://other.example.com', prefix: '/projects/other-app/api/' },
    ]);
    expect(warn).not.toHaveBeenCalled();
  });

  it('accepts http only for loopback hosts', () => {
    const warn = vi.fn();
    const got = parseAppBackends(
      'a1=http://localhost:3000,a2=http://127.0.0.1:4100/,a3=http://[::1]:5000',
      warn,
    );
    expect(got.map((b) => b.origin)).toEqual(['http://localhost:3000', 'http://127.0.0.1:4100', 'http://[::1]:5000']);
    expect(warn).not.toHaveBeenCalled();
  });

  it.each([
    ['no equals sign', 'demo-app'],
    ['bad slug', 'Demo_App=https://demo.example.com'],
    ['leading hyphen slug', '-demo=https://demo.example.com'],
    ['one-char slug', 'a=https://demo.example.com'],
    ['unparseable origin', 'demo-app=not a url'],
    ['http non-loopback', 'demo-app=http://demo.example.com'],
    ['non-http scheme', 'demo-app=ftp://demo.example.com'],
    ['credentials', 'demo-app=https://user:s3cretpw@demo.example.com'],
    ['username only', 'demo-app=https://user@demo.example.com'],
    ['path', 'demo-app=https://demo.example.com/base'],
    ['query', 'demo-app=https://demo.example.com/?x=1'],
    ['hash', 'demo-app=https://demo.example.com/#frag'],
  ])('skips %s with one warning that never echoes the entry', (_label, entry) => {
    const warn = vi.fn();
    expect(parseAppBackends(`${entry},other-app=https://other.example.com`, warn)).toEqual([
      { slug: 'other-app', origin: 'https://other.example.com', prefix: '/projects/other-app/api/' },
    ]);
    expect(warn).toHaveBeenCalledTimes(1);
    const msg = String(warn.mock.calls[0][0]);
    expect(msg).toMatch(/^\[app-backends\] APP_BACKENDS entry 1 ignored: /);
    expect(msg).not.toContain(entry);
    expect(msg).not.toContain('s3cretpw');
    const origin = entry.split('=')[1];
    if (origin) expect(msg).not.toContain(origin);
  });

  it('keeps the first of duplicate slugs', () => {
    const warn = vi.fn();
    expect(parseAppBackends('demo-app=https://one.example.com,demo-app=https://two.example.com', warn)).toEqual([
      { slug: 'demo-app', origin: 'https://one.example.com', prefix: '/projects/demo-app/api/' },
    ]);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toMatch(/entry 2 ignored: .*demo-app/);
    expect(warn.mock.calls[0][0]).not.toContain('two.example.com');
  });

  it('uses console.warn by default', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(parseAppBackends('nope')).toEqual([]);
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});

describe('APP_BACKEND_SLUG_RE parity with SlugSchema', () => {
  const samples = [
    'demo-app', 'ab', 'a1', '00', 'a'.repeat(40), 'a'.repeat(41), 'a', '', '-ab', 'ab-', 'a--b',
    'Demo', 'de_mo', 'de.mo', 'de mo', 'demo/app', 'a'.repeat(39) + '-', 'other-app',
  ];
  it.each(samples)('agrees on %j', (s) => {
    expect(APP_BACKEND_SLUG_RE.test(s)).toBe(SlugSchema.safeParse(s).success);
  });
});

describe('matchAppBackend', () => {
  const backends = [demo, local];
  it('matches the exact prefix and keeps the query in rest', () => {
    expect(matchAppBackend(backends, '/projects/demo-app/api/items/1?x=2')).toEqual({ backend: demo, rest: 'items/1?x=2' });
    expect(matchAppBackend(backends, '/projects/other-app/api/')).toEqual({ backend: local, rest: '' });
  });
  it('returns null otherwise', () => {
    for (const u of [
      '/projects/demo-app/api',
      '/projects/demo-app/apix/y',
      '/projects/demo-app/',
      '/projects/demo-apps/api/x',
      '/projects/unknown/api/x',
      '/PROJECTS/demo-app/api/x',
      '/api/x',
      '',
    ]) {
      expect(matchAppBackend(backends, u)).toBeNull();
    }
    expect(matchAppBackend([], '/projects/demo-app/api/x')).toBeNull();
  });
});

describe('buildUpstreamUrl', () => {
  it('builds <origin>/api/<rest> keeping the query', () => {
    expect(buildUpstreamUrl(demo, 'items/1?x=2&y=3', 'http')?.href).toBe('https://demo.example.com/api/items/1?x=2&y=3');
    expect(buildUpstreamUrl(demo, '', 'http')?.href).toBe('https://demo.example.com/api/');
  });
  it('uses wss for https and ws for http origins', () => {
    expect(buildUpstreamUrl(demo, 'socket?room=1', 'ws')?.href).toBe('wss://demo.example.com/api/socket?room=1');
    expect(buildUpstreamUrl(local, 'socket', 'ws')?.href).toBe('ws://127.0.0.1:4100/api/socket');
  });
  it.each([
    '../x',
    '../../x',
    '%2e%2e/x',
    '%2E%2E/x',
    '.%2e/x',
    '..\\x',
    '\\..\\x',
    'a/../../x',
    '/\\evil.example.com/x',
    '//evil.example.com/x',
  ])('refuses %j', (rest) => {
    const u = buildUpstreamUrl(demo, rest, 'http');
    if (u !== null) {
      // Only acceptable non-null results stay on the origin under /api/.
      expect(u.origin).toBe(demo.origin);
      expect(u.pathname.startsWith('/api/')).toBe(true);
    }
  });
  it('returns null for traversal out of /api/', () => {
    for (const rest of ['../x', '%2e%2e/x', '..\\x', 'a/../../x', '.%2e/x']) {
      expect(buildUpstreamUrl(demo, rest, 'http')).toBeNull();
    }
  });
  it('keeps a path that stays inside /api/', () => {
    expect(buildUpstreamUrl(demo, 'a/../b', 'http')?.href).toBe('https://demo.example.com/api/b');
  });
});

describe('forwardRequestHeaders', () => {
  it('copies only allowlisted headers and never cookie or host', () => {
    const out = forwardRequestHeaders(
      {
        authorization: 'Bearer t',
        'content-type': 'application/json',
        accept: 'application/json',
        origin: 'https://bilko.run',
        'user-agent': 'ua/1',
        'if-none-match': '"abc"',
        'if-modified-since': 'Mon, 01 Jan 2026 00:00:00 GMT',
        cookie: '__session=secret',
        host: 'bilko.run',
        'content-length': '12',
        'accept-encoding': 'gzip',
        'x-custom': 'nope',
        connection: 'keep-alive',
      },
      '10.0.0.5',
    );
    expect(out).toEqual({
      authorization: 'Bearer t',
      'content-type': 'application/json',
      accept: 'application/json',
      origin: 'https://bilko.run',
      'user-agent': 'ua/1',
      'if-none-match': '"abc"',
      'if-modified-since': 'Mon, 01 Jan 2026 00:00:00 GMT',
      'x-forwarded-for': '10.0.0.5',
      'x-forwarded-proto': 'http',
      'x-forwarded-host': 'bilko.run',
    });
  });

  it('appends the peer to x-forwarded-for and takes first proto/host values', () => {
    const out = forwardRequestHeaders(
      {
        host: 'internal:3000',
        'x-forwarded-for': ['1.1.1.1', '2.2.2.2'] as unknown as string,
        'x-forwarded-proto': 'https, http',
        'x-forwarded-host': 'bilko.run, other',
      },
      '10.0.0.5',
    );
    expect(out['x-forwarded-for']).toBe('1.1.1.1, 2.2.2.2, 10.0.0.5');
    expect(out['x-forwarded-proto']).toBe('https');
    expect(out['x-forwarded-host']).toBe('bilko.run');
  });

  it('handles a string x-forwarded-for and a missing peer', () => {
    const out = forwardRequestHeaders({ 'x-forwarded-for': '1.1.1.1', host: 'bilko.run' }, undefined);
    expect(out['x-forwarded-for']).toBe('1.1.1.1');
    expect(forwardRequestHeaders({}, undefined)['x-forwarded-for']).toBeUndefined();
    expect(forwardRequestHeaders({}, undefined)['x-forwarded-host']).toBeUndefined();
    expect(forwardRequestHeaders({}, undefined)['cookie']).toBeUndefined();
  });

  it('uses the first entry of an array-valued header', () => {
    const out = forwardRequestHeaders({ 'if-match': ['"a"', '"b"'] as unknown as string }, '::1');
    expect(out['if-match']).toBe('"a"');
    expect(out['x-forwarded-for']).toBe('::1');
  });
});
