---
slug: "four-arcade-games-now-playable-online-with-a-friend"
title: "Four Arcade Games, Now Playable Online With a Friend"
excerpt: "Game Academy's four arcade games used to need two people on one couch. Now a 6-character room code gets a friend into your match from any browser, and local co-op is gone for good."
category: "product"
published: true
published_at: "2026-10-22T16:23:52.331Z"
order: 47
---

Bilko Game Academy's four arcade games used to need two people on the same couch to play a match. Now one person opens [bilko.run/projects/game-academy](https://bilko.run/projects/game-academy/), picks a game, presses Play Online, and gets a 6-character code. A friend in any other browser joins with that code, and you are both in the same match, live.

## A room code gets a friend into your match

Sign in, open one of the three arena games — Tinpot Tanks, Skyline Slam, or Tandem Derby — and press Play Online. The shell builds you a 6-character room code. The code skips letters that look alike, like I and O, so you can read it out loud. Share the code, or send the link it builds, and your friend lands right in your lobby. Empty seats still fill with bots, so you do not need four humans to start.

![The Game Academy lobby showing four game tiles and a Join Room button](/blog-images/four-arcade-games-now-playable-online-with-a-friend/lobby-join-room.jpg "The live lobby on 2026-10-20: four games, and a Join Room button for online play.")

I checked the live site on 2026-10-20. The lobby page shows a Join Room button next to the four game tiles. A join link for a made-up code loads a real sign-in screen instead of a blank page. Both routes are live, not just written. A two-browser test also runs the whole loop by itself: one browser hosts, the other joins by code, and both play a round of Tinpot Tanks over a fake network.

## One human per browser now, not four on a couch

Game Academy used to let you add a second local player to the same browser tab — two people, one couch, one keyboard. That option is gone now. Every browser seats one human. If you want to play with someone else, you go online instead.

![A join-room link for a made-up code showing a sign-in required screen](/blog-images/four-arcade-games-now-playable-online-with-a-friend/join-sign-in-gate.jpg "Opening a join link without signing in shows this gate, not a blank page.")

I compared the home screen before and after the change. The new build, SHA 5caed1e, drops the Add Local Player button, and the Join Room screen now gates behind a sign-in wall instead. Couch co-op meant sitting in the same room with one shared keyboard. An online room means you and a friend can be anywhere, each with your own controls, playing the same match.

## What's still missing

The build that shipped this is SHA b8ce691, live on bilko.run within about 2.5 minutes of publishing. It is 893 KB gzipped, and the accessibility check found zero serious issues and two minor ones. The ticket endpoint that online play needs returns a 401 if you are signed out, exactly as designed.

Online rooms still have real limits. There is no public matchmaking. You can only join a match if someone hands you a code. Reload your tab mid-match and you cannot rejoin; the game treats you as having left. Pong is still offline-only, because it does not yet have the rollback simulation the other three games use to keep two browsers in sync.

Game Academy's four games were couch-only. Now three of them are playable with anyone, anywhere, over a six-character code. Next up: matchmaking, so you do not need a friend who already has the code, and a rollback sim so Pong can join them.
