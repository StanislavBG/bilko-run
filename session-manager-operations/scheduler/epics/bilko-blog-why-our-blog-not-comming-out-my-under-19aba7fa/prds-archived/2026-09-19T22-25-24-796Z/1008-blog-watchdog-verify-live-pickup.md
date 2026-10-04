---
title: Blog watchdog: verify live pickup after an autonomous publish and escalate a silent failure
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 18
sourcePromptId: bilko-blog-why-our-blog-not-comming-out-my-under-19aba7fa
tag: feature
agentType: dev-lead
createdVia: scheduler-api
issuedAt: 2026-09-11T17:54:29.124Z
---
# Goal

Once PRD 1007 lands, scripts/blog-cadence-watchdog.sh publishes without a human ever looking at the result — which means a push that succeeds but never reaches production would be invisible. blog.config.yaml's `gates.7_seed` already requires "live pickup verified at /api/blog after Render deploys", but nothing automated enforces it: the seed relies on Render auto-deploying from origin/main and running initDb()'s unconditional INSERT OR IGNORE at boot. Add a bounded post-publish verification pass that confirms the newly seeded slug actually appears at https://bilko.run/api/blog, and turn a failure into a loud, recorded error rather than a silent no-op that only surfaces as another cadence gap weeks later.

# Acceptance criteria

- [ ] Core: after a successful autonomous seed+push, scripts/blog-cadence-watchdog.sh polls https://bilko.run/api/blog until every slug it just seeded appears, or until a bounded deadline expires
- [ ] Core: the poll deadline and interval are read from blog.config.yaml's `autonomy:` block (e.g. `verify_deploy_timeout_seconds: 900`, `verify_deploy_interval_seconds: 60`), parsed with the same defensive grep pattern as the other thresholds, FATAL + `error:` heartbeat + exit 1 on a parse failure
- [ ] Core: on success the run writes an `ok:` heartbeat naming the published slug(s) and the observed live pickup time, and logs a line with the live URL(s)
- [ ] Core: on timeout the run writes an `error:` heartbeat naming the seeded-but-not-live slug(s) and exits non-zero — it must NOT silently exit 0, and must NOT re-seed or re-push
- [ ] Edge cases: verification reuses the SAME hardened fetch helper PRD 1005 introduces for the initial /api/blog read (retry + `jq -e 'type == "array"'` shape gate) rather than reimplementing a second raw curl+jq — one fetch implementation in the script, not two
- [ ] Edge cases: a transient non-array/error body or curl failure mid-poll counts as 'not yet live' and the poll continues to its deadline, rather than aborting the run
- [ ] Edge cases: the total run time stays bounded — the verification deadline plus the claude -p timeout must not exceed the watchdog's overall runtime budget; document the resulting worst case in the script's header comment
- [ ] Edge cases: a run that seeded nothing (no publishable material, or autonomous_publish false) skips verification entirely and keeps its existing exit path and heartbeat
- [ ] Interaction / integration: the git push already happened before verification starts — a verification failure must never trigger a revert, force-push, or history rewrite; it reports only
- [ ] Interaction / integration: write_heartbeat is still called exactly once per run on every path, and the heartbeat line format stays `<ISO-8601 timestamp> <status text>` so scripts/check-blog-watchdog-heartbeat.sh keeps parsing it
- [ ] Tests: tests/blog-cadence-watchdog.test.ts gains static assertions that a verification poll exists, is bounded by a config-read deadline, reuses the shared fetch helper, and contains no revert/force-push/reset in its failure path
- [ ] Tests: no test makes a real network call to bilko.run — the suite is deliberately offline/static
- [ ] Tests: `bash -n scripts/blog-cadence-watchdog.sh` passes
- [ ] Tests: `timeout 300 pnpm test` passes
- [ ] Tests: `timeout 300 pnpm typecheck` passes

# Implementation notes

This PRD depends on 1007-blog-watchdog-autonomous-publish (which makes the watchdog seed and push at all) and on 1005-blog-watchdog-survive-boot-time-network-races-on-the-api-blo (which introduces the hardened fetch). Read BOTH PRDs' landed state first — `git log` the script and read scripts/blog-cadence-watchdog.sh as it actually exists at execution time, not as described here; 1007 may have adjusted the config key names or the seed flow during its own execution.

Verified mechanics this PRD rests on (from .claude/skills/blog-from-git/seed.md, confirmed 2026-07-24 per that file): seeds are `INSERT OR IGNORE INTO blog_posts (...)` calls in initDb() in server/db.ts; a NEW slug reaches production automatically on the next Render deploy boot; EDITS to an already-deployed post's seed are silently ignored in production and require the admin blog API (server/routes/blog.ts) instead. So verification is a slug-presence check, nothing more.

Render auto-deploys from origin (StanislavBG/bilko-run) main — deploy source is configured in the Render dashboard, there is no render.yaml in-repo. Deploy latency is the reason for a generous default deadline; 900s is a starting point, not a measured value — state that in the config comment.

Extract the slug list to verify from what the seed step actually wrote rather than re-deriving it from server/db.ts by parsing TypeScript; have the claude -p run report its seeded slugs on its final stdout line (the prompt already uses a "print a one-line list ... and nothing else" convention for draft paths) and capture that.

Follow the script's existing conventions: `set -euo pipefail`, one write_heartbeat per exit path, `[blog-cadence-watchdog]`-prefixed stdout, failures to stderr, all thresholds from blog.config.yaml.

Note the active destructive-git guard hook in this environment: the failure path here is report-only by design, so nothing in this PRD should attempt any git write at all.

# Out of scope

- Do NOT revert, force-push, reset, or otherwise rewrite git history when verification fails — report only
- Do NOT re-seed or re-push on a verification timeout — the next scheduled run handles retry
- Do NOT call the Render API or add a deploy-status integration — slug presence at /api/blog is the signal
- Do NOT reimplement a second curl+jq fetch path — reuse the helper from PRD 1005
- Do NOT add notification channels (email, desktop, webhook) — heartbeat status plus non-zero exit is the escalation surface

## Engineering standards

Before writing any code, read `/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` — it has the Performance, Debugging,
API-reuse, TDD, and Execution-discipline rules that apply to this PRD. Every rule in it is
mandatory, especially Execution discipline (bounded commands, verify before done, the
finish-protocol sentinel).
