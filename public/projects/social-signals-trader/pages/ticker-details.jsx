/* global React */
// Ticker Details — the premium-selling worksheet.
//
// Renders window.OPTION_CHAIN (produced by src/social_signals_trader/options_chain.py)
// as one card per underlying: what the free indicative feed actually knows, then
// the two ladders we care about — cash-secured puts (deploy idle cash) and
// covered calls (rent out shares we already own).
//
// Every contract shown already passed the producer's filters: |delta| <= the
// max-short-delta param (~POP >= 80%), DTE inside the window, and — for puts —
// collateral under the per-contract cash ceiling.

const { useState, useMemo } = React;

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

function LadderTable({ rows, kind }) {
  if (!rows || !rows.length) {
    return (
      <p style={{ fontSize: 12, color: "var(--text-3)", margin: "8px 0 0" }}>
        No contract clears the filters — either every strike in the window is
        illiquid (no greeks on the indicative feed), the credit is below the
        floor, or {kind === "sell_put" ? "collateral exceeds the per-contract cash ceiling" : "no OTM strike pays enough"}.
      </p>
    );
  }
  const isPut = kind === "sell_put";
  return (
    <div style={{ overflowX: "auto", marginTop: 8 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--mono)", fontSize: 11 }}>
        <thead>
          <tr style={{ color: "var(--text-3)", textAlign: "right" }}>
            <th style={{ textAlign: "left", padding: "4px 6px" }}>Contract</th>
            <th style={{ padding: "4px 6px" }}>Exp</th>
            <th style={{ padding: "4px 6px" }}>DTE</th>
            <th style={{ padding: "4px 6px" }}>Strike</th>
            <th style={{ padding: "4px 6px" }}>Δ</th>
            <th style={{ padding: "4px 6px", minWidth: 120 }}>Win prob</th>
            <th style={{ padding: "4px 6px" }}>Credit</th>
            <th style={{ padding: "4px 6px" }}>{isPut ? "Cash held" : "Share value"}</th>
            <th style={{ padding: "4px 6px" }}>Ann. yield</th>
            <th style={{ padding: "4px 6px" }}>{isPut ? "Breakeven" : "Upside cap"}</th>
            <th style={{ padding: "4px 6px" }}>IV</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.symbol} style={{ borderTop: "1px solid var(--line)", textAlign: "right" }}>
              <td style={{ textAlign: "left", padding: "5px 6px", color: "var(--text-2)" }}>{r.symbol}</td>
              <td style={{ padding: "5px 6px" }}>{r.expiry?.slice(5)}</td>
              <td style={{ padding: "5px 6px" }}>{r.dte}d</td>
              <td style={{ padding: "5px 6px" }}>{usd2(r.strike)}</td>
              <td style={{ padding: "5px 6px" }}>{r.delta?.toFixed(3)}</td>
              <td style={{ padding: "5px 6px" }}><PopBar pop={r.pop} /></td>
              <td style={{ padding: "5px 6px" }} className="up">{usd2(r.credit)}</td>
              <td style={{ padding: "5px 6px", color: "var(--text-2)" }}>{usd(r.collateral)}</td>
              <td style={{ padding: "5px 6px" }} className={r.ann_yield >= 0.15 ? "up" : ""}>{pct(r.ann_yield)}</td>
              <td style={{ padding: "5px 6px", color: "var(--text-2)" }}>
                {isPut ? usd2(r.breakeven) : pct(r.upside_cap_pct)}
              </td>
              <td style={{ padding: "5px 6px", color: "var(--text-2)" }}>{pct(r.iv)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TickerCard({ row, params }) {
  const [tab, setTab] = useState("sell_put");
  const rows = tab === "sell_put" ? row.sell_puts : row.sell_calls;

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
        <Stat label="CSP candidates" value={row.sell_puts?.length || 0} />
        <Stat label="CC candidates" value={row.sell_calls?.length || 0} />
      </div>

      <div style={{ display: "flex", gap: 6, marginTop: 14 }}>
        {[["sell_put", `Sell puts (${row.sell_puts?.length || 0})`], ["sell_call", `Sell calls (${row.sell_calls?.length || 0})`]].map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className="btn"
            style={{
              fontSize: 11, padding: "4px 10px",
              background: tab === k ? "var(--accent)" : "var(--surface-2)",
              color: tab === k ? "var(--bg)" : "var(--text-2)",
              border: "1px solid var(--line)", borderRadius: 6, cursor: "pointer",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <LadderTable rows={rows} kind={tab} />
    </section>
  );
}

function TickerDetailsPage({ panel }) {
  const data = panel || window.OPTION_CHAIN;
  const [q, setQ] = useState("");
  const [onlyActionable, setOnlyActionable] = useState(false);

  const rows = useMemo(() => {
    const all = (data && data.tickers) || [];
    const needle = q.trim().toUpperCase();
    return all.filter((r) => {
      if (needle && !r.ticker.includes(needle)) return false;
      if (onlyActionable && !(r.sell_puts?.length || r.sell_calls?.length)) return false;
      return true;
    });
  }, [data, q, onlyActionable]);

  if (!data || !data.tickers) {
    return (
      <main className="shell">
        <h2>Ticker Details</h2>
        <p style={{ color: "var(--text-2)" }}>
          No option-chain snapshot bundled. Generate one with{" "}
          <code>.venv/bin/python -m social_signals_trader.options_chain AAPL MSFT --write</code>.
        </p>
      </main>
    );
  }

  const p = data.params || {};
  const totals = rows.reduce(
    (acc, r) => ({
      puts: acc.puts + (r.sell_puts?.length || 0),
      calls: acc.calls + (r.sell_calls?.length || 0),
      scanned: acc.scanned + (r.contracts_scanned || 0),
    }),
    { puts: 0, calls: 0, scanned: 0 }
  );

  return (
    <main className="shell" id="ticker-details">
      <header style={{ marginTop: 8 }}>
        <h2 style={{ margin: 0 }}>Ticker Details</h2>
        <p style={{ color: "var(--text-2)", fontSize: 13, marginTop: 6, maxWidth: 760 }}>
          What the options market shows us, per underlying, for the two trades we
          want: <strong>sell puts</strong> to put idle cash to work, and{" "}
          <strong>sell calls</strong> against shares already in the book. Only
          contracts with a win probability at or above{" "}
          {pct(1 - (p.max_short_delta ?? 0.2))} (|Δ| ≤ {p.max_short_delta}),
          expiring within {p.max_dte} days, are listed.
        </p>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
          <Chip tone="neutral" title="The free Alpaca tier. OPRA requires a signed agreement + Algo Trader Plus.">feed: {data.feed}</Chip>
          <Chip tone="neutral">≤ {p.max_dte}d to expiry</Chip>
          <Chip tone="neutral">cash ceiling {usd(p.max_collateral)}/contract</Chip>
          <Chip tone="neutral">min credit {usd2(p.min_credit)}</Chip>
          <Chip tone="neutral">as of {String(data.generatedAt || "").replace("T", " ")}</Chip>
        </div>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginTop: 14 }}>
        <Stat label="Underlyings" value={rows.length} />
        <Stat label="Contracts scanned" value={totals.scanned.toLocaleString()} />
        <Stat label="Put candidates" value={totals.puts} />
        <Stat label="Call candidates" value={totals.calls} />
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 14, flexWrap: "wrap" }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter ticker…"
          style={{ background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: 6, padding: "5px 10px", color: "var(--text)", fontFamily: "var(--mono)", fontSize: 12 }}
        />
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-2)" }}>
          <input type="checkbox" checked={onlyActionable} onChange={(e) => setOnlyActionable(e.target.checked)} />
          Only tickers with a candidate
        </label>
      </div>

      {rows.map((r) => <TickerCard key={r.ticker} row={r} params={p} />)}

      {!rows.length && (
        <p style={{ color: "var(--text-3)", marginTop: 16 }}>No ticker matches that filter.</p>
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
