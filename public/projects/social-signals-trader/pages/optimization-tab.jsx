/* global React, OptimizationClient */
/* dashboard/pages/optimization-tab.jsx — PRD 47 Optimization tab.
 *
 * Reads window.OptimizationClient (dashboard/lib/optimization-client.js) which
 * either POSTs to the trader's loopback http://127.0.0.1:8765/optimization
 * endpoints or, when `?fixture=opt`, resolves against
 * window.OPTIMIZATION_FIXTURE.
 *
 * Mobile (<=820px): heatmap collapses to a list view. A/B view stacks.
 */
(function () {
  "use strict";
  const { useState, useMemo, useEffect } = React;

  // ---- helpers ------------------------------------------------------------

  function useIsMobile(bp) {
    const [m, setM] = useState(
      typeof window !== "undefined" ? window.innerWidth <= bp : false
    );
    useEffect(() => {
      const onR = () => setM(window.innerWidth <= bp);
      window.addEventListener("resize", onR);
      return () => window.removeEventListener("resize", onR);
    }, [bp]);
    return m;
  }

  // Diverging palette: red < 0, gray ≈ 0, green > 1.
  // Input domain ~[-1, 2.5]; outside that we clamp.
  function colorFor(metric, kind /* "sharpe" | "win_rate" | "max_drawdown" */) {
    if (metric == null || Number.isNaN(metric)) return "var(--surface-2)";
    if (kind === "win_rate") {
      const t = Math.max(0, Math.min(1, metric));
      // 0 → red, 0.5 → gray, 1 → green
      const g = Math.round(80 + t * 140);
      const r = Math.round(220 - t * 140);
      return `rgb(${r},${g},90)`;
    }
    if (kind === "max_drawdown") {
      // Less negative is better. Domain [-0.25, 0].
      const t = Math.max(0, Math.min(1, (0.25 + metric) / 0.25));
      const g = Math.round(80 + t * 140);
      const r = Math.round(220 - t * 140);
      return `rgb(${r},${g},90)`;
    }
    // sharpe
    const t = Math.max(-1, Math.min(2.5, metric));
    if (t < 0) {
      const k = (t + 1) / 1; // 0..1
      const r = Math.round(180 + (1 - k) * 60);
      const g = Math.round(70 + k * 100);
      return `rgb(${r},${g},80)`;
    }
    const k = Math.min(1, t / 2.5);
    const r = Math.round(180 - k * 120);
    const g = Math.round(170 + k * 60);
    return `rgb(${r},${g},90)`;
  }

  function fmtParams(p) {
    return Object.keys(p)
      .map((k) => `${k}=${typeof p[k] === "number" ? p[k] : JSON.stringify(p[k])}`)
      .join(" ");
  }

  // ---- heatmap ------------------------------------------------------------

  function Heatmap({ result, colorKind, onCellHover }) {
    // Detect param axes from the first cell.
    if (!result || !result.cells || !result.cells.length) {
      return <div className="dim" style={{ padding: 16 }}>no cells</div>;
    }
    const cell0 = result.cells[0];
    const paramKeys = Object.keys(cell0.params);
    const xKey = paramKeys[0];
    const yKey = paramKeys[1] || paramKeys[0];
    const xVals = Array.from(new Set(result.cells.map((c) => c.params[xKey]))).sort((a, b) => a - b);
    const yVals = Array.from(new Set(result.cells.map((c) => c.params[yKey]))).sort((a, b) => a - b);

    const CELL = 64;
    const PAD_L = 60;
    const PAD_T = 28;
    const W = PAD_L + xVals.length * CELL + 16;
    const H = PAD_T + yVals.length * CELL + 24;

    const lookup = new Map();
    for (const c of result.cells) {
      lookup.set(`${c.params[xKey]}|${c.params[yKey]}`, c);
    }

    return (
      <svg data-testid="opt-heatmap"
           viewBox={`0 0 ${W} ${H}`}
           preserveAspectRatio="xMidYMid meet"
           style={{ width: "100%", height: "auto", maxWidth: 720, display: "block" }}>
        {/* y axis labels */}
        {yVals.map((yv, j) => (
          <text key={`yl${j}`} x={PAD_L - 8} y={PAD_T + j * CELL + CELL / 2 + 4}
                fill="var(--muted)" fontSize="10" fontFamily="var(--mono)" textAnchor="end">
            {yv}
          </text>
        ))}
        {/* x axis labels */}
        {xVals.map((xv, i) => (
          <text key={`xl${i}`} x={PAD_L + i * CELL + CELL / 2} y={PAD_T - 8}
                fill="var(--muted)" fontSize="10" fontFamily="var(--mono)" textAnchor="middle">
            {xv}
          </text>
        ))}
        {/* axis names */}
        <text x={PAD_L + (xVals.length * CELL) / 2} y={H - 6}
              fill="var(--muted)" fontSize="10" fontFamily="var(--mono)" textAnchor="middle">
          {xKey}
        </text>
        <text x={10} y={PAD_T + (yVals.length * CELL) / 2}
              fill="var(--muted)" fontSize="10" fontFamily="var(--mono)" textAnchor="middle"
              transform={`rotate(-90, 10, ${PAD_T + (yVals.length * CELL) / 2})`}>
          {yKey}
        </text>
        {/* cells */}
        {yVals.map((yv, j) =>
          xVals.map((xv, i) => {
            const c = lookup.get(`${xv}|${yv}`);
            if (!c) return null;
            const metric = c[colorKind] != null ? c[colorKind] : c.sharpe;
            return (
              <g key={`c${i}_${j}`}
                 onMouseEnter={() => onCellHover && onCellHover(c)}
                 onMouseLeave={() => onCellHover && onCellHover(null)}>
                <rect x={PAD_L + i * CELL + 2} y={PAD_T + j * CELL + 2}
                      width={CELL - 4} height={CELL - 4}
                      fill={colorFor(metric, colorKind)}
                      stroke="var(--line)" strokeWidth="0.5" rx="3" />
                <text x={PAD_L + i * CELL + CELL / 2}
                      y={PAD_T + j * CELL + CELL / 2 + 4}
                      fill="#111" fontSize="11" fontFamily="var(--mono)" textAnchor="middle">
                  {typeof metric === "number" ? metric.toFixed(2) : "—"}
                </text>
              </g>
            );
          })
        )}
      </svg>
    );
  }

  // Mobile fallback for the heatmap — flat list of cells.
  function HeatmapList({ result, onCellHover }) {
    if (!result || !result.cells || !result.cells.length) return null;
    return (
      <div data-testid="opt-heatmap-list">
        {result.cells.map((c, i) => (
          <div key={i}
               onMouseEnter={() => onCellHover && onCellHover(c)}
               onClick={() => onCellHover && onCellHover(c)}
               style={{
                 padding: 10, borderBottom: "1px solid var(--line)",
                 display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "center",
               }}>
            <div style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{fmtParams(c.params)}</div>
            <div style={{ display: "flex", gap: 8, fontFamily: "var(--mono)", fontSize: 11 }}>
              <span>S {c.sharpe.toFixed(2)}</span>
              <span style={{ color: "var(--muted)" }}>W {(c.win_rate * 100).toFixed(0)}%</span>
              <span style={{ color: "var(--neg)" }}>DD {(c.max_drawdown * 100).toFixed(1)}%</span>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ---- A/B equity curves --------------------------------------------------

  function ABEquity({ resultA, resultB }) {
    const W = 720, H = 240, PAD_L = 48, PAD_R = 16, PAD_T = 12, PAD_B = 26;
    const curveA = resultA && resultA.winner
      ? (resultA.cells.find((c) => c.params === resultA.cells.find((x) => x.sharpe === resultA.winner.sharpe).params) || resultA.cells[0]).equity_curve
      : null;
    // Simpler: pick the winning cell by matching sharpe.
    function winnerCurve(r) {
      if (!r || !r.cells || !r.winner) return null;
      const w = r.cells.find((c) => c.sharpe === r.winner.sharpe);
      return w ? w.equity_curve : null;
    }
    const cA = winnerCurve(resultA);
    const cB = winnerCurve(resultB);
    const curves = [cA, cB].filter(Boolean);
    if (curves.length === 0) {
      return (
        <svg data-testid="opt-ab-equity" viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }}>
          <text x={W / 2} y={H / 2} fill="var(--muted)" textAnchor="middle" fontSize="12">
            run sweeps for both sleeves
          </text>
        </svg>
      );
    }
    let vMin = Infinity, vMax = -Infinity;
    const maxLen = Math.max(...curves.map((c) => c.length));
    for (const c of curves) {
      for (const p of c) {
        if (p.v < vMin) vMin = p.v;
        if (p.v > vMax) vMax = p.v;
      }
    }
    if (vMax === vMin) vMax = vMin + 1;
    const xFor = (i) => PAD_L + (i / Math.max(1, maxLen - 1)) * (W - PAD_L - PAD_R);
    const yFor = (v) => PAD_T + (1 - (v - vMin) / (vMax - vMin)) * (H - PAD_T - PAD_B);
    const strokes = ["var(--pos)", "var(--info)"];
    return (
      <svg data-testid="opt-ab-equity"
           viewBox={`0 0 ${W} ${H}`}
           preserveAspectRatio="xMidYMid meet"
           style={{ width: "100%", height: "auto", display: "block" }}>
        {/* gridlines */}
        {[0, 0.25, 0.5, 0.75, 1].map((g) => {
          const v = vMin + (1 - g) * (vMax - vMin);
          return (
            <g key={g}>
              <line x1={PAD_L} x2={W - PAD_R} y1={yFor(v)} y2={yFor(v)}
                    stroke="var(--line)" strokeDasharray="2 4" />
              <text x={PAD_L - 6} y={yFor(v) + 3} fill="var(--muted)"
                    fontSize="10" fontFamily="var(--mono)" textAnchor="end">
                {v.toFixed(0)}
              </text>
            </g>
          );
        })}
        {[cA, cB].map((c, idx) => {
          if (!c) return null;
          const pts = c.map((p, i) => `${xFor(i)},${yFor(p.v)}`).join(" ");
          return (
            <polyline key={idx}
                      points={pts}
                      fill="none"
                      stroke={strokes[idx]}
                      strokeWidth="2"
                      strokeLinejoin="round"
                      strokeLinecap="round" />
          );
        })}
      </svg>
    );
  }

  // ---- promote modal ------------------------------------------------------

  function PromoteModal({ open, onClose, sleeveId, params, onConfirm, busy, error }) {
    if (!open) return null;
    return (
      <div role="dialog" aria-modal="true" data-testid="opt-promote-modal"
           style={{
             position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
             display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
           }}>
        <div style={{
          background: "var(--surface)", border: "1px solid var(--line)",
          borderRadius: 10, padding: 20, maxWidth: 460, width: "90%",
        }}>
          <h3 style={{ marginTop: 0 }}>Promote to LIVE?</h3>
          <p style={{ fontFamily: "var(--mono)", fontSize: 13, color: "var(--text)" }}>
            {sleeveId} · {fmtParams(params)}
          </p>
          {error && (
            <div style={{ color: "var(--neg)", fontSize: 12, marginBottom: 8 }}>
              {String(error)}
            </div>
          )}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={onClose} disabled={busy}
                    style={{ padding: "8px 14px", background: "transparent",
                             color: "var(--text)", border: "1px solid var(--line)",
                             borderRadius: 6, cursor: "pointer" }}>
              Cancel
            </button>
            <button onClick={onConfirm} disabled={busy}
                    data-testid="opt-promote-confirm"
                    style={{ padding: "8px 14px", background: "var(--pos)",
                             color: "#111", border: "none", borderRadius: 6,
                             cursor: busy ? "wait" : "pointer", fontWeight: 600 }}>
              {busy ? "Promoting…" : "Promote to LIVE"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---- main page ----------------------------------------------------------

  // ---- Variants subtab (PRD 72) ------------------------------------------

  function VariantEvaluation({ client, isMobile }) {
    const [variants, setVariants] = useState([]);
    const [selected, setSelected] = useState([]);
    const [fromDate, setFromDate] = useState("2026-04-01");
    const [toDate, setToDate] = useState("2026-05-23");
    const [rows, setRows] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
      let cancelled = false;
      async function load() {
        try {
          const res = await client.listVariants();
          if (cancelled) return;
          const list = (res && res.variants) || [];
          setVariants(list);
          // Default-select up to 3 variants so the chart renders something
          // useful before the operator clicks anything.
          setSelected(list.slice(0, 3).map((v) => v.id));
        } catch (e) {
          if (!cancelled) setError(e.message || String(e));
        }
      }
      load();
      return () => { cancelled = true; };
    }, []);

    function toggleVariant(id) {
      setSelected((s) =>
        s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);
    }

    async function runEval() {
      if (!selected.length) return;
      setBusy(true);
      setError(null);
      try {
        const res = await client.evaluateVariants(selected, fromDate, toDate, "earnings");
        setRows(res.rows || []);
      } catch (e) {
        setError(e.message || String(e));
      } finally {
        setBusy(false);
      }
    }

    const sortedRows = useMemo(() => {
      if (!rows) return [];
      return [...rows].sort((a, b) => (b.sharpe || 0) - (a.sharpe || 0));
    }, [rows]);

    return (
      <div data-testid="variants-subtab">
        <div className="card">
          <div className="card-head"><h3>Variants · side-by-side evaluation</h3></div>
          <div className="card-body">
            <div style={{
              display: "grid", gap: 12,
              gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr auto",
              alignItems: "end", marginBottom: 12,
            }}>
              <div>
                <label style={{ display: "block", fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>
                  From
                </label>
                <input type="date" value={fromDate}
                       data-testid="variants-from"
                       onChange={(e) => setFromDate(e.target.value)}
                       style={inputStyle()} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>
                  To
                </label>
                <input type="date" value={toDate}
                       data-testid="variants-to"
                       onChange={(e) => setToDate(e.target.value)}
                       style={inputStyle()} />
              </div>
              <button onClick={runEval}
                      disabled={busy || selected.length === 0}
                      data-testid="variants-run"
                      className="bmc-btn"
                      style={{ minHeight: 36, padding: "8px 14px" }}>
                {busy ? "Evaluating…" : "Run evaluation"}
              </button>
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 6 }}>
                Variants ({selected.length} selected)
              </div>
              <div data-testid="variants-multiselect"
                   style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {variants.map((v) => {
                  const on = selected.includes(v.id);
                  return (
                    <button key={v.id}
                            data-testid={`variants-toggle-${v.id}`}
                            onClick={() => toggleVariant(v.id)}
                            style={{
                              padding: "6px 10px", fontSize: 11,
                              fontFamily: "var(--mono)",
                              background: on ? "var(--surface-2)" : "transparent",
                              border: "1px solid var(--line)",
                              borderRadius: 6,
                              color: on ? "var(--text)" : "var(--muted)",
                              cursor: "pointer",
                            }}>
                      {v.id}
                    </button>
                  );
                })}
              </div>
            </div>

            {error && (
              <div data-testid="variants-error"
                   style={{ color: "var(--neg)", fontSize: 12, marginBottom: 8 }}>
                {error}
              </div>
            )}

            <VariantEquityOverlay rows={rows} />

            {sortedRows.length > 0 && (
              <table data-testid="variants-results-table"
                     style={{
                       width: "100%", marginTop: 12, fontSize: 12,
                       fontFamily: "var(--mono)", borderCollapse: "collapse",
                     }}>
                <thead>
                  <tr style={{ textAlign: "left", color: "var(--muted)" }}>
                    <th style={{ padding: "6px 8px" }}>variant</th>
                    <th style={{ padding: "6px 8px", textAlign: "right" }}>n</th>
                    <th style={{ padding: "6px 8px", textAlign: "right" }}>win %</th>
                    <th style={{ padding: "6px 8px", textAlign: "right" }}>sharpe</th>
                    <th style={{ padding: "6px 8px", textAlign: "right" }}>max dd</th>
                    <th style={{ padding: "6px 8px", textAlign: "right" }}>final</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRows.map((r) => (
                    <tr key={r.variant_id}
                        style={{ borderTop: "1px solid var(--line)" }}>
                      <td style={{ padding: "6px 8px" }}>{r.variant_id}</td>
                      <td style={{ padding: "6px 8px", textAlign: "right" }}>{r.n_trades}</td>
                      <td style={{ padding: "6px 8px", textAlign: "right" }}>
                        {(r.win_rate * 100).toFixed(1)}
                      </td>
                      <td style={{ padding: "6px 8px", textAlign: "right" }}>
                        {(r.sharpe || 0).toFixed(2)}
                      </td>
                      <td style={{ padding: "6px 8px", textAlign: "right", color: "var(--neg)" }}>
                        {(r.max_dd_pct * 100).toFixed(1)}
                      </td>
                      <td style={{ padding: "6px 8px", textAlign: "right",
                                   color: (r.final_equity_pct || 0) >= 0 ? "var(--pos)" : "var(--neg)" }}>
                        {((r.final_equity_pct || 0) * 100).toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    );
  }

  function VariantEquityOverlay({ rows }) {
    const W = 720, H = 240, PAD_L = 48, PAD_R = 16, PAD_T = 12, PAD_B = 26;
    if (!rows || rows.length === 0) {
      return (
        <svg data-testid="variants-equity-overlay" viewBox={`0 0 ${W} ${H}`}
             style={{ width: "100%", height: "auto" }}>
          <text x={W / 2} y={H / 2} fill="var(--muted)" textAnchor="middle" fontSize="12">
            run an evaluation to see equity curves
          </text>
        </svg>
      );
    }
    const colors = ["var(--pos)", "var(--info)", "var(--warn)", "var(--neg)",
                    "#a48ce6", "#3fbac2", "#e69a3a", "#7eb87e"];
    let vMin = Infinity, vMax = -Infinity;
    let maxLen = 0;
    rows.forEach((r) => {
      const c = r.equity_curve || [];
      if (c.length > maxLen) maxLen = c.length;
      c.forEach((p) => {
        if (p.equity < vMin) vMin = p.equity;
        if (p.equity > vMax) vMax = p.equity;
      });
    });
    if (!Number.isFinite(vMin)) { vMin = 0; vMax = 1; }
    if (vMax === vMin) vMax = vMin + 0.001;
    const xFor = (i) => PAD_L + (i / Math.max(1, maxLen - 1)) * (W - PAD_L - PAD_R);
    const yFor = (v) => PAD_T + (1 - (v - vMin) / (vMax - vMin)) * (H - PAD_T - PAD_B);
    return (
      <div>
        <svg data-testid="variants-equity-overlay"
             viewBox={`0 0 ${W} ${H}`}
             preserveAspectRatio="xMidYMid meet"
             style={{ width: "100%", height: "auto", display: "block" }}>
          {[0, 0.25, 0.5, 0.75, 1].map((g) => {
            const v = vMin + (1 - g) * (vMax - vMin);
            return (
              <g key={g}>
                <line x1={PAD_L} x2={W - PAD_R} y1={yFor(v)} y2={yFor(v)}
                      stroke="var(--line)" strokeDasharray="2 4" />
                <text x={PAD_L - 6} y={yFor(v) + 3} fill="var(--muted)"
                      fontSize="10" fontFamily="var(--mono)" textAnchor="end">
                  {v.toFixed(3)}
                </text>
              </g>
            );
          })}
          {rows.map((r, idx) => {
            const curve = r.equity_curve || [];
            if (!curve.length) return null;
            const pts = curve.map((p, i) => `${xFor(i)},${yFor(p.equity)}`).join(" ");
            return (
              <polyline key={r.variant_id}
                        points={pts}
                        fill="none"
                        stroke={colors[idx % colors.length]}
                        strokeWidth="2"
                        strokeLinejoin="round"
                        strokeLinecap="round" />
            );
          })}
        </svg>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: 11,
                      color: "var(--muted)", marginTop: 6 }}>
          {rows.map((r, idx) => (
            <span key={r.variant_id}
                  style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <i style={{
                width: 10, height: 10,
                background: colors[idx % colors.length],
                display: "inline-block", borderRadius: 2,
              }} />
              {r.variant_id}
            </span>
          ))}
        </div>
      </div>
    );
  }

  function OptimizationPage() {
    const isMobile = useIsMobile(820);
    const client = window.OptimizationClient;
    const sleeves = client ? client.listSleeves() : [];
    const [subtab, setSubtab] = useState("sweep");  // "sweep" | "variants"

    const [sleeveId, setSleeveId] = useState(sleeves[0] || "OPT_FLOW");
    const [ranges, setRanges] = useState(() => initRanges(client, sleeves[0] || "OPT_FLOW"));
    const [colorKind, setColorKind] = useState("sharpe");
    const [hoverCell, setHoverCell] = useState(null);
    const [sweepResult, setSweepResult] = useState(null);
    const [sweepError, setSweepError] = useState(null);
    const [sweeping, setSweeping] = useState(false);
    const [promotedAt, setPromotedAt] = useState(null);

    // A/B state
    const [abLeft, setAbLeft] = useState(sleeves[0] || "OPT_FLOW");
    const [abRight, setAbRight] = useState(sleeves[1] || sleeves[0] || "BLEND_CONS");
    const [abResultA, setAbResultA] = useState(null);
    const [abResultB, setAbResultB] = useState(null);
    const [abBusy, setAbBusy] = useState(false);

    // Promote modal
    const [promoteOpen, setPromoteOpen] = useState(false);
    const [promoteBusy, setPromoteBusy] = useState(false);
    const [promoteError, setPromoteError] = useState(null);

    function initRanges(client, sid) {
      if (!client) return {};
      const schema = client.paramSchema(sid);
      const out = {};
      for (const k of Object.keys(schema)) out[k] = { ...schema[k] };
      return out;
    }

    // Reset ranges on sleeve change.
    useEffect(() => {
      if (!client) return;
      setRanges(initRanges(client, sleeveId));
      setSweepResult(null);
      setSweepError(null);
      setPromotedAt(null);
    }, [sleeveId]);

    const paramGrid = useMemo(() => {
      if (!client) return {};
      const out = {};
      for (const k of Object.keys(ranges)) {
        out[k] = client.rangeToValues(ranges[k].min, ranges[k].max, ranges[k].step);
      }
      return out;
    }, [ranges]);

    const gridN = useMemo(() => (client ? client.gridSize(paramGrid) : 0), [paramGrid]);
    const overCap = client ? gridN > client.MAX_GRID : false;

    async function runSweep() {
      setSweeping(true);
      setSweepError(null);
      try {
        const res = await client.sweep(sleeveId, paramGrid,
          ["2026-02-22", "2026-05-22"]);
        setSweepResult(res);
      } catch (e) {
        setSweepError(e.message || String(e));
      } finally {
        setSweeping(false);
      }
    }

    async function runAB() {
      setAbBusy(true);
      try {
        const grid = (sid) => {
          const sch = client.paramSchema(sid);
          const g = {};
          for (const k of Object.keys(sch)) {
            g[k] = client.rangeToValues(sch[k].min, sch[k].max, sch[k].step * 3);
          }
          return g;
        };
        const range = ["2026-02-22", "2026-05-22"];
        const [a, b] = await Promise.all([
          client.sweep(abLeft, grid(abLeft), range),
          client.sweep(abRight, grid(abRight), range),
        ]);
        setAbResultA(a);
        setAbResultB(b);
      } catch (e) {
        // surface in card body
        setAbResultA(null);
        setAbResultB(null);
      } finally {
        setAbBusy(false);
      }
    }

    async function confirmPromote() {
      if (!sweepResult || !sweepResult.winner) return;
      setPromoteBusy(true);
      setPromoteError(null);
      try {
        const res = await client.promote(
          sleeveId,
          sweepResult.winner.params,
          sweepResult.sweep_id,
        );
        setPromotedAt(res.entry ? res.entry.promoted_at : new Date().toISOString());
        setPromoteOpen(false);
      } catch (e) {
        setPromoteError(e.message || String(e));
      } finally {
        setPromoteBusy(false);
      }
    }

    if (!client) {
      return (
        <main className="shell">
          <div className="card"><div className="card-body">
            OptimizationClient missing — check optimization-client.js loaded.
          </div></div>
        </main>
      );
    }

    return (
      <main className="shell" data-testid="optimization-page">
        {/* ===== Subtab switcher (PRD 72) ===== */}
        <div data-testid="opt-subtab-switcher"
             role="tablist" aria-label="Optimization view"
             style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          {[["sweep", "Sweep / A·B"], ["variants", "Variants"]].map(([id, label]) => (
            <button key={id}
                    role="tab"
                    aria-selected={subtab === id}
                    data-testid={`opt-subtab-${id}`}
                    onClick={() => setSubtab(id)}
                    style={{
                      padding: "6px 14px",
                      background: subtab === id ? "var(--surface-2)" : "transparent",
                      color: "var(--text)",
                      border: "1px solid var(--line)",
                      borderRadius: 6, cursor: "pointer", fontSize: 12,
                    }}>
              {label}
            </button>
          ))}
        </div>

        {subtab === "variants" && (
          <VariantEvaluation client={client} isMobile={isMobile} />
        )}

        {subtab === "sweep" && <>
        {/* ===== Sweep card ===== */}
        <div className="card">
          <div className="card-head">
            <h3>Optimization · sleeve parameter sweep</h3>
            {promotedAt && (
              <span className="mono" style={{ fontSize: 10, color: "var(--pos)" }}>
                promoted {promotedAt}
              </span>
            )}
          </div>
          <div className="card-body">
            <div style={{
              display: "grid", gap: 12,
              gridTemplateColumns: isMobile ? "1fr" : "180px 1fr auto", alignItems: "end",
              marginBottom: 16,
            }}>
              <div>
                <label style={{ display: "block", fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>
                  Sleeve
                </label>
                <select value={sleeveId}
                        data-testid="opt-sleeve-select"
                        onChange={(e) => setSleeveId(e.target.value)}
                        style={{
                          width: "100%", padding: 10,
                          background: "var(--surface-2)", color: "var(--text)",
                          border: "1px solid var(--line)", borderRadius: 6,
                        }}>
                  {sleeves.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div style={{
                display: "grid", gap: 8,
                gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)",
              }}>
                {Object.keys(ranges).map((k) => (
                  <div key={k} style={{
                    padding: 8, border: "1px solid var(--line)", borderRadius: 6,
                  }}>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>
                      {k}
                    </div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <input type="number" value={ranges[k].min}
                             step={ranges[k].step}
                             data-testid={`opt-range-${k}-min`}
                             onChange={(e) => setRanges({
                               ...ranges, [k]: { ...ranges[k], min: Number(e.target.value) },
                             })}
                             style={inputStyle()} />
                      <span style={{ color: "var(--muted)" }}>→</span>
                      <input type="number" value={ranges[k].max}
                             step={ranges[k].step}
                             data-testid={`opt-range-${k}-max`}
                             onChange={(e) => setRanges({
                               ...ranges, [k]: { ...ranges[k], max: Number(e.target.value) },
                             })}
                             style={inputStyle()} />
                      <span style={{ color: "var(--muted)" }}>step</span>
                      <input type="number" value={ranges[k].step}
                             data-testid={`opt-range-${k}-step`}
                             onChange={(e) => setRanges({
                               ...ranges, [k]: { ...ranges[k], step: Number(e.target.value) },
                             })}
                             style={inputStyle()} />
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                <span style={{
                  fontSize: 11, fontFamily: "var(--mono)",
                  color: overCap ? "var(--neg)" : "var(--muted)",
                }}>
                  grid size = {gridN} cells {overCap && "(over 200)"}
                </span>
                <button onClick={runSweep}
                        disabled={sweeping || overCap || gridN === 0}
                        data-testid="opt-run-sweep"
                        className="bmc-btn"
                        style={{ minHeight: 36, padding: "8px 14px" }}>
                  {sweeping ? "Running…" : "Run Sweep"}
                </button>
                {sweeping && <progress style={{ width: "100%" }} />}
              </div>
            </div>

            {sweepError && (
              <div data-testid="opt-error"
                   style={{ color: "var(--neg)", fontSize: 12, marginBottom: 8 }}>
                {sweepError}
              </div>
            )}

            {/* Heatmap + color toggle */}
            {sweepResult && (
              <>
                <div style={{ display: "flex", gap: 6, marginBottom: 8 }} role="radiogroup" aria-label="color metric">
                  {["sharpe", "win_rate", "max_drawdown"].map((k) => (
                    <button key={k}
                            data-testid={`opt-color-${k}`}
                            onClick={() => setColorKind(k)}
                            className={colorKind === k ? "active" : ""}
                            style={{
                              padding: "4px 10px",
                              background: colorKind === k ? "var(--surface-2)" : "transparent",
                              color: "var(--text)", border: "1px solid var(--line)",
                              borderRadius: 6, cursor: "pointer", fontSize: 11,
                            }}>
                      {k}
                    </button>
                  ))}
                </div>

                {isMobile
                  ? <HeatmapList result={sweepResult} onCellHover={setHoverCell} />
                  : <Heatmap result={sweepResult} colorKind={colorKind} onCellHover={setHoverCell} />}

                {hoverCell && (
                  <div data-testid="opt-cell-tooltip"
                       style={{
                         marginTop: 8, padding: 10,
                         border: "1px solid var(--line)", borderRadius: 6,
                         fontFamily: "var(--mono)", fontSize: 11,
                         display: "flex", flexWrap: "wrap", gap: 16,
                       }}>
                    <span>{fmtParams(hoverCell.params)}</span>
                    <span>sharpe={hoverCell.sharpe.toFixed(2)}</span>
                    <span>win={(hoverCell.win_rate * 100).toFixed(0)}%</span>
                    <span>dd={(hoverCell.max_drawdown * 100).toFixed(1)}%</span>
                    <span>n={hoverCell.n_trades}</span>
                  </div>
                )}

                {sweepResult.winner && (
                  <div style={{
                    marginTop: 12, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center",
                  }}>
                    <span style={{ fontFamily: "var(--mono)", fontSize: 12 }}>
                      winner · {fmtParams(sweepResult.winner.params)} · sharpe={sweepResult.winner.sharpe.toFixed(2)}
                    </span>
                    <button onClick={() => setPromoteOpen(true)}
                            data-testid="opt-promote-open"
                            className="bmc-btn"
                            style={{ minHeight: 36, padding: "8px 14px" }}>
                      Promote winner to LIVE
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* ===== A/B card ===== */}
        <div className="card" style={{ marginTop: 12 }}>
          <div className="card-head">
            <h3>A/B · sleeve vs sleeve (winning-cell equity)</h3>
            <button onClick={runAB} disabled={abBusy}
                    data-testid="opt-ab-run"
                    className="bmc-btn"
                    style={{ minHeight: 32, padding: "6px 12px" }}>
              {abBusy ? "Running…" : "Run A/B"}
            </button>
          </div>
          <div className="card-body">
            <div style={{
              display: "grid", gap: 12,
              gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
              marginBottom: 12,
            }}>
              <div>
                <label style={{ display: "block", fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>
                  Sleeve A
                </label>
                <select value={abLeft} onChange={(e) => setAbLeft(e.target.value)}
                        data-testid="opt-ab-left"
                        style={inputStyle()}>
                  {sleeves.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>
                  Sleeve B
                </label>
                <select value={abRight} onChange={(e) => setAbRight(e.target.value)}
                        data-testid="opt-ab-right"
                        style={inputStyle()}>
                  {sleeves.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <ABEquity resultA={abResultA} resultB={abResultB} />
            <div style={{ display: "flex", gap: 14, fontSize: 11, color: "var(--muted)", marginTop: 6 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <i style={{ width: 10, height: 10, background: "var(--pos)", display: "inline-block", borderRadius: 2 }} />
                {abLeft}
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <i style={{ width: 10, height: 10, background: "var(--info)", display: "inline-block", borderRadius: 2 }} />
                {abRight}
              </span>
            </div>
          </div>
        </div>

        <PromoteModal open={promoteOpen}
                      onClose={() => setPromoteOpen(false)}
                      sleeveId={sleeveId}
                      params={sweepResult && sweepResult.winner ? sweepResult.winner.params : {}}
                      busy={promoteBusy}
                      error={promoteError}
                      onConfirm={confirmPromote} />
        </>}
      </main>
    );
  }

  function inputStyle() {
    return {
      flex: "1 1 0", minWidth: 60, padding: 6,
      background: "var(--surface-2)", color: "var(--text)",
      border: "1px solid var(--line)", borderRadius: 4,
      fontFamily: "var(--mono)", fontSize: 12,
    };
  }

  window.OptimizationPage = OptimizationPage;
})();
