---
slug: "the-family-screen-now-checks-if-that-class-is-real"
title: "The Family Screen Now Checks If That Class Is Real"
excerpt: "Family Frame's shared family screen can now find local events and kids' classes near you, and it only shows the ones whose sign-up link actually works."
category: "product"
published: true
published_at: "2026-11-12T17:00:00.000Z"
order: 53
---

Family Frame's shared family screen can now go looking for things to do nearby. A pottery class. A weekend festival. A toddler music hour. It only shows your family the ones with a sign-up link that actually works. Before this week, the app could suggest an event. It could not promise the link behind it was real.

![The Family Frame tile on bilko.run, showing its one-line pitch of one warm family screen with 15+ small apps](/blog-images/the-family-screen-now-checks-if-that-class-is-real/family-frame-tile.jpg "Family Frame's project card on bilko.run/projects, where you can open the app.")

## Every event now has to prove it's real

The old Events app could save an event even with weak proof. A listing site was enough, even if the organizer itself was nowhere to be found. That changed this week. A new check sorts every link into one of three kinds: the organizer's own page, a real registration page, or just a listing. An event now needs a named organizer. It also needs a link on that organizer's own site before it is saved at all. A second check makes a real web request to that link. It drops the event if the page is dead or redirects elsewhere. Sign-up events get one more check. Claude's Haiku model opens the organizer's real page itself. It confirms the class is still offered, by the right provider, with a real start date. Only then does the event reach your family's screen. The app also tracks how sure it is. A new event starts at 70% confidence. That climbs to 80% once its link is checked, and to 90% once the page check confirms it. A daily re-check runs the same checks on events already shown. It withdraws anything whose source has since gone dead. A cleanup pass also cleared out older sign-up events from before this policy existed.

## A real day view, with classes pulled into their own shelf

Finding what's happening on one specific day used to mean scrolling the whole calendar. Now each day has its own page. It splits into Morning, Afternoon, Evening, Classes you can sign up for, and Open all day. A seven-day strip lets you jump across days fast. A new filter bar also lets your family narrow things down. Seven groups cover who's going, what kind of thing it is, how far it is, and what it costs, and they combine. Ongoing classes with no single date, like a weekly swim lesson, no longer clutter the calendar. They live on their own shelf instead, split into for the kids, for grown-ups, and for everyone. Every event page also got a Sign Up pill. One glance tells you if something needs you to register before you show up.

![GitHub commit history for the family-frame repository, listing recent commits about the events verification and browse work](/blog-images/the-family-screen-now-checks-if-that-class-is-real/github-commits.jpg "84 commits landed in this repo since the last update, most of them building the Events app.")

Family Frame started as one shared screen for a household: weather, a calendar, photos, household bills, and more. This week adds a new app, Events, and makes it trustworthy before it shows your family anything. The daily re-check means that trust doesn't stop at publish time. It keeps running. This is a personal passion project, still being tested, not a finished product. Look around today at [family-frame.replit.app](https://family-frame.replit.app).
