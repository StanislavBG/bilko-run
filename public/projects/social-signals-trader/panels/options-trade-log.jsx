/* global React */
// Options trade log — every credit spread the sleeve opened or closed, with the
// full contract detail frozen at that moment. The point is reviewability: what
// the greeks and prices actually were when we committed, not what they are now.

const { useState: useLogState } = React;

const g4 = (v) => (v == null ? "—" : Number(v).toFixed(4));
const money = (v) => (v == null ? "—" : (v < 0 ? "-$" : "$") + Math.abs(Number(v)).toLocaleString(undefined, { maximumFractionDigits: 2 }));
const pctv = (v) => (v == null ? "—" : (Number(v) * 100).toFixed(1) + "%");

// Both legs side by side, each with its own greeks. Rendered for entry and,
// once the spread is flattened, again for exit.
function LegDetail({ title, legs }) {
  if (!legs || legs.error) {
    return <div className="opt-legs-empty">{legs && legs.error ? `snapshot unavailable: ${legs.error}` : "no snapshot captured"}</div>;
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
            <th>IV</th><th>Δ</th><th>Γ</th><th>Θ</th><th>V</th><th>ρ</th><th>Vol</th>
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
  return (
    <div className={`opt-trade opt-trade--${isClose ? "close" : "open"}`}>
      <div className="opt-trade-head" onClick={() => setOpen(!open)}>
        <span className={`opt-badge opt-badge--${isClose ? "close" : "open"}`}>
          {isClose ? "CLOSE" : "OPEN"}
        </span>
        <span className={`opt-badge opt-badge--${ev.status === "submitted" ? "live" : ev.status === "error" ? "err" : "dry"}`}>
          {ev.status}
        </span>
        <strong className="opt-ticker">{ev.ticker}</strong>
        <span className="mono-dim">
          {ev.short_strike ? `${ev.short_strike}/${ev.long_strike}` : ev.short}
        </span>
        <span className="mono-dim">×{ev.contracts}</span>
        {isClose
          ? <span className={pnl >= 0 ? "up" : "down"}>{money(pnl)}</span>
          : <span className="up">+{money(ev.credit)}</span>}
        {isClose && <span className="mono-dim">captured {pctv(ev.captured_pct)}</span>}
        <span className="opt-trade-ts mono-dim">{String(ev.ts || "").replace("T", " ")}</span>
        <span className="opt-chev">{open ? "▾" : "▸"}</span>
      </div>

      {open && (
        <div className="opt-trade-body">
          <div className="opt-kv">
            {[
              ["Credit", money(ev.credit ?? ev.entry_credit)],
              ["Risk", money(ev.risk)],
              ["EV at entry", money(ev.ev)],
              ["Win prob", pctv(ev.pop)],
              ["DTE", ev.dte],
              ["Expiry", ev.expiry],
              ["Spot at entry", money(ev.spot_at_entry)],
              ["Width", money(ev.width)],
              ["Profit target", pctv(ev.profit_target_pct)],
              ["Exit cost", isClose ? money(ev.exit_cost) : null],
              ["Reason", ev.reason],
              ["Order id", ev.client_order_id],
            ].filter(([, v]) => v != null && v !== "—").map(([k, v]) => (
              <div className="opt-kv-item" key={k}>
                <span className="opt-kv-k">{k}</span>
                <span className="opt-kv-v">{v}</span>
              </div>
            ))}
          </div>
          <LegDetail title="Legs at entry" legs={ev.entry_legs} />
          {isClose && <LegDetail title="Legs at exit" legs={ev.exit_legs} />}
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
        Θ theta · V vega · ρ rho. Quotes are Alpaca's indicative feed.
      </p>
    </section>
  );
}

window.OptionsTradeLog = OptionsTradeLog;
