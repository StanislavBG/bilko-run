/* global React, SBClient */
/* dashboard/pages/signals-tab.jsx — PRD 46 Signals tab.
 *
 * Reads SBClient (window.SBClient) which today is backed by an in-memory
 * fixture; PRD M8 swaps it for meta.panel_history MCP.
 */
(function () {
  "use strict";
  const { useState, useMemo, useEffect, useRef } = React;

  const RANGE_DAYS = { "1d": 1, "7d": 7, "30d": 30, "90d": 90 };
  const DAY_MS = 86400 * 1000;

  // Evidence-post URLs are scraped/untrusted. React won't block a
  // `javascript:` href, so allow only http(s)/protocol-relative; else drop.
  const safeHref = (u) => {
    if (typeof u !== "string") return null;
    const s = u.trim();
    return /^https?:\/\//i.test(s) || s.startsWith("/") ? s : null;
  };
  const STROKES = ["var(--pos)", "var(--info)", "var(--warn)", "var(--neg)", "var(--text-2)"];

  // ---------- helpers ----------

  // Pure: pick top-N tickers by total mentions inside [sinceE, untilE].
  // O(rows) single pass.
  function topTickersByMentions(rows, n) {
    const counts = new Map();
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const m = (r.payload && r.payload.mentions) || 0;
      counts.set(r.ticker, (counts.get(r.ticker) || 0) + m);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map((e) => e[0]);
  }

  // Group rows by ticker → sorted [{t, bull_share, mentions}].
  function groupByTicker(rows) {
    const out = new Map();
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const t = Date.parse(r.built_at);
      const p = r.payload || {};
      const series = out.get(r.ticker) || [];
      series.push({ t, bull_share: p.bull_share || 0, mentions: p.mentions || 0 });
      out.set(r.ticker, series);
    }
    for (const series of out.values()) series.sort((a, b) => a.t - b.t);
    return out;
  }

  // RFC 4180 quoting.
  function csvCell(v) {
    if (v == null) return "";
    const s = String(v);
    if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function downloadCsv(rows, rangeKey) {
    const header = "built_at,ticker,panel,bull_share,bull_count,bear_count,mentions,top_subreddit";
    const lines = [header];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const p = r.payload || {};
      lines.push([
        csvCell(r.built_at), csvCell(r.ticker), csvCell(r.panel),
        csvCell(p.bull_share), csvCell(p.bull_count), csvCell(p.bear_count),
        csvCell(p.mentions), csvCell(p.top_subreddit),
      ].join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const today = new Date().toISOString().slice(0, 10);
    const a = document.createElement("a");
    a.href = url;
    a.download = `signals_${rangeKey}_${today}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // Track viewport width so we can fall back to single-ticker mode on mobile.
  function useIsMobile(breakpoint) {
    const [m, setM] = useState(
      typeof window !== "undefined" ? window.innerWidth <= breakpoint : false
    );
    useEffect(() => {
      const onR = () => setM(window.innerWidth <= breakpoint);
      window.addEventListener("resize", onR);
      return () => window.removeEventListener("resize", onR);
    }, [breakpoint]);
    return m;
  }

  // ---------- chart ----------

  function SignalsChart({ tickerSeries, strokes }) {
    const W = 800, H = 320, PAD_L = 48, PAD_R = 48, PAD_T = 16, PAD_B = 30;
    if (!tickerSeries.size) {
      return (
        <svg data-testid="signals-chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet"
             style={{ width: "100%", height: "auto", display: "block" }}>
          <text x={W / 2} y={H / 2} fill="var(--muted)" fontSize="14" textAnchor="middle">
            no data in range
          </text>
        </svg>
      );
    }

    // Compute time domain across all selected tickers.
    let tMin = Infinity, tMax = -Infinity, mMax = 0;
    for (const series of tickerSeries.values()) {
      for (let i = 0; i < series.length; i++) {
        if (series[i].t < tMin) tMin = series[i].t;
        if (series[i].t > tMax) tMax = series[i].t;
        if (series[i].mentions > mMax) mMax = series[i].mentions;
      }
    }
    if (tMax === tMin) tMax = tMin + DAY_MS;
    if (mMax === 0) mMax = 1;
    const xFor = (t) => PAD_L + ((t - tMin) / (tMax - tMin)) * (W - PAD_L - PAD_R);
    const ySent = (v) => PAD_T + (1 - Math.max(0, Math.min(1, v))) * (H - PAD_T - PAD_B);
    const yMent = (v) => H - PAD_B - (v / mMax) * (H - PAD_T - PAD_B);

    // gridlines + axis labels
    const yTicks = [0, 0.25, 0.5, 0.75, 1];
    const xTickCount = 5;
    const xTicks = Array.from({ length: xTickCount }, (_, i) =>
      tMin + (i / (xTickCount - 1)) * (tMax - tMin)
    );
    const fmtDate = (t) => {
      const d = new Date(t);
      return `${String(d.getUTCMonth() + 1).padStart(2, "0")}/${String(d.getUTCDate()).padStart(2, "0")}`;
    };

    // mention bars — pick first selected ticker for the bar series (low-opacity backdrop).
    const firstTicker = Array.from(tickerSeries.keys())[0];
    const firstSeries = tickerSeries.get(firstTicker) || [];
    const barW = firstSeries.length > 1
      ? Math.max(2, (W - PAD_L - PAD_R) / firstSeries.length - 2)
      : 8;

    const tickerEntries = Array.from(tickerSeries.entries());

    return (
      <svg data-testid="signals-chart"
           viewBox={`0 0 ${W} ${H}`}
           preserveAspectRatio="xMidYMid meet"
           style={{ width: "100%", height: "auto", display: "block" }}>
        {/* horizontal gridlines + left axis (sentiment) */}
        {yTicks.map((v, i) => (
          <g key={`gy${i}`}>
            <line x1={PAD_L} x2={W - PAD_R} y1={ySent(v)} y2={ySent(v)}
                  stroke="var(--line)" strokeDasharray="2 4" />
            <text x={PAD_L - 6} y={ySent(v) + 3} fill="var(--muted)" fontSize="10"
                  textAnchor="end" fontFamily="var(--mono)">
              {v.toFixed(2)}
            </text>
          </g>
        ))}
        {/* right axis (mentions) */}
        {yTicks.map((v, i) => (
          <text key={`gym${i}`} x={W - PAD_R + 6} y={yMent(v * mMax) + 3}
                fill="var(--muted)" fontSize="10" textAnchor="start" fontFamily="var(--mono)">
            {Math.round(v * mMax)}
          </text>
        ))}
        {/* x axis labels */}
        {xTicks.map((t, i) => (
          <text key={`tx${i}`} x={xFor(t)} y={H - 8} fill="var(--muted)" fontSize="10"
                textAnchor="middle" fontFamily="var(--mono)">
            {fmtDate(t)}
          </text>
        ))}
        {/* mentions bars (first selected ticker) */}
        {firstSeries.map((d, i) => (
          <rect key={`b${i}`}
                x={xFor(d.t) - barW / 2}
                y={yMent(d.mentions)}
                width={barW}
                height={H - PAD_B - yMent(d.mentions)}
                fill="var(--info)" opacity="0.12" />
        ))}
        {/* one polyline per ticker */}
        {tickerEntries.map(([tk, series], idx) => {
          const stroke = strokes[idx % strokes.length];
          const pts = series.map((d) => `${xFor(d.t)},${ySent(d.bull_share)}`).join(" ");
          return (
            <polyline key={tk}
                      data-ticker={tk}
                      points={pts}
                      fill="none"
                      stroke={stroke}
                      strokeWidth="1.8"
                      strokeLinejoin="round"
                      strokeLinecap="round" />
          );
        })}
        {/* axis labels */}
        <text x={PAD_L} y={PAD_T - 2} fill="var(--muted)" fontSize="10" fontFamily="var(--mono)">
          bull_share
        </text>
        <text x={W - PAD_R} y={PAD_T - 2} fill="var(--muted)" fontSize="10"
              fontFamily="var(--mono)" textAnchor="end">
          mentions
        </text>
      </svg>
    );
  }

  // ---------- theme drilldown side-sheet ----------

  function ThemeSidesheet({ theme, onClose }) {
    useEffect(() => {
      if (!theme) return undefined;
      const onKey = (e) => { if (e.key === "Escape") onClose(); };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }, [theme, onClose]);
    const open = !!theme;
    const overlayStyle = {
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
      opacity: open ? 1 : 0,
      pointerEvents: open ? "auto" : "none",
      transition: "opacity 180ms ease",
      zIndex: 90,
    };
    const sheetStyle = {
      position: "fixed", top: 0, right: 0, bottom: 0,
      width: "min(420px, 100%)",
      background: "var(--surface)", borderLeft: "1px solid var(--line)",
      transform: open ? "translateX(0)" : "translateX(100%)",
      transition: "transform 220ms ease",
      zIndex: 91,
      overflowY: "auto",
      padding: 16,
      boxSizing: "border-box",
    };
    return (
      <>
        <div style={overlayStyle} onClick={onClose} aria-hidden={!open} />
        <aside data-testid="theme-sidesheet"
               aria-hidden={open ? "false" : "true"}
               style={sheetStyle}>
          {theme && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h3 style={{ margin: 0 }}>{theme.theme}</h3>
                <button onClick={onClose} className="icon-btn"
                        style={{ background: "transparent", border: "1px solid var(--line)", color: "var(--text)", borderRadius: 6, padding: "4px 8px", cursor: "pointer" }}>
                  ✕
                </button>
              </div>
              <div style={{ marginBottom: 12 }}>
                {(theme.tickers || []).map((t) => (
                  <span key={t} className="chip" style={{ marginRight: 6 }}>{t}</span>
                ))}
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                {(theme.evidence_posts || []).map((p) => (
                  <a key={p.id} href={safeHref(p.url) || undefined} target="_blank" rel="noreferrer"
                     style={{ display: "block", padding: 10, border: "1px solid var(--line)", borderRadius: 6, color: "var(--text)", textDecoration: "none" }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{p.title}</div>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
                      r/{p.subreddit} · score {p.score} · {p.created_utc}
                    </div>
                  </a>
                ))}
              </div>
            </>
          )}
        </aside>
      </>
    );
  }

  // ---------- main page ----------

  function SignalsPage() {
    const isMobile = useIsMobile(820);
    const [rangeKey, setRangeKey] = useState("30d");
    const [selectedTickers, setSelectedTickers] = useState([]);
    const [tickerQuery, setTickerQuery] = useState("");
    const [subFilter, setSubFilter] = useState(""); // empty = all
    const [openTheme, setOpenTheme] = useState(null);

    const allTickers = useMemo(
      () => (window.SBClient ? window.SBClient.tickers() : []),
      []
    );
    const allSubs = useMemo(
      () => (window.SBClient ? window.SBClient.subreddits() : []),
      []
    );
    const themes = useMemo(
      () => (window.SBClient ? window.SBClient.themes() : []),
      []
    );

    const sinceE = useMemo(() => {
      const days = RANGE_DAYS[rangeKey] || 30;
      return Date.now() - days * DAY_MS;
    }, [rangeKey]);

    // Pull range-bounded rows once. NB: fixture's anchor date may be in the
    // past relative to "now"; we therefore fall back to the dataset's own
    // tail when no rows fall inside [now-Nd, now].
    const rangeRows = useMemo(() => {
      if (!window.SBClient) return [];
      let rows = window.SBClient.history({ since: sinceE });
      if (rows.length === 0) {
        // Anchor to the most-recent built_at present in the dataset.
        const all = window.SBClient.history({});
        if (all.length === 0) return [];
        let maxT = 0;
        for (let i = 0; i < all.length; i++) {
          const t = Date.parse(all[i].built_at);
          if (t > maxT) maxT = t;
        }
        const days = RANGE_DAYS[rangeKey] || 30;
        rows = window.SBClient.history({ since: maxT - days * DAY_MS, until: maxT });
      }
      if (subFilter) {
        rows = rows.filter((r) => r.payload && r.payload.top_subreddit === subFilter);
      }
      return rows;
    }, [sinceE, subFilter, rangeKey]);

    // Effective selection: default top-5 by mentions when empty; collapse to
    // single ticker on mobile (per PRD AC7).
    const effectiveTickers = useMemo(() => {
      let sel = selectedTickers;
      if (sel.length === 0) sel = topTickersByMentions(rangeRows, 5);
      if (isMobile && sel.length > 1) sel = sel.slice(0, 1);
      return sel;
    }, [selectedTickers, rangeRows, isMobile]);

    // Filter rows to selected tickers + group.
    const visibleRows = useMemo(() => {
      if (effectiveTickers.length === 0) return [];
      const set = new Set(effectiveTickers);
      return rangeRows.filter((r) => set.has(r.ticker));
    }, [rangeRows, effectiveTickers]);

    const tickerSeries = useMemo(() => groupByTicker(visibleRows), [visibleRows]);

    // Autocomplete suggestion list.
    const suggestions = useMemo(() => {
      const q = tickerQuery.trim().toUpperCase();
      if (!q) return [];
      return allTickers.filter((t) => t.startsWith(q) && !selectedTickers.includes(t)).slice(0, 8);
    }, [tickerQuery, allTickers, selectedTickers]);

    const addTicker = (t) => {
      if (selectedTickers.includes(t)) return;
      setSelectedTickers([...selectedTickers, t]);
      setTickerQuery("");
    };
    const removeTicker = (t) => setSelectedTickers(selectedTickers.filter((x) => x !== t));
    const onSelectSingle = (t) => setSelectedTickers(t ? [t] : []);

    return (
      <main className="shell" data-testid="signals-page">
        <div className="card">
          <div className="card-head">
            <h3>Signals · sentiment & mentions time series</h3>
            <div className="tf" role="radiogroup" aria-label="Time range">
              {Object.keys(RANGE_DAYS).map((k) => (
                <button key={k}
                        className={rangeKey === k ? "active" : ""}
                        onClick={() => setRangeKey(k)}
                        data-testid={`range-${k}`}>
                  {k}
                </button>
              ))}
            </div>
          </div>
          <div className="card-body">
            {/* Controls row */}
            <div style={{ display: "grid", gap: 12, gridTemplateColumns: isMobile ? "1fr" : "1.5fr 1fr auto", alignItems: "start", marginBottom: 16 }}>
              {/* Ticker selector */}
              {isMobile ? (
                <div>
                  <label style={{ display: "block", fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>
                    Ticker
                  </label>
                  <select data-testid="ticker-single-mobile"
                          value={effectiveTickers[0] || ""}
                          onChange={(e) => onSelectSingle(e.target.value)}
                          style={{ width: "100%", padding: 10, background: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--line)", borderRadius: 6 }}>
                    <option value="">(top by mentions)</option>
                    {allTickers.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div data-testid="ticker-multi-desktop">
                  <label style={{ display: "block", fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>
                    Tickers (type to add; leave empty for top 5)
                  </label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: 6, border: "1px solid var(--line)", borderRadius: 6, background: "var(--surface-2)" }}>
                    {selectedTickers.map((t) => (
                      <span key={t} className="chip" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        {t}
                        <button onClick={() => removeTicker(t)}
                                aria-label={`Remove ${t}`}
                                style={{ background: "transparent", border: "none", color: "var(--muted)", cursor: "pointer", padding: 0 }}>×</button>
                      </span>
                    ))}
                    <input value={tickerQuery}
                           onChange={(e) => setTickerQuery(e.target.value)}
                           onKeyDown={(e) => {
                             if (e.key === "Enter" && suggestions[0]) addTicker(suggestions[0]);
                           }}
                           placeholder="e.g. NVDA"
                           style={{ flex: "1 1 80px", minWidth: 80, background: "transparent", color: "var(--text)", border: "none", outline: "none", padding: 4 }} />
                  </div>
                  {suggestions.length > 0 && (
                    <div style={{ marginTop: 4, border: "1px solid var(--line)", borderRadius: 6, background: "var(--surface)", maxHeight: 160, overflowY: "auto" }}>
                      {suggestions.map((t) => (
                        <div key={t}
                             onClick={() => addTicker(t)}
                             style={{ padding: "6px 10px", cursor: "pointer", fontFamily: "var(--mono)" }}>
                          {t}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Subreddit overlay */}
              <div>
                <label style={{ display: "block", fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>
                  Subreddit overlay
                </label>
                {isMobile ? (
                  <select value={subFilter}
                          onChange={(e) => setSubFilter(e.target.value)}
                          style={{ width: "100%", padding: 10, background: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--line)", borderRadius: 6 }}>
                    <option value="">all subs</option>
                    {allSubs.map((s) => (
                      <option key={s} value={s}>r/{s}</option>
                    ))}
                  </select>
                ) : (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                    <label style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12 }}>
                      <input type="radio" name="sub" checked={subFilter === ""}
                             onChange={() => setSubFilter("")} />
                      all
                    </label>
                    {allSubs.map((s) => (
                      <label key={s} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12 }}>
                        <input type="radio" name="sub" checked={subFilter === s}
                               onChange={() => setSubFilter(s)} />
                        r/{s}
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* CSV export */}
              <div style={{ alignSelf: "end" }}>
                <button onClick={() => downloadCsv(visibleRows, rangeKey)}
                        data-testid="csv-export"
                        className="bmc-btn"
                        style={{ minHeight: 36, padding: "8px 14px" }}>
                  Export CSV
                </button>
              </div>
            </div>

            {/* Chart */}
            <SignalsChart tickerSeries={tickerSeries} strokes={STROKES} />

            {/* Legend */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 8, fontSize: 11, color: "var(--muted)" }}>
              {Array.from(tickerSeries.keys()).map((tk, idx) => (
                <span key={tk} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <i style={{ width: 10, height: 10, borderRadius: 2, background: STROKES[idx % STROKES.length], display: "inline-block" }} />
                  {tk}
                </span>
              ))}
              <span style={{ marginLeft: "auto" }}>
                {visibleRows.length} rows · range {rangeKey}
              </span>
            </div>
          </div>
        </div>

        {/* Themes */}
        <div className="card" style={{ marginTop: 12 }}>
          <div className="card-head">
            <h3>Themes · click to drill down</h3>
            <span className="mono" style={{ fontSize: 10, color: "var(--muted)" }}>
              {themes.length} themes
            </span>
          </div>
          <div className="card-body">
            <div style={{ display: "grid", gap: 8, gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(260px, 1fr))" }}>
              {themes.map((th) => (
                <button key={th.theme}
                        data-testid="theme-card"
                        onClick={() => setOpenTheme(th)}
                        style={{
                          textAlign: "left", padding: 12,
                          border: "1px solid var(--line)", borderRadius: 8,
                          background: "var(--surface-2)", color: "var(--text)",
                          cursor: "pointer", minHeight: 44,
                        }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>{th.theme}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>
                    {(th.tickers || []).join(" · ")}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>
                    {(th.evidence_posts || []).length} posts
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <ThemeSidesheet theme={openTheme} onClose={() => setOpenTheme(null)} />
      </main>
    );
  }

  window.SignalsPage = SignalsPage;
})();
