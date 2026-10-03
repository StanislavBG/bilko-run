# Blog cadence watchdog — schedule, logs, and gate state

`scripts/blog-cadence-watchdog.sh` enforces the blog's declared 3-5 day publishing cadence
(`.claude/skills/blog-from-git/blog.config.yaml` `cadence.target_gap_days`) since nothing else
does — `/blog-from-git` only ever runs when a human types it. This doc is the one place that
records the real, currently-installed schedule, because the script has previously had two
schedulers and three different claimed times, none of which agreed with each other.

## The one trigger (verified on this machine 2026-09-11; crontab removed 2026-10-03)

| Trigger | Definition | Fires (PT) | Log |
|---|---|---|---|
| **systemd user timer** (sole trigger) | `blog-cadence-watchdog.timer` — `OnCalendar=daily`, `Persistent=true`, `AccuracySec=15min`, running `blog-cadence-watchdog.service` (`WorkingDirectory=%h/Projects/Bilko`) | daily, ~00:00-00:15 | `.claude/skills/blog-from-git/drafts/.watchdog.log` |

A duplicate crontab entry (`0 12 * * * .../blog-cadence-watchdog.sh # bilko blog-cadence-watchdog`)
was removed on 2026-10-03 at 3:26 PM PDT at the owner's request (backup:
`~/.claude/backups/crontab-20261003-152617.bak`). The systemd user timer above is now the only
trigger for this script. **Do not re-add a crontab trigger for this script — one trigger only.**

A separate, unrelated timer — `blog-watchdog-heartbeat-check.timer` — runs
`scripts/check-blog-watchdog-heartbeat.sh` roughly twice daily to detect if the watchdog itself
has gone dead or unhealthy. It doesn't invoke the watchdog; it only reads the heartbeat file the
watchdog writes on every run.

The single log this script writes to is `.claude/skills/blog-from-git/drafts/.watchdog.log`.
`~/.claude/logs/blog-cadence-watchdog.log` is historical only — it was written by the now-removed
crontab trigger and is no longer appended to.

## The trigger is LOCAL to this machine

The systemd timer exists only on this laptop. It only fires while this machine is powered on —
there is no server-side or cloud equivalent keeping the cadence on days this machine is off. The
`Persistent=true` setting narrows but does not eliminate this gap: it replays a run that was
missed while the machine was off, once the machine is next on, but a run genuinely cannot happen
while the machine has no power at all.

## Why an overlapping run is harmless, not dangerous

With only the systemd timer as a trigger, overlapping runs should be rare, but two safeguards
still make a manual rerun or any accidental overlap a safe no-op:

- **Concurrency lock**: `/tmp/bilko.blog-cadence-watchdog.lock` via `flock -n`. If a manual rerun
  ever overlapped the timer's run, the second to acquire the lock exits immediately with
  `"another instance running — skipping"` and still writes a heartbeat.
- **Same-day idempotency guards PUBLISHING, not scanning**: `.watchdog-state`
  (`.claude/skills/blog-from-git/drafts/.watchdog-state`) records the date of the last
  draft/publish attempt. A second run later the same day never seeds a second post on the same
  day, but it still runs today's scan (phases 1-2) rather than exiting outright; see "Scan vs
  publish cadence" below.

## Scan vs publish cadence

Scanning and publishing are governed independently (`.claude/skills/blog-from-git/blog.config.yaml`
`cadence:` block):

- **Scan (phases 1-2 of blog-from-git) runs every day**, unconditionally
  (`cadence.scan_every_days: 1`) — the watchdog no longer exits before scanning just because the
  live gap is within cadence.
- **Publish is gated on the LOWER bound of `cadence.target_gap_days` (`[3, 4]` → 3).** A post is
  "due" once the live gap reaches 3 days, not 4 — the upper bound (4) is reserved for the
  over-cadence/stall heartbeat classification, not the publish trigger.
- **A due post's subject is also gated by `rotation.project_cooldown_posts` (3).** A project
  covered in any of the last 3 `blog-ledger.md` rows is ineligible as the next subject. If a post
  is due but every candidate is on cooldown, the watchdog writes a `warn:` heartbeat and does not
  publish — it never invents a post to satisfy cadence.

## The NEXT_SLOT gate — a hard minimum gap floor, fail-closed

The `/api/blog` live-gap check above is necessary but not sufficient: it can't see a post that's
already been seeded for a future date, so it can call a day "due" even when a future post is
already queued close behind the last live one. `scripts/blog-cadence-watchdog.sh` closes that hole
by calling `pnpm tsx scripts/blog-cadence-gate.ts next-slot` after the live-gap check (around the
script's "hard minimum gap floor" block) and treating its answer as the real floor:

- `next-slot` reads the actually-seeded rows (not `/api/blog`, which hides future-dated posts) and
  returns the earliest ISO timestamp that is `cadence.min_gap_days` (3 days) clear of every seeded
  post — i.e. the next slot a new post is allowed to publish at.
- **Fail closed**: if the `next-slot` call errors, times out, or doesn't return a value that looks
  like an ISO timestamp, the watchdog logs a FATAL line, writes an `error:` heartbeat, and exits
  non-zero — it does not fall through to scanning or publishing on an unverified value.
- If `next-slot`'s returned time is still in the future, the watchdog runs **scan-only** (phases
  1-2: Rotation + Scan) even though the live `/api/blog` gap said a post was due — it does not
  draft, seed, or touch `server/db.ts`/`blog-ledger.md`/git. Only once the current time reaches
  `next-slot` does the watchdog proceed to drafting/publishing.
- This is the same gate `seed.md` tells an interactive session to run by hand before committing a
  seed (`pnpm tsx scripts/blog-cadence-gate.ts check`) — the watchdog's `next-slot` call and the
  skill's pre-commit `check` call are the automated and manual halves of the same hard floor.

This gate exists because of the 2026-10-03 double publication: a watchdog-seeded git-viewer post
went live at 16:08Z, and an owner-requested OutdoorHours post was then seeded for the same day at
17:26Z — about an hour later — because an interactive session read `rotation.override:
user-explicit-only` as covering the gap, not just the rotation/cooldown rules. The OutdoorHours
post was rescheduled to `2026-10-07T16:00:00Z` (9:00 AM PDT) to restore the 3-day gap. The
NEXT_SLOT gate, plus `rotation.md`'s explicit statement that the gap is never override-able, are
what closes this path going forward: an owner "publish now" request made inside the gap now gets
seeded at `next-slot`, not at the moment of the request, whether it's driven by the watchdog or a
manual session. Every seed — watchdog or manual — must also pass `pnpm tsx scripts/blog-cadence-gate.ts
check` immediately before the `git commit` that lands it; a failing `check` means no commit, no
push, full stop (see `seed.md`).

## Is publishing autonomous or gated?

**Gated.** As of this doc (2026-09-11), `.claude/skills/blog-from-git/blog.config.yaml` has no
`autonomy.autonomous_publish` key at all — only a comment on line 20 that references it
conditionally ("applies ONLY when autonomy.autonomous_publish is false"). The absence of that key
means the human-approval gate described in the script itself is still in force: the watchdog runs
phases 1-5 only (Rotation, Scan, Research, Ground, Draft) and explicitly stops before phase 6
(Approve) and phase 7 (Seed) — it never edits `server/db.ts` or `blog-ledger.md`, never commits,
never pushes, never publishes. A sibling PRD (1007) is expected to remove this gate; when it
lands, this doc's "Gated" verdict and the `autonomy.autonomous_publish` key's presence/value in
`blog.config.yaml` will both need to be re-checked and this section updated to match.

## Where drafts land

Finished drafts are written to `.claude/skills/blog-from-git/drafts/<published-date>-<slug>.md`.
Nothing downstream (seeding, publishing) touches a draft until a human reviews it and explicitly
tells Claude (interactively) to seed it, per the human-gate instructions in the script itself and
in `.claude/skills/blog-from-git/SKILL.md`.
