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
// Single-page consolidation: the dashboard is the only surface, so the tab
// nav was removed. Brand + the section anchors below are the whole header.
function Header({ handle, bmcUrl, setPage }) {
  const sections = [
    ["catalysts", "Catalysts"],
    ["positions", "Positions"],
    ["tradelog", "Trade Log"],
    ["watchlist", "Watchlist"],
  ];
  const closeNav = () => {
    const el = document.getElementById("nav-toggle");
    if (el) el.checked = false;
  };
  // Ticker Details is a real route, not an in-page anchor — it renders its own
  // surface instead of a section of the dashboard.
  const routes = [["options", "Ticker Details"]];
  const jumpTo = (id) => {
    closeNav();
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    else if (setPage) setPage(id);
  };
  const goto = (page) => {
    closeNav();
    if (setPage) setPage(page);
  };
  return (
    <header className="header">
      <div className="brand" style={{ cursor: "pointer" }} onClick={() => setPage && setPage("dashboard")}>
        <div className="brand-mark">P</div>
        <div className="brand-name">{handle.split(".")[0]}<span>.{handle.split(".")[1]}</span></div>
      </div>
      {/* Desktop nav (≥821px) — in-page section jumps, not router tabs */}
      <nav className="nav">
        {sections.map(([id, l]) => (
          <a key={id} href={`#${id}`}
             onClick={(e) => { e.preventDefault(); jumpTo(id); }}>{l}</a>
        ))}
        {routes.map(([id, l]) => (
          <a key={id} href={`#${id}`}
             onClick={(e) => { e.preventDefault(); goto(id); }}>{l}</a>
        ))}
      </nav>
      {/* Mobile hamburger — CSS-only via :checked sibling selector */}
      <input type="checkbox" id="nav-toggle" className="nav-toggle-input" aria-hidden="true" />
      <label htmlFor="nav-toggle" className="nav-toggle-btn" aria-label="Toggle navigation">
        <span aria-hidden="true">☰</span>
      </label>
      <nav className="nav-mobile">
        {sections.map(([id, l]) => (
          <a key={id} href={`#${id}`}
             onClick={(e) => { e.preventDefault(); jumpTo(id); }}>{l}</a>
        ))}
        {routes.map(([id, l]) => (
          <a key={id} href={`#${id}`}
             onClick={(e) => { e.preventDefault(); goto(id); }}>{l}</a>
        ))}
      </nav>
      <a className="bmc-btn" href={bmcUrl} target="_blank" rel="noreferrer">
        <span className="coffee">☕</span> Buy me a coffee
      </a>
    </header>
  );
}

// ============== DEMO badge ==============
// Marks widgets whose live producer is wired but currently emits no usable data
// (e.g. upstream pipeline gap or missing source file). The badge keeps the rest
// of the dashboard honest: if a widget is unmarked, treat its data as real.
function DemoBadge({ title = "no live data — producer not yet wired" }) {
  return (
    <span
      className="demo-badge"
      title={title}
      aria-label="DEMO"
    >DEMO</span>
  );
}
window.DemoBadge = DemoBadge;

// ============== Hero P&L (legacy 5-col, kept as a tweak option) ==============
function HeroLegacy({ perf, equity }) {
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

// ============== Two-line sparkline (equity vs SPY overlay) ==============
function DualSparkline({ equity, spy, width = 220, height = 44 }) {
  if (!equity || equity.length === 0) return null;
  const all = [...equity, ...spy];
  const min = Math.min(...all);
  const max = Math.max(...all);
  const range = max - min || 1;
  const step = width / (equity.length - 1);
  const eqPts = equity
    .map((v, i) => `${i * step},${height - ((v - min) / range) * (height - 2) - 1}`)
    .join(" ");
  const spyPts = spy
    .map((v, i) => `${i * step},${height - ((v - min) / range) * (height - 2) - 1}`)
    .join(" ");
  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      <polyline points={spyPts} fill="none" stroke="var(--dim)" strokeWidth="1.2" strokeDasharray="3 3" />
      <polyline points={eqPts} fill="none" stroke="var(--pos)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ============== Hero — Alpaca account vs SPY (single above-the-fold KPI) ==============
// The single verifiable measure of success: the Alpaca account's return vs SPY,
// representing the union of all Social Signal Strategies. Per-sleeve attribution
// is now collapsed into <PerStrategyAttribution /> below.
function HeroAlpacaVsSpy({ perf, equity, leadWith = "dollar" }) {
  const fmt$ = (v) => "$" + Math.round(v).toLocaleString("en-US");
  const fmtPct = (v) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
  const acctReturnPct = perf.totalPnlPct;
  const spyReturnPct = perf.spyYtdPct;
  const vsSpy = acctReturnPct - spyReturnPct;
  const equityVals = equity.map((e) => e.equity);
  const spyVals = equity.map((e) => e.spy);
  const leadValue = leadWith === "percent"
    ? fmtPct(acctReturnPct)
    : fmt$(perf.currentEquity);
  const leadSub = leadWith === "percent"
    ? `${fmt$(perf.currentEquity)} from ${fmt$(perf.startingCapital)}`
    : `${fmtPct(acctReturnPct)} from ${fmt$(perf.startingCapital)}`;
  return (
    <div className="hero hero-asv">
      <div className="asv-lead">
        <span className="label">Alpaca account · YTD</span>
        <span className={`value mono ${acctReturnPct >= 0 ? "up" : "down"}`}>{leadValue}</span>
        <span className="sub dim">{leadSub}</span>
      </div>
      <div className="asv-vs">
        <span className="label">vs SPY</span>
        <span className={`value mono ${vsSpy >= 0 ? "up" : "down"}`}>{fmtPct(vsSpy)}</span>
        <span className="sub dim">
          acct {fmtPct(acctReturnPct)} · SPY {fmtPct(spyReturnPct)}
        </span>
      </div>
      <div className="asv-spark">
        <span className="label">Equity vs SPY</span>
        <DualSparkline equity={equityVals} spy={spyVals} width={220} height={44} />
        <span className="sub dim" style={{ display: "flex", gap: 10 }}>
          <span><i className="dot" style={{ background: "var(--pos)" }} /> Account</span>
          <span><i className="dot" style={{ background: "var(--dim)" }} /> SPY</span>
        </span>
      </div>
    </div>
  );
}

// ============== Hero dispatcher (legacy / dollar / percent) ==============
function Hero({ perf, equity, mode }) {
  if (mode === "legacy") return <HeroLegacy perf={perf} equity={equity} />;
  return <HeroAlpacaVsSpy perf={perf} equity={equity} leadWith={mode || "dollar"} />;
}

// ============== Per-strategy attribution (collapsible secondary KPIs) ==============
// Demoted from the primary hero. Reads window.STRATEGIES; sleeve PnL is derived
// from ytdPct × equal-weight slice of startingCapital (per-sleeve dollar PnL is
// not surfaced in PERF today, so this is a proxy honest enough for attribution
// ranking).
function PerStrategyAttribution({ perf, strategies }) {
  const list = strategies || window.STRATEGIES || [];
  const sliceCapital = list.length > 0 ? perf.startingCapital / list.length : 0;
  const rows = list
    .map((s) => ({
      id: s.id,
      name: s.name,
      trades: s.trades || 0,
      winRate: s.winRate || 0,
      sleevePnl: (s.ytdPct || 0) * sliceCapital / 100,
      status: s.status,
    }))
    .sort((a, b) => b.sleevePnl - a.sleevePnl);
  const fmt$ = (v) => (v >= 0 ? "+$" : "−$") + Math.abs(Math.round(v)).toLocaleString("en-US");
  return (
    <div className="card per-strategy-attr">
      <details>
        <summary className="per-strategy-attr-summary">
          <span className="psa-title">by-strategy attribution</span>
          <span className="psa-meta dim mono">{list.length} sleeves · secondary KPIs</span>
        </summary>
        <div className="card-body">
          <div style={{ marginBottom: 12 }}>
            <StatStrip perf={perf} />
          </div>
          <table className="trades">
            <thead>
              <tr>
                <th>Strategy</th>
                <th>Status</th>
                <th className="num">n trades</th>
                <th className="num">win rate</th>
                <th className="num">sleeve P&L</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td><b>{r.id}</b><div className="sub-cell dim">{r.name}</div></td>
                  <td><span className="pill">{r.status || "—"}</span></td>
                  <td className="num">{r.trades}</td>
                  <td className="num">{(r.winRate * 100).toFixed(1)}%</td>
                  <td className={`num ${r.sleevePnl >= 0 ? "up" : "down"}`}>{fmt$(r.sleevePnl)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
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

// ============== Realized P&L Calendar ==============
const CAL_WEEKS = 13;
const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function buildCalendar(data, weeks = CAL_WEEKS) {
  // Map YYYY-MM-DD -> day record. Server keys are UTC dates.
  const byDate = new Map(data.filter((d) => d.date).map((d) => [d.date, d]));
  // Anchor "today" to UTC date so it aligns with server-side date keys.
  const now = new Date();
  const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  // Monday-start week containing today. Mon=0..Sun=6.
  const dow = todayUTC.getUTCDay();              // 0=Sun..6=Sat
  const monOffset = (dow + 6) % 7;               // Mon=0..Sun=6
  const thisMon = new Date(todayUTC.getTime() - monOffset * 86400000);
  const startMon = new Date(thisMon.getTime() - (weeks - 1) * 7 * 86400000);
  const cells = [];      // column-major: [col0row0..col0row6, col1row0..]
  const monthLabels = []; // {col, label}
  let lastMonth = -1;
  for (let col = 0; col < weeks; col++) {
    for (let row = 0; row < 7; row++) {
      const dt = new Date(startMon.getTime() + (col * 7 + row) * 86400000);
      const key = dt.toISOString().slice(0, 10);
      cells.push({
        key,
        col,
        row,
        weekend: row >= 5,
        future: dt > todayUTC,
        day: byDate.get(key) || null,
      });
    }
    // Month label: month of the Monday in this column.
    const monDate = new Date(startMon.getTime() + col * 7 * 86400000);
    const m = monDate.getUTCMonth();
    if (m !== lastMonth) {
      monthLabels.push({ col, label: MONTH_NAMES[m] });
      lastMonth = m;
    }
  }
  return { cells, monthLabels, startMon, todayUTC };
}

function Heatmap({ data }) {
  const [hover, setHover] = useState(null);  // { i, day, x, y, flip }
  const bodyRef = React.useRef(null);
  const { cells, monthLabels } = React.useMemo(() => buildCalendar(data), [data]);
  // Color scale over realized days only (zeros and empties don't move the max).
  const realized = data.filter((d) => d.pnl);
  const max = Math.max(...realized.map((d) => Math.abs(d.pnl)), 1);
  const colorFor = (v) => {
    if (!v) return "var(--surface-2)";
    const intensity = Math.min(1, Math.abs(v) / max);
    const alpha = 0.18 + intensity * 0.65;
    return v > 0
      ? `oklch(0.65 0.18 145 / ${alpha})`
      : `oklch(0.55 0.20 25 / ${alpha})`;
  };
  const total = data.reduce((s, d) => s + d.pnl, 0);
  const wins = data.reduce((s, d) => s + (d.wins || (d.pnl > 0 ? 1 : 0)), 0);
  const losses = data.reduce((s, d) => s + (d.losses || (d.pnl < 0 ? 1 : 0)), 0);
  const fmt$ = (v) => (v >= 0 ? "+$" : "−$") + Math.abs(v).toLocaleString("en-US", { maximumFractionDigits: 0 });
  return (
    <div className="card">
      <div className="card-head">
        <h3>Realized P&L · last 3 months</h3>
        <div className="row" style={{ gap: 14, fontFamily: "var(--mono)", fontSize: 11 }}>
          <span className={total >= 0 ? "up" : "down"}>{fmt$(total)}</span>
          <span style={{ color: "var(--muted)" }}>{wins}W / {losses}L</span>
          <span className="row" style={{ gap: 4, color: "var(--muted)", fontSize: 10 }}>
            <span>−</span>
            {[-1, -0.5, 0, 0.5, 1].map((v, i) => (
              <i key={i} style={{ width: 10, height: 10, borderRadius: 2, background: colorFor(v * max), display: "inline-block" }} />
            ))}
            <span>+</span>
          </span>
        </div>
      </div>
      <div className="card-body" style={{ position: "relative" }} ref={bodyRef}>
        <div className="calendar">
          <div className="cal-months" style={{ gridTemplateColumns: `repeat(${CAL_WEEKS}, var(--cal-cell))` }}>
            {monthLabels.map((m) => (
              <span key={m.col} className="cal-month-label" style={{ gridColumnStart: m.col + 1 }}>{m.label}</span>
            ))}
          </div>
          <div className="cal-body">
            <div className="cal-weekdays">
              {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((d, i) => (
                <span key={d} className="cal-weekday" style={{ visibility: i % 2 === 0 ? "visible" : "hidden" }}>{d.slice(0,1)}</span>
              ))}
            </div>
            <div className="heatmap" style={{ gridTemplateColumns: `repeat(${CAL_WEEKS}, var(--cal-cell))` }}>
              {cells.map((c, i) => {
                if (c.future) return <div key={i} className="cell future" />;
                const bg = c.day ? colorFor(c.day.pnl) : "var(--surface-2)";
                return (
                  <div
                    key={i}
                    className={`cell${c.weekend ? " weekend" : ""}${c.day ? " has-trades" : ""}`}
                    style={{ background: bg }}
                    onMouseEnter={(e) => {
                      if (!c.day) return;
                      const rect = bodyRef.current.getBoundingClientRect();
                      const cell = e.currentTarget.getBoundingClientRect();
                      const TIP_W = 280;
                      const flip = (cell.right - rect.left) + TIP_W + 12 > rect.width;
                      setHover({ i, day: c.day, x: cell.left - rect.left + (flip ? -8 : cell.width + 8), y: cell.top - rect.top, flip });
                    }}
                    onMouseLeave={() => setHover((h) => (h && h.i === i ? null : h))}
                  />
                );
              })}
            </div>
          </div>
        </div>
        {hover && <RealizedDayTip day={hover.day} fmt$={fmt$} x={hover.x} y={hover.y} flip={hover.flip} />}
      </div>
    </div>
  );
}

function RealizedDayTip({ day, fmt$, x, y, flip }) {
  const dateStr = day.date
    ? new Date(day.date + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
    : new Date(day.t).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const trades = day.trades || [];
  const style = flip
    ? { right: `calc(100% - ${x}px)`, top: y }
    : { left: x, top: y };
  return (
    <div className="realized-tip" style={style}>
      <div className="realized-tip-head">
        <span className="mono">{dateStr}</span>
        <span className={`mono ${day.pnl >= 0 ? "up" : "down"}`}>{fmt$(day.pnl)}</span>
      </div>
      {trades.length === 0 ? (
        <div className="realized-tip-empty">no closed trades</div>
      ) : (
        <table className="realized-tip-table">
          <tbody>
            {trades.slice(0, 8).map((t, i) => (
              <tr key={i}>
                <td className="t">{t.ticker}</td>
                <td className="q mono">{t.qty}</td>
                <td className="px mono">{t.entry}→{t.exit}</td>
                <td className={`p mono ${t.pnl >= 0 ? "up" : "down"}`}>{fmt$(t.pnl)}</td>
              </tr>
            ))}
            {trades.length > 8 && (
              <tr><td colSpan="4" className="realized-tip-more">+{trades.length - 8} more</td></tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ============== Cascade tier badge (PRD 74 + PRD 82) ==============
// Annotates trade rows produced by the CATALYST_WATERFALL cascade strategy.
// Colour map: social → green, regulatory → deep teal, options_tech → amber,
// naive → grey. Regulatory (PRD 82) reads EDGAR Form-4 + 8-K signals.
function TierBadge({ tier }) {
  if (!tier) return null;
  const t = String(tier).toLowerCase();
  const map = {
    social:       { bg: "var(--pos)",    fg: "#0a0e14", label: "SOCIAL" },
    regulatory:   { bg: "#1e6b7a",       fg: "#e6f7fb", label: "REGULATORY" },
    options_tech: { bg: "var(--accent)", fg: "#0a0e14", label: "OPTIONS/TECH" },
    naive:        { bg: "var(--muted)",  fg: "#0a0e14", label: "NAIVE" },
  };
  const cfg = map[t] || { bg: "var(--muted)", fg: "#0a0e14", label: t.toUpperCase() };
  return (
    <span
      className="tier-badge"
      title={`waterfall tier: ${t}`}
      style={{
        display: "inline-block",
        padding: "1px 6px",
        marginRight: 6,
        borderRadius: 3,
        fontFamily: "var(--mono)",
        fontSize: 9.5,
        fontWeight: 600,
        letterSpacing: 0.4,
        background: cfg.bg,
        color: cfg.fg,
        verticalAlign: "middle",
      }}
    >{cfg.label}</span>
  );
}
window.TierBadge = TierBadge;

// ============== Trades table ==============
function TradesTable({ trades, bmcUrl }) {
  const [filter, setFilter] = useState("ALL");
  const [openTrade, setOpenTrade] = useState(null);
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
              <tr
                key={t.id}
                onClick={() => setOpenTrade(t)}
                style={{ cursor: "pointer" }}
                title="Click for provenance"
              >
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
                    <a className="tip-inline" href={bmcUrl} target="_blank" rel="noreferrer" title="Tip the trader" onClick={(e) => e.stopPropagation()}>☕ tip</a>
                  )}
                </td>
                <td className="dim">{t.source}</td>
                <td className="dim" style={{ fontSize: 10.5, maxWidth: 180 }}>
                  <TierBadge tier={t.tier} />
                  {t.note}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {openTrade && window.TradeProvenanceModal && (
        <window.TradeProvenanceModal trade={openTrade} onClose={() => setOpenTrade(null)} />
      )}
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
// Restored rich watchlist (was its own tab; now an inline review section, no
// tab/shell). Per-ticker active-signal cards — 30d mention sparkline, 14d
// sentiment bars, conviction meter, why-watching + trigger-to-enter — over
// window.WATCHLIST_DETAIL, followed by the rejected-signals table over
// window.PASSED_SIGNALS. The bare long-horizon catalyst table it briefly
// replaced is retired. Both globals are still emitted by snapshot.py
// (build_watchlist_detail / build_passed_signals).
function Watchlist({ detail, passed }) {
  const list = Array.isArray(detail) ? detail : (window.WATCHLIST_DETAIL || []);
  const rejected = Array.isArray(passed) ? passed : (window.PASSED_SIGNALS || []);
  return (
    <div id="watchlist" style={{ display: "grid", gap: 12 }}>
      <div className="card">
        <div className="card-head">
          <h3>Watchlist · {list.length} tracked</h3>
          <span className="mono" style={{ fontSize: 10, color: "var(--muted)" }}>conviction floor 0.65 to enter</span>
        </div>
        <div className="card-body tight">
          {list.length === 0 ? (
            <div className="dim" style={{ padding: "12px 4px", fontSize: 12 }}>No signals tracked right now.</div>
          ) : list.map((w) => {
            const series = Array.isArray(w.series) ? w.series : [];
            const sentSeries = Array.isArray(w.sentSeries) ? w.sentSeries : [];
            const max = Math.max(1, ...series);
            const sentMax = Math.max(1, ...sentSeries.map(Math.abs));
            const conv = w.conviction ?? 0;
            return (
              <div key={w.ticker} style={{ padding: 14, borderBottom: "1px solid var(--line)" }}>
                <div style={{ display: "grid", gridTemplateColumns: "120px 1fr 1fr auto", gap: 16, alignItems: "center" }}>
                  <div>
                    <div className="ticker mono" style={{ fontSize: 16, fontWeight: 600 }}>{w.ticker}</div>
                    {w.addedDays != null ? <div className="mono" style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>added {w.addedDays}d ago</div> : null}
                    <span className={`pill ${w.status === "WATCHING" ? "watching" : "passed"}`} style={{ marginTop: 6, display: "inline-flex" }}>{w.status}</span>
                  </div>
                  <div>
                    <div className="label" style={{ fontFamily: "var(--mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)", marginBottom: 4 }}>Mention volume · 30d</div>
                    <div style={{ display: "flex", gap: 1, height: 32, alignItems: "flex-end" }}>
                      {series.map((v, i) => <div key={i} style={{ flex: 1, height: `${(v/max)*100}%`, background: "var(--info)", opacity: 0.4 + (v/max)*0.6, borderRadius: "1px 1px 0 0" }} />)}
                    </div>
                    <div className="mono" style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>{w.mentions24h} mentions/24h</div>
                  </div>
                  <div>
                    <div className="label" style={{ fontFamily: "var(--mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)", marginBottom: 4 }}>Sentiment · 14d</div>
                    <div style={{ display: "flex", gap: 1, height: 32, alignItems: "center", position: "relative" }}>
                      <div style={{ position: "absolute", left: 0, right: 0, top: "50%", height: 1, background: "var(--line-2)" }} />
                      {sentSeries.map((v, i) => {
                        const h = (Math.abs(v) / sentMax) * 14;
                        return <div key={i} style={{ flex: 1, height: h, background: v >= 0 ? "var(--pos)" : "var(--neg)", marginTop: v >= 0 ? `${16 - h}px` : "16px", borderRadius: 1 }} />;
                      })}
                    </div>
                    <div className="mono" style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>current <span className={(w.sentiment ?? 0) >= 0 ? "up" : "down"}>{(w.sentiment ?? 0) >= 0 ? "+" : ""}{(w.sentiment ?? 0).toFixed(2)}</span></div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div className="mono" style={{ fontSize: 22, fontWeight: 600 }}>{(conv * 100).toFixed(0)}%</div>
                    <div className="mono" style={{ fontSize: 10, color: "var(--muted)" }}>conviction</div>
                    <div style={{ width: 80, height: 4, background: "var(--surface-2)", borderRadius: 2, marginTop: 6, marginLeft: "auto", overflow: "hidden" }}>
                      <div style={{ width: `${conv * 100}%`, height: "100%", background: conv >= 0.65 ? "var(--pos)" : "var(--warn)" }} />
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--line)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, fontSize: 12 }}>
                  <div><span className="dim mono" style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>Why watching</span><br /><span style={{ color: "var(--text-2)" }}>{w.reason}</span></div>
                  <div><span className="dim mono" style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>Trigger to enter</span><br /><span style={{ color: "var(--text-2)" }}>{w.triggerLevel}</span></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {rejected.length > 0 ? (
        <div className="card">
          <div className="card-head">
            <h3>Signals the engine rejected · with retroactive outcome</h3>
            <span className="mono" style={{ fontSize: 10, color: "var(--muted)" }}>{rejected.length} passed</span>
          </div>
          <div className="card-body tight">
            <table className="trades">
              <thead>
                <tr>
                  <th>Ticker</th>
                  <th>Date</th>
                  <th>Why rejected</th>
                  <th>Outcome</th>
                  <th className="num">P&L impact</th>
                </tr>
              </thead>
              <tbody>
                {rejected.map((p, i) => (
                  <tr key={`${p.ticker}:${p.date}:${i}`}>
                    <td className="ticker">{p.ticker}</td>
                    <td className="dim">{p.date}</td>
                    <td className="dim" style={{ maxWidth: 320 }}>{p.reason}</td>
                    <td className={String(p.outcome).startsWith("+") ? "up" : "down"}>{p.outcome}</td>
                    <td className={`num ${String(p.outcomePnl).startsWith("missed") ? "down" : "up"}`} style={{ fontSize: 11 }}>{p.outcomePnl}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// Current positions — the FULL open book from Alpaca (source of truth), so the
// whole book shows, not just catalyst-linked tickers. Reads window.POSITIONS.
function CurrentPositions({ positions }) {
  const rows = Array.isArray(positions) ? positions : [];
  const fmt$ = (v) => (v >= 0 ? "+$" : "−$") + Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const totalMv = rows.reduce((a, r) => a + (r.marketValue || 0), 0);
  const totalPl = rows.reduce((a, r) => a + (r.unrealizedPl || 0), 0);
  const [expanded, setExpanded] = React.useState({});
  const toggle = (ticker) => setExpanded((s) => ({ ...s, [ticker]: !s[ticker] }));
  return (
    <div className="card" id="positions">
      <div className="card-head">
        <h3>Current Positions · {rows.length} open</h3>
        <span className="mono" style={{ fontSize: 10, color: "var(--muted)" }}>
          MV ${totalMv.toLocaleString("en-US", { maximumFractionDigits: 0 })} · <span className={totalPl >= 0 ? "up" : "down"}>{fmt$(totalPl)}</span> unrealized
        </span>
      </div>
      <div className="card-body tight" style={{ maxHeight: 520, overflowY: "auto" }}>
        {rows.length === 0 ? (
          <div className="dim" style={{ padding: "12px 4px", fontSize: 12 }}>No open positions.</div>
        ) : (
        <table className="trades">
          <thead>
            <tr>
              <th>Ticker</th>
              <th>Side</th>
              <th className="num">Qty</th>
              <th className="num">Avg Entry</th>
              <th className="num">Last</th>
              <th className="num">Mkt Value</th>
              <th className="num">Unrealized</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <React.Fragment key={p.ticker}>
                <tr
                  onClick={() => (p.rationale || p.exit_intent) ? toggle(p.ticker) : null}
                  style={(p.rationale || p.exit_intent) ? { cursor: "pointer" } : {}}
                >
                  <td className="ticker">
                    {p.ticker}
                    {window.TierBadge && <TierBadge tier={p.tier} />}
                    {(p.rationale || p.exit_intent) && (
                      <span style={{ marginLeft: 4, fontSize: 9, color: "var(--muted)", opacity: 0.7 }}>
                        {expanded[p.ticker] ? "▲" : "▼"}
                      </span>
                    )}
                  </td>
                  <td><span className={`pill ${p.side === "LONG" ? "long" : "short"}`}>{p.side}</span></td>
                  <td className="num dim">{p.qty}</td>
                  <td className="num">{(p.avgEntry || 0).toFixed(2)}</td>
                  <td className="num">{(p.currentPrice || 0).toFixed(2)}</td>
                  <td className="num dim">${Math.abs(p.marketValue || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}</td>
                  <td className={`num ${p.unrealizedPl >= 0 ? "up" : "down"}`}>
                    {fmt$(p.unrealizedPl || 0)}
                    <div className="sub-cell" style={{ color: p.unrealizedPl >= 0 ? "var(--pos)" : "var(--neg)", opacity: 0.7 }}>{p.unrealizedPlPct >= 0 ? "+" : ""}{(p.unrealizedPlPct || 0).toFixed(1)}%</div>
                  </td>
                </tr>
                {expanded[p.ticker] && (p.rationale || p.exit_intent) && (
                  <tr>
                    <td colSpan={7} style={{ padding: "4px 8px 8px 28px", background: "var(--surface2, #1a1a2e)" }}>
                      {p.rationale && (
                        <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 3 }}>
                          <span style={{ color: "var(--text)", fontWeight: 600 }}>why: </span>{p.rationale}
                        </div>
                      )}
                      {p.exit_intent && (
                        <div style={{ fontSize: 11, color: "var(--muted)" }}>
                          <span style={{ color: "var(--text)", fontWeight: 600 }}>exit: </span>{p.exit_intent}
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
        )}
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
  Sparkline, DualSparkline, StatusBar, Header,
  Hero, HeroLegacy, HeroAlpacaVsSpy, PerStrategyAttribution,
  StatStrip, EquityChart, Heatmap, TradesTable, TierBadge,
  SubredditPanel, TrendingTickers, Themes, Watchlist, CurrentPositions,
  Methodology, FooterCTA,
});
