---
slug: "twelve-places-one-weather-rule-you-set-yourself"
title: "Rank 12 places by weather you define yourself"
excerpt: "OutdoorHours counts the hours you could have been outside, in twelve places, using a comfort rule you pick or build. Ten years of hourly data."
category: "product"
published: true
published_at: "2026-10-07T16:00:00.000Z"
order: 43
---

You decide what a nice day is, then watch twelve places get ranked by your rule. [OutdoorHours](https://bilko.run/projects/outdoor-hours/) counts every hour of the last ten years that passed your test for "good to go outside."

Most weather apps give you a temperature and stop there. A temperature does not tell you if you could have sat on a patio. Is 75 degrees nice with thick smoke in the air? Is it nice at noon with a strong sun? You each have an answer, and the answer is rarely the same one your neighbor has.

So OutdoorHours starts with a question: was it comfortable to be outside? It asks that question of each hour. An hour counts when it is daytime, the temperature is mild, the sun is not too strong, it is dry, the sky is not overcast, the air is not muggy, and the air is clean.

With the default "Goldilocks" rule, Santa Clara County in California has 20,114 good hours over ten years. Eastside King County in Washington has 12,361. The page shows those counts as soon as you open it.

![OutdoorHours page showing 20,114 comfortable hours for Santa Clara County against 12,361 for Eastside King County over ten years](/blog-images/twelve-places-one-weather-rule-you-set-yourself/ten-year-leaderboard.jpg "Two counties, one rule, ten years of hours: Santa Clara County leads under the default Goldilocks rule.")

Now change the rule. There are five ready-made moods: Sun Seeker, Goldilocks, Classic, Cool & Cloudy, and All-Weather. Sun Seeker is strict beach-day weather, with clear skies, mild temperatures, low humidity, and clean air. Switch to it and the same two counties drop to 8,807 hours and 3,637. The gap between them gets wider, because the strict rule hits Eastside King County harder.

![OutdoorHours with the Sun Seeker rule selected, showing 8,807 good hours for Santa Clara County and 3,637 for Eastside King County](/blog-images/twelve-places-one-weather-rule-you-set-yourself/sun-seeker-ranking.jpg "Switching to Sun Seeker cuts both counts, and Eastside King County falls much further.")

Or skip the presets. The Custom button opens sliders for the temperature range, UV, rain, cloud cover, humidity, and air quality. Your browser re-counts ten years of hourly data against your numbers. The tour on the page says air quality data only starts in August 2022, so older hours are not held to the air rule.

The twelve places run from Bay Area and Seattle-area counties to the Florida coasts, New York City, Maui, Sofia in Bulgaria, and Gabrovo in Bulgaria. Pick the ones you care about and add them to the chart. Click a point to open that month, then a day, then the hourly detail. A year-over-year switch lets you check if this summer was worse than the last one, or if it only felt that way.

This helps if you are planning a trip, weighing a move, or just settling a debate with a friend about whose city has better weather. The data refreshes, and the page said it was last updated on October 9, 2026 when I loaded it.

Before, a weather app decided what "nice" meant. Now you set the rule and the ranking follows it. Your rule lives in the page link, so you can send a friend your exact view.

Try it at [bilko.run/projects/outdoor-hours](https://bilko.run/projects/outdoor-hours/). Set a rule, pick two places, and see which one wins. The code is open source at [github.com/StanislavBG/outdoor-hours](https://github.com/StanislavBG/outdoor-hours).
