/* global React */
/* PRD 76 — Upcoming Catalysts widget.
 *
 * Consumes `window.UPCOMING_CATALYSTS` (built by
 * `aggregations.build_upcoming_catalysts`). Renders a compact, grouped-by-
 * date list with hover (desktop) / tap (mobile) popovers that surface the
 * position, thesis, and a concrete "what's the plan today" action.
 *
 * Design judgment:
 *  - Stays visually compact at desktop (max-height + scroll); the hero P&L
 *    remains the headline.
 *  - Tier badge reuses the same colour map as PRD 74's <TierBadge /> so the
 *    user's eye trains on one consistent semantic.
 *  - Plan-today phrasing is derived from days-away (single source of truth)
 *    so we don't drift from the trader's entry-window math.
 */

const UC_EMPTY = {
  asOf: null,
  withinDays: 10,
  entries: [],
  counts: { total: 0, held: 0, withThesis: 0 },
};

// ---------- pure helpers ----------

function formatDateHeader(iso) {
  if (!iso) return "—";
  // Treat as US-Eastern calendar date (matches the trader's NY-anchored day).
  const d = new Date(iso + "T12:00:00Z");
  return d.toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric",
  });
}

function fmtMoney(v) {
  if (v == null || Number.isNaN(v)) return "—";
  const sign = v >= 0 ? "+$" : "−$";
  return sign + Math.abs(v).toLocaleString("en-US", {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
}

function fmtPct(v) {
  if (v == null || Number.isNaN(v)) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}

function catalystLabel(c) {
  return (c || "").replace(/_/g, " ").toUpperCase();
}

// Group entries by date. O(n) single pass; entries are already sorted server-side.
function groupByDate(entries) {
  const out = [];
  let current = null;
  for (const e of entries || []) {
    if (!current || current.date !== e.date) {
      current = { date: e.date, rows: [] };
      out.push(current);
    }
    current.rows.push(e);
  }
  return out;
}

// Plan-today phrasing. Driven by daysAway + position state so the user can
// glance at the row and know what (if anything) the trader will do today.
function planForToday(entry) {
  const d = entry.daysAway;
  const pos = entry.position;
  if (pos) {
    if (d != null && d <= 0) return "EXIT at close (event today)";
    if (d != null && d === 1) return "HOLD into event (T-1)";
    return "HOLD";
  }
  // No position yet.
  if (d != null && d <= 0) return "Event passed — skip";
  if (d != null && d === 1) {
    return entry.thesis && entry.thesis.direction === "short"
      ? "Plan: SHORT $5k at open (T-1)"
      : "Plan: BUY $5k at open (T-1)";
  }
  return "Wait — entry window opens T-1";
}

// Compact deterministic exit-policy summary, e.g. "@open T+1 · stop 10d · −5% circuit".
// Mirrors the backend `exitPlan` policy facts so the chip line never drifts from
// what the trader actually enforces.
function exitPolicyChips(exitPlan) {
  if (!exitPlan) return [];
  const chips = [];
  if (exitPlan.intradayOnly) {
    chips.push("intraday only");
  } else if (exitPlan.exitAt != null && exitPlan.exitLagDays != null) {
    const lag = exitPlan.exitLagDays === 0 ? "T" : `T+${exitPlan.exitLagDays}`;
    chips.push(`@${exitPlan.exitAt} ${lag}`);
  }
  if (exitPlan.timeStopDays != null) chips.push(`time-stop ${exitPlan.timeStopDays}d`);
  if (exitPlan.dailyLossCircuitPct != null) chips.push(`−${exitPlan.dailyLossCircuitPct}% circuit`);
  return chips;
}

// Map a signal-builder avg_sentiment (−1..1) to an up/down/neutral class.
function sentimentTone(avg) {
  if (avg == null || Number.isNaN(avg)) return "dim";
  if (avg > 0.05) return "up";
  if (avg < -0.05) return "down";
  return "dim";
}

// ---------- subcomponents ----------

function PositionDot({ position }) {
  // Hollow = no position; filled green = long held; filled red = short held.
  if (!position) {
    return (
      <span className="uc-position-dot uc-dot-empty" aria-label="no position"
        title="No position">○</span>
    );
  }
  const isShort = position.side === "SHORT";
  const cls = isShort ? "uc-dot-short" : "uc-dot-long";
  const label = isShort ? "Short position open" : "Long position open";
  return (
    <span className={`uc-position-dot ${cls}`} aria-label={label}
      title={label}>●</span>
  );
}

function UcTierBadge({ tier, kind }) {
  if (!tier) return null;
  const t = String(tier).toLowerCase();
  const map = {
    social:       { bg: "var(--pos)",    fg: "#0a0e14", label: "SOCIAL" },
    options_tech: { bg: "var(--accent)", fg: "#0a0e14", label: "OPTIONS/TECH" },
    naive:        { bg: "var(--muted)",  fg: "#0a0e14", label: "NAIVE" },
  };
  const cfg = map[t] || { bg: "var(--muted)", fg: "#0a0e14", label: t.toUpperCase() };
  const isForecast = kind === "forecast";
  return (
    <span
      className="uc-tier-badge tier-badge"
      title={isForecast ? `forecast tier: ${t}` : `fired tier: ${t}`}
      style={{
        background: cfg.bg, color: cfg.fg,
        opacity: isForecast ? 0.55 : 1,
        borderStyle: isForecast ? "dashed" : "solid",
      }}
    >{cfg.label}{isForecast ? "?" : ""}</span>
  );
}

function PositionBlock({ position }) {
  if (!position) return null;
  return (
    <div className="uc-pop-block">
      <div className="uc-pop-block-title">Position</div>
      <div className="uc-pop-grid">
        <span className="uc-pop-k">Side</span>
        <span className={`uc-pop-v mono ${position.side === "LONG" ? "up" : "down"}`}>
          {position.side}
        </span>
        <span className="uc-pop-k">Qty</span>
        <span className="uc-pop-v mono">{position.qty}</span>
        <span className="uc-pop-k">Avg entry</span>
        <span className="uc-pop-v mono">${(position.avgEntry || 0).toFixed(2)}</span>
        <span className="uc-pop-k">Current</span>
        <span className="uc-pop-v mono">${(position.currentPrice || 0).toFixed(2)}</span>
        <span className="uc-pop-k">Unrealized</span>
        <span className={`uc-pop-v mono ${(position.unrealizedPl || 0) >= 0 ? "up" : "down"}`}>
          {fmtMoney(position.unrealizedPl)} ({fmtPct(position.unrealizedPlPct)})
        </span>
      </div>
    </div>
  );
}

function ThesisBlock({ thesis, tier, tierKind }) {
  if (!thesis) {
    return (
      <div className="uc-pop-block">
        <div className="uc-pop-block-title">Thesis</div>
        <div className="uc-pop-empty">
          No social signal — calendar sweeper will fire as <em>tier {tier}</em>.
        </div>
      </div>
    );
  }
  return (
    <div className="uc-pop-block">
      <div className="uc-pop-block-title">Thesis · {thesis.state}</div>
      <div className="uc-pop-grid">
        <span className="uc-pop-k">Direction</span>
        <span className={`uc-pop-v mono ${thesis.direction === "long" ? "up" : "down"}`}>
          {(thesis.direction || "").toUpperCase()}
        </span>
        <span className="uc-pop-k">Confidence</span>
        <span className="uc-pop-v mono">{(thesis.confidence * 100).toFixed(0)}%</span>
        <span className="uc-pop-k">Tier</span>
        <span className="uc-pop-v mono">{tier} <span className="dim">({tierKind})</span></span>
        <span className="uc-pop-k">Source</span>
        <span className="uc-pop-v mono">{thesis.extractedBy || "—"}</span>
      </div>
      {thesis.evidence && (
        <div className="uc-pop-evidence">
          <div className="uc-pop-block-title">Evidence</div>
          <div className="uc-pop-evidence-body">{thesis.evidence}</div>
        </div>
      )}
    </div>
  );
}

// Explicit status disambiguates "checked, found nothing" from "call failed".
// Legacy payloads (pre-PRD 346) carry no `status` field at all — treat those
// as "ok" so old snapshots keep rendering the bar exactly as before.
function sentimentStatus(sentiment) {
  if (!sentiment) return "unavailable";
  return sentiment.status || "ok";
}

// Sentiment — signal-builder social read (bull/bear + avg) shown side-by-side
// with the trader's own thesis stance, so divergence is obvious at a glance.
function SentimentBlock({ sentiment, thesis }) {
  const hasThesis = !!thesis;
  const status = sentimentStatus(sentiment);
  const bull = sentiment && sentiment.bullishPct != null ? sentiment.bullishPct : null;
  const bear = sentiment && sentiment.bearishPct != null ? sentiment.bearishPct : null;
  return (
    <div className="uc-pop-block">
      <div className="uc-pop-block-title">Sentiment</div>
      <div className="uc-sent-cols">
        {/* signal-builder social sentiment */}
        <div className="uc-sent-col">
          <div className="uc-sent-col-head">Social <span className="dim">· signal-builder</span></div>
          {status === "unavailable" ? (
            <div className="uc-sent-body">
              <div className="uc-sent-meta mono warn">no data — signal-builder degraded/timeout</div>
              {sentiment && sentiment.asOf && (
                <div className="uc-sent-sub dim">last known {sentiment.asOf}</div>
              )}
            </div>
          ) : status === "quiet" ? (
            <div className="uc-sent-body">
              <div className="uc-sent-meta mono dim">0 mentions — checked, quiet</div>
              {sentiment.asOf && <div className="uc-sent-sub dim">as of {sentiment.asOf}</div>}
            </div>
          ) : (
            <div className="uc-sent-body">
              {(bull != null || bear != null) && (
                <div className="uc-sent-bar" title={`bull ${bull ?? "—"}% / bear ${bear ?? "—"}%`}>
                  <span className="uc-sent-bull" style={{ width: `${bull ?? 0}%` }} />
                  <span className="uc-sent-bear" style={{ width: `${bear ?? 0}%` }} />
                </div>
              )}
              <div className="uc-sent-meta mono">
                <span className={sentimentTone(sentiment.avgSentiment)}>
                  {sentiment.label || (sentiment.avgSentiment != null
                    ? (sentiment.avgSentiment >= 0 ? "net +" : "net ") + sentiment.avgSentiment
                    : "—")}
                </span>
                {bull != null && <span className="dim"> · bull {Math.round(bull)}%</span>}
                {bear != null && <span className="dim"> / bear {Math.round(bear)}%</span>}
                <span className="dim"> · {sentiment.mentions} mentions</span>
                {sentiment.asOf && <span className="dim"> · as of {sentiment.asOf}</span>}
              </div>
              {sentiment.topSubreddit && (
                <div className="uc-sent-sub dim">top: r/{sentiment.topSubreddit}</div>
              )}
            </div>
          )}
        </div>
        {/* trader thesis stance */}
        <div className="uc-sent-col">
          <div className="uc-sent-col-head">Thesis <span className="dim">· trader</span></div>
          {hasThesis ? (
            <div className="uc-sent-body">
              <div className="uc-sent-meta mono">
                <span className={thesis.direction === "long" ? "up" : "down"}>
                  {(thesis.direction || "").toUpperCase()}
                </span>
                <span className="dim"> · conf {(thesis.confidence * 100).toFixed(0)}%</span>
              </div>
              <div className="uc-sent-sub dim">state {thesis.state || "—"}</div>
            </div>
          ) : (
            <div className="uc-pop-empty">No thesis — calendar sweeper only.</div>
          )}
        </div>
      </div>
    </div>
  );
}

// Social · burrow — mentions/velocity/top-posts read routed via signal-builder
// (PRD 347). Mirrors SentimentBlock's three-state status handling so a failed
// SB route reads distinctly from a genuinely quiet ticker.
function SocialBlock({ social }) {
  const status = social && social.status ? social.status : "unavailable";
  return (
    <div className="uc-pop-block">
      <div className="uc-pop-block-title">Social <span className="dim">· burrow</span></div>
      {status === "unavailable" ? (
        <div className="uc-sent-body">
          <div className="uc-sent-meta mono warn">no data — SB route degraded/timeout</div>
          {social && social.asOf && <div className="uc-sent-sub dim">last known {social.asOf}</div>}
        </div>
      ) : status === "quiet" ? (
        <div className="uc-sent-body">
          <div className="uc-sent-meta mono dim">0 mentions — checked, quiet</div>
          {social.asOf && <div className="uc-sent-sub dim">as of {social.asOf}</div>}
        </div>
      ) : (
        <div className="uc-sent-body">
          <div className="uc-sent-meta mono">
            {social.mentions ?? 0} mentions
            {social.velocity != null && <span className="dim"> · velocity {social.velocity}</span>}
            {social.asOf && <span className="dim"> · as of {social.asOf}</span>}
          </div>
          {(social.topPosts || []).slice(0, 2).map((p, i) => (
            <div key={i} className="uc-sent-sub dim">
              {p.title}{p.subreddit ? ` — r/${p.subreddit}` : ""}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Exit plan — deterministic policy chips (always) + LLM narrative (when present).
function ExitPlanBlock({ exitPlan, entry }) {
  const chips = exitPolicyChips(exitPlan);
  const narrative = exitPlan && exitPlan.narrative;
  const planToday = planForToday(entry);
  return (
    <div className="uc-pop-block">
      <div className="uc-pop-block-title">Exit plan</div>
      {chips.length > 0 && (
        <div className="uc-exit-chips">
          {chips.map((c, i) => (
            <span key={i} className="uc-exit-chip mono">{c}</span>
          ))}
        </div>
      )}
      {narrative
        ? <div className="uc-exit-narrative">{narrative}</div>
        : <div className="uc-pop-empty">Policy-driven exit (no narrative generated).</div>}
      <div className="uc-pop-grid uc-exit-today">
        <span className="uc-pop-k">Today</span>
        <span className="uc-pop-v">{planToday}</span>
      </div>
    </div>
  );
}

// Inline detail panel — rendered directly beneath an expanded row (accordion),
// no floating popover. Replaces PRD 76's hover popover per the user's request
// to surface position / sentiment / exit-plan in place.
function UcDetail({ entry }) {
  return (
    <div className="uc-detail" role="region">
      {entry.subject && <div className="uc-pop-subject">{entry.subject}</div>}
      <PositionBlock position={entry.position} />
      <SentimentBlock sentiment={entry.sentiment} thesis={entry.thesis} />
      <SocialBlock social={entry.social} />
      <ThesisBlock thesis={entry.thesis} tier={entry.tier} tierKind={entry.tierKind} />
      <ExitPlanBlock exitPlan={entry.exitPlan} entry={entry} />
    </div>
  );
}

// Collapsed-row trade-log line — the fund's public blotter ("hedge-fund RSS").
// Reads as a fixed-column matrix so rows stack into an aligned ledger:
//   [TYPE] [qty @ entry] [ ± $ P&L ] [ ± % ]
// Trade type is the opening order action: SHORT → SELL, LONG → BUY. The ± value
// columns populate from the position's live unrealized P&L (a short opened via
// SELL shows its running gain; a flat/unfilled BUY simply has nothing to show).
function RowPnl({ position }) {
  if (!position) return null;
  const up = (position.unrealizedPl || 0) >= 0;
  const isShort = position.side === "SHORT";
  const action = isShort ? "SELL" : "BUY";
  const upCls = up ? "up" : "down";
  return (
    <span className="uc-row-trade mono">
      <span className={`uc-trade-type ${isShort ? "sell" : "buy"}`}>{action}</span>
      <span className="uc-trade-size dim">
        {position.qty} @ ${(position.avgEntry || 0).toFixed(2)}
      </span>
      <span className={`uc-trade-pnl ${upCls}`}>{fmtMoney(position.unrealizedPl)}</span>
      <span className={`uc-trade-pct ${upCls}`}>{fmtPct(position.unrealizedPlPct)}</span>
    </span>
  );
}

function UcRow({ entry, isOpen, onToggle }) {
  return (
    <div
      className={`uc-row ${isOpen ? "uc-row-open" : ""}`}
      onClick={onToggle}
      tabIndex={0}
      role="button"
      aria-expanded={isOpen}
      onKeyDown={(ev) => {
        if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); onToggle(); }
      }}
    >
      <span className="uc-caret dim" aria-hidden="true">{isOpen ? "▾" : "▸"}</span>
      <PositionDot position={entry.position} />
      <span className="uc-ticker mono">{entry.ticker}</span>
      <span className="uc-catalyst">{catalystLabel(entry.catalyst)}</span>
      <UcTierBadge tier={entry.tier} kind={entry.tierKind} />
      {entry.position
        ? <RowPnl position={entry.position} />
        : <span className="uc-subject dim">{entry.subject || ""}</span>}
      <span className="uc-days-away mono dim">
        {entry.daysAway == null ? "—"
          : entry.daysAway === 0 ? "today"
          : entry.daysAway === 1 ? "T-1"
          : `T-${entry.daysAway}`}
      </span>
    </div>
  );
}

// ---------- main ----------

function UpcomingCatalystsWidget({ panel }) {
  const data = panel || UC_EMPTY;
  const [openKey, setOpenKey] = React.useState(null);

  const groups = React.useMemo(() => groupByDate(data.entries), [data.entries]);

  const total = (data.counts && data.counts.total) || 0;
  const held = (data.counts && data.counts.held) || 0;
  const knowledge = data.knowledge;

  return (
    <div className="card upcoming-catalysts">
      <div className="card-head">
        <h3>
          Upcoming Catalysts · next {data.withinDays || 10} days
        </h3>
        <div className="uc-head-right">
          <span className="uc-summary mono dim">
            {total} events · {held} held
          </span>
          {knowledge && knowledge.coveragePct != null && (
            <span className="uc-knowledge mono dim">
              Knowledge 7d: {knowledge.coveragePct}% · both {knowledge.knownBoth} · SB {knowledge.sbOnly}
              {" "}· social {knowledge.socialOnly} ·{" "}
              <span className={knowledge.blind > 0 ? "warn" : ""}>blind {knowledge.blind}</span>
            </span>
          )}
        </div>
      </div>
      <div className="card-body tight uc-body">
        {total === 0 && (
          <div className="uc-empty">No catalysts in the next {data.withinDays || 10} days.</div>
        )}
        {groups.map((g) => (
          <div key={g.date} className="uc-date-group">
            <div className="uc-date-header mono">{formatDateHeader(g.date)}</div>
            {g.rows.map((e) => {
              const key = `${e.date}:${e.ticker}:${e.catalyst}`;
              const isOpen = openKey === key;
              return (
                <div key={key} className="uc-row-wrap">
                  <UcRow
                    entry={e} isOpen={isOpen}
                    onToggle={() => setOpenKey(isOpen ? null : key)}
                  />
                  {isOpen && <UcDetail entry={e} />}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

window.UpcomingCatalystsWidget = UpcomingCatalystsWidget;
window.UC_EMPTY = UC_EMPTY;
