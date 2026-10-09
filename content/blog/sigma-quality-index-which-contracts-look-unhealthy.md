---
slug: "sigma-quality-index-which-contracts-look-unhealthy"
title: "Sigma can now tell you which contracts look unhealthy"
excerpt: "Sigma always told you what happened in Bulgarian procurement. The new quality index tells you whether it looks healthy: a 0-1 score over five pillars, blended 60% mean / 40% worst pillar, across 194,481 contracts — with unknown never counting as zero."
category: "product"
published: true
published_at: "2026-07-02T16:00:00.000Z"
order: 23
---

Until now, [СИГМА](https://sigma.midt.bg) told you *what happened* in Bulgarian public procurement: who bought what, from whom, for how much, traceable to the source notice. Whether a contract looked *healthy* was your problem — you eyeballed single-bid awards, annex counts, and overruns one contract at a time.

The new [Индекс на качеството](https://sigma.midt.bg/quality) page answers the question directly. Every contract gets a 0–1 health score built from five weighted pillars: contestability (how many bids, judged against comparable contracts, not an absolute count), procedure openness, value integrity (annexes, overruns, estimate accuracy), relationship health (repeat wins, buyer–supplier concentration), and transparency. The blend is 60% weighted mean, 40% worst pillar — so a contract can't average its way out of one catastrophic dimension.

What you can do with it:

- Rank authorities, suppliers, sectors, regions, years, and funding sources — **sorted weakest-first by default**. The page opens on the problems.
- Click any bar of the score histogram to get the exact contracts behind it. "Every contract scoring under 20 in construction in 2024" is a URL, not an export-and-pivot exercise.
- Open any contract's decomposition and see which pillar dragged it down, with each pillar's weight and contribution drawn to scale.

The rule that shaped the whole index: **unknown never counts as zero**. A missing pillar drops out of the average entirely; a contract with under 40% data coverage gets no score at all rather than a misleading one; an authority needs 20 scored contracts before its average is published, so a municipality with three contracts can't top the worst-offender table. The UI renders missing data as „—" with a tooltip saying exactly that.

That rule earned its keep during review. The lowball-then-amend detector — flagging contracts whose first amendment inflates them over 30% within 90 days — was silently comparing amendment values against signing values *without checking they were in the same currency*, and scoring unscorable rows as clean. Both paths now resolve to unknown.

The numbers behind the launch: 194,481 contracts scored, 18 of 18 spec validation checks passing, and the pipeline's reconciliation gate verified against the full corpus — 193,902 contracts, EUR 51.7bn, residual 0.00.

Next up: joint procurements (about 8% of authority records name multiple co-buyers on one notice) are currently excluded rather than misattributed — attributing them to each real co-authority without double-counting value is the open product decision.