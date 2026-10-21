# bilko.run traffic review: 30 days to 2026-10-20

**Status: blocked. A human has to mint the admin key.** No `bka_...` key exists on this machine. `BILKO_ADMIN_KEY` is unset and `~/.config/bilko-host/admin-key` is missing, so `traffic_report` cannot reach `/api/admin/traffic`. The ~5,000-visitor figure is still **unverified**.

## Unblock (Stanislav, about 1 minute)

1. Sign in as admin. Open https://bilko.run/admin/secrets → *Admin API keys* → **Create key**. Copy the `bka_...` value. It is shown only once.
2. `mkdir -p ~/.config/bilko-host && (umask 077; cat > ~/.config/bilko-host/admin-key)`, then paste the key, press Enter, then Ctrl-D.
3. In any Claude session, run `mcp__bilko-host__traffic_report { "days": 30, "excludeSelf": true }`. Paste the numbers into the table below.

No MCP restart is needed for the key, because it is read on every call. The `traffic_report` tool does appear only after the bilko-host MCP server restarts, i.e. in a new Claude session.

## Results (to fill in)

| Metric | Value |
|---|---|
| Human visitors (IP+UA) | — |
| Bot visitors / bot hit % | — |
| Human single-hit visitors (%) | — |
| bilko_vid cookie uniques | — |
| Top 5 pages | — |
| Top 5 projects | — |
| Top 5 referrers | — |
| `metricValidSince` (visitors / cookie) | — |

## Read these numbers with care

- **The window is shorter than 30 days.** `page_hits` began on 2026-10-12, and the `bilko_vid` cookie on 2026-10-18. A 30-day request really covers about 8 days of visitor data. Any "5,000 visitors" figure from before 2026-10-12 came from another source, such as client-side `page_views` or an outside tool. It is not comparable.
- **"Visitors" means a salted hash of IP + user agent, not the cookie.** One person on a phone and a laptop counts as two. An office behind one NAT using the same browser counts as one.
- **Bots are flagged by user agent only.** Crawlers that send a browser UA are counted as human. Their main signal is `humanSingleHit`. A high single-hit share, together with few clicks, points to undeclared bots rather than real readers.
- **Cookie uniques over-count non-browsers.** A client that drops cookies gets a new `bilko_vid` on every request. If `bilkoVidCookie` is much higher than `visitors.human`, that gap is mostly non-browser traffic.
- The same doubt applies to npm: `claude-code-session-manager` shows 9,440 downloads in 30 days against 1 GitHub star. npm download counts include mirrors and CI installs, so they are not a measure of human interest either.
