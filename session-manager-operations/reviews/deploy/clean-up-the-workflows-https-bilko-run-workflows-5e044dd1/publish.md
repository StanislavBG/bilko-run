# Publish record: workflows removal + dead-code trim

- Pushed SHA (`origin/main`): 35dab2f3761ae0b90193f3d632d1ea47d9dbe408 (fast-forward from 7f70816, 7 commits)
- Old main asset: /assets/index-0mIBlqu0.js (recorded 2026-10-10 10:11 PDT, /api/health uptime 1465s)
- New main asset: /assets/index-DpzKiFP7.js (detected on try 5 of 20)

## Live checks
- 2026-10-10 10:13:47 PDT: new bundle does not contain "Background AI agents and automations": PASS
- 2026-10-10 10:13:48 PDT: POST /api/demos/email-capture -> 404: PASS
- 2026-10-10 10:13:48 PDT: POST /api/demos/headline-grader/unlock -> 404: PASS
- 2026-10-10 10:13:48 PDT: GET /projects -> 301 to /projects/, which returns 200: PASS (final status 200)
- /workflows returns 200 because the SPA serves index.html for unknown paths; the Workflows page and its bundle blurb are gone.
