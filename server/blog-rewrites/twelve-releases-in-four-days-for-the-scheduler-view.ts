import type { BlogRewrite } from './types.js';

export const rewrite: BlogRewrite = {
  slug: 'twelve-releases-in-four-days-for-the-scheduler-view',
  migrationId: '2026-10-03-rewrite-twelve-releases-in-four-days-for-the-scheduler-view',
  title: 'See Every Session Manager Plan on One Screen',
  excerpt:
    "Session Manager's Scheduler tab now shows every running plan as shapes on one screen instead of a scroll list. This week also removed a manual merge button that wasn't getting used.",
  content: `Open Session Manager's Scheduler tab this week and you see every plan you are running as one picture, not a list you scroll down. Each plan gets its own full-width band, with a colored strip on the side that shows its status at a glance. Inside each band sits a strip of small rows, one per task, open right on whichever task is running now. A minimap across the top lets you drag to jump between plans.

Session Manager runs your Claude Code coding sessions for you. It starts tasks, tracks how many tokens you have left, and keeps a queue of work moving. You do not have to watch a terminal all day to know what is still running. The new Scheduler view matters most once you run more than one plan at a time. You can see all of them as shapes on one screen, instead of checking them one by one. Try it at https://bilko.run/projects/session-manager/ and open the Scheduler tab. The old table view did not go away. It is still there, now called List, for anyone who prefers it.

Also shipped this week: twelve releases in under four days, version 0.87.0 through 0.95.0. A "Merge to main" button, added three weeks ago, got removed, along with its retry button. A merge conflict now just tells you to fix it yourself in git. Fourteen of this week's fixes were merged in by Session Manager's own scheduler, running against its own code. That is the same job it does for you, done on itself.

What's next: the List view stays while it's clear which screen people actually reach for. Small fixes keep landing the way most of this week's did, as jobs the scheduler runs on itself.

The code is open source. See it at https://github.com/StanislavBG/claude-code-session-manager.`,
};
