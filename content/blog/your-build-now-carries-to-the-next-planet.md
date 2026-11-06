---
slug: "your-build-now-carries-to-the-next-planet"
title: "Your Build Now Carries to the Next Planet"
excerpt: "Escape Velocity used to send you into each new planet close to a fresh start. Now every upgrade you picked rides along to the next world, and the victory screen says so."
category: "product"
published: true
published_at: "2026-11-02T17:00:00.000Z"
order: 50
---

Escape Velocity used to send you into each new planet close to a fresh start. Now every upgrade you picked on one world rides along to the next. The victory screen tells you it happened.

## What shipped: a build that survives the trip

[Escape Velocity](https://bilko.run/projects/escape-velocity/) is a free, keyboard-only space game. You fly from Mercury outward, fight each planet's boss, and spend Core Shards at the Galaxy Café between stops. Until this week, each new planet still started your fight close to scratch. Now every upgrade card you pick gets saved. The moment you win, the game replays those picks at the start of the next planet. Your build keeps the dash upgrade, the extra weapon, the health boost — all of it. You no longer rebuild it from level one each time. The victory screen now prints a line for this too. It names the level you're carrying forward, so you see the carry-over happen, not just feel it.

## The one decision: lock the class so carry means something

Before this change, the Café's shop ended in a "Change playstyle" row. You could reopen it between any two planets and swap your whole class build. That stopped making sense once a build carries forward: swapping classes would throw away the very progress the game now saves. So picking a class became a one-time choice, forced before you even reach Mercury. Choose it once, and the Café's row stops offering a swap. It shows your class gear instead, as you earn it. Locking the class is what makes the carry feature mean something — without the lock, a mid-run swap could undo it.

![The Escape Velocity landing page with its Click to play button, free to start](/blog-images/your-build-now-carries-to-the-next-planet/ev-landing.jpg "Free, keyboard only, no sign-in required to play.")

## Bigger fights, a faster open, and proof it runs smoother

Enemies now render 1.35 times bigger. Bosses render 1.3 times bigger. Five bosses got new three-quarter-angle art this week; before, the view was flatter. The first wave of a run shows its warning in half a second now, not eight. None of this would matter if the web build couldn't hold a steady frame rate, so that got measured too. The three hardest Sol fights were running 38 to 51 frames a second, with up to 93% of frames landing late. One cause explained most of it: a background shader was redrawing the whole sky every frame. Hiding just that shader put all three fights at a locked 60 frames a second. The game is free to try, no install: WASD flies, Space dashes, and you'll see the "Level carried" line the first time you clear a planet.

Escape Velocity used to reset you planet to planet, and let you rebuild a different class each stop. Now your build travels with you, and the class you pick at the start is the one you fly with for the run. Next up: Pluto, the campaign's last stop, stays locked until every other planet is cleared. The performance work has one loose end of its own — the diagnostic flag used to find the sky-shader slowdown still needs to become a permanent, committed option, not a one-off patch.
