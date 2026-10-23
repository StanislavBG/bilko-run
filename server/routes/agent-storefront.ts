import type { FastifyInstance } from 'fastify';
import { buildCatalog } from '../../src/data/projectCatalog.js';
import { AGENT_OFFERS, formatPrice, type AgentOffer } from '../../shared/agent-offers.js';
import { availableOffers } from '../services/offer-availability.js';
import type { ListOffers } from './project-catalog.js';

/**
 * /llms.txt (llmstxt.org): what bilko.run is, every public project, every paid
 * offer that can be bought now with price + buy link, and the machine endpoints.
 * Built per request from the available AGENT_OFFERS and the project catalog so it cannot drift.
 */

const CACHE_CONTROL = 'public, max-age=300';
const SITE = 'https://bilko.run';

const oneLine = (s: string): string => s.replace(/\s+/g, ' ').trim();

export function buildLlmsTxt(offers: readonly AgentOffer[] = AGENT_OFFERS): string {
  const buy = offers.map(
    o => `- [${o.name} — ${formatPrice(o)}](${o.buyUrl}): ${oneLine(o.summary)} ${oneLine(o.whatYouGet)}`,
  );
  const projects = buildCatalog().projects.map(
    p => `- [${p.name}](${SITE}/projects/${p.slug}/): ${oneLine(p.tagline)}`,
  );

  return [
    '# bilko.run',
    '',
    '> bilko.run is a host platform for small independent web apps and tools, with shared sign-in, credits and a project catalog. Each project is its own app; some have paid offers.',
    '',
    '## Buy',
    '',
    ...buy,
    '',
    '## Projects',
    '',
    ...projects,
    '',
    '## For agents',
    '',
    `- [MCP endpoint](${SITE}/mcp): POST ${SITE}/mcp, a read-only catalog MCP server (streamable HTTP, no auth) with tools list_projects, get_project and list_offers.`,
    `- [Project catalog](${SITE}/api/projects): GET ${SITE}/api/projects returns every public project as JSON.`,
    `- [Offers](${SITE}/api/offers): GET ${SITE}/api/offers returns every paid offer as JSON, each with a buyUrl to open in a browser to pay via Stripe Checkout.`,
    '',
  ].join('\n');
}

export function registerAgentStorefrontRoutes(
  app: FastifyInstance,
  opts: { listOffers?: ListOffers } = {},
): void {
  const listOffers = opts.listOffers ?? availableOffers;
  app.get('/llms.txt', async (_req, reply) => {
    reply
      .header('Content-Type', 'text/plain; charset=utf-8')
      .header('Cache-Control', CACHE_CONTROL);
    return buildLlmsTxt(await listOffers());
  });
}
