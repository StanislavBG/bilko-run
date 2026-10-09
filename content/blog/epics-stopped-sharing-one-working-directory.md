---
slug: "epics-stopped-sharing-one-working-directory"
title: "Epics Stopped Sharing One Working Directory"
excerpt: "Session Manager's Epics — its unit of scheduled dev work — used to run concurrently against one shared checkout. Now each gets its own git worktree, and the tests that were supposed to prove it never actually ran."
category: "build-log"
published: true
published_at: "2026-08-23T16:00:00.000Z"
order: 36
---

I gave [Session Manager](/projects/session-manager/)'s Epics their own git worktrees this week. An Epic is the app's unit of scheduled dev work — a tagged session that owns its own PRDs and runs from proposed to active to completed. Before this, every concurrent Epic in a project ran against the same shared checkout, which meant two Epics editing at once could clobber each other's uncommitted changes or pick up half-finished edits from a sibling that happened to be running in the same directory at the same time.

The fix: each Epic now gets its own branch and checkout, created the moment it goes active. Terminal and Chat spawn into that isolated directory instead of the shared one. An explicit merge-to-main checkpoint folds the branch back in — attempted automatically on completion, but never blocking the Epic from archiving if the merge doesn't go clean — and a real conflict surfaces as a UI state with a resolve-in-terminal option, instead of silently corrupting whatever the shared directory used to be.

The part I want to write down is what happened when I went back to register the acceptance tests for the merge checkpoint. They existed — a whole file covering the fast-forward and real-conflict cases — but had never been added to the test runner's include list. Running the suite reported "no test files found" for that file. The core coverage for this feature had been dead code since the day it was written; it looked covered and wasn't. Registering it surfaced a second, smaller thing: a test asserting the code would `reject` with an error, when the actual code throws synchronously before the async path is ever reached. The assertion was wrong, not the code — but nobody would have known either way, because the test never ran.

Same day, three more edge cases turned up on their own: a relative project path silently resolving against the wrong working directory and writing five stray folders with no error at all; a worktree path saved from a previous session going stale after a reboot or a tmp-dir sweep and killing that Epic's terminal with an opaque error; and the anti-resurrection guard that's supposed to stop a job from running twice failing open on its first unreadable log file, which is exactly how this feature's own rollout PRD ended up running twice.

What's next: there's a per-project toggle now, in Settings, for anyone who wants Epics back on a shared directory — but the point of shipping it was to stop needing that toggle at all.