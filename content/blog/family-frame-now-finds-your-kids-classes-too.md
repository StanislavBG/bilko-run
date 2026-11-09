---
slug: "family-frame-now-finds-your-kids-classes-too"
title: "Family Frame Now Finds Your Kids' Classes Too"
excerpt: "Family Frame's Events app now treats a repeating kids' class differently from a one-day event, with its own shelf, a new day view, and a one-tap sign-up link."
category: "product"
published: true
published_at: "2026-11-09T17:00:00.000Z"
order: 52
---

Open one day on Family Frame's wall screen now. It shows every swim lesson or art class your kids can still join that day. The sign-up link is already attached. You don't have to go find it yourself.

## A swim class is not a pumpkin festival

Family Frame is a free, one-screen home hub. It has 15+ small apps for one household: photos, a shared calendar, chores, bills. Big type, few buttons, built for a wall or tablet screen. Its Events app already searched the web for local events near your address. It showed you a list to say yes or no to. But a pumpkin festival happens once, on one date. A swim class runs every Tuesday for ten weeks, and you need to know if it still has an open spot. Until this week, the pipeline searched for both the same way. Classes got lost in the same list as one-day events.

![The Family Frame card on bilko.run's Projects page, showing its tagline and an Open button](/blog-images/family-frame-now-finds-your-kids-classes-too/projects-tile.jpg "Family Frame's tile on bilko.run, where the Events app lives")

## Classes get their own shelf and their own day view

That changed over the last few days. The pipeline now runs a separate search just for classes and lessons. On the Events screen, classes get their own shelf. It groups them by who in the family they fit, instead of mixing them into the calendar. A new day view opens at one date. It splits the day into Morning, Afternoon, Evening, and a Classes you can sign up for section. A seven-day strip lets you jump across dates. You can now name which family members are going to an event, not just tap a generic "Going." A class's own page also carries a one-tap "Sign up" pill. It links straight to the registration page, so nobody has to search a venue's website for it. In four days, 48 real commits landed in the family-frame code. 35 of them touch the Events app, and 16 touch classes by name. The filter bar on the Events screen now has seven groups. One of them is "Who," so you can filter down to just one kid's activities.

![The family-frame GitHub repo's events design brief, showing the Events app's purpose and screen plan](/blog-images/family-frame-now-finds-your-kids-classes-too/events-design-doc.jpg "The public design doc that defines the day view and filter groups")

## Try it, and what's still moving

Family Frame is live at [family-frame.replit.app](https://family-frame.replit.app). Its code is public at [github.com/StanislavBG/family-frame](https://github.com/StanislavBG/family-frame). You turn Events on by giving your address and consent inside the app. A local search then starts finding events and classes near you. The same week this shipped, the pipeline's own refresh order got tuned too. It now re-checks events closer in time first. Its daily run budget was also raised, from under four hours to four. That way, classes near their sign-up deadline don't go stale while farther-out ones wait their turn. Family Frame was a screen that showed you local events. Now it tells a class from a one-day event, and gets you to the sign-up page in one tap. Next, that re-check order needs to hold up as more households turn Events on.

![The family-frame GitHub repo's commit list for Nov 2, showing same-day events-pipeline fixes](/blog-images/family-frame-now-finds-your-kids-classes-too/commit-list.jpg "Commits landing the same day this post covers, on GitHub")
