---
slug: "a-minesweeper-that-never-makes-you-guess"
title: "A Minesweeper That Never Makes You Guess"
excerpt: "MindSwiffer only ships boards you can solve by logic. No coin-flip cells, free hints, and a calm default skin that renames mines to pebbles."
category: "product"
published: true
published_at: "2026-11-05T17:00:00.000Z"
order: 51
---

Every Minesweeper player knows the moment: two covered cells left, a 50/50 shot, and no way to know which one hides the mine. You click, you lose, and it was never really your fault. MindSwiffer, one of Bilko's browser games, builds its boards so that moment does not happen.

## No more coin-flip cells

MindSwiffer's board generator does not just drop mines at random and hope. It builds a board, then runs a solver on it. The solver tries to clear the whole board using pure logic, starting from your first click. If it gets stuck, the generator swaps one mine for a different cell and tries again. It repeats that until the board can be solved end to end, no guessing. The game's own explainer says it straight: boards only ship if they are solvable by deduction. On the rare try where deduction stalls anyway, that one game falls back to a plain random board. It gets marked "Degraded," so you always know whether logic or luck decided it. No-guess generation is on by default, nothing to turn on yourself.

## A hint that proves itself, not a wall of ads

New to Minesweeper, or just stuck? MindSwiffer's hint button does not nudge you at random. It runs the same kind of logic the board generator uses. It only points at a cell it can prove is safe, or prove is a mine. Hints are free, too. That matters for who this game is built for: people who want a real puzzle without paying or sitting through an ad to get unstuck. The project's own tagline says it plainly: "Minesweeper, swept clean. No 50/50s, no ads, no nonsense."

![The live MindSwiffer board mid-game, showing a solved cascade of numbered cells](/blog-images/a-minesweeper-that-never-makes-you-guess/ms-board.jpg "The default Cozy Sweeper board, captured live — numbers show how many mines touch each covered cell.")

## Two skins, one puzzle underneath

Open MindSwiffer today and you land on its calm default look, called Cozy Sweeper. Covered cells are "patches," mines are "pebbles," and undo is "take it back." There are three soft color palettes to pick from. Prefer the classic look? One click swaps to a traditional grid. It opens on a small 5x5 starter board with a line that tells you what you are getting into: "Hints are free. You can't really lose right now." Under either skin, it is the same no-guess engine. That logic lives in a repo now at version 0.8.0, backed by 42 test files that check it still works.

![The classic-layout welcome screen, with the headline Welcome to MindSwiffer and a 5x5 starter grid](/blog-images/a-minesweeper-that-never-makes-you-guess/ms-classic-menu.jpg "Switching to the classic layout opens on a no-lose starter board, free hints included.")

Classic Minesweeper has lived with the coin-flip problem for decades. MindSwiffer's answer is to prove a board is fair before it ever reaches you. Then it backs that up with a hint system that proves its own suggestions, instead of guessing on your behalf. Play it free at [bilko.run/projects/mindswiffer](https://bilko.run/projects/mindswiffer/). Next up for the game: more difficulty presets, and a deeper replay and achievements layer on top of the same solver.
