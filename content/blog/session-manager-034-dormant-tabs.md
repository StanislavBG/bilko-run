---
slug: "session-manager-034-dormant-tabs"
title: "Session Manager 0.34: tabs that cost nothing until you talk"
excerpt: "Tabs used to spawn a live process the moment you opened them. As of v0.34.0 a new tab is a dormant chat box — nothing runs until you send a message — and it remembers its conversation across restarts. Plus the chat engine rewrite that stopped parallel Claudes from eating the machine."
category: "product"
published: true
published_at: "2026-06-28T16:00:00.000Z"
order: 22
---

Session Manager tabs used to be expensive. Opening one spawned a real PTY and a real `claude` process immediately, so a window full of tabs was a window full of running processes, and every app restart re-spawned all of them. As of v0.34.0, a new tab opens as a lightweight chat box and stays dormant — no PTY, no process — until you actually send a message. Tabs also rehydrate their prior conversation on mount, so reopening the app shows history instead of a blank box.

The chat engine behind this got rewritten once before shipping. The first version used a reject-at-capacity semaphore allowing 3 concurrent runs, which fanned out into parallel `claude` processes that ran the machine out of memory and got a scheduled job SIGKILLed mid-edit. The replacement is a FIFO queue copied from the scheduler, capped at one run at a time — bursts now queue with a visible position instead of erroring. The fix for too many Claudes came from the one part of the app that already knew how to run exactly one job.

Also shipped in the 12 commits of this release (PRDs 318–325):

- A **Timeline view** in the Knowledge Graph tab: searchable, newest-first conversation history per project, with expandable verbatim exchanges, logged to `~/.claude/knowledge-log/`.
- The scheduler's orphan-requeue cap raised from 2 to 5.
- An e2e test asserting zero `claude` processes on boot — which kept false-positiving on the app's own power-blocker, because `systemd-inhibit --why` contains the string "claude -p jobs". It now keys on the process name, not the command line.

One skip to be honest about: the end-to-end Send round-trip test is checked in but disabled, marked "needs auth + spawns claude; run it manually when the machine is quiet."

Session Manager is the local cockpit for the Claude Code CLI — multi-tab terminal, scheduler, voice dictation, live observability. It lives at [/projects/session-manager/](/projects/session-manager/).