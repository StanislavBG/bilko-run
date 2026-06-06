// Mock data for the trade-in-public dashboard.
// All numbers are illustrative.

window.SITE = {
  handle: "publictrades.dev",
  tagline: "Autonomous trading bots reading 10 subreddits. Live results, in public.",
  startedISO: "2025-01-06",
  bmcUrl: "https://buymeacoffee.com/publictrades",
};

// Per-strategy / index summary. Each is a fully autonomous bot fed by a different
// subset of subreddits or signal logic. They compete against each other + SPY.
window.STRATEGIES = [
  { id: "WSB",     name: "WSB Momentum",         feeds: ["wallstreetbets","pennystocks"],            ytdPct:  42.1, sharpe: 1.62, winRate: 0.58, trades: 64, dd: -12.4, status: "LIVE" },
  { id: "FUND",    name: "Fundamentals Index",   feeds: ["SecurityAnalysis","ValueInvesting"],       ytdPct:  18.4, sharpe: 1.91, winRate: 0.72, trades: 26, dd:  -4.2, status: "LIVE" },
  { id: "OPT",     name: "Options Sentiment",    feeds: ["options","thetagang"],                    ytdPct:  24.6, sharpe: 1.48, winRate: 0.55, trades: 31, dd:  -8.0, status: "LIVE" },
  { id: "BLEND",   name: "Blended Consensus",    feeds: ["stocks","investing","StockMarket"],        ytdPct:  16.2, sharpe: 1.74, winRate: 0.69, trades: 38, dd:  -5.1, status: "LIVE" },
  { id: "DAY",     name: "Daytrading Pulse",     feeds: ["Daytrading"],                              ytdPct:   9.8, sharpe: 0.92, winRate: 0.51, trades: 22, dd:  -7.6, status: "LIVE" },
  { id: "VS",      name: "WSB vs SecurityAnalysis", feeds: ["wallstreetbets","SecurityAnalysis"],   ytdPct:  31.4, sharpe: 1.83, winRate: 0.64, trades: 18, dd:  -6.2, status: "EXPERIMENTAL" },
  { id: "CONTRA",  name: "Contrarian Reversal",  feeds: ["wallstreetbets","pennystocks"],            ytdPct:   6.4, sharpe: 0.61, winRate: 0.48, trades: 14, dd: -11.2, status: "EXPERIMENTAL" },
];

// --- Performance summary ---
window.PERF = {
  totalPnl: 28471.42,
  totalPnlPct: 31.6,
  startingCapital: 90000,
  currentEquity: 118471.42,
  ytdReturnPct: 31.6,
  spyYtdPct: 9.4,
  winRate: 0.612,
  trades: 187,
  open: 9,
  closed: 178,
  wins: 109,
  losses: 69,
  avgWin: 612.18,
  avgLoss: -284.51,
  profitFactor: 2.41,
  sharpe: 1.84,
  maxDD: -8.7,
  bestTrade: { ticker: "NVDA", pnl: 4218.0 },
  worstTrade: { ticker: "PLTR", pnl: -1840.5 },
  avgHoldDays: 4.2,
};

// --- Equity curve (daily, ~120 days) ---
function genEquity() {
  const out = [];
  let v = 90000;
  let spy = 100;
  const start = new Date("2025-01-06").getTime();
  for (let i = 0; i < 120; i++) {
    // trader curve: trends up with volatility, one ~8% drawdown around day 55
    const drift = 0.0028;
    const dd = i > 50 && i < 65 ? -0.012 : 0;
    const noise = (Math.sin(i * 0.7) + Math.cos(i * 0.31) + (Math.random() - 0.5) * 1.4) * 0.011;
    v = v * (1 + drift + dd + noise);
    spy = spy * (1 + 0.0008 + (Math.sin(i * 0.4) + (Math.random() - 0.5)) * 0.006);
    out.push({
      t: start + i * 86400000,
      equity: v,
      spy,
      day: i,
    });
  }
  // pin final value to PERF.currentEquity for consistency
  const last = out[out.length - 1].equity;
  const scale = 118471.42 / last;
  out.forEach((o) => (o.equity = o.equity * scale));
  return out;
}
window.EQUITY = genEquity();

// --- Daily P&L heatmap (last ~84 days) ---
function genHeatmap() {
  const out = [];
  const start = Date.now() - 84 * 86400000;
  for (let i = 0; i < 84; i++) {
    const r = Math.random();
    let pnl = 0;
    const dow = new Date(start + i * 86400000).getDay();
    if (dow === 0 || dow === 6) {
      pnl = 0; // weekends
    } else if (r < 0.18) {
      pnl = 0; // no trading
    } else if (r < 0.65) {
      pnl = Math.round((Math.random() * 1200 + 50) * 100) / 100;
    } else {
      pnl = -Math.round((Math.random() * 700 + 30) * 100) / 100;
    }
    out.push({ t: start + i * 86400000, pnl });
  }
  return out;
}
window.HEATMAP = genHeatmap();

// --- Trades ---
window.TRADES = [
  { id: "T-0187", ticker: "NVDA", side: "LONG", type: "STOCK", status: "OPEN",   entry: 892.40, exit: null,    qty: 25,  pnl: 2148.50, pnlPct: 9.6,  opened: "2026-04-28", closed: null,         source: "r/wallstreetbets", confidence: 0.82, note: "Earnings run-up, sentiment +0.71" },
  { id: "T-0186", ticker: "AMD",  side: "LONG", type: "CALL",  status: "OPEN",   entry: 4.20,   exit: null,    qty: 10,  pnl: 380.00,  pnlPct: 9.0,  opened: "2026-04-29", closed: null,         source: "r/options",        confidence: 0.64, note: "May 16 $170c, momentum chatter" },
  { id: "T-0185", ticker: "TSM",  side: "LONG", type: "STOCK", status: "CLOSED", entry: 168.10, exit: 184.55,  qty: 60,  pnl: 987.00,  pnlPct: 9.8,  opened: "2026-04-12", closed: "2026-04-30", source: "r/stocks",         confidence: 0.71, note: "Capacity expansion thesis" },
  { id: "T-0184", ticker: "PLTR", side: "LONG", type: "STOCK", status: "CLOSED", entry: 28.40,  exit: 24.55,   qty: 480, pnl: -1840.50, pnlPct: -13.6, opened: "2026-04-08", closed: "2026-04-22", source: "r/wallstreetbets", confidence: 0.55, note: "Stop hit, contract miss rumor" },
  { id: "T-0183", ticker: "META", side: "LONG", type: "STOCK", status: "CLOSED", entry: 482.00, exit: 511.20,  qty: 18,  pnl: 525.60,  pnlPct: 6.1,  opened: "2026-04-11", closed: "2026-04-24", source: "r/investing",      confidence: 0.78, note: "Buy-the-dip post earnings" },
  { id: "T-0182", ticker: "SOFI", side: "LONG", type: "STOCK", status: "CLOSED", entry: 8.20,   exit: 9.45,    qty: 600, pnl: 750.00,  pnlPct: 15.2, opened: "2026-04-02", closed: "2026-04-19", source: "r/pennystocks",    confidence: 0.49, note: "Retail momentum + rate cut chatter" },
  { id: "T-0181", ticker: "AAPL", side: "SHORT", type: "PUT",  status: "CLOSED", entry: 6.80,   exit: 9.40,    qty: 5,   pnl: 1300.00, pnlPct: 38.2, opened: "2026-04-04", closed: "2026-04-15", source: "r/options",        confidence: 0.60, note: "Hedge into earnings" },
  { id: "T-0180", ticker: "GOOG", side: "LONG", type: "STOCK", status: "CLOSED", entry: 168.40, exit: 175.10,  qty: 40,  pnl: 268.00,  pnlPct: 4.0,  opened: "2026-04-01", closed: "2026-04-14", source: "r/SecurityAnalysis", confidence: 0.69, note: "Cloud margin thesis" },
  { id: "T-0179", ticker: "MSTR", side: "LONG", type: "STOCK", status: "CLOSED", entry: 1240.0, exit: 1098.0,  qty: 4,   pnl: -568.00, pnlPct: -11.5, opened: "2026-03-28", closed: "2026-04-10", source: "r/wallstreetbets", confidence: 0.42, note: "BTC pullback, exited rule" },
  { id: "T-0178", ticker: "F",    side: "LONG", type: "STOCK", status: "CLOSED", entry: 11.05,  exit: 11.02,   qty: 800, pnl: -24.00,  pnlPct: -0.3, opened: "2026-03-26", closed: "2026-04-08", source: "r/ValueInvesting", confidence: 0.51, note: "Thesis broke, flat exit" },
  { id: "T-0177", ticker: "AMZN", side: "LONG", type: "STOCK", status: "CLOSED", entry: 188.20, exit: 198.30,  qty: 22,  pnl: 222.20,  pnlPct: 5.4,  opened: "2026-03-24", closed: "2026-04-04", source: "r/stocks",         confidence: 0.74, note: "AWS reaccel chatter" },
  { id: "T-0176", ticker: "SPY",  side: "LONG", type: "CALL",  status: "CLOSED", entry: 3.10,   exit: 4.85,    qty: 20,  pnl: 3500.00, pnlPct: 56.5, opened: "2026-03-22", closed: "2026-04-02", source: "r/Daytrading",     confidence: 0.66, note: "Index bounce play" },
  { id: "T-0175", ticker: "COIN", side: "LONG", type: "STOCK", status: "CLOSED", entry: 215.0,  exit: 198.4,   qty: 30,  pnl: -498.00, pnlPct: -7.7, opened: "2026-03-18", closed: "2026-03-29", source: "r/wallstreetbets", confidence: 0.48, note: "BTC weak, exited" },
  { id: "T-0174", ticker: "MU",   side: "LONG", type: "STOCK", status: "CLOSED", entry: 102.4,  exit: 116.8,   qty: 40,  pnl: 576.00,  pnlPct: 14.1, opened: "2026-03-15", closed: "2026-03-28", source: "r/SecurityAnalysis", confidence: 0.77, note: "HBM cycle thesis" },
  { id: "T-0173", ticker: "HOOD", side: "LONG", type: "STOCK", status: "CLOSED", entry: 18.20,  exit: 21.40,   qty: 200, pnl: 640.00,  pnlPct: 17.6, opened: "2026-03-12", closed: "2026-03-25", source: "r/pennystocks",    confidence: 0.55, note: "Crypto volume up" },
  { id: "T-0172", ticker: "TSLA", side: "SHORT", type: "PUT",  status: "CLOSED", entry: 12.40,  exit: 6.20,    qty: 4,   pnl: -2480.00, pnlPct: -50.0, opened: "2026-03-08", closed: "2026-03-20", source: "r/wallstreetbets", confidence: 0.38, note: "Got run over on bounce" },
  { id: "T-0171", ticker: "JPM",  side: "LONG", type: "STOCK", status: "CLOSED", entry: 198.0,  exit: 207.5,   qty: 25,  pnl: 237.50,  pnlPct: 4.8,  opened: "2026-03-04", closed: "2026-03-18", source: "r/investing",      confidence: 0.72, note: "Banks rotation" },
  { id: "T-0170", ticker: "DIS",  side: "LONG", type: "STOCK", status: "CLOSED", entry: 102.0,  exit: 109.4,   qty: 50,  pnl: 370.00,  pnlPct: 7.3,  opened: "2026-03-01", closed: "2026-03-15", source: "r/stocks",         confidence: 0.58, note: "Streaming margin uplift" },
];

// --- Watchlist (signals not yet acted on) ---
window.WATCHLIST = [
  { ticker: "AVGO", mentions24h: 312, sentiment: 0.64, conviction: 0.71, status: "WATCHING", reason: "AI capex chatter, 7d +84% mentions" },
  { ticker: "RBLX", mentions24h: 198, sentiment: 0.41, conviction: 0.52, status: "WATCHING", reason: "Earnings setup, mixed signal" },
  { ticker: "DELL", mentions24h: 142, sentiment: 0.58, conviction: 0.63, status: "WATCHING", reason: "Server backlog mentions rising" },
  { ticker: "UBER", mentions24h: 89,  sentiment: 0.49, conviction: 0.45, status: "PASSED",   reason: "Sentiment cooling, valuation stretched" },
  { ticker: "SHOP", mentions24h: 76,  sentiment: 0.55, conviction: 0.58, status: "WATCHING", reason: "Holiday GMV thesis forming" },
];

// --- Subreddit intelligence ---
window.SUBREDDITS = [
  { name: "wallstreetbets",  subs: 16800000, posts24h: 2840, sentiment:  0.31, change24h:  +0.08, top: ["NVDA","TSLA","SPY","AMD","PLTR"],   pulse: [40,52,48,61,55,70,82,76] },
  { name: "stocks",          subs: 4200000,  posts24h: 612,  sentiment:  0.18, change24h:  +0.04, top: ["AAPL","GOOG","META","MSFT","JPM"],  pulse: [22,28,30,26,32,35,38,42] },
  { name: "investing",       subs: 2900000,  posts24h: 484,  sentiment:  0.22, change24h:  +0.02, top: ["VOO","SPY","BRK.B","JPM","AMZN"],   pulse: [18,20,22,24,21,26,28,30] },
  { name: "options",         subs: 480000,   posts24h: 388,  sentiment:  0.12, change24h:  +0.06, top: ["SPY","QQQ","NVDA","TSLA","AMD"],    pulse: [30,38,42,40,52,58,55,62] },
  { name: "SecurityAnalysis",subs: 320000,   posts24h: 64,   sentiment:  0.34, change24h:  -0.02, top: ["BRK.B","GOOG","TSM","V","MA"],      pulse: [10,12,11,14,16,15,18,17] },
  { name: "ValueInvesting",  subs: 280000,   posts24h: 48,   sentiment:  0.28, change24h:  +0.01, top: ["BRK.B","JPM","KO","UNH","XOM"],     pulse: [8,10,9,11,12,10,13,14] },
  { name: "pennystocks",     subs: 2100000,  posts24h: 920,  sentiment:  0.41, change24h:  +0.12, top: ["SOFI","HOOD","RIOT","MARA","PLUG"], pulse: [36,42,48,50,55,60,68,72] },
  { name: "thetagang",       subs: 220000,   posts24h: 142,  sentiment:  0.05, change24h:  -0.04, top: ["SPY","QQQ","AAPL","MSFT","TSLA"],   pulse: [14,16,15,18,17,19,20,18] },
  { name: "Daytrading",      subs: 1900000,  subsLabel: "1.9M", posts24h: 540, sentiment: 0.09, change24h: +0.03, top: ["SPY","TSLA","NVDA","AMD","SMCI"], pulse: [28,32,34,38,40,42,46,50] },
  { name: "StockMarket",     subs: 3400000,  posts24h: 412,  sentiment:  0.20, change24h:  +0.05, top: ["AAPL","NVDA","MSFT","GOOG","META"], pulse: [20,24,26,28,30,32,34,36] },
];

// --- Trending tickers across all subs ---
window.TRENDING = [
  { ticker: "NVDA", mentions: 1842, sentiment:  0.71, change: +18.4, action: "HOLDING" },
  { ticker: "TSLA", mentions: 1284, sentiment: -0.12, change:  +4.1, action: "PASSED" },
  { ticker: "AMD",  mentions:  982, sentiment:  0.58, change: +12.0, action: "HOLDING" },
  { ticker: "SPY",  mentions:  874, sentiment:  0.22, change:  +2.8, action: "—" },
  { ticker: "AAPL", mentions:  812, sentiment:  0.34, change:  -1.2, action: "—" },
  { ticker: "PLTR", mentions:  618, sentiment:  0.04, change: -22.1, action: "STOPPED OUT" },
  { ticker: "AVGO", mentions:  514, sentiment:  0.64, change: +28.0, action: "WATCHING" },
  { ticker: "META", mentions:  488, sentiment:  0.42, change:  +8.4, action: "CLOSED +6%" },
  { ticker: "SMCI", mentions:  402, sentiment:  0.38, change: +14.2, action: "—" },
  { ticker: "COIN", mentions:  348, sentiment: -0.18, change:  -8.0, action: "STOPPED OUT" },
];

// --- Themes (LLM-summarized topics) ---
window.THEMES = [
  { title: "AI infrastructure capex", heat: 92, change: +14, blurb: "Hyperscaler spend keeps surprising up. NVDA, AVGO, DELL, SMCI dominate mentions.", subs: ["wallstreetbets","stocks","SecurityAnalysis"] },
  { title: "Rate-cut repositioning",  heat: 78, change:  +6, blurb: "Chatter shifting from 'higher for longer' to summer cuts. Banks + small caps lifted.", subs: ["investing","stocks","StockMarket"] },
  { title: "Crypto-linked equities",  heat: 64, change:  -8, blurb: "BTC consolidation cooling COIN/MSTR/MARA chatter. Sentiment turning cautious.", subs: ["wallstreetbets","pennystocks"] },
  { title: "Theta / premium selling", heat: 51, change:  +2, blurb: "Steady IV regime favoring CSPs on QQQ/SPY/big-cap tech. Discipline talk up.", subs: ["thetagang","options"] },
  { title: "Value rotation watch",    heat: 38, change:  +4, blurb: "BRK.B, KO, XOM mentions ticking up. Talk of rotation if growth wobbles.", subs: ["ValueInvesting","SecurityAnalysis"] },
  { title: "Earnings whisper plays",  heat: 47, change: +11, blurb: "Pre-earnings call/put structures around DIS, RBLX, SHOP being shared.", subs: ["options","Daytrading"] },
];
