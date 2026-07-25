/* global React */
// G4 — <SubredditAlphaAttribution>: per-subreddit alpha attribution panel.
// For each subreddit, shows total realized P&L, win rate, avg hold, Sharpe,
// over a 30d / 90d window toggle. Reads window.SUB_ATTRIBUTION (built by
// aggregations.build_sub_attribution from data/per_sub_outcomes.jsonl).
//
// Renders on the Reddit Intel page so the reader can see, at a glance,
// which subreddit is generating real P&L vs. just noise.

const _SAA_WINDOWS = ["30", "90"];

function _saaFmtUsd(v) {
  if (typeof v !== "number" || !Number.isFinite(v)) return "—";
  const sign = v >= 0 ? "+" : "−";
  const abs = Math.abs(v);
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(1)}k`;
  return `${sign}$${abs.toFixed(0)}`;
}

function _saaFmtPct(v) {
  if (typeof v !== "number" || !Number.isFinite(v)) return "—";
  return `${(v * 100).toFixed(0)}%`;
}

function _saaFmtSharpe(v) {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toFixed(2);
}

function _saaFmtHold(v) {
  if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) return "—";
  return `${v.toFixed(1)}d`;
}

function _saaPnlTone(v) {
  if (typeof v !== "number" || !Number.isFinite(v)) return "";
  if (v > 0) return "up";
  if (v < 0) return "down";
  return "";
}

function SubredditAlphaAttribution() {
  const data = (window.SUB_ATTRIBUTION && typeof window.SUB_ATTRIBUTION === "object")
    ? window.SUB_ATTRIBUTION : null;
  const [windowKey, setWindowKey] = React.useState("30");

  const byWindow = (data && data.by_window) || {};
  const rows = Array.isArray(byWindow[windowKey]) ? byWindow[windowKey] : [];

  if (!data || rows.length === 0) {
    return (
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-head">
          <h3>Subreddit alpha attribution</h3>
          <span className="mono" style={{ fontSize: 10, color: "var(--muted)" }}>
            which subreddit is paying for itself?
          </span>
        </div>
        <div className="card-body">
          <p className="mono" style={{ margin: 0, color: "var(--muted)", fontSize: 12 }}>
            No per-subreddit attribution rows yet — `per_sub_outcomes.jsonl` is empty
            or the snapshot has not run since theses started entering positions.
          </p>
        </div>
      </div>
    );
  }

  // The aggregation already sorts by total_pnl_usd desc. Hoist a small
  // summary line for the page reader: best/worst sub and total realized.
  const sumRealized = rows.reduce((s, r) => s + (Number(r.realized_pnl_usd) || 0), 0);
  const sumExits = rows.reduce((s, r) => s + (Number(r.n_exits) || 0), 0);
  const best = rows[0];
  const worst = rows[rows.length - 1];
  const computedAt = data.computed_at ? new Date(data.computed_at) : null;

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div className="card-head">
        <h3>Subreddit alpha attribution · {windowKey}d</h3>
        <div className="row" style={{ gap: 6, alignItems: "center" }}>
          <span className="mono" style={{ fontSize: 10, color: "var(--muted)", marginRight: 8 }}>
            which subreddit is paying for itself?
          </span>
          {_SAA_WINDOWS.map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => setWindowKey(w)}
              className="mono"
              style={{
                padding: "2px 8px",
                fontSize: 11,
                background: w === windowKey ? "var(--accent)" : "var(--surface-2)",
                color: w === windowKey ? "var(--bg)" : "var(--text-2)",
                border: "1px solid var(--line)",
                borderRadius: 3,
                cursor: "pointer",
              }}
            >
              {w}d
            </button>
          ))}
        </div>
      </div>
      <div className="card-body tight">
        <div
          className="mono"
          style={{
            padding: "8px 12px",
            background: "var(--surface-2)",
            borderBottom: "1px solid var(--line)",
            fontSize: 11,
            color: "var(--text-2)",
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 12,
          }}
        >
          <span>
            <span style={{ color: "var(--muted)" }}>total realized&nbsp;</span>
            <span className={_saaPnlTone(sumRealized)}>{_saaFmtUsd(sumRealized)}</span>
            <span style={{ color: "var(--muted)" }}>&nbsp;· {sumExits} closed</span>
          </span>
          <span>
            <span style={{ color: "var(--muted)" }}>best&nbsp;</span>
            r/{best.subreddit}
            <span className={_saaPnlTone(best.total_pnl_usd)} style={{ marginLeft: 4 }}>
              {_saaFmtUsd(best.total_pnl_usd)}
            </span>
          </span>
          <span>
            <span style={{ color: "var(--muted)" }}>worst&nbsp;</span>
            r/{worst.subreddit}
            <span className={_saaPnlTone(worst.total_pnl_usd)} style={{ marginLeft: 4 }}>
              {_saaFmtUsd(worst.total_pnl_usd)}
            </span>
          </span>
        </div>
        <table className="trades">
          <thead>
            <tr>
              <th>Subreddit</th>
              <th className="num">Realized P&L</th>
              <th className="num">Win rate</th>
              <th className="num">Avg hold</th>
              <th className="num">Sharpe</th>
              <th className="num">Trades</th>
              <th className="num">Killed / deferred</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.subreddit}>
                <td className="ticker">r/{r.subreddit}</td>
                <td className={`num ${_saaPnlTone(r.realized_pnl_usd)}`}>
                  {_saaFmtUsd(r.realized_pnl_usd)}
                </td>
                <td className="num">{_saaFmtPct(r.win_rate)}</td>
                <td className="num">{_saaFmtHold(r.avg_hold_days)}</td>
                <td className="num">{_saaFmtSharpe(r.sharpe)}</td>
                <td className="num dim">
                  {r.n_exits || 0}<span style={{ color: "var(--muted)" }}> / {r.n_entries || 0}</span>
                </td>
                <td className="num dim">
                  {r.n_killed || 0}<span style={{ color: "var(--muted)" }}> / {r.n_deferred || 0}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {computedAt && (
          <div
            className="mono"
            style={{
              padding: "6px 12px",
              fontSize: 10,
              color: "var(--muted)",
              borderTop: "1px solid var(--line)",
            }}
          >
            attribution computed {computedAt.toISOString().slice(0, 19).replace("T", " ")}Z ·
            P&L split pro-rata by contributor confidence when multiple subreddits feed a thesis ·
            Sharpe is a 5d-return proxy, not portfolio Sharpe
          </div>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { SubredditAlphaAttribution });
