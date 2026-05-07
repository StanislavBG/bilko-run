/* global React */

// ===== Macro themes data =====
function genSeries(start, end, points = 30, vol = 0.04) {
  const out = [start];
  const drift = (Math.log(end / start)) / points;
  for (let i = 1; i < points; i++) {
    const noise = (Math.sin(i * 0.5) + (Math.random() - 0.5) * 1.6) * vol;
    out.push(out[i - 1] * (1 + drift + noise));
  }
  out[out.length - 1] = end;
  return out;
}

const MACRO_THEMES = [
  {
    id: "AI",
    name: "Artificial Intelligence",
    icon: "◆",
    color: "oklch(0.78 0.14 235)",
    headlinePrice: null,
    headlineLabel: "AI exposure index",
    headlineValue: 184.2,
    headlineDelta: +12.4,
    headlineDeltaPct: +7.2,
    series: genSeries(140, 184.2, 60, 0.018),
    sentiment: 0.62,
    sentimentDelta: +0.08,
    mentions24h: 4218,
    mentionsDelta: +18.4,
    keyTickers: [
      { ticker: "NVDA", role: "Compute leader",      pnl: 6420, mentions: 1842, sentiment: 0.71, action: "HOLDING" },
      { ticker: "AVGO", role: "AI networking",       pnl: 0,    mentions:  514, sentiment: 0.64, action: "WATCHING" },
      { ticker: "AMD",  role: "Compute alt",         pnl: 2180, mentions:  982, sentiment: 0.58, action: "HOLDING" },
      { ticker: "SMCI", role: "Server systems",      pnl: 0,    mentions:  402, sentiment: 0.38, action: "—" },
      { ticker: "DELL", role: "Server backlog",      pnl: 0,    mentions:  142, sentiment: 0.58, action: "WATCHING" },
      { ticker: "MU",   role: "HBM memory",          pnl: 920,  mentions:  280, sentiment: 0.61, action: "CLOSED +14%" },
      { ticker: "TSM",  role: "Foundry",             pnl: 1310, mentions:  340, sentiment: 0.66, action: "CLOSED +10%" },
      { ticker: "GOOG", role: "Hyperscaler / TPU",   pnl: 720,  mentions:  402, sentiment: 0.49, action: "CLOSED +4%" },
    ],
    talkingPoints: [
      "Hyperscaler capex revisions keep surprising up — q/q AI infra spend +18% consensus.",
      "HBM supply tightness chatter migrating from r/SecurityAnalysis to r/wallstreetbets — typically a 2-week lead before momentum.",
      "Sovereign-AI buildout commentary appearing in r/investing for the first time in 90 days.",
      "Counter-narrative: r/ValueInvesting flagging multiple compression risk above $1T market caps.",
    ],
    sourceBreakdown: [
      { sub: "wallstreetbets",   share: 0.34 },
      { sub: "stocks",           share: 0.18 },
      { sub: "SecurityAnalysis", share: 0.16 },
      { sub: "investing",        share: 0.12 },
      { sub: "options",          share: 0.10 },
      { sub: "Daytrading",       share: 0.06 },
      { sub: "StockMarket",      share: 0.04 },
    ],
    bullCount: 2840,
    bearCount: 1378,
  },
  {
    id: "BTC",
    name: "Bitcoin",
    icon: "₿",
    color: "oklch(0.82 0.16 75)",
    headlinePrice: 67214,
    headlineLabel: "BTC spot",
    headlineValue: 67214,
    headlineDelta: +812,
    headlineDeltaPct: +1.22,
    series: genSeries(54200, 67214, 60, 0.025),
    sentiment: 0.34,
    sentimentDelta: -0.04,
    mentions24h: 1842,
    mentionsDelta: -8.2,
    keyTickers: [
      { ticker: "MSTR", role: "Treasury proxy",      pnl: -568,  mentions:  342, sentiment:  0.18, action: "STOPPED" },
      { ticker: "COIN", role: "Exchange",            pnl: -498,  mentions:  348, sentiment: -0.18, action: "STOPPED" },
      { ticker: "MARA", role: "Miner",               pnl: 0,     mentions:  214, sentiment:  0.22, action: "—" },
      { ticker: "RIOT", role: "Miner",               pnl: 0,     mentions:  198, sentiment:  0.18, action: "—" },
      { ticker: "HOOD", role: "Retail crypto venue", pnl: 640,   mentions:  220, sentiment:  0.41, action: "CLOSED +18%" },
      { ticker: "IBIT", role: "Spot ETF",            pnl: 0,     mentions:  104, sentiment:  0.28, action: "WATCHING" },
    ],
    talkingPoints: [
      "ETF inflow chatter cooling as BTC consolidates in 65–68k range — sentiment turning cautious.",
      "Miner economics improving post-halving normalization, but r/wallstreetbets has rotated attention to AI names.",
      "Macro thread: rate-cut expectations beginning to support risk assets including BTC.",
      "Contrarian signal: r/pennystocks crypto-adjacent posts down 24% week-over-week — historically precedes consolidation.",
    ],
    sourceBreakdown: [
      { sub: "wallstreetbets",   share: 0.42 },
      { sub: "pennystocks",      share: 0.22 },
      { sub: "stocks",           share: 0.12 },
      { sub: "investing",        share: 0.10 },
      { sub: "options",          share: 0.08 },
      { sub: "Daytrading",       share: 0.06 },
    ],
    bullCount: 1124,
    bearCount: 718,
  },
  {
    id: "GOLD",
    name: "Gold",
    icon: "◉",
    color: "oklch(0.84 0.14 88)",
    headlinePrice: 2418,
    headlineLabel: "Gold spot",
    headlineValue: 2418,
    headlineDelta: +14,
    headlineDeltaPct: +0.58,
    series: genSeries(2080, 2418, 60, 0.008),
    sentiment: 0.41,
    sentimentDelta: +0.06,
    mentions24h: 412,
    mentionsDelta: +24.0,
    keyTickers: [
      { ticker: "GLD",  role: "Spot ETF",          pnl: 0,    mentions: 142, sentiment: 0.46, action: "WATCHING" },
      { ticker: "NEM",  role: "Largest miner",     pnl: 0,    mentions:  84, sentiment: 0.38, action: "—" },
      { ticker: "GDX",  role: "Miner ETF",         pnl: 0,    mentions:  72, sentiment: 0.42, action: "—" },
      { ticker: "AEM",  role: "Senior producer",   pnl: 0,    mentions:  48, sentiment: 0.36, action: "—" },
      { ticker: "PHYS", role: "Physical trust",    pnl: 0,    mentions:  32, sentiment: 0.51, action: "WATCHING" },
    ],
    talkingPoints: [
      "Mention volume up +24% over 30d — first time gold has trended on r/wallstreetbets in 6 months.",
      "Central bank buying chatter dominant in r/SecurityAnalysis (China + India accumulation thesis).",
      "Real-rate narrative: rate-cut chatter is finally supporting gold conviction in r/investing.",
      "Miners lagging spot — r/ValueInvesting flagging the divergence as a multi-month setup.",
    ],
    sourceBreakdown: [
      { sub: "investing",        share: 0.28 },
      { sub: "SecurityAnalysis", share: 0.22 },
      { sub: "ValueInvesting",   share: 0.18 },
      { sub: "stocks",           share: 0.12 },
      { sub: "wallstreetbets",   share: 0.10 },
      { sub: "StockMarket",      share: 0.10 },
    ],
    bullCount: 290,
    bearCount: 122,
  },
];

window.MACRO_THEMES = MACRO_THEMES;

// ===== Macro page component =====
function MacroPage() {
  const [selId, setSelId] = React.useState("AI");
  const sel = MACRO_THEMES.find((t) => t.id === selId) || MACRO_THEMES[0];

  // small line renderer
  const W = 760, H = 200, PAD_L = 50, PAD_R = 12, PAD_T = 12, PAD_B = 22;
  const series = sel.series;
  const min = Math.min(...series) * 0.99;
  const max = Math.max(...series) * 1.01;
  const range = max - min;
  const xStep = (W - PAD_L - PAD_R) / (series.length - 1);
  const yFor = (v) => PAD_T + ((max - v) / range) * (H - PAD_T - PAD_B);
  const xFor = (i) => PAD_L + i * xStep;
  const pts = series.map((v, i) => `${xFor(i)},${yFor(v)}`).join(" ");
  const area = `${PAD_L},${H - PAD_B} ${pts} ${xFor(series.length - 1)},${H - PAD_B}`;
  const yTicks = [min, min + range / 2, max];
  const fmtV = (v) => sel.headlinePrice ? "$" + Math.round(v).toLocaleString() : v.toFixed(0);

  const totalShare = sel.sourceBreakdown.reduce((a, b) => a + b.share, 0);
  const bullPct = sel.bullCount / (sel.bullCount + sel.bearCount);

  return (
    <main className="shell">
      <PageHeader title="Macro Themes" subtitle="AI · Bitcoin · Gold — thematic indexes built from subreddit chatter, with the tickers each theme touches" />

      {/* THEME SELECTOR CARDS */}
      <div className="grid grid-12" style={{ marginBottom: 12 }}>
        {MACRO_THEMES.map((t) => (
          <div key={t.id} className="col-4 col-md-12">
            <div onClick={() => setSelId(t.id)}
              style={{
                background: "var(--surface)",
                border: "1px solid " + (selId === t.id ? t.color : "var(--line)"),
                borderRadius: 6, padding: 16, cursor: "pointer",
                boxShadow: selId === t.id ? `0 0 0 1px ${t.color} inset` : "none",
              }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <span style={{ fontSize: 20, color: t.color, fontFamily: "var(--mono)" }}>{t.icon}</span>
                <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase" }}>{t.id}</span>
                <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--muted)", fontFamily: "var(--mono)" }}>{t.mentions24h.toLocaleString()} mentions/24h</span>
              </div>
              <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>{t.name}</div>
              <div className="mono" style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-0.01em" }}>
                {t.headlinePrice ? "$" + t.headlineValue.toLocaleString() : t.headlineValue.toFixed(1)}
              </div>
              <div className="mono" style={{ fontSize: 12, marginTop: 4 }}>
                <span className={t.headlineDelta >= 0 ? "up" : "down"}>{t.headlineDelta >= 0 ? "+" : ""}{t.headlineDelta.toLocaleString()} ({t.headlineDeltaPct >= 0 ? "+" : ""}{t.headlineDeltaPct.toFixed(2)}%)</span>
                <span className="dim" style={{ marginLeft: 6 }}>24h</span>
              </div>
              <div style={{ marginTop: 10 }}>
                <Sparkline data={t.series} width={300} height={36} color={t.color} />
              </div>
              <div style={{ display: "flex", gap: 14, marginTop: 10, fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--muted)" }}>
                <span>sentiment <span className={t.sentiment >= 0 ? "up" : "down"}>{t.sentiment >= 0 ? "+" : ""}{t.sentiment.toFixed(2)}</span></span>
                <span>Δ24h <span className={t.sentimentDelta >= 0 ? "up" : "down"}>{t.sentimentDelta >= 0 ? "+" : ""}{t.sentimentDelta.toFixed(2)}</span></span>
                <span style={{ marginLeft: "auto" }}>mentions <span className={t.mentionsDelta >= 0 ? "up" : "down"}>{t.mentionsDelta >= 0 ? "+" : ""}{t.mentionsDelta.toFixed(0)}%</span></span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* SELECTED CHART */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-head">
          <h3>{sel.name} · 60-day chart</h3>
          <span className="mono" style={{ fontSize: 10, color: "var(--muted)" }}>{sel.headlineLabel}</span>
        </div>
        <div className="chart-wrap">
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="200" style={{ display: "block" }}>
            {yTicks.map((v, i) => (
              <g key={i}>
                <line x1={PAD_L} x2={W - PAD_R} y1={yFor(v)} y2={yFor(v)} stroke="var(--line)" strokeDasharray="2 4" />
                <text x={PAD_L - 6} y={yFor(v) + 3} fill="var(--muted)" fontSize="10" textAnchor="end" fontFamily="var(--mono)">{fmtV(v)}</text>
              </g>
            ))}
            <polyline points={area} fill={sel.color} opacity="0.10" />
            <polyline points={pts} fill="none" stroke={sel.color} strokeWidth="1.8" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      {/* TWO-COLUMN: AI summary + tickers */}
      <div className="grid grid-12" style={{ marginBottom: 12 }}>
        {/* AI SUMMARY */}
        <div className="col-7 col-md-12">
          <div className="card">
            <div className="card-head">
              <h3>AI summary · what the 10 subs are saying about {sel.name}</h3>
              <span className="mono" style={{ fontSize: 10, color: "var(--muted)" }}>regenerated 4m ago</span>
            </div>
            <div className="card-body">
              {/* sentiment + bull/bear gauge */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 0, border: "1px solid var(--line)", borderRadius: 4, marginBottom: 14 }}>
                <div style={{ padding: "10px 14px", borderRight: "1px solid var(--line)" }}>
                  <div className="label" style={{ fontFamily: "var(--mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)" }}>Aggregate sentiment</div>
                  <div className="mono" style={{ fontSize: 18, fontWeight: 600, marginTop: 2 }}>
                    <span className={sel.sentiment >= 0 ? "up" : "down"}>{sel.sentiment >= 0 ? "+" : ""}{sel.sentiment.toFixed(2)}</span>
                  </div>
                </div>
                <div style={{ padding: "10px 14px", borderRight: "1px solid var(--line)" }}>
                  <div className="label" style={{ fontFamily: "var(--mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)" }}>Bull / Bear posts</div>
                  <div className="mono" style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}>
                    <span className="up">{sel.bullCount.toLocaleString()}</span>
                    <span className="dim"> / </span>
                    <span className="down">{sel.bearCount.toLocaleString()}</span>
                  </div>
                  <div style={{ width: "100%", height: 4, background: "var(--neg-bg)", borderRadius: 2, marginTop: 6, overflow: "hidden" }}>
                    <div style={{ width: `${bullPct * 100}%`, height: "100%", background: "var(--pos)" }} />
                  </div>
                </div>
                <div style={{ padding: "10px 14px" }}>
                  <div className="label" style={{ fontFamily: "var(--mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)" }}>Mentions/24h</div>
                  <div className="mono" style={{ fontSize: 18, fontWeight: 600, marginTop: 2 }}>
                    {sel.mentions24h.toLocaleString()} <span className={sel.mentionsDelta >= 0 ? "up" : "down"} style={{ fontSize: 11 }}>{sel.mentionsDelta >= 0 ? "+" : ""}{sel.mentionsDelta.toFixed(0)}%</span>
                  </div>
                </div>
              </div>

              <div className="label" style={{ fontFamily: "var(--mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)", marginBottom: 8 }}>Key talking points</div>
              <ul style={{ margin: 0, padding: "0 0 0 16px", color: "var(--text-2)", fontSize: 13, lineHeight: 1.65 }}>
                {sel.talkingPoints.map((tp, i) => <li key={i} style={{ marginBottom: 6 }}>{tp}</li>)}
              </ul>
            </div>
          </div>
        </div>

        {/* SOURCE BREAKDOWN */}
        <div className="col-5 col-md-12">
          <div className="card">
            <div className="card-head">
              <h3>Where the chatter lives</h3>
              <span className="mono" style={{ fontSize: 10, color: "var(--muted)" }}>share of {sel.name} mentions</span>
            </div>
            <div className="card-body">
              <div style={{ display: "grid", gap: 8 }}>
                {sel.sourceBreakdown.map((s) => (
                  <div key={s.sub} style={{ display: "grid", gridTemplateColumns: "150px 1fr 50px", alignItems: "center", gap: 10, fontFamily: "var(--mono)", fontSize: 11.5 }}>
                    <span style={{ color: "var(--text-2)" }}>r/{s.sub}</span>
                    <div style={{ height: 16, background: "var(--surface-2)", borderRadius: 3, position: "relative", border: "1px solid var(--line)", overflow: "hidden" }}>
                      <div style={{ width: `${(s.share / totalShare) * 100}%`, height: "100%", background: sel.color, opacity: 0.8 }} />
                    </div>
                    <span style={{ textAlign: "right" }}>{(s.share * 100).toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* RELEVANT TICKERS */}
      <div className="card">
        <div className="card-head">
          <h3>Tickers tied to {sel.name}</h3>
          <span className="mono" style={{ fontSize: 10, color: "var(--muted)" }}>system positions tagged</span>
        </div>
        <div className="card-body tight">
          <table className="trades">
            <thead>
              <tr>
                <th>Ticker</th>
                <th>Role</th>
                <th className="num">Mentions 24h</th>
                <th className="num">Sentiment</th>
                <th className="num">Strategy P&L</th>
                <th>Engine action</th>
              </tr>
            </thead>
            <tbody>
              {sel.keyTickers.map((t) => (
                <tr key={t.ticker}>
                  <td className="ticker">{t.ticker}</td>
                  <td className="dim">{t.role}</td>
                  <td className="num">{t.mentions.toLocaleString()}</td>
                  <td className="num"><span className={t.sentiment >= 0 ? "up" : "down"}>{t.sentiment >= 0 ? "+" : ""}{t.sentiment.toFixed(2)}</span></td>
                  <td className={`num ${t.pnl > 0 ? "up" : t.pnl < 0 ? "down" : "dim"}`}>
                    {t.pnl === 0 ? "—" : (t.pnl > 0 ? "+" : "−") + "$" + Math.abs(t.pnl).toLocaleString()}
                  </td>
                  <td>
                    <span className={`pill ${t.action === "HOLDING" ? "holding" : t.action === "WATCHING" ? "watching" : t.action.startsWith("STOPPED") ? "stopped" : t.action.startsWith("CLOSED") ? "closed" : "passed"}`}>{t.action}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}

window.MacroPage = MacroPage;
