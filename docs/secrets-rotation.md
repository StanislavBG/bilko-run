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
| `GITHUB_TOKEN` | GitHub | `server/routes/tools/git-viewer.ts` (~209, 250): raises the git-viewer rate budget to 5000/h and enables the paid tier; unset falls back to the 60/h anonymous limit. `scripts/sanity-qa-cron.sh` reads it from the cron env to open issues | GitHub API quota burned; whatever repo scope the token carries |
| `RESEND_API_KEY` | Resend | `server/services/mailer.ts` (~39, 48): mail is disabled unless it, `MAIL_FROM` and `BILKO_INBOX` are all set | mail sent as the site's sender |
| `STRIPE_TEST_SECRET_KEY` | Stripe | `server/services/stripe.ts` (~34): test-mode client for owner checkouts (`server/routes/web-products.ts` ~295 reports it as not configured when unset) | test-mode data only |
| `ANALYTICS_VISITOR_SALT` | Bilko | `server/page-hits.ts` (~102, `stableVisitorId`): salts the stable visitor hash. When unset it falls back to a salt hard-coded in that file (`bilko-visitor-v1`), so an unset value is guessable and visitor ids can be recomputed from IP + user agent | de-anonymised visitor ids |
| Admin API key (`bka_…`) | Bilko | minted by `scripts/mint-admin-key.ts` (`pnpm admin-key:mint --install`) into the `admin_api_keys` table; verified in `server/clerk.ts` (~94) via `server/services/admin-api-keys.ts`; the raw key lives only in `~/.config/bilko-host/admin-key` (or `BILKO_ADMIN_KEY_FILE`). Not a Render env var | read access to every `/api/admin/*` GET |

The admin Secrets seed in `server/db.ts` does not list `GITHUB_TOKEN`, `RESEND_API_KEY`, `STRIPE_TEST_SECRET_KEY`, `ANALYTICS_VISITOR_SALT` or the admin key, so "Mark rotated" has no row for them yet.

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
3. Render redeploys (~2–3 min). Watch the deploy finish.
4. Verify: `POST /api/stripe/create-checkout-session` as a signed-in user returns a Checkout URL (no 5xx). Do not complete the payment.
5. Stripe dashboard → revoke old key.
6. Run `POST /api/admin/secrets/STRIPE_SECRET_KEY/rotated`.

### `STRIPE_WEBHOOK_SECRET`

1. Stripe dashboard → Developers → Webhooks → endpoint → Roll secret. Copy new.
2. Render env update + redeploy.
3. Verify: trigger a test webhook from Stripe dashboard "Send test webhook" button. Pass means Stripe shows the delivery as 200. A bad secret returns 400 `Webhook signature verification failed.` (`server/routes/stripe.ts` ~200).
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
3. Verify: `GET /api/admin/secrets` with the admin API key returns 200 (it reads the DB). `POST /api/analytics/event` with an empty body returns 400 `Unknown event` (`server/routes/analytics.ts` ~200), which proves the server is up but not that the DB works.
4. Revoke old token: `turso db tokens revoke <id>`.
5. Mark rotated.


### `ANTHROPIC_API_KEY_ACADEMY`

1. Anthropic console → API keys → create a new key dedicated to Academy.
2. Render env update + redeploy (if it is missing the server still starts, logs `[Academy] ANTHROPIC_API_KEY_ACADEMY not set` as a warning, and `/api/academy/ask` returns 503 — `server/routes/academy.ts` ~35).
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

### `GITHUB_TOKEN`

1. GitHub → Settings → Developer settings → create a new token with the narrowest read scope git-viewer needs.
2. Render env update + redeploy.
3. Verify: `GET /api/health` `.gitViewer` shows the token as set; the git-viewer log line reads `token=set`.
4. Revoke the old token. Mark rotated (once seeded).

### `RESEND_API_KEY`

1. Resend dashboard → API keys → create a new key.
2. Render env update + redeploy.
3. Verify: with `MAIL_FROM` and `BILKO_INBOX` set, a site action that sends mail (see `server/services/mailer.ts`) delivers; the Resend dashboard logs the send.
4. Delete the old key.

### `STRIPE_TEST_SECRET_KEY`

1. Stripe dashboard (test mode or sandbox) → API keys → roll the secret key.
2. Render env update + redeploy.
3. Verify: an owner checkout no longer returns "Stripe test mode, which is not configured".
4. Revoke the old key.

### `ANALYTICS_VISITOR_SALT`

1. Generate a random salt (`openssl rand -hex 32`).
2. Render env update + redeploy. Changing it changes every stable visitor id, so returning-visitor counts reset once.
3. Verify: `POST /api/analytics/event` with an empty body returns 400 `Unknown event` (server is up).

### Admin API key

1. Run `TURSO_DATABASE_URL=… TURSO_AUTH_TOKEN=… pnpm admin-key:mint --install`. It mints a new `bka_` key, revokes older live keys with the same label, and writes the file at `~/.config/bilko-host/admin-key`. The key is never printed.
2. Verify: `GET /api/admin/secrets` with the new key as Bearer returns 200; the old key returns 401.
