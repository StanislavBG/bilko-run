---
slug: "the-matrix-said-skip-two-we-shipped-anyway"
title: "The Matrix Said Skip Two. We Shipped Them Anyway."
excerpt: "Session Manager's own competitor matrix ranked two features low priority. All three got built in one night anyway, including the diff review every rival already had."
category: "product"
published: true
published_at: "2026-11-16T17:00:00.000Z"
order: 54
---

Session Manager is a free desktop app for developers who run Claude Code CLI sessions every day. It has a scheduler that waits out your token limit, worktrees that keep parallel work from colliding, and a queue of Epics for the work itself. On November 8, it ran its own Competitor matrix, a side-by-side against Claude Code Desktop, opcode, Vibe Kanban and Conductor. The matrix flagged one clear gap and waved off two more ideas as low priority. Four days later, all three got built in one night.

## The diff every rival already had

Diff review was one of the matrix's two top-priority rows. Claude Code Desktop, Vibe Kanban and Conductor all let you review a change without leaving their app. Session Manager did not, and the matrix called that "the clearest gap." Open an Epic now and there is a Changes tab. It shows the diff of the Epic's worktree branch against main, file by file, plus one section per PRD that landed inside it. Click a line, leave a comment, and send every comment to the Epic's session as one message instead of switching to GitHub and back. The review range is pinned, so the diff still shows even after the Epic's branch gets deleted.

![GitHub compare page for v0.132.0 to v0.133.0, showing 80 commits and 183 files changed](/blog-images/the-matrix-said-skip-two-we-shipped-anyway/sm-compare-80-commits.jpg "The full commit range behind v0.133.0, confirmed on GitHub.")

## Running Codex, Gemini CLI or Cursor from the same cockpit

This one, the matrix did not recommend at all. Its own note called multiple agent CLIs "out of scope: the product is a cockpit for the Claude Code CLI." Vibe Kanban and Conductor already run several CLIs side by side; Session Manager ran exactly one. The New Session form has a CLI picker now anyway. Claude Code stays the default. Codex, Gemini CLI, Cursor Agent CLI, opencode and Antigravity show up once you have them installed and signed in with your own account. Each one gets an adapter that turns that CLI's events into the same shape Claude Code produces. The chat, the transcript, the terminal, and the phone web remote all work the same way, no matter which CLI you picked. A chip in the Epic header and the Sessions queue shows you which one is running.

## A preview button the matrix said skip

The lowest-priority row of the three got built too. The matrix gave built-in app preview a P3: "no user demand found... opening the dev server URL in the system browser covers most of the value." That is exactly how it got built. A Run preview control in the Epic header starts your project's dev script inside that Epic's own worktree, on a free port. It then opens the local URL in your normal browser. One dev server runs per Epic. It stops when the Epic finishes, gets deleted, or merges to main. Any leftover preview process gets cleaned up the next time the app starts.

You can try all of this today. Grab v0.133.0 with `npx claude-code-session-manager@latest`, or pull the Mac or Windows installer from [bilko.run/projects/session-manager](https://bilko.run/projects/session-manager/). The app and its Field Manual are both free. The code is open source at [github.com/StanislavBG/claude-code-session-manager](https://github.com/StanislavBG/claude-code-session-manager).

![The Session Manager landing page, showing the free Mac and Windows installers and the npx install command](/blog-images/the-matrix-said-skip-two-we-shipped-anyway/sm-landing-page.jpg "Where to grab v0.133.0 right now.")

All three Epics started within two minutes of each other, around 11 PM on November 12. All three were done by 8:08 AM the next morning, and v0.133.0 shipped at 8:25 AM. Session Manager used to run only the Claude Code CLI, with no in-app way to review or preview a change. Now it can do both, plus run five more CLIs. This release also made Project Home's docs explorer full-screen and added a cost warning before a pricey macro runs. The matrix still has open rows, like a warning when two parallel Epics edit the same files, so the next round is already lined up.
