/* global React */
// D4 — <StrategyComparisonPanel>: head-to-head between two strategies.
// Reads:
//   - window.STRATEGIES (rows with id/name/sharpe/winRate/trades/ytdPct/dd)
//   - window.STRATEGY_EQUITY_SERIES ({sid: [{t, equity}, ...]}) for overlay
//   - window.TRADES (used to derive avg hold days per strategy)

const _COMPARE_COLORS = ["oklch(0.78 0.18 25)", "oklch(0.78 0.16 145)"];

function _holdDays(opened, closed) {
  if (!opened || !closed) return null;
  const a = new Date(opened).getTime();
  const b = new Date(closed).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  const d = (b - a) / 86400000;
  return d >= 0 ? d : null;
}

function _avgHoldFor(trades, sid) {
  const xs = [];
  for (const t of trades || []) {
    if (!t || t.status !== "CLOSED") continue;
    const stratHere = t.strategy || null;
    if (stratHere !== sid) continue;
    const h = _holdDays(t.opened, t.closed);
    if (h != null) xs.push(h);
  }
  if (xs.length === 0) return null;
  return xs.reduce((s, v) => s + v, 0) / xs.length;
}

function _stat({ label, a, b, fmt, deltaFmt, betterIs }) {
  const fa = a == null ? "—" : (fmt ? fmt(a) : String(a));
  const fb = b == null ? "—" : (fmt ? fmt(b) : String(b));
  let delta = "—";
  let deltaTone = "";
  if (typeof a === "number" && typeof b === "number") {
    const d = a - b;
    const better = betterIs === "lower" ? d < 0 : d > 0;
    if (d === 0) {
      delta = "0";
    } else {
      delta = deltaFmt ? deltaFmt(d) : (d > 0 ? `+${d.toFixed(2)}` : d.toFixed(2));
      deltaTone = better ? "up" : "down";
    }
  }
  return { label, fa, fb, delta, deltaTone };
}

function StrategyComparisonPanel({ defaultA, defaultB }) {
  const strategies = Array.isArray(window.STRATEGIES) ? window.STRATEGIES : [];
  const equitySeries = (window.STRATEGY_EQUITY_SERIES || {});
  const trades = Array.isArray(window.TRADES) ? window.TRADES : [];

  if (strategies.length < 2) {
    return (
      <div className="card" style={{ padding: 12 }}>
        <p style={{ color: "var(--muted)", fontFamily: "var(--mono)", fontSize: 13, margin: 0 }}>
          Need at least 2 strategies to compare.
        </p>
      </div>
    );
  }

  const initialA = defaultA && strategies.find((s) => s.id === defaultA)
    ? defaultA : strategies[0].id;
  const initialBPick = strategies.find((s) => s.id !== initialA);
  const initialB = defaultB && strategies.find((s) => s.id === defaultB) && defaultB !== initialA
    ? defaultB : (initialBPick ? initialBPick.id : strategies[1].id);

  const [aId, setAId] = React.useState(initialA);
  const [bId, setBId] = React.useState(initialB);

  const a = strategies.find((s) => s.id === aId) || strategies[0];
  const b = strategies.find((s) => s.id === bId) || strategies[1];

  const seriesA = Array.isArray(equitySeries[a.id]) ? equitySeries[a.id] : [];
  const seriesB = Array.isArray(equitySeries[b.id]) ? equitySeries[b.id] : [];

  const holdA = _avgHoldFor(trades, a.id);
  const holdB = _avgHoldFor(trades, b.id);

  const stats = [
    _stat({ label: "YTD return", a: a.ytdPct, b: b.ytdPct, fmt: (v) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`, deltaFmt: (d) => `${d >= 0 ? "+" : ""}${d.toFixed(1)} pts` }),
    _stat({ label: "Sharpe", a: a.sharpe, b: b.sharpe, fmt: (v) => v.toFixed(2), deltaFmt: (d) => `${d >= 0 ? "+" : ""}${d.toFixed(2)}` }),
    _stat({ label: "Win rate", a: a.winRate, b: b.winRate, fmt: (v) => `${(v * 100).toFixed(0)}%`, deltaFmt: (d) => `${d >= 0 ? "+" : ""}${(d * 100).toFixed(0)} pp` }),
    _stat({ label: "Trades", a: a.trades, b: b.trades, fmt: (v) => String(v), deltaFmt: (d) => `${d >= 0 ? "+" : ""}${d}` }),
    _stat({ label: "Max DD", a: a.dd, b: b.dd, fmt: (v) => `${v.toFixed(1)}%`, deltaFmt: (d) => `${d >= 0 ? "+" : ""}${d.toFixed(1)} pts`, betterIs: "lower" }),
    _stat({ label: "Avg hold (d)", a: holdA, b: holdB, fmt: (v) => v.toFixed(1), deltaFmt: (d) => `${d >= 0 ? "+" : ""}${d.toFixed(1)}d` }),
  ];

  // Equity overlay — normalize each series so both start at 100.
  const W = 640, H = 200, PAD_L = 44, PAD_R = 12, PAD_T = 12, PAD_B = 22;
  const norm = (s) => {
    if (!s || s.length === 0) return [];
    const base = s[0].equity || 1;
    return s.map((p) => (p.equity / base) * 100);
  };
  const nA = norm(seriesA);
  const nB = norm(seriesB);
  const allVals = nA.concat(nB);
  const hasData = allVals.length > 0;
  const minV = hasData ? Math.min(100, ...allVals) * 0.99 : 95;
  const maxV = hasData ? Math.max(100, ...allVals) * 1.01 : 105;
  const range = (maxV - minV) || 1;
  const lenA = Math.max(nA.length, 1);
  const lenB = Math.max(nB.length, 1);
  const longest = Math.max(lenA, lenB);
  const xFor = (i, total) => {
    const denom = Math.max(longest - 1, 1);
    const proportion = total <= 1 ? 1 : i / (total - 1) * ((total - 1) / denom);
    return PAD_L + proportion * (W - PAD_L - PAD_R);
  };
  const yFor = (v) => PAD_T + ((maxV - v) / range) * (H - PAD_T - PAD_B);
  const linePts = (arr) => arr.map((v, i) => `${xFor(i, arr.length)},${yFor(v)}`).join(" ");

  const _select = (current, onChange, otherId, key) => (
    <select
      key={key}
      value={current}
      onChange={(e) => onChange(e.target.value)}
      className="mono"
      style={{
        background: "var(--surface-2)",
        color: "var(--text)",
        border: "1px solid var(--line)",
        borderRadius: 3,
        padding: "3px 6px",
        fontFamily: "var(--mono)",
        fontSize: 11,
      }}
    >
      {strategies.map((s) => (
        <option key={s.id} value={s.id} disabled={s.id === otherId}>
          {s.id} · {s.name}
        </option>
      ))}
    </select>
  );

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div className="card-head">
        <h3>Head-to-head</h3>
        <span className="mono" style={{ fontSize: 10, color: "var(--muted)" }}>
          equity overlay normalized to 100 at first close
        </span>
      </div>
      <div className="card-body">
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <i style={{ width: 8, height: 8, background: _COMPARE_COLORS[0], borderRadius: 2 }} />
            <span className="label" style={{ fontFamily: "var(--mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)" }}>A</span>
            {_select(aId, setAId, bId, "selA")}
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <i style={{ width: 8, height: 8, background: _COMPARE_COLORS[1], borderRadius: 2 }} />
            <span className="label" style={{ fontFamily: "var(--mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)" }}>B</span>
            {_select(bId, setBId, aId, "selB")}
          </span>
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
            {nA.length > 0 && (
              <polyline points={linePts(nA)} fill="none" stroke={_COMPARE_COLORS[0]} strokeWidth="1.8" strokeLinejoin="round" />
            )}
            {nB.length > 0 && (
              <polyline points={linePts(nB)} fill="none" stroke={_COMPARE_COLORS[1]} strokeWidth="1.8" strokeLinejoin="round" />
            )}
            {!hasData && (
              <text x={W / 2} y={H / 2} fill="var(--muted)" fontSize="11" textAnchor="middle" fontFamily="var(--mono)">
                no closed-trade equity series for either strategy yet
              </text>
            )}
          </svg>
        </div>

        <table className="trades">
          <thead>
            <tr>
              <th>Metric</th>
              <th className="num" style={{ color: _COMPARE_COLORS[0] }}>{a.id}</th>
              <th className="num" style={{ color: _COMPARE_COLORS[1] }}>{b.id}</th>
              <th className="num">A − B</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((row) => (
              <tr key={row.label}>
                <td className="dim">{row.label}</td>
                <td className="num">{row.fa}</td>
                <td className="num">{row.fb}</td>
                <td className={`num ${row.deltaTone}`}>{row.delta}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

Object.assign(window, { StrategyComparisonPanel });
