/* global React */
const { useState, useMemo } = React;

// ============== Bar chart (horizontal) ==============
function HBarChart({ rows, valueKey = "pnl", labelKey = "source", height = 22, signed = true, fmt }) {
  const max = Math.max(...rows.map((r) => Math.abs(r[valueKey])));
  return (
    <div style={{ display: "grid", gap: 6 }}>
      {rows.map((r) => {
        const v = r[valueKey];
        const w = (Math.abs(v) / max) * 100;
        const color = !signed ? "var(--info)" : v >= 0 ? "var(--pos)" : "var(--neg)";
        return (
          <div key={r[labelKey]} style={{ display: "grid", gridTemplateColumns: "140px 1fr 80px", alignItems: "center", gap: 10, fontFamily: "var(--mono)", fontSize: 11 }}>
            <span style={{ color: "var(--text-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r[labelKey]}</span>
            <div style={{ height, background: "var(--surface-2)", borderRadius: 3, position: "relative", border: "1px solid var(--line)" }}>
              <div style={{ position: "absolute", left: signed && v < 0 ? `${50 - w/2}%` : signed ? "50%" : 0, width: signed ? `${w/2}%` : `${w}%`, top: 0, bottom: 0, background: color, borderRadius: 2, opacity: 0.85 }} />
              {signed && <div style={{ position: "absolute", left: "50%", top: -2, bottom: -2, width: 1, background: "var(--line-2)" }} />}
            </div>
            <span className={signed ? (v >= 0 ? "up" : "down") : ""} style={{ textAlign: "right" }}>
              {fmt ? fmt(v, r) : (signed ? (v >= 0 ? "+" : "") : "") + (typeof v === "number" ? v.toLocaleString() : v)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ============== Vertical bar chart ==============
function VBarChart({ rows, valueKey, labelKey, height = 140, signed = true }) {
  const max = Math.max(...rows.map((r) => Math.abs(r[valueKey])));
  return (
    <div style={{ display: "grid", gap: 4 }}>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${rows.length}, 1fr)`, gap: 6, height, alignItems: "end" }}>
        {rows.map((r) => {
          const v = r[valueKey];
          const h = (Math.abs(v) / max) * (height - 24);
          const color = !signed ? "var(--info)" : v >= 0 ? "var(--pos)" : "var(--neg)";
          return (
            <div key={r[labelKey]} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%" }}>
              <span className={signed && v < 0 ? "down" : signed && v > 0 ? "up" : ""} style={{ fontFamily: "var(--mono)", fontSize: 10, marginBottom: 2 }}>
                {signed && v >= 0 ? "+" : ""}{Math.abs(v) >= 1000 ? (v/1000).toFixed(1)+"k" : v}
              </span>
              <div style={{ width: "70%", height: h, background: color, borderRadius: "2px 2px 0 0", opacity: 0.9 }} />
            </div>
          );
        })}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${rows.length}, 1fr)`, gap: 6, fontFamily: "var(--mono)", fontSize: 10, color: "var(--muted)", textAlign: "center" }}>
        {rows.map((r) => <span key={r[labelKey]}>{r[labelKey]}</span>)}
      </div>
    </div>
  );
}

// ============== Trades deep-dive page ==============
function TradesPage() {
  const trades = window.TRADES;
  const sourcePerf = window.SOURCE_PERF;
  const monthly = window.MONTHLY_PNL;
  const holds = window.HOLD_BUCKETS;
  const dist = window.PNL_DIST;
  const tickers = window.TICKER_PERF;

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [sort, setSort] = useState({ key: "id", dir: "desc" });
  const [openTrade, setOpenTrade] = useState(null);

  const filtered = useMemo(() => {
    let r = trades.filter((t) => {
      if (filter === "OPEN") return t.status === "OPEN";
      if (filter === "WINS") return t.status === "CLOSED" && t.pnl > 0;
      if (filter === "LOSSES") return t.status === "CLOSED" && t.pnl < 0;
      if (filter === "BIG") return Math.abs(t.pnl) > 1000;
      return true;
    });
    if (search) {
      const s = search.toLowerCase();
      r = r.filter((t) => t.ticker.toLowerCase().includes(s) || t.source.toLowerCase().includes(s) || t.note.toLowerCase().includes(s));
    }
    r = [...r].sort((a, b) => {
      const x = a[sort.key], y = b[sort.key];
      const cmp = typeof x === "number" ? x - y : String(x).localeCompare(String(y));
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return r;
  }, [trades, filter, search, sort]);

  const setSortKey = (k) => setSort((s) => ({ key: k, dir: s.key === k && s.dir === "desc" ? "asc" : "desc" }));
  const fmt$ = (v) => (v >= 0 ? "+$" : "−$") + Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <main className="shell">
      <PageHeader title="Trades" subtitle="Every fill the engine has executed since Jan 6 · win or lose · linked to the source posts that triggered the signal" />

      {/* TOP STATS */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="statgrid">
          {[
            ["Total trades", window.PERF.trades],
            ["Win rate", (window.PERF.winRate * 100).toFixed(1) + "%"],
            ["Avg win / loss", `$${window.PERF.avgWin.toFixed(0)} / −$${Math.abs(window.PERF.avgLoss).toFixed(0)}`],
            ["Profit factor", window.PERF.profitFactor.toFixed(2)],
            ["Avg hold", window.PERF.avgHoldDays.toFixed(1) + "d"],
            ["Largest DD", window.PERF.maxDD.toFixed(1) + "%"],
          ].map((s) => (
            <div className="stat" key={s[0]}>
              <div className="label">{s[0]}</div>
              <div className="value">{s[1]}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ANALYTICS GRID */}
      <div className="grid grid-12" style={{ marginBottom: 12 }}>
        <div className="col-6 col-md-12">
          <div className="card">
            <div className="card-head"><h3>Monthly P&L · 12 months</h3></div>
            <div className="card-body">
              <VBarChart rows={monthly} valueKey="pnl" labelKey="month" height={160} />
            </div>
          </div>
        </div>
        <div className="col-6 col-md-12">
          <div className="card">
            <div className="card-head"><h3>P&L distribution · per trade</h3></div>
            <div className="card-body">
              <VBarChart rows={dist} valueKey="count" labelKey="bin" height={160} signed={false} />
            </div>
          </div>
        </div>

        <div className="col-6 col-md-12">
          <div className="card">
            <div className="card-head"><h3>P&L by source subreddit</h3></div>
            <div className="card-body">
              <HBarChart rows={sourcePerf} valueKey="pnl" labelKey="source"
                fmt={(v, r) => `${v >= 0 ? "+" : "−"}$${Math.abs(v).toLocaleString()}`} />
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--line)", display: "grid", gridTemplateColumns: "140px 1fr 80px", gap: 10, fontFamily: "var(--mono)", fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                <span>source</span><span>n trades · win rate</span><span style={{textAlign: "right"}}>total p&l</span>
              </div>
              <div style={{ display: "grid", gap: 4, marginTop: 6 }}>
                {sourcePerf.map((r) => (
                  <div key={r.source} style={{ display: "grid", gridTemplateColumns: "140px 1fr 80px", gap: 10, fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--muted)" }}>
                    <span></span>
                    <span>{r.trades}t · {(r.winRate * 100).toFixed(0)}%</span>
                    <span></span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="col-6 col-md-12">
          <div className="card">
            <div className="card-head"><h3>Hold-period performance</h3></div>
            <div className="card-body">
              <HBarChart rows={holds} valueKey="avgPnl" labelKey="label"
                fmt={(v) => `${v >= 0 ? "+" : "−"}$${Math.abs(v)}`} />
              <table className="trades" style={{ marginTop: 14 }}>
                <thead><tr><th>Bucket</th><th className="num">Trades</th><th className="num">Win rate</th><th className="num">Avg P&L</th></tr></thead>
                <tbody>
                  {holds.map((h) => (
                    <tr key={h.label}>
                      <td>{h.label}</td>
                      <td className="num">{h.trades}</td>
                      <td className="num">{(h.winRate * 100).toFixed(0)}%</td>
                      <td className={`num ${h.avgPnl >= 0 ? "up" : "down"}`}>{h.avgPnl >= 0 ? "+" : "−"}${Math.abs(h.avgPnl)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="col-12">
          <div className="card">
            <div className="card-head"><h3>Top 10 tickers by P&L</h3></div>
            <div className="card-body">
              <table className="trades">
                <thead>
                  <tr>
                    <th>Ticker</th>
                    <th className="num">Trades</th>
                    <th className="num">Win rate</th>
                    <th className="num">Total P&L</th>
                    <th>P&L bar</th>
                  </tr>
                </thead>
                <tbody>
                  {tickers.map((t) => {
                    const max = Math.max(...tickers.map((x) => Math.abs(x.pnl)));
                    const w = (Math.abs(t.pnl) / max) * 100;
                    return (
                      <tr key={t.ticker}>
                        <td className="ticker">{t.ticker}</td>
                        <td className="num">{t.trades}</td>
                        <td className="num">{(t.winRate * 100).toFixed(0)}%</td>
                        <td className={`num ${t.pnl >= 0 ? "up" : "down"}`}>{t.pnl >= 0 ? "+" : "−"}${Math.abs(t.pnl).toLocaleString()}</td>
                        <td>
                          <div style={{ height: 10, background: "var(--surface-2)", borderRadius: 2, position: "relative", border: "1px solid var(--line)" }}>
                            <div style={{ position: "absolute", left: t.pnl >= 0 ? "50%" : `${50 - w/2}%`, width: `${w/2}%`, top: 0, bottom: 0, background: t.pnl >= 0 ? "var(--pos)" : "var(--neg)", borderRadius: 2 }} />
                            <div style={{ position: "absolute", left: "50%", top: -2, bottom: -2, width: 1, background: "var(--line-2)" }} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* FULL TRADE LOG */}
      <div className="card">
        <div className="card-head">
          <h3>Full trade log · {filtered.length} of {trades.length}</h3>
          <div className="row" style={{ gap: 10 }}>
            <input
              placeholder="search ticker / source / note"
              value={search} onChange={(e) => setSearch(e.target.value)}
              style={{ background: "var(--bg-2)", border: "1px solid var(--line)", borderRadius: 4, color: "var(--text)", padding: "4px 8px", fontFamily: "var(--mono)", fontSize: 11, width: 220 }}
            />
            <div className="tf">
              {["ALL","OPEN","WINS","LOSSES","BIG"].map((f) => (
                <button key={f} className={filter === f ? "active" : ""} onClick={() => setFilter(f)}>{f}</button>
              ))}
            </div>
          </div>
        </div>
        <div className="card-body tight" style={{ maxHeight: 600, overflowY: "auto" }}>
          <table className="trades">
            <thead>
              <tr>
                {[["id","ID"],["ticker","Ticker"],["side","Side"],["type","Type"],["status","Status"],["entry","Entry"],["exit","Exit"],["qty","Qty"],["pnl","P&L"],["source","Source"]].map(([k, l]) => (
                  <th key={k} onClick={() => setSortKey(k)} style={{ cursor: "pointer", userSelect: "none" }} className={["entry","exit","qty","pnl"].includes(k) ? "num" : ""}>
                    {l}{sort.key === k ? (sort.dir === "desc" ? " ↓" : " ↑") : ""}
                  </th>
                ))}
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id} onClick={() => setOpenTrade(t)} style={{ cursor: "pointer" }} title="Click for provenance">
                  <td className="dim">{t.id}</td>
                  <td><div className="ticker">{t.ticker}</div><div className="sub-cell">{t.opened}{t.closed ? ` → ${t.closed}` : " · open"}</div></td>
                  <td><span className={`pill ${t.side === "LONG" ? "long" : "short"}`}>{t.side}</span></td>
                  <td className="dim">{t.type}</td>
                  <td><span className={`pill ${t.status === "OPEN" ? "open" : "closed"}`}>{t.status}</span></td>
                  <td className="num">{t.entry.toFixed(2)}</td>
                  <td className="num dim">{t.exit ? t.exit.toFixed(2) : "—"}</td>
                  <td className="num dim">{t.qty}</td>
                  <td className={`num ${t.pnl >= 0 ? "up" : "down"}`}>{fmt$(t.pnl)}<div className="sub-cell" style={{ color: t.pnl >= 0 ? "var(--pos)" : "var(--neg)", opacity: 0.7 }}>{t.pnlPct >= 0 ? "+" : ""}{t.pnlPct.toFixed(1)}%</div></td>
                  <td className="dim">{t.source}</td>
                  <td className="dim" style={{ fontSize: 10.5, maxWidth: 220 }}>{t.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {openTrade && window.TradeProvenanceModal && (
        <window.TradeProvenanceModal trade={openTrade} onClose={() => setOpenTrade(null)} />
      )}
    </main>
  );
}

// ============== Reddit Intel page ==============
function RedditPage() {
  const subs = window.SUB_DETAIL;
  const flow = window.TICKER_FLOW;
  const posts = window.HOT_POSTS;
  const themes = window.THEMES;
  const [openSub, setOpenSub] = useState("wallstreetbets");

  const fmtSubs = (n) => n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : (n / 1e3).toFixed(0) + "k";

  const sub = subs.find((s) => s.name === openSub) || subs[0];

  return (
    <main className="shell">
      <PageHeader title="Reddit Intel" subtitle="Mention flow, sentiment, top posts and per-subreddit drill-downs across 10 stock-focused communities" />

      {/* THEME ROW */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-head"><h3>Active themes · last 24h</h3></div>
        <div className="card-body tight">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", borderTop: "1px solid var(--line)" }}>
            {(themes || []).map((t, i) => (
              <div key={t.title || i} style={{ padding: 14, borderRight: i % 3 === 2 ? "none" : "1px solid var(--line)", borderBottom: i < 3 ? "1px solid var(--line)" : "none" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{t.title}</span>
                  <span className="mono" style={{ fontSize: 11 }}>
                    {t.heat ?? "—"}
                    {t.change != null && (
                      <span className={t.change >= 0 ? "up" : "down"} style={{ marginLeft: 6 }}>{t.change >= 0 ? "+" : ""}{t.change}</span>
                    )}
                  </span>
                </div>
                <p style={{ margin: 0, color: "var(--text-2)", fontSize: 12, lineHeight: 1.5 }}>{t.blurb}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* TICKER FLOW */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-head">
          <h3>Ticker mention flow · 30 days</h3>
          <span className="mono" style={{ fontSize: 10, color: "var(--muted)" }}>volume only · sentiment in panel below</span>
        </div>
        <div className="card-body tight">
          {(flow || []).length === 0 && (
            <div className="dim" style={{ padding: "12px 14px", fontFamily: "var(--mono)", fontSize: 11 }}>No ticker-flow data yet — burrow's ticker_mention_flow has no captures for the active watchlist.</div>
          )}
          {(flow || []).map((t) => {
            const series = Array.isArray(t.series) ? t.series : [];
            const max = Math.max(...series, 1);
            const action = t.action || "—";
            return (
              <div key={t.ticker} style={{ display: "grid", gridTemplateColumns: "70px 1fr 100px 140px", alignItems: "center", gap: 14, padding: "10px 14px", borderBottom: "1px solid var(--line)", fontFamily: "var(--mono)", fontSize: 11.5 }}>
                <span style={{ fontWeight: 600 }}>{t.ticker}</span>
                <div style={{ display: "flex", gap: 1, height: 28, alignItems: "flex-end" }}>
                  {series.map((v, i) => (
                    <div key={i} style={{ flex: 1, height: `${((v || 0) / max) * 100}%`, background: "var(--info)", opacity: 0.4 + ((v || 0)/max) * 0.6, borderRadius: "1px 1px 0 0" }} />
                  ))}
                </div>
                <span style={{ color: "var(--muted)", fontSize: 10.5, textAlign: "right" }}>{series[series.length - 1] ?? 0} <span style={{ opacity: 0.6 }}>today</span></span>
                <span className={`pill ${typeof action === "string" && action.startsWith("HOLDING") ? "holding" : typeof action === "string" && action.startsWith("WATCHING") ? "watching" : typeof action === "string" && action.startsWith("STOPPED") ? "stopped" : "passed"}`}>{action}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* SUBREDDIT DRILLDOWN */}
      <div className="grid grid-12" style={{ marginBottom: 12 }}>
        <div className="col-4 col-md-12">
          <div className="card">
            <div className="card-head"><h3>10 subreddits · click to drill</h3></div>
            <div className="card-body tight">
              {subs.map((s) => (
                <div key={s.name} onClick={() => setOpenSub(s.name)}
                  style={{ padding: "10px 14px", borderBottom: "1px solid var(--line)", cursor: "pointer", background: openSub === s.name ? "var(--surface-2)" : "transparent", borderLeft: openSub === s.name ? "2px solid var(--accent)" : "2px solid transparent" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--mono)", fontSize: 12 }}>
                    <span style={{ fontWeight: 600 }}>r/{s.name}</span>
                    {s.sentiment == null ? (
                      <span className="dim" style={{ fontSize: 11 }}>—</span>
                    ) : (
                      <span className={s.sentiment >= 0 ? "up" : "down"} style={{ fontSize: 11 }}>{s.sentiment >= 0 ? "+" : ""}{Number(s.sentiment).toFixed(2)}</span>
                    )}
                  </div>
                  <div className="mono" style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>{fmtSubs(s.subs || 0)} subs · {s.posts24h ?? 0} posts/24h · {s.newPostsPerHour ?? 0}/hr</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="col-8 col-md-12">
          <div className="card" style={{ marginBottom: 12 }}>
            <div className="card-head">
              <h3>r/{sub.name} · drill-down</h3>
              <span className="mono" style={{ fontSize: 10, color: "var(--muted)" }}>{fmtSubs(sub.subs)} subs</span>
            </div>
            <div className="card-body">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 0, marginBottom: 14, border: "1px solid var(--line)", borderRadius: 4 }}>
                {[
                  ["Posts/24h", sub.posts24h ?? 0],
                  ["Sentiment", sub.sentiment == null ? "—" : ((sub.sentiment >= 0 ? "+" : "") + Number(sub.sentiment).toFixed(2))],
                  ["Bull / Bear", `${sub.bullCount ?? 0} / ${sub.bearCount ?? 0}`],
                  ["Avg score", sub.avgScore ?? sub.avgUpvotes ?? "—"],
                ].map((s, i) => (
                  <div key={s[0]} style={{ padding: "10px 12px", borderRight: i < 3 ? "1px solid var(--line)" : "none" }}>
                    <div className="label" style={{ fontFamily: "var(--mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)" }}>{s[0]}</div>
                    <div className="mono" style={{ fontSize: 16, fontWeight: 600, marginTop: 2 }}>{s[1]}</div>
                  </div>
                ))}
              </div>

              <div style={{ marginBottom: 14 }}>
                <div className="label" style={{ fontFamily: "var(--mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)", marginBottom: 6 }}>30-day mention volume</div>
                {Array.isArray(sub.series30d) && sub.series30d.length > 0 ? (
                  <div style={{ display: "flex", gap: 1, height: 50, alignItems: "flex-end" }}>
                    {(() => {
                      const max = Math.max(...sub.series30d, 1);
                      return sub.series30d.map((v, i) => (
                        <div key={i} style={{ flex: 1, height: `${((v || 0) / max) * 100}%`, background: "var(--info)", opacity: 0.5 + ((v || 0)/max) * 0.5, borderRadius: "1px 1px 0 0" }} />
                      ));
                    })()}
                  </div>
                ) : (
                  <div className="dim" style={{ fontFamily: "var(--mono)", fontSize: 11 }}>no series yet</div>
                )}
              </div>

              <div style={{ marginBottom: 14 }}>
                <div className="label" style={{ fontFamily: "var(--mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)", marginBottom: 8 }}>Top tickers in r/{sub.name}</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {(Array.isArray(sub.topTickers) && sub.topTickers.length ? sub.topTickers : (sub.top || [])).map((t) => <span key={t} style={{ background: "var(--surface-2)", border: "1px solid var(--line)", padding: "4px 8px", borderRadius: 3, fontFamily: "var(--mono)", fontSize: 11 }}>{t}</span>)}
                </div>
              </div>

              <div>
                <div className="label" style={{ fontFamily: "var(--mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)", marginBottom: 8 }}>Top voices</div>
                <div className="mono" style={{ fontSize: 11.5, color: "var(--text-2)" }}>{(Array.isArray(sub.topAuthors) && sub.topAuthors.length) ? sub.topAuthors.join(" · ") : <span className="dim">—</span>}</div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-head"><h3>Top posts in r/{sub.name}</h3></div>
            <div className="card-body tight">
              {(sub.topPosts || []).length === 0 && (
                <div className="dim" style={{ padding: "12px 14px", fontFamily: "var(--mono)", fontSize: 11 }}>No top posts captured yet.</div>
              )}
              {(sub.topPosts || []).map((p, i) => (
                <div key={i} style={{ padding: "10px 14px", borderBottom: i < (sub.topPosts.length - 1) ? "1px solid var(--line)" : "none" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{p.title}</span>
                    {p.age ? <span className="mono dim" style={{ fontSize: 10, whiteSpace: "nowrap" }}>{p.age}</span> : null}
                  </div>
                  <div className="mono" style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 4 }}>
                    {p.flair ? <span style={{ background: "var(--surface-2)", border: "1px solid var(--line)", padding: "1px 5px", borderRadius: 3, marginRight: 6 }}>{p.flair}</span> : null}
                    ↑ {Number(p.score || 0).toLocaleString()} · {Number(p.comments || 0).toLocaleString()} comments
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* HOT POSTS GLOBAL */}
      <div className="card">
        <div className="card-head"><h3>Hot posts feed · all 10 subs</h3></div>
        <div className="card-body tight">
          {(posts || []).length === 0 && (
            <div className="dim" style={{ padding: "12px 14px", fontFamily: "var(--mono)", fontSize: 11 }}>No hot posts captured yet.</div>
          )}
          {(posts || []).map((p, i) => {
            const action = p.action || "—";
            return (
              <div key={i} style={{ padding: "12px 14px", borderBottom: i < posts.length - 1 ? "1px solid var(--line)" : "none", display: "grid", gridTemplateColumns: "1fr auto", gap: 14, alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>{p.title}</div>
                  <div className="mono" style={{ fontSize: 10.5, color: "var(--muted)" }}>
                    <span style={{ color: "var(--text-2)" }}>r/{p.sub}</span>
                    {p.flair ? <span style={{ background: "var(--surface-2)", border: "1px solid var(--line)", padding: "1px 5px", borderRadius: 3, margin: "0 8px" }}>{p.flair}</span> : <span style={{ marginRight: 4 }}> </span>}
                    ↑ {Number(p.score || 0).toLocaleString()} · {Number(p.comments || 0).toLocaleString()} comments
                    {p.age ? ` · ${p.age}` : null}
                    {p.sentiment != null && (
                      <span className={p.sentiment >= 0 ? "up" : "down"} style={{ marginLeft: 8 }}>sent {p.sentiment >= 0 ? "+" : ""}{Number(p.sentiment).toFixed(2)}</span>
                    )}
                  </div>
                </div>
                <span className={`pill ${typeof action === "string" && action.startsWith("ACTED") ? "holding" : typeof action === "string" && action.startsWith("STOPPED") ? "stopped" : "passed"}`}>{action}</span>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}

// ============== Watchlist page ==============
function WatchlistPage() {
  const list = window.WATCHLIST_DETAIL;
  const passed = window.PASSED_SIGNALS;

  return (
    <main className="shell">
      <PageHeader title="Watchlist" subtitle="Signals the engine is tracking but hasn't acted on · conviction, trigger conditions, and signals it rejected" />

      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-head">
          <h3>Active signals · {list.length} tracked</h3>
          <span className="mono" style={{ fontSize: 10, color: "var(--muted)" }}>conviction floor 0.65 to enter</span>
        </div>
        <div className="card-body tight">
          {list.map((w) => {
            const max = Math.max(...w.series);
            const sentMax = Math.max(...w.sentSeries.map(Math.abs));
            return (
              <div key={w.ticker} style={{ padding: 14, borderBottom: "1px solid var(--line)" }}>
                <div style={{ display: "grid", gridTemplateColumns: "120px 1fr 1fr auto", gap: 16, alignItems: "center" }}>
                  <div>
                    <div className="ticker mono" style={{ fontSize: 16, fontWeight: 600 }}>{w.ticker}</div>
                    <div className="mono" style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>added {w.addedDays}d ago</div>
                    <span className={`pill ${w.status === "WATCHING" ? "watching" : "passed"}`} style={{ marginTop: 6, display: "inline-flex" }}>{w.status}</span>
                  </div>
                  <div>
                    <div className="label" style={{ fontFamily: "var(--mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)", marginBottom: 4 }}>Mention volume · 30d</div>
                    <div style={{ display: "flex", gap: 1, height: 32, alignItems: "flex-end" }}>
                      {w.series.map((v, i) => <div key={i} style={{ flex: 1, height: `${(v/max)*100}%`, background: "var(--info)", opacity: 0.4 + (v/max)*0.6, borderRadius: "1px 1px 0 0" }} />)}
                    </div>
                    <div className="mono" style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>{w.mentions24h} mentions/24h</div>
                  </div>
                  <div>
                    <div className="label" style={{ fontFamily: "var(--mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)", marginBottom: 4 }}>Sentiment · 14d</div>
                    <div style={{ display: "flex", gap: 1, height: 32, alignItems: "center", position: "relative" }}>
                      <div style={{ position: "absolute", left: 0, right: 0, top: "50%", height: 1, background: "var(--line-2)" }} />
                      {w.sentSeries.map((v, i) => {
                        const h = (Math.abs(v) / sentMax) * 14;
                        return <div key={i} style={{ flex: 1, height: h, background: v >= 0 ? "var(--pos)" : "var(--neg)", marginTop: v >= 0 ? `${16 - h}px` : "16px", borderRadius: 1 }} />;
                      })}
                    </div>
                    <div className="mono" style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>current <span className={w.sentiment >= 0 ? "up" : "down"}>{w.sentiment >= 0 ? "+" : ""}{w.sentiment.toFixed(2)}</span></div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div className="mono" style={{ fontSize: 22, fontWeight: 600 }}>{(w.conviction * 100).toFixed(0)}%</div>
                    <div className="mono" style={{ fontSize: 10, color: "var(--muted)" }}>conviction</div>
                    <div style={{ width: 80, height: 4, background: "var(--surface-2)", borderRadius: 2, marginTop: 6, marginLeft: "auto", overflow: "hidden" }}>
                      <div style={{ width: `${w.conviction * 100}%`, height: "100%", background: w.conviction >= 0.65 ? "var(--pos)" : "var(--warn)" }} />
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--line)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, fontSize: 12 }}>
                  <div><span className="dim mono" style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>Why watching</span><br /><span style={{ color: "var(--text-2)" }}>{w.reason}</span></div>
                  <div><span className="dim mono" style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>Trigger to enter</span><br /><span style={{ color: "var(--text-2)" }}>{w.triggerLevel}</span></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h3>Signals the engine rejected · with retroactive outcome</h3>
          <span className="mono" style={{ fontSize: 10, color: "var(--muted)" }}>nothing curated</span>
        </div>
        <div className="card-body tight">
          <table className="trades">
            <thead>
              <tr>
                <th>Ticker</th>
                <th>Date</th>
                <th>Why rejected</th>
                <th>Outcome</th>
                <th className="num">P&L impact</th>
              </tr>
            </thead>
            <tbody>
              {passed.map((p) => (
                <tr key={p.ticker + p.date}>
                  <td className="ticker">{p.ticker}</td>
                  <td className="dim">{p.date}</td>
                  <td className="dim" style={{ maxWidth: 320 }}>{p.reason}</td>
                  <td className={p.outcome.startsWith("+") ? "up" : "down"}>{p.outcome}</td>
                  <td className={`num ${p.outcomePnl.startsWith("missed") ? "down" : "up"}`} style={{ fontSize: 11 }}>{p.outcomePnl}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* THESIS CARDS — one card per thesis, with lifecycle bar (D1) */}
      <div style={{ marginTop: 12 }}>
        <div style={{ marginBottom: 8 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Theses · lifecycle</h2>
          <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 12 }}>
            DETECTED → CORROBORATED → ENTERED → EXITED · countdown to event · contributing strategies
          </p>
        </div>
        <ThesisCardList theses={window.THESES} limit={20} />
      </div>

      {/* SIGNAL AGREEMENT — 4-source per-thesis cross-check (G1) */}
      <div style={{ marginTop: 12 }}>
        <div style={{ marginBottom: 8 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Signal agreement</h2>
          <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 12 }}>
            For each thesis: what 4 independent sources said — momentum, agent, ticker_intent, options flow
          </p>
        </div>
        {window.SignalAgreementPanel ? <window.SignalAgreementPanel limit={12} /> : null}
      </div>

      {/* EVENT CARDS — one card per (ticker, event_date), sorted by event_date asc */}
      <div style={{ marginTop: 12 }}>
        <div style={{ marginBottom: 8 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Upcoming event cards</h2>
          <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 12 }}>
            Per-event breakdown: subreddit sentiment, positions, and P&L by catalyst date
          </p>
        </div>
        <EventCardList />
      </div>

      {/* CATALYST WINDOW — upcoming earnings / FDA / ex-div from the calendars */}
      <div style={{ marginTop: 12 }}>
        <div style={{ marginBottom: 8 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Catalyst window</h2>
          <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 12 }}>
            Confirmed and unconfirmed catalysts from earnings + event calendars · grouped by date
          </p>
        </div>
        <CatalystWindowPanel />
      </div>
    </main>
  );
}

// ============== Methodology page ==============
function MethodologyPage() {
  const rules = window.METHOD_RULES;
  const breaks = window.RULE_BREAKS;
  const faq = window.METHOD_FAQ;

  return (
    <main className="shell">
      <PageHeader title="Methodology" subtitle="The full pipeline — how Reddit posts become trade signals, and the rules that turn signals into positions" />

      {/* PIPELINE */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-head"><h3>Pipeline</h3></div>
        <div className="card-body">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 0, border: "1px solid var(--line)", borderRadius: 4 }}>
            {[
              { step: "01", title: "Ingest", body: "Pull posts + top-level comments from 10 subs every 15 min. ~28k items/day. Body, score, comment count, ticker mentions extracted with $-prefix + dictionary." },
              { step: "02", title: "Score", body: "Each post → LLM call returning {sentiment ∈ [-1,1], topic tag, conviction ∈ [0,1], tickers}. Cached + rate-limited. ~$1.20/day in API costs." },
              { step: "03", title: "Aggregate", body: "Per-ticker and per-sub rollups weighted by post score and recency. Each strategy applies its own feed weights to produce a signal score." },
              { step: "04", title: "Execute", body: "When a strategy's signal crosses its conviction gate, the engine sizes, places stops, and submits orders via broker API. Zero human review. The audit log streams to this page." },
            ].map((s, i) => (
              <div key={s.step} style={{ padding: 16, borderRight: i < 3 ? "1px solid var(--line)" : "none" }}>
                <div className="mono" style={{ fontSize: 11, color: "var(--accent)", letterSpacing: "0.1em" }}>{s.step}</div>
                <div style={{ fontWeight: 600, fontSize: 15, margin: "4px 0 6px" }}>{s.title}</div>
                <p style={{ margin: 0, color: "var(--text-2)", fontSize: 12.5, lineHeight: 1.55 }}>{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* RULES */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-head"><h3>Trading rules · 8 commitments</h3></div>
        <div className="card-body">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
            {rules.map((r) => (
              <div key={r.num} style={{ padding: 14, background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: 4 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4 }}>
                  <span className="mono" style={{ fontSize: 11, color: "var(--accent)", letterSpacing: "0.1em" }}>{r.num}</span>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{r.title}</span>
                </div>
                <p style={{ margin: 0, color: "var(--text-2)", fontSize: 12.5, lineHeight: 1.55 }}>{r.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* DECISION NARRATIVE STREAM — D5 */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-head">
          <h3>Decision narrative · the agent did X because Y</h3>
          <span className="mono" style={{ fontSize: 10, color: "var(--muted)" }}>last 25 ticks · prose-mode read from agent_reports.jsonl</span>
        </div>
        <div className="card-body tight">
          {window.DecisionNarrativeStream ? <window.DecisionNarrativeStream /> : null}
        </div>
      </div>

      {/* RULE BREAKS */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-head">
          <h3>Recent rule firings · live audit log</h3>
          <span className="mono" style={{ fontSize: 10, color: "var(--muted)" }}>3 events YTD · each rule worked as designed</span>
        </div>
        <div className="card-body tight">
          <table className="trades">
            <thead>
              <tr><th>Trade</th><th>Ticker</th><th>Rule broken</th><th className="num">Outcome</th><th>Lesson</th></tr>
            </thead>
            <tbody>
              {(breaks || []).length === 0 && (
                <tr><td colSpan={5} className="dim" style={{ padding: 14, textAlign: "center" }}>No rule firings logged yet.</td></tr>
              )}
              {(breaks || []).map((b, i) => (
                <tr key={`${b.ts || i}-${b.ticker || ""}-${b.rule || ""}-${i}`}>
                  <td className="dim">{b.trade}</td>
                  <td className="ticker">{b.ticker}</td>
                  <td className="dim">{b.rule}</td>
                  <td className="num down">{b.outcome}</td>
                  <td className="dim" style={{ maxWidth: 360 }}>{b.lesson}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* SIGNAL DEDUP — sibling of rule breaks: "blocked at gate" but for the dedup window */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ marginBottom: 8 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Signal dedup · time-windowed gate</h2>
          <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 12 }}>
            Recent (strategy, ticker, direction) fires suppressed within the 60-minute window, plus the live windows still in effect
          </p>
        </div>
        <SignalDedupPanel />
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ marginBottom: 8 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>News signal health · headline scanner pulse</h2>
          <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 12 }}>
            24h scan totals plus recently flagged headlines (block_entry / exit_now) per ticker — distinguishes "no flags" from "scanner stalled"
          </p>
        </div>
        <NewsSignalHealthPanel />
      </div>

      {/* FAQ */}
      <div className="card">
        <div className="card-head"><h3>FAQ</h3></div>
        <div className="card-body tight">
          {faq.map((f, i) => (
            <div key={i} style={{ padding: "14px 16px", borderBottom: i < faq.length - 1 ? "1px solid var(--line)" : "none" }}>
              <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 6 }}>{f.q}</div>
              <div style={{ color: "var(--text-2)", fontSize: 13, lineHeight: 1.6 }}>{f.a}</div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

// ============== Page header ==============
function PageHeader({ title, subtitle }) {
  return (
    <div style={{ padding: "20px 0 18px", borderBottom: "1px solid var(--line)", marginBottom: 16 }}>
      <h1 style={{ margin: 0, fontFamily: "var(--sans)", fontSize: 28, fontWeight: 600, letterSpacing: "-0.02em" }}>{title}</h1>
      <p style={{ margin: "6px 0 0", color: "var(--muted)", fontSize: 13.5, fontFamily: "var(--mono)" }}>{subtitle}</p>
    </div>
  );
}

// ============== Reports page ==============
function ReportsPage() {
  const reports = window.WEEKLY_REPORTS || [];
  const [selected, setSelected] = useState(reports.length > 0 ? reports[0].week : null);

  if (reports.length === 0) {
    return (
      <main className="shell">
        <PageHeader title="Weekly Reports" subtitle="Saturday 9 AM · Claude reviews its own trades" />
        <div className="card" style={{ padding: 24, color: "var(--muted)", fontFamily: "var(--mono)", fontSize: 13 }}>
          No reports yet. The weekly report cron runs every Saturday at 9 AM PT.
        </div>
      </main>
    );
  }

  const current = reports.find((r) => r.week === selected) || reports[0];

  const gradeColor = (g) => {
    if (!g || g === "?") return "var(--muted)";
    if (g.startsWith("A")) return "var(--pos)";
    if (g.startsWith("B")) return "oklch(0.78 0.14 235)";
    if (g.startsWith("C")) return "var(--warn, oklch(0.82 0.16 75))";
    return "var(--neg)";
  };

  const renderMarkdown = (md) => {
    if (typeof window.marked !== "undefined") {
      return { __html: window.marked.parse(md) };
    }
    return { __html: `<pre style="white-space:pre-wrap;font-size:13px">${md.replace(/</g,"&lt;")}</pre>` };
  };

  return (
    <main className="shell">
      <PageHeader title="Weekly Reports" subtitle="Saturday 9 AM · Claude reviews its own trades" />
      <div className="grid grid-12" style={{ marginTop: 12 }}>
        <div className="col-3 col-md-12">
          <div className="card" style={{ padding: "8px 0" }}>
            {reports.map((r) => (
              <div
                key={r.week}
                onClick={() => setSelected(r.week)}
                style={{
                  padding: "10px 16px",
                  cursor: "pointer",
                  background: selected === r.week ? "var(--surface-2)" : "transparent",
                  borderLeft: selected === r.week ? "2px solid var(--accent)" : "2px solid transparent",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 12, fontWeight: 600 }}>{r.week}</span>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 12, fontWeight: 700, color: gradeColor(r.grade) }}>{r.grade}</span>
                </div>
                {r.summary && (
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 3, lineHeight: 1.4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                    {r.summary}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="col-9 col-md-12">
          {current && (
            <div
              className="card reports-content"
              style={{ padding: 24, lineHeight: 1.65, fontSize: 14 }}
              dangerouslySetInnerHTML={renderMarkdown(current.content)}
            />
          )}
        </div>
      </div>
    </main>
  );
}

Object.assign(window, { TradesPage, RedditPage, WatchlistPage, MethodologyPage, ReportsPage, PageHeader, HBarChart, VBarChart });
