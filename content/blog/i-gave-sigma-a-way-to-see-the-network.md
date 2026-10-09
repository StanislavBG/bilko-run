---
slug: "i-gave-sigma-a-way-to-see-the-network"
title: "I gave Sigma a way to see the network, not just the rows"
excerpt: "Sigma always had the data — every Bulgarian public contract, authority, and supplier — but no way to see how they connect. This week I shipped the relationship graph: pick a company, see the network around it, click to walk the money outward one hop at a time. Plus a competition view and a spending trend. I even built multi-focus and ripped it back out."
category: "product"
published: true
published_at: "2026-06-24T10:00:00.000Z"
order: 21
---

Sigma has always had the data — every Bulgarian public contract, every authority, every supplier. What it didn't have was a way to *see* how they connect. You could read the rows; you couldn't see the shape. This week I fixed that.

The change I care most about is the relationship graph. Pick a company or an institution and Sigma draws the network around it, with the contract value written on each edge. Click a node and it recenters — so you walk the money outward one hop at a time instead of opening twenty pages and holding the connections in your head. I went back and forth on letting you focus on up to three entities at once, built it, and then ripped it back out: the multi-focus graph looked impressive and read like noise. One focus, click to move it, is the version that actually answers a question.

Two more views shipped alongside it. A Competition page that shows single-bid share and supplier concentration per authority — the contracts that only ever drew one bidder, sortable instead of buried. And a Trend view that lays spending out by month and year, so the end-of-budget-year spikes show up as a curve.

The unglamorous half was hosting. [Sigma Plus](https://sigma-plus.replit.app) is the live, daily-updated build, and I wanted redeploys to never wipe the data — so the corpus now lives in object storage and restores itself on every deploy, with a 30-minute refresh channel pushing new records in. It self-heals now, which means I stop babysitting it.

Next I want the graph to remember where you've been — a breadcrumb of the path you clicked through, so a long chase is reproducible. For now: pull a name you recognize and start clicking → [sigma-plus.replit.app](https://sigma-plus.replit.app)