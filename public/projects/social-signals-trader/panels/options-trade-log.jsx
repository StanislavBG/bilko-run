/* global React */
// Options trade log — every credit spread the sleeve opened or closed, with the
// full contract detail frozen at that moment. The point is reviewability: what
// the greeks and prices actually were when we committed, not what they are now,
// and whether the order actually filled — never implying money we don't have.
//
// Two tables, never one: Open Orders (submitted, not yet fully filled — a
// QUEUED order is not a trade) and Trade Log (Alpaca reports filled_qty === qty).
// A row belongs in the Trade Log if and only if the broker says it filled
// completely; everything else, including expired/cancelled/rejected history,
// stays in Open Orders or is dropped, but never counted as a trade.

// OCC parsing + spread classification + money formatting are shared with
// CurrentPositions/TradesTable via window.SpreadFormat (dashboard/lib/spread-format.js)
// — one parser/classifier, not three.
const { g4, money, pctv, num, parseOccSymbol, plainEnglishLeg, spreadStructure, breakeven, dteFromExpiry } = window.SpreadFormat;
const Help = window.Help;

// One feedback button per hand-rolled card head below (Expiry ladder / Trade
// Log / Open Orders never go through options-summary.jsx's <Section>, so
// each wires window.FeedbackButton itself). The id is derived by the same
// componentId() kebab-casing options-summary.jsx's <Section> uses — reused
// via window.OptionsSummaryInternals rather than re-implemented here — so
// "Trade Log" always yields "trade-log" no matter which panel renders it.
function CardFeedbackButton({ label }) {
  if (!window.FeedbackButton) return null;
  const internals = window.OptionsSummaryInternals;
  const id = internals ? internals.componentId(label) : label;
  return <window.FeedbackButton target={{ kind: "component", id, label }} />;
}

// Prefer the broker's own leg intent (authoritative); fall back to
// short=sold / long=bought inference keyed on open vs close event.
function legDirection(record, symbol, isClose) {
  const legs = record && record.response && record.response.legs;
  if (Array.isArray(legs)) {
    const leg = legs.find((l) => l && l.symbol === symbol);
    if (leg && leg.position_intent) {
      return String(leg.position_intent).replace(/_/g, " ").toUpperCase();
    }
    if (leg && leg.side) {
      return `${leg.side.toUpperCase()} TO ${isClose ? "CLOSE" : "OPEN"}`;
    }
  }
  if (symbol && symbol === record.short) return isClose ? "BUY TO CLOSE" : "SELL TO OPEN";
  if (symbol && symbol === record.long) return isClose ? "SELL TO CLOSE" : "BUY TO OPEN";
  return null;
}

// UNFILLED / PARTIAL n/N / FILLED, from the broker response — never inferred
// from status strings alone, since "accepted"/"submitted" say nothing about fills.
function fillState(record) {
  const resp = record.response || {};
  const total = num(resp.qty) ?? num(record.contracts);
  const filled = num(resp.filled_qty) ?? 0;
  if (total == null || total <= 0 || Number.isNaN(total) || Number.isNaN(filled)) return null;
  if (filled <= 0) return { state: "UNFILLED", filled, total };
  if (filled >= total) return { state: "FILLED", filled, total };
  return { state: "PARTIAL", filled, total };
}

function creditReceived(record) {
  const resp = record.response || {};
  const fs = fillState(record);
  if (!fs || fs.filled <= 0) return 0;
  const avgPrice = num(resp.filled_avg_price);
  if (avgPrice == null) return null; // filled but broker hasn't reported an avg price yet — unknown, not zero
  return avgPrice * 100 * fs.filled;
}

// --- Open Orders vs Trade Log classification ----------------------------
// A row is a trade if and only if Alpaca reports it filled completely —
// never inferred from our own submit-time `status` string.
const TERMINAL_LABELS = {
  canceled: "CANCELLED",
  expired: "EXPIRED",
  rejected: "REJECTED",
  unknown_to_broker: "UNKNOWN",
};

function isFullyFilled(record) {
  const resp = record.response || {};
  const qty = num(resp.qty) ?? num(record.contracts);
  const filled_qty = num(resp.filled_qty) ?? 0;
  return qty != null && qty > 0 && filled_qty === qty;
}

// Buckets every submitted order into "trade" (Trade Log) or "open" (Open
// Orders), with a reader-safe label — never a bare broker status string like
// "accepted", which reads as done to a non-trader.
// `kind` doubles as the CSS-badge selector and the "still at risk of not
// filling" test (`kind === "terminal"` — expired/cancelled/rejected/unknown
// orders are resolved, not pending).
function classifyOrder(record) {
  if (isFullyFilled(record)) {
    return { bucket: "trade", label: "FILLED", kind: "filled" };
  }
  const resp = record.response || {};
  const brokerStatus = resp.status;
  const fs = fillState(record);
  if (brokerStatus && TERMINAL_LABELS[brokerStatus]) {
    const label = fs && fs.filled > 0
      ? `${TERMINAL_LABELS[brokerStatus]} ${fs.filled}/${fs.total}`
      : TERMINAL_LABELS[brokerStatus];
    return { bucket: "open", label, kind: "terminal" };
  }
  if (fs && fs.state === "PARTIAL") {
    return { bucket: "open", label: `PARTIAL ${fs.filled}/${fs.total}`, kind: "partial" };
  }
  return { bucket: "open", label: "QUEUED", kind: "unfilled" };
}

// Both legs side by side, each with its own greeks. Rendered for entry and,
// once the spread is flattened, again for exit. `contracts` (the position's
// own contract count) drives the per-leg "net greek × 100 × contracts ="
// scaling shown by each greek cell's <Help/> — undefined degrades to a
// formula-only tooltip rather than a wrong number.
function LegDetail({ title, legs, predatesSnapshots, contracts }) {
  if (legs === undefined || legs === null) {
    return (
      <div className="opt-legs-empty">
        {predatesSnapshots ? "this record predates leg snapshots" : "no snapshot captured"}
      </div>
    );
  }
  if (legs.error) {
    return <div className="opt-legs-empty">snapshot capture failed: {legs.error}</div>;
  }
  const rows = Array.isArray(legs) ? legs : Object.values(legs).filter((l) => l && l.symbol);
  if (!rows.length) return <div className="opt-legs-empty">no snapshot captured</div>;
  return (
    <div className="opt-legblock">
      <div className="opt-legblock-title">{title}</div>
      <table className="opt-table opt-table--legs">
        <thead>
          <tr>
            <th className="al">Contract</th><th>Bid</th><th>Ask</th><th>Mid</th><th>Last</th>
            <th>IV<Help term="iv" /></th>
            <th>Δ<Help term="delta" /></th>
            <th>Γ<Help term="gamma" /></th>
            <th>Θ<Help term="theta" /></th>
            <th>V<Help term="vega" /></th>
            <th>ρ<Help term="rho" /></th>
            <th>Vol</th><th>OI</th><th>Quote time</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((l) => {
            const k = l.greeks || {};
            const asOf = { quotes: l.quote_ts };
            const greekProps = (net_greek) => ({ inputs: { net_greek, contracts }, asOf });
            return (
              <tr key={l.symbol}>
                <td className="al mono-dim">{l.symbol}</td>
                <td>{money(l.bid)}</td>
                <td>{money(l.ask)}</td>
                <td>{money(l.mid)}</td>
                <td>{money(l.last)}</td>
                <td>{pctv(l.iv)}</td>
                <td>{g4(k.delta)}<Help term="delta" {...greekProps(k.delta)} /></td>
                <td>{g4(k.gamma)}<Help term="gamma" {...greekProps(k.gamma)} /></td>
                <td className="neg-tint">{g4(k.theta)}<Help term="theta" {...greekProps(k.theta)} /></td>
                <td>{g4(k.vega)}<Help term="vega" {...greekProps(k.vega)} /></td>
                <td>{g4(k.rho)}<Help term="rho" {...greekProps(k.rho)} /></td>
                <td className="mono-dim">{(l.volume || 0).toLocaleString()}</td>
                <td className="mono-dim">{(l.open_interest || 0).toLocaleString()}</td>
                <td className="mono-dim">{l.quote_ts ? String(l.quote_ts).replace("T", " ") : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// One key scheme for both rows and the detail page: prefer the broker's own
// order id, but only when it's unique across the whole log — a duplicated or
// missing client_order_id falls back to the event's own index so every row
// still gets a stable, collision-free key.
function tradeKey(ev, i) {
  const events = (window.SPREAD_LOG && window.SPREAD_LOG.events) || [];
  const id = ev && ev.client_order_id;
  if (id != null) {
    const count = events.filter((e) => e && e.client_order_id === id).length;
    if (count === 1) return String(id);
  }
  return "i" + i;
}

// Inverse of tradeKey: walk `log.events` looking for the event whose key
// matches. Returns null (never throws) when the log is missing/empty or the
// key matches nothing — a stale bookmark against a regenerated log.
function resolveTrade(key, log) {
  const events = (log && log.events) || [];
  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    if (tradeKey(ev, i) === key) {
      return { ev, index: i, classification: classifyOrder(ev) };
    }
  }
  return null;
}

// Derive every value a row (either table) needs to render, once per event.
// `classification` is computed once per event by the caller (see
// OptionsTradeLog's bucketing pass) and threaded through here rather than
// re-run per row.
function tradeFacts(ev, classification) {
  const isClose = ev.event === "close";
  const shortParsed = parseOccSymbol(ev.short);
  const longParsed = parseOccSymbol(ev.long);
  const structure = spreadStructure(shortParsed, longParsed, ev.ticker);
  const fs = fillState(ev);
  const received = creditReceived(ev);
  // Close events keep the entry credit under `entry_credit`, not `credit` —
  // same value, different field name, so this must match every other reader
  // of "what did we collect" (headlineSentence, OpenOrdersTable's atRiskCredit).
  const maxGain = ev.credit ?? ev.entry_credit;
  const maxLoss = ev.risk;
  const be = breakeven(shortParsed, maxGain, ev.contracts);
  const riskReward = maxLoss != null && maxGain ? maxLoss / maxGain : null;
  const pnl = isClose ? ev.realized_pnl : null;
  return { isClose, shortParsed, longParsed, structure, fs, received, maxGain, maxLoss, be, riskReward, pnl, classification };
}

// Legacy detail view: structure blurb, decoded legs, key/value detail grid,
// and both entry/exit greek snapshots. No row expands inline any more — every
// row opens dashboard/pages/option-trade-detail.jsx as a full page instead
// (see openDetail() below). Kept exported for back-compat rather than deleted
// outright — out of scope for this PRD to remove.
function TradeDetail({ ev, facts }) {
  const { isClose, structure, fs, received, maxGain, maxLoss, be, riskReward, pnl, classification } = facts;
  return (
    <div className="opt-trade-body">
      {structure && structure.gloss && (
        <p className="opt-structure-gloss">{structure.name} — {structure.gloss}</p>
      )}
      <div className="opt-legblock">
        <div className="opt-legblock-title">Legs</div>
        <ul className="opt-leg-lines">
          <li>
            <span className="opt-leg-dir">{legDirection(ev, ev.short, isClose) || "—"}</span>{" "}
            <span className="mono-dim">{ev.short}</span> — {plainEnglishLeg(ev.short)}
          </li>
          <li>
            <span className="opt-leg-dir">{legDirection(ev, ev.long, isClose) || "—"}</span>{" "}
            <span className="mono-dim">{ev.long}</span> — {plainEnglishLeg(ev.long)}
          </li>
        </ul>
      </div>
      <div className="opt-kv">
        {[
          ["Max gain (credit)", money(maxGain)],
          ["Max loss (risk)", money(maxLoss)],
          ["Breakeven", be != null ? money(be) : null],
          ["Risk:reward", riskReward != null ? `${riskReward.toFixed(1)} : 1 against` : null],
          ["Credit if filled", money(ev.credit ?? ev.entry_credit)],
          ["Credit received", classification.bucket === "trade" ? money(received) : null],
          ["Realized P&L", isClose ? money(pnl) : null],
          ["Fill state", classification.label],
          ["EV at entry", money(ev.ev)],
          ["Win prob (POP)", pctv(ev.pop)],
          ["DTE", ev.dte],
          ["Expiry", ev.expiry || (facts.shortParsed ? facts.shortParsed.expiry : null)],
          ["Spot at entry", money(ev.spot_at_entry)],
          ["IV at entry", pctv(ev.iv_at_entry)],
          ["Width", money(ev.width)],
          ["Contracts", ev.contracts],
          ["Credit per contract", money(ev.credit_per_contract)],
          ["Profit target", pctv(ev.profit_target_pct)],
          ["Exit cost", isClose ? money(ev.exit_cost) : null],
          ["Reason", ev.reason],
          ["Order id", ev.client_order_id],
          ["Broker order status", ev.response ? ev.response.status : null],
          ["Broker limit price", ev.response && ev.response.limit_price != null ? money(num(ev.response.limit_price)) : null],
          ["Time in force", ev.response ? ev.response.time_in_force : null],
          ["Submitted at", ev.response && ev.response.submitted_at ? String(ev.response.submitted_at).replace("T", " ") : null],
          ["Filled at", ev.response && ev.response.filled_at ? String(ev.response.filled_at).replace("T", " ") : null],
        ].filter(([, v]) => v != null && v !== "—").map(([k, v]) => (
          <div className="opt-kv-item" key={k}>
            <span className="opt-kv-k">{k}</span>
            <span className="opt-kv-v">{v}</span>
          </div>
        ))}
      </div>
      <LegDetail title="Legs at entry" legs={ev.entry_legs} predatesSnapshots={!("entry_legs" in ev)} contracts={ev.contracts} />
      {isClose && <LegDetail title="Legs at exit" legs={ev.exit_legs} predatesSnapshots={!("exit_legs" in ev)} contracts={ev.contracts} />}
    </div>
  );
}

function StructureCell({ facts, ev }) {
  return (
    <>
      <div>{facts.structure ? facts.structure.name : "Credit spread"}</div>
      <div className="mono-dim">
        {facts.shortParsed && facts.longParsed
          ? `$${facts.shortParsed.strike}/$${facts.longParsed.strike}`
          : (ev.short_strike ? `${ev.short_strike}/${ev.long_strike}` : ev.short)}
      </div>
    </>
  );
}

// --- Expiry ladder + Expires column --------------------------------------
// `expiry` is frozen purchase-time data; the day count is always recomputed
// from it at render time (never read back from the stored `dte`, which
// would freeze at its entry-time value forever).
function resolveExpiry(ev, facts) {
  return ev.expiry
    || (facts.shortParsed ? facts.shortParsed.expiry : null)
    || (facts.longParsed ? facts.longParsed.expiry : null)
    || null;
}

function formatExpiryDate(expiry) {
  if (!expiry) return null;
  const d = new Date(expiry + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function formatLadderDate(expiry) {
  const d = new Date(expiry + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return expiry;
  const dow = d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
  const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return `${dow} ${date}`;
}

function dteUrgencyClass(dte) {
  if (dte <= 2) return "neg-tint";
  if (dte <= 5) return "warn";
  return "mono-dim";
}

function closeDateLabel(ev) {
  const resp = ev.response || {};
  const ts = resp.filled_at || ev.ts;
  const d = ts ? new Date(ts) : null;
  if (!d || Number.isNaN(d.getTime())) return "Closed";
  return `Closed ${d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}`;
}

// `outcome`, when set, overrides the live countdown for rows that are done
// (a filled close, or an order the broker reports expired) — dte alone
// can't distinguish "resolved" from "still ticking down".
function ExpiresCell({ ev, facts, outcome }) {
  if (outcome) return <span className="mono-dim">{outcome}</span>;
  const expiry = resolveExpiry(ev, facts);
  const dateStr = formatExpiryDate(expiry);
  if (!dateStr) return <span className="mono-dim">—</span>;
  const dte = dteFromExpiry(expiry);
  if (dte == null) return <span className="mono-dim">{dateStr}</span>;
  if (dte < 0) return <span className="mono-dim">Expired</span>;
  return <span className={dteUrgencyClass(dte)}>{dateStr} · {dte}d</span>;
}

// One row per distinct expiry date across every still-open position — an
// open trade-log "open" event with no matching "close" for the same
// ticker/short/long. Matched FIFO in chronological order so re-entering the
// identical contract combo after a prior close (same ticker/short/long,
// different day) nets out only the one close it actually pairs with, not
// every open sharing that key. Risk is summed from facts.maxLoss (ev.risk),
// the same value already rendered per-row — never recomputed a second way.
function computeOpenPositions(trades) {
  const byTime = [...trades].sort((a, b) => new Date(a.ev.ts) - new Date(b.ev.ts));
  const openQueues = new Map(); // key -> FIFO queue of still-open {ev, classification}
  byTime.forEach((t) => {
    const { ev } = t;
    const key = `${ev.ticker}|${ev.short}|${ev.long}`;
    if (ev.event === "close") {
      const q = openQueues.get(key);
      if (q && q.length) q.shift();
    } else {
      if (!openQueues.has(key)) openQueues.set(key, []);
      openQueues.get(key).push(t);
    }
  });
  const remaining = [];
  openQueues.forEach((q) => remaining.push(...q));
  return remaining.map(({ ev, classification }) => ({ ev, facts: tradeFacts(ev, classification) }));
}

// The set of `ev` objects (by reference — trades/computeOpenPositions share
// the same underlying event objects, never clones) still open per
// computeOpenPositions' FIFO matching. O(n) over trades, computed once per
// render and reused by tradeStatus for every row rather than re-run per row.
function computeOpenPositionKeys(trades) {
  return new Set(computeOpenPositions(trades).map(({ ev }) => ev));
}

// A Trade Log row's lifecycle bucket — "open" | "closed" | "expired" — reusing
// computeOpenPositions rather than a second open/closed derivation. A CLOSE
// row is always closed. An OPEN row still present in `openPositionKeys` is
// open, unless the contract's own expiry has already passed with no CLOSE
// ever logged — that's a worthless-expiry roll-off, not a live position. An
// OPEN row no longer in `openPositionKeys` was matched by a CLOSE event
// elsewhere in the log, so the round trip counts as closed. Never throws: a
// record missing `legs`/`expiry`/`realized_pnl` just resolves no expiry and
// falls through to "open" or "closed".
function tradeStatus(ev, facts, openPositionKeys) {
  if (!ev) return "closed";
  if (ev.event === "close") return "closed";
  if (!openPositionKeys || !openPositionKeys.has(ev)) return "closed";
  const expiry = facts ? resolveExpiry(ev, facts) : null;
  const dte = expiry ? dteFromExpiry(expiry) : null;
  return dte != null && dte < 0 ? "expired" : "open";
}

function ExpiryLadder({ positions }) {
  if (!positions.length) return null;
  const groups = new Map();
  positions.forEach(({ ev, facts }) => {
    const expiry = resolveExpiry(ev, facts);
    if (!expiry) return;
    if (!groups.has(expiry)) groups.set(expiry, { expiry, tickers: [], risk: 0, latestEntryTs: null });
    const g = groups.get(expiry);
    g.tickers.push(ev.ticker);
    g.risk += facts.maxLoss || 0;
    const entryTs = (ev.response && ev.response.filled_at) || ev.ts;
    if (entryTs && (!g.latestEntryTs || entryTs > g.latestEntryTs)) g.latestEntryTs = entryTs;
  });
  const rows = Array.from(groups.values()).sort((a, b) => a.expiry.localeCompare(b.expiry));
  if (!rows.length) return null;
  return (
    <section className="card opt-panel opt-ladder">
      <div className="opt-panel-head">
        <h3 className="opt-panel-title">
          Expiry ladder
          <CardFeedbackButton label="Expiry ladder" />
        </h3>
        <div className="opt-panel-stats">
          <span><em>{positions.length}</em> open positions</span>
        </div>
      </div>
      <div className="opt-table-scroll">
        <table className="opt-table opt-table--orders">
          <thead>
            <tr>
              <th className="al">Expires<window.Help term="expiry" /></th>
              <th>DTE<window.Help term="dte" /></th>
              <th>Positions<window.Help term="positions_count" /></th>
              <th className="al">Tickers</th>
              <th>Risk rolling off<window.Help term="risk_rolling_off" /></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const dte = dteFromExpiry(r.expiry);
              const clamped = dte == null ? null : Math.max(0, dte);
              return (
                <tr key={r.expiry}>
                  <td className="al">{formatLadderDate(r.expiry)}</td>
                  <td className={clamped == null ? "mono-dim" : dteUrgencyClass(clamped)}>
                    {clamped == null ? "—" : `${clamped}d`}
                  </td>
                  <td>
                    {r.tickers.length}
                    <window.Help
                      term="positions_count"
                      inputs={{ positions_count: r.tickers.length }}
                    />
                  </td>
                  <td className="al mono-dim">{r.tickers.join(", ")}</td>
                  <td>
                    {money(r.risk)}
                    <window.Help
                      term="risk_rolling_off"
                      inputs={{ risk_rolling_off: r.risk }}
                      asOf={{ entry: r.latestEntryTs }}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// kind -> badge modifier class ("unfilled"/"filled" never reach Open Orders).
const OPEN_ORDER_BADGE_CLASS = { terminal: "terminal", partial: "fill-partial", unfilled: "fill-unfilled" };

// One resting/unfilled/partially-filled/terminal order. The label is never a
// bare broker status string — QUEUED / PARTIAL n/N / EXPIRED / CANCELLED /
// REJECTED / UNKNOWN only.
function OpenOrderRow({ ev, classification, index }) {
  const facts = tradeFacts(ev, classification);
  const resp = ev.response || {};
  const openDetail = () => { location.hash = "trade/" + encodeURIComponent(tradeKey(ev, index)); };
  const onKeyDown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openDetail();
    }
  };
  // A PARTIAL fill has already put `fs.filled` contracts' worth of risk on
  // the books — an unfilled/QUEUED order hasn't put any on yet, so its
  // hypothetical numbers use the full ordered count. Never the ordered
  // count for a PARTIAL, which would overstate what's actually at risk.
  const calcContracts = facts.fs && facts.fs.state === "PARTIAL" ? facts.fs.filled : ev.contracts;
  const orderCredit = ev.credit ?? ev.entry_credit;
  const asOf = { entry: resp.submitted_at };
  const shortStrike = facts.shortParsed ? facts.shortParsed.strike : undefined;
  const right = facts.shortParsed ? facts.shortParsed.right : undefined;
  return (
    <tr className="opt-row" onClick={openDetail} tabIndex={0} role="link" onKeyDown={onKeyDown}>
      <td className="al">
        <span className="opt-chev">›</span>
        <span className={`opt-badge opt-badge--${OPEN_ORDER_BADGE_CLASS[classification.kind]}`}>
          {classification.label}
        </span>
      </td>
      <td className="al"><strong className="opt-ticker">{ev.ticker}</strong></td>
      <td className="al"><StructureCell facts={facts} ev={ev} /></td>
      <td>
        <ExpiresCell
          ev={ev}
          facts={facts}
          outcome={classification.kind === "terminal" && classification.label.startsWith("EXPIRED") ? "Expired" : null}
        />
      </td>
      <td>{ev.contracts}</td>
      <td>{resp.limit_price != null ? money(num(resp.limit_price)) : "—"}</td>
      <td className="mono-dim">
        {money(orderCredit)}
        <Help
          term="credit_if_filled"
          inputs={{ limit_price: num(resp.limit_price), contracts: calcContracts }}
          asOf={asOf}
        />
      </td>
      <td>
        {money(facts.maxLoss)}
        <Help term="max_loss" inputs={{ width: ev.width, contracts: calcContracts, credit: orderCredit }} asOf={asOf} />
      </td>
      <td>
        {facts.be != null ? money(facts.be) : "—"}
        <Help
          term="breakeven"
          inputs={{ short_strike: shortStrike, credit: orderCredit, contracts: calcContracts, right }}
          asOf={asOf}
        />
      </td>
      <td>{resp.submitted_at ? String(resp.submitted_at).replace("T", " ").slice(0, 19) : "—"}</td>
      <td>{resp.time_in_force || "—"}</td>
    </tr>
  );
}

// One order Alpaca reports 100% filled — the only rows that count as trades.
// The trade's own feedback target — the id is the SAME key the #trade/<key>
// detail route resolves back via resolveTrade(), so a row's feedback always
// joins to the trade the visitor was actually looking at.
function tradeFeedbackTarget(ev, facts, index) {
  const structureName = facts.structure ? facts.structure.name : "credit spread";
  return {
    kind: "trade",
    id: tradeKey(ev, index),
    label: `${ev.ticker || "this ticker"} ${structureName}`,
  };
}

function TradeLogRow({ ev, classification, index }) {
  const facts = tradeFacts(ev, classification);
  const { isClose, received, pnl, maxGain } = facts;
  const resp = ev.response || {};
  const openDetail = () => { location.hash = "trade/" + encodeURIComponent(tradeKey(ev, index)); };
  const onKeyDown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openDetail();
    }
  };
  // Closed trades are final — stamp with the fill/close time, never a live
  // quote, so a settled number can never read as a moving mark.
  const asOf = { entry: resp.filled_at };
  return (
    <tr className="opt-row" onClick={openDetail} tabIndex={0} role="link" onKeyDown={onKeyDown}>
      <td className="al">
        <span className="opt-chev">›</span>
        <span className={`opt-badge opt-badge--${isClose ? "close" : "open"}`}>{isClose ? "CLOSE" : "OPEN"}</span>
      </td>
      <td className="al"><strong className="opt-ticker">{ev.ticker}</strong></td>
      <td className="al"><StructureCell facts={facts} ev={ev} /></td>
      <td><ExpiresCell ev={ev} facts={facts} outcome={isClose ? closeDateLabel(ev) : null} /></td>
      <td>{ev.contracts}</td>
      <td className="up">
        {money(received)}
        <Help
          term="credit_received"
          inputs={{ net_per_contract: num(resp.filled_avg_price), contracts: facts.fs && facts.fs.filled }}
          asOf={asOf}
        />
      </td>
      <td>{resp.filled_at ? String(resp.filled_at).replace("T", " ").slice(0, 19) : "—"}</td>
      <td>
        {isClose ? <span className={pnl >= 0 ? "up" : "down"}>{money(pnl)}</span> : "—"}
        {isClose && (
          <Help term="realized_pl" inputs={{ credit_received: maxGain, exit_cost: ev.exit_cost }} asOf={asOf} />
        )}
      </td>
      <td className="opts-col-feedback">
        {window.FeedbackButton && (
          <window.FeedbackButton target={tradeFeedbackTarget(ev, facts, index)} />
        )}
      </td>
    </tr>
  );
}

function OpenOrdersTable({ orders }) {
  const atRiskCredit = orders
    .filter((o) => o.classification.kind !== "terminal")
    .reduce((n, o) => n + (o.ev.credit ?? o.ev.entry_credit ?? 0), 0);
  return (
    <section className="card opt-panel">
      <div className="opt-panel-head">
        <h3 className="opt-panel-title">
          Open Orders
          <CardFeedbackButton label="Open Orders" />
        </h3>
        <div className="opt-panel-stats">
          <span><em>{orders.length}</em> orders</span>
          <span>target <em className="mono-dim">{money(atRiskCredit)}</em> if filled</span>
        </div>
      </div>
      {!orders.length ? (
        <p className="opt-log-empty">No open orders.</p>
      ) : (
        <div className="opt-table-scroll">
          <table className="opt-table opt-table--orders">
            <thead>
              <tr>
                <th className="al">Status</th><th className="al">Ticker</th><th className="al">Structure</th>
                <th>Expires</th>
                <th>Contracts</th>
                <th>Limit<window.Help term="limit_price" /></th>
                <th>Credit if filled<window.Help term="credit_if_filled" /></th>
                <th>Max loss<window.Help term="max_loss" /></th>
                <th>Breakeven<window.Help term="breakeven" /></th>
                <th>Submitted</th>
                <th>TIF<window.Help term="tif" /></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <OpenOrderRow key={(o.ev.client_order_id || "") + o.index} ev={o.ev} classification={o.classification} index={o.index} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

const TRADE_STATUS_FILTERS = [
  { key: "all", label: "All" },
  { key: "open", label: "Open" },
  { key: "closed", label: "Closed" },
  { key: "expired", label: "Expired" },
];

const TRADE_STATUS_LABEL = { open: "Open", closed: "Closed", expired: "Expired" };

const TRADE_LOG_GROUP_BYS = [
  { key: "none", label: "None" },
  { key: "status", label: "Status" },
  { key: "ticker", label: "Ticker" },
  { key: "expiry", label: "Expiry" },
];

// Group label for a single enriched trade under a given grouping mode.
// Expiry falls back to a trailing "Unknown expiry" bucket rather than
// dropping the row when the contract's expiry can't be resolved at all.
function groupLabelFor(groupBy, t) {
  if (groupBy === "status") return TRADE_STATUS_LABEL[t.status] || "Unknown status";
  if (groupBy === "ticker") return t.ev.ticker || "Unknown ticker";
  if (groupBy === "expiry") {
    const expiry = resolveExpiry(t.ev, t.facts);
    if (!expiry) return "Unknown expiry";
    return formatExpiryDate(expiry) || expiry;
  }
  return null;
}

function realizedOf(trades) {
  return trades
    .filter((t) => t.ev.event === "close")
    .reduce((n, t) => n + (t.ev.realized_pnl || 0), 0);
}

function GroupHeaderRow({ label, count, realized }) {
  // One real <td> per column below (see the 8 headers) rather than a
  // spanning cell — this panel deliberately removed that inline-detail-row
  // pattern (PRD 1013) and must not reintroduce it.
  return (
    <tr className="opt-group-row">
      <td className="al opt-group-label">
        {label} <span className="opt-group-count">{count}</span> · realized{" "}
        <span className={realized >= 0 ? "up" : "down"}>{money(realized)}</span>
      </td>
      <td /><td /><td /><td /><td /><td /><td /><td />
    </tr>
  );
}

function TradeLogTable({ trades }) {
  const { useState } = React;
  const [filter, setFilter] = useState("all");
  const [groupBy, setGroupBy] = useState("none");

  // O(n) over trades: one facts + status derivation per row, computed once
  // per render and reused by the counts, the filter, and the grouping below.
  const openPositionKeys = computeOpenPositionKeys(trades);
  const enriched = trades.map((t) => {
    const facts = tradeFacts(t.ev, t.classification);
    return { ...t, facts, status: tradeStatus(t.ev, facts, openPositionKeys) };
  });

  const counts = { all: enriched.length, open: 0, closed: 0, expired: 0 };
  enriched.forEach((t) => { counts[t.status] = (counts[t.status] || 0) + 1; });

  const visible = filter === "all" ? enriched : enriched.filter((t) => t.status === filter);
  const realizedVisible = realizedOf(visible);

  let groups = null;
  if (groupBy !== "none") {
    const order = [];
    const byLabel = new Map();
    visible.forEach((t) => {
      const label = groupLabelFor(groupBy, t);
      if (!byLabel.has(label)) { byLabel.set(label, []); order.push(label); }
      byLabel.get(label).push(t);
    });
    groups = order.map((label) => ({ label, rows: byLabel.get(label) }));
    if (groupBy === "expiry") {
      groups.sort((a, b) => {
        if (a.label === "Unknown expiry") return 1;
        if (b.label === "Unknown expiry") return -1;
        return a.label.localeCompare(b.label);
      });
    }
  }

  return (
    <section className="card opt-panel">
      <div className="opt-panel-head">
        <h3 className="opt-panel-title">
          Trade Log
          <CardFeedbackButton label="Trade Log" />
        </h3>
        <div className="opt-panel-stats">
          <span><em>{visible.length}</em> trades <span className="mono-dim">of {enriched.length}</span></span>
          <span>realized <em className={realizedVisible >= 0 ? "up" : "down"}>{money(realizedVisible)}</em></span>
        </div>
      </div>
      {!enriched.length ? (
        <p className="opt-log-empty">No filled trades yet.</p>
      ) : (
        <>
          <div className="opt-filter-row">
            <div className="opt-filter-group" role="group" aria-label="Filter by status">
              {TRADE_STATUS_FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  className={`opt-filter-btn${filter === f.key ? " opt-filter-btn--active" : ""}`}
                  onClick={() => setFilter(f.key)}
                >
                  {f.label} <span className="opt-filter-count">{counts[f.key] || 0}</span>
                </button>
              ))}
              <Help term="trade_status_filter" />
            </div>
            <div className="opt-group-select">
              <label htmlFor="opt-trade-log-group-by">Group by:</label>
              <select
                id="opt-trade-log-group-by"
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value)}
              >
                {TRADE_LOG_GROUP_BYS.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}
              </select>
              <Help term="trade_log_group_by" />
            </div>
          </div>
          {!visible.length ? (
            <p className="opt-log-empty">No {filter} trades.</p>
          ) : (
            <div className="opt-table-scroll">
              <table className="opt-table opt-table--orders">
                <thead>
                  <tr>
                    <th className="al">Event<window.Help term="trade_event" /></th>
                    <th className="al">Ticker</th>
                    <th className="al">Structure<window.Help term="spread" /></th>
                    <th>Expires<window.Help term="expiry" /></th>
                    <th>Contracts<window.Help term="contracts" /></th>
                    <th>Credit received<window.Help term="credit_received" /></th>
                    <th>Filled<window.Help term="filled_at" /></th>
                    <th>Realized P&amp;L<window.Help term="realized_pl" /></th>
                    <th className="sr-only">Feedback</th>
                  </tr>
                </thead>
                <tbody>
                  {groups
                    ? groups.map((g) => (
                        <React.Fragment key={g.label}>
                          <GroupHeaderRow label={g.label} count={g.rows.length} realized={realizedOf(g.rows)} />
                          {g.rows.map((t) => (
                            <TradeLogRow key={(t.ev.client_order_id || "") + t.index} ev={t.ev} classification={t.classification} index={t.index} />
                          ))}
                        </React.Fragment>
                      ))
                    : visible.map((t) => (
                        <TradeLogRow key={(t.ev.client_order_id || "") + t.index} ev={t.ev} classification={t.classification} index={t.index} />
                      ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}

// Same parts-not-a-fixed-stack shape as window.optionsSummaryParts: the
// Options Log page interleaves the Expiry ladder with the summary cards
// (ladder half-width near the top, Trade Log full width lower down), so each
// card is handed back on its own. OptionsTradeLog below is these parts in the
// default stacked order — one definition of each table either way.
function optionsTradeLogParts(log) {
  const data = log || window.SPREAD_LOG;
  if (!data || !data.events || !data.events.length) {
    return {
      empty: (
        <section className="card opt-log">
          <h3 className="opt-log-title">Options trade log</h3>
          <p className="opt-log-empty">
            No spread activity yet. Generate with{" "}
            <code>python -m social_signals_trader.spread_trader --export-log</code>.
          </p>
        </section>
      ),
    };
  }

  const openOrders = [];
  const trades = [];
  data.events.forEach((ev, index) => {
    const classification = classifyOrder(ev);
    (classification.bucket === "trade" ? trades : openOrders).push({ ev, classification, index });
  });
  const openPositions = computeOpenPositions(trades);

  return {
    empty: null,
    expiryLadder: <ExpiryLadder positions={openPositions} />,
    tradeLog: <TradeLogTable trades={trades} />,
    openOrders: <OpenOrdersTable orders={openOrders} />,
    foot: (
      <p className="opt-log-foot">
        Greeks and prices are frozen at the moment of the order — entry legs from
        just before submission, exit legs from the close. Δ delta · Γ gamma ·
        Θ theta · V vega · ρ rho. Quotes are Alpaca’s indicative feed. Open
        Orders shows a target credit, grey, not money received — a row only
        moves to the Trade Log once Alpaca reports it filled completely.
      </p>
    ),
  };
}

function OptionsTradeLog({ log }) {
  const parts = optionsTradeLogParts(log);
  if (parts.empty) return parts.empty;
  return (
    // Trade Log leads at full width: it is the denser table and the one that
    // records what actually happened. Open Orders sits below it — intent, not
    // history. Side by side, both were squeezed into half a column and the
    // numeric columns wrapped.
    <div className="opt-log opt-log--stacked">
      <div className="opt-log-stack">
        {parts.expiryLadder}
        {parts.tradeLog}
        {parts.openOrders}
      </div>
      {parts.foot}
    </div>
  );
}

window.OptionsTradeLog = OptionsTradeLog;
window.optionsTradeLogParts = optionsTradeLogParts;
window.OptionsTradeLogInternals = {
  tradeKey, resolveTrade, classifyOrder, tradeFacts, legDirection, fillState,
  creditReceived, LegDetail, TradeDetail, tradeStatus, computeOpenPositionKeys,
};
