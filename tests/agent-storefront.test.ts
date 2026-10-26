import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Fastify from 'fastify';
import { buildCatalogMcpServer } from '../server/routes/project-catalog.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { buildLlmsTxt, registerAgentStorefrontRoutes } from '../server/routes/agent-storefront.js';
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

describe('/llms.txt project guides', () => {
  const [first, second] = buildCatalog().projects.map(p => p.slug);

  it('adds a Project guides section only for projects that ship llms.txt', () => {
    expect(buildLlmsTxt(AGENT_OFFERS)).not.toContain('## Project guides');
    const body = buildLlmsTxt(AGENT_OFFERS, slug => slug === first);
    expect(body).toContain('## Project guides');
    expect(body).toContain(`(https://bilko.run/projects/${first}/llms.txt)`);
    expect(body).not.toContain(`(https://bilko.run/projects/${second}/llms.txt)`);
  });

  it('links <distPath>/projects/<slug>/llms.txt when the published bundle has one', async () => {
    const dist = fs.mkdtempSync(path.join(os.tmpdir(), 'llms-dist-'));
    fs.mkdirSync(path.join(dist, 'projects', first), { recursive: true });
    fs.writeFileSync(path.join(dist, 'projects', first, 'llms.txt'), '# Guide\n');
    fs.mkdirSync(path.join(dist, 'projects', second), { recursive: true });
    fs.writeFileSync(path.join(dist, 'projects', second, 'index.html'), '<!doctype html>');
    const app = Fastify();
    registerAgentStorefrontRoutes(app, { listOffers: async () => AGENT_OFFERS, distPath: dist });
    const body = (await app.inject({ method: 'GET', url: '/llms.txt' })).body;
    expect(body).toContain(`(https://bilko.run/projects/${first}/llms.txt)`);
    expect(body).not.toContain(`(https://bilko.run/projects/${second}/llms.txt)`);
  });
});
