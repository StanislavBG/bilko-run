/* optimization-client.js — thin fetch wrapper for the trader /optimization
 * HTTP endpoint (src/social_signals_trader/optimization_api.py).
 *
 * Discovery rules (in priority order):
 *   1. `?optApi=https://...`         — URL override for ad-hoc testing.
 *   2. `window.OPTIMIZATION_API_URL` — set by the operator at deploy time.
 *   3. `?fixture=opt`                — bypass network entirely, resolve
 *      against window.OPTIMIZATION_FIXTURE so the tab renders with no
 *      backend (this is the dev/Playwright path).
 *   4. http://127.0.0.1:8765         — default loopback port the
 *      stdlib HTTP server in optimization_api.py binds to.
 *
 * The sleeve param schema is hard-coded here to keep the dashboard fully
 * static (no MCP round-trip just to populate a <select>). It MUST stay in
 * sync with SLEEVE_PARAM_SCHEMA in optimization_api.py — when a sleeve or
 * axis is added/removed/retuned there, mirror the change in this file by
 * hand. There is no auto-sync (the dashboard is intentionally a static
 * bundle with no Python import).
 *
 * PRD 62: WSB_EARN exposes catalyst-timing axes
 * (`earnings_entry_lead`, `earnings_exit_lag`). The server recognises
 * `<catalyst>_entry_lead` / `<catalyst>_exit_lag` and lifts them into a
 * `catalyst_overrides` dict for `backtest_replay.run()`.
 *
 * Complexity: every call is O(1) in client work; server-side sweep is
 * O(|grid|) (capped at 200 cells).
 */
(function () {
  "use strict";

  const SLEEVE_PARAM_SCHEMA = {
    OPT_FLOW: {
      min_conviction:    { min: 0.30, max: 0.90, step: 0.05 },
      mention_threshold: { min: 5,    max: 50,   step: 5    },
    },
    BLEND_CONS: {
      min_conviction: { min: 0.30, max: 0.90, step: 0.05 },
      cross_sub_min:  { min: 2,    max: 6,    step: 1    },
    },
    DAY_PULSE: {
      min_conviction:     { min: 0.30, max: 0.90, step: 0.05 },
      velocity_ratio_min: { min: 1.2,  max: 4.0,  step: 0.2  },
    },
    WSB_EARN: {
      // PRD 62: catalyst-timing sweep dimensions
      earnings_entry_lead: { min: 0, max: 10, step: 1 },
      earnings_exit_lag:   { min: 0, max: 5,  step: 1 },
    },
  };

  const MAX_GRID = 200;

  function apiBase() {
    const params = new URLSearchParams(window.location.search || "");
    const override = params.get("optApi");
    if (override) return override.replace(/\/+$/, "");
    if (window.OPTIMIZATION_API_URL) return String(window.OPTIMIZATION_API_URL).replace(/\/+$/, "");
    return "http://127.0.0.1:8765";
  }

  function useFixture() {
    const params = new URLSearchParams(window.location.search || "");
    return params.get("fixture") === "opt";
  }

  function listSleeves() {
    return Object.keys(SLEEVE_PARAM_SCHEMA);
  }

  function paramSchema(sleeveId) {
    return SLEEVE_PARAM_SCHEMA[sleeveId] || {};
  }

  // Build {param: [v0, v1, ...]} from a {min, max, step} triple.
  // Caps at 1000 values per axis to defend against pathological step=0.
  // Complexity: O((max-min)/step).
  function rangeToValues(min, max, step) {
    const out = [];
    if (!Number.isFinite(min) || !Number.isFinite(max) || !Number.isFinite(step) || step <= 0) {
      return out;
    }
    const eps = step / 1e6;
    let v = min;
    let i = 0;
    while (v <= max + eps && i < 1000) {
      out.push(Number(v.toFixed(6)));
      v += step;
      i++;
    }
    return out;
  }

  function gridSize(paramGrid) {
    let n = 1;
    for (const k of Object.keys(paramGrid)) n *= Math.max(1, paramGrid[k].length);
    return n;
  }

  async function _fixtureSweep(sleeveId, paramGrid) {
    const fx = window.OPTIMIZATION_FIXTURE;
    if (fx && fx[sleeveId]) {
      return fx[sleeveId];
    }
    // Synthesize a tiny deterministic result from the grid if the fixture
    // doesn't cover this sleeve, so the heatmap still renders.
    const keys = Object.keys(paramGrid);
    const values = keys.map((k) => paramGrid[k] || []);
    const combos = [];
    (function recur(i, acc) {
      if (i === keys.length) { combos.push({ ...acc }); return; }
      for (const v of values[i]) { acc[keys[i]] = v; recur(i + 1, acc); }
    })(0, {});
    const cells = combos.map((params, idx) => {
      const sharpe = -0.5 + (idx % 7) * 0.5;
      return {
        params,
        sharpe: Number(sharpe.toFixed(2)),
        win_rate: 0.4 + (idx % 5) * 0.05,
        max_drawdown: -0.05 - (idx % 4) * 0.02,
        n_trades: 20 + idx * 3,
        equity_curve: Array.from({ length: 10 }, (_, k) => ({
          t: `step_${k}`,
          v: 10000 + idx * 80 + k * 12 * (sharpe + 1),
        })),
      };
    });
    const winner = cells.reduce((a, b) => (a.sharpe >= b.sharpe ? a : b), cells[0]);
    return {
      sleeve_id: sleeveId,
      cells,
      winner: winner ? { params: winner.params, sharpe: winner.sharpe } : null,
      sweep_id: "fixture-" + sleeveId,
      mock: true,
    };
  }

  async function sweep(sleeveId, paramGrid, dateRange) {
    if (useFixture()) return _fixtureSweep(sleeveId, paramGrid);
    const url = apiBase() + "/optimization/sweep";
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sleeve_id: sleeveId, param_grid: paramGrid, date_range: dateRange }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(body.error || ("http_" + res.status));
      err.detail = body;
      throw err;
    }
    return body;
  }

  async function promote(sleeveId, params, sweepId) {
    if (useFixture()) {
      // No-op in fixture mode — just echo the payload so the UI can confirm.
      return { ok: true, sleeve_id: sleeveId, entry: { params, source: "fixture",
               promoted_at: new Date().toISOString(), sweep_id: sweepId || "fixture" } };
    }
    const url = apiBase() + "/optimization/promote";
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sleeve_id: sleeveId, params, sweep_id: sweepId }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(body.error || ("http_" + res.status));
      err.detail = body;
      throw err;
    }
    return body;
  }

  // ---- PRD 72: variants ---------------------------------------------------

  async function listVariants() {
    if (useFixture()) {
      const fx = window.VARIANT_EVALUATION_FIXTURE;
      if (fx && Array.isArray(fx.variants)) return { variants: fx.variants };
      return { variants: [] };
    }
    const url = apiBase() + "/variants/list";
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(body.error || ("http_" + res.status));
      err.detail = body;
      throw err;
    }
    return body;
  }

  async function evaluateVariants(variants, fromDate, toDate, catalyst) {
    if (useFixture()) {
      const fx = window.VARIANT_EVALUATION_FIXTURE;
      const fxRows = fx && Array.isArray(fx.rows) ? fx.rows : [];
      const filtered = fxRows.filter((r) => variants.includes(r.variant_id));
      return { rows: filtered.length ? filtered : fxRows };
    }
    const url = apiBase() + "/variants/evaluate";
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        variants, from: fromDate, to: toDate, catalyst: catalyst || null,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(body.error || ("http_" + res.status));
      err.detail = body;
      throw err;
    }
    return body;
  }

  window.OptimizationClient = {
    listSleeves,
    paramSchema,
    rangeToValues,
    gridSize,
    sweep,
    promote,
    listVariants,
    evaluateVariants,
    MAX_GRID,
    SLEEVE_PARAM_SCHEMA,
  };
})();
