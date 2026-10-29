---
slug: "the-web-remote-now-drives-any-computer-you-pair"
title: "The web remote now drives any computer you pair, not just one"
excerpt: "Session Manager's phone remote used to pair with one computer at a time, through a six-step dance of codes. Now you pair each computer once and switch between them with a tap."
category: "product"
published: true
published_at: "2026-10-29T16:00:00.000Z"
order: 49
---

Pairing a second computer to Session Manager's phone remote used to take six steps and two separate codes. Now you pair each computer once and switch between them with one tap. Session Manager is a free desktop app that runs your Claude Code sessions; the web remote lets you check on them from your phone.

## Pairing two computers used to mean a six-step dance

The old flow, called "Remote machines," needed a host computer and a client computer. The host generated an 8-character code. The client entered a second 8-character code of its own. Then both screens showed a 6-digit number, and you had to confirm they matched before anything connected. Miss a step, and you started over.

The new flow drops the host-and-client idea. You pair each computer once, straight from your phone. On that computer, open Settings, then Phone remote, and turn on "Allow remote control from the web." Do this once per computer you own — say, a laptop you carry and a desktop that stays home. Then open [bilko.run/projects/session-manager](https://bilko.run/projects/session-manager/), sign in, and tap your computer in the "Your computers" list in the app's header. The old pairing code was deleted this week, not hidden behind a setting. There's no leftover path back to the six-step version.

![A Field Manual chapter page titled "Around the cockpit," showing the chapter that documents Session Manager's screens](/blog-images/the-web-remote-now-drives-any-computer-you-pair/manual-cockpit-tour.jpg "Chapter 11 of the free Field Manual, rewritten this week to teach the web remote instead of Remote machines.")

## Each computer still keeps its own lock

Driving several computers from one phone doesn't mean they share one connection. Each paired computer keeps its own end-to-end encrypted session. The app only trusts the one computer you're actively switched to. The Connect screen also now asks each desktop for its real name and operating system before listing it. Instead of guessing between two blank rows, you see something like "MacBook Pro" next to "Living Room PC." That's a small change, but it's the difference between picking the right machine with confidence and hoping you clicked the right one.

## The chat view got easier to read, the same week

The same release that shipped the device switcher also rewrote the remote's chat screen. Long conversations now load in pages instead of one long scroll. A pending bubble shows while a reply is on its way. You can tell the agent is working instead of wondering if your message went through. Both changes shipped in Field Manual version 2.3.0, released October 23, alongside the desktop app's own version bump to 0.123.1.

![GitHub repository page for claude-code-session-manager, showing recent commits about removing the old remote client and the manual version bump](/blog-images/the-web-remote-now-drives-any-computer-you-pair/sm-github-repo.jpg "The project's public commit history, confirming the change shipped and is live.")

Session Manager started as a desktop cockpit for Claude Code sessions. Now you can check on more than one of your own computers from a single phone or browser. You pair each one once, instead of running a two-machine pairing ceremony every time. Next, keep an eye on the chat view — it's the part getting the most attention right now. The app and its Field Manual are both free. The code is open source at [github.com/StanislavBG/claude-code-session-manager](https://github.com/StanislavBG/claude-code-session-manager).
