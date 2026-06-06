/* global React */

const EMPTY_SIGNAL_DEDUP = {
  recentBlocks: [],
  activeWindows: [],
  counts: { recentBlocks24h: 0, byStrategy: {}, byTicker: {} },
};

function _fmtSeconds(s) {
  if (s == null) return "—";
  const n = Math.max(0, Number(s) || 0);
  if (n < 60) return `${n}s`;
  if (n < 3600) return `${Math.floor(n / 60)}m`;
  return `${Math.floor(n / 3600)}h ${Math.floor((n % 3600) / 60)}m`;
}

function _fmtClock(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toISOString().replace("T", " ").slice(0, 19) + "Z";
  } catch (_) { return iso; }
}

function DirectionChip({ direction }) {
  const dir = (direction || "").toLowerCase();
  const color = dir === "short" ? "var(--neg)" : dir === "long" ? "var(--pos)" : "var(--muted)";
  return (
    <span style={{
      fontFamily: "var(--mono)", fontSize: 10, fontWeight: 600,
      letterSpacing: "0.07em", color, textTransform: "uppercase",
    }}>{dir || "—"}</span>
  );
}

function RecentBlocksTable({ rows }) {
  if (!rows || !rows.length) {
    return (
      <p style={{ color: "var(--muted)", fontFamily: "var(--mono)", fontSize: 13, margin: 0, padding: 12 }}>
        No dedup blocks in the recent audit window.
      </p>
    );
  }
  return (
    <table className="trades" style={{ width: "100%" }}>
      <thead>
        <tr>
          <th>Blocked at</th>
          <th>Strategy</th>
          <th>Ticker</th>
          <th>Direction</th>
          <th className="num">Since original fire</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((b, i) => (
          <tr key={`${b.ts}-${b.strategyId}-${b.ticker}-${i}`}>
            <td className="dim" style={{ fontFamily: "var(--mono)", fontSize: 11 }}>{_fmtClock(b.ts)}</td>
            <td style={{ fontFamily: "var(--mono)", fontSize: 11 }}>{b.strategyId || "—"}</td>
            <td className="ticker">{b.ticker || "—"}</td>
            <td><DirectionChip direction={b.direction} /></td>
            <td className="num dim" style={{ fontFamily: "var(--mono)", fontSize: 11 }}>
              {_fmtSeconds(b.secondsSinceOriginal)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ActiveWindowsTable({ rows }) {
  if (!rows || !rows.length) {
    return (
      <p style={{ color: "var(--muted)", fontFamily: "var(--mono)", fontSize: 13, margin: 0, padding: 12 }}>
        No live dedup windows.
      </p>
    );
  }
  return (
    <table className="trades" style={{ width: "100%" }}>
      <thead>
        <tr>
          <th>Strategy</th>
          <th>Ticker</th>
          <th>Direction</th>
          <th>Last fire</th>
          <th>Expires at</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((w, i) => (
          <tr key={`${w.strategyId}-${w.ticker}-${w.direction}-${i}`}>
            <td style={{ fontFamily: "var(--mono)", fontSize: 11 }}>{w.strategyId || "—"}</td>
            <td className="ticker">{w.ticker || "—"}</td>
            <td><DirectionChip direction={w.direction} /></td>
            <td className="dim" style={{ fontFamily: "var(--mono)", fontSize: 11 }}>{_fmtClock(w.lastFireTs)}</td>
            <td className="dim" style={{ fontFamily: "var(--mono)", fontSize: 11 }}>{_fmtClock(w.expiresAt)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SignalDedupPanel() {
  const raw = window.SIGNAL_DEDUP || EMPTY_SIGNAL_DEDUP;
  const blocks = raw.recentBlocks || [];
  const active = raw.activeWindows || [];
  const counts = raw.counts || EMPTY_SIGNAL_DEDUP.counts;
  const byStrat = counts.byStrategy || {};
  const byTick = counts.byTicker || {};

  return (
    <div>
      <div style={{ marginBottom: 10, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
        <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-2)" }}>
          {counts.recentBlocks24h || 0} block{counts.recentBlocks24h === 1 ? "" : "s"} in last 24h
          <span style={{ color: "var(--muted)" }}> · {active.length} active window{active.length === 1 ? "" : "s"}</span>
        </span>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {Object.entries(byStrat).map(([k, v]) => (
            <span key={`s-${k}`} style={{
              fontFamily: "var(--mono)", fontSize: 10, color: "var(--muted)",
              border: "1px solid var(--line)", padding: "1px 6px", borderRadius: 3,
              letterSpacing: "0.06em",
            }}>{k} {v}</span>
          ))}
          {Object.entries(byTick).map(([k, v]) => (
            <span key={`t-${k}`} style={{
              fontFamily: "var(--mono)", fontSize: 10, color: "var(--accent)",
              border: "1px solid var(--accent)", padding: "1px 6px", borderRadius: 3,
              letterSpacing: "0.06em",
            }}>{k} {v}</span>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-head"><h3 style={{ margin: 0, fontSize: 14 }}>Recent dedup blocks</h3></div>
        <div className="card-body tight" style={{ padding: 0 }}>
          <RecentBlocksTable rows={blocks} />
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h3 style={{ margin: 0, fontSize: 14 }}>Active dedup windows</h3></div>
        <div className="card-body tight" style={{ padding: 0 }}>
          <ActiveWindowsTable rows={active} />
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { SignalDedupPanel, RecentBlocksTable, ActiveWindowsTable });
