/* fixtures/signals_history.example.js
 *
 * Programmatic fixture for the Signals tab. Generates 90 days of daily
 * sentiment+mentions rows for 3 tickers across 2 subreddits so the tab
 * renders out of the box with `?fixture=signals` or whenever the real
 * window.SIGNALS_HISTORY is absent.
 *
 * Shape matches docs/architecture-split.md §"MCP contract sketch" and
 * PRD 46 §"Fixture shape".
 */
(function () {
  "use strict";

  const TICKERS = ["NVDA", "TSLA", "AMD"];
  const SUBS = ["wallstreetbets", "stocks"];
  const DAYS = 90;

  // Anchor at 2026-05-22 18:00 UTC so behaviour is deterministic in tests.
  const END = Date.parse("2026-05-22T18:00:00Z");
  const DAY_MS = 86400 * 1000;

  // Tiny seeded PRNG so re-renders are deterministic across reloads.
  function mulberry32(a) {
    return function () {
      let t = (a += 0x6D2B79F5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Per-ticker baselines so the lines are visibly distinct.
  const BASE = {
    NVDA: { bullShare: 0.78, mentions: 45 },
    TSLA: { bullShare: 0.52, mentions: 60 },
    AMD:  { bullShare: 0.65, mentions: 28 },
  };

  const rows = [];
  let seed = 42;
  for (let i = 0; i < TICKERS.length; i++) {
    const tk = TICKERS[i];
    const rng = mulberry32(seed + i * 1000);
    for (let d = 0; d < DAYS; d++) {
      const ts = END - (DAYS - 1 - d) * DAY_MS;
      const base = BASE[tk];
      // Walk bull_share with a small noise, clamped to [0.05, 0.95].
      const drift = (rng() - 0.5) * 0.12;
      const trend = Math.sin((d / DAYS) * Math.PI * 2 + i) * 0.08;
      const bullShare = Math.max(0.05, Math.min(0.95, base.bullShare + drift + trend));
      const mentions = Math.max(1, Math.round(base.mentions * (0.6 + rng() * 0.9)));
      const bullCount = Math.round(mentions * bullShare);
      const bearCount = mentions - bullCount;
      const sub = SUBS[(d + i) % SUBS.length];
      rows.push({
        built_at: new Date(ts).toISOString(),
        ticker: tk,
        panel: "sentiment",
        payload: {
          bull_count: bullCount,
          bear_count: bearCount,
          bull_share: Number(bullShare.toFixed(3)),
          mentions: mentions,
          top_subreddit: sub,
        },
      });
    }
  }

  const themes = [
    {
      theme: "AI infrastructure",
      tickers: ["NVDA", "AMD", "SMCI"],
      built_at: new Date(END).toISOString(),
      evidence_posts: [
        {
          id: "t3_ai1",
          title: "NVDA crushing Q1 — H100 backlog into 2027",
          subreddit: "wallstreetbets",
          url: "https://www.reddit.com/r/wallstreetbets/comments/ai1",
          created_utc: "2026-05-22T17:30:00Z",
          score: 412,
        },
        {
          id: "t3_ai2",
          title: "AMD MI300X benchmarks: 1.3x H100 in inference",
          subreddit: "stocks",
          url: "https://www.reddit.com/r/stocks/comments/ai2",
          created_utc: "2026-05-22T16:10:00Z",
          score: 287,
        },
        {
          id: "t3_ai3",
          title: "SMCI is the picks-and-shovels play of the decade",
          subreddit: "wallstreetbets",
          url: "https://www.reddit.com/r/wallstreetbets/comments/ai3",
          created_utc: "2026-05-22T14:55:00Z",
          score: 198,
        },
      ],
    },
    {
      theme: "EV demand softness",
      tickers: ["TSLA", "RIVN", "LCID"],
      built_at: new Date(END).toISOString(),
      evidence_posts: [
        {
          id: "t3_ev1",
          title: "TSLA Q2 deliveries trending below consensus",
          subreddit: "stocks",
          url: "https://www.reddit.com/r/stocks/comments/ev1",
          created_utc: "2026-05-22T15:00:00Z",
          score: 156,
        },
        {
          id: "t3_ev2",
          title: "Lucid burning $1B/qtr, runway < 18mo",
          subreddit: "wallstreetbets",
          url: "https://www.reddit.com/r/wallstreetbets/comments/ev2",
          created_utc: "2026-05-22T13:40:00Z",
          score: 92,
        },
      ],
    },
  ];

  window.SIGNALS_HISTORY_FIXTURE = {
    schema_version: 1,
    built_at_range: [
      new Date(END - (DAYS - 1) * DAY_MS).toISOString(),
      new Date(END).toISOString(),
    ],
    rows: rows,
    themes: themes,
  };
})();
