/* global React */
// D2 — <TickReportFeed> JSX component.
// Renders window.AGENT_REPORTS (newest-first list of rows from
// data/agent_reports.jsonl, emitted by snapshot.py). One row per tick:
// timestamp, cost, summary; expandable for the full provenance payload.

const TICK_REPORT_HIDDEN_KEYS = new Set([
  "ts", "kind", "summary", "costUsd",
  "cost_usd", "cost", "usd", "usd_cost",
  "total_cost_usd", "cost_usd_estimate",
]);

function _fmtUsd(v) {
  if (v == null) return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  if (n === 0) return "$0";
  if (n < 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}

function _fmtTs(ts) {
  if (!ts) return "—";
  try {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return ts;
    // YYYY-MM-DD HH:MM local
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
      `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch (e) {
    return ts;
  }
}

function TickCountChip({ label, value, tone }) {
  if (value == null || value === 0) return null;
  const color =
    tone === "pos" ? "var(--pos)"
    : tone === "neg" ? "var(--neg)"
    : tone === "warn" ? "var(--warn)"
    : "var(--text-2)";
  return (
    <span
      style={{
        background: "var(--surface-2)",
        border: "1px solid var(--line)",
        padding: "1px 6px",
        borderRadius: 3,
        fontFamily: "var(--mono)",
        fontSize: 10,
        color,
        marginRight: 4,
      }}
    >
      {label}:{value}
    </span>
  );
}

function TickReportRow({ report }) {
  const [open, setOpen] = React.useState(false);
  const {
    ts, kind, summary, costUsd,
    detected, corroborated, entered, exited, killed,
    errors, notes,
  } = report || {};

  const hasErrors = Array.isArray(errors) && errors.length > 0;
  const kindColor =
    kind === "roadmap" ? "var(--accent)"
    : hasErrors ? "var(--neg)"
    : "var(--text-2)";

  // Extra fields beyond the known surface for the expanded view.
  const extras = {};
  for (const k of Object.keys(report || {})) {
    if (TICK_REPORT_HIDDEN_KEYS.has(k)) continue;
    extras[k] = report[k];
  }

  return (
    <div
      className="card"
      style={{
        marginBottom: 6,
        padding: "8px 10px",
        opacity: hasErrors ? 0.95 : 1,
        borderLeft: hasErrors ? "2px solid var(--neg)" : "2px solid var(--line)",
      }}
    >
      <div
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          cursor: "pointer",
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            fontFamily: "var(--mono)",
            fontSize: 11,
            color: "var(--text-2)",
            minWidth: 110,
          }}
        >
          {_fmtTs(ts)}
        </span>
        <span
          style={{
            fontFamily: "var(--mono)",
            fontSize: 9.5,
            color: kindColor,
            textTransform: "uppercase",
            letterSpacing: "0.07em",
            minWidth: 56,
          }}
        >
          {kind || "tick"}
        </span>
        <span
          style={{
            fontFamily: "var(--mono)",
            fontSize: 10.5,
            color: costUsd > 0 ? "var(--warn)" : "var(--muted)",
            minWidth: 56,
          }}
        >
          {_fmtUsd(costUsd)}
        </span>
        <div style={{ display: "flex", flexWrap: "wrap" }}>
          <TickCountChip label="det" value={detected} tone="pos" />
          <TickCountChip label="corr" value={corroborated} tone="pos" />
          <TickCountChip label="ent" value={entered} tone="pos" />
          <TickCountChip label="exit" value={exited} tone="warn" />
          <TickCountChip label="kill" value={killed} tone="neg" />
          {hasErrors && (
            <TickCountChip label="err" value={errors.length} tone="neg" />
          )}
        </div>
        <span
          style={{
            flex: "1 1 280px",
            fontFamily: "var(--mono)",
            fontSize: 11.5,
            color: "var(--text)",
            minWidth: 200,
          }}
        >
          {summary || <span className="dim">(no summary)</span>}
        </span>
        <span
          aria-hidden="true"
          style={{
            fontFamily: "var(--mono)",
            fontSize: 11,
            color: "var(--muted)",
          }}
        >
          {open ? "▾" : "▸"}
        </span>
      </div>

      {open && (
        <div
          style={{
            marginTop: 8,
            paddingTop: 8,
            borderTop: "1px dashed var(--line)",
          }}
        >
          {hasErrors && (
            <div style={{ marginBottom: 8 }}>
              <span
                className="label"
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 9.5,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "var(--neg)",
                }}
              >
                Errors
              </span>
              <ul
                style={{
                  margin: "4px 0 0",
                  paddingLeft: 18,
                  fontFamily: "var(--mono)",
                  fontSize: 11,
                  color: "var(--neg)",
                }}
              >
                {errors.map((e, i) => (
                  <li key={i}>{typeof e === "string" ? e : JSON.stringify(e)}</li>
                ))}
              </ul>
            </div>
          )}
          {notes && (
            <div style={{ marginBottom: 8 }}>
              <span
                className="label"
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 9.5,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "var(--muted)",
                }}
              >
                Notes
              </span>
              {Array.isArray(notes) ? (
                <ul
                  style={{
                    margin: "4px 0 0",
                    paddingLeft: 18,
                    fontFamily: "var(--mono)",
                    fontSize: 11,
                    color: "var(--text-2)",
                  }}
                >
                  {notes.map((n, i) => (
                    <li key={i}>{typeof n === "string" ? n : JSON.stringify(n)}</li>
                  ))}
                </ul>
              ) : (
                <div
                  style={{
                    marginTop: 4,
                    fontFamily: "var(--mono)",
                    fontSize: 11,
                    color: "var(--text-2)",
                  }}
                >
                  {typeof notes === "string" ? notes : JSON.stringify(notes)}
                </div>
              )}
            </div>
          )}
          {Object.keys(extras).length > 0 && (
            <div>
              <span
                className="label"
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 9.5,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "var(--muted)",
                }}
              >
                Provenance
              </span>
              <pre
                style={{
                  margin: "4px 0 0",
                  padding: "6px 8px",
                  background: "var(--surface-2)",
                  border: "1px solid var(--line)",
                  borderRadius: 3,
                  fontFamily: "var(--mono)",
                  fontSize: 10.5,
                  color: "var(--text-2)",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  overflowX: "auto",
                }}
              >
                {JSON.stringify(extras, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TickReportFeed({ reports, limit }) {
  const raw = Array.isArray(reports) ? reports : (window.AGENT_REPORTS || []);
  if (raw.length === 0) {
    return (
      <p
        style={{
          color: "var(--muted)",
          fontFamily: "var(--mono)",
          fontSize: 13,
          padding: "8px 0",
        }}
      >
        No agent tick reports yet.
      </p>
    );
  }
  // snapshot emits newest-first; tolerate any order defensively.
  const sorted = [...raw].sort((a, b) => {
    const at = (a && a.ts) || "";
    const bt = (b && b.ts) || "";
    if (at === bt) return 0;
    return at < bt ? 1 : -1;
  });
  const shown = typeof limit === "number" ? sorted.slice(0, limit) : sorted;
  return (
    <div>
      {shown.map((r, i) => (
        <TickReportRow key={(r && r.ts) || i} report={r} />
      ))}
    </div>
  );
}

Object.assign(window, { TickReportFeed, TickReportRow });
