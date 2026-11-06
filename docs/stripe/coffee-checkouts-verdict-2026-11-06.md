# Coffee checkout starts, 2026-10-30 to 2026-11-06: verdicts

Pulled 2026-11-06 (PST), read-only: `stripe get /v1/checkout/sessions --live`, the bilko.run admin API
(`/api/admin/sessions`, `/api/admin/traffic?slug=…`, `/api/admin/flows`) and GitHub repo traffic.
Asked by Self's portfolio review (D-2026-11-06-03). All times PST.

All six were created by the live coffee Payment Link `plink_1U2LEcR6…` (`buy.stripe.com/eVq6…`, $5,
`price_1U2LEcR6…`). The `product_key` metadata is copied from the link. None came from the server-side
`checkout.sessions.create` fallback in `GET /coffee`, which never runs while `COFFEE_PAYMENT_LINK_DEFAULT`
is set. No session got past the first screen: no email was entered on any of them.

| Created | Session | Stripe status | Visitor location (Adaptive Pricing) | bilko.run trace before it | Verdict |
|---|---|---|---|---|---|
| 11-05 02:35:33 | …k9JavKkpd0 | expired, unpaid | US (USD, US-only methods offered) | none | unclassifiable, likely automated |
| 11-05 03:57:36 | …RomGCWYw7p | expired, unpaid | China (priced in CNY) | none | unclassifiable, likely automated |
| 11-05 09:16:47 | …S2UsESHxWr | expired, unpaid | US | two one-page `/projects` visits 6–7 min earlier, no clicks | unclassifiable |
| 11-05 09:33:12 | …lXY7lPU9PY | expired, unpaid | US | none | unclassifiable, likely automated |
| 11-05 12:30:10 | …TlmWz5gMKP | expired, unpaid | US | none | unclassifiable, likely automated |
| 11-06 02:04:39 | …smCdvb5ktZ | open, unpaid (expires 11-07 02:04) | US | none (SST's headless live checker loaded the dashboard 10–17 min after) | unclassifiable |

What the evidence rules out:

- **A click on a bilko.run page.** There were no `tip.click-tip` events and no `tip-coffee` clicks in 8 days. No
  browser session on bilko.run ended within 15 minutes before 5 of the 6. No project page, including the Social
  Signals Trader dashboard, which links the raw payment link, had a hit in the 20 minutes before any of them.
- **Curl-style scripts.** In test mode, plain GETs of a Payment Link, with curl's user-agent and with a Chrome
  user-agent, created no session. Each headless Chromium load created one. Only a client that runs Stripe's
  JavaScript can start a session. That means a person or a headless browser.
- **Our own automation.** No Claude transcript since 10-30 opened the coffee URL in a browser.
- **The Session Manager GitHub README.** The repo had 1 view (1 unique) on 11-05.

Why the class is unknown: until this commit, `GET /coffee` was not recorded in `page_hits`, because a
bodyless 302 has no `text/html` content-type. Stripe also stores no IP or user-agent for Payment Link
sessions. Five starts in one day, from the US and China, none past page load and with no trace on bilko.run,
look more like crawlers or agents following an off-site link than tippers giving up. That is not proven. The
off-site links are `bilko.run/coffee` in the Session Manager README, FUNDING.yml and npm `funding` field, and the
raw `buy.stripe.com` URL in SST's public snapshot JSON and in this repo.

Lifetime on this link: 13 sessions since 2026-08-08, 0 paid, 0 with an email.

**Checkout completes for a person.** On 2026-11-06 the real `/coffee` route ran locally in Stripe test mode,
pointed at the test coffee link. A browser clicked the footer anchor, went through `/coffee` (302) to the
Payment Link, and paid with card 4242. The session ended `complete`/`paid` for $5. `/checkout/success` for that
session returned 200 with "Thanks for the coffee ☕". Nothing was broken, and nothing was changed on prices or
links.

Prevention: `/coffee` hits are now recorded in `page_hits` with visitor class, referrer and country
(`server/page-hits.ts`), so the next coffee start can be matched to its visitor by time.

## Re-check, 2026-11-06 2:45 PM PST

Asked again by Self (same decision). Live Stripe still shows these 6 sessions in Self's window and no coffee
session after 11-06 02:04. Every one has `payment_intent` null: no one submitted payment details on any of them.

Production now records `/coffee`. A curl probe at 2:45:45 PM was stored as `/coffee`, 302, class `script`. The
deploy check at 2:40 PM was stored as `human`, though it was a tool (UA `bilko-coffee-audit/1 …`).
`classifyVisitor` called every UA it did not list a person. It now calls any UA that does not start with
`Mozilla/` a `script`, the rule `/buy` already used (`server/routes/agent-buy.ts`). Rows from before this deploy
keep their class, so human counts drop a little from the deploy on.

**For Self's `snapshot.py`: don't drop starts by visitor class.** Stripe stores no class, IP or user-agent on
a Payment Link session, so `snapshot.py` has nothing to filter on. Curl-type scripts and API clients cannot
start a coffee session at all (test mode, above). Only a browser running Stripe's JavaScript can, and in Stripe
a headless one looks the same as a person. Count intent instead: Stripe creates the `payment_intent` only when
someone submits payment details. Report `real_started` as page loads and add `real_attempted` (sessions with a
`payment_intent`). Judge buying intent on attempted and paid, not on started. This window: 6 started,
0 attempted, 0 paid. To learn the class of a future start, match it to the `/coffee` hit seconds before it. A
start with no `/coffee` hit came through the raw `buy.stripe.com` link (SST's snapshot JSON, `shared/product-catalog.ts`) and
stays unclassified.
