// live-events.js — SSE-via-polling for static hosting.
//
// Polls data-events.ndjson every 3 seconds. New rows are dispatched as
// CustomEvent("live-event", { detail: row }) on window so any component
// can subscribe without this module knowing the React tree.
//
// Usage:
//   window.addEventListener("live-event", (e) => console.log(e.detail));
//
// The SSE-via-polling design:
//   - Server appends to dashboard/data-events.ndjson (one JSON object per
//     line, with an incrementing `id` field).
//   - Client polls with ?since=<last_id> and reads only new lines.
//   - Static hosting compatible (no WebSocket, no backend needed).
//   - If the backend later gains a real SSE endpoint, replace this file
//     only; callers remain unchanged.

(function () {
  "use strict";

  var _lastId = 0;
  var _pollUrl = "data-events.ndjson";
  var _intervalMs = 3000;
  var _timer = null;

  function _parseNdjson(text) {
    var rows = [];
    var lines = text.split("\n");
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line) continue;
      try {
        rows.push(JSON.parse(line));
      } catch (_) {
        // skip malformed lines
      }
    }
    return rows;
  }

  function _applyRows(rows) {
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var rowId = parseInt(row.id, 10) || 0;
      if (rowId <= _lastId) continue;
      _lastId = rowId;
      try {
        window.dispatchEvent(new CustomEvent("live-event", { detail: row }));
      } catch (_) {
        // CustomEvent not supported in very old browsers — ignore
      }
    }
  }

  function _poll() {
    var url = _pollUrl + "?since=" + _lastId + "&_=" + Date.now();
    fetch(url, { cache: "no-store" })
      .then(function (r) {
        if (!r.ok) return "";
        return r.text();
      })
      .then(function (text) {
        if (text) _applyRows(_parseNdjson(text));
      })
      .catch(function () {
        // Network error — silently swallow; will retry next interval.
      });
  }

  function start(opts) {
    opts = opts || {};
    if (opts.url) _pollUrl = opts.url;
    if (opts.intervalMs) _intervalMs = opts.intervalMs;
    if (_timer) clearInterval(_timer);
    // Kick off immediately then on interval.
    _poll();
    _timer = setInterval(_poll, _intervalMs);
  }

  function stop() {
    if (_timer) {
      clearInterval(_timer);
      _timer = null;
    }
  }

  // Auto-start when the DOM is ready.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { start(); });
  } else {
    start();
  }

  // Expose for manual control / testing.
  window.LiveEvents = { start: start, stop: stop };
})();
