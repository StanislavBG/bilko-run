# Letting AI agents pay bilko.run

Research only. Nothing here is built by this document. Written 2026-10-20.

**The question:** how can an AI agent pay bilko.run without a person clicking through a Stripe Checkout page?

**Money context:** lifetime Stripe revenue is about $21. Offers today: Launch Kit ($9 one-time), Git Viewer ($5/month), PageRoast credits ($1 each or 7 for $5). Every option below is judged against that. Most of them cost more engineering time than they could earn back soon.

**How to read the sources.** Every claim about a third-party program has a URL and the date it was fetched (all fetched 2026-10-20). Anything that could not be checked is marked **unverified**. Effort is in working days for this codebase and is an estimate, not a quote.

## One-minute summary

| Option | Can agents pay without a human click? | Open to bilko.run today? | Effort | Verdict |
|---|---|---|---|---|
| 1. Stripe Agentic Commerce (ACP, Shared Payment Tokens) | Yes, with the buyer's pre-approved card token | Partly. Stripe side is open preview; the ChatGPT side is invite-only | 4–8 days | Not now |
| 2. Stripe Directory listing | No, it is discovery only | Yes, by emailing Stripe, but only for machine-payments sellers | 0.25 day | Do after something is payable |
| 3. HTTP 402 pay-per-call (MPP, x402) | Yes, fully automatic | Yes, if Stripe approves stablecoin access (cards need only a Stripe profile) | 3–5 days | Not now |
| 4. Prepaid credits + API key (shipped) | Yes, after one human purchase | Already live | 0 days | Keep, and measure |
| 5. Payment Links vs the `/buy` 302 route | Neither is hands-free; both still need a human page | Both available | 0–0.5 day | Keep `/buy` |

## 1. Stripe Agentic Commerce Protocol (ACP), Instant Checkout in ChatGPT, Shared Payment Tokens

**What it is.** ACP is an open standard (Apache 2.0) for how a buyer, an AI agent and a business check out together. The business stays the seller of record. Stripe and OpenAI developed it. Source: https://www.agenticcommerce.dev (fetched 2026-10-20).

Shared Payment Tokens (SPTs) are the payment half. An SPT is a scoped grant that lets the agent use a customer's saved payment method at one seller, with an amount cap and an expiry. Source: https://docs.stripe.com/agentic-commerce/concepts/shared-payment-tokens (fetched 2026-10-20).

**Status and eligibility.**
- SPTs are marked **Public preview** and work for sellers in the US, Canada and select European countries (same source).
- Stripe's own docs have moved on from "ACP" as the headline. Its `/agentic-commerce/protocol` page now describes the Universal Commerce Protocol (UCP), an open standard that Stripe says it supports as a Tech Council member. Source: https://docs.stripe.com/agentic-commerce/protocol (fetched 2026-10-20). ACP itself is still live at https://www.agenticcommerce.dev.
- For selling through agents, Stripe offers "Agentic Commerce Suite": the seller uploads a product catalog (CSV feed), and Stripe shares it with agents, runs checkout and sends an order event. It is built for product catalogs and says it is available in the US, Canada and select European countries. Source: https://docs.stripe.com/agentic-commerce/sellers/use-cases/retail/checkout.md (fetched 2026-10-20).
- ChatGPT's side is gated. OpenAI says onboarding product feeds in ChatGPT "is currently available to approved partners" and points to an application form. Source: https://developers.openai.com/commerce/guides/get-started.md (fetched 2026-10-20). The ACP site says the same: each AI platform runs its own process, and ChatGPT requires an application. Source: https://www.agenticcommerce.dev (fetched 2026-10-20). Whether a store this small would be approved: **unverified**.
- Whether Instant Checkout in ChatGPT accepts digital downloads or subscriptions (not physical goods): **unverified**. The OpenAI prohibited-products policy and merchant terms were not checked beyond the get-started page.

**Fees.**
- Underlying card processing is Stripe's standard 2.9% + 30¢ per successful domestic card transaction. Source: https://stripe.com/pricing (fetched 2026-10-20).
- Any extra fee for Agentic Commerce Suite or an Instant Checkout commission: **unverified** (not stated on the pages fetched).
- Stripe's fixed 30¢ matters at this price level. On a $1 PageRoast credit, card fees take about 33¢ (33%). On $5 it is about 45¢ (9%). On $9 it is about 56¢ (6%).

**Integration effort: 4–8 days.** Needs a catalog feed for three offers, a Stripe profile, handling of agent-created checkout events next to the existing webhook (`server/routes/stripe.ts`), the application to OpenAI (waiting time unknown), and testing against Stripe's test helper for SPTs. The Git Viewer subscription and API-key delivery do not map cleanly onto a retail-catalog model; the fit is **unverified**.

**Fit for bilko.run.** Low today. The reachable audience (ChatGPT shoppers) is not who buys a $1 roast or a developer launch kit, and approval is not in the owner's hands. Revisit if OpenAI opens feed onboarding beyond approved partners.

## 2. Stripe Directory / agent-readiness listing

**What it is.** Stripe Directory is a searchable catalog that agents and developers use to find providers and "follow the best supported path" to use them. Today it indexes Stripe Apps, Stripe Projects providers, pay-per-call endpoints listed on mpp.dev, and the wider Stripe business network. It is labelled a preview. Source: https://docs.stripe.com/directory.md (fetched 2026-10-20).

**Eligibility and how to get listed.** The route Stripe documents is for machine-payments sellers. After finishing a machine-payments integration, email machine-payments@stripe.com with business name, Stripe account ID, Stripe profile ID, a link to `llms.txt` and any agent skills, whether you accept card tokens (SPTs), stablecoins or both, and one to three example prompts. Source: https://docs.stripe.com/payments/machine.md (fetched 2026-10-20). No documented path for listing a credits-and-API-key store: **unverified**.

**Fees.** None stated. Source: same pages.

**Effort: about a quarter day** once a machine-payments endpoint exists (writing the email, confirming `llms.txt`, which bilko.run already serves per `shared/agent-offers.ts`). Before that, there is nothing for Stripe to list.

**Fit.** Good as a cheap follow-up, useless on its own. A listing sends agents to something they can pay for hands-free; with only the Checkout page, they would still hit a human step.

## 3. HTTP 402 pay-per-call (MPP, x402, Stripe-based variants)

**What it is.** The server answers a request with HTTP status 402 ("Payment Required") plus the price. The agent pays and retries, with no account, no key, no checkout page.

- **MPP** (Machine Payments Protocol): co-authored by Stripe and Tempo, supports cards and stablecoins. The server records each payment with a Stripe PaymentIntent. Sources: https://docs.stripe.com/payments/machine/mpp.md and https://mpp.dev (fetched 2026-10-20).
- **x402**: an open standard under the Linux Foundation family (LF Projects) that adds payment middleware to a server. Stablecoin payments are the primary use case. Source: https://www.x402.org (fetched 2026-10-20). Stripe also supports x402 stablecoin payments. Source: https://docs.stripe.com/payments/machine.md (fetched 2026-10-20).

**Crypto settlement is out of scope for bilko.run.** x402 and the stablecoin side of MPP settle in USDC on public blockchains; the card path (via SPTs) does not. This document therefore only considers MPP with cards.

**Eligibility and limits.**
- Card payments use SPTs. Minimum is $0.50 per card payment, so the $1 credit is fine but anything cheaper is not. Source: https://docs.stripe.com/payments/machine/mpp.md (fetched 2026-10-20).
- Stripe says payments land in the normal Stripe balance, in fiat, and refunds work as usual. Source: https://docs.stripe.com/payments/machine.md (fetched 2026-10-20).
- Stablecoin acceptance needs Stripe approval and excludes New York (same source). Not needed for the card path.
- Buyers use a Link Agent Wallet or similar. How many agents hold one today: **unverified**.

**Fees.** Card payments: standard card rate, 2.9% + 30¢ (https://stripe.com/pricing, fetched 2026-10-20) — assuming SPT card charges are priced as normal cards, which is **unverified**. Stripe's pricing page lists stablecoin payments at 0.8% per transaction, promotional through 2027-01-01, then +0.2% (same page); not relevant to the card-only scope.

**Integration effort: 3–5 days.** A 402 challenge and verification wrapper around `roast_page` (currently gated by `bkk_` keys in `server/routes/tools/page-roast.ts`), PaymentIntent bookkeeping, idempotency, tests against Stripe's test helper, and a documented fallback. Stripe's sample code and a one-prompt coding-agent flow exist (https://docs.stripe.com/payments/machine/mpp.md), which may shorten the first day.

**Fit.** Technically the best match for "no human at all" and for a $1 item. The weakness is demand: a seller needs agents carrying funded Link wallets, and nothing in the research shows that population exists yet for this niche.

## 4. Prepaid credits + API key (shipped)

**What it is.** A person (or the agent, handed a link) buys credits once at `https://bilko.run/buy/<offer>`; the success page mints a `bkk_` API key. After that, the agent calls paid tools with `Authorization: Bearer bkk_...` and no browser. First paid tool: `roast_page` on the `/mcp` server, costing 1 credit.

**What is in this repo.**
- `shared/agent-offers.ts`: the four offers (`launch-kit`, `git-viewer`, `pageroast-credits-7`, `pageroast-credit-1`) as plain data, used for `llms.txt`, the public catalog and `/buy/<id>`.
- `server/routes/agent-buy.ts`: `/buy/:offerId`, which creates a Stripe Checkout session and 302-redirects to it (rate-limited per IP).
- `server/services/agent-api-keys.ts`: hashed, revocable `bkk_` keys, up to 10 active per account; used by `creditGate` and the `roast_page` MCP tool.
- Self-serve mint/list/revoke routes and the agent-buy success page that shows a key.

**Availability and fees.** Live now, no third-party approval. Fees are the normal Stripe card fees above. Prepaid credits help here: one $5 purchase covers seven agent calls, so the 30¢ fixed fee is paid once instead of seven times.

**Effort: 0 days to keep; small follow-ups only** (a usage dashboard, low-balance error message).

**Fit.** Best today. It needs one human purchase, but that matches how developers already hand an agent an API key, and it needs no waiting on Stripe or OpenAI. Limitation: the agent cannot discover, decide and pay on its own from zero.

## 5. Stripe Payment Links vs the `/buy` 302 route

**Payment Links** are no-code, Stripe-hosted pages with a shareable URL; they support 40+ payment methods, automatic receipts and no-code refunds, with limited visual customization. Source: https://docs.stripe.com/payments/payment-links (fetched 2026-10-20). Fees are the same Stripe card rates; Payment Links carry no extra listed fee on https://stripe.com/pricing (fetched 2026-10-20).

| | Payment Link | `/buy/<offer>` 302 (shipped) |
|---|---|---|
| Setup | Click in Stripe Dashboard, 0 code | Already written |
| Human clicks needed | Yes, on Stripe's page | Yes, on Stripe's page |
| Price source | Fixed in Stripe | `shared/agent-offers.ts`, one source of truth with `llms.txt` and the MCP catalog |
| Session options (email, metadata, redirect, key minting) | Fixed at link creation | Set per request in code |
| Fits agent discovery (`llms.txt`, MCP catalog) | Each link is a separate URL to maintain | One predictable URL pattern per offer |

Both end on a Stripe-hosted page that a person must complete, so neither answers the "no human" question. The `/buy` route is the better choice because the success page must mint a `bkk_` key and attach purchases to the buyer's email, which a plain Payment Link cannot do without separate webhook work (the webhook handling already exists for `/buy`). Effort to switch: 0.5 day, with a loss of key minting. No reason to switch.

## Recommendation

**Ranked next steps**

1. **Keep option 4 and make it observable (0.5–1 day, payoff: knowing whether any agent ever buys).** Count `/buy` hits, completed purchases and `bkk_` key calls by agent type. At $21 lifetime revenue, evidence of demand is worth more than another payment rail. The existing traffic classification can be reused.
2. **Do nothing on options 1, 2, 3 and 5 until a trigger fires.** Doing none of them costs nothing and loses no revenue that exists today.

**Not now, with the trigger that changes it**

- **MPP / x402 pay-per-call (3–5 days).** Trigger: at least 10 `/buy` hits or key-bearing tool calls from agents per month that stop at the checkout page, or Stripe announcing that card-based machine payments are generally available (today it is a preview-stage product; GA status **unverified**). Card-only; crypto remains out of scope.
- **Stripe Directory listing (0.25 day).** Trigger: a machine-payments endpoint exists. Then send the email described in option 2.
- **ACP / Instant Checkout in ChatGPT (4–8 days).** Trigger: OpenAI opens merchant onboarding beyond approved partners, and confirms digital goods and subscriptions are allowed. Both are **unverified** today.
- **Payment Links in place of `/buy` (0.5 day).** Trigger: none expected; revisit only if the `/buy` route becomes a maintenance burden.

**Expected payoff.** Revenue is about $21 lifetime. Even a 10x increase in sales would not cover a multi-day integration at hourly rates, so the rule is: only build a new rail once real agent traffic is stuck at the existing one.
