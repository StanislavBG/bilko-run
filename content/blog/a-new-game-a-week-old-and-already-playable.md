---
slug: "a-new-game-a-week-old-and-already-playable"
title: "A New Game, A Week Old, Already Playable"
excerpt: "A spaceship game started as an empty cosmos shader eight days ago. It's now a three-tier game with a real tutorial, six enemy types, and a deleted experiment worth explaining."
category: "build-log"
published: true
published_at: "2026-08-27T16:00:00.000Z"
order: 37
---

Eight days ago this was one commit: an ambient starfield and nebula shader in Godot, nothing else. It's now a real, three-tier game — a Universe Map of solar systems joined by warp lanes, each system a network of planets joined by transit lanes, and landing on a planet drops you into a 15-minute survivors-style combat run. A fresh save starts parked at Mercury inside an authored 8-planet tutorial ("Escape the Solar System") before the rest of the galaxy opens up; everywhere past Sol is deliberately locked off for now. Nine enemy archetypes, including six added this week, plus elite affixes and a boss fight, plus a meta-progression currency that upgrades your ship between runs.

The decision worth writing down: for one night in the middle of this build, the game had an AI design assistant built into it — a chat drawer that spawned a real, long-lived `claude` CLI process and streamed its output straight into the game's UI, meant to let you ask for design help without leaving the editor. It worked, with one very specific Godot gotcha: after the child process exits, Godot 4.7.2's pipe reader never flips its own "end of file" flag, so the code had to poll whether the process was still alive instead of trusting the pipe to tell it. It shipped, ran for a session, and then got deleted a week later. That's not a failure — trying an idea fast and cheap enough to also throw away fast and cheap is the actual point of building this way.

The honest admission: a spawn bug made the whole game look broken in a specific way — landing on a planet would either hang on a white screen forever or drop you into an empty arena with nothing in it. Two separate bugs were stacked on top of each other. One file failed to parse at all because an untyped array left a loop variable ambiguous, so the level loader silently loaded with nothing in it. Separately, the code that entered a level was calling into it in the same breath as adding it to the scene tree, racing ahead of Godot's own object initialization — so even a correctly-loaded level could still throw against a null reference. Both had to be found and fixed together; fixing either alone would have looked like it worked and wouldn't have.

Worth knowing: about 5 of the 96 commits this week were merged in directly from an autonomous scheduler running dev-work jobs against this repo, not typed by hand — the rest is manual. No tile on [/projects](/projects), and no GitHub remote at all yet; this one's entirely local for now.