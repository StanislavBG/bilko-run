import type { FastifyInstance } from 'fastify';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildCatalog } from '../../src/data/projectCatalog.js';
import { AGENT_OFFERS, formatPrice, type AgentOffer } from '../../shared/agent-offers.js';
import { availableOffers } from '../services/offer-availability.js';
import type { ListOffers } from './project-catalog.js';

/**
 * /llms.txt (llmstxt.org): what bilko.run is, every public project, every paid
 * offer that can be bought now with price + buy link, and the machine endpoints.
 * Built per request from the available AGENT_OFFERS and the project catalog so it cannot drift.
 * A public project whose published bundle ships its own llms.txt
 * (<dist>/projects/<slug>/llms.txt) is linked under "Project guides".
 */

const CACHE_CONTROL = 'public, max-age=300';
const SITE = 'https://bilko.run';

const SLUG_RE = /^[a-z0-9-]+$/;

const oneLine = (s: string): string => s.replace(/\s+/g, ' ').trim();

/** Tools registered on /mcp (asserted against buildCatalogMcpServer in tests). */
export const MCP_TOOLS = [
  'list_projects',
  'get_project',
  'list_offers',
  'list_menu',
  'wallet_balance',
  'order_menu_item',
  'roast_page',
] as const;

export function buildLlmsTxt(
  offers: readonly AgentOffer[] = AGENT_OFFERS,
  hasProjectLlmsTxt: (slug: string) => boolean = () => false,
): string {
  const buy = offers.map(
    o => `- [${o.name} — ${formatPrice(o)}](${o.buyUrl}): ${oneLine(o.summary)} ${oneLine(o.whatYouGet)}`,
  );
  const catalog = buildCatalog().projects;
  const projects = catalog.map(
    p => `- [${p.name}](${SITE}/projects/${p.slug}/): ${oneLine(p.tagline)}`,
  );
  const guides = catalog
    .filter(p => SLUG_RE.test(p.slug) && hasProjectLlmsTxt(p.slug))
    .map(p => `- [${p.name} llms.txt](${SITE}/projects/${p.slug}/llms.txt): ${p.name}'s own llms.txt, with more detail than this file.`);

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
    ...(guides.length > 0 ? ['## Project guides', '', ...guides, ''] : []),
    '## For agents',
    '',
    `- [MCP endpoint](${SITE}/mcp): POST ${SITE}/mcp, a streamable HTTP MCP server with tools ${MCP_TOOLS.join(', ')}. list_projects, get_project, list_offers and list_menu need no key; wallet_balance, order_menu_item and roast_page need a bkk_ key sent as "Authorization: Bearer bkk_...".`,
    `- [Menu](${SITE}/api/menu): GET ${SITE}/api/menu returns the services menu with credit prices. Top up at ${SITE}/buy/credits-3, /buy/credits-5 or /buy/credits-10 (the success page shows a bkk_ key), then spend credits with POST ${SITE}/api/menu/<itemId>/order or the order_menu_item tool. Check the balance with GET ${SITE}/api/wallet.`,
    `- [Project catalog](${SITE}/api/projects): GET ${SITE}/api/projects returns every public project as JSON.`,
    `- [Offers](${SITE}/api/offers): GET ${SITE}/api/offers returns every paid offer as JSON, each with a buyUrl to open in a browser to pay via Stripe Checkout. To check a buyUrl without opening a checkout, send HEAD or add ?dryRun=1.`,
    '',
  ].join('\n');
}

export function registerAgentStorefrontRoutes(
  app: FastifyInstance,
  opts: { listOffers?: ListOffers; distPath?: string } = {},
): void {
  const listOffers = opts.listOffers ?? availableOffers;
  const { distPath } = opts;
  const hasProjectLlmsTxt = (slug: string): boolean =>
    distPath !== undefined && existsSync(resolve(distPath, 'projects', slug, 'llms.txt'));
  app.get('/llms.txt', async (_req, reply) => {
    reply
      .header('Content-Type', 'text/plain; charset=utf-8')
      .header('Cache-Control', CACHE_CONTROL);
    return buildLlmsTxt(await listOffers(), hasProjectLlmsTxt);
  });
}
