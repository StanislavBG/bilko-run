# Secrets rotation runbook

This is the operational playbook. Rotate any secret >90 days old, after a
suspected leak, or when an employee leaves the team (currently a no-op since
the team is one person, but the principle stands).

## Inventory

| Name | Vendor | Where used | Failure mode if leaked |
|---|---|---|---|
| `STRIPE_API_KEY` | Stripe | server: charge/refund | $$$ exfiltrated |
| `STRIPE_WEBHOOK_SECRET` | Stripe | server: webhook signature verification | spoofed payment events |
| `GEMINI_API_KEY` | Google | server: every AI call | API quota burned |
| `CLERK_SECRET_KEY` | Clerk | server: token verification | impersonation |
| `CLERK_WEBHOOK_SECRET` | Clerk | server: user-event webhook | spoofed user events |
| `TURSO_AUTH_TOKEN` | Turso | server: DB connection | full DB read/write |
| `MANUAL_DOWNLOAD_SECRET` | self | server: signs Field Manual download tokens | forged/never-expiring manual download links |

## General principles

- **Rotate without downtime.** Every vendor supports keeping two keys live
  simultaneously during cutover. Provision the new key, deploy the env var,
  verify, *then* invalidate the old.
- **Never log a secret.** If a rotation script accidentally prints, change
  the secret again immediately.
- **Test in staging first** if a staging env exists; otherwise rotate on a
  low-traffic day and watch logs for 5 minutes.

## Per-secret procedures

### `STRIPE_API_KEY`

1. Stripe dashboard → Developers → API keys → Roll secret key. Copy the new key.
2. Render dashboard → bilko-run service → Environment → set `STRIPE_API_KEY` to the new value. Save.
3. Render redeploys (~2–3 min). Watch logs for `Stripe initialized` line.
4. Verify: in admin SQL view, run `SELECT created_at FROM token_purchases ORDER BY id DESC LIMIT 1;` then make a $1 test charge. Row appears.
5. Stripe dashboard → revoke old key.
6. Run `POST /api/admin/secrets/STRIPE_API_KEY/rotated`.

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

### `CLERK_SECRET_KEY` and `CLERK_WEBHOOK_SECRET`

1. Clerk dashboard → API keys / Webhooks → Roll.
2. Render env update + redeploy.
3. Verify: log in via Clerk widget; user.email appears in `/admin`. Send a test webhook.
4. Mark rotated.

### `TURSO_AUTH_TOKEN`

1. Turso CLI: `turso db tokens create bilko --expiration 90d`. Capture token.
2. Render env update + redeploy.
3. Verify: `curl https://bilko.run/api/analytics/event -X POST` returns 200 (proves DB writable).
4. Revoke old token: `turso db tokens revoke <id>`.
5. Mark rotated.

### `MANUAL_DOWNLOAD_SECRET`

**Required in production.** `server/services/manual.ts` signs the Field Manual's short-lived
download tokens with this key. If it's unset, the server falls back to a random per-process key —
tokens then break across a restart and disagree between instances behind a load balancer, so a
buyer's download link can fail mid-session. There's no vendor rotation flow; generate a fresh
random value and roll it like any HMAC secret.

1. Generate a new value: `openssl rand -hex 32`.
2. Render dashboard → bilko-run service → Environment → set `MANUAL_DOWNLOAD_SECRET`. Save.
3. Render redeploys. Rolling this secret invalidates any download link minted in the last 5
   minutes (`DOWNLOAD_TOKEN_TTL_MS`) — negligible blast radius, no coordination needed.
4. Verify: sign in as an entitled buyer at `/manual`, download an asset, confirm it completes.
5. Mark rotated.

## After every rotation

- Add a note in `secret_metadata.notes` describing what triggered it (90d, leak, off-boarding).
- If rotation was due to a leak, also: invalidate any user sessions older than the leak window.
