---
slug: "how-pageroast-went-from-frustration-to-product"
title: "How PageRoast Went From \"I Need Feedback\" to a Product That Roasts Landing Pages for Fun"
excerpt: "The story of building PageRoast — from launching to zero signups, learning CRO the hard way, and turning frustration into a tool that scores landing pages and delivers savage one-liners."
category: "product"
published: true
published_at: "2026-04-04T03:04:43.816Z"
order: 1
---

## The launch that went nowhere

I launched my first product to zero signups. The code worked. The design was decent. The product did what it said it would do. But nobody signed up.

The problem wasn't the product. It was the page selling it.

I didn't know that at the time. I thought "clear" meant the same as "clever." I thought one testimonial from a friend counted as social proof. I thought hiding the price tag made me seem premium. I was wrong about all of it.

## Learning CRO the hard way

Over the next few months, I studied conversion rate optimization — not the theory, the actual frameworks that people use to audit landing pages. Joanna Wiebe on conversion copywriting. Peep Laja on evidence-based design. Harry Dry on marketing examples.

The patterns were obvious once I saw them:

- **Hero section**: Can someone understand what you do in 5 seconds? If your headline needs a subheadline to make sense, the headline isn't working.
- **Social proof**: Real testimonials with full names, photos, and company logos. Not "J." from "a company" saying "great product."
- **Clarity**: Benefits over features. "Save 10 hours/week" beats "AI-powered automation."
- **Conversion architecture**: One CTA above the fold. Not three competing buttons asking for different things.

Most landing pages fail at least two of these. Mine failed all four.

## The tool I wished existed

I wanted a tool that would read my actual page — not a template, not a checklist — and tell me specifically what was broken. Something that applied real frameworks, not just word counts or SEO scores.

That tool didn't exist. So I built it.

## How PageRoast works

PageRoast takes any URL, fetches the page content, and sends it through **Gemini 2.0 Flash** with a carefully calibrated scoring system:

- **Hero Section (25 pts)**: Headline clarity, subheadline specificity, CTA visibility, visual hierarchy
- **Social Proof (25 pts)**: Testimonials with names/photos, trust logos, quantified proof, risk reversal
- **Clarity & Persuasion (25 pts)**: 5-second test, benefits vs features, readability, objection handling
- **Conversion Architecture (25 pts)**: CTA clarity, urgency/scarcity, risk reversal, friction reduction

Each section gets scored independently. You get a total out of 100, a letter grade, section-by-section feedback with specific fixes, and — the part people actually share — a savage one-liner roast.

## The roast was an accident

The roast line wasn't in the original plan. I added it as a debugging artifact — a quick summary to validate the AI understood the page. But when I showed the tool to friends, they screenshotted the roast and shared it. Nobody screenshotted the score breakdown.

That's when I realized: **the roast is marketing. The score is the product.**

People come for the entertainment. They stay for the actionable fixes. And they share the one-liner, which brings more people. It's a viral loop that doesn't feel like marketing because it's genuinely funny.

## What I'd do differently

I'd ship sooner. The first version was embarrassing — rough UI, imprecise scoring, roast lines that weren't funny enough. I delayed three weeks polishing. Those three weeks taught me nothing that user feedback didn't teach in three days.

I'd also charge from day one. Free users gave zero feedback. Paid users told me exactly what was wrong.

## What's next

PageRoast is one of 7 tools on [bilko.run](/projects). Each one takes something that used to require a specialist and makes it available in 30 seconds through AI.

- [HeadlineGrader](/projects/headline-grader) scores headlines against 4 proven copywriting frameworks
- [AdScorer](/projects/ad-scorer) grades ad copy for Facebook, Google, and LinkedIn
- [ThreadGrader](/projects/thread-grader) analyzes X/Twitter threads for viral potential
- [EmailForge](/projects/email-forge) generates 5-email sequences using proven persuasion frameworks
- [AudienceDecoder](/projects/audience-decoder) identifies who actually follows you

Try [PageRoast](/projects/page-roast) — your first roast is free. Just don't blame me when the score hurts.

## FAQ

**Is PageRoast actually useful or just a joke?**
Both. The roast line is entertainment. The 4-section breakdown with specific fixes is real CRO analysis. Founders use it to improve their pages, then share the roast for clout.

**How accurate is the scoring?**
It's calibrated against reference examples — a "Tips for Better Marketing" headline scores below 35, while a data-rich headline with proof elements scores 85+. The AI uses the full 0-100 range, not the compressed 50-80 that most AI tools default to.

**What does it cost?**
First roast is free. After that, $1 per credit or $5 for 7. Same credits work across all bilko.run tools. No subscriptions.