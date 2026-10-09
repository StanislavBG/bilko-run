---
slug: "twelve-releases-in-four-days-for-the-scheduler-view"
title: "Twelve Releases in Four Days for the Scheduler View"
excerpt: "Twelve releases in four days, a job table rebuilt as a graph, and a merge button I deleted three weeks after adding it."
category: "build-log"
published: true
published_at: "2026-09-22T07:02:48.000Z"
order: 40
---

[Session Manager](/projects/session-manager/) is the local cockpit for running Claude Code CLI sessions — it schedules routines, tracks token budget, and keeps a queue of long-running plans so you're not babysitting a terminal to know what's still working. This past week it shipped twelve releases in under four days, v0.87.0 through v0.95.0, and the one worth writing about is a screen I rebuilt and a button I deleted three weeks after adding it.

The screen is the Scheduler tab — open Session Manager and it's what you land on. Until this week its default view was a vertical job table — scroll down to find the plan you care about, scroll more if you're running several at once. It's now a graph by default: one full-bleed band per plan, a 3px status spine down the side, and a windowed strip of dense 31px rows for each plan's PRDs, opening on whichever stage is actually running instead of the top of a list. There's a whole-graph minimap you can brush to jump around instead of scrolling, and the old table didn't go away — it's still there as List, for anyone who preferred it. If you're running more than one plan at a time, that's the actual point: you see all of them as shapes on one screen instead of hunting one at a time in a scroll.

The button is smaller and, to me, more interesting. Three weeks ago I gave each Epic its own git worktree and shipped an explicit "Merge to main" button as the checkpoint back to the shared branch — I wrote about it in [the post about Epics no longer sharing one working directory](/blog/epics-stopped-sharing-one-working-directory). This week I deleted that button, along with "Retry merge" and the action behind it. The merge-before-archive checkpoint that actually matters is untouched; what's gone is the dedicated UI for doing it by hand. A conflict now just tells you plainly that resolving it is yours to do in git, instead of offering a button for a path that, in three weeks of real use, wasn't earning the screen space.

The part I didn't expect going into this: fourteen of the fixes in this window were merged in by Session Manager's own scheduler, working against its own repo — the tool doing the exact job it's built to schedule. Most of what landed alongside the Graph view was resilience work in that same vein: fail-closed guards so a stale worktree lease or a torn queue shard can't wedge the whole machine, a circuit breaker wired into the usage meter, and a fix for a job that could accidentally cancel another job's build identity mid-flight.

What's next: List stays available while I see which one people actually reach for, and the resilience fixes keep landing the same way most of this week's did — as jobs the scheduler queues and runs against itself.