/* global React */
// Ticker Details — the premium-selling worksheet.
//
// Live-only: every card comes from a real-time /options/chain call through
// the trader API. What it shows: what the free indicative feed actually
// knows, then the two ladders we care about — cash-secured puts (deploy idle
// cash) and covered calls (rent out shares we already own).
//
// Every contract shown already passed the producer's filters: |delta| <= the
// max-short-delta param (~POP >= 80%), DTE inside the window, and — for puts —
// collateral under the per-contract cash ceiling.

const { useState, useEffect } = React;

const pct = (v) => (v == null ? "—" : (v * 100).toFixed(1) + "%");
const usd = (v) => (v == null ? "—" : "$" + Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 }));
const usd2 = (v) => (v == null ? "—" : "$" + Number(v).toFixed(2));

function Chip({ tone = "neutral", children, title }) {
  const bg = {
    good: "color-mix(in oklch, var(--pos) 18%, transparent)",
    bad: "color-mix(in oklch, var(--neg) 18%, transparent)",
    warn: "color-mix(in oklch, var(--accent) 18%, transparent)",
    neutral: "var(--surface-2)",
  }[tone];
  const fg = { good: "var(--pos)", bad: "var(--neg)", warn: "var(--accent)", neutral: "var(--text-2)" }[tone];
  return (
    <span
      title={title}
      style={{
        background: bg, color: fg, border: "1px solid var(--line)", borderRadius: 999,
        padding: "2px 8px", fontSize: 10, fontFamily: "var(--mono)", whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

// Two cards side by side, each half the page. auto-fit rather than a hard
// `1fr 1fr` so a row with only one live card (or a narrow window) collapses to
// full width instead of leaving a dead column.
function Row2({ children }) {
  const kids = React.Children.toArray(children).filter(Boolean);
  if (!kids.length) return null;
  return <div className="opts-row2">{kids}</div>;
}

// `term` is optional: most Stats here are raw counts with no glossary
// concept behind them. When present with no matching `calc` (e.g. "iv" —
// definition/example only), <Help/> renders the definition and never
// invents a formula for a number that's really just what the live chain
// response reported.
function Stat({ label, value, tone, term, inputs, asOf }) {
  return (
    <div style={{ display: "grid", gap: 2 }}>
      <span style={{ fontSize: 10, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: ".06em" }}>
        {label}
        {term && <window.Help term={term} inputs={inputs} asOf={asOf} />}
      </span>
      <span className={tone} style={{ fontFamily: "var(--mono)", fontSize: 15 }}>{value}</span>
    </div>
  );
}

// POP is 1 - |delta|. Render it as a bar so an 84% and a 96% candidate are
// distinguishable at a glance rather than two similar-looking decimals.
function PopBar({ pop }) {
  const w = Math.max(0, Math.min(1, pop || 0)) * 100;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ flex: 1, height: 6, background: "var(--surface-2)", borderRadius: 3, border: "1px solid var(--line)", position: "relative" }}>
        <div style={{ position: "absolute", inset: 0, right: `${100 - w}%`, background: "var(--pos)", borderRadius: 3, opacity: 0.85 }} />
      </div>
      <span style={{ fontFamily: "var(--mono)", fontSize: 11, width: 44, textAlign: "right" }}>{pct(pop)}</span>
    </div>
  );
}

// The four structures, in the order a premium seller evaluates them.
const LADDERS = [
  { key: "sell_puts", label: "Sell puts", hint: "Cash-secured. Collateral = strike x 100." },
  { key: "put_spreads", label: "Put spreads", hint: "Bull put credit spread. Risk = width - credit, so the same cash funds many more positions." },
  { key: "sell_calls", label: "Sell calls", hint: "Covered. Needs 100+ shares of the underlying." },
  { key: "call_spreads", label: "Call spreads", hint: "Bear call credit spread. Sells calls without owning the shares." },
];

const EMPTY_REASON = {
  sell_puts: "every strike in the window is illiquid, the credit is below the floor, or the cash collateral exceeds the per-contract ceiling — try the put spread instead",
  put_spreads: "no pair of strikes in the window produces a positive credit inside the risk ceiling",
  sell_calls: "no strike above spot pays enough, or the chain has no greeks at this delta",
  call_spreads: "no pair of strikes above spot produces a positive credit inside the risk ceiling",
};

function LadderTable({ rows, kind }) {
  if (!rows || !rows.length) {
    return (
      <p style={{ fontSize: 12, color: "var(--text-3)", margin: "8px 0 0" }}>
        No candidate — {EMPTY_REASON[kind] || "nothing clears the filters"}.
      </p>
    );
  }
  const isSpread = kind === "put_spreads" || kind === "call_spreads";
  const isCoveredCall = kind === "sell_calls";
  return (
    <div style={{ overflowX: "auto", marginTop: 8 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--mono)", fontSize: 11 }}>
        <thead>
          <tr style={{ color: "var(--text-3)", textAlign: "right" }}>
            <th style={{ textAlign: "left", padding: "4px 6px" }}>{isSpread ? "Short / long" : "Contract"}</th>
            <th style={{ padding: "4px 6px" }}>Exp</th>
            <th style={{ padding: "4px 6px" }}>DTE</th>
            <th style={{ padding: "4px 6px" }}>{isSpread ? "Width" : "Strike"}</th>
            <th style={{ padding: "4px 6px" }}>Δ</th>
            <th style={{ padding: "4px 6px", minWidth: 120 }}>Win prob</th>
            <th style={{ padding: "4px 6px" }}>Credit</th>
            <th style={{ padding: "4px 6px" }}>{isSpread ? "Max loss" : isCoveredCall ? "Share value" : "Cash held"}</th>
            <th style={{ padding: "4px 6px" }}>Ann. yield</th>
            <th style={{ padding: "4px 6px" }}>{isCoveredCall ? "Upside cap" : "Breakeven"}</th>
            <th style={{ padding: "4px 6px" }}>IV</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.short_symbol ? r.short_symbol + r.long_symbol : r.symbol} style={{ borderTop: "1px solid var(--line)", textAlign: "right" }}>
              <td style={{ textAlign: "left", padding: "5px 6px", color: "var(--text-2)" }}>
                {isSpread ? `${usd2(r.strike)} / ${usd2(r.long_strike)}` : r.symbol}
              </td>
              <td style={{ padding: "5px 6px" }}>{r.expiry?.slice(5)}</td>
              <td style={{ padding: "5px 6px" }}>{r.dte}d</td>
              <td style={{ padding: "5px 6px" }}>{isSpread ? usd2(r.width) : usd2(r.strike)}</td>
              <td style={{ padding: "5px 6px" }}>{r.delta?.toFixed(3)}</td>
              <td style={{ padding: "5px 6px" }}><PopBar pop={r.pop} /></td>
              <td style={{ padding: "5px 6px" }} className="up">{usd2(r.credit)}</td>
              <td style={{ padding: "5px 6px", color: "var(--text-2)" }}>{usd(r.collateral)}</td>
              <td style={{ padding: "5px 6px" }} className={r.ann_yield >= 0.15 ? "up" : ""}>{pct(r.ann_yield)}</td>
              <td style={{ padding: "5px 6px", color: "var(--text-2)" }}>
                {isCoveredCall ? pct(r.upside_cap_pct) : usd2(r.breakeven)}
              </td>
              <td style={{ padding: "5px 6px", color: "var(--text-2)" }}>{pct(r.iv)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Fund policy — the CREDIT_SPREAD sleeve's live, actually-traded config,
// exported by spread_trader.export_config() as window.SPREAD_CONFIG. This is
// deliberately a separate surface from the ticker worksheet below: the
// worksheet's filters come from options_chain's exploratory scanner constants,
// which are looser on purpose (one explores, one trades) — merging the two
// into a single parameter list is the bug this component exists to avoid.
function StrategyPolicy() {
  const sc = window.SPREAD_CONFIG;
  if (!sc || !sc.config) {
    return (
      <section className="card opts-strategy-card" style={{ borderColor: "var(--neg)" }}>
        <p style={{ color: "var(--neg)", fontSize: 12, margin: 0 }}>
          Strategy config unavailable — dashboard/data-spread-config.js is missing or failed to
          load. Not showing stand-in numbers here on purpose.
        </p>
      </section>
    );
  }
  const c = sc.config;
  // Most of these terms describe a config *threshold* (a band, a ceiling),
  // not a value this file can plug into that term's own calc — the calc's
  // input keys (e.g. pop's short_leg_delta) don't correspond to a single
  // static config field. `max_per_underlying`'s glossary calc is the
  // identity `v => v.max_per_underlying`, so it's the one term here whose
  // live config value substitutes straight in — same additive pattern as
  // options-summary.jsx's RulesInForce (PRD 1026).
  const FIELD_TERM_CONFIG_INPUT = {
    max_per_underlying: { max_per_underlying: c.max_per_underlying },
  };
  // `dash` renders a config field as-is, or an em-dash when the field is
  // absent from window.SPREAD_CONFIG — never `undefined`/`NaN` on screen.
  const dash = (v, fmt) => (v == null ? "—" : fmt ? fmt(v) : v);
  const field = (label, value, gloss, term) => (
    <div style={{ display: "grid", gap: 1 }}>
      <span style={{ fontSize: 9, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: ".06em" }}>
        {label}
        {term && <window.Help term={term} inputs={FIELD_TERM_CONFIG_INPUT[term]} />}
      </span>
      <span style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{value}</span>
      <span style={{ fontSize: 10, color: "var(--text-3)", lineHeight: 1.35 }}>{gloss}</span>
    </div>
  );
  // Compact: this card is an explainer, not a live reading — it sits at the
  // bottom of the page under "Strategy & rules", so it gets narrower columns
  // and smaller type than the live cards above it.
  const grid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "8px 12px", marginTop: 6 };
  const h4 = { fontSize: 10, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--text-3)", marginTop: 10, marginBottom: 0 };

  // The three buy-to-close triggers a SELL leg can hit, shared verbatim by
  // both SELL PUT and SELL CALL so the wording never drifts between legs —
  // only the leg noun ("short put" / "short call") differs.
  const buyToCloseTriggers = (legNoun) => (
    <ul className="opts-strategy-leg-triggers">
      <li>
        <b>Profit target</b> (<span style={{ fontFamily: "var(--mono)" }}>profit_target_pct = {pct(c.profit_target_pct)}</span>
        <window.Help term="profit_target" />) — buy to close once {pct(c.profit_target_pct)} of the entry
        credit is captured. Frees the collateral sooner instead of sitting through the last, highest-gamma
        slice of credit.
      </li>
      <li>
        <b>Strike breach</b> (<span style={{ fontFamily: "var(--mono)" }}>
          close_on_strike_breach = {String(dash(c.close_on_strike_breach))}, strike_breach_buffer_pct = {pct(c.strike_breach_buffer_pct)}
        </span>
        <window.Help term="strike_breach_exit" /> <window.Help term="strike_breach_buffer" />) — buy to close
        if the stock trades past the {legNoun}'s strike by more than the buffer. Caps the loss instead of
        waiting for expiry.
      </li>
      <li>
        <b>Max-loss stop</b> (<span style={{ fontFamily: "var(--mono)" }}>max_loss_pct = {dash(c.max_loss_pct, pct)}</span>
        <window.Help term="max_loss_pct" />) — buy to close once the cost to close equals {dash(c.max_loss_pct, pct)} of
        the credit collected. A second, independent loss cap alongside the strike breach.
      </li>
    </ul>
  );

  const legStyle = { marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--line)" };
  const legTitle = { fontSize: 11, fontWeight: 700, letterSpacing: ".02em", margin: 0 };

  return (
    <section className="card opts-strategy-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
        <h3 style={{ margin: 0, fontSize: 13 }}>CREDIT_SPREAD — fund policy</h3>
        <span style={{ fontSize: 10, color: "var(--text-3)", fontFamily: "var(--mono)" }}>
          config as of {String(sc.generatedAt || "unknown").replace("T", " ")}
        </span>
      </div>
      <p style={{ fontSize: 11, color: "var(--text-2)", marginTop: 4, maxWidth: 760 }}>
        These are the live, actually-traded rules — loaded from data/spread_config.json with any
        SST_SPREAD_* env overrides applied. The ticker worksheet above is an exploratory scan with
        its own, looser filters; it is not this policy.
      </p>

      <h4 style={h4}>Universe</h4>
      <p style={{ fontSize: 11, fontFamily: "var(--mono)", margin: "3px 0 0", color: "var(--text-2)" }} title="The only tickers the sleeve scans and trades.">
        {(c.tickers || []).join(", ")}
      </p>

      <h4 style={h4}>Entry gates</h4>
      <div style={grid}>
        {field("Short-leg delta", `|Δ| ≤ ${dash(c.max_short_delta)}`, "the short strike's delta ceiling — roughly its odds of finishing ITM", "short_leg_delta")}
        {field("Win probability", pct(c.min_pop), "minimum probability of profit required to enter", "pop")}
        {field("DTE window", `${dash(c.min_dte)}–${dash(c.max_dte)}d`, "floor keeps out of 1-DTE gamma; cap keeps capital turning over", "dte")}
        {field("Risk per position", `${usd(c.min_notional)}–${usd(c.max_notional)}`, "capital-at-risk band per position, not a ceiling alone", "risk")}
        {field("Min credit", usd2(c.min_credit), "below this, fees dominate the trade", "min_credit")}
        {field("Expected value", `≥ ${usd2(c.min_ev)}${c.require_positive_ev ? " (must be positive)" : ""}`, "pop × credit − (1−pop) × max loss must clear this", "ev")}
        {field("Ann. yield floor", c.min_ann_yield > 0 ? pct(c.min_ann_yield) : "off (0)", c.min_ann_yield > 0 ? "minimum annualized yield required" : "not used — a high yield floor mechanically forces 1-DTE risk", "ann_yield")}
      </div>

      <h4 style={h4}>Book limits</h4>
      <div style={grid}>
        {field("Max positions", dash(c.max_positions), "open spreads across the whole book at once", "max_positions")}
        {field("Max total risk", `${dash(c.max_total_risk_equity_multiple)}× equity`, "capital-at-risk ceiling across every open spread, scaled to live equity", "max_total_risk")}
        {field("Max per underlying", dash(c.max_per_underlying), "at most this many open spreads per name at a time", "max_per_underlying")}
        {field("Margin buffer", pct(c.margin_buffer_pct), "new entries are refused once maintenance margin would exceed equity minus this buffer", "margin_buffer_pct")}
      </div>

      <h4 style={h4}>Legs — who sells, who buys, and why</h4>
      <p style={{ fontSize: 11, color: "var(--text-2)", margin: "3px 0 0", maxWidth: 760 }}>
        Every position is a vertical spread: one leg <b>sold to open</b><window.Help term="sell_to_open" /> for{" "}
        <b>credit received</b><window.Help term="credit_received" /> (money in), one leg{" "}
        <b>bought to open</b><window.Help term="buy_to_open" /> for a <b>debit paid</b>
        <window.Help term="debit_paid" /> (money out) that caps the loss. A short put spread pairs SELL PUT +
        BUY PUT; a short call spread pairs SELL CALL + BUY CALL — this sleeve never trades a naked leg.
      </p>

      <div style={legStyle}>
        <h5 style={legTitle}>SELL PUT (short leg — the credit)<window.Help term="short_leg" /></h5>
        <p style={{ fontSize: 11, color: "var(--text-2)", margin: "3px 0 0", maxWidth: 760 }}>
          <b>Opens:</b> SELL TO OPEN a put at or below the short-leg delta ceiling (
          <span style={{ fontFamily: "var(--mono)" }}>|Δ| ≤ {dash(c.max_short_delta)}</span>) with win
          probability at least <span style={{ fontFamily: "var(--mono)" }}>{pct(c.min_pop)}</span> and{" "}
          <span style={{ fontFamily: "var(--mono)" }}>{dash(c.min_dte)}–{dash(c.max_dte)}d</span> to expiry —
          the same Entry gates above, applied to this leg specifically. This is the credit-collecting leg: the
          bet is the stock stays above this strike.
        </p>
        <p style={{ fontSize: 11, color: "var(--text-2)", margin: "6px 0 0" }}><b>Closes — buy to close</b><window.Help term="buy_to_close" />:</p>
        {buyToCloseTriggers("short put")}
      </div>

      <div style={legStyle}>
        <h5 style={legTitle}>BUY PUT (long leg — the loss cap)<window.Help term="long_leg" /></h5>
        <p style={{ fontSize: 11, color: "var(--text-2)", margin: "3px 0 0", maxWidth: 760 }}>
          <b>Opens:</b> BUY TO OPEN a lower-strike put in the same order as its SELL PUT, sized to the Risk
          per position band above (<span style={{ fontFamily: "var(--mono)" }}>{usd(c.min_notional)}–{usd(c.max_notional)}</span>).
          This leg is never opened on its own — it exists purely to convert the short put's uncapped risk into
          a defined max loss (width minus credit received).
        </p>
        <p style={{ fontSize: 11, color: "var(--text-2)", margin: "6px 0 0" }}>
          <b>Closes:</b> BUY TO CLOSE the SELL PUT is what actually locks in profit or loss on this pair — the
          long put is sold to close (or expires worthless) alongside it, same order, same moment. It is never
          traded independently of its short leg.
        </p>
      </div>

      <div style={legStyle}>
        <h5 style={legTitle}>SELL CALL (short leg — the credit)<window.Help term="short_leg" /></h5>
        <p style={{ fontSize: 11, color: "var(--text-2)", margin: "3px 0 0", maxWidth: 760 }}>
          <b>Opens:</b> SELL TO OPEN a call at or below the short-leg delta ceiling (
          <span style={{ fontFamily: "var(--mono)" }}>|Δ| ≤ {dash(c.max_short_delta)}</span>) with win
          probability at least <span style={{ fontFamily: "var(--mono)" }}>{pct(c.min_pop)}</span> and{" "}
          <span style={{ fontFamily: "var(--mono)" }}>{dash(c.min_dte)}–{dash(c.max_dte)}d</span> to expiry —
          the same Entry gates above, applied to this leg specifically. This is the credit-collecting leg: the
          bet is the stock stays below this strike.
        </p>
        <p style={{ fontSize: 11, color: "var(--text-2)", margin: "6px 0 0" }}><b>Closes — buy to close</b><window.Help term="buy_to_close" />:</p>
        {buyToCloseTriggers("short call")}
      </div>

      <div style={legStyle}>
        <h5 style={legTitle}>BUY CALL (long leg — the loss cap)<window.Help term="long_leg" /></h5>
        <p style={{ fontSize: 11, color: "var(--text-2)", margin: "3px 0 0", maxWidth: 760 }}>
          <b>Opens:</b> BUY TO OPEN a higher-strike call in the same order as its SELL CALL, sized to the Risk
          per position band above (<span style={{ fontFamily: "var(--mono)" }}>{usd(c.min_notional)}–{usd(c.max_notional)}</span>).
          This leg is never opened on its own — it exists purely to convert the short call's uncapped risk
          into a defined max loss (width minus credit received).
        </p>
        <p style={{ fontSize: 11, color: "var(--text-2)", margin: "6px 0 0" }}>
          <b>Closes:</b> BUY TO CLOSE the SELL CALL is what actually locks in profit or loss on this pair —
          the long call is sold to close (or expires worthless) alongside it, same order, same moment. It is
          never traded independently of its short leg.
        </p>
      </div>
    </section>
  );
}

function TickerCard({ row, params, asOf }) {
  const [tab, setTab] = useState("put_spreads");
  const rows = row[tab];
  const active = LADDERS.find((l) => l.key === tab);
  // The page's own asOf is the client-observed completion time of the live
  // optionChain() call this row came from — the closest thing to "the
  // timestamp the live response actually carries" available here.
  const ivAsOf = asOf ? { quotes: asOf } : undefined;

  return (
    <section className="card" style={{ padding: 14, marginTop: 12 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <h3 style={{ margin: 0, fontSize: 18 }}>{row.ticker}</h3>
          <span style={{ fontFamily: "var(--mono)", color: "var(--text-2)" }}>{usd2(row.spot)}</span>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {row.error && <Chip tone="bad" title={row.error}>chain error</Chip>}
          {row.csp_blocked_by_capital && (
            <Chip tone="warn" title={`A cash-secured put needs strike x 100 in cash. At ${usd2(row.spot)} that exceeds the ${usd(params.max_collateral)} per-contract ceiling.`}>
              CSP over cash ceiling
            </Chip>
          )}
          {row.lots > 0
            ? <Chip tone="good" title={`${row.shares_owned} shares = ${row.lots} covered-call lot(s)`}>{row.lots} lot{row.lots > 1 ? "s" : ""} coverable</Chip>
            : <Chip tone="neutral" title="Covered calls need 100+ shares of the underlying.">no shares held</Chip>}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 12, marginTop: 12 }}>
        <Stat label="Contracts scanned" value={row.contracts_scanned} />
        <Stat label="Expiries in window" value={row.expiries?.length || 0} />
        <Stat label="Avg IV" value={pct(row.atm_iv)} term="iv" asOf={ivAsOf} />
        <Stat label="Shares owned" value={row.shares_owned} />
        <Stat label="Cheapest defined risk" value={usd(cheapestRisk(row))} />
        <Stat label="Candidates" value={LADDERS.reduce((n, l) => n + (row[l.key]?.length || 0), 0)} />
      </div>

      <div style={{ display: "flex", gap: 6, marginTop: 14, flexWrap: "wrap" }}>
        {LADDERS.map((l) => (
          <button
            key={l.key}
            onClick={() => setTab(l.key)}
            title={l.hint}
            style={{
              fontSize: 11, padding: "4px 10px",
              background: tab === l.key ? "var(--accent)" : "var(--surface-2)",
              color: tab === l.key ? "var(--bg)" : "var(--text-2)",
              border: "1px solid var(--line)", borderRadius: 6, cursor: "pointer",
            }}
          >
            {l.label} ({row[l.key]?.length || 0})
          </button>
        ))}
      </div>
      {active && <p style={{ fontSize: 11, color: "var(--text-3)", margin: "8px 0 0" }}>{active.hint}</p>}

      <LadderTable rows={rows} kind={tab} />
    </section>
  );
}

// The smallest amount of capital that puts a trade on for this name — the
// number that decides how many positions the book can actually hold.
function cheapestRisk(row) {
  const all = LADDERS.flatMap((l) => row[l.key] || []).map((r) => r.collateral).filter((v) => v > 0);
  return all.length ? Math.min(...all) : null;
}

// #options/AAPL and ?ticker=AAPL both deep-link a single stock. The hash form is
// canonical (it survives the static-site routing); the query form is accepted so
// a link pasted from anywhere still works.
function tickerFromUrl() {
  const fromHash = (location.hash || "").replace("#", "").split("/")[1];
  if (fromHash) return decodeURIComponent(fromHash).toUpperCase();
  const q = new URLSearchParams(location.search || "").get("ticker");
  return q ? q.toUpperCase() : "";
}

// One ticker in, its option detail out. Live-only: every render comes from
// window.OptimizationClient.optionChain() (a real Alpaca call through the
// trader API), never a bundled snapshot. The only snapshotting in this app
// happens at trade time (options_chain.snapshot_legs), not here.
function TickerDetailsPage() {
  const urlTicker = tickerFromUrl();

  const [input, setInput] = useState(urlTicker);
  const [row, setRow] = useState(null);
  const [params, setParams] = useState({});
  const [feed, setFeed] = useState("indicative");
  const [asOf, setAsOf] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  const lookup = async (raw) => {
    const t = String(raw || input).trim().toUpperCase();
    if (!t) return;
    setBusy(true);
    setNote("");
    // Make the URL match what's on screen, so the view is shareable/bookmarkable.
    if (tickerFromUrl() !== t) location.hash = `options/${t}`;
    try {
      const res = await window.OptimizationClient.optionChain(t, {
        max_dte: params.max_dte,
        max_collateral: params.max_collateral,
      });
      setRow(res.ticker);
      setParams(res.params || params);
      setFeed(res.feed || feed);
      setAsOf(new Date().toISOString().slice(0, 19));
      if (res.ticker && res.ticker.error) setNote(`Chain error: ${res.ticker.error}`);
    } catch (err) {
      setRow(null);
      setAsOf("");
      setNote(
        `Live lookup failed (${err.message}). Start the local API with ` +
        `\`.venv/bin/python -m social_signals_trader.optimization_api\`.`
      );
    } finally {
      setBusy(false);
    }
  };

  // A deep link should render that ticker without the user touching anything.
  // Runs once on mount, and again if the hash changes under us (back button).
  useEffect(() => {
    if (urlTicker) lookup(urlTicker);
    const onHash = () => {
      const t = tickerFromUrl();
      if (t && t !== (row && row.ticker)) {
        setInput(t);
        lookup(t);
      }
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const summary = (window.optionsSummaryParts && window.optionsSummaryParts()) || {};
  const tradeLog = (window.optionsTradeLogParts && window.optionsTradeLogParts(window.SPREAD_LOG)) || {};

  // Reading order, top to bottom: what happened today → what we hold → when it
  // rolls off and where the book stands → what we make of it → what to do →
  // what's queued → the full history. Everything explanatory (how a credit
  // spread works, the fund policy, the rules, provenance) is compacted into
  // one "Strategy & rules" block at the very bottom: it's reference material,
  // read once, not a live reading.
  return (
    <main className="shell opts-page" id="ticker-details">
      <header className="opts-page-head">
        <h2 style={{ margin: 0, fontSize: 20 }}>Options Log</h2>
        <span className="opts-page-sub">every open credit spread, what it's worth now, and what we did</span>
      </header>

      {summary.empty || (
        <>
          {summary.headline}
          <div id="options-summary">{summary.positions}</div>
          <Row2>
            {tradeLog.expiryLadder}
            {summary.whereBookStands}
          </Row2>
          <Row2>
            {summary.whatWeThink}
            {summary.actionQueue}
          </Row2>
          <Row2>
            {summary.openQueue}
            {tradeLog.openOrders}
          </Row2>
        </>
      )}

      <div id="options-trade-log">
        {tradeLog.empty || tradeLog.tradeLog}
        {tradeLog.foot}
      </div>

      <section className="opts-worksheet">
        <h3 className="opts-section-title">Ticker worksheet</h3>
        <p className="opts-page-sub">
          Give it one ticker; it returns everything the options market will tell
          us about that name, scored for premium selling. Spreads are included so a
          $300 stock costs a few hundred dollars of risk instead of $30k of cash.
        </p>

        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value.toUpperCase())}
            onKeyDown={(e) => { if (e.key === "Enter") lookup(); }}
            placeholder="Ticker, e.g. AAPL"
            style={{ background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: 6, padding: "7px 12px", color: "var(--text)", fontFamily: "var(--mono)", fontSize: 13, width: 160 }}
          />
          <button
            onClick={() => lookup()}
            disabled={busy || !input.trim()}
            style={{ padding: "7px 16px", background: "var(--accent)", color: "var(--bg)", border: "1px solid var(--line)", borderRadius: 6, cursor: busy ? "wait" : "pointer", fontSize: 12, fontWeight: 600, opacity: busy || !input.trim() ? 0.6 : 1 }}
          >
            {busy ? "Loading…" : "Get options"}
          </button>
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
          <Chip tone="neutral" title="The free Alpaca tier. OPRA requires a signed agreement + Algo Trader Plus.">feed: {feed}</Chip>
          {Object.keys(params).length > 0 && (
            <>
              <Chip tone="neutral" title="Exploratory scan filter — this worksheet, not the fund policy below.">scan: ≤ {params.max_dte}d to expiry</Chip>
              <Chip tone="neutral" title="Exploratory scan filter — this worksheet, not the fund policy below.">scan: risk ceiling {usd(params.max_collateral)}/position</Chip>
              <Chip tone="neutral" title="Exploratory scan filter — this worksheet, not the fund policy below.">scan: min credit {usd2(params.min_credit)}</Chip>
            </>
          )}
          {asOf && <Chip tone="neutral">as of {String(asOf).replace("T", " ")}</Chip>}
        </div>

        {note && (
          <p style={{ fontSize: 12, color: "var(--text-3)", marginTop: 10, maxWidth: 760 }}>{note}</p>
        )}

        {row ? (
          <TickerCard row={row} params={params} asOf={asOf} />
        ) : busy ? (
          <p style={{ color: "var(--text-3)", marginTop: 14 }}>Loading…</p>
        ) : (
          <p style={{ color: "var(--text-3)", marginTop: 14 }}>
            Enter a ticker above to pull its chain.
          </p>
        )}
      </section>

      <section className="opts-strategy">
        <h3 className="opts-section-title">Strategy &amp; rules</h3>
        {summary.howto}
        <StrategyPolicy />
        <Row2>
          {summary.rulesInForce}
          {summary.provenance}
        </Row2>
        <p style={{ color: "var(--text-3)", fontSize: 11, marginTop: 12, maxWidth: 760 }}>
          Win probability is approximated as 1 − |Δ|, the standard dealer heuristic —
          it is not a guarantee, and it ignores the fat left tail a short put carries.
          Quotes come from Alpaca's free indicative feed, a derivative of OPRA rather
          than the consolidated book; treat the credit column as indicative, not fillable.
        </p>
      </section>
    </main>
  );
}

window.TickerDetailsPage = TickerDetailsPage;
