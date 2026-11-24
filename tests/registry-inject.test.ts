// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { dbRun, initDb } from '../server/db.js';
import { putProject } from '../server/services/registry-db.js';
import { refreshRegistry, getRegistrySnapshot } from '../server/registry-runtime.js';
import { registerSecurityHeaders } from '../server/security-headers.js';
import { registerRegistryInject, registryElement } from '../server/registry-inject.js';
import { registerProjectsHubRoutes } from '../server/projects-hub.js';
import standaloneJson from '../src/data/standalone-projects.json' with { type: 'json' };

const SHELL =
  '<!DOCTYPE html><html><head><title>bilko</title></head><body>' +
  '<div id="root"><!--bilko-prerender--><!--/bilko-prerender--></div>' +
  '<script type="module" src="/src/main.tsx"></script></body></html>';
const APP_PAGE = '<!DOCTYPE html><html><head></head><body><div id="root"></div><script src="app.js"></script></body></html>';

function entry(slug: string, extra: Record<string, unknown> = {}) {
  return {
    slug,
    name: slug.toUpperCase(),
    tagline: `${slug} tagline`,
    category: 'Test',
    status: 'live',
    year: 2026,
    host: { kind: 'static-path', path: `/projects/${slug}/` },
    ...extra,
  };
}

function extractRegistry(html: string): unknown {
  const m = html.match(/<script type="application\/json" id="bilko-registry">([\s\S]*?)<\/script>/);
  expect(m, 'registry element present').not.toBeNull();
  return JSON.parse(m![1]);
}

let app: FastifyInstance;
beforeAll(async () => {
  await initDb();
  await dbRun('DELETE FROM bilko_db_projects');
  await dbRun('DELETE FROM bilko_db_project_log');
  await putProject(entry('alpha'), 'test');
  await refreshRegistry();
  app = Fastify();
  registerSecurityHeaders(app);
  registerRegistryInject(app);
  registerProjectsHubRoutes(app, SHELL);
  app.get('/projects/alpha/', async (_req, reply) => reply.type('text/html').send(APP_PAGE));
  app.get('/projects/alpha/levels/1.html', async (_req, reply) => reply.type('text/html').send(SHELL));
  app.get('/api/thing', async () => ({ ok: true }));
  app.get('/stripe-page', async (_req, reply) => reply.type('text/html').send('<html><body>Paid</body></html>'));
  app.setNotFoundHandler(async (_req, reply) => reply.type('text/html').send(SHELL));
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

describe('registry element on SPA shells', () => {
  it('the SPA fallback carries the current snapshot', async () => {
    const res = await app.inject({ method: 'GET', url: '/about?x=1' });
    expect(res.statusCode).toBe(200);
    const data = extractRegistry(res.body) as { slug: string }[];
    expect(data.map((p) => p.slug)).toEqual(getRegistrySnapshot().map((p) => p.slug));
    expect(data.map((p) => p.slug)).toContain('alpha');
    // Placed inside the body, before it closes.
    expect(res.body.indexOf('id="bilko-registry"')).toBeLessThan(res.body.indexOf('</body>'));
    expect(res.body.match(/id="bilko-registry"/g)).toHaveLength(1);
  });

  it('the /projects hub carries it', async () => {
    const res = await app.inject({ method: 'GET', url: '/projects' });
    expect((extractRegistry(res.body) as { slug: string }[]).map((p) => p.slug)).toContain('alpha');
  });

  it('follows registry changes without re-registering', async () => {
    await putProject(entry('beta'), 'test');
    await refreshRegistry();
    const res = await app.inject({ method: 'GET', url: '/' });
    expect((extractRegistry(res.body) as { slug: string }[]).map((p) => p.slug)).toContain('beta');
  });

  it('static-path app pages under /projects/<slug>/ do not get it', async () => {
    for (const url of ['/projects/alpha/', '/projects/alpha/levels/1.html']) {
      const res = await app.inject({ method: 'GET', url });
      expect(res.body, url).not.toContain('bilko-registry');
    }
  });

  it('non-shell HTML and JSON responses do not get it', async () => {
    expect((await app.inject({ method: 'GET', url: '/stripe-page' })).body).not.toContain('bilko-registry');
    expect((await app.inject({ method: 'GET', url: '/api/thing' })).body).not.toContain('bilko-registry');
  });
});

describe('HTML escaping', () => {
  it('escapes < so a value cannot close the script element', () => {
    const evil = entry('evil', { tagline: '</script><script>alert(1)</script><!--' });
    const el = registryElement([evil as never]);
    const inner = el.slice(el.indexOf('>') + 1, el.lastIndexOf('</script>'));
    expect(inner).not.toContain('<');
    expect(inner).toContain('\\u003c/script>');
    expect((JSON.parse(inner) as { tagline: string }[])[0].tagline).toBe(evil.tagline);
  });

  it('parses back to the same value in a jsdom document', () => {
    const evil = entry('evil', { tagline: '</script><b>x</b>' });
    document.body.innerHTML = registryElement([evil as never]);
    const text = document.getElementById('bilko-registry')!.textContent!;
    expect((JSON.parse(text) as { tagline: string }[])[0].tagline).toBe(evil.tagline);
  });
});

describe('src/data/projectsRegistry.ts', () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = '';
  });

  it('builds PROJECTS from the injected element when present', async () => {
    document.body.innerHTML =
      registryElement([entry('injected-one') as never, entry('session-manager') as never]) + '<div id="root"></div>';
    const mod = await import('../src/data/projectsRegistry.js');
    expect(mod.PROJECTS.map((p) => p.slug)).toEqual(['injected-one', 'session-manager']);
    // SPA_ROUTE_OVERRIDES still apply to injected entries.
    expect(mod.PROJECTS[1].host).toEqual({ kind: 'react-route', path: '/products/session-manager' });
  });

  it('falls back to the bundled JSON when the element is absent', async () => {
    const mod = await import('../src/data/projectsRegistry.js');
    expect(mod.PROJECTS.map((p) => p.slug)).toEqual((standaloneJson as { slug: string }[]).map((p) => p.slug));
  });

  it('falls back to the bundled JSON when the element is not a JSON array', async () => {
    document.body.innerHTML = '<script type="application/json" id="bilko-registry">{not json</script>';
    const mod = await import('../src/data/projectsRegistry.js');
    expect(mod.PROJECTS.length).toBe((standaloneJson as unknown[]).length);
  });
});
