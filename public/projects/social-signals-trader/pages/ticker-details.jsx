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

function Stat({ label, value, tone }) {
  return (
    <div style={{ display: "grid", gap: 2 }}>
      <span style={{ fontSize: 10, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: ".06em" }}>{label}</span>
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
      <section className="card" style={{ padding: 14, marginTop: 8, borderColor: "var(--neg)" }}>
        <p style={{ color: "var(--neg)", fontSize: 13, margin: 0 }}>
          Strategy config unavailable — dashboard/data-spread-config.js is missing or failed to
          load. Not showing stand-in numbers here on purpose.
        </p>
      </section>
    );
  }
  const c = sc.config;
  const field = (label, value, gloss, term) => (
    <div style={{ display: "grid", gap: 2 }}>
      <span style={{ fontSize: 10, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: ".06em" }}>
        {label}
        {term && <window.Help term={term} />}
      </span>
      <span style={{ fontFamily: "var(--mono)", fontSize: 13 }}>{value}</span>
      <span style={{ fontSize: 11, color: "var(--text-3)" }}>{gloss}</span>
    </div>
  );
  const grid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12, marginTop: 8 };
  const h4 = { fontSize: 11, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--text-3)", marginTop: 14, marginBottom: 0 };

  return (
    <section className="card" style={{ padding: 14, marginTop: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
        <h3 style={{ margin: 0, fontSize: 14 }}>CREDIT_SPREAD — fund policy</h3>
        <span style={{ fontSize: 11, color: "var(--text-3)", fontFamily: "var(--mono)" }}>
          config as of {String(sc.generatedAt || "unknown").replace("T", " ")}
        </span>
      </div>
      <p style={{ fontSize: 12, color: "var(--text-2)", marginTop: 6, maxWidth: 760 }}>
        These are the live, actually-traded rules — loaded from data/spread_config.json with any
        SST_SPREAD_* env overrides applied. The ticker worksheet below is an exploratory scan with
        its own, looser filters; it is not this policy.
      </p>

      <h4 style={h4}>Universe</h4>
      <p style={{ fontSize: 12, fontFamily: "var(--mono)", margin: "4px 0 0" }} title="The only tickers the sleeve scans and trades.">
        {(c.tickers || []).join(", ")}
      </p>

      <h4 style={h4}>Entry gates</h4>
      <div style={grid}>
        {field("Short-leg delta", `|Δ| ≤ ${c.max_short_delta}`, "the short strike's delta ceiling — roughly its odds of finishing ITM", "short_leg_delta")}
        {field("Win probability", pct(c.min_pop), "minimum probability of profit required to enter", "pop")}
        {field("DTE window", `${c.min_dte}–${c.max_dte}d`, "floor keeps out of 1-DTE gamma; cap keeps capital turning over", "dte")}
        {field("Risk per position", `${usd(c.min_notional)}–${usd(c.max_notional)}`, "capital-at-risk band per position, not a ceiling alone", "risk")}
        {field("Min credit", usd2(c.min_credit), "below this, fees dominate the trade", "min_credit")}
        {field("Expected value", `≥ ${usd2(c.min_ev)}${c.require_positive_ev ? " (must be positive)" : ""}`, "pop × credit − (1−pop) × max loss must clear this", "ev")}
        {field("Ann. yield floor", c.min_ann_yield > 0 ? pct(c.min_ann_yield) : "off (0)", c.min_ann_yield > 0 ? "minimum annualized yield required" : "not used — a high yield floor mechanically forces 1-DTE risk", "ann_yield")}
      </div>

      <h4 style={h4}>Book limits</h4>
      <div style={grid}>
        {field("Max positions", c.max_positions, "open spreads across the whole book at once", "max_positions")}
        {field("Max total risk", usd(c.max_total_risk), "capital-at-risk ceiling across every open spread", "max_total_risk")}
        {field("Max per underlying", c.max_per_underlying, "at most this many open spreads per name at a time", "max_per_underlying")}
      </div>

      <h4 style={h4}>Exit policy</h4>
      <p style={{ fontSize: 12, fontFamily: "var(--mono)", margin: "4px 0 0" }}>
        profit target {pct(c.profit_target_pct)} — closes once {pct(c.profit_target_pct)} of the
        entry credit is captured
      </p>
    </section>
  );
}

function TickerCard({ row, params }) {
  const [tab, setTab] = useState("put_spreads");
  const rows = row[tab];
  const active = LADDERS.find((l) => l.key === tab);

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
        <Stat label="Avg IV" value={pct(row.atm_iv)} />
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

  return (
    <main className="shell" id="ticker-details">
      <header style={{ marginTop: 8 }}>
        <h2 style={{ margin: 0 }}>Ticker Details</h2>
        <p style={{ color: "var(--text-2)", fontSize: 13, marginTop: 6, maxWidth: 760 }}>
          Give it one ticker; it returns everything the options market will tell
          us about that name, scored for premium selling. Spreads are included so a
          $300 stock costs a few hundred dollars of risk instead of $30k of cash.
        </p>
      </header>

      <StrategyPolicy />

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 16, flexWrap: "wrap" }}>
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
            <Chip tone="neutral" title="Exploratory scan filter — this worksheet, not the fund policy above.">scan: ≤ {params.max_dte}d to expiry</Chip>
            <Chip tone="neutral" title="Exploratory scan filter — this worksheet, not the fund policy above.">scan: risk ceiling {usd(params.max_collateral)}/position</Chip>
            <Chip tone="neutral" title="Exploratory scan filter — this worksheet, not the fund policy above.">scan: min credit {usd2(params.min_credit)}</Chip>
          </>
        )}
        {asOf && <Chip tone="neutral">as of {String(asOf).replace("T", " ")}</Chip>}
      </div>

      {note && (
        <p style={{ fontSize: 12, color: "var(--text-3)", marginTop: 10, maxWidth: 760 }}>{note}</p>
      )}

      {window.OptionsSummaryPanel && (
        <div id="options-summary" style={{ marginTop: 12 }}>
          <window.OptionsSummaryPanel />
        </div>
      )}

      {window.OptionsTradeLog && (
        <div id="options-trade-log" style={{ marginTop: 12 }}>
          <window.OptionsTradeLog log={window.SPREAD_LOG} />
        </div>
      )}

      {row ? (
        <TickerCard row={row} params={params} />
      ) : busy ? (
        <p style={{ color: "var(--text-3)", marginTop: 20 }}>Loading…</p>
      ) : (
        <p style={{ color: "var(--text-3)", marginTop: 20 }}>
          Enter a ticker above to pull its chain.
        </p>
      )}

      <p style={{ color: "var(--text-3)", fontSize: 11, marginTop: 20, maxWidth: 760 }}>
        Win probability is approximated as 1 − |Δ|, the standard dealer heuristic —
        it is not a guarantee, and it ignores the fat left tail a short put carries.
        Quotes come from Alpaca's free indicative feed, a derivative of OPRA rather
        than the consolidated book; treat the credit column as indicative, not fillable.
      </p>
    </main>
  );
}

window.TickerDetailsPage = TickerDetailsPage;
