import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { z } from 'zod';
import { buildCatalog, findCatalogProject } from '../../src/data/projectCatalog.js';
import { registerPageRoastMcpTool } from './tools/page-roast.js';
import { hashIp } from './tools/_shared.js';
import { verifyAgentApiKey } from '../services/agent-api-keys.js';
import { AGENT_OFFERS, formatPrice, type AgentOffer } from '../../shared/agent-offers.js';
import { availableOffers } from '../services/offer-availability.js';

/**
 * Public project catalog: exactly the cards an anonymous visitor sees on
 * /projects, as JSON (GET /api/projects) and as a read-only MCP endpoint
 * (POST /mcp, streamable HTTP, stateless). No auth, no write tools.
 * Contract: docs/host-contract.md → "Public project catalog".
 */

// Registry only changes on deploy; 5 minutes keeps consumers close to live.
const CACHE_CONTROL = 'public, max-age=300';

function json(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

/** Offers listed to agents: only those that can be bought and delivered now. */
export type ListOffers = () => Promise<readonly AgentOffer[]>;

function offersForSlug(slug: string, offers: readonly AgentOffer[]) {
  return offers
    .filter(o => new URL(o.pageUrl).pathname === `/projects/${slug}/`)
    .map(o => ({ id: o.id, price: formatPrice(o), buyUrl: o.buyUrl }));
}

function enrichedCatalog(offers: readonly AgentOffer[]) {
  const catalog = buildCatalog();
  return { ...catalog, projects: catalog.projects.map(p => ({ ...p, offers: offersForSlug(p.slug, offers) })) };
}

export function buildOffersPayload(offers: readonly AgentOffer[] = AGENT_OFFERS) {
  return {
    offers: offers.map(o => ({
      id: o.id,
      name: o.name,
      summary: o.summary,
      whatYouGet: o.whatYouGet,
      price: formatPrice(o),
      amount: o.amountCents / 100,
      currency: 'USD',
      billing: o.billing,
      pageUrl: o.pageUrl,
      buyUrl: o.buyUrl,
      payWith: o.payWith,
      howToBuy: o.payWith === 'credits'
        ? `Pay with Bilko Credits: top up at https://bilko.run/buy/credits-5 (or credits-3 / credits-10), then POST https://bilko.run/api/menu/${o.source.kind === 'menu' ? o.source.itemId : o.id}/order with a bkk_ key, or use the MCP tool order_menu_item. Details: ${o.buyUrl}`
        : `Open ${o.buyUrl} in a browser to pay via Stripe Checkout.`,
    })),
  };
}

export function buildCatalogMcpServer(
  auth?: { email: string | null; ipHash: string; invalidKey?: boolean },
  listOffers: ListOffers = availableOffers,
): McpServer {
  const server = new McpServer({ name: 'bilko-run-projects', version: '1.0.0' });

  server.registerTool(
    'list_projects',
    {
      title: 'List public projects',
      description:
        'Returns every project publicly listed on https://bilko.run/projects, in page order, with how to talk about each (audience, talking_points) and any paid offers (id, price, buyUrl). Same data as GET https://bilko.run/api/projects.',
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => json(enrichedCatalog(await listOffers())),
  );

  server.registerTool(
    'get_project',
    {
      title: 'Get a public project',
      description:
        'Returns one publicly listed bilko.run project by slug. Non-public or unknown slugs return a not-found error.',
      inputSchema: { slug: z.string().min(1).max(64) },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ slug }) => {
      const project = findCatalogProject(slug);
      if (!project) {
        return { isError: true, content: [{ type: 'text' as const, text: `Project "${slug}" not found.` }] };
      }
      return json({ ...project, offers: offersForSlug(project.slug, await listOffers()) });
    },
  );

  server.registerTool(
    'list_offers',
    {
      title: 'List paid offers',
      description:
        'Returns everything for sale on https://bilko.run: id, price, what you get, and a buyUrl to open in a browser to pay via Stripe Checkout. Same data as GET https://bilko.run/api/offers.',
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => json(buildOffersPayload(await listOffers())),
  );

  registerPageRoastMcpTool(server, auth ?? { email: null, ipHash: hashIp('unknown') });

  return server;
}

export function registerProjectCatalogRoutes(
  app: FastifyInstance,
  opts: { listOffers?: ListOffers } = {},
): void {
  const listOffers = opts.listOffers ?? availableOffers;

  app.get('/api/projects', async (_req, reply) => {
    reply.header('Cache-Control', CACHE_CONTROL);
    return enrichedCatalog(await listOffers());
  });

  app.get('/api/offers', async (_req, reply) => {
    reply.header('Cache-Control', CACHE_CONTROL);
    return buildOffersPayload(await listOffers());
  });

  // Stateless streamable HTTP with plain JSON replies: a fresh server +
  // transport per request (the SDK's stateless pattern), no session state.
  // Uses the Web-standard transport, not the Node one: the Node transport
  // (via @hono/node-server) waits to drain a body Fastify already read, then
  // calls destroySoon() on the socket, which drops keep-alive connections.
  app.post('/mcp', async (req, reply) => {
    // Agent key is optional: catalog tools are public; only roast_page needs it.
    const authHeader = req.headers.authorization;
    let email: string | null = null;
    let invalidKey = false;
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer bkk_')) {
      email = await verifyAgentApiKey(authHeader.slice('Bearer '.length));
      invalidKey = !email;
    }
    const server = buildCatalogMcpServer({ email, ipHash: hashIp(req.ip), invalidKey }, listOffers);
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    try {
      await server.connect(transport);
      const headers = new Headers();
      for (const [k, v] of Object.entries(req.headers)) {
        if (typeof v === 'string') headers.set(k, v);
        else if (Array.isArray(v)) headers.set(k, v.join(', '));
      }
      const res = await transport.handleRequest(
        new Request(`http://localhost${req.url}`, { method: 'POST', headers }),
        { parsedBody: req.body },
      );
      reply.status(res.status);
      res.headers.forEach((v, k) => { reply.header(k, v); });
      return reply.send(await res.text());
    } finally {
      await transport.close();
      await server.close();
    }
  });

  // No server-initiated streams or sessions in stateless mode.
  const notAllowed = async (_req: FastifyRequest, reply: FastifyReply) =>
    reply.status(405).header('Allow', 'POST').send({ jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed.' }, id: null });
  app.get('/mcp', notAllowed);
  app.delete('/mcp', notAllowed);
}
