---
slug: "launch-kit-eight-skills-hand-off-one-shared-brief"
title: "Launch Kit's eight skills hand off one shared brief"
excerpt: "A new $9 download gives Claude Code eight skills that take a working product to a launched one, each writing one file the next skill reads."
category: "product"
published: true
published_at: "2026-10-13T02:50:22.054Z"
order: 44
---

I shipped Launch Kit this week. It's eight Claude Code skills that take a product from "it works" to "people can buy it." Each skill writes one file and tells you which skill to run next, so you're not stuck guessing what comes after the build.

## Eight skills that hand off one shared brief

Run `launch-context` first. It asks what you sell, who buys it, and why they'd switch, then writes that into one file. Every other skill reads that file instead of asking you the same questions again.

From there, pick what you need. `page-roast` scores your landing page from 0 to 100 and rewrites the headline. `headline-lab` scores 20 headlines across five frameworks and picks a top three to test. `price-and-offer` sets a price and a launch offer with a deadline. `launch-emails` writes a five-email sequence. `launch-week` lays out a day-by-day plan from one week before launch to one week after, plus a readiness score. `build-in-public` turns your changelog into posts. `first-100` names your first customer and how to reach them.

You don't have to run all eight. Start with `launch-context`, then jump to whichever skill matches what you're stuck on. It's built for one person: a solo builder who already has something working and needs the launch steps done, not researched.

![Grid of eight Launch Kit skill cards, each naming its job and output file](/blog-images/launch-kit-eight-skills-hand-off-one-shared-brief/eight-skills-grid.jpg "Launch Kit's eight skills, each with one job and one output file.")

## Checked out for real before asking for nine dollars

The one decision behind this release: don't turn on the buy button until the whole path has been paid for, for real, at least once.

Launch Kit sells for $9, pinned to release 1.0.1, a 32,631-byte zip. The server checks that file's sha256 before it hands it to anyone, so a bad upload can never go out as a paid release.

On October 10, a real purchase ran start to finish: landing page, Stripe Checkout, the thanks page, and a working download link, all inside 60 seconds. The zip that came down matched the sha256 pinned in the repo. Launch Kit also went onto the public projects page this week, so it's not a page hiding at a random URL.

The live pricing section backs that up with plain terms. You get 20 downloads per purchase. Sign in with the email you bought it with to re-download anytime. If the purchase path breaks, a 14-day refund gets you your nine dollars back, not an argument.

![Launch Kit pricing section showing nine dollars one-time, version 1.0.1, and refund terms](/blog-images/launch-kit-eight-skills-hand-off-one-shared-brief/nine-dollars-once.jpg "Nine dollars, once, pinned to v1.0.1, with a 14-day refund.")

## How to start, and what the funnel view tracks next

Try it at [bilko.run/projects/launch-kit](https://bilko.run/projects/launch-kit/). After you buy, the skills drop into Claude Code the normal way. Copy the folders into `~/.claude/skills/` to use them in every project, or into one project's `.claude/skills/` folder. Restart Claude Code and say "start the launch kit." Claude.ai works too — upload each skill folder as its own zip under Settings, then Skills. Building an agent with the Claude Agent SDK works as well: drop the folders into its `.claude/skills/` and turn on skill loading.

What's next isn't a new skill. It's a dashboard. The admin panel now has a products tab for checkout starts, completions, and revenue. That same view will track whatever paid download ships after Launch Kit.

![Launch Kit landing page hero section with headline and Get it for nine dollars button](/blog-images/launch-kit-eight-skills-hand-off-one-shared-brief/landing-page-hero.jpg "The live Launch Kit landing page, with the nine-dollar checkout button in the header.")
