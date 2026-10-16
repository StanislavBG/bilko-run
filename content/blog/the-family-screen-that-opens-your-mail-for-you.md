---
slug: "the-family-screen-that-opens-your-mail-for-you"
title: "The Family Screen That Opens Your Mail For You"
excerpt: "Family Frame just got a public tile on bilko.run, and its newest trick is reading your forwarded mail and sorting it onto the family screen for you."
category: "product"
published: true
published_at: "2026-10-16T03:17:41.700Z"
order: 45
---

Family bills, daycare notes, and the shared calendar usually sit in different inboxes. Someone has to remember to check each one. Family Frame just got a public door on bilko.run, and its newest move is reading your forwarded mail for you.

## A screen built for the wall, not your pocket

Family Frame is a shared screen for one house. You mount a tablet or smart screen on the wall. It shows the house's photos, a shared calendar, the weather, and songs or a radio station for the kids. Everything is sized to read from across the room. The design uses big fonts and few buttons, so nobody has to tap around to see today's plan. The project has run for months, but today it joined bilko.run's Projects page as a live, public tile. Its tagline there: "the window between homes."

![The Family Frame card on bilko.run's Projects page, showing its tagline and an Open button](/blog-images/the-family-screen-that-opens-your-mail-for-you/projects-ring.jpg "Family Frame's new public tile on bilko.run, live today")

## Forward a bill, it sorts itself

A household can now forward mail to a private address made just for that house. A timer checks that address every five minutes. It drops new mail straight into the family's mailbox inside Family Frame. Mail from a sender the house has not approved gets held until someone approves it.

Turn on the new Organize setting, and it goes further. A forwarded bill becomes a dated record with the amount and the due date. A forwarded daycare report becomes a record tied to that one kid. Each email gets tagged "bill" or "daily report," so you can scan the inbox fast. The step is opt-in and capped at 20 mail-reading calls per run. Mail past that cap still arrives; it just skips sorting. Only the subject and text go to the classifier, never your address, names, or birthdays.

![A GitHub page showing Family Frame's household-email guide, explaining how forwarded mail is read and organized](/blog-images/the-family-screen-that-opens-your-mail-for-you/household-email-doc.jpg "The household-email guide that documents the new Organize step")

## Daycare can publish straight to the fridge

Family Frame also added a People view today. Pick one family member, and the screen filters the calendar, inbox, and photos down to just them. Any section with nothing to show stays hidden.

The more interesting part is who can fill that view. A daycare or school can connect its own agent straight to your account. It uses a shared protocol called MCP. From there, it can post a kid's nap times, photos, and lesson notes right onto your dashboard, with no email forwarding needed. The code behind all of this, including the mail and People features, is public. Read it at [github.com/StanislavBG/family-frame](https://github.com/StanislavBG/family-frame).

![The public family-frame GitHub repository, listing recent commits for the mail and household-inbox features](/blog-images/the-family-screen-that-opens-your-mail-for-you/family-frame-repo.jpg "family-frame on GitHub: public, with today's mail and People commits")

Family Frame started as a private screen for one house. Now it has a public tile on bilko.run, your forwarded mail can sort itself, and a daycare can publish a kid's day straight to the wall. The honest gap: it does not read attachments yet. A PDF bill or a photo stuck in an email still needs a person to open it. Try the live screen at [family-frame.replit.app](https://family-frame.replit.app).
