---
slug: "turn-your-github-year-into-a-heatmap-and-badge-wall"
title: "Turn Your GitHub Year Into a Heatmap and Badge Wall"
excerpt: "GitHub's profile page is one flat grid. GitViewer turns the same data into a heatmap you can spin three ways, a badge wall, and a streak counter -- fork it and point it at your own history."
category: "product"
published: true
published_at: "2026-10-03T16:08:44.000Z"
order: 42
---

GitHub gives you one flat green grid and calls it a profile. [GitViewer](https://bilko.run/projects/git-viewer/) turns that same data into something worth looking at. It's built for anyone who wants their coding history to look like more than a flat grid. You get a heatmap you can spin into three shapes. You also get a wall of badges that light up as you hit real milestones. A streak counter tracks your longest run of back-to-back coding days.

The stock GitHub profile page has not changed in years. It shows a grid of green squares and a repo list. It tells you that you coded on a given day. It does not tell you how long that streak ran, or which project ate your week. To get more than that, you would have to read your own commit history by hand.

GitViewer rebuilds your whole coding year as one page instead. Open it and you see a 53-week heatmap in three styles: classic squares, a 3D "extrude" view, or a radial clock face. Under that sits a 30-day breakdown of the languages and projects you actually touched. Below that is a feed of your recent commits, plus a row of badges for things like total commits and active days. On the live build right now, the streak counter shows an 18-day active streak. Its best streak this year ran 42 days, back in February and March. Both numbers come from real commit history across 62 repos.

You can try it first with Bilko's own data at [the GitViewer project page](https://bilko.run/projects/git-viewer/). If you want your own version, [the project is open source on GitHub](https://github.com/StanislavBG/git-viewer). Fork it, add your GitHub username, and run one command, \`pnpm sync\`. That command pulls your real repo history through the GitHub API. It then rebuilds the whole dashboard around your own work. A gear icon in the corner lets you change the heatmap style, color, and density without touching any code. Click into any project and you get its own page with its own stats.

The project's own roadmap lists a repo-health score and more badge types as not built yet. What is already live is enough to swap out your default GitHub profile. It shows your actual work, not just that you showed up.