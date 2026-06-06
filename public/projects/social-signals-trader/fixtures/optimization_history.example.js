/* optimization_history.example.js — deterministic fixture sweep results.
 *
 * Activated by `?fixture=opt`. Gives the Optimization tab one example
 * sweep per sleeve so the heatmap, A/B view, and Promote button all render
 * without a live trader endpoint. Numbers are seeded by hand to:
 *   - cover ≥6 cells per sleeve,
 *   - include both negative and positive Sharpe values
 *     (so the diverging palette has at least 2 distinct fills),
 *   - produce visibly different equity curves for the A/B view.
 *
 * Complexity: pure data, O(1).
 */
(function () {
  "use strict";

  function curve(seed, n = 12) {
    // Tiny LCG so the curve is deterministic per (seed) without RNG state.
    let x = (seed * 9301 + 49297) % 233280;
    const out = [];
    let v = 10000;
    for (let i = 0; i < n; i++) {
      x = (x * 9301 + 49297) % 233280;
      const r = (x / 233280) * 0.08 - 0.03;  // -3% to +5%
      v *= 1 + r;
      out.push({ t: `step_${i}`, v: Math.round(v * 100) / 100 });
    }
    return out;
  }

  // 6 cells for OPT_FLOW (3 convictions × 2 mention thresholds)
  const optFlowCells = [
    { params: { min_conviction: 0.50, mention_threshold: 10 }, sharpe:  1.42, win_rate: 0.58, max_drawdown: -0.087, n_trades: 73,  equity_curve: curve(11) },
    { params: { min_conviction: 0.50, mention_threshold: 20 }, sharpe:  0.88, win_rate: 0.52, max_drawdown: -0.112, n_trades: 41,  equity_curve: curve(12) },
    { params: { min_conviction: 0.55, mention_threshold: 10 }, sharpe:  1.71, win_rate: 0.62, max_drawdown: -0.071, n_trades: 65,  equity_curve: curve(13) },
    { params: { min_conviction: 0.55, mention_threshold: 20 }, sharpe:  0.34, win_rate: 0.48, max_drawdown: -0.144, n_trades: 38,  equity_curve: curve(14) },
    { params: { min_conviction: 0.60, mention_threshold: 10 }, sharpe: -0.22, win_rate: 0.41, max_drawdown: -0.198, n_trades: 50,  equity_curve: curve(15) },
    { params: { min_conviction: 0.60, mention_threshold: 20 }, sharpe:  0.95, win_rate: 0.55, max_drawdown: -0.083, n_trades: 27,  equity_curve: curve(16) },
  ];

  // 6 cells for BLEND_CONS
  const blendCells = [
    { params: { min_conviction: 0.50, cross_sub_min: 2 }, sharpe:  0.62, win_rate: 0.51, max_drawdown: -0.091, n_trades: 88, equity_curve: curve(21) },
    { params: { min_conviction: 0.50, cross_sub_min: 3 }, sharpe:  1.18, win_rate: 0.59, max_drawdown: -0.064, n_trades: 64, equity_curve: curve(22) },
    { params: { min_conviction: 0.55, cross_sub_min: 2 }, sharpe:  0.45, win_rate: 0.49, max_drawdown: -0.121, n_trades: 76, equity_curve: curve(23) },
    { params: { min_conviction: 0.55, cross_sub_min: 3 }, sharpe:  1.55, win_rate: 0.64, max_drawdown: -0.058, n_trades: 52, equity_curve: curve(24) },
    { params: { min_conviction: 0.60, cross_sub_min: 2 }, sharpe: -0.14, win_rate: 0.46, max_drawdown: -0.155, n_trades: 49, equity_curve: curve(25) },
    { params: { min_conviction: 0.60, cross_sub_min: 3 }, sharpe:  0.78, win_rate: 0.54, max_drawdown: -0.079, n_trades: 36, equity_curve: curve(26) },
  ];

  // 6 cells for DAY_PULSE
  const dayCells = [
    { params: { min_conviction: 0.50, velocity_ratio_min: 1.5 }, sharpe:  0.90, win_rate: 0.55, max_drawdown: -0.080, n_trades: 60, equity_curve: curve(31) },
    { params: { min_conviction: 0.50, velocity_ratio_min: 2.0 }, sharpe:  1.32, win_rate: 0.61, max_drawdown: -0.065, n_trades: 44, equity_curve: curve(32) },
    { params: { min_conviction: 0.55, velocity_ratio_min: 1.5 }, sharpe:  0.20, win_rate: 0.47, max_drawdown: -0.140, n_trades: 51, equity_curve: curve(33) },
    { params: { min_conviction: 0.55, velocity_ratio_min: 2.0 }, sharpe:  1.05, win_rate: 0.57, max_drawdown: -0.073, n_trades: 33, equity_curve: curve(34) },
    { params: { min_conviction: 0.60, velocity_ratio_min: 1.5 }, sharpe: -0.30, win_rate: 0.42, max_drawdown: -0.180, n_trades: 28, equity_curve: curve(35) },
    { params: { min_conviction: 0.60, velocity_ratio_min: 2.0 }, sharpe:  0.55, win_rate: 0.50, max_drawdown: -0.092, n_trades: 22, equity_curve: curve(36) },
  ];

  function winnerOf(cells) {
    const w = cells.reduce((a, b) => (a.sharpe >= b.sharpe ? a : b), cells[0]);
    return { params: w.params, sharpe: w.sharpe };
  }

  window.OPTIMIZATION_FIXTURE = {
    OPT_FLOW:   { sleeve_id: "OPT_FLOW",   cells: optFlowCells, winner: winnerOf(optFlowCells), sweep_id: "fx-opt-flow",   mock: true },
    BLEND_CONS: { sleeve_id: "BLEND_CONS", cells: blendCells,   winner: winnerOf(blendCells),   sweep_id: "fx-blend-cons", mock: true },
    DAY_PULSE:  { sleeve_id: "DAY_PULSE",  cells: dayCells,     winner: winnerOf(dayCells),     sweep_id: "fx-day-pulse",  mock: true },
  };

  // PRD 72: variant evaluation fixture --------------------------------------
  //
  // Lets the Variants subtab render without the trader HTTP endpoint. Three
  // reference variants matching data/strategies/{WSB_,SA_,BALANCED_}SENTIMENT.
  // Equity curves are aligned on the same x-axis (12 ticks) so the overlay
  // chart renders cleanly even at fixture load.

  function variantCurve(seed, n = 12) {
    let x = (seed * 9301 + 49297) % 233280;
    const out = [{ ts: "open", equity: 1.0 }];
    let v = 1.0;
    for (let i = 0; i < n; i++) {
      x = (x * 9301 + 49297) % 233280;
      const r = (x / 233280) * 0.06 - 0.02;  // -2% .. +4%
      v *= 1 + r;
      out.push({ ts: `2026-04-${String(i + 1).padStart(2, "0")}T15:30:00Z`,
                 equity: Math.round(v * 1e6) / 1e6 });
    }
    return out;
  }

  function variantProposals(variantId, ticker, n) {
    const out = [];
    for (let i = 0; i < n; i++) {
      out.push({
        ts: `2026-04-${String((i % 12) + 1).padStart(2, "0")}T15:30:00Z`,
        ticker: ticker,
        side: i % 4 === 3 ? "sell" : "buy",
        qty: 1,
        conviction: 0.55 + ((i * 7) % 30) / 100,
      });
    }
    return out;
  }

  const wsbCurve     = variantCurve(101);
  const saCurve      = variantCurve(202);
  const balancedCurve = variantCurve(303);

  window.VARIANT_EVALUATION_FIXTURE = {
    variants: [
      { id: "WSB_SENTIMENT_ONLY", name: "WSB sentiment-only baseline",
        feeds: ["wallstreetbets"], catalyst: "earnings", capital_pct: 0.02 },
      { id: "SA_SENTIMENT_ONLY", name: "SecurityAnalysis sentiment-only baseline",
        feeds: ["securityanalysis"], catalyst: "earnings", capital_pct: 0.02 },
      { id: "BALANCED_SENTIMENT", name: "Balanced sentiment (cross-sub baseline)",
        feeds: ["wallstreetbets", "securityanalysis", "investing"],
        catalyst: "earnings", capital_pct: 0.02 },
    ],
    rows: [
      {
        variant_id: "WSB_SENTIMENT_ONLY",
        n_trades: 18, win_rate: 0.55, sharpe: 0.92, max_dd_pct: -0.084,
        final_equity_pct: wsbCurve[wsbCurve.length - 1].equity - 1,
        equity_curve: wsbCurve,
        proposals: variantProposals("WSB_SENTIMENT_ONLY", "TSLA", 18),
        conviction_threshold: 0.5, from: "2026-04-01", to: "2026-05-23",
        catalyst: "earnings",
      },
      {
        variant_id: "SA_SENTIMENT_ONLY",
        n_trades: 9, win_rate: 0.66, sharpe: 1.21, max_dd_pct: -0.052,
        final_equity_pct: saCurve[saCurve.length - 1].equity - 1,
        equity_curve: saCurve,
        proposals: variantProposals("SA_SENTIMENT_ONLY", "BRK.B", 9),
        conviction_threshold: 0.5, from: "2026-04-01", to: "2026-05-23",
        catalyst: "earnings",
      },
      {
        variant_id: "BALANCED_SENTIMENT",
        n_trades: 24, win_rate: 0.61, sharpe: 1.45, max_dd_pct: -0.038,
        final_equity_pct: balancedCurve[balancedCurve.length - 1].equity - 1,
        equity_curve: balancedCurve,
        proposals: variantProposals("BALANCED_SENTIMENT", "AAPL", 24),
        conviction_threshold: 0.5, from: "2026-04-01", to: "2026-05-23",
        catalyst: "earnings",
      },
    ],
  };
})();
