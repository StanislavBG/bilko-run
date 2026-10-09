---
slug: "outdoorhours-week-2-from-fixed-rules-to-rule-engine"
title: "OutdoorHours, Week 2: From Four Rules to a Rule Engine"
excerpt: "Last week OutdoorHours shipped with one fixed answer to the question \"was it comfortable to be outside?\" This week — fourteen commits, nine regions, three continents — the answer became a setting users can rewrite, share by URL, and run against their own definition of comfortable."
category: "build-log"
published: true
published_at: "2026-04-28T02:15:34.053Z"
order: 9
---

## The opinionated tool problem

Every dashboard with a thesis eventually meets the user who disagrees with the thesis. OutdoorHours week 1 had a single, sharp definition of "comfortable": daytime, 45–86°F, UV ≤ 6, rain ≤ 1 mm/h. All four pass or the hour doesn't count. We shipped that on a Sunday and felt smart for about eighteen hours.

By Monday the question was: *whose comfortable?* The Sun Seeker who needs 80°F to feel alive. The cloudy-grey-and-cold person who treats 60°F as ideal. The trail runner who'll go in the rain but not in heavy haze. Everyone has a different answer, and the leaderboard ranking flips depending on which definition wins.

The week's shipping log — fourteen commits between April 21 and April 27 — is the trace of that conversation. The tool went from a fixed-rule classifier to a configurable rule engine, from two regions to nine across three continents, and from "here is the answer" to "here is your answer."

## v5 + v6: the leaderboard exposed the obvious

The first crack came from looking at our own output. The County Leaderboard widget (v5, [`ec6a0c3`](#)) was supposed to be a quick-glance ranking — who has the most stay-outside hours over the selected range. Useful, except we'd been treating "Bay Area" as a place. It isn't. Pacific Heights, Mission, and Ocean Beach are three places that disagree about whether it's comfortable on any given afternoon, and the leaderboard refused to combine them.

That forced [v6 (`1bec861`)](#): per-county **Character Profiles** — "Meet the Counties." Each region picked up a paragraph of personality on the deep-dive panel: who thrives there (a sun chaser, a cloud sympathizer, a humidity tolerator), who doesn't, and what the weather does for a living. Our nine-region bundle now reads as nine arguments for nine kinds of life, not nine bars on a chart.

That, in turn, made it obvious that the Four Rules weren't telling the whole story. Pacific Heights and Mission both pass the four — but at very different humidity. So we needed more rules. And more rules meant fewer users would agree with all of them at once.

## v7 + v8: six rules, five profiles, instant toggle

v7 ([`0018ca2`](#)) added two rule cards we'd been resisting: **cloud cover** and **humidity**. Six rules, all four-in-the-original plus two on the side. We also flipped the default range from 10y to 1m so the landing experience is "today, last week, this month" instead of a ten-year flex. We added Sofia, BG (because the Bilkov family is from Bulgaria) and St. Johns, FL (because Florida-not-Miami is its own conversation).

Six rules made the tool *more* opinionated, not less. So v8 ([`7e1b3f1`](#)) admitted defeat and shipped a profile system: five named bundles of rules a user can toggle in one click.

- **Sun Seeker** — strict floor, generous ceiling, low cloud
- **Goldilocks** (default) — the original four-rule comfort target
- **Classic** — the four core rules, no cloud or humidity gates
- **Cool & Cloudy** — high cloud OK, lower temperature floor
- **All-Weather** — the most permissive: daytime + UV-safe, almost everything else passes

The implementation choice that mattered: **per-profile rollups are pre-computed at export time**, not at click time. Every region's monthly bundle ships with parallel columns named `stay_outside_<id>_hours` and `pct_daytime_outside_<id>` for each profile id. The toggle reads from a different column. Chart, leaderboard, quick-take, and rule cards all re-read against the active profile's column without a re-fetch and without a re-aggregate.

The cost: bundle size grew. The 10-year bundle went from ~2.9 MB to ~5 MB once profiles were baked in. Acceptable. The gain: zero latency on the toggle, zero per-profile API call, zero re-render hitches.

## v9 + v10: another axis, another deep dive

v9 ([`9a580d9`](#)) added US AQI as a non-comfort metric — strictly informational, no profile gates against it (yet). At the same time we added Gabrovo, BG, the second Bulgarian region, mostly because the Bay Area / Seattle / Bulgarian-mountain triangle is a comparison that makes me happy.

v10 ([`668c6fc`](#)) was the **Region Deep Dive**: every metric, every profile, every grain, on a per-region page. Instead of "compare Bay Area vs. Seattle Eastside on stay-outside hours," you can now drop into San Mateo County and see twelve metrics for that region alone, year-over-year, with the character paragraph at the top. The leaderboard view is for picking *between* places. The deep dive is for understanding *one* place.

This was the inflection point where the tool stopped being a comparison chart and started being a regional almanac.

## v11 + v12: shareable rules, then a custom builder

v11 ([`37139ae`](#)) shipped two unrelated quality-of-life things that paired perfectly: **sticky controls** so the toolbar doesn't scroll out of view, and **shareable URLs**. Every UI state — selected regions, active profile, range, grain, metric, drill-in stack — now serializes into the URL. Send a link, the recipient lands on exactly your view. Year-over-year comparisons came along for the ride: lock to one region, walk back through five Aprils.

The shareable URL is the move that unlocked v12 ([`526ebb2`](#)): the **Custom Profile Builder**. Users can now define their own rule bundle — pick the temperature range, the UV ceiling, the rain max, optional humidity and cloud caps — and the tool re-runs every region against it. The custom profile encodes into the URL alongside everything else, so a custom rule is a shareable artifact. Send your friend a link to "my idea of nice weather" and they see your nine-region ranking against your definition, not Goldilocks's.

The technical wrinkle: custom profiles can't use pre-computed columns, because we don't know in advance what the user will pick. So the deep-dive panel and chart fall back to client-side scoring — re-aggregating from hourly bundles when the user is on a custom profile. This is slower (a few hundred ms on the 10-year range) but bounded, since the work is local-only and the user opted into it by clicking "build custom."

v12.1 ([`d6189bd`](#)) added a six-step product tour for first-time visitors and tightened the share UI for custom rules. By Friday we had a 121-month, nine-region, six-rule, five-prebuilt-or-one-custom-profile dashboard with shareable URLs. It's a lot.

## v13: the editorial reskin

The last move of the week was visual. v13 ([`4aa780d`](#)) — "editorial-meteorology reskin" — pulled the design language toward weather-section newsroom rather than dashboard SaaS. Dark glass background, bright county-specific colors over the glass, typographic confidence borrowed more from the New York Times weather page than from a Plotly tutorial. v13.1 and v13.2 followed up by tuning the color saturation on county headers — the original palette was muddy on dark.

Why the reskin: with nine regions, six rules, five prebuilt profiles, and a custom builder, the tool was carrying more state than the old "two charts and a leaderboard" layout could honestly absorb. Editorial design imposes hierarchy. You read the lead first, then the regional cards, then drill into one. The chart is a supporting figure, not the page.

## What I'd do differently

**Profiles should have been v3, not v8.** Every iteration between v3 and v8 — including the second region wave, the AI narratives, the leaderboard, the character profiles — was built against a fixed-rule pipeline I was about to throw out anyway. The pre-computed-column trick wasn't hard to retrofit, but the rule cards, the quick-take template, and the narrative prompts all had to be rewritten once the rule set became dynamic. If your tool is opinionated about a definition, ship the "you might disagree" path before you ship the "and here's why we're right" path.

**Custom profiles should have hourly fallback from day one.** I shipped them with the per-profile-column architecture intact, then realized the next morning that a "custom" profile literally cannot have a pre-computed column. The fallback to client-side scoring was a 90-minute fix on day two. It would've been a 20-minute fix on day zero.

## Try it

[OutdoorHours](/projects/outdoor-hours) now covers nine regions across three continents, six rules, five prebuilt profiles, and a custom profile builder with shareable URLs. Free, no credits, no login.

Build a profile that reflects your idea of nice weather and send me the URL — `bilko@bilko.run`. The most opinionated reader's profile gets pinned as a guest preset next week.

If you want to see how the rest of the bilko.run platform fits together, [the full project list is here](/projects). Or for a different tool that takes opinions and gives them back to you sharper, try [PageRoast](/projects/page-roast).

## FAQ

**How do shared profile URLs work?**
Every UI selection — regions, range, grain, metric, profile (built-in id or custom rule object), drill-in stack — encodes into the URL hash. The page reads it on load. No server round-trip; nothing stored on our side.

**Why six rules instead of four?**
Because cloud cover and humidity are the two rules that most often *should* be in someone's definition of comfortable but weren't in ours. Adding them as optional rules (with a `null` cap meaning "ignore") preserved the four-rule classic profile while opening up the cloudy-and-cool and humid-and-warm cases.

**Can I add my own region?**
Not directly — adding a region requires fetching ten years of hourly ERA5 data via Open-Meteo, processing it through the export pipeline, and rebuilding the bundles. If there's a county you want covered, email `bilko@bilko.run` with the lat/long. The ten regions we have today were added that way.

**Why precompute per-profile rollups instead of scoring at click time?**
Because click latency is the difference between a tool that feels live and a tool that feels like it's loading. The custom-profile path falls back to client-side scoring when the rules are user-defined; built-in profiles read pre-computed columns and stay sub-50ms.