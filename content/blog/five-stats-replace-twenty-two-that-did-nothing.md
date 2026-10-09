---
slug: "five-stats-replace-twenty-two-that-did-nothing"
title: "Five Stats Replace Twenty-Two That Did Nothing"
excerpt: "A shape-themed action RPG went from a store with no UI to a playable combat build in a week — then a 7-iteration completeness audit found the archetypes had been mathematically identical the whole time."
category: "build-log"
published: true
published_at: "2026-07-31T16:00:00.000Z"
order: 30
---

A week ago this project — a shape-themed action RPG with a triangle striker, a square bulwark, a circle arcanist — was 756 hand-written lines of state management and nothing to look at: no weapon, no combat, no UI. This week it shipped v1.1.0 and became a game you can actually play: pick an archetype, drop into a run, move with a joystick, auto-attack with a real equipped weapon that branches between melee arcs and ranged projectiles, watch floating damage numbers and enemy HP bars, cast Frost Nova or Meteor Storm on real cooldowns, and see a Character Power score built from armor, crit, and spell power that are now actually wired into the combat math instead of sitting in a spreadsheet.

The redesign underneath all of that: the character sheet used to track 22 individually-leveled passive stats, and nothing consumed most of them. It's now 5 primary stats, with weapons, gear, and skills all deriving their real numbers as a joint sum off those five. Sixteen items — spells and gear, r1 through r16 — got scaled to the new system, one commit each.

Here's the part worth writing down. After the rewrite, a 7-iteration audit ran through the content looking for anything the redesign had silently broken. Iteration 6 found the best one: all three archetypes' advertised starting boosts — Striker gets +attack and +attack speed, Bulwark gets +HP and +armor, Arcanist gets +spell power and +mana — were dead. The function that applied them wrote to a field called `Passive.lvl`. The function that actually derives combat stats only ever reads `primaryLevels`. A fresh Striker, Bulwark, and Arcanist with the same points spent had byte-identical stats. Nothing threw an error. Nothing failed a build. The archetypes just quietly stopped being different from each other, and the only reason anyone noticed was a leftover code comment from the redesign — "all points are spent on primaries now" — that didn't match what the boost function was still doing.

That's the lesson: a structural rewrite doesn't announce what it broke. The audit that caught this wasn't triggered by a bug report; it was a deliberate pass looking for exactly this class of silent disconnect, and it found six more of the same shape before this one and one more after (an XP-gain no-op, the final iteration). Nine more detailed stats — penetration, area-of-effect, evasion, luck, cooldown reduction, pickup radius, regen, resistance, block — are confirmed dead too, and still are; some, like penetration, need a mechanic (enemy armor) that doesn't exist yet to mean anything.

What I'd do differently: run that audit pass as part of the redesign, not a week after it. Every one of these bugs existed the moment the rewrite landed; the only thing that changed between "broken" and "found" was deciding to go looking.

Still rough: the EAS build handed off at the end of the week (build #8, ~3 hours to compile) was still in progress at handoff — the next session picks it up mid-build, with the submit and TestFlight steps written down but not run. And `expo-doctor` has been flagging six packages with drifted patch versions for a while now; that's been deliberately deferred, not fixed.

No tile on [/projects](/projects) yet for this one — it's still a build, not a release.