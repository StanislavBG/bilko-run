/* global React */
// D5 — <DecisionNarrativeStream>: "the agent did X because Y" feed.
// Reads window.AGENT_REPORTS (rows produced by snapshot's
// _build_agent_reports_panel, already newest-first + cost-normalized) and
// renders each row as a single narrative line:
//
//   2026-05-12 11:00  [ENTERED 2]  because PANW entry deferred (market closed) …
//
// Different from <TickReportFeed> (D2), which is tabular with expandable
// provenance — this is the prose-y story-mode view for the Methodology page.

function _verbFor(report) {
  const r = report || {};
  if (r.kind === "roadmap") {
    const item = r.item || "";
    return { label: item ? `Roadmap ${item}` : "Roadmap", tone: "accent" };
  }
  if (Array.isArray(r.errors) && r.errors.length > 0) {
    return { label: `Errored ${r.errors.length}`, tone: "neg" };
  }
  if ((r.entered || 0) > 0) return { label: `Entered ${r.entered}`, tone: "pos" };
  if ((r.exited || 0) > 0) return { label: `Exited ${r.exited}`, tone: "warn" };
  if ((r.killed || 0) > 0) return { label: `Killed ${r.killed}`, tone: "neg" };
  if ((r.corroborated || 0) > 0) return { label: `Corroborated ${r.corroborated}`, tone: "pos" };
  if ((r.detected || 0) > 0) return { label: `Detected ${r.detected}`, tone: "info" };
  if ((r.deferred_market_closed || 0) > 0) return { label: "Deferred", tone: "muted" };
  if ((r.skipped_market_closed || 0) > 0) return { label: "Skipped", tone: "muted" };
  if ((r.skipped_no_corroboration || 0) > 0) return { label: "Skipped", tone: "muted" };
  return { label: "Tick", tone: "muted" };
}

function _toneColor(tone) {
  switch (tone) {
    case "pos": return "var(--pos)";
    case "neg": return "var(--neg)";
    case "warn": return "var(--warn)";
    case "info": return "var(--info)";
    case "accent": return "var(--accent)";
    default: return "var(--muted)";
  }
}

function _fmtNarrativeTs(ts) {
  if (!ts) return "—";
  try {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return ts;
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
      `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch (e) {
    return ts;
  }
}

function _fmtNarrativeCost(v) {
  if (v == null) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n === 0) return null;
  if (n < 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}

function DecisionNarrativeLine({ report }) {
  const { ts, summary, costUsd } = report || {};
  const verb = _verbFor(report);
  const color = _toneColor(verb.tone);
  const hasSummary = typeof summary === "string" && summary.trim().length > 0;
  const costLabel = _fmtNarrativeCost(costUsd);
  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        padding: "10px 14px",
        borderBottom: "1px solid var(--line)",
        alignItems: "flex-start",
      }}
    >
      <span
        style={{
          fontFamily: "var(--mono)",
          fontSize: 10.5,
          color: "var(--muted)",
          minWidth: 110,
          paddingTop: 2,
          whiteSpace: "nowrap",
        }}
      >
        {_fmtNarrativeTs(ts)}
      </span>
      <span
        style={{
          fontFamily: "var(--mono)",
          fontSize: 10,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color,
          background: "var(--surface-2)",
          border: `1px solid ${color}`,
          padding: "2px 8px",
          borderRadius: 3,
          minWidth: 92,
          textAlign: "center",
          whiteSpace: "nowrap",
          marginTop: 1,
        }}
      >
        {verb.label}
      </span>
      <span
        style={{
          flex: 1,
          fontFamily: "var(--mono)",
          fontSize: 12,
          color: "var(--text)",
          lineHeight: 1.55,
        }}
      >
        {hasSummary ? (
          <span>
            <span style={{ color: "var(--muted)" }}>because </span>
            {summary}
          </span>
        ) : (
          <span className="dim">(no narrative recorded)</span>
        )}
      </span>
      {costLabel && (
        <span
          style={{
            fontFamily: "var(--mono)",
            fontSize: 10,
            color: "var(--warn)",
            paddingTop: 3,
            whiteSpace: "nowrap",
          }}
        >
          {costLabel}
        </span>
      )}
    </div>
  );
}

function DecisionNarrativeStream({ reports, limit }) {
  const raw = Array.isArray(reports) ? reports : (window.AGENT_REPORTS || []);
  if (raw.length === 0) {
    return (
      <p
        style={{
          color: "var(--muted)",
          fontFamily: "var(--mono)",
          fontSize: 13,
          padding: "10px 14px",
          margin: 0,
        }}
      >
        No agent decisions logged yet.
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
  const cap = typeof limit === "number" ? limit : 25;
  const shown = sorted.slice(0, cap);
  return (
    <div>
      {shown.map((r, i) => (
        <DecisionNarrativeLine key={(r && r.ts) || i} report={r} />
      ))}
    </div>
  );
}

Object.assign(window, { DecisionNarrativeStream, DecisionNarrativeLine });
