---
slug: "boat-shooter-is-back-116-mb-down-to-2"
title: "116 MB of sprites shrank to 2, and the game is back"
excerpt: "Boat Shooter was pulled offline for two months because its art was too big to host. It's live again at under 4% of the old size, with a hard limit so it can't happen again."
category: "product"
published: true
published_at: "2026-10-19T16:23:30.684Z"
order: 46
---

Bilko Game Academy's first game, Boat Shooter, is live again at [bilko.run/projects/game-academy](https://bilko.run/projects/game-academy/). It sat offline for two months. The fix is one number: 116 megabytes of sprite art shrank down to about 2. That's the difference between a game that loads fast and one that just times out.

## The number: 116.5 MB down to 2 MB

Boat Shooter is a top-down roguelike shmup. Its art was 117 sprite images. Together they totaled 116.5 MB of plain PNG, and the biggest single file was 3.74 MB. Nothing cached them. Nothing compressed them. Every visit pulled the full 116 MB over again. That one game was heavier than everything else on bilko.run put together, so it got pulled offline on August 13 while the art got fixed.

![The Bilko Game Academy lobby screen, showing Boat Shooter ready to queue next to three other game slots](/blog-images/boat-shooter-is-back-116-mb-down-to-2/game-academy-live.jpg "The live lobby at bilko.run/projects/game-academy/ after the relaunch, with Boat Shooter ready to play")

The fix was to turn all 117 sprites into smaller WebP images. The published game now totals 4.2 MB on disk. Those same 117 sprites add up to 2 MB together, less than 2% of their old size. There's also a hard rule now: the game can never publish over 5 MB, gzipped. The same bloat can't sneak back in unnoticed.

## What's fixed, and how to play it now

While the game was down, its link didn't fail cleanly. It bounced you in a loop instead of showing a normal "not found" page. That's fixed too. Any game like it that goes offline now shows a clear message instead of a loop.

Boat Shooter itself is back and loads normally right now. Bilko Game Academy is a free, in-browser game library. Sign in with your bilko.run account and it remembers your progress across devices. Boat Shooter is the first game in it, and you can play it today. No download. Nothing to install. Just a browser tab. Signing in is what lets you close the tab on your laptop and pick the run back up on your phone later.

## Next: a shell built for more than one game

The host also changed a security rule. Now Game Academy can run games built in bigger engines, like Godot or Unity, inside its own page. Before, it only allowed lightweight browser games like Boat Shooter. That matters because a second game is already built behind the scenes. It's wired into the same shell, sitting on a shared player and save system. The two games will share that system, so the next one won't need its own sign-in, its own save file, or its own leaderboard built from scratch. It just plugs into the one Boat Shooter already uses. That second game hasn't shipped to bilko.run yet, so Boat Shooter is still the only game you can play today. But the next relaunch is set up to add a game, not just put this one on a diet.

Boat Shooter was offline for two months over one oversized art folder. It's back now at under 4% of the old size, with a budget that stops it from happening again. The shell underneath it is already built to hold more than one game. Go play it at [bilko.run/projects/game-academy](https://bilko.run/projects/game-academy/).
