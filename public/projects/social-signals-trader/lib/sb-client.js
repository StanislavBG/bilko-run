/* sb-client.js — read-side wrapper for signal-builder panel history.
 *
 * TODO(signal-builder-MCP): Once signal-builder ships an HTTP shim around
 * meta.panel_history(panel, at), swap the in-memory scan in `history()` for
 * a fetch() call against /panels/history?panel=...&since=...&until=... and
 * `tickers()` / `subreddits()` for /panels/dimensions. Until then, this
 * module reads from window.SIGNALS_HISTORY (snapshot.py M8 will populate
 * data.js with this global) or, when present, window.SIGNALS_HISTORY_FIXTURE
 * (set by fixtures/signals_history.example.js).
 *
 * Complexity: O(n) over history rows; n bounded by 90d × ~24 builds/day ×
 * ~50 panels = ~108k worst case — fine for client side, no indexing needed.
 */
(function () {
  "use strict";

  function pickHistory() {
    // `?fixture=signals` URL param forces the fixture even if real data is
    // present. Used by the Playwright spec and the AC2 smoke check.
    const params = new URLSearchParams(window.location.search || "");
    const forceFixture = params.get("fixture") === "signals";
    if (forceFixture && window.SIGNALS_HISTORY_FIXTURE) {
      return window.SIGNALS_HISTORY_FIXTURE;
    }
    if (window.SIGNALS_HISTORY && Array.isArray(window.SIGNALS_HISTORY.rows)) {
      return window.SIGNALS_HISTORY;
    }
    if (window.SIGNALS_HISTORY_FIXTURE) {
      return window.SIGNALS_HISTORY_FIXTURE;
    }
    return { schema_version: 1, rows: [], themes: [] };
  }

  function toEpoch(s) {
    if (!s) return 0;
    if (typeof s === "number") return s;
    const t = Date.parse(s);
    return Number.isNaN(t) ? 0 : t;
  }

  const SBClient = {
    _raw() {
      return pickHistory();
    },

    /**
     * Returns rows shaped: {built_at, ticker, panel, payload}[].
     * Filters: tickers (string[]), panels (string[]), since (ISO|epoch),
     * until (ISO|epoch). All optional.
     */
    history(opts) {
      const { tickers, panels, since, until } = opts || {};
      const rows = pickHistory().rows || [];
      const tickerSet = tickers && tickers.length ? new Set(tickers) : null;
      const panelSet = panels && panels.length ? new Set(panels) : null;
      const sinceE = since ? toEpoch(since) : 0;
      const untilE = until ? toEpoch(until) : Infinity;
      // O(n) single pass.
      const out = [];
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        if (tickerSet && !tickerSet.has(r.ticker)) continue;
        if (panelSet && !panelSet.has(r.panel)) continue;
        const t = toEpoch(r.built_at);
        if (t < sinceE || t > untilE) continue;
        out.push(r);
      }
      return out;
    },

    /** Distinct tickers seen across the history blob (sorted). */
    tickers() {
      const rows = pickHistory().rows || [];
      const s = new Set();
      for (let i = 0; i < rows.length; i++) if (rows[i].ticker) s.add(rows[i].ticker);
      return Array.from(s).sort();
    },

    /** Distinct subreddits referenced inside payloads (sorted). */
    subreddits() {
      const rows = pickHistory().rows || [];
      const s = new Set();
      for (let i = 0; i < rows.length; i++) {
        const sub = rows[i].payload && rows[i].payload.top_subreddit;
        if (sub) s.add(sub);
      }
      return Array.from(s).sort();
    },

    /** Themes list (for the drilldown side-sheet). */
    themes() {
      return pickHistory().themes || [];
    },
  };

  window.SBClient = SBClient;
})();
