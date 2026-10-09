---
slug: "the-academy-course-is-now-just-about-claude"
title: "The Academy Course Is Now Just About Claude"
excerpt: "Academy swapped its 20-lesson generic-AI curriculum for a 12-chapter course on being a Claude user, then found a real bug by testing all 15 pages instead of 6."
category: "product"
published: true
published_at: "2026-07-28T16:00:00.000Z"
order: 29
---

[Academy](/projects/academy/) used to teach "what is an AI" in general — 20 lessons across 3 modules, the kind of foundations content that could describe any chatbot. This week it became a course about one specific thing: how to be a Claude user. 12 chapters, 4 modules — Meet Claude, Working In Claude, Prompting, Trust And Next Steps — plus a rewritten welcome page. The glossary picked up Claude-specific terms it never needed before, like Cowork and Claude in Chrome. It's a smaller course than it was (12 chapters instead of 20 lessons) and a more useful one, because it stops trying to be neutral about a choice the reader already made by showing up.

The swap touched 59 files — 4,075 lines added, 3,426 removed, so most of the old curriculum is gone, not layered under the new one.

The interesting part is what the follow-up commit caught. Academy's design-review testing had only ever hit 6 hardcoded routes with Playwright screenshots and an axe-core accessibility pass. Widening that to all 15 pages — the welcome page, all 12 chapters, both demo fixtures — surfaced a real bug: the "you're done" screen was rendering multiple identical "Start over" cards from a count-based loop, each one linking back to the course root instead of lesson 1, directly contradicting its own label. It had shipped invisibly because nothing was testing that page. Now all 15 pages get the same audit, and there's one correct card.

Also shipped: a docs fix admitting a real risk rather than a hypothetical one — `AUTHORING.md` now says plainly that `pnpm build` does not publish, because `publish_static_project` owns the copy and its gates, and hand-rolling a scratch script to skip that "silently skips the a11y and audit gates." Someone was tempted to take the shortcut; the doc exists so the next person isn't.

**What's next:** the new curriculum is live at [/projects/academy/](/projects/academy/) — if you've read the old foundations lessons, this is a different course, not a v2 of the same one.