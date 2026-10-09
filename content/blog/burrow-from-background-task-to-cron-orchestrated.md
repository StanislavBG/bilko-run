---
slug: "burrow-from-background-task-to-cron-orchestrated"
title: "Burrow, Week 16: From Crashing Background Task to Cron-Orchestrated"
excerpt: "Our local-first social automation agent kept silently double-posting and losing settings on restart. Four commits later it is cron-orchestrated, traced, idempotent, and routing replies through a seven-mode tone palette. Here is what actually changed."
category: "build-log"
published: true
published_at: "2026-04-20T07:27:07.946Z"
order: 6
---

## Why this week mattered

Burrow is our local-first social media agent — a FastAPI server that drives real Playwright-Chromium browsers to scroll, like, and reply across X, Reddit, LinkedIn, and Facebook. Everything runs on the laptop, nothing routes through a cloud API, and every action hits the same DOM a human would.

Week 16 was the week Burrow graduated from "background task that occasionally crashes and silently double-posts" to something I trust to run unattended overnight. Four commits, 77 files in the largest one, and the stack ended the week with cron-level orchestration, Playwright tracing, a reply-tone doctrine, and atomic reply idempotency.

## Commit 1 — The big refactor (`07a85bc`, +7,527 lines)

Before this week, the orchestrator ran in-process as a background task inside the FastAPI server. Two problems: it crashed on malformed state, and running `--status` from the dashboard accidentally triggered spurious run markers because the engine and the status check shared a database.

**The fix:** move orchestration out of the process entirely.

- `scripts/orchestrator-cron.sh` runs every 5 minutes via `flock` (a Linux mutual-exclusion lock, so two ticks can't overlap).
- The in-process `OrchestratorEngine` now runs with `read_only=True` — dashboard can read state, never write.
- Dashboard write routes return **403 if `engine.read_only`**, **409 if another pipeline is mid-run**. No more races.

The tradeoff is real: 5-minute granularity means sub-minute reactions are gone. For social posting that's fine. For a trading bot it wouldn't be.

The other big move in this commit: **14 Claude prompts moved out of Python and into `data/prompts/**/*.md`**, loaded by a new `app/shared/prompts.py` using Python's `string.Template` with an LRU cache. Every pipeline — X, Reddit, LinkedIn, Facebook — now sources its drafting, planning, and review prompts from markdown. You can tune tone without a deploy.

### The reply doctrine

The most opinionated piece of the refactor is the tone doctrine. v2 had a single reply template and every response sounded like the same robot. v3 shipped `data/x-reply-strategy.md` with **seven modes**:

- `affirm_reinforce` — "yes, and here's the other reason"
- `quiet_cosign` — a minimal nod
- `lived_parallel` — "same, different context"
- `specific_noticing` — pick out a detail most readers missed
- `genuine_curiosity` — one question, not interrogation
- `dry_oneliner` — wit
- `resonance_close` — validation on an emotional post

Most modes ban ending on a question and ban opening with "actually" or "hot take." LinkedIn got its own stricter four-verb doctrine: commend → agree → expand → wish.

The mode gets chosen per-candidate by the planner based on the tweet's content class. A venting post gets `resonance_close`. A witty observation gets `dry_oneliner`. One template → seven; the feed stops sounding like one person replying to everything the same way.

### DeepResearch infographics

Also slipped into this commit: a Step 6 that auto-generates infographics for research runs via Gemini Nanobanana, exports to `.txt / .md / .docx / .pdf`, and stores 50 runs in memory with a 24-hour TTL. Desktop gets a `ResearchTab.tsx` with a per-image gallery. This is the bridge between Burrow's Claude-driven research output and something visual you can actually share.

## Commit 2 — Tracing and guards (`7f3ae92`)

Cron was reporting "3 replies posted" when X was silently throttling 2 of them. Every action looked like a success in the logs because we weren't looking at the activity stream for error actions.

Four things changed:

- **Silent failure detection**: runs that finish but have error actions in `activity_stream` now flip to `status='failed'`, not `completed`. Dashboard stops lying to you.
- **Playwright tracing** wraps every scroll session. On crash, we retain a `.zip` in `downloads/traces/` replayable via `playwright show-trace`. Forensics, not logs.
- **Circuit breaker persistence**: the X tracker's `session_state` KV table now stores product-reply cooldown markers across sessions. 45-minute minimum gap survives process restarts.
- **New-account warmup**: capture-threshold lowered from P50 → P25 for accounts with less than two weeks of history. A brand-new account was filtering 100% of tweets because the capture-policy weights were tuned on older data.

## Commit 3 — Atomicity and schema v2 (`b78a03c`)

The subtle bug was this: Burrow would start to reply, navigate to the tweet, X would force a logout or crash the tab, the process would restart, and on the next cron tick Burrow would reply *again* — because the interaction row hadn't been written yet.

**Fix:** `_post_reply` now pre-writes a `reply_pending` interaction row **before** navigating. If the process dies, the pending row blocks the next session from re-attempting. The idempotency cache treats any row — pending or posted — as "already tried."

Other atomicity wins:

- **Settings persistence**: PUT `/settings` now writes `interval`, `window`, `jitter`, `duration` to `schedule_state.config_overrides_json`. Restarts no longer wipe tuning.
- **Content calendar schema v2**: `posts.category` is now `NOT NULL DEFAULT 'general'` with a `schema_version` table so future migrations are tracked.
- **High-opp hysteresis**: if the 24-hour success rate on high-opportunity replies drops below 60% (over 5+ attempts), the phase skips entirely. X is telling us to cool off; we listen.
- **Tier-3 fallback**: classifier fallback bumped from "after 2 consecutive failures" to "after 3" with a warning on the third.
- **`/locator/wait` endpoint**: pre-waits for a Playwright selector to become visible before extracting. Kills the "Execution context was destroyed" race that showed up when the feed re-rendered mid-extract. Costs 50–200 ms per extract; worth every millisecond.
- **Timezone helper**: `app/shared/tz.py` surfaces `*_local` timestamps so the dashboard shows PDT instead of UTC.

## Commit 4 — Dedup funnel, prompt escaping, high-opp caps (`5164fbb`)

Three tight fixes that each unblocked a real run:

**Dedup was over-aggressive.** `_dedup_against_tracker` was using the `seen_tweets` table (which records every tweet we ever *rendered*, 8K+ rows) as a deny-list. But the intent of dedup is "don't double-reply to the same tweet," not "never show a tweet we've ever seen." A run had 71 feed items, the old dedup killed it to 3 candidates, the planner had nothing to work with. The fix: dedup against the `interactions` table only. Same run, post-fix: **71 → 147 candidates after merge**. `seen_tweets` stays populated for analytics but no longer chokes the planner.

**Prompt `$` escaping.** `string.Template.safe_substitute` treats `$word` as a placeholder. Tweets like "I love $Bitcoin" triggered false "unresolved placeholder" warnings and could leak a literal `$$Bitcoin` into the Claude prompt. Fix: escape literal `$` to `$$` before substitution, collapse back to `$` after. Claude sees `$Bitcoin` exactly as written.

**High-opportunity cap bypass.** High-opp replies (crafted replies to high-visibility, low-reply-count tweets) were sharing a budget with organic replies. A run queued three high-opp candidates; all three got dropped because two organic replies had already eaten the 2-per-session cap. Now high-opp has its own `daily_high_opp_limit=5` budget, passed through as an `is_high_opp` flag. Five crafted replies plus two quick reactions per day, no fighting.

## What shipped, in one line per commit

| Commit  | Focus       | Outcome                                                                   |
|---------|-------------|---------------------------------------------------------------------------|
| 07a85bc | Architecture| Cron decoupling, 14 prompts externalized, 7-mode reply doctrine, infographics |
| 7f3ae92 | Hardening   | Silent-failure detection, Playwright tracing, persistent circuit breakers |
| b78a03c | Atomicity   | Pre-write pending rows, settings persistence, locator-wait, schema v2     |
| 5164fbb | Fixes       | Dedup 71→147, prompt \$ escaping, high-opp budget isolation              |

## What I'd do differently

I'd have moved prompts to files in week 2, not week 16. Every Python redeploy to tweak a one-line prompt tweak was a tax I paid for months. LRU-cached markdown loaders took 40 lines to add.

I'd also have wired Playwright tracing before the first overnight run, not after watching three mystery failures with no forensic trail. Tracing is cheap. Post-hoc debugging from partial logs is not.

## What's next

Now that the cron loop is honest about failures, the next week is tuning: can we lower the 45-minute product cooldown (probably yes), can we raise the hysteresis floor (probably no), does the lowered capture P25 produce measurably better engagement on new accounts (unknown — need a week of data).

Burrow isn't a [bilko.run](/projects) tool — it runs on my laptop, not in the cloud. But the reply doctrine work is interesting enough that we may spin out a scored version of it inside [ThreadGrader](/projects/thread-grader) or [AudienceDecoder](/projects/audience-decoder) next sprint.

## FAQ

**Is Burrow for sale?**
No. It drives real browsers on real accounts, which is the opposite of what platforms want automated, and we run it against our own accounts only.

**Why local-first instead of a cloud API?**
Because every API path (X, LinkedIn, Reddit) is either rate-limited, stripped of the features we need, or both. Driving the actual DOM is the only way to do the full surface.

**What's the reply success rate after the hardening?**
Measurable after one more week of data. Before the hardening we literally didn't know — the logs lied. Now we do.