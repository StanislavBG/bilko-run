/**
 * Every paid offer on bilko.run, as pure data for AI-agent discovery
 * (/llms.txt, the public MCP catalog, JSON-LD, /buy/:offerId).
 *
 * Offers reference the existing catalogs by `source`; prices are not stored in
 * PRICE_CATALOG, so amountCents lives here and must match PricingPage copy.
 *
 * Keep this file pure data and pure functions — no fs, no env reads, no Stripe
 * SDK imports — so it can load cleanly in the browser bundle and on the server.
 */

import type { PriceType } from './product-catalog.js';
import { TOKENS_PER_BUNDLE, TOKENS_PER_SINGLE } from './product-catalog.js';

export interface AgentOffer {
  /** kebab-case id; also the /buy/<id> path segment */
  id: string;
  name: string;
  summary: string;
  whatYouGet: string;
  amountCents: number;
  currency: 'usd';
  billing: 'one_time' | 'month';
  pageUrl: string;
  /** no-JS buy URL: https://bilko.run/buy/<id> */
  buyUrl: string;
  source:
    | { kind: 'web_product'; slug: string }
    | { kind: 'price_catalog'; priceType: PriceType };
  /** true when the purchase yields an API key an agent can use */
  agentKey: boolean;
}

const SITE = 'https://bilko.run';
const buy = (id: string): string => `${SITE}/buy/${id}`;

export const AGENT_OFFERS: readonly AgentOffer[] = [
  {
    id: 'launch-kit',
    name: 'Bilko Launch Kit',
    summary: 'A downloadable launch kit zip, sold as a one-time purchase.',
    whatYouGet: 'One zip download of the Bilko Launch Kit after checkout.',
    amountCents: 900,
    currency: 'usd',
    billing: 'one_time',
    pageUrl: `${SITE}/projects/launch-kit/`,
    buyUrl: buy('launch-kit'),
    source: { kind: 'web_product', slug: 'launch-kit' },
    agentKey: false,
  },
  {
    id: 'agent-factory-kit',
    name: 'Bilko Agent Factory Kit',
    summary: 'A downloadable kit of agent personas and templates for Session Manager / Claude Code users, sold as a one-time purchase.',
    whatYouGet:
      'One zip download after checkout: agent personas, a PRD template, a standards template, a validator prompt and scheduler recipes. Made for Session Manager and Claude Code users.',
    amountCents: 300,
    currency: 'usd',
    billing: 'one_time',
    pageUrl: `${SITE}/projects/launch-kit/agent-factory-kit/`,
    buyUrl: buy('agent-factory-kit'),
    source: { kind: 'web_product', slug: 'agent-factory-kit' },
    agentKey: false,
  },
  {
    id: 'git-viewer',
    name: 'Git Viewer Portfolio',
    summary: 'A hosted, auto-refreshed portfolio page built from your GitHub activity.',
    whatYouGet:
      'A hosted portfolio page that refreshes daily. Pay with the same email as the GitHub-linked bilko.run sign-in so the subscription attaches to your account.',
    amountCents: 500,
    currency: 'usd',
    billing: 'month',
    pageUrl: `${SITE}/projects/git-viewer/`,
    buyUrl: buy('git-viewer'),
    source: { kind: 'price_catalog', priceType: 'git_viewer' },
    agentKey: false,
  },
  {
    id: 'pageroast-credits-7',
    name: 'PageRoast credits (7)',
    summary: 'A bundle of 7 PageRoast credits for landing page audits.',
    whatYouGet: `${TOKENS_PER_BUNDLE} PageRoast credits, one-time, usable with an agent API key.`,
    amountCents: 500,
    currency: 'usd',
    billing: 'one_time',
    pageUrl: `${SITE}/projects/page-roast/`,
    buyUrl: buy('pageroast-credits-7'),
    source: { kind: 'price_catalog', priceType: 'pageroast_tokens' },
    agentKey: true,
  },
  {
    id: 'pageroast-credit-1',
    name: 'PageRoast credit (1)',
    summary: 'A single PageRoast credit for one landing page audit.',
    whatYouGet: `${TOKENS_PER_SINGLE} PageRoast credit, one-time, usable with an agent API key.`,
    amountCents: 100,
    currency: 'usd',
    billing: 'one_time',
    pageUrl: `${SITE}/projects/page-roast/`,
    buyUrl: buy('pageroast-credit-1'),
    source: { kind: 'price_catalog', priceType: 'pageroast_token_single' },
    agentKey: true,
  },
];

export function offerById(id: string): AgentOffer | undefined {
  return AGENT_OFFERS.find(o => o.id === id);
}

/** '$9', '$5/month', '$1.50' */
export function formatPrice(o: AgentOffer): string {
  const dollars = o.amountCents / 100;
  const amount = Number.isInteger(dollars) ? `$${dollars}` : `$${dollars.toFixed(2)}`;
  return o.billing === 'month' ? `${amount}/month` : amount;
}
