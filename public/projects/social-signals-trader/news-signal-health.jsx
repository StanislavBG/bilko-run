/* global React */

const EMPTY_NEWS_SIGNAL_HEALTH = {
  asOf: null,
  counts24h: { clear: 0, blockEntry: 0, exitNow: 0, total: 0 },
  recentFlagged: [],
  byTicker: {},
};

function _fmtClock(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toISOString().replace("T", " ").slice(0, 19) + "Z";
  } catch (_) { return iso; }
}

function ClassificationChip({ classification }) {
  // exit_now = red (force-exit), block_entry = warn (caution), clear = muted (informational).
  const cls = classification || "";
  const color =
    cls === "exit_now" ? "var(--neg)" :
    cls === "block_entry" ? "var(--warn)" :
    "var(--muted)";
  return (
    <span style={{
      display: "inline-block", padding: "1px 6px", borderRadius: 3,
      fontSize: 10, fontFamily: "var(--mono)", fontWeight: 600,
      letterSpacing: "0.07em", border: `1px solid ${color}`, color,
      textTransform: "uppercase",
    }}>{cls.replace(/_/g, " ") || "—"}</span>
  );
}

function RecentFlaggedTable({ rows }) {
  if (!rows || !rows.length) {
    return (
      <p style={{ color: "var(--muted)", fontFamily: "var(--mono)", fontSize: 13, margin: 0, padding: 12 }}>
        No flagged headlines in the recent scan window.
      </p>
    );
  }
  return (
    <table className="trades" style={{ width: "100%" }}>
      <thead>
        <tr>
          <th>Scanned at</th>
          <th>Ticker</th>
          <th>Classification</th>
          <th>Top headline</th>
          <th>Keywords</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={`${r.ts}-${r.ticker}-${i}`}>
            <td className="dim" style={{ fontFamily: "var(--mono)", fontSize: 11 }}>{_fmtClock(r.ts)}</td>
            <td className="ticker">{r.ticker || "—"}</td>
            <td><ClassificationChip classification={r.classification} /></td>
            <td style={{ fontSize: 12, color: "var(--text-2)" }}>{r.topHeadline || "—"}</td>
            <td style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--muted)" }}>
              {(r.keywords || []).join(", ") || "—"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function NewsSignalHealthPanel() {
  const raw = window.NEWS_SIGNAL_HEALTH || EMPTY_NEWS_SIGNAL_HEALTH;
  const counts = raw.counts24h || EMPTY_NEWS_SIGNAL_HEALTH.counts24h;
  const flagged = raw.recentFlagged || [];
  const byTicker = raw.byTicker || {};

  return (
    <div>
      <div style={{ marginBottom: 10, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
        <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-2)" }}>
          {counts.total} scan{counts.total === 1 ? "" : "s"} 24h
          <span style={{ color: "var(--muted)" }}> · </span>
          <span style={{ color: "var(--muted)" }}>{counts.clear} clear</span>
          <span style={{ color: "var(--muted)" }}> · </span>
          <span style={{ color: "var(--warn)" }}>{counts.blockEntry} block_entry</span>
          <span style={{ color: "var(--muted)" }}> · </span>
          <span style={{ color: "var(--neg)" }}>{counts.exitNow} exit_now</span>
        </span>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {Object.entries(byTicker).map(([k, v]) => (
            <span key={`nt-${k}`} style={{
              fontFamily: "var(--mono)", fontSize: 10, color: "var(--accent)",
              border: "1px solid var(--accent)", padding: "1px 6px", borderRadius: 3,
              letterSpacing: "0.06em",
            }}>{k} b{v.blockEntry}/x{v.exitNow}</span>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h3 style={{ margin: 0, fontSize: 14 }}>Recent flagged headlines</h3></div>
        <div className="card-body tight" style={{ padding: 0 }}>
          <RecentFlaggedTable rows={flagged} />
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { NewsSignalHealthPanel, RecentFlaggedTable, ClassificationChip });
