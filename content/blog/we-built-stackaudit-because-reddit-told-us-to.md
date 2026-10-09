---
slug: "we-built-stackaudit-because-reddit-told-us-to"
title: "We Built StackAudit Because Reddit Told Us To"
excerpt: "How a single Reddit thread with 461 upvotes and 283 comments convinced us to build a SaaS cost-cutting tool — and what we learned about research-driven product development."
category: "product"
published: true
published_at: "2026-04-04T07:14:03.871Z"
order: 2
---

## The thread that started it all

"The SaaS model is quietly falling apart for small businesses and nobody in tech wants to admit it."

That's the title of a Reddit post on r/Entrepreneur that got 461 upvotes and 283 comments. The post described a 12-person company paying for 23 separate SaaS subscriptions — and the total monthly bill was startling.

But the real gold was in the replies.

## What the comments revealed

One reply said: "We cut nine subscriptions in a single afternoon and nobody noticed." Nine tools. Gone. Zero impact on productivity. That's not optimization — that's waste discovery.

Another founder shared: "We emailed 50 churned customers offering to buy them coffee and talk about why they left." The most common answer? Too many tools, too much overlap, too little clarity on what each one actually did.

A third thread — "Built our SaaS on AWS. Monthly bill: $2,400. Moved to Hetzner. Monthly bill: $180" — showed the same pattern at the infrastructure level. Not a complex migration. Just switching from an enterprise platform to one that matched their actual needs.

## The gap we found

Enterprise stack audit tools exist. Zylo, Zluri, Torii — they cost $10,000-50,000 per year and require IT integration. They're built for companies with 305+ SaaS applications and dedicated procurement teams.

Nobody was serving the 1-20 person team with 15-30 tools who just needed a quick answer: "What am I wasting money on?"

## What we built

[StackAudit](/projects/stack-audit) lets you paste your tool list and get an AI analysis in 30 seconds:

- **Cost efficiency**: Are you overpaying? Are there free alternatives?
- **Tool overlap**: Are multiple tools doing the same job?
- **Self-host potential**: Could you run it yourself for less?
- **Stack complexity**: Is your stack right-sized for your team?
- **Future risk**: Are you locked into vendors with rising prices?

Each tool gets a KEEP, SWITCH, or CUT recommendation with a specific alternative suggestion.

## The numbers

The average small team wastes $200-500 per month on tools they don't use or could replace. That's $2,400-6,000 per year — enough to fund a contractor, a marketing campaign, or six months of better hosting.

Enterprise audit tools would charge you $10,000+ to find that waste. StackAudit costs $1.

## What we learned about research-driven development

This product didn't come from a brainstorm. It came from reading 3,690 Reddit posts that our automation system had captured and indexed in a vector database. We didn't guess what people needed — we searched for corroborated pain points across multiple threads and validated them against market data.

The lesson: **your users are already describing their problems publicly. You just need a system to find and synthesize those signals.**

## Try it

[StackAudit](/projects/stack-audit) is live. Paste your tools, see what you can save. Then [roast your landing page](/projects/page-roast) while you're at it.

## FAQ

**How accurate are the savings estimates?**
They're directional, not exact. Use them as a starting point for your own audit, not a final decision.

**Will it tell me to cancel everything?**
No. Some tools are worth every penny. We flag what's wasteful, redundant, or has a better alternative.

**How is this different from Zylo or Zluri?**
They cost $10K+/year, require IT integration, and target enterprises with 300+ apps. StackAudit costs $1, runs in 30 seconds, and is built for small teams.