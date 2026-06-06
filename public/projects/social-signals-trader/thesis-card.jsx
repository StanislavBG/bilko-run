/* global React */
// D1 — <ThesisCard> JSX component.
// Reads window.THESES (a flat list of thesis objects emitted by snapshot.py
// via aggregations.build_theses_panel). Each card shows:
//   - lifecycle bar (DETECTED → CORROBORATED → ENTERED → EXITED)
//   - days-to-event countdown
//   - contributing strategies
//   - kill reason if KILLED

const LIFECYCLE = ["DETECTED", "CORROBORATED", "ENTERED", "EXITED"];

function lifecycleIndex(state) {
  const i = LIFECYCLE.indexOf(state);
  return i === -1 ? -1 : i;
}

function LifecycleBar({ state }) {
  const killed = state === "KILLED";
  const activeIdx = killed ? -1 : lifecycleIndex(state);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
      {LIFECYCLE.map((stage, i) => {
        const reached = !killed && i <= activeIdx;
        const current = !killed && i === activeIdx;
        const bg = current
          ? "var(--accent)"
          : reached
          ? "var(--pos)"
          : "var(--surface-2)";
        const color = current || reached ? "var(--bg)" : "var(--muted)";
        return (
          <React.Fragment key={stage}>
            <div
              title={stage + (current ? " (current)" : "")}
              style={{
                padding: "3px 8px",
                background: bg,
                color,
                fontFamily: "var(--mono)",
                fontSize: 9.5,
                fontWeight: 600,
                letterSpacing: "0.06em",
                border: "1px solid var(--line)",
                borderRadius: 2,
              }}
            >
              {stage}
            </div>
            {i < LIFECYCLE.length - 1 && (
              <div
                style={{
                  width: 10,
                  height: 1,
                  background: reached && i < activeIdx ? "var(--pos)" : "var(--line)",
                }}
              />
            )}
          </React.Fragment>
        );
      })}
      {killed && (
        <span
          className="pill stopped"
          style={{ marginLeft: 8, fontSize: 9.5, letterSpacing: "0.06em" }}
        >
          KILLED
        </span>
      )}
    </div>
  );
}

function ThesisCard({ thesis }) {
  if (!thesis) return null;
  const {
    ticker,
    eventDate,
    direction,
    catalyst,
    state,
    confidence,
    contributors,
    daysUntil,
    pnlPct,
    killReason,
  } = thesis;

  const isKilled = state === "KILLED";
  const countdown =
    daysUntil == null
      ? "—"
      : daysUntil >= 0
      ? `T-${daysUntil}d`
      : `T+${-daysUntil}d`;
  const dirColor =
    direction === "long"
      ? "var(--pos)"
      : direction === "short"
      ? "var(--neg)"
      : "var(--muted)";

  return (
    <div
      className="card"
      style={{
        marginBottom: 10,
        padding: 12,
        opacity: isKilled ? 0.7 : 1,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 10,
        }}
      >
        <span className="ticker mono" style={{ fontSize: 15, fontWeight: 700 }}>
          {ticker}
        </span>
        <span
          style={{
            padding: "1px 6px",
            borderRadius: 3,
            fontSize: 10,
            fontFamily: "var(--mono)",
            fontWeight: 600,
            letterSpacing: "0.07em",
            border: `1px solid ${dirColor}`,
            color: dirColor,
          }}
        >
          {(direction || "?").toUpperCase()}
        </span>
        {catalyst && (
          <span
            style={{
              fontFamily: "var(--mono)",
              fontSize: 10,
              color: "var(--accent)",
              textTransform: "uppercase",
              letterSpacing: "0.07em",
            }}
          >
            {catalyst}
          </span>
        )}
        <span
          style={{
            fontFamily: "var(--mono)",
            fontSize: 11,
            color: "var(--text-2)",
          }}
        >
          {eventDate || "—"}
          <span
            style={{
              marginLeft: 6,
              color:
                daysUntil == null
                  ? "var(--muted)"
                  : daysUntil >= 0
                  ? "var(--warn)"
                  : "var(--muted)",
            }}
          >
            {countdown}
          </span>
        </span>
        {pnlPct != null && (
          <span
            className={pnlPct >= 0 ? "up" : "down"}
            style={{ fontFamily: "var(--mono)", fontSize: 11, marginLeft: "auto" }}
          >
            {pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%
          </span>
        )}
        {pnlPct == null && confidence != null && (
          <span
            style={{
              fontFamily: "var(--mono)",
              fontSize: 11,
              color: "var(--muted)",
              marginLeft: "auto",
            }}
          >
            conf {Math.round(confidence * 100)}%
          </span>
        )}
      </div>

      <LifecycleBar state={state} />

      <div
        style={{
          marginTop: 10,
          display: "flex",
          flexWrap: "wrap",
          gap: 6,
          alignItems: "center",
        }}
      >
        <span
          className="label"
          style={{
            fontFamily: "var(--mono)",
            fontSize: 9.5,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "var(--muted)",
            marginRight: 4,
          }}
        >
          Contributors
        </span>
        {(contributors || []).length === 0 ? (
          <span className="dim" style={{ fontFamily: "var(--mono)", fontSize: 11 }}>
            —
          </span>
        ) : (
          (contributors || []).map((c) => (
            <span
              key={c}
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--line)",
                padding: "1px 6px",
                borderRadius: 3,
                fontFamily: "var(--mono)",
                fontSize: 10.5,
                color: "var(--text-2)",
              }}
            >
              {c}
            </span>
          ))
        )}
      </div>

      {isKilled && killReason && (
        <div
          style={{
            marginTop: 8,
            padding: "6px 8px",
            background: "var(--surface-2)",
            border: "1px solid var(--line)",
            borderRadius: 3,
            fontFamily: "var(--mono)",
            fontSize: 10.5,
            color: "var(--neg)",
          }}
        >
          <span className="dim" style={{ marginRight: 6 }}>kill reason</span>
          {killReason}
        </div>
      )}
    </div>
  );
}

function ThesisCardList({ theses, limit }) {
  const raw = Array.isArray(theses) ? theses : (window.THESES || []);
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
        No theses materialized yet.
      </p>
    );
  }

  // Sort: non-KILLED first by daysUntil asc, then KILLED at the end.
  const sorted = [...raw].sort((a, b) => {
    const aK = a.state === "KILLED" ? 1 : 0;
    const bK = b.state === "KILLED" ? 1 : 0;
    if (aK !== bK) return aK - bK;
    const ad = a.daysUntil == null ? 1e9 : a.daysUntil;
    const bd = b.daysUntil == null ? 1e9 : b.daysUntil;
    return ad - bd;
  });

  const shown = typeof limit === "number" ? sorted.slice(0, limit) : sorted;

  return (
    <div>
      {shown.map((t) => (
        <ThesisCard key={t.key || `${t.ticker}:${t.eventDate}`} thesis={t} />
      ))}
    </div>
  );
}

Object.assign(window, { ThesisCard, ThesisCardList, LifecycleBar });
