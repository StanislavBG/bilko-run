# bilko.run traffic review: 30-day window to 2026-10-21

**Status: done.** Pulled 2026-10-21 with `traffic_report { days: 30, excludeSelf: true }`. The admin key is at `~/.config/bilko-host/admin-key` (mode 600).

**Headline: the ~5,000-visitor figure does not hold.** The server has 9 days of data (2026-10-13 to 2026-10-21). In that window it saw **273 visitors whose user agent looks like a real browser**, which is about 30 per day. 62% of the visitors that are not UA-flagged as bots loaded exactly one page. Referrals are close to zero.

## Results (window 2026-10-13 to 2026-10-21, own visits excluded)

| Metric | Value |
|---|---|
| Browser-class visitors (`byClass.human`) | **273** (2,292 hits) |
| Not UA-flagged as bots (`visitors.human`) | 317 (3,323 hits). This still includes `script`-class traffic. |
| Visitors flagged as bots | 141 (1,143 hits). 25.6% of hits, 30.8% of visitors. |
| Visitors in other classes | script 109 (1,839 hits) · search crawlers 49 · AI crawlers 12 · AI user agents 9 |
| Single-hit share of `visitors.human` | 198 of 317 (62.5%) |
| bilko_vid cookie uniques (since 2026-10-18) | 343 |
| Visitors per day | 34, 67, 36, 40, 48, 46, 83, 44, 17 (the last day is partial) |
| Top pages (visitors) | `/` 197 · `/projects/` 15 · `/products/session-manager` 11 · `/projects/session-manager/` 9 · `/projects/git-viewer/` 7 |
| Top projects (visitors) | session-manager 15 · git-viewer 7 · escape-velocity 6 · launch-kit 4 · academy 4 · game-academy, outdoor-hours, social-signals-trader 3 each |
| Referrers (hits) | linkedin.com 7 · google.com 4 · accounts.google.com 4 (sign-in) · t.co 2 · google.com.hk, facebook.com, duckduckgo.com 1 each. **No reddit.** |
| Top countries (hits) | US 709 · PL 600 · NL 561 · KR 423 · AU 232 · IN 230 |
| Clicks | 518 (1,235 with your own visits included) |
| `metricValidSince` | visitors 2026-10-13 · cookie 2026-10-18 |

## What it means

- **Real reach is about 30 to 80 people a day, nearly all of whom land on `/` and leave.** Per-project pages get single-digit visitors. Nothing on bilko.run currently gets enough traffic to judge demand for it.
- **Referrals barely register.** Burrow's X replies show up as `t.co`, with 2 hits in 9 days. LinkedIn is the largest referrer at 7. Google brings 4. Reddit brings none. Most traffic arrives with no referrer at all (direct visits, apps, or bots).
- **Much of the "human" bucket is scanners.** `/wp-admin/install.php` (94 hits), `/.env`, `/wp-login.php` and random `*.php` probes are all in the top 25. The country mix also points to hosting providers: PL, NL and KR together outweigh the US.
- **The npm signal is consistent with this.** `claude-code-session-manager` shows 9,440 downloads in 30 days, but only 15 visitors reached the Session Manager pages. Those downloads are mostly mirrors and CI, not people.
- **Next data need:** UTM-tagged links on every outbound post. `funnel_report` already exists to measure them, and the current referrer counts are too small to tell channels apart.

## Read these numbers with care

- **The window is shorter than 30 days.** `page_hits` began on 2026-10-12, and the `bilko_vid` cookie on 2026-10-18. A 30-day request really covers about 8 days of visitor data. Any "5,000 visitors" figure from before 2026-10-12 came from another source, such as client-side `page_views` or an outside tool. It is not comparable.
- **"Visitors" means a salted hash of IP + user agent, not the cookie.** One person on a phone and a laptop counts as two. An office behind one NAT using the same browser counts as one.
- **Bots are flagged by user agent only.** Crawlers that send a browser UA are counted as human. Their main signal is `humanSingleHit`. A high single-hit share, together with few clicks, points to undeclared bots rather than real readers.
- **Cookie uniques over-count non-browsers.** A client that drops cookies gets a new `bilko_vid` on every request. If `bilkoVidCookie` is much higher than `visitors.human`, that gap is mostly non-browser traffic.
- The same doubt applies to npm: `claude-code-session-manager` shows 9,440 downloads in 30 days against 1 GitHub star. npm download counts include mirrors and CI installs, so they are not a measure of human interest either.
