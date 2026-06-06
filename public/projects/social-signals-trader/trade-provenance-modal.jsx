/* global React */
// D3 — <TradeProvenanceModal> JSX component.
// Clicking a row in the trade log opens this modal. It reads
// window.THESIS_PROVENANCE (a dict keyed by thesis_key, emitted by
// snapshot.py via aggregations.build_thesis_provenance) and surfaces:
//   - Header: ticker, side, status, P&L, entry/exit
//   - Sources: original Reddit posts (subreddit, author, permalink)
//   - Conviction breakdown: contributing strategies + confidence bar
//   - Corroboration: state_meta.corroboration evidence
//   - Agent rationale: recent audit rows (kind, ts, rationale, ruleBreaks)
//
// Trades emitted to dashboard/data.js currently lack an explicit
// `thesisKey` field, so the modal falls back to a best-effort lookup by
// (ticker, opened date) when no key is attached.

function findProvenanceForTrade(trade, provenanceDict) {
  if (!trade || !provenanceDict) return null;
  // Preferred: explicit thesisKey on the trade row.
  const explicit = trade.thesisKey || trade.thesis_key;
  if (explicit && provenanceDict[explicit]) return provenanceDict[explicit];

  const ticker = (trade.ticker || "").toUpperCase();
  if (!ticker) return null;

  // Collect candidates that match ticker. Most THESIS_PROVENANCE entries
  // expose a `ticker` field directly; some may only carry it via the key
  // (`TICKER:DATE:DIR:SUBREDDIT`).
  const candidates = [];
  for (const key of Object.keys(provenanceDict)) {
    const p = provenanceDict[key];
    const t = (p && p.ticker ? p.ticker : key.split(":")[0] || "").toUpperCase();
    if (t === ticker) candidates.push({ key, p });
  }
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0].p;

  // Tie-break: prefer the one whose eventDate is nearest to trade.opened.
  const opened = trade.opened || trade.closed || "";
  const score = (p) => {
    const ev = p && p.eventDate ? p.eventDate : "";
    if (!ev || !opened) return Number.POSITIVE_INFINITY;
    return Math.abs(Date.parse(ev) - Date.parse(opened)) || 0;
  };
  candidates.sort((a, b) => score(a.p) - score(b.p));
  return candidates[0].p;
}

function _fmtTs(ts) {
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

function _Section({ title, children, accent }) {
  return (
    <div style={{ marginTop: 14 }}>
      <div
        style={{
          fontFamily: "var(--mono)",
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: accent || "var(--muted)",
          marginBottom: 6,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function SourcesList({ sources }) {
  if (!Array.isArray(sources) || sources.length === 0) {
    return (
      <div className="dim" style={{ fontFamily: "var(--mono)", fontSize: 11 }}>
        no source posts captured
      </div>
    );
  }
  return (
    <ul style={{ margin: 0, paddingLeft: 16, listStyle: "disc" }}>
      {sources.map((s, i) => {
        const sub = s.subreddit ? `r/${s.subreddit}` : "";
        const author = s.author ? `u/${s.author}` : "";
        const url = s.permalink || s.url || null;
        const titleText = s.title || s.text || url || "(no title)";
        return (
          <li
            key={i}
            style={{
              fontFamily: "var(--mono)",
              fontSize: 11.5,
              color: "var(--text-2)",
              marginBottom: 4,
              lineHeight: 1.45,
            }}
          >
            {url ? (
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                style={{ color: "var(--text)", textDecoration: "underline" }}
              >
                {titleText}
              </a>
            ) : (
              <span>{titleText}</span>
            )}
            <span style={{ marginLeft: 6, color: "var(--muted)" }}>
              {sub}{sub && author ? " · " : ""}{author}
              {s.score != null && <span> · {s.score}↑</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function ConvictionBreakdown({ rows }) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return (
      <div className="dim" style={{ fontFamily: "var(--mono)", fontSize: 11 }}>
        no contributors recorded
      </div>
    );
  }
  return (
    <div style={{ display: "grid", gap: 4 }}>
      {rows.map((r) => {
        const conf = Math.max(0, Math.min(1, Number(r.confidence) || 0));
        return (
          <div
            key={r.traderId}
            style={{
              display: "grid",
              gridTemplateColumns: "150px 1fr 56px",
              alignItems: "center",
              gap: 10,
              fontFamily: "var(--mono)",
              fontSize: 11,
            }}
          >
            <span style={{ color: "var(--text-2)" }}>{r.traderId}</span>
            <div
              style={{
                height: 8,
                background: "var(--surface-2)",
                border: "1px solid var(--line)",
                borderRadius: 3,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${conf * 100}%`,
                  height: "100%",
                  background: "var(--accent)",
                  opacity: 0.85,
                }}
              />
            </div>
            <span style={{ textAlign: "right", color: "var(--muted)" }}>
              {(conf * 100).toFixed(0)}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

function CorroborationView({ corroboration }) {
  if (!corroboration || typeof corroboration !== "object") {
    return (
      <div className="dim" style={{ fontFamily: "var(--mono)", fontSize: 11 }}>
        no corroboration evidence
      </div>
    );
  }
  return (
    <pre
      style={{
        margin: 0,
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
      {JSON.stringify(corroboration, null, 2)}
    </pre>
  );
}

// Block reason codes that reflect market state rather than a strategy
// decision. Historically the agent wrote one rule_break per cron tick
// for each open thesis whenever markets were closed, which swamped the
// rationale feed. New code no longer emits these (theses_cli J1 fix),
// but the modal still filters legacy rows from `audit.jsonl`.
const ENV_RULE_BREAKS = new Set([
  "market_closed",
  "weekend",
  "pre_open",
  "post_close",
]);

function _isEnvironmentalRow(r) {
  const breaks = Array.isArray(r && r.ruleBreaks) ? r.ruleBreaks : [];
  if (breaks.length === 0) return false;
  return breaks.every((b) => ENV_RULE_BREAKS.has(b));
}

function RationaleList({ rationale }) {
  const [showEnv, setShowEnv] = React.useState(false);
  if (!Array.isArray(rationale) || rationale.length === 0) {
    return (
      <div className="dim" style={{ fontFamily: "var(--mono)", fontSize: 11 }}>
        no agent rationale captured yet
      </div>
    );
  }
  const envCount = rationale.filter(_isEnvironmentalRow).length;
  const visible = showEnv ? rationale : rationale.filter((r) => !_isEnvironmentalRow(r));
  return (
    <div style={{ display: "grid", gap: 6 }}>
      {envCount > 0 && (
        <label
          style={{
            fontFamily: "var(--mono)",
            fontSize: 10.5,
            color: "var(--muted)",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={showEnv}
            onChange={(e) => setShowEnv(e.target.checked)}
          />
          show environmental skips ({envCount} hidden)
        </label>
      )}
      {visible.length === 0 ? (
        <div className="dim" style={{ fontFamily: "var(--mono)", fontSize: 11 }}>
          no strategy-level rationale (only environmental skips on file)
        </div>
      ) : visible.map((r, i) => {
        const kindColor =
          r.kind === "ENTERED" ? "var(--pos)"
          : r.kind === "EXITED" ? "var(--warn)"
          : r.kind === "KILLED" ? "var(--neg)"
          : "var(--text-2)";
        return (
          <div
            key={i}
            style={{
              padding: "6px 8px",
              border: "1px solid var(--line)",
              borderRadius: 3,
              background: "var(--surface-2)",
            }}
          >
            <div
              style={{
                display: "flex",
                gap: 8,
                alignItems: "center",
                flexWrap: "wrap",
                fontFamily: "var(--mono)",
                fontSize: 10.5,
              }}
            >
              <span style={{ color: "var(--muted)" }}>{_fmtTs(r.ts)}</span>
              <span
                style={{
                  color: kindColor,
                  textTransform: "uppercase",
                  letterSpacing: "0.07em",
                  fontWeight: 600,
                }}
              >
                {r.kind || "—"}
              </span>
              {r.strategyId && (
                <span style={{ color: "var(--text-2)" }}>{r.strategyId}</span>
              )}
            </div>
            {r.rationale && (
              <div
                style={{
                  marginTop: 4,
                  fontFamily: "var(--mono)",
                  fontSize: 11,
                  color: "var(--text)",
                  lineHeight: 1.45,
                }}
              >
                {r.rationale}
              </div>
            )}
            {Array.isArray(r.ruleBreaks) && r.ruleBreaks.length > 0 && (
              <div
                style={{
                  marginTop: 4,
                  fontFamily: "var(--mono)",
                  fontSize: 10.5,
                  color: "var(--neg)",
                }}
              >
                rule breaks: {r.ruleBreaks.join(", ")}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function TradeProvenanceModal({ trade, provenance, onClose }) {
  // Esc closes; clicks on the backdrop close; clicks inside the modal don't.
  React.useEffect(() => {
    if (!trade) return undefined;
    const onKey = (e) => { if (e.key === "Escape" && onClose) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [trade, onClose]);

  if (!trade) return null;

  const dict = provenance || window.THESIS_PROVENANCE || {};
  const p = findProvenanceForTrade(trade, dict);

  const sideColor =
    trade.side === "LONG" ? "var(--pos)"
    : trade.side === "SHORT" ? "var(--neg)"
    : "var(--muted)";
  const pnl = Number(trade.pnl) || 0;
  const pnlColor = pnl >= 0 ? "var(--pos)" : "var(--neg)";
  const fmt$ = (v) =>
    (v >= 0 ? "+$" : "−$") +
    Math.abs(v).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Trade provenance"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.55)",
        zIndex: 1000,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "60px 16px",
        overflowY: "auto",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card"
        style={{
          width: "min(720px, 100%)",
          maxHeight: "calc(100vh - 120px)",
          overflowY: "auto",
          padding: 16,
          background: "var(--bg)",
          border: "1px solid var(--line)",
          boxShadow: "0 16px 48px rgba(0, 0, 0, 0.45)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 6,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span
              className="ticker mono"
              style={{ fontSize: 18, fontWeight: 700 }}
            >
              {trade.ticker}
            </span>
            <span
              style={{
                padding: "1px 6px",
                borderRadius: 3,
                fontFamily: "var(--mono)",
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.07em",
                border: `1px solid ${sideColor}`,
                color: sideColor,
              }}
            >
              {trade.side || "?"}
            </span>
            <span
              className={`pill ${trade.status === "OPEN" ? "open" : "closed"}`}
              style={{ fontSize: 10 }}
            >
              {trade.status || "—"}
            </span>
            {trade.strategy && (
              <span
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 10.5,
                  color: "var(--accent)",
                  textTransform: "uppercase",
                  letterSpacing: "0.07em",
                }}
              >
                {trade.strategy}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: "transparent",
              border: "1px solid var(--line)",
              color: "var(--text-2)",
              fontFamily: "var(--mono)",
              fontSize: 11,
              padding: "4px 10px",
              borderRadius: 3,
              cursor: "pointer",
            }}
          >
            ✕ close
          </button>
        </div>

        <div
          style={{
            display: "flex",
            gap: 18,
            flexWrap: "wrap",
            fontFamily: "var(--mono)",
            fontSize: 11.5,
            color: "var(--text-2)",
            marginTop: 4,
          }}
        >
          <span>
            <span className="dim">entry</span> {trade.entry != null ? Number(trade.entry).toFixed(2) : "—"}
          </span>
          <span>
            <span className="dim">exit</span> {trade.exit != null ? Number(trade.exit).toFixed(2) : "—"}
          </span>
          <span>
            <span className="dim">qty</span> {trade.qty ?? "—"}
          </span>
          <span>
            <span className="dim">opened</span> {trade.opened || "—"}
            {trade.closed ? ` → ${trade.closed}` : ""}
          </span>
          <span style={{ marginLeft: "auto", color: pnlColor, fontWeight: 600 }}>
            {fmt$(pnl)}
            {trade.pnlPct != null && (
              <span style={{ marginLeft: 6, color: pnlColor, opacity: 0.8 }}>
                ({trade.pnlPct >= 0 ? "+" : ""}{Number(trade.pnlPct).toFixed(2)}%)
              </span>
            )}
          </span>
        </div>

        {!p ? (
          <p
            style={{
              marginTop: 16,
              color: "var(--muted)",
              fontFamily: "var(--mono)",
              fontSize: 12,
              lineHeight: 1.5,
            }}
          >
            No matching thesis provenance for this trade. It may have been a
            legacy momentum fill or an opportunistic entry outside the
            thesis pipeline.
          </p>
        ) : (
          <>
            <_Section title="Sources">
              <SourcesList sources={p.sources} />
            </_Section>

            <_Section title="Conviction breakdown">
              <ConvictionBreakdown rows={p.convictionBreakdown} />
            </_Section>

            <_Section title="Corroboration">
              <CorroborationView corroboration={p.corroboration} />
            </_Section>

            <_Section title="Agent rationale" accent="var(--accent)">
              <RationaleList rationale={p.rationale} />
            </_Section>
          </>
        )}
      </div>
    </div>
  );
}

Object.assign(window, {
  TradeProvenanceModal,
  findProvenanceForTrade,
});
