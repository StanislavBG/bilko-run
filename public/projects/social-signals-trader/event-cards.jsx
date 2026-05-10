/* global React */
// Event-card panel (F8) — one card per (ticker, event_date) event.
// Reads window.EVENT_CARDS emitted by snapshot.py.
// Zero external dependencies; reuses existing dashboard CSS variables.
// TODO: mobile responsiveness is desktop-only in v1.

// ============== Conviction sparkline (SVG, no chart library) ==============
function ConvictionSparkline({ points, width = 80, height = 24 }) {
  if (!points || points.length < 2) {
    return <span style={{ color: "var(--muted)", fontSize: 10 }}>—</span>;
  }
  const xs = points.map((_, i) => (i / (points.length - 1)) * width);
  const ys = points.map((p) => height - (p.conviction || 0) * height);
  const d = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(" ");
  return (
    <svg width={width} height={height} style={{ display: "block", overflow: "visible" }}>
      <path d={d} fill="none" stroke="var(--info)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ============== Direction badge ==============
function DirBadge({ direction }) {
  const color = direction === "long" ? "var(--pos)" : direction === "short" ? "var(--neg)" : "var(--muted)";
  const label = (direction || "?").toUpperCase();
  return (
    <span style={{
      display: "inline-block",
      padding: "1px 6px",
      borderRadius: 3,
      fontSize: 10,
      fontFamily: "var(--mono)",
      fontWeight: 600,
      letterSpacing: "0.07em",
      border: `1px solid ${color}`,
      color,
    }}>{label}</span>
  );
}

// ============== Conviction bar ==============
function ConvictionBar({ value }) {
  const pct = Math.min(100, Math.max(0, (value || 0) * 100));
  const color = pct >= 65 ? "var(--pos)" : pct >= 40 ? "var(--warn)" : "var(--neg)";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ width: 60, height: 4, background: "var(--surface-2)", borderRadius: 2, overflow: "hidden", border: "1px solid var(--line)" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color }} />
      </div>
      <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--text-2)", minWidth: 28 }}>{pct.toFixed(0)}%</span>
    </div>
  );
}

// ============== P&L chip ==============
function PnlChip({ pnl }) {
  if (pnl === null || pnl === undefined) {
    return <span style={{ color: "var(--muted)", fontSize: 11 }}>—</span>;
  }
  const cls = pnl >= 0 ? "up" : "down";
  const sign = pnl >= 0 ? "+" : "−";
  return (
    <span className={cls} style={{ fontFamily: "var(--mono)", fontSize: 11 }}>
      {sign}${Math.abs(pnl).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    </span>
  );
}

// ============== Agreement bar ==============
function AgreementBar({ agreement }) {
  const long = (agreement.long_subs || []).length;
  const short = (agreement.short_subs || []).length;
  const neutral = (agreement.neutral_subs || []).length;
  const total = long + short + neutral || 1;
  const longPct = (long / total) * 100;
  const shortPct = (short / total) * 100;
  const neutPct = (neutral / total) * 100;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ flex: 1, height: 6, display: "flex", borderRadius: 3, overflow: "hidden", border: "1px solid var(--line)" }}>
        {long > 0 && <div style={{ width: `${longPct}%`, background: "var(--pos)" }} title={`long: ${agreement.long_subs.join(", ")}`} />}
        {neutral > 0 && <div style={{ width: `${neutPct}%`, background: "var(--muted)" }} title={`neutral: ${agreement.neutral_subs.join(", ")}`} />}
        {short > 0 && <div style={{ width: `${shortPct}%`, background: "var(--neg)" }} title={`short: ${agreement.short_subs.join(", ")}`} />}
      </div>
      <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--text-2)", whiteSpace: "nowrap" }}>
        {long}L / {short}S · <span style={{ color: agreement.consensus_direction === "long" ? "var(--pos)" : agreement.consensus_direction === "short" ? "var(--neg)" : "var(--warn)" }}>
          {agreement.consensus_direction} {Math.round((agreement.consensus_strength || 0) * 100)}%
        </span>
      </span>
    </div>
  );
}

// ============== Single event card ==============
function EventCard({ card }) {
  const daysUntil = Math.ceil((new Date(card.event_date) - new Date()) / 86400000);
  const countdown = daysUntil >= 0 ? `T-${daysUntil}d` : `T+${-daysUntil}d`;

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      {/* Header */}
      <div className="card-head" style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h3 style={{ margin: 0 }}>
          <span className="ticker mono" style={{ fontSize: 17, fontWeight: 700 }}>{card.ticker}</span>
          {card.catalyst && (
            <span style={{ marginLeft: 8, fontSize: 11, fontFamily: "var(--mono)", color: "var(--accent)", letterSpacing: "0.07em", textTransform: "uppercase" }}>{card.catalyst}</span>
          )}
        </h3>
        <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-2)" }}>
          {card.event_date}
          <span style={{ marginLeft: 6, color: daysUntil >= 0 ? "var(--warn)" : "var(--muted)" }}>{countdown}</span>
        </span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 10, flexWrap: "wrap" }}>
          {Object.entries(card.state_summary || {}).filter(([, v]) => v > 0).map(([k, v]) => (
            <span key={k} style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{k} {v}</span>
          ))}
        </div>
      </div>

      {/* Subreddit rows */}
      <div className="card-body tight" style={{ padding: 0 }}>
        <table className="trades" style={{ width: "100%" }}>
          <thead>
            <tr>
              <th>Subreddit</th>
              <th>Dir</th>
              <th>Conviction</th>
              <th>Timeline</th>
              <th className="num">Qty @ Entry</th>
              <th className="num">Exit</th>
              <th className="num">P&L</th>
              <th>State</th>
            </tr>
          </thead>
          <tbody>
            {(card.subreddits || []).map((sub) => (
              <tr key={sub.thesis_key || sub.subreddit}>
                <td style={{ fontFamily: "var(--mono)", fontSize: 12 }}>r/{sub.subreddit}</td>
                <td><DirBadge direction={sub.direction} /></td>
                <td><ConvictionBar value={sub.conviction_now} /></td>
                <td><ConvictionSparkline points={sub.sentiment_timeline} /></td>
                <td className="num" style={{ fontFamily: "var(--mono)", fontSize: 11 }}>
                  {sub.qty != null ? `${sub.qty}sh` : "—"}
                  {sub.entry_price != null ? <span style={{ color: "var(--muted)" }}> @ ${sub.entry_price.toFixed(2)}</span> : null}
                </td>
                <td className="num" style={{ fontFamily: "var(--mono)", fontSize: 11 }}>
                  {sub.exit_price != null ? `$${sub.exit_price.toFixed(2)}` : "—"}
                </td>
                <td className="num"><PnlChip pnl={sub.realized_pnl_usd != null ? sub.realized_pnl_usd : sub.unrealized_pnl_usd} /></td>
                <td>
                  <span className="pill" style={{ fontSize: 9, letterSpacing: "0.05em" }}>{sub.current_state}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary row */}
      {card.summary && (
        <div style={{ padding: "8px 14px", borderTop: "1px solid var(--line)", display: "flex", gap: 24, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-2)" }}>
            Total: {card.summary.total_qty || 0}sh · ${(card.summary.total_notional_usd || 0).toLocaleString()}
          </span>
          {card.summary.blended_realized_pnl != null && (
            <span style={{ fontFamily: "var(--mono)", fontSize: 11 }}>
              Realized: <PnlChip pnl={card.summary.blended_realized_pnl} />
            </span>
          )}
          {card.summary.blended_unrealized_pnl != null && (
            <span style={{ fontFamily: "var(--mono)", fontSize: 11 }}>
              Unrealized: <PnlChip pnl={card.summary.blended_unrealized_pnl} />
            </span>
          )}
          <div style={{ marginLeft: "auto", flex: 1, minWidth: 180 }}>
            <AgreementBar agreement={card.agreement || { long_subs: [], short_subs: [], neutral_subs: [], consensus_direction: "split", consensus_strength: 0 }} />
          </div>
        </div>
      )}
    </div>
  );
}

// ============== Event card list (section) ==============
function EventCardList() {
  const raw = window.EVENT_CARDS;
  if (!raw || typeof raw !== "object" || Object.keys(raw).length === 0) {
    return (
      <p style={{ color: "var(--muted)", fontFamily: "var(--mono)", fontSize: 13 }}>
        No upcoming events with sentiment data yet.
      </p>
    );
  }

  // Sort by event_date ascending.
  const cards = Object.values(raw).sort((a, b) =>
    (a.event_date || "").localeCompare(b.event_date || "")
  );

  return (
    <div>
      {cards.map((card) => (
        <EventCard key={`${card.ticker}:${card.event_date}`} card={card} />
      ))}
    </div>
  );
}

// Expose to global scope for use in pages.jsx / app.jsx.
Object.assign(window, { EventCard, EventCardList, ConvictionSparkline, AgreementBar });
