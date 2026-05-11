# Deployment — bilko.run on Render

bilko.run is hosted on Render, auto-deploying from the **`Content-Grade/Content-Grade` `master`** branch (NOT `origin/main`). Every git push must therefore also be pushed to `content-grade master`. See [CLAUDE.md](../CLAUDE.md) "Rules" for the dual-push contract.

## Topology

```
StanislavBG/bilko-run (origin)  ──┐
                                  ├── git push    Render
Content-Grade/Content-Grade (cg)  ──┘─── webhook ──▶ build ──▶ deploy
                                              ▲
                                              │
                            (manual Deploy Hook bypasses webhook)
```

## Failure mode: "deploy never fires"

Symptom: the latest commit lands in `content-grade/master` but `bilko.run/api/health` reports a multi-day uptime and new static assets return the SPA fallback HTML instead of their own bundle.

Root cause every time so far: **Render's GitHub App is disconnected** from `Content-Grade/Content-Grade`. Verify with:

```bash
gh api repos/Content-Grade/Content-Grade/hooks | jq 'length'   # expected: ≥1; if 0, webhook is gone
curl -s https://bilko.run/api/health | jq .uptime              # expected: ≲ build-duration; if days, no deploy
curl -sI https://bilko.run/projects/<latest-game>/manifest.json | grep -i content-type
                                                                # expected: application/json; if text/html, stale
```

This has recurred four times (Sudoku, MindSwiffer, Academy, wave-2 games). The webhook silently disappears after GitHub OAuth re-auth or org-permission changes. Reconnecting it is the only permanent fix.

## Triggering a deploy

### Option A — Deploy Hook (autonomous, preferred)

One-time setup:

1. Render dashboard → `bilko-run` service → **Settings** → **Build & Deploy**
2. Scroll to **Deploy Hook**, copy the URL (`https://api.render.com/deploy/srv-XXX?key=YYY`)
3. Add to `.env.local` (gitignored) at the repo root:
   ```
   RENDER_DEPLOY_HOOK=https://api.render.com/deploy/srv-XXX?key=YYY
   ```

Then any session — including unattended PRDs — can trigger a deploy with:

```bash
./scripts/render-deploy.sh
```

### Option B — Dashboard Manual Deploy (fallback)

1. Render dashboard → `bilko-run` service
2. Top right → **Manual Deploy** → **Deploy latest commit**
3. Wait ~3–5 min, then verify with the three curl checks above

### Option C — Reconnect GitHub App (permanent fix)

1. Render dashboard → service → **Settings** → **Build & Deploy** → **Auto-Deploy**
2. **Connect a repository** → re-authorize the Render GitHub App for `Content-Grade/Content-Grade`
3. Confirm branch is `master`
4. Test by pushing an empty commit:
   ```bash
   git commit --allow-empty -m "test: trigger Render deploy" && git push content-grade main:master
   ```

## Verifying a deploy landed

```bash
# uptime should drop to seconds, not days
curl -s https://bilko.run/api/health | jq .

# any newly-shipped static-path app should return its own title, not the host SPA
for slug in fizzpop etch cellar sudoku mindswiffer academy; do
  echo "=== $slug ==="
  curl -s "https://bilko.run/projects/$slug/" | grep -oE "<title>[^<]+</title>"
done

# manifests must be JSON, not text/html
curl -sI https://bilko.run/projects/cellar/manifest.json | grep -i content-type
```

## Push contract

Both pushes are required:

```bash
git push origin main
git push content-grade main:master    # this is the one Render watches
```

If you forget the `content-grade` push, Render never sees the commit and the deploy never fires regardless of webhook state.
