# Secrets rotation runbook

This is the operational playbook. Rotate any secret >90 days old, after a
suspected leak, or when an employee leaves the team (currently a no-op since
the team is one person, but the principle stands).

## Inventory

| Name | Vendor | Where used | Failure mode if leaked |
|---|---|---|---|
| `STRIPE_SECRET_KEY` | Stripe | server: charge/refund (`scripts/cost-monitor.ts` reads it as `STRIPE_API_KEY`) | $$$ exfiltrated |
| `STRIPE_WEBHOOK_SECRET` | Stripe | server: webhook signature verification | spoofed payment events |
| `GEMINI_API_KEY` | Google | server: every AI call | API quota burned |
| `CLERK_SECRET_KEY` | Clerk | server: token verification | impersonation |
| `TURSO_AUTH_TOKEN` | Turso | server: DB connection | full DB read/write |
| `ANTHROPIC_API_KEY_ACADEMY` | Anthropic | server: Academy proxy (`/api/academy/ask`) | API quota burned |
| `PROJECT_SNAPSHOT_TOKEN` | Bilko | server: shared bearer for every project's snapshot/event writes and feedback inbox; fallback for the Session Manager usage read | forged project data on any project; any project's customer feedback read, re-statused or hidden |
| `PROJECT_FEEDBACK_TOKENS` | Bilko | server: per-project bearers, each opening one project's feedback inbox | that one project's customer feedback read, re-statused or hidden |
| `SM_USAGE_READ_TOKEN` | Bilko | server: headless read of `/api/admin/session-manager/usage` | Session Manager usage stats read |
| `BILKO_GAME_HMAC_KEY` | Bilko | server: signs game scores | forged leaderboard scores |

## General principles

- **Rotate without downtime.** Every vendor supports keeping two keys live
  simultaneously during cutover. Provision the new key, deploy the env var,
  verify, *then* invalidate the old.
- **Never log a secret.** If a rotation script accidentally prints, change
  the secret again immediately.
- **Test in staging first** if a staging env exists; otherwise rotate on a
  low-traffic day and watch logs for 5 minutes.

## Per-secret procedures

### `STRIPE_SECRET_KEY`

1. Stripe dashboard → Developers → API keys → Roll secret key. Copy the new key.
2. Render dashboard → bilko-run service → Environment → set `STRIPE_SECRET_KEY` to the new value (and `STRIPE_API_KEY` if you run `scripts/cost-monitor.ts`). Save.
3. Render redeploys (~2–3 min). Watch logs for `Stripe initialized` line.
4. Verify: in admin SQL view, run `SELECT created_at FROM token_purchases ORDER BY id DESC LIMIT 1;` then make a $1 test charge. Row appears.
5. Stripe dashboard → revoke old key.
6. Run `POST /api/admin/secrets/STRIPE_SECRET_KEY/rotated`.

### `STRIPE_WEBHOOK_SECRET`

1. Stripe dashboard → Developers → Webhooks → endpoint → Roll secret. Copy new.
2. Render env update + redeploy.
3. Verify: trigger a test webhook from Stripe dashboard "Send test webhook" button. Watch logs for "Stripe webhook verified".
4. Mark rotated in admin.

### `GEMINI_API_KEY`

1. Google AI Studio → API keys → Create new key.
2. Render env update + redeploy.
3. Verify: visit `/projects/headline-grader/`, score a headline, get a non-empty result.
4. Delete old key from Google AI Studio.
5. Mark rotated.

### `CLERK_SECRET_KEY`

1. Clerk dashboard → API keys → Roll.
2. Render env update + redeploy.
3. Verify: log in via Clerk widget; user.email appears in `/admin`.
4. Mark rotated.

### `TURSO_AUTH_TOKEN`

1. Turso CLI: `turso db tokens create bilko --expiration 90d`. Capture token.
2. Render env update + redeploy.
3. Verify: `curl https://bilko.run/api/analytics/event -X POST` returns 200 (proves DB writable).
4. Revoke old token: `turso db tokens revoke <id>`.
5. Mark rotated.


### `ANTHROPIC_API_KEY_ACADEMY`

1. Anthropic console → API keys → create a new key dedicated to Academy.
2. Render env update + redeploy (production refuses to start without it).
3. Verify: ask a question in the Academy; get a non-empty answer.
4. Revoke the old key. Mark rotated.

### `PROJECT_SNAPSHOT_TOKEN`

The value lives outside Render in these places. Holders rename it, so searching for `PROJECT_SNAPSHOT_TOKEN` alone misses them; search for the routes as well. Add any new holder here in the same change that creates it.

| Holder | Where the value lives | Uses it for |
|---|---|---|
| social-signals-trader | `SST_DASHBOARD_SNAPSHOT_TOKEN` in that repo's `.env` | posts snapshots and events, pulls feedback |
| social-signals-trader dashboard owner mode | `localStorage` in the owner's browser, captured from `#options?owner=<token>` | moderates feedback; a 401 clears it, so capture it again |
| Session Manager | `token` in `~/.claude/session-manager/customer-feedback-owner.json`, or `SM_FEEDBACK_OWNER_TOKEN` | reads its feedback inbox and sets status; posts no snapshots or events |

The two feedback-only holders can move to `PROJECT_FEEDBACK_TOKENS`, which drops them from this table. `/api/admin/session-manager/usage` also accepts this token as a fallback, but no script in the sibling repos uses it (the admin page signs in with Clerk).

1. Generate a new random token (`openssl rand -hex 32`).
2. Update it in Render env; redeploy. The host keeps one value, so every holder gets 401 until step 3.
3. Update every holder in the table above.
4. Verify: a sibling snapshot upload returns 2xx, not 401, and Session Manager's `customer_feedback_list` returns items, not a token error.
5. Mark rotated.

### `PROJECT_FEEDBACK_TOKENS`

Comma-separated `slug:token` pairs, for example `session-manager:<hex>`. Each token opens `GET`, `moderate` and `status` on that project's feedback and is refused everywhere else. One name in Render holds every project's token, so "Mark rotated" records the most recent rotation of any of them.

| Slug | Holder | Where the value lives |
|---|---|---|
| `session-manager` | Session Manager | `token` in `~/.claude/session-manager/customer-feedback-owner.json`, or `SM_FEEDBACK_OWNER_TOKEN` |
| `social-signals-trader` | dashboard owner mode | `localStorage` in the owner's browser, captured from `#options?owner=<token>` |

Listing a holder here does not mean it has moved yet: until its pair is in Render it stays on `PROJECT_SNAPSHOT_TOKEN`.

To add a project, or rotate one project's token with no downtime (a slug may appear twice, and both tokens work until the old pair is removed):

1. Generate a new random token (`openssl rand -hex 32`).
2. Append `<slug>:<token>` to the value in Render env; redeploy.
3. Put the token in that project's holder, listed above.
4. Verify: `GET /api/projects/<slug>/feedback` with the new token returns 200, and with that project's token on another slug returns 401.
5. Remove the old pair from Render env, if there was one; redeploy.
6. Mark rotated.

### `SM_USAGE_READ_TOKEN`

No script in the sibling repos holds this today; check the owner's local scripts before rotating.

1. Generate a new random token (`openssl rand -hex 32`).
2. Render env update + redeploy, then update any script that reads the usage route.
3. Verify: `GET /api/admin/session-manager/usage` with the new token returns 200.
4. Mark rotated.

### `BILKO_GAME_HMAC_KEY`

1. Generate a new random key (`openssl rand -hex 32`).
2. Render env update + redeploy. Scores signed with the old key stop validating, so in-flight games may be rejected once.
3. Verify: finish a game and submit a score.
4. Mark rotated.
