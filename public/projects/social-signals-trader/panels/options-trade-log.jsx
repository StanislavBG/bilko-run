/* global React */
// Options trade log — every credit spread the sleeve opened or closed, with the
// full contract detail frozen at that moment. The point is reviewability: what
// the greeks and prices actually were when we committed, not what they are now,
// and whether the order actually filled — never implying money we don't have.

const { useState: useLogState } = React;

const g4 = (v) => (v == null ? "—" : Number(v).toFixed(4));
const money = (v) => (v == null ? "—" : (v < 0 ? "-$" : "$") + Math.abs(Number(v)).toLocaleString(undefined, { maximumFractionDigits: 2 }));
const pctv = (v) => (v == null ? "—" : (Number(v) * 100).toFixed(1) + "%");
const num = (v) => (v == null || v === "" ? null : Number(v));

// --- OCC symbol parsing ------------------------------------------------
// Layout: <root><yymmdd><C|P><strike*1000, 8 digits>, e.g.
// SPY260810C00777000 -> SPY $777 CALL exp 2026-08-10.
function parseOccSymbol(symbol) {
  if (!symbol || typeof symbol !== "string" || symbol.length < 15) return null;
  const tail = symbol.slice(-15);
  const datePart = tail.slice(0, 6);
  const rightChar = tail[6];
  const strikePart = tail.slice(7);
  if (!/^[0-9]{6}$/.test(datePart) || !/^[CP]$/.test(rightChar) || !/^[0-9]{8}$/.test(strikePart)) {
    return null;
  }
  const root = symbol.slice(0, -15);
  if (!root) return null;
  const yy = datePart.slice(0, 2);
  const mm = datePart.slice(2, 4);
  const dd = datePart.slice(4, 6);
  const strike = parseInt(strikePart, 10) / 1000;
  return {
    root,
    expiry: `20${yy}-${mm}-${dd}`,
    right: rightChar === "C" ? "CALL" : "PUT",
    strike,
  };
}

function plainEnglishLeg(symbol) {
  const p = parseOccSymbol(symbol);
  if (!p) return symbol || "—";
  return `${p.root} $${p.strike} ${p.right} exp ${p.expiry}`;
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

function spreadStructure(shortParsed, longParsed, ticker) {
  if (!shortParsed || !longParsed) return null;
  if (shortParsed.right === "CALL" && longParsed.right === "CALL" && shortParsed.strike < longParsed.strike) {
    return {
      name: "Bear call credit spread",
      gloss: `profits if ${ticker} stays below $${shortParsed.strike} through ${shortParsed.expiry}`,
    };
  }
  if (shortParsed.right === "PUT" && longParsed.right === "PUT" && shortParsed.strike > longParsed.strike) {
    return {
      name: "Bull put credit spread",
      gloss: `profits if ${ticker} stays above $${shortParsed.strike} through ${shortParsed.expiry}`,
    };
  }
  return { name: "Credit spread", gloss: null };
}

// Breakeven = short strike + credit/share for a call spread,
// short strike - credit/share for a put spread.
function breakeven(shortParsed, credit, contracts) {
  if (!shortParsed || credit == null || !contracts) return null;
  const creditPerShare = credit / contracts / 100;
  return shortParsed.right === "CALL" ? shortParsed.strike + creditPerShare : shortParsed.strike - creditPerShare;
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

// Both legs side by side, each with its own greeks. Rendered for entry and,
// once the spread is flattened, again for exit.
function LegDetail({ title, legs, predatesSnapshots }) {
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
            <th>IV</th><th>Δ</th><th>Γ</th><th>Θ</th><th>V</th><th>ρ</th><th>Vol</th><th>OI</th><th>Quote time</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((l) => {
            const k = l.greeks || {};
            return (
              <tr key={l.symbol}>
                <td className="al mono-dim">{l.symbol}</td>
                <td>{money(l.bid)}</td>
                <td>{money(l.ask)}</td>
                <td>{money(l.mid)}</td>
                <td>{money(l.last)}</td>
                <td>{pctv(l.iv)}</td>
                <td>{g4(k.delta)}</td>
                <td>{g4(k.gamma)}</td>
                <td className="neg-tint">{g4(k.theta)}</td>
                <td>{g4(k.vega)}</td>
                <td>{g4(k.rho)}</td>
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

function TradeCard({ ev }) {
  const [open, setOpen] = useState_(false);
  const isClose = ev.event === "close";
  const pnl = isClose ? ev.realized_pnl : null;

  const shortParsed = parseOccSymbol(ev.short);
  const longParsed = parseOccSymbol(ev.long);
  const structure = spreadStructure(shortParsed, longParsed, ev.ticker);
  const fs = fillState(ev);
  const received = creditReceived(ev);
  const maxGain = ev.credit;
  const maxLoss = ev.risk;
  const be = breakeven(shortParsed, ev.credit, ev.contracts);
  const riskReward = maxLoss != null && maxGain ? maxLoss / maxGain : null;

  let headline;
  if (isClose) {
    headline = <span className={pnl >= 0 ? "up" : "down"}>{money(pnl)}</span>;
  } else if (!fs || fs.state === "UNFILLED") {
    headline = <span className="mono-dim">target {money(maxGain)}</span>;
  } else if (fs.state === "PARTIAL") {
    headline = <span className="mono-dim">partial {money(received)} of {money(maxGain)} target</span>;
  } else {
    headline = <span className="up">+{money(received)}</span>;
  }

  return (
    <div className={`opt-trade opt-trade--${isClose ? "close" : "open"}`}>
      <div className="opt-trade-head" onClick={() => setOpen(!open)}>
        <span className={`opt-badge opt-badge--${isClose ? "close" : "open"}`}>
          {isClose ? "CLOSE" : "OPEN"}
        </span>
        {!isClose && fs && (
          <span className={`opt-badge opt-badge--fill-${fs.state.toLowerCase()}`}>
            {fs.state === "PARTIAL" ? `PARTIAL ${fs.filled}/${fs.total}` : fs.state}
          </span>
        )}
        <span className={`opt-badge opt-badge--${ev.status === "submitted" ? "live" : ev.status === "error" ? "err" : "dry"}`}>
          {ev.status}
        </span>
        <strong className="opt-ticker">{ev.ticker}</strong>
        {structure && <span className="mono-dim">{structure.name}</span>}
        <span className="mono-dim">
          {shortParsed && longParsed
            ? `$${shortParsed.strike}/$${longParsed.strike}`
            : (ev.short_strike ? `${ev.short_strike}/${ev.long_strike}` : ev.short)}
        </span>
        <span className="mono-dim">×{ev.contracts}</span>
        {headline}
        {isClose && <span className="mono-dim">captured {pctv(ev.captured_pct)}</span>}
        <span className="opt-trade-ts mono-dim">{String(ev.ts || "").replace("T", " ")}</span>
        <span className="opt-chev">{open ? "▾" : "▸"}</span>
      </div>

      {open && (
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
              ["Credit received", !isClose ? money(received) : null],
              ["Realized P&L", isClose ? money(pnl) : null],
              ["Fill state", !isClose && fs ? (fs.state === "PARTIAL" ? `PARTIAL ${fs.filled}/${fs.total}` : fs.state) : null],
              ["EV at entry", money(ev.ev)],
              ["Win prob (POP)", pctv(ev.pop)],
              ["DTE", ev.dte],
              ["Expiry", ev.expiry || (shortParsed ? shortParsed.expiry : null)],
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
            ].filter(([, v]) => v != null && v !== "—").map(([k, v]) => (
              <div className="opt-kv-item" key={k}>
                <span className="opt-kv-k">{k}</span>
                <span className="opt-kv-v">{v}</span>
              </div>
            ))}
          </div>
          <LegDetail title="Legs at entry" legs={ev.entry_legs} predatesSnapshots={!("entry_legs" in ev)} />
          {isClose && <LegDetail title="Legs at exit" legs={ev.exit_legs} predatesSnapshots={!("exit_legs" in ev)} />}
        </div>
      )}
    </div>
  );
}

// Local alias so this file doesn't collide with other panels' useState import.
const useState_ = React.useState;

function OptionsTradeLog({ log }) {
  const data = log || window.SPREAD_LOG;
  const [filter, setFilter] = useLogState("all");
  if (!data || !data.events || !data.events.length) {
    return (
      <section className="card opt-log">
        <h3 className="opt-log-title">Options trade log</h3>
        <p className="opt-log-empty">
          No spread activity yet. Generate with{" "}
          <code>python -m social_signals_trader.spread_trader --export-log</code>.
        </p>
      </section>
    );
  }
  const events = data.events.filter((e) => {
    if (filter === "live") return e.status === "submitted";
    if (filter === "open") return (e.event || "open") === "open";
    if (filter === "close") return e.event === "close";
    return true;
  });
  const live = data.events.filter((e) => e.status === "submitted");
  const realized = data.events.filter((e) => e.event === "close" && e.status === "submitted")
    .reduce((n, e) => n + (e.realized_pnl || 0), 0);

  return (
    <section className="card opt-log">
      <div className="opt-log-head">
        <h3 className="opt-log-title">Options trade log</h3>
        <div className="opt-log-stats">
          <span><em>{data.events.length}</em> events</span>
          <span><em>{live.length}</em> live</span>
          <span>realized <em className={realized >= 0 ? "up" : "down"}>{money(realized)}</em></span>
        </div>
      </div>
      <div className="opt-log-filters">
        {["all", "live", "open", "close"].map((f) => (
          <button key={f} className={`opt-filter${filter === f ? " is-active" : ""}`} onClick={() => setFilter(f)}>
            {f}
          </button>
        ))}
      </div>
      <div className="opt-log-list">
        {events.map((e, i) => <TradeCard key={(e.client_order_id || "") + i} ev={e} />)}
      </div>
      <p className="opt-log-foot">
        Greeks and prices are frozen at the moment of the order — entry legs from
        just before submission, exit legs from the close. Δ delta · Γ gamma ·
        Θ theta · V vega · ρ rho. Quotes are Alpaca’s indicative feed. A grey
        "target" figure is the limit-order goal, not money received — it only
        turns green once the broker reports a fill.
      </p>
    </section>
  );
}

window.OptionsTradeLog = OptionsTradeLog;
