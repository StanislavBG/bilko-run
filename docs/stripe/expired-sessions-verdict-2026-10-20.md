# Anonymous expired checkout sessions since 2026-10-10: verdicts

Pulled 2026-10-20 (PDT) with `stripe checkout sessions list --live --created[gte]=2026-10-09`.
The planned `funnel_events.ip_hash` join was **not run**: no admin API key on this machine
(`~/.config/bilko-host/admin-key` absent) and no Turso credentials locally. Verdicts below use
Stripe session fields plus the commit/deploy-record timeline. All times PDT.

| Session (created) | Product | Verdict | Evidence |
|---|---|---|---|
| 10-10 22:04–22:17 (×8, incl. 2 `diag=rca-1258`, 1 $0 complete) | Launch Kit | **Owner** | Launch-night debugging; the completed one is `bilkobibitkov2000+launchkit-qa@`; `diag` sessions point at `https://bilko.run/x`. |
| 10-11 13:14 | Launch Kit | **Owner (likely)** | 10 min before `feat(site): all four purchase CTAs start checkout via data-buy` (Bilko-Launch-Kit 13:24) and the CTA publish/validation records (13:22–13:29). Those records stubbed Stripe, so this is most likely a manual click during the wiring session. Not proven without the ip_hash join. |
| 10-11 22:39 | Launch Kit | **Owner (agent)** | Bilko-Launch-Kit `reviews/deploy/.../publish.md`: "Checkout smoke (22:39:52 PDT, no payment made): POST /api/web-products/launch-kit/checkout → cs_live_…". |
| 10-11 22:40 | Launch Kit | **Owner (agent, likely)** | The same publish PRD's acceptance criteria demand a live checkout smoke; the 22:40 commit is its re-run/validation record. |
| 10-11 00:20, 10-13 12:32, 10-17 12:16 | Buy me a coffee | **Undetermined** | Created by Payment Link `plink_1U2LEcR6…` (via the `/coffee` redirect), so there is no `checkout_start` row and no email or IP on the session. No owner commit references coffee at those times. 10-11 00:20 overlaps an active owner work session (Launch Kit hub deploy 00:38–00:45); 10-13 and 10-17 have no owner coffee activity on record. Treat as possible real tippers. Only `page_hits` (`/coffee`, `is_admin`) read with an admin key can settle it. |

Not anonymous (owner, by email/ref): 10-12 20:47 BG Labs Pro (`bilkobibitkov2000@`), 10-19 11:39 Git Viewer (`stanislavbg@`).

**Bottom line:** every Launch Kit expiry since launch was the owner or an owner agent. There is no evidence yet of a real Launch Kit buyer abandoning. The three coffee sessions are the only possibly-real abandoners.

Prevention landed 2026-10-20: owner checkouts go to Stripe test mode, `?dryRun=1` for smokes, live key refused outside production, recovery enabled. See `docs/host-contract.md` → "Stripe live vs test".

## Catalog cleanup (owner-confirmed 2026-10-20/21)

Archived live products: Stepproof Suite, Stepproof Pro, Preflight Enterprise, Preflight Team, ContentGrade Pro, [Subscription] Query Flow, [ARCHIVE] Background Labs. None had active subscriptions except [ARCHIVE] Background Labs: two $1/mo owner test subscriptions (cus_U2u4cOSQCrPdrB), canceled first. Kept: Git Viewer (both), Launch Kit, coffee, Session Manager, AudienceDecoder, PageRoast, BG Labs Basic/Pro/Enterprise.
