# Sub-skill: ground (Part 2.5) — feature-value from the project's OWN live state

Diffs tell you *what changed*; they don't tell you what the feature is *worth* right now. For
that, query the project's own runtime surface during composing. A "feature value" claim backed by
a live number from the system is the difference between a build log and a press release.

**A project may expose any of these — check for them before writing a focused post:**

| Surface | How to find it | What it grounds |
|---|---|---|
| An **MCP server** | `find <repo> -iname '*.mcp.json'` / `<repo>/data/mcp/` | live reads of the project's actual knowledge/state |
| A **scorecard / KPI script** | `<repo>/scripts/*scorecard*.py`, `--json`; KPI doc in `<repo>/docs/` or its `CLAUDE.md` North-Star section | the real metric the feature moves |
| **Operational DBs** | `<repo>/downloads/*.db`, `orchestrator.db`, `scraper.db` | counts, runs, coverage — real, not invented |

## Burrow specifically (the canonical example)

Burrow (`~/Projects/burrow`) is **infrastructure with a measurable North-Star KPI** (Reddit
trading-sub coverage). When a focused post is about Burrow, ground the value like this:

1. **The coverage KPI is the spine of "ongoing focus."** Read the definition and pull the live
   number — don't invent one:
   ```bash
   cd ~/Projects/burrow
   sed -n '1,40p' docs/reddit-coverage-kpi.md           # the formula + universe + tiers
   python3 scripts/coverage_scorecard.py --json 2>/dev/null | python3 -m json.tool | head -40
   ```
   The KPI = `mean(min(1, actual_visits/target_visits))` over the trading-sub universe. A real
   coverage % (and which tiers are starving) is the strongest possible "why this work matters"
   hook. (Note 2026-07-24: the tiered P0–P3 cadence was retired for a uniform daily target —
   re-read the KPI doc before citing tiers.)

2. **The `burrow-brain` MCP is live read access to what the system actually captured.** Config at
   `data/mcp/burrow-brain.mcp.json` (HTTP, `http://127.0.0.1:8767/mcp`). Endpoints include
   `list_subreddits`, `hot_posts`, `search_distilled`, `search_mentions`, `agg_mentions`, plus
   analytics / edgar / research. Use it to show the feature *working*: e.g. how many subs are
   indexed, real mentions captured this week, what the brain can now answer that it couldn't.
   - To query it from the composing session, register the server and load its tools via ToolSearch
     (it's an HTTP MCP needing the init handshake — don't hand-roll JSON-RPC). If it isn't connected
     in-session, fall back to the operational DBs / scorecard, and say the numbers came from there.

3. **Mandatory-evidence audit** (also used by `/optimize-kpi`): `scripts/mcp_usage_audit.py
   --window 7d --logs --json` surfaces real consumers, dark tools, error hotspots — gold for an
   honest "what's still rough" section.

**Rule:** every feature-value number in a post must trace to a scorecard, an MCP read, a DB query,
or a KPI doc. If you can't source it, don't print it (bot-tell #6). State where each number came
from, the same way the `signal-builder` post sources its 337 test count.
