import { describe, it, expect, vi } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AppBackendOriginSchema, SlugSchema } from '../mcp-host-server/src/contract/registry.js';
import { loadDeployedRegistry } from '../server/app-backends/registry.js';
import {
  APP_BACKEND_SLUG_RE,
  appBackendsFromRegistry,
  resolveAppBackends,
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

const sp = (slug: string, backend?: unknown) => ({
  slug,
  host: backend === undefined ? { kind: 'static-path', path: `/projects/${slug}/` } : { kind: 'static-path', path: `/projects/${slug}/`, backend },
});

describe('appBackendsFromRegistry', () => {
  it('keeps static-path entries with an https backend and ignores entries without one', () => {
    const warn = vi.fn();
    expect(appBackendsFromRegistry([sp('demo-app', 'https://demo.example.com'), sp('plain-app'), { slug: 'x-y' }], warn)).toEqual([
      { slug: 'demo-app', origin: 'https://demo.example.com', prefix: '/projects/demo-app/api/' },
    ]);
    expect(warn).not.toHaveBeenCalled();
  });

  it.each([
    ['external-url entry', { slug: 'ext-app', host: { kind: 'external-url', url: 'https://ext.example.com', backend: 'https://secret-ext.example.com' } }, 'ext-app'],
    ['http origin', sp('ext-app', 'http://secret-plain.example.com'), 'ext-app'],
    ['http localhost', sp('ext-app', 'http://localhost:3000'), 'ext-app'],
    ['http 127.0.0.1', sp('ext-app', 'http://127.0.0.1:4100'), 'ext-app'],
    ['http [::1]', sp('ext-app', 'http://[::1]:5000'), 'ext-app'],
    ['credentials', sp('ext-app', 'https://user:s3cretpw@secret-cred.example.com'), 'ext-app'],
    ['path', sp('ext-app', 'https://secret-path.example.com/base'), 'ext-app'],
    ['non-string backend', sp('ext-app', 42), 'ext-app'],
    ['too long', sp('ext-app', `https://${'a'.repeat(200)}.example.com`), 'ext-app'],
    ['bad slug', sp('Bad_Slug', 'https://secret-slug.example.com'), '#1'],
  ])('skips %s with one warning that never echoes the origin', (_label, entry, label) => {
    const warn = vi.fn();
    expect(appBackendsFromRegistry([entry], warn)).toEqual([]);
    expect(warn).toHaveBeenCalledTimes(1);
    const msg = String(warn.mock.calls[0][0]);
    expect(msg.startsWith(`[app-backends] registry entry ${label} backend ignored: `)).toBe(true);
    const backend = (entry.host as { backend?: unknown }).backend;
    if (typeof backend === 'string') {
      expect(msg).not.toContain(backend);
      expect(msg).not.toContain(new URL(backend).hostname);
    }
    expect(msg).not.toContain('s3cretpw');
    expect(msg).not.toContain('secret');
  });

  it('returns [] with one warning for a non-array', () => {
    for (const input of [undefined, null, {}, 'x', 3]) {
      const warn = vi.fn();
      expect(appBackendsFromRegistry(input, warn)).toEqual([]);
      expect(warn).toHaveBeenCalledTimes(1);
    }
  });
});

describe('resolveAppBackends', () => {
  const registry = [sp('demo-app', 'https://reg-demo.example.com'), sp('other-app', 'https://reg-other.example.com')];

  it('registry only', () => {
    expect(resolveAppBackends(registry, undefined, vi.fn())).toEqual([
      { slug: 'demo-app', origin: 'https://reg-demo.example.com', prefix: '/projects/demo-app/api/', source: 'registry' },
      { slug: 'other-app', origin: 'https://reg-other.example.com', prefix: '/projects/other-app/api/', source: 'registry' },
    ]);
  });

  it('env only, loopback http still allowed there', () => {
    expect(resolveAppBackends([], 'demo-app=http://127.0.0.1:4100', vi.fn())).toEqual([
      { slug: 'demo-app', origin: 'http://127.0.0.1:4100', prefix: '/projects/demo-app/api/', source: 'env' },
    ]);
  });

  it('a valid env entry overrides the registry for its slug', () => {
    expect(resolveAppBackends(registry, 'demo-app=https://env-demo.example.com', vi.fn())).toEqual([
      { slug: 'demo-app', origin: 'https://env-demo.example.com', prefix: '/projects/demo-app/api/', source: 'env' },
      { slug: 'other-app', origin: 'https://reg-other.example.com', prefix: '/projects/other-app/api/', source: 'registry' },
    ]);
  });

  it('an invalid env entry leaves the registry backend in force', () => {
    const warn = vi.fn();
    expect(resolveAppBackends([registry[0]], 'demo-app=http://env-demo.example.com', warn)).toEqual([
      { slug: 'demo-app', origin: 'https://reg-demo.example.com', prefix: '/projects/demo-app/api/', source: 'registry' },
    ]);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('neither set gives []', () => {
    const warn = vi.fn();
    expect(resolveAppBackends([], undefined, warn)).toEqual([]);
    expect(resolveAppBackends([sp('plain-app')], '', warn)).toEqual([]);
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('AppBackendOriginSchema parity with appBackendsFromRegistry', () => {
  const origins = [
    'https://api.example.com',
    'https://api.example.com/',
    'https://API.example.com',
    'https://api.example.com:8443',
    'https://api.example.com:443',
    'http://api.example.com',
    'http://localhost:3000',
    'http://127.0.0.1:4100',
    'https://localhost:3000',
    'https://user:pw@api.example.com',
    'https://user@api.example.com',
    'https://api.example.com/base',
    'https://api.example.com/?x=1',
    'https://api.example.com/#h',
    'ftp://api.example.com',
    'wss://api.example.com',
    'not a url',
    '',
    `https://${'a'.repeat(190)}.com`,
    `https://${'a'.repeat(200)}.com`,
  ];
  it.each(origins)('agrees on %j', (origin) => {
    const kept = appBackendsFromRegistry([sp('demo-app', origin)], () => {});
    const keptUnchanged = kept.length === 1 && kept[0].origin === origin;
    expect(AppBackendOriginSchema.safeParse(origin).success).toBe(keptUnchanged);
  });
});

describe('loadDeployedRegistry', () => {
  const dir = mkdtempSync(join(tmpdir(), 'app-backends-registry-'));

  it('reads a valid file', () => {
    const file = join(dir, 'ok.json');
    writeFileSync(file, JSON.stringify([sp('demo-app', 'https://demo.example.com')]));
    const warn = vi.fn();
    expect(loadDeployedRegistry(file, warn)).toEqual([sp('demo-app', 'https://demo.example.com')]);
    expect(warn).not.toHaveBeenCalled();
  });

  it.each([
    ['missing file', 'missing.json', null],
    ['bad JSON', 'bad.json', '{not json'],
    ['non-array', 'obj.json', '{"a":1}'],
  ])('returns [] with one warning for %s', (_label, name, body) => {
    const file = join(dir, name);
    if (body !== null) writeFileSync(file, body);
    const warn = vi.fn();
    expect(loadDeployedRegistry(file, warn)).toEqual([]);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('finds the repo registry by default', () => {
    expect(Array.isArray(loadDeployedRegistry(undefined, () => {}))).toBe(true);
    expect(loadDeployedRegistry(undefined, () => {}).length).toBeGreaterThan(0);
  });
});
