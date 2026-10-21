// @vitest-environment node
import Fastify from 'fastify';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { registerProjectCatalogRoutes } from '../server/routes/project-catalog.js';
import { PUBLIC_CARDS, HUB_CARDS } from '../src/data/projectsView.js';
import { PROJECTS } from '../src/data/projectsRegistry.js';

const app = Fastify();

beforeAll(async () => {
  registerProjectCatalogRoutes(app);
  await app.ready();
});
afterAll(() => app.close());

const FIELDS = ['slug', 'name', 'tagline', 'category', 'status', 'url', 'tags', 'detail', 'audience', 'talking_points', 'offering', 'pricing', 'call_to_action', 'avoid_claims', 'share_image_url', 'offers'].sort();
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
      expect(typeof p.call_to_action).toBe('string');
      expect(Array.isArray(p.avoid_claims)).toBe(true);
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
  it('exposes only the three read-only tools', async () => {
    const res = await mcp({ method: 'tools/list', params: {} });
    const tools = res.result.tools as { name: string; annotations?: { readOnlyHint?: boolean } }[];
    expect(tools.map(t => t.name).sort()).toEqual(['get_project', 'list_offers', 'list_projects']);
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
    const got = JSON.parse(ok.result.content[0].text);
    expect(got.slug).toBe(slug);
    for (const k of ['offering', 'pricing', 'call_to_action', 'avoid_claims']) expect(got).toHaveProperty(k);

    const miss = await mcp({ method: 'tools/call', params: { name: 'get_project', arguments: { slug: NON_PUBLIC[0] } } });
    expect(miss.result.isError).toBe(true);
    expect(miss.result.content[0].text).toContain('not found');
  });

  it('rejects GET (no server-initiated streams in stateless mode)', async () => {
    const res = await app.inject({ method: 'GET', url: '/mcp' });
    expect(res.statusCode).toBe(405);
  });
});

describe('marketing enums', () => {
  it('serves offering and pricing as "" or a known enum value for every public project', async () => {
    const projects = (await app.inject({ method: 'GET', url: '/api/projects' })).json().projects as
      { offering: string; pricing: string }[];
    const offerings = ['', 'saas', 'free-tool', 'showcase', 'open-source', 'game', 'content', 'experiment'];
    const pricings = ['', 'free', 'freemium', 'paid', 'none'];
    for (const p of projects) {
      expect(offerings).toContain(p.offering);
      expect(pricings).toContain(p.pricing);
    }
  });
});

describe('share_image_url', () => {
  it('is https://bilko.run/og/<slug>.png for every public project', async () => {
    const projects = (await app.inject({ method: 'GET', url: '/api/projects' })).json().projects as
      { slug: string; share_image_url: string }[];
    expect(projects.length).toBeGreaterThan(0);
    for (const p of projects) expect(p.share_image_url).toBe(`https://bilko.run/og/${p.slug}.png`);
  });
});

describe('registry-owned audience / talking_points', () => {
  it('serves git-viewer promo copy from its listing and empty values when a project has no listing', async () => {
    const projects = (await app.inject({ method: 'GET', url: '/api/projects' })).json().projects as
      { slug: string; audience: string; talking_points: string[] }[];
    const gv = projects.find(p => p.slug === 'git-viewer')!;
    const entry = PROJECTS.find(p => p.slug === 'git-viewer')!;
    expect(gv.audience).toBe(entry.listing?.audience ?? '');
    expect(gv.talking_points).toEqual(entry.listing?.talkingPoints ?? []);
    expect(gv.audience.length).toBeGreaterThan(0);
    expect(gv.talking_points.length).toBeGreaterThan(0);
  });

  it('yields audience "" and talking_points [] for a public project with no listing', async () => {
    vi.resetModules();
    vi.doMock('../src/data/projectsRegistry.js', async importOriginal => {
      const real = await importOriginal<typeof import('../src/data/projectsRegistry.js')>();
      const base = real.PROJECTS.find(p => p.public === true)!;
      const { listing: _listing, ...bare } = base;
      return { ...real, PROJECTS: [{ ...bare, slug: 'no-listing-fixture', public: true }] };
    });
    try {
      const { CATALOG_PROJECTS } = await import('../src/data/projectCatalog.js');
      const row = CATALOG_PROJECTS.find(p => p.slug === 'no-listing-fixture')!;
      expect(row.audience).toBe('');
      expect(row.talking_points).toEqual([]);
    } finally {
      vi.doUnmock('../src/data/projectsRegistry.js');
      vi.resetModules();
    }
  });
});

describe('offers for agents', () => {
  const IDS = ['launch-kit', 'git-viewer', 'pageroast-credits-7', 'pageroast-credit-1'];

  it('list_offers over POST /mcp returns the 4 offers with buy URLs', async () => {
    const res = await mcp({ method: 'tools/call', params: { name: 'list_offers', arguments: {} } });
    const data = JSON.parse(res.result.content[0].text);
    expect(data.offers.map((o: { id: string }) => o.id)).toEqual(IDS);
    for (const o of data.offers) {
      expect(o.buyUrl).toBe(`https://bilko.run/buy/${o.id}`);
      expect(o.currency).toBe('USD');
      expect(o.howToBuy).toContain(o.buyUrl);
    }
    const kit = data.offers.find((o: { id: string }) => o.id === 'launch-kit');
    expect(kit.price).toBe('$9');
    expect(kit.amount).toBe(9);
  });

  it('carries the offer on its project entry and [] elsewhere', async () => {
    const res = await mcp({ method: 'tools/call', params: { name: 'get_project', arguments: { slug: 'launch-kit' } } });
    const got = JSON.parse(res.result.content[0].text);
    expect(got.offers).toEqual([{ id: 'launch-kit', price: '$9', buyUrl: 'https://bilko.run/buy/launch-kit' }]);
    const list = (await app.inject({ method: 'GET', url: '/api/projects' })).json().projects as { slug: string; offers: unknown[] }[];
    expect(list.find(p => p.slug === 'git-viewer')!.offers).toHaveLength(1);
    expect(list.filter(p => p.offers.length === 0).length).toBeGreaterThan(0);
  });

  it('GET /api/offers matches list_offers', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/offers' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['cache-control']).toBe('public, max-age=300');
    const viaMcp = JSON.parse((await mcp({ method: 'tools/call', params: { name: 'list_offers', arguments: {} } })).result.content[0].text);
    expect(res.json()).toEqual(viaMcp);
  });
});
