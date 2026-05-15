/* global React, Sparkline */
const { useState: useStateS } = React;

const STRAT_COLORS = {
  WSB: "oklch(0.78 0.18 25)",
  FUND: "oklch(0.78 0.16 145)",
  OPT: "oklch(0.78 0.14 235)",
  BLEND: "oklch(0.82 0.16 75)",
  DAY: "oklch(0.74 0.16 320)",
  VS: "oklch(0.80 0.14 180)",
  CONTRA: "oklch(0.66 0.10 280)",
};

function StrategiesPage() {
  const strategies = window.STRATEGIES;
  const [selected, setSelected] = useStateS(strategies[0].id);

  // Real per-strategy equity (cumulative P&L) from snapshot.py. Only strategies
  // with closed trades appear here — empty/missing strategies are intentionally
  // dropped from the chart but kept in the legend (dimmed).
  const rawStrat = window.STRATEGY_EQUITY_SERIES || {};
  const rawSpy = window.SPY_BENCHMARK_SERIES || [];

  const { normalized, spyPts, unionDates, hasData } = React.useMemo(() => {
    const norm = {};
    const haveData = {};
    Object.keys(rawStrat).forEach((sid) => {
      const arr = rawStrat[sid] || [];
      if (arr.length < 2) return;
      const base = arr[0].equity;
      if (!base) return;
      norm[sid] = arr.map((r) => ({ t: (r.t || "").slice(0, 10), value: (r.equity / base) * 100 }));
      haveData[sid] = true;
    });
    const spyN = (rawSpy || []).map((r) => ({ t: (r.t || "").slice(0, 10), value: r.value }));
    const dateSet = new Set();
    Object.values(norm).forEach((arr) => arr.forEach((p) => p.t && dateSet.add(p.t)));
    spyN.forEach((p) => p.t && dateSet.add(p.t));
    const dates = [...dateSet].sort();
    return { normalized: norm, spyPts: spyN, unionDates: dates, hasData: haveData };
  }, [rawStrat, rawSpy]);

  const sel = strategies.find((s) => s.id === selected) || strategies[0];

  // Render combined chart
  const W = 760, H = 240, PAD_L = 44, PAD_R = 12, PAD_T = 12, PAD_B = 22;

  const dateToIdx = React.useMemo(() => {
    const m = new Map();
    unionDates.forEach((d, i) => m.set(d, i));
    return m;
  }, [unionDates]);

  const hasAny = unionDates.length >= 2;
  const allVals = [];
  Object.values(normalized).forEach((arr) => arr.forEach((p) => allVals.push(p.value)));
  spyPts.forEach((p) => allVals.push(p.value));
  const min = hasAny ? Math.min(...allVals) * 0.99 : 95;
  const max = hasAny ? Math.max(...allVals) * 1.01 : 105;
  const range = max - min || 1;
  const xStep = hasAny ? (W - PAD_L - PAD_R) / Math.max(unionDates.length - 1, 1) : 0;
  const yFor = (v) => PAD_T + ((max - v) / range) * (H - PAD_T - PAD_B);
  const xFor = (i) => PAD_L + i * xStep;
  const yTicks = [min, min + range / 2, max];

  const linePts = (arr) =>
    arr
      .map((p) => {
        const i = dateToIdx.get(p.t);
        return i == null ? null : `${xFor(i)},${yFor(p.value)}`;
      })
      .filter(Boolean)
      .join(" ");

  const live = strategies.filter((s) => s.status === "LIVE");
  const exp = strategies.filter((s) => s.status === "EXPERIMENTAL");
  const ytdVals = strategies.map((s) => s.ytdPct);

  return (
    <main className="shell">
      <PageHeader title="Strategies" subtitle="Independent autonomous bots competing against each other and SPY · each fed by a different mix of subreddits" />

      {/* HEADLINE STATS */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="statgrid">
          {[
            ["Live strategies", live.length],
            ["Experimental", exp.length],
            ["Best YTD", `+${Math.max(...ytdVals).toFixed(1)}%`, "up"],
            ["Worst YTD", `+${Math.min(...ytdVals).toFixed(1)}%`, ""],
            ["SPY benchmark", "+9.4%"],
            ["Auto-kill rule", "-15% DD"],
          ].map((s, i) => (
            <div className="stat" key={i}>
              <div className="label">{s[0]}</div>
              <div className={`value ${s[2] || ""}`}>{s[1]}</div>
            </div>
          ))}
        </div>
      </div>

      {/* COMBINED EQUITY CHART */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-head">
          <h3>All strategies · YTD performance vs SPY</h3>
          <div className="row" style={{ gap: 12, fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--muted)", flexWrap: "wrap" }}>
            {strategies.map((s) => {
              const has = hasData[s.id];
              return (
                <span key={s.id} style={{ display: "inline-flex", alignItems: "center", gap: 5, opacity: has ? 1 : 0.35 }}>
                  <i style={{ width: 8, height: 8, background: STRAT_COLORS[s.id] || "var(--muted)", borderRadius: 2 }} />
                  {s.id}
                  {!has && <em style={{ fontStyle: "normal", color: "var(--muted)" }}> · no trades yet</em>}
                </span>
              );
            })}
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, opacity: spyPts.length >= 2 ? 1 : 0.35 }}>
              <i style={{ width: 8, height: 8, background: "var(--muted)", borderRadius: 2 }} />
              SPY
            </span>
          </div>
        </div>
        <div className="chart-wrap">
          {hasAny ? (
            <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="240" style={{ display: "block" }}>
              {yTicks.map((v, i) => (
                <g key={i}>
                  <line x1={PAD_L} x2={W-PAD_R} y1={yFor(v)} y2={yFor(v)} stroke="var(--line)" strokeDasharray="2 4" />
                  <text x={PAD_L-6} y={yFor(v)+3} fill="var(--muted)" fontSize="10" textAnchor="end" fontFamily="var(--mono)">{(v-100).toFixed(0)}%</text>
                </g>
              ))}
              <line x1={PAD_L} x2={W-PAD_R} y1={yFor(100)} y2={yFor(100)} stroke="var(--line-2)" strokeDasharray="3 3" />
              {spyPts.length >= 2 && (
                <polyline points={linePts(spyPts)} fill="none" stroke="var(--muted)" strokeWidth="1.4" strokeDasharray="3 3" />
              )}
              {strategies.map((s) => {
                const arr = normalized[s.id];
                if (!arr) return null;
                return (
                  <polyline key={s.id} points={linePts(arr)} fill="none" stroke={STRAT_COLORS[s.id] || "var(--muted)"} strokeWidth="1.6" strokeLinejoin="round" />
                );
              })}
            </svg>
          ) : (
            <div className="mono" style={{ padding: "40px 12px", color: "var(--muted)", fontSize: 12, textAlign: "center" }}>
              Waiting for closed trades · curves render once strategies log ≥2 round-trips.
            </div>
          )}
        </div>
      </div>

      {/* LEADERBOARD */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-head">
          <h3>Leaderboard</h3>
          <span className="mono" style={{ fontSize: 10, color: "var(--muted)" }}>ranked by YTD return</span>
        </div>
        <div className="card-body tight">
          <table className="trades">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Strategy</th>
                <th>Feeds</th>
                <th className="num">YTD</th>
                <th className="num">Sharpe</th>
                <th className="num">Win rate</th>
                <th className="num">Trades</th>
                <th className="num">Max DD</th>
                <th>Status</th>
                <th>Curve</th>
              </tr>
            </thead>
            <tbody>
              {[...strategies].sort((a,b) => b.ytdPct - a.ytdPct).map((s, i) => {
                const sparkVals = (normalized[s.id] || []).map((p) => p.value);
                return (
                  <tr key={s.id} onClick={() => setSelected(s.id)} style={{ cursor: "pointer", background: selected === s.id ? "var(--surface-2)" : "transparent" }}>
                    <td className="dim mono">{String(i+1).padStart(2, "0")}</td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <i style={{ width: 8, height: 16, background: STRAT_COLORS[s.id] || "var(--muted)", borderRadius: 2 }} />
                        <div>
                          <div className="ticker">{s.name}</div>
                          <div className="sub-cell">{s.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="dim" style={{ fontSize: 10.5 }}>
                      {s.feeds.map((f) => <span key={f} style={{ background: "var(--surface-2)", border: "1px solid var(--line)", padding: "1px 5px", borderRadius: 3, marginRight: 4 }}>r/{f}</span>)}
                    </td>
                    <td className={`num ${s.ytdPct >= 9.4 ? "up" : s.ytdPct >= 0 ? "" : "down"}`}>+{s.ytdPct.toFixed(1)}%</td>
                    <td className="num">{s.sharpe.toFixed(2)}</td>
                    <td className="num">{(s.winRate*100).toFixed(0)}%</td>
                    <td className="num dim">{s.trades}</td>
                    <td className="num down">{s.dd.toFixed(1)}%</td>
                    <td><span className={`pill ${s.status === "LIVE" ? "holding" : "watching"}`}>{s.status}</span></td>
                    <td><Sparkline data={sparkVals} width={80} height={20} color={STRAT_COLORS[s.id] || "var(--muted)"} /></td>
                  </tr>
                );
              })}
              <tr style={{ borderTop: "2px solid var(--line-2)", opacity: 0.7 }}>
                <td className="dim mono">—</td>
                <td><div style={{ display: "flex", alignItems: "center", gap: 8 }}><i style={{ width: 8, height: 16, background: "var(--muted)", borderRadius: 2 }} /><div><div className="ticker">SPY (benchmark)</div><div className="sub-cell">passive</div></div></div></td>
                <td className="dim">—</td>
                <td className="num">+9.4%</td>
                <td className="num">0.81</td>
                <td className="num">—</td>
                <td className="num dim">—</td>
                <td className="num dim">−4.2%</td>
                <td><span className="pill">BENCHMARK</span></td>
                <td><Sparkline data={spyPts.map((p) => p.value)} width={80} height={20} color="var(--muted)" /></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* HEAD-TO-HEAD COMPARISON (D4) */}
      {window.StrategyComparisonPanel && <window.StrategyComparisonPanel />}

      {/* SELECTED STRATEGY DETAIL */}
      <div className="card">
        <div className="card-head">
          <h3>{sel.name} · {sel.id}</h3>
          <span className={`pill ${sel.status === "LIVE" ? "holding" : "watching"}`}>{sel.status}</span>
        </div>
        <div className="card-body">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", border: "1px solid var(--line)", borderRadius: 4, marginBottom: 16 }}>
            {[
              ["YTD return", `+${sel.ytdPct.toFixed(1)}%`, sel.ytdPct >= 9.4 ? "up" : "down"],
              ["vs SPY", `${sel.ytdPct - 9.4 >= 0 ? "+" : ""}${(sel.ytdPct - 9.4).toFixed(1)} pts`, sel.ytdPct >= 9.4 ? "up" : "down"],
              ["Sharpe", sel.sharpe.toFixed(2)],
              ["Win rate", (sel.winRate*100).toFixed(0)+"%"],
              ["Trades", sel.trades],
              ["Max DD", sel.dd.toFixed(1)+"%", "down"],
            ].map((s, i) => (
              <div key={i} style={{ padding: "12px 14px", borderRight: i < 5 ? "1px solid var(--line)" : "none" }}>
                <div className="label" style={{ fontFamily: "var(--mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)" }}>{s[0]}</div>
                <div className={`mono ${s[2] || ""}`} style={{ fontSize: 18, fontWeight: 600, marginTop: 2 }}>{s[1]}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <div className="label" style={{ fontFamily: "var(--mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)", marginBottom: 8 }}>Signal feeds</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {sel.feeds.map((f) => {
                  const sub = window.SUBREDDITS.find((x) => x.name === f);
                  return (
                    <div key={f} style={{ padding: 10, background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: 4, display: "grid", gridTemplateColumns: "1fr auto", gap: 12 }}>
                      <div>
                        <div className="ticker mono" style={{ fontSize: 12, fontWeight: 600 }}>r/{f}</div>
                        <div className="mono" style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>{sub ? `${sub.posts24h} posts/24h · sentiment ${sub.sentiment >= 0 ? "+" : ""}${sub.sentiment.toFixed(2)}` : ""}</div>
                      </div>
                      {sub && <Sparkline data={sub.pulse} width={80} height={22} color={STRAT_COLORS[sel.id]} />}
                    </div>
                  );
                })}
              </div>
            </div>
            <div>
              <div className="label" style={{ fontFamily: "var(--mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)", marginBottom: 8 }}>How the signal is computed</div>
              <p style={{ margin: 0, color: "var(--text-2)", fontSize: 13, lineHeight: 1.6 }}>
                {sel.id === "WSB" && "Weighted mention velocity from r/wallstreetbets and r/pennystocks. Signal fires when a ticker's 24h mention z-score crosses 2σ and aggregate sentiment > +0.4."}
                {sel.id === "FUND" && "DD-flair posts in r/SecurityAnalysis and r/ValueInvesting weighted by post score. Signal fires only on tickers with conviction ≥ 0.7 and at least 2 independent posts."}
                {sel.id === "OPT" && "Reads strike-and-expiry mentions from r/options and r/thetagang. Tracks unusual call/put structures and IV-regime chatter; fires structured trades."}
                {sel.id === "BLEND" && "Cross-validates signals across r/stocks, r/investing and r/StockMarket. A ticker must surface in at least 2 of 3 with sentiment > +0.3 to fire."}
                {sel.id === "DAY" && "Intraday momentum scanner using r/Daytrading post velocity. Short hold windows (<2 days). Higher trade count, lower per-trade edge."}
                {sel.id === "VS" && "Trades the spread between WSB hype and SecurityAnalysis fundamentals: long when both align bullish, short hype-only signals SecurityAnalysis is silent on."}
                {sel.id === "CONTRA" && "Fades extreme one-sided sentiment in r/wallstreetbets and r/pennystocks. Fires when sentiment > +0.85 or < −0.7 and post velocity is exhausting (3-day declining MA)."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

window.StrategiesPage = StrategiesPage;
