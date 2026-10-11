# Launch Kit: publish landing (job 1257)

Run: 2026-10-10 ~22:00-22:10 PDT (America/Los_Angeles).

| Item | Value |
|---|---|
| Register commit | e645dbc17264f2a7353fcf3611bf33aa421d0470 |
| Publish commit (mcp__bilko-host__status; publish checkout HEAD == origin/main) | 8c110893f80ef92694905f30a006c1fd93347144 |
| Gates | manifest=pass, budget=pass, golden=pass, a11y=pass, audit=pass (none bypassed) |
| Site build | `pnpm build` in site/: launch-kit 1.0.0 (e644449, 59.8 KB gz) |

## Checks

| # | Check | Result |
|---|---|---|
| 1 | No *.zip or SKILL.md under site/dist before publish (find, inverted) | PASS |
| 2 | Slug `launch-kit` registered (was absent in list_projects) | PASS |
| 3 | Publish with no gate bypass, no rebuild needed | PASS |
| 4a | /projects/launch-kit/ returns 200 with 'Launch Kit' and '$9' (poll 8 of 20, 22:09 PDT) | PASS |
| 4b | /projects/launch-kit/thanks/?session_id=x serves the launch-kit thanks page ("Your download — Bilko Launch Kit", not SPA shell) | PASS |
| 4c | /og/launch-kit.png 200 (404 for polls 1-7 until deploy finished) | PASS |
| 4d | Landing JS calls production API `/api/web-products/launch-kit/checkout` (same origin) | PASS |
| 4e | No .zip served under /projects/launch-kit/ (landing references none; a guessed .zip URL returns text/html SPA fallback, not a zip) | PASS |

## Notes

- `register_static_project` has no `displayName` or `public` parameters, so the registry entry was created without `displayName: 'Launch Kit'` and `public: true`. Registry name is 'Bilko Launch Kit'. If the card must appear on /projects, those two fields need a follow-up registry edit.
- No `sourceRepo` was registered, as specified.
