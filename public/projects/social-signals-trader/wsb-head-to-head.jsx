/* global React */
// G3 — <WSBHeadToHead>: pinned head-to-head between WSB_FADE (contrarian
// at extreme bull spikes) and WSB_EARN (event-driven earnings runs). Both
// are fed primarily by r/wallstreetbets — same subreddit, opposite
// mechanics. Renders the verdict: "which wins?"
//
// Reads:
//   - window.STRATEGIES (rows with id/name/sharpe/winRate/trades/ytdPct/dd)
//   - window.STRATEGY_EQUITY_SERIES ({sid: [{t, equity}, ...]})
//   - window.TRADES (filtered to the two strategies for hold + recent fill)

const _WSB_PAIR = ["WSB_FADE", "WSB_EARN"];
const _WSB_COLORS = {
  WSB_FADE: "oklch(0.66 0.10 280)",   // matches CONTRA palette
  WSB_EARN: "oklch(0.78 0.18 25)",    // matches WSB palette
};

function _wsbHold(opened, closed) {
  if (!opened || !closed) return null;
  const a = new Date(opened).getTime();
  const b = new Date(closed).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  const d = (b - a) / 86400000;
  return d >= 0 ? d : null;
}

function _wsbTradesFor(trades, sid) {
  return (trades || []).filter((t) => t && t.strategy === sid);
}

function _wsbAvgHold(trades, sid) {
  const xs = _wsbTradesFor(trades, sid)
    .filter((t) => t.status === "CLOSED")
    .map((t) => _wsbHold(t.opened, t.closed))
    .filter((v) => v != null);
  if (xs.length === 0) return null;
  return xs.reduce((s, v) => s + v, 0) / xs.length;
}

function _wsbVerdict(a, b) {
  // a, b are the strategy rows. Verdict picks the one with the better
  // YTD return when both have trades; otherwise reports the disparity.
  const aTrades = a && a.trades ? a.trades : 0;
  const bTrades = b && b.trades ? b.trades : 0;
  if (aTrades === 0 && bTrades === 0) {
    return { winner: null, line: "Both strategies are still warming up — no trades attributed yet." };
  }
  if (aTrades === 0) {
    return { winner: b.id, line: `${b.id} is live with ${bTrades} trades; ${a.id} has logged none yet.` };
  }
  if (bTrades === 0) {
    return { winner: a.id, line: `${a.id} is live with ${aTrades} trades; ${b.id} has logged none yet.` };
  }
  if (a.ytdPct === b.ytdPct) {
    return { winner: null, line: `Dead heat at ${a.ytdPct.toFixed(1)}% YTD apiece.` };
  }
  const w = a.ytdPct > b.ytdPct ? a : b;
  const l = a.ytdPct > b.ytdPct ? b : a;
  const delta = (w.ytdPct - l.ytdPct).toFixed(1);
  return {
    winner: w.id,
    line: `${w.id} leads by ${delta} pts YTD (${w.ytdPct.toFixed(1)}% vs ${l.ytdPct.toFixed(1)}%).`,
  };
}

function WSBHeadToHead() {
  const strategies = Array.isArray(window.STRATEGIES) ? window.STRATEGIES : [];
  const equitySeries = (window.STRATEGY_EQUITY_SERIES || {});
  const trades = Array.isArray(window.TRADES) ? window.TRADES : [];

  const fade = strategies.find((s) => s.id === "WSB_FADE");
  const earn = strategies.find((s) => s.id === "WSB_EARN");

  if (!fade || !earn) {
    return (
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-head">
          <h3>WSB_FADE vs WSB_EARN · same subreddit, opposite mechanics</h3>
        </div>
        <div className="card-body">
          <p className="mono" style={{ margin: 0, color: "var(--muted)", fontSize: 12 }}>
            Both strategies must be registered to render this head-to-head.
            {!fade && " WSB_FADE missing."}
            {!earn && " WSB_EARN missing."}
          </p>
        </div>
      </div>
    );
  }

  const fadeHold = _wsbAvgHold(trades, "WSB_FADE");
  const earnHold = _wsbAvgHold(trades, "WSB_EARN");
  const verdict = _wsbVerdict(fade, earn);

  const seriesFade = Array.isArray(equitySeries.WSB_FADE) ? equitySeries.WSB_FADE : [];
  const seriesEarn = Array.isArray(equitySeries.WSB_EARN) ? equitySeries.WSB_EARN : [];

  // Equity overlay: normalize to 100 at first close, align by index.
  const W = 720, H = 200, PAD_L = 44, PAD_R = 12, PAD_T = 12, PAD_B = 22;
  const norm = (s) => {
    if (!s || s.length === 0) return [];
    const base = s[0].equity || 1;
    return s.map((p) => (p.equity / base) * 100);
  };
  const nF = norm(seriesFade);
  const nE = norm(seriesEarn);
  const all = nF.concat(nE);
  const hasData = all.length > 0;
  const minV = hasData ? Math.min(100, ...all) * 0.99 : 95;
  const maxV = hasData ? Math.max(100, ...all) * 1.01 : 105;
  const range = (maxV - minV) || 1;
  const longest = Math.max(nF.length, nE.length, 1);
  const xFor = (i, total) => {
    const denom = Math.max(longest - 1, 1);
    const proportion = total <= 1 ? 1 : (i / (total - 1)) * ((total - 1) / denom);
    return PAD_L + proportion * (W - PAD_L - PAD_R);
  };
  const yFor = (v) => PAD_T + ((maxV - v) / range) * (H - PAD_T - PAD_B);
  const linePts = (arr) => arr.map((v, i) => `${xFor(i, arr.length)},${yFor(v)}`).join(" ");

  const rows = [
    { label: "YTD return",   f: fade.ytdPct,  e: earn.ytdPct,  fmt: (v) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`, delta: (d) => `${d >= 0 ? "+" : ""}${d.toFixed(1)} pts` },
    { label: "Sharpe",       f: fade.sharpe,  e: earn.sharpe,  fmt: (v) => v.toFixed(2),                           delta: (d) => `${d >= 0 ? "+" : ""}${d.toFixed(2)}` },
    { label: "Win rate",     f: fade.winRate, e: earn.winRate, fmt: (v) => `${(v * 100).toFixed(0)}%`,             delta: (d) => `${d >= 0 ? "+" : ""}${(d * 100).toFixed(0)} pp` },
    { label: "Trades",       f: fade.trades,  e: earn.trades,  fmt: (v) => String(v),                              delta: (d) => `${d >= 0 ? "+" : ""}${d}` },
    { label: "Max DD",       f: fade.dd,      e: earn.dd,      fmt: (v) => `${v.toFixed(1)}%`,                     delta: (d) => `${d >= 0 ? "+" : ""}${d.toFixed(1)} pts`, betterLow: true },
    { label: "Avg hold (d)", f: fadeHold,     e: earnHold,     fmt: (v) => v == null ? "—" : v.toFixed(1),         delta: (d) => `${d >= 0 ? "+" : ""}${d.toFixed(1)}d` },
  ];

  const fmtCell = (v, fmt) => (v == null ? "—" : fmt(v));
  const deltaCell = (f, e, fmt, betterLow) => {
    if (typeof f !== "number" || typeof e !== "number") return { txt: "—", tone: "" };
    const d = f - e;
    if (d === 0) return { txt: "0", tone: "" };
    const better = betterLow ? d < 0 : d > 0;
    return { txt: fmt(d), tone: better ? "up" : "down" };
  };

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div className="card-head">
        <h3>WSB_FADE vs WSB_EARN · same subreddit, opposite mechanics</h3>
        <span className="mono" style={{ fontSize: 10, color: "var(--muted)" }}>
          both fed by r/wallstreetbets · which mechanic wins?
        </span>
      </div>
      <div className="card-body">
        <div
          className="mono"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
            marginBottom: 12,
            fontSize: 12,
            color: "var(--text-2)",
            lineHeight: 1.6,
          }}
        >
          <div style={{ padding: 10, background: "var(--surface-2)", border: `1px solid ${_WSB_COLORS.WSB_FADE}33`, borderLeft: `3px solid ${_WSB_COLORS.WSB_FADE}`, borderRadius: 4 }}>
            <div style={{ fontWeight: 600, color: _WSB_COLORS.WSB_FADE, marginBottom: 4 }}>WSB_FADE · contrarian</div>
            Shorts when WSB attention crosses the 95th-percentile mention spike AND bull_share &gt; 0.85. Holds 5 trading days. Edge: −8.5% HPRs at peak attention (Wang et al., 2024).
          </div>
          <div style={{ padding: 10, background: "var(--surface-2)", border: `1px solid ${_WSB_COLORS.WSB_EARN}33`, borderLeft: `3px solid ${_WSB_COLORS.WSB_EARN}`, borderRadius: 4 }}>
            <div style={{ fontWeight: 600, color: _WSB_COLORS.WSB_EARN, marginBottom: 4 }}>WSB_EARN · event-driven</div>
            Longs WSB-discussed tickers into earnings. Enters T−7, exits T+1. Captures the pre-event attention bid and earnings drift on names the crowd is already watching.
          </div>
        </div>

        <div
          className="mono"
          style={{
            padding: "8px 12px",
            marginBottom: 12,
            background: verdict.winner ? `${_WSB_COLORS[verdict.winner]}1a` : "var(--surface-2)",
            border: `1px solid ${verdict.winner ? _WSB_COLORS[verdict.winner] : "var(--line)"}`,
            borderRadius: 4,
            fontSize: 12,
          }}
        >
          <span style={{ fontFamily: "var(--mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)", marginRight: 8 }}>verdict</span>
          {verdict.line}
        </div>

        <div className="chart-wrap" style={{ marginBottom: 14 }}>
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="200" style={{ display: "block" }}>
            {[minV, minV + range / 2, maxV].map((v, i) => (
              <g key={i}>
                <line x1={PAD_L} x2={W - PAD_R} y1={yFor(v)} y2={yFor(v)} stroke="var(--line)" strokeDasharray="2 4" />
                <text x={PAD_L - 6} y={yFor(v) + 3} fill="var(--muted)" fontSize="10" textAnchor="end" fontFamily="var(--mono)">
                  {(v - 100).toFixed(0)}%
                </text>
              </g>
            ))}
            <line x1={PAD_L} x2={W - PAD_R} y1={yFor(100)} y2={yFor(100)} stroke="var(--line-2)" strokeDasharray="3 3" />
            {nF.length > 0 && (
              <polyline points={linePts(nF)} fill="none" stroke={_WSB_COLORS.WSB_FADE} strokeWidth="1.8" strokeLinejoin="round" />
            )}
            {nE.length > 0 && (
              <polyline points={linePts(nE)} fill="none" stroke={_WSB_COLORS.WSB_EARN} strokeWidth="1.8" strokeLinejoin="round" />
            )}
            {!hasData && (
              <text x={W / 2} y={H / 2} fill="var(--muted)" fontSize="11" textAnchor="middle" fontFamily="var(--mono)">
                no closed-trade equity series for WSB_FADE or WSB_EARN yet
              </text>
            )}
          </svg>
        </div>

        <table className="trades">
          <thead>
            <tr>
              <th>Metric</th>
              <th className="num" style={{ color: _WSB_COLORS.WSB_FADE }}>WSB_FADE</th>
              <th className="num" style={{ color: _WSB_COLORS.WSB_EARN }}>WSB_EARN</th>
              <th className="num">FADE − EARN</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const d = deltaCell(r.f, r.e, r.delta, r.betterLow);
              return (
                <tr key={r.label}>
                  <td className="dim">{r.label}</td>
                  <td className="num">{fmtCell(r.f, r.fmt)}</td>
                  <td className="num">{fmtCell(r.e, r.fmt)}</td>
                  <td className={`num ${d.tone}`}>{d.txt}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

Object.assign(window, { WSBHeadToHead });
