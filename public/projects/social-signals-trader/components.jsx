/* global React */
const { useState, useMemo, useEffect } = React;

// ============== Sparkline ==============
function Sparkline({ data, width = 80, height = 22, color = "var(--pos)", fill = true }) {
  if (!data || data.length === 0) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const step = width / (data.length - 1);
  const points = data
    .map((v, i) => `${i * step},${height - ((v - min) / range) * (height - 2) - 1}`)
    .join(" ");
  const areaPoints = `0,${height} ${points} ${width},${height}`;
  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      {fill && <polyline points={areaPoints} fill={color} opacity="0.14" stroke="none" />}
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ============== Status bar ==============
function StatusBar() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const pad = (n) => String(n).padStart(2, "0");
  const ts = `${now.getUTCFullYear()}-${pad(now.getUTCMonth()+1)}-${pad(now.getUTCDate())} ${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())} UTC`;
  const ticks = window.STATUS_QUOTES || [];
  const marketState = ticks.find((t) => t.marketState)?.marketState || "closed";
  const isOpen = marketState === "open";
  return (
    <div className="statusbar">
      <span className="live">{isOpen ? "LIVE · MARKET OPEN" : "MARKET CLOSED"}</span>
      <div className="ticker-strip">
        {ticks.length === 0 && <span className="muted">no quotes</span>}
        {ticks.map((q) => {
          const p = q.price;
          const c = q.changePct;
          return (
            <span key={q.ticker}>
              <b style={{ color: "var(--text)" }}>{q.ticker}</b>
              <span className="tnum">
                {p == null ? "—" : p.toLocaleString("en-US", { minimumFractionDigits: p < 1000 ? 2 : 0 })}
              </span>
              {c == null ? (
                <span className="muted">—</span>
              ) : (
                <span className={c >= 0 ? "up" : "down"}>{c >= 0 ? "+" : ""}{c.toFixed(2)}%</span>
              )}
            </span>
          );
        })}
      </div>
      <span className="muted">{ts}</span>
    </div>
  );
}

// ============== Header ==============
function Header({ handle, bmcUrl, page, setPage }) {
  const tabs = [
    ["dashboard", "Dashboard"],
    ["strategies", "Strategies"],
    ["macro", "Macro"],
    ["trades", "Trades"],
    ["reddit", "Reddit Intel"],
    ["watchlist", "Watchlist"],
    ["reports", "Reports"],
    ["methodology", "Methodology"],
  ];
  return (
    <header className="header">
      <div className="brand" style={{ cursor: "pointer" }} onClick={() => setPage("dashboard")}>
        <div className="brand-mark">P</div>
        <div className="brand-name">{handle.split(".")[0]}<span>.{handle.split(".")[1]}</span></div>
      </div>
      <nav className="nav">
        {tabs.map(([k, l]) => (
          <a key={k} href={`#${k}`} className={page === k ? "active" : ""}
             onClick={(e) => { e.preventDefault(); setPage(k); }}>{l}</a>
        ))}
      </nav>
      <a className="bmc-btn" href={bmcUrl} target="_blank" rel="noreferrer">
        <span className="coffee">☕</span> Buy me a coffee
      </a>
    </header>
  );
}

// ============== Hero P&L ==============
function Hero({ perf, equity }) {
  const equityVals = equity.map((e) => e.equity);
  const fmt$ = (v) => "$" + Math.round(v).toLocaleString("en-US");
  const fmtPct = (v) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
  return (
    <div className="hero">
      <div className="pnl-hero">
        <span className="label">Total P&L · YTD</span>
        <span className={`value mono ${perf.totalPnl >= 0 ? "up" : "down"}`}>
          {perf.totalPnl >= 0 ? "+" : ""}{fmt$(perf.totalPnl)}
        </span>
        <span className="sub">
          <span className={perf.totalPnlPct >= 0 ? "up" : "down"}>{fmtPct(perf.totalPnlPct)}</span>
          <span className="dim"> · vs SPY +{perf.spyYtdPct.toFixed(1)}%</span>
        </span>
        <Sparkline data={equityVals} width={140} height={32} color="var(--pos)" />
      </div>
      <div>
        <span className="label">Equity</span>
        <span className="value mono">{fmt$(perf.currentEquity)}</span>
        <span className="sub dim">from {fmt$(perf.startingCapital)}</span>
      </div>
      <div>
        <span className="label">Win Rate</span>
        <span className="value mono">{(perf.winRate * 100).toFixed(1)}%</span>
        <span className="sub dim">{perf.wins}W · {perf.losses}L</span>
      </div>
      <div>
        <span className="label">Profit Factor</span>
        <span className="value mono">{perf.profitFactor.toFixed(2)}</span>
        <span className="sub dim">avg win ${perf.avgWin.toFixed(0)} · loss ${Math.abs(perf.avgLoss).toFixed(0)}</span>
      </div>
      <div>
        <span className="label">Sharpe / Max DD</span>
        <span className="value mono">{perf.sharpe.toFixed(2)} <span className="dim" style={{fontSize: 16}}> / </span><span className="down">{perf.maxDD.toFixed(1)}%</span></span>
        <span className="sub dim">{perf.trades} trades · {perf.open} open</span>
      </div>
    </div>
  );
}

// ============== Stats strip (secondary) ==============
function StatStrip({ perf }) {
  const items = [
    ["Trades", perf.trades, ""],
    ["Open", perf.open, ""],
    ["Closed", perf.closed, ""],
    ["Avg hold", perf.avgHoldDays.toFixed(1) + "d", ""],
    ["Best trade", "+$" + perf.bestTrade.pnl.toFixed(0), perf.bestTrade.ticker, "up"],
    ["Worst trade", "−$" + Math.abs(perf.worstTrade.pnl).toFixed(0), perf.worstTrade.ticker, "down"],
  ];
  return (
    <div className="card">
      <div className="statgrid">
        {items.map((it) => (
          <div className="stat" key={it[0]}>
            <div className="label">{it[0]}</div>
            <div className={`value ${it[3] || ""}`}>{it[1]} <span className="dim" style={{fontSize: 11, marginLeft: 4}}>{it[2]}</span></div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============== Equity chart ==============
function EquityChart({ equity, timeframe, setTimeframe }) {
  const W = 760, H = 240, PAD_L = 44, PAD_R = 12, PAD_T = 12, PAD_B = 22;
  const slice = useMemo(() => {
    const days = timeframe === "30D" ? 30 : timeframe === "7D" ? 7 : timeframe === "90D" ? 90 : equity.length;
    return equity.slice(-days);
  }, [equity, timeframe]);
  if (slice.length === 0) return null;
  const eqVals = slice.map((d) => d.equity);
  const spyStart = slice[0].spy;
  const eqStart = slice[0].equity;
  // normalize spy onto equity scale (% change from start * eqStart)
  const spyVals = slice.map((d) => eqStart * (d.spy / spyStart));
  const all = [...eqVals, ...spyVals];
  const min = Math.min(...all) * 0.998;
  const max = Math.max(...all) * 1.002;
  const range = max - min;
  const xStep = (W - PAD_L - PAD_R) / (slice.length - 1);
  const yFor = (v) => PAD_T + ((max - v) / range) * (H - PAD_T - PAD_B);
  const xFor = (i) => PAD_L + i * xStep;
  const eqPts = eqVals.map((v, i) => `${xFor(i)},${yFor(v)}`).join(" ");
  const spyPts = spyVals.map((v, i) => `${xFor(i)},${yFor(v)}`).join(" ");
  const eqArea = `${PAD_L},${H - PAD_B} ${eqPts} ${xFor(slice.length - 1)},${H - PAD_B}`;
  const ticks = 5;
  const yTicks = Array.from({ length: ticks }, (_, i) => min + (range * i) / (ticks - 1));
  const fmt$ = (v) => "$" + Math.round(v / 1000) + "k";
  const fmtDate = (t) => {
    const d = new Date(t);
    return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
  };
  const xTicks = [0, Math.floor(slice.length / 4), Math.floor(slice.length / 2), Math.floor(3 * slice.length / 4), slice.length - 1];

  return (
    <div className="card">
      <div className="card-head">
        <h3>Equity Curve · vs SPY</h3>
        <div className="tf">
          {["7D","30D","90D","ALL"].map((t) => (
            <button key={t} className={timeframe === t ? "active" : ""} onClick={() => setTimeframe(t)}>{t}</button>
          ))}
        </div>
      </div>
      <div className="chart-wrap">
        <div className="chart-legend">
          <span><i className="dot" style={{ background: "var(--pos)" }} /> Account equity</span>
          <span><i className="dot" style={{ background: "var(--dim)" }} /> SPY (normalized)</span>
          <span className="right">Last: <b className="mono" style={{color:"var(--text)"}}>${Math.round(eqVals[eqVals.length-1]).toLocaleString()}</b></span>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="240" style={{ display: "block" }}>
          {/* gridlines */}
          {yTicks.map((v, i) => (
            <g key={i}>
              <line x1={PAD_L} x2={W - PAD_R} y1={yFor(v)} y2={yFor(v)} stroke="var(--line)" strokeDasharray="2 4" />
              <text x={PAD_L - 6} y={yFor(v) + 3} fill="var(--muted)" fontSize="10" textAnchor="end" fontFamily="var(--mono)">{fmt$(v)}</text>
            </g>
          ))}
          {/* x labels */}
          {xTicks.map((i) => (
            <text key={i} x={xFor(i)} y={H - 6} fill="var(--muted)" fontSize="10" textAnchor="middle" fontFamily="var(--mono)">{fmtDate(slice[i].t)}</text>
          ))}
          {/* SPY (background line) */}
          <polyline points={spyPts} fill="none" stroke="var(--dim)" strokeWidth="1.2" strokeDasharray="3 3" />
          {/* equity area */}
          <polyline points={eqArea} fill="var(--pos)" opacity="0.10" />
          <polyline points={eqPts} fill="none" stroke="var(--pos)" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}

// ============== P&L Heatmap ==============
function Heatmap({ data }) {
  const max = Math.max(...data.map((d) => Math.abs(d.pnl))) || 1;
  const colorFor = (v) => {
    if (v === 0) return "var(--surface-2)";
    const intensity = Math.min(1, Math.abs(v) / max);
    const alpha = 0.18 + intensity * 0.65;
    return v > 0
      ? `oklch(0.65 0.18 145 / ${alpha})`
      : `oklch(0.55 0.20 25 / ${alpha})`;
  };
  return (
    <div className="card">
      <div className="card-head">
        <h3>Daily P&L · last 12 weeks</h3>
        <div className="row" style={{ gap: 8, fontFamily: "var(--mono)", fontSize: 10, color: "var(--muted)" }}>
          <span>−</span>
          {[-1, -0.5, 0, 0.5, 1].map((v, i) => (
            <i key={i} style={{ width: 10, height: 10, borderRadius: 2, background: colorFor(v * max), display: "inline-block" }} />
          ))}
          <span>+</span>
        </div>
      </div>
      <div className="card-body">
        <div className="heatmap">
          {data.map((d, i) => {
            const date = new Date(d.t);
            const label = `${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })} · ${d.pnl > 0 ? "+$" : d.pnl < 0 ? "-$" : "$"}${Math.abs(d.pnl).toFixed(0)}`;
            return <div key={i} className="cell" title={label} style={{ background: colorFor(d.pnl) }} />;
          })}
        </div>
      </div>
    </div>
  );
}

// ============== Trades table ==============
function TradesTable({ trades, bmcUrl }) {
  const [filter, setFilter] = useState("ALL");
  const filtered = trades.filter((t) => {
    if (filter === "OPEN") return t.status === "OPEN";
    if (filter === "CLOSED") return t.status === "CLOSED";
    if (filter === "WINS") return t.status === "CLOSED" && t.pnl > 0;
    if (filter === "LOSSES") return t.status === "CLOSED" && t.pnl < 0;
    return true;
  });
  const fmt$ = (v) => (v >= 0 ? "+$" : "−$") + Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (
    <div className="card">
      <div className="card-head">
        <h3>Live Trade Log · {filtered.length} of {trades.length} shown</h3>
        <div className="tf">
          {["ALL", "OPEN", "CLOSED", "WINS", "LOSSES"].map((f) => (
            <button key={f} className={filter === f ? "active" : ""} onClick={() => setFilter(f)}>{f}</button>
          ))}
        </div>
      </div>
      <div className="card-body tight" style={{ maxHeight: 480, overflowY: "auto" }}>
        <table className="trades">
          <thead>
            <tr>
              <th>ID</th>
              <th>Ticker</th>
              <th>Side</th>
              <th>Type</th>
              <th>Status</th>
              <th className="num">Entry</th>
              <th className="num">Exit</th>
              <th className="num">Qty</th>
              <th className="num">P&L</th>
              <th>Source</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => (
              <tr key={t.id}>
                <td className="dim">{t.id}</td>
                <td>
                  <div className="ticker">{t.ticker}</div>
                  <div className="sub-cell">{t.opened}{t.closed ? ` → ${t.closed}` : " · open"}</div>
                </td>
                <td><span className={`pill ${t.side === "LONG" ? "long" : "short"}`}>{t.side}</span></td>
                <td className="dim">{t.type}</td>
                <td><span className={`pill ${t.status === "OPEN" ? "open" : "closed"}`}>{t.status}</span></td>
                <td className="num">{t.entry.toFixed(2)}</td>
                <td className="num dim">{t.exit ? t.exit.toFixed(2) : "—"}</td>
                <td className="num dim">{t.qty}</td>
                <td className={`num ${t.pnl >= 0 ? "up" : "down"}`}>
                  {fmt$(t.pnl)}
                  <div className="sub-cell" style={{ color: t.pnl >= 0 ? "var(--pos)" : "var(--neg)", opacity: 0.7 }}>{t.pnlPct >= 0 ? "+" : ""}{t.pnlPct.toFixed(1)}%</div>
                  {t.pnl > 1000 && t.status === "CLOSED" && (
                    <a className="tip-inline" href={bmcUrl} target="_blank" rel="noreferrer" title="Tip the trader">☕ tip</a>
                  )}
                </td>
                <td className="dim">{t.source}</td>
                <td className="dim" style={{ fontSize: 10.5, maxWidth: 180 }}>{t.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============== Subreddit panel ==============
function SubredditPanel({ subs }) {
  const [tf, setTf] = useState("24H");
  const fmtSubs = (n) => n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : (n / 1e3).toFixed(0) + "k";
  return (
    <div className="card">
      <div className="card-head">
        <h3>Subreddit Pulse · 10 sources</h3>
        <div className="tf">
          {["24H","7D","30D"].map((t) => (
            <button key={t} className={tf === t ? "active" : ""} onClick={() => setTf(t)}>{t}</button>
          ))}
        </div>
      </div>
      <div className="card-body tight">
        {subs.map((s) => {
          const sentColor = s.sentiment >= 0 ? "var(--pos)" : "var(--neg)";
          const sentPct = (Math.abs(s.sentiment) * 100).toFixed(0);
          return (
            <div className="sub-row" key={s.name}>
              <div className="name">
                <b>r/{s.name}</b>
                <small>{fmtSubs(s.subs)} subs · {s.posts24h} posts/24h</small>
              </div>
              <div>
                <Sparkline data={s.pulse} width={56} height={18} color="var(--info)" />
              </div>
              <div className="row" style={{ gap: 6 }}>
                <span className="sent" title={`Sentiment ${s.sentiment.toFixed(2)}`}>
                  <i style={{
                    width: `${sentPct}%`,
                    background: sentColor,
                    marginLeft: s.sentiment >= 0 ? "50%" : `${50 - parseFloat(sentPct)/2}%`,
                  }} />
                </span>
                <span className={s.change24h >= 0 ? "up" : "down"} style={{ fontSize: 10 }}>
                  {s.change24h >= 0 ? "+" : ""}{s.change24h.toFixed(2)}
                </span>
              </div>
              <div className="tickers">
                {s.top.map((t) => <span className="chip" key={t}>{t}</span>)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============== Trending tickers ==============
function TrendingTickers({ trending }) {
  return (
    <div className="card">
      <div className="card-head">
        <h3>Trending Tickers · 24h aggregate</h3>
        <span className="mono" style={{ fontSize: 10, color: "var(--muted)" }}>across 10 subs</span>
      </div>
      <div className="card-body tight">
        {trending.map((t, i) => {
          const sentColor = t.sentiment >= 0 ? "var(--pos)" : "var(--neg)";
          const w = Math.abs(t.sentiment) * 50;
          return (
            <div className="trend-row" key={t.ticker}>
              <span className="trend-rank">{String(i + 1).padStart(2, "0")}</span>
              <span>
                <span className="trend-tk">{t.ticker}</span>
                <span className="trend-mentions" style={{ marginLeft: 8 }}>{t.mentions.toLocaleString()} <span className="dim" style={{fontSize: 10}}>mentions</span></span>
              </span>
              <span className="sent" title={`Sentiment ${t.sentiment.toFixed(2)}`}>
                <i style={{ width: `${w}%`, background: sentColor, marginLeft: t.sentiment >= 0 ? "50%" : `${50 - w}%` }} />
              </span>
              <span className={t.change >= 0 ? "up" : "down"} style={{ minWidth: 56, textAlign: "right" }}>
                {t.change >= 0 ? "+" : ""}{t.change.toFixed(1)}%
              </span>
              <span className={`pill ${t.action.startsWith("HOLDING") ? "holding" : t.action.startsWith("WATCHING") ? "watching" : t.action.startsWith("STOPPED") ? "stopped" : "passed"}`}>
                {t.action}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============== Themes ==============
function Themes({ themes }) {
  return (
    <div className="card">
      <div className="card-head">
        <h3>What Reddit Is Talking About</h3>
        <span className="mono" style={{ fontSize: 10, color: "var(--muted)" }}>LLM-summarized · refreshed 4m ago</span>
      </div>
      <div className="card-body tight">
        {themes.map((th) => (
          <div className="theme" key={th.title}>
            <div className="theme-head">
              <span className="theme-title">{th.title}</span>
              <span className="theme-heat">
                <span className="dim">heat</span>
                <span className="heat-bar"><i style={{ width: `${th.heat}%` }} /></span>
                <span className="mono">{th.heat}</span>
                <span className={th.change >= 0 ? "up" : "down"} style={{ fontSize: 10 }}>
                  {th.change >= 0 ? "+" : ""}{th.change}
                </span>
              </span>
            </div>
            <p className="theme-blurb">{th.blurb}</p>
            <div className="theme-meta">
              {th.subs.map((s) => <span className="chip" key={s}>r/{s}</span>)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============== Watchlist ==============
function Watchlist({ list }) {
  return (
    <div className="card">
      <div className="card-head">
        <h3>Watchlist · signals not yet acted on</h3>
        <span className="mono" style={{ fontSize: 10, color: "var(--muted)" }}>{list.length} tracked</span>
      </div>
      <div className="card-body tight">
        <table className="trades">
          <thead>
            <tr>
              <th>Ticker</th>
              <th className="num">Mentions 24h</th>
              <th className="num">Sentiment</th>
              <th className="num">Conviction</th>
              <th>Status</th>
              <th>Reasoning</th>
            </tr>
          </thead>
          <tbody>
            {list.map((w) => (
              <tr key={w.ticker}>
                <td className="ticker">{w.ticker}</td>
                <td className="num">{w.mentions24h}</td>
                <td className="num"><span className={w.sentiment >= 0 ? "up" : "down"}>{w.sentiment >= 0 ? "+" : ""}{w.sentiment.toFixed(2)}</span></td>
                <td className="num">{(w.conviction * 100).toFixed(0)}%</td>
                <td><span className={`pill ${w.status === "WATCHING" ? "watching" : "passed"}`}>{w.status}</span></td>
                <td className="dim">{w.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============== Methodology + Footer ==============
function Methodology() {
  return (
    <div className="card" id="methodology">
      <div className="card-head"><h3>Methodology · how this works</h3></div>
      <div className="card-body">
        <div className="method-grid">
          <div>
            <h4>01 · Ingest</h4>
            <p>The pipeline pulls posts and top-level comments from 10 stock-focused subreddits every 15 minutes. Body, title, score, comment count, ticker mentions ($-prefixed and dictionary-matched).</p>
          </div>
          <div>
            <h4>02 · Score</h4>
            <p>An LLM tags each post with sentiment, topic and conviction. Per-ticker and per-sub aggregates roll up into per-strategy signal scores, weighted by post score and recency.</p>
          </div>
          <div>
            <h4>03 · Execute</h4>
            <p>When a strategy's signal crosses its conviction gate the engine sizes, places stops, and routes orders. Fully autonomous, zero human review. Every fill streams straight to the audit log on this page.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============== Footer CTA ==============
function FooterCTA({ bmcUrl, perf }) {
  return (
    <div className="footer-cta">
      <div>
        <h2>If watching the experiment is useful, fuel it.</h2>
        <p>Servers, scrapers, model calls and broker fees are paid out of pocket. No paid signals, no Discord, no affiliate. The bots make their own decisions; coffee keeps the pipeline running — and you get to watch live whether autonomous Reddit-driven trading actually works (so far: <span className="up mono">+{perf.totalPnlPct.toFixed(1)}%</span> YTD vs SPY <span className="mono">+{perf.spyYtdPct.toFixed(1)}%</span>).</p>
      </div>
      <a className="bmc-btn" href={bmcUrl} target="_blank" rel="noreferrer" style={{ padding: "12px 20px", fontSize: 13 }}>
        <span className="coffee">☕</span> Buy me a coffee
      </a>
    </div>
  );
}

// expose
Object.assign(window, {
  Sparkline, StatusBar, Header, Hero, StatStrip,
  EquityChart, Heatmap, TradesTable,
  SubredditPanel, TrendingTickers, Themes, Watchlist,
  Methodology, FooterCTA,
});
