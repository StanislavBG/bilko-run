/* global React */

const EMPTY_CATALYST_WINDOW = {
  withinDays: 7,
  asOf: null,
  entries: [],
  grouped: {},
  counts: { total: 0, byCatalyst: {} },
};

function CatalystChip({ catalyst }) {
  const label = (catalyst || "").replace(/_/g, " ").toUpperCase();
  return (
    <span style={{
      display: "inline-block",
      padding: "1px 6px",
      borderRadius: 3,
      fontSize: 10,
      fontFamily: "var(--mono)",
      fontWeight: 600,
      letterSpacing: "0.07em",
      border: "1px solid var(--accent)",
      color: "var(--accent)",
    }}>{label}</span>
  );
}

function CatalystRow({ entry }) {
  return (
    <tr>
      <td style={{ fontFamily: "var(--mono)", fontSize: 12, fontWeight: 600 }}>
        {entry.ticker || <span className="dim">—</span>}
      </td>
      <td><CatalystChip catalyst={entry.catalyst} /></td>
      <td style={{ fontSize: 12, color: "var(--text-2)" }}>{entry.subject || "—"}</td>
      <td style={{ fontFamily: "var(--mono)", fontSize: 11 }}>
        {entry.confirmed ? (
          <span style={{ color: "var(--pos)" }}>confirmed</span>
        ) : (
          <span style={{ color: "var(--warn)" }}>unconfirmed</span>
        )}
      </td>
      <td style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--muted)" }}>
        {entry.source || ""}
      </td>
    </tr>
  );
}

function CatalystDateGroup({ date, entries }) {
  const daysAway = entries[0] && entries[0].daysAway != null ? entries[0].daysAway : null;
  const countdown = daysAway == null ? "" : daysAway === 0 ? "today" : `T-${daysAway}d`;
  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div className="card-head" style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <h3 style={{ margin: 0, fontSize: 14 }}>
          <span style={{ fontFamily: "var(--mono)" }}>{date}</span>
          {countdown && (
            <span style={{ marginLeft: 8, fontSize: 11, fontFamily: "var(--mono)", color: "var(--warn)" }}>
              {countdown}
            </span>
          )}
        </h3>
        <span style={{ marginLeft: "auto", fontFamily: "var(--mono)", fontSize: 10, color: "var(--muted)" }}>
          {entries.length} {entries.length === 1 ? "catalyst" : "catalysts"}
        </span>
      </div>
      <div className="card-body tight" style={{ padding: 0 }}>
        <table className="trades" style={{ width: "100%" }}>
          <thead>
            <tr>
              <th>Ticker</th>
              <th>Catalyst</th>
              <th>Subject</th>
              <th>Status</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e, i) => (
              <CatalystRow key={`${e.ticker}-${e.catalyst}-${i}`} entry={e} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CatalystWindowPanel() {
  const raw = window.CATALYST_WINDOW || EMPTY_CATALYST_WINDOW;
  const counts = raw.counts || EMPTY_CATALYST_WINDOW.counts;
  const grouped = raw.grouped || {};
  const dates = Object.keys(grouped).sort();

  if (!counts.total) {
    return (
      <p style={{ color: "var(--muted)", fontFamily: "var(--mono)", fontSize: 13 }}>
        No catalysts in window{raw.withinDays ? ` (next ${raw.withinDays}d)` : ""}.
      </p>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 10, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
        <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-2)" }}>
          {counts.total} catalyst{counts.total === 1 ? "" : "s"} in next {raw.withinDays}d
          {raw.asOf && <span style={{ color: "var(--muted)" }}> · as of {raw.asOf}</span>}
        </span>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {Object.entries(counts.byCatalyst || {}).map(([k, v]) => (
            <span key={k} style={{
              fontFamily: "var(--mono)", fontSize: 10, color: "var(--muted)",
              border: "1px solid var(--line)", padding: "1px 6px", borderRadius: 3,
              textTransform: "uppercase", letterSpacing: "0.06em",
            }}>{k.replace(/_/g, " ")} {v}</span>
          ))}
        </div>
      </div>
      {dates.map((date) => (
        <CatalystDateGroup key={date} date={date} entries={grouped[date]} />
      ))}
    </div>
  );
}

Object.assign(window, { CatalystWindowPanel, CatalystDateGroup, CatalystRow });
