---
slug: "a-stranger-already-turned-their-github-into-a-resume"
title: "A Stranger Already Turned Their GitHub Into a Résumé"
excerpt: "The first person outside the project built a real portfolio with git-viewer, so its landing page now shows real builds before the famous examples."
category: "product"
published: true
published_at: "2026-11-26T17:00:00.000Z"
order: 57
---

git-viewer turns any public GitHub account into a portfolio and a résumé. You give it a username, nothing else, and it does the rest. This week, a stranger did exactly that. git-viewer's landing page now shows his real page before the famous examples it used to lead with.

## What landed: a real build, not a fixture

Until last week, the "See an example" box on the landing page only linked to invented or famous accounts. A test persona, Linus Torvalds, Dan Abramov. On November 7, someone outside the project tried it for real. GitHub user bidyut10, Bidyut Kundu, pasted his handle in. He got back a full page. It shows 623 commits in the last 12 months, 829 stars earned across his repos, and 132 followers. It also shows two badges git-viewer worked out on its own: Starstruck III and Pair Extraordinaire II. That page is live right now. You can open it yourself.

![Bidyut Kundu's live git-viewer portfolio showing 623 commits, 829 stars, 132 followers and two earned badges](/blog-images/a-stranger-already-turned-their-github-into-a-resume/built-portfolio.jpg "Bidyut Kundu's real portfolio, built from his GitHub account, not a fixture")

That's the whole point of git-viewer: it reads your public repos, commits and activity through the GitHub API and builds the page itself. No private data, no setup. It works for anyone job-hunting, or anyone who just wants a clean page that shows their real coding work instead of a stale résumé PDF nobody updates.

## The decision: pick real builds by hand, not by script

There's a real limit here. Anyone can open any GitHub login's portfolio just by adding `?u=<login>` to the URL. A page existing proves nothing about who built it; it only proves someone typed a name in. So the fix skips guessing. There's no code that tries to detect a "real" user. Instead, there's a short list, picked by hand and checked into the code, of people confirmed to have built their own page. Today it holds one name.

![git-viewer's landing page showing the new 'Built by our users' card for Bidyut Kundu ahead of the famous examples](/blog-images/a-stranger-already-turned-their-github-into-a-resume/built-by-our-users.jpg "The new Built by our users card, shown ahead of Torvalds and Abramov")

The change shipped behind real gates, not a guess. All 106 tests pass. A new browser test checks the card renders right. Another test makes sure the list can never quietly include the project's own test persona instead of a real person.

## Try it, and maybe you're the next name on that list

Starting costs nothing. Open git-viewer, type your GitHub username, and click "Build my portfolio." It reads only your public activity, no sign-in, no token, and gives you a heatmap, streaks, one featured project and a résumé PDF for free. Five dollars a year unlocks up to 12 projects you choose and a daily refresh instead of once a day. Either way, the build takes seconds, not an afternoon of formatting a résumé by hand.

![git-viewer's three-step "How it works" panel next to its free and five-dollar-a-year pricing](/blog-images/a-stranger-already-turned-their-github-into-a-resume/free-plan-how-it-works.jpg "How it works and the free vs. five-dollar-a-year plan")

git-viewer is open source, so you can read how the heatmap and the showcase list actually work: [github.com/StanislavBG/git-viewer](https://github.com/StanislavBG/git-viewer). To try building your own, start at [bilko.run/projects/git-viewer](https://bilko.run/projects/git-viewer/).

The showcase list is still picked by hand. One name is on it today. The next one added could be whoever reads this and tries git-viewer next.
