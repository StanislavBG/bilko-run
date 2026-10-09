---
slug: "10-tools-solo-what-i-learned-shipping-bilko-run"
title: "10 Tools, Solo: What I Learned Shipping bilko.run"
excerpt: "I built 10 AI tools in one sprint — from landing page audits to browser-based private document analysis. Here's what actually worked, what surprised me, and what I'd do differently."
category: "build-log"
published: true
published_at: "2026-04-04T13:12:19.860Z"
order: 4
---

## The number that surprises people

10 tools. One person. One sprint.

Not 10 MVPs. Not 10 landing pages with "coming soon" badges. 10 fully functional tools with scoring engines, compare modes, generate modes, personal libraries, cross-tool promotion, a blog, a payment system, and an admin dashboard.

People ask how. The honest answer: AI as a co-pilot and a very specific architecture decision.

## The architecture that made it possible

Every tool on [bilko.run](/projects) follows the same pattern:

1. **Input**: User pastes text (headline, ad copy, thread, email, document, tool list, URL)
2. **Analysis**: Gemini 2.0 Flash processes it against a calibrated scoring prompt
3. **Output**: Score card + section breakdown + actionable fixes + roast/verdict

The frontend uses a shared component kit — ToolHero, ScoreCard, SectionBreakdown, CompareLayout, Rewrites, CrossPromo. Each tool page is 200-400 lines, not 1,000+. The heavy lifting lives in reusable components.

The backend follows the same pattern: validate input, check auth, rate-limit, call Gemini, parse JSON, save to DB, return results. A shared helper handles the boilerplate for generate endpoints.

This means adding a new tool is a matter of writing a scoring prompt and a page layout. Not building infrastructure from scratch.

## What each tool taught me

**[PageRoast](/projects/page-roast)** — The roast line was an accident. I added it as a debugging artifact. People screenshotted it and shared it. Lesson: the most shareable feature isn't always the most useful one.

**[HeadlineGrader](/projects/headline-grader)** — Adding a Generate mode (not just scoring) doubled the tool's value. People who came to score a headline stayed to generate five better ones.

**[AdScorer](/projects/ad-scorer)** — Platform-specific scoring matters. A great Facebook ad is not a great Google ad. The same copy scores differently depending on where it runs.

**[ThreadGrader](/projects/thread-grader)** — The X algorithm data (reply = 27x a like, bookmarks = 5x) surprised users. They knew threads mattered but not why specific structures worked.

**[EmailForge](/projects/email-forge)** — The deliverability score was inspired by Instantly.ai. Flagging spam trigger words before sending prevents emails from dying in spam folders.

**[AudienceDecoder](/projects/audience-decoder)** — The personality typing (Provocateur, Amplifier, Educator, Slow Burn, Generalist) gave people an identity to rally around. More shareable than raw engagement numbers.

**[LaunchGrader](/projects/launch-grader)** — Born from a Reddit thread with 431 comments asking for product reviews. The demand was obvious once I looked for it.

**[StackAudit](/projects/stack-audit)** — "The SaaS model is quietly falling apart" (461 upvotes, 283 comments). Four corroborating threads. Clear pain, clear gap, clear solution.

**[Stepproof](/projects/stepproof)** — The hardest to build as a web service. YAML parsing, multi-provider LLM adapters, assertion engines — all ported from a CLI tool into a Fastify endpoint.

**[LocalScore](/projects/local-score)** — The outlier. Runs entirely in the browser via WebGPU. Zero server involvement. Free forever. Timed with Gemma 4's launch. Our most technically interesting tool.

## What surprised me

**Credits beat subscriptions.** Every Reddit thread about SaaS pricing complaints is about subscriptions. $1/credit with no recurring charge removes the biggest objection.

**Cross-tool handoffs work.** "Turn this headline into ad copy" and "Generate an email sequence from this thread" connect the tools into workflows. No single-tool competitor can do this.

**Below-fold content matters more than I thought.** Educational sections (How It Works, FAQ, scoring explanations) keep users on the page and build trust. Pages with this content have lower bounce rates.

**The blog drives tool discovery.** Posts about how tools were built (with real Reddit threads as evidence) attract exactly the right audience.

## What I'd do differently

**Ship the blog earlier.** I built 10 tools before writing a single blog post. The blog should have been tool #1 — it's the top of the funnel.

**Start with 3 tools, not 10.** PageRoast, HeadlineGrader, and StackAudit cover three distinct verticals and validate the platform model. The other 7 could have been added based on usage data.

**Test the payment flow sooner.** I added Stripe early but didn't test the full purchase-to-credit-to-usage flow with real users until late.

## The tools

All 10 are live at [bilko.run/projects](/projects). Your first analysis is free. After that, $1/credit or $5 for 7. [LocalScore](/projects/local-score) is completely free — it runs in your browser.

If you're building something and need marketing help, start with [PageRoast](/projects/page-roast). If you're spending too much on tools, start with [StackAudit](/projects/stack-audit). If you have sensitive documents, start with [LocalScore](/projects/local-score).

## FAQ

**Did you really build all of this alone?**
Yes, with AI as a co-pilot. Claude for architecture decisions, code reviews, and the copy you're reading. Gemini for the tool analysis engines. The code is mine; the speed is AI-assisted.

**How long did it take?**
The core platform (10 tools + blog + payments + admin) shipped in one intensive sprint. Each tool takes 2-4 hours when the architecture is reusable.

**Is it profitable?**
Early. The credit model means every use generates revenue. No free-tier subsidization problem.