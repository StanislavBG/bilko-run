---
slug: "all-green-three-bugs-the-regression-pass-caught"
title: "Five redesigns, three bugs the \"all green\" reports missed"
excerpt: "Five Claude Design handoffs. Five implementation agents reported full green tests. A paranoid second-pass regression agent caught three would-have-shipped-broken bugs the green tests missed. This is the post about the gap between \"tests pass\" and \"the thing actually works.\""
category: "lessons"
published: true
published_at: "2026-05-16T22:14:32.466Z"
order: 12
---

Five Claude Design handoffs landed on Monday. Five implementation agents shipped them, each reporting full green tests. A second-pass regression agent ran behind each one — and caught three bugs that would have shipped broken to production. This is the post about what the green reports didn't say.

If you read [last week's post](/blog/week-of-six-games) — six games in seven days, the host-as-platform pivot, the static-path contract — what you didn't see was what comes after launch week: hardening. This is that. Six polish rounds on Monday, five Claude Design redesigns on Monday afternoon, and the discipline that kept three near-misses out of production.

## One Monday: six polish rounds before noon

Here is Monday's commit timeline, in Pacific Time:

- **00:02** — full-bleed layouts + onboarding tutorials, all five siblings
- **01:13** — v2 polish: 10 visual + UX enhancements per game (themes, win celebrations, microinteractions, daily streak strips, personal stats, settings sheets, synthesized web-audio SFX + haptics, per-game juice)
- **07:39** — round-3 deep features: achievements, PWA installs, replay, custom builders
- **08:17** — round-4 simplicity + smoothness for new players (progressive disclosure for returning users)
- **08:53** — round-5 validated game-state hardening (schema migration, solver verification, deterministic seeds, corrupted-state recovery, formal state machines, multi-tab handling, dev-only diagnostics)
- **12:03** — round-6 framerate + performance: 60fps under every interaction, heavy work moved off the render path, main-thread parse + bundle trim

Each round was a parallel fan-out: one Claude Code session per game, each shipping to its own sibling repo (`~/Projects/Cellar`, `~/Projects/Sudoku`, `~/Projects/MindSwiffer`, `~/Projects/FizzPop`, `~/Projects/Etch`), with a host-side drop refresh at the end. Five repos times six rounds is thirty self-contained agent invocations in twelve hours. The contract worked. The agents stayed in their lanes. None of them broke another.

This is the part that has stopped surprising me. The interesting part is what happened next.

## The redesign handoffs and the second-pass discipline

Mid-afternoon, five Claude Design handoffs landed — one per game. Real design briefs: visual direction, palette, typography, ambient detail, motion language.

- **Cellar** got a warm wood-cellar treatment — oxblood-and-cream cards, EB Garamond serif, amber lamp glow, italic *Cellar* wordmark, "Cellared." confetti on a win.
- **Sudoku** got paper-first — board fills the viewport via ResizeObserver, auto-notes default flipped to false, a four-button action row, an "N left" pad.
- **MindSwiffer** got Cozy Sweeper — Tearoom/Garden/Parlor palettes, flag-first toggle, "Take it back" 3-undo mine recovery, a generous 7×7 default.
- **FizzPop** got cocoa-and-cream Fuzzy Pop — tilting cannon SVG, dotted aim with wall bounces, a landing-spot ring, color+shape bubbles.
- **Etch** got Sleepy Cat — segmented Fill/Mark-empty pen, tap-and-drag, four palettes, a calm progress bar (no timer), confetti and a cat-color reveal on a win.

Five implementation agents — one per repo — built each redesign. Each reported back: tests green, bundle under budget, drop refreshed.

Then five **independent regression-validation agents** opened the same five repos and ran every relevant test, including the ones the implementation agents didn't think to run.

This is the discipline. It is also the thing that almost wasn't a habit. We added "always pair a redesign with a paranoid follow-up" to the standing rules after this week burned us twice. The cost is one extra agent invocation per redesign. The savings are below.

## Three would-have-shipped-broken bugs

### 1. Cellar's Service Worker stuck on v0.7

Cellar v0.8.0's `public/sw.js` shipped with `const VERSION = 'cellar-v0.7.0'`. The implementation agent updated `package.json`, updated the manifest, updated every component — and left the SW version literal alone. Service Worker invalidation is keyed off that string. Every existing v0.7 PWA user would have stayed on the v0.7 cache forever. The new wood-cellar chrome would have shipped to nobody who had installed the app.

Severity: critical. Fix: bump the literal, add a test that asserts SW VERSION matches `package.json#version`. The host-level fix — coming next week — is to template the SW VERSION at build time.

### 2. Sudoku's invisible undo

Sudoku's redesign rewrote `GridSlot.tsx` and kept a local `useState` board *alongside* the Zustand store. Undo, redo, new-game, multi-tab resume, and cloud-load all dispatched the right events and updated the store correctly. The visible grid never re-rendered.

The existing Cmd+Z test was green because it asserted that the undo *bus event* was dispatched. It was not asserting that the grid actually rolled back. Bus-dispatch is a proxy invariant; visual rollback is the actual one. The test had been wrong since the day it was written; the original implementation just happened to make it look right.

Severity: critical. Fix: `GridSlot.tsx` reads from the store directly, `bus-bridge.ts` seeds DEV_PUZZLE on first interaction, and the test now asserts the cell text actually changes.

### 3. MindSwiffer's lose-flow test never ran

MindSwiffer's regression agent ran `pnpm test:unit` and got a real failure: `tests/state/store.test.ts` lose-flow was red. The cozy redesign added a "take-back" mechanic with its own store; `resetStore()` resets the main store but not the cozy one. The lose-flow test asserts that resetting a lost game clears all state. The implementation agent had reported "tests pass" — but they hadn't actually run `test:unit`. They had run the e2e suite, seen green, and called it.

This is the failure mode that earned its own line in the standing rules: **"all tests pass" reports aren't all the tests**.

## The cross-game patterns worth fixing structurally

The same week's redesigns exposed three patterns that aren't bugs in any one game but will become bugs in every future game if we don't fix them at the host level:

1. **SW VERSION strings hand-maintained.** Templated from `package.json#version` at build time, this entire bug class disappears. Filed as a `host-kit` task.
2. **Manifest `gitSha` drift.** FizzPop and Etch both shipped initial drops with the *previous* version's `gitSha` because the build script didn't auto-inject it. The regression agents rebuilt and re-dropped in both cases. The `manifest` CLI should always inject `git rev-parse --short HEAD` at build time.
3. **"All tests pass" reports aren't all the tests.** Two of five redesign agents reported full green test runs while skipping at least one suite. The host-level guard is to make every sibling's `pnpm build` script enforce `pnpm test:unit && pnpm test:e2e` as a precondition before `dist/` is allowed to land. The implementation agent can still ship — but the build itself will refuse if either suite is red or unrun.

Ten more fix-now items came out of the regression sweep — Cellar's PWA splash flashing white, FizzPop's goal-banner progress bar stuck at 0% from a reference-keyed cache, Etch's tap-and-drag toggling instead of setting, MindSwiffer's cozy mode having no inverse — each one a separate PRD, each one queued to a parallel-group slot in the scheduler.

## What we'd do differently

Make the regression agent the contract, not the convention.

This week the second-pass agent caught real bugs three times. Last week it caught two. The pattern is two months old: any time an agent reports "all tests pass" after a non-trivial structural change, the failure rate of *actual* greenness is somewhere around 30%. Not because the agents lie — because the test surface is bigger than any single fan-out remembers to cover.

The host-side fix is to make the build refuse to produce a `dist/` until both unit and e2e suites have run cleanly in the same shell invocation. That's a `host-kit` `prepublish` hook plus a per-sibling `package.json` script. We're shipping it next week. The agent-side fix is already in the playbook: when you ask Claude Code to do a redesign, you also queue the paranoid follow-up. Don't ask, don't assume — queue.

## Calling it a week

That is the post. Six polish rounds Monday, five design handoffs Monday afternoon, three near-misses caught by a paranoid second pass, ten PRDs queued for next week, and a host-level fix planned to make this class of bug structurally impossible.

Taking a few days off. The platform is the platform — it will keep auto-deploying through the rest of the week, the games will keep being playable, the AI tools will keep grading and scoring, and the daily [Outdoor Hours](/projects/outdoor-hours/) snapshot will keep landing on the hour without me. That is the point of the contract.

If you want to see what a Monday of hardening feels like in your browser:

- [Sudoku](/projects/sudoku/) — paper-first, viewport-fill, no spreadsheet vibes
- [MindSwiffer](/projects/mindswiffer/) — Minesweeper in a tearoom, with take-backs
- [FizzPop](/projects/fizzpop/) — daily bubble shooter, cocoa-and-cream chrome
- [Etch](/projects/etch/) — Picross, calm progress bar, sleepy cat reveal
- [Cellar](/projects/cellar/) — FreeCell, wood-cellar chrome, "Cellared." confetti

## FAQ

**Why six polish rounds in a single Monday?**
Because they were independent. Themes, deep features, simplicity for new players, state hardening, framerate — none of those steps blocked any other. Five sibling repos times six rounds is thirty parallel agent invocations; the platform serializes nothing. The bottleneck is review, not invocation, and rounds are a natural review unit: one round, look at the diffs across all five, queue the next.

**Why design handoffs from Claude Design rather than the implementation agent designing?**
Specialization. A redesign handoff written by a design agent — palette, typography, motion, ambient detail — gives the implementation agent a target to *hit*, not a target to *invent*. It's the same reason engineers like specs: the constraint shrinks the search space. The implementation agent doesn't have to defend taste decisions; it just has to land the brief.

**Is the regression-validation agent slowing you down?**
On wall-clock time, yes — it adds about 30% to the redesign cycle. On total time-to-correct-ship, no. The three bugs caught this week would each have cost an evening of debugging once a real user reported the symptom, plus the trust hit of having shipped broken software. The cycle cost is paid in agent time, which is the cheap kind of time.

**What's the host-level fix?**
Two things, both shipping next week. (1) The `host-kit` `prepublish` hook will refuse to emit a `dist/` until `pnpm test:unit && pnpm test:e2e` have both completed cleanly. The implementation agent can no longer report "tests pass" without the tests having actually run. (2) The manifest CLI will inject `gitSha` and `version` from git and `package.json` at build time, eliminating two whole classes of drift (the SW VERSION literal and the manifest gitSha staleness).

**Is this an indictment of AI-agent coding?**
No. It's the opposite. The same week that produced three near-misses also produced thirty parallel agent invocations across five sibling repos in twelve hours, with zero broken siblings and a 50% drop in median bundle size for the games over v1. The lesson is not "agents are unreliable." The lesson is that an agent reporting "tests pass" is evidence, not proof — and proof is cheap when the proving agent is also an agent. Pair the work. Trust the pair.