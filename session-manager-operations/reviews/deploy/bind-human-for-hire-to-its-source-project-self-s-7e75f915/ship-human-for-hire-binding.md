# Ship: human-for-hire binding to ~/Self

Status: SHIPPED (all checks green)

## Plan commit
- `05ac2e1579b6d656b9be1a18ea1c7c8fd02fe0e0` feat(registry): bind human-for-hire host.localPath to ~/Self
  (src/data/standalone-projects.json, scripts/refresh-commit-order.ts, docs/host-internals.md)
- `git log origin/main..HEAD` showed only this commit, so it was pushed as-is (no cherry-pick).

## Push
- `git push origin 05ac2e15…:refs/heads/main`: `992ef37b..05ac2e15` (fast-forward, no force, origin only, never content-grade).
- Push time: Thu Nov 19 10:36:20 AM PST 2026.
- `git merge-base --is-ancestor 05ac2e15 origin/main`: exit 0.
- Afterward, Self pushed `d8022fda listing: update human-for-hire` (an update_project_listing write) on top of it.
  So the binding already works for Self. That commit leaves the localPath line alone, and origin/main still has `"localPath": "~/Self"`.

## sync-local-main.sh
- `cd /home/bilko/Projects/Bilko && bash scripts/sync-local-main.sh`: `[sync-local-main] in sync at 05ac2e15`, exit 0.
- python3 check of /home/bilko/Projects/Bilko/src/data/standalone-projects.json, human-for-hire host:
  `{'kind': 'external-url', 'url': 'https://bilko.run/book', 'localPath': '~/Self'}`

## Deploy check (/api/health uptime vs seconds since push; 30 s apart, max 20 tries, curl --max-time 15)
```
try 1 10:36:27 uptime=1930 elapsed=7
try 2 10:36:57 uptime=1961 elapsed=37
try 3 10:37:27 uptime=1991 elapsed=67
try 4 10:37:57 uptime=2021 elapsed=97
try 5 10:38:27 uptime=2051 elapsed=127
try 6 10:38:57 uptime=2081 elapsed=157
try 7 10:39:28 uptime=57 elapsed=188
REDEPLOYED
```
Caveat: Render's free tier can also restart after 15 min idle. Here the instance had been up for 2081 s just before the drop, so the restart was not an idle wake. It is the redeploy.

## Live checks (times PST, after the redeploy)
- `curl -sf --max-time 15 https://bilko.run/api/projects`: 13870 bytes. human-for-hire is listed as `('human-for-hire', 'https://bilko.run/book')`.
  - `grep -c -F localPath`: 0
  - `grep -c -F '~/Self'`: 0
- `curl -s -o /dev/null -w '%{http_code}' --max-time 15 https://bilko.run/book`: 200
- The tagline was not checked (Self owns the card copy). No bilko-host write tool was called.

## CI (gh run list --branch main --limit 1)
- `completed success listing: update human-for-hire CI main push 44589664274 3m27s 2026-11-19T18:36:50Z` (head d8022fda, which contains 05ac2e15)
- The run for 05ac2e15 itself (2026-11-19T18:36:22Z) was `cancelled` because d8022fda's push superseded it. The success run above covers it.
