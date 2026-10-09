---
slug: "sigma-now-shows-who-sits-behind-a-contract"
title: "СИГМА Now Shows Who Sits Behind a Contract"
excerpt: "SIGMA answered who paid whom. On September 16th the public V2 added the next question: who is behind the company, with person pages, a related-persons view and a connection graph."
category: "product"
published: true
published_at: "2026-09-16T16:00:00.000Z"
order: 39
---

[СИГМА](https://sigma.midt.bg) is a public-procurement transparency portal for Bulgaria: contracts from 2020 onward, refreshed daily from the official register, so you can trace who paid whom and how much without being a procurement specialist. It's for anyone who wants to follow public money without a procurement background. To start, open the site and search a company or a public institution by name.

**Was.** Until mid-September, SIGMA answered "who paid whom?" well: an institution page, a company page, a contract page, and a flows view tying them together. It could not answer the next question, the one people actually ask: who is behind the company?

**Now.** On September 16th the public V2 landed, and it adds people to the picture.

- **Person pages.** Each person in the registers gets a profile at their own address. A made-up ID returns a plain 404 instead of an empty shell.
- **Company and institution profiles got deeper:** roles, history and shareholdings sit next to the money, so a company page shows who held which role and when, not just what it won.
- **"Related persons."** A new view lists the people connected to contractors, with filters and grouping, so you can narrow it to the slice you care about instead of scrolling one giant list.
- **A connection graph** draws those links out visually.

Profiles of natural persons and sole traders are marked noindex, so search engines don't build a public dossier on a private individual. That was a deliberate line, not an afterthought: the portal is a reference tool for following public money, not a people-finder.

Underneath sits a registry layer that shipped a few minutes earlier the same day: a stable identity for each person across sources, a daily job that reads new batches and changes from the Trade Registry, and eleven new database migrations (0011 through 0021) applied before the workers deploy. The web app didn't change in that first commit. It was the plumbing the profiles stand on.

One honest caveat: a link between a person and a company is a fact from the registers, not a verdict. The point of the graph is to make the question askable in a click, not to answer it for you.

**Next.** The new screens still need responsive and mobile layouts, and that pass is already underway.

Try it: [sigma.midt.bg](https://sigma.midt.bg).