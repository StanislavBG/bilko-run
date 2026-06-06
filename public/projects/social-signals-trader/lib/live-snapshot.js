/* live-snapshot.js — fetch the live dashboard data from the bilko.run server and
 * overlay it onto window.* before the React app renders.
 *
 * This replaces the old publish path (the trader committed a regenerated data.js
 * into the Bilko site repo every ~30 min, rebuilding the whole site). Now the
 * trader POSTs its snapshot to `/api/projects/<slug>/snapshot` and this fetches
 * it at load. The committed data.js / data-extended.js still load first as a
 * cold-start FALLBACK — if this fetch fails (offline, static-dev, no snapshot
 * yet) the page renders the bundled baseline instead of breaking.
 *
 * app.jsx awaits window.__loadLiveSnapshot() before the first render, so the
 * overlay is in place before any component reads window.* . */
(function () {
  var SLUG = "social-signals-trader";
  // Absolute path → resolves against the ORIGIN root (bilko.run), not the
  // /projects/<slug>/ page path. Same-origin in prod (no CORS); harmlessly
  // unreachable when the dashboard is served as static files in dev.
  var ENDPOINT = "/api/projects/" + SLUG + "/snapshot";

  window.__loadLiveSnapshot = function () {
    return fetch(ENDPOINT, { cache: "no-store" })
      .then(function (r) {
        if (!r.ok) throw new Error("snapshot HTTP " + r.status);
        return r.json();
      })
      .then(function (snap) {
        var g = snap && snap.globals;
        if (!g || typeof g !== "object") throw new Error("snapshot missing globals");
        var n = 0;
        for (var k in g) {
          if (Object.prototype.hasOwnProperty.call(g, k)) { window[k] = g[k]; n++; }
        }
        window.__liveSnapshotMeta = { ok: true, count: n, generatedAt: snap.generatedAt || null };
        if (window.console) console.info("[live-snapshot] overlaid " + n + " globals from server");
        return window.__liveSnapshotMeta;
      })
      .catch(function (e) {
        // Never reject — the app falls back to the bundled baseline data.js.
        window.__liveSnapshotMeta = { ok: false, error: String((e && e.message) || e) };
        if (window.console) console.warn("[live-snapshot] using bundled data (" + window.__liveSnapshotMeta.error + ")");
        return window.__liveSnapshotMeta;
      });
  };
})();
