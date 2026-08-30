# Sub-skill: scan (Part 2) — GitHub is the source of truth

Two rules that are easy to get wrong and have been:

1. **Pull from the GitHub API, not local clones.** Local trees are stale, dirty, on the wrong
   branch, or missing. The GitHub API gives the pushed truth for any window. Use `gh api`.
2. **Scan EVERY repo, not just the Bilko host repo.** `StanislavBG/bilko-run` is the LEAST
   representative — its log is dominated by automated `social-signals-trader: publish dashboard
   snapshot` (every 30 min) and `OutdoorHours` hourly refreshes. Counting those is how you wrongly
   conclude the week was "quiet." The real work lives in the siblings. (Memory:
   `feedback_blog_scans_whole_portfolio`.)

**Owners:** everything lives under the GitHub account **`StanislavBG`** (~73 repos). The host repo
is `StanislavBG/bilko-run`. (`Content-Grade` is a separate, diverged project — see CLAUDE.md;
include it in the scan only if explicitly asked.)

> ⚠️ **Not everything is on GitHub yet.** A repo that is local-only with no remote is invisible to a
> pure GitHub scan, and a build log is often *about* exactly such a repo (the trading stack —
> `burrow`, `signal-builder`, `social-signals-trader` — was local-only until 2026-06-04; `burrow`
> and `sigma-plus` still are as of 2026-07-24). So: GitHub-first, then a local reconciliation pass
> (step 5). **Flag any still-unpushed repo to the user** so GitHub can actually be the single
> source of truth.

## 1. Find the window

```bash
cd ~/Projects/Bilko
grep -n "published_at" server/db.ts | tail -3      # blog seeds live in server/db.ts initDb()
```
Read the latest seed block(s) for the last post's date, slug, and what it covered (don't repeat
it). Today's date is in session context. Window = `[last post date, today]`. Set
`SINCE=<last-post-date>T00:00:00Z`. Cross-check against the ledger — they must agree.

## 2. Enumerate repos touched in the window

```bash
gh repo list StanislavBG --limit 300 --json name,pushedAt,createdAt \
  --jq ".[] | select(.pushedAt >= \"$SINCE\") | .name + \"  pushed \" + .pushedAt[:10] + \"  created \" + .createdAt[:10]"
```
- `pushedAt >= SINCE` → candidate repos. `createdAt >= SINCE` → **new repos = launches**, the
  highest-signal items. Call these out.

## 3. Pull commits per repo (filter automation noise)

```bash
gh api "repos/StanislavBG/$REPO/commits?since=$SINCE&per_page=100" --paginate \
  --jq '.[] | (.commit.committer.date[:10]) + "  " + (.sha[:8]) + "  " + (.commit.message | split("\n")[0])' \
  | grep -viE "dashboard snapshot|hourly refresh|hourly snapshot|publish.*snapshot"
```
Counts are not a story. 376 dashboard-snapshot commits is one cron, not a busy week.

## 4. Mine substance — diffs, commit bodies, project context

```bash
HEAD=$(gh api "repos/StanislavBG/$REPO/commits?per_page=1" --jq '.[0].sha')
BASE=$(gh api "repos/StanislavBG/$REPO/commits?since=$SINCE&per_page=100" --paginate --jq '.[-1].sha')
gh api "repos/StanislavBG/$REPO/compare/$BASE...$HEAD" --jq '.files[]? | (.status[:1]) + " " + .filename'
gh api "repos/StanislavBG/$REPO/compare/$BASE...$HEAD" -H "Accept: application/vnd.github.diff"   # raw patch
gh api "repos/StanislavBG/$REPO/commits/<sha>" --jq '.commit.message'                             # the WHY
gh api "repos/StanislavBG/$REPO/readme" --jq '.content' | base64 -d | head -60                    # launch context
```
Hunt for **cross-repo arcs** — the best build logs are one story spanning repos. Capture the
specifics the voice rules demand: version bumps, PRD numbers, real test counts, before/after.
(A GitHub MCP server, if connected, is equivalent — fetch its schema via ToolSearch first.)

## 5. Reconciliation pass — catch local-only repos

```bash
cd ~/Projects
for d in */; do
  [ -d "$d/.git" ] || continue
  git -C "$d" remote get-url origin >/dev/null 2>&1 && continue
  echo "LOCAL-ONLY (GitHub missed it): ${d%/}"
  git -C "$d" log --since="$SINCE" --pretty="  %ad %s" --date=short | grep -viE "dashboard snapshot|hourly refresh"
done
```
Include these in the post and tell the user they're unpushed. Repos WITH a remote are already
covered by steps 2-4 — don't double-scan them locally (GitHub is more current).

## 6. Decide structure (ask if unclear)

- One **arc post** tying repos into a single story, OR **per-project posts**, one build log per
  repo from its own POV (cross-link them). If the user named projects, cover those. If ambiguous, ask.
- In **focused mode** the structure is decided: an update post (or short series) on the named
  project. Skip the ambiguity check — go deep on that project and proceed to `ground.md`.
- In **catch-up mode** (`rotation.md` Part 0.5) the output of this scan is the story-unit list for
  the backfill queue — cluster by project AND by the dates the commits landed.
