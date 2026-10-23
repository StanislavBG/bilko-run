import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';
import { buildCatalogMcpServer } from '../server/routes/project-catalog.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { registerAgentStorefrontRoutes } from '../server/routes/agent-storefront.js';
import { AGENT_OFFERS, formatPrice } from '../shared/agent-offers.js';
import { buildCatalog } from '../src/data/projectCatalog.js';

describe('GET /llms.txt', () => {
  async function fetchTxt() {
    const app = Fastify();
    registerAgentStorefrontRoutes(app, { listOffers: async () => AGENT_OFFERS });
    return app.inject({ method: 'GET', url: '/llms.txt' });
  }

  it('serves text/plain with a 5 minute cache', async () => {
    const res = await fetchTxt();
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('text/plain; charset=utf-8');
    expect(res.headers['cache-control']).toBe('public, max-age=300');
  });

  it('starts with the H1 and lists every offer, project and endpoint', async () => {
    const body = (await fetchTxt()).body;
    expect(body.split('\n')[0]).toBe('# bilko.run');
    for (const o of AGENT_OFFERS) {
      expect(body).toContain(o.buyUrl);
      expect(body).toContain(formatPrice(o));
    }
    const slug = buildCatalog().projects[0].slug;
    expect(body).toContain(`https://bilko.run/projects/${slug}/`);
    for (const e of ['POST https://bilko.run/mcp', 'GET https://bilko.run/api/projects', 'GET https://bilko.run/api/offers']) {
      expect(body).toContain(e);
    }
  });

  it('names exactly the tools registered on /mcp', async () => {
    const server = buildCatalogMcpServer();
    const client = new Client({ name: 'test', version: '1.0.0' });
    const [a, b] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(a), client.connect(b)]);
    const registered = (await client.listTools()).tools.map(t => t.name).sort();
    await client.close();

    const body = (await fetchTxt()).body;
    const line = body.split('\n').find(l => l.includes('POST https://bilko.run/mcp')) ?? '';
    const named = (line.match(/tools (.+?)\. /)?.[1] ?? '').split(', ').sort();
    expect(named).toEqual(registered);
    expect(body).toContain('GET https://bilko.run/api/menu');
  });
});
