// ===== Extended mock data for deep-dive pages =====

// Per-trade source breakdown (computed from TRADES, but pre-aggregated here for rich pages)
window.SOURCE_PERF = [
  { source: "r/wallstreetbets",  trades: 48, wins: 28, pnl: 8420.50, winRate: 0.583, avgPnl: 175.4 },
  { source: "r/stocks",          trades: 32, wins: 22, pnl: 6240.10, winRate: 0.687, avgPnl: 195.0 },
  { source: "r/options",         trades: 26, wins: 14, pnl: 4180.00, winRate: 0.538, avgPnl: 160.8 },
  { source: "r/SecurityAnalysis",trades: 18, wins: 14, pnl: 3960.40, winRate: 0.778, avgPnl: 220.0 },
  { source: "r/investing",       trades: 22, wins: 15, pnl: 2840.20, winRate: 0.682, avgPnl: 129.1 },
  { source: "r/pennystocks",     trades: 14, wins: 6,  pnl: 1240.80, winRate: 0.429, avgPnl: 88.6 },
  { source: "r/Daytrading",      trades: 12, wins: 6,  pnl: 880.50,  winRate: 0.500, avgPnl: 73.4 },
  { source: "r/ValueInvesting",  trades: 8,  wins: 6,  pnl: 510.20,  winRate: 0.750, avgPnl: 63.8 },
  { source: "r/thetagang",       trades: 5,  wins: 3,  pnl: 184.20,  winRate: 0.600, avgPnl: 36.8 },
  { source: "r/StockMarket",     trades: 2,  wins: 1,  pnl: 14.52,   winRate: 0.500, avgPnl: 7.3 },
];

// Monthly P&L bars
window.MONTHLY_PNL = [
  { month: "Jan", pnl: 2840, trades: 14 },
  { month: "Feb", pnl: 4120, trades: 22 },
  { month: "Mar", pnl: -1280, trades: 28 },
  { month: "Apr", pnl: 6840, trades: 31 },
  { month: "May", pnl: 5210, trades: 26 },
  { month: "Jun", pnl: 3180, trades: 19 },
  { month: "Jul", pnl: 4420, trades: 21 },
  { month: "Aug", pnl: -2210, trades: 17 },
  { month: "Sep", pnl: 1840, trades: 16 },
  { month: "Oct", pnl: 2110, trades: 11 },
  { month: "Nov", pnl: 1240, trades: 9 },
  { month: "Dec", pnl: 161, trades: 4 },
];

// Hold-period buckets
window.HOLD_BUCKETS = [
  { label: "<1d",   trades: 28, winRate: 0.39, avgPnl:  -42 },
  { label: "1-3d",  trades: 52, winRate: 0.58, avgPnl:  142 },
  { label: "4-7d",  trades: 61, winRate: 0.66, avgPnl:  218 },
  { label: "8-14d", trades: 32, winRate: 0.72, avgPnl:  284 },
  { label: "15-30d",trades: 11, winRate: 0.64, avgPnl:  198 },
  { label: ">30d",  trades: 3,  winRate: 0.67, avgPnl:  120 },
];

// P&L distribution buckets ($, count)
window.PNL_DIST = [
  { bin: "<-2k",  count: 2 },
  { bin: "-2k..-1k", count: 5 },
  { bin: "-1k..-500", count: 11 },
  { bin: "-500..-100", count: 28 },
  { bin: "-100..0", count: 23 },
  { bin: "0..100", count: 22 },
  { bin: "100..500", count: 41 },
  { bin: "500..1k", count: 28 },
  { bin: "1k..2k", count: 18 },
  { bin: "2k..5k", count: 7 },
  { bin: ">5k", count: 2 },
];

// Top tickers traded
window.TICKER_PERF = [
  { ticker: "NVDA", trades: 12, pnl: 6420, winRate: 0.83 },
  { ticker: "AMD",  trades: 9,  pnl: 2180, winRate: 0.67 },
  { ticker: "META", trades: 7,  pnl: 1840, winRate: 0.71 },
  { ticker: "SPY",  trades: 14, pnl: 4220, winRate: 0.64 },
  { ticker: "TSLA", trades: 11, pnl: -1840, winRate: 0.36 },
  { ticker: "PLTR", trades: 6,  pnl: -2210, winRate: 0.33 },
  { ticker: "AAPL", trades: 8,  pnl: 1240, winRate: 0.62 },
  { ticker: "GOOG", trades: 5,  pnl: 720,  winRate: 0.60 },
  { ticker: "TSM",  trades: 4,  pnl: 1310, winRate: 0.75 },
  { ticker: "MU",   trades: 4,  pnl: 920,  winRate: 0.75 },
];

// ===== Reddit deep-dive =====

// 30-day mention timeline per top sub
function genMentionSeries(base, vol = 0.4) {
  const out = [];
  for (let i = 0; i < 30; i++) {
    out.push(Math.max(10, Math.round(base * (1 + (Math.sin(i * 0.4) + (Math.random() - 0.5) * 2) * vol))));
  }
  return out;
}
window.SUB_DETAIL = window.SUBREDDITS.map((s) => ({
  ...s,
  series30d: genMentionSeries(s.posts24h, 0.35),
  topPosts: [
    { title: "Daily Discussion Thread - " + s.name, score: Math.round(2400 + Math.random() * 8000), comments: Math.round(800 + Math.random() * 4000), age: "4h", flair: "Daily" },
    { title: `${s.top[0]} earnings setup — what's the play?`, score: Math.round(800 + Math.random() * 3000), comments: Math.round(120 + Math.random() * 600), age: "9h", flair: "Discussion" },
    { title: `DD: Why ${s.top[1]} is mispriced going into Q2`, score: Math.round(600 + Math.random() * 2000), comments: Math.round(80 + Math.random() * 400), age: "14h", flair: "DD" },
    { title: `${s.top[2]} chart looking ${s.sentiment > 0.2 ? "explosive" : "concerning"}`, score: Math.round(300 + Math.random() * 1200), comments: Math.round(50 + Math.random() * 300), age: "18h", flair: "TA" },
  ],
  bullCount: Math.round(s.posts24h * (0.5 + s.sentiment * 0.5)),
  bearCount: Math.round(s.posts24h * (0.5 - s.sentiment * 0.5)),
  newPostsPerHour: +(s.posts24h / 24).toFixed(1),
  avgScore: Math.round(80 + Math.random() * 220),
  topAuthors: [
    `${s.name === "wallstreetbets" ? "u/DeepFuckingValue" : "u/" + ["BagholderTycoon","MoatsAndMargins","ChartWatcher","ThetaGang420","ValueHunter88"][Math.floor(Math.random()*5)]}`,
    `u/${["MarketMonk","AlphaSeeker","RedditAnalyst","TickerTracker","DDLord"][Math.floor(Math.random()*5)]}`,
    `u/${["CallsAndPuts","DiamondHandsXX","SwingTrader42","MicroCapMike","FundamentalFred"][Math.floor(Math.random()*5)]}`,
  ],
}));

// Ticker mention flow over 30 days
window.TICKER_FLOW = [
  { ticker: "NVDA", series: genMentionSeries(180, 0.5), action: "HOLDING +$2.1k" },
  { ticker: "TSLA", series: genMentionSeries(140, 0.6), action: "PASSED" },
  { ticker: "AMD",  series: genMentionSeries(110, 0.5), action: "HOLDING +$380" },
  { ticker: "AVGO", series: genMentionSeries(48,  0.9), action: "WATCHING" },
  { ticker: "PLTR", series: genMentionSeries(70,  0.7), action: "STOPPED OUT -$1.8k" },
  { ticker: "SMCI", series: genMentionSeries(40,  0.8), action: "—" },
];

// Top posts global feed
window.HOT_POSTS = [
  { sub: "wallstreetbets",  title: "NVDA earnings play — full position thesis with risk levels", score: 8420, comments: 3140, age: "3h", flair: "DD",          sentiment:  0.74, action: "ACTED ON · T-0187" },
  { sub: "stocks",          title: "TSM capacity expansion is being underestimated by sellside",  score: 4210, comments:  812, age: "5h", flair: "Discussion",  sentiment:  0.62, action: "ACTED ON · T-0185" },
  { sub: "options",         title: "Selling premium into this VIX regime — what's working",       score: 3180, comments:  640, age: "8h", flair: "Strategy",    sentiment:  0.18, action: "—" },
  { sub: "SecurityAnalysis",title: "MU: HBM cycle is real, here's the unit math",                 score: 2840, comments:  482, age: "12h", flair: "DD",          sentiment:  0.71, action: "ACTED ON · T-0174" },
  { sub: "wallstreetbets",  title: "PLTR contract leak rumor — shorts piling in",                 score: 6210, comments: 2410, age: "1d", flair: "News",        sentiment: -0.42, action: "STOPPED · T-0184" },
  { sub: "investing",       title: "Rate cuts — why the consensus is finally shifting",           score: 2110, comments:  390, age: "1d", flair: "Macro",       sentiment:  0.31, action: "—" },
  { sub: "pennystocks",     title: "SOFI volume surge looks real this time",                      score: 1840, comments:  280, age: "2d", flair: "Catalyst",    sentiment:  0.58, action: "ACTED ON · T-0182" },
  { sub: "thetagang",       title: "Wheel returns Q1 review — net +4.8% on $50k account",         score: 1240, comments:  190, age: "2d", flair: "Review",      sentiment:  0.21, action: "—" },
];

// ===== Watchlist extended =====
window.WATCHLIST_DETAIL = [
  ...window.WATCHLIST.map(w => ({
    ...w,
    series: genMentionSeries(w.mentions24h * 0.7, 0.6),
    sentSeries: Array.from({length: 14}, (_,i) => +(w.sentiment + (Math.random() - 0.5) * 0.2).toFixed(2)),
    addedDays: Math.floor(Math.random() * 12) + 2,
    triggerLevel: w.ticker === "AVGO" ? "$1640 break + 24h sustained sentiment > 0.6" :
                  w.ticker === "RBLX" ? "Earnings beat or guidance raise" :
                  w.ticker === "DELL" ? "Server backlog confirmation in next earnings" :
                  w.ticker === "UBER" ? "n/a · removed" :
                  "GMV pre-announce or holiday peer reads",
  })),
];

// Signals passed on, with retroactive outcome
window.PASSED_SIGNALS = [
  { ticker: "GME",  date: "Apr 18", reason: "Pure squeeze chatter, no thesis I could check",       outcome: "+22% in 5d",  outcomePnl: "missed +$2.1k" },
  { ticker: "BBBY", date: "Mar 04", reason: "Bagholder coping cluster, no fundamental catalyst",   outcome: "−18%",         outcomePnl: "avoided −$840" },
  { ticker: "HIMS", date: "Mar 22", reason: "Conviction below threshold (0.61)",                   outcome: "+34% in 12d", outcomePnl: "missed +$1.6k" },
  { ticker: "NIO",  date: "Feb 14", reason: "Macro headwind (China demand) overwhelmed sentiment", outcome: "−12%",         outcomePnl: "avoided −$540" },
  { ticker: "BBAI", date: "Feb 02", reason: "Penny chatter, manipulation risk",                    outcome: "−42%",         outcomePnl: "avoided −$1.2k" },
  { ticker: "CVNA", date: "Jan 28", reason: "Sentiment too lopsided bullish — contrarian risk",    outcome: "+8%",          outcomePnl: "missed +$320" },
];

// ===== Methodology — fully autonomous pipeline rules =====
window.METHOD_RULES = [
  { num: "01", title: "Conviction gate",         body: "A trade fires only when the strategy's signal score crosses 0.65 and at least 2 independent posts present non-overlapping evidence within a 6-hour window. Below threshold, the bot stays flat." },
  { num: "02", title: "Per-strategy isolation",  body: "Each strategy runs its own capital sleeve, position book, and risk budget. No cross-strategy hedging or netting — they're scored independently against SPY." },
  { num: "03", title: "Fixed-risk sizing",       body: "Every entry risks exactly 1% of the strategy's sleeve between entry and stop. Stops are placed at order time and never widened by the engine." },
  { num: "04", title: "No averaging down",       body: "If a stop is hit, the position closes. The engine cannot add to losers. A re-entry requires a fresh signal that crosses the conviction gate again." },
  { num: "05", title: "Time stop · 21 days",     body: "If the thesis hasn't resolved in 21 trading days, the position is force-closed. Stale signals are treated as failed signals." },
  { num: "06", title: "Scale-out ladder",        body: "On profitable trades the bot scales out: 1/3 at 1R, 1/3 at 2R, final third trails a 10-day moving average. Fully mechanical." },
  { num: "07", title: "Earnings cushion rule",   body: "If a position isn't up ≥ 2R going into a scheduled earnings event, it's closed before the print. Binary risk without a cushion is rejected." },
  { num: "08", title: "Live audit trail",        body: "Every signal, fill, and exit is logged with timestamp, source posts, and signal score. The dashboard is a direct read of the audit log — no curation, no edits." },
];

// Live signal-pipeline events the system has emitted (autonomous decisions)
window.RULE_BREAKS = [
  { trade: "T-0172", ticker: "TSLA", rule: "05 · Time stop · 21 days", outcome: "−$2,480", lesson: "Thesis stale at day 22, force-closed for max loss. Time stop saved further bleed." },
  { trade: "T-0179", ticker: "MSTR", rule: "04 · No averaging down",   outcome: "−$568",   lesson: "Stop hit cleanly. Engine refused 2 re-entry signals that didn't cross the conviction gate." },
  { trade: "T-0184", ticker: "PLTR", rule: "03 · Fixed-risk sizing",   outcome: "−$1,840", lesson: "Sized to 1% risk; stop hit; loss bounded as designed. Working as intended." },
];

window.METHOD_FAQ = [
  { q: "Is this fully autonomous?",         a: "Yes. The pipeline runs end-to-end without human intervention: ingest → score → decide → execute → log. The dashboard is a read-only window onto a live system." },
  { q: "How are strategies picked?",        a: "Each strategy is a different mapping from subreddit feeds to a signal. Some are single-sub momentum, some blend multiple subs, some pit two subs against each other (e.g. WSB vs SecurityAnalysis). All run live in parallel and are scored vs SPY." },
  { q: "Can a strategy be killed?",         a: "Auto-kill triggers if a strategy hits −15% drawdown or its 30-day Sharpe drops below 0. It moves to RETIRED, capital returns to the pool. No manual override." },
  { q: "Why these 10 subreddits?",          a: "They're where stock-specific signal density is highest: r/wallstreetbets and r/pennystocks for retail flow, r/SecurityAnalysis and r/ValueInvesting for fundamentals, r/options and r/thetagang for derivatives structure, the rest for breadth." },
  { q: "Is this real money?",                a: "Yes — $90k seed split across the live strategy sleeves. Brokerage statements reconcile to the audit trail and are spot-checkable on request." },
  { q: "What does the LLM actually do?",    a: "It tags each post with sentiment, topic, conviction, and tickers. The trading rules are deterministic: gates, sizes, stops, and ladders are coded, not chatted." },
  { q: "Why monetize via coffee?",          a: "No paid signals, no Discord, no affiliate. The system makes its own decisions; tips just keep the lights on. You're watching the experiment, not buying its output." },
];
