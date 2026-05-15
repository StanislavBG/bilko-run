/* global React */

// Live MACRO_THEMES come from window.MACRO_THEMES, emitted by snapshot.py
// (aggregations.build_macro_themes — Alpaca BTC/GLD bars + burrow trending).
// No in-file synthetic series anymore: an empty/missing payload renders an
// honest empty state, not fake noise.

// ===== Macro page component =====
function MacroPage() {
  const themes = (typeof window !== "undefined" && Array.isArray(window.MACRO_THEMES))
    ? window.MACRO_THEMES : [];
  const [selId, setSelId] = React.useState((themes[0] && themes[0].id) || "AI");

  if (!themes.length) {
    return (
      <main className="shell">
        <PageHeader title="Macro Themes" subtitle="AI · Bitcoin · Gold — thematic indexes built from live bars + subreddit chatter" />
        <div className="card"><div className="card-body">
          <div className="dim" style={{ padding: "32px 0", textAlign: "center", fontFamily: "var(--mono)", fontSize: 12 }}>
            No macro data yet — waiting for next snapshot tick.
          </div>
        </div></div>
      </main>
    );
  }

  const sel = themes.find((t) => t.id === selId) || themes[0];

  // Tolerate missing fields — live builders emit nulls/empties for
  // not-yet-populated fields (sentiment, talkingPoints, sourceBreakdown).
  const series = Array.isArray(sel.series) ? sel.series : [];
  const keyTickers = Array.isArray(sel.keyTickers) ? sel.keyTickers : [];
  const sourceBreakdown = Array.isArray(sel.sourceBreakdown) ? sel.sourceBreakdown : [];
  const talkingPoints = Array.isArray(sel.talkingPoints) ? sel.talkingPoints : [];
  const bullCount = Number(sel.bullCount || 0);
  const bearCount = Number(sel.bearCount || 0);
  const sentiment = sel.sentiment;
  const sentimentDelta = sel.sentimentDelta;
  const mentions24h = Number(sel.mentions24h || 0);
  const mentionsDelta = sel.mentionsDelta;
  const headlinePrice = sel.headlinePrice;
  const headlineValue = sel.headlineValue;
  const headlineDelta = sel.headlineDelta;
  const headlineDeltaPct = sel.headlineDeltaPct;

  // small line renderer
  const W = 760, H = 200, PAD_L = 50, PAD_R = 12, PAD_T = 12, PAD_B = 22;
  const hasSeries = series.length >= 2;
  const min = hasSeries ? Math.min(...series) * 0.99 : 0;
  const max = hasSeries ? Math.max(...series) * 1.01 : 1;
  const range = (max - min) || 1;
  const xStep = hasSeries ? (W - PAD_L - PAD_R) / (series.length - 1) : 0;
  const yFor = (v) => PAD_T + ((max - v) / range) * (H - PAD_T - PAD_B);
  const xFor = (i) => PAD_L + i * xStep;
  const pts = hasSeries ? series.map((v, i) => `${xFor(i)},${yFor(v)}`).join(" ") : "";
  const area = hasSeries ? `${PAD_L},${H - PAD_B} ${pts} ${xFor(series.length - 1)},${H - PAD_B}` : "";
  const yTicks = hasSeries ? [min, min + range / 2, max] : [];
  const fmtV = (v) => headlinePrice ? "$" + Math.round(v).toLocaleString() : v.toFixed(0);

  const totalShare = sourceBreakdown.reduce((a, b) => a + (b.share || 0), 0) || 1;
  const totalPosts = bullCount + bearCount;
  const bullPct = totalPosts ? bullCount / totalPosts : 0;

  return (
    <main className="shell">
      <PageHeader title="Macro Themes" subtitle="AI · Bitcoin · Gold — thematic indexes built from subreddit chatter, with the tickers each theme touches" />

      {/* THEME SELECTOR CARDS */}
      <div className="grid grid-12" style={{ marginBottom: 12 }}>
        {themes.map((t) => {
          const m24 = Number(t.mentions24h || 0);
          const hv = t.headlineValue;
          const hp = t.headlinePrice;
          const hd = t.headlineDelta;
          const hdp = t.headlineDeltaPct;
          const sLine = Array.isArray(t.series) ? t.series : [];
          return (
            <div key={t.id} className="col-4 col-md-12">
              <div onClick={() => setSelId(t.id)}
                style={{
                  background: "var(--surface)",
                  border: "1px solid " + (selId === t.id ? t.color : "var(--line)"),
                  borderRadius: 6, padding: 16, cursor: "pointer",
                  boxShadow: selId === t.id ? `0 0 0 1px ${t.color} inset` : "none",
                }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <span style={{ fontSize: 20, color: t.color, fontFamily: "var(--mono)" }}>{t.icon}</span>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase" }}>{t.id}</span>
                  <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--muted)", fontFamily: "var(--mono)" }}>{m24.toLocaleString()} mentions/24h</span>
                </div>
                <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>{t.name}</div>
                <div className="mono" style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-0.01em" }}>
                  {hv == null ? "—" : (hp ? "$" + Number(hv).toLocaleString() : Number(hv).toFixed(1))}
                </div>
                <div className="mono" style={{ fontSize: 12, marginTop: 4 }}>
                  {hd == null && hdp == null ? (
                    <span className="dim">no Δ data</span>
                  ) : (
                    <span className={(hd ?? hdp) >= 0 ? "up" : "down"}>
                      {hd != null ? ((hd >= 0 ? "+" : "") + Number(hd).toLocaleString()) : ""}
                      {hdp != null ? ` (${hdp >= 0 ? "+" : ""}${Number(hdp).toFixed(2)}%)` : ""}
                    </span>
                  )}
                  <span className="dim" style={{ marginLeft: 6 }}>24h</span>
                </div>
                <div style={{ marginTop: 10 }}>
                  <Sparkline data={sLine} width={300} height={36} color={t.color} />
                </div>
                <div style={{ display: "flex", gap: 14, marginTop: 10, fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--muted)" }}>
                  <span>sentiment {t.sentiment == null ? <span className="dim">—</span> : <span className={t.sentiment >= 0 ? "up" : "down"}>{t.sentiment >= 0 ? "+" : ""}{Number(t.sentiment).toFixed(2)}</span>}</span>
                  <span>Δ24h {t.sentimentDelta == null ? <span className="dim">—</span> : <span className={t.sentimentDelta >= 0 ? "up" : "down"}>{t.sentimentDelta >= 0 ? "+" : ""}{Number(t.sentimentDelta).toFixed(2)}</span>}</span>
                  <span style={{ marginLeft: "auto" }}>mentions {t.mentionsDelta == null ? <span className="dim">—</span> : <span className={t.mentionsDelta >= 0 ? "up" : "down"}>{t.mentionsDelta >= 0 ? "+" : ""}{Number(t.mentionsDelta).toFixed(0)}%</span>}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* SELECTED CHART */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-head">
          <h3>{sel.name} · 60-day chart</h3>
          <span className="mono" style={{ fontSize: 10, color: "var(--muted)" }}>{sel.headlineLabel}</span>
        </div>
        <div className="chart-wrap">
          {hasSeries ? (
            <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="200" style={{ display: "block" }}>
              {yTicks.map((v, i) => (
                <g key={i}>
                  <line x1={PAD_L} x2={W - PAD_R} y1={yFor(v)} y2={yFor(v)} stroke="var(--line)" strokeDasharray="2 4" />
                  <text x={PAD_L - 6} y={yFor(v) + 3} fill="var(--muted)" fontSize="10" textAnchor="end" fontFamily="var(--mono)">{fmtV(v)}</text>
                </g>
              ))}
              <polyline points={area} fill={sel.color} opacity="0.10" />
              <polyline points={pts} fill="none" stroke={sel.color} strokeWidth="1.8" strokeLinejoin="round" />
            </svg>
          ) : (
            <div className="dim" style={{ padding: "32px 0", textAlign: "center", fontFamily: "var(--mono)", fontSize: 12 }}>
              No price series available — check Alpaca / burrow data sources.
            </div>
          )}
        </div>
      </div>

      {/* TWO-COLUMN: AI summary + tickers */}
      <div className="grid grid-12" style={{ marginBottom: 12 }}>
        {/* AI SUMMARY */}
        <div className="col-7 col-md-12">
          <div className="card">
            <div className="card-head">
              <h3>AI summary · what the 10 subs are saying about {sel.name}</h3>
              <span className="mono" style={{ fontSize: 10, color: "var(--muted)" }}>regenerated 4m ago</span>
            </div>
            <div className="card-body">
              {/* sentiment + bull/bear gauge */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 0, border: "1px solid var(--line)", borderRadius: 4, marginBottom: 14 }}>
                <div style={{ padding: "10px 14px", borderRight: "1px solid var(--line)" }}>
                  <div className="label" style={{ fontFamily: "var(--mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)" }}>Aggregate sentiment</div>
                  <div className="mono" style={{ fontSize: 18, fontWeight: 600, marginTop: 2 }}>
                    {sentiment == null ? <span className="dim">—</span> : (
                      <span className={sentiment >= 0 ? "up" : "down"}>{sentiment >= 0 ? "+" : ""}{Number(sentiment).toFixed(2)}</span>
                    )}
                  </div>
                </div>
                <div style={{ padding: "10px 14px", borderRight: "1px solid var(--line)" }}>
                  <div className="label" style={{ fontFamily: "var(--mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)" }}>Bull / Bear posts</div>
                  <div className="mono" style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}>
                    <span className="up">{bullCount.toLocaleString()}</span>
                    <span className="dim"> / </span>
                    <span className="down">{bearCount.toLocaleString()}</span>
                  </div>
                  <div style={{ width: "100%", height: 4, background: "var(--neg-bg)", borderRadius: 2, marginTop: 6, overflow: "hidden" }}>
                    <div style={{ width: `${bullPct * 100}%`, height: "100%", background: "var(--pos)" }} />
                  </div>
                </div>
                <div style={{ padding: "10px 14px" }}>
                  <div className="label" style={{ fontFamily: "var(--mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)" }}>Mentions/24h</div>
                  <div className="mono" style={{ fontSize: 18, fontWeight: 600, marginTop: 2 }}>
                    {mentions24h.toLocaleString()}
                    {mentionsDelta != null && (
                      <span className={mentionsDelta >= 0 ? "up" : "down"} style={{ fontSize: 11 }}> {mentionsDelta >= 0 ? "+" : ""}{Number(mentionsDelta).toFixed(0)}%</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="label" style={{ fontFamily: "var(--mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)", marginBottom: 8 }}>Key talking points</div>
              {talkingPoints.length ? (
                <ul style={{ margin: 0, padding: "0 0 0 16px", color: "var(--text-2)", fontSize: 13, lineHeight: 1.65 }}>
                  {talkingPoints.map((tp, i) => <li key={i} style={{ marginBottom: 6 }}>{tp}</li>)}
                </ul>
              ) : (
                <div className="dim" style={{ fontFamily: "var(--mono)", fontSize: 11.5 }}>
                  Talking points are agent-generated; not yet wired in this build.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* SOURCE BREAKDOWN */}
        <div className="col-5 col-md-12">
          <div className="card">
            <div className="card-head">
              <h3>Where the chatter lives</h3>
              <span className="mono" style={{ fontSize: 10, color: "var(--muted)" }}>share of {sel.name} mentions</span>
            </div>
            <div className="card-body">
              {sourceBreakdown.length ? (
                <div style={{ display: "grid", gap: 8 }}>
                  {sourceBreakdown.map((s) => (
                    <div key={s.sub} style={{ display: "grid", gridTemplateColumns: "150px 1fr 50px", alignItems: "center", gap: 10, fontFamily: "var(--mono)", fontSize: 11.5 }}>
                      <span style={{ color: "var(--text-2)" }}>r/{s.sub}</span>
                      <div style={{ height: 16, background: "var(--surface-2)", borderRadius: 3, position: "relative", border: "1px solid var(--line)", overflow: "hidden" }}>
                        <div style={{ width: `${((s.share || 0) / totalShare) * 100}%`, height: "100%", background: sel.color, opacity: 0.8 }} />
                      </div>
                      <span style={{ textAlign: "right" }}>{((s.share || 0) * 100).toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="dim" style={{ fontFamily: "var(--mono)", fontSize: 11.5 }}>
                  Source breakdown not yet computed.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* RELEVANT TICKERS */}
      <div className="card">
        <div className="card-head">
          <h3>Tickers tied to {sel.name}</h3>
          <span className="mono" style={{ fontSize: 10, color: "var(--muted)" }}>system positions tagged</span>
        </div>
        <div className="card-body tight">
          <table className="trades">
            <thead>
              <tr>
                <th>Ticker</th>
                <th>Role</th>
                <th className="num">Mentions 24h</th>
                <th className="num">Sentiment</th>
                <th className="num">Strategy P&L</th>
                <th>Engine action</th>
              </tr>
            </thead>
            <tbody>
              {keyTickers.map((t) => {
                const mn = Number(t.mentions || 0);
                const sn = t.sentiment;
                const pn = Number(t.pnl || 0);
                const action = t.action || "—";
                return (
                  <tr key={t.ticker}>
                    <td className="ticker">{t.ticker}</td>
                    <td className="dim">{t.role}</td>
                    <td className="num">{mn.toLocaleString()}</td>
                    <td className="num">
                      {sn == null ? <span className="dim">—</span> : (
                        <span className={sn >= 0 ? "up" : "down"}>{sn >= 0 ? "+" : ""}{Number(sn).toFixed(2)}</span>
                      )}
                    </td>
                    <td className={`num ${pn > 0 ? "up" : pn < 0 ? "down" : "dim"}`}>
                      {pn === 0 ? "—" : (pn > 0 ? "+" : "−") + "$" + Math.abs(pn).toLocaleString()}
                    </td>
                    <td>
                      <span className={`pill ${action === "HOLDING" ? "holding" : action === "WATCHING" ? "watching" : (typeof action === "string" && action.startsWith("STOPPED")) ? "stopped" : (typeof action === "string" && action.startsWith("CLOSED")) ? "closed" : "passed"}`}>{action}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}

window.MacroPage = MacroPage;
