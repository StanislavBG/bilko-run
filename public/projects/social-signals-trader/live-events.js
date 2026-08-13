// live-events.js — SSE-via-polling for static hosting.
//
// Polls data-events.ndjson for APPENDED rows and dispatches each new one as
// CustomEvent("live-event", { detail: row }) on window so any component can
// subscribe without this module knowing the React tree.
//
// Usage:
//   window.addEventListener("live-event", (e) => console.log(e.detail));
//
// The SSE-via-polling design:
//   - Server appends to dashboard/data-events.ndjson (one JSON object per
//     line, with an incrementing `id` field).
//   - Static hosting compatible (no WebSocket, no backend needed).
//   - If the backend later gains a real SSE endpoint, replace this file
//     only; callers remain unchanged.
//
// BANDWIDTH CONTRACT — read this before changing the poll logic.
//
// The original implementation re-downloaded the WHOLE file every 3 s with
// `cache: "no-store"` plus a `?_=<Date.now()>` cache-buster and a `?since=<id>`
// param the static host does not implement. Every poll was therefore a full
// 200 with the complete body: 121 KB x 1200 polls/hour = ~133 MB/hour PER OPEN
// TAB (measured live on bilko.run, 2026-08-13), for a file that changes at most
// a few times a day. A handful of tabs left open is 10 GB of egress.
//
// The three rules that keep it cheap:
//   1. RANGE, NOT REFETCH. Ask for `bytes=<consumed>-`. Unchanged file -> 416
//      (a few bytes). Appended file -> 206 carrying ONLY the new rows.
//   2. NO CACHE-BUSTER. A unique query string makes every request a cache miss
//      at the CDN and forces a full body. Byte offsets already guarantee
//      freshness; the URL must stay stable.
//   3. DON'T POLL A TAB NOBODY IS LOOKING AT. Polling pauses on
//      `document.hidden` and resumes (with an immediate catch-up poll) on
//      visibility, and backs off toward MAX_INTERVAL_MS while nothing arrives.
//
// Steady state is now one ~250-byte 416 every 15-300 s instead of 121 KB every
// 3 s — roughly a 10,000x reduction in bytes served per idle tab.

(function () {
  "use strict";

  var BASE_INTERVAL_MS = 15000;   // fast enough to feel live, 5x cheaper than 3s
  var MAX_INTERVAL_MS = 300000;   // idle ceiling — a quiet book polls every 5 min
  var QUIET_POLLS_BEFORE_BACKOFF = 4;

  var _lastId = 0;
  var _pollUrl = "data-events.ndjson";
  var _baseIntervalMs = BASE_INTERVAL_MS;
  var _maxIntervalMs = MAX_INTERVAL_MS;
  var _intervalMs = BASE_INTERVAL_MS;
  var _timer = null;
  var _running = false;
  var _inFlight = false;
  // Bytes of the file already consumed and dispatched. Always sits on a line
  // boundary, so a partially-written trailing row is simply re-read next poll.
  var _offset = 0;
  var _quietPolls = 0;

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
    var dispatched = 0;
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var rowId = parseInt(row.id, 10) || 0;
      if (rowId <= _lastId) continue;
      _lastId = rowId;
      dispatched++;
      try {
        window.dispatchEvent(new CustomEvent("live-event", { detail: row }));
      } catch (_) {
        // CustomEvent not supported in very old browsers — ignore
      }
    }
    return dispatched;
  }

  // Consume only up to the last complete line. Returns bytes consumed, so the
  // caller can advance _offset to a line boundary; a half-flushed final row is
  // left unconsumed and re-read (a few bytes) on the next poll rather than
  // being parsed as malformed JSON.
  function _consumeChunk(bytes) {
    var lastNewline = -1;
    for (var i = bytes.length - 1; i >= 0; i--) {
      if (bytes[i] === 0x0a) { lastNewline = i; break; }
    }
    if (lastNewline < 0) return { consumed: 0, dispatched: 0 };
    var complete = bytes.subarray(0, lastNewline + 1);
    var text = new TextDecoder("utf-8").decode(complete);
    return { consumed: complete.length, dispatched: _applyRows(_parseNdjson(text)) };
  }

  // 416 carries `Content-Range: bytes */<total>`; a total SMALLER than our
  // offset means the file was truncated or rotated, so restart from byte 0.
  function _totalFromContentRange(header) {
    if (!header) return null;
    var m = /\/\s*(\d+)\s*$/.exec(header);
    return m ? parseInt(m[1], 10) : null;
  }

  function _schedule() {
    // `document.hidden` is re-checked here, not just in the visibility handler:
    // a poll already in flight when the tab was hidden would otherwise
    // re-schedule itself from its own .then() and keep the loop alive.
    if (!_running || document.hidden) return;
    if (_timer) clearTimeout(_timer);
    _timer = setTimeout(_tick, _intervalMs);
  }

  function _onQuiet() {
    _quietPolls++;
    if (_quietPolls >= QUIET_POLLS_BEFORE_BACKOFF) {
      _intervalMs = Math.min(_intervalMs * 2, _maxIntervalMs);
      _quietPolls = 0;
    }
  }

  function _onActivity() {
    _quietPolls = 0;
    _intervalMs = _baseIntervalMs;
  }

  function _tick() {
    _poll().then(_schedule, _schedule);
  }

  function _poll() {
    if (_inFlight) return Promise.resolve();
    // Deliberately NO cache-buster and NO ?since= — see the bandwidth contract
    // above. The byte offset is the cursor; the URL stays cacheable.
    _inFlight = true;
    return fetch(_pollUrl, {
      cache: "no-store",
      headers: { Range: "bytes=" + _offset + "-" }
    })
      .then(function (r) {
        if (r.status === 416) {
          // Range beyond EOF — nothing new. Detect truncation/rotation.
          var total = _totalFromContentRange(r.headers.get("Content-Range"));
          if (total !== null && total < _offset) _offset = 0;
          _onQuiet();
          return null;
        }
        if (r.status === 304) { _onQuiet(); return null; }
        if (!r.ok) { _onQuiet(); return null; }
        // 206 -> only the appended bytes. 200 -> host ignored Range and sent
        // the whole file, so restart the cursor at 0 before consuming it (the
        // `id` guard in _applyRows still suppresses already-seen rows).
        if (r.status === 200) _offset = 0;
        return r.arrayBuffer();
      })
      .then(function (buf) {
        if (!buf) return;
        var res = _consumeChunk(new Uint8Array(buf));
        _offset += res.consumed;
        if (res.dispatched > 0) _onActivity(); else _onQuiet();
      })
      .catch(function () {
        // Network error — silently swallow; will retry on the next interval.
        _onQuiet();
      })
      .then(function () { _inFlight = false; });
  }

  function _onVisibilityChange() {
    if (!_running) return;
    if (document.hidden) {
      if (_timer) { clearTimeout(_timer); _timer = null; }
      return;
    }
    // Back in view: catch up immediately at the fast cadence.
    _onActivity();
    _tick();
  }

  function start(opts) {
    opts = opts || {};
    if (opts.url) _pollUrl = opts.url;
    if (opts.intervalMs) _baseIntervalMs = opts.intervalMs;
    if (opts.maxIntervalMs) _maxIntervalMs = opts.maxIntervalMs;
    if (_maxIntervalMs < _baseIntervalMs) _maxIntervalMs = _baseIntervalMs;
    _intervalMs = _baseIntervalMs;
    _quietPolls = 0;
    if (_timer) { clearTimeout(_timer); _timer = null; }
    _running = true;
    if (document.hidden) return;  // nothing to render into — wait for focus
    _tick();
  }

  function stop() {
    _running = false;
    if (_timer) {
      clearTimeout(_timer);
      _timer = null;
    }
  }

  document.addEventListener("visibilitychange", _onVisibilityChange);

  // Auto-start when the DOM is ready.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { start(); });
  } else {
    start();
  }

  // Expose for manual control / testing.
  window.LiveEvents = {
    start: start,
    stop: stop,
    _state: function () {
      return { offset: _offset, lastId: _lastId, intervalMs: _intervalMs, running: _running };
    }
  };
})();
