// @vitest-environment node
import Fastify from 'fastify';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { registerProjectCatalogRoutes } from '../server/routes/project-catalog.js';
import { PUBLIC_CARDS, HUB_CARDS } from '../src/data/projectsView.js';

const app = Fastify();

beforeAll(async () => {
  registerProjectCatalogRoutes(app);
  await app.ready();
});
afterAll(() => app.close());

const FIELDS = ['slug', 'name', 'tagline', 'category', 'status', 'url', 'tags', 'detail', 'audience', 'talking_points'].sort();
const NON_PUBLIC = HUB_CARDS.filter(c => c.type === 'project' && !c.isPublic).map(c => c.slug);

async function mcp(body: object) {
  const res = await app.inject({
    method: 'POST',
    url: '/mcp',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    payload: { jsonrpc: '2.0', id: 1, ...body },
  });
  expect(res.statusCode).toBe(200);
  expect(res.headers['content-type']).toContain('application/json');
  return res.json();
}

describe('GET /api/projects', () => {
  it('returns exactly the public /projects cards, in page order, with the v1 field set', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/projects' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['cache-control']).toBe('public, max-age=300');
    const body = res.json();
    expect(body.schema_version).toBe(1);
    expect(new Date(body.generated_at).toISOString()).toBe(body.generated_at);
    expect(body.projects.map((p: { slug: string }) => p.slug)).toEqual(PUBLIC_CARDS.map(c => c.slug));
    for (const p of body.projects) {
      expect(Object.keys(p).sort()).toEqual(FIELDS);
      for (const k of ['slug', 'name', 'tagline', 'status']) expect(p[k]).toBeTruthy();
      expect(p.url).toMatch(/^https:\/\//);
      expect(typeof p.detail).toBe('string');
      expect(typeof p.audience).toBe('string');
      expect(Array.isArray(p.talking_points)).toBe(true);
      expect(Array.isArray(p.tags)).toBe(true);
    }
  });

  it('never lists a non-public registry project', async () => {
    expect(NON_PUBLIC.length).toBeGreaterThan(0);
    const slugs = new Set(((await app.inject({ method: 'GET', url: '/api/projects' })).json().projects as { slug: string }[]).map(p => p.slug));
    for (const s of NON_PUBLIC) expect(slugs.has(s)).toBe(false);
  });

  it('links each card to the same destination the /projects page does', async () => {
    const byslug = new Map(((await app.inject({ method: 'GET', url: '/api/projects' })).json().projects as { slug: string; url: string }[]).map(p => [p.slug, p.url]));
    for (const c of PUBLIC_CARDS) {
      const href = c.href!;
      expect(byslug.get(c.slug)).toBe(href.startsWith('/') ? `https://bilko.run${href}` : href);
    }
  });
});

describe('public MCP at /mcp', () => {
  it('exposes only the two read-only tools', async () => {
    const res = await mcp({ method: 'tools/list', params: {} });
    const tools = res.result.tools as { name: string; annotations?: { readOnlyHint?: boolean } }[];
    expect(tools.map(t => t.name).sort()).toEqual(['get_project', 'list_projects']);
    for (const t of tools) expect(t.annotations?.readOnlyHint).toBe(true);
  });

  it('list_projects returns the same public slugs as the JSON route', async () => {
    const res = await mcp({ method: 'tools/call', params: { name: 'list_projects', arguments: {} } });
    const data = JSON.parse(res.result.content[0].text);
    expect(data.schema_version).toBe(1);
    expect(data.projects.map((p: { slug: string }) => p.slug)).toEqual(PUBLIC_CARDS.map(c => c.slug));
  });

  it('get_project returns a public project and not-found for a non-public slug', async () => {
    const slug = PUBLIC_CARDS[0].slug;
    const ok = await mcp({ method: 'tools/call', params: { name: 'get_project', arguments: { slug } } });
    expect(JSON.parse(ok.result.content[0].text).slug).toBe(slug);

    const miss = await mcp({ method: 'tools/call', params: { name: 'get_project', arguments: { slug: NON_PUBLIC[0] } } });
    expect(miss.result.isError).toBe(true);
    expect(miss.result.content[0].text).toContain('not found');
  });

  it('rejects GET (no server-initiated streams in stateless mode)', async () => {
    const res = await app.inject({ method: 'GET', url: '/mcp' });
    expect(res.statusCode).toBe(405);
  });
});
