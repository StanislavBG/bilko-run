
/* ---- data-feedback.js ---- */
window.FEEDBACK_THREADS = {
  "counts": {
    "active": 3,
    "answered": 3,
    "archived": 0,
    "proposal": 1,
    "system": 0,
    "total": 3,
    "trade": 2,
    "unanswered": 0
  },
  "funnel": {
    "breachingSla": 0,
    "generatedAt": "2026-08-14T14:45:01Z",
    "open": 0,
    "resolvedThisWeek": 2,
    "routedToPrd": 4,
    "triagedBySeverity": {
      "high": 0,
      "low": 1,
      "medium": 0
    }
  },
  "generatedAt": "2026-08-14T14:45:01Z",
  "schema": 2,
  "threads": [{
    "answered": true,
    "archivedAt": null,
    "contractKey": "NFLX-P-75-74-2026-08-21",
    "createdAt": "2026-08-13T23:36:06.000Z",
    "description": "What made you go with PUT over CALL?",
    "hasImage": false,
    "id": "fb_mss5pq4b_crdgipdi",
    "lastActivityAt": "2026-08-14T05:08:10Z",
    "messages": [{
      "author": "visitor",
      "authorLabel": "Visitor",
      "body": "What made you go with PUT over CALL?",
      "createdAt": "2026-08-13T23:36:06.000Z",
      "hasImage": false,
      "id": "fb_mss5pq4b_crdgipdi",
      "role": "user",
      "title": "This is looking sus"
    }, {
      "author": "agent",
      "authorLabel": "Trading agent",
      "body": "Fair call-out \u2014 on this one the PUT side didn't actually clear our own gate. Our rule is to sell puts only when the stock is already beaten down (RSI under 35, stochastic under 30), and NFLX is sitting at RSI 61.82 with %K 98.13, which is the opposite \u2014 that's overbought territory, closer to a CALL setup. That's why the \"Momentum \u2014 oversold\" check is flagged as failed on the card, and why this proposal shouldn't go live as a put; the direction gate is doing its job by refusing it.",
      "createdAt": "2026-08-14T05:08:10Z",
      "hasImage": false,
      "id": "fb_mss5pq4b_crdgipdi.r1",
      "role": "agent"
    }],
    "replies": [{
      "author": "agent",
      "authorLabel": "Trading agent",
      "body": "Fair call-out \u2014 on this one the PUT side didn't actually clear our own gate. Our rule is to sell puts only when the stock is already beaten down (RSI under 35, stochastic under 30), and NFLX is sitting at RSI 61.82 with %K 98.13, which is the opposite \u2014 that's overbought territory, closer to a CALL setup. That's why the \"Momentum \u2014 oversold\" check is flagged as failed on the card, and why this proposal shouldn't go live as a put; the direction gate is doing its job by refusing it.",
      "createdAt": "2026-08-14T05:08:10Z",
      "id": "fb_mss5pq4b_crdgipdi.r1"
    }],
    "route": "#options",
    "scope": "proposal",
    "stage": "proposal",
    "status": "answered",
    "targetId": "proposal-NFLX-put-75-74-2026-08-21",
    "targetKind": "component",
    "targetLabel": "NFLX 75/74 put spread, expires 2026-08-21",
    "title": "This is looking sus",
    "type": "feedback"
  }, {
    "answered": true,
    "archivedAt": null,
    "contractKey": "BABA-C-143-144-2026-08-14",
    "createdAt": "2026-08-09T23:17:11.000Z",
    "description": "Which value is true? And why it is a loss at all?",
    "hasImage": false,
    "id": "fb_msmf9zlo_v0a1ebjz",
    "lastActivityAt": "2026-08-14T04:04:42Z",
    "messages": [{
      "author": "visitor",
      "authorLabel": "Visitor",
      "body": "Which value is true? And why it is a loss at all?",
      "createdAt": "2026-08-09T23:17:11.000Z",
      "hasImage": false,
      "id": "fb_msmf9zlo_v0a1ebjz",
      "role": "user",
      "title": "[B] Why are we showing 4k loss here? 7k on detail?"
    }, {
      "author": "agent",
      "authorLabel": "Trading agent",
      "body": "Good catch \u2014 they're two different quantities, and one of them is wrong. The -$4,032 on the Options Log is the position's open (unrealised) P&L; the $7,448 on the detail page is labelled max loss and means the worst case if the spread finishes fully in the money, not money lost. So they were never meant to agree. But neither number checks out: this is 56 contracts of a $1-wide 143/144 call spread opened for a $0.33 credit, now marked $0.39. Open P&L should be (0.39 - 0.33) x 56 x 100 = -$336, and worst case should be (1.00 x 56 x 100) - $1,848 = $3,752. Both figures we showed are exactly what you get if the entry credit is added instead of subtracted, so we're treating this as a sign bug in how the entry credit is carried and it's queued for a fix. And on 'why is it a loss at all' \u2014 a small open loss just means the spread is marked slightly wider than we sold it; BABA is at $128.41 with the short strike at $143, so the trade is still 11% out of the money with 5 days left. Nothing has been realised. We'll update this thread once the numbers are corrected.",
      "createdAt": "2026-08-09T23:22:44Z",
      "hasImage": false,
      "id": "fb_msmf9zlo_v0a1ebjz.r1",
      "role": "agent"
    }, {
      "author": "agent",
      "authorLabel": "Trading agent",
      "body": "Correction to our earlier answer \u2014 we got this wrong, and the original $7,448 figure you asked about was in fact the correct one. We described this as a credit spread. It was not. The broker record shows we sold the 143 call at $0.05 and bought the 144 call at $0.38 \u2014 short the lower strike, long the higher one, which is a bear call spread, but entered for a net $0.33 DEBIT of $1,848 rather than for a credit. That structure cannot make money at any price: the best possible outcome is both legs expiring worthless and losing the $1,848 we paid, and the worst is the full $1 width against us. Max loss really was $5,600 + $1,848 = $7,448, exactly as the detail page said. Our previous reply's '-$336 open P&L' and '$3,752 max loss' were both wrong, because they assumed a credit we never collected. The real open loss was -$4,704. We have now closed the position: we bought the short 143 call back at $0.51 today, and the long 144 call has no bid left and expires worthless tomorrow, for a realised loss of about $4,704. Two separate problems stand behind your question. The display bug you spotted is real and still queued. The bigger one is that the fund opened a spread that was mathematically incapable of profiting, and no entry check caught it \u2014 that is the more valuable half of this feedback, and it is the one we are treating as serious. Thank you for pushing on it.",
      "createdAt": "2026-08-13T18:26:09Z",
      "hasImage": false,
      "id": "fb_msmf9zlo_v0a1ebjz.r2",
      "role": "agent"
    }, {
      "author": "agent",
      "authorLabel": "Trading agent",
      "body": "Closing the loop from our last reply here: the guard we said was 'queued' is now live. A hard min_net_credit floor is enforced twice for every CREDIT_SPREAD candidate \u2014 once in the scan (with its own funnel line so a rejected name stays visible instead of silently vanishing) and again as the final check right before an order is built, against the exact price about to be submitted rather than the earlier scan estimate. Zero and negative net credit are both refused unconditionally; a missing/unreadable price is treated the same as a non-positive one. And if a fill somehow still reconciles to a non-positive credit despite that, it now triggers a loud WARNING (trade, scored credit, actual credit, slippage) plus a durable audit-log entry, not just a quiet log line. This trade (and INTC 88/87 the same week) is what these checks exist to stop from happening again.",
      "createdAt": "2026-08-13T22:43:19Z",
      "hasImage": false,
      "id": "fb_msmf9zlo_v0a1ebjz.r3",
      "role": "agent"
    }, {
      "author": "agent",
      "authorLabel": "Trading agent",
      "body": "Fixed: shipped in 1094-feedback-fb-msmf9zlo-v0a1ebjz-b-why-are-we-showing-4k-loss-h \u2014 feedback fb_msmf9zlo_v0a1ebjz: [B] Why are we showing 4k loss here? 7k on detail?. Thanks for flagging it.",
      "createdAt": "2026-08-14T03:48:06Z",
      "hasImage": false,
      "id": "fb_msmf9zlo_v0a1ebjz.r4",
      "role": "agent"
    }, {
      "author": "agent",
      "authorLabel": "Trading agent",
      "body": "Both numbers were real, just answering different questions, and the page didn't say so. $4,704 (the headline) is what this trade actually closed for \u2014 we bought back the short leg early instead of letting the spread expire. $7,448 (in the stat grid below) is the theoretical worst case if we'd held to expiry with the stock above $144, which never happened. The detail page now labels that second number as a worst-case ceiling and explicitly names the real $4,704 result next to it, so it's clear which one is the actual outcome.",
      "createdAt": "2026-08-14T04:04:42Z",
      "hasImage": false,
      "id": "fb_msmf9zlo_v0a1ebjz.r5",
      "role": "agent"
    }],
    "replies": [{
      "author": "agent",
      "authorLabel": "Trading agent",
      "body": "Good catch \u2014 they're two different quantities, and one of them is wrong. The -$4,032 on the Options Log is the position's open (unrealised) P&L; the $7,448 on the detail page is labelled max loss and means the worst case if the spread finishes fully in the money, not money lost. So they were never meant to agree. But neither number checks out: this is 56 contracts of a $1-wide 143/144 call spread opened for a $0.33 credit, now marked $0.39. Open P&L should be (0.39 - 0.33) x 56 x 100 = -$336, and worst case should be (1.00 x 56 x 100) - $1,848 = $3,752. Both figures we showed are exactly what you get if the entry credit is added instead of subtracted, so we're treating this as a sign bug in how the entry credit is carried and it's queued for a fix. And on 'why is it a loss at all' \u2014 a small open loss just means the spread is marked slightly wider than we sold it; BABA is at $128.41 with the short strike at $143, so the trade is still 11% out of the money with 5 days left. Nothing has been realised. We'll update this thread once the numbers are corrected.",
      "createdAt": "2026-08-09T23:22:44Z",
      "id": "fb_msmf9zlo_v0a1ebjz.r1"
    }, {
      "author": "agent",
      "authorLabel": "Trading agent",
      "body": "Correction to our earlier answer \u2014 we got this wrong, and the original $7,448 figure you asked about was in fact the correct one. We described this as a credit spread. It was not. The broker record shows we sold the 143 call at $0.05 and bought the 144 call at $0.38 \u2014 short the lower strike, long the higher one, which is a bear call spread, but entered for a net $0.33 DEBIT of $1,848 rather than for a credit. That structure cannot make money at any price: the best possible outcome is both legs expiring worthless and losing the $1,848 we paid, and the worst is the full $1 width against us. Max loss really was $5,600 + $1,848 = $7,448, exactly as the detail page said. Our previous reply's '-$336 open P&L' and '$3,752 max loss' were both wrong, because they assumed a credit we never collected. The real open loss was -$4,704. We have now closed the position: we bought the short 143 call back at $0.51 today, and the long 144 call has no bid left and expires worthless tomorrow, for a realised loss of about $4,704. Two separate problems stand behind your question. The display bug you spotted is real and still queued. The bigger one is that the fund opened a spread that was mathematically incapable of profiting, and no entry check caught it \u2014 that is the more valuable half of this feedback, and it is the one we are treating as serious. Thank you for pushing on it.",
      "createdAt": "2026-08-13T18:26:09Z",
      "id": "fb_msmf9zlo_v0a1ebjz.r2"
    }, {
      "author": "agent",
      "authorLabel": "Trading agent",
      "body": "Closing the loop from our last reply here: the guard we said was 'queued' is now live. A hard min_net_credit floor is enforced twice for every CREDIT_SPREAD candidate \u2014 once in the scan (with its own funnel line so a rejected name stays visible instead of silently vanishing) and again as the final check right before an order is built, against the exact price about to be submitted rather than the earlier scan estimate. Zero and negative net credit are both refused unconditionally; a missing/unreadable price is treated the same as a non-positive one. And if a fill somehow still reconciles to a non-positive credit despite that, it now triggers a loud WARNING (trade, scored credit, actual credit, slippage) plus a durable audit-log entry, not just a quiet log line. This trade (and INTC 88/87 the same week) is what these checks exist to stop from happening again.",
      "createdAt": "2026-08-13T22:43:19Z",
      "id": "fb_msmf9zlo_v0a1ebjz.r3"
    }, {
      "author": "agent",
      "authorLabel": "Trading agent",
      "body": "Fixed: shipped in 1094-feedback-fb-msmf9zlo-v0a1ebjz-b-why-are-we-showing-4k-loss-h \u2014 feedback fb_msmf9zlo_v0a1ebjz: [B] Why are we showing 4k loss here? 7k on detail?. Thanks for flagging it.",
      "createdAt": "2026-08-14T03:48:06Z",
      "id": "fb_msmf9zlo_v0a1ebjz.r4"
    }, {
      "author": "agent",
      "authorLabel": "Trading agent",
      "body": "Both numbers were real, just answering different questions, and the page didn't say so. $4,704 (the headline) is what this trade actually closed for \u2014 we bought back the short leg early instead of letting the spread expire. $7,448 (in the stat grid below) is the theoretical worst case if we'd held to expiry with the stock above $144, which never happened. The detail page now labels that second number as a worst-case ceiling and explicitly names the real $4,704 result next to it, so it's clear which one is the actual outcome.",
      "createdAt": "2026-08-14T04:04:42Z",
      "id": "fb_msmf9zlo_v0a1ebjz.r5"
    }],
    "route": "#options",
    "scope": "position",
    "stage": "position",
    "status": "answered",
    "targetId": "BABA-C-143/144-2026-08-14",
    "targetKind": "position",
    "targetLabel": "BABA 143/144 call spread, expires Aug 14",
    "title": "[B] Why are we showing 4k loss here? 7k on detail?",
    "type": "feedback"
  }, {
    "answered": true,
    "archivedAt": null,
    "contractKey": "INTC-P-88-87-2026-08-12",
    "createdAt": "2026-08-09T23:42:16.000Z",
    "description": "how come we sell a put spread but pay debit? this should never happen!",
    "hasImage": false,
    "id": "fb_msmg68hc_h8sokn3z",
    "lastActivityAt": "2026-08-13T22:43:19Z",
    "messages": [{
      "author": "visitor",
      "authorLabel": "Visitor",
      "body": "how come we sell a put spread but pay debit? this should never happen!",
      "createdAt": "2026-08-09T23:42:16.000Z",
      "hasImage": false,
      "id": "fb_msmg68hc_h8sokn3z",
      "role": "user",
      "title": "Put spread fundamental problem"
    }, {
      "author": "agent",
      "authorLabel": "Trading agent",
      "body": "You were right, and it wasn't just this trade. The fund's INTC 88/87 put spread scored a +$364 credit at scan time but the broker fill came back at -$84 \u2014 a $448 slippage that flipped a credit spread into a debit, and risk on the position rose from $2,436 to $2,884 as a result. BABA 143/144 the same week was the identical class of bug: a structure we called a credit spread that could not profit at any price, entered for a net debit no entry check ever looked at. Root cause: the pre-submission check only ever looked at the credit the SCAN estimated, never the actual price about to be sent to the broker, so a quote move (or, in an earlier version of this bug, a sign error in how the limit price was built) could slip a non-positive-credit order through untouched. Two fixes now: (1) a hard min_net_credit floor is checked twice \u2014 once during the scan (its own 'non_positive_credit' line in the funnel, so a rejected name is visible, not silently dropped) and a second time as the final choke point right before the order is built, using the exact number that becomes the broker limit price, not the earlier scan estimate. A missing or unreadable price is refused the same as a non-positive one. (2) If a fill still somehow reconciles to a non-positive credit, it now pages loudly: a WARNING naming the trade, the scored credit, the actual credit and the slippage, plus a durable audit-log entry, from both the immediate-fill path and the later reconcile pass. The rule and the live floor are now shown on every proposed trade's check list and on the CREDIT_SPREAD policy card, so this is reviewable going forward, not just fixed in code. Thanks for catching it and for not letting it go.",
      "createdAt": "2026-08-13T22:43:19Z",
      "hasImage": false,
      "id": "fb_msmg68hc_h8sokn3z.r1",
      "role": "agent"
    }],
    "replies": [{
      "author": "agent",
      "authorLabel": "Trading agent",
      "body": "You were right, and it wasn't just this trade. The fund's INTC 88/87 put spread scored a +$364 credit at scan time but the broker fill came back at -$84 \u2014 a $448 slippage that flipped a credit spread into a debit, and risk on the position rose from $2,436 to $2,884 as a result. BABA 143/144 the same week was the identical class of bug: a structure we called a credit spread that could not profit at any price, entered for a net debit no entry check ever looked at. Root cause: the pre-submission check only ever looked at the credit the SCAN estimated, never the actual price about to be sent to the broker, so a quote move (or, in an earlier version of this bug, a sign error in how the limit price was built) could slip a non-positive-credit order through untouched. Two fixes now: (1) a hard min_net_credit floor is checked twice \u2014 once during the scan (its own 'non_positive_credit' line in the funnel, so a rejected name is visible, not silently dropped) and a second time as the final choke point right before the order is built, using the exact number that becomes the broker limit price, not the earlier scan estimate. A missing or unreadable price is refused the same as a non-positive one. (2) If a fill still somehow reconciles to a non-positive credit, it now pages loudly: a WARNING naming the trade, the scored credit, the actual credit and the slippage, plus a durable audit-log entry, from both the immediate-fill path and the later reconcile pass. The rule and the live floor are now shown on every proposed trade's check list and on the CREDIT_SPREAD policy card, so this is reviewable going forward, not just fixed in code. Thanks for catching it and for not letting it go.",
      "createdAt": "2026-08-13T22:43:19Z",
      "id": "fb_msmg68hc_h8sokn3z.r1"
    }],
    "route": "#trade/CREDIT_SPREAD_INTC_20260812_8800",
    "scope": "trade",
    "stage": "trade",
    "status": "answered",
    "targetId": "CREDIT_SPREAD_INTC_20260812_8800",
    "targetKind": "trade",
    "targetLabel": "INTC Bull put credit spread",
    "title": "Put spread fundamental problem",
    "type": "feedback"
  }]
};

/* ---- lib/live-snapshot.js ---- */
/* live-snapshot.js — fetch the live dashboard data from the bilko.run server and
 * overlay it onto window.* before the React app renders.
 *
 * This replaces the old publish path (the trader committed a regenerated data.js
 * into the Bilko site repo every ~30 min, rebuilding the whole site). Now the
 * trader POSTs its snapshot to `/api/projects/<slug>/snapshot` and this fetches
 * it at load.
 *
 * dashboard-data.bundle.js (data.js / data-extended.js / spread-*.js /
 * data-options-summary.js, concatenated by build-dashboard.mjs) is the
 * cold-start FALLBACK, but as of PRD 1102 it is NOT script-tagged in
 * index.html — the same payload lives in both the bundle and the snapshot
 * response, so an unconditional <script src> would ship it twice on every
 * load where the fetch succeeds (the common case). Instead this module
 * fetches the live snapshot first and only lazily loads the bundle if that
 * fetch fails (offline, static-dev, no snapshot yet), so a normal cold load
 * downloads the data exactly once.
 *
 * app.jsx awaits window.__loadLiveSnapshot() before the first render, so the
 * overlay (or fallback) is in place before any component reads window.* . */
(function () {
  var SLUG = "social-signals-trader";
  // Absolute path → resolves against the ORIGIN root (bilko.run), not the
  // /projects/<slug>/ page path. Same-origin in prod (no CORS); harmlessly
  // unreachable when the dashboard is served as static files in dev.
  var ENDPOINT = "/api/projects/" + SLUG + "/snapshot";
  var FALLBACK_BUNDLE = "dashboard-data.bundle.js";

  // Only loaded when the live snapshot fetch fails — see module comment.
  // Resolves true/false once the bundle has run (or been rejected), never rejects.
  //
  // MUST VALIDATE BEFORE EXECUTING. dashboard-data.bundle.js is on
  // publish-to-bilko.sh's rsync exclude list (generated data must never churn
  // through git), so on bilko.run this URL does not resolve to a file — the
  // host answers it with its SPA catch-all: HTTP **200**, `content-type:
  // text/html`, a 2.4 KB "<!DOCTYPE html>" page. A bare <script src> therefore
  // fires onload, not onerror, and injects an HTML document into the page as
  // JavaScript — a silent hard failure that renders an empty dashboard.
  // Probing the response first is what makes this path honest: anything that
  // is not real JavaScript is refused, and the caller reports the data as
  // unavailable instead of pretending a fallback ran.
  function looksLikeHtml(contentType, body) {
    if ((contentType || "").toLowerCase().indexOf("html") !== -1) return true;
    return /^\s*(<!doctype|<html)/i.test(body || "");
  }
  function loadFallbackBundle() {
    // Default cache mode (not no-store) so the <script src> below is served
    // from cache rather than fetched a second time.
    return fetch(FALLBACK_BUNDLE).then(function (r) {
      if (!r.ok) return false;
      return r.text().then(function (body) {
        if (looksLikeHtml(r.headers.get("content-type"), body)) return false;
        return new Promise(function (resolve) {
          // Inject by src, not inline text — the host sets a CSP nonce and
          // an inline <script> would be blocked.
          var s = document.createElement("script");
          s.src = FALLBACK_BUNDLE;
          s.onload = function () {
            resolve(true);
          };
          s.onerror = function () {
            resolve(false);
          };
          document.head.appendChild(s);
        });
      });
    }).catch(function () {
      return false;
    });
  }
  window.__loadLiveSnapshot = function () {
    return fetch(ENDPOINT, {
      cache: "no-store"
    }).then(function (r) {
      if (!r.ok) throw new Error("snapshot HTTP " + r.status);
      return r.json();
    }).then(function (snap) {
      var g = snap && snap.globals;
      if (!g || typeof g !== "object") throw new Error("snapshot missing globals");
      var n = 0;
      for (var k in g) {
        if (Object.prototype.hasOwnProperty.call(g, k)) {
          window[k] = g[k];
          n++;
        }
      }
      window.__liveSnapshotMeta = {
        ok: true,
        count: n,
        generatedAt: snap.generatedAt || null
      };
      if (window.console) console.info("[live-snapshot] overlaid " + n + " globals from server");
      return window.__liveSnapshotMeta;
    }).catch(function (e) {
      // Never reject — fall back to the bundled baseline, loaded lazily
      // only now that the live fetch has actually failed.
      var errMsg = String(e && e.message || e);
      return loadFallbackBundle().then(function (loaded) {
        // `fallbackLoaded` is the honest signal: false means the page has
        // NO data at all, not "we quietly fell back". Surfaced so a caller
        // can render an explicit unavailable state rather than an empty book.
        window.__liveSnapshotMeta = {
          ok: false,
          error: errMsg,
          fallbackLoaded: loaded
        };
        if (window.console) {
          console.warn(loaded ? "[live-snapshot] using bundled data (" + errMsg + ")" : "[live-snapshot] NO DATA — live fetch failed (" + errMsg + ") and no usable fallback bundle is published");
        }
        return window.__liveSnapshotMeta;
      });
    });
  };
})();

/* ---- lib/sb-client.js ---- */
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
    var params = new URLSearchParams(window.location.search || "");
    var forceFixture = params.get("fixture") === "signals";
    if (forceFixture && window.SIGNALS_HISTORY_FIXTURE) {
      return window.SIGNALS_HISTORY_FIXTURE;
    }
    if (window.SIGNALS_HISTORY && Array.isArray(window.SIGNALS_HISTORY.rows)) {
      return window.SIGNALS_HISTORY;
    }
    if (window.SIGNALS_HISTORY_FIXTURE) {
      return window.SIGNALS_HISTORY_FIXTURE;
    }
    return {
      schema_version: 1,
      rows: [],
      themes: []
    };
  }
  function toEpoch(s) {
    if (!s) return 0;
    if (typeof s === "number") return s;
    var t = Date.parse(s);
    return Number.isNaN(t) ? 0 : t;
  }
  var SBClient = {
    _raw() {
      return pickHistory();
    },
    /**
     * Returns rows shaped: {built_at, ticker, panel, payload}[].
     * Filters: tickers (string[]), panels (string[]), since (ISO|epoch),
     * until (ISO|epoch). All optional.
     */
    history(opts) {
      var {
        tickers,
        panels,
        since,
        until
      } = opts || {};
      var rows = pickHistory().rows || [];
      var tickerSet = tickers && tickers.length ? new Set(tickers) : null;
      var panelSet = panels && panels.length ? new Set(panels) : null;
      var sinceE = since ? toEpoch(since) : 0;
      var untilE = until ? toEpoch(until) : Infinity;
      // O(n) single pass.
      var out = [];
      for (var i = 0; i < rows.length; i++) {
        var r = rows[i];
        if (tickerSet && !tickerSet.has(r.ticker)) continue;
        if (panelSet && !panelSet.has(r.panel)) continue;
        var t = toEpoch(r.built_at);
        if (t < sinceE || t > untilE) continue;
        out.push(r);
      }
      return out;
    },
    /** Distinct tickers seen across the history blob (sorted). */
    tickers() {
      var rows = pickHistory().rows || [];
      var s = new Set();
      for (var i = 0; i < rows.length; i++) if (rows[i].ticker) s.add(rows[i].ticker);
      return Array.from(s).sort();
    },
    /** Distinct subreddits referenced inside payloads (sorted). */
    subreddits() {
      var rows = pickHistory().rows || [];
      var s = new Set();
      for (var i = 0; i < rows.length; i++) {
        var sub = rows[i].payload && rows[i].payload.top_subreddit;
        if (sub) s.add(sub);
      }
      return Array.from(s).sort();
    },
    /** Themes list (for the drilldown side-sheet). */
    themes() {
      return pickHistory().themes || [];
    }
  };
  window.SBClient = SBClient;
})();

/* ---- lib/optimization-client.js ---- */
/* optimization-client.js — thin fetch wrapper for the trader /optimization
 * HTTP endpoint (src/social_signals_trader/optimization_api.py).
 *
 * Discovery rules (in priority order):
 *   1. `?optApi=https://...`         — URL override for ad-hoc testing.
 *   2. `window.OPTIMIZATION_API_URL` — set by the operator at deploy time.
 *   3. `?fixture=opt`                — bypass network entirely, resolve
 *      against window.OPTIMIZATION_FIXTURE so the tab renders with no
 *      backend (this is the dev/Playwright path).
 *   4. Health-probe discovery        — GET /health on candidate loopback
 *      ports [8787, 8791, 8765] in order, first responder whose body has
 *      service === "optimization_api" wins. 8787 is the current default
 *      (see optimization_api.py); 8791/8765 are legacy fallbacks for
 *      already-running instances. A responder that answers /health but
 *      isn't the optimization_api (e.g. an unrelated service squatting the
 *      port) is rejected, not accepted.
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
 * PRD 75: per-cell metrics (sharpe / win_rate / max_drawdown / n_trades /
 * equity_curve) now come from a real `backtest_replay.run()` invocation
 * per cell — the legacy deterministic mock is gated behind the trader-side
 * `SST_OPTIMIZATION_MOCK=1` env var and only used by the endpoint shape
 * tests. The wire shape is unchanged: cells with no underlying panel
 * history get null metrics + a `note` field the dashboard renders as
 * "no data" without changing the column layout.
 *
 * Complexity: every call is O(1) in client work; server-side sweep is
 * O(|grid|) (capped at 200 cells).
 */
(function () {
  "use strict";

  var SLEEVE_PARAM_SCHEMA = {
    OPT_FLOW: {
      min_conviction: {
        min: 0.30,
        max: 0.90,
        step: 0.05
      },
      mention_threshold: {
        min: 5,
        max: 50,
        step: 5
      }
    },
    BLEND_CONS: {
      min_conviction: {
        min: 0.30,
        max: 0.90,
        step: 0.05
      },
      cross_sub_min: {
        min: 2,
        max: 6,
        step: 1
      }
    },
    DAY_PULSE: {
      min_conviction: {
        min: 0.30,
        max: 0.90,
        step: 0.05
      },
      velocity_ratio_min: {
        min: 1.2,
        max: 4.0,
        step: 0.2
      }
    },
    WSB_EARN: {
      // PRD 62: catalyst-timing sweep dimensions
      earnings_entry_lead: {
        min: 0,
        max: 10,
        step: 1
      },
      earnings_exit_lag: {
        min: 0,
        max: 5,
        step: 1
      }
    }
  };
  var MAX_GRID = 200;
  var DISCOVERY_PORTS = [8787, 8791, 8765];
  var PROBE_TIMEOUT_MS = 1500;
  var _resolvedBase = null;
  async function _probeCandidate(base) {
    var res;
    try {
      res = await fetch(base + "/health", {
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS)
      });
    } catch (_err) {
      return false;
    }
    if (!res.ok) return false;
    var body = await res.json().catch(() => ({}));
    return body && body.service === "optimization_api";
  }

  /** Resolve the trader optimization API base URL, memoised for the page
   *  lifetime. Priority: ?optApi= override -> window.OPTIMIZATION_API_URL ->
   *  health-probe discovery across DISCOVERY_PORTS. Rejects (uncached, so a
   *  retry after starting the server works without a reload) when nothing
   *  answers as optimization_api. */
  async function resolveApiBase() {
    var params = new URLSearchParams(window.location.search || "");
    var override = params.get("optApi");
    if (override) return override.replace(/\/+$/, "");
    if (window.OPTIMIZATION_API_URL) return String(window.OPTIMIZATION_API_URL).replace(/\/+$/, "");
    if (_resolvedBase) return _resolvedBase;
    for (var port of DISCOVERY_PORTS) {
      var base = `http://127.0.0.1:${port}`;
      // eslint-disable-next-line no-await-in-loop -- sequential by design: try in priority order, stop at first hit
      if (await _probeCandidate(base)) {
        _resolvedBase = base;
        return base;
      }
    }
    throw new Error(`trader API not reachable on ${DISCOVERY_PORTS.join("/")}`);
  }
  function useFixture() {
    var params = new URLSearchParams(window.location.search || "");
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
    var out = [];
    if (!Number.isFinite(min) || !Number.isFinite(max) || !Number.isFinite(step) || step <= 0) {
      return out;
    }
    var eps = step / 1e6;
    var v = min;
    var i = 0;
    while (v <= max + eps && i < 1000) {
      out.push(Number(v.toFixed(6)));
      v += step;
      i++;
    }
    return out;
  }
  function gridSize(paramGrid) {
    var n = 1;
    for (var k of Object.keys(paramGrid)) n *= Math.max(1, paramGrid[k].length);
    return n;
  }
  async function _fixtureSweep(sleeveId, paramGrid) {
    var fx = window.OPTIMIZATION_FIXTURE;
    if (fx && fx[sleeveId]) {
      return fx[sleeveId];
    }
    // Synthesize a tiny deterministic result from the grid if the fixture
    // doesn't cover this sleeve, so the heatmap still renders.
    var keys = Object.keys(paramGrid);
    var values = keys.map(k => paramGrid[k] || []);
    var combos = [];
    (function recur(i, acc) {
      if (i === keys.length) {
        combos.push({
          ...acc
        });
        return;
      }
      for (var v of values[i]) {
        acc[keys[i]] = v;
        recur(i + 1, acc);
      }
    })(0, {});
    var cells = combos.map((params, idx) => {
      var sharpe = -0.5 + idx % 7 * 0.5;
      return {
        params,
        sharpe: Number(sharpe.toFixed(2)),
        win_rate: 0.4 + idx % 5 * 0.05,
        max_drawdown: -0.05 - idx % 4 * 0.02,
        n_trades: 20 + idx * 3,
        equity_curve: Array.from({
          length: 10
        }, (_, k) => ({
          t: `step_${k}`,
          v: 10000 + idx * 80 + k * 12 * (sharpe + 1)
        }))
      };
    });
    var winner = cells.reduce((a, b) => a.sharpe >= b.sharpe ? a : b, cells[0]);
    return {
      sleeve_id: sleeveId,
      cells,
      winner: winner ? {
        params: winner.params,
        sharpe: winner.sharpe
      } : null,
      sweep_id: "fixture-" + sleeveId,
      mock: true
    };
  }
  async function sweep(sleeveId, paramGrid, dateRange) {
    if (useFixture()) return _fixtureSweep(sleeveId, paramGrid);
    var url = (await resolveApiBase()) + "/optimization/sweep";
    var res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        sleeve_id: sleeveId,
        param_grid: paramGrid,
        date_range: dateRange
      })
    });
    var body = await res.json().catch(() => ({}));
    if (!res.ok) {
      var err = new Error(body.error || "http_" + res.status);
      err.detail = body;
      throw err;
    }
    return body;
  }
  async function promote(sleeveId, params, sweepId) {
    if (useFixture()) {
      // No-op in fixture mode — just echo the payload so the UI can confirm.
      return {
        ok: true,
        sleeve_id: sleeveId,
        entry: {
          params,
          source: "fixture",
          promoted_at: new Date().toISOString(),
          sweep_id: sweepId || "fixture"
        }
      };
    }
    var url = (await resolveApiBase()) + "/optimization/promote";
    var res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        sleeve_id: sleeveId,
        params,
        sweep_id: sweepId
      })
    });
    var body = await res.json().catch(() => ({}));
    if (!res.ok) {
      var err = new Error(body.error || "http_" + res.status);
      err.detail = body;
      throw err;
    }
    return body;
  }

  // ---- PRD 72: variants ---------------------------------------------------

  async function listVariants() {
    if (useFixture()) {
      var fx = window.VARIANT_EVALUATION_FIXTURE;
      if (fx && Array.isArray(fx.variants)) return {
        variants: fx.variants
      };
      return {
        variants: []
      };
    }
    var url = (await resolveApiBase()) + "/variants/list";
    var res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: "{}"
    });
    var body = await res.json().catch(() => ({}));
    if (!res.ok) {
      var err = new Error(body.error || "http_" + res.status);
      err.detail = body;
      throw err;
    }
    return body;
  }
  async function evaluateVariants(variants, fromDate, toDate, catalyst) {
    if (useFixture()) {
      var fx = window.VARIANT_EVALUATION_FIXTURE;
      var fxRows = fx && Array.isArray(fx.rows) ? fx.rows : [];
      var filtered = fxRows.filter(r => variants.includes(r.variant_id));
      return {
        rows: filtered.length ? filtered : fxRows
      };
    }
    var url = (await resolveApiBase()) + "/variants/evaluate";
    var res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        variants,
        from: fromDate,
        to: toDate,
        catalyst: catalyst || null
      })
    });
    var body = await res.json().catch(() => ({}));
    if (!res.ok) {
      var err = new Error(body.error || "http_" + res.status);
      err.detail = body;
      throw err;
    }
    return body;
  }

  /** On-demand option chain for ONE ticker. Rejects with a readable message so
   *  the Ticker Details page can fall back to its bundled snapshot. */
  async function optionChain(ticker, opts) {
    var base = await resolveApiBase();
    var res = await fetch(base + "/options/chain", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        ticker,
        ...(opts || {})
      })
    });
    var body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.detail || body.error || `HTTP ${res.status}`);
    return body;
  }
  window.OptimizationClient = {
    resolveApiBase,
    optionChain,
    listSleeves,
    paramSchema,
    rangeToValues,
    gridSize,
    sweep,
    promote,
    listVariants,
    evaluateVariants,
    MAX_GRID,
    SLEEVE_PARAM_SCHEMA
  };
})();

/* ---- lib/spread-format.js ---- */
// Shared option-spread formatting/parsing — the single OCC parser + spread
// classifier + breakeven math used by every panel that renders option legs
// (options-trade-log.jsx, CurrentPositions / TradesTable in components.jsx).
// Plain JS (no JSX), loaded before any panel that references window.SpreadFormat.

(function () {
  var g4 = v => v == null ? "—" : Number(v).toFixed(4);
  var money = v => v == null ? "—" : (v < 0 ? "-$" : "$") + Math.abs(Number(v)).toLocaleString(undefined, {
    maximumFractionDigits: 2
  });
  var pctv = v => v == null ? "—" : (Number(v) * 100).toFixed(1) + "%";
  var num = v => v == null || v === "" ? null : Number(v);

  // --- OCC symbol parsing ------------------------------------------------
  // Layout: <root><yymmdd><C|P><strike*1000, 8 digits>, e.g.
  // SPY260810C00777000 -> SPY $777 CALL exp 2026-08-10.
  function parseOccSymbol(symbol) {
    if (!symbol || typeof symbol !== "string" || symbol.length < 15) return null;
    var tail = symbol.slice(-15);
    var datePart = tail.slice(0, 6);
    var rightChar = tail[6];
    var strikePart = tail.slice(7);
    if (!/^[0-9]{6}$/.test(datePart) || !/^[CP]$/.test(rightChar) || !/^[0-9]{8}$/.test(strikePart)) {
      return null;
    }
    var root = symbol.slice(0, -15);
    if (!root) return null;
    var yy = datePart.slice(0, 2);
    var mm = datePart.slice(2, 4);
    var dd = datePart.slice(4, 6);
    var strike = parseInt(strikePart, 10) / 1000;
    return {
      root,
      expiry: `20${yy}-${mm}-${dd}`,
      right: rightChar === "C" ? "CALL" : "PUT",
      strike
    };
  }
  function plainEnglishLeg(symbol) {
    var p = parseOccSymbol(symbol);
    if (!p) return symbol || "—";
    return `${p.root} $${p.strike} ${p.right} exp ${p.expiry}`;
  }
  function spreadStructure(shortParsed, longParsed, ticker) {
    if (!shortParsed || !longParsed) return null;
    if (shortParsed.right === "CALL" && longParsed.right === "CALL" && shortParsed.strike < longParsed.strike) {
      return {
        name: "Bear call credit spread",
        gloss: `profits if ${ticker} stays below $${shortParsed.strike} through ${shortParsed.expiry}`
      };
    }
    if (shortParsed.right === "PUT" && longParsed.right === "PUT" && shortParsed.strike > longParsed.strike) {
      return {
        name: "Bull put credit spread",
        gloss: `profits if ${ticker} stays above $${shortParsed.strike} through ${shortParsed.expiry}`
      };
    }
    return {
      name: "Credit spread",
      gloss: null
    };
  }

  // Breakeven = short strike + credit/share for a call spread,
  // short strike - credit/share for a put spread. A spread that filled at a
  // net DEBIT (credit <= 0) has no breakeven — it cannot win at any price —
  // so this returns null rather than a number that looks like a real target.
  function breakeven(shortParsed, credit, contracts) {
    if (!shortParsed || credit == null || credit <= 0 || !contracts) return null;
    var creditPerShare = credit / contracts / 100;
    return shortParsed.right === "CALL" ? shortParsed.strike + creditPerShare : shortParsed.strike - creditPerShare;
  }

  // Whole calendar days from now until an ISO expiry date (YYYY-MM-DD).
  function dteFromExpiry(expiry, now) {
    if (!expiry) return null;
    var exp = new Date(expiry + "T00:00:00Z");
    if (Number.isNaN(exp.getTime())) return null;
    var ref = now || new Date();
    var refUtc = Date.UTC(ref.getFullYear(), ref.getMonth(), ref.getDate());
    return Math.round((exp.getTime() - refUtc) / 86400000);
  }
  window.SpreadFormat = {
    g4,
    money,
    pctv,
    num,
    parseOccSymbol,
    plainEnglishLeg,
    spreadStructure,
    breakeven,
    dteFromExpiry
  };
})();

/* ---- lib/glossary.js ---- */
// Shared options glossary + <Help term="..."/> tooltip primitive — the ONE
// definition per concept, project-wide, so PRDs 1019/1020 apply it instead of
// each panel inventing its own tooltip. Plain JS (no JSX — uses
// React.createElement directly), loaded before any panel that references
// window.Glossary / window.Help.

(function () {
  // A TERMS entry may carry an optional `calc` describing a worked
  // calculation, rendered by <Help/> when the call site passes matching
  // `inputs`. Shape (all fields required unless noted):
  //
  //   calc: {
  //     expr: "width × 100 × contracts − credit",  // generic, human-readable;
  //       // written using each input's `key` (underscores as spaces) as the
  //       // substitution token, e.g. "short ask" for key "short_ask" —
  //       // <Help/> does a literal word-swap of each token for its live value.
  //     inputs: [
  //       {
  //         key: "credit",              // matches a key in the `inputs` prop
  //         label: "Credit received",   // shown in the "How we got this" list
  //         unit: "$",                  // "$" | "%" | "" | "px" — how to format
  //         priced: true,               // came from a market quote or a fill —
  //                                     // needs an as-of stamp (see `clock`)
  //         clock: "entry",             // "entry" (fill-derived, historical) or
  //                                     // "quotes" (live-quote-derived) — only
  //                                     // meaningful when priced: true
  //         text: false,                // true for a non-numeric input (e.g.
  //                                     // "call"/"put") — skips numeric coercion
  //       },
  //       ...
  //     ],
  //     result: (v) => v.width * 100 * v.contracts - v.credit,  // pure, no
  //       // rounding beyond what the Python source does; may return
  //       // null/non-finite for a legitimate "can't compute" case (e.g.
  //       // division by zero) — <Help/> falls back to formula-only then.
  //     unit: "$",                       // "$" | "%" | "" | "px" — result unit
  //     source: "src/social_signals_trader/options_summary.py:250",  // file:line
  //   }
  //
  // PRDs 1026/1027 wire call-site `inputs` — follow this exact shape so they
  // stay mechanically consistent.
  //
  // INVARIANT (PRD 1025): every entry in TERMS carries either a `calc` or a
  // non-empty `example` string — never neither. `calc` is for values this
  // file (or the Python it mirrors) actually derives from other numbers;
  // `example` is for everything else — definitions, enums, raw inputs — one
  // concrete, numeric, plain-English sentence rendered under `long`. A term
  // may carry both (calc renders last); tests/test_glossary_jsx.py enforces
  // this for every term it parses out of TERMS.
  var MAX_LOSS_CALC = {
    expr: "width × 100 × contracts − credit",
    inputs: [{
      key: "width",
      label: "Spread width",
      unit: "$"
    }, {
      key: "contracts",
      label: "Contracts",
      unit: ""
    }, {
      key: "credit",
      label: "Credit received",
      unit: "$",
      priced: true,
      clock: "entry"
    }],
    result: v => v.width * 100 * v.contracts - v.credit,
    unit: "$",
    source: "src/social_signals_trader/options_summary.py:250"
  };
  var TERMS = {
    credit_received: {
      label: "Credit received",
      short: "The cash we were paid up front to open this trade.",
      long: "Selling a spread means we collect money immediately instead of paying it. This is that amount, per contract times how many contracts we hold.",
      calc: {
        expr: "−(net premium per contract) × 100 × contracts",
        inputs: [{
          key: "net_per_contract",
          label: "Net premium per contract",
          unit: "$",
          priced: true,
          clock: "entry"
        }, {
          key: "contracts",
          label: "Contracts",
          unit: ""
        }],
        result: v => -v.net_per_contract * 100 * v.contracts,
        unit: "$",
        source: "src/social_signals_trader/options_summary.py:223"
      }
    },
    debit_paid: {
      label: "Debit paid",
      short: "Cash paid out to open or close a position — the mirror of credit received.",
      long: "Sign convention: credit received is money in (positive to us at entry); debit paid is money out. Buying to open the long leg and buying to close the short leg are both debits.",
      example: "Buying to open the $250 put for $0.45 costs a $45 debit per contract (0.45 × 100); buying to close a short leg works the same way — price × 100 × contracts, paid out instead of received."
    },
    credit_if_filled: {
      label: "Credit if filled",
      short: "The cash we'd be paid up front if this order fills at its limit price.",
      long: "Same idea as credit received, but for an order that hasn't executed yet.",
      calc: {
        expr: "limit price × 100 × contracts",
        inputs: [{
          key: "limit_price",
          label: "Limit price (per share)",
          unit: "$"
        }, {
          key: "contracts",
          label: "Contracts",
          unit: ""
        }],
        result: v => v.limit_price * 100 * v.contracts,
        unit: "$",
        source: "src/social_signals_trader/options_chain.py:655"
      }
    },
    max_gain: {
      label: "Max gain",
      short: "The most this trade can make, best case.",
      long: "For a credit spread that ceiling is the credit received — if the stock cooperates, we simply keep the whole premium.",
      calc: {
        expr: "credit",
        inputs: [{
          key: "credit",
          label: "Credit received",
          unit: "$",
          priced: true,
          clock: "entry"
        }],
        result: v => v.credit,
        unit: "$",
        source: "src/social_signals_trader/options_summary.py:223"
      }
    },
    max_loss: {
      label: "Max loss",
      short: "The most this trade can lose, worst case.",
      long: "The width of the spread (the gap between the two strikes) minus the credit we collected, times contracts. This is capped and known up front — it cannot get worse than this.",
      calc: MAX_LOSS_CALC
    },
    risk: {
      label: "Risk",
      short: "How much money is on the line if this trade goes the wrong way.",
      long: "Shorthand for max loss — the capital that's actually exposed on this position.",
      calc: MAX_LOSS_CALC
    },
    breakeven: {
      label: "Breakeven",
      short: "The stock price at which this trade neither makes nor loses money.",
      long: "Past this price the trade starts losing; short of it, we keep some or all of the credit.",
      calc: {
        expr: "short strike ± credit ÷ contracts ÷ 100 (call: +, put: −)",
        inputs: [{
          key: "short_strike",
          label: "Short strike",
          unit: "$"
        }, {
          key: "credit",
          label: "Credit received",
          unit: "$",
          priced: true,
          clock: "entry"
        }, {
          key: "contracts",
          label: "Contracts",
          unit: ""
        }, {
          key: "right",
          label: "Option type",
          unit: "",
          text: true
        }],
        result: v => {
          var cps = v.credit / v.contracts / 100;
          return String(v.right).toLowerCase() === "call" ? v.short_strike + cps : v.short_strike - cps;
        },
        unit: "$",
        source: "src/social_signals_trader/aggregations.py:502"
      }
    },
    cushion: {
      label: "Cushion",
      short: "How far the stock has to move before this trade starts losing — bigger is safer.",
      long: "Measured as the distance from the current stock price to breakeven. A wide cushion means the stock would have to move a lot against us before we're at risk.",
      calc: {
        expr: "(short strike − spot) ÷ spot, put: (spot − short strike) ÷ spot",
        inputs: [{
          key: "short_strike",
          label: "Short strike",
          unit: "$"
        }, {
          key: "spot",
          label: "Spot price",
          unit: "$",
          priced: true,
          clock: "quotes"
        }, {
          key: "right",
          label: "Option type",
          unit: "",
          text: true
        }],
        result: v => {
          if (!v.spot) return null;
          var r = String(v.right).toLowerCase();
          return r === "call" ? (v.short_strike - v.spot) / v.spot : (v.spot - v.short_strike) / v.spot;
        },
        unit: "%",
        source: "src/social_signals_trader/options_summary.py:243"
      }
    },
    band: {
      label: "Band",
      short: "A traffic-light label for how close this trade is to trouble.",
      long: "SAFE = plenty of cushion left. WATCH = cushion is shrinking, keep an eye on it. DANGER = cushion is nearly gone. BREACHED = the stock has already crossed the strike that protects this trade.",
      example: "A short $255 put with the stock at $270 has ~5.6% cushion — that reads SAFE; the same trade at $256 has ~0.4% cushion and reads DANGER."
    },
    dte: {
      label: "DTE",
      short: "Days left until this option expires.",
      long: "Short for 'days to expiration'. Fewer days means less time for the stock to move against us, but also less time for it to recover if it does.",
      example: "An expiry of 0 or a negative number of days just means the contract has already expired or expires today — not that time is somehow owed back.",
      calc: {
        expr: "expiry date − today, in calendar days",
        inputs: [{
          key: "expiry",
          label: "Expiry date",
          unit: "",
          text: true
        }, {
          key: "today",
          label: "Today's date",
          unit: "",
          text: true
        }],
        result: v => {
          // Both inputs are plain YYYY-MM-DD calendar-date strings (not
          // instants), so a bare `new Date(...)` parses each consistently
          // as UTC midnight — unlike SpreadFormat.dteFromExpiry, whose `now`
          // param expects a real instant and re-derives the local calendar
          // day from it, which would double-convert a date-only string.
          var exp = new Date(v.expiry);
          var today = new Date(v.today);
          if (Number.isNaN(exp.getTime()) || Number.isNaN(today.getTime())) return null;
          return Math.round((exp.getTime() - today.getTime()) / 86400000);
        },
        unit: "",
        source: "src/social_signals_trader/options_summary_render.py:195"
      }
    },
    last_updated: {
      label: "Last updated",
      short: "When the job that wrote this card last ran.",
      long: "The read-through of the book — what we think, what needs action, and the Positions table — is re-derived wholesale by the Analyst cron (scripts/options-status-refresh-summary.sh), pre-open plus 4x through the session on weekdays only, never live in your browser. This stamp is that job's own generated_at, shown in Pacific time with its age; it turns amber once wall-clock has passed the job's own next scheduled run plus its grace period, which means a weekday run was missed — not merely that the last run happened a while ago (a Friday-evening or weekend view of Friday's last run is not flagged).",
      example: "A stamp reading '12:55 PM PDT, Fri Aug 8 · ~2h old · pre-open + 4x through the session' means the cron last ran at 12:55 PM Pacific — the prices quoted in the bullets are from then, not from right now."
    },
    expiry: {
      label: "Expiry",
      short: "The date this option contract stops existing.",
      long: "After this date the contract is settled — worthless if out of the money, exercised if in the money.",
      example: "An option with expiry 2026-08-21 stops trading and settles on that date — that's what the 8/21 in the contract symbol means."
    },
    short_leg: {
      label: "Short leg",
      short: "The option we sold as part of this spread.",
      long: "Selling it is what generates the credit; it's also the leg that defines breakeven and risk.",
      example: "In a $255/$250 bull put spread, the $255 put we sold is the short leg."
    },
    long_leg: {
      label: "Long leg",
      short: "The option we bought as part of this spread.",
      long: "It exists to cap our downside — it's what makes the max loss a known, limited number instead of unlimited.",
      example: "In a $255/$250 bull put spread, the $250 put we bought is the long leg — it caps the loss at $5 wide minus the credit collected."
    },
    sell_to_open: {
      label: "Sell to open",
      short: "The order type that opens a new short position — selling an option we don't already own.",
      long: "This is what generates the credit: we take on the obligation (assignment risk) in exchange for cash paid to us up front. It's the first leg of every spread this sleeve trades.",
      example: "Selling to open the $255 put collects that put's premium now and creates the obligation to buy the stock at $255 if it's assigned."
    },
    buy_to_open: {
      label: "Buy to open",
      short: "The order type that opens a new long position — buying an option we don't already own.",
      long: "This is the loss-cap leg: it costs a debit, but that debit buys the right to trade the stock at the strike, capping how bad the short leg can go. Always opened in the same order as its short leg, never on its own.",
      example: "Buying to open the $250 put alongside selling the $255 put turns an otherwise unlimited-risk short put into a defined-risk spread."
    },
    buy_to_close: {
      label: "Buy to close",
      short: "The order type that closes an existing short position — buying back the option we sold.",
      long: "Costs a debit. Used both to lock in a win (profit target) and to cap a loss (strike breach or max-loss stop) — the trigger differs but the order is the same.",
      example: "Buying to close a short put we sold for $1.20 at $0.60 locks in $0.60 of the credit as realized profit; buying it back at $2.40 instead locks in a loss."
    },
    strike: {
      label: "Strike",
      short: "The price level written into an option contract.",
      long: "It's the price at which the option would be exercised — where shares would change hands if the option is in the money at expiry.",
      example: "If we sold the $255 put, $255 is the strike — below that price at expiry, the buyer can put the shares to us at $255 each."
    },
    width: {
      label: "Width",
      short: "The dollar gap between the two strike prices in a spread.",
      long: "Wider spreads collect more credit but also risk more, since max loss is roughly the width minus the credit received.",
      calc: {
        expr: "|short strike − long strike|",
        inputs: [{
          key: "short_strike",
          label: "Short strike",
          unit: "$"
        }, {
          key: "long_strike",
          label: "Long strike",
          unit: "$"
        }],
        result: v => Math.abs(v.short_strike - v.long_strike),
        unit: "$",
        source: "src/social_signals_trader/options_summary.py:208"
      }
    },
    contracts: {
      label: "Contracts",
      short: "How many copies of this spread we're holding.",
      long: "Each option contract represents 100 shares, so gains, losses, and credit all scale by this number.",
      example: "3 contracts of a $1.20 credit spread means $360 of credit total (3 × $1.20 × 100), not $1.20."
    },
    delta: {
      label: "Delta",
      short: "How much an option's price moves for a $1 move in the stock.",
      long: "Also used as a rough odds estimate — a 0.20 delta option behaves like it has roughly a 20% chance of finishing in the money.",
      example: "A 0.30-delta call gains about $0.30 in value for every $1 the stock rises.",
      calc: {
        expr: "net delta × 100 × contracts = position delta",
        inputs: [{
          key: "net_greek",
          label: "Net delta (per share)",
          unit: ""
        }, {
          key: "contracts",
          label: "Contracts",
          unit: ""
        }],
        result: v => v.net_greek * 100 * v.contracts,
        unit: "",
        source: "dashboard/panels/options-trade-log.jsx:123"
      }
    },
    short_leg_delta: {
      label: "Short-leg delta",
      short: "The odds-style read on our sold option — roughly its chance of finishing in the money.",
      long: "A lower short-leg delta means the strike we sold is farther from the stock price, so the trade is statistically safer (but usually pays less credit).",
      example: "A short-leg delta of −0.15 on a sold put reads as roughly a 15% chance the stock finishes below that strike at expiry."
    },
    gamma: {
      label: "Gamma",
      short: "How fast delta itself changes as the stock moves.",
      long: "High gamma means the trade's sensitivity to the stock can shift quickly — risk can change fast, especially close to expiry.",
      example: "A gamma of 0.05 means a $1 stock move shifts delta by about 0.05 — e.g. from 0.20 to 0.25.",
      calc: {
        expr: "net gamma × 100 × contracts = position gamma",
        inputs: [{
          key: "net_greek",
          label: "Net gamma (per share)",
          unit: ""
        }, {
          key: "contracts",
          label: "Contracts",
          unit: ""
        }],
        result: v => v.net_greek * 100 * v.contracts,
        unit: "",
        source: "dashboard/panels/options-trade-log.jsx:124"
      }
    },
    theta: {
      label: "Theta",
      short: "How much value this position gains (or loses) each day just from time passing.",
      long: "Credit spreads are usually sold to profit from theta — time decay works in our favor as long as the stock stays away from the short strike.",
      example: "A position with theta of +$8 gains about $8 in value overnight from time decay alone, stock price unchanged.",
      calc: {
        expr: "net theta × 100 × contracts = position theta",
        inputs: [{
          key: "net_greek",
          label: "Net theta (per share)",
          unit: ""
        }, {
          key: "contracts",
          label: "Contracts",
          unit: ""
        }],
        result: v => v.net_greek * 100 * v.contracts,
        unit: "$",
        source: "dashboard/panels/options-trade-log.jsx:125"
      }
    },
    vega: {
      label: "Vega",
      short: "How much this position's value changes when the market's expected volatility changes.",
      long: "A jump in expected volatility (e.g. before earnings) can move this position even if the stock price hasn't moved at all.",
      example: "A vega of −$12 means the position loses about $12 in value for every 1-point rise in implied volatility.",
      calc: {
        expr: "net vega × 100 × contracts = position vega",
        inputs: [{
          key: "net_greek",
          label: "Net vega (per share)",
          unit: ""
        }, {
          key: "contracts",
          label: "Contracts",
          unit: ""
        }],
        result: v => v.net_greek * 100 * v.contracts,
        unit: "$",
        source: "dashboard/panels/options-trade-log.jsx:126"
      }
    },
    rho: {
      label: "Rho",
      short: "How much this position's value changes when interest rates change.",
      long: "Usually the smallest factor for short-dated option trades, but included for completeness.",
      example: "A rho of $2 means the position's value moves about $2 for a full 1% (100bp) move in interest rates — rarely material over a 2-week hold.",
      calc: {
        expr: "net rho × 100 × contracts = position rho",
        inputs: [{
          key: "net_greek",
          label: "Net rho (per share)",
          unit: ""
        }, {
          key: "contracts",
          label: "Contracts",
          unit: ""
        }],
        result: v => v.net_greek * 100 * v.contracts,
        unit: "$",
        source: "dashboard/panels/options-trade-log.jsx:127"
      }
    },
    iv: {
      label: "IV",
      short: "The market's current guess at how much this stock will swing around.",
      long: "Short for 'implied volatility'. Higher IV means option premiums are richer — good for sellers of credit spreads, but it also signals the market expects a bigger move.",
      example: "An IV of 45% implies the market expects this stock could move roughly ±45% over the next year, annualized."
    },
    rsi: {
      label: "RSI (14)",
      short: "How hard a stock has been bought or sold lately, on a 0-100 scale.",
      example: "Below 35 means it has been sold off hard (oversold) — that is when the fund is allowed to sell PUT spreads. Above 65 means it has been bought hard (overbought) — that is when it is allowed to sell CALL spreads. RSI 28 on a name we sell puts on means we are betting the fall has gone far enough.",
      long: "Relative Strength Index, Wilder's 14-day version computed on daily closes. It compares the size of recent up moves to recent down moves; 50 is neutral. It is a stretch gauge, not a prediction — a stock can stay oversold for weeks."
    },
    stochastic: {
      label: "Stochastic %K (14)",
      short: "Where today's close sits inside the last 14 days' high-low range.",
      example: "%K = 8 means the close is near the bottom of the two-week range (oversold, the fund's put-spread condition is %K < 30); %K = 95 means it is near the top (overbought, the call-spread condition is %K > 70). It is checked together with RSI — both must agree before a side is allowed.",
      long: "Fast %K = (close - lowest low) / (highest high - lowest low) x 100 over the last 14 daily bars. A flat range reads 50 (neutral) rather than dividing by zero."
    },
    collateral: {
      label: "Collateral",
      short: "The cash the broker locks up while the trade is open. We get it back when it closes.",
      example: "A 4-contract $5-wide spread reserves 4 x $5 x 100 = $2,000. The $420 credit we were paid counts toward it, so the NEW cash tied up is $1,580 — which is also the most the trade can lose. The deposit is released when the spread closes or expires.",
      long: "Also called buying-power reduction. For a credit spread the broker holds the full strike width, because that is the worst the position can be worth against us. It is not a cost and not a loss — it is capital that cannot be used for anything else until the trade is done, which is why the sleeve caps how much of the account can be deployed as collateral at once."
    },
    proposed_trade: {
      label: "Proposed trade",
      short: "A trade the fund intends to open and has not opened. No money is committed yet.",
      example: "A proposal reading 'NVDA 150/145 put spread, expires Aug 21' means the fund wants to sell that spread on the next tick and has not yet. Nothing is at risk while it sits here, and a comment on it — 'the strike is too close' — is read before anything fills.",
      long: "Proposals are produced by the pre-bell plan (spread_trader --preopen) after a candidate clears every entry gate. They sit here so a human can read the reasoning and object before the next tick tries to fill them. Comment on one with its \u{1F4AC} button — that thread is read before anything is placed. A proposal that fills moves to the Trade Log; one that doesn't simply disappears at the next plan."
    },
    pop: {
      label: "PoP / win probability",
      short: "Our best estimate of the odds this trade ends up profitable.",
      long: "Short for 'probability of profit'. It's an estimate, not a guarantee — it comes from option pricing math, not a promise about what the stock will actually do.",
      calc: {
        expr: "1 − |short-leg delta| (an estimate from option-pricing math, not an exact identity)",
        inputs: [{
          key: "short_leg_delta",
          label: "Short-leg delta",
          unit: "",
          priced: true,
          clock: "quotes"
        }],
        result: v => 1 - Math.abs(v.short_leg_delta),
        unit: "%",
        source: "src/social_signals_trader/options_summary.py:322"
      }
    },
    ev: {
      label: "EV",
      short: "The average dollar outcome we'd expect if we ran this exact trade many times.",
      long: "Short for 'expected value'. It blends the size of the win, the size of the loss, and how likely each is, into one number — positive EV means the trade is favorable on average.",
      calc: {
        expr: "(pop × credit ÷ contracts − (1 − pop) × (width × 100 − credit ÷ contracts)) × contracts, pop = 1 − |short delta|",
        inputs: [{
          key: "short_leg_delta",
          label: "Short-leg delta",
          unit: "",
          priced: true,
          clock: "quotes"
        }, {
          key: "credit",
          label: "Credit received",
          unit: "$",
          priced: true,
          clock: "entry"
        }, {
          key: "width",
          label: "Spread width",
          unit: "$"
        }, {
          key: "contracts",
          label: "Contracts",
          unit: ""
        }],
        result: v => {
          var pop = 1 - Math.abs(v.short_leg_delta);
          var creditPc = v.credit / v.contracts;
          var maxLossPc = v.width * 100 - creditPc;
          return (pop * creditPc - (1 - pop) * maxLossPc) * v.contracts;
        },
        unit: "$",
        source: "src/social_signals_trader/options_summary.py:325"
      }
    },
    breakeven_credit: {
      label: "Breakeven credit",
      short: "The minimum credit that would have made this trade break even, given its odds.",
      long: "Compares what we actually collected against what the option math says we needed to collect just to break even on average — collecting more than this is what makes the trade +EV.",
      calc: {
        expr: "(1 − pop) × width × 100 × contracts",
        inputs: [{
          key: "pop",
          label: "PoP (win probability)",
          unit: "%"
        }, {
          key: "width",
          label: "Spread width",
          unit: "$"
        }, {
          key: "contracts",
          label: "Contracts",
          unit: ""
        }],
        result: v => (1 - v.pop) * v.width * 100 * v.contracts,
        unit: "$",
        source: "src/social_signals_trader/options_summary.py:326"
      }
    },
    pct_captured: {
      label: "% captured",
      short: "How much of the maximum possible profit we've actually locked in so far.",
      long: "100% would mean we've captured the full credit received; a negative number means the trade is currently underwater relative to what we collected.",
      calc: {
        expr: "(credit − close cost) ÷ credit",
        inputs: [{
          key: "credit",
          label: "Credit received",
          unit: "$",
          priced: true,
          clock: "entry"
        }, {
          key: "close_cost",
          label: "Close cost",
          unit: "$",
          priced: true,
          clock: "quotes"
        }],
        result: v => v.credit == null || v.credit <= 0 ? null : (v.credit - v.close_cost) / v.credit,
        unit: "%",
        source: "src/social_signals_trader/options_summary.py:269"
      }
    },
    profit_target: {
      label: "Profit target",
      short: "The point at which we plan to close this trade early and take the win.",
      long: "Usually set as a percentage of the credit received, so we don't have to hold every trade all the way to expiry to realize a profit.",
      calc: {
        expr: "credit × (1 − profit_target_pct)",
        inputs: [{
          key: "credit",
          label: "Credit received",
          unit: "$",
          priced: true,
          clock: "entry"
        }, {
          key: "profit_target_pct",
          token: "profit_target_pct",
          label: "Profit-target %",
          unit: "%"
        }],
        result: v => v.credit * (1 - v.profit_target_pct),
        unit: "$",
        source: "src/social_signals_trader/options_summary.py:275"
      }
    },
    max_loss_pct: {
      label: "Max-loss stop",
      short: "A rule that closes a losing trade once its open loss equals a set fraction of the credit we collected.",
      long: "Expressed as a fraction of the CREDIT RECEIVED, not of the trade's max risk — a defined-risk spread can never lose more than its own max risk, so that denominator would never fire. Default 100%: close once the cost to buy the spread back equals the full credit we were paid at entry. A mark known to be arithmetically impossible (see wide_quote / mark-suspect clamp) never triggers this — it keys off the clamped cost-to-close, same as the profit target.",
      example: "With max_loss_pct at 100% and $30 collected in credit, the trade is closed once buying it back would cost $60 (the loss equals the credit received). For a spread whose width caps the buy-back cost below that threshold, the strike breach — not this rule — remains the only loss exit.",
      calc: {
        expr: "credit × (1 + max_loss_pct)",
        inputs: [{
          key: "credit",
          label: "Credit received",
          unit: "$",
          priced: true,
          clock: "entry"
        }, {
          key: "max_loss_pct",
          token: "max_loss_pct",
          label: "Max-loss %",
          unit: "%"
        }],
        result: v => v.credit * (1 + v.max_loss_pct),
        unit: "$",
        source: "src/social_signals_trader/options_summary.py:279"
      }
    },
    strike_breach_exit: {
      label: "Strike-breach exit",
      short: "A rule that closes the trade automatically if the stock crosses our short strike.",
      long: "This caps how bad a losing trade can get instead of waiting for the theoretical max loss at expiry.",
      calc: {
        expr: "short strike ± (short strike × strike_breach_buffer_pct), put: +, call: −",
        inputs: [{
          key: "short_strike",
          label: "Short strike",
          unit: "$"
        }, {
          key: "strike_breach_buffer_pct",
          label: "Breach buffer %",
          unit: "%"
        }, {
          key: "right",
          label: "Option type",
          unit: "",
          text: true
        }],
        result: v => {
          var buffer = v.short_strike * v.strike_breach_buffer_pct;
          return String(v.right).toLowerCase() === "put" ? v.short_strike + buffer : v.short_strike - buffer;
        },
        unit: "$",
        source: "src/social_signals_trader/options_summary.py:274"
      }
    },
    bull_put_spread: {
      label: "Bull put spread",
      short: "A trade that profits if the stock stays above a certain price.",
      long: "We sell a put at a higher strike and buy a put at a lower strike for protection, collecting credit up front — the bet is the stock stays above the strike we sold.",
      example: "Sell the $255 put, buy the $250 put: we collect credit now and keep it all as long as the stock stays above $255 at expiry."
    },
    bear_call_spread: {
      label: "Bear call spread",
      short: "A trade that profits if the stock stays below a certain price.",
      long: "We sell a call at a lower strike and buy a call at a higher strike for protection, collecting credit up front — the bet is the stock stays below the strike we sold.",
      example: "Sell the $260 call, buy the $265 call: we collect credit now and keep it all as long as the stock stays below $260 at expiry."
    },
    open_pl: {
      label: "Open P/L",
      short: "The paper profit or loss on a position we're still holding.",
      long: "This changes constantly with the stock price and isn't locked in until we close the position.",
      calc: {
        expr: "credit − close cost",
        inputs: [{
          key: "credit",
          label: "Credit received",
          unit: "$",
          priced: true,
          clock: "entry"
        }, {
          key: "close_cost",
          label: "Close cost",
          unit: "$",
          priced: true,
          clock: "quotes"
        }],
        result: v => v.credit - v.close_cost,
        unit: "$",
        source: "src/social_signals_trader/options_summary.py:266"
      }
    },
    realized_pl: {
      label: "Realized P/L",
      short: "The actual profit or loss once a position is closed.",
      long: "Unlike open P/L, this number is final — it's what actually hit the account. Distinct from open P/L, which is still a paper mark that moves with the quote.",
      example: "We collected $360 credit and paid $90 to close it — realized P/L is +$270, and it doesn't change again after that.",
      calc: {
        expr: "credit received − exit cost",
        inputs: [{
          key: "credit_received",
          label: "Credit received",
          unit: "$",
          priced: true,
          clock: "entry"
        }, {
          key: "exit_cost",
          label: "Exit cost",
          unit: "$",
          priced: true,
          clock: "entry"
        }],
        result: v => v.credit_received - v.exit_cost,
        unit: "$",
        source: "src/social_signals_trader/spread_trader.py:1462"
      }
    },
    decay: {
      label: "Decay",
      short: "The steady loss of an option's time value as expiry approaches.",
      long: "All else equal, an option is worth less tomorrow than today simply because there's less time left for the stock to move — this is what theta measures.",
      example: "An option worth $2.10 today with theta of −$0.05 is worth roughly $2.05 tomorrow if the stock and IV don't move at all."
    },
    deployment: {
      label: "Deployment",
      short: "How much of the account's available capital is currently committed to open trades.",
      long: "Low deployment means most of the account is sitting in cash rather than at risk in a position.",
      calc: {
        expr: "(spread risk + stock value) ÷ equity",
        inputs: [{
          key: "spread_risk",
          label: "Spread risk (sum of open max loss)",
          unit: "$"
        }, {
          key: "stock_value",
          label: "Stock market value",
          unit: "$"
        }, {
          key: "equity",
          label: "Equity",
          unit: "$",
          priced: true,
          clock: "quotes"
        }],
        result: v => v.equity ? (v.spread_risk + v.stock_value) / v.equity : null,
        unit: "%",
        source: "src/social_signals_trader/spread_trader.py:517"
      }
    },
    wide_quote: {
      label: "Wide quote / low confidence",
      short: "The buy and sell prices for this option are far apart, so the 'real' price is uncertain.",
      long: "A wide bid-ask spread usually means this option is thinly traded — any single quote should be trusted less, and fills may be worse than the quoted mid-price.",
      calc: {
        expr: "(ask − bid) ÷ mid — flagged wide above a 25% threshold",
        inputs: [{
          key: "bid",
          label: "Bid",
          unit: "$",
          priced: true,
          clock: "quotes"
        }, {
          key: "ask",
          label: "Ask",
          unit: "$",
          priced: true,
          clock: "quotes"
        }],
        result: v => v.ask + v.bid ? (v.ask - v.bid) / ((v.ask + v.bid) / 2) : null,
        unit: "%",
        source: "src/social_signals_trader/options_summary.py:183"
      }
    },
    variance_risk_premium: {
      label: "Variance risk premium (beta)",
      short: "The gap between what the market expected a stock to move and how much it actually moved — a rough gauge of whether options are rich or cheap.",
      long: "This is a beta metric: it compares implied volatility (the market's forecast) against realized volatility (what actually happened) after the fact. A consistently positive gap suggests option sellers are being overpaid for the risk they take on.",
      calc: {
        expr: "implied vol − realized vol (a beta estimate over closed trades, not an exact per-trade identity)",
        inputs: [{
          key: "avg_implied_vol",
          label: "Avg. implied vol at entry",
          unit: "%"
        }, {
          key: "avg_realized_vol",
          label: "Avg. realized vol over the hold",
          unit: "%"
        }],
        result: v => v.avg_implied_vol - v.avg_realized_vol,
        unit: "%",
        source: "src/social_signals_trader/beta.py:462"
      }
    },
    risk_reward: {
      label: "Risk:reward",
      short: "How many dollars are risked for every dollar of potential profit.",
      long: "Credit spreads typically show an unfavorable-looking ratio here on purpose — they're high-probability, capped-reward trades, so a small, likely win is being weighed against a larger, unlikely loss.",
      calc: {
        expr: "max loss ÷ max gain",
        inputs: [{
          key: "max_loss",
          label: "Max loss",
          unit: "$",
          priced: true,
          clock: "entry"
        }, {
          key: "max_gain",
          label: "Max gain",
          unit: "$",
          priced: true,
          clock: "entry"
        }],
        result: v => v.max_gain ? v.max_loss / v.max_gain : null,
        unit: "",
        source: "src/social_signals_trader/options_summary.py:250"
      }
    },
    exit_cost: {
      label: "Exit cost",
      short: "What it cost to buy back the spread and close the position.",
      long: "This is the debit paid to close a spread that was originally sold for a credit. The trade's real profit or loss is the credit received minus this cost.",
      example: "We collected $360 to open the spread and paid $90 to close it — exit cost is $90, and realized P/L is $360 − $90 = $270."
    },
    spot_at_entry: {
      label: "Spot at entry",
      short: "The stock's price at the moment we opened the trade.",
      long: "Used as the reference point for how far the stock has moved since entry.",
      example: "If the stock was $270.50 the moment we opened the trade, that's spot at entry — even if it's since moved to $265."
    },
    credit_per_contract: {
      label: "Credit per contract",
      short: "The premium collected per single spread contract.",
      long: "Multiply by the number of contracts to get the total credit received.",
      calc: {
        expr: "credit ÷ contracts",
        inputs: [{
          key: "credit",
          label: "Credit received",
          unit: "$",
          priced: true,
          clock: "entry"
        }, {
          key: "contracts",
          label: "Contracts",
          unit: ""
        }],
        result: v => v.contracts ? v.credit / v.contracts : null,
        unit: "$",
        source: "src/social_signals_trader/spread_trader.py:1415"
      }
    },
    fill_state: {
      label: "Fill state",
      short: "Whether the broker filled none, some, or all of the contracts.",
      long: "FILLED means the whole order went through, PARTIAL means only some contracts filled, and UNFILLED/QUEUED means none have yet.",
      example: "An order for 3 contracts where only 2 filled shows PARTIAL, not FILLED."
    },
    reason: {
      label: "Reason",
      short: "Why the position was opened or closed.",
      long: "A short internal tag describing the trigger — for example a strike breach, a profit target being hit, or a time-stop.",
      example: "A row tagged strike_breach means the exit fired because the stock crossed the short strike, not because the profit target was hit."
    },
    order_id: {
      label: "Order id",
      short: "The broker's identifier for this order.",
      long: "Useful for looking this order up directly in the Alpaca dashboard or API.",
      example: "An order id like 6b1e2c4a-... can be pasted straight into the Alpaca dashboard's order search."
    },
    broker_order_status: {
      label: "Broker order status",
      short: "The broker's own status label for this order.",
      long: "Reported directly by Alpaca, independent of the fill-state label shown next to it.",
      example: "A row can show broker status 'accepted' while our own fill-state label still reads UNFILLED — the broker has the order but hasn't matched it yet."
    },
    broker_limit_price: {
      label: "Broker limit price",
      short: "The most we were willing to pay or accept per share for the fill.",
      long: "The order won't fill at a worse price than this, though it may fill better.",
      example: "A broker limit price of −$1.20 (credit) means we accept any fill at a credit of $1.20/share or better, but never a worse one."
    },
    time_in_force: {
      label: "Time in force",
      short: "How long the order stays working before the broker cancels it.",
      long: "Common values are DAY (cancels at market close) and GTC (stays open until filled or cancelled).",
      example: "A DAY order placed at 10am that hasn't filled by the 4pm close is automatically cancelled."
    },
    submitted_at: {
      label: "Submitted at",
      short: "When the order was sent to the broker.",
      long: "Timestamped the moment we transmitted the order, not when it filled.",
      example: "An order submitted at 9:31 AM PT may not fill until 9:34 AM PT — submitted_at is the earlier timestamp."
    },
    filled_at: {
      label: "Filled at",
      short: "When the broker completed the fill.",
      long: "May be seconds or minutes after submission, depending on how much liquidity was available.",
      example: "An order submitted at 9:31 AM PT that fills at 9:34 AM PT shows filled_at as 9:34 AM PT."
    },
    spot: {
      label: "Spot",
      short: "The stock's current live price.",
      long: "Not the strike, not the entry price — this is where the underlying is trading right now, which is what cushion and band are measured against.",
      example: "If the ticker is trading at $268.40 right now, that's spot — regardless of what it was at entry or what the strike is."
    },
    equity: {
      label: "Equity",
      short: "The total value of the account — cash plus everything held, marked to market.",
      long: "This is the number that moves day to day as positions gain or lose value; it's what performance is measured against.",
      example: "$40,000 cash plus $10,000 of open-position value marks equity at $50,000, even with no positions closed today."
    },
    cash: {
      label: "Cash",
      short: "The uninvested dollars sitting in the account, not committed to any open position.",
      long: "Selling a credit spread ties up collateral (max loss) against this cash, but the credit received is added to it immediately.",
      example: "Selling a spread for $360 credit against $1,140 of max-loss collateral adds $360 to cash while reserving $1,140 of buying power against it."
    },
    close_cost: {
      label: "Close cost",
      short: "What it would cost right now to buy back this spread and close it out.",
      long: "Compared against the credit we originally received, this is how we know how much of the max profit we've already captured.",
      calc: {
        expr: "min((short ask − long bid) × 100, width × 100) × contracts",
        inputs: [{
          key: "short_ask",
          label: "Short-leg ask",
          unit: "$",
          priced: true,
          clock: "quotes"
        }, {
          key: "long_bid",
          label: "Long-leg bid",
          unit: "$",
          priced: true,
          clock: "quotes"
        }, {
          key: "width",
          label: "Spread width",
          unit: "$"
        }, {
          key: "contracts",
          label: "Contracts",
          unit: ""
        }],
        result: v => Math.min((v.short_ask - v.long_bid) * 100, v.width * 100) * v.contracts,
        unit: "$",
        source: "src/social_signals_trader/options_summary.py:257-262"
      }
    },
    unpaired_leg: {
      label: "Unpaired leg",
      short: "An option leg on the books with no matching spread partner.",
      long: "Normally every short leg has a long leg protecting it (or vice versa); an unpaired leg usually means a data gap or a position that didn't close cleanly, and is worth a second look.",
      example: "A short $255 put on the books with no matching long put nearby shows up as an unpaired leg — worth checking for a broken close."
    },
    spread: {
      label: "Spread",
      short: "The two-option combo — one sold, one bought — that makes up this trade.",
      long: "Selling the short leg brings in the credit; buying the long leg caps the risk. Together they define one defined-risk position.",
      example: "Selling the $255 put and buying the $250 put together is one spread — a $5-wide bull put spread."
    },
    frozen_entry: {
      label: "Frozen entry",
      short: "The fill time, price, and credit exactly as they were the moment this trade opened.",
      long: "This never updates — it's the historical snapshot, kept alongside the live/now columns so you can see how far the trade has moved since it opened.",
      example: "A trade filled at 10:02 AM PT for $1.20/contract keeps that fill time and price in frozen_entry forever, even after the market moves."
    },
    min_net_credit: {
      label: "Min net credit",
      short: "The unconditional floor — a spread that cannot net a real, positive credit is refused before it ever reaches the broker.",
      long: "Checked against the exact price about to be submitted (the limit price), not just the earlier scan estimate, and enforced a second time at the final choke point right before the order is built. A missing/unmeasurable credit is refused the same as a non-positive one. A fill that somehow still comes in at or below this floor pages the operator and is logged as a rule break.",
      example: "INTC 88/87 on 2026-08-12 scored a +$364 credit but reconciled at a filled credit of -$84 — this floor now refuses that candidate before submission instead of letting the broker fill it as a debit."
    },
    min_credit: {
      label: "Min credit",
      short: "The smallest credit we'll accept to bother opening a trade.",
      long: "Below this, commissions and slippage eat too much of the potential profit for the trade to be worth putting on.",
      example: "With min_credit set to $0.20, a candidate that only offers $0.12/contract is rejected before it's ever scored."
    },
    min_credit_breakeven_multiple: {
      label: "Min breakeven multiple",
      short: "The binding credit gate — credit must beat the spread's own breakeven credit by this margin.",
      long: "A flat dollar floor (min_credit) accepts any width/PoP combination, which let spreads through that needed far more than $5 to break even. This scales the floor with the spread's own odds: credit_per_contract must be at least this multiple of (1 − pop) × width × 100, the breakeven credit. 0 = off, leaving only the absolute min_credit floor.",
      calc: {
        expr: "min_credit_breakeven_multiple × (1 − pop) × width × 100",
        inputs: [{
          key: "min_credit_breakeven_multiple",
          label: "Min breakeven multiple",
          unit: ""
        }, {
          key: "pop",
          label: "PoP (win probability)",
          unit: "%"
        }, {
          key: "width",
          label: "Spread width",
          unit: "$"
        }],
        result: v => v.min_credit_breakeven_multiple * (1 - v.pop) * v.width * 100,
        unit: "$",
        source: "src/social_signals_trader/spread_trader.py:117,402"
      }
    },
    ann_yield: {
      label: "Annualized yield floor",
      short: "The minimum credit-per-day-of-risk, scaled up to a yearly rate, required to enter.",
      long: "Set too high, this filter mechanically forces very short-dated (1-DTE) trades, since those show the richest annualized numbers — which is why it's often left off.",
      calc: {
        expr: "(credit ÷ max loss) × (365 ÷ DTE) — the code annualizes by calendar days, not trading days",
        inputs: [{
          key: "credit",
          label: "Credit received",
          unit: "$",
          priced: true,
          clock: "entry"
        }, {
          key: "max_loss",
          label: "Max loss",
          unit: "$",
          priced: true,
          clock: "entry"
        }, {
          key: "dte",
          label: "DTE",
          unit: ""
        }],
        result: v => v.max_loss > 0 && v.dte > 0 ? v.credit / v.max_loss * (365 / v.dte) : null,
        unit: "%",
        source: "src/social_signals_trader/options_chain.py:214-217"
      }
    },
    max_positions: {
      label: "Max positions",
      short: "The most open spreads the book will hold across every ticker at once.",
      long: "A book-wide ceiling, independent of how much capital each individual position risks.",
      example: "With max_positions set to 12, an entry scan that finds a 13th attractive setup skips it until something else closes."
    },
    max_total_risk: {
      label: "Max total risk",
      short: "The most capital the whole book is allowed to have on the line at once, across every open spread — scaled to live equity, not a fixed dollar figure.",
      long: "Each new trade's max loss counts against this ceiling — once it's hit, no new positions open even if individual position limits allow it. Expressed as a multiple of equity so it can't drift above the account's own size the way a fixed dollar cap can.",
      calc: {
        expr: "equity × max_total_risk_equity_multiple",
        inputs: [{
          key: "equity",
          label: "Equity",
          unit: "$",
          priced: true,
          clock: "quotes"
        }, {
          key: "max_total_risk_equity_multiple",
          label: "Equity multiple",
          unit: ""
        }],
        result: v => v.equity * v.max_total_risk_equity_multiple,
        unit: "$",
        source: "src/social_signals_trader/spread_trader.py:515"
      }
    },
    max_per_underlying: {
      label: "Max per underlying",
      short: "The most open spreads allowed on a single stock at the same time.",
      long: "Keeps the book from concentrating too much risk in one name, even if that name keeps generating attractive-looking setups.",
      example: "With max_per_underlying set to 2, a third attractive setup on the same ticker is skipped even though the book-wide max_positions cap has room.",
      calc: {
        expr: "at most max_per_underlying open spreads allowed on one underlying at a time",
        inputs: [{
          key: "max_per_underlying",
          token: "max_per_underlying",
          label: "Max per underlying",
          unit: ""
        }],
        result: v => v.max_per_underlying,
        unit: "",
        source: "src/social_signals_trader/spread_trader.py:170"
      }
    },
    min_pop: {
      label: "Min PoP requirement",
      short: "The lowest win-probability estimate a candidate needs to even be considered.",
      long: "A floor on PoP (see PoP / win probability) — candidates estimated below this are never scored, no matter how much credit they'd pay.",
      calc: {
        expr: "candidate pop must be >= min pop to enter",
        inputs: [{
          key: "min_pop",
          label: "Min PoP",
          unit: "%"
        }],
        result: v => v.min_pop,
        unit: "%",
        source: "src/social_signals_trader/spread_trader.py:69"
      }
    },
    max_short_delta: {
      label: "Max short-leg delta",
      short: "The most aggressive (highest-delta) short strike the strategy will sell.",
      long: "A ceiling on short-leg delta (see Short-leg delta) — candidates whose short strike prices in more risk than this are skipped.",
      calc: {
        expr: "|candidate short delta| must be <= max short delta to enter",
        inputs: [{
          key: "max_short_delta",
          label: "Max short delta",
          unit: ""
        }],
        result: v => v.max_short_delta,
        unit: "",
        source: "src/social_signals_trader/spread_trader.py:61"
      }
    },
    margin_buffer_pct: {
      label: "Margin buffer",
      short: "How much of equity is kept as broker-margin cushion — new entries are refused once maintenance margin plus the order's own risk would eat into it.",
      long: "The only sizing cap denominated in the broker's own maintenance-margin figure rather than the sleeve's internal risk accounting. Read fresh from the broker every tick, so a stale equity or margin reading can never mask a breach.",
      calc: {
        expr: "maintenance margin ÷ equity, compared against the configured margin_buffer_pct",
        inputs: [{
          key: "maintenance_margin",
          label: "Maintenance margin",
          unit: "$",
          priced: true,
          clock: "quotes"
        }, {
          key: "equity",
          label: "Equity",
          unit: "$",
          priced: true,
          clock: "quotes"
        }],
        result: v => v.equity ? v.maintenance_margin / v.equity : null,
        unit: "%",
        source: "src/social_signals_trader/spread_trader.py:523"
      }
    },
    max_expiry_concentration_pct: {
      label: "Max expiry concentration",
      short: "The most of total book risk any single expiry date is allowed to hold.",
      long: "Existing open positions plus everything already chosen this batch count against this cap for whichever expiry they land on. Guards against a single gap-through event on one date — e.g. an earnings surprise landing on a Friday where a third of the book expires — costing far more than any one underlying could on its own. 0 = off.",
      calc: {
        expr: "risk on one expiry ÷ total book risk, compared against max_expiry_concentration_pct",
        inputs: [{
          key: "expiry_risk",
          label: "Risk on this expiry",
          unit: "$",
          priced: true,
          clock: "quotes"
        }, {
          key: "total_book_risk",
          label: "Total book risk",
          unit: "$",
          priced: true,
          clock: "quotes"
        }],
        result: v => v.total_book_risk ? v.expiry_risk / v.total_book_risk : null,
        unit: "%",
        source: "src/social_signals_trader/spread_trader.py:178,688"
      }
    },
    target_invested_pct: {
      label: "Target deployment",
      short: "The share of account equity the sleeve tries to keep deployed as collateral.",
      long: "Premium selling earns nothing on idle cash, so this is the deployment the sleeve fills toward — subject to the beta gate floor while beta is unmeasured, and it's a target, not the max_total_risk_equity_multiple backstop above it (see Max total risk).",
      calc: {
        expr: "equity × target_invested_pct",
        inputs: [{
          key: "equity",
          label: "Equity",
          unit: "$",
          priced: true,
          clock: "quotes"
        }, {
          key: "target_invested_pct",
          label: "Target deployment",
          unit: ""
        }],
        result: v => v.equity * v.target_invested_pct,
        unit: "$",
        source: "src/social_signals_trader/spread_trader.py:191,545"
      }
    },
    beta_gate_floor_pct: {
      label: "Beta gate floor",
      short: "The deployment ceiling used while realized-vs-delta-implied beta is unmeasured.",
      long: "target_invested_pct is not applied directly — it's capped by the measured beta until the realized-vs-delta-implied breach rate has an adequate sample (beta_min_sample closed positions). This is that cap while unmeasured, or while a measured beta shows no edge (>= 1.0): deliberately well below target_invested_pct so the book can't scale on an assumption that hasn't been checked against real outcomes.",
      calc: {
        expr: "deployment capped at beta_gate_floor_pct until beta is measured with an adequate sample",
        inputs: [{
          key: "beta_gate_floor_pct",
          label: "Beta gate floor",
          unit: ""
        }],
        result: v => v.beta_gate_floor_pct,
        unit: "%",
        source: "src/social_signals_trader/spread_trader.py:206; src/social_signals_trader/beta.py:379"
      }
    },
    hold_to_expiry: {
      label: "Hold to expiry",
      short: "Whether this strategy lets trades run all the way to expiration instead of closing them early.",
      long: "When true, the profit-target exit is not used and the trade is only closed at expiry (or on assignment) or on a strike breach. Default is false as of the 2026-08-08 directive: winners are bought back once profit_target_pct of max profit is captured, so capital rotates into fresh positions instead of sitting through the highest-gamma stretch for the last slice of credit.",
      example: "With hold_to_expiry false and profit_target_pct at 50%, a trade that has captured 50% of its entry credit is closed immediately rather than held for the rest of the credit."
    },
    strike_breach_buffer: {
      label: "Strike-breach buffer",
      short: "How much room past the strike the stock gets before the strike-breach exit actually fires.",
      long: "A small buffer avoids getting stopped out by a brief, noisy tick through the strike that reverses a moment later.",
      example: "With a 1% buffer on a $255 short put, the stock has to trade below about $252.45 before the strike-breach exit fires — not the instant it dips under $255.",
      calc: {
        expr: "short strike × strike breach buffer pct = buffer distance from the strike",
        inputs: [{
          key: "short_strike",
          label: "Short strike",
          unit: "$"
        }, {
          key: "strike_breach_buffer_pct",
          label: "Breach buffer %",
          unit: "%"
        }],
        result: v => v.short_strike * v.strike_breach_buffer_pct,
        unit: "$",
        source: "src/social_signals_trader/spread_trader.py:1385"
      }
    },
    live_flag: {
      label: "Live",
      short: "Whether this strategy is currently allowed to place real orders, as opposed to being paused.",
      long: "When false, the strategy can still be evaluated and logged, but it won't submit anything to the broker.",
      example: "A strategy with live=false still scores and logs candidates every tick, but every order it would have placed is logged as dry_run instead of submitted."
    },
    provenance: {
      label: "Provenance",
      short: "Where this summary's numbers came from and how fresh they are.",
      long: "Includes when the underlying record was generated, how old the option quotes are, and what the previous snapshot looked like — the receipts behind every number above.",
      example: "A record generated at 9:35 AM PT with quotes stamped 9:34 AM PT has a provenance block showing ~1 minute of quote age."
    },
    analyst: {
      label: "Analyst",
      short: "The voice that reads the book and writes an opinion on a schedule.",
      long: "Runs the options-status-refresh-summary cron on its own published schedule (pre-open plus four more times through the weekday session) and re-derives Positions, Where the book stands, What we think right now, Action queue, and Provenance wholesale each time. It never places an order.",
      example: "A card stamped \"ANALYST · updated 2:00 PM PDT · every 2h\" is the Analyst's most recent read, not a live number."
    },
    trader: {
      label: "Trader",
      short: "The voice that decides and acts, on its own 15-minute tick.",
      long: "trader-tick.sh wakes every 15 minutes and decides from three inputs: the Analyst's latest read, any User comments filed since its last tick, and the frozen fund rules in force at the time — never re-reading rules live. Proposed trades, the Trade Log, Expiry ladder, Open Orders, and Rules in force are all Trader-authored or Trader-executed.",
      example: "A comment left on a proposal at 2:07 PM PDT is read by the Trader at its next tick, at or after 2:15 PM PDT."
    },
    user: {
      label: "User",
      short: "The voice that comments in public on a proposal or a card.",
      long: "Anyone reading the page can leave feedback on a Proposed trade or any other card; that comment is the instruction the Trader reads on its next tick — the User never places an order directly.",
      example: "A comment on a proposal's discussion thread is the User's only lever over what the Trader does next."
    },
    positions_count: {
      label: "Positions",
      short: "How many open spreads share this expiration date.",
      long: "Grouping by expiry shows how much risk rolls off the book on a given day, rather than trickling out one position at a time.",
      calc: {
        expr: "count of open spreads whose expiry matches this row",
        inputs: [{
          key: "positions_count",
          label: "Open positions on this expiry",
          unit: ""
        }],
        result: v => v.positions_count,
        unit: "",
        source: "dashboard/panels/options-trade-log.jsx:376"
      }
    },
    risk_rolling_off: {
      label: "Risk rolling off",
      short: "The total max loss across every spread that expires on this date.",
      long: "Once these positions expire (or are closed), this much capital-at-risk comes off the book, whether the trades won or lost.",
      calc: {
        expr: "Σ max loss across every open spread sharing this expiry",
        inputs: [{
          key: "risk_rolling_off",
          label: "Total max loss on this expiry",
          unit: "$"
        }],
        result: v => v.risk_rolling_off,
        unit: "$",
        source: "dashboard/panels/options-trade-log.jsx:377"
      }
    },
    trade_event: {
      label: "Event",
      short: "Whether this row opened the position (OPEN) or closed it out (CLOSE).",
      long: "A spread usually appears as two rows over its life — one to open it, one to close it — unless it's still open, in which case only the OPEN row exists so far.",
      example: "A spread opened on Monday and closed on Friday shows two rows — one OPEN, one CLOSE; a spread still open only has the OPEN row."
    },
    limit_price: {
      label: "Limit",
      short: "The price we told the broker we're willing to accept — the order won't fill worse than this.",
      long: "For a credit spread this is a minimum credit to receive; the order sits unfilled until the market offers at least that much.",
      example: "A limit of $1.20 credit means the order only fills at $1.20/contract or a better (higher) credit — never worse."
    },
    total_credit: {
      label: "Total credit received (open book)",
      short: "The sum of credit collected across every open spread right now.",
      long: "Adds each open position's own credit received into one book-wide figure.",
      calc: {
        expr: "sum of credit received across count open spreads",
        inputs: [{
          key: "count",
          label: "Open spreads",
          unit: ""
        }, {
          key: "total",
          label: "Total credit received",
          unit: "$",
          priced: true,
          clock: "entry"
        }],
        result: v => v.total,
        unit: "$",
        source: "src/social_signals_trader/options_summary.py:223"
      }
    },
    total_open_pl: {
      label: "Total open P/L (open book)",
      short: "The combined paper profit or loss across every open spread right now.",
      long: "Adds each open position's own open P/L into one book-wide figure — it moves with live quotes.",
      calc: {
        expr: "sum of open P/L across count open spreads",
        inputs: [{
          key: "count",
          label: "Open spreads",
          unit: ""
        }, {
          key: "total",
          label: "Total open P/L",
          unit: "$",
          priced: true,
          clock: "quotes"
        }],
        result: v => v.total,
        unit: "$",
        source: "src/social_signals_trader/options_summary.py:266"
      }
    },
    total_max_loss: {
      label: "Total max loss (open book)",
      short: "The combined worst-case loss across every open spread right now.",
      long: "Adds each open position's own max loss — capped and known per position — into one book-wide figure.",
      calc: {
        expr: "sum of max loss across count open spreads",
        inputs: [{
          key: "count",
          label: "Open spreads",
          unit: ""
        }, {
          key: "total",
          label: "Total max loss",
          unit: "$",
          priced: true,
          clock: "entry"
        }],
        result: v => v.total,
        unit: "$",
        source: "src/social_signals_trader/options_summary.py:250"
      }
    },
    tif: {
      label: "TIF",
      short: "Short for 'time in force' — how long this order stays active before it's automatically cancelled.",
      long: "A common value is DAY, meaning the order cancels itself at the end of the trading session if it hasn't filled.",
      example: "A DAY order placed at 3:55 PM PT that hasn't filled by the 4:00 PM PT close is cancelled automatically."
    },
    trade_status_filter: {
      label: "Status filter",
      short: "Shows only Trade Log rows in the selected lifecycle state — Open, Closed, or Expired.",
      long: "Open = still held (an OPEN row with no matching CLOSE, expiry still ahead). Closed = a round trip we exited ourselves — a CLOSE row exists. Expired = fully filled at entry but the contract's own expiry date has already passed with no CLOSE ever logged, so it rolled off worthless rather than being actively closed.",
      example: "7 spreads still held show under Open; a spread we bought back on Tuesday shows under Closed even though its OPEN row is still in the table."
    },
    trade_log_group_by: {
      label: "Group by",
      short: "Clusters Trade Log rows into labeled sections instead of one flat list.",
      long: "Status groups by Open/Closed/Expired, Ticker groups by underlying symbol, Expiry groups by the contract's expiration date (rows with no resolvable expiry land in a trailing Unknown expiry group). Each group header shows its row count and summed realized P&L.",
      example: "Grouping by Ticker turns a 40-row flat log into one section per symbol, each with its own trade count and realized P&L subtotal."
    },
    trade_log_pagination: {
      label: "Pagination",
      short: "Pages the Trade Log's already-sorted, already-filtered rows client-side, 10 per page by default.",
      long: "The status filter and Group by selection apply before pagination, so a page always shows a slice of the same set the panel-head stats and filter counts describe — never a different total. First/Prev/Next/Last move between pages; the page-size selector offers 10/20/50/100/All. Changing the filter, the grouping, or the page size resets you to page 1.",
      example: "26 filtered trades at 10/page shows 'Page 1 of 3'; switching Rows per page to All shows all 26 rows on 'Page 1 of 1'."
    },
    armed: {
      label: "Armed",
      short: "A position whose percent-of-credit threshold (profit target or max loss) has been reached and is eligible to close right now.",
      long: "Armed rows are the ones the executor will actually act on next tick — everything else in the Action queue is context, not an instruction. A row that would otherwise be Armed moves to Can't trust instead the moment its mark-suspect clamp makes the close price untrustworthy.",
      calc: {
        expr: "pct_captured ≤ −max_loss_pct  OR  pct_captured ≥ profit_target_pct",
        inputs: [{
          key: "pct_captured",
          label: "% captured",
          unit: "%",
          priced: true,
          clock: "quotes"
        }, {
          key: "max_loss_pct",
          label: "Max-loss %",
          unit: "%"
        }, {
          key: "profit_target_pct",
          label: "Profit-target %",
          unit: "%"
        }],
        result: v => v.pct_captured <= -v.max_loss_pct || v.pct_captured >= v.profit_target_pct ? 1 : 0,
        unit: "",
        source: "src/social_signals_trader/options_summary_render.py:546"
      }
    },
    suppressed_exit: {
      label: "Suppressed exit",
      short: "An exit that would otherwise fire (profit target or max loss reached) but is held back because the close price can't be trusted.",
      long: "This happens when the position's mark-suspect clamp is active — the quoted close cost is arithmetically impossible, so acting on it could realize a false profit or loss. The row stays visible under Can't trust rather than disappearing, so nothing gets silently skipped.",
      example: "A put credit spread quoted to close at $612 against a $600 structural max value is clamped: the max-loss trigger would otherwise fire, but the close is suppressed until a trustworthy quote arrives."
    },
    mark_suspect: {
      label: "Mark suspect",
      short: "A flag on a position whose quoted close cost is above the spread's own structural maximum value — arithmetically impossible for a defined-risk spread.",
      long: "A credit spread can never cost more to close than its own width × 100 × contracts (the structural max value) — if the quoted mid crosses that, the quote itself is broken (a stale or crossed wide-leg book), not the position. Any exit driven by that mark is suppressed rather than acted on.",
      calc: {
        expr: "raw close cost > width × 100 × contracts",
        inputs: [{
          key: "raw_close_cost",
          label: "Raw close cost",
          unit: "$",
          priced: true,
          clock: "quotes"
        }, {
          key: "width",
          label: "Spread width",
          unit: "$"
        }, {
          key: "contracts",
          label: "Contracts",
          unit: ""
        }],
        result: v => v.raw_close_cost > v.width * 100 * v.contracts ? 1 : 0,
        unit: "",
        source: "src/social_signals_trader/options_summary.py:266"
      }
    },
    at_stake: {
      label: "Total at stake",
      short: "The sum of open P/L across every Armed row — the dollar amount that changes if the executor's next tick fires each eligible close.",
      long: "Rows in Watching or Can't trust aren't counted here — this is specifically what today's armed exits are worth, not the book's total exposure.",
      calc: {
        expr: "sum of |open P/L| across armed rows",
        inputs: [{
          key: "count",
          label: "Armed rows",
          unit: ""
        }, {
          key: "total",
          label: "Total at stake",
          unit: "$",
          priced: true,
          clock: "quotes"
        }],
        result: v => v.total,
        unit: "$",
        source: "src/social_signals_trader/options_summary_render.py:597"
      }
    },
    unpriceable: {
      label: "Unpriceable",
      short: "A position whose leg quotes are wide enough that the numbers shown for it are indicative only, not trustworthy.",
      long: "Same underlying signal as the wide-quote flag on a single row, rolled up to a book-wide count in the Can't trust group — every unpriceable position is also wide-quoted, but this line exists so the count is visible without opening each row.",
      example: "3 positions flagged unpriceable because a short or long leg's bid-ask spread is over the 25% wide-quote threshold — their P/L and cushion figures are directional only until a tighter quote arrives."
    },
    feedback_thread: {
      label: "Feedback thread",
      short: "One conversation about this trade — every message from the visitor and every reply from the fund, in order, each labelled with who said it.",
      long: "Each submission opens its own thread, so two questions about the same trade stay two conversations and an answer can never land under the wrong one. A thread is a back-and-forth: “Visitor” messages are what was asked or followed up with, “Trading agent” messages are the fund's replies — both render in the order they happened. The status pill reads awaiting reply until the fund answers, then answered; a stale thread the fund has retired is marked archived but stays visible here. A conversation follows the trade itself, not just one page of it: a question asked while the trade was still a proposal keeps showing — with an “asked while proposed” chip — once that proposal fills and becomes a position, and again once it lands in the trade log (“asked while open” / “asked on the trade log”), all interleaved by time on every one of those three surfaces.",
      example: "Visitor asks “why did you close BABA early?” on Aug 9 at 1:35 PM PDT; Trading agent replies Aug 9 at 4:02 PM PDT in the same thread, so the card reads “2 messages” — a separate question about the credit shown at entry opens its own thread below it."
    },
    system_feedback: {
      label: "Feedback on the site",
      short: "Feedback filed against a card or the page itself rather than against a trade — collected here at the bottom of the Options Log.",
      long: "The \u{1F4AC} button in a card's header files feedback about that card (how it reads, what's missing, a number that looks wrong). That's a note about the site, so it is deliberately kept off the trade pages and pooled here. Each item is the same visitor/agent conversation as a trade thread — public, attributed, and ordered by time — with a pill showing awaiting reply, answered, or archived.",
      example: "\"The cushion column wraps on mobile\" filed against the Positions card on Aug 9 shows up in this block, tagged Positions — not under any single spread."
    },
    position_feedback_indicator: {
      label: "Feedback on this position",
      short: "This row already has at least one question or comment filed against it.",
      long: "Click it to jump to where the discussion and any reply live — the matching trade's own page (its “Questions & feedback on this trade” section) when this position has one, or wherever this row's feedback surfaces otherwise. A count with an exclamation mark means at least one thread is still awaiting a reply.",
      example: "\"2!\" on the BABA 143/144 row means two threads are filed against this spread and at least one hasn't been answered yet."
    }
  };
  function normalizeTerm(term) {
    if (!term) return null;
    return String(term).trim().toLowerCase().replace(/[\s-]+/g, "_");
  }
  function get(term) {
    return TERMS[normalizeTerm(term)] || null;
  }
  var React = window.React;
  var SF = window.SpreadFormat;
  var activeCloser = null;

  // A priced calc value that isn't stamped goes stale invisibly — this
  // mirrors options-summary.jsx's REFRESH_INTERVAL_MINUTES=120 (*2 grace)
  // convention so a calc block flags the same staleness the panel does.
  var DEFAULT_STALE_AFTER_MS = 4 * 60 * 60 * 1000;
  function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  function formatByUnit(value, unit) {
    if (value == null || !Number.isFinite(Number(value))) return "—";
    var n = Number(value);
    if (unit === "$") return SF ? SF.money(n) : `$${n}`;
    if (unit === "%") return SF ? SF.pctv(n) : `${(n * 100).toFixed(1)}%`;
    if (unit === "px") return `${n}px`;
    return n.toLocaleString(undefined, {
      maximumFractionDigits: 2
    });
  }
  function formatInputValue(inputSpec, value) {
    if (inputSpec.text) return value == null ? "—" : String(value).toUpperCase();
    return formatByUnit(value, inputSpec.unit);
  }
  function inputPresent(inputSpec, value) {
    if (value == null) return false;
    if (inputSpec.text) return String(value).length > 0;
    return Number.isFinite(Number(value));
  }
  function substituteExpr(expr, calcInputs, inputs) {
    var out = expr;
    calcInputs.forEach(inputSpec => {
      var token = inputSpec.token || inputSpec.key.replace(/_/g, " ");
      var formatted = formatInputValue(inputSpec, inputs[inputSpec.key]);
      out = out.replace(new RegExp(escapeRegExp(token), "gi"), formatted);
    });
    return out;
  }

  // Two clocks, never conflated: fill-derived values (credit, entry prices)
  // are historical facts stamped with the fill time; live-quote-derived
  // values (close cost, spot, ...) are stamped with the quote time. A calc
  // that mixes both prints one as-of line per clock.
  var CLOCK_LABEL = {
    entry: "entry fill",
    quotes: "quotes"
  };
  function formatAsOfTime(iso) {
    var d = new Date(iso);
    if (!iso || Number.isNaN(d.getTime())) return null;
    var timePart = d.toLocaleTimeString("en-US", {
      timeZone: "America/Los_Angeles",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short"
    });
    var datePart = d.toLocaleDateString("en-US", {
      timeZone: "America/Los_Angeles",
      month: "short",
      day: "numeric"
    });
    return {
      text: `${timePart}, ${datePart}`,
      ms: d.getTime()
    };
  }
  function relativeAge(ms) {
    var delta = Math.abs(Date.now() - ms);
    var m = delta / 60000;
    if (m < 1) return "just now";
    if (m < 60) return `~${Math.round(m)}m old`;
    var h = m / 60;
    if (h < 48) return `~${Math.round(h)}h old`;
    return `~${Math.round(h / 24)}d old`;
  }
  function asOfLine(clock, asOf, staleAfterMs, key) {
    var iso = asOf ? asOf[clock] : null;
    var label = CLOCK_LABEL[clock] || clock;
    if (!iso) {
      return React.createElement("span", {
        className: "help-tip-calc-asof",
        key
      }, `Price time unavailable (${label})`);
    }
    var t = formatAsOfTime(iso);
    if (!t) {
      return React.createElement("span", {
        className: "help-tip-calc-asof",
        key
      }, `Price time unavailable (${label})`);
    }
    var stale = Date.now() - t.ms > staleAfterMs;
    return React.createElement("span", {
      className: stale ? "help-tip-calc-asof help-tip-calc-asof--stale" : "help-tip-calc-asof",
      key
    }, `${stale ? "⚠ " : ""}Prices as of ${t.text} (${label}) — ${relativeAge(t.ms)}`);
  }
  function renderCalcBlock(calc, props) {
    var inputs = props.inputs || {};
    var presentSpecs = calc.inputs.filter(spec => inputPresent(spec, inputs[spec.key]));
    var allPresent = presentSpecs.length === calc.inputs.length;
    var elements = [React.createElement("span", {
      className: "help-tip-calc-title",
      key: "title"
    }, "How we got this"), React.createElement("span", {
      className: "help-tip-calc-expr",
      key: "expr"
    }, calc.expr)];
    if (!presentSpecs.length) {
      elements.push(React.createElement("span", {
        className: "help-tip-calc-names",
        key: "names"
      }, calc.inputs.map(s => s.label).join(", ")), React.createElement("span", {
        className: "help-tip-calc-unavailable",
        key: "unavailable"
      }, "live inputs not available on this view"));
      return React.createElement("span", {
        className: "help-tip-calc"
      }, elements);
    }

    // At least one input is present but not all (e.g. a config-only value
    // shown outside the context of one specific position) — substitute what
    // we have, leave the rest as the formula's own words, and stop short of
    // a result rather than pretending we can compute one.
    if (!allPresent) {
      presentSpecs.forEach((spec, i) => {
        elements.push(React.createElement("span", {
          className: "help-tip-calc-input",
          key: `input-${i}`
        }, `${spec.label}: ${formatInputValue(spec, inputs[spec.key])}`));
      });
      elements.push(React.createElement("span", {
        className: "help-tip-calc-sub",
        key: "sub"
      }, substituteExpr(calc.expr, presentSpecs, inputs)));
      var missing = calc.inputs.filter(spec => presentSpecs.indexOf(spec) === -1);
      elements.push(React.createElement("span", {
        className: "help-tip-calc-unavailable",
        key: "unavailable"
      }, `still needs ${missing.map(s => s.label).join(", ")} to finish this calc`));
      return React.createElement("span", {
        className: "help-tip-calc"
      }, elements);
    }
    var numericInputs = {};
    calc.inputs.forEach(spec => {
      numericInputs[spec.key] = spec.text ? inputs[spec.key] : Number(inputs[spec.key]);
    });
    calc.inputs.forEach((spec, i) => {
      elements.push(React.createElement("span", {
        className: "help-tip-calc-input",
        key: `input-${i}`
      }, `${spec.label}: ${formatInputValue(spec, inputs[spec.key])}`));
    });
    var result = calc.result(numericInputs);
    if (!Number.isFinite(result)) {
      elements.push(React.createElement("span", {
        className: "help-tip-calc-unavailable",
        key: "unavailable"
      }, "value not computable from these inputs"));
      return React.createElement("span", {
        className: "help-tip-calc"
      }, elements);
    }
    elements.push(React.createElement("span", {
      className: "help-tip-calc-sub",
      key: "sub"
    }, substituteExpr(calc.expr, calc.inputs, inputs)), React.createElement("span", {
      className: "help-tip-calc-result",
      key: "result"
    }, "= ", React.createElement("b", null, formatByUnit(result, calc.unit))));
    var clocks = [];
    calc.inputs.forEach(spec => {
      if (spec.priced && spec.clock && clocks.indexOf(spec.clock) === -1) clocks.push(spec.clock);
    });
    var staleAfterMs = props.staleAfterMs || DEFAULT_STALE_AFTER_MS;
    ["entry", "quotes"].forEach(clock => {
      if (clocks.indexOf(clock) !== -1) {
        elements.push(asOfLine(clock, props.asOf, staleAfterMs, `asof-${clock}`));
      }
    });
    return React.createElement("span", {
      className: "help-tip-calc"
    }, elements);
  }

  //: Gap between the `?` button and the popover, and the minimum breathing room
  //: kept between the popover and the viewport edge before it flips.
  var TIP_GAP = 6;
  var TIP_MARGIN = 8;

  // Viewport coordinates for a popover anchored under `btn`, flipped above /
  // pulled leftward when it would otherwise run past the viewport edge. Pure
  // maths on two rects so it can be reasoned about (and tested) without a DOM.
  function tipPosition(btnRect, tipSize, viewport) {
    var left = btnRect.left;
    if (left + tipSize.width > viewport.width - TIP_MARGIN) {
      left = Math.max(TIP_MARGIN, viewport.width - TIP_MARGIN - tipSize.width);
    }
    var top = btnRect.bottom + TIP_GAP;
    // Flip above the trigger only when that actually gives more room — on a
    // very short viewport, staying below and clamping beats flipping into an
    // even smaller gap.
    var roomBelow = viewport.height - btnRect.bottom - TIP_GAP;
    var roomAbove = btnRect.top - TIP_GAP;
    if (tipSize.height > roomBelow && roomAbove > roomBelow) {
      top = Math.max(TIP_MARGIN, btnRect.top - TIP_GAP - tipSize.height);
    }
    return {
      top: top,
      left: left
    };
  }
  function Help(props) {
    var term = props && props.term;
    var entry = get(term);
    var [open, setOpen] = React.useState(false);
    // null until measured — the popover renders off-screen for one frame so it
    // can be measured, then snaps to its final spot; never flashes mid-page.
    var [pos, setPos] = React.useState(null);
    var btnRef = React.useRef(null);
    var tipRef = React.useRef(null);
    var closeRef = React.useRef(null);
    closeRef.current = () => setOpen(false);

    // Measure after paint and re-measure on scroll/resize. The popover lives in
    // a portal on <body>, so nothing anchors it to the button except this — but
    // that's exactly why it can escape a table's `overflow-x: auto` instead of
    // widening it into a scrollbar the user has to chase (PRD 1034).
    React.useLayoutEffect(() => {
      if (!open) {
        setPos(null);
        return undefined;
      }
      var place = () => {
        var btn = btnRef.current;
        var tip = tipRef.current;
        if (!btn || !tip) return;
        setPos(tipPosition(btn.getBoundingClientRect(), {
          width: tip.offsetWidth,
          height: tip.offsetHeight
        }, {
          width: window.innerWidth,
          height: window.innerHeight
        }));
      };
      place();
      // Capture phase so a scroll inside ANY ancestor (the table's own
      // horizontal scroller included), not just the window, keeps the popover
      // glued to its button.
      window.addEventListener("scroll", place, true);
      window.addEventListener("resize", place);
      return () => {
        window.removeEventListener("scroll", place, true);
        window.removeEventListener("resize", place);
      };
    }, [open]);
    if (!entry) return null;
    function openTooltip(e) {
      if (e) e.stopPropagation();
      if (activeCloser && activeCloser !== closeRef.current) activeCloser();
      activeCloser = closeRef.current;
      setOpen(true);
    }
    function toggle(e) {
      if (e) e.stopPropagation();
      if (open) {
        setOpen(false);
        if (activeCloser === closeRef.current) activeCloser = null;
      } else {
        openTooltip(e);
      }
    }
    function onKeyDown(e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggle(e);
      } else if (e.key === "Escape" && open) {
        e.preventDefault();
        setOpen(false);
        if (activeCloser === closeRef.current) activeCloser = null;
        if (btnRef.current) btnRef.current.focus();
      }
    }
    React.useEffect(() => {
      return () => {
        if (activeCloser === closeRef.current) activeCloser = null;
      };
    }, []);
    return React.createElement("span", {
      className: "help",
      onClick: e => e.stopPropagation()
    }, React.createElement("button", {
      type: "button",
      ref: btnRef,
      className: "help-btn",
      "aria-label": `What is ${entry.label}?`,
      "aria-expanded": open,
      onClick: toggle,
      onKeyDown: onKeyDown
    }, "?"), open ? ReactDOM.createPortal(React.createElement("span", {
      className: "help-tip",
      role: "tooltip",
      ref: tipRef,
      // Clicks inside the popover must not reach whatever is under
      // the portal's DOM position (e.g. a clickable table row).
      onClick: e => e.stopPropagation(),
      style: pos ? {
        top: pos.top + "px",
        left: pos.left + "px"
      } : {
        top: "0px",
        left: "0px",
        visibility: "hidden"
      }
    }, React.createElement("span", {
      className: "help-tip-label"
    }, entry.label), props && props.note ? React.createElement("span", {
      className: "help-tip-note"
    }, props.note) : null, React.createElement("span", {
      className: "help-tip-short"
    }, entry.short), React.createElement("span", {
      className: "help-tip-long"
    }, entry.long), entry.example ? React.createElement("span", {
      className: "help-tip-example"
    }, entry.example) : null, entry.calc ? renderCalcBlock(entry.calc, props || {}) : null), document.body) : null);
  }
  window.Glossary = TERMS;
  window.Help = Help;
  // The one PT-clock formatter, shared with panels that stamp a card with
  // "when did the job that produced this last run" (options-summary.jsx's
  // SectionStamp) — so a section stamp and a `?` tooltip's "as of" line can
  // never disagree on how a timestamp reads.
  window.AsOfTime = {
    format: formatAsOfTime,
    relativeAge: relativeAge
  };
})();

/* ---- lib/feedback.js ---- */
/* feedback.js — the ONE feedback primitive the dashboard reuses everywhere
 * (PRD 1040). Exposes:
 *   window.FeedbackButton  — a small speech-bubble button, sibling of the
 *                            `?` Help button, that opens a feedback modal
 *                            scoped to one target (component/position/
 *                            trade/page).
 *   window.FeedbackClient  — the submit/outbox transport. A failed POST is
 *                            queued in localStorage and retried later, so a
 *                            submission is never silently lost.
 *
 * Plain JS (React.createElement, no JSX) — loaded as a plain <script>, same
 * as dashboard/lib/glossary.js, so every `type=text/babel` panel below it in
 * index.html can already see window.FeedbackButton.
 */
(function () {
  var SLUG = "social-signals-trader";
  // Absolute path → resolves against the ORIGIN root (bilko.run), not the
  // /projects/<slug>/ page path. Same reasoning as live-snapshot.js.
  var ENDPOINT = "/api/projects/social-signals-trader/feedback";
  var OUTBOX_KEY = "sst.feedback.outbox";
  var OUTBOX_CAP = 20;

  // Owner-mode moderation (PRD 1071). The owner token is a real bearer
  // credential — see docs/feedback-api-contract.md's moderate route. It is
  // captured once from a `#options?owner=<token>` URL param, stored ONLY in
  // localStorage, stripped from the address bar immediately, never sent on
  // any request other than moderate(), and dropped on 401/403.
  var OWNER_KEY = "sst.feedback.owner";
  var MODERATE_ACTIONS = ["archive", "unarchive", "delete", "restore"];
  var MAX_EDGE = 1600;
  var JPEG_QUALITY = 0.8;
  var MAX_DATAURL_BYTES = 2000000;
  var MAX_RAW_BYTES = 8000000;
  var VALID_KINDS = ["component", "position", "trade", "page"];
  var VALID_TYPES = ["bug", "feature", "feedback"];

  // ---------------------------------------------------------------------
  // FeedbackClient — transport + outbox
  // ---------------------------------------------------------------------

  function readOutbox() {
    try {
      var raw = window.localStorage.getItem(OUTBOX_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }
  function writeOutbox(arr) {
    try {
      window.localStorage.setItem(OUTBOX_KEY, JSON.stringify(arr));
    } catch (e) {
      // Safari private mode / storage disabled — degrade silently, the
      // caller already has an inline "saved" message on screen either way.
    }
  }
  function enqueue(payload) {
    var arr = readOutbox();
    arr.push(payload);
    while (arr.length > OUTBOX_CAP) arr.shift();
    writeOutbox(arr);
  }
  function postPayload(payload) {
    return fetch(ENDPOINT, {
      method: "POST",
      cache: "no-store",
      credentials: "omit",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    }).then(function (r) {
      return !!(r && r.ok);
    }).catch(function () {
      return false;
    });
  }

  // Retries every queued entry one at a time; removes each only on a 2xx.
  // A still-failing entry stays queued and this never throws or rejects.
  var flushing = false;
  function flushOutbox() {
    if (flushing) return Promise.resolve();
    var arr = readOutbox();
    if (!arr.length) return Promise.resolve();
    flushing = true;
    var toKeep = [];
    var chain = Promise.resolve();
    arr.forEach(function (item) {
      chain = chain.then(function () {
        return postPayload(item).then(function (ok) {
          if (!ok) toKeep.push(item);
        }).catch(function () {
          toKeep.push(item);
        });
      });
    });
    return chain.then(function () {
      writeOutbox(toKeep);
    }).catch(function () {}).then(function () {
      flushing = false;
    });
  }

  // ---------------------------------------------------------------------
  // Owner mode — token capture/storage + the moderate() transport
  // ---------------------------------------------------------------------

  function readOwnerToken() {
    try {
      var t = window.localStorage.getItem(OWNER_KEY);
      return typeof t === "string" && t ? t : null;
    } catch (e) {
      return null;
    }
  }
  function writeOwnerToken(token) {
    try {
      if (token) {
        window.localStorage.setItem(OWNER_KEY, token);
      } else {
        window.localStorage.removeItem(OWNER_KEY);
      }
    } catch (e) {
      // Safari private mode / storage disabled — owner mode just can't
      // persist this session; nothing to surface to the visitor.
    }
  }
  function clearOwnerToken() {
    writeOwnerToken(null);
  }

  // Strips an `owner=<token>` query param out of a hash string, returning the
  // hash unchanged if there is none. Used BOTH by captureOwnerFromUrl (to
  // build the URL it hands to history.replaceState) and — independently —
  // by buildPayload's `route` field below: if a `history.replaceState` call
  // ever throws (Safari's >100-calls/30s History API limit, a sandboxed
  // iframe, a restricted embedding context) the token could otherwise sit in
  // `window.location.hash` for the rest of the page session, and
  // buildPayload() reads that hash verbatim into every ordinary, PUBLIC,
  // unauthenticated feedback submission's `route` field. Sanitizing at BOTH
  // the capture site and the read site means a failed URL scrub can never by
  // itself leak the token into a public payload.
  function stripOwnerParam(hash) {
    var h = hash || "";
    var qIdx = h.indexOf("?");
    if (qIdx === -1) return h;
    try {
      var params = new URLSearchParams(h.slice(qIdx + 1));
      if (!params.has("owner")) return h;
      params.delete("owner");
      var rest = params.toString();
      return h.slice(0, qIdx) + (rest ? "?" + rest : "");
    } catch (e) {
      return h;
    }
  }

  // Reads `owner=<token>` off the CURRENT hash's query string (e.g.
  // `#options?owner=abc`, not a `?owner=` on the page URL itself — the
  // dashboard is a hash-routed SPA), rewrites history so the token never
  // sits in the address bar or browser history, THEN stores it — in that
  // order, so a `history.replaceState` failure never leaves a token
  // persisted whose URL couldn't be scrubbed.
  function captureOwnerFromUrl() {
    try {
      var hash = window.location.hash || "";
      var qIdx = hash.indexOf("?");
      if (qIdx === -1) return;
      var params = new URLSearchParams(hash.slice(qIdx + 1));
      var token = params.get("owner");
      if (!token) return;
      var newHash = stripOwnerParam(hash);
      var newUrl = window.location.pathname + window.location.search + newHash;
      window.history.replaceState(null, "", newUrl);
      writeOwnerToken(token);
      try {
        window.dispatchEvent(new Event("sst:feedback-owner-changed"));
      } catch (e2) {}
    } catch (e) {
      // Malformed hash / no History API — owner mode just doesn't arm this
      // load; never let capture throw into page bootstrap.
    }
  }
  function moderate(id, action, opts) {
    opts = opts || {};
    if (typeof id !== "string" || !id) {
      return Promise.resolve({
        ok: false,
        status: 0
      });
    }
    if (MODERATE_ACTIONS.indexOf(action) === -1) {
      return Promise.resolve({
        ok: false,
        status: 0
      });
    }
    var token = readOwnerToken();
    if (!token) {
      return Promise.resolve({
        ok: false,
        status: 401
      });
    }
    var body = {
      action: action
    };
    if (typeof opts.reason === "string" && opts.reason) body.reason = opts.reason;
    return fetch(ENDPOINT + "/" + encodeURIComponent(id) + "/moderate", {
      method: "POST",
      cache: "no-store",
      credentials: "omit",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token
      },
      body: JSON.stringify(body)
    }).then(function (r) {
      var status = r ? r.status : 0;
      if (status === 401 || status === 403) clearOwnerToken();
      return {
        ok: !!(r && r.ok),
        status: status
      };
    }).catch(function () {
      return {
        ok: false,
        status: 0
      };
    });
  }
  function buildPayload(opts) {
    opts = opts || {};
    var target = opts.target || {};
    var viewport = {
      w: window.innerWidth || 0,
      h: window.innerHeight || 0
    };
    var tz = "";
    try {
      tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    } catch (e) {}
    var type = VALID_TYPES.indexOf(opts.type) !== -1 ? opts.type : "feedback";
    var parentId = typeof opts.parentId === "string" && opts.parentId ? opts.parentId : null;
    return {
      schema: 1,
      slug: SLUG,
      target: {
        kind: target.kind,
        id: target.id,
        label: target.label
      },
      route: stripOwnerParam(window.location && window.location.hash || "#options"),
      type: type,
      title: opts.title || "",
      description: opts.description || "",
      image: opts.image || null,
      parentId: parentId,
      client: {
        ua: window.navigator && window.navigator.userAgent || "",
        viewport: viewport,
        tz: tz,
        submittedAt: new Date().toISOString()
      },
      snapshotGeneratedAt: window.__liveSnapshotMeta && window.__liveSnapshotMeta.generatedAt || null
    };
  }
  function submit(payload) {
    return postPayload(payload).then(function (ok) {
      if (ok) {
        flushOutbox();
        return {
          ok: true,
          queued: false
        };
      }
      enqueue(payload);
      return {
        ok: false,
        queued: true
      };
    });
  }
  var FeedbackClient = {
    ENDPOINT: ENDPOINT,
    OUTBOX_KEY: OUTBOX_KEY,
    OWNER_KEY: OWNER_KEY,
    MODERATE_ACTIONS: MODERATE_ACTIONS,
    buildPayload: buildPayload,
    submit: submit,
    flushOutbox: flushOutbox,
    moderate: moderate,
    getOwnerToken: readOwnerToken,
    clearOwnerToken: clearOwnerToken
  };

  // Drain anything left over from a prior offline session as soon as the
  // page has this module loaded.
  flushOutbox();
  // Capture + strip a `?owner=<token>` URL param before any panel below this
  // script tag renders, so the token is never visible on screen or in
  // history for longer than this one synchronous call.
  captureOwnerFromUrl();
  // Also re-arm on an in-page SPA hash change (no full reload) — a visitor
  // following a `#options?owner=<token>` link from elsewhere in the app
  // shouldn't need a hard refresh for owner mode to take.
  window.addEventListener("hashchange", captureOwnerFromUrl);

  // ---------------------------------------------------------------------
  // FeedbackButton + modal
  // ---------------------------------------------------------------------

  // A 10px hairline glyph shipped first and was effectively invisible — the
  // first real visitor found the button only because they were looking for it.
  // Now 14px, heavier stroke, and paired with a "Feedback" word everywhere the
  // layout has room for one (CSS hides the word inside dense table cells, where
  // the chip stands alone).
  function FeedbackIcon() {
    return React.createElement("svg", {
      viewBox: "0 0 12 12",
      width: 14,
      height: 14,
      "aria-hidden": "true",
      stroke: "currentColor",
      fill: "none",
      strokeWidth: 1.5
    }, React.createElement("path", {
      d: "M1.5 2.5h9v5.5h-4l-2 2v-2h-3z",
      strokeLinejoin: "round"
    }), React.createElement("path", {
      d: "M4 5.1l3-1.4",
      strokeLinecap: "round"
    }), React.createElement("path", {
      d: "M4.3 6.3l3-1.4",
      strokeLinecap: "round"
    }));
  }
  function downscaleImage(file, maxEdge, quality) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = function () {
        reject(reader.error || new Error("read failed"));
      };
      reader.onload = function () {
        var img = new Image();
        img.onerror = function () {
          reject(new Error("decode failed"));
        };
        img.onload = function () {
          var w = img.naturalWidth || img.width;
          var h = img.naturalHeight || img.height;
          var scale = Math.min(1, maxEdge / Math.max(w, h || 1));
          var outW = Math.max(1, Math.round(w * scale));
          var outH = Math.max(1, Math.round(h * scale));
          var canvas = document.createElement("canvas");
          canvas.width = outW;
          canvas.height = outH;
          var ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, outW, outH);
          var dataUrl = canvas.toDataURL("image/jpeg", quality);
          var b64 = dataUrl.split(",")[1] || "";
          var bytes = Math.round(b64.length * 3 / 4);
          resolve({
            dataUrl: dataUrl,
            bytes: bytes,
            mime: "image/jpeg"
          });
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  // A reply is not a second feedback item in the reader's mind — it's the next
  // message in a conversation that already has a subject. Only the FIRST post
  // against a target carries a title (it names the topic); everything after it
  // is body-only. `parentId` is the whole distinction: set => reply mode.
  //
  // The wire contract (docs/feedback-api-contract.md) still requires a
  // non-empty `title` on every submitted item, so reply mode SYNTHESIZES one
  // from the parent's label instead of asking for it. Nothing renders it —
  // feedback_threads.build() folds a child row into its parent's messages[]
  // using `description` only.
  var REPLY_TITLE_MAX = 120;
  function replyTitleFor(label) {
    var base = "Re: " + (label || "thread");
    return base.length > REPLY_TITLE_MAX ? base.slice(0, REPLY_TITLE_MAX) : base;
  }
  function FeedbackModal(props) {
    var target = props.target;
    var label = target.label;
    var isReply = !!props.parentId;
    var closeRef = React.useRef(props.onClose);
    closeRef.current = props.onClose;
    var titleRef = React.useRef(null);
    var bodyRef = React.useRef(null);
    // A reply inherits its topic's type — the reader classified the
    // conversation once, when they opened it.
    var [type, setType] = React.useState(isReply && VALID_TYPES.indexOf(props.parentType) !== -1 ? props.parentType : "feedback");
    var [title, setTitle] = React.useState("");
    var [description, setDescription] = React.useState("");
    var [image, setImage] = React.useState(null);
    var [imageError, setImageError] = React.useState("");
    var [status, setStatus] = React.useState("idle"); // idle | pending | success | queued
    var [message, setMessage] = React.useState("");
    React.useEffect(function () {
      var first = isReply ? bodyRef.current : titleRef.current;
      if (first) first.focus();
    }, [isReply]);
    React.useEffect(function () {
      function onKeyDown(e) {
        if (e.key === "Escape") {
          e.preventDefault();
          closeRef.current();
        }
      }
      document.addEventListener("keydown", onKeyDown);
      return function () {
        document.removeEventListener("keydown", onKeyDown);
      };
    }, []);
    function handleFile(file) {
      setImageError("");
      if (!file) return;
      if (file.size > MAX_RAW_BYTES) {
        setImageError("Image is larger than 8MB — pick a smaller file.");
        return;
      }
      downscaleImage(file, MAX_EDGE, JPEG_QUALITY).then(function (result) {
        if (result.bytes > MAX_DATAURL_BYTES) {
          setImageError("Image is still too large after compression — pick a smaller file.");
          return;
        }
        setImage(result);
      }).catch(function () {
        setImageError("Could not read that image.");
      });
    }
    function onFileInputChange(e) {
      var file = e.target.files && e.target.files[0];
      handleFile(file);
      e.target.value = "";
    }
    function onPaste(e) {
      var items = e.clipboardData && e.clipboardData.items;
      if (!items) return;
      for (var i = 0; i < items.length; i++) {
        if (items[i].type && items[i].type.indexOf("image/") === 0) {
          var file = items[i].getAsFile();
          if (file) {
            handleFile(file);
            e.preventDefault();
            break;
          }
        }
      }
    }
    function removeImage() {
      setImage(null);
      setImageError("");
    }
    var canSubmit = (isReply || title.trim().length > 0) && description.trim().length > 0 && status !== "pending";

    // A position-scoped submission answers on that position's trade page, not
    // in place on #options where it was filed — say so explicitly, otherwise
    // a visitor sees the same row and reasonably assumes their feedback
    // vanished (this is the exact confusion that prompted this indicator).
    var answerHint = target.kind === "position" ? " We'll answer on this trade's page." : "";
    function onSubmit(e) {
      e.preventDefault();
      if (!canSubmit) return;
      setStatus("pending");
      var payload = buildPayload({
        target: target,
        type: type,
        title: isReply ? replyTitleFor(label) : title.trim(),
        description: description.trim(),
        image: image,
        parentId: props.parentId
      });
      submit(payload).then(function (result) {
        if (result && result.ok) {
          setStatus("success");
          setMessage((isReply ? "Thanks — reply sent." : "Thanks — feedback sent.") + answerHint);
        } else {
          setStatus("queued");
          setMessage("Saved — we'll send it next time you're online." + answerHint);
        }
        setTimeout(function () {
          closeRef.current();
        }, 1500);
      });
    }
    function onBackdropClick() {
      closeRef.current();
    }
    var doneMsg = status === "success" || status === "queued";
    return React.createElement("div", {
      className: "fb-backdrop",
      onClick: onBackdropClick
    }, React.createElement("div", {
      className: "fb-modal",
      role: "dialog",
      "aria-modal": "true",
      "aria-label": isReply ? "Reply in the thread " + label : "Leave feedback on " + label,
      onClick: function (e) {
        e.stopPropagation();
      },
      onPaste: onPaste
    }, React.createElement("div", {
      className: "fb-modal-head"
    }, isReply ? "Reply in " : "Leave feedback on ", React.createElement("b", null, label)), doneMsg ? React.createElement("div", {
      className: "fb-msg"
    }, message) : React.createElement("form", {
      onSubmit: onSubmit
    },
    // Type + Title name a NEW topic. A reply is another message in a
    // topic that already has both, so it asks for the body alone.
    isReply ? null : React.createElement("div", {
      className: "fb-chips",
      role: "radiogroup",
      "aria-label": "Feedback type"
    }, VALID_TYPES.map(function (t) {
      var chipLabel = t === "bug" ? "Bug" : t === "feature" ? "Feature" : "Feedback";
      return React.createElement("button", {
        type: "button",
        key: t,
        className: "fb-chip" + (type === t ? " fb-chip--on" : ""),
        "aria-pressed": type === t,
        onClick: function () {
          setType(t);
        }
      }, chipLabel);
    })), isReply ? null : React.createElement("label", {
      className: "fb-field"
    }, "Title", React.createElement("input", {
      type: "text",
      ref: titleRef,
      value: title,
      maxLength: 120,
      required: true,
      onChange: function (e) {
        setTitle(e.target.value);
      }
    })), React.createElement("label", {
      className: "fb-field"
    }, isReply ? "Your reply" : "Description", React.createElement("textarea", {
      ref: bodyRef,
      value: description,
      maxLength: 4000,
      required: true,
      rows: 4,
      onChange: function (e) {
        setDescription(e.target.value);
      }
    })), React.createElement("label", {
      className: "fb-field"
    }, "Screenshot (optional — you can also paste an image)", React.createElement("input", {
      type: "file",
      accept: "image/*",
      onChange: onFileInputChange
    })), imageError ? React.createElement("div", {
      className: "fb-msg"
    }, imageError) : null, image ? React.createElement("div", {
      className: "fb-thumb"
    }, React.createElement("img", {
      src: image.dataUrl,
      alt: "Attached screenshot"
    }), React.createElement("button", {
      type: "button",
      onClick: removeImage
    }, "Remove")) : null, React.createElement("div", {
      className: "fb-actions"
    }, React.createElement("button", {
      type: "button",
      onClick: onBackdropClick
    }, "Cancel"), React.createElement("button", {
      type: "submit",
      disabled: !canSubmit
    }, status === "pending" ? "Sending…" : isReply ? "Send reply" : "Send feedback")))));
  }
  function FeedbackButton(props) {
    var target = props && props.target;
    var malformed = !target || typeof target !== "object" || !target.kind || !target.id || !target.label || VALID_KINDS.indexOf(target.kind) === -1;
    var isReply = !!(props && props.parentId);
    var [open, setOpen] = React.useState(false);
    var btnRef = React.useRef(null);
    if (malformed) return null;
    function close() {
      setOpen(false);
      if (btnRef.current) btnRef.current.focus();
    }
    return React.createElement("span", {
      className: "feedback",
      onClick: function (e) {
        e.stopPropagation();
      }
    }, React.createElement("button", {
      type: "button",
      ref: btnRef,
      className: "feedback-btn" + (isReply ? " feedback-btn--reply" : ""),
      "aria-label": isReply ? "Reply in the thread " + target.label : "Leave feedback on " + target.label,
      "aria-expanded": open,
      onClick: function (e) {
        e.stopPropagation();
        setOpen(true);
      }
    }, FeedbackIcon(), React.createElement("span", {
      className: "feedback-btn-label"
    }, isReply ? "Reply" : "Feedback")), open ? ReactDOM.createPortal(React.createElement(FeedbackModal, {
      target: target,
      parentId: props.parentId,
      parentType: props.parentType,
      onClose: close
    }), document.body) : null);
  }
  window.FeedbackButton = FeedbackButton;
  window.FeedbackClient = FeedbackClient;
})();

/* ---- fixtures/signals_history.example.js ---- */
/* fixtures/signals_history.example.js
 *
 * Programmatic fixture for the Signals tab. Generates 90 days of daily
 * sentiment+mentions rows for 3 tickers across 2 subreddits so the tab
 * renders out of the box with `?fixture=signals` or whenever the real
 * window.SIGNALS_HISTORY is absent.
 *
 * Shape matches docs/architecture-split.md §"MCP contract sketch" and
 * PRD 46 §"Fixture shape".
 */
(function () {
  "use strict";

  var TICKERS = ["NVDA", "TSLA", "AMD"];
  var SUBS = ["wallstreetbets", "stocks"];
  var DAYS = 90;

  // Anchor at 2026-05-22 18:00 UTC so behaviour is deterministic in tests.
  var END = Date.parse("2026-05-22T18:00:00Z");
  var DAY_MS = 86400 * 1000;

  // Tiny seeded PRNG so re-renders are deterministic across reloads.
  function mulberry32(a) {
    return function () {
      var t = a += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  // Per-ticker baselines so the lines are visibly distinct.
  var BASE = {
    NVDA: {
      bullShare: 0.78,
      mentions: 45
    },
    TSLA: {
      bullShare: 0.52,
      mentions: 60
    },
    AMD: {
      bullShare: 0.65,
      mentions: 28
    }
  };
  var rows = [];
  var seed = 42;
  for (var i = 0; i < TICKERS.length; i++) {
    var tk = TICKERS[i];
    var rng = mulberry32(seed + i * 1000);
    for (var d = 0; d < DAYS; d++) {
      var ts = END - (DAYS - 1 - d) * DAY_MS;
      var base = BASE[tk];
      // Walk bull_share with a small noise, clamped to [0.05, 0.95].
      var drift = (rng() - 0.5) * 0.12;
      var trend = Math.sin(d / DAYS * Math.PI * 2 + i) * 0.08;
      var bullShare = Math.max(0.05, Math.min(0.95, base.bullShare + drift + trend));
      var mentions = Math.max(1, Math.round(base.mentions * (0.6 + rng() * 0.9)));
      var bullCount = Math.round(mentions * bullShare);
      var bearCount = mentions - bullCount;
      var sub = SUBS[(d + i) % SUBS.length];
      rows.push({
        built_at: new Date(ts).toISOString(),
        ticker: tk,
        panel: "sentiment",
        payload: {
          bull_count: bullCount,
          bear_count: bearCount,
          bull_share: Number(bullShare.toFixed(3)),
          mentions: mentions,
          top_subreddit: sub
        }
      });
    }
  }
  var themes = [{
    theme: "AI infrastructure",
    tickers: ["NVDA", "AMD", "SMCI"],
    built_at: new Date(END).toISOString(),
    evidence_posts: [{
      id: "t3_ai1",
      title: "NVDA crushing Q1 — H100 backlog into 2027",
      subreddit: "wallstreetbets",
      url: "https://www.reddit.com/r/wallstreetbets/comments/ai1",
      created_utc: "2026-05-22T17:30:00Z",
      score: 412
    }, {
      id: "t3_ai2",
      title: "AMD MI300X benchmarks: 1.3x H100 in inference",
      subreddit: "stocks",
      url: "https://www.reddit.com/r/stocks/comments/ai2",
      created_utc: "2026-05-22T16:10:00Z",
      score: 287
    }, {
      id: "t3_ai3",
      title: "SMCI is the picks-and-shovels play of the decade",
      subreddit: "wallstreetbets",
      url: "https://www.reddit.com/r/wallstreetbets/comments/ai3",
      created_utc: "2026-05-22T14:55:00Z",
      score: 198
    }]
  }, {
    theme: "EV demand softness",
    tickers: ["TSLA", "RIVN", "LCID"],
    built_at: new Date(END).toISOString(),
    evidence_posts: [{
      id: "t3_ev1",
      title: "TSLA Q2 deliveries trending below consensus",
      subreddit: "stocks",
      url: "https://www.reddit.com/r/stocks/comments/ev1",
      created_utc: "2026-05-22T15:00:00Z",
      score: 156
    }, {
      id: "t3_ev2",
      title: "Lucid burning $1B/qtr, runway < 18mo",
      subreddit: "wallstreetbets",
      url: "https://www.reddit.com/r/wallstreetbets/comments/ev2",
      created_utc: "2026-05-22T13:40:00Z",
      score: 92
    }]
  }];
  window.SIGNALS_HISTORY_FIXTURE = {
    schema_version: 1,
    built_at_range: [new Date(END - (DAYS - 1) * DAY_MS).toISOString(), new Date(END).toISOString()],
    rows: rows,
    themes: themes
  };
})();

/* ---- fixtures/optimization_history.example.js ---- */
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
    var x = (seed * 9301 + 49297) % 233280;
    var out = [];
    var v = 10000;
    for (var i = 0; i < n; i++) {
      x = (x * 9301 + 49297) % 233280;
      var r = x / 233280 * 0.08 - 0.03; // -3% to +5%
      v *= 1 + r;
      out.push({
        t: `step_${i}`,
        v: Math.round(v * 100) / 100
      });
    }
    return out;
  }

  // 6 cells for OPT_FLOW (3 convictions × 2 mention thresholds)
  var optFlowCells = [{
    params: {
      min_conviction: 0.50,
      mention_threshold: 10
    },
    sharpe: 1.42,
    win_rate: 0.58,
    max_drawdown: -0.087,
    n_trades: 73,
    equity_curve: curve(11)
  }, {
    params: {
      min_conviction: 0.50,
      mention_threshold: 20
    },
    sharpe: 0.88,
    win_rate: 0.52,
    max_drawdown: -0.112,
    n_trades: 41,
    equity_curve: curve(12)
  }, {
    params: {
      min_conviction: 0.55,
      mention_threshold: 10
    },
    sharpe: 1.71,
    win_rate: 0.62,
    max_drawdown: -0.071,
    n_trades: 65,
    equity_curve: curve(13)
  }, {
    params: {
      min_conviction: 0.55,
      mention_threshold: 20
    },
    sharpe: 0.34,
    win_rate: 0.48,
    max_drawdown: -0.144,
    n_trades: 38,
    equity_curve: curve(14)
  }, {
    params: {
      min_conviction: 0.60,
      mention_threshold: 10
    },
    sharpe: -0.22,
    win_rate: 0.41,
    max_drawdown: -0.198,
    n_trades: 50,
    equity_curve: curve(15)
  }, {
    params: {
      min_conviction: 0.60,
      mention_threshold: 20
    },
    sharpe: 0.95,
    win_rate: 0.55,
    max_drawdown: -0.083,
    n_trades: 27,
    equity_curve: curve(16)
  }];

  // 6 cells for BLEND_CONS
  var blendCells = [{
    params: {
      min_conviction: 0.50,
      cross_sub_min: 2
    },
    sharpe: 0.62,
    win_rate: 0.51,
    max_drawdown: -0.091,
    n_trades: 88,
    equity_curve: curve(21)
  }, {
    params: {
      min_conviction: 0.50,
      cross_sub_min: 3
    },
    sharpe: 1.18,
    win_rate: 0.59,
    max_drawdown: -0.064,
    n_trades: 64,
    equity_curve: curve(22)
  }, {
    params: {
      min_conviction: 0.55,
      cross_sub_min: 2
    },
    sharpe: 0.45,
    win_rate: 0.49,
    max_drawdown: -0.121,
    n_trades: 76,
    equity_curve: curve(23)
  }, {
    params: {
      min_conviction: 0.55,
      cross_sub_min: 3
    },
    sharpe: 1.55,
    win_rate: 0.64,
    max_drawdown: -0.058,
    n_trades: 52,
    equity_curve: curve(24)
  }, {
    params: {
      min_conviction: 0.60,
      cross_sub_min: 2
    },
    sharpe: -0.14,
    win_rate: 0.46,
    max_drawdown: -0.155,
    n_trades: 49,
    equity_curve: curve(25)
  }, {
    params: {
      min_conviction: 0.60,
      cross_sub_min: 3
    },
    sharpe: 0.78,
    win_rate: 0.54,
    max_drawdown: -0.079,
    n_trades: 36,
    equity_curve: curve(26)
  }];

  // 6 cells for DAY_PULSE
  var dayCells = [{
    params: {
      min_conviction: 0.50,
      velocity_ratio_min: 1.5
    },
    sharpe: 0.90,
    win_rate: 0.55,
    max_drawdown: -0.080,
    n_trades: 60,
    equity_curve: curve(31)
  }, {
    params: {
      min_conviction: 0.50,
      velocity_ratio_min: 2.0
    },
    sharpe: 1.32,
    win_rate: 0.61,
    max_drawdown: -0.065,
    n_trades: 44,
    equity_curve: curve(32)
  }, {
    params: {
      min_conviction: 0.55,
      velocity_ratio_min: 1.5
    },
    sharpe: 0.20,
    win_rate: 0.47,
    max_drawdown: -0.140,
    n_trades: 51,
    equity_curve: curve(33)
  }, {
    params: {
      min_conviction: 0.55,
      velocity_ratio_min: 2.0
    },
    sharpe: 1.05,
    win_rate: 0.57,
    max_drawdown: -0.073,
    n_trades: 33,
    equity_curve: curve(34)
  }, {
    params: {
      min_conviction: 0.60,
      velocity_ratio_min: 1.5
    },
    sharpe: -0.30,
    win_rate: 0.42,
    max_drawdown: -0.180,
    n_trades: 28,
    equity_curve: curve(35)
  }, {
    params: {
      min_conviction: 0.60,
      velocity_ratio_min: 2.0
    },
    sharpe: 0.55,
    win_rate: 0.50,
    max_drawdown: -0.092,
    n_trades: 22,
    equity_curve: curve(36)
  }];
  function winnerOf(cells) {
    var w = cells.reduce((a, b) => a.sharpe >= b.sharpe ? a : b, cells[0]);
    return {
      params: w.params,
      sharpe: w.sharpe
    };
  }
  window.OPTIMIZATION_FIXTURE = {
    OPT_FLOW: {
      sleeve_id: "OPT_FLOW",
      cells: optFlowCells,
      winner: winnerOf(optFlowCells),
      sweep_id: "fx-opt-flow",
      mock: true
    },
    BLEND_CONS: {
      sleeve_id: "BLEND_CONS",
      cells: blendCells,
      winner: winnerOf(blendCells),
      sweep_id: "fx-blend-cons",
      mock: true
    },
    DAY_PULSE: {
      sleeve_id: "DAY_PULSE",
      cells: dayCells,
      winner: winnerOf(dayCells),
      sweep_id: "fx-day-pulse",
      mock: true
    }
  };

  // PRD 72: variant evaluation fixture --------------------------------------
  //
  // Lets the Variants subtab render without the trader HTTP endpoint. Three
  // reference variants matching data/strategies/{WSB_,SA_,BALANCED_}SENTIMENT.
  // Equity curves are aligned on the same x-axis (12 ticks) so the overlay
  // chart renders cleanly even at fixture load.

  function variantCurve(seed, n = 12) {
    var x = (seed * 9301 + 49297) % 233280;
    var out = [{
      ts: "open",
      equity: 1.0
    }];
    var v = 1.0;
    for (var i = 0; i < n; i++) {
      x = (x * 9301 + 49297) % 233280;
      var r = x / 233280 * 0.06 - 0.02; // -2% .. +4%
      v *= 1 + r;
      out.push({
        ts: `2026-04-${String(i + 1).padStart(2, "0")}T15:30:00Z`,
        equity: Math.round(v * 1e6) / 1e6
      });
    }
    return out;
  }
  function variantProposals(variantId, ticker, n) {
    var out = [];
    for (var i = 0; i < n; i++) {
      out.push({
        ts: `2026-04-${String(i % 12 + 1).padStart(2, "0")}T15:30:00Z`,
        ticker: ticker,
        side: i % 4 === 3 ? "sell" : "buy",
        qty: 1,
        conviction: 0.55 + i * 7 % 30 / 100
      });
    }
    return out;
  }
  var wsbCurve = variantCurve(101);
  var saCurve = variantCurve(202);
  var balancedCurve = variantCurve(303);
  window.VARIANT_EVALUATION_FIXTURE = {
    variants: [{
      id: "WSB_SENTIMENT_ONLY",
      name: "WSB sentiment-only baseline",
      feeds: ["wallstreetbets"],
      catalyst: "earnings",
      capital_pct: 0.02
    }, {
      id: "SA_SENTIMENT_ONLY",
      name: "SecurityAnalysis sentiment-only baseline",
      feeds: ["securityanalysis"],
      catalyst: "earnings",
      capital_pct: 0.02
    }, {
      id: "BALANCED_SENTIMENT",
      name: "Balanced sentiment (cross-sub baseline)",
      feeds: ["wallstreetbets", "securityanalysis", "investing"],
      catalyst: "earnings",
      capital_pct: 0.02
    }],
    rows: [{
      variant_id: "WSB_SENTIMENT_ONLY",
      n_trades: 18,
      win_rate: 0.55,
      sharpe: 0.92,
      max_dd_pct: -0.084,
      final_equity_pct: wsbCurve[wsbCurve.length - 1].equity - 1,
      equity_curve: wsbCurve,
      proposals: variantProposals("WSB_SENTIMENT_ONLY", "TSLA", 18),
      conviction_threshold: 0.5,
      from: "2026-04-01",
      to: "2026-05-23",
      catalyst: "earnings"
    }, {
      variant_id: "SA_SENTIMENT_ONLY",
      n_trades: 9,
      win_rate: 0.66,
      sharpe: 1.21,
      max_dd_pct: -0.052,
      final_equity_pct: saCurve[saCurve.length - 1].equity - 1,
      equity_curve: saCurve,
      proposals: variantProposals("SA_SENTIMENT_ONLY", "BRK.B", 9),
      conviction_threshold: 0.5,
      from: "2026-04-01",
      to: "2026-05-23",
      catalyst: "earnings"
    }, {
      variant_id: "BALANCED_SENTIMENT",
      n_trades: 24,
      win_rate: 0.61,
      sharpe: 1.45,
      max_dd_pct: -0.038,
      final_equity_pct: balancedCurve[balancedCurve.length - 1].equity - 1,
      equity_curve: balancedCurve,
      proposals: variantProposals("BALANCED_SENTIMENT", "AAPL", 24),
      conviction_threshold: 0.5,
      from: "2026-04-01",
      to: "2026-05-23",
      catalyst: "earnings"
    }]
  };
})();

/* ---- pages/signals-tab.jsx ---- */
/* global React, SBClient */
/* dashboard/pages/signals-tab.jsx — PRD 46 Signals tab.
 *
 * Reads SBClient (window.SBClient) which today is backed by an in-memory
 * fixture; PRD M8 swaps it for meta.panel_history MCP.
 */
(function () {
  "use strict";

  var {
    useState,
    useMemo,
    useEffect,
    useRef
  } = React;
  var RANGE_DAYS = {
    "1d": 1,
    "7d": 7,
    "30d": 30,
    "90d": 90
  };
  var DAY_MS = 86400 * 1000;
  var STROKES = ["var(--pos)", "var(--info)", "var(--warn)", "var(--neg)", "var(--text-2)"];

  // ---------- helpers ----------

  // Pure: pick top-N tickers by total mentions inside [sinceE, untilE].
  // O(rows) single pass.
  function topTickersByMentions(rows, n) {
    var counts = new Map();
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var m = r.payload && r.payload.mentions || 0;
      counts.set(r.ticker, (counts.get(r.ticker) || 0) + m);
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, n).map(e => e[0]);
  }

  // Group rows by ticker → sorted [{t, bull_share, mentions}].
  function groupByTicker(rows) {
    var out = new Map();
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var t = Date.parse(r.built_at);
      var p = r.payload || {};
      var series = out.get(r.ticker) || [];
      series.push({
        t,
        bull_share: p.bull_share || 0,
        mentions: p.mentions || 0
      });
      out.set(r.ticker, series);
    }
    for (var _series of out.values()) _series.sort((a, b) => a.t - b.t);
    return out;
  }

  // RFC 4180 quoting.
  function csvCell(v) {
    if (v == null) return "";
    var s = String(v);
    if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }
  function downloadCsv(rows, rangeKey) {
    var header = "built_at,ticker,panel,bull_share,bull_count,bear_count,mentions,top_subreddit";
    var lines = [header];
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var p = r.payload || {};
      lines.push([csvCell(r.built_at), csvCell(r.ticker), csvCell(r.panel), csvCell(p.bull_share), csvCell(p.bull_count), csvCell(p.bear_count), csvCell(p.mentions), csvCell(p.top_subreddit)].join(","));
    }
    var blob = new Blob([lines.join("\n")], {
      type: "text/csv"
    });
    var url = URL.createObjectURL(blob);
    var today = new Date().toISOString().slice(0, 10);
    var a = document.createElement("a");
    a.href = url;
    a.download = `signals_${rangeKey}_${today}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // Track viewport width so we can fall back to single-ticker mode on mobile.
  function useIsMobile(breakpoint) {
    var [m, setM] = useState(typeof window !== "undefined" ? window.innerWidth <= breakpoint : false);
    useEffect(() => {
      var onR = () => setM(window.innerWidth <= breakpoint);
      window.addEventListener("resize", onR);
      return () => window.removeEventListener("resize", onR);
    }, [breakpoint]);
    return m;
  }

  // ---------- chart ----------

  function SignalsChart({
    tickerSeries,
    strokes
  }) {
    var W = 800,
      H = 320,
      PAD_L = 48,
      PAD_R = 48,
      PAD_T = 16,
      PAD_B = 30;
    if (!tickerSeries.size) {
      return /*#__PURE__*/React.createElement("svg", {
        "data-testid": "signals-chart",
        viewBox: `0 0 ${W} ${H}`,
        preserveAspectRatio: "xMidYMid meet",
        style: {
          width: "100%",
          height: "auto",
          display: "block"
        }
      }, /*#__PURE__*/React.createElement("text", {
        x: W / 2,
        y: H / 2,
        fill: "var(--muted)",
        fontSize: "14",
        textAnchor: "middle"
      }, "no data in range"));
    }

    // Compute time domain across all selected tickers.
    var tMin = Infinity,
      tMax = -Infinity,
      mMax = 0;
    for (var series of tickerSeries.values()) {
      for (var i = 0; i < series.length; i++) {
        if (series[i].t < tMin) tMin = series[i].t;
        if (series[i].t > tMax) tMax = series[i].t;
        if (series[i].mentions > mMax) mMax = series[i].mentions;
      }
    }
    if (tMax === tMin) tMax = tMin + DAY_MS;
    if (mMax === 0) mMax = 1;
    var xFor = t => PAD_L + (t - tMin) / (tMax - tMin) * (W - PAD_L - PAD_R);
    var ySent = v => PAD_T + (1 - Math.max(0, Math.min(1, v))) * (H - PAD_T - PAD_B);
    var yMent = v => H - PAD_B - v / mMax * (H - PAD_T - PAD_B);

    // gridlines + axis labels
    var yTicks = [0, 0.25, 0.5, 0.75, 1];
    var xTickCount = 5;
    var xTicks = Array.from({
      length: xTickCount
    }, (_, i) => tMin + i / (xTickCount - 1) * (tMax - tMin));
    var fmtDate = t => {
      var d = new Date(t);
      return `${String(d.getUTCMonth() + 1).padStart(2, "0")}/${String(d.getUTCDate()).padStart(2, "0")}`;
    };

    // mention bars — pick first selected ticker for the bar series (low-opacity backdrop).
    var firstTicker = Array.from(tickerSeries.keys())[0];
    var firstSeries = tickerSeries.get(firstTicker) || [];
    var barW = firstSeries.length > 1 ? Math.max(2, (W - PAD_L - PAD_R) / firstSeries.length - 2) : 8;
    var tickerEntries = Array.from(tickerSeries.entries());
    return /*#__PURE__*/React.createElement("svg", {
      "data-testid": "signals-chart",
      viewBox: `0 0 ${W} ${H}`,
      preserveAspectRatio: "xMidYMid meet",
      style: {
        width: "100%",
        height: "auto",
        display: "block"
      }
    }, yTicks.map((v, i) => /*#__PURE__*/React.createElement("g", {
      key: `gy${i}`
    }, /*#__PURE__*/React.createElement("line", {
      x1: PAD_L,
      x2: W - PAD_R,
      y1: ySent(v),
      y2: ySent(v),
      stroke: "var(--line)",
      strokeDasharray: "2 4"
    }), /*#__PURE__*/React.createElement("text", {
      x: PAD_L - 6,
      y: ySent(v) + 3,
      fill: "var(--muted)",
      fontSize: "10",
      textAnchor: "end",
      fontFamily: "var(--mono)"
    }, v.toFixed(2)))), yTicks.map((v, i) => /*#__PURE__*/React.createElement("text", {
      key: `gym${i}`,
      x: W - PAD_R + 6,
      y: yMent(v * mMax) + 3,
      fill: "var(--muted)",
      fontSize: "10",
      textAnchor: "start",
      fontFamily: "var(--mono)"
    }, Math.round(v * mMax))), xTicks.map((t, i) => /*#__PURE__*/React.createElement("text", {
      key: `tx${i}`,
      x: xFor(t),
      y: H - 8,
      fill: "var(--muted)",
      fontSize: "10",
      textAnchor: "middle",
      fontFamily: "var(--mono)"
    }, fmtDate(t))), firstSeries.map((d, i) => /*#__PURE__*/React.createElement("rect", {
      key: `b${i}`,
      x: xFor(d.t) - barW / 2,
      y: yMent(d.mentions),
      width: barW,
      height: H - PAD_B - yMent(d.mentions),
      fill: "var(--info)",
      opacity: "0.12"
    })), tickerEntries.map(([tk, series], idx) => {
      var stroke = strokes[idx % strokes.length];
      var pts = series.map(d => `${xFor(d.t)},${ySent(d.bull_share)}`).join(" ");
      return /*#__PURE__*/React.createElement("polyline", {
        key: tk,
        "data-ticker": tk,
        points: pts,
        fill: "none",
        stroke: stroke,
        strokeWidth: "1.8",
        strokeLinejoin: "round",
        strokeLinecap: "round"
      });
    }), /*#__PURE__*/React.createElement("text", {
      x: PAD_L,
      y: PAD_T - 2,
      fill: "var(--muted)",
      fontSize: "10",
      fontFamily: "var(--mono)"
    }, "bull_share"), /*#__PURE__*/React.createElement("text", {
      x: W - PAD_R,
      y: PAD_T - 2,
      fill: "var(--muted)",
      fontSize: "10",
      fontFamily: "var(--mono)",
      textAnchor: "end"
    }, "mentions"));
  }

  // ---------- theme drilldown side-sheet ----------

  function ThemeSidesheet({
    theme,
    onClose
  }) {
    useEffect(() => {
      if (!theme) return undefined;
      var onKey = e => {
        if (e.key === "Escape") onClose();
      };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }, [theme, onClose]);
    var open = !!theme;
    var overlayStyle = {
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.45)",
      opacity: open ? 1 : 0,
      pointerEvents: open ? "auto" : "none",
      transition: "opacity 180ms ease",
      zIndex: 90
    };
    var sheetStyle = {
      position: "fixed",
      top: 0,
      right: 0,
      bottom: 0,
      width: "min(420px, 100%)",
      background: "var(--surface)",
      borderLeft: "1px solid var(--line)",
      transform: open ? "translateX(0)" : "translateX(100%)",
      transition: "transform 220ms ease",
      zIndex: 91,
      overflowY: "auto",
      padding: 16,
      boxSizing: "border-box"
    };
    return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
      style: overlayStyle,
      onClick: onClose,
      "aria-hidden": !open
    }), /*#__PURE__*/React.createElement("aside", {
      "data-testid": "theme-sidesheet",
      "aria-hidden": open ? "false" : "true",
      style: sheetStyle
    }, theme && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 12
      }
    }, /*#__PURE__*/React.createElement("h3", {
      style: {
        margin: 0
      }
    }, theme.theme), /*#__PURE__*/React.createElement("button", {
      onClick: onClose,
      className: "icon-btn",
      style: {
        background: "transparent",
        border: "1px solid var(--line)",
        color: "var(--text)",
        borderRadius: 6,
        padding: "4px 8px",
        cursor: "pointer"
      }
    }, "\u2715")), /*#__PURE__*/React.createElement("div", {
      style: {
        marginBottom: 12
      }
    }, (theme.tickers || []).map(t => /*#__PURE__*/React.createElement("span", {
      key: t,
      className: "chip",
      style: {
        marginRight: 6
      }
    }, t))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "grid",
        gap: 8
      }
    }, (theme.evidence_posts || []).map(p => /*#__PURE__*/React.createElement("a", {
      key: p.id,
      href: p.url,
      target: "_blank",
      rel: "noreferrer",
      style: {
        display: "block",
        padding: 10,
        border: "1px solid var(--line)",
        borderRadius: 6,
        color: "var(--text)",
        textDecoration: "none"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontWeight: 600,
        fontSize: 13
      }
    }, p.title), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 11,
        color: "var(--muted)",
        marginTop: 4
      }
    }, "r/", p.subreddit, " \xB7 score ", p.score, " \xB7 ", p.created_utc)))))));
  }

  // ---------- main page ----------

  function SignalsPage() {
    var isMobile = useIsMobile(820);
    var [rangeKey, setRangeKey] = useState("30d");
    var [selectedTickers, setSelectedTickers] = useState([]);
    var [tickerQuery, setTickerQuery] = useState("");
    var [subFilter, setSubFilter] = useState(""); // empty = all
    var [openTheme, setOpenTheme] = useState(null);
    var allTickers = useMemo(() => window.SBClient ? window.SBClient.tickers() : [], []);
    var allSubs = useMemo(() => window.SBClient ? window.SBClient.subreddits() : [], []);
    var themes = useMemo(() => window.SBClient ? window.SBClient.themes() : [], []);
    var sinceE = useMemo(() => {
      var days = RANGE_DAYS[rangeKey] || 30;
      return Date.now() - days * DAY_MS;
    }, [rangeKey]);

    // Pull range-bounded rows once. NB: fixture's anchor date may be in the
    // past relative to "now"; we therefore fall back to the dataset's own
    // tail when no rows fall inside [now-Nd, now].
    var rangeRows = useMemo(() => {
      if (!window.SBClient) return [];
      var rows = window.SBClient.history({
        since: sinceE
      });
      if (rows.length === 0) {
        // Anchor to the most-recent built_at present in the dataset.
        var all = window.SBClient.history({});
        if (all.length === 0) return [];
        var maxT = 0;
        for (var i = 0; i < all.length; i++) {
          var t = Date.parse(all[i].built_at);
          if (t > maxT) maxT = t;
        }
        var days = RANGE_DAYS[rangeKey] || 30;
        rows = window.SBClient.history({
          since: maxT - days * DAY_MS,
          until: maxT
        });
      }
      if (subFilter) {
        rows = rows.filter(r => r.payload && r.payload.top_subreddit === subFilter);
      }
      return rows;
    }, [sinceE, subFilter, rangeKey]);

    // Effective selection: default top-5 by mentions when empty; collapse to
    // single ticker on mobile (per PRD AC7).
    var effectiveTickers = useMemo(() => {
      var sel = selectedTickers;
      if (sel.length === 0) sel = topTickersByMentions(rangeRows, 5);
      if (isMobile && sel.length > 1) sel = sel.slice(0, 1);
      return sel;
    }, [selectedTickers, rangeRows, isMobile]);

    // Filter rows to selected tickers + group.
    var visibleRows = useMemo(() => {
      if (effectiveTickers.length === 0) return [];
      var set = new Set(effectiveTickers);
      return rangeRows.filter(r => set.has(r.ticker));
    }, [rangeRows, effectiveTickers]);
    var tickerSeries = useMemo(() => groupByTicker(visibleRows), [visibleRows]);

    // Autocomplete suggestion list.
    var suggestions = useMemo(() => {
      var q = tickerQuery.trim().toUpperCase();
      if (!q) return [];
      return allTickers.filter(t => t.startsWith(q) && !selectedTickers.includes(t)).slice(0, 8);
    }, [tickerQuery, allTickers, selectedTickers]);
    var addTicker = t => {
      if (selectedTickers.includes(t)) return;
      setSelectedTickers([...selectedTickers, t]);
      setTickerQuery("");
    };
    var removeTicker = t => setSelectedTickers(selectedTickers.filter(x => x !== t));
    var onSelectSingle = t => setSelectedTickers(t ? [t] : []);
    return /*#__PURE__*/React.createElement("main", {
      className: "shell",
      "data-testid": "signals-page"
    }, /*#__PURE__*/React.createElement("div", {
      className: "card"
    }, /*#__PURE__*/React.createElement(window.CardHead, {
      title: "Signals \xB7 sentiment & mentions time series"
    }, /*#__PURE__*/React.createElement("div", {
      className: "tf",
      role: "radiogroup",
      "aria-label": "Time range"
    }, Object.keys(RANGE_DAYS).map(k => /*#__PURE__*/React.createElement("button", {
      key: k,
      className: rangeKey === k ? "active" : "",
      onClick: () => setRangeKey(k),
      "data-testid": `range-${k}`
    }, k)))), /*#__PURE__*/React.createElement("div", {
      className: "card-body"
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "grid",
        gap: 12,
        gridTemplateColumns: isMobile ? "1fr" : "1.5fr 1fr auto",
        alignItems: "start",
        marginBottom: 16
      }
    }, isMobile ? /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
      style: {
        display: "block",
        fontSize: 11,
        color: "var(--muted)",
        marginBottom: 4
      }
    }, "Ticker"), /*#__PURE__*/React.createElement("select", {
      "data-testid": "ticker-single-mobile",
      value: effectiveTickers[0] || "",
      onChange: e => onSelectSingle(e.target.value),
      style: {
        width: "100%",
        padding: 10,
        background: "var(--surface-2)",
        color: "var(--text)",
        border: "1px solid var(--line)",
        borderRadius: 6
      }
    }, /*#__PURE__*/React.createElement("option", {
      value: ""
    }, "(top by mentions)"), allTickers.map(t => /*#__PURE__*/React.createElement("option", {
      key: t,
      value: t
    }, t)))) : /*#__PURE__*/React.createElement("div", {
      "data-testid": "ticker-multi-desktop"
    }, /*#__PURE__*/React.createElement("label", {
      style: {
        display: "block",
        fontSize: 11,
        color: "var(--muted)",
        marginBottom: 4
      }
    }, "Tickers (type to add; leave empty for top 5)"), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexWrap: "wrap",
        gap: 6,
        padding: 6,
        border: "1px solid var(--line)",
        borderRadius: 6,
        background: "var(--surface-2)"
      }
    }, selectedTickers.map(t => /*#__PURE__*/React.createElement("span", {
      key: t,
      className: "chip",
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 6
      }
    }, t, /*#__PURE__*/React.createElement("button", {
      onClick: () => removeTicker(t),
      "aria-label": `Remove ${t}`,
      style: {
        background: "transparent",
        border: "none",
        color: "var(--muted)",
        cursor: "pointer",
        padding: 0
      }
    }, "\xD7"))), /*#__PURE__*/React.createElement("input", {
      value: tickerQuery,
      onChange: e => setTickerQuery(e.target.value),
      onKeyDown: e => {
        if (e.key === "Enter" && suggestions[0]) addTicker(suggestions[0]);
      },
      placeholder: "e.g. NVDA",
      style: {
        flex: "1 1 80px",
        minWidth: 80,
        background: "transparent",
        color: "var(--text)",
        border: "none",
        outline: "none",
        padding: 4
      }
    })), suggestions.length > 0 && /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 4,
        border: "1px solid var(--line)",
        borderRadius: 6,
        background: "var(--surface)",
        maxHeight: 160,
        overflowY: "auto"
      }
    }, suggestions.map(t => /*#__PURE__*/React.createElement("div", {
      key: t,
      onClick: () => addTicker(t),
      style: {
        padding: "6px 10px",
        cursor: "pointer",
        fontFamily: "var(--mono)"
      }
    }, t)))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
      style: {
        display: "block",
        fontSize: 11,
        color: "var(--muted)",
        marginBottom: 4
      }
    }, "Subreddit overlay"), isMobile ? /*#__PURE__*/React.createElement("select", {
      value: subFilter,
      onChange: e => setSubFilter(e.target.value),
      style: {
        width: "100%",
        padding: 10,
        background: "var(--surface-2)",
        color: "var(--text)",
        border: "1px solid var(--line)",
        borderRadius: 6
      }
    }, /*#__PURE__*/React.createElement("option", {
      value: ""
    }, "all subs"), allSubs.map(s => /*#__PURE__*/React.createElement("option", {
      key: s,
      value: s
    }, "r/", s))) : /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexWrap: "wrap",
        gap: 10,
        alignItems: "center"
      }
    }, /*#__PURE__*/React.createElement("label", {
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 12
      }
    }, /*#__PURE__*/React.createElement("input", {
      type: "radio",
      name: "sub",
      checked: subFilter === "",
      onChange: () => setSubFilter("")
    }), "all"), allSubs.map(s => /*#__PURE__*/React.createElement("label", {
      key: s,
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 12
      }
    }, /*#__PURE__*/React.createElement("input", {
      type: "radio",
      name: "sub",
      checked: subFilter === s,
      onChange: () => setSubFilter(s)
    }), "r/", s)))), /*#__PURE__*/React.createElement("div", {
      style: {
        alignSelf: "end"
      }
    }, /*#__PURE__*/React.createElement("button", {
      onClick: () => downloadCsv(visibleRows, rangeKey),
      "data-testid": "csv-export",
      className: "bmc-btn",
      style: {
        minHeight: 36,
        padding: "8px 14px"
      }
    }, "Export CSV"))), /*#__PURE__*/React.createElement(SignalsChart, {
      tickerSeries: tickerSeries,
      strokes: STROKES
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexWrap: "wrap",
        gap: 12,
        marginTop: 8,
        fontSize: 11,
        color: "var(--muted)"
      }
    }, Array.from(tickerSeries.keys()).map((tk, idx) => /*#__PURE__*/React.createElement("span", {
      key: tk,
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 4
      }
    }, /*#__PURE__*/React.createElement("i", {
      style: {
        width: 10,
        height: 10,
        borderRadius: 2,
        background: STROKES[idx % STROKES.length],
        display: "inline-block"
      }
    }), tk)), /*#__PURE__*/React.createElement("span", {
      style: {
        marginLeft: "auto"
      }
    }, visibleRows.length, " rows \xB7 range ", rangeKey)))), /*#__PURE__*/React.createElement("div", {
      className: "card",
      style: {
        marginTop: 12
      }
    }, /*#__PURE__*/React.createElement(window.CardHead, {
      title: "Themes \xB7 click to drill down"
    }, /*#__PURE__*/React.createElement("span", {
      className: "mono",
      style: {
        fontSize: 10,
        color: "var(--muted)"
      }
    }, themes.length, " themes")), /*#__PURE__*/React.createElement("div", {
      className: "card-body"
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "grid",
        gap: 8,
        gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(260px, 1fr))"
      }
    }, themes.map(th => /*#__PURE__*/React.createElement("button", {
      key: th.theme,
      "data-testid": "theme-card",
      onClick: () => setOpenTheme(th),
      style: {
        textAlign: "left",
        padding: 12,
        border: "1px solid var(--line)",
        borderRadius: 8,
        background: "var(--surface-2)",
        color: "var(--text)",
        cursor: "pointer",
        minHeight: 44
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontWeight: 600,
        marginBottom: 4
      }
    }, th.theme), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 11,
        color: "var(--muted)"
      }
    }, (th.tickers || []).join(" · ")), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 10,
        color: "var(--muted)",
        marginTop: 4
      }
    }, (th.evidence_posts || []).length, " posts")))))), /*#__PURE__*/React.createElement(ThemeSidesheet, {
      theme: openTheme,
      onClose: () => setOpenTheme(null)
    }));
  }
  window.SignalsPage = SignalsPage;
})();

/* ---- pages/optimization-tab.jsx ---- */
/* global React, OptimizationClient */
/* dashboard/pages/optimization-tab.jsx — PRD 47 Optimization tab.
 *
 * Reads window.OptimizationClient (dashboard/lib/optimization-client.js) which
 * either POSTs to the trader's loopback optimization API (discovered via
 * health-probe across 127.0.0.1:8787/8791/8765) or, when `?fixture=opt`,
 * resolves against window.OPTIMIZATION_FIXTURE.
 *
 * Mobile (<=820px): heatmap collapses to a list view. A/B view stacks.
 */
(function () {
  "use strict";

  var {
    useState,
    useMemo,
    useEffect
  } = React;

  // ---- helpers ------------------------------------------------------------

  function useIsMobile(bp) {
    var [m, setM] = useState(typeof window !== "undefined" ? window.innerWidth <= bp : false);
    useEffect(() => {
      var onR = () => setM(window.innerWidth <= bp);
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
      var _t = Math.max(0, Math.min(1, metric));
      // 0 → red, 0.5 → gray, 1 → green
      var _g = Math.round(80 + _t * 140);
      var _r = Math.round(220 - _t * 140);
      return `rgb(${_r},${_g},90)`;
    }
    if (kind === "max_drawdown") {
      // Less negative is better. Domain [-0.25, 0].
      var _t2 = Math.max(0, Math.min(1, (0.25 + metric) / 0.25));
      var _g2 = Math.round(80 + _t2 * 140);
      var _r2 = Math.round(220 - _t2 * 140);
      return `rgb(${_r2},${_g2},90)`;
    }
    // sharpe
    var t = Math.max(-1, Math.min(2.5, metric));
    if (t < 0) {
      var _k = (t + 1) / 1; // 0..1
      var _r3 = Math.round(180 + (1 - _k) * 60);
      var _g3 = Math.round(70 + _k * 100);
      return `rgb(${_r3},${_g3},80)`;
    }
    var k = Math.min(1, t / 2.5);
    var r = Math.round(180 - k * 120);
    var g = Math.round(170 + k * 60);
    return `rgb(${r},${g},90)`;
  }
  function fmtParams(p) {
    return Object.keys(p).map(k => `${k}=${typeof p[k] === "number" ? p[k] : JSON.stringify(p[k])}`).join(" ");
  }

  // ---- heatmap ------------------------------------------------------------

  function Heatmap({
    result,
    colorKind,
    onCellHover
  }) {
    // Detect param axes from the first cell.
    if (!result || !result.cells || !result.cells.length) {
      return /*#__PURE__*/React.createElement("div", {
        className: "dim",
        style: {
          padding: 16
        }
      }, "no cells");
    }
    var cell0 = result.cells[0];
    var paramKeys = Object.keys(cell0.params);
    var xKey = paramKeys[0];
    var yKey = paramKeys[1] || paramKeys[0];
    var xVals = Array.from(new Set(result.cells.map(c => c.params[xKey]))).sort((a, b) => a - b);
    var yVals = Array.from(new Set(result.cells.map(c => c.params[yKey]))).sort((a, b) => a - b);
    var CELL = 64;
    var PAD_L = 60;
    var PAD_T = 28;
    var W = PAD_L + xVals.length * CELL + 16;
    var H = PAD_T + yVals.length * CELL + 24;
    var lookup = new Map();
    for (var c of result.cells) {
      lookup.set(`${c.params[xKey]}|${c.params[yKey]}`, c);
    }
    return /*#__PURE__*/React.createElement("svg", {
      "data-testid": "opt-heatmap",
      viewBox: `0 0 ${W} ${H}`,
      preserveAspectRatio: "xMidYMid meet",
      style: {
        width: "100%",
        height: "auto",
        maxWidth: 720,
        display: "block"
      }
    }, yVals.map((yv, j) => /*#__PURE__*/React.createElement("text", {
      key: `yl${j}`,
      x: PAD_L - 8,
      y: PAD_T + j * CELL + CELL / 2 + 4,
      fill: "var(--muted)",
      fontSize: "10",
      fontFamily: "var(--mono)",
      textAnchor: "end"
    }, yv)), xVals.map((xv, i) => /*#__PURE__*/React.createElement("text", {
      key: `xl${i}`,
      x: PAD_L + i * CELL + CELL / 2,
      y: PAD_T - 8,
      fill: "var(--muted)",
      fontSize: "10",
      fontFamily: "var(--mono)",
      textAnchor: "middle"
    }, xv)), /*#__PURE__*/React.createElement("text", {
      x: PAD_L + xVals.length * CELL / 2,
      y: H - 6,
      fill: "var(--muted)",
      fontSize: "10",
      fontFamily: "var(--mono)",
      textAnchor: "middle"
    }, xKey), /*#__PURE__*/React.createElement("text", {
      x: 10,
      y: PAD_T + yVals.length * CELL / 2,
      fill: "var(--muted)",
      fontSize: "10",
      fontFamily: "var(--mono)",
      textAnchor: "middle",
      transform: `rotate(-90, 10, ${PAD_T + yVals.length * CELL / 2})`
    }, yKey), yVals.map((yv, j) => xVals.map((xv, i) => {
      var c = lookup.get(`${xv}|${yv}`);
      if (!c) return null;
      var metric = c[colorKind] != null ? c[colorKind] : c.sharpe;
      return /*#__PURE__*/React.createElement("g", {
        key: `c${i}_${j}`,
        onMouseEnter: () => onCellHover && onCellHover(c),
        onMouseLeave: () => onCellHover && onCellHover(null)
      }, /*#__PURE__*/React.createElement("rect", {
        x: PAD_L + i * CELL + 2,
        y: PAD_T + j * CELL + 2,
        width: CELL - 4,
        height: CELL - 4,
        fill: colorFor(metric, colorKind),
        stroke: "var(--line)",
        strokeWidth: "0.5",
        rx: "3"
      }), /*#__PURE__*/React.createElement("text", {
        x: PAD_L + i * CELL + CELL / 2,
        y: PAD_T + j * CELL + CELL / 2 + 4,
        fill: "#111",
        fontSize: "11",
        fontFamily: "var(--mono)",
        textAnchor: "middle"
      }, typeof metric === "number" ? metric.toFixed(2) : "—"));
    })));
  }

  // Mobile fallback for the heatmap — flat list of cells.
  function HeatmapList({
    result,
    onCellHover
  }) {
    if (!result || !result.cells || !result.cells.length) return null;
    return /*#__PURE__*/React.createElement("div", {
      "data-testid": "opt-heatmap-list"
    }, result.cells.map((c, i) => /*#__PURE__*/React.createElement("div", {
      key: i,
      onMouseEnter: () => onCellHover && onCellHover(c),
      onClick: () => onCellHover && onCellHover(c),
      style: {
        padding: 10,
        borderBottom: "1px solid var(--line)",
        display: "grid",
        gridTemplateColumns: "1fr auto",
        gap: 8,
        alignItems: "center"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: "var(--mono)",
        fontSize: 12
      }
    }, fmtParams(c.params)), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 8,
        fontFamily: "var(--mono)",
        fontSize: 11
      }
    }, /*#__PURE__*/React.createElement("span", null, "S ", c.sharpe.toFixed(2)), /*#__PURE__*/React.createElement("span", {
      style: {
        color: "var(--muted)"
      }
    }, "W ", (c.win_rate * 100).toFixed(0), "%"), /*#__PURE__*/React.createElement("span", {
      style: {
        color: "var(--neg)"
      }
    }, "DD ", (c.max_drawdown * 100).toFixed(1), "%")))));
  }

  // ---- A/B equity curves --------------------------------------------------

  function ABEquity({
    resultA,
    resultB
  }) {
    var W = 720,
      H = 240,
      PAD_L = 48,
      PAD_R = 16,
      PAD_T = 12,
      PAD_B = 26;
    var curveA = resultA && resultA.winner ? (resultA.cells.find(c => c.params === resultA.cells.find(x => x.sharpe === resultA.winner.sharpe).params) || resultA.cells[0]).equity_curve : null;
    // Simpler: pick the winning cell by matching sharpe.
    function winnerCurve(r) {
      if (!r || !r.cells || !r.winner) return null;
      var w = r.cells.find(c => c.sharpe === r.winner.sharpe);
      return w ? w.equity_curve : null;
    }
    var cA = winnerCurve(resultA);
    var cB = winnerCurve(resultB);
    var curves = [cA, cB].filter(Boolean);
    if (curves.length === 0) {
      return /*#__PURE__*/React.createElement("svg", {
        "data-testid": "opt-ab-equity",
        viewBox: `0 0 ${W} ${H}`,
        style: {
          width: "100%",
          height: "auto"
        }
      }, /*#__PURE__*/React.createElement("text", {
        x: W / 2,
        y: H / 2,
        fill: "var(--muted)",
        textAnchor: "middle",
        fontSize: "12"
      }, "run sweeps for both sleeves"));
    }
    var vMin = Infinity,
      vMax = -Infinity;
    var maxLen = Math.max(...curves.map(c => c.length));
    for (var c of curves) {
      for (var p of c) {
        if (p.v < vMin) vMin = p.v;
        if (p.v > vMax) vMax = p.v;
      }
    }
    if (vMax === vMin) vMax = vMin + 1;
    var xFor = i => PAD_L + i / Math.max(1, maxLen - 1) * (W - PAD_L - PAD_R);
    var yFor = v => PAD_T + (1 - (v - vMin) / (vMax - vMin)) * (H - PAD_T - PAD_B);
    var strokes = ["var(--pos)", "var(--info)"];
    return /*#__PURE__*/React.createElement("svg", {
      "data-testid": "opt-ab-equity",
      viewBox: `0 0 ${W} ${H}`,
      preserveAspectRatio: "xMidYMid meet",
      style: {
        width: "100%",
        height: "auto",
        display: "block"
      }
    }, [0, 0.25, 0.5, 0.75, 1].map(g => {
      var v = vMin + (1 - g) * (vMax - vMin);
      return /*#__PURE__*/React.createElement("g", {
        key: g
      }, /*#__PURE__*/React.createElement("line", {
        x1: PAD_L,
        x2: W - PAD_R,
        y1: yFor(v),
        y2: yFor(v),
        stroke: "var(--line)",
        strokeDasharray: "2 4"
      }), /*#__PURE__*/React.createElement("text", {
        x: PAD_L - 6,
        y: yFor(v) + 3,
        fill: "var(--muted)",
        fontSize: "10",
        fontFamily: "var(--mono)",
        textAnchor: "end"
      }, v.toFixed(0)));
    }), [cA, cB].map((c, idx) => {
      if (!c) return null;
      var pts = c.map((p, i) => `${xFor(i)},${yFor(p.v)}`).join(" ");
      return /*#__PURE__*/React.createElement("polyline", {
        key: idx,
        points: pts,
        fill: "none",
        stroke: strokes[idx],
        strokeWidth: "2",
        strokeLinejoin: "round",
        strokeLinecap: "round"
      });
    }));
  }

  // ---- promote modal ------------------------------------------------------

  function PromoteModal({
    open,
    onClose,
    sleeveId,
    params,
    onConfirm,
    busy,
    error
  }) {
    if (!open) return null;
    return /*#__PURE__*/React.createElement("div", {
      role: "dialog",
      "aria-modal": "true",
      "data-testid": "opt-promote-modal",
      style: {
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        background: "var(--surface)",
        border: "1px solid var(--line)",
        borderRadius: 10,
        padding: 20,
        maxWidth: 460,
        width: "90%"
      }
    }, /*#__PURE__*/React.createElement("h3", {
      style: {
        marginTop: 0
      }
    }, "Promote to LIVE?"), /*#__PURE__*/React.createElement("p", {
      style: {
        fontFamily: "var(--mono)",
        fontSize: 13,
        color: "var(--text)"
      }
    }, sleeveId, " \xB7 ", fmtParams(params)), error && /*#__PURE__*/React.createElement("div", {
      style: {
        color: "var(--neg)",
        fontSize: 12,
        marginBottom: 8
      }
    }, String(error)), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 8,
        justifyContent: "flex-end"
      }
    }, /*#__PURE__*/React.createElement("button", {
      onClick: onClose,
      disabled: busy,
      style: {
        padding: "8px 14px",
        background: "transparent",
        color: "var(--text)",
        border: "1px solid var(--line)",
        borderRadius: 6,
        cursor: "pointer"
      }
    }, "Cancel"), /*#__PURE__*/React.createElement("button", {
      onClick: onConfirm,
      disabled: busy,
      "data-testid": "opt-promote-confirm",
      style: {
        padding: "8px 14px",
        background: "var(--pos)",
        color: "#111",
        border: "none",
        borderRadius: 6,
        cursor: busy ? "wait" : "pointer",
        fontWeight: 600
      }
    }, busy ? "Promoting…" : "Promote to LIVE"))));
  }

  // ---- main page ----------------------------------------------------------

  // ---- Variants subtab (PRD 72) ------------------------------------------

  function VariantEvaluation({
    client,
    isMobile
  }) {
    var [variants, setVariants] = useState([]);
    var [selected, setSelected] = useState([]);
    var [fromDate, setFromDate] = useState("2026-04-01");
    var [toDate, setToDate] = useState("2026-05-23");
    var [rows, setRows] = useState(null);
    var [busy, setBusy] = useState(false);
    var [error, setError] = useState(null);
    useEffect(() => {
      var cancelled = false;
      async function load() {
        try {
          var res = await client.listVariants();
          if (cancelled) return;
          var list = res && res.variants || [];
          setVariants(list);
          // Default-select up to 3 variants so the chart renders something
          // useful before the operator clicks anything.
          setSelected(list.slice(0, 3).map(v => v.id));
        } catch (e) {
          if (!cancelled) setError(e.message || String(e));
        }
      }
      load();
      return () => {
        cancelled = true;
      };
    }, []);
    function toggleVariant(id) {
      setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
    }
    async function runEval() {
      if (!selected.length) return;
      setBusy(true);
      setError(null);
      try {
        var res = await client.evaluateVariants(selected, fromDate, toDate, "earnings");
        setRows(res.rows || []);
      } catch (e) {
        setError(e.message || String(e));
      } finally {
        setBusy(false);
      }
    }
    var sortedRows = useMemo(() => {
      if (!rows) return [];
      return [...rows].sort((a, b) => (b.sharpe || 0) - (a.sharpe || 0));
    }, [rows]);
    return /*#__PURE__*/React.createElement("div", {
      "data-testid": "variants-subtab"
    }, /*#__PURE__*/React.createElement("div", {
      className: "card"
    }, /*#__PURE__*/React.createElement(window.CardHead, {
      title: "Variants \xB7 side-by-side evaluation"
    }), /*#__PURE__*/React.createElement("div", {
      className: "card-body"
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "grid",
        gap: 12,
        gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr auto",
        alignItems: "end",
        marginBottom: 12
      }
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
      style: {
        display: "block",
        fontSize: 11,
        color: "var(--muted)",
        marginBottom: 4
      }
    }, "From"), /*#__PURE__*/React.createElement("input", {
      type: "date",
      value: fromDate,
      "data-testid": "variants-from",
      onChange: e => setFromDate(e.target.value),
      style: inputStyle()
    })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
      style: {
        display: "block",
        fontSize: 11,
        color: "var(--muted)",
        marginBottom: 4
      }
    }, "To"), /*#__PURE__*/React.createElement("input", {
      type: "date",
      value: toDate,
      "data-testid": "variants-to",
      onChange: e => setToDate(e.target.value),
      style: inputStyle()
    })), /*#__PURE__*/React.createElement("button", {
      onClick: runEval,
      disabled: busy || selected.length === 0,
      "data-testid": "variants-run",
      className: "bmc-btn",
      style: {
        minHeight: 36,
        padding: "8px 14px"
      }
    }, busy ? "Evaluating…" : "Run evaluation")), /*#__PURE__*/React.createElement("div", {
      style: {
        marginBottom: 12
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 11,
        color: "var(--muted)",
        marginBottom: 6
      }
    }, "Variants (", selected.length, " selected)"), /*#__PURE__*/React.createElement("div", {
      "data-testid": "variants-multiselect",
      style: {
        display: "flex",
        flexWrap: "wrap",
        gap: 6
      }
    }, variants.map(v => {
      var on = selected.includes(v.id);
      return /*#__PURE__*/React.createElement("button", {
        key: v.id,
        "data-testid": `variants-toggle-${v.id}`,
        onClick: () => toggleVariant(v.id),
        style: {
          padding: "6px 10px",
          fontSize: 11,
          fontFamily: "var(--mono)",
          background: on ? "var(--surface-2)" : "transparent",
          border: "1px solid var(--line)",
          borderRadius: 6,
          color: on ? "var(--text)" : "var(--muted)",
          cursor: "pointer"
        }
      }, v.id);
    }))), error && /*#__PURE__*/React.createElement("div", {
      "data-testid": "variants-error",
      style: {
        color: "var(--neg)",
        fontSize: 12,
        marginBottom: 8
      }
    }, error), /*#__PURE__*/React.createElement(VariantEquityOverlay, {
      rows: rows
    }), sortedRows.length > 0 && /*#__PURE__*/React.createElement("table", {
      "data-testid": "variants-results-table",
      style: {
        width: "100%",
        marginTop: 12,
        fontSize: 12,
        fontFamily: "var(--mono)",
        borderCollapse: "collapse"
      }
    }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", {
      style: {
        textAlign: "left",
        color: "var(--muted)"
      }
    }, /*#__PURE__*/React.createElement("th", {
      style: {
        padding: "6px 8px"
      }
    }, "variant"), /*#__PURE__*/React.createElement("th", {
      style: {
        padding: "6px 8px",
        textAlign: "right"
      }
    }, "n"), /*#__PURE__*/React.createElement("th", {
      style: {
        padding: "6px 8px",
        textAlign: "right"
      }
    }, "win %"), /*#__PURE__*/React.createElement("th", {
      style: {
        padding: "6px 8px",
        textAlign: "right"
      }
    }, "sharpe"), /*#__PURE__*/React.createElement("th", {
      style: {
        padding: "6px 8px",
        textAlign: "right"
      }
    }, "max dd"), /*#__PURE__*/React.createElement("th", {
      style: {
        padding: "6px 8px",
        textAlign: "right"
      }
    }, "final"))), /*#__PURE__*/React.createElement("tbody", null, sortedRows.map(r => /*#__PURE__*/React.createElement("tr", {
      key: r.variant_id,
      style: {
        borderTop: "1px solid var(--line)"
      }
    }, /*#__PURE__*/React.createElement("td", {
      style: {
        padding: "6px 8px"
      }
    }, r.variant_id), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: "6px 8px",
        textAlign: "right"
      }
    }, r.n_trades), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: "6px 8px",
        textAlign: "right"
      }
    }, (r.win_rate * 100).toFixed(1)), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: "6px 8px",
        textAlign: "right"
      }
    }, (r.sharpe || 0).toFixed(2)), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: "6px 8px",
        textAlign: "right",
        color: "var(--neg)"
      }
    }, (r.max_dd_pct * 100).toFixed(1)), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: "6px 8px",
        textAlign: "right",
        color: (r.final_equity_pct || 0) >= 0 ? "var(--pos)" : "var(--neg)"
      }
    }, ((r.final_equity_pct || 0) * 100).toFixed(1)))))))));
  }
  function VariantEquityOverlay({
    rows
  }) {
    var W = 720,
      H = 240,
      PAD_L = 48,
      PAD_R = 16,
      PAD_T = 12,
      PAD_B = 26;
    if (!rows || rows.length === 0) {
      return /*#__PURE__*/React.createElement("svg", {
        "data-testid": "variants-equity-overlay",
        viewBox: `0 0 ${W} ${H}`,
        style: {
          width: "100%",
          height: "auto"
        }
      }, /*#__PURE__*/React.createElement("text", {
        x: W / 2,
        y: H / 2,
        fill: "var(--muted)",
        textAnchor: "middle",
        fontSize: "12"
      }, "run an evaluation to see equity curves"));
    }
    var colors = ["var(--pos)", "var(--info)", "var(--warn)", "var(--neg)", "#a48ce6", "#3fbac2", "#e69a3a", "#7eb87e"];
    var vMin = Infinity,
      vMax = -Infinity;
    var maxLen = 0;
    rows.forEach(r => {
      var c = r.equity_curve || [];
      if (c.length > maxLen) maxLen = c.length;
      c.forEach(p => {
        if (p.equity < vMin) vMin = p.equity;
        if (p.equity > vMax) vMax = p.equity;
      });
    });
    if (!Number.isFinite(vMin)) {
      vMin = 0;
      vMax = 1;
    }
    if (vMax === vMin) vMax = vMin + 0.001;
    var xFor = i => PAD_L + i / Math.max(1, maxLen - 1) * (W - PAD_L - PAD_R);
    var yFor = v => PAD_T + (1 - (v - vMin) / (vMax - vMin)) * (H - PAD_T - PAD_B);
    return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("svg", {
      "data-testid": "variants-equity-overlay",
      viewBox: `0 0 ${W} ${H}`,
      preserveAspectRatio: "xMidYMid meet",
      style: {
        width: "100%",
        height: "auto",
        display: "block"
      }
    }, [0, 0.25, 0.5, 0.75, 1].map(g => {
      var v = vMin + (1 - g) * (vMax - vMin);
      return /*#__PURE__*/React.createElement("g", {
        key: g
      }, /*#__PURE__*/React.createElement("line", {
        x1: PAD_L,
        x2: W - PAD_R,
        y1: yFor(v),
        y2: yFor(v),
        stroke: "var(--line)",
        strokeDasharray: "2 4"
      }), /*#__PURE__*/React.createElement("text", {
        x: PAD_L - 6,
        y: yFor(v) + 3,
        fill: "var(--muted)",
        fontSize: "10",
        fontFamily: "var(--mono)",
        textAnchor: "end"
      }, v.toFixed(3)));
    }), rows.map((r, idx) => {
      var curve = r.equity_curve || [];
      if (!curve.length) return null;
      var pts = curve.map((p, i) => `${xFor(i)},${yFor(p.equity)}`).join(" ");
      return /*#__PURE__*/React.createElement("polyline", {
        key: r.variant_id,
        points: pts,
        fill: "none",
        stroke: colors[idx % colors.length],
        strokeWidth: "2",
        strokeLinejoin: "round",
        strokeLinecap: "round"
      });
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexWrap: "wrap",
        gap: 12,
        fontSize: 11,
        color: "var(--muted)",
        marginTop: 6
      }
    }, rows.map((r, idx) => /*#__PURE__*/React.createElement("span", {
      key: r.variant_id,
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 4
      }
    }, /*#__PURE__*/React.createElement("i", {
      style: {
        width: 10,
        height: 10,
        background: colors[idx % colors.length],
        display: "inline-block",
        borderRadius: 2
      }
    }), r.variant_id))));
  }
  function OptimizationPage() {
    var isMobile = useIsMobile(820);
    var client = window.OptimizationClient;
    var sleeves = client ? client.listSleeves() : [];
    var [subtab, setSubtab] = useState("sweep"); // "sweep" | "variants"

    var [sleeveId, setSleeveId] = useState(sleeves[0] || "OPT_FLOW");
    var [ranges, setRanges] = useState(() => initRanges(client, sleeves[0] || "OPT_FLOW"));
    var [colorKind, setColorKind] = useState("sharpe");
    var [hoverCell, setHoverCell] = useState(null);
    var [sweepResult, setSweepResult] = useState(null);
    var [sweepError, setSweepError] = useState(null);
    var [sweeping, setSweeping] = useState(false);
    var [promotedAt, setPromotedAt] = useState(null);

    // A/B state
    var [abLeft, setAbLeft] = useState(sleeves[0] || "OPT_FLOW");
    var [abRight, setAbRight] = useState(sleeves[1] || sleeves[0] || "BLEND_CONS");
    var [abResultA, setAbResultA] = useState(null);
    var [abResultB, setAbResultB] = useState(null);
    var [abBusy, setAbBusy] = useState(false);

    // Promote modal
    var [promoteOpen, setPromoteOpen] = useState(false);
    var [promoteBusy, setPromoteBusy] = useState(false);
    var [promoteError, setPromoteError] = useState(null);
    function initRanges(client, sid) {
      if (!client) return {};
      var schema = client.paramSchema(sid);
      var out = {};
      for (var k of Object.keys(schema)) out[k] = {
        ...schema[k]
      };
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
    var paramGrid = useMemo(() => {
      if (!client) return {};
      var out = {};
      for (var k of Object.keys(ranges)) {
        out[k] = client.rangeToValues(ranges[k].min, ranges[k].max, ranges[k].step);
      }
      return out;
    }, [ranges]);
    var gridN = useMemo(() => client ? client.gridSize(paramGrid) : 0, [paramGrid]);
    var overCap = client ? gridN > client.MAX_GRID : false;
    async function runSweep() {
      setSweeping(true);
      setSweepError(null);
      try {
        var res = await client.sweep(sleeveId, paramGrid, ["2026-02-22", "2026-05-22"]);
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
        var grid = sid => {
          var sch = client.paramSchema(sid);
          var g = {};
          for (var k of Object.keys(sch)) {
            g[k] = client.rangeToValues(sch[k].min, sch[k].max, sch[k].step * 3);
          }
          return g;
        };
        var range = ["2026-02-22", "2026-05-22"];
        var [a, b] = await Promise.all([client.sweep(abLeft, grid(abLeft), range), client.sweep(abRight, grid(abRight), range)]);
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
        var res = await client.promote(sleeveId, sweepResult.winner.params, sweepResult.sweep_id);
        setPromotedAt(res.entry ? res.entry.promoted_at : new Date().toISOString());
        setPromoteOpen(false);
      } catch (e) {
        setPromoteError(e.message || String(e));
      } finally {
        setPromoteBusy(false);
      }
    }
    if (!client) {
      return /*#__PURE__*/React.createElement("main", {
        className: "shell"
      }, /*#__PURE__*/React.createElement("div", {
        className: "card"
      }, /*#__PURE__*/React.createElement("div", {
        className: "card-body"
      }, "OptimizationClient missing \u2014 check optimization-client.js loaded.")));
    }
    return /*#__PURE__*/React.createElement("main", {
      className: "shell",
      "data-testid": "optimization-page"
    }, /*#__PURE__*/React.createElement("div", {
      "data-testid": "opt-subtab-switcher",
      role: "tablist",
      "aria-label": "Optimization view",
      style: {
        display: "flex",
        gap: 6,
        marginBottom: 12
      }
    }, [["sweep", "Sweep / A·B"], ["variants", "Variants"]].map(([id, label]) => /*#__PURE__*/React.createElement("button", {
      key: id,
      role: "tab",
      "aria-selected": subtab === id,
      "data-testid": `opt-subtab-${id}`,
      onClick: () => setSubtab(id),
      style: {
        padding: "6px 14px",
        background: subtab === id ? "var(--surface-2)" : "transparent",
        color: "var(--text)",
        border: "1px solid var(--line)",
        borderRadius: 6,
        cursor: "pointer",
        fontSize: 12
      }
    }, label))), subtab === "variants" && /*#__PURE__*/React.createElement(VariantEvaluation, {
      client: client,
      isMobile: isMobile
    }), subtab === "sweep" && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
      className: "card"
    }, /*#__PURE__*/React.createElement(window.CardHead, {
      title: "Optimization \xB7 sleeve parameter sweep"
    }, promotedAt && /*#__PURE__*/React.createElement("span", {
      className: "mono",
      style: {
        fontSize: 10,
        color: "var(--pos)"
      }
    }, "promoted ", promotedAt)), /*#__PURE__*/React.createElement("div", {
      className: "card-body"
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "grid",
        gap: 12,
        gridTemplateColumns: isMobile ? "1fr" : "180px 1fr auto",
        alignItems: "end",
        marginBottom: 16
      }
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
      style: {
        display: "block",
        fontSize: 11,
        color: "var(--muted)",
        marginBottom: 4
      }
    }, "Sleeve"), /*#__PURE__*/React.createElement("select", {
      value: sleeveId,
      "data-testid": "opt-sleeve-select",
      onChange: e => setSleeveId(e.target.value),
      style: {
        width: "100%",
        padding: 10,
        background: "var(--surface-2)",
        color: "var(--text)",
        border: "1px solid var(--line)",
        borderRadius: 6
      }
    }, sleeves.map(s => /*#__PURE__*/React.createElement("option", {
      key: s,
      value: s
    }, s)))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "grid",
        gap: 8,
        gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)"
      }
    }, Object.keys(ranges).map(k => /*#__PURE__*/React.createElement("div", {
      key: k,
      style: {
        padding: 8,
        border: "1px solid var(--line)",
        borderRadius: 6
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 11,
        color: "var(--muted)",
        marginBottom: 4
      }
    }, k), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 6,
        alignItems: "center"
      }
    }, /*#__PURE__*/React.createElement("input", {
      type: "number",
      value: ranges[k].min,
      step: ranges[k].step,
      "data-testid": `opt-range-${k}-min`,
      onChange: e => setRanges({
        ...ranges,
        [k]: {
          ...ranges[k],
          min: Number(e.target.value)
        }
      }),
      style: inputStyle()
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        color: "var(--muted)"
      }
    }, "\u2192"), /*#__PURE__*/React.createElement("input", {
      type: "number",
      value: ranges[k].max,
      step: ranges[k].step,
      "data-testid": `opt-range-${k}-max`,
      onChange: e => setRanges({
        ...ranges,
        [k]: {
          ...ranges[k],
          max: Number(e.target.value)
        }
      }),
      style: inputStyle()
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        color: "var(--muted)"
      }
    }, "step"), /*#__PURE__*/React.createElement("input", {
      type: "number",
      value: ranges[k].step,
      "data-testid": `opt-range-${k}-step`,
      onChange: e => setRanges({
        ...ranges,
        [k]: {
          ...ranges[k],
          step: Number(e.target.value)
        }
      }),
      style: inputStyle()
    }))))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "grid",
        gap: 6
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 11,
        fontFamily: "var(--mono)",
        color: overCap ? "var(--neg)" : "var(--muted)"
      }
    }, "grid size = ", gridN, " cells ", overCap && "(over 200)"), /*#__PURE__*/React.createElement("button", {
      onClick: runSweep,
      disabled: sweeping || overCap || gridN === 0,
      "data-testid": "opt-run-sweep",
      className: "bmc-btn",
      style: {
        minHeight: 36,
        padding: "8px 14px"
      }
    }, sweeping ? "Running…" : "Run Sweep"), sweeping && /*#__PURE__*/React.createElement("progress", {
      style: {
        width: "100%"
      }
    }))), sweepError && /*#__PURE__*/React.createElement("div", {
      "data-testid": "opt-error",
      style: {
        color: "var(--neg)",
        fontSize: 12,
        marginBottom: 8
      }
    }, sweepError), sweepResult && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 6,
        marginBottom: 8
      },
      role: "radiogroup",
      "aria-label": "color metric"
    }, ["sharpe", "win_rate", "max_drawdown"].map(k => /*#__PURE__*/React.createElement("button", {
      key: k,
      "data-testid": `opt-color-${k}`,
      onClick: () => setColorKind(k),
      className: colorKind === k ? "active" : "",
      style: {
        padding: "4px 10px",
        background: colorKind === k ? "var(--surface-2)" : "transparent",
        color: "var(--text)",
        border: "1px solid var(--line)",
        borderRadius: 6,
        cursor: "pointer",
        fontSize: 11
      }
    }, k))), isMobile ? /*#__PURE__*/React.createElement(HeatmapList, {
      result: sweepResult,
      onCellHover: setHoverCell
    }) : /*#__PURE__*/React.createElement(Heatmap, {
      result: sweepResult,
      colorKind: colorKind,
      onCellHover: setHoverCell
    }), hoverCell && /*#__PURE__*/React.createElement("div", {
      "data-testid": "opt-cell-tooltip",
      style: {
        marginTop: 8,
        padding: 10,
        border: "1px solid var(--line)",
        borderRadius: 6,
        fontFamily: "var(--mono)",
        fontSize: 11,
        display: "flex",
        flexWrap: "wrap",
        gap: 16
      }
    }, /*#__PURE__*/React.createElement("span", null, fmtParams(hoverCell.params)), /*#__PURE__*/React.createElement("span", null, "sharpe=", hoverCell.sharpe.toFixed(2)), /*#__PURE__*/React.createElement("span", null, "win=", (hoverCell.win_rate * 100).toFixed(0), "%"), /*#__PURE__*/React.createElement("span", null, "dd=", (hoverCell.max_drawdown * 100).toFixed(1), "%"), /*#__PURE__*/React.createElement("span", null, "n=", hoverCell.n_trades)), sweepResult.winner && /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 12,
        display: "flex",
        flexWrap: "wrap",
        gap: 12,
        alignItems: "center"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: "var(--mono)",
        fontSize: 12
      }
    }, "winner \xB7 ", fmtParams(sweepResult.winner.params), " \xB7 sharpe=", sweepResult.winner.sharpe.toFixed(2)), /*#__PURE__*/React.createElement("button", {
      onClick: () => setPromoteOpen(true),
      "data-testid": "opt-promote-open",
      className: "bmc-btn",
      style: {
        minHeight: 36,
        padding: "8px 14px"
      }
    }, "Promote winner to LIVE"))))), /*#__PURE__*/React.createElement("div", {
      className: "card",
      style: {
        marginTop: 12
      }
    }, /*#__PURE__*/React.createElement(window.CardHead, {
      title: "A/B \xB7 sleeve vs sleeve (winning-cell equity)"
    }, /*#__PURE__*/React.createElement("button", {
      onClick: runAB,
      disabled: abBusy,
      "data-testid": "opt-ab-run",
      className: "bmc-btn",
      style: {
        minHeight: 32,
        padding: "6px 12px"
      }
    }, abBusy ? "Running…" : "Run A/B")), /*#__PURE__*/React.createElement("div", {
      className: "card-body"
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "grid",
        gap: 12,
        gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
        marginBottom: 12
      }
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
      style: {
        display: "block",
        fontSize: 11,
        color: "var(--muted)",
        marginBottom: 4
      }
    }, "Sleeve A"), /*#__PURE__*/React.createElement("select", {
      value: abLeft,
      onChange: e => setAbLeft(e.target.value),
      "data-testid": "opt-ab-left",
      style: inputStyle()
    }, sleeves.map(s => /*#__PURE__*/React.createElement("option", {
      key: s,
      value: s
    }, s)))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
      style: {
        display: "block",
        fontSize: 11,
        color: "var(--muted)",
        marginBottom: 4
      }
    }, "Sleeve B"), /*#__PURE__*/React.createElement("select", {
      value: abRight,
      onChange: e => setAbRight(e.target.value),
      "data-testid": "opt-ab-right",
      style: inputStyle()
    }, sleeves.map(s => /*#__PURE__*/React.createElement("option", {
      key: s,
      value: s
    }, s))))), /*#__PURE__*/React.createElement(ABEquity, {
      resultA: abResultA,
      resultB: abResultB
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 14,
        fontSize: 11,
        color: "var(--muted)",
        marginTop: 6
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 4
      }
    }, /*#__PURE__*/React.createElement("i", {
      style: {
        width: 10,
        height: 10,
        background: "var(--pos)",
        display: "inline-block",
        borderRadius: 2
      }
    }), abLeft), /*#__PURE__*/React.createElement("span", {
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 4
      }
    }, /*#__PURE__*/React.createElement("i", {
      style: {
        width: 10,
        height: 10,
        background: "var(--info)",
        display: "inline-block",
        borderRadius: 2
      }
    }), abRight)))), /*#__PURE__*/React.createElement(PromoteModal, {
      open: promoteOpen,
      onClose: () => setPromoteOpen(false),
      sleeveId: sleeveId,
      params: sweepResult && sweepResult.winner ? sweepResult.winner.params : {},
      busy: promoteBusy,
      error: promoteError,
      onConfirm: confirmPromote
    })));
  }
  function inputStyle() {
    return {
      flex: "1 1 0",
      minWidth: 60,
      padding: 6,
      background: "var(--surface-2)",
      color: "var(--text)",
      border: "1px solid var(--line)",
      borderRadius: 4,
      fontFamily: "var(--mono)",
      fontSize: 12
    };
  }
  window.OptimizationPage = OptimizationPage;
})();

/* ---- panels/tweaks-panel.jsx ---- */
// tweaks-panel.jsx
// Reusable Tweaks shell + form-control helpers.
//
// Owns the host protocol (listens for __activate_edit_mode / __deactivate_edit_mode,
// posts __edit_mode_available / __edit_mode_set_keys / __edit_mode_dismissed) so
// individual prototypes don't re-roll it. Ships a consistent set of controls so you
// don't hand-draw <input type="range">, segmented radios, steppers, etc.
//
// Usage (in an HTML file that loads React + Babel):
//
//   const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
//     "primaryColor": "#D97757",
//     "fontSize": 16,
//     "density": "regular",
//     "dark": false
//   }/*EDITMODE-END*/;
//
//   function App() {
//     const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
//     return (
//       <div style={{ fontSize: t.fontSize, color: t.primaryColor }}>
//         Hello
//         <TweaksPanel>
//           <TweakSection label="Typography" />
//           <TweakSlider label="Font size" value={t.fontSize} min={10} max={32} unit="px"
//                        onChange={(v) => setTweak('fontSize', v)} />
//           <TweakRadio  label="Density" value={t.density}
//                        options={['compact', 'regular', 'comfy']}
//                        onChange={(v) => setTweak('density', v)} />
//           <TweakSection label="Theme" />
//           <TweakColor  label="Primary" value={t.primaryColor}
//                        onChange={(v) => setTweak('primaryColor', v)} />
//           <TweakToggle label="Dark mode" value={t.dark}
//                        onChange={(v) => setTweak('dark', v)} />
//         </TweaksPanel>
//       </div>
//     );
//   }
//
// ─────────────────────────────────────────────────────────────────────────────

var __TWEAKS_STYLE = `
  .twk-panel{position:fixed;right:16px;bottom:16px;z-index:2147483646;width:280px;
    max-height:calc(100vh - 32px);display:flex;flex-direction:column;
    background:rgba(250,249,247,.78);color:#29261b;
    -webkit-backdrop-filter:blur(24px) saturate(160%);backdrop-filter:blur(24px) saturate(160%);
    border:.5px solid rgba(255,255,255,.6);border-radius:14px;
    box-shadow:0 1px 0 rgba(255,255,255,.5) inset,0 12px 40px rgba(0,0,0,.18);
    font:11.5px/1.4 ui-sans-serif,system-ui,-apple-system,sans-serif;overflow:hidden}
  .twk-hd{display:flex;align-items:center;justify-content:space-between;
    padding:10px 8px 10px 14px;cursor:move;user-select:none}
  .twk-hd b{font-size:12px;font-weight:600;letter-spacing:.01em}
  .twk-x{appearance:none;border:0;background:transparent;color:rgba(41,38,27,.55);
    width:22px;height:22px;border-radius:6px;cursor:default;font-size:13px;line-height:1}
  .twk-x:hover{background:rgba(0,0,0,.06);color:#29261b}
  .twk-body{padding:2px 14px 14px;display:flex;flex-direction:column;gap:10px;
    overflow-y:auto;overflow-x:hidden;min-height:0;
    scrollbar-width:thin;scrollbar-color:rgba(0,0,0,.15) transparent}
  .twk-body::-webkit-scrollbar{width:8px}
  .twk-body::-webkit-scrollbar-track{background:transparent;margin:2px}
  .twk-body::-webkit-scrollbar-thumb{background:rgba(0,0,0,.15);border-radius:4px;
    border:2px solid transparent;background-clip:content-box}
  .twk-body::-webkit-scrollbar-thumb:hover{background:rgba(0,0,0,.25);
    border:2px solid transparent;background-clip:content-box}
  .twk-row{display:flex;flex-direction:column;gap:5px}
  .twk-row-h{flex-direction:row;align-items:center;justify-content:space-between;gap:10px}
  .twk-lbl{display:flex;justify-content:space-between;align-items:baseline;
    color:rgba(41,38,27,.72)}
  .twk-lbl>span:first-child{font-weight:500}
  .twk-val{color:rgba(41,38,27,.5);font-variant-numeric:tabular-nums}

  .twk-sect{font-size:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;
    color:rgba(41,38,27,.45);padding:10px 0 0}
  .twk-sect:first-child{padding-top:0}

  .twk-field{appearance:none;width:100%;height:26px;padding:0 8px;
    border:.5px solid rgba(0,0,0,.1);border-radius:7px;
    background:rgba(255,255,255,.6);color:inherit;font:inherit;outline:none}
  .twk-field:focus{border-color:rgba(0,0,0,.25);background:rgba(255,255,255,.85)}
  select.twk-field{padding-right:22px;
    background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path fill='rgba(0,0,0,.5)' d='M0 0h10L5 6z'/></svg>");
    background-repeat:no-repeat;background-position:right 8px center}

  .twk-slider{appearance:none;-webkit-appearance:none;width:100%;height:4px;margin:6px 0;
    border-radius:999px;background:rgba(0,0,0,.12);outline:none}
  .twk-slider::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;
    width:14px;height:14px;border-radius:50%;background:#fff;
    border:.5px solid rgba(0,0,0,.12);box-shadow:0 1px 3px rgba(0,0,0,.2);cursor:default}
  .twk-slider::-moz-range-thumb{width:14px;height:14px;border-radius:50%;
    background:#fff;border:.5px solid rgba(0,0,0,.12);box-shadow:0 1px 3px rgba(0,0,0,.2);cursor:default}

  .twk-seg{position:relative;display:flex;padding:2px;border-radius:8px;
    background:rgba(0,0,0,.06);user-select:none}
  .twk-seg-thumb{position:absolute;top:2px;bottom:2px;border-radius:6px;
    background:rgba(255,255,255,.9);box-shadow:0 1px 2px rgba(0,0,0,.12);
    transition:left .15s cubic-bezier(.3,.7,.4,1),width .15s}
  .twk-seg.dragging .twk-seg-thumb{transition:none}
  .twk-seg button{appearance:none;position:relative;z-index:1;flex:1;border:0;
    background:transparent;color:inherit;font:inherit;font-weight:500;min-height:22px;
    border-radius:6px;cursor:default;padding:4px 6px;line-height:1.2;
    overflow-wrap:anywhere}

  .twk-toggle{position:relative;width:32px;height:18px;border:0;border-radius:999px;
    background:rgba(0,0,0,.15);transition:background .15s;cursor:default;padding:0}
  .twk-toggle[data-on="1"]{background:#34c759}
  .twk-toggle i{position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;
    background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.25);transition:transform .15s}
  .twk-toggle[data-on="1"] i{transform:translateX(14px)}

  .twk-num{display:flex;align-items:center;height:26px;padding:0 0 0 8px;
    border:.5px solid rgba(0,0,0,.1);border-radius:7px;background:rgba(255,255,255,.6)}
  .twk-num-lbl{font-weight:500;color:rgba(41,38,27,.6);cursor:ew-resize;
    user-select:none;padding-right:8px}
  .twk-num input{flex:1;min-width:0;height:100%;border:0;background:transparent;
    font:inherit;font-variant-numeric:tabular-nums;text-align:right;padding:0 8px 0 0;
    outline:none;color:inherit;-moz-appearance:textfield}
  .twk-num input::-webkit-inner-spin-button,.twk-num input::-webkit-outer-spin-button{
    -webkit-appearance:none;margin:0}
  .twk-num-unit{padding-right:8px;color:rgba(41,38,27,.45)}

  .twk-btn{appearance:none;height:26px;padding:0 12px;border:0;border-radius:7px;
    background:rgba(0,0,0,.78);color:#fff;font:inherit;font-weight:500;cursor:default}
  .twk-btn:hover{background:rgba(0,0,0,.88)}
  .twk-btn.secondary{background:rgba(0,0,0,.06);color:inherit}
  .twk-btn.secondary:hover{background:rgba(0,0,0,.1)}

  .twk-swatch{appearance:none;-webkit-appearance:none;width:56px;height:22px;
    border:.5px solid rgba(0,0,0,.1);border-radius:6px;padding:0;cursor:default;
    background:transparent;flex-shrink:0}
  .twk-swatch::-webkit-color-swatch-wrapper{padding:0}
  .twk-swatch::-webkit-color-swatch{border:0;border-radius:5.5px}
  .twk-swatch::-moz-color-swatch{border:0;border-radius:5.5px}
`;

// ── useTweaks ───────────────────────────────────────────────────────────────
// Single source of truth for tweak values. setTweak persists via the host
// (__edit_mode_set_keys → host rewrites the EDITMODE block on disk).
function useTweaks(defaults) {
  var [values, setValues] = React.useState(defaults);
  // Accepts either setTweak('key', value) or setTweak({ key: value, ... }) so a
  // useState-style call doesn't write a "[object Object]" key into the persisted
  // JSON block.
  var setTweak = React.useCallback((keyOrEdits, val) => {
    var edits = typeof keyOrEdits === 'object' && keyOrEdits !== null ? keyOrEdits : {
      [keyOrEdits]: val
    };
    setValues(prev => ({
      ...prev,
      ...edits
    }));
    window.parent.postMessage({
      type: '__edit_mode_set_keys',
      edits
    }, '*');
  }, []);
  return [values, setTweak];
}

// ── TweaksPanel ─────────────────────────────────────────────────────────────
// Floating shell. Registers the protocol listener BEFORE announcing
// availability — if the announce ran first, the host's activate could land
// before our handler exists and the toolbar toggle would silently no-op.
// The close button posts __edit_mode_dismissed so the host's toolbar toggle
// flips off in lockstep; the host echoes __deactivate_edit_mode back which
// is what actually hides the panel.
function TweaksPanel({
  title = 'Tweaks',
  children
}) {
  var [open, setOpen] = React.useState(false);
  var dragRef = React.useRef(null);
  var offsetRef = React.useRef({
    x: 16,
    y: 16
  });
  var PAD = 16;
  var clampToViewport = React.useCallback(() => {
    var panel = dragRef.current;
    if (!panel) return;
    var w = panel.offsetWidth,
      h = panel.offsetHeight;
    var maxRight = Math.max(PAD, window.innerWidth - w - PAD);
    var maxBottom = Math.max(PAD, window.innerHeight - h - PAD);
    offsetRef.current = {
      x: Math.min(maxRight, Math.max(PAD, offsetRef.current.x)),
      y: Math.min(maxBottom, Math.max(PAD, offsetRef.current.y))
    };
    panel.style.right = offsetRef.current.x + 'px';
    panel.style.bottom = offsetRef.current.y + 'px';
  }, []);
  React.useEffect(() => {
    if (!open) return;
    clampToViewport();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', clampToViewport);
      return () => window.removeEventListener('resize', clampToViewport);
    }
    var ro = new ResizeObserver(clampToViewport);
    ro.observe(document.documentElement);
    return () => ro.disconnect();
  }, [open, clampToViewport]);
  React.useEffect(() => {
    var onMsg = e => {
      var t = e?.data?.type;
      if (t === '__activate_edit_mode') setOpen(true);else if (t === '__deactivate_edit_mode') setOpen(false);
    };
    window.addEventListener('message', onMsg);
    window.parent.postMessage({
      type: '__edit_mode_available'
    }, '*');
    return () => window.removeEventListener('message', onMsg);
  }, []);
  var dismiss = () => {
    setOpen(false);
    window.parent.postMessage({
      type: '__edit_mode_dismissed'
    }, '*');
  };
  var onDragStart = e => {
    var panel = dragRef.current;
    if (!panel) return;
    var r = panel.getBoundingClientRect();
    var sx = e.clientX,
      sy = e.clientY;
    var startRight = window.innerWidth - r.right;
    var startBottom = window.innerHeight - r.bottom;
    var move = ev => {
      offsetRef.current = {
        x: startRight - (ev.clientX - sx),
        y: startBottom - (ev.clientY - sy)
      };
      clampToViewport();
    };
    var up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };
  if (!open) return null;
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("style", null, __TWEAKS_STYLE), /*#__PURE__*/React.createElement("div", {
    ref: dragRef,
    className: "twk-panel",
    "data-noncommentable": "",
    style: {
      right: offsetRef.current.x,
      bottom: offsetRef.current.y
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "twk-hd",
    onMouseDown: onDragStart
  }, /*#__PURE__*/React.createElement("b", null, title), /*#__PURE__*/React.createElement("button", {
    className: "twk-x",
    "aria-label": "Close tweaks",
    onMouseDown: e => e.stopPropagation(),
    onClick: dismiss
  }, "\u2715")), /*#__PURE__*/React.createElement("div", {
    className: "twk-body"
  }, children)));
}

// ── Layout helpers ──────────────────────────────────────────────────────────

function TweakSection({
  label,
  children
}) {
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "twk-sect"
  }, label), children);
}
function TweakRow({
  label,
  value,
  children,
  inline = false
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: inline ? 'twk-row twk-row-h' : 'twk-row'
  }, /*#__PURE__*/React.createElement("div", {
    className: "twk-lbl"
  }, /*#__PURE__*/React.createElement("span", null, label), value != null && /*#__PURE__*/React.createElement("span", {
    className: "twk-val"
  }, value)), children);
}

// ── Controls ────────────────────────────────────────────────────────────────

function TweakSlider({
  label,
  value,
  min = 0,
  max = 100,
  step = 1,
  unit = '',
  onChange
}) {
  return /*#__PURE__*/React.createElement(TweakRow, {
    label: label,
    value: `${value}${unit}`
  }, /*#__PURE__*/React.createElement("input", {
    type: "range",
    className: "twk-slider",
    min: min,
    max: max,
    step: step,
    value: value,
    onChange: e => onChange(Number(e.target.value))
  }));
}
function TweakToggle({
  label,
  value,
  onChange
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "twk-row twk-row-h"
  }, /*#__PURE__*/React.createElement("div", {
    className: "twk-lbl"
  }, /*#__PURE__*/React.createElement("span", null, label)), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "twk-toggle",
    "data-on": value ? '1' : '0',
    role: "switch",
    "aria-checked": !!value,
    onClick: () => onChange(!value)
  }, /*#__PURE__*/React.createElement("i", null)));
}
function TweakRadio({
  label,
  value,
  options,
  onChange
}) {
  var trackRef = React.useRef(null);
  var [dragging, setDragging] = React.useState(false);
  var opts = options.map(o => typeof o === 'object' ? o : {
    value: o,
    label: o
  });
  var idx = Math.max(0, opts.findIndex(o => o.value === value));
  var n = opts.length;

  // The active value is read by pointer-move handlers attached for the lifetime
  // of a drag — ref it so a stale closure doesn't fire onChange for every move.
  var valueRef = React.useRef(value);
  valueRef.current = value;
  var segAt = clientX => {
    var r = trackRef.current.getBoundingClientRect();
    var inner = r.width - 4;
    var i = Math.floor((clientX - r.left - 2) / inner * n);
    return opts[Math.max(0, Math.min(n - 1, i))].value;
  };
  var onPointerDown = e => {
    setDragging(true);
    var v0 = segAt(e.clientX);
    if (v0 !== valueRef.current) onChange(v0);
    var move = ev => {
      if (!trackRef.current) return;
      var v = segAt(ev.clientX);
      if (v !== valueRef.current) onChange(v);
    };
    var up = () => {
      setDragging(false);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  return /*#__PURE__*/React.createElement(TweakRow, {
    label: label
  }, /*#__PURE__*/React.createElement("div", {
    ref: trackRef,
    role: "radiogroup",
    onPointerDown: onPointerDown,
    className: dragging ? 'twk-seg dragging' : 'twk-seg'
  }, /*#__PURE__*/React.createElement("div", {
    className: "twk-seg-thumb",
    style: {
      left: `calc(2px + ${idx} * (100% - 4px) / ${n})`,
      width: `calc((100% - 4px) / ${n})`
    }
  }), opts.map(o => /*#__PURE__*/React.createElement("button", {
    key: o.value,
    type: "button",
    role: "radio",
    "aria-checked": o.value === value
  }, o.label))));
}
function TweakSelect({
  label,
  value,
  options,
  onChange
}) {
  return /*#__PURE__*/React.createElement(TweakRow, {
    label: label
  }, /*#__PURE__*/React.createElement("select", {
    className: "twk-field",
    value: value,
    onChange: e => onChange(e.target.value)
  }, options.map(o => {
    var v = typeof o === 'object' ? o.value : o;
    var l = typeof o === 'object' ? o.label : o;
    return /*#__PURE__*/React.createElement("option", {
      key: v,
      value: v
    }, l);
  })));
}
function TweakText({
  label,
  value,
  placeholder,
  onChange
}) {
  return /*#__PURE__*/React.createElement(TweakRow, {
    label: label
  }, /*#__PURE__*/React.createElement("input", {
    className: "twk-field",
    type: "text",
    value: value,
    placeholder: placeholder,
    onChange: e => onChange(e.target.value)
  }));
}
function TweakNumber({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  onChange
}) {
  var clamp = n => {
    if (min != null && n < min) return min;
    if (max != null && n > max) return max;
    return n;
  };
  var startRef = React.useRef({
    x: 0,
    val: 0
  });
  var onScrubStart = e => {
    e.preventDefault();
    startRef.current = {
      x: e.clientX,
      val: value
    };
    var decimals = (String(step).split('.')[1] || '').length;
    var move = ev => {
      var dx = ev.clientX - startRef.current.x;
      var raw = startRef.current.val + dx * step;
      var snapped = Math.round(raw / step) * step;
      onChange(clamp(Number(snapped.toFixed(decimals))));
    };
    var up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "twk-num"
  }, /*#__PURE__*/React.createElement("span", {
    className: "twk-num-lbl",
    onPointerDown: onScrubStart
  }, label), /*#__PURE__*/React.createElement("input", {
    type: "number",
    value: value,
    min: min,
    max: max,
    step: step,
    onChange: e => onChange(clamp(Number(e.target.value)))
  }), unit && /*#__PURE__*/React.createElement("span", {
    className: "twk-num-unit"
  }, unit));
}
function TweakColor({
  label,
  value,
  onChange
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "twk-row twk-row-h"
  }, /*#__PURE__*/React.createElement("div", {
    className: "twk-lbl"
  }, /*#__PURE__*/React.createElement("span", null, label)), /*#__PURE__*/React.createElement("input", {
    type: "color",
    className: "twk-swatch",
    value: value,
    onChange: e => onChange(e.target.value)
  }));
}
function TweakButton({
  label,
  onClick,
  secondary = false
}) {
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: secondary ? 'twk-btn secondary' : 'twk-btn',
    onClick: onClick
  }, label);
}
Object.assign(window, {
  useTweaks,
  TweaksPanel,
  TweakSection,
  TweakRow,
  TweakSlider,
  TweakToggle,
  TweakRadio,
  TweakSelect,
  TweakText,
  TweakNumber,
  TweakColor,
  TweakButton
});

/* ---- components/components.jsx ---- */
/* global React */
var {
  useState,
  useMemo,
  useEffect
} = React;

// ============== Sparkline ==============
function Sparkline({
  data,
  width = 80,
  height = 22,
  color = "var(--pos)",
  fill = true
}) {
  if (!data || data.length === 0) return null;
  var min = Math.min(...data);
  var max = Math.max(...data);
  var range = max - min || 1;
  var step = width / (data.length - 1);
  var points = data.map((v, i) => `${i * step},${height - (v - min) / range * (height - 2) - 1}`).join(" ");
  var areaPoints = `0,${height} ${points} ${width},${height}`;
  return /*#__PURE__*/React.createElement("svg", {
    width: width,
    height: height,
    style: {
      display: "block"
    }
  }, fill && /*#__PURE__*/React.createElement("polyline", {
    points: areaPoints,
    fill: color,
    opacity: "0.14",
    stroke: "none"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: points,
    fill: "none",
    stroke: color,
    strokeWidth: "1.5",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }));
}

// ============== Status bar ==============
function StatusBar() {
  var [now, setNow] = useState(new Date());
  useEffect(() => {
    var id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  var pad = n => String(n).padStart(2, "0");
  var ts = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())} ${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())} UTC`;
  var ticks = window.STATUS_QUOTES || [];
  var marketState = ticks.find(t => t.marketState)?.marketState || "closed";
  var isOpen = marketState === "open";
  return /*#__PURE__*/React.createElement("div", {
    className: "statusbar"
  }, /*#__PURE__*/React.createElement("span", {
    className: "live"
  }, isOpen ? "LIVE · MARKET OPEN" : "MARKET CLOSED"), /*#__PURE__*/React.createElement("div", {
    className: "ticker-strip"
  }, ticks.length === 0 && /*#__PURE__*/React.createElement("span", {
    className: "muted"
  }, "no quotes"), ticks.map(q => {
    var p = q.price;
    var c = q.changePct;
    return /*#__PURE__*/React.createElement("span", {
      key: q.ticker
    }, /*#__PURE__*/React.createElement("b", {
      style: {
        color: "var(--text)"
      }
    }, q.ticker), /*#__PURE__*/React.createElement("span", {
      className: "tnum"
    }, p == null ? "—" : p.toLocaleString("en-US", {
      minimumFractionDigits: p < 1000 ? 2 : 0
    })), c == null ? /*#__PURE__*/React.createElement("span", {
      className: "muted"
    }, "\u2014") : /*#__PURE__*/React.createElement("span", {
      className: c >= 0 ? "up" : "down"
    }, c >= 0 ? "+" : "", c.toFixed(2), "%"));
  })), /*#__PURE__*/React.createElement("span", {
    className: "muted"
  }, ts));
}

// ============== Header ==============
// Single-page consolidation: the dashboard is the only surface, so the tab
// nav was removed. Brand + the section anchors below are the whole header.
function Header({
  handle,
  bmcUrl,
  setPage,
  showBmc = true
}) {
  var sections = [["catalysts", "Catalysts"], ["positions", "Positions"], ["tradelog", "Trade Log"], ["watchlist", "Watchlist"]];
  var closeNav = () => {
    var el = document.getElementById("nav-toggle");
    if (el) el.checked = false;
  };
  // Real routes, not in-page anchors — each renders its own surface instead of
  // a section of the dashboard. Options Log is the landing page, so Dashboard
  // needs a link of its own to get back to the account-vs-SPY review.
  var routes = [["options", "Options Log"], ["dashboard", "Dashboard"]];
  // The section anchors above only exist on the dashboard surface. From any
  // other route the element isn't in the DOM yet, so switch to the dashboard
  // first and scroll once it has painted — previously this called
  // setPage("positions"), an unknown page that silently fell back.
  var jumpTo = id => {
    closeNav();
    var el = document.getElementById(id);
    if (el) return el.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
    if (!setPage) return;
    setPage("dashboard");
    requestAnimationFrame(() => {
      var painted = document.getElementById(id);
      if (painted) painted.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    });
  };
  var goto = page => {
    closeNav();
    if (setPage) setPage(page);
  };
  // Routes lead: the Options Log is the landing surface, so it's the first tab
  // and Dashboard the second. The dashboard's own in-page section jumps follow
  // them. Built once and rendered by both navs so desktop and mobile can never
  // drift out of order.
  var navLinks = [...routes.map(([id, label]) => ({
    id,
    label,
    onClick: () => goto(id)
  })), ...sections.map(([id, label]) => ({
    id,
    label,
    onClick: () => jumpTo(id)
  }))];
  var renderNavLinks = () => navLinks.map(({
    id,
    label,
    onClick
  }) => /*#__PURE__*/React.createElement("a", {
    key: id,
    href: `#${id}`,
    onClick: e => {
      e.preventDefault();
      onClick();
    }
  }, label));
  return /*#__PURE__*/React.createElement("header", {
    className: "header"
  }, /*#__PURE__*/React.createElement("div", {
    className: "brand",
    style: {
      cursor: "pointer"
    },
    onClick: () => setPage && setPage("options")
  }, /*#__PURE__*/React.createElement("div", {
    className: "brand-mark"
  }, handle ? handle[0] : "P"), /*#__PURE__*/React.createElement("div", {
    className: "brand-name"
  }, (() => {
    var dot = handle.lastIndexOf(".");
    if (dot === -1) return handle;
    return /*#__PURE__*/React.createElement(React.Fragment, null, handle.slice(0, dot), /*#__PURE__*/React.createElement("span", null, handle.slice(dot)));
  })())), /*#__PURE__*/React.createElement("nav", {
    className: "nav"
  }, renderNavLinks()), /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    id: "nav-toggle",
    className: "nav-toggle-input",
    "aria-hidden": "true"
  }), /*#__PURE__*/React.createElement("label", {
    htmlFor: "nav-toggle",
    className: "nav-toggle-btn",
    "aria-label": "Toggle navigation"
  }, /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true"
  }, "\u2630")), /*#__PURE__*/React.createElement("nav", {
    className: "nav-mobile"
  }, renderNavLinks()), showBmc && /*#__PURE__*/React.createElement("a", {
    className: "bmc-btn",
    href: bmcUrl,
    target: "_blank",
    rel: "noreferrer"
  }, /*#__PURE__*/React.createElement("span", {
    className: "coffee"
  }, "\u2615"), " Buy me a coffee"));
}

// ============== DEMO badge ==============
// Marks widgets whose live producer is wired but currently emits no usable data
// (e.g. upstream pipeline gap or missing source file). The badge keeps the rest
// of the dashboard honest: if a widget is unmarked, treat its data as real.
function DemoBadge({
  title = "no live data — producer not yet wired"
}) {
  return /*#__PURE__*/React.createElement("span", {
    className: "demo-badge",
    title: title,
    "aria-label": "DEMO"
  }, "DEMO");
}
window.DemoBadge = DemoBadge;

// ============== Feedback-button plumbing shared by every card head ==========
// Derives a stable, human-readable feedback target id from a card's visible
// title ("What we think right now" -> "what-we-think-right-now") so no call
// site ever hand-types one — the ONE kebab-casing rule, site-wide. Originally
// lived in options-summary.jsx (PRD 1041); moved here so every card shell —
// not just the Options Log's <Section> — can share exactly one definition.
// Re-exported via window.OptionsSummaryInternals.componentId for callers that
// already depend on that surface.
function componentId(title) {
  return String(title).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
window.componentId = componentId;

// The shared `.card > .card-head > h3` shell, now with a `?` Help-style
// FeedbackButton wired in for free. `feedbackId` is opt-in — when omitted
// it's derived from `title` via componentId(), same rule Section already
// uses on the Options Log. Titles that interpolate live values (row counts,
// filters) MUST pass an explicit feedbackId so the id stays stable as the
// data changes. `children` renders after the title, in the same slot the
// raw `<div className="card-head">` markup used for filter rows / meta text
// — the wrapper never changes the `.card-head` class or its flex layout.
function CardHead({
  title,
  feedbackId,
  children
}) {
  var resolvedFeedbackId = feedbackId || componentId(title);
  return /*#__PURE__*/React.createElement("div", {
    className: "card-head"
  }, /*#__PURE__*/React.createElement("h3", null, title, window.FeedbackButton && /*#__PURE__*/React.createElement(window.FeedbackButton, {
    target: {
      kind: "component",
      id: resolvedFeedbackId,
      label: title
    }
  })), children);
}
window.CardHead = CardHead;

// ============== Hero P&L (legacy 5-col, kept as a tweak option) ==============
function HeroLegacy({
  perf,
  equity
}) {
  var equityVals = equity.map(e => e.equity);
  var fmt$ = v => "$" + Math.round(v).toLocaleString("en-US");
  var fmtPct = v => `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
  return /*#__PURE__*/React.createElement("div", {
    className: "hero"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pnl-hero"
  }, /*#__PURE__*/React.createElement("span", {
    className: "label"
  }, "Total P&L \xB7 YTD"), /*#__PURE__*/React.createElement("span", {
    className: `value mono ${perf.totalPnl >= 0 ? "up" : "down"}`
  }, perf.totalPnl >= 0 ? "+" : "", fmt$(perf.totalPnl)), /*#__PURE__*/React.createElement("span", {
    className: "sub"
  }, /*#__PURE__*/React.createElement("span", {
    className: perf.totalPnlPct >= 0 ? "up" : "down"
  }, fmtPct(perf.totalPnlPct)), /*#__PURE__*/React.createElement("span", {
    className: "dim"
  }, " \xB7 vs SPY +", perf.spyYtdPct.toFixed(1), "%")), /*#__PURE__*/React.createElement(Sparkline, {
    data: equityVals,
    width: 140,
    height: 32,
    color: "var(--pos)"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "label"
  }, "Equity"), /*#__PURE__*/React.createElement("span", {
    className: "value mono"
  }, fmt$(perf.currentEquity)), /*#__PURE__*/React.createElement("span", {
    className: "sub dim"
  }, "from ", fmt$(perf.startingCapital))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "label"
  }, "Win Rate"), /*#__PURE__*/React.createElement("span", {
    className: "value mono"
  }, (perf.winRate * 100).toFixed(1), "%"), /*#__PURE__*/React.createElement("span", {
    className: "sub dim"
  }, perf.wins, "W \xB7 ", perf.losses, "L")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "label"
  }, "Profit Factor"), /*#__PURE__*/React.createElement("span", {
    className: "value mono"
  }, perf.profitFactor.toFixed(2)), /*#__PURE__*/React.createElement("span", {
    className: "sub dim"
  }, "avg win $", perf.avgWin.toFixed(0), " \xB7 loss $", Math.abs(perf.avgLoss).toFixed(0))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "label"
  }, "Sharpe / Max DD"), /*#__PURE__*/React.createElement("span", {
    className: "value mono"
  }, perf.sharpe.toFixed(2), " ", /*#__PURE__*/React.createElement("span", {
    className: "dim",
    style: {
      fontSize: 16
    }
  }, " / "), /*#__PURE__*/React.createElement("span", {
    className: "down"
  }, perf.maxDD.toFixed(1), "%")), /*#__PURE__*/React.createElement("span", {
    className: "sub dim"
  }, perf.trades, " trades \xB7 ", perf.open, " open")));
}

// ============== Two-line sparkline (equity vs SPY overlay) ==============
function DualSparkline({
  equity,
  spy,
  width = 220,
  height = 44
}) {
  if (!equity || equity.length === 0) return null;
  var all = [...equity, ...spy];
  var min = Math.min(...all);
  var max = Math.max(...all);
  var range = max - min || 1;
  var step = width / (equity.length - 1);
  var eqPts = equity.map((v, i) => `${i * step},${height - (v - min) / range * (height - 2) - 1}`).join(" ");
  var spyPts = spy.map((v, i) => `${i * step},${height - (v - min) / range * (height - 2) - 1}`).join(" ");
  return /*#__PURE__*/React.createElement("svg", {
    width: width,
    height: height,
    style: {
      display: "block"
    }
  }, /*#__PURE__*/React.createElement("polyline", {
    points: spyPts,
    fill: "none",
    stroke: "var(--dim)",
    strokeWidth: "1.2",
    strokeDasharray: "3 3"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: eqPts,
    fill: "none",
    stroke: "var(--pos)",
    strokeWidth: "1.8",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }));
}

// ============== Hero — Alpaca account vs SPY (single above-the-fold KPI) ==============
// The single verifiable measure of success: the Alpaca account's return vs SPY,
// representing the union of all Social Signal Strategies. Per-sleeve attribution
// is now collapsed into <PerStrategyAttribution /> below.
function HeroAlpacaVsSpy({
  perf,
  equity,
  leadWith = "dollar"
}) {
  var fmt$ = v => "$" + Math.round(v).toLocaleString("en-US");
  var fmtPct = v => `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
  var acctReturnPct = perf.totalPnlPct;
  var spyReturnPct = perf.spyYtdPct;
  var vsSpy = acctReturnPct - spyReturnPct;
  var equityVals = equity.map(e => e.equity);
  var spyVals = equity.map(e => e.spy);
  var leadValue = leadWith === "percent" ? fmtPct(acctReturnPct) : fmt$(perf.currentEquity);
  var leadSub = leadWith === "percent" ? `${fmt$(perf.currentEquity)} from ${fmt$(perf.startingCapital)}` : `${fmtPct(acctReturnPct)} from ${fmt$(perf.startingCapital)}`;
  return /*#__PURE__*/React.createElement("div", {
    className: "hero hero-asv"
  }, /*#__PURE__*/React.createElement("div", {
    className: "asv-lead"
  }, /*#__PURE__*/React.createElement("span", {
    className: "label"
  }, "Alpaca account \xB7 YTD"), /*#__PURE__*/React.createElement("span", {
    className: `value mono ${acctReturnPct >= 0 ? "up" : "down"}`
  }, leadValue), /*#__PURE__*/React.createElement("span", {
    className: "sub dim"
  }, leadSub)), /*#__PURE__*/React.createElement("div", {
    className: "asv-vs"
  }, /*#__PURE__*/React.createElement("span", {
    className: "label"
  }, "vs SPY"), /*#__PURE__*/React.createElement("span", {
    className: `value mono ${vsSpy >= 0 ? "up" : "down"}`
  }, fmtPct(vsSpy)), /*#__PURE__*/React.createElement("span", {
    className: "sub dim"
  }, "acct ", fmtPct(acctReturnPct), " \xB7 SPY ", fmtPct(spyReturnPct))), /*#__PURE__*/React.createElement("div", {
    className: "asv-spark"
  }, /*#__PURE__*/React.createElement("span", {
    className: "label"
  }, "Equity vs SPY"), /*#__PURE__*/React.createElement(DualSparkline, {
    equity: equityVals,
    spy: spyVals,
    width: 220,
    height: 44
  }), /*#__PURE__*/React.createElement("span", {
    className: "sub dim",
    style: {
      display: "flex",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("i", {
    className: "dot",
    style: {
      background: "var(--pos)"
    }
  }), " Account"), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("i", {
    className: "dot",
    style: {
      background: "var(--dim)"
    }
  }), " SPY"))));
}

// ============== Hero dispatcher (legacy / dollar / percent) ==============
function Hero({
  perf,
  equity,
  mode
}) {
  if (mode === "legacy") return /*#__PURE__*/React.createElement(HeroLegacy, {
    perf: perf,
    equity: equity
  });
  return /*#__PURE__*/React.createElement(HeroAlpacaVsSpy, {
    perf: perf,
    equity: equity,
    leadWith: mode || "dollar"
  });
}

// ============== Per-strategy attribution (collapsible secondary KPIs) ==============
// Demoted from the primary hero. Reads window.STRATEGIES; sleeve PnL is derived
// from ytdPct × equal-weight slice of startingCapital (per-sleeve dollar PnL is
// not surfaced in PERF today, so this is a proxy honest enough for attribution
// ranking).
function PerStrategyAttribution({
  perf,
  strategies
}) {
  var list = strategies || window.STRATEGIES || [];
  var sliceCapital = list.length > 0 ? perf.startingCapital / list.length : 0;
  var rows = list.map(s => ({
    id: s.id,
    name: s.name,
    trades: s.trades || 0,
    winRate: s.winRate || 0,
    sleevePnl: (s.ytdPct || 0) * sliceCapital / 100,
    status: s.status
  })).sort((a, b) => b.sleevePnl - a.sleevePnl);
  var fmt$ = v => (v >= 0 ? "+$" : "−$") + Math.abs(Math.round(v)).toLocaleString("en-US");
  return /*#__PURE__*/React.createElement("div", {
    className: "card per-strategy-attr"
  }, /*#__PURE__*/React.createElement("details", null, /*#__PURE__*/React.createElement("summary", {
    className: "per-strategy-attr-summary"
  }, /*#__PURE__*/React.createElement("span", {
    className: "psa-title"
  }, "by-strategy attribution"), /*#__PURE__*/React.createElement("span", {
    className: "psa-meta dim mono"
  }, list.length, " sleeves \xB7 secondary KPIs")), /*#__PURE__*/React.createElement("div", {
    className: "card-body"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement(StatStrip, {
    perf: perf
  })), /*#__PURE__*/React.createElement("table", {
    className: "trades"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Strategy"), /*#__PURE__*/React.createElement("th", null, "Status"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "n trades"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "win rate"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "sleeve P&L"))), /*#__PURE__*/React.createElement("tbody", null, rows.map(r => /*#__PURE__*/React.createElement("tr", {
    key: r.id
  }, /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("b", null, r.id), /*#__PURE__*/React.createElement("div", {
    className: "sub-cell dim"
  }, r.name)), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("span", {
    className: "pill"
  }, r.status || "—")), /*#__PURE__*/React.createElement("td", {
    className: "num"
  }, r.trades), /*#__PURE__*/React.createElement("td", {
    className: "num"
  }, (r.winRate * 100).toFixed(1), "%"), /*#__PURE__*/React.createElement("td", {
    className: `num ${r.sleevePnl >= 0 ? "up" : "down"}`
  }, fmt$(r.sleevePnl)))))))));
}

// ============== Stats strip (secondary) ==============
function StatStrip({
  perf
}) {
  var items = [["Trades", perf.trades, ""], ["Open", perf.open, ""], ["Closed", perf.closed, ""], ["Avg hold", perf.avgHoldDays.toFixed(1) + "d", ""], ["Best trade", "+$" + perf.bestTrade.pnl.toFixed(0), perf.bestTrade.ticker, "up"], ["Worst trade", "−$" + Math.abs(perf.worstTrade.pnl).toFixed(0), perf.worstTrade.ticker, "down"]];
  return /*#__PURE__*/React.createElement("div", {
    className: "card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "statgrid"
  }, items.map(it => /*#__PURE__*/React.createElement("div", {
    className: "stat",
    key: it[0]
  }, /*#__PURE__*/React.createElement("div", {
    className: "label"
  }, it[0]), /*#__PURE__*/React.createElement("div", {
    className: `value ${it[3] || ""}`
  }, it[1], " ", /*#__PURE__*/React.createElement("span", {
    className: "dim",
    style: {
      fontSize: 11,
      marginLeft: 4
    }
  }, it[2]))))));
}

// ============== Equity chart ==============
function EquityChart({
  equity,
  timeframe,
  setTimeframe
}) {
  var W = 760,
    H = 240,
    PAD_L = 44,
    PAD_R = 12,
    PAD_T = 12,
    PAD_B = 22;
  var slice = useMemo(() => {
    var days = timeframe === "30D" ? 30 : timeframe === "7D" ? 7 : timeframe === "90D" ? 90 : equity.length;
    return equity.slice(-days);
  }, [equity, timeframe]);
  if (slice.length === 0) return null;
  var eqVals = slice.map(d => d.equity);
  var spyStart = slice[0].spy;
  var eqStart = slice[0].equity;
  // normalize spy onto equity scale (% change from start * eqStart)
  var spyVals = slice.map(d => eqStart * (d.spy / spyStart));
  var all = [...eqVals, ...spyVals];
  var min = Math.min(...all) * 0.998;
  var max = Math.max(...all) * 1.002;
  var range = max - min;
  var xStep = (W - PAD_L - PAD_R) / (slice.length - 1);
  var yFor = v => PAD_T + (max - v) / range * (H - PAD_T - PAD_B);
  var xFor = i => PAD_L + i * xStep;
  var eqPts = eqVals.map((v, i) => `${xFor(i)},${yFor(v)}`).join(" ");
  var spyPts = spyVals.map((v, i) => `${xFor(i)},${yFor(v)}`).join(" ");
  var eqArea = `${PAD_L},${H - PAD_B} ${eqPts} ${xFor(slice.length - 1)},${H - PAD_B}`;
  var ticks = 5;
  var yTicks = Array.from({
    length: ticks
  }, (_, i) => min + range * i / (ticks - 1));
  var fmt$ = v => "$" + Math.round(v / 1000) + "k";
  var fmtDate = t => {
    var d = new Date(t);
    return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
  };
  var xTicks = [0, Math.floor(slice.length / 4), Math.floor(slice.length / 2), Math.floor(3 * slice.length / 4), slice.length - 1];
  return /*#__PURE__*/React.createElement("div", {
    className: "card"
  }, /*#__PURE__*/React.createElement(window.CardHead, {
    title: "Equity Curve \xB7 vs SPY"
  }, /*#__PURE__*/React.createElement("div", {
    className: "tf"
  }, ["7D", "30D", "90D", "ALL"].map(t => /*#__PURE__*/React.createElement("button", {
    key: t,
    className: timeframe === t ? "active" : "",
    onClick: () => setTimeframe(t)
  }, t)))), /*#__PURE__*/React.createElement("div", {
    className: "chart-wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "chart-legend"
  }, /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("i", {
    className: "dot",
    style: {
      background: "var(--pos)"
    }
  }), " Account equity"), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("i", {
    className: "dot",
    style: {
      background: "var(--dim)"
    }
  }), " SPY (normalized)"), /*#__PURE__*/React.createElement("span", {
    className: "right"
  }, "Last: ", /*#__PURE__*/React.createElement("b", {
    className: "mono",
    style: {
      color: "var(--text)"
    }
  }, "$", Math.round(eqVals[eqVals.length - 1]).toLocaleString()))), /*#__PURE__*/React.createElement("svg", {
    viewBox: `0 0 ${W} ${H}`,
    width: "100%",
    height: "240",
    style: {
      display: "block"
    }
  }, yTicks.map((v, i) => /*#__PURE__*/React.createElement("g", {
    key: i
  }, /*#__PURE__*/React.createElement("line", {
    x1: PAD_L,
    x2: W - PAD_R,
    y1: yFor(v),
    y2: yFor(v),
    stroke: "var(--line)",
    strokeDasharray: "2 4"
  }), /*#__PURE__*/React.createElement("text", {
    x: PAD_L - 6,
    y: yFor(v) + 3,
    fill: "var(--muted)",
    fontSize: "10",
    textAnchor: "end",
    fontFamily: "var(--mono)"
  }, fmt$(v)))), xTicks.map(i => /*#__PURE__*/React.createElement("text", {
    key: i,
    x: xFor(i),
    y: H - 6,
    fill: "var(--muted)",
    fontSize: "10",
    textAnchor: "middle",
    fontFamily: "var(--mono)"
  }, fmtDate(slice[i].t))), /*#__PURE__*/React.createElement("polyline", {
    points: spyPts,
    fill: "none",
    stroke: "var(--dim)",
    strokeWidth: "1.2",
    strokeDasharray: "3 3"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: eqArea,
    fill: "var(--pos)",
    opacity: "0.10"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: eqPts,
    fill: "none",
    stroke: "var(--pos)",
    strokeWidth: "1.8",
    strokeLinejoin: "round"
  }))));
}

// ============== Realized P&L Calendar ==============
var CAL_WEEKS = 13;
var MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function buildCalendar(data, weeks = CAL_WEEKS) {
  // Map YYYY-MM-DD -> day record. Server keys are UTC dates.
  var byDate = new Map(data.filter(d => d.date).map(d => [d.date, d]));
  // Anchor "today" to UTC date so it aligns with server-side date keys.
  var now = new Date();
  var todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  // Monday-start week containing today. Mon=0..Sun=6.
  var dow = todayUTC.getUTCDay(); // 0=Sun..6=Sat
  var monOffset = (dow + 6) % 7; // Mon=0..Sun=6
  var thisMon = new Date(todayUTC.getTime() - monOffset * 86400000);
  var startMon = new Date(thisMon.getTime() - (weeks - 1) * 7 * 86400000);
  var cells = []; // column-major: [col0row0..col0row6, col1row0..]
  var monthLabels = []; // {col, label}
  var lastMonth = -1;
  for (var col = 0; col < weeks; col++) {
    for (var row = 0; row < 7; row++) {
      var dt = new Date(startMon.getTime() + (col * 7 + row) * 86400000);
      var key = dt.toISOString().slice(0, 10);
      cells.push({
        key,
        col,
        row,
        weekend: row >= 5,
        future: dt > todayUTC,
        day: byDate.get(key) || null
      });
    }
    // Month label: month of the Monday in this column.
    var monDate = new Date(startMon.getTime() + col * 7 * 86400000);
    var m = monDate.getUTCMonth();
    if (m !== lastMonth) {
      monthLabels.push({
        col,
        label: MONTH_NAMES[m]
      });
      lastMonth = m;
    }
  }
  return {
    cells,
    monthLabels,
    startMon,
    todayUTC
  };
}
function Heatmap({
  data
}) {
  var [hover, setHover] = useState(null); // { i, day, x, y, flip }
  var bodyRef = React.useRef(null);
  var {
    cells,
    monthLabels
  } = React.useMemo(() => buildCalendar(data), [data]);
  // Color scale over realized days only (zeros and empties don't move the max).
  var realized = data.filter(d => d.pnl);
  var max = Math.max(...realized.map(d => Math.abs(d.pnl)), 1);
  var colorFor = v => {
    if (!v) return "var(--surface-2)";
    var intensity = Math.min(1, Math.abs(v) / max);
    var alpha = 0.18 + intensity * 0.65;
    return v > 0 ? `oklch(0.65 0.18 145 / ${alpha})` : `oklch(0.55 0.20 25 / ${alpha})`;
  };
  var total = data.reduce((s, d) => s + d.pnl, 0);
  var wins = data.reduce((s, d) => s + (d.wins || (d.pnl > 0 ? 1 : 0)), 0);
  var losses = data.reduce((s, d) => s + (d.losses || (d.pnl < 0 ? 1 : 0)), 0);
  var fmt$ = v => (v >= 0 ? "+$" : "−$") + Math.abs(v).toLocaleString("en-US", {
    maximumFractionDigits: 0
  });
  return /*#__PURE__*/React.createElement("div", {
    className: "card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "card-head"
  }, /*#__PURE__*/React.createElement("h3", null, "Realized P&L \xB7 last 3 months"), /*#__PURE__*/React.createElement("div", {
    className: "row",
    style: {
      gap: 14,
      fontFamily: "var(--mono)",
      fontSize: 11
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: total >= 0 ? "up" : "down"
  }, fmt$(total)), /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--muted)"
    }
  }, wins, "W / ", losses, "L"), /*#__PURE__*/React.createElement("span", {
    className: "row",
    style: {
      gap: 4,
      color: "var(--muted)",
      fontSize: 10
    }
  }, /*#__PURE__*/React.createElement("span", null, "\u2212"), [-1, -0.5, 0, 0.5, 1].map((v, i) => /*#__PURE__*/React.createElement("i", {
    key: i,
    style: {
      width: 10,
      height: 10,
      borderRadius: 2,
      background: colorFor(v * max),
      display: "inline-block"
    }
  })), /*#__PURE__*/React.createElement("span", null, "+")))), /*#__PURE__*/React.createElement("div", {
    className: "card-body",
    style: {
      position: "relative"
    },
    ref: bodyRef
  }, /*#__PURE__*/React.createElement("div", {
    className: "calendar"
  }, /*#__PURE__*/React.createElement("div", {
    className: "cal-months",
    style: {
      gridTemplateColumns: `repeat(${CAL_WEEKS}, var(--cal-cell))`
    }
  }, monthLabels.map(m => /*#__PURE__*/React.createElement("span", {
    key: m.col,
    className: "cal-month-label",
    style: {
      gridColumnStart: m.col + 1
    }
  }, m.label))), /*#__PURE__*/React.createElement("div", {
    className: "cal-body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "cal-weekdays"
  }, ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d, i) => /*#__PURE__*/React.createElement("span", {
    key: d,
    className: "cal-weekday",
    style: {
      visibility: i % 2 === 0 ? "visible" : "hidden"
    }
  }, d.slice(0, 1)))), /*#__PURE__*/React.createElement("div", {
    className: "heatmap",
    style: {
      gridTemplateColumns: `repeat(${CAL_WEEKS}, var(--cal-cell))`
    }
  }, cells.map((c, i) => {
    if (c.future) return /*#__PURE__*/React.createElement("div", {
      key: i,
      className: "cell future"
    });
    var bg = c.day ? colorFor(c.day.pnl) : "var(--surface-2)";
    return /*#__PURE__*/React.createElement("div", {
      key: i,
      className: `cell${c.weekend ? " weekend" : ""}${c.day ? " has-trades" : ""}`,
      style: {
        background: bg
      },
      onMouseEnter: e => {
        if (!c.day) return;
        var rect = bodyRef.current.getBoundingClientRect();
        var cell = e.currentTarget.getBoundingClientRect();
        var TIP_W = 280;
        var flip = cell.right - rect.left + TIP_W + 12 > rect.width;
        setHover({
          i,
          day: c.day,
          x: cell.left - rect.left + (flip ? -8 : cell.width + 8),
          y: cell.top - rect.top,
          flip
        });
      },
      onMouseLeave: () => setHover(h => h && h.i === i ? null : h)
    });
  })))), hover && /*#__PURE__*/React.createElement(RealizedDayTip, {
    day: hover.day,
    fmt$: fmt$,
    x: hover.x,
    y: hover.y,
    flip: hover.flip
  })));
}
function RealizedDayTip({
  day,
  fmt$,
  x,
  y,
  flip
}) {
  var dateStr = day.date ? new Date(day.date + "T12:00:00Z").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric"
  }) : new Date(day.t).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric"
  });
  var trades = day.trades || [];
  var style = flip ? {
    right: `calc(100% - ${x}px)`,
    top: y
  } : {
    left: x,
    top: y
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "realized-tip",
    style: style
  }, /*#__PURE__*/React.createElement("div", {
    className: "realized-tip-head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "mono"
  }, dateStr), /*#__PURE__*/React.createElement("span", {
    className: `mono ${day.pnl >= 0 ? "up" : "down"}`
  }, fmt$(day.pnl))), trades.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "realized-tip-empty"
  }, "no closed trades") : /*#__PURE__*/React.createElement("table", {
    className: "realized-tip-table"
  }, /*#__PURE__*/React.createElement("tbody", null, trades.slice(0, 8).map((t, i) => /*#__PURE__*/React.createElement("tr", {
    key: i
  }, /*#__PURE__*/React.createElement("td", {
    className: "t"
  }, t.ticker), /*#__PURE__*/React.createElement("td", {
    className: "q mono"
  }, t.qty), /*#__PURE__*/React.createElement("td", {
    className: "px mono"
  }, t.entry, "\u2192", t.exit), /*#__PURE__*/React.createElement("td", {
    className: `p mono ${t.pnl >= 0 ? "up" : "down"}`
  }, fmt$(t.pnl)))), trades.length > 8 && /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    colSpan: "4",
    className: "realized-tip-more"
  }, "+", trades.length - 8, " more")))));
}

// ============== Cascade tier badge (PRD 74 + PRD 82) ==============
// Annotates trade rows produced by the CATALYST_WATERFALL cascade strategy.
// Colour map: social → green, regulatory → deep teal, options_tech → amber,
// naive → grey. Regulatory (PRD 82) reads EDGAR Form-4 + 8-K signals.
function TierBadge({
  tier
}) {
  if (!tier) return null;
  var t = String(tier).toLowerCase();
  var map = {
    social: {
      bg: "var(--pos)",
      fg: "#0a0e14",
      label: "SOCIAL"
    },
    regulatory: {
      bg: "#1e6b7a",
      fg: "#e6f7fb",
      label: "REGULATORY"
    },
    options_tech: {
      bg: "var(--accent)",
      fg: "#0a0e14",
      label: "OPTIONS/TECH"
    },
    naive: {
      bg: "var(--muted)",
      fg: "#0a0e14",
      label: "NAIVE"
    }
  };
  var cfg = map[t] || {
    bg: "var(--muted)",
    fg: "#0a0e14",
    label: t.toUpperCase()
  };
  return /*#__PURE__*/React.createElement("span", {
    className: "tier-badge",
    title: `waterfall tier: ${t}`,
    style: {
      display: "inline-block",
      padding: "1px 6px",
      marginRight: 6,
      borderRadius: 3,
      fontFamily: "var(--mono)",
      fontSize: 9.5,
      fontWeight: 600,
      letterSpacing: 0.4,
      background: cfg.bg,
      color: cfg.fg,
      verticalAlign: "middle"
    }
  }, cfg.label);
}
window.TierBadge = TierBadge;

// A PRD 998 mleg spread row (`type: "OPTION_SPREAD"`) — one row per spread,
// never one per leg. `side`/`entry`/`exit` are null on these rows (there's no
// single entry/exit price for a two-leg vertical), so the table renders
// structure/credit/breakeven in their place instead of crashing on
// `null.toFixed`.
function tradeStructureLabel(t) {
  if (t.type !== "OPTION_SPREAD" || !t.right) return null;
  var {
    spreadStructure
  } = window.SpreadFormat;
  var shortParsed = {
    right: t.right,
    strike: t.shortStrike
  };
  var longParsed = {
    right: t.right,
    strike: t.longStrike
  };
  var s = spreadStructure(shortParsed, longParsed, t.ticker);
  return s ? s.name : "Credit spread";
}

// ============== Trades table ==============
function TradesTable({
  trades,
  bmcUrl
}) {
  var [filter, setFilter] = useState("ALL");
  var [openTrade, setOpenTrade] = useState(null);
  var filtered = trades.filter(t => {
    if (filter === "OPEN") return t.status === "OPEN";
    if (filter === "CLOSED") return t.status === "CLOSED";
    if (filter === "WINS") return t.status === "CLOSED" && t.pnl > 0;
    if (filter === "LOSSES") return t.status === "CLOSED" && t.pnl < 0;
    return true;
  });
  var fmt$ = v => (v >= 0 ? "+$" : "−$") + Math.abs(v).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  var {
    money
  } = window.SpreadFormat;
  return /*#__PURE__*/React.createElement("div", {
    className: "card"
  }, /*#__PURE__*/React.createElement(window.CardHead, {
    title: `Live Trade Log · ${filtered.length} of ${trades.length} shown`,
    feedbackId: "live-trade-log"
  }, /*#__PURE__*/React.createElement("div", {
    className: "tf"
  }, ["ALL", "OPEN", "CLOSED", "WINS", "LOSSES"].map(f => /*#__PURE__*/React.createElement("button", {
    key: f,
    className: filter === f ? "active" : "",
    onClick: () => setFilter(f)
  }, f)))), /*#__PURE__*/React.createElement("div", {
    className: "card-body tight",
    style: {
      maxHeight: 480,
      overflowY: "auto"
    }
  }, /*#__PURE__*/React.createElement("table", {
    className: "trades"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "ID"), /*#__PURE__*/React.createElement("th", null, "Ticker"), /*#__PURE__*/React.createElement("th", null, "Side"), /*#__PURE__*/React.createElement("th", null, "Type"), /*#__PURE__*/React.createElement("th", null, "Status"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Entry"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Exit"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Qty"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "P&L"), /*#__PURE__*/React.createElement("th", null, "Source"), /*#__PURE__*/React.createElement("th", null, "Note"))), /*#__PURE__*/React.createElement("tbody", null, filtered.map(t => {
    var isSpread = t.type === "OPTION_SPREAD";
    var structureLabel = tradeStructureLabel(t);
    return /*#__PURE__*/React.createElement("tr", {
      key: t.id,
      onClick: () => setOpenTrade(t),
      style: {
        cursor: "pointer"
      },
      title: "Click for provenance"
    }, /*#__PURE__*/React.createElement("td", {
      className: "dim"
    }, t.id), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("div", {
      className: "ticker"
    }, t.ticker), /*#__PURE__*/React.createElement("div", {
      className: "sub-cell"
    }, t.opened, t.closed ? ` → ${t.closed}` : " · open")), /*#__PURE__*/React.createElement("td", null, isSpread ? /*#__PURE__*/React.createElement("span", {
      className: "pill"
    }, t.right || "SPREAD") : /*#__PURE__*/React.createElement("span", {
      className: `pill ${t.side === "LONG" ? "long" : "short"}`
    }, t.side)), /*#__PURE__*/React.createElement("td", {
      className: "dim"
    }, isSpread ? structureLabel || "SPREAD" : t.type), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("span", {
      className: `pill ${t.status === "OPEN" ? "open" : "closed"}`
    }, t.status)), isSpread ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("td", {
      className: "num",
      title: "Credit received"
    }, money(t.credit)), /*#__PURE__*/React.createElement("td", {
      className: "num dim",
      title: "Breakeven"
    }, t.breakeven != null ? money(t.breakeven) : "—")) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("td", {
      className: "num"
    }, t.entry != null ? t.entry.toFixed(2) : "—"), /*#__PURE__*/React.createElement("td", {
      className: "num dim"
    }, t.exit != null ? t.exit.toFixed(2) : "—")), /*#__PURE__*/React.createElement("td", {
      className: "num dim"
    }, t.qty), /*#__PURE__*/React.createElement("td", {
      className: `num ${t.pnl >= 0 ? "up" : "down"}`
    }, fmt$(t.pnl), /*#__PURE__*/React.createElement("div", {
      className: "sub-cell",
      style: {
        color: t.pnl >= 0 ? "var(--pos)" : "var(--neg)",
        opacity: 0.7
      }
    }, (t.pnlPct >= 0 ? "+" : "") + (t.pnlPct || 0).toFixed(1), "%"), t.pnl > 1000 && t.status === "CLOSED" && /*#__PURE__*/React.createElement("a", {
      className: "tip-inline",
      href: bmcUrl,
      target: "_blank",
      rel: "noreferrer",
      title: "Tip the trader",
      onClick: e => e.stopPropagation()
    }, "\u2615 tip")), /*#__PURE__*/React.createElement("td", {
      className: "dim"
    }, t.source), /*#__PURE__*/React.createElement("td", {
      className: "dim",
      style: {
        fontSize: 10.5,
        maxWidth: 180
      }
    }, /*#__PURE__*/React.createElement(TierBadge, {
      tier: t.tier
    }), isSpread && t.shortStrike != null && t.longStrike != null && /*#__PURE__*/React.createElement("span", {
      className: "mono-dim"
    }, "$", t.shortStrike, "/$", t.longStrike, " exp ", t.expiry, " (DTE ", t.dte, ") \xB7 "), t.note));
  })))), openTrade && window.TradeProvenanceModal && /*#__PURE__*/React.createElement(window.TradeProvenanceModal, {
    trade: openTrade,
    onClose: () => setOpenTrade(null)
  }));
}

// ============== Subreddit panel ==============
function SubredditPanel({
  subs
}) {
  var [tf, setTf] = useState("24H");
  var fmtSubs = n => n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : (n / 1e3).toFixed(0) + "k";
  return /*#__PURE__*/React.createElement("div", {
    className: "card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "card-head"
  }, /*#__PURE__*/React.createElement("h3", null, "Subreddit Pulse \xB7 10 sources"), /*#__PURE__*/React.createElement("div", {
    className: "tf"
  }, ["24H", "7D", "30D"].map(t => /*#__PURE__*/React.createElement("button", {
    key: t,
    className: tf === t ? "active" : "",
    onClick: () => setTf(t)
  }, t)))), /*#__PURE__*/React.createElement("div", {
    className: "card-body tight"
  }, subs.map(s => {
    var sentColor = s.sentiment >= 0 ? "var(--pos)" : "var(--neg)";
    var sentPct = (Math.abs(s.sentiment) * 100).toFixed(0);
    return /*#__PURE__*/React.createElement("div", {
      className: "sub-row",
      key: s.name
    }, /*#__PURE__*/React.createElement("div", {
      className: "name"
    }, /*#__PURE__*/React.createElement("b", null, "r/", s.name), /*#__PURE__*/React.createElement("small", null, fmtSubs(s.subs), " subs \xB7 ", s.posts24h, " posts/24h")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Sparkline, {
      data: s.pulse,
      width: 56,
      height: 18,
      color: "var(--info)"
    })), /*#__PURE__*/React.createElement("div", {
      className: "row",
      style: {
        gap: 6
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "sent",
      title: `Sentiment ${s.sentiment.toFixed(2)}`
    }, /*#__PURE__*/React.createElement("i", {
      style: {
        width: `${sentPct}%`,
        background: sentColor,
        marginLeft: s.sentiment >= 0 ? "50%" : `${50 - parseFloat(sentPct) / 2}%`
      }
    })), /*#__PURE__*/React.createElement("span", {
      className: s.change24h >= 0 ? "up" : "down",
      style: {
        fontSize: 10
      }
    }, s.change24h >= 0 ? "+" : "", s.change24h.toFixed(2))), /*#__PURE__*/React.createElement("div", {
      className: "tickers"
    }, s.top.map(t => /*#__PURE__*/React.createElement("span", {
      className: "chip",
      key: t
    }, t))));
  })));
}

// ============== Trending tickers ==============
function TrendingTickers({
  trending
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "card-head"
  }, /*#__PURE__*/React.createElement("h3", null, "Trending Tickers \xB7 24h aggregate"), /*#__PURE__*/React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 10,
      color: "var(--muted)"
    }
  }, "across 10 subs")), /*#__PURE__*/React.createElement("div", {
    className: "card-body tight"
  }, trending.map((t, i) => {
    var sentColor = t.sentiment >= 0 ? "var(--pos)" : "var(--neg)";
    var w = Math.abs(t.sentiment) * 50;
    return /*#__PURE__*/React.createElement("div", {
      className: "trend-row",
      key: t.ticker
    }, /*#__PURE__*/React.createElement("span", {
      className: "trend-rank"
    }, String(i + 1).padStart(2, "0")), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("span", {
      className: "trend-tk"
    }, t.ticker), /*#__PURE__*/React.createElement("span", {
      className: "trend-mentions",
      style: {
        marginLeft: 8
      }
    }, t.mentions.toLocaleString(), " ", /*#__PURE__*/React.createElement("span", {
      className: "dim",
      style: {
        fontSize: 10
      }
    }, "mentions"))), /*#__PURE__*/React.createElement("span", {
      className: "sent",
      title: `Sentiment ${t.sentiment.toFixed(2)}`
    }, /*#__PURE__*/React.createElement("i", {
      style: {
        width: `${w}%`,
        background: sentColor,
        marginLeft: t.sentiment >= 0 ? "50%" : `${50 - w}%`
      }
    })), /*#__PURE__*/React.createElement("span", {
      className: t.change >= 0 ? "up" : "down",
      style: {
        minWidth: 56,
        textAlign: "right"
      }
    }, t.change >= 0 ? "+" : "", t.change.toFixed(1), "%"), /*#__PURE__*/React.createElement("span", {
      className: `pill ${t.action.startsWith("HOLDING") ? "holding" : t.action.startsWith("WATCHING") ? "watching" : t.action.startsWith("STOPPED") ? "stopped" : "passed"}`
    }, t.action));
  })));
}

// ============== Themes ==============
function Themes({
  themes
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "card-head"
  }, /*#__PURE__*/React.createElement("h3", null, "What Reddit Is Talking About"), /*#__PURE__*/React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 10,
      color: "var(--muted)"
    }
  }, "LLM-summarized \xB7 refreshed 4m ago")), /*#__PURE__*/React.createElement("div", {
    className: "card-body tight"
  }, themes.map(th => /*#__PURE__*/React.createElement("div", {
    className: "theme",
    key: th.title
  }, /*#__PURE__*/React.createElement("div", {
    className: "theme-head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "theme-title"
  }, th.title), /*#__PURE__*/React.createElement("span", {
    className: "theme-heat"
  }, /*#__PURE__*/React.createElement("span", {
    className: "dim"
  }, "heat"), /*#__PURE__*/React.createElement("span", {
    className: "heat-bar"
  }, /*#__PURE__*/React.createElement("i", {
    style: {
      width: `${th.heat}%`
    }
  })), /*#__PURE__*/React.createElement("span", {
    className: "mono"
  }, th.heat), /*#__PURE__*/React.createElement("span", {
    className: th.change >= 0 ? "up" : "down",
    style: {
      fontSize: 10
    }
  }, th.change >= 0 ? "+" : "", th.change))), /*#__PURE__*/React.createElement("p", {
    className: "theme-blurb"
  }, th.blurb), /*#__PURE__*/React.createElement("div", {
    className: "theme-meta"
  }, th.subs.map(s => /*#__PURE__*/React.createElement("span", {
    className: "chip",
    key: s
  }, "r/", s)))))));
}

// ============== Watchlist ==============
// Restored rich watchlist (was its own tab; now an inline review section, no
// tab/shell). Per-ticker active-signal cards — 30d mention sparkline, 14d
// sentiment bars, conviction meter, why-watching + trigger-to-enter — over
// window.WATCHLIST_DETAIL, followed by the rejected-signals table over
// window.PASSED_SIGNALS. The bare long-horizon catalyst table it briefly
// replaced is retired. Both globals are still emitted by snapshot.py
// (build_watchlist_detail / build_passed_signals).
function Watchlist({
  detail,
  passed
}) {
  var list = Array.isArray(detail) ? detail : window.WATCHLIST_DETAIL || [];
  var rejected = Array.isArray(passed) ? passed : window.PASSED_SIGNALS || [];
  return /*#__PURE__*/React.createElement("div", {
    id: "watchlist",
    style: {
      display: "grid",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "card"
  }, /*#__PURE__*/React.createElement(window.CardHead, {
    title: `Watchlist · ${list.length} tracked`,
    feedbackId: "watchlist"
  }, /*#__PURE__*/React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 10,
      color: "var(--muted)"
    }
  }, "conviction floor 0.65 to enter")), /*#__PURE__*/React.createElement("div", {
    className: "card-body tight"
  }, list.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "dim",
    style: {
      padding: "12px 4px",
      fontSize: 12
    }
  }, "No signals tracked right now.") : list.map(w => {
    var series = Array.isArray(w.series) ? w.series : [];
    var sentSeries = Array.isArray(w.sentSeries) ? w.sentSeries : [];
    var max = Math.max(1, ...series);
    var sentMax = Math.max(1, ...sentSeries.map(Math.abs));
    var conv = w.conviction ?? 0;
    return /*#__PURE__*/React.createElement("div", {
      key: w.ticker,
      style: {
        padding: 14,
        borderBottom: "1px solid var(--line)"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "grid",
        gridTemplateColumns: "120px 1fr 1fr auto",
        gap: 16,
        alignItems: "center"
      }
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      className: "ticker mono",
      style: {
        fontSize: 16,
        fontWeight: 600
      }
    }, w.ticker), w.addedDays != null ? /*#__PURE__*/React.createElement("div", {
      className: "mono",
      style: {
        fontSize: 10,
        color: "var(--muted)",
        marginTop: 2
      }
    }, "added ", w.addedDays, "d ago") : null, /*#__PURE__*/React.createElement("span", {
      className: `pill ${w.status === "WATCHING" ? "watching" : "passed"}`,
      style: {
        marginTop: 6,
        display: "inline-flex"
      }
    }, w.status)), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      className: "label",
      style: {
        fontFamily: "var(--mono)",
        fontSize: 10,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        color: "var(--muted)",
        marginBottom: 4
      }
    }, "Mention volume \xB7 30d"), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 1,
        height: 32,
        alignItems: "flex-end"
      }
    }, series.map((v, i) => /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        flex: 1,
        height: `${v / max * 100}%`,
        background: "var(--info)",
        opacity: 0.4 + v / max * 0.6,
        borderRadius: "1px 1px 0 0"
      }
    }))), /*#__PURE__*/React.createElement("div", {
      className: "mono",
      style: {
        fontSize: 10,
        color: "var(--muted)",
        marginTop: 4
      }
    }, w.mentions24h, " mentions/24h")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      className: "label",
      style: {
        fontFamily: "var(--mono)",
        fontSize: 10,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        color: "var(--muted)",
        marginBottom: 4
      }
    }, "Sentiment \xB7 14d"), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 1,
        height: 32,
        alignItems: "center",
        position: "relative"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        position: "absolute",
        left: 0,
        right: 0,
        top: "50%",
        height: 1,
        background: "var(--line-2)"
      }
    }), sentSeries.map((v, i) => {
      var h = Math.abs(v) / sentMax * 14;
      return /*#__PURE__*/React.createElement("div", {
        key: i,
        style: {
          flex: 1,
          height: h,
          background: v >= 0 ? "var(--pos)" : "var(--neg)",
          marginTop: v >= 0 ? `${16 - h}px` : "16px",
          borderRadius: 1
        }
      });
    })), /*#__PURE__*/React.createElement("div", {
      className: "mono",
      style: {
        fontSize: 10,
        color: "var(--muted)",
        marginTop: 4
      }
    }, "current ", /*#__PURE__*/React.createElement("span", {
      className: (w.sentiment ?? 0) >= 0 ? "up" : "down"
    }, (w.sentiment ?? 0) >= 0 ? "+" : "", (w.sentiment ?? 0).toFixed(2)))), /*#__PURE__*/React.createElement("div", {
      style: {
        textAlign: "right"
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "mono",
      style: {
        fontSize: 22,
        fontWeight: 600
      }
    }, (conv * 100).toFixed(0), "%"), /*#__PURE__*/React.createElement("div", {
      className: "mono",
      style: {
        fontSize: 10,
        color: "var(--muted)"
      }
    }, "conviction"), /*#__PURE__*/React.createElement("div", {
      style: {
        width: 80,
        height: 4,
        background: "var(--surface-2)",
        borderRadius: 2,
        marginTop: 6,
        marginLeft: "auto",
        overflow: "hidden"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: `${conv * 100}%`,
        height: "100%",
        background: conv >= 0.65 ? "var(--pos)" : "var(--warn)"
      }
    })))), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 10,
        paddingTop: 10,
        borderTop: "1px solid var(--line)",
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 16,
        fontSize: 12
      }
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
      className: "dim mono",
      style: {
        fontSize: 10,
        textTransform: "uppercase",
        letterSpacing: "0.08em"
      }
    }, "Why watching"), /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("span", {
      style: {
        color: "var(--text-2)"
      }
    }, w.reason)), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
      className: "dim mono",
      style: {
        fontSize: 10,
        textTransform: "uppercase",
        letterSpacing: "0.08em"
      }
    }, "Trigger to enter"), /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("span", {
      style: {
        color: "var(--text-2)"
      }
    }, w.triggerLevel))));
  }))), rejected.length > 0 ? /*#__PURE__*/React.createElement("div", {
    className: "card"
  }, /*#__PURE__*/React.createElement(window.CardHead, {
    title: "Signals the engine rejected \xB7 with retroactive outcome",
    feedbackId: "watchlist-rejected-signals"
  }, /*#__PURE__*/React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 10,
      color: "var(--muted)"
    }
  }, rejected.length, " passed")), /*#__PURE__*/React.createElement("div", {
    className: "card-body tight"
  }, /*#__PURE__*/React.createElement("table", {
    className: "trades"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Ticker"), /*#__PURE__*/React.createElement("th", null, "Date"), /*#__PURE__*/React.createElement("th", null, "Why rejected"), /*#__PURE__*/React.createElement("th", null, "Outcome"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "P&L impact"))), /*#__PURE__*/React.createElement("tbody", null, rejected.map((p, i) => /*#__PURE__*/React.createElement("tr", {
    key: `${p.ticker}:${p.date}:${i}`
  }, /*#__PURE__*/React.createElement("td", {
    className: "ticker"
  }, p.ticker), /*#__PURE__*/React.createElement("td", {
    className: "dim"
  }, p.date), /*#__PURE__*/React.createElement("td", {
    className: "dim",
    style: {
      maxWidth: 320
    }
  }, p.reason), /*#__PURE__*/React.createElement("td", {
    className: String(p.outcome).startsWith("+") ? "up" : "down"
  }, p.outcome), /*#__PURE__*/React.createElement("td", {
    className: `num ${String(p.outcomePnl).startsWith("missed") ? "down" : "up"}`,
    style: {
      fontSize: 11
    }
  }, p.outcomePnl))))))) : null);
}

// --- Option-leg grouping for CurrentPositions ---------------------------
// window.POSITIONS is the raw Alpaca book: one row PER OPTION LEG, not per
// spread — a 2-leg vertical shows up as two SHORT/LONG rows on the same
// underlying. Pair legs into verticals by (underlying, expiry, right):
// exactly one SHORT + one LONG in a bucket is a clean vertical; anything left
// over (assignment leftover, one leg already closed, three legs on one
// expiry) renders as an explicit unpaired-leg row rather than being dropped
// or mis-paired with an unrelated leg on the same underlying. Two spreads on
// the same underlying at different expiries land in different buckets (the
// key includes expiry) so they never collapse into one row.
function groupPositionLegsIntoSpreads(positions) {
  var {
    parseOccSymbol
  } = window.SpreadFormat;
  var equity = [];
  var buckets = {};
  (positions || []).forEach(p => {
    var parsed = parseOccSymbol(p.ticker);
    if (!parsed) {
      equity.push(p);
      return;
    }
    var key = `${parsed.root}|${parsed.expiry}|${parsed.right}`;
    (buckets[key] = buckets[key] || []).push(Object.assign({}, p, {
      parsed
    }));
  });
  var spreads = [];
  var unpaired = [];
  Object.keys(buckets).forEach(key => {
    var legs = buckets[key];
    // Sort by strike before pairing so a bucket holding more than one vertical
    // (e.g. two puts spreads on the same underlying/expiry) pairs each short
    // with its nearest long by strike, not an arbitrary array-order neighbor —
    // reduces (never fully eliminates without an explicit leg-group id from
    // the broker) the chance of pairing legs from unrelated verticals.
    var shorts = legs.filter(l => l.side === "SHORT").sort((a, b) => a.parsed.strike - b.parsed.strike);
    var longs = legs.filter(l => l.side === "LONG").sort((a, b) => a.parsed.strike - b.parsed.strike);
    while (shorts.length && longs.length) {
      spreads.push(buildSpreadRow(shorts.shift(), longs.shift()));
    }
    shorts.forEach(l => unpaired.push(l));
    longs.forEach(l => unpaired.push(l));
  });
  return {
    spreads,
    unpaired,
    equity
  };
}
function buildSpreadRow(shortLeg, longLeg) {
  var {
    spreadStructure,
    breakeven,
    dteFromExpiry,
    money
  } = window.SpreadFormat;
  var structure = spreadStructure(shortLeg.parsed, longLeg.parsed, shortLeg.parsed.root);
  var contracts = shortLeg.qty || longLeg.qty || 0;
  // Credit received at entry ≈ (short avg price − long avg price) × contracts
  // × 100, mirroring aggregations._build_spread_row's per-leg credit math.
  var credit = (Number(shortLeg.avgEntry || 0) - Number(longLeg.avgEntry || 0)) * contracts * 100;
  var width = Math.abs(shortLeg.parsed.strike - longLeg.parsed.strike);
  var maxRisk = width * contracts * 100 - credit;
  var be = breakeven(shortLeg.parsed, credit, contracts);
  var pnl = (shortLeg.unrealizedPl || 0) + (longLeg.unrealizedPl || 0);
  var dte = dteFromExpiry(shortLeg.parsed.expiry);
  var name = structure ? structure.name : "Credit spread";
  var rationale = `${name} on ${shortLeg.parsed.root}: short $${shortLeg.parsed.strike} / ` + `long $${longLeg.parsed.strike} exp ${shortLeg.parsed.expiry} — collected ${money(credit)} credit.`;
  var dteTxt = dte != null ? `${dte}d` : "—";
  var exitIntent = `Intend to close at the profit target or let it ride to expiry ${shortLeg.parsed.expiry} ` + `(DTE ${dteTxt}); early-assignment risk on the short $${shortLeg.parsed.strike} leg if it goes ` + `in-the-money before then; hard time-stop still applies.`;
  return {
    key: `${shortLeg.parsed.root}:${shortLeg.parsed.expiry}:${shortLeg.parsed.right}`,
    ticker: shortLeg.parsed.root,
    structure,
    contracts,
    credit,
    maxRisk,
    breakeven: be,
    pnl,
    dte,
    expiry: shortLeg.parsed.expiry,
    shortStrike: shortLeg.parsed.strike,
    longStrike: longLeg.parsed.strike,
    right: shortLeg.parsed.right,
    rationale,
    exitIntent
  };
}

// One row for an option leg that couldn't be paired — still renders (never
// silently dropped), decoded to plain English, flagged as unpaired.
function UnpairedLegRow({
  p
}) {
  var {
    plainEnglishLeg,
    money
  } = window.SpreadFormat;
  var fmt$ = v => (v >= 0 ? "+$" : "−$") + Math.abs(v).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    className: "ticker"
  }, p.parsed.root, /*#__PURE__*/React.createElement("span", {
    className: "pill",
    style: {
      marginLeft: 6,
      fontSize: 9,
      borderColor: "var(--warn)",
      color: "var(--warn)"
    }
  }, "UNPAIRED LEG")), /*#__PURE__*/React.createElement("td", {
    className: "dim"
  }, plainEnglishLeg(p.ticker)), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("span", {
    className: `pill ${p.side === "LONG" ? "long" : "short"}`
  }, p.side)), /*#__PURE__*/React.createElement("td", {
    className: "num dim"
  }, p.qty), /*#__PURE__*/React.createElement("td", {
    className: "num"
  }, money(p.avgEntry)), /*#__PURE__*/React.createElement("td", {
    className: `num ${p.unrealizedPl >= 0 ? "up" : "down"}`
  }, fmt$(p.unrealizedPl || 0)));
}

// One paired vertical spread row: structure, strikes, expiry/DTE, credit,
// max risk, breakeven, live mark-to-market P&L. Click to expand the
// spread-flavoured rationale/exit-intent (profit target, DTE, assignment risk
// — never the equity "cover at the open on T+1" copy).
function SpreadRow({
  s,
  open,
  onToggle
}) {
  var {
    money
  } = window.SpreadFormat;
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("tr", {
    onClick: onToggle,
    style: {
      cursor: "pointer"
    }
  }, /*#__PURE__*/React.createElement("td", {
    className: "ticker"
  }, s.ticker, /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: 4,
      fontSize: 9,
      color: "var(--muted)",
      opacity: 0.7
    }
  }, open ? "▲" : "▼")), /*#__PURE__*/React.createElement("td", {
    className: "dim"
  }, s.structure ? s.structure.name : "Credit spread"), /*#__PURE__*/React.createElement("td", {
    className: "dim mono"
  }, "$", s.shortStrike, "/$", s.longStrike), /*#__PURE__*/React.createElement("td", {
    className: "dim"
  }, s.expiry, " ", /*#__PURE__*/React.createElement("span", {
    className: "mono-dim"
  }, "(", s.dte != null ? `${s.dte}d` : "—", ")")), /*#__PURE__*/React.createElement("td", {
    className: "num"
  }, money(s.credit)), /*#__PURE__*/React.createElement("td", {
    className: "num dim"
  }, money(s.maxRisk)), /*#__PURE__*/React.createElement("td", {
    className: "num dim"
  }, s.breakeven != null ? money(s.breakeven) : "—"), /*#__PURE__*/React.createElement("td", {
    className: `num ${s.pnl >= 0 ? "up" : "down"}`
  }, money(s.pnl))), open && /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    colSpan: 8,
    style: {
      padding: "4px 8px 8px 28px",
      background: "var(--surface2, #1a1a2e)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: "var(--muted)",
      marginBottom: 3
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--text)",
      fontWeight: 600
    }
  }, "why: "), s.rationale), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: "var(--muted)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--text)",
      fontWeight: 600
    }
  }, "exit: "), s.exitIntent))));
}

// Current positions — the FULL open book from Alpaca (source of truth), so the
// whole book shows, not just catalyst-linked tickers. Reads window.POSITIONS.
// Option legs are grouped into spreads (PRD 999) — never rendered as bare
// unpaired OCC rows unless they genuinely have no partner.
function CurrentPositions({
  positions
}) {
  var rawRows = Array.isArray(positions) ? positions : [];
  var fmt$ = v => (v >= 0 ? "+$" : "−$") + Math.abs(v).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  var totalMv = rawRows.reduce((a, r) => a + (r.marketValue || 0), 0);
  var totalPl = rawRows.reduce((a, r) => a + (r.unrealizedPl || 0), 0);
  var {
    spreads,
    unpaired,
    equity
  } = React.useMemo(() => groupPositionLegsIntoSpreads(rawRows), [rawRows]);
  var rowCount = spreads.length + unpaired.length + equity.length;
  var [expanded, setExpanded] = React.useState({});
  var toggleSpread = key => setExpanded(s => ({
    ...s,
    [key]: !s[key]
  }));
  var toggleEquity = ticker => setExpanded(s => ({
    ...s,
    [`eq:${ticker}`]: !s[`eq:${ticker}`]
  }));
  return /*#__PURE__*/React.createElement("div", {
    className: "card",
    id: "positions"
  }, /*#__PURE__*/React.createElement(window.CardHead, {
    title: `Current Positions · ${rowCount} open`,
    feedbackId: "current-positions"
  }, /*#__PURE__*/React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 10,
      color: "var(--muted)"
    }
  }, "MV $", totalMv.toLocaleString("en-US", {
    maximumFractionDigits: 0
  }), " \xB7 ", /*#__PURE__*/React.createElement("span", {
    className: totalPl >= 0 ? "up" : "down"
  }, fmt$(totalPl)), " unrealized")), /*#__PURE__*/React.createElement("div", {
    className: "card-body tight",
    style: {
      maxHeight: 640,
      overflowY: "auto"
    }
  }, rowCount === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "dim",
    style: {
      padding: "12px 4px",
      fontSize: 12
    }
  }, "No open positions.") : /*#__PURE__*/React.createElement(React.Fragment, null, spreads.length > 0 && /*#__PURE__*/React.createElement("table", {
    className: "trades"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Underlying"), /*#__PURE__*/React.createElement("th", null, "Structure"), /*#__PURE__*/React.createElement("th", null, "Strikes (short/long)"), /*#__PURE__*/React.createElement("th", null, "Expiry (DTE)"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Credit"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Max risk"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Breakeven"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "P&L"))), /*#__PURE__*/React.createElement("tbody", null, spreads.map(s => /*#__PURE__*/React.createElement(SpreadRow, {
    key: s.key,
    s: s,
    open: !!expanded[s.key],
    onToggle: () => toggleSpread(s.key)
  })))), unpaired.length > 0 && /*#__PURE__*/React.createElement("table", {
    className: "trades",
    style: {
      marginTop: spreads.length ? 12 : 0
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Underlying"), /*#__PURE__*/React.createElement("th", null, "Leg"), /*#__PURE__*/React.createElement("th", null, "Side"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Qty"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Avg Entry"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Unrealized"))), /*#__PURE__*/React.createElement("tbody", null, unpaired.map(p => /*#__PURE__*/React.createElement(UnpairedLegRow, {
    key: p.ticker + ":" + p.side,
    p: p
  })))), equity.length > 0 && /*#__PURE__*/React.createElement("table", {
    className: "trades",
    style: {
      marginTop: spreads.length || unpaired.length ? 12 : 0
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Ticker"), /*#__PURE__*/React.createElement("th", null, "Side"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Qty"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Avg Entry"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Last"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Mkt Value"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Unrealized"))), /*#__PURE__*/React.createElement("tbody", null, equity.map(p => /*#__PURE__*/React.createElement(React.Fragment, {
    key: p.ticker
  }, /*#__PURE__*/React.createElement("tr", {
    onClick: () => p.rationale || p.exit_intent ? toggleEquity(p.ticker) : null,
    style: p.rationale || p.exit_intent ? {
      cursor: "pointer"
    } : {}
  }, /*#__PURE__*/React.createElement("td", {
    className: "ticker"
  }, p.ticker, window.TierBadge && /*#__PURE__*/React.createElement(TierBadge, {
    tier: p.tier
  }), (p.rationale || p.exit_intent) && /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: 4,
      fontSize: 9,
      color: "var(--muted)",
      opacity: 0.7
    }
  }, expanded[`eq:${p.ticker}`] ? "▲" : "▼")), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("span", {
    className: `pill ${p.side === "LONG" ? "long" : "short"}`
  }, p.side)), /*#__PURE__*/React.createElement("td", {
    className: "num dim"
  }, p.qty), /*#__PURE__*/React.createElement("td", {
    className: "num"
  }, (p.avgEntry || 0).toFixed(2)), /*#__PURE__*/React.createElement("td", {
    className: "num"
  }, (p.currentPrice || 0).toFixed(2)), /*#__PURE__*/React.createElement("td", {
    className: "num dim"
  }, "$", Math.abs(p.marketValue || 0).toLocaleString("en-US", {
    maximumFractionDigits: 0
  })), /*#__PURE__*/React.createElement("td", {
    className: `num ${p.unrealizedPl >= 0 ? "up" : "down"}`
  }, fmt$(p.unrealizedPl || 0), /*#__PURE__*/React.createElement("div", {
    className: "sub-cell",
    style: {
      color: p.unrealizedPl >= 0 ? "var(--pos)" : "var(--neg)",
      opacity: 0.7
    }
  }, p.unrealizedPlPct >= 0 ? "+" : "", (p.unrealizedPlPct || 0).toFixed(1), "%"))), expanded[`eq:${p.ticker}`] && (p.rationale || p.exit_intent) && /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    colSpan: 7,
    style: {
      padding: "4px 8px 8px 28px",
      background: "var(--surface2, #1a1a2e)"
    }
  }, p.rationale && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: "var(--muted)",
      marginBottom: 3
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--text)",
      fontWeight: 600
    }
  }, "why: "), p.rationale), p.exit_intent && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: "var(--muted)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--text)",
      fontWeight: 600
    }
  }, "exit: "), p.exit_intent))))))))));
}

// ============== Methodology + Footer ==============
function Methodology() {
  return /*#__PURE__*/React.createElement("div", {
    className: "card",
    id: "methodology"
  }, /*#__PURE__*/React.createElement("div", {
    className: "card-head"
  }, /*#__PURE__*/React.createElement("h3", null, "Methodology \xB7 how this works")), /*#__PURE__*/React.createElement("div", {
    className: "card-body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "method-grid"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h4", null, "01 \xB7 Ingest"), /*#__PURE__*/React.createElement("p", null, "The pipeline pulls posts and top-level comments from 10 stock-focused subreddits every 15 minutes. Body, title, score, comment count, ticker mentions ($-prefixed and dictionary-matched).")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h4", null, "02 \xB7 Score"), /*#__PURE__*/React.createElement("p", null, "An LLM tags each post with sentiment, topic and conviction. Per-ticker and per-sub aggregates roll up into per-strategy signal scores, weighted by post score and recency.")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h4", null, "03 \xB7 Execute"), /*#__PURE__*/React.createElement("p", null, "When a strategy's signal crosses its conviction gate the engine sizes, places stops, and routes orders. Fully autonomous, zero human review. Every fill streams straight to the audit log on this page.")))));
}

// ============== Footer CTA ==============
function FooterCTA({
  bmcUrl,
  perf
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "footer-cta"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h2", null, "If watching the experiment is useful, fuel it."), /*#__PURE__*/React.createElement("p", null, "Servers, scrapers, model calls and broker fees are paid out of pocket. No paid signals, no Discord, no affiliate. The bots make their own decisions; coffee keeps the pipeline running \u2014 and you get to watch live whether autonomous Reddit-driven trading actually works (so far: ", /*#__PURE__*/React.createElement("span", {
    className: "up mono"
  }, "+", perf.totalPnlPct.toFixed(1), "%"), " YTD vs SPY ", /*#__PURE__*/React.createElement("span", {
    className: "mono"
  }, "+", perf.spyYtdPct.toFixed(1), "%"), ").")), /*#__PURE__*/React.createElement("a", {
    className: "bmc-btn",
    href: bmcUrl,
    target: "_blank",
    rel: "noreferrer",
    style: {
      padding: "12px 20px",
      fontSize: 13
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "coffee"
  }, "\u2615"), " Buy me a coffee"));
}

// expose
Object.assign(window, {
  Sparkline,
  DualSparkline,
  StatusBar,
  Header,
  Hero,
  HeroLegacy,
  HeroAlpacaVsSpy,
  PerStrategyAttribution,
  StatStrip,
  EquityChart,
  Heatmap,
  TradesTable,
  TierBadge,
  SubredditPanel,
  TrendingTickers,
  Themes,
  Watchlist,
  CurrentPositions,
  Methodology,
  FooterCTA
});

/* ---- pages/pages.jsx ---- */
/* global React */
var {
  useState,
  useMemo
} = React;

// ============== Bar chart (horizontal) ==============
function HBarChart({
  rows,
  valueKey = "pnl",
  labelKey = "source",
  height = 22,
  signed = true,
  fmt
}) {
  var max = Math.max(...rows.map(r => Math.abs(r[valueKey])));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 6
    }
  }, rows.map(r => {
    var v = r[valueKey];
    var w = Math.abs(v) / max * 100;
    var color = !signed ? "var(--info)" : v >= 0 ? "var(--pos)" : "var(--neg)";
    return /*#__PURE__*/React.createElement("div", {
      key: r[labelKey],
      style: {
        display: "grid",
        gridTemplateColumns: "140px 1fr 80px",
        alignItems: "center",
        gap: 10,
        fontFamily: "var(--mono)",
        fontSize: 11
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        color: "var(--text-2)",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap"
      }
    }, r[labelKey]), /*#__PURE__*/React.createElement("div", {
      style: {
        height,
        background: "var(--surface-2)",
        borderRadius: 3,
        position: "relative",
        border: "1px solid var(--line)"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        position: "absolute",
        left: signed && v < 0 ? `${50 - w / 2}%` : signed ? "50%" : 0,
        width: signed ? `${w / 2}%` : `${w}%`,
        top: 0,
        bottom: 0,
        background: color,
        borderRadius: 2,
        opacity: 0.85
      }
    }), signed && /*#__PURE__*/React.createElement("div", {
      style: {
        position: "absolute",
        left: "50%",
        top: -2,
        bottom: -2,
        width: 1,
        background: "var(--line-2)"
      }
    })), /*#__PURE__*/React.createElement("span", {
      className: signed ? v >= 0 ? "up" : "down" : "",
      style: {
        textAlign: "right"
      }
    }, fmt ? fmt(v, r) : (signed ? v >= 0 ? "+" : "" : "") + (typeof v === "number" ? v.toLocaleString() : v)));
  }));
}

// ============== Vertical bar chart ==============
function VBarChart({
  rows,
  valueKey,
  labelKey,
  height = 140,
  signed = true
}) {
  var max = Math.max(...rows.map(r => Math.abs(r[valueKey])));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 4
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: `repeat(${rows.length}, 1fr)`,
      gap: 6,
      height,
      alignItems: "end"
    }
  }, rows.map(r => {
    var v = r[valueKey];
    var h = Math.abs(v) / max * (height - 24);
    var color = !signed ? "var(--info)" : v >= 0 ? "var(--pos)" : "var(--neg)";
    return /*#__PURE__*/React.createElement("div", {
      key: r[labelKey],
      style: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-end",
        height: "100%"
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: signed && v < 0 ? "down" : signed && v > 0 ? "up" : "",
      style: {
        fontFamily: "var(--mono)",
        fontSize: 10,
        marginBottom: 2
      }
    }, signed && v >= 0 ? "+" : "", Math.abs(v) >= 1000 ? (v / 1000).toFixed(1) + "k" : v), /*#__PURE__*/React.createElement("div", {
      style: {
        width: "70%",
        height: h,
        background: color,
        borderRadius: "2px 2px 0 0",
        opacity: 0.9
      }
    }));
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: `repeat(${rows.length}, 1fr)`,
      gap: 6,
      fontFamily: "var(--mono)",
      fontSize: 10,
      color: "var(--muted)",
      textAlign: "center"
    }
  }, rows.map(r => /*#__PURE__*/React.createElement("span", {
    key: r[labelKey]
  }, r[labelKey]))));
}

// ============== Trades deep-dive page ==============
function TradesPage() {
  var trades = window.TRADES;
  var sourcePerf = window.SOURCE_PERF;
  var monthly = window.MONTHLY_PNL;
  var holds = window.HOLD_BUCKETS;
  var dist = window.PNL_DIST;
  var tickers = window.TICKER_PERF;
  var [search, setSearch] = useState("");
  var [filter, setFilter] = useState("ALL");
  var [sort, setSort] = useState({
    key: "id",
    dir: "desc"
  });
  var [openTrade, setOpenTrade] = useState(null);
  var filtered = useMemo(() => {
    var r = trades.filter(t => {
      if (filter === "OPEN") return t.status === "OPEN";
      if (filter === "WINS") return t.status === "CLOSED" && t.pnl > 0;
      if (filter === "LOSSES") return t.status === "CLOSED" && t.pnl < 0;
      if (filter === "BIG") return Math.abs(t.pnl) > 1000;
      return true;
    });
    if (search) {
      var s = search.toLowerCase();
      r = r.filter(t => t.ticker.toLowerCase().includes(s) || t.source.toLowerCase().includes(s) || t.note.toLowerCase().includes(s));
    }
    r = [...r].sort((a, b) => {
      var x = a[sort.key],
        y = b[sort.key];
      var cmp = typeof x === "number" ? x - y : String(x).localeCompare(String(y));
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return r;
  }, [trades, filter, search, sort]);
  var setSortKey = k => setSort(s => ({
    key: k,
    dir: s.key === k && s.dir === "desc" ? "asc" : "desc"
  }));
  var fmt$ = v => (v >= 0 ? "+$" : "−$") + Math.abs(v).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return /*#__PURE__*/React.createElement("main", {
    className: "shell"
  }, /*#__PURE__*/React.createElement(PageHeader, {
    title: "Trades",
    subtitle: "Every fill the engine has executed since Jan 6 \xB7 win or lose \xB7 linked to the source posts that triggered the signal"
  }), /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "statgrid"
  }, [["Total trades", window.PERF.trades], ["Win rate", (window.PERF.winRate * 100).toFixed(1) + "%"], ["Avg win / loss", `$${window.PERF.avgWin.toFixed(0)} / −$${Math.abs(window.PERF.avgLoss).toFixed(0)}`], ["Profit factor", window.PERF.profitFactor.toFixed(2)], ["Avg hold", window.PERF.avgHoldDays.toFixed(1) + "d"], ["Largest DD", window.PERF.maxDD.toFixed(1) + "%"]].map(s => /*#__PURE__*/React.createElement("div", {
    className: "stat",
    key: s[0]
  }, /*#__PURE__*/React.createElement("div", {
    className: "label"
  }, s[0]), /*#__PURE__*/React.createElement("div", {
    className: "value"
  }, s[1]))))), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-12",
    style: {
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "col-6 col-md-12"
  }, /*#__PURE__*/React.createElement("div", {
    className: "card"
  }, /*#__PURE__*/React.createElement(window.CardHead, {
    title: "Monthly P&L \xB7 12 months"
  }), /*#__PURE__*/React.createElement("div", {
    className: "card-body"
  }, /*#__PURE__*/React.createElement(VBarChart, {
    rows: monthly,
    valueKey: "pnl",
    labelKey: "month",
    height: 160
  })))), /*#__PURE__*/React.createElement("div", {
    className: "col-6 col-md-12"
  }, /*#__PURE__*/React.createElement("div", {
    className: "card"
  }, /*#__PURE__*/React.createElement(window.CardHead, {
    title: "P&L distribution \xB7 per trade"
  }), /*#__PURE__*/React.createElement("div", {
    className: "card-body"
  }, /*#__PURE__*/React.createElement(VBarChart, {
    rows: dist,
    valueKey: "count",
    labelKey: "bin",
    height: 160,
    signed: false
  })))), /*#__PURE__*/React.createElement("div", {
    className: "col-6 col-md-12"
  }, /*#__PURE__*/React.createElement("div", {
    className: "card"
  }, /*#__PURE__*/React.createElement(window.CardHead, {
    title: "P&L by source subreddit"
  }), /*#__PURE__*/React.createElement("div", {
    className: "card-body"
  }, /*#__PURE__*/React.createElement(HBarChart, {
    rows: sourcePerf,
    valueKey: "pnl",
    labelKey: "source",
    fmt: (v, r) => `${v >= 0 ? "+" : "−"}$${Math.abs(v).toLocaleString()}`
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10,
      paddingTop: 10,
      borderTop: "1px solid var(--line)",
      display: "grid",
      gridTemplateColumns: "140px 1fr 80px",
      gap: 10,
      fontFamily: "var(--mono)",
      fontSize: 10,
      color: "var(--muted)",
      textTransform: "uppercase",
      letterSpacing: "0.06em"
    }
  }, /*#__PURE__*/React.createElement("span", null, "source"), /*#__PURE__*/React.createElement("span", null, "n trades \xB7 win rate"), /*#__PURE__*/React.createElement("span", {
    style: {
      textAlign: "right"
    }
  }, "total p&l")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 4,
      marginTop: 6
    }
  }, sourcePerf.map(r => /*#__PURE__*/React.createElement("div", {
    key: r.source,
    style: {
      display: "grid",
      gridTemplateColumns: "140px 1fr 80px",
      gap: 10,
      fontFamily: "var(--mono)",
      fontSize: 10.5,
      color: "var(--muted)"
    }
  }, /*#__PURE__*/React.createElement("span", null), /*#__PURE__*/React.createElement("span", null, r.trades, "t \xB7 ", (r.winRate * 100).toFixed(0), "%"), /*#__PURE__*/React.createElement("span", null))))))), /*#__PURE__*/React.createElement("div", {
    className: "col-6 col-md-12"
  }, /*#__PURE__*/React.createElement("div", {
    className: "card"
  }, /*#__PURE__*/React.createElement(window.CardHead, {
    title: "Hold-period performance"
  }), /*#__PURE__*/React.createElement("div", {
    className: "card-body"
  }, /*#__PURE__*/React.createElement(HBarChart, {
    rows: holds,
    valueKey: "avgPnl",
    labelKey: "label",
    fmt: v => `${v >= 0 ? "+" : "−"}$${Math.abs(v)}`
  }), /*#__PURE__*/React.createElement("table", {
    className: "trades",
    style: {
      marginTop: 14
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Bucket"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Trades"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Win rate"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Avg P&L"))), /*#__PURE__*/React.createElement("tbody", null, holds.map(h => /*#__PURE__*/React.createElement("tr", {
    key: h.label
  }, /*#__PURE__*/React.createElement("td", null, h.label), /*#__PURE__*/React.createElement("td", {
    className: "num"
  }, h.trades), /*#__PURE__*/React.createElement("td", {
    className: "num"
  }, (h.winRate * 100).toFixed(0), "%"), /*#__PURE__*/React.createElement("td", {
    className: `num ${h.avgPnl >= 0 ? "up" : "down"}`
  }, h.avgPnl >= 0 ? "+" : "−", "$", Math.abs(h.avgPnl))))))))), /*#__PURE__*/React.createElement("div", {
    className: "col-12"
  }, /*#__PURE__*/React.createElement("div", {
    className: "card"
  }, /*#__PURE__*/React.createElement(window.CardHead, {
    title: "Top 10 tickers by P&L"
  }), /*#__PURE__*/React.createElement("div", {
    className: "card-body"
  }, /*#__PURE__*/React.createElement("table", {
    className: "trades"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Ticker"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Trades"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Win rate"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Total P&L"), /*#__PURE__*/React.createElement("th", null, "P&L bar"))), /*#__PURE__*/React.createElement("tbody", null, tickers.map(t => {
    var max = Math.max(...tickers.map(x => Math.abs(x.pnl)));
    var w = Math.abs(t.pnl) / max * 100;
    return /*#__PURE__*/React.createElement("tr", {
      key: t.ticker
    }, /*#__PURE__*/React.createElement("td", {
      className: "ticker"
    }, t.ticker), /*#__PURE__*/React.createElement("td", {
      className: "num"
    }, t.trades), /*#__PURE__*/React.createElement("td", {
      className: "num"
    }, (t.winRate * 100).toFixed(0), "%"), /*#__PURE__*/React.createElement("td", {
      className: `num ${t.pnl >= 0 ? "up" : "down"}`
    }, t.pnl >= 0 ? "+" : "−", "$", Math.abs(t.pnl).toLocaleString()), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("div", {
      style: {
        height: 10,
        background: "var(--surface-2)",
        borderRadius: 2,
        position: "relative",
        border: "1px solid var(--line)"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        position: "absolute",
        left: t.pnl >= 0 ? "50%" : `${50 - w / 2}%`,
        width: `${w / 2}%`,
        top: 0,
        bottom: 0,
        background: t.pnl >= 0 ? "var(--pos)" : "var(--neg)",
        borderRadius: 2
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        position: "absolute",
        left: "50%",
        top: -2,
        bottom: -2,
        width: 1,
        background: "var(--line-2)"
      }
    }))));
  }))))))), /*#__PURE__*/React.createElement("div", {
    className: "card"
  }, /*#__PURE__*/React.createElement(window.CardHead, {
    title: `Full trade log · ${filtered.length} of ${trades.length}`,
    feedbackId: "full-trade-log"
  }, /*#__PURE__*/React.createElement("div", {
    className: "row",
    style: {
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("input", {
    placeholder: "search ticker / source / note",
    value: search,
    onChange: e => setSearch(e.target.value),
    style: {
      background: "var(--bg-2)",
      border: "1px solid var(--line)",
      borderRadius: 4,
      color: "var(--text)",
      padding: "4px 8px",
      fontFamily: "var(--mono)",
      fontSize: 11,
      width: 220
    }
  }), /*#__PURE__*/React.createElement("div", {
    className: "tf"
  }, ["ALL", "OPEN", "WINS", "LOSSES", "BIG"].map(f => /*#__PURE__*/React.createElement("button", {
    key: f,
    className: filter === f ? "active" : "",
    onClick: () => setFilter(f)
  }, f))))), /*#__PURE__*/React.createElement("div", {
    className: "card-body tight",
    style: {
      maxHeight: 600,
      overflowY: "auto"
    }
  }, /*#__PURE__*/React.createElement("table", {
    className: "trades"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, [["id", "ID"], ["ticker", "Ticker"], ["side", "Side"], ["type", "Type"], ["status", "Status"], ["entry", "Entry"], ["exit", "Exit"], ["qty", "Qty"], ["pnl", "P&L"], ["source", "Source"]].map(([k, l]) => /*#__PURE__*/React.createElement("th", {
    key: k,
    onClick: () => setSortKey(k),
    style: {
      cursor: "pointer",
      userSelect: "none"
    },
    className: ["entry", "exit", "qty", "pnl"].includes(k) ? "num" : ""
  }, l, sort.key === k ? sort.dir === "desc" ? " ↓" : " ↑" : "")), /*#__PURE__*/React.createElement("th", null, "Note"))), /*#__PURE__*/React.createElement("tbody", null, filtered.map(t => /*#__PURE__*/React.createElement("tr", {
    key: t.id,
    onClick: () => setOpenTrade(t),
    style: {
      cursor: "pointer"
    },
    title: "Click for provenance"
  }, /*#__PURE__*/React.createElement("td", {
    className: "dim"
  }, t.id), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("div", {
    className: "ticker"
  }, t.ticker), /*#__PURE__*/React.createElement("div", {
    className: "sub-cell"
  }, t.opened, t.closed ? ` → ${t.closed}` : " · open")), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("span", {
    className: `pill ${t.side === "LONG" ? "long" : "short"}`
  }, t.side)), /*#__PURE__*/React.createElement("td", {
    className: "dim"
  }, t.type), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("span", {
    className: `pill ${t.status === "OPEN" ? "open" : "closed"}`
  }, t.status)), /*#__PURE__*/React.createElement("td", {
    className: "num"
  }, t.entry.toFixed(2)), /*#__PURE__*/React.createElement("td", {
    className: "num dim"
  }, t.exit ? t.exit.toFixed(2) : "—"), /*#__PURE__*/React.createElement("td", {
    className: "num dim"
  }, t.qty), /*#__PURE__*/React.createElement("td", {
    className: `num ${t.pnl >= 0 ? "up" : "down"}`
  }, fmt$(t.pnl), /*#__PURE__*/React.createElement("div", {
    className: "sub-cell",
    style: {
      color: t.pnl >= 0 ? "var(--pos)" : "var(--neg)",
      opacity: 0.7
    }
  }, t.pnlPct >= 0 ? "+" : "", t.pnlPct.toFixed(1), "%")), /*#__PURE__*/React.createElement("td", {
    className: "dim"
  }, t.source), /*#__PURE__*/React.createElement("td", {
    className: "dim",
    style: {
      fontSize: 10.5,
      maxWidth: 220
    }
  }, t.note))))))), openTrade && window.TradeProvenanceModal && /*#__PURE__*/React.createElement(window.TradeProvenanceModal, {
    trade: openTrade,
    onClose: () => setOpenTrade(null)
  }));
}

// ============== Reddit Intel page ==============
function RedditPage() {
  var subs = window.SUB_DETAIL;
  var flow = window.TICKER_FLOW;
  var posts = window.HOT_POSTS;
  var themes = window.THEMES;
  var [openSub, setOpenSub] = useState("wallstreetbets");
  var fmtSubs = n => n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : (n / 1e3).toFixed(0) + "k";
  var sub = subs.find(s => s.name === openSub) || subs[0];
  return /*#__PURE__*/React.createElement("main", {
    className: "shell"
  }, /*#__PURE__*/React.createElement(PageHeader, {
    title: "Reddit Intel",
    subtitle: "Mention flow, sentiment, top posts and per-subreddit drill-downs across 10 stock-focused communities"
  }), /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement(window.CardHead, {
    title: "Active themes \xB7 last 24h"
  }), /*#__PURE__*/React.createElement("div", {
    className: "card-body tight"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(3, 1fr)",
      borderTop: "1px solid var(--line)"
    }
  }, (themes || []).map((t, i) => /*#__PURE__*/React.createElement("div", {
    key: t.title || i,
    style: {
      padding: 14,
      borderRight: i % 3 === 2 ? "none" : "1px solid var(--line)",
      borderBottom: i < 3 ? "1px solid var(--line)" : "none"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      marginBottom: 4
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 600,
      fontSize: 13
    }
  }, t.title), /*#__PURE__*/React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 11
    }
  }, t.heat ?? "—", t.change != null && /*#__PURE__*/React.createElement("span", {
    className: t.change >= 0 ? "up" : "down",
    style: {
      marginLeft: 6
    }
  }, t.change >= 0 ? "+" : "", t.change))), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      color: "var(--text-2)",
      fontSize: 12,
      lineHeight: 1.5
    }
  }, t.blurb)))))), /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement(window.CardHead, {
    title: "Ticker mention flow \xB7 30 days"
  }, /*#__PURE__*/React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 10,
      color: "var(--muted)"
    }
  }, "volume only \xB7 sentiment in panel below")), /*#__PURE__*/React.createElement("div", {
    className: "card-body tight"
  }, (flow || []).length === 0 && /*#__PURE__*/React.createElement("div", {
    className: "dim",
    style: {
      padding: "12px 14px",
      fontFamily: "var(--mono)",
      fontSize: 11
    }
  }, "No ticker-flow data yet \u2014 burrow's ticker_mention_flow has no captures for the active watchlist."), (flow || []).map(t => {
    var series = Array.isArray(t.series) ? t.series : [];
    var max = Math.max(...series, 1);
    var action = t.action || "—";
    return /*#__PURE__*/React.createElement("div", {
      key: t.ticker,
      style: {
        display: "grid",
        gridTemplateColumns: "70px 1fr 100px 140px",
        alignItems: "center",
        gap: 14,
        padding: "10px 14px",
        borderBottom: "1px solid var(--line)",
        fontFamily: "var(--mono)",
        fontSize: 11.5
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontWeight: 600
      }
    }, t.ticker), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 1,
        height: 28,
        alignItems: "flex-end"
      }
    }, series.map((v, i) => /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        flex: 1,
        height: `${(v || 0) / max * 100}%`,
        background: "var(--info)",
        opacity: 0.4 + (v || 0) / max * 0.6,
        borderRadius: "1px 1px 0 0"
      }
    }))), /*#__PURE__*/React.createElement("span", {
      style: {
        color: "var(--muted)",
        fontSize: 10.5,
        textAlign: "right"
      }
    }, series[series.length - 1] ?? 0, " ", /*#__PURE__*/React.createElement("span", {
      style: {
        opacity: 0.6
      }
    }, "today")), /*#__PURE__*/React.createElement("span", {
      className: `pill ${typeof action === "string" && action.startsWith("HOLDING") ? "holding" : typeof action === "string" && action.startsWith("WATCHING") ? "watching" : typeof action === "string" && action.startsWith("STOPPED") ? "stopped" : "passed"}`
    }, action));
  }))), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-12",
    style: {
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "col-4 col-md-12"
  }, /*#__PURE__*/React.createElement("div", {
    className: "card"
  }, /*#__PURE__*/React.createElement(window.CardHead, {
    title: "10 subreddits \xB7 click to drill"
  }), /*#__PURE__*/React.createElement("div", {
    className: "card-body tight"
  }, subs.map(s => /*#__PURE__*/React.createElement("div", {
    key: s.name,
    onClick: () => setOpenSub(s.name),
    style: {
      padding: "10px 14px",
      borderBottom: "1px solid var(--line)",
      cursor: "pointer",
      background: openSub === s.name ? "var(--surface-2)" : "transparent",
      borderLeft: openSub === s.name ? "2px solid var(--accent)" : "2px solid transparent"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      fontFamily: "var(--mono)",
      fontSize: 12
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 600
    }
  }, "r/", s.name), s.sentiment == null ? /*#__PURE__*/React.createElement("span", {
    className: "dim",
    style: {
      fontSize: 11
    }
  }, "\u2014") : /*#__PURE__*/React.createElement("span", {
    className: s.sentiment >= 0 ? "up" : "down",
    style: {
      fontSize: 11
    }
  }, s.sentiment >= 0 ? "+" : "", Number(s.sentiment).toFixed(2))), /*#__PURE__*/React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 10,
      color: "var(--muted)",
      marginTop: 2
    }
  }, fmtSubs(s.subs || 0), " subs \xB7 ", s.posts24h ?? 0, " posts/24h \xB7 ", s.newPostsPerHour ?? 0, "/hr")))))), /*#__PURE__*/React.createElement("div", {
    className: "col-8 col-md-12"
  }, /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement(window.CardHead, {
    title: `r/${sub.name} · drill-down`
  }, /*#__PURE__*/React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 10,
      color: "var(--muted)"
    }
  }, fmtSubs(sub.subs), " subs")), /*#__PURE__*/React.createElement("div", {
    className: "card-body"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(4, 1fr)",
      gap: 0,
      marginBottom: 14,
      border: "1px solid var(--line)",
      borderRadius: 4
    }
  }, [["Posts/24h", sub.posts24h ?? 0], ["Sentiment", sub.sentiment == null ? "—" : (sub.sentiment >= 0 ? "+" : "") + Number(sub.sentiment).toFixed(2)], ["Bull / Bear", `${sub.bullCount ?? 0} / ${sub.bearCount ?? 0}`], ["Avg score", sub.avgScore ?? sub.avgUpvotes ?? "—"]].map((s, i) => /*#__PURE__*/React.createElement("div", {
    key: s[0],
    style: {
      padding: "10px 12px",
      borderRight: i < 3 ? "1px solid var(--line)" : "none"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "label",
    style: {
      fontFamily: "var(--mono)",
      fontSize: 10,
      textTransform: "uppercase",
      letterSpacing: "0.08em",
      color: "var(--muted)"
    }
  }, s[0]), /*#__PURE__*/React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 16,
      fontWeight: 600,
      marginTop: 2
    }
  }, s[1])))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "label",
    style: {
      fontFamily: "var(--mono)",
      fontSize: 10,
      textTransform: "uppercase",
      letterSpacing: "0.08em",
      color: "var(--muted)",
      marginBottom: 6
    }
  }, "30-day mention volume"), Array.isArray(sub.series30d) && sub.series30d.length > 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 1,
      height: 50,
      alignItems: "flex-end"
    }
  }, (() => {
    var max = Math.max(...sub.series30d, 1);
    return sub.series30d.map((v, i) => /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        flex: 1,
        height: `${(v || 0) / max * 100}%`,
        background: "var(--info)",
        opacity: 0.5 + (v || 0) / max * 0.5,
        borderRadius: "1px 1px 0 0"
      }
    }));
  })()) : /*#__PURE__*/React.createElement("div", {
    className: "dim",
    style: {
      fontFamily: "var(--mono)",
      fontSize: 11
    }
  }, "no series yet")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "label",
    style: {
      fontFamily: "var(--mono)",
      fontSize: 10,
      textTransform: "uppercase",
      letterSpacing: "0.08em",
      color: "var(--muted)",
      marginBottom: 8
    }
  }, "Top tickers in r/", sub.name), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      flexWrap: "wrap"
    }
  }, (Array.isArray(sub.topTickers) && sub.topTickers.length ? sub.topTickers : sub.top || []).map(t => /*#__PURE__*/React.createElement("span", {
    key: t,
    style: {
      background: "var(--surface-2)",
      border: "1px solid var(--line)",
      padding: "4px 8px",
      borderRadius: 3,
      fontFamily: "var(--mono)",
      fontSize: 11
    }
  }, t)))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "label",
    style: {
      fontFamily: "var(--mono)",
      fontSize: 10,
      textTransform: "uppercase",
      letterSpacing: "0.08em",
      color: "var(--muted)",
      marginBottom: 8
    }
  }, "Top voices"), /*#__PURE__*/React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 11.5,
      color: "var(--text-2)"
    }
  }, Array.isArray(sub.topAuthors) && sub.topAuthors.length ? sub.topAuthors.join(" · ") : /*#__PURE__*/React.createElement("span", {
    className: "dim"
  }, "\u2014"))))), /*#__PURE__*/React.createElement("div", {
    className: "card"
  }, /*#__PURE__*/React.createElement(window.CardHead, {
    title: `Top posts in r/${sub.name}`
  }), /*#__PURE__*/React.createElement("div", {
    className: "card-body tight"
  }, (sub.topPosts || []).length === 0 && /*#__PURE__*/React.createElement("div", {
    className: "dim",
    style: {
      padding: "12px 14px",
      fontFamily: "var(--mono)",
      fontSize: 11
    }
  }, "No top posts captured yet."), (sub.topPosts || []).map((p, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      padding: "10px 14px",
      borderBottom: i < sub.topPosts.length - 1 ? "1px solid var(--line)" : "none"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      fontWeight: 500
    }
  }, p.title), p.age ? /*#__PURE__*/React.createElement("span", {
    className: "mono dim",
    style: {
      fontSize: 10,
      whiteSpace: "nowrap"
    }
  }, p.age) : null), /*#__PURE__*/React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 10.5,
      color: "var(--muted)",
      marginTop: 4
    }
  }, p.flair ? /*#__PURE__*/React.createElement("span", {
    style: {
      background: "var(--surface-2)",
      border: "1px solid var(--line)",
      padding: "1px 5px",
      borderRadius: 3,
      marginRight: 6
    }
  }, p.flair) : null, "\u2191 ", Number(p.score || 0).toLocaleString(), " \xB7 ", Number(p.comments || 0).toLocaleString(), " comments"))))))), window.SubredditAlphaAttribution && /*#__PURE__*/React.createElement(window.SubredditAlphaAttribution, null), /*#__PURE__*/React.createElement("div", {
    className: "card"
  }, /*#__PURE__*/React.createElement(window.CardHead, {
    title: "Hot posts feed \xB7 all 10 subs"
  }), /*#__PURE__*/React.createElement("div", {
    className: "card-body tight"
  }, (posts || []).length === 0 && /*#__PURE__*/React.createElement("div", {
    className: "dim",
    style: {
      padding: "12px 14px",
      fontFamily: "var(--mono)",
      fontSize: 11
    }
  }, "No hot posts captured yet."), (posts || []).map((p, i) => {
    var action = p.action || "—";
    return /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        padding: "12px 14px",
        borderBottom: i < posts.length - 1 ? "1px solid var(--line)" : "none",
        display: "grid",
        gridTemplateColumns: "1fr auto",
        gap: 14,
        alignItems: "center"
      }
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        fontWeight: 500,
        marginBottom: 4
      }
    }, p.title), /*#__PURE__*/React.createElement("div", {
      className: "mono",
      style: {
        fontSize: 10.5,
        color: "var(--muted)"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        color: "var(--text-2)"
      }
    }, "r/", p.sub), p.flair ? /*#__PURE__*/React.createElement("span", {
      style: {
        background: "var(--surface-2)",
        border: "1px solid var(--line)",
        padding: "1px 5px",
        borderRadius: 3,
        margin: "0 8px"
      }
    }, p.flair) : /*#__PURE__*/React.createElement("span", {
      style: {
        marginRight: 4
      }
    }, " "), "\u2191 ", Number(p.score || 0).toLocaleString(), " \xB7 ", Number(p.comments || 0).toLocaleString(), " comments", p.age ? ` · ${p.age}` : null, p.sentiment != null && /*#__PURE__*/React.createElement("span", {
      className: p.sentiment >= 0 ? "up" : "down",
      style: {
        marginLeft: 8
      }
    }, "sent ", p.sentiment >= 0 ? "+" : "", Number(p.sentiment).toFixed(2)))), /*#__PURE__*/React.createElement("span", {
      className: `pill ${typeof action === "string" && action.startsWith("ACTED") ? "holding" : typeof action === "string" && action.startsWith("STOPPED") ? "stopped" : "passed"}`
    }, action));
  }))));
}

// ============== Sleeve Activation matrix (M3) ==============
function SleeveActivation({
  rows
}) {
  var [showDormant, setShowDormant] = React.useState(false);
  var list = Array.isArray(rows) ? rows : [];
  if (!list.length) return null;
  var visible = showDormant ? list : list.filter(r => !r.dormant);
  var activeCount = list.filter(r => !r.dormant).length;
  var dormantCount = list.length - activeCount;
  return /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement(window.CardHead, {
    title: "Sleeve activation matrix"
  }, /*#__PURE__*/React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 10,
      color: "var(--muted)"
    }
  }, activeCount, " active / ", dormantCount, " dormant \xB7 ", list.length, " registered")), /*#__PURE__*/React.createElement("div", {
    className: "card-body tight"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setShowDormant(v => !v),
    style: {
      background: "none",
      border: "1px solid var(--line)",
      borderRadius: 3,
      padding: "3px 8px",
      cursor: "pointer",
      color: "var(--text-2)",
      fontSize: 11
    }
  }, showDormant ? "Hide dormant" : `Show all (incl. ${dormantCount} dormant)`)), /*#__PURE__*/React.createElement("table", {
    className: "trades"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Id"), /*#__PURE__*/React.createElement("th", null, "Name"), /*#__PURE__*/React.createElement("th", null, "Status"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Cap %"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Open"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Closed"), /*#__PURE__*/React.createElement("th", null, "First trade"), /*#__PURE__*/React.createElement("th", null, "Last trade"))), /*#__PURE__*/React.createElement("tbody", null, visible.map(r => /*#__PURE__*/React.createElement("tr", {
    key: r.id,
    style: r.dormant ? {
      opacity: 0.5
    } : undefined
  }, /*#__PURE__*/React.createElement("td", {
    className: "ticker"
  }, r.id), /*#__PURE__*/React.createElement("td", {
    className: "dim",
    style: {
      maxWidth: 240
    }
  }, r.name), /*#__PURE__*/React.createElement("td", {
    className: "mono",
    style: {
      fontSize: 11
    }
  }, r.status), /*#__PURE__*/React.createElement("td", {
    className: "num"
  }, (Number(r.capital_pct) * 100).toFixed(0), "%"), /*#__PURE__*/React.createElement("td", {
    className: "num"
  }, r.n_open), /*#__PURE__*/React.createElement("td", {
    className: "num"
  }, r.n_closed), /*#__PURE__*/React.createElement("td", {
    className: "dim mono",
    style: {
      fontSize: 11
    }
  }, r.first_trade_date || "—"), /*#__PURE__*/React.createElement("td", {
    className: "dim mono",
    style: {
      fontSize: 11
    }
  }, r.last_trade_date || "—")))))));
}

// ============== Universe Coverage panel ==============
function UniverseCoverage({
  data
}) {
  var [signalOpen, setSignalOpen] = React.useState(false);
  var [gapOpen, setGapOpen] = React.useState(false);
  if (!data) return null;
  var {
    scan_ts,
    universe_size = 500,
    scanned = 0,
    with_calendar = 0,
    with_signal = 0,
    missing_calendar = 0,
    by_strategy = {},
    sample_signaled = [],
    sample_gaps = []
  } = data;
  var freshness = scan_ts ? (() => {
    var ms = Date.now() - new Date(scan_ts).getTime();
    var m = Math.round(ms / 60000);
    return m < 60 ? `${m}m ago` : `${Math.round(m / 60)}h ago`;
  })() : "no scan yet";
  var maxStrat = Math.max(1, ...Object.values(by_strategy).map(Number));
  return /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      marginTop: 12
    }
  }, /*#__PURE__*/React.createElement(window.CardHead, {
    title: "S&P 500 universe coverage"
  }, /*#__PURE__*/React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 10,
      color: "var(--muted)"
    }
  }, "last scan ", freshness)), /*#__PURE__*/React.createElement("div", {
    className: "card-body",
    style: {
      padding: "12px 16px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(4, 1fr)",
      gap: 12,
      marginBottom: 16
    }
  }, [{
    label: "scanned",
    value: `${scanned} / ${universe_size}`
  }, {
    label: "with calendar",
    value: with_calendar
  }, {
    label: "with signal",
    value: with_signal
  }, {
    label: "gaps (dark)",
    value: missing_calendar
  }].map(({
    label,
    value
  }) => /*#__PURE__*/React.createElement("div", {
    key: label,
    style: {
      textAlign: "center"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 20,
      fontWeight: 600
    }
  }, value), /*#__PURE__*/React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 10,
      color: "var(--muted)",
      textTransform: "uppercase",
      letterSpacing: "0.08em"
    }
  }, label)))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 10,
      color: "var(--muted)",
      textTransform: "uppercase",
      letterSpacing: "0.08em",
      marginBottom: 6
    }
  }, "signals by strategy"), Object.entries(by_strategy).map(([strat, count]) => /*#__PURE__*/React.createElement("div", {
    key: strat,
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      marginBottom: 4
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "mono",
    style: {
      width: 72,
      fontSize: 11
    }
  }, strat), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      background: "var(--surface-2)",
      borderRadius: 2,
      height: 8,
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: `${Number(count) / maxStrat * 100}%`,
      height: "100%",
      background: "var(--info)",
      borderRadius: 2
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "mono",
    style: {
      width: 28,
      fontSize: 11,
      textAlign: "right"
    }
  }, count)))), /*#__PURE__*/React.createElement("div", {
    style: {
      borderTop: "1px solid var(--line)",
      paddingTop: 10
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setSignalOpen(o => !o),
    style: {
      background: "none",
      border: "none",
      cursor: "pointer",
      color: "var(--text-2)",
      fontSize: 12,
      padding: 0,
      marginBottom: 4,
      display: "flex",
      alignItems: "center",
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("span", null, signalOpen ? "▾" : "▸"), /*#__PURE__*/React.createElement("span", null, "Top ", Math.min(sample_signaled.length, 20), " signaled tickers")), signalOpen && /*#__PURE__*/React.createElement("table", {
    className: "trades",
    style: {
      marginTop: 6
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Ticker"), /*#__PURE__*/React.createElement("th", null, "Strategies"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Mentions 7d"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Days to earnings"))), /*#__PURE__*/React.createElement("tbody", null, sample_signaled.map(r => /*#__PURE__*/React.createElement("tr", {
    key: r.ticker
  }, /*#__PURE__*/React.createElement("td", {
    className: "ticker"
  }, r.ticker), /*#__PURE__*/React.createElement("td", {
    className: "mono",
    style: {
      fontSize: 11
    }
  }, (r.strategies || []).join(", ")), /*#__PURE__*/React.createElement("td", {
    className: "num"
  }, r.mentions_7d ?? "—"), /*#__PURE__*/React.createElement("td", {
    className: "num"
  }, r.days_to_earnings ?? "—")))))), /*#__PURE__*/React.createElement("div", {
    style: {
      borderTop: "1px solid var(--line)",
      paddingTop: 10,
      marginTop: 6
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setGapOpen(o => !o),
    style: {
      background: "none",
      border: "none",
      cursor: "pointer",
      color: "var(--text-2)",
      fontSize: 12,
      padding: 0,
      marginBottom: 4,
      display: "flex",
      alignItems: "center",
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("span", null, gapOpen ? "▾" : "▸"), /*#__PURE__*/React.createElement("span", null, "Top ", Math.min(sample_gaps.length, 20), " invisible tickers (no calendar + no mentions)")), gapOpen && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      gap: 6,
      marginTop: 6
    }
  }, sample_gaps.map(t => /*#__PURE__*/React.createElement("span", {
    key: t,
    className: "mono",
    style: {
      background: "var(--surface-2)",
      padding: "2px 6px",
      borderRadius: 3,
      fontSize: 11
    }
  }, t))))));
}

// ============== Watchlist page ==============
function WatchlistPage() {
  var list = window.WATCHLIST_DETAIL;
  var passed = window.PASSED_SIGNALS;
  return /*#__PURE__*/React.createElement("main", {
    className: "shell"
  }, /*#__PURE__*/React.createElement(PageHeader, {
    title: "Watchlist",
    subtitle: "Signals the engine is tracking but hasn't acted on \xB7 conviction, trigger conditions, and signals it rejected"
  }), /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement(window.CardHead, {
    title: `Active signals · ${list.length} tracked`,
    feedbackId: "active-signals"
  }, /*#__PURE__*/React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 10,
      color: "var(--muted)"
    }
  }, "conviction floor 0.65 to enter")), /*#__PURE__*/React.createElement("div", {
    className: "card-body tight"
  }, list.map(w => {
    var max = Math.max(...w.series);
    var sentMax = Math.max(...w.sentSeries.map(Math.abs));
    return /*#__PURE__*/React.createElement("div", {
      key: w.ticker,
      style: {
        padding: 14,
        borderBottom: "1px solid var(--line)"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "grid",
        gridTemplateColumns: "120px 1fr 1fr auto",
        gap: 16,
        alignItems: "center"
      }
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      className: "ticker mono",
      style: {
        fontSize: 16,
        fontWeight: 600
      }
    }, w.ticker), /*#__PURE__*/React.createElement("div", {
      className: "mono",
      style: {
        fontSize: 10,
        color: "var(--muted)",
        marginTop: 2
      }
    }, "added ", w.addedDays, "d ago"), /*#__PURE__*/React.createElement("span", {
      className: `pill ${w.status === "WATCHING" ? "watching" : "passed"}`,
      style: {
        marginTop: 6,
        display: "inline-flex"
      }
    }, w.status)), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      className: "label",
      style: {
        fontFamily: "var(--mono)",
        fontSize: 10,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        color: "var(--muted)",
        marginBottom: 4
      }
    }, "Mention volume \xB7 30d"), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 1,
        height: 32,
        alignItems: "flex-end"
      }
    }, w.series.map((v, i) => /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        flex: 1,
        height: `${v / max * 100}%`,
        background: "var(--info)",
        opacity: 0.4 + v / max * 0.6,
        borderRadius: "1px 1px 0 0"
      }
    }))), /*#__PURE__*/React.createElement("div", {
      className: "mono",
      style: {
        fontSize: 10,
        color: "var(--muted)",
        marginTop: 4
      }
    }, w.mentions24h, " mentions/24h")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      className: "label",
      style: {
        fontFamily: "var(--mono)",
        fontSize: 10,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        color: "var(--muted)",
        marginBottom: 4
      }
    }, "Sentiment \xB7 14d"), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 1,
        height: 32,
        alignItems: "center",
        position: "relative"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        position: "absolute",
        left: 0,
        right: 0,
        top: "50%",
        height: 1,
        background: "var(--line-2)"
      }
    }), w.sentSeries.map((v, i) => {
      var h = Math.abs(v) / sentMax * 14;
      return /*#__PURE__*/React.createElement("div", {
        key: i,
        style: {
          flex: 1,
          height: h,
          background: v >= 0 ? "var(--pos)" : "var(--neg)",
          marginTop: v >= 0 ? `${16 - h}px` : "16px",
          borderRadius: 1
        }
      });
    })), /*#__PURE__*/React.createElement("div", {
      className: "mono",
      style: {
        fontSize: 10,
        color: "var(--muted)",
        marginTop: 4
      }
    }, "current ", /*#__PURE__*/React.createElement("span", {
      className: w.sentiment >= 0 ? "up" : "down"
    }, w.sentiment >= 0 ? "+" : "", w.sentiment.toFixed(2)))), /*#__PURE__*/React.createElement("div", {
      style: {
        textAlign: "right"
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "mono",
      style: {
        fontSize: 22,
        fontWeight: 600
      }
    }, (w.conviction * 100).toFixed(0), "%"), /*#__PURE__*/React.createElement("div", {
      className: "mono",
      style: {
        fontSize: 10,
        color: "var(--muted)"
      }
    }, "conviction"), /*#__PURE__*/React.createElement("div", {
      style: {
        width: 80,
        height: 4,
        background: "var(--surface-2)",
        borderRadius: 2,
        marginTop: 6,
        marginLeft: "auto",
        overflow: "hidden"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: `${w.conviction * 100}%`,
        height: "100%",
        background: w.conviction >= 0.65 ? "var(--pos)" : "var(--warn)"
      }
    })))), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 10,
        paddingTop: 10,
        borderTop: "1px solid var(--line)",
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 16,
        fontSize: 12
      }
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
      className: "dim mono",
      style: {
        fontSize: 10,
        textTransform: "uppercase",
        letterSpacing: "0.08em"
      }
    }, "Why watching"), /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("span", {
      style: {
        color: "var(--text-2)"
      }
    }, w.reason)), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
      className: "dim mono",
      style: {
        fontSize: 10,
        textTransform: "uppercase",
        letterSpacing: "0.08em"
      }
    }, "Trigger to enter"), /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("span", {
      style: {
        color: "var(--text-2)"
      }
    }, w.triggerLevel))));
  }))), /*#__PURE__*/React.createElement("div", {
    className: "card"
  }, /*#__PURE__*/React.createElement(window.CardHead, {
    title: "Signals the engine rejected \xB7 with retroactive outcome"
  }, /*#__PURE__*/React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 10,
      color: "var(--muted)"
    }
  }, "nothing curated")), /*#__PURE__*/React.createElement("div", {
    className: "card-body tight"
  }, /*#__PURE__*/React.createElement("table", {
    className: "trades"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Ticker"), /*#__PURE__*/React.createElement("th", null, "Date"), /*#__PURE__*/React.createElement("th", null, "Why rejected"), /*#__PURE__*/React.createElement("th", null, "Outcome"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "P&L impact"))), /*#__PURE__*/React.createElement("tbody", null, passed.map(p => /*#__PURE__*/React.createElement("tr", {
    key: p.ticker + p.date
  }, /*#__PURE__*/React.createElement("td", {
    className: "ticker"
  }, p.ticker), /*#__PURE__*/React.createElement("td", {
    className: "dim"
  }, p.date), /*#__PURE__*/React.createElement("td", {
    className: "dim",
    style: {
      maxWidth: 320
    }
  }, p.reason), /*#__PURE__*/React.createElement("td", {
    className: p.outcome.startsWith("+") ? "up" : "down"
  }, p.outcome), /*#__PURE__*/React.createElement("td", {
    className: `num ${p.outcomePnl.startsWith("missed") ? "down" : "up"}`,
    style: {
      fontSize: 11
    }
  }, p.outcomePnl))))))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      fontSize: 16,
      fontWeight: 600,
      margin: 0
    }
  }, "Theses \xB7 lifecycle"), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "4px 0 0",
      color: "var(--muted)",
      fontSize: 12
    }
  }, "DETECTED \u2192 CORROBORATED \u2192 ENTERED \u2192 EXITED \xB7 countdown to event \xB7 contributing strategies")), /*#__PURE__*/React.createElement(ThesisCardList, {
    theses: window.THESES,
    limit: 20
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      fontSize: 16,
      fontWeight: 600,
      margin: 0
    }
  }, "Signal agreement"), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "4px 0 0",
      color: "var(--muted)",
      fontSize: 12
    }
  }, "For each thesis: what 4 independent sources said \u2014 momentum, agent, ticker_intent, options flow")), window.SignalAgreementPanel ? /*#__PURE__*/React.createElement(window.SignalAgreementPanel, {
    limit: 12
  }) : null), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      fontSize: 16,
      fontWeight: 600,
      margin: 0
    }
  }, "Upcoming event cards"), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "4px 0 0",
      color: "var(--muted)",
      fontSize: 12
    }
  }, "Per-event breakdown: subreddit sentiment, positions, and P&L by catalyst date")), /*#__PURE__*/React.createElement(EventCardList, null)), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      fontSize: 16,
      fontWeight: 600,
      margin: 0
    }
  }, "Catalyst window"), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "4px 0 0",
      color: "var(--muted)",
      fontSize: 12
    }
  }, "Confirmed and unconfirmed catalysts from earnings + event calendars \xB7 grouped by date")), /*#__PURE__*/React.createElement(CatalystWindowPanel, null)), /*#__PURE__*/React.createElement(UniverseCoverage, {
    data: window.UNIVERSE_COVERAGE
  }));
}

// ============== Methodology page ==============
function MethodologyPage() {
  var rules = window.METHOD_RULES;
  var breaks = window.RULE_BREAKS;
  var faq = window.METHOD_FAQ;
  return /*#__PURE__*/React.createElement("main", {
    className: "shell"
  }, /*#__PURE__*/React.createElement(PageHeader, {
    title: "Methodology",
    subtitle: "The full pipeline \u2014 how Reddit posts become trade signals, and the rules that turn signals into positions"
  }), /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement(window.CardHead, {
    title: "Pipeline"
  }), /*#__PURE__*/React.createElement("div", {
    className: "card-body"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(4, 1fr)",
      gap: 0,
      border: "1px solid var(--line)",
      borderRadius: 4
    }
  }, [{
    step: "01",
    title: "Ingest",
    body: "Pull posts + top-level comments from 10 subs every 15 min. ~28k items/day. Body, score, comment count, ticker mentions extracted with $-prefix + dictionary."
  }, {
    step: "02",
    title: "Score",
    body: "Each post → LLM call returning {sentiment ∈ [-1,1], topic tag, conviction ∈ [0,1], tickers}. Cached + rate-limited. ~$1.20/day in API costs."
  }, {
    step: "03",
    title: "Aggregate",
    body: "Per-ticker and per-sub rollups weighted by post score and recency. Each strategy applies its own feed weights to produce a signal score."
  }, {
    step: "04",
    title: "Execute",
    body: "When a strategy's signal crosses its conviction gate, the engine sizes, places stops, and submits orders via broker API. Zero human review. The audit log streams to this page."
  }].map((s, i) => /*#__PURE__*/React.createElement("div", {
    key: s.step,
    style: {
      padding: 16,
      borderRight: i < 3 ? "1px solid var(--line)" : "none"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 11,
      color: "var(--accent)",
      letterSpacing: "0.1em"
    }
  }, s.step), /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 600,
      fontSize: 15,
      margin: "4px 0 6px"
    }
  }, s.title), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      color: "var(--text-2)",
      fontSize: 12.5,
      lineHeight: 1.55
    }
  }, s.body)))))), /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement(window.CardHead, {
    title: "Trading rules \xB7 8 commitments"
  }), /*#__PURE__*/React.createElement("div", {
    className: "card-body"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(2, 1fr)",
      gap: 14
    }
  }, rules.map(r => /*#__PURE__*/React.createElement("div", {
    key: r.num,
    style: {
      padding: 14,
      background: "var(--surface-2)",
      border: "1px solid var(--line)",
      borderRadius: 4
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "baseline",
      gap: 10,
      marginBottom: 4
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 11,
      color: "var(--accent)",
      letterSpacing: "0.1em"
    }
  }, r.num), /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 600,
      fontSize: 13
    }
  }, r.title)), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      color: "var(--text-2)",
      fontSize: 12.5,
      lineHeight: 1.55
    }
  }, r.body)))))), /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement(window.CardHead, {
    title: "Decision narrative \xB7 the agent did X because Y"
  }, /*#__PURE__*/React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 10,
      color: "var(--muted)"
    }
  }, "last 25 ticks \xB7 prose-mode read from agent_reports.jsonl")), /*#__PURE__*/React.createElement("div", {
    className: "card-body tight"
  }, window.DecisionNarrativeStream ? /*#__PURE__*/React.createElement(window.DecisionNarrativeStream, null) : null)), /*#__PURE__*/React.createElement(SleeveActivation, {
    rows: window.SLEEVE_ACTIVATION
  }), /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement(window.CardHead, {
    title: "Recent rule firings \xB7 live audit log"
  }, /*#__PURE__*/React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 10,
      color: "var(--muted)"
    }
  }, "3 events YTD \xB7 each rule worked as designed")), /*#__PURE__*/React.createElement("div", {
    className: "card-body tight"
  }, /*#__PURE__*/React.createElement("table", {
    className: "trades"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Trade"), /*#__PURE__*/React.createElement("th", null, "Ticker"), /*#__PURE__*/React.createElement("th", null, "Rule broken"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Outcome"), /*#__PURE__*/React.createElement("th", null, "Lesson"))), /*#__PURE__*/React.createElement("tbody", null, (breaks || []).length === 0 && /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    colSpan: 5,
    className: "dim",
    style: {
      padding: 14,
      textAlign: "center"
    }
  }, "No rule firings logged yet.")), (breaks || []).map((b, i) => /*#__PURE__*/React.createElement("tr", {
    key: `${b.ts || i}-${b.ticker || ""}-${b.rule || ""}-${i}`
  }, /*#__PURE__*/React.createElement("td", {
    className: "dim"
  }, b.trade), /*#__PURE__*/React.createElement("td", {
    className: "ticker"
  }, b.ticker), /*#__PURE__*/React.createElement("td", {
    className: "dim"
  }, b.rule), /*#__PURE__*/React.createElement("td", {
    className: "num down"
  }, b.outcome), /*#__PURE__*/React.createElement("td", {
    className: "dim",
    style: {
      maxWidth: 360
    }
  }, b.lesson))))))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      fontSize: 16,
      fontWeight: 600,
      margin: 0
    }
  }, "Signal dedup \xB7 time-windowed gate"), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "4px 0 0",
      color: "var(--muted)",
      fontSize: 12
    }
  }, "Recent (strategy, ticker, direction) fires suppressed within the 60-minute window, plus the live windows still in effect")), /*#__PURE__*/React.createElement(SignalDedupPanel, null)), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      fontSize: 16,
      fontWeight: 600,
      margin: 0
    }
  }, "News signal health \xB7 headline scanner pulse"), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "4px 0 0",
      color: "var(--muted)",
      fontSize: 12
    }
  }, "24h scan totals plus recently flagged headlines (block_entry / exit_now) per ticker \u2014 distinguishes \"no flags\" from \"scanner stalled\"")), /*#__PURE__*/React.createElement(NewsSignalHealthPanel, null)), /*#__PURE__*/React.createElement("div", {
    className: "card"
  }, /*#__PURE__*/React.createElement(window.CardHead, {
    title: "FAQ"
  }), /*#__PURE__*/React.createElement("div", {
    className: "card-body tight"
  }, faq.map((f, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      padding: "14px 16px",
      borderBottom: i < faq.length - 1 ? "1px solid var(--line)" : "none"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 600,
      fontSize: 13.5,
      marginBottom: 6
    }
  }, f.q), /*#__PURE__*/React.createElement("div", {
    style: {
      color: "var(--text-2)",
      fontSize: 13,
      lineHeight: 1.6
    }
  }, f.a))))));
}

// ============== Page header ==============
function PageHeader({
  title,
  subtitle
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "20px 0 18px",
      borderBottom: "1px solid var(--line)",
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: 0,
      fontFamily: "var(--sans)",
      fontSize: 28,
      fontWeight: 600,
      letterSpacing: "-0.02em"
    }
  }, title), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "6px 0 0",
      color: "var(--muted)",
      fontSize: 13.5,
      fontFamily: "var(--mono)"
    }
  }, subtitle));
}

// ============== Reports page ==============
function ReportsPage() {
  var reports = window.WEEKLY_REPORTS || [];
  var [selected, setSelected] = useState(reports.length > 0 ? reports[0].week : null);
  if (reports.length === 0) {
    return /*#__PURE__*/React.createElement("main", {
      className: "shell"
    }, /*#__PURE__*/React.createElement(PageHeader, {
      title: "Weekly Reports",
      subtitle: "Saturday 9 AM \xB7 Claude reviews its own trades"
    }), /*#__PURE__*/React.createElement("div", {
      className: "card",
      style: {
        padding: 24,
        color: "var(--muted)",
        fontFamily: "var(--mono)",
        fontSize: 13
      }
    }, "No reports yet. The weekly report cron runs every Saturday at 9 AM PT."));
  }
  var current = reports.find(r => r.week === selected) || reports[0];
  var gradeColor = g => {
    if (!g || g === "?") return "var(--muted)";
    if (g.startsWith("A")) return "var(--pos)";
    if (g.startsWith("B")) return "oklch(0.78 0.14 235)";
    if (g.startsWith("C")) return "var(--warn, oklch(0.82 0.16 75))";
    return "var(--neg)";
  };
  var renderMarkdown = md => {
    if (typeof window.marked !== "undefined") {
      return {
        __html: window.marked.parse(md)
      };
    }
    return {
      __html: `<pre style="white-space:pre-wrap;font-size:13px">${md.replace(/</g, "&lt;")}</pre>`
    };
  };
  return /*#__PURE__*/React.createElement("main", {
    className: "shell"
  }, /*#__PURE__*/React.createElement(PageHeader, {
    title: "Weekly Reports",
    subtitle: "Saturday 9 AM \xB7 Claude reviews its own trades"
  }), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-12",
    style: {
      marginTop: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "col-3 col-md-12"
  }, /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      padding: "8px 0"
    }
  }, reports.map(r => /*#__PURE__*/React.createElement("div", {
    key: r.week,
    onClick: () => setSelected(r.week),
    style: {
      padding: "10px 16px",
      cursor: "pointer",
      background: selected === r.week ? "var(--surface-2)" : "transparent",
      borderLeft: selected === r.week ? "2px solid var(--accent)" : "2px solid transparent"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--mono)",
      fontSize: 12,
      fontWeight: 600
    }
  }, r.week), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--mono)",
      fontSize: 12,
      fontWeight: 700,
      color: gradeColor(r.grade)
    }
  }, r.grade)), r.summary && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: "var(--muted)",
      marginTop: 3,
      lineHeight: 1.4,
      overflow: "hidden",
      display: "-webkit-box",
      WebkitLineClamp: 2,
      WebkitBoxOrient: "vertical"
    }
  }, r.summary))))), /*#__PURE__*/React.createElement("div", {
    className: "col-9 col-md-12"
  }, current && /*#__PURE__*/React.createElement("div", {
    className: "card reports-content",
    style: {
      padding: 24,
      lineHeight: 1.65,
      fontSize: 14
    },
    dangerouslySetInnerHTML: renderMarkdown(current.content)
  }))));
}
Object.assign(window, {
  TradesPage,
  RedditPage,
  WatchlistPage,
  MethodologyPage,
  ReportsPage,
  PageHeader,
  HBarChart,
  VBarChart
});

/* ---- panels/options-trade-log.jsx ---- */
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* global React */
// Options trade log — every credit spread the sleeve opened or closed, with the
// full contract detail frozen at that moment. The point is reviewability: what
// the greeks and prices actually were when we committed, not what they are now,
// and whether the order actually filled — never implying money we don't have.
//
// Two tables, never one: Open Orders (submitted, not yet fully filled — a
// QUEUED order is not a trade) and Trade Log (Alpaca reports filled_qty === qty).
// A row belongs in the Trade Log if and only if the broker says it filled
// completely; everything else, including expired/cancelled/rejected history,
// stays in Open Orders or is dropped, but never counted as a trade.

// OCC parsing + spread classification + money formatting are shared with
// CurrentPositions/TradesTable via window.SpreadFormat (dashboard/lib/spread-format.js)
// — one parser/classifier, not three.
var {
  g4,
  money,
  pctv,
  num,
  parseOccSymbol,
  plainEnglishLeg,
  spreadStructure,
  breakeven,
  dteFromExpiry
} = window.SpreadFormat;
var Help = window.Help;

// One feedback button per hand-rolled card head below (Expiry ladder / Trade
// Log / Open Orders never go through options-summary.jsx's <Section>, so
// each wires window.FeedbackButton itself). The id is derived by the same
// componentId() kebab-casing options-summary.jsx's <Section> uses — reused
// via window.OptionsSummaryInternals rather than re-implemented here — so
// "Trade Log" always yields "trade-log" no matter which panel renders it.
function CardFeedbackButton({
  label
}) {
  if (!window.FeedbackButton) return null;
  var internals = window.OptionsSummaryInternals;
  var id = internals ? internals.componentId(label) : label;
  return /*#__PURE__*/React.createElement(window.FeedbackButton, {
    target: {
      kind: "component",
      id,
      label
    }
  });
}

// Every card on this panel is written by the Trader (trader-tick /
// spread_trader, plus the frozen rules) — the shared byline reused from
// options-summary.jsx via window.OptionsSummaryInternals rather than a
// second implementation.
function TraderByline() {
  var internals = window.OptionsSummaryInternals;
  var RB = internals && internals.RoleByline;
  var role = internals && internals.ROLE && internals.ROLE.TRADER;
  return RB ? /*#__PURE__*/React.createElement(RB, {
    role: role
  }) : null;
}

// Prefer the broker's own leg intent (authoritative); fall back to
// short=sold / long=bought inference keyed on open vs close event.
function legDirection(record, symbol, isClose) {
  var legs = record && record.response && record.response.legs;
  if (Array.isArray(legs)) {
    var leg = legs.find(l => l && l.symbol === symbol);
    if (leg && leg.position_intent) {
      return String(leg.position_intent).replace(/_/g, " ").toUpperCase();
    }
    if (leg && leg.side) {
      return `${leg.side.toUpperCase()} TO ${isClose ? "CLOSE" : "OPEN"}`;
    }
  }
  if (symbol && symbol === record.short) return isClose ? "BUY TO CLOSE" : "SELL TO OPEN";
  if (symbol && symbol === record.long) return isClose ? "SELL TO CLOSE" : "BUY TO OPEN";
  return null;
}

// UNFILLED / PARTIAL n/N / FILLED, from the broker response — never inferred
// from status strings alone, since "accepted"/"submitted" say nothing about fills.
function fillState(record) {
  var resp = record.response || {};
  var total = num(resp.qty) ?? num(record.contracts);
  var filled = num(resp.filled_qty) ?? 0;
  if (total == null || total <= 0 || Number.isNaN(total) || Number.isNaN(filled)) return null;
  if (filled <= 0) return {
    state: "UNFILLED",
    filled,
    total
  };
  if (filled >= total) return {
    state: "FILLED",
    filled,
    total
  };
  return {
    state: "PARTIAL",
    filled,
    total
  };
}

// `record.credit` is the same signed figure options_summary.py computes
// (`credit = -net_per_contract * qty * 100`) — trust it directly rather than
// re-deriving from the broker's raw filled_avg_price, which is debit-positive
// and would need the same negation repeated (and, until this fix, wasn't).
function creditReceived(record) {
  var fs = fillState(record);
  if (!fs || fs.filled <= 0) return 0;
  var credit = num(record.credit);
  if (credit != null) return credit;
  return null; // filled but no credit reported yet — unknown, not zero
}

// --- Open Orders vs Trade Log classification ----------------------------
// A row is a trade if and only if Alpaca reports it filled completely —
// never inferred from our own submit-time `status` string.
var TERMINAL_LABELS = {
  canceled: "CANCELLED",
  expired: "EXPIRED",
  rejected: "REJECTED",
  unknown_to_broker: "UNKNOWN"
};
function isFullyFilled(record) {
  var resp = record.response || {};
  var qty = num(resp.qty) ?? num(record.contracts);
  var filled_qty = num(resp.filled_qty) ?? 0;
  return qty != null && qty > 0 && filled_qty === qty;
}

// Buckets every submitted order into "trade" (Trade Log) or "open" (Open
// Orders), with a reader-safe label — never a bare broker status string like
// "accepted", which reads as done to a non-trader.
// `kind` doubles as the CSS-badge selector and the "still at risk of not
// filling" test (`kind === "terminal"` — expired/cancelled/rejected/unknown
// orders are resolved, not pending).
function classifyOrder(record) {
  if (isFullyFilled(record)) {
    return {
      bucket: "trade",
      label: "FILLED",
      kind: "filled"
    };
  }
  var resp = record.response || {};
  var brokerStatus = resp.status;
  var fs = fillState(record);
  if (brokerStatus && TERMINAL_LABELS[brokerStatus]) {
    var label = fs && fs.filled > 0 ? `${TERMINAL_LABELS[brokerStatus]} ${fs.filled}/${fs.total}` : TERMINAL_LABELS[brokerStatus];
    return {
      bucket: "open",
      label,
      kind: "terminal"
    };
  }
  if (fs && fs.state === "PARTIAL") {
    return {
      bucket: "open",
      label: `PARTIAL ${fs.filled}/${fs.total}`,
      kind: "partial"
    };
  }
  return {
    bucket: "open",
    label: "QUEUED",
    kind: "unfilled"
  };
}

// Both legs side by side, each with its own greeks. Rendered for entry and,
// once the spread is flattened, again for exit. `contracts` (the position's
// own contract count) drives the per-leg "net greek × 100 × contracts ="
// scaling shown by each greek cell's <Help/> — undefined degrades to a
// formula-only tooltip rather than a wrong number.
function LegDetail({
  title,
  legs,
  predatesSnapshots,
  contracts
}) {
  if (legs === undefined || legs === null) {
    return /*#__PURE__*/React.createElement("div", {
      className: "opt-legs-empty"
    }, predatesSnapshots ? "this record predates leg snapshots" : "no snapshot captured");
  }
  if (legs.error) {
    return /*#__PURE__*/React.createElement("div", {
      className: "opt-legs-empty"
    }, "snapshot capture failed: ", legs.error);
  }
  var rows = Array.isArray(legs) ? legs : Object.values(legs).filter(l => l && l.symbol);
  if (!rows.length) return /*#__PURE__*/React.createElement("div", {
    className: "opt-legs-empty"
  }, "no snapshot captured");
  return /*#__PURE__*/React.createElement("div", {
    className: "opt-legblock"
  }, /*#__PURE__*/React.createElement("div", {
    className: "opt-legblock-title"
  }, title), /*#__PURE__*/React.createElement("table", {
    className: "opt-table opt-table--legs"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", {
    className: "al"
  }, "Contract"), /*#__PURE__*/React.createElement("th", null, "Bid"), /*#__PURE__*/React.createElement("th", null, "Ask"), /*#__PURE__*/React.createElement("th", null, "Mid"), /*#__PURE__*/React.createElement("th", null, "Last"), /*#__PURE__*/React.createElement("th", null, "IV", /*#__PURE__*/React.createElement(Help, {
    term: "iv"
  })), /*#__PURE__*/React.createElement("th", null, "\u0394", /*#__PURE__*/React.createElement(Help, {
    term: "delta"
  })), /*#__PURE__*/React.createElement("th", null, "\u0393", /*#__PURE__*/React.createElement(Help, {
    term: "gamma"
  })), /*#__PURE__*/React.createElement("th", null, "\u0398", /*#__PURE__*/React.createElement(Help, {
    term: "theta"
  })), /*#__PURE__*/React.createElement("th", null, "V", /*#__PURE__*/React.createElement(Help, {
    term: "vega"
  })), /*#__PURE__*/React.createElement("th", null, "\u03C1", /*#__PURE__*/React.createElement(Help, {
    term: "rho"
  })), /*#__PURE__*/React.createElement("th", null, "Vol"), /*#__PURE__*/React.createElement("th", null, "OI"), /*#__PURE__*/React.createElement("th", null, "Quote time"))), /*#__PURE__*/React.createElement("tbody", null, rows.map(l => {
    var k = l.greeks || {};
    var asOf = {
      quotes: l.quote_ts
    };
    var greekProps = net_greek => ({
      inputs: {
        net_greek,
        contracts
      },
      asOf
    });
    return /*#__PURE__*/React.createElement("tr", {
      key: l.symbol
    }, /*#__PURE__*/React.createElement("td", {
      className: "al mono-dim"
    }, l.symbol), /*#__PURE__*/React.createElement("td", null, money(l.bid)), /*#__PURE__*/React.createElement("td", null, money(l.ask)), /*#__PURE__*/React.createElement("td", null, money(l.mid)), /*#__PURE__*/React.createElement("td", null, money(l.last)), /*#__PURE__*/React.createElement("td", null, pctv(l.iv)), /*#__PURE__*/React.createElement("td", null, g4(k.delta), /*#__PURE__*/React.createElement(Help, _extends({
      term: "delta"
    }, greekProps(k.delta)))), /*#__PURE__*/React.createElement("td", null, g4(k.gamma), /*#__PURE__*/React.createElement(Help, _extends({
      term: "gamma"
    }, greekProps(k.gamma)))), /*#__PURE__*/React.createElement("td", {
      className: "neg-tint"
    }, g4(k.theta), /*#__PURE__*/React.createElement(Help, _extends({
      term: "theta"
    }, greekProps(k.theta)))), /*#__PURE__*/React.createElement("td", null, g4(k.vega), /*#__PURE__*/React.createElement(Help, _extends({
      term: "vega"
    }, greekProps(k.vega)))), /*#__PURE__*/React.createElement("td", null, g4(k.rho), /*#__PURE__*/React.createElement(Help, _extends({
      term: "rho"
    }, greekProps(k.rho)))), /*#__PURE__*/React.createElement("td", {
      className: "mono-dim"
    }, (l.volume || 0).toLocaleString()), /*#__PURE__*/React.createElement("td", {
      className: "mono-dim"
    }, (l.open_interest || 0).toLocaleString()), /*#__PURE__*/React.createElement("td", {
      className: "mono-dim"
    }, l.quote_ts ? String(l.quote_ts).replace("T", " ") : "—"));
  }))));
}

// One key scheme for both rows and the detail page: prefer the broker's own
// order id, but only when it's unique across the whole log — a duplicated or
// missing client_order_id falls back to the event's own index so every row
// still gets a stable, collision-free key.
function tradeKey(ev, i) {
  var events = window.SPREAD_LOG && window.SPREAD_LOG.events || [];
  var id = ev && ev.client_order_id;
  if (id != null) {
    var count = events.filter(e => e && e.client_order_id === id).length;
    if (count === 1) return String(id);
  }
  return "i" + i;
}

// Inverse of tradeKey: walk `log.events` looking for the event whose key
// matches. Returns null (never throws) when the log is missing/empty or the
// key matches nothing — a stale bookmark against a regenerated log.
function resolveTrade(key, log) {
  var events = log && log.events || [];
  for (var i = 0; i < events.length; i++) {
    var ev = events[i];
    if (tradeKey(ev, i) === key) {
      return {
        ev,
        index: i,
        classification: classifyOrder(ev)
      };
    }
  }
  return null;
}

// Derive every value a row (either table) needs to render, once per event.
// `classification` is computed once per event by the caller (see
// OptionsTradeLog's bucketing pass) and threaded through here rather than
// re-run per row.
function tradeFacts(ev, classification) {
  var isClose = ev.event === "close";
  var shortParsed = parseOccSymbol(ev.short);
  var longParsed = parseOccSymbol(ev.long);
  var structure = spreadStructure(shortParsed, longParsed, ev.ticker);
  var fs = fillState(ev);
  var received = creditReceived(ev);
  // Close events keep the entry credit under `entry_credit`, not `credit` —
  // same value, different field name, so this must match every other reader
  // of "what did we collect" (headlineSentence, OpenOrdersTable's atRiskCredit).
  var maxGain = ev.credit ?? ev.entry_credit;
  // Close events never carry `risk` — that field is written once, on the
  // `open` record, and a close row has no matching field at all (see
  // `entry_credit`/`exit_cost`/`realized_pnl` on the close event in
  // spread_trades.jsonl). Falling back to `ev.risk` alone rendered "Max
  // loss" as a blank dash on every closed trade's detail page — a visitor
  // who filed feedback while a spread was open, then came back after it
  // closed, saw the number they asked about vanish rather than persist.
  // Re-derive it the same way `_fill_reconciled_event` does for the open
  // record (width * 100 * contracts - credit), using the strikes parsed
  // straight off the leg symbols since `width` isn't logged on close events
  // either.
  var width = ev.width ?? (shortParsed && longParsed && shortParsed.strike != null && longParsed.strike != null ? Math.abs(shortParsed.strike - longParsed.strike) : null);
  var maxLoss = ev.risk ?? (width != null && ev.contracts != null && maxGain != null ? width * 100 * ev.contracts - maxGain : null);
  // A "credit" spread that filled at a net DEBIT (BABA 143/144, 2026-08-07) has
  // no max gain — the best case at expiry is $0, not the negative "credit"
  // number. Every reader of `maxGain` must brand it as a debit paid, not print
  // the negative figure as though it were an upside.
  var isNetDebit = maxGain != null && maxGain < 0;
  var be = breakeven(shortParsed, maxGain, ev.contracts);
  var riskReward = maxLoss != null && maxGain ? maxLoss / maxGain : null;
  var pnl = isClose ? ev.realized_pnl : null;
  return {
    isClose,
    shortParsed,
    longParsed,
    structure,
    fs,
    received,
    maxGain,
    isNetDebit,
    maxLoss,
    width,
    be,
    riskReward,
    pnl,
    classification
  };
}

// Legacy detail view: structure blurb, decoded legs, key/value detail grid,
// and both entry/exit greek snapshots. No row expands inline any more — every
// row opens dashboard/pages/option-trade-detail.jsx as a full page instead
// (see openDetail() below). Kept exported for back-compat rather than deleted
// outright — out of scope for this PRD to remove.
function TradeDetail({
  ev,
  facts
}) {
  var {
    isClose,
    structure,
    fs,
    received,
    maxGain,
    isNetDebit,
    maxLoss,
    be,
    riskReward,
    pnl,
    classification
  } = facts;
  return /*#__PURE__*/React.createElement("div", {
    className: "opt-trade-body"
  }, structure && structure.gloss && /*#__PURE__*/React.createElement("p", {
    className: "opt-structure-gloss"
  }, structure.name, " \u2014 ", structure.gloss), /*#__PURE__*/React.createElement("div", {
    className: "opt-legblock"
  }, /*#__PURE__*/React.createElement("div", {
    className: "opt-legblock-title"
  }, "Legs"), /*#__PURE__*/React.createElement("ul", {
    className: "opt-leg-lines"
  }, /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("span", {
    className: "opt-leg-dir"
  }, legDirection(ev, ev.short, isClose) || "—"), " ", /*#__PURE__*/React.createElement("span", {
    className: "mono-dim"
  }, ev.short), " \u2014 ", plainEnglishLeg(ev.short)), /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("span", {
    className: "opt-leg-dir"
  }, legDirection(ev, ev.long, isClose) || "—"), " ", /*#__PURE__*/React.createElement("span", {
    className: "mono-dim"
  }, ev.long), " \u2014 ", plainEnglishLeg(ev.long)))), /*#__PURE__*/React.createElement("div", {
    className: "opt-kv"
  }, [[isNetDebit ? "Net debit paid" : "Max gain (credit)", money(isNetDebit ? Math.abs(maxGain) : maxGain)], ["Max loss (risk)", money(maxLoss)], ["Breakeven", be != null ? money(be) : isNetDebit ? "no breakeven — net debit" : null], ["Risk:reward", riskReward != null ? `${riskReward.toFixed(1)} : 1 against` : null], ["Credit if filled", money(ev.credit ?? ev.entry_credit)], ["Credit received", classification.bucket === "trade" ? money(received) : null], ["Realized P&L", isClose ? money(pnl) : null], ["Fill state", classification.label], ["EV at entry", money(ev.ev)], ["Win prob (POP)", pctv(ev.pop)], ["DTE", ev.dte], ["Expiry", ev.expiry || (facts.shortParsed ? facts.shortParsed.expiry : null)], ["Spot at entry", money(ev.spot_at_entry)], ["IV at entry", pctv(ev.iv_at_entry)], ["Width", money(ev.width)], ["Contracts", ev.contracts], ["Credit per contract", money(ev.credit_per_contract)], ["Profit target", pctv(ev.profit_target_pct)], ["Exit cost", isClose ? money(ev.exit_cost) : null], ["Reason", ev.reason], ["Order id", ev.client_order_id], ["Broker order status", ev.response ? ev.response.status : null], ["Broker limit price", ev.response && ev.response.limit_price != null ? money(num(ev.response.limit_price)) : null], ["Time in force", ev.response ? ev.response.time_in_force : null], ["Submitted at", ev.response && ev.response.submitted_at ? String(ev.response.submitted_at).replace("T", " ") : null], ["Filled at", ev.response && ev.response.filled_at ? String(ev.response.filled_at).replace("T", " ") : null]].filter(([, v]) => v != null && v !== "—").map(([k, v]) => /*#__PURE__*/React.createElement("div", {
    className: "opt-kv-item",
    key: k
  }, /*#__PURE__*/React.createElement("span", {
    className: "opt-kv-k"
  }, k), /*#__PURE__*/React.createElement("span", {
    className: "opt-kv-v"
  }, v)))), /*#__PURE__*/React.createElement(LegDetail, {
    title: "Legs at entry",
    legs: ev.entry_legs,
    predatesSnapshots: !("entry_legs" in ev),
    contracts: ev.contracts
  }), isClose && /*#__PURE__*/React.createElement(LegDetail, {
    title: "Legs at exit",
    legs: ev.exit_legs,
    predatesSnapshots: !("exit_legs" in ev),
    contracts: ev.contracts
  }));
}
function StructureCell({
  facts,
  ev
}) {
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", null, facts.structure ? facts.structure.name : "Credit spread"), /*#__PURE__*/React.createElement("div", {
    className: "mono-dim"
  }, facts.shortParsed && facts.longParsed ? `$${facts.shortParsed.strike}/$${facts.longParsed.strike}` : ev.short_strike ? `${ev.short_strike}/${ev.long_strike}` : ev.short));
}

// --- Expiry ladder + Expires column --------------------------------------
// `expiry` is frozen purchase-time data; the day count is always recomputed
// from it at render time (never read back from the stored `dte`, which
// would freeze at its entry-time value forever).
function resolveExpiry(ev, facts) {
  return ev.expiry || (facts.shortParsed ? facts.shortParsed.expiry : null) || (facts.longParsed ? facts.longParsed.expiry : null) || null;
}
function formatExpiryDate(expiry) {
  if (!expiry) return null;
  var d = new Date(expiry + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC"
  });
}
function formatLadderDate(expiry) {
  var d = new Date(expiry + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return expiry;
  var dow = d.toLocaleDateString("en-US", {
    weekday: "short",
    timeZone: "UTC"
  });
  var date = d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC"
  });
  return `${dow} ${date}`;
}
function dteUrgencyClass(dte) {
  if (dte <= 2) return "neg-tint";
  if (dte <= 5) return "warn";
  return "mono-dim";
}
function closeDateLabel(ev) {
  var resp = ev.response || {};
  var ts = resp.filled_at || ev.ts;
  var d = ts ? new Date(ts) : null;
  if (!d || Number.isNaN(d.getTime())) return "Closed";
  return `Closed ${d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC"
  })}`;
}

// `outcome`, when set, overrides the live countdown for rows that are done
// (a filled close, or an order the broker reports expired) — dte alone
// can't distinguish "resolved" from "still ticking down".
function ExpiresCell({
  ev,
  facts,
  outcome
}) {
  if (outcome) return /*#__PURE__*/React.createElement("span", {
    className: "mono-dim"
  }, outcome);
  var expiry = resolveExpiry(ev, facts);
  var dateStr = formatExpiryDate(expiry);
  if (!dateStr) return /*#__PURE__*/React.createElement("span", {
    className: "mono-dim"
  }, "\u2014");
  var dte = dteFromExpiry(expiry);
  if (dte == null) return /*#__PURE__*/React.createElement("span", {
    className: "mono-dim"
  }, dateStr);
  if (dte < 0) return /*#__PURE__*/React.createElement("span", {
    className: "mono-dim"
  }, "Expired");
  return /*#__PURE__*/React.createElement("span", {
    className: dteUrgencyClass(dte)
  }, dateStr, " \xB7 ", dte, "d");
}

// One row per distinct expiry date across every still-open position — an
// open trade-log "open" event with no matching "close" for the same
// ticker/short/long. Matched FIFO in chronological order so re-entering the
// identical contract combo after a prior close (same ticker/short/long,
// different day) nets out only the one close it actually pairs with, not
// every open sharing that key. Risk is summed from facts.maxLoss (ev.risk),
// the same value already rendered per-row — never recomputed a second way.
function computeOpenPositions(trades) {
  var byTime = [...trades].sort((a, b) => new Date(a.ev.ts) - new Date(b.ev.ts));
  var openQueues = new Map(); // key -> FIFO queue of still-open {ev, classification}
  byTime.forEach(t => {
    var {
      ev
    } = t;
    var key = `${ev.ticker}|${ev.short}|${ev.long}`;
    if (ev.event === "close") {
      var q = openQueues.get(key);
      if (q && q.length) q.shift();
    } else {
      if (!openQueues.has(key)) openQueues.set(key, []);
      openQueues.get(key).push(t);
    }
  });
  var remaining = [];
  openQueues.forEach(q => remaining.push(...q));
  return remaining.map(({
    ev,
    classification
  }) => ({
    ev,
    facts: tradeFacts(ev, classification)
  }));
}

// The set of `ev` objects (by reference — trades/computeOpenPositions share
// the same underlying event objects, never clones) still open per
// computeOpenPositions' FIFO matching. O(n) over trades, computed once per
// render and reused by tradeStatus for every row rather than re-run per row.
function computeOpenPositionKeys(trades) {
  return new Set(computeOpenPositions(trades).map(({
    ev
  }) => ev));
}

// A Trade Log row's lifecycle bucket — "open" | "closed" | "expired" — reusing
// computeOpenPositions rather than a second open/closed derivation. A CLOSE
// row is always closed. An OPEN row still present in `openPositionKeys` is
// open, unless the contract's own expiry has already passed with no CLOSE
// ever logged — that's a worthless-expiry roll-off, not a live position. An
// OPEN row no longer in `openPositionKeys` was matched by a CLOSE event
// elsewhere in the log, so the round trip counts as closed. Never throws: a
// record missing `legs`/`expiry`/`realized_pnl` just resolves no expiry and
// falls through to "open" or "closed".
function tradeStatus(ev, facts, openPositionKeys) {
  if (!ev) return "closed";
  if (ev.event === "close") return "closed";
  if (!openPositionKeys || !openPositionKeys.has(ev)) return "closed";
  var expiry = facts ? resolveExpiry(ev, facts) : null;
  var dte = expiry ? dteFromExpiry(expiry) : null;
  return dte != null && dte < 0 ? "expired" : "open";
}
function ExpiryLadder({
  positions
}) {
  if (!positions.length) return null;
  var groups = new Map();
  positions.forEach(({
    ev,
    facts
  }) => {
    var expiry = resolveExpiry(ev, facts);
    if (!expiry) return;
    if (!groups.has(expiry)) groups.set(expiry, {
      expiry,
      tickers: [],
      risk: 0,
      latestEntryTs: null
    });
    var g = groups.get(expiry);
    g.tickers.push(ev.ticker);
    g.risk += facts.maxLoss || 0;
    var entryTs = ev.response && ev.response.filled_at || ev.ts;
    if (entryTs && (!g.latestEntryTs || entryTs > g.latestEntryTs)) g.latestEntryTs = entryTs;
  });
  var rows = Array.from(groups.values()).sort((a, b) => a.expiry.localeCompare(b.expiry));
  if (!rows.length) return null;
  return /*#__PURE__*/React.createElement("section", {
    className: "card opt-panel opt-ladder"
  }, /*#__PURE__*/React.createElement("div", {
    className: "opt-panel-head"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "opt-panel-title"
  }, "Expiry ladder", /*#__PURE__*/React.createElement(CardFeedbackButton, {
    label: "Expiry ladder"
  })), /*#__PURE__*/React.createElement("span", {
    className: "opts-provenance"
  }, /*#__PURE__*/React.createElement(TraderByline, null)), /*#__PURE__*/React.createElement("div", {
    className: "opt-panel-stats"
  }, /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("em", null, positions.length), " open positions"))), /*#__PURE__*/React.createElement("div", {
    className: "opt-table-scroll"
  }, /*#__PURE__*/React.createElement("table", {
    className: "opt-table opt-table--orders"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", {
    className: "al"
  }, "Expires", /*#__PURE__*/React.createElement(window.Help, {
    term: "expiry"
  })), /*#__PURE__*/React.createElement("th", null, "DTE", /*#__PURE__*/React.createElement(window.Help, {
    term: "dte"
  })), /*#__PURE__*/React.createElement("th", null, "Positions", /*#__PURE__*/React.createElement(window.Help, {
    term: "positions_count"
  })), /*#__PURE__*/React.createElement("th", {
    className: "al"
  }, "Tickers"), /*#__PURE__*/React.createElement("th", null, "Risk rolling off", /*#__PURE__*/React.createElement(window.Help, {
    term: "risk_rolling_off"
  })))), /*#__PURE__*/React.createElement("tbody", null, rows.map(r => {
    var dte = dteFromExpiry(r.expiry);
    var clamped = dte == null ? null : Math.max(0, dte);
    return /*#__PURE__*/React.createElement("tr", {
      key: r.expiry
    }, /*#__PURE__*/React.createElement("td", {
      className: "al"
    }, formatLadderDate(r.expiry)), /*#__PURE__*/React.createElement("td", {
      className: clamped == null ? "mono-dim" : dteUrgencyClass(clamped)
    }, clamped == null ? "—" : `${clamped}d`), /*#__PURE__*/React.createElement("td", null, r.tickers.length, /*#__PURE__*/React.createElement(window.Help, {
      term: "positions_count",
      inputs: {
        positions_count: r.tickers.length
      }
    })), /*#__PURE__*/React.createElement("td", {
      className: "al mono-dim"
    }, r.tickers.join(", ")), /*#__PURE__*/React.createElement("td", null, money(r.risk), /*#__PURE__*/React.createElement(window.Help, {
      term: "risk_rolling_off",
      inputs: {
        risk_rolling_off: r.risk
      },
      asOf: {
        entry: r.latestEntryTs
      }
    })));
  })))));
}

// kind -> badge modifier class ("unfilled"/"filled" never reach Open Orders).
var OPEN_ORDER_BADGE_CLASS = {
  terminal: "terminal",
  partial: "fill-partial",
  unfilled: "fill-unfilled"
};

// One resting/unfilled/partially-filled/terminal order. The label is never a
// bare broker status string — QUEUED / PARTIAL n/N / EXPIRED / CANCELLED /
// REJECTED / UNKNOWN only.
function OpenOrderRow({
  ev,
  classification,
  index
}) {
  var facts = tradeFacts(ev, classification);
  var resp = ev.response || {};
  var openDetail = () => {
    location.hash = "trade/" + encodeURIComponent(tradeKey(ev, index));
  };
  var onKeyDown = e => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openDetail();
    }
  };
  // A PARTIAL fill has already put `fs.filled` contracts' worth of risk on
  // the books — an unfilled/QUEUED order hasn't put any on yet, so its
  // hypothetical numbers use the full ordered count. Never the ordered
  // count for a PARTIAL, which would overstate what's actually at risk.
  var calcContracts = facts.fs && facts.fs.state === "PARTIAL" ? facts.fs.filled : ev.contracts;
  var orderCredit = ev.credit ?? ev.entry_credit;
  var asOf = {
    entry: resp.submitted_at
  };
  var shortStrike = facts.shortParsed ? facts.shortParsed.strike : undefined;
  var right = facts.shortParsed ? facts.shortParsed.right : undefined;
  return /*#__PURE__*/React.createElement("tr", {
    className: "opt-row",
    onClick: openDetail,
    tabIndex: 0,
    role: "link",
    onKeyDown: onKeyDown
  }, /*#__PURE__*/React.createElement("td", {
    className: "al"
  }, /*#__PURE__*/React.createElement("span", {
    className: "opt-chev"
  }, "\u203A"), /*#__PURE__*/React.createElement("span", {
    className: `opt-badge opt-badge--${OPEN_ORDER_BADGE_CLASS[classification.kind]}`
  }, classification.label)), /*#__PURE__*/React.createElement("td", {
    className: "al"
  }, /*#__PURE__*/React.createElement("strong", {
    className: "opt-ticker"
  }, ev.ticker)), /*#__PURE__*/React.createElement("td", {
    className: "al"
  }, /*#__PURE__*/React.createElement(StructureCell, {
    facts: facts,
    ev: ev
  })), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement(ExpiresCell, {
    ev: ev,
    facts: facts,
    outcome: classification.kind === "terminal" && classification.label.startsWith("EXPIRED") ? "Expired" : null
  })), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("span", {
    className: `opt-badge opt-badge--${facts.isClose ? "warn" : "neutral"}`
  }, facts.isClose ? "EXIT" : "ENTRY")), /*#__PURE__*/React.createElement("td", null, ev.contracts), /*#__PURE__*/React.createElement("td", null, resp.limit_price != null ? money(num(resp.limit_price)) : "—", facts.isClose && num(resp.limit_price) === 0 && /*#__PURE__*/React.createElement("span", {
    className: "opt-unfillable",
    title: "A close order priced at $0 cannot fill \u2014 it will rest until it expires."
  }, " ", "\u26A0 unfillable")), /*#__PURE__*/React.createElement("td", {
    className: "mono-dim"
  }, facts.isClose ? /*#__PURE__*/React.createElement("span", {
    title: "This is an EXIT order \u2014 filling it PAYS a debit, it does not collect a credit. The figure shown is the credit collected when the position was OPENED."
  }, money(orderCredit), " ", /*#__PURE__*/React.createElement("span", {
    className: "opt-money-note"
  }, "(entry credit)")) : /*#__PURE__*/React.createElement(React.Fragment, null, money(orderCredit), /*#__PURE__*/React.createElement(Help, {
    term: "credit_if_filled",
    inputs: {
      limit_price: num(resp.limit_price),
      contracts: calcContracts
    },
    asOf: asOf
  }))), /*#__PURE__*/React.createElement("td", null, money(facts.maxLoss), /*#__PURE__*/React.createElement(Help, {
    term: "max_loss",
    inputs: {
      width: ev.width,
      contracts: calcContracts,
      credit: orderCredit
    },
    asOf: asOf
  })), /*#__PURE__*/React.createElement("td", null, facts.be != null ? money(facts.be) : facts.isNetDebit ? "no breakeven — net debit" : "—", /*#__PURE__*/React.createElement(Help, {
    term: "breakeven",
    inputs: {
      short_strike: shortStrike,
      credit: orderCredit,
      contracts: calcContracts,
      right
    },
    asOf: asOf
  })), /*#__PURE__*/React.createElement("td", null, resp.submitted_at ? String(resp.submitted_at).replace("T", " ").slice(0, 19) : "—"), /*#__PURE__*/React.createElement("td", null, resp.time_in_force || "—"));
}

// One order Alpaca reports 100% filled — the only rows that count as trades.
// The trade's own feedback target — the id is the SAME key the #trade/<key>
// detail route resolves back via resolveTrade(), so a row's feedback always
// joins to the trade the visitor was actually looking at.
function tradeFeedbackTarget(ev, facts, index) {
  var structureName = facts.structure ? facts.structure.name : "credit spread";
  return {
    kind: "trade",
    id: tradeKey(ev, index),
    label: `${ev.ticker || "this ticker"} ${structureName}`
  };
}
function TradeLogRow({
  ev,
  classification,
  index
}) {
  var facts = tradeFacts(ev, classification);
  var {
    isClose,
    received,
    pnl,
    maxGain
  } = facts;
  // A close event never sets `ev.credit` (it carries `entry_credit` /
  // `exit_cost` instead — see spread_trader.py's `manage()`), so
  // creditReceived(ev) is always null/0 for a close row. Read the cost to
  // close straight off `ev.exit_cost`, the field the row is actually
  // labelled after.
  var exitCost = isClose ? num(ev.exit_cost) : null;
  var resp = ev.response || {};
  var openDetail = () => {
    location.hash = "trade/" + encodeURIComponent(tradeKey(ev, index));
  };
  var onKeyDown = e => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openDetail();
    }
  };
  // Closed trades are final — stamp with the fill/close time, never a live
  // quote, so a settled number can never read as a moving mark.
  var asOf = {
    entry: resp.filled_at
  };
  return /*#__PURE__*/React.createElement("tr", {
    className: "opt-row",
    onClick: openDetail,
    tabIndex: 0,
    role: "link",
    onKeyDown: onKeyDown
  }, /*#__PURE__*/React.createElement("td", {
    className: "al"
  }, /*#__PURE__*/React.createElement("span", {
    className: "opt-chev"
  }, "\u203A"), /*#__PURE__*/React.createElement("span", {
    className: `opt-badge opt-badge--${isClose ? "close" : "open"}`
  }, isClose ? "CLOSE" : "OPEN")), /*#__PURE__*/React.createElement("td", {
    className: "al"
  }, /*#__PURE__*/React.createElement("strong", {
    className: "opt-ticker"
  }, ev.ticker)), /*#__PURE__*/React.createElement("td", {
    className: "al"
  }, /*#__PURE__*/React.createElement(StructureCell, {
    facts: facts,
    ev: ev
  })), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement(ExpiresCell, {
    ev: ev,
    facts: facts,
    outcome: isClose ? closeDateLabel(ev) : null
  })), /*#__PURE__*/React.createElement("td", null, ev.contracts), /*#__PURE__*/React.createElement("td", null, isClose ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "mono-dim opt-cell-sublabel"
  }, "Cost to close"), /*#__PURE__*/React.createElement("span", {
    className: exitCost > 0 ? "down" : "up"
  }, money(exitCost)), /*#__PURE__*/React.createElement(Help, {
    term: "exit_cost",
    inputs: {
      exit_cost: ev.exit_cost
    },
    asOf: asOf
  })) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
    className: received >= 0 ? "up" : "down"
  }, money(received)), /*#__PURE__*/React.createElement(Help, {
    term: "credit_received",
    inputs: {
      net_per_contract: num(resp.filled_avg_price),
      contracts: facts.fs && facts.fs.filled
    },
    asOf: asOf
  }))), /*#__PURE__*/React.createElement("td", null, resp.filled_at ? String(resp.filled_at).replace("T", " ").slice(0, 19) : "—"), /*#__PURE__*/React.createElement("td", null, isClose ? /*#__PURE__*/React.createElement("span", {
    className: pnl >= 0 ? "up" : "down"
  }, money(pnl)) : "—", isClose && /*#__PURE__*/React.createElement(Help, {
    term: "realized_pl",
    inputs: {
      credit_received: maxGain,
      exit_cost: ev.exit_cost
    },
    asOf: asOf
  })), /*#__PURE__*/React.createElement("td", {
    className: "opts-col-feedback",
    onClick: e => e.stopPropagation(),
    onKeyDown: e => e.stopPropagation()
  }, window.FeedbackButton && /*#__PURE__*/React.createElement(window.FeedbackButton, {
    target: tradeFeedbackTarget(ev, facts, index)
  })));
}

// An EXIT order that died unfilled is not a footnote: the position it was
// meant to close is still open (or ran to expiry unmanaged). That consequence
// is invisible from a status badge alone.
function DeadExitWarning({
  orders
}) {
  var dead = (orders || []).filter(o => o.classification.kind === "terminal" && o.ev && o.ev.event === "close");
  if (!dead.length) return null;
  return /*#__PURE__*/React.createElement("p", {
    className: "opt-dead-exit"
  }, "\u26A0 ", dead.length, " exit order", dead.length === 1 ? "" : "s", " died without filling (", dead.map(o => o.ev.ticker).join(", "), ") \u2014 whatever ", dead.length === 1 ? "it was" : "they were", " ", "meant to close was NOT closed by ", dead.length === 1 ? "it" : "them", ". Check the position against the broker before treating any exit as done.");
}
function OpenOrdersTable({
  orders
}) {
  var atRiskCredit = orders.filter(o => o.classification.kind !== "terminal").reduce((n, o) => n + (o.ev.credit ?? o.ev.entry_credit ?? 0), 0);
  return /*#__PURE__*/React.createElement("section", {
    className: "card opt-panel"
  }, /*#__PURE__*/React.createElement("div", {
    className: "opt-panel-head"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "opt-panel-title"
  }, "Open Orders", /*#__PURE__*/React.createElement(CardFeedbackButton, {
    label: "Open Orders"
  }), /*#__PURE__*/React.createElement("span", {
    className: "opt-panel-sub"
  }, "submitted but never filled \u2014 resting, partial, or dead (expired / cancelled / rejected)")), /*#__PURE__*/React.createElement("span", {
    className: "opts-provenance"
  }, /*#__PURE__*/React.createElement(TraderByline, null)), /*#__PURE__*/React.createElement("div", {
    className: "opt-panel-stats"
  }, /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("em", null, orders.length), " orders"), /*#__PURE__*/React.createElement("span", null, "target ", /*#__PURE__*/React.createElement("em", {
    className: "mono-dim"
  }, money(atRiskCredit)), " if filled"))), !orders.length ? /*#__PURE__*/React.createElement("p", {
    className: "opt-log-empty"
  }, "No open orders.") : /*#__PURE__*/React.createElement("div", {
    className: "opt-table-scroll"
  }, /*#__PURE__*/React.createElement("table", {
    className: "opt-table opt-table--orders"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", {
    className: "al"
  }, "Status"), /*#__PURE__*/React.createElement("th", {
    className: "al"
  }, "Ticker"), /*#__PURE__*/React.createElement("th", {
    className: "al"
  }, "Structure"), /*#__PURE__*/React.createElement("th", null, "Contract expiry"), /*#__PURE__*/React.createElement("th", null, "Opens/closes"), /*#__PURE__*/React.createElement("th", null, "Contracts"), /*#__PURE__*/React.createElement("th", null, "Limit", /*#__PURE__*/React.createElement(window.Help, {
    term: "limit_price"
  })), /*#__PURE__*/React.createElement("th", null, "Credit", /*#__PURE__*/React.createElement(window.Help, {
    term: "credit_if_filled"
  })), /*#__PURE__*/React.createElement("th", null, "Max loss", /*#__PURE__*/React.createElement(window.Help, {
    term: "max_loss"
  })), /*#__PURE__*/React.createElement("th", null, "Breakeven", /*#__PURE__*/React.createElement(window.Help, {
    term: "breakeven"
  })), /*#__PURE__*/React.createElement("th", null, "Submitted"), /*#__PURE__*/React.createElement("th", null, "TIF", /*#__PURE__*/React.createElement(window.Help, {
    term: "tif"
  })))), /*#__PURE__*/React.createElement("tbody", null, orders.map(o => /*#__PURE__*/React.createElement(OpenOrderRow, {
    key: (o.ev.client_order_id || "") + o.index,
    ev: o.ev,
    classification: o.classification,
    index: o.index
  })))), /*#__PURE__*/React.createElement(DeadExitWarning, {
    orders: orders
  })));
}
var TRADE_STATUS_FILTERS = [{
  key: "all",
  label: "All"
}, {
  key: "open",
  label: "Open"
}, {
  key: "closed",
  label: "Closed"
}, {
  key: "expired",
  label: "Expired"
}];
var TRADE_STATUS_LABEL = {
  open: "Open",
  closed: "Closed",
  expired: "Expired"
};
var TRADE_LOG_GROUP_BYS = [{
  key: "none",
  label: "None"
}, {
  key: "status",
  label: "Status"
}, {
  key: "ticker",
  label: "Ticker"
}, {
  key: "expiry",
  label: "Expiry"
}];

// Persist the Trade Log's view (page/pageSize/filter/groupBy) across the
// #trade/<key> detail page round trip. sessionStorage over the location hash
// because the hash is already load-bearing for routing (#options,
// #options/<TICKER>, #trade/<key>) — piggybacking view state onto it would
// mean parsing it back out of every other hash consumer. Namespaced key,
// try/catch because sessionStorage throws in some privacy modes.
var TRADE_LOG_VIEW_KEY = "sst.tradeLog.view.v2";
var TRADE_LOG_PAGE_SIZES = [10, 20, 50, 100, "all"];
function readStoredTradeLogView() {
  try {
    var raw = sessionStorage.getItem(TRADE_LOG_VIEW_KEY);
    if (!raw) return null;
    var parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    // Validate on read: a stale/corrupt/out-of-range persisted value must
    // clamp to something safe rather than render a blank table.
    var filter = TRADE_STATUS_FILTERS.some(f => f.key === parsed.filter) ? parsed.filter : "all";
    var groupBy = TRADE_LOG_GROUP_BYS.some(g => g.key === parsed.groupBy) ? parsed.groupBy : "none";
    var pageSize = TRADE_LOG_PAGE_SIZES.includes(parsed.pageSize) ? parsed.pageSize : 10;
    var page = Number.isInteger(parsed.page) && parsed.page > 0 ? parsed.page : 1;
    return {
      filter,
      groupBy,
      pageSize,
      page
    };
  } catch (err) {
    return null;
  }
}
function writeStoredTradeLogView(view) {
  try {
    sessionStorage.setItem(TRADE_LOG_VIEW_KEY, JSON.stringify(view));
  } catch (err) {
    // sessionStorage unavailable (privacy mode) — view just won't persist.
  }
}
function initialTradeLogView() {
  return readStoredTradeLogView() || {
    filter: "all",
    groupBy: "none",
    page: 1,
    pageSize: 10
  };
}

// Group label for a single enriched trade under a given grouping mode.
// Expiry falls back to a trailing "Unknown expiry" bucket rather than
// dropping the row when the contract's expiry can't be resolved at all.
function groupLabelFor(groupBy, t) {
  if (groupBy === "status") return TRADE_STATUS_LABEL[t.status] || "Unknown status";
  if (groupBy === "ticker") return t.ev.ticker || "Unknown ticker";
  if (groupBy === "expiry") {
    var expiry = resolveExpiry(t.ev, t.facts);
    if (!expiry) return "Unknown expiry";
    return formatExpiryDate(expiry) || expiry;
  }
  return null;
}
function realizedOf(trades) {
  return trades.filter(t => t.ev.event === "close").reduce((n, t) => n + (t.ev.realized_pnl || 0), 0);
}
function GroupHeaderRow({
  label,
  count,
  realized,
  continuation
}) {
  // One real <td> per column below (see the 8 headers) rather than a
  // spanning cell — this panel deliberately removed that inline-detail-row
  // pattern (PRD 1013) and must not reintroduce it.
  return /*#__PURE__*/React.createElement("tr", {
    className: `opt-group-row${continuation ? " opt-group-row--cont" : ""}`
  }, /*#__PURE__*/React.createElement("td", {
    className: "al opt-group-label"
  }, label, continuation ? " (cont.)" : "", " ", /*#__PURE__*/React.createElement("span", {
    className: "opt-group-count"
  }, count), " \xB7 realized", " ", /*#__PURE__*/React.createElement("span", {
    className: realized >= 0 ? "up" : "down"
  }, money(realized))), /*#__PURE__*/React.createElement("td", null), /*#__PURE__*/React.createElement("td", null), /*#__PURE__*/React.createElement("td", null), /*#__PURE__*/React.createElement("td", null), /*#__PURE__*/React.createElement("td", null), /*#__PURE__*/React.createElement("td", null), /*#__PURE__*/React.createElement("td", null), /*#__PURE__*/React.createElement("td", null));
}
function TradeLogTable({
  trades,
  expectedOpenCount,
  totalEvents,
  capped,
  publishedEvents
}) {
  var {
    useState,
    useEffect
  } = React;
  var [filter, setFilter] = useState(() => initialTradeLogView().filter);
  var [groupBy, setGroupBy] = useState(() => initialTradeLogView().groupBy);
  var [page, setPage] = useState(() => initialTradeLogView().page);
  var [pageSize, setPageSize] = useState(() => initialTradeLogView().pageSize);

  // O(n) over trades: one facts + status derivation per row, computed once
  // per render and reused by the counts, the filter, and the grouping below.
  var openPositionKeys = computeOpenPositionKeys(trades);
  var enriched = trades.map(t => {
    var facts = tradeFacts(t.ev, t.classification);
    return {
      ...t,
      facts,
      status: tradeStatus(t.ev, facts, openPositionKeys)
    };
  })
  // Newest first: descending event timestamp, ties broken by descending
  // index so the order is stable and deterministic regardless of the
  // incoming SPREAD_LOG.events append order.
  .sort((a, b) => {
    var tsDiff = new Date(b.ev.ts).getTime() - new Date(a.ev.ts).getTime();
    return tsDiff !== 0 ? tsDiff : b.index - a.index;
  });
  var counts = {
    all: enriched.length,
    open: 0,
    closed: 0,
    expired: 0
  };
  enriched.forEach(t => {
    counts[t.status] = (counts[t.status] || 0) + 1;
  });

  // The Trade Log's Open count is derived by FIFO-pairing this log's own
  // open/close events; Positions comes straight from Alpaca. Two independent
  // sources that CAN drift (PRD 1059: a dropped close event once made this
  // read 15 while Alpaca held 14) — surface the mismatch rather than let the
  // two panels silently disagree.
  var reconciliationMismatch = typeof expectedOpenCount === "number" && expectedOpenCount !== counts.open;
  var visible = filter === "all" ? enriched : enriched.filter(t => t.status === filter);
  var realizedVisible = realizedOf(visible);

  // Grouped mode pages over the FLAT filtered list (exactly `pageSize` rows
  // per page regardless of how many groups they span), not group-by-group —
  // build the groups (for whole-group counts) plus a flat, group-ordered row
  // list (for slicing) up front so headers can repeat correctly across a
  // page boundary.
  var groups = null;
  var groupStats = null; // label -> { count, realized } over the WHOLE filtered set, not just this page
  var flatGroupedRows = null; // [{ label, t }] in group order
  var groupStartIndex = null; // label -> that group's first index in flatGroupedRows
  if (groupBy !== "none") {
    var order = [];
    var byLabel = new Map();
    visible.forEach(t => {
      var label = groupLabelFor(groupBy, t);
      if (!byLabel.has(label)) {
        byLabel.set(label, []);
        order.push(label);
      }
      byLabel.get(label).push(t);
    });
    groups = order.map(label => ({
      label,
      rows: byLabel.get(label)
    }));
    if (groupBy === "expiry") {
      groups.sort((a, b) => {
        if (a.label === "Unknown expiry") return 1;
        if (b.label === "Unknown expiry") return -1;
        return a.label.localeCompare(b.label);
      });
    }
    groupStats = new Map();
    flatGroupedRows = [];
    groupStartIndex = new Map();
    groups.forEach(g => {
      groupStats.set(g.label, {
        count: g.rows.length,
        realized: realizedOf(g.rows)
      });
      groupStartIndex.set(g.label, flatGroupedRows.length);
      g.rows.forEach(t => flatGroupedRows.push({
        label: g.label,
        t
      }));
    });
  }

  // Clamp on the derived page count rather than setState-in-render: a filter
  // change or the live-snapshot overlay replacing window.SPREAD_LOG after
  // first render can both shrink the row list out from under a stale `page`
  // (also covers a stale/out-of-range page restored from sessionStorage).
  var totalRows = groups ? flatGroupedRows.length : visible.length;
  var pageCount = pageSize === "all" ? 1 : Math.max(1, Math.ceil(totalRows / pageSize));
  var effectivePage = Math.min(page, pageCount);
  var sliceStart = pageSize === "all" ? 0 : (effectivePage - 1) * pageSize;
  var pageRows = pageSize === "all" ? visible : visible.slice(sliceStart, sliceStart + pageSize);
  var pageFlatGroupedRows = groups ? pageSize === "all" ? flatGroupedRows : flatGroupedRows.slice(sliceStart, sliceStart + pageSize) : null;
  var pageRowCount = groups ? pageFlatGroupedRows.length : pageRows.length;
  var rangeStart = totalRows === 0 ? 0 : sliceStart + 1;
  var rangeEnd = totalRows === 0 ? 0 : rangeStart + pageRowCount - 1;

  // Walk this page's flat slice, emitting a GroupHeaderRow every time the
  // label changes — including at the top of the page, so a group whose rows
  // straddle a page boundary gets a repeated, whole-group-count header
  // marked as a continuation rather than orphaned rows under no header.
  var groupedBodyRows = null;
  if (groups) {
    groupedBodyRows = [];
    var lastLabel = null;
    pageFlatGroupedRows.forEach((item, i) => {
      var globalIndex = sliceStart + i;
      if (item.label !== lastLabel) {
        var stats = groupStats.get(item.label);
        var continuation = globalIndex !== groupStartIndex.get(item.label);
        groupedBodyRows.push(/*#__PURE__*/React.createElement(GroupHeaderRow, {
          key: `grp-${item.label}-${globalIndex}`,
          label: item.label,
          count: stats.count,
          realized: stats.realized,
          continuation: continuation
        }));
        lastLabel = item.label;
      }
      groupedBodyRows.push(/*#__PURE__*/React.createElement(TradeLogRow, {
        key: (item.t.ev.client_order_id || "") + item.t.index,
        ev: item.t.ev,
        classification: item.t.classification,
        index: item.t.index
      }));
    });
  }

  // Persist the view (not raw `page`, so a page clamped down this render is
  // what survives the #trade/<key> round trip) after every change.
  useEffect(() => {
    writeStoredTradeLogView({
      filter,
      groupBy,
      page: effectivePage,
      pageSize
    });
  }, [filter, groupBy, effectivePage, pageSize]);
  return /*#__PURE__*/React.createElement("section", {
    className: "card opt-panel"
  }, /*#__PURE__*/React.createElement("div", {
    className: "opt-panel-head"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "opt-panel-title"
  }, "Trade Log", /*#__PURE__*/React.createElement(CardFeedbackButton, {
    label: "Trade Log"
  })), /*#__PURE__*/React.createElement("span", {
    className: "opts-provenance"
  }, /*#__PURE__*/React.createElement(TraderByline, null)), /*#__PURE__*/React.createElement("div", {
    className: "opt-panel-stats"
  }, /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("em", null, visible.length), " trades ", /*#__PURE__*/React.createElement("span", {
    className: "mono-dim"
  }, "of ", enriched.length)), !!visible.length && /*#__PURE__*/React.createElement("span", {
    className: "mono-dim"
  }, "Showing ", rangeStart, "\u2013", rangeEnd, " of ", visible.length), /*#__PURE__*/React.createElement("span", null, "realized ", /*#__PURE__*/React.createElement("em", {
    className: realizedVisible >= 0 ? "up" : "down"
  }, money(realizedVisible))))), reconciliationMismatch && /*#__PURE__*/React.createElement("p", {
    className: "opt-log-note opt-reconcile-warn"
  }, "Reconciliation note: this table's Open count (", counts.open, ") doesn't match the", " ", "Positions table's row count (", expectedOpenCount, ") \u2014 one likely has an event the other doesn't. Trust Positions (sourced from Alpaca); flag this for review."), capped && /*#__PURE__*/React.createElement("p", {
    className: "opt-log-note opt-log-capped"
  }, "Publishing note: only the newest ", publishedEvents, " of ", totalEvents, " trade log events are published to this dashboard \u2014 older activity exists in the internal record but cannot be shown here."), !enriched.length ? /*#__PURE__*/React.createElement("p", {
    className: "opt-log-empty"
  }, "No filled trades yet.") : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "opt-filter-row"
  }, /*#__PURE__*/React.createElement("div", {
    className: "opt-filter-group",
    role: "group",
    "aria-label": "Filter by status"
  }, TRADE_STATUS_FILTERS.map(f => /*#__PURE__*/React.createElement("button", {
    key: f.key,
    type: "button",
    className: `opt-filter-btn${filter === f.key ? " opt-filter-btn--active" : ""}`,
    onClick: () => {
      setFilter(f.key);
      setPage(1);
    }
  }, f.label, " ", /*#__PURE__*/React.createElement("span", {
    className: "opt-filter-count"
  }, counts[f.key] || 0))), /*#__PURE__*/React.createElement(Help, {
    term: "trade_status_filter"
  })), /*#__PURE__*/React.createElement("div", {
    className: "opt-group-select"
  }, /*#__PURE__*/React.createElement("label", {
    htmlFor: "opt-trade-log-group-by"
  }, "Group by:"), /*#__PURE__*/React.createElement("select", {
    id: "opt-trade-log-group-by",
    value: groupBy,
    onChange: e => {
      setGroupBy(e.target.value);
      setPage(1);
    }
  }, TRADE_LOG_GROUP_BYS.map(g => /*#__PURE__*/React.createElement("option", {
    key: g.key,
    value: g.key
  }, g.label))), /*#__PURE__*/React.createElement(Help, {
    term: "trade_log_group_by"
  }))), !visible.length ? /*#__PURE__*/React.createElement("p", {
    className: "opt-log-empty"
  }, "No ", filter, " trades.") : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "opt-table-scroll"
  }, /*#__PURE__*/React.createElement("table", {
    className: "opt-table opt-table--orders"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", {
    className: "al"
  }, "Event", /*#__PURE__*/React.createElement(window.Help, {
    term: "trade_event"
  })), /*#__PURE__*/React.createElement("th", {
    className: "al"
  }, "Ticker"), /*#__PURE__*/React.createElement("th", {
    className: "al"
  }, "Structure", /*#__PURE__*/React.createElement(window.Help, {
    term: "spread"
  })), /*#__PURE__*/React.createElement("th", null, "Expires", /*#__PURE__*/React.createElement(window.Help, {
    term: "expiry"
  })), /*#__PURE__*/React.createElement("th", null, "Contracts", /*#__PURE__*/React.createElement(window.Help, {
    term: "contracts"
  })), /*#__PURE__*/React.createElement("th", null, "Credit received", /*#__PURE__*/React.createElement(window.Help, {
    term: "credit_received"
  })), /*#__PURE__*/React.createElement("th", null, "Filled", /*#__PURE__*/React.createElement(window.Help, {
    term: "filled_at"
  })), /*#__PURE__*/React.createElement("th", null, "Realized P&L", /*#__PURE__*/React.createElement(window.Help, {
    term: "realized_pl"
  })), /*#__PURE__*/React.createElement("th", {
    className: "sr-only"
  }, "Feedback"))), /*#__PURE__*/React.createElement("tbody", null, groups ? groupedBodyRows : pageRows.map(t => /*#__PURE__*/React.createElement(TradeLogRow, {
    key: (t.ev.client_order_id || "") + t.index,
    ev: t.ev,
    classification: t.classification,
    index: t.index
  }))))), /*#__PURE__*/React.createElement(TradeLogPagination, {
    page: effectivePage,
    pageCount: pageCount,
    pageSize: pageSize,
    onPageChange: setPage,
    onPageSizeChange: size => {
      setPageSize(size);
      setPage(1);
    }
  }))));
}

// Below the table wrapper so it reads as "controls for the table above it";
// disabled (not hidden) at the ends so keyboard users always land on a real
// control, and rendered even when everything fits on one page (PRD AC).
function TradeLogPagination({
  page,
  pageCount,
  pageSize,
  onPageChange,
  onPageSizeChange
}) {
  var atFirst = page <= 1;
  var atLast = page >= pageCount;
  return /*#__PURE__*/React.createElement("nav", {
    className: "opt-pagination",
    "aria-label": "Trade Log pagination"
  }, /*#__PURE__*/React.createElement("div", {
    className: "opt-pagination-controls"
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "opt-pagination-btn",
    onClick: () => onPageChange(1),
    disabled: atFirst
  }, "First"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "opt-pagination-btn",
    onClick: () => onPageChange(page - 1),
    disabled: atFirst
  }, "Prev"), /*#__PURE__*/React.createElement("span", {
    className: "opt-pagination-readout",
    "aria-live": "polite"
  }, "Page ", page, " of ", pageCount), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "opt-pagination-btn",
    onClick: () => onPageChange(page + 1),
    disabled: atLast
  }, "Next"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "opt-pagination-btn",
    onClick: () => onPageChange(pageCount),
    disabled: atLast
  }, "Last")), /*#__PURE__*/React.createElement("div", {
    className: "opt-pagination-size"
  }, /*#__PURE__*/React.createElement("label", {
    htmlFor: "opt-trade-log-page-size"
  }, "Rows per page:"), /*#__PURE__*/React.createElement("select", {
    id: "opt-trade-log-page-size",
    value: pageSize,
    onChange: e => onPageSizeChange(e.target.value === "all" ? "all" : Number(e.target.value))
  }, /*#__PURE__*/React.createElement("option", {
    value: 10
  }, "10"), /*#__PURE__*/React.createElement("option", {
    value: 20
  }, "20"), /*#__PURE__*/React.createElement("option", {
    value: 50
  }, "50"), /*#__PURE__*/React.createElement("option", {
    value: 100
  }, "100"), /*#__PURE__*/React.createElement("option", {
    value: "all"
  }, "All")), /*#__PURE__*/React.createElement(Help, {
    term: "trade_log_pagination"
  })));
}

// Same parts-not-a-fixed-stack shape as window.optionsSummaryParts: the
// Options Log page interleaves the Expiry ladder with the summary cards
// (ladder half-width near the top, Trade Log full width lower down), so each
// card is handed back on its own. OptionsTradeLog below is these parts in the
// default stacked order — one definition of each table either way.
function optionsTradeLogParts(log, expectedOpenCount) {
  var data = log || window.SPREAD_LOG;
  if (!data || !data.events || !data.events.length) {
    return {
      empty: /*#__PURE__*/React.createElement("section", {
        className: "card opt-log"
      }, /*#__PURE__*/React.createElement("h3", {
        className: "opt-log-title"
      }, "Options trade log"), /*#__PURE__*/React.createElement("p", {
        className: "opt-log-empty"
      }, "No spread activity yet. Generate with", " ", /*#__PURE__*/React.createElement("code", null, "python -m social_signals_trader.spread_trader --export-log"), "."))
    };
  }
  var openOrders = [];
  var trades = [];
  data.events.forEach((ev, index) => {
    var classification = classifyOrder(ev);
    (classification.bucket === "trade" ? trades : openOrders).push({
      ev,
      classification,
      index
    });
  });
  var openPositions = computeOpenPositions(trades);
  return {
    empty: null,
    expiryLadder: /*#__PURE__*/React.createElement(ExpiryLadder, {
      positions: openPositions
    }),
    tradeLog: /*#__PURE__*/React.createElement(TradeLogTable, {
      trades: trades,
      expectedOpenCount: expectedOpenCount,
      totalEvents: typeof data.totalEvents === "number" ? data.totalEvents : data.events.length,
      capped: !!data.capped,
      publishedEvents: data.events.length
    }),
    openOrders: /*#__PURE__*/React.createElement(OpenOrdersTable, {
      orders: openOrders
    }),
    foot: /*#__PURE__*/React.createElement("p", {
      className: "opt-log-foot"
    }, "Greeks and prices are frozen at the moment of the order \u2014 entry legs from just before submission, exit legs from the close. \u0394 delta \xB7 \u0393 gamma \xB7 \u0398 theta \xB7 V vega \xB7 \u03C1 rho. Quotes are Alpaca\u2019s indicative feed. Open Orders shows a target credit, grey, not money received \u2014 a row only moves to the Trade Log once Alpaca reports it filled completely.")
  };
}
function OptionsTradeLog({
  log
}) {
  var parts = optionsTradeLogParts(log);
  if (parts.empty) return parts.empty;
  return (
    /*#__PURE__*/
    // Trade Log leads at full width: it is the denser table and the one that
    // records what actually happened. Open Orders sits below it — intent, not
    // history. Side by side, both were squeezed into half a column and the
    // numeric columns wrapped.
    React.createElement("div", {
      className: "opt-log opt-log--stacked"
    }, /*#__PURE__*/React.createElement("div", {
      className: "opt-log-stack"
    }, parts.expiryLadder, parts.tradeLog, parts.openOrders), parts.foot)
  );
}
window.OptionsTradeLog = OptionsTradeLog;
window.optionsTradeLogParts = optionsTradeLogParts;
window.OptionsTradeLogInternals = {
  tradeKey,
  resolveTrade,
  classifyOrder,
  tradeFacts,
  legDirection,
  fillState,
  creditReceived,
  LegDetail,
  TradeDetail,
  tradeStatus,
  computeOpenPositionKeys
};

/* ---- panels/options-summary.jsx ---- */
/* global React */
var {
  useMemo
} = React;
// Options Summary panel — renders window.OPTIONS_SUMMARY (PRD 1007 record +
// PRD 1008's rendered markdown, refreshed every 2h by PRD 1009). Full
// disclosure: real dollars, equity, greeks, entry fills, action queue — it's
// a paper account and the point is showcasing the fund's strategy work.
//
// Rather than re-derive deltas/reconciliation/confidence gating in JS (that
// math already lives once in options_summary_render.py, keyed off the prior
// jsonl record this page never sees), this panel parses the ALREADY-RENDERED
// `summary` markdown into its known sections and re-skins each one — same
// section order the render defines, same numbers, styled to match the rest
// of the dashboard instead of read as raw markdown.

// PRD 1080 recut the Analyst's cadence to an uneven, weekday-only schedule
// (options_status_refresh_summary.py: SCHEDULE) and started publishing it as
// data — `summaryData.schedule` (nextRunAt / staleAfterMs / cadenceLabel) —
// so this panel no longer transcribes the cron by hand. These fallback
// values fire ONLY when a payload has no `schedule` key yet (an older cached
// snapshot published before PRD 1080 shipped) — they reproduce that
// payload's own prior assumption of a flat 2h cadence, stale past 2 missed
// cycles.
var FALLBACK_CADENCE_LABEL = "every 2h";
var FALLBACK_REFRESH_INTERVAL_MINUTES = 120;
var FALLBACK_STALE_AFTER_MS = FALLBACK_REFRESH_INTERVAL_MINUTES * 2 * 60 * 1000;
var BAND_LABEL_CLASS = {
  SAFE: "opts-band opts-band--safe",
  WATCH: "opts-band opts-band--watch",
  DANGER: "opts-band opts-band--danger",
  BREACHED: "opts-band opts-band--breached"
};

// PRD: the Options Log is written by three voices — the Analyst (the 5x/day
// options-summary cron forming an opinion), the Trader (trader-tick /
// spread_trader + the frozen rules deciding), and the User (public feedback
// threads). Every card head carries a byline naming which one wrote it, so a
// reader can tell an opinion refreshed hours ago from a broker fact refreshed
// minutes ago. Kept as a plain label map (not derived) so ROLE.ANALYST etc.
// are the single spelling used at every call site.
var ROLE = {
  ANALYST: "Analyst",
  TRADER: "Trader",
  USER: "User"
};

// Presentation only — never touches a feedback target id. Re-exported via
// window.OptionsSummaryInternals.RoleByline so options-trade-log.jsx,
// proposed-trades.jsx and feedback-threads.jsx render the identical chip
// instead of three near-copies. The glossary term matches the role label
// lowercased ("Analyst" -> "analyst"), so every byline resolves to its own
// definition of what that voice does and on what cadence.
function RoleByline({
  role
}) {
  if (!role) return null;
  return /*#__PURE__*/React.createElement("span", {
    className: `opts-role-byline opts-role-byline--${role.toLowerCase()}`
  }, role, /*#__PURE__*/React.createElement(window.Help, {
    term: role.toLowerCase()
  }));
}
function ageLabel(iso) {
  if (!iso) return null;
  var t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  var ms = Date.now() - t;
  var m = ms / 60000;
  if (m < 1) return "just now";
  if (m < 60) return `${Math.round(m)}m ago`;
  var h = m / 60;
  if (h < 48) return `${h.toFixed(1)}h ago`;
  return `${(h / 24).toFixed(1)}d ago`;
}

// Shared staleness test — schedule-driven: a snapshot is stale once
// wall-clock has passed the job's own next scheduled run plus its grace
// period (`schedule.nextRunAt` + `schedule.staleAfterMs`, both published by
// the job itself), so a Friday-evening/weekend view of Friday's last run is
// NOT stale just because it's "old", while a genuinely missed weekday run
// IS. Falls back to the pre-PRD-1080 per-timestamp rule when `schedule` is
// absent (an older cached payload). Kept as one function (rather than each
// caller re-deriving the check) so this panel and any other reader of
// window.OPTIONS_SUMMARY (dashboard/pages/option-trade-detail.jsx) can never
// disagree on what "stale" means.
function isStaleAsOf(iso, schedule) {
  if (schedule && schedule.nextRunAt && typeof schedule.staleAfterMs === "number") {
    var next = new Date(schedule.nextRunAt).getTime();
    if (!Number.isNaN(next)) {
      return Date.now() > next + schedule.staleAfterMs;
    }
  }
  if (!iso) return false;
  var t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t > FALLBACK_STALE_AFTER_MS;
}

// --- markdown-lite parsing -------------------------------------------------
// The render's shape is fixed (owned by PRDs 1007/1008 — out of scope here),
// so a small dedicated parser beats pulling in a full markdown lib for one
// producer.
function parseSections(md) {
  var lines = (md || "").split("\n");
  var sections = [];
  var current = {
    title: null,
    lines: []
  };
  for (var line of lines) {
    var m = /^##\s+(.*)$/.exec(line);
    if (m) {
      sections.push(current);
      current = {
        title: m[1].trim(),
        lines: []
      };
    } else {
      current.lines.push(line);
    }
  }
  sections.push(current);
  return sections;
}
function findSection(sections, title) {
  return sections.find(s => s.title === title) || {
    title,
    lines: []
  };
}
function bulletsOf(lines) {
  return lines.filter(l => l.startsWith("- ")).map(l => l.slice(2));
}
function plainLinesOf(lines) {
  return lines.map(l => l.trim()).filter(l => l && !l.startsWith("- ") && !l.startsWith("|"));
}
function isTableLine(l) {
  return l.trim().startsWith("|");
}
function tableOf(lines) {
  var rows = lines.filter(isTableLine).map(l => l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map(c => c.trim()));
  if (rows.length < 2) return null;
  return {
    header: rows[0],
    body: rows.slice(2)
  };
}

// --- inline styling ---------------------------------------------------------
// Only tokens with an explicit +/- sign get colour — a bare "$104,191.02"
// (equity, not a change) stays neutral.
var SIGNED_TOKEN_RE = /([+-]\$[\d,]+(?:\.\d+)?|[+-]\d+(?:\.\d+)?%)/g;
function colorizeSigned(text) {
  if (!text) return text;
  var out = [];
  SIGNED_TOKEN_RE.lastIndex = 0;
  var last = 0;
  var m;
  var key = 0;
  while (m = SIGNED_TOKEN_RE.exec(text)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    var tok = m[0];
    out.push(/*#__PURE__*/React.createElement("span", {
      key: key++,
      className: tok.startsWith("-") ? "down" : "up"
    }, tok));
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

// --- glossary term matching in freeform bullet text ------------------------
// Same "one definition per concept" rule as everywhere else — this only maps
// a plain-English label already present in the rendered text to the
// glossary's `term` key, it never writes a second copy of any definition.
// Longest label first so e.g. "% captured" claims its match before the
// shorter "captured" pattern gets a chance to.
var PROSE_TERMS = [["Account equity", "equity"], ["unpaired legs", "unpaired_leg"], ["close cost", "close_cost"], ["open P/L", "open_pl"], ["open marks", "open_pl"], ["max loss", "max_loss"], ["wide-quoted", "wide_quote"], ["wide quote", "wide_quote"], ["strike BREACHED", "strike_breach_exit"], ["profit target", "profit_target"], ["Spot quotes", "spot"], ["% captured", "pct_captured"], ["captured", "pct_captured"], ["Realized", "realized_pl"], ["Deployment cap", "deployment"], ["Deployed", "deployment"], ["headroom", "deployment"], ["decay", "decay"], ["PoP", "pop"], ["Cash", "cash"], ["Bands", "band"], ["DANGER", "band"], ["cushion", "cushion"], ["DTE", "dte"], ["credit", "credit_received"], ["delta", "delta"], ["theta", "theta"], ["vega", "vega"], ["gamma", "gamma"], ["Beta", "variance_risk_premium"], ["Risk", "risk"], ["EV", "ev"], ["breach", "strike_breach_exit"]].sort((a, b) => b[0].length - a[0].length);
var PROSE_TERM_MAP = new Map(PROSE_TERMS);
function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Word-boundary the pattern on whichever ends actually start/end on a word
// character, so e.g. "breach" doesn't also swallow half of "breached".
function wordBoundedPattern(label) {
  var escaped = escapeRegExp(label);
  var pre = /^\w/.test(label) ? "\\b" : "";
  var post = /\w$/.test(label) ? "\\b" : "";
  return `${pre}${escaped}${post}`;
}
var GLOSSY_LINE_RE = new RegExp(PROSE_TERMS.map(([label]) => wordBoundedPattern(label)).join("|") + "|" + SIGNED_TOKEN_RE.source, "g");
var SIGNED_TOKEN_WHOLE_RE = /^[+-]\$[\d,]+(?:\.\d+)?$|^[+-]\d+(?:\.\d+)?%$/;

// Same tokenizing shape as colorizeSigned, but scanning for BOTH signed
// money/pct tokens (colour) and known glossary labels (a <Help/> button) in
// one pass, so a bullet like "max loss $1,234" gets both.
function glossify(text) {
  if (!text) return text;
  var out = [];
  GLOSSY_LINE_RE.lastIndex = 0;
  var last = 0;
  var m;
  var key = 0;
  var used = new Set();
  while (m = GLOSSY_LINE_RE.exec(text)) {
    var tok = m[0];
    if (m.index > last) out.push(text.slice(last, m.index));
    if (SIGNED_TOKEN_WHOLE_RE.test(tok)) {
      out.push(/*#__PURE__*/React.createElement("span", {
        key: key++,
        className: tok.startsWith("-") ? "down" : "up"
      }, tok));
    } else {
      out.push(tok);
      var term = PROSE_TERM_MAP.get(tok);
      if (term && !used.has(term)) {
        used.add(term);
        out.push(/*#__PURE__*/React.createElement(window.Help, {
          key: "h" + key++,
          term: term
        }));
      }
    }
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

// Bold (`**text**`) plus the same signed-token colouring, for "What we think
// right now" lines.
function renderInlineMd(text) {
  var parts = String(text).split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) {
      return /*#__PURE__*/React.createElement("strong", {
        key: i
      }, colorizeSigned(p.slice(2, -2)));
    }
    return /*#__PURE__*/React.createElement(React.Fragment, {
      key: i
    }, colorizeSigned(p));
  });
}

// Same bold-handling as renderInlineMd, but glossifying instead of just
// colour-coding — used where the bullet text itself contains a jargon term
// (Action queue).
function renderInlineMdGlossy(text) {
  var parts = String(text).split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) {
      return /*#__PURE__*/React.createElement("strong", {
        key: i
      }, glossify(p.slice(2, -2)));
    }
    return /*#__PURE__*/React.createElement(React.Fragment, {
      key: i
    }, glossify(p));
  });
}
function BulletList({
  items,
  render = colorizeSigned,
  className = "opts-bullets"
}) {
  if (!items.length) return null;
  return /*#__PURE__*/React.createElement("ul", {
    className: className
  }, items.map((t, i) => /*#__PURE__*/React.createElement("li", {
    key: i,
    className: t.indexOf("⚠") !== -1 ? "opts-line-warn" : undefined
  }, render(t))));
}
function Paragraphs({
  items
}) {
  if (!items.length) return null;
  return /*#__PURE__*/React.createElement(React.Fragment, null, items.map((t, i) => /*#__PURE__*/React.createElement("p", {
    key: i,
    className: "opt-log-empty"
  }, colorizeSigned(t))));
}

// --- section renderers -------------------------------------------------------

// "Last updated <PT time> · <age> · <cadence>" for a card whose content is
// written by a cron rather than computed live in the browser. The absolute
// time comes from window.AsOfTime (the same PT formatter the `?` tooltips'
// as-of lines use) so the two can't drift apart; staleness reuses
// isStaleAsOf against the SAME `schedule` the headline's STALE banner
// checks, so a stamp and that banner always agree. The cadence clause comes
// from `schedule.cadenceLabel` (falling back to FALLBACK_CADENCE_LABEL for
// an older cached payload) rather than a hardcoded "every Nh", since the
// real cadence is uneven and weekday-only. Renders nothing when there's no
// usable timestamp — an unstamped card is better than a fabricated one.
function SectionStamp({
  iso,
  schedule
}) {
  var t = window.AsOfTime ? window.AsOfTime.format(iso) : null;
  if (!t) return null;
  var stale = isStaleAsOf(iso, schedule);
  var cadenceLabel = schedule && schedule.cadenceLabel || FALLBACK_CADENCE_LABEL;
  return /*#__PURE__*/React.createElement("span", {
    className: stale ? "opts-section-stamp opts-section-stamp--stale" : "opts-section-stamp",
    title: iso
  }, /*#__PURE__*/React.createElement("span", null, stale ? "⚠ " : "", "Last updated ", t.text), /*#__PURE__*/React.createElement("span", null, "\xB7 ", window.AsOfTime.relativeAge(t.ms)), /*#__PURE__*/React.createElement("span", null, "\xB7 ", cadenceLabel), /*#__PURE__*/React.createElement(window.Help, {
    term: "last_updated"
  }));
}

// componentId() (the feedback-target-id kebab-casing rule) now lives in
// dashboard/components/components.jsx as window.componentId, shared by every
// card shell on the site, not just this panel's <Section>. Re-exported below
// via window.OptionsSummaryInternals.componentId for the trade-log panel and
// anything else that already depends on that surface. Named differently from
// the global (window.componentId(...), called live) rather than shadowing it
// with a same-named top-level function declaration — every <script> here
// shares one global scope, so a same-named declaration would silently
// overwrite window.componentId with itself and recurse forever.
function panelComponentId(title) {
  return window.componentId(title);
}

// Every section below is the same card/head/title shell around a different
// body — one wrapper instead of seven copies of the same markup.
// `updatedAt` is opt-in: only the cards whose content is regenerated
// wholesale by the Analyst cron carry a stamp, so the stamp keeps meaning
// something (that's "What we think right now" / "Action queue", both prose
// re-derived from the record, AND Positions — it renders straight off
// record.positions[] / positions_display[], the same cron-authored record).
// `schedule` (summaryData.schedule) rides along so SectionStamp can compute
// staleness/cadence off the job's own published schedule instead of a
// hardcoded interval. `feedbackId` is opt-in too — when omitted it's
// derived from `title` via panelComponentId() so every card built on
// Section gets a feedback button with no per-call-site change.
function Section({
  title,
  titleTerm,
  feedbackId,
  updatedAt,
  schedule,
  role,
  extraHead,
  children
}) {
  var resolvedFeedbackId = feedbackId || panelComponentId(title);
  return /*#__PURE__*/React.createElement("section", {
    className: "card opt-panel"
  }, /*#__PURE__*/React.createElement("div", {
    className: "opt-panel-head"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "opt-panel-title"
  }, title, titleTerm && /*#__PURE__*/React.createElement(window.Help, {
    term: titleTerm
  }), window.FeedbackButton && /*#__PURE__*/React.createElement(window.FeedbackButton, {
    target: {
      kind: "component",
      id: resolvedFeedbackId,
      label: title
    }
  })), (role || updatedAt) && /*#__PURE__*/React.createElement("span", {
    className: "opts-provenance"
  }, /*#__PURE__*/React.createElement(RoleByline, {
    role: role
  }), role && updatedAt && /*#__PURE__*/React.createElement("span", {
    className: "opts-provenance-sep"
  }, "\xB7"), updatedAt && /*#__PURE__*/React.createElement(SectionStamp, {
    iso: updatedAt,
    schedule: schedule
  })), extraHead), children);
}

// The banner states the day's P&L but never said what it is a percentage OF.
// Account equity is the denominator for every ratio on this page (deployment,
// collateral share, day move), so it belongs on the banner itself rather than
// three cards further down. Cash sits beside it because equity alone does not
// say how much of it is still spendable.
function AccountBalance({
  account
}) {
  var a = account || {};
  if (a.equity === null || a.equity === undefined) return null;
  var money = n => n === null || n === undefined || Number.isNaN(Number(n)) ? "—" : `$${Number(n).toLocaleString("en-US", {
    maximumFractionDigits: 0
  })}`;
  return /*#__PURE__*/React.createElement("div", {
    className: "opts-headline-balance"
  }, /*#__PURE__*/React.createElement("div", {
    className: "opts-balance-main"
  }, /*#__PURE__*/React.createElement("span", {
    className: "opts-balance-label"
  }, "Account balance", /*#__PURE__*/React.createElement(window.Help, {
    term: "equity"
  })), /*#__PURE__*/React.createElement("span", {
    className: "opts-balance-value"
  }, money(a.equity))), /*#__PURE__*/React.createElement("div", {
    className: "opts-balance-sub"
  }, "cash ", money(a.cash), a.options_buying_power !== undefined && a.options_buying_power !== null ? ` · options buying power ${money(a.options_buying_power)}` : "", a.balance_asof ? ` · as of ${a.balance_asof}` : ""));
}
function Headline({
  text,
  staleLabel,
  cadenceLabel,
  account
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "opts-headline"
  }, /*#__PURE__*/React.createElement("div", {
    className: "opts-headline-main"
  }, /*#__PURE__*/React.createElement("div", {
    className: "opts-headline-text"
  }, glossify(text)), staleLabel && /*#__PURE__*/React.createElement("div", {
    className: "opts-stale-banner"
  }, "\u26A0 STALE \u2014 refreshed ", staleLabel, ", expected ", cadenceLabel || FALLBACK_CADENCE_LABEL)), /*#__PURE__*/React.createElement(AccountBalance, {
    account: account
  }));
}

// 3-4 plain-English sentences on what a credit spread even is, shown once at
// the top of the panel so every jargon term below has a home to point back
// to — the per-term <Help/> buttons handle the specifics. A second paragraph
// states the three-voice loop the rest of the page assumes a reader already
// knows: who writes each card, on what cadence, and who acts on it. Renders
// `cadenceLabel` from the Analyst's own published schedule rather than a
// literal, so this copy can't drift from the cron the way the old hardcoded
// "every 2h" text did (PRD 1080/1081).
function HowToReadThisPage({
  cadenceLabel
}) {
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("p", {
    className: "opt-log-empty opts-howto"
  }, "We sell credit spreads: a defined-risk options trade where the broker pays us cash (the credit) up front, in exchange for us taking on the risk that the stock crosses a price we picked (the strike). We keep that cash if the stock stays on the safe side of the strike through expiration; we owe money if it doesn't. Every number below traces back to that one idea \u2014 how much cash we collected, how much room the stock has before we're at risk, and whether that room is shrinking."), /*#__PURE__*/React.createElement("p", {
    className: "opt-log-empty opts-howto"
  }, "Every card is written by one of three voices, named on its byline: the", " ", /*#__PURE__*/React.createElement("b", null, "Analyst"), " reads the book and writes what it thinks (", cadenceLabel || FALLBACK_CADENCE_LABEL, ", weekdays); the ", /*#__PURE__*/React.createElement("b", null, "User"), " \u2014 that's you \u2014 comments in public on a proposal or a card; the", " ", /*#__PURE__*/React.createElement("b", null, "Trader"), " wakes on its own 15-minute tick and decides from the Analyst's latest read, your comments, and the fund's frozen rules. Tap a byline's ", /*#__PURE__*/React.createElement("code", null, "?"), " for what each voice actually does."));
}

// The "Book totals" bullet gets three extra input-carrying `?` badges (one
// per figure it names) on top of the generic per-word ones glossify() already
// inserts — additive, per PRD 1026, never a replacement for the header-level
// explainers.
function WhereBookStands({
  lines,
  totals,
  positionsCount,
  asOf
}) {
  var items = bulletsOf(lines);
  if (!items.length) return null;
  return /*#__PURE__*/React.createElement(Section, {
    title: "Where the book stands",
    role: ROLE.ANALYST
  }, /*#__PURE__*/React.createElement("ul", {
    className: "opts-bullets"
  }, items.map((t, i) => /*#__PURE__*/React.createElement("li", {
    key: i,
    className: t.indexOf("⚠") !== -1 ? "opts-line-warn" : undefined
  }, glossify(t), totals && t.startsWith("Book totals") && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(window.Help, {
    term: "total_credit",
    inputs: {
      count: positionsCount,
      total: totals.credit
    },
    asOf: asOf
  }), /*#__PURE__*/React.createElement(window.Help, {
    term: "total_open_pl",
    inputs: {
      count: positionsCount,
      total: totals.open_pl
    },
    asOf: asOf
  }), /*#__PURE__*/React.createElement(window.Help, {
    term: "total_max_loss",
    inputs: {
      count: positionsCount,
      total: totals.max_loss
    },
    asOf: asOf
  }))))));
}

// The frozen entry columns get a visual break from the live/now columns via a
// left border on the first live column — same table, two eras.
function makeColClass(frozenCount) {
  return function colClass(i, extra) {
    if (i < frozenCount) return `al ${extra || ""} opts-col-frozen`.trim();
    return i === frozenCount ? "opts-col-live-first" : undefined;
  };
}
function BandBadge({
  value
}) {
  var cls = BAND_LABEL_CLASS[value];
  if (!cls) return /*#__PURE__*/React.createElement("span", {
    className: "mono-dim"
  }, value || "—");
  return /*#__PURE__*/React.createElement("span", {
    className: cls
  }, value);
}
function ConfCell({
  value
}) {
  if ((value || "").indexOf("⚠") !== -1) return /*#__PURE__*/React.createElement("span", {
    className: "opts-line-warn"
  }, value);
  return /*#__PURE__*/React.createElement("span", {
    className: "mono-dim"
  }, value);
}

// A row only becomes a link when its `entry.tag` (== client_order_id) both
// resolves to exactly one SPREAD_LOG event AND that event describes the same
// spread (underlying/right/short strike/expiry) as the position — a stale or
// reused client_order_id must never link to the wrong trade.
function eventMatchesPosition(pos, ev) {
  if (!pos || !ev || !window.SpreadFormat) return false;
  var parsed = window.SpreadFormat.parseOccSymbol(ev.short);
  if (!parsed) return false;
  return parsed.root === pos.underlying && parsed.right.toLowerCase() === String(pos.right).toLowerCase() && Number(parsed.strike) === Number(pos.short_strike) && parsed.expiry === pos.expiry;
}
function tradeKeyForPosition(pos) {
  var tag = pos && pos.entry && pos.entry.tag;
  var events = window.SPREAD_LOG && window.SPREAD_LOG.events || [];
  var internals = window.OptionsTradeLogInternals;
  if (!tag || !events.length || !internals) return null;
  var candidates = [];
  events.forEach((ev, i) => {
    if (ev && ev.client_order_id === tag && eventMatchesPosition(pos, ev)) {
      candidates.push({
        ev,
        i
      });
    }
  });
  if (candidates.length !== 1) return null;
  var {
    ev,
    i
  } = candidates[0];
  return internals.tradeKey(ev, i);
}

// "2026-08-15" -> "Aug 15", for the human-readable feedback label below.
// Display-only — never fed back into a calculation.
function expiryShortLabel(iso) {
  if (!iso) return "";
  var d = new Date(String(iso).slice(0, 10) + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC"
  });
}

// One position -> one stable feedback target, so feedback can be joined back
// to the exact spread it's about. The id is built from the position's own
// fields (never the row's rendered text, which can reformat) in the order
// TICKER-right-shortStrike/longStrike-expiry, e.g. "AAPL-P-190/185-2026-08-15".
// Reused verbatim by option-trade-detail.jsx rather than re-derived there.
// Falls back to whatever OCC symbol / raw text is available when a position
// can't be decomposed into those fields (e.g. an unmatched Positions-table
// row) — a malformed identity source must still produce a button, never a
// thrown error or an `undefined` label.
function positionFeedbackTarget(pos) {
  if (!pos) return null;
  var hasFields = pos.underlying != null && pos.right != null && pos.short_strike != null && pos.long_strike != null && pos.expiry != null;
  if (hasFields) {
    var right = String(pos.right).charAt(0).toUpperCase();
    var rightWord = String(pos.right).toLowerCase();
    return {
      id: `${pos.underlying}-${right}-${pos.short_strike}/${pos.long_strike}-${pos.expiry}`,
      label: `${pos.underlying} ${pos.short_strike}/${pos.long_strike} ${rightWord} spread, expires ${expiryShortLabel(pos.expiry)}`
    };
  }
  var symbol = pos.short_symbol || pos.symbol || pos.raw;
  var parsed = symbol && window.SpreadFormat && window.SpreadFormat.parseOccSymbol(symbol);
  if (parsed) {
    var _right = parsed.right.charAt(0).toUpperCase();
    return {
      id: `${parsed.root}-${_right}-${parsed.strike}-${parsed.expiry}`,
      label: window.SpreadFormat.plainEnglishLeg(symbol)
    };
  }
  return symbol ? {
    id: symbol,
    label: symbol
  } : null;
}

// After setting the hash to a trade's detail page, that page mounts
// asynchronously (React re-render off the hashchange event) — so this retries
// a few times rather than assuming #trade-feedback exists on the next tick.
// Mirrors option-trade-detail.jsx's scrollToTradeLog for the reverse trip.
var TRADE_FEEDBACK_SCROLL_BEHAVIOR = "auto";
function scrollToTradeFeedback(attempts) {
  var el = document.getElementById("trade-feedback");
  if (el) {
    el.scrollIntoView({
      behavior: TRADE_FEEDBACK_SCROLL_BEHAVIOR,
      block: "start"
    });
    return;
  }
  if (attempts > 0) window.setTimeout(() => scrollToTradeFeedback(attempts - 1), 30);
}

// A Positions row whose position already has feedback filed against it (via
// positionFeedbackTarget's id — the same id TradeFeedbackThreads matches on)
// gets a small counter next to the 💬 button, so a visitor who filed feedback
// from this row can find out where the answer lives instead of assuming it
// vanished. Links to the matching trade's #trade/<key> page when one exists;
// a position without a matching trade-log entry has nowhere to link to yet,
// so the count renders unlinked with a tooltip instead of a dead link.
function PositionFeedbackIndicator({
  feedbackTarget,
  tradeKeyValue
}) {
  var internals = window.FeedbackThreadsInternals;
  if (!internals || !feedbackTarget) return null;
  var payload = internals.feedbackPayload();
  var threads = internals.selectThreadsForContract(payload.threads, [{
    kind: "position",
    id: feedbackTarget.id
  }]);
  if (!threads.length) return null;
  var open = internals.unansweredActiveCount(threads);
  var count = `${threads.length}${open > 0 ? "!" : ""}`;
  var label = `${threads.length} thread${threads.length === 1 ? "" : "s"}${open > 0 ? `, ${open} awaiting reply` : ""}`;
  var cls = `opts-fb-indicator${open > 0 ? " opts-fb-indicator--open" : ""}`;
  var help = window.Help && /*#__PURE__*/React.createElement(window.Help, {
    term: "position_feedback_indicator"
  });
  if (tradeKeyValue) {
    return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("button", {
      type: "button",
      className: cls,
      title: `${label} — view on this trade's page`,
      onClick: e => {
        e.stopPropagation();
        location.hash = "trade/" + encodeURIComponent(tradeKeyValue);
        scrollToTradeFeedback(10);
      }
    }, "\u{1F4AC}", " ", count), help);
  }
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
    className: `${cls} opts-fb-indicator--unlinked`,
    title: `${label} — no trade page yet for this position`
  }, "\u{1F4AC}", " ", count), help);
}

// One column per cell key in `positions_display[i].cells` (written by
// `positions_display_rows()` in options_summary_render.py — the single place
// that formats these numbers into strings). `frozen` marks the columns the
// entry-snapshot styling (`opts-col-frozen`) applies to; `term` is the shared
// glossary key for the header tooltip.
var POSITIONS_COLUMNS = [{
  key: "spread",
  header: "Spread",
  term: "spread",
  frozen: true
}, {
  key: "contracts",
  header: "Contracts",
  term: "contracts",
  frozen: true
}, {
  key: "frozen_entry",
  header: "FROZEN entry (filled / net / credit)",
  term: "frozen_entry",
  frozen: true
}, {
  key: "spread_price",
  header: "LIVE spread price (Δ)",
  term: "close_cost"
}, {
  key: "spot",
  header: "LIVE spot",
  term: "spot"
}, {
  key: "cushion",
  header: "LIVE cushion (Δ)",
  term: "cushion"
}, {
  key: "band",
  header: "LIVE band",
  term: "band"
}, {
  key: "open_pl",
  header: "LIVE open P/L (Δ)",
  term: "open_pl"
}, {
  key: "pct_captured",
  header: "% captured",
  term: "pct_captured"
}, {
  key: "short_delta",
  header: "short Δ (Δ)",
  term: "short_leg_delta"
}, {
  key: "conf",
  header: "conf",
  term: "wide_quote"
}];

// A position row can't be rendered at all without these — they build both
// its display key (matching it to `positions_display`) and its #trade/<key>
// link. Checked in this order so the error names the FIRST field missing.
var POSITIONS_REQUIRED_FIELDS = ["short_symbol", "underlying", "right", "short_strike", "long_strike", "expiry", "qty"];
function missingPositionField(pos) {
  if (!pos) return "position";
  for (var field of POSITIONS_REQUIRED_FIELDS) {
    if (pos[field] == null) return field;
  }
  return null;
}

// This row's own live inputs for the four calculated cells — `pos` is the
// matched record.positions[] entry (or null when the row's Spread label
// couldn't be resolved back to one, e.g. an unpaired leg); every input
// object degrades to `{}` in that case so <Help/> falls back to a
// formula-only tooltip instead of crashing on `pos.now.spot` etc.
function positionRowCalcProps(pos, fallbackAsOf) {
  var asOf = {
    quotes: pos && pos.oldest_quote_ts || fallbackAsOf,
    entry: pos && pos.entry && pos.entry.filled_at || fallbackAsOf
  };
  // `entry`/`now` are guaranteed on a current snapshot but NOT on the legacy
  // one the fallback above now renders, and an unguarded deref here would take
  // the whole panel down with it — the exact failure mode the per-row error
  // was protecting against.
  var entry = pos && pos.entry || {};
  var now = pos && pos.now || {};
  var creditCloseCost = pos ? {
    credit: entry.credit,
    close_cost: now.close_cost
  } : {};
  return {
    asOf,
    risk: pos ? {
      width: pos.width,
      contracts: pos.qty,
      credit: entry.credit
    } : {},
    cushion: pos ? {
      short_strike: pos.short_strike,
      spot: now.spot,
      right: pos.right
    } : {},
    open_pl: creditCloseCost,
    pct_captured: creditCloseCost,
    close_cost: pos ? {
      short_ask: pos.quality && pos.quality.short && pos.quality.short.ask,
      long_bid: pos.quality && pos.quality.long && pos.quality.long.bid,
      width: pos.width,
      contracts: pos.qty
    } : {}
  };
}
var colClass = makeColClass(POSITIONS_COLUMNS.filter(c => c.frozen).length);

// LEGACY-SNAPSHOT FALLBACK. `positions_display` is the single source of cell
// text (positions_display_rows() in options_summary_render.py) and stays that
// way — but a snapshot written before that field existed (schema_version 1,
// still served as the host's cold-start bundle) has `positions[]` and no
// display rows, which rendered as one "Could not render this position" line
// per open spread: a table of errors describing a book that is perfectly
// well described by the data sitting next to it.
//
// This rebuilds the same cell keys from the raw position when — and only
// when — the display entry is absent. Deltas need the PRIOR snapshot, which a
// legacy record does not carry, so those read an em dash rather than a
// fabricated zero. Never used when `positions_display` is present.
function legacyDisplayCells(pos) {
  var money = n => n === null || n === undefined || Number.isNaN(Number(n)) ? "—" : `$${Number(n).toLocaleString("en-US", {
    maximumFractionDigits: 0
  })}`;
  var pct = (n, digits) => n === null || n === undefined || Number.isNaN(Number(n)) ? "—" : `${(Number(n) * 100).toFixed(digits === undefined ? 2 : digits)}%`;
  var num = (n, digits) => n === null || n === undefined || Number.isNaN(Number(n)) ? "—" : Number(n).toFixed(digits);
  var entry = pos.entry || {};
  var now = pos.now || {};
  var greeks = pos.greeks || {};
  var filled = entry.filled_at ? String(entry.filled_at).slice(0, 10) : "—";
  return {
    spread: `${pos.underlying} ${pos.right} ${pos.short_strike}/${pos.long_strike} ${pos.expiry}`,
    contracts: pos.qty === null || pos.qty === undefined ? "—" : String(pos.qty),
    frozen_entry: `${filled} / ${num(entry.net_per_contract, 2)} / ${money(entry.credit)}`,
    spread_price: `${money(now.close_cost)} (—)`,
    spot: now.spot === null || now.spot === undefined ? "—" : `$${Number(now.spot).toFixed(2)}`,
    cushion: `${pct(now.cushion_pct)} (—)`,
    band: now.band || "—",
    open_pl: `${money(now.open_pl)} (—)`,
    pct_captured: now.pct_captured === null || now.pct_captured === undefined ? "—" : pct(now.pct_captured, 0),
    short_delta: `${num(greeks.short_leg_delta, 3)} (—)`,
    conf: "⚠ legacy"
  };
}

// One typed record.positions[] row -> one <tr>. `display` is this position's
// entry from `positions_display` (the export's pre-formatted cell strings,
// keyed by short_symbol). When it's missing the row falls back to
// legacyDisplayCells(); only a position missing an IDENTITY field (which no
// fallback can invent) still renders an explicit error row.
function PositionsRow({
  pos,
  display,
  fallbackAsOf
}) {
  var missingField = missingPositionField(pos);
  if (missingField) {
    var label = pos && pos.short_symbol ? ` (${pos.short_symbol})` : "";
    return /*#__PURE__*/React.createElement("tr", {
      className: "opts-row-error"
    }, /*#__PURE__*/React.createElement("td", {
      colSpan: POSITIONS_COLUMNS.length + 1,
      className: "opts-line-warn"
    }, "\u26A0 Could not render this position", label, " \u2014 missing `", missingField, "`."));
  }
  var cells = display ? display.cells : legacyDisplayCells(pos);
  var key = tradeKeyForPosition(pos);
  var feedbackTarget = positionFeedbackTarget(pos);
  var openDetail = key != null ? () => {
    location.hash = "trade/" + encodeURIComponent(key);
  } : null;
  var onKeyDown = openDetail ? e => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openDetail();
    }
  } : undefined;
  var calcProps = positionRowCalcProps(pos, fallbackAsOf);
  var wideQuoteNote = (cells.conf || "").indexOf("⚠") !== -1 ? "⚠ Wide-quoted leg(s) on this row — this mark is the least trustworthy number in the table." : undefined;
  return /*#__PURE__*/React.createElement("tr", {
    className: openDetail ? "opt-row" : undefined,
    onClick: openDetail || undefined,
    tabIndex: openDetail ? 0 : undefined,
    role: openDetail ? "link" : undefined,
    onKeyDown: onKeyDown
  }, POSITIONS_COLUMNS.map(({
    key: ck,
    frozen
  }, ci) => /*#__PURE__*/React.createElement("td", {
    key: ck,
    className: colClass(ci, "mono-dim")
  }, ck === "band" ? /*#__PURE__*/React.createElement(BandBadge, {
    value: cells.band
  }) : ck === "conf" ? /*#__PURE__*/React.createElement(ConfCell, {
    value: cells.conf
  }) : ck === "frozen_entry" ? /*#__PURE__*/React.createElement(React.Fragment, null, cells.frozen_entry, /*#__PURE__*/React.createElement(window.Help, {
    term: "risk",
    inputs: calcProps.risk,
    asOf: calcProps.asOf
  })) : ck === "spread_price" ? /*#__PURE__*/React.createElement(React.Fragment, null, colorizeSigned(cells.spread_price), /*#__PURE__*/React.createElement(window.Help, {
    term: "close_cost",
    inputs: calcProps.close_cost,
    asOf: calcProps.asOf,
    note: wideQuoteNote
  })) : ck === "cushion" ? /*#__PURE__*/React.createElement(React.Fragment, null, colorizeSigned(cells.cushion), /*#__PURE__*/React.createElement(window.Help, {
    term: "cushion",
    inputs: calcProps.cushion,
    asOf: calcProps.asOf
  })) : ck === "open_pl" ? /*#__PURE__*/React.createElement(React.Fragment, null, colorizeSigned(cells.open_pl), /*#__PURE__*/React.createElement(window.Help, {
    term: "open_pl",
    inputs: calcProps.open_pl,
    asOf: calcProps.asOf
  })) : ck === "pct_captured" ? /*#__PURE__*/React.createElement(React.Fragment, null, colorizeSigned(cells.pct_captured), /*#__PURE__*/React.createElement(window.Help, {
    term: "pct_captured",
    inputs: calcProps.pct_captured,
    asOf: calcProps.asOf
  })) : frozen ? cells[ck] : colorizeSigned(cells[ck]))), /*#__PURE__*/React.createElement("td", {
    className: "opts-col-feedback",
    onClick: e => e.stopPropagation(),
    onKeyDown: e => e.stopPropagation()
  }, window.FeedbackButton && feedbackTarget && /*#__PURE__*/React.createElement(window.FeedbackButton, {
    target: {
      kind: "position",
      ...feedbackTarget
    }
  }), /*#__PURE__*/React.createElement(PositionFeedbackIndicator, {
    feedbackTarget: feedbackTarget,
    tradeKeyValue: key
  })));
}

// An option leg the broker holds that this page's spread pairing cannot pair
// (a long with no matching short, e.g. after the short side was closed or
// assigned). It is a REAL position with real P&L — Alpaca shows it — so
// omitting it made "No open options positions" a lie whenever one existed.
// Rendered as its own block rather than a spread row: it has no width, no
// credit and no cushion, and inventing those columns would be worse than
// stating plainly what it is.
function UnpairedLegs({
  legs
}) {
  var list = (legs || []).filter(Boolean);
  if (!list.length) return null;
  var reasonText = {
    long_with_no_matching_short: "long leg with no matching short — the spread's other side is gone",
    short_with_no_matching_long: "short leg with no matching long — UNCOVERED, no loss cap"
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "opts-unpaired"
  }, /*#__PURE__*/React.createElement("h4", {
    className: "opts-unpaired-title"
  }, "\u26A0 ", list.length, " unpaired option leg", list.length === 1 ? "" : "s", " \u2014 held at the broker, not part of any spread"), /*#__PURE__*/React.createElement("table", {
    className: "opt-table opts-unpaired-table"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", {
    className: "al"
  }, "Contract"), /*#__PURE__*/React.createElement("th", {
    className: "al"
  }, "Qty"), /*#__PURE__*/React.createElement("th", {
    className: "al"
  }, "Side"), /*#__PURE__*/React.createElement("th", {
    className: "al"
  }, "Why it is not a spread"))), /*#__PURE__*/React.createElement("tbody", null, list.map((leg, i) => /*#__PURE__*/React.createElement("tr", {
    key: leg.symbol || i
  }, /*#__PURE__*/React.createElement("td", {
    className: "al mono-dim"
  }, leg.symbol || "—"), /*#__PURE__*/React.createElement("td", {
    className: "al mono-dim"
  }, leg.qty === null || leg.qty === undefined ? "—" : leg.qty), /*#__PURE__*/React.createElement("td", {
    className: "al mono-dim"
  }, leg.side || "—"), /*#__PURE__*/React.createElement("td", {
    className: "al"
  }, reasonText[leg.unpaired_reason] || leg.unpaired_reason || "unpaired"))))), /*#__PURE__*/React.createElement("p", {
    className: "opts-unpaired-note"
  }, "These carry no credit, no width and no loss cap of their own, so the book totals above exclude them. They still move with the underlying \u2014 check them against the broker."));
}
function PositionsTable({
  positions,
  positionsDisplay,
  fallbackAsOf,
  unpairedLegs
}) {
  var posList = positions || [];
  if (!posList.length) {
    return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("p", {
      className: "opt-log-empty"
    }, "No open credit spreads."), /*#__PURE__*/React.createElement(UnpairedLegs, {
      legs: unpairedLegs
    }));
  }
  var displayBySymbol = new Map((positionsDisplay || []).map(d => [d.short_symbol, d]));
  return /*#__PURE__*/React.createElement("div", {
    className: "opt-table-scroll"
  }, /*#__PURE__*/React.createElement("table", {
    className: "opt-table opt-table--orders opts-positions-table"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, POSITIONS_COLUMNS.map(({
    key,
    header,
    term
  }, ci) => /*#__PURE__*/React.createElement("th", {
    key: key,
    className: colClass(ci)
  }, header, term && /*#__PURE__*/React.createElement(window.Help, {
    term: term
  }))), /*#__PURE__*/React.createElement("th", {
    className: "sr-only"
  }, "Feedback"))), /*#__PURE__*/React.createElement("tbody", null, posList.map((pos, ri) => /*#__PURE__*/React.createElement(PositionsRow, {
    key: pos && pos.short_symbol || ri,
    pos: pos,
    display: pos && pos.short_symbol ? displayBySymbol.get(pos.short_symbol) : null,
    fallbackAsOf: fallbackAsOf
  })))));
}
function PositionsSection({
  positions,
  positionsDisplay,
  fallbackAsOf,
  unpairedLegs,
  schedule
}) {
  return /*#__PURE__*/React.createElement(Section, {
    title: "Positions \u2014 entry snapshot (frozen) vs now (live)",
    updatedAt: fallbackAsOf,
    schedule: schedule,
    role: ROLE.ANALYST
  }, /*#__PURE__*/React.createElement(PositionsTable, {
    positions: positions,
    positionsDisplay: positionsDisplay,
    fallbackAsOf: fallbackAsOf,
    unpairedLegs: unpairedLegs
  }));
}

// options_summary_render.py's `_anchor_id()` trails both "What we think"
// bullets and Action queue rows with `<!-- id:pos-... -->` (link 2) so a
// queue row can deep-link to its rationale bullet (link 3) — strip it from
// the visible text everywhere it's parsed out, never render the raw comment.
var ANCHOR_COMMENT_RE = /\s*<!--\s*id:([\w.-]+)\s*-->\s*$/;
function stripAnchorComment(text) {
  var m = ANCHOR_COMMENT_RE.exec(text);
  return m ? {
    text: text.slice(0, m.index),
    anchorId: m[1]
  } : {
    text,
    anchorId: null
  };
}
var ACTION_QUEUE_HIGHLIGHT_CLASS = "opts-wwt-row--highlight";

// scrollIntoView + a transient CSS class is the whole deep-link mechanism —
// no router, no new state library, per the PRD's implementation notes.
function scrollToWhatWeThinkRow(anchorId) {
  var el = document.getElementById(anchorId);
  if (!el) return false;
  var SMOOTH_SCROLL = "smooth";
  el.scrollIntoView({
    behavior: SMOOTH_SCROLL,
    block: "center"
  });
  el.classList.add(ACTION_QUEUE_HIGHLIGHT_CLASS);
  window.setTimeout(() => el.classList.remove(ACTION_QUEUE_HIGHLIGHT_CLASS), 2000);
  return true;
}
function WhatWeThink({
  lines,
  updatedAt,
  schedule
}) {
  var items = bulletsOf(lines);
  return /*#__PURE__*/React.createElement(Section, {
    title: "What we think right now",
    updatedAt: updatedAt,
    schedule: schedule,
    role: ROLE.ANALYST
  }, items.length ? /*#__PURE__*/React.createElement("ul", {
    className: "opts-bullets opts-what-we-think"
  }, items.map((raw, i) => {
    var {
      text,
      anchorId
    } = stripAnchorComment(raw);
    return /*#__PURE__*/React.createElement("li", {
      key: i,
      id: anchorId || undefined,
      className: text.indexOf("⚠") !== -1 ? "opts-line-warn" : undefined
    }, renderInlineMd(text));
  })) : /*#__PURE__*/React.createElement("p", {
    className: "opt-log-empty"
  }, plainLinesOf(lines)[0] || "No open options positions — nothing to assess."));
}
var ACTION_SEVERITY = {
  "🔴": "breached",
  "🟠": "danger",
  "⚠": "watch",
  "✅": "safe",
  "🚫": "suppressed",
  "🔵": "info"
};
var ACTION_COUNTS_RE = /^(\d+) armed · (\d+) watching · (\d+) blocked · (.+) total at stake$/;

// The counts line (`options_summary_render.py::_action_queue`) is plain
// prose, not a bullet — pulled out separately from the grouped rows below so
// it can move into the card head instead of the body.
function parseActionCounts(lines) {
  for (var line of lines) {
    var m = ACTION_COUNTS_RE.exec(line.trim());
    if (m) return {
      armed: m[1],
      watching: m[2],
      blocked: m[3],
      totalAtStake: m[4]
    };
  }
  return null;
}

// Buckets the queue's `**Armed**` / `**Watching**` / `**Can't trust**`
// sub-headings, preserving emission order and skipping empty groups. A
// pre-link-2 payload with no sub-headings falls every row into one
// ungrouped (label: null) bucket instead of throwing.
function parseActionGroups(lines) {
  var groups = [];
  var current = null;
  for (var line of lines) {
    var headingMatch = /^\*\*(.+)\*\*$/.exec(line.trim());
    if (headingMatch) {
      current = {
        label: headingMatch[1],
        items: []
      };
      groups.push(current);
      continue;
    }
    if (line.startsWith("- ")) {
      if (!current) {
        current = {
          label: null,
          items: []
        };
        groups.push(current);
      }
      current.items.push(line.slice(2));
    }
  }
  return groups.filter(g => g.items.length > 0);
}

// Only the two groups with a dedicated glossary term get a label-level Help;
// "Watching" leans on the per-row band/credit glossify() terms already
// present in its own row text.
var ACTION_GROUP_TERM = {
  Armed: "armed",
  "Can't trust": "mark_suspect"
};
var EMPTY_ANCHOR_SET = new Set();
function ActionQueueCounts({
  counts
}) {
  if (!counts) return null;
  return /*#__PURE__*/React.createElement("span", {
    className: "opts-action-counts-chip"
  }, /*#__PURE__*/React.createElement("span", null, counts.armed, " armed"), /*#__PURE__*/React.createElement("span", null, "\xB7 ", counts.watching, " watching"), /*#__PURE__*/React.createElement("span", null, "\xB7 ", counts.blocked, " blocked"), /*#__PURE__*/React.createElement("span", null, "\xB7 ", counts.totalAtStake, " total at stake"), /*#__PURE__*/React.createElement(window.Help, {
    term: "at_stake"
  }));
}
function ActionQueueRow({
  text,
  anchors
}) {
  var {
    text: visible,
    anchorId
  } = stripAnchorComment(text);
  var sev = ACTION_SEVERITY[visible.slice(0, 2).trim()] || ACTION_SEVERITY[visible[0]] || "neutral";
  var clickable = Boolean(anchorId && anchors.has(anchorId));
  var rowTerm = visible.slice(0, 2).trim() === "🚫" ? "suppressed_exit" : visible.indexOf("unpriceable") !== -1 ? "unpriceable" : null;
  var activate = clickable ? () => scrollToWhatWeThinkRow(anchorId) : undefined;
  var onKeyDown = clickable ? e => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      activate();
    }
  } : undefined;
  return /*#__PURE__*/React.createElement("li", {
    className: `opts-action opts-action--${sev}${clickable ? " opts-action--clickable" : ""}`,
    onClick: activate,
    role: clickable ? "button" : undefined,
    tabIndex: clickable ? 0 : undefined,
    onKeyDown: onKeyDown
  }, renderInlineMdGlossy(visible), rowTerm && /*#__PURE__*/React.createElement(window.Help, {
    term: rowTerm
  }));
}
function ActionQueue({
  lines,
  updatedAt,
  anchors,
  schedule
}) {
  var counts = parseActionCounts(lines);
  var groups = parseActionGroups(lines);
  var anchorSet = anchors || EMPTY_ANCHOR_SET;
  return /*#__PURE__*/React.createElement(Section, {
    title: "Action queue",
    updatedAt: updatedAt,
    schedule: schedule,
    role: ROLE.ANALYST,
    extraHead: /*#__PURE__*/React.createElement(ActionQueueCounts, {
      counts: counts
    })
  }, groups.length ? groups.map((g, gi) => /*#__PURE__*/React.createElement("div", {
    className: "opts-action-group",
    key: gi
  }, g.label && /*#__PURE__*/React.createElement("h4", {
    className: "opts-action-group-label"
  }, g.label, ACTION_GROUP_TERM[g.label] && /*#__PURE__*/React.createElement(window.Help, {
    term: ACTION_GROUP_TERM[g.label]
  })), /*#__PURE__*/React.createElement("ul", {
    className: "opts-bullets opts-action-queue"
  }, g.items.map((t, i) => /*#__PURE__*/React.createElement(ActionQueueRow, {
    key: i,
    text: t,
    anchors: anchorSet
  }))))) : /*#__PURE__*/React.createElement("p", {
    className: "opt-log-empty"
  }, "Nothing needs attention right now."));
}
var OPEN_QUEUE_HEADER_TERM = {
  Short: "short_leg",
  Long: "long_leg",
  Contracts: "contracts",
  Expiry: "expiry",
  DTE: "dte",
  PoP: "pop",
  Risk: "risk",
  Credit: "credit_received",
  EV: "ev"
};

// The "Deployed ..." bullet gets the live deployment `?` (total max loss ÷
// equity) on top of the generic per-word ones glossify() already inserts —
// same additive treatment as WhereBookStands' "Book totals" bullet.
//
// Cron-output-only, deliberately not on the page: the live Options Log
// (dashboard/pages/ticker-details.jsx) never mounts this — its deployment
// and margin-breach line moved into the full-width Proposed trades panel
// when that panel absorbed the "human in the loop" spot directly under
// Positions. Kept defined (and still returned by optionsSummaryParts'
// caller-facing sibling, OptionsSummaryPanel below) only so the standalone
// panel and its tests keep exercising the same markdown->JSX parse the cron
// output goes through — not because anything renders it live.
function OpenQueue({
  lines,
  totals,
  account
}) {
  var bullets = bulletsOf(lines);
  var table = tableOf(lines);
  var plain = plainLinesOf(lines);
  var deploymentAsOf = account ? {
    quotes: account.balance_asof
  } : undefined;
  return /*#__PURE__*/React.createElement(Section, {
    title: "Open queue"
  }, bullets.length ? /*#__PURE__*/React.createElement("ul", {
    className: "opts-bullets"
  }, bullets.map((t, i) => /*#__PURE__*/React.createElement("li", {
    key: i,
    className: t.indexOf("⚠") !== -1 ? "opts-line-warn" : undefined
  }, glossify(t), totals && account && t.startsWith("Deployed ") && /*#__PURE__*/React.createElement(window.Help, {
    term: "deployment",
    inputs: {
      spread_risk: totals.max_loss,
      stock_value: 0,
      equity: account.equity
    },
    asOf: deploymentAsOf
  })))) : /*#__PURE__*/React.createElement(Paragraphs, {
    items: plain
  }), table && /*#__PURE__*/React.createElement("div", {
    className: "opt-table-scroll",
    style: {
      marginTop: 10
    }
  }, /*#__PURE__*/React.createElement("table", {
    className: "opt-table opt-table--orders"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, table.header.map((h, i) => /*#__PURE__*/React.createElement("th", {
    key: i,
    className: i === 0 ? "al" : undefined
  }, h, OPEN_QUEUE_HEADER_TERM[h] && /*#__PURE__*/React.createElement(window.Help, {
    term: OPEN_QUEUE_HEADER_TERM[h]
  }))))), /*#__PURE__*/React.createElement("tbody", null, table.body.map((row, ri) => /*#__PURE__*/React.createElement("tr", {
    key: ri
  }, row.map((cell, ci) => /*#__PURE__*/React.createElement("td", {
    key: ci,
    className: ci === 0 ? "al" : undefined
  }, ci === table.header.length - 1 ? colorizeSigned(cell) : cell))))))));
}

// `key` here is the raw config field name from options_summary_render.py's
// `_RULES_FIELDS` (out of scope to change) — mapped to the existing glossary
// term for that concept, reusing definitions rather than writing new ones.
var RULES_FIELD_TERM = {
  hold_to_expiry: "hold_to_expiry",
  profit_target_pct: "profit_target",
  close_on_strike_breach: "strike_breach_exit",
  strike_breach_buffer_pct: "strike_breach_buffer",
  max_short_delta: "max_short_delta",
  min_pop: "min_pop",
  min_dte: "dte",
  max_dte: "dte",
  max_per_underlying: "max_per_underlying",
  live: "live_flag"
};

// Rendered markdown already carries the config's own value as this bullet's
// `value` text — these five terms' glossary calcs accept that same field
// name as an input key, so the live SPREAD_CONFIG value substitutes straight
// into the rule's formula instead of the header-level explainer staying
// generic. Kept as a plain Set (not an object literal) so it doesn't get
// picked up by the "every mapped term must resolve" source-level test scan,
// which only looks for `key: "glossary_term"` shaped mappings.
var RULES_FIELDS_WITH_CONFIG_INPUT = new Set(["profit_target_pct", "strike_breach_buffer_pct", "max_per_underlying", "min_pop", "max_short_delta"]);
function RulesInForce({
  lines
}) {
  var items = bulletsOf(lines).map(l => {
    var m = /^`([^`]+)`:\s*(.*)$/.exec(l);
    return m ? {
      key: m[1],
      value: m[2],
      term: RULES_FIELD_TERM[m[1]]
    } : {
      key: l,
      value: "",
      free: true
    };
  });
  var config = window.SPREAD_CONFIG && window.SPREAD_CONFIG.config || {};
  return /*#__PURE__*/React.createElement(Section, {
    title: "Rules in force",
    role: ROLE.TRADER
  }, /*#__PURE__*/React.createElement("div", {
    className: "opt-kv"
  }, items.map((it, i) => {
    var configValue = !it.free && RULES_FIELDS_WITH_CONFIG_INPUT.has(it.key) ? config[it.key] : undefined;
    var inputs = configValue != null ? {
      [it.key]: configValue
    } : undefined;
    return /*#__PURE__*/React.createElement("div", {
      className: "opt-kv-item",
      key: i
    }, /*#__PURE__*/React.createElement("span", {
      className: "opt-kv-k"
    }, it.free ? glossify(it.key) : it.key, it.term && /*#__PURE__*/React.createElement(window.Help, {
      term: it.term,
      inputs: inputs
    })), /*#__PURE__*/React.createElement("span", {
      className: "opt-kv-v"
    }, it.value));
  })));
}
function Provenance({
  lines
}) {
  return /*#__PURE__*/React.createElement(Section, {
    title: "Provenance",
    titleTerm: "provenance",
    role: ROLE.ANALYST
  }, /*#__PURE__*/React.createElement(BulletList, {
    items: bulletsOf(lines),
    className: "opts-bullets mono-dim"
  }));
}
function EmptyState() {
  return /*#__PURE__*/React.createElement("section", {
    className: "card opt-log"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "opt-log-title"
  }, "Options book summary"), /*#__PURE__*/React.createElement(HowToReadThisPage, null), /*#__PURE__*/React.createElement("p", {
    className: "opt-log-empty"
  }, "No summary yet \u2014 the ", /*#__PURE__*/React.createElement("code", null, "options-status-refresh-summary"), " job hasn't run for the first time."));
}

// One card per section, handed back individually so the page that owns the
// layout (dashboard/pages/ticker-details.jsx) can place them itself — the
// "Today" headline first, Positions next, then half-width pairs. Returning
// elements rather than exporting each component keeps the parsing/asOf
// plumbing in one place: OptionsSummaryPanel below is these same parts in the
// default stacked order, so there is exactly one definition of every card.
//
// `empty` is the only key set when there's no record yet — callers render it
// instead of the layout.
function optionsSummaryParts(data) {
  var summaryData = data || window.OPTIONS_SUMMARY;
  if (!summaryData || !summaryData.record || !summaryData.summary) {
    return {
      empty: /*#__PURE__*/React.createElement(EmptyState, null)
    };
  }
  var sections = parseSections(summaryData.summary);
  var headlineText = (sections[0].lines.find(l => l.trim()) || "").trim();
  // Absent on an older cached payload published before PRD 1080 — every
  // consumer below falls back to the pre-1080 flat-2h assumption via
  // isStaleAsOf()/SectionStamp's own defaulting, never throws on the missing key.
  var schedule = summaryData.schedule || null;
  var staleLabel = isStaleAsOf(summaryData.generatedAt, schedule) ? ageLabel(summaryData.generatedAt) : null;
  var cadenceLabel = schedule && schedule.cadenceLabel || FALLBACK_CADENCE_LABEL;
  var record = summaryData.record;
  // PRD 1026: single fallback stamp for any price-derived calc that has no
  // more specific timestamp of its own (a position's own oldest_quote_ts /
  // entry.filled_at always wins when present).
  var fallbackAsOf = summaryData.generatedAt || record.generated_at;
  var bookAsOf = {
    quotes: record.oldest_quote_ts || fallbackAsOf,
    entry: fallbackAsOf
  };

  // Action queue rows deep-link to their What-we-think rationale row by the
  // same `pos-...` anchor id both sections carry — derived once here, from
  // the one bullet parse, so the two sections can never disagree on which
  // anchors actually exist.
  var whatWeThinkLines = findSection(sections, "What we think right now").lines;
  var whatWeThinkAnchors = new Set(bulletsOf(whatWeThinkLines).map(b => stripAnchorComment(b).anchorId).filter(Boolean));
  return {
    empty: null,
    // Handed to optionsTradeLogParts() so the Trade Log's FIFO-derived Open
    // count can be reconciled against Alpaca's own record.positions[] —
    // two independent sources that can (and did — PRD 1059) drift when the
    // trade log is missing a close event.
    positionsCount: record.positions.length,
    // Exposed so the page head (ticker-details.jsx) can state the Analyst's
    // real cadence in its sub-header without re-deriving or hardcoding it —
    // HowToReadThisPage isn't the only reader of this value.
    cadenceLabel,
    howto: /*#__PURE__*/React.createElement(HowToReadThisPage, {
      cadenceLabel: cadenceLabel
    }),
    headline: /*#__PURE__*/React.createElement(Headline, {
      text: headlineText,
      staleLabel: staleLabel,
      cadenceLabel: cadenceLabel,
      account: record.account
    }),
    whereBookStands: /*#__PURE__*/React.createElement(WhereBookStands, {
      lines: findSection(sections, "Where the book stands").lines,
      totals: record.totals,
      positionsCount: record.positions.length,
      asOf: bookAsOf
    }),
    positions: /*#__PURE__*/React.createElement(PositionsSection, {
      positions: record.positions,
      positionsDisplay: summaryData.positions_display,
      fallbackAsOf: fallbackAsOf,
      unpairedLegs: record.unpaired_legs,
      schedule: schedule
    }),
    // Both cards are prose the Analyst cron re-derives wholesale, so each
    // carries that job's run time — `fallbackAsOf` is exactly the summary's
    // own generated_at (see above), not a per-position quote clock.
    whatWeThink: /*#__PURE__*/React.createElement(WhatWeThink, {
      lines: whatWeThinkLines,
      updatedAt: fallbackAsOf,
      schedule: schedule
    }),
    actionQueue: /*#__PURE__*/React.createElement(ActionQueue, {
      lines: findSection(sections, "Action queue").lines,
      updatedAt: fallbackAsOf,
      anchors: whatWeThinkAnchors,
      schedule: schedule
    }),
    // No `openQueue` key: the live page (ticker-details.jsx) never mounted
    // one, and Proposed trades is what a reader sees for "what's about to
    // happen" now. OpenQueue the component stays defined above for the
    // standalone-panel test coverage only — see its own comment.
    rulesInForce: /*#__PURE__*/React.createElement(RulesInForce, {
      lines: findSection(sections, "Rules in force").lines
    }),
    provenance: /*#__PURE__*/React.createElement(Provenance, {
      lines: findSection(sections, "Provenance").lines
    })
  };
}
function OptionsSummaryPanel({
  data
}) {
  var summaryText = data ? data.summary : window.OPTIONS_SUMMARY && window.OPTIONS_SUMMARY.summary;
  // Hooks must run unconditionally, so this memo sits ahead of the
  // empty-state guard below even though its result is unused in that case.
  var parts = useMemo(() => optionsSummaryParts(data), [data, summaryText]);
  if (parts.empty) return parts.empty;
  return /*#__PURE__*/React.createElement("div", {
    className: "opt-log opt-log--stacked opts-summary"
  }, /*#__PURE__*/React.createElement("div", {
    className: "opt-log-stack"
  }, parts.howto, parts.headline, parts.whereBookStands, parts.positions, parts.whatWeThink, parts.actionQueue, parts.rulesInForce, parts.provenance));
}

// Shared with dashboard/pages/option-trade-detail.jsx so it can resolve a
// trade-log event to its live record.positions[] entry (for the current
// price) using the same row<->position identity rules this panel uses —
// rather than a third, drift-prone matcher.
window.OptionsSummaryInternals = {
  eventMatchesPosition,
  tradeKeyForPosition,
  ageLabel,
  isStaleAsOf,
  FALLBACK_STALE_AFTER_MS,
  FALLBACK_CADENCE_LABEL,
  FALLBACK_REFRESH_INTERVAL_MINUTES,
  componentId: panelComponentId,
  positionFeedbackTarget,
  RoleByline,
  ROLE
};
window.OptionsSummaryPanel = OptionsSummaryPanel;
// Per-card access for the page that owns the Options Log layout.
window.optionsSummaryParts = optionsSummaryParts;

/* ---- panels/feedback-threads.jsx ---- */
/* global React */
// Feedback forum — the read side of dashboard/lib/feedback.js.
//
// feedback.js is how a visitor SUBMITS feedback against a target (a trade, a
// position, a component, the page). This file is how that feedback comes back
// on-screen, with the local agent's answer attached:
//
//   window.TradeFeedbackThreads  — the discussion under one trade
//                                  (#trade/<key>): every thread filed against
//                                  that trade key or its matching position.
//   window.SystemFeedbackPanel   — feedback filed against a COMPONENT or the
//                                  page. That's a note about the site, not
//                                  about a trade, so it never shows under a
//                                  trade — it collects at the very bottom of
//                                  #options.
//
// One feedback item = one thread. Replies are keyed on the feedback id
// (feedback_threads.py), so two questions about the same trade stay two
// separate conversations and an answer can never land under the wrong one.
//
// Data: window.FEEDBACK_THREADS, generated by
// `python -m social_signals_trader.feedback_cli build` into data-feedback.js
// and overlaid live by lib/live-snapshot.js. Missing/empty is the normal
// cold-start case — every entry point below degrades to "nothing to show".

var FeedbackThreadsHelp = window.Help;

// Every block on this file is written by the User — public feedback, not the
// Analyst's opinion or the Trader's decision. Shared byline reused from
// options-summary.jsx via window.OptionsSummaryInternals rather than a
// second implementation.
function userByline() {
  var internals = window.OptionsSummaryInternals;
  var RB = internals && internals.RoleByline;
  var role = internals && internals.ROLE && internals.ROLE.USER;
  return RB ? /*#__PURE__*/React.createElement(RB, {
    role: role
  }) : null;
}
var TYPE_TONE = {
  bug: "bad",
  feature: "warn",
  feedback: "neutral"
};
var TYPE_LABEL = {
  bug: "BUG",
  feature: "IDEA",
  feedback: "FEEDBACK"
};
var STATUS_LABEL = {
  open: "awaiting reply",
  answered: "answered",
  archived: "archived"
};

// --- per-browser view state (filter + collapse) -----------------------------
// Client-side only — never touches the stored feedback itself, just what a
// given reader has chosen to look at. Same localStorage try/catch discipline
// as readOutbox/writeOutbox in lib/feedback.js (Safari private mode etc. must
// degrade to in-memory, never throw into render).

var VIEW_KEY = "sst.feedback.view";
var VIEW_COLLAPSE_CAP = 200;
var FILTER_KEYS = ["open", "answered", "archived", "all"];
var FILTER_LABEL = {
  open: "Open",
  answered: "Answered",
  archived: "Archived",
  all: "All"
};
function statusOf(thread) {
  return thread.status || (thread.answered ? "answered" : "open");
}
function defaultCollapsed(status) {
  return status !== "open";
}
function readViewState() {
  try {
    var raw = window.localStorage.getItem(VIEW_KEY);
    var obj = raw ? JSON.parse(raw) : null;
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return {
      filters: {},
      collapse: {}
    };
    var filters = obj.filters && typeof obj.filters === "object" && !Array.isArray(obj.filters) ? obj.filters : {};
    var collapse = obj.collapse && typeof obj.collapse === "object" && !Array.isArray(obj.collapse) ? obj.collapse : {};
    return {
      filters,
      collapse
    };
  } catch (e) {
    return {
      filters: {},
      collapse: {}
    };
  }
}
function writeViewState(state) {
  try {
    window.localStorage.setItem(VIEW_KEY, JSON.stringify(state));
  } catch (e) {
    // Safari private mode / storage disabled — the reader's choices just
    // don't survive a reload this session; nothing to surface to them.
  }
}

// Drops entries for thread ids that no longer exist anywhere in the feed, then
// caps what's left to the most-recently-touched VIEW_COLLAPSE_CAP entries so
// the object can't grow forever across a long-lived browser profile.
function pruneCollapse(collapse, liveIds) {
  var idSet = new Set(liveIds || []);
  var keys = Object.keys(collapse).filter(id => idSet.has(id));
  if (keys.length > VIEW_COLLAPSE_CAP) keys = keys.slice(keys.length - VIEW_COLLAPSE_CAP);
  var next = {};
  keys.forEach(id => {
    next[id] = collapse[id];
  });
  return next;
}

// --- owner mode (PRD 1071) ---------------------------------------------
// The token itself lives in localStorage under FeedbackClient.OWNER_KEY,
// captured/stripped from the URL by lib/feedback.js before this module ever
// renders. This file only tracks whether a token is CURRENTLY present, plus
// a page-wide "the moderate route 404s" flag, as small pub/sub state so a
// 401/403 (owner token invalid) or 404 (route not deployed) discovered by
// one thread's moderate click drops every panel out of owner mode / into
// the disabled-with-note state together, not just the thread that was
// clicked.

function hasOwnerToken() {
  return !!(window.FeedbackClient && window.FeedbackClient.getOwnerToken && window.FeedbackClient.getOwnerToken());
}
var ownerModeFlag = hasOwnerToken();
var ownerModeListeners = new Set();
function setOwnerMode(next) {
  if (!next && window.FeedbackClient && window.FeedbackClient.clearOwnerToken) {
    window.FeedbackClient.clearOwnerToken();
  }
  if (ownerModeFlag === next) return;
  ownerModeFlag = next;
  ownerModeListeners.forEach(fn => fn(next));
}
// lib/feedback.js re-captures `?owner=<token>` on a `hashchange` (an in-page
// SPA link, not just a hard reload) and fires this event after storing it —
// pick that up here so ownerModeFlag (computed once at module load) doesn't
// go stale for the rest of the session.
if (typeof window !== "undefined") {
  window.addEventListener("sst:feedback-owner-changed", () => setOwnerMode(hasOwnerToken()));
}
function useOwnerMode() {
  var [value, setValue] = React.useState(ownerModeFlag);
  React.useEffect(() => {
    ownerModeListeners.add(setValue);
    return () => ownerModeListeners.delete(setValue);
  }, []);
  return value;
}
var routeNotDeployedFlag = false;
var routeNotDeployedListeners = new Set();
function setRouteNotDeployed(next) {
  if (routeNotDeployedFlag === next) return;
  routeNotDeployedFlag = next;
  routeNotDeployedListeners.forEach(fn => fn(next));
}
function useRouteNotDeployed() {
  var [value, setValue] = React.useState(routeNotDeployedFlag);
  React.useEffect(() => {
    routeNotDeployedListeners.add(setValue);
    return () => routeNotDeployedListeners.delete(setValue);
  }, []);
  return value;
}

// One thread's Archive / Unarchive / Delete controls. Rendered only in
// owner mode, only when the thread has an id. `moderationState` is this
// thread's slice of ThreadList's override map ({status, pending, error,
// hidden} or undefined pre-interaction).
function ModerationControls({
  thread,
  routeNotDeployed,
  moderationState,
  onModerate
}) {
  var [confirmingDelete, setConfirmingDelete] = React.useState(false);
  if (!thread.id) return null;
  var status = statusOf(thread);
  var pending = !!(moderationState && moderationState.pending);
  var disabled = pending || routeNotDeployed;
  var error = moderationState && moderationState.error;
  function run(action) {
    // `disabled` only takes effect once the optimistic setOverrides() render
    // lands — guard the synchronous click too, so a fast double-click can't
    // fire two overlapping moderate() calls for the same thread.
    if (disabled) return;
    setConfirmingDelete(false);
    onModerate(action);
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "fbt-mod",
    onClick: e => e.stopPropagation()
  }, /*#__PURE__*/React.createElement("div", {
    className: "fbt-mod-actions"
  }, status === "archived" ? /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "fbt-mod-btn",
    disabled: disabled,
    onClick: () => run("unarchive")
  }, "Unarchive") : /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "fbt-mod-btn",
    disabled: disabled,
    onClick: () => run("archive")
  }, "Archive"), !confirmingDelete ? /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "fbt-mod-btn fbt-mod-btn--danger",
    disabled: disabled,
    onClick: () => setConfirmingDelete(true)
  }, "Delete") : /*#__PURE__*/React.createElement("span", {
    className: "fbt-mod-confirm"
  }, "Delete this thread?", /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "fbt-mod-btn fbt-mod-btn--danger",
    disabled: disabled,
    onClick: () => run("delete")
  }, "Confirm"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "fbt-mod-btn",
    onClick: () => setConfirmingDelete(false)
  }, "Cancel"))), routeNotDeployed && /*#__PURE__*/React.createElement("p", {
    className: "fbt-mod-note"
  }, "moderation route not deployed on bilko.run yet \u2014 use", " ", /*#__PURE__*/React.createElement("code", null, `feedback_cli archive --id ${thread.id}`), " locally"), !routeNotDeployed && error && /*#__PURE__*/React.createElement("p", {
    className: "fbt-mod-error"
  }, error));
}
function feedbackPayload() {
  var p = window.FEEDBACK_THREADS;
  if (!p || !Array.isArray(p.threads)) return {
    generatedAt: null,
    threads: [],
    counts: {},
    funnel: null
  };
  return p;
}

// "2026-08-09T20:35:04Z" -> "Aug 9, 1:35 PM PDT". Display-only; the raw ISO
// stays on the element title so the exact instant is never lost.
function whenLabel(iso) {
  if (!iso) return "";
  var d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Los_Angeles",
    timeZoneName: "short"
  });
}

// A thread belongs to this trade page when it was filed against the trade key
// itself, or against the position that trade opened — the two surfaces use
// different id shapes (tradeKey vs positionFeedbackTarget), so the caller
// passes both and this matches either.
function selectThreads(threads, targets) {
  var wanted = (targets || []).filter(t => t && t.kind && t.id);
  if (!wanted.length) return [];
  return threads.filter(t => wanted.some(w => w.kind === t.targetKind && String(w.id) === String(t.targetId)));
}
function systemThreads(threads) {
  return threads.filter(t => t.scope === "system");
}

// Threads on ONE proposed trade. Filed as component/`proposal-<id>` (the
// submit contract has no `proposal` kind), given scope "proposal" by
// feedback_threads.py so they never leak into the site-feedback pool above.
function proposalThreads(threads, proposalId) {
  if (!proposalId) return [];
  return threads.filter(t => t.targetKind === "component" && String(t.targetId) === String(proposalId));
}

// --- contract continuity (PRD 1088, on top of PRD 1087's contractKey) ------
//
// One spread carries three (kind,id) identities over its life — proposed,
// open position, trade log — each already resolved to the SAME `contractKey`
// by feedback_threads.py. This is the single selector all three surfaces
// (ProposalDiscussion, TradeFeedbackThreads, PositionFeedbackIndicator) call
// through so a question asked at one stage surfaces at every later stage
// too, rather than three surfaces each re-implementing the merge.
//
// Strictly additive over `selectThreads`: it always includes the legacy
// (kind,id) match, then unions in every other thread sharing a contractKey
// found on that match. A pre-1087 cached payload (no `contractKey` on any
// thread) degrades to exactly `selectThreads`'s behavior — no blank panel,
// no crash. `threads` (feedbackPayload().threads / feedback_threads.build's
// output) already arrives sorted by lastActivityAt descending, so filtering
// it in one pass — rather than concatenating the legacy and by-contract
// subsets — keeps the merged set in that same single time order (one
// interleaved conversation, not legacy-then-contract-matches) and dedupes
// on thread id for free.
function selectThreadsForContract(threads, targets) {
  var legacy = selectThreads(threads, targets);
  var keys = new Set(legacy.map(t => t.contractKey).filter(Boolean));
  if (!keys.size) return legacy;
  var legacyIds = new Set(legacy.map(t => t.id));
  return threads.filter(t => legacyIds.has(t.id) || t.contractKey && keys.has(t.contractKey));
}

// Header "N awaiting reply" must exclude archived threads — an archived
// thread is neither answered nor something a reader should chase a reply
// on, and `counts.unanswered` (PRD 1068) already excludes it. Shared here so
// the three header counts below can't drift back into recounting archived
// threads as open.
function unansweredActiveCount(threads) {
  return threads.filter(t => !t.answered && statusOf(t) !== "archived").length;
}
var STAGE_LABEL = {
  proposal: "asked while proposed",
  position: "asked while open",
  trade: "asked on the trade log"
};

// --- rendering -------------------------------------------------------------

// One entry of a thread's `messages[]` — the visitor's opening post and every
// follow-up/reply all render through this SAME component, attributed by
// `role` (schema 2, feedback_threads.py `_public_message`/`_user_message`).
// A long body (a pasted stack trace, a rambling question) shouldn't push a
// whole thread's card past the fold — clamp it to a few lines and let the
// reader opt into the rest.
var CLAMP_THRESHOLD = 400;
function ClampedBody({
  text
}) {
  var [expanded, setExpanded] = React.useState(false);
  if (!text) return null;
  var long = text.length > CLAMP_THRESHOLD;
  return /*#__PURE__*/React.createElement("div", {
    className: `fbt-body-wrap${long && !expanded ? " fbt-body-wrap--clamped" : ""}`
  }, /*#__PURE__*/React.createElement("p", {
    className: "fbt-body"
  }, text), long && /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "fbt-linklike fbt-clamp-toggle",
    onClick: () => setExpanded(v => !v)
  }, expanded ? "Show less" : "Show more"));
}
function ThreadMessage({
  message
}) {
  var role = message.role === "agent" ? "agent" : "user";
  var authorLabel = message.authorLabel || message.author || "Visitor";
  return /*#__PURE__*/React.createElement("div", {
    className: `fbt-msg fbt-msg--${role}`
  }, /*#__PURE__*/React.createElement("div", {
    className: "fbt-msg-head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "fbt-author"
  }, authorLabel), /*#__PURE__*/React.createElement("span", {
    className: "fbt-when",
    title: message.createdAt || ""
  }, whenLabel(message.createdAt))), /*#__PURE__*/React.createElement(ClampedBody, {
    text: message.body
  }));
}

// `messages[]` is the schema-2 shape (feedback_threads.py `build()`). A
// pre-v2 cached payload (stale `data-feedback.js`, or a browser holding an
// old file) only has `description` + `replies[]` — synthesize the same
// opener-then-replies shape from those so ThreadMessage is the ONLY render
// path for a thread's conversation, live or fallback.
function threadMessages(thread) {
  if (Array.isArray(thread.messages)) return thread.messages;
  var opener = {
    id: thread.id,
    role: "user",
    author: "visitor",
    authorLabel: "Visitor",
    body: thread.description || "",
    createdAt: thread.createdAt
  };
  var replies = (thread.replies || []).map(r => ({
    ...r,
    role: "agent"
  }));
  return [opener, ...replies];
}

// One thread = every message in time order, then a Reply control that
// re-opens the SAME feedback form scoped to the SAME target — so a visitor's
// follow-up comes back attached to this trade/component, not to the page at
// large. It goes out with `parentId` set, which is what puts the form into
// reply mode (body only, no title, no type chips — the topic already named
// itself when it was opened; see FeedbackModal in lib/feedback.js).
// Collapsed: header row only (badge / title / time / status pill / message
// count) behind one toggle button. Expanded: the full conversation. The
// header is itself the toggle so keyboard/screen-reader users get one
// obvious control per thread (`aria-expanded`, real `<button>`).
function FeedbackThread({
  thread,
  collapsed,
  onToggleCollapse,
  ownerMode,
  routeNotDeployed,
  moderationState,
  onModerate
}) {
  var tone = TYPE_TONE[thread.type] || "neutral";
  var status = statusOf(thread);
  var statusLabel = STATUS_LABEL[status] || STATUS_LABEL.open;
  var messages = threadMessages(thread);
  var title = thread.title || "(no title)";
  var stageLabel = STAGE_LABEL[thread.stage];
  return /*#__PURE__*/React.createElement("article", {
    className: `fbt-thread fbt-thread--${status}`
  }, /*#__PURE__*/React.createElement("header", {
    className: "fbt-thread-head"
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "fbt-thread-toggle",
    "aria-expanded": !collapsed,
    "aria-label": `${collapsed ? "Expand" : "Collapse"} thread: ${title}`,
    onClick: onToggleCollapse
  }, /*#__PURE__*/React.createElement("span", {
    className: "fbt-caret",
    "aria-hidden": "true"
  }, collapsed ? "▸" : "▾"), /*#__PURE__*/React.createElement("span", {
    className: `fbt-badge fbt-badge--${tone}`
  }, TYPE_LABEL[thread.type] || "FEEDBACK"), stageLabel && /*#__PURE__*/React.createElement("span", {
    className: `fbt-stage fbt-stage--${thread.stage}`
  }, stageLabel), /*#__PURE__*/React.createElement("span", {
    className: "fbt-title"
  }, title), /*#__PURE__*/React.createElement("span", {
    className: "fbt-when",
    title: thread.createdAt || ""
  }, whenLabel(thread.createdAt)), /*#__PURE__*/React.createElement("span", {
    className: `fbt-status fbt-status--${status}`
  }, statusLabel), /*#__PURE__*/React.createElement("span", {
    className: "fbt-msg-count"
  }, messages.length, " message", messages.length === 1 ? "" : "s")), ownerMode && /*#__PURE__*/React.createElement(ModerationControls, {
    thread: thread,
    routeNotDeployed: routeNotDeployed,
    moderationState: moderationState,
    onModerate: onModerate
  })), !collapsed && /*#__PURE__*/React.createElement("div", {
    className: "fbt-thread-body"
  }, thread.targetLabel && /*#__PURE__*/React.createElement("p", {
    className: "fbt-target"
  }, "about: ", thread.targetLabel), /*#__PURE__*/React.createElement("div", {
    className: "fbt-messages"
  }, messages.map(m => /*#__PURE__*/React.createElement(ThreadMessage, {
    key: m.id,
    message: m
  }))), window.FeedbackButton && thread.targetKind && thread.targetId && /*#__PURE__*/React.createElement("div", {
    className: "fbt-thread-foot"
  }, /*#__PURE__*/React.createElement(window.FeedbackButton, {
    target: {
      kind: thread.targetKind,
      id: thread.targetId,
      label: thread.targetLabel || thread.title
    },
    parentId: thread.id,
    parentType: thread.type
  }), /*#__PURE__*/React.createElement("span", {
    className: "fbt-hint"
  }, "adds a message to this topic \u2014 no new title"))));
}

// Chips for open / answered / archived / all — a zero-count chip stays
// visible but disabled so the control set never reflows as data changes.
function ThreadFilters({
  counts,
  value,
  onChange
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "fbt-filters",
    role: "group",
    "aria-label": "Filter threads by status"
  }, FILTER_KEYS.map(key => {
    var count = counts[key] || 0;
    var active = value === key;
    return /*#__PURE__*/React.createElement("button", {
      key: key,
      type: "button",
      className: `fbt-chip${active ? " fbt-chip--on" : ""}`,
      "aria-pressed": active,
      disabled: count === 0,
      onClick: () => onChange(key)
    }, FILTER_LABEL[key], " ", /*#__PURE__*/React.createElement("span", {
      className: "fbt-chip-count"
    }, count));
  }));
}

// The single shared filtering + collapse implementation. All three entry
// points (TradeFeedbackThreads, SystemFeedbackPanel, ProposalDiscussion) pass
// their own already-selected thread subset through here — this is the only
// place that reads/writes `sst.feedback.view`.
//
// panelKey scopes the persisted filter choice per surface (a trade page and
// the system panel shouldn't fight over one shared filter). allThreadIds is
// the FULL feed's thread ids (not just this subset) so collapse-state pruning
// can tell "archived on another page" apart from "genuinely gone".
function ThreadList({
  threads: rawThreads,
  emptyText,
  panelKey,
  allThreadIds
}) {
  var [view, setView] = React.useState(readViewState);
  var archiveRef = React.useRef(null);
  var key = panelKey || "_default";
  var storedFilter = view.filters[key];
  var ownerMode = useOwnerMode();
  var routeNotDeployed = useRouteNotDeployed();
  // id -> {status, pending, error, hidden} — a local, optimistic overlay on
  // top of the static FEEDBACK_THREADS payload. `hidden` (delete) removes a
  // thread from every list below without a reload; a failed call reverts
  // both `status` and `hidden` and leaves `error` for ModerationControls.
  var [overrides, setOverrides] = React.useState({});
  React.useEffect(() => {
    if (storedFilter === "archived" && archiveRef.current) archiveRef.current.open = true;
  }, [storedFilter]);
  function performModerate(thread, action) {
    var id = thread.id;
    var prevStatus = statusOf(thread);
    var isDelete = action === "delete";
    var optimisticStatus = action === "archive" ? "archived" : action === "unarchive" || action === "restore" ? thread.answered ? "answered" : "open" : prevStatus;
    setOverrides(prev => ({
      ...prev,
      [id]: {
        status: optimisticStatus,
        pending: true,
        error: null,
        hidden: isDelete
      }
    }));
    window.FeedbackClient.moderate(id, action).then(result => {
      if (result && result.ok) {
        setOverrides(prev => ({
          ...prev,
          [id]: {
            status: optimisticStatus,
            pending: false,
            error: null,
            hidden: isDelete
          }
        }));
        return;
      }
      var status = result ? result.status : 0;
      if (status === 401 || status === 403) setOwnerMode(false);
      if (status === 404) setRouteNotDeployed(true);
      var message = status === 404 ? `moderation route not deployed on bilko.run yet — use \`feedback_cli archive --id ${id}\` locally` : status === 401 || status === 403 ? "Not authorized — owner mode disabled." : `Failed (HTTP ${status || "network error"}).`;
      setOverrides(prev => ({
        ...prev,
        [id]: {
          status: prevStatus,
          pending: false,
          error: message,
          hidden: false
        }
      }));
    });
  }
  var threads = rawThreads.filter(t => !(overrides[t.id] && overrides[t.id].hidden)).map(t => overrides[t.id] ? {
    ...t,
    status: overrides[t.id].status
  } : t);
  if (!threads.length) return /*#__PURE__*/React.createElement("p", {
    className: "fbt-empty"
  }, emptyText);
  var archived = threads.filter(t => statusOf(t) === "archived");
  var active = threads.filter(t => statusOf(t) !== "archived");
  var counts = {
    open: threads.filter(t => statusOf(t) === "open").length,
    answered: threads.filter(t => statusOf(t) === "answered").length,
    archived: archived.length,
    all: threads.length
  };
  var filter = FILTER_KEYS.includes(storedFilter) ? storedFilter : counts.open > 0 ? "open" : "all";
  function setFilter(next) {
    var nextView = {
      ...view,
      filters: {
        ...view.filters,
        [key]: next
      }
    };
    setView(nextView);
    writeViewState(nextView);
  }
  function toggleCollapse(id, status) {
    var wasCollapsed = view.collapse[id] != null ? view.collapse[id] : defaultCollapsed(status);
    // Delete-then-set so a re-toggled id moves to the end of insertion order —
    // pruneCollapse drops from the front, so this keeps the cap an LRU over
    // recently-touched threads rather than first-ever-touched ones.
    var rest = {
      ...view.collapse
    };
    delete rest[id];
    var collapse = pruneCollapse({
      ...rest,
      [id]: !wasCollapsed
    }, allThreadIds && allThreadIds.length ? allThreadIds : threads.map(t => t.id));
    var nextView = {
      ...view,
      collapse
    };
    setView(nextView);
    writeViewState(nextView);
  }
  function isCollapsed(t) {
    var status = statusOf(t);
    return view.collapse[t.id] != null ? view.collapse[t.id] : defaultCollapsed(status);
  }
  function renderThread(t) {
    return /*#__PURE__*/React.createElement(FeedbackThread, {
      key: t.id,
      thread: t,
      collapsed: isCollapsed(t),
      onToggleCollapse: () => toggleCollapse(t.id, statusOf(t)),
      ownerMode: ownerMode,
      routeNotDeployed: routeNotDeployed,
      moderationState: overrides[t.id],
      onModerate: action => performModerate(t, action)
    });
  }
  var visible = filter === "archived" ? [] : filter === "all" ? active : active.filter(t => statusOf(t) === filter);
  var showFilteredEmpty = filter !== "archived" && !visible.length;
  var showArchivedRedirect = filter === "archived" && archived.length > 0;
  return /*#__PURE__*/React.createElement("div", {
    className: "fbt-list-wrap"
  }, /*#__PURE__*/React.createElement(ThreadFilters, {
    counts: counts,
    value: filter,
    onChange: setFilter
  }), showFilteredEmpty && /*#__PURE__*/React.createElement("p", {
    className: "fbt-empty fbt-empty--filtered"
  }, `No ${(FILTER_LABEL[filter] || "matching").toLowerCase()} topics.`, " ", /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "fbt-linklike",
    onClick: () => setFilter("all")
  }, "Show all")), showArchivedRedirect && /*#__PURE__*/React.createElement("p", {
    className: "fbt-empty fbt-empty--filtered"
  }, "Archived topics are in the drawer below."), !showFilteredEmpty && !showArchivedRedirect && visible.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "fbt-list"
  }, visible.map(renderThread)), archived.length > 0 && /*#__PURE__*/React.createElement("details", {
    className: "fbt-archive-drawer",
    ref: archiveRef
  }, /*#__PURE__*/React.createElement("summary", {
    className: "fbt-archive-summary"
  }, archived.length, " archived topic", archived.length === 1 ? "" : "s"), /*#__PURE__*/React.createElement("div", {
    className: "fbt-list fbt-list--archived"
  }, archived.map(renderThread))));
}

// --- entry points ----------------------------------------------------------

// Discussion under one trade. `targets` is [{kind,id}, …] — the trade key and,
// when the trade is still open, the matching position id.
function TradeFeedbackThreads({
  targets
}) {
  var payload = feedbackPayload();
  var threads = selectThreadsForContract(payload.threads, targets);
  var open = unansweredActiveCount(threads);
  var panelKey = `trade:${(targets || []).map(t => `${t.kind}:${t.id}`).join(",")}`;
  return /*#__PURE__*/React.createElement("section", {
    className: "card opt-panel fbt-panel",
    id: "trade-feedback"
  }, /*#__PURE__*/React.createElement("div", {
    className: "opt-panel-head"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "opt-panel-title"
  }, "Questions & feedback on this trade", FeedbackThreadsHelp && /*#__PURE__*/React.createElement(FeedbackThreadsHelp, {
    term: "feedback_thread"
  })), /*#__PURE__*/React.createElement("span", {
    className: "opts-provenance"
  }, userByline()), /*#__PURE__*/React.createElement("div", {
    className: "opt-panel-stats"
  }, /*#__PURE__*/React.createElement("span", {
    className: "fbt-count"
  }, threads.length, " thread", threads.length === 1 ? "" : "s"), open > 0 && /*#__PURE__*/React.createElement("span", {
    className: "fbt-count fbt-count--open"
  }, open, " awaiting reply"))), /*#__PURE__*/React.createElement(ThreadList, {
    threads: threads,
    panelKey: panelKey,
    allThreadIds: payload.threads.map(t => t.id),
    emptyText: "No one has asked about this trade yet. Use the \u{1F4AC} button at the top of the page to ask — answers appear here."
  }));
}

// System feedback — component/page-scoped notes about the SITE. Lives at the
// bottom of #options, deliberately away from any single trade.
// The funnel this whole pipeline is: submit -> triage -> route (to a PRD) ->
// reconcile -> resolved. `funnel` is computed ONCE, in Python
// (`feedback_threads.build_funnel()`, sourced from feedback_queue.json +
// triage.jsonl + routed.jsonl) and shipped as `window.FEEDBACK_THREADS.
// funnel` — this component only renders those numbers, it never recomputes
// them, so the CLI brief (`/project-status`) and this card always agree.
function FeedbackFunnel({
  funnel
}) {
  if (!funnel) return null;
  var bySev = funnel.triagedBySeverity || {};
  var triagedOpen = (bySev.low || 0) + (bySev.medium || 0) + (bySev.high || 0);
  var breaching = funnel.breachingSla || 0;
  return /*#__PURE__*/React.createElement("div", {
    className: "fbt-funnel",
    role: "group",
    "aria-label": "Feedback handling funnel"
  }, /*#__PURE__*/React.createElement("span", {
    className: "fbt-funnel-stat"
  }, /*#__PURE__*/React.createElement("b", null, funnel.open || 0), " open"), /*#__PURE__*/React.createElement("span", {
    className: "fbt-funnel-stat" + (breaching > 0 ? " fbt-funnel-stat--warn" : "")
  }, /*#__PURE__*/React.createElement("b", null, breaching), " breaching SLA"), /*#__PURE__*/React.createElement("span", {
    className: "fbt-funnel-stat" + ((bySev.high || 0) > 0 ? " fbt-funnel-stat--warn" : "")
  }, /*#__PURE__*/React.createElement("b", null, triagedOpen), " triaged", /*#__PURE__*/React.createElement("span", {
    className: "fbt-funnel-sub"
  }, " ", "(low ", bySev.low || 0, " / medium ", bySev.medium || 0, " / high ", bySev.high || 0, ")")), /*#__PURE__*/React.createElement("span", {
    className: "fbt-funnel-stat"
  }, /*#__PURE__*/React.createElement("b", null, funnel.routedToPrd || 0), " routed to a PRD"), /*#__PURE__*/React.createElement("span", {
    className: "fbt-funnel-stat"
  }, /*#__PURE__*/React.createElement("b", null, funnel.resolvedThisWeek || 0), " resolved this week"));
}
function SystemFeedbackPanel() {
  var payload = feedbackPayload();
  var threads = systemThreads(payload.threads);
  var open = unansweredActiveCount(threads);
  return /*#__PURE__*/React.createElement("section", {
    className: "card opt-panel fbt-panel",
    id: "system-feedback"
  }, /*#__PURE__*/React.createElement("div", {
    className: "opt-panel-head"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "opt-panel-title"
  }, "Feedback on the site", FeedbackThreadsHelp && /*#__PURE__*/React.createElement(FeedbackThreadsHelp, {
    term: "system_feedback"
  })), /*#__PURE__*/React.createElement("span", {
    className: "opts-provenance"
  }, userByline()), /*#__PURE__*/React.createElement("div", {
    className: "opt-panel-stats"
  }, /*#__PURE__*/React.createElement("span", {
    className: "fbt-count"
  }, threads.length, " thread", threads.length === 1 ? "" : "s"), open > 0 && /*#__PURE__*/React.createElement("span", {
    className: "fbt-count fbt-count--open"
  }, open, " awaiting reply"))), /*#__PURE__*/React.createElement("p", {
    className: "opts-page-sub fbt-lede"
  }, "Feedback filed against a card or the page itself \u2014 how the site reads, not what the fund traded. Trade-specific questions live on that trade\u2019s own page."), /*#__PURE__*/React.createElement(FeedbackFunnel, {
    funnel: payload.funnel
  }), /*#__PURE__*/React.createElement(ThreadList, {
    threads: threads,
    panelKey: "system",
    allThreadIds: payload.threads.map(t => t.id),
    emptyText: "No site feedback yet. Every card has a \u{1F4AC} button; whatever you send lands here with our answer."
  }));
}

// The discussion under ONE proposed trade, rendered inline on that proposal's
// card in Proposed Trades — not a separate panel, because the comment IS the
// instruction for that specific proposal and has to sit against it.
//
// Read-plus-reply only: there is exactly ONE control for STARTING a topic on a
// proposal, and it's the Feedback button in the card header (proposed-trades.
// jsx). This panel used to carry a second one in its footer with the identical
// target and no parentId — two buttons, same effect, so a reader had to guess
// whether the lower one meant something different. Every button inside this
// panel now sits in a thread and is a Reply.
function ProposalDiscussion({
  proposalId,
  label
}) {
  var payload = feedbackPayload();
  var threads = proposalId ? selectThreadsForContract(payload.threads, [{
    kind: "component",
    id: proposalId
  }]) : [];
  var open = unansweredActiveCount(threads);
  return /*#__PURE__*/React.createElement("div", {
    className: "prop-discussion",
    id: `discussion-${proposalId || ""}`
  }, /*#__PURE__*/React.createElement("h5", {
    className: "prop-block-title"
  }, "Discussion", userByline(), /*#__PURE__*/React.createElement("span", {
    className: "fbt-count"
  }, threads.length, " comment", threads.length === 1 ? "" : "s"), open > 0 && /*#__PURE__*/React.createElement("span", {
    className: "fbt-count fbt-count--open"
  }, open, " awaiting reply")), threads.length ? /*#__PURE__*/React.createElement(ThreadList, {
    threads: threads,
    panelKey: `proposal:${proposalId || ""}`,
    allThreadIds: payload.threads.map(t => t.id),
    emptyText: ""
  }) : /*#__PURE__*/React.createElement("p", {
    className: "fbt-empty"
  }, "No comments on this proposal yet.", " ", window.FeedbackButton ? "Use the Feedback button at the top of this card to say what should happen to it — hold it, resize it, or let it run." : ""));
}
window.TradeFeedbackThreads = TradeFeedbackThreads;
window.SystemFeedbackPanel = SystemFeedbackPanel;
window.ProposalDiscussion = ProposalDiscussion;
window.FeedbackThreadsInternals = {
  selectThreads,
  selectThreadsForContract,
  unansweredActiveCount,
  systemThreads,
  proposalThreads,
  whenLabel,
  feedbackPayload,
  ThreadMessage,
  threadMessages,
  statusOf,
  defaultCollapsed,
  readViewState,
  writeViewState,
  pruneCollapse,
  VIEW_KEY,
  VIEW_COLLAPSE_CAP,
  FILTER_KEYS,
  ModerationControls,
  useOwnerMode,
  useRouteNotDeployed,
  setOwnerMode,
  setRouteNotDeployed
};

/* ---- panels/proposed-trades.jsx ---- */
/* global React */
// Proposed Trades — the human-in-the-loop surface.
//
// Everything below is a trade the fund INTENDS to open and has not opened.
// It sits directly under Positions and above the Trade Log on #options, in
// reading order: what we hold → what we're about to do → what we already did.
//
// Data: window.SPREAD_PLAN (dashboard/data-spread-plan.js), written by
// spread_trader.export_plan(). Each `intent[]` entry carries its own proposal
// card — `explain` (the trade in five-year-old English), `checks` (the entry
// gates it cleared, with the rule each was measured against) and `rules`
// (today's fund policy, frozen at the moment it was proposed).
//
// Feedback: every proposal carries its own 💬 button, filed as
// `{kind: "component", id: "proposal-<id>"}` — the submit contract only allows
// component/position/trade/page (docs/feedback-api-contract.md), so `proposal-`
// is a reserved component-id prefix. feedback_threads.py gives those threads
// scope "proposal", which keeps them OUT of the site-feedback pool at the
// bottom of the page and renders them under this card instead. The comment is
// the instruction: a visitor says "no, the strike is too close" and that thread
// is what the next tick's operator reads before letting it fill.

var PROPOSAL_ID_PREFIX = "proposal-";

// Every card on this panel is written by the Trader (trader-tick /
// spread_trader, plus the frozen rules) — the shared byline reused from
// options-summary.jsx via window.OptionsSummaryInternals rather than a
// second implementation.
function traderByline() {
  var internals = window.OptionsSummaryInternals;
  var RB = internals && internals.RoleByline;
  var role = internals && internals.ROLE && internals.ROLE.TRADER;
  return RB ? /*#__PURE__*/React.createElement(RB, {
    role: role
  }) : null;
}
function proposalPlan() {
  var p = window.SPREAD_PLAN;
  if (!p || typeof p !== "object") return {
    generatedAt: null,
    deployment: {},
    intent: []
  };
  return {
    generatedAt: p.generatedAt || null,
    deployment: p.deployment || {},
    funnel: p.funnel || null,
    intent: Array.isArray(p.intent) ? p.intent : []
  };
}
function proposalFeedbackTarget(item) {
  return {
    kind: "component",
    id: PROPOSAL_ID_PREFIX + (item.id || "unknown"),
    label: item.label || `Proposed trade — ${item.ticker || "?"}`
  };
}

// Plan timestamps are UTC ISO; every time on this site reads in Pacific.
function whenPlanned(iso) {
  var d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Los_Angeles",
    timeZoneName: "short"
  });
}
function propMoney(n, decimals) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "—";
  return `$${Number(n).toLocaleString("en-US", {
    minimumFractionDigits: decimals || 0,
    maximumFractionDigits: decimals || 0
  })}`;
}
function propPct(n, decimals) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "—";
  return `${(Number(n) * 100).toFixed(decimals === undefined ? 0 : decimals)}%`;
}

// A proposal is missing its card when data-spread-plan.js predates the
// proposal-card export. Say so loudly rather than rendering an empty shell —
// same rule the Positions table follows for a missing identity field.
function MissingCard({
  item
}) {
  return /*#__PURE__*/React.createElement("p", {
    className: "prop-error"
  }, "This proposal has no explanation attached (no ", /*#__PURE__*/React.createElement("code", null, "explain"), " block on", " ", item.ticker || "the intent row", ") \u2014 data-spread-plan.js was written by an older spread_trader. Re-run ", /*#__PURE__*/React.createElement("code", null, "spread_trader --preopen"), " to regenerate it.");
}
function ProposalChecks({
  checks
}) {
  if (!Array.isArray(checks) || !checks.length) return null;
  return /*#__PURE__*/React.createElement("div", {
    className: "prop-block"
  }, /*#__PURE__*/React.createElement("h5", {
    className: "prop-block-title"
  }, "Why it got through the gates"), /*#__PURE__*/React.createElement("table", {
    className: "opt-table prop-checks"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", {
    className: "al"
  }, "Check"), /*#__PURE__*/React.createElement("th", {
    className: "al"
  }, "This trade"), /*#__PURE__*/React.createElement("th", {
    className: "al"
  }, "The rule"), /*#__PURE__*/React.createElement("th", {
    className: "al"
  }, "Why the rule exists"))), /*#__PURE__*/React.createElement("tbody", null, checks.map((c, i) => /*#__PURE__*/React.createElement("tr", {
    key: i,
    className: c.pass ? undefined : "prop-check-fail"
  }, /*#__PURE__*/React.createElement("td", {
    className: "al"
  }, /*#__PURE__*/React.createElement("span", {
    className: `prop-tick prop-tick--${c.pass ? "pass" : "fail"}`
  }, c.pass ? "✓" : "✕"), c.label), /*#__PURE__*/React.createElement("td", {
    className: "al prop-mono"
  }, c.observed), /*#__PURE__*/React.createElement("td", {
    className: "al prop-mono"
  }, c.rule), /*#__PURE__*/React.createElement("td", {
    className: "al prop-why"
  }, c.why))))));
}

// Today's rules, carried on the proposal itself rather than read live from
// SPREAD_CONFIG: a proposal reviewed tomorrow must show the policy it was
// generated under. The full per-leg breakdown stays in the "CREDIT_SPREAD —
// fund policy" card at the bottom of the page; this is that policy's
// decision-relevant subset, restated in plain words.
function ProposalRules({
  rules
}) {
  var [open, setOpen] = React.useState(false);
  if (!Array.isArray(rules) || !rules.length) return null;
  return /*#__PURE__*/React.createElement("div", {
    className: "prop-block"
  }, /*#__PURE__*/React.createElement("h5", {
    className: "prop-block-title"
  }, "Today\u2019s trading rules", /*#__PURE__*/React.createElement("button", {
    className: "prop-toggle",
    onClick: () => setOpen(!open)
  }, open ? "hide" : "show all")), /*#__PURE__*/React.createElement("ul", {
    className: "prop-rules"
  }, (open ? rules : rules.filter(r => String(r.plain).startsWith("EXIT"))).map((r, i) => /*#__PURE__*/React.createElement("li", {
    key: i
  }, /*#__PURE__*/React.createElement("span", {
    className: "prop-rule-plain"
  }, r.plain), /*#__PURE__*/React.createElement("span", {
    className: "prop-rule-field"
  }, r.field, " = ", /*#__PURE__*/React.createElement("b", null, r.value))))), !open && /*#__PURE__*/React.createElement("p", {
    className: "prop-rules-note"
  }, "Showing the three exit rules \u2014 the ones that decide when this trade ends. \u201CShow all\u201D adds the entry rules that let it in."));
}

// The broker reserves the FULL strike width, not the width net of the credit.
// `risk` is what we can lose; this is what is locked up until the trade closes
// — the two differ by exactly the credit, and sizing runs off this number, so
// showing only `risk` understates the capital a proposal consumes. The share
// of equity is appended when the plan carries it, because "$2,000" means
// nothing without "of what".
function collateralLabel(item, equity) {
  if (item.collateral === null || item.collateral === undefined) return "—";
  var base = propMoney(item.collateral);
  var eq = Number(equity);
  if (!eq || Number.isNaN(eq)) return base;
  return `${base} · ${propPct(item.collateral / eq, 1)} of equity`;
}

// The SCORECARD — the right-hand column of every proposal card.
//
// The KPIs used to sit as a thin strip under the narrative while the right
// half of the card was empty. They are the numbers a reviewer decides on, so
// they get their own column: money first (paid / at risk / locked up), then
// the odds, then the contract facts, then the verdict from the entry gates.
// One tile per fact, aligned, so three proposals can be compared by eye
// straight down the column.
function ScoreRow({
  label,
  value,
  term,
  tone,
  big
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: `prop-score-row${big ? " prop-score-row--big" : ""}`
  }, /*#__PURE__*/React.createElement("span", {
    className: "prop-score-label"
  }, label, term && window.Help && /*#__PURE__*/React.createElement(window.Help, {
    term: term
  })), /*#__PURE__*/React.createElement("span", {
    className: `prop-score-value${tone ? ` prop-score-value--${tone}` : ""}`
  }, value));
}

// A proposal only reaches this panel by clearing every gate, so the badge
// normally reads "8 of 8". It is computed, not assumed: a hand-edited plan or
// a future soft gate must show the real count rather than a green lie.
function gateTally(checks) {
  var list = Array.isArray(checks) ? checks : [];
  return {
    passed: list.filter(c => c && c.pass).length,
    total: list.length
  };
}
function momentumChip(item) {
  if (item.rsi === null || item.rsi === undefined) return null;
  var isPut = String(item.right || "").toLowerCase() === "put";
  return `${isPut ? "Oversold" : "Overbought"} · RSI ${item.rsi} · %K ${item.stoch_k}`;
}
function ProposalScorecard({
  item,
  equity
}) {
  var tally = gateTally(item.checks);
  var clean = tally.total > 0 && tally.passed === tally.total;
  var chip = momentumChip(item);
  var pop = Number(item.pop);
  return /*#__PURE__*/React.createElement("aside", {
    className: "prop-scorecard"
  }, /*#__PURE__*/React.createElement("div", {
    className: "prop-score-head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "prop-score-title"
  }, "Scorecard"), /*#__PURE__*/React.createElement("span", {
    className: `prop-score-gates prop-score-gates--${clean ? "pass" : "fail"}`
  }, clean ? "✓" : "✕", " ", tally.passed, " of ", tally.total, " gates")), /*#__PURE__*/React.createElement(ScoreRow, {
    label: "We get paid",
    value: propMoney(item.credit),
    term: "credit_received",
    tone: "pos",
    big: true
  }), /*#__PURE__*/React.createElement(ScoreRow, {
    label: "Most we can lose",
    value: propMoney(item.risk),
    term: "risk",
    tone: "neg",
    big: true
  }), /*#__PURE__*/React.createElement(ScoreRow, {
    label: "Cash tied up (collateral)",
    value: collateralLabel(item, equity),
    term: "collateral"
  }), /*#__PURE__*/React.createElement(ScoreRow, {
    label: "Expected value",
    value: propMoney(item.ev),
    term: "ev",
    tone: Number(item.ev) > 0 ? "pos" : "neg"
  }), /*#__PURE__*/React.createElement(ScoreRow, {
    label: "Chance we're right",
    value: propPct(item.pop),
    term: "pop"
  }), Number.isFinite(pop) && /*#__PURE__*/React.createElement("div", {
    className: "prop-meter",
    title: `${(pop * 100).toFixed(1)}% probability of profit`
  }, /*#__PURE__*/React.createElement("span", {
    className: "prop-meter-fill",
    style: {
      width: `${Math.max(0, Math.min(100, pop * 100))}%`
    }
  })), /*#__PURE__*/React.createElement(ScoreRow, {
    label: "Contracts",
    value: item.contracts,
    term: "contracts"
  }), /*#__PURE__*/React.createElement(ScoreRow, {
    label: "Expires",
    value: `${item.expiry} (${item.dte}d)`,
    term: "dte"
  }), chip && /*#__PURE__*/React.createElement("div", {
    className: "prop-score-chip"
  }, chip));
}
function ProposalCard({
  item,
  equity
}) {
  var explain = item.explain;
  var target = proposalFeedbackTarget(item);
  return /*#__PURE__*/React.createElement("article", {
    className: "prop-card",
    id: `proposal-${item.id || ""}`
  }, /*#__PURE__*/React.createElement("header", {
    className: "prop-card-head"
  }, /*#__PURE__*/React.createElement("h4", {
    className: "prop-card-title"
  }, item.label || item.ticker), /*#__PURE__*/React.createElement("span", {
    className: "opts-provenance"
  }, traderByline()), /*#__PURE__*/React.createElement("div", {
    className: "prop-card-head-right"
  }, /*#__PURE__*/React.createElement("span", {
    className: "prop-badge"
  }, "PROPOSED \xB7 not yet placed"), window.FeedbackButton && /*#__PURE__*/React.createElement(window.FeedbackButton, {
    target: target
  }))), /*#__PURE__*/React.createElement("div", {
    className: "prop-card-body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "prop-narrative"
  }, explain ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("p", {
    className: "prop-headline"
  }, explain.headline), /*#__PURE__*/React.createElement("ul", {
    className: "prop-bullets"
  }, (explain.bullets || []).map((b, i) => /*#__PURE__*/React.createElement("li", {
    key: i
  }, b))), /*#__PURE__*/React.createElement("p", {
    className: "prop-structure"
  }, /*#__PURE__*/React.createElement("b", null, "What we actually place:"), " ", explain.structure)) : /*#__PURE__*/React.createElement(MissingCard, {
    item: item
  })), /*#__PURE__*/React.createElement(ProposalScorecard, {
    item: item,
    equity: equity
  })), /*#__PURE__*/React.createElement(ProposalChecks, {
    checks: item.checks
  }), /*#__PURE__*/React.createElement(ProposalRules, {
    rules: item.rules
  }), window.ProposalDiscussion && /*#__PURE__*/React.createElement(window.ProposalDiscussion, {
    proposalId: target.id,
    label: target.label
  }));
}

// The deployment gap used to live in the "Open queue" card. It moves here with
// the proposals it explains: how much room the book has is the reason there
// are (or aren't) proposals on screen at all.
// "Deployed $4,823 of target $31,770" invites two wrong readings: that the
// figures are cash (they are collateral committed — open spread max-loss plus
// long equity market value), and that the target is the CONFIGURED
// target_invested_pct (it is that percentage capped by the beta gate, which
// floors deployment at 30% until beta is measured on >= 20 closed positions).
// Neither is derivable from the numbers on screen, so the basis is stated.
function deploymentBasis(d) {
  var eq = Number(d.equity);
  var gate = d.beta_gate || {};
  var cap = Number(gate.cap);
  var configured = Number(d.target_pct);
  var gated = Number.isFinite(cap) && Number.isFinite(configured) && cap < configured;
  var parts = [];
  parts.push(`Deployed = collateral committed (open spread max-loss + long equity), not cash` + (Number.isFinite(eq) ? `; measured against equity ${propMoney(eq)}, not buying power` : ""));
  if (Number.isFinite(cap)) {
    parts.push(gated ? `target = ${propPct(cap)} of equity — the beta-gate floor, held below the configured ${propPct(configured)}` + (gate.reason ? ` (${gate.reason})` : "") : `target = ${propPct(cap)} of equity`);
  }
  return parts.join(" · ");
}
function DeploymentLine({
  deployment,
  totalCollateral
}) {
  var d = deployment || {};
  if (d.deployed === undefined && d.headroom === undefined && !totalCollateral) return null;
  return /*#__PURE__*/React.createElement("div", {
    className: "prop-deployment"
  }, /*#__PURE__*/React.createElement("span", null, "Deployed ", propMoney(d.deployed), " of target ", propMoney(d.target), " (", propPct(d.deployed_pct), " of equity) \u2014 headroom ", propMoney(d.headroom)), /*#__PURE__*/React.createElement("span", {
    className: "prop-deployment-note"
  }, deploymentBasis(d)), totalCollateral > 0 && /*#__PURE__*/React.createElement("span", null, "These proposals would together tie up ", propMoney(totalCollateral), " of collateral", d.equity ? ` (${propPct(totalCollateral / d.equity, 1)} of equity)` : "", " \u2014 that cash is reserved by the broker until each trade closes, and it is returned in full when they do."), d.margin_breach && /*#__PURE__*/React.createElement("span", {
    className: "prop-margin-breach"
  }, "\uD83D\uDD34 MARGIN BREACH \u2014 maintenance margin ", propMoney(d.maintenance_margin), " exceeds cap", " ", propMoney(d.margin_cap), ". New entries are refused until it clears, so nothing below can fill."));
}

// "Nothing to review" is only believable with the count of what was looked
// at. Without the funnel, a barren option chain and a broken scanner render
// identically — which is what an empty panel meant before this.
function EmptyState({
  funnel
}) {
  if (!funnel) {
    return /*#__PURE__*/React.createElement("p", {
      className: "opt-log-empty"
    }, "No proposals right now. Either no candidate cleared the entry gates, or the book is already at its deployment target \u2014 the line above says which.");
  }
  // The screen stage (options_chain.select_spreads) drops on win probability,
  // expected value, DTE and the risk-per-position band all at once, and it is
  // where most of the board dies — 49 priced down to 1 on 2026-08-13. Listing
  // `priced` and then `selected` with nothing between them left 98% of the
  // funnel unaccounted for on screen, which is the same "where did they all
  // go?" this panel exists to answer. Derived here rather than added to the
  // exported funnel so an already-published plan renders it too.
  var num = v => typeof v === "number" ? v : null;
  var screened = num(funnel.priced) !== null && num(funnel.selected) !== null ? funnel.priced - funnel.selected : null;
  var rows = [["Names scanned", funnel.tickers], ["Spreads the chain priced", funnel.priced], ["Dropped — negative expected value, too few days, or wrong size", screened], ["Cleared that screen", funnel.selected], ["Dropped — no positive net credit at all", funnel.rejected_non_positive_credit], ["Dropped — expected value or credit too small", funnel.rejected_ev_or_credit], ["Dropped — win probability outside the band", funnel.rejected_pop_band], [funnel.momentum_gate ? "Dropped — wrong side for the stock's momentum" : "Momentum gate OFF this run", funnel.momentum_gate ? funnel.rejected_momentum : "—"], ["Proposed", funnel.passed]].filter(([, v]) => v !== null && v !== undefined);
  // EV > 0 is exactly "credit > breakeven credit", i.e. ratio > 1.00. Showing
  // the best ratio on the board turns "0 proposed" from a shrug into a
  // measurement: 0.81 means the market paid 81% of fair value at its most
  // generous, and no gate tuning short of accepting negative expectancy
  // changes that.
  var best = funnel.best_credit_ratio;
  var need = funnel.credit_ratio_required;
  return /*#__PURE__*/React.createElement("div", {
    className: "prop-empty"
  }, /*#__PURE__*/React.createElement("p", {
    className: "opt-log-empty"
  }, "No proposals right now \u2014 and that is a measurement, not a blank screen. Here is the whole funnel behind it:"), /*#__PURE__*/React.createElement("ul", {
    className: "prop-funnel"
  }, rows.map(([label, value], i) => /*#__PURE__*/React.createElement("li", {
    key: i
  }, /*#__PURE__*/React.createElement("span", null, label), /*#__PURE__*/React.createElement("b", null, value === undefined || value === null ? "—" : value)))), best !== null && best !== undefined && /*#__PURE__*/React.createElement("p", {
    className: `prop-funnel-verdict${best < 1 ? " prop-funnel-verdict--short" : ""}`
  }, "Best credit on the board: ", /*#__PURE__*/React.createElement("b", null, Number(best).toFixed(2), "\xD7"), " fair value", need ? /*#__PURE__*/React.createElement(React.Fragment, null, " \xB7 policy needs ", /*#__PURE__*/React.createElement("b", null, Number(need).toFixed(2), "\xD7")) : null, ".", best < 1 ? " Below 1.00× the market is paying less than the trade is worth — every candidate has negative expected value, so nothing can pass without knowingly trading at a loss." : " At or above 1.00× the market is paying fair value or better."), funnel.chain_errors > 0 && /*#__PURE__*/React.createElement("p", {
    className: "prop-funnel-note"
  }, "\u26A0 ", funnel.chain_errors, " name", funnel.chain_errors === 1 ? "" : "s", " could not be priced at all (chain error) \u2014 those were never evaluated."));
}

// One proposal at a time, with a pager. Reviewing is a per-trade decision —
// stacking seven full cards buries the later ones and makes "how many are
// there, and which am I on?" unanswerable without scrolling. The dot rail is
// the position indicator: ‹ o o ● o o ›, one dot per proposal, the filled one
// is the open card. A dot for a proposal carrying an unanswered comment gets a
// ring, so an unread objection is visible from any card, not only from its own.
function unansweredCountFor(item) {
  var internals = window.FeedbackThreadsInternals;
  var payload = window.FEEDBACK_THREADS;
  if (!internals || !internals.proposalThreads || !payload || !Array.isArray(payload.threads)) {
    return 0;
  }
  var threads = internals.proposalThreads(payload.threads, PROPOSAL_ID_PREFIX + (item.id || ""));
  return threads.filter(t => !t.answered).length;
}
function ProposalPager({
  items,
  index,
  onGo
}) {
  if (items.length < 2) return null;
  var wrap = i => (i + items.length) % items.length;
  return /*#__PURE__*/React.createElement("nav", {
    className: "prop-pager",
    "aria-label": "Proposed trade navigation"
  }, /*#__PURE__*/React.createElement("button", {
    className: "prop-pager-arrow",
    onClick: () => onGo(wrap(index - 1)),
    "aria-label": "Previous proposal",
    title: "Previous proposal (\u2190)"
  }, "\u2039"), /*#__PURE__*/React.createElement("div", {
    className: "prop-dots"
  }, items.map((it, i) => {
    var open = unansweredCountFor(it);
    var label = `${it.ticker || "proposal"} — ${i + 1} of ${items.length}` + (open ? ` (${open} unanswered comment${open === 1 ? "" : "s"})` : "");
    return /*#__PURE__*/React.createElement("button", {
      key: it.id || i,
      className: `prop-dot${i === index ? " prop-dot--on" : ""}${open ? " prop-dot--flagged" : ""}`,
      onClick: () => onGo(i),
      "aria-label": label,
      "aria-current": i === index ? "true" : undefined,
      title: label
    });
  })), /*#__PURE__*/React.createElement("button", {
    className: "prop-pager-arrow",
    onClick: () => onGo(wrap(index + 1)),
    "aria-label": "Next proposal",
    title: "Next proposal (\u2192)"
  }, "\u203A"), /*#__PURE__*/React.createElement("span", {
    className: "prop-pager-count"
  }, index + 1, " of ", items.length, items[index] && items[index].ticker ? ` · ${items[index].ticker}` : ""));
}
function ProposedTrades() {
  var plan = proposalPlan();
  var items = plan.intent;
  var [index, setIndex] = React.useState(0);
  // A regenerated plan can be shorter than the one that was on screen; clamp
  // rather than render a blank card off the end of the list.
  var safeIndex = items.length ? Math.min(index, items.length - 1) : 0;
  var active = items[safeIndex];
  var onKeyDown = e => {
    if (items.length < 2) return;
    if (e.key === "ArrowLeft") {
      setIndex((safeIndex - 1 + items.length) % items.length);
      e.preventDefault();
    }
    if (e.key === "ArrowRight") {
      setIndex((safeIndex + 1) % items.length);
      e.preventDefault();
    }
  };
  return /*#__PURE__*/React.createElement("section", {
    className: "card opt-panel prop-panel",
    id: "proposed-trades"
  }, /*#__PURE__*/React.createElement("div", {
    className: "opt-panel-head"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "opt-panel-title"
  }, "Proposed trades", window.Help && /*#__PURE__*/React.createElement(window.Help, {
    term: "proposed_trade"
  }), window.FeedbackButton && /*#__PURE__*/React.createElement(window.FeedbackButton, {
    target: {
      kind: "component",
      id: "proposed-trades",
      label: "Proposed trades"
    }
  })), /*#__PURE__*/React.createElement("span", {
    className: "opts-provenance"
  }, traderByline()), /*#__PURE__*/React.createElement("div", {
    className: "opt-panel-stats"
  }, /*#__PURE__*/React.createElement("span", {
    className: "fbt-count"
  }, items.length, " proposal", items.length === 1 ? "" : "s"), plan.generatedAt && /*#__PURE__*/React.createElement("span", {
    className: "fbt-count",
    title: plan.generatedAt
  }, "planned ", whenPlanned(plan.generatedAt)))), /*#__PURE__*/React.createElement("p", {
    className: "opts-page-sub prop-lede"
  }, "Nothing here has been placed. These are the trades the fund intends to open on the next tick, each explained from scratch, with the rules it had to clear. Disagree with one? Use its \uD83D\uDCAC button \u2014 the comment thread under a proposal is how you tell the fund what to do with it, and it is read before anything fills."), /*#__PURE__*/React.createElement(DeploymentLine, {
    deployment: plan.deployment,
    totalCollateral: items.reduce((sum, it) => sum + (Number(it.collateral) || 0), 0)
  }), items.length ? /*#__PURE__*/React.createElement("div", {
    className: "prop-deck",
    tabIndex: 0,
    onKeyDown: onKeyDown,
    "aria-live": "polite"
  }, /*#__PURE__*/React.createElement(ProposalPager, {
    items: items,
    index: safeIndex,
    onGo: setIndex
  }), /*#__PURE__*/React.createElement(ProposalCard, {
    key: active.id || safeIndex,
    item: active,
    equity: plan.deployment && plan.deployment.equity
  }), /*#__PURE__*/React.createElement(ProposalPager, {
    items: items,
    index: safeIndex,
    onGo: setIndex
  })) : /*#__PURE__*/React.createElement(EmptyState, {
    funnel: plan.funnel
  }));
}
window.ProposedTrades = ProposedTrades;
window.ProposedTradesInternals = {
  PROPOSAL_ID_PREFIX,
  gateTally,
  unansweredCountFor,
  momentumChip,
  collateralLabel,
  proposalPlan,
  proposalFeedbackTarget,
  propMoney,
  propPct
};

/* ---- pages/option-trade-detail.jsx ---- */
/* global React */
// Stand-alone, full-width page for one Options Trade Log entry — a narrative
// explanation of a single spread trade, not a jargon dump. Answers three
// questions in plain English before showing any raw numbers: what did we do,
// what had to happen to win, and what actually happened. All math/parsing is
// reused from window.SpreadFormat + window.OptionsTradeLogInternals — this
// file only turns those facts into sentences and layout.

var {
  useState,
  useEffect
} = React;
var {
  money,
  pctv,
  num,
  parseOccSymbol,
  plainEnglishLeg
} = window.SpreadFormat;
var Help = window.Help;

// #trade/<key> is the only shape this page reads — the key itself is opaque
// (see tradeKey in options-trade-log.jsx), so this just decodes the segment
// after the slash.
function tradeKeyFromUrl() {
  var fromHash = (location.hash || "").replace("#", "").split("/")[1];
  return fromHash ? decodeURIComponent(fromHash) : "";
}

// Called right after `location.hash = "options"` — the Options Log page
// mounts asynchronously (React re-render off the hashchange event), so this
// retries a few times rather than assuming the element exists on the next tick.
function scrollToTradeLog(attempts) {
  var el = document.getElementById("options-trade-log");
  if (el) {
    el.scrollIntoView({
      behavior: "auto",
      block: "start"
    });
    return;
  }
  if (attempts > 0) setTimeout(() => scrollToTradeLog(attempts - 1), 30);
}
function BackToTradeLog() {
  var goBack = () => {
    location.hash = "options";
    scrollToTradeLog(10);
  };
  return /*#__PURE__*/React.createElement("button", {
    onClick: goBack,
    className: "optd-back",
    style: {
      background: "var(--surface-2)",
      border: "1px solid var(--line)",
      borderRadius: 6,
      padding: "7px 14px",
      color: "var(--text)",
      fontSize: 12,
      fontWeight: 600,
      cursor: "pointer"
    }
  }, "\u2190 Back to trade log");
}

// Same target shape/id as the row this page was opened from (options-trade-log.jsx's
// tradeKey), so a visitor's feedback from the row and from the detail page join to
// the same trade regardless of which surface they used.
function TradeDetailFeedbackButton({
  ev,
  facts,
  tradeKeyValue
}) {
  if (!window.FeedbackButton || !tradeKeyValue) return null;
  var structureName = facts.structure ? facts.structure.name : "credit spread";
  var target = {
    kind: "trade",
    id: tradeKeyValue,
    label: `${ev.ticker || "this ticker"} ${structureName}`
  };
  return /*#__PURE__*/React.createElement(window.FeedbackButton, {
    target: target
  });
}

// Which feedback targets this page owns: the trade key itself, plus the id
// the Options Log's Positions table files position feedback under — reused
// from its one definition (positionFeedbackTarget on OptionsSummaryInternals),
// never re-derived here, so a question asked from the positions table and one
// asked from this page land in the same discussion.
//
// While the trade is still open that id comes straight off the live position
// row. Once it's closed there's no live row left to read it from, but the
// SAME contract still has that identity — so it's rebuilt from the trade
// record's own OCC symbols/expiry (`facts.shortParsed`/`longParsed`, already
// parsed once by `tradeFacts` and never re-parsed here) through the exact
// same `positionFeedbackTarget` builder. That's what lets a question asked
// while the position was open keep showing here after the trade closes,
// rather than going stranded the moment the live row disappears — the
// contract-continuity merge (`FeedbackThreadsInternals.selectThreadsForContract`)
// needs at least one of these legacy identities to seed the search from.
function feedbackTargets(tradeKeyValue, pos, ev, facts) {
  var targets = [];
  if (tradeKeyValue) targets.push({
    kind: "trade",
    id: tradeKeyValue
  });
  var summaryInternals = window.OptionsSummaryInternals;
  var buildTarget = summaryInternals && summaryInternals.positionFeedbackTarget;
  var posTarget = pos && buildTarget ? buildTarget(pos) : null;
  if (!posTarget && buildTarget && ev && facts && facts.shortParsed && facts.longParsed) {
    posTarget = buildTarget({
      underlying: ev.ticker,
      right: facts.shortParsed.right,
      short_strike: facts.shortParsed.strike,
      long_strike: facts.longParsed.strike,
      expiry: facts.shortParsed.expiry
    });
  }
  if (posTarget) targets.push({
    kind: "position",
    id: posTarget.id
  });
  return targets;
}
var BADGE_CLASS = {
  filled: "fill-filled",
  terminal: "terminal",
  partial: "fill-partial",
  unfilled: "fill-unfilled"
};

// --- plain-English helpers -------------------------------------------------

// "2026-08-10" or an ISO timestamp -> "10 Aug". Display-only; never fed back
// into any calculation, so this stays local rather than living in SpreadFormat.
function shortDate(isoLike) {
  if (!isoLike) return null;
  var d = new Date(String(isoLike).slice(0, 10) + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC"
  });
}

// "short_strike_breached" -> "Short strike breached"; leaves already-readable
// sentences (the common case today) untouched.
function reasonPhrase(reason) {
  if (!reason) return null;
  var cleaned = String(reason).replace(/_/g, " ");
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

// The frozen expiry, wherever it's recorded — the top-level field on newer
// records, or decoded from the short leg's OCC symbol on older ones.
function expiryOf(ev, facts) {
  return ev.expiry || (facts.shortParsed ? facts.shortParsed.expiry : null);
}

// "T" -> " " in a stored ISO timestamp, for display only.
function tsPretty(ts) {
  return ts ? String(ts).replace("T", " ") : null;
}

// Which side of the short strike is the profit zone: a call credit spread
// pays off if the underlying stays *below* the short strike, a put credit
// spread if it stays *above* it. One place for this so the breakeven
// caption and the payoff strip can't drift out of sync with each other.
function profitDirection(shortParsed) {
  return shortParsed && shortParsed.right === "CALL" ? "below" : "above";
}

// One sentence built from spreadStructure().name/.gloss, the short strike,
// expiry, and credit — the only jargon-free summary of "what is this trade".
// Falls back to a generic sentence when the structure can't be classified
// (missing/unrecognised legs) so the page never renders blank up top.
function headlineSentence(ev, facts) {
  var {
    structure,
    shortParsed,
    classification
  } = facts;
  var ticker = ev.ticker || "this ticker";
  var dateStr = shortDate(ev.ts) || "an earlier date";
  if (!structure) {
    return `On ${dateStr} we opened an options trade on ${ticker}.`;
  }
  var name = structure.name.charAt(0).toLowerCase() + structure.name.slice(1);
  var expiryStr = shortDate(expiryOf(ev, facts));
  // Composed from the parsed fields directly, not by string-surgering
  // structure.gloss's pre-baked sentence — a wording/date-format change in
  // spreadStructure() would otherwise silently break this substitution.
  var conditionClause = null;
  if (structure.gloss && shortParsed) {
    var verbPhrase = profitDirection(shortParsed) === "below" ? "stays below" : "stays above";
    conditionClause = `as long as ${ticker} ${verbPhrase} $${shortParsed.strike}${expiryStr ? ` through ${expiryStr}` : ""}`;
  }
  var creditVal = ev.credit ?? ev.entry_credit;
  var creditStr = creditVal != null ? money(creditVal) : null;
  var unfilled = classification.bucket !== "trade";
  // A credit spread is SUBMITTED for a net credit, but the broker fill can
  // still land as a net debit (bad/stale quote on one leg at execution —
  // see docs/findings/2026-08-07-options-book-anomalies.md and the
  // `build_spread_order` limit-price fix that now floors every new order at
  // its scored credit). Saying "it pays us -$84" reads as a typo, not a
  // fill outcome, so a net-debit fill gets its own honest sentence instead.
  var isNetDebit = creditVal != null && creditVal < 0;
  var sentence = `On ${dateStr} we sold a ${name} on ${ticker}.`;
  if (isNetDebit) {
    sentence += ` It was meant to collect a credit, but filled at a net debit of ${money(Math.abs(creditVal))} instead`;
    if (conditionClause) sentence += `; even ${conditionClause}, the most this can do is return to $0`;
    sentence += ".";
  } else if (creditStr) {
    sentence += unfilled ? ` It would pay us ${creditStr} if it fills` : ` It pays us ${creditStr}`;
    if (conditionClause) sentence += ` ${conditionClause}`;
    sentence += ".";
  } else if (conditionClause) {
    sentence += ` It ${conditionClause}.`;
  }
  return sentence;
}

// The one-line outcome banner: closed (win/loss in words), still open, or
// never filled — never implies a result an unfilled order doesn't have.
function outcomeBanner(ev, facts) {
  var {
    isClose,
    pnl,
    classification
  } = facts;
  if (classification.bucket !== "trade") {
    return {
      tone: "neutral",
      text: `Not filled — ${classification.label}. No money has changed hands.`
    };
  }
  if (isClose) {
    if (pnl == null) return {
      tone: "neutral",
      text: "Closed — result not yet reported."
    };
    var expiry = expiryOf(ev, facts);
    var closeDate = ev.ts ? new Date(ev.ts) : null;
    var expiryDate = expiry ? new Date(expiry + "T00:00:00Z") : null;
    var early = closeDate && expiryDate && !Number.isNaN(closeDate.getTime()) && !Number.isNaN(expiryDate.getTime()) && closeDate < expiryDate;
    var verb = pnl >= 0 ? "gain" : "loss";
    return {
      tone: pnl >= 0 ? "pos" : "neg",
      text: `Closed ${early ? "early " : ""}for a ${money(Math.abs(pnl))} ${verb}.`
    };
  }
  return {
    tone: "neutral",
    text: "Still open — the result isn't decided yet."
  };
}
function breakevenCaption(facts) {
  if (facts.isNetDebit) return "This spread filled at a net debit — it cannot win at any price, so there is no breakeven.";
  if (facts.be == null || !facts.shortParsed) return "Not enough data to compute a breakeven.";
  var dir = profitDirection(facts.shortParsed) === "below" ? "above" : "below";
  return `Breakeven ${money(facts.be)} — ${dir} this price we start losing money.`;
}

// --- Current price (header + payoff bar) -------------------------------------

// This trade's own row in window.OPTIONS_SUMMARY.record.positions[] — reuses
// the exact matcher the Options Summary panel already trusts
// (window.OptionsSummaryInternals.eventMatchesPosition, options-summary.jsx)
// rather than writing a third one, and additionally checks the long strike so
// two open spreads that happen to share a short leg don't collide. A closed
// or unfilled trade has no "now" — never asked to match one.
function matchedPosition(ev, facts) {
  if (facts.isClose || facts.classification.bucket !== "trade" || !ev.short) return null;
  var summary = window.OPTIONS_SUMMARY;
  var internals = window.OptionsSummaryInternals;
  var positions = summary && summary.record && summary.record.positions;
  if (!Array.isArray(positions) || !positions.length || !internals) return null;
  var longParsed = ev.long ? parseOccSymbol(ev.long) : null;
  var candidates = positions.filter(pos => {
    if (!internals.eventMatchesPosition(pos, ev)) return false;
    if (longParsed && pos.long_strike != null && Number(pos.long_strike) !== Number(longParsed.strike)) return false;
    return true;
  });
  return candidates.length === 1 ? candidates[0] : null;
}

// Header price element: the live spot from the matched position when one
// exists, else the frozen entry spot labelled as such, else nothing — never
// a `$null`/`$NaN` and never a stale live price passed off as current.
function CurrentPrice({
  ev,
  facts,
  pos
}) {
  var internals = window.OptionsSummaryInternals;
  var livePrice = pos ? num(pos.now && pos.now.spot) : null;
  if (livePrice == null) {
    var entrySpot = num(ev.spot_at_entry);
    return entrySpot != null ? /*#__PURE__*/React.createElement("span", {
      className: "optd-price mono-dim"
    }, "Spot at entry ", money(entrySpot)) : null;
  }
  var summary = window.OPTIONS_SUMMARY;
  var asOfIso = pos.oldest_quote_ts || summary && summary.generatedAt;
  var ageStr = internals && asOfIso ? internals.ageLabel(asOfIso) : null;
  var stale = !!(internals && asOfIso && internals.isStaleAsOf(asOfIso, summary && summary.schedule));
  return /*#__PURE__*/React.createElement("span", {
    className: "optd-price"
  }, money(livePrice), /*#__PURE__*/React.createElement(Help, {
    term: "spot",
    inputs: {
      spot: livePrice
    },
    asOf: {
      quotes: asOfIso
    }
  }), ageStr && /*#__PURE__*/React.createElement("span", {
    className: stale ? "opts-stale-banner optd-price-asof" : "optd-price-asof mono-dim"
  }, stale ? "⚠ stale — " : "as of ", ageStr));
}

// --- "What we did" ----------------------------------------------------------

function LegRow({
  ev,
  symbol,
  isClose,
  roleText
}) {
  var dir = window.OptionsTradeLogInternals.legDirection(ev, symbol, isClose);
  if (!symbol) {
    return /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("p", {
      className: "optd-leg-sentence"
    }, "Leg details aren\u2019t available for this record."));
  }
  var parsed = parseOccSymbol(symbol);
  var sentence;
  if (!parsed) {
    sentence = `${dir || "Traded"} ${plainEnglishLeg(symbol)} — ${roleText}`;
  } else {
    var verb = dir && dir.indexOf("BUY") === 0 ? "Bought" : dir && dir.indexOf("SELL") === 0 ? "Sold" : "Traded";
    var contracts = ev.contracts != null ? ev.contracts : null;
    var qtyPhrase = contracts != null ? `${contracts} contracts of the` : "the";
    var expiryStr = shortDate(parsed.expiry);
    sentence = `${verb} ${qtyPhrase} ${parsed.root} $${parsed.strike} ${parsed.right.toLowerCase()}` + `${expiryStr ? ` expiring ${expiryStr}` : ""} — ${roleText}`;
  }
  return /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("p", {
    className: "optd-leg-sentence"
  }, sentence), /*#__PURE__*/React.createElement("div", {
    className: "mono-dim optd-occ"
  }, symbol));
}

// Both legs' roles are fixed for a credit spread (short = premium, long =
// insurance) but the sentence has to match the direction actually traded:
// "collects the premium" is only true while the position is open — on a
// close we're buying that leg back, not collecting anything.
function WhatWeDid({
  ev,
  facts
}) {
  var hasLegs = !!(ev.short || ev.long);
  var shortRole = facts.isClose ? "the leg that had been collecting the premium, now bought back to close" : "this is the leg that collects the premium";
  var longRole = facts.isClose ? "the insurance leg, now sold since the position is closing" : "the insurance leg that caps our loss";
  return /*#__PURE__*/React.createElement("section", {
    className: "card opt-panel optd-section"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "optd-h2"
  }, "What we did"), /*#__PURE__*/React.createElement("p", {
    className: "optd-explainer"
  }, "A credit spread sells one option to collect cash up front, then buys a further-out option purely as insurance so the most we can lose is capped."), hasLegs ? /*#__PURE__*/React.createElement("ul", {
    className: "optd-leg-list"
  }, /*#__PURE__*/React.createElement(LegRow, {
    ev: ev,
    symbol: ev.short,
    isClose: facts.isClose,
    roleText: shortRole
  }), /*#__PURE__*/React.createElement(LegRow, {
    ev: ev,
    symbol: ev.long,
    isClose: facts.isClose,
    roleText: longRole
  })) : /*#__PURE__*/React.createElement("p", {
    className: "opt-legs-empty"
  }, "this record predates leg snapshots"));
}

// --- "What had to happen for this to win" -----------------------------------

function payoffAnchors(facts, ev, livePrice) {
  var short = facts.shortParsed;
  if (!short || facts.be == null) return null;
  var long = facts.longParsed;
  var spot = num(ev.spot_at_entry);
  var values = [short.strike, facts.be];
  if (long) values.push(long.strike);
  if (spot != null) values.push(spot);
  if (livePrice != null) values.push(livePrice);
  var lo = Math.min(...values);
  var hi = Math.max(...values);
  if (!(hi > lo)) return null;
  var pad = (hi - lo) * 0.2;
  var min = lo - pad;
  var max = hi + pad;
  var pct = v => (v - min) / (max - min) * 100;
  return {
    shortPct: pct(short.strike),
    longPct: long ? pct(long.strike) : null,
    bePct: pct(facts.be),
    spotPct: spot != null ? pct(spot) : null,
    nowPct: livePrice != null ? pct(livePrice) : null,
    profitSide: profitDirection(short) === "below" ? "left" : "right"
  };
}
function PayoffStrip({
  facts,
  ev,
  livePrice
}) {
  var a = payoffAnchors(facts, ev, livePrice);
  if (!a) {
    return /*#__PURE__*/React.createElement("p", {
      className: "optd-payoff-empty"
    }, "Not enough data to draw the payoff strip.");
  }
  var profitLeft = a.profitSide === "left";
  return /*#__PURE__*/React.createElement("div", {
    className: "optd-payoff"
  }, /*#__PURE__*/React.createElement("div", {
    className: "optd-payoff-track"
  }, /*#__PURE__*/React.createElement("div", {
    className: "optd-payoff-zone optd-payoff-zone--profit",
    style: {
      left: profitLeft ? "0%" : `${a.bePct}%`,
      width: `${profitLeft ? a.bePct : 100 - a.bePct}%`
    }
  }), /*#__PURE__*/React.createElement("div", {
    className: "optd-payoff-zone optd-payoff-zone--loss",
    style: {
      left: profitLeft ? `${a.bePct}%` : "0%",
      width: `${profitLeft ? 100 - a.bePct : a.bePct}%`
    }
  }), /*#__PURE__*/React.createElement("div", {
    className: "optd-payoff-marker",
    style: {
      left: `${a.shortPct}%`
    },
    title: `Short strike $${facts.shortParsed.strike}`
  }, /*#__PURE__*/React.createElement("span", {
    className: "optd-payoff-dot"
  }), /*#__PURE__*/React.createElement("span", {
    className: "optd-payoff-tag"
  }, "$", facts.shortParsed.strike)), a.longPct != null && /*#__PURE__*/React.createElement("div", {
    className: "optd-payoff-marker",
    style: {
      left: `${a.longPct}%`
    },
    title: `Long strike $${facts.longParsed.strike}`
  }, /*#__PURE__*/React.createElement("span", {
    className: "optd-payoff-dot"
  }), /*#__PURE__*/React.createElement("span", {
    className: "optd-payoff-tag"
  }, "$", facts.longParsed.strike)), /*#__PURE__*/React.createElement("div", {
    className: "optd-payoff-marker optd-payoff-marker--be",
    style: {
      left: `${a.bePct}%`
    },
    title: `Breakeven ${money(facts.be)}`
  }, /*#__PURE__*/React.createElement("span", {
    className: "optd-payoff-dot"
  }), /*#__PURE__*/React.createElement("span", {
    className: "optd-payoff-tag"
  }, "BE ", money(facts.be))), a.spotPct != null && /*#__PURE__*/React.createElement("div", {
    className: "optd-payoff-marker optd-payoff-marker--spot",
    style: {
      left: `${a.spotPct}%`
    },
    title: `Spot at entry ${money(ev.spot_at_entry)}`
  }, /*#__PURE__*/React.createElement("span", {
    className: "optd-payoff-dot"
  }), /*#__PURE__*/React.createElement("span", {
    className: "optd-payoff-tag"
  }, "Spot at entry ", money(ev.spot_at_entry))), a.nowPct != null && /*#__PURE__*/React.createElement("div", {
    className: "optd-payoff-marker optd-payoff-marker--now",
    style: {
      left: `${a.nowPct}%`
    },
    title: `Stock trading at ${money(livePrice)} now`
  }, /*#__PURE__*/React.createElement("span", {
    className: "optd-payoff-dot"
  }), /*#__PURE__*/React.createElement("span", {
    className: "optd-payoff-tag"
  }, "Now ", money(livePrice)))), /*#__PURE__*/React.createElement("div", {
    className: "optd-payoff-legend"
  }, /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("span", {
    className: "optd-payoff-swatch optd-payoff-swatch--profit"
  }), " Profit zone"), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("span", {
    className: "optd-payoff-swatch optd-payoff-swatch--loss"
  }), " Loss zone")), /*#__PURE__*/React.createElement("p", {
    className: "optd-payoff-caption"
  }, "Green is where the stock can trade and this trade still wins; red is where it starts losing money \u2014 both relative to where the stock trades today."));
}

// A "credit" spread that filled as a net DEBIT has no max gain — the best
// case at expiry is $0. This swaps the max-gain stat's label/value/caption
// for a net-debit framing instead of printing a negative "max gain".
function maxGainStat(facts) {
  var verb = facts.isClose ? "could have made" : "can make";
  if (!facts.isNetDebit) {
    return {
      label: "Most we can make",
      value: money(facts.maxGain),
      sub: "Max gain",
      tone: "up",
      caption: `The most we ${verb} — the full credit, if the trade finished on the safe side.`
    };
  }
  return {
    label: "Net debit paid",
    value: money(Math.abs(facts.maxGain)),
    sub: "Net debit",
    tone: "down",
    caption: "This spread filled as a net DEBIT, not a credit — best case at expiry is $0; this is what we already paid."
  };
}

// The max-loss caption is the crux of feedback fb_msmf9zlo_v0a1ebjz ("why is
// this a loss at all, and which number is true — 4k or 7k?"): this stat is
// the theoretical worst case at expiry, computed the same way whether the
// trade is open or already closed, so a closed trade that actually lost less
// (or won) than this figure reads as a second, conflicting loss number next
// to the realized-P&L headline above. Spell out the distinction explicitly
// and point at the real outcome instead of leaving the reader to guess which
// figure is "true."
function maxLossCaption(facts) {
  if (!facts.isClose) {
    return "The maximum possible loss if the spread finishes fully in the money at expiry — worst case, not what it is showing right now.";
  }
  if (facts.pnl == null) {
    return "The maximum possible loss this trade could have taken if held to expiry — a worst-case ceiling, not what actually happened.";
  }
  var verb = facts.pnl >= 0 ? "won" : "lost";
  return `The worst case if this had been held to expiry — not what actually happened. This trade closed and ${verb} ${money(Math.abs(facts.pnl))}; see Realized P&L below.`;
}
function WhatHadToHappen({
  ev,
  facts,
  livePrice
}) {
  var calc = tradeCalcProps(ev, facts);
  var mg = maxGainStat(facts);
  return /*#__PURE__*/React.createElement("section", {
    className: "card opt-panel optd-section"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "optd-h2"
  }, facts.isClose ? "What was riding on this trade" : "What had to happen for this to win"), /*#__PURE__*/React.createElement("div", {
    className: "optd-stat-grid"
  }, /*#__PURE__*/React.createElement("div", {
    className: "optd-stat"
  }, /*#__PURE__*/React.createElement("div", {
    className: "optd-stat-label"
  }, mg.label, /*#__PURE__*/React.createElement(Help, {
    term: "max_gain",
    inputs: calc.max_gain.inputs,
    asOf: calc.max_gain.asOf
  })), /*#__PURE__*/React.createElement("div", {
    className: `optd-stat-value ${mg.tone}`
  }, mg.value), /*#__PURE__*/React.createElement("div", {
    className: "optd-stat-sub"
  }, mg.sub), /*#__PURE__*/React.createElement("div", {
    className: "optd-stat-caption"
  }, mg.caption)), /*#__PURE__*/React.createElement("div", {
    className: "optd-stat"
  }, /*#__PURE__*/React.createElement("div", {
    className: "optd-stat-label"
  }, "Most we can lose", /*#__PURE__*/React.createElement(Help, {
    term: "max_loss",
    inputs: calc.max_loss.inputs,
    asOf: calc.max_loss.asOf
  })), /*#__PURE__*/React.createElement("div", {
    className: "optd-stat-value down"
  }, money(facts.maxLoss)), /*#__PURE__*/React.createElement("div", {
    className: "optd-stat-sub"
  }, "Max loss"), /*#__PURE__*/React.createElement("div", {
    className: "optd-stat-caption"
  }, maxLossCaption(facts))), /*#__PURE__*/React.createElement("div", {
    className: "optd-stat"
  }, /*#__PURE__*/React.createElement("div", {
    className: "optd-stat-label"
  }, "Break-even price", /*#__PURE__*/React.createElement(Help, {
    term: "breakeven",
    inputs: calc.breakeven.inputs,
    asOf: calc.breakeven.asOf
  })), /*#__PURE__*/React.createElement("div", {
    className: "optd-stat-value"
  }, facts.be != null ? money(facts.be) : facts.isNetDebit ? "no breakeven — net debit" : "—"), /*#__PURE__*/React.createElement("div", {
    className: "optd-stat-sub"
  }, "Breakeven"), /*#__PURE__*/React.createElement("div", {
    className: "optd-stat-caption"
  }, breakevenCaption(facts))), /*#__PURE__*/React.createElement("div", {
    className: "optd-stat"
  }, /*#__PURE__*/React.createElement("div", {
    className: "optd-stat-label"
  }, "Chance this wins", /*#__PURE__*/React.createElement(Help, {
    term: "pop",
    inputs: calc.pop.inputs,
    asOf: calc.pop.asOf
  })), /*#__PURE__*/React.createElement("div", {
    className: "optd-stat-value"
  }, pctv(ev.pop)), /*#__PURE__*/React.createElement("div", {
    className: "optd-stat-sub"
  }, "Win prob (POP)"), /*#__PURE__*/React.createElement("div", {
    className: "optd-stat-caption"
  }, "The modeled odds this trade finishes a winner."))), /*#__PURE__*/React.createElement(PayoffStrip, {
    ev: ev,
    facts: facts,
    livePrice: livePrice
  }));
}

// --- "What actually happened" ------------------------------------------------

function timelineSteps(ev, facts) {
  var resp = ev.response || {};
  var steps = [];
  if (resp.submitted_at) {
    steps.push({
      ts: resp.submitted_at,
      label: "Order sent to the broker"
    });
  }
  if (resp.filled_at) {
    var fs = facts.fs;
    var qtyPhrase = fs && fs.state === "PARTIAL" ? `${fs.filled} of ${fs.total} contracts` : `all ${ev.contracts != null ? ev.contracts : ""} contracts`.trim();
    steps.push({
      ts: resp.filled_at,
      label: `Broker filled ${qtyPhrase}`
    });
  }
  if (facts.isClose && ev.ts) {
    steps.push({
      ts: ev.ts,
      label: "We closed the position early"
    });
  }
  return steps.filter(s => s.ts).sort((a, b) => new Date(a.ts) - new Date(b.ts));
}

// One reasoning row matches this trade when its position key — ticker +
// short_strike + long_strike + expiry, written by
// src/social_signals_trader/position_reasoning.py — equals this trade's own
// key. Same-ticker/different-expiry rows never collide because expiry is
// part of the key. "failed" rows carry no ticker and never match anything.
function _reasoningRowMatches(row, ticker, shortStrike, longStrike, expiry) {
  if (!row || row.kind !== "position_reasoning" || row.status === "failed") return false;
  if (String(row.ticker || "").toUpperCase() !== String(ticker || "").toUpperCase()) return false;
  var close = (a, b) => a != null && b != null && Math.abs(Number(a) - Number(b)) < 0.005;
  return close(row.short_strike, shortStrike) && close(row.long_strike, longStrike) && row.expiry === expiry;
}

// The full reasoning journal for this trade, oldest first — every 2h
// book-review entry logged against this exact position, regardless of
// whether it's still open (a closed position still keeps its history).
function reasoningEntriesFor(ev, facts) {
  var ticker = ev.ticker;
  var shortStrike = facts.shortParsed ? facts.shortParsed.strike : null;
  var longStrike = facts.longParsed ? facts.longParsed.strike : null;
  var expiry = expiryOf(ev, facts);
  if (!ticker || shortStrike == null || longStrike == null || !expiry) return [];
  var rows = window.AGENT_REPORTS || [];
  return rows.filter(r => _reasoningRowMatches(r, ticker, shortStrike, longStrike, expiry)).sort((a, b) => new Date(a.ts) - new Date(b.ts));
}
function WhatActuallyHappened({
  ev,
  facts
}) {
  var steps = timelineSteps(ev, facts);
  var reasoningEntries = reasoningEntriesFor(ev, facts);
  // Reused as-is from the Methodology page's D5 panel — this page never
  // re-implements how a report row renders, it only supplies the rows.
  var DecisionNarrativeLine = window.DecisionNarrativeLine;
  return /*#__PURE__*/React.createElement("section", {
    className: "card opt-panel optd-section"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "optd-h2"
  }, "What actually happened"), steps.length ? /*#__PURE__*/React.createElement("ol", {
    className: "optd-timeline"
  }, steps.map((s, i) => /*#__PURE__*/React.createElement("li", {
    key: i
  }, /*#__PURE__*/React.createElement("div", {
    className: "optd-timeline-dot"
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "optd-timeline-label"
  }, s.label), /*#__PURE__*/React.createElement("div", {
    className: "optd-timeline-ts mono-dim"
  }, tsPretty(s.ts)))))) : /*#__PURE__*/React.createElement("p", {
    className: "opt-log-empty"
  }, "No timeline events recorded for this order yet."), facts.isClose && ev.reason && /*#__PURE__*/React.createElement("p", {
    className: "optd-reason"
  }, "Why: ", reasonPhrase(ev.reason)), reasoningEntries.length > 0 && DecisionNarrativeLine && /*#__PURE__*/React.createElement("div", {
    className: "optd-reasoning-journal",
    style: {
      marginTop: 12,
      borderTop: "1px solid var(--line)"
    }
  }, reasoningEntries.map((r, i) => /*#__PURE__*/React.createElement(DecisionNarrativeLine, {
    key: r.ts || i,
    report: r
  }))));
}

// --- "The numbers" ------------------------------------------------------------

// The short leg's own entry-snapshot row (from ev.entry_legs) — the source
// of the short-leg delta that drives PoP/EV's live-quote-clock inputs. Same
// shape resolution as LegDetail's own rows: array or {short, long} object.
function shortEntryLeg(ev) {
  var legs = ev.entry_legs;
  if (!legs) return null;
  var rows = Array.isArray(legs) ? legs : Object.values(legs).filter(l => l && l.symbol);
  return rows.find(l => l.symbol === ev.short) || null;
}

// One place computing every calc-driving `{inputs, asOf}` pair for this
// trade's own numbers — reused by both the hero stat grid and "The numbers"
// KvGroups so the two surfaces can never drift out of sync with each other.
function tradeCalcProps(ev, facts) {
  var entryTs = ev.response && ev.response.filled_at || ev.ts;
  var asOfEntry = {
    entry: entryTs
  };
  var leg = shortEntryLeg(ev);
  var quoteTs = leg && leg.quote_ts;
  var shortDelta = leg && leg.greeks ? leg.greeks.delta : undefined;
  var shortStrike = facts.shortParsed ? facts.shortParsed.strike : undefined;
  var longStrike = facts.longParsed ? facts.longParsed.strike : undefined;
  var right = facts.shortParsed ? facts.shortParsed.right : undefined;
  var credit = facts.maxGain;
  // `facts.width` already falls back to the strikes when `ev.width` is
  // absent (close events never log it — see tradeFacts in
  // options-trade-log.jsx) — reuse it rather than re-deriving it here, so
  // the Help tooltip's inputs can never drift from the headline number.
  var maxLossCalc = {
    inputs: {
      width: facts.width,
      contracts: ev.contracts,
      credit
    },
    asOf: asOfEntry
  };
  return {
    max_gain: {
      inputs: {
        credit
      },
      asOf: asOfEntry
    },
    max_loss: maxLossCalc,
    risk: maxLossCalc,
    breakeven: {
      inputs: {
        short_strike: shortStrike,
        credit,
        contracts: ev.contracts,
        right
      },
      asOf: asOfEntry
    },
    pop: {
      inputs: {
        short_leg_delta: shortDelta
      },
      asOf: {
        quotes: quoteTs
      }
    },
    risk_reward: {
      inputs: {
        max_loss: facts.maxLoss,
        max_gain: facts.maxGain
      },
      asOf: asOfEntry
    },
    credit_if_filled: {
      inputs: {
        limit_price: num(ev.response && ev.response.limit_price),
        contracts: ev.contracts
      }
    },
    credit_received: {
      inputs: {
        net_per_contract: num(ev.response && ev.response.filled_avg_price),
        contracts: facts.fs && facts.fs.filled
      },
      asOf: asOfEntry
    },
    realized_pl: {
      inputs: {
        credit_received: ev.entry_credit,
        exit_cost: ev.exit_cost
      },
      asOf: asOfEntry
    },
    ev: {
      inputs: {
        short_leg_delta: shortDelta,
        credit,
        width: ev.width,
        contracts: ev.contracts
      },
      asOf: {
        entry: entryTs,
        quotes: quoteTs
      }
    },
    width: {
      inputs: {
        short_strike: shortStrike,
        long_strike: longStrike
      }
    },
    credit_per_contract: {
      inputs: {
        credit,
        contracts: ev.contracts
      },
      asOf: asOfEntry
    },
    profit_target: {
      inputs: {
        credit,
        profit_target_pct: ev.profit_target_pct
      },
      asOf: asOfEntry
    }
  };
}

// Each row is [label, value, glossaryTerm, secondaryTechnicalLabel?, wide?] —
// the label is the plain-English wording, the glossary term drives the
// <Help/> tooltip, the optional secondary label surfaces the trader
// shorthand underneath so a reader who already knows it isn't retaught
// nothing, and `wide` (true for the handful of long-value fields like the
// order id and ISO timestamps) spans the tile across two grid columns
// instead of stretching every tile in the row to the longest value.
// `calc` (keyed by term) supplies that term's live `inputs`/`asOf` — absent
// for terms with no matching calc, which degrades <Help/> to definition-only.
function KvGroup({
  title,
  items,
  calc
}) {
  var rows = items.filter(item => item[1] != null && item[1] !== "—");
  if (!rows.length) return null;
  return /*#__PURE__*/React.createElement("div", {
    className: "optd-kv-group"
  }, /*#__PURE__*/React.createElement("div", {
    className: "optd-kv-group-title"
  }, title), /*#__PURE__*/React.createElement("div", {
    className: "opt-kv optd-tiles"
  }, rows.map(([label, v, term, secondary, wide]) => {
    var props = calc && term && calc[term] || {};
    return /*#__PURE__*/React.createElement("div", {
      className: `optd-tile${wide ? " optd-tile--wide" : ""}`,
      key: label
    }, /*#__PURE__*/React.createElement("span", {
      className: "opt-kv-k"
    }, label, term && /*#__PURE__*/React.createElement(Help, {
      term: term,
      inputs: props.inputs,
      asOf: props.asOf
    })), secondary && /*#__PURE__*/React.createElement("span", {
      className: "opt-kv-sub"
    }, secondary), /*#__PURE__*/React.createElement("span", {
      className: "opt-kv-v"
    }, v));
  })));
}

// Current-position calc for the "Current open P&L" row — same shape as
// options-summary.jsx's positionRowCalcProps so the detail page's <Help/>
// tooltip explains the number with the exact inputs that produced it,
// instead of re-deriving a second formula for the same field.
function openPlCalcProps(pos) {
  if (!pos || !pos.entry || !pos.now) return {};
  return {
    inputs: {
      credit: pos.entry.credit,
      close_cost: pos.now.close_cost
    },
    asOf: {
      entry: pos.entry.filled_at,
      quotes: pos.oldest_quote_ts
    }
  };
}
function TheNumbers({
  ev,
  facts,
  pos
}) {
  var {
    isClose,
    received,
    maxGain,
    isNetDebit,
    maxLoss,
    be,
    riskReward,
    pnl,
    classification
  } = facts;
  var calc = {
    ...tradeCalcProps(ev, facts),
    open_pl: openPlCalcProps(pos)
  };
  var maxGainLabel = isNetDebit ? "Net debit paid" : "Most we can make";
  var maxGainSecondary = isNetDebit ? "Net debit" : "Max gain (credit)";
  var maxGainValue = money(isNetDebit ? Math.abs(maxGain) : maxGain);
  // Only meaningful while the trade is still open and matched to a live
  // position — a closed trade already has "Realized P&L" below, and the two
  // must never both render for the same trade (one is a live mark, the other
  // is final).
  var openPl = !isClose && pos && pos.now ? pos.now.open_pl : null;
  return /*#__PURE__*/React.createElement("section", {
    className: "card opt-panel optd-section"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "optd-h2"
  }, "The numbers"), /*#__PURE__*/React.createElement(KvGroup, {
    title: "Money",
    calc: calc,
    items: [[maxGainLabel, maxGainValue, "max_gain", maxGainSecondary],
    // "Most we can lose" is the worst case if the spread finishes fully
    // in the money at expiry — NOT what it's showing right now. Kept
    // apart from "Current open P&L" below (a live mark that moves
    // every quote) so the two are never mistaken for each other.
    ["Most we can lose", money(maxLoss), "max_loss", "Max loss (risk, worst case at expiry)"], ["Current open P&L", openPl != null ? money(openPl) : null, "open_pl", "Live mark, not worst case"], ["Break-even price", be != null ? money(be) : isNetDebit ? "no breakeven — net debit" : null, "breakeven", "Breakeven"], ["Risk:reward", riskReward != null ? `${riskReward.toFixed(1)} : 1 against` : null, "risk_reward"], ["Credit if filled", money(ev.credit ?? ev.entry_credit), "credit_if_filled"],
    // A CLOSE event's own `received` is what it cost to close, not a
    // credit — that's the "Exit cost" row below, not this one.
    ["Credit received", classification.bucket === "trade" && !isClose ? money(received) : null, "credit_received"], ["Realized P&L", isClose ? money(pnl) : null, "realized_pl"], ["EV at entry", money(ev.ev), "ev"], ["Chance this wins", pctv(ev.pop), "pop", "Win prob (POP)"], ["Exit cost", isClose ? money(ev.exit_cost) : null, "exit_cost"]]
  }), /*#__PURE__*/React.createElement(KvGroup, {
    title: "The contract",
    calc: calc,
    items: [["Days until it expires", ev.dte, "dte", "DTE"], ["Expiry", expiryOf(ev, facts), "expiry"], ["Spot at entry", money(ev.spot_at_entry), "spot_at_entry"], ["IV at entry", pctv(ev.iv_at_entry), "iv"], ["Width", money(ev.width), "width"], ["Contracts", ev.contracts, "contracts"], ["Credit per contract", money(ev.credit_per_contract), "credit_per_contract"], ["Profit target", pctv(ev.profit_target_pct), "profit_target"]]
  }), /*#__PURE__*/React.createElement(KvGroup, {
    title: "The order",
    items: (() => {
      var resp = ev.response || {};
      return [["Fill state", classification.label, "fill_state"], ["Reason", ev.reason, "reason"], ["Order id", ev.client_order_id, "order_id", null, true], ["Broker order status", resp.status, "broker_order_status"], ["Broker limit price", resp.limit_price != null ? money(num(resp.limit_price)) : null, "broker_limit_price"], ["Time in force", resp.time_in_force, "time_in_force"], ["Submitted at", tsPretty(resp.submitted_at), "submitted_at", null, true], ["Filled at", tsPretty(resp.filled_at), "filled_at", null, true]];
    })()
  }));
}

// --- Greeks -------------------------------------------------------------------

function Greeks({
  ev,
  facts
}) {
  var internals = window.OptionsTradeLogInternals;
  return /*#__PURE__*/React.createElement("section", {
    className: "card opt-panel optd-section"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "optd-h2"
  }, "The greeks"), /*#__PURE__*/React.createElement("p", {
    className: "optd-explainer optd-explainer--wide"
  }, "These are the risk sensitivities for each leg \u2014 tap the ", /*#__PURE__*/React.createElement("strong", null, "?"), " on a column header below for what a delta, gamma, theta, vega, or rho actually means."), /*#__PURE__*/React.createElement("p", {
    className: "optd-note"
  }, "These were frozen at the moment of the order \u2014 not live prices."), /*#__PURE__*/React.createElement("div", {
    className: "optd-legtable-wrap"
  }, /*#__PURE__*/React.createElement(internals.LegDetail, {
    title: "Legs at entry",
    legs: ev.entry_legs,
    predatesSnapshots: !("entry_legs" in ev),
    contracts: ev.contracts
  })), facts.isClose && /*#__PURE__*/React.createElement("div", {
    className: "optd-legtable-wrap"
  }, /*#__PURE__*/React.createElement(internals.LegDetail, {
    title: "Legs at exit",
    legs: ev.exit_legs,
    predatesSnapshots: !("exit_legs" in ev),
    contracts: ev.contracts
  })));
}

// --- Page -----------------------------------------------------------------

function OptionTradeDetailPage() {
  var [key, setKey] = useState(tradeKeyFromUrl);
  useEffect(() => {
    var onHash = () => setKey(tradeKeyFromUrl());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  var internals = window.OptionsTradeLogInternals;
  var resolved = internals ? internals.resolveTrade(key, window.SPREAD_LOG) : null;
  if (!resolved) {
    return /*#__PURE__*/React.createElement("main", {
      className: "shell",
      id: "trade-detail"
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 12
      }
    }, /*#__PURE__*/React.createElement(BackToTradeLog, null)), /*#__PURE__*/React.createElement("section", {
      className: "card opt-panel",
      style: {
        marginTop: 16
      }
    }, /*#__PURE__*/React.createElement("p", {
      className: "opt-log-empty"
    }, "That trade isn\u2019t in the log any more.")));
  }
  var {
    ev,
    classification
  } = resolved;
  var facts = internals.tradeFacts(ev, classification);
  var isClose = facts.isClose;
  var banner = outcomeBanner(ev, facts);
  var pos = matchedPosition(ev, facts);
  var livePrice = pos ? num(pos.now && pos.now.spot) : null;
  return /*#__PURE__*/React.createElement("main", {
    className: "shell",
    id: "trade-detail"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 12,
      position: "sticky",
      top: 0,
      zIndex: 1,
      paddingBottom: 8,
      display: "flex",
      alignItems: "center",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(BackToTradeLog, null), /*#__PURE__*/React.createElement(TradeDetailFeedbackButton, {
    ev: ev,
    facts: facts,
    tradeKeyValue: key
  })), /*#__PURE__*/React.createElement("section", {
    className: "card opt-panel",
    style: {
      marginTop: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "opt-panel-head"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "opt-panel-title"
  }, /*#__PURE__*/React.createElement("strong", {
    className: "opt-ticker"
  }, ev.ticker), /*#__PURE__*/React.createElement(CurrentPrice, {
    ev: ev,
    facts: facts,
    pos: pos
  })), /*#__PURE__*/React.createElement("div", {
    className: "opt-panel-stats"
  }, /*#__PURE__*/React.createElement("span", {
    className: `opt-badge opt-badge--${isClose ? "close" : "open"}`
  }, isClose ? "CLOSE" : "OPEN"), /*#__PURE__*/React.createElement("span", {
    className: `opt-badge opt-badge--${BADGE_CLASS[classification.kind] || "fill-unfilled"}`
  }, classification.label))), /*#__PURE__*/React.createElement("p", {
    className: "optd-headline"
  }, headlineSentence(ev, facts)), /*#__PURE__*/React.createElement("span", {
    className: `optd-banner optd-banner--${banner.tone}`
  }, banner.text)), /*#__PURE__*/React.createElement(WhatWeDid, {
    ev: ev,
    facts: facts
  }), /*#__PURE__*/React.createElement(WhatHadToHappen, {
    ev: ev,
    facts: facts,
    livePrice: livePrice
  }), /*#__PURE__*/React.createElement(WhatActuallyHappened, {
    ev: ev,
    facts: facts
  }), /*#__PURE__*/React.createElement(TheNumbers, {
    ev: ev,
    facts: facts,
    pos: pos
  }), /*#__PURE__*/React.createElement(Greeks, {
    ev: ev,
    facts: facts
  }), window.TradeFeedbackThreads && /*#__PURE__*/React.createElement(window.TradeFeedbackThreads, {
    targets: feedbackTargets(key, pos, ev, facts)
  }));
}
window.OptionTradeDetailPage = OptionTradeDetailPage;

/* ---- pages/ticker-details.jsx ---- */
/* global React */
// Ticker Details — the premium-selling worksheet.
//
// Live-only: every card comes from a real-time /options/chain call through
// the trader API. What it shows: what the free indicative feed actually
// knows, then the two ladders we care about — cash-secured puts (deploy idle
// cash) and covered calls (rent out shares we already own).
//
// Every contract shown already passed the producer's filters: |delta| <= the
// max-short-delta param (~POP >= 80%), DTE inside the window, and — for puts —
// collateral under the per-contract cash ceiling.

var {
  useState,
  useEffect
} = React;
var pct = v => v == null ? "—" : (v * 100).toFixed(1) + "%";
var usd = v => v == null ? "—" : "$" + Number(v).toLocaleString(undefined, {
  maximumFractionDigits: 0
});
var usd2 = v => v == null ? "—" : "$" + Number(v).toFixed(2);
function Chip({
  tone = "neutral",
  children,
  title
}) {
  var bg = {
    good: "color-mix(in oklch, var(--pos) 18%, transparent)",
    bad: "color-mix(in oklch, var(--neg) 18%, transparent)",
    warn: "color-mix(in oklch, var(--accent) 18%, transparent)",
    neutral: "var(--surface-2)"
  }[tone];
  var fg = {
    good: "var(--pos)",
    bad: "var(--neg)",
    warn: "var(--accent)",
    neutral: "var(--text-2)"
  }[tone];
  return /*#__PURE__*/React.createElement("span", {
    title: title,
    style: {
      background: bg,
      color: fg,
      border: "1px solid var(--line)",
      borderRadius: 999,
      padding: "2px 8px",
      fontSize: 10,
      fontFamily: "var(--mono)",
      whiteSpace: "nowrap"
    }
  }, children);
}

// Two cards side by side, each half the page. auto-fit rather than a hard
// `1fr 1fr` so a row with only one live card (or a narrow window) collapses to
// full width instead of leaving a dead column.
function Row2({
  children
}) {
  var kids = React.Children.toArray(children).filter(Boolean);
  if (!kids.length) return null;
  return /*#__PURE__*/React.createElement("div", {
    className: "opts-row2"
  }, kids);
}

// `term` is optional: most Stats here are raw counts with no glossary
// concept behind them. When present with no matching `calc` (e.g. "iv" —
// definition/example only), <Help/> renders the definition and never
// invents a formula for a number that's really just what the live chain
// response reported.
function Stat({
  label,
  value,
  tone,
  term,
  inputs,
  asOf
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 2
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      color: "var(--text-3)",
      textTransform: "uppercase",
      letterSpacing: ".06em"
    }
  }, label, term && /*#__PURE__*/React.createElement(window.Help, {
    term: term,
    inputs: inputs,
    asOf: asOf
  })), /*#__PURE__*/React.createElement("span", {
    className: tone,
    style: {
      fontFamily: "var(--mono)",
      fontSize: 15
    }
  }, value));
}

// POP is 1 - |delta|. Render it as a bar so an 84% and a 96% candidate are
// distinguishable at a glance rather than two similar-looking decimals.
function PopBar({
  pop
}) {
  var w = Math.max(0, Math.min(1, pop || 0)) * 100;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      height: 6,
      background: "var(--surface-2)",
      borderRadius: 3,
      border: "1px solid var(--line)",
      position: "relative"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      right: `${100 - w}%`,
      background: "var(--pos)",
      borderRadius: 3,
      opacity: 0.85
    }
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--mono)",
      fontSize: 11,
      width: 44,
      textAlign: "right"
    }
  }, pct(pop)));
}

// The four structures, in the order a premium seller evaluates them.
var LADDERS = [{
  key: "sell_puts",
  label: "Sell puts",
  hint: "Cash-secured. Collateral = strike x 100."
}, {
  key: "put_spreads",
  label: "Put spreads",
  hint: "Bull put credit spread. Risk = width - credit, so the same cash funds many more positions."
}, {
  key: "sell_calls",
  label: "Sell calls",
  hint: "Covered. Needs 100+ shares of the underlying."
}, {
  key: "call_spreads",
  label: "Call spreads",
  hint: "Bear call credit spread. Sells calls without owning the shares."
}];
var EMPTY_REASON = {
  sell_puts: "every strike in the window is illiquid, the credit is below the floor, or the cash collateral exceeds the per-contract ceiling — try the put spread instead",
  put_spreads: "no pair of strikes in the window produces a positive credit inside the risk ceiling",
  sell_calls: "no strike above spot pays enough, or the chain has no greeks at this delta",
  call_spreads: "no pair of strikes above spot produces a positive credit inside the risk ceiling"
};
function LadderTable({
  rows,
  kind
}) {
  if (!rows || !rows.length) {
    return /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 12,
        color: "var(--text-3)",
        margin: "8px 0 0"
      }
    }, "No candidate \u2014 ", EMPTY_REASON[kind] || "nothing clears the filters", ".");
  }
  var isSpread = kind === "put_spreads" || kind === "call_spreads";
  var isCoveredCall = kind === "sell_calls";
  return /*#__PURE__*/React.createElement("div", {
    style: {
      overflowX: "auto",
      marginTop: 8
    }
  }, /*#__PURE__*/React.createElement("table", {
    style: {
      width: "100%",
      borderCollapse: "collapse",
      fontFamily: "var(--mono)",
      fontSize: 11
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", {
    style: {
      color: "var(--text-3)",
      textAlign: "right"
    }
  }, /*#__PURE__*/React.createElement("th", {
    style: {
      textAlign: "left",
      padding: "4px 6px"
    }
  }, isSpread ? "Short / long" : "Contract"), /*#__PURE__*/React.createElement("th", {
    style: {
      padding: "4px 6px"
    }
  }, "Exp"), /*#__PURE__*/React.createElement("th", {
    style: {
      padding: "4px 6px"
    }
  }, "DTE"), /*#__PURE__*/React.createElement("th", {
    style: {
      padding: "4px 6px"
    }
  }, isSpread ? "Width" : "Strike"), /*#__PURE__*/React.createElement("th", {
    style: {
      padding: "4px 6px"
    }
  }, "\u0394"), /*#__PURE__*/React.createElement("th", {
    style: {
      padding: "4px 6px",
      minWidth: 120
    }
  }, "Win prob"), /*#__PURE__*/React.createElement("th", {
    style: {
      padding: "4px 6px"
    }
  }, "Credit"), /*#__PURE__*/React.createElement("th", {
    style: {
      padding: "4px 6px"
    }
  }, isSpread ? "Max loss" : isCoveredCall ? "Share value" : "Cash held"), /*#__PURE__*/React.createElement("th", {
    style: {
      padding: "4px 6px"
    }
  }, "Ann. yield"), /*#__PURE__*/React.createElement("th", {
    style: {
      padding: "4px 6px"
    }
  }, isCoveredCall ? "Upside cap" : "Breakeven"), /*#__PURE__*/React.createElement("th", {
    style: {
      padding: "4px 6px"
    }
  }, "IV"))), /*#__PURE__*/React.createElement("tbody", null, rows.map(r => /*#__PURE__*/React.createElement("tr", {
    key: r.short_symbol ? r.short_symbol + r.long_symbol : r.symbol,
    style: {
      borderTop: "1px solid var(--line)",
      textAlign: "right"
    }
  }, /*#__PURE__*/React.createElement("td", {
    style: {
      textAlign: "left",
      padding: "5px 6px",
      color: "var(--text-2)"
    }
  }, isSpread ? `${usd2(r.strike)} / ${usd2(r.long_strike)}` : r.symbol), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: "5px 6px"
    }
  }, r.expiry?.slice(5)), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: "5px 6px"
    }
  }, r.dte, "d"), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: "5px 6px"
    }
  }, isSpread ? usd2(r.width) : usd2(r.strike)), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: "5px 6px"
    }
  }, r.delta?.toFixed(3)), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: "5px 6px"
    }
  }, /*#__PURE__*/React.createElement(PopBar, {
    pop: r.pop
  })), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: "5px 6px"
    },
    className: "up"
  }, usd2(r.credit)), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: "5px 6px",
      color: "var(--text-2)"
    }
  }, usd(r.collateral)), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: "5px 6px"
    },
    className: r.ann_yield >= 0.15 ? "up" : ""
  }, pct(r.ann_yield)), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: "5px 6px",
      color: "var(--text-2)"
    }
  }, isCoveredCall ? pct(r.upside_cap_pct) : usd2(r.breakeven)), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: "5px 6px",
      color: "var(--text-2)"
    }
  }, pct(r.iv)))))));
}

// One feedback target per policy SECTION, not one for the whole card. A
// reader who disagrees with the max-loss stop and a reader who disagrees with
// the traded universe are giving feedback on two different rules; a single
// card-level button would file both into the same thread and lose which
// sub-strategy was meant. Ids are namespaced `policy-<section>` — so
// "universe" here can never collide with a same-named card elsewhere on the
// site — and go through the shared window.componentId kebab-caser rather than
// hand-typed strings (same rule <CardHead>/<Section> use).
function PolicyFeedback({
  section,
  compact
}) {
  if (!window.FeedbackButton) return null;
  var slug = window.componentId ? window.componentId(section) : String(section).toLowerCase();
  var btn = /*#__PURE__*/React.createElement(window.FeedbackButton, {
    target: {
      kind: "component",
      id: `policy-${slug}`,
      label: `Policy — ${section}`
    }
  });
  // `compact` drops the "Feedback" word (icon only) for the buttons that sit
  // inside a bullet's running text, where a full pill would break the line.
  // Section headings keep the labelled pill (PRD 1044 — the affordance must
  // be legible, not a ghost icon).
  return compact ? /*#__PURE__*/React.createElement("span", {
    className: "policy-feedback-compact"
  }, btn) : btn;
}

// Fund policy — the CREDIT_SPREAD sleeve's live, actually-traded config,
// exported by spread_trader.export_config() as window.SPREAD_CONFIG. This is
// deliberately a separate surface from the ticker worksheet below: the
// worksheet's filters come from options_chain's exploratory scanner constants,
// which are looser on purpose (one explores, one trades) — merging the two
// into a single parameter list is the bug this component exists to avoid.
// Whether the sleeve is actually allowed to send an order, stated at the top of
// the page rather than inferred from an empty Trade Log. `live` is the real
// switch: spread_trader.execute()/manage() pass `dry_run=not cfg.live`, so with
// it false EVERY entry and exit is a dry run — the tick still runs, still
// scores, still writes the log, and submits nothing. A page that shows
// proposals, positions and exits without saying that reads as a live book.
function ExecutionState() {
  var sc = window.SPREAD_CONFIG;
  if (!sc || !sc.config || sc.config.live == null) return null;
  if (sc.config.live) {
    return /*#__PURE__*/React.createElement("p", {
      className: "opts-exec-state opts-exec-state--live"
    }, /*#__PURE__*/React.createElement("b", null, "Execution: LIVE."), " The 15-minute tick submits real orders to the broker.");
  }
  return /*#__PURE__*/React.createElement("p", {
    className: "opts-exec-state opts-exec-state--halted"
  }, /*#__PURE__*/React.createElement("b", null, "Execution: HALTED \u2014 every order is a dry run."), " The tick still scans, scores and logs on schedule, but ", /*#__PURE__*/React.createElement("span", {
    className: "mono"
  }, "live = false"), ", so nothing below reaches the broker: no entry is opened and no exit is sent. Positions and P&L shown are the existing book, not new activity.");
}
function StrategyPolicy() {
  var sc = window.SPREAD_CONFIG;
  if (!sc || !sc.config) {
    return /*#__PURE__*/React.createElement("section", {
      className: "card opts-strategy-card",
      style: {
        borderColor: "var(--neg)"
      }
    }, /*#__PURE__*/React.createElement("p", {
      style: {
        color: "var(--neg)",
        fontSize: 12,
        margin: 0
      }
    }, "Strategy config unavailable \u2014 dashboard/data-spread-config.js is missing or failed to load. Not showing stand-in numbers here on purpose."));
  }
  var c = sc.config;
  // Most of these terms describe a config *threshold* (a band, a ceiling),
  // not a value this file can plug into that term's own calc — the calc's
  // input keys (e.g. pop's short_leg_delta) don't correspond to a single
  // static config field. `max_per_underlying`'s glossary calc is the
  // identity `v => v.max_per_underlying`, so it's the one term here whose
  // live config value substitutes straight in — same additive pattern as
  // options-summary.jsx's RulesInForce (PRD 1026).
  var FIELD_TERM_CONFIG_INPUT = {
    max_per_underlying: {
      max_per_underlying: c.max_per_underlying
    }
  };
  // `dash` renders a config field as-is, or an em-dash when the field is
  // absent from window.SPREAD_CONFIG — never `undefined`/`NaN` on screen.
  var dash = (v, fmt) => v == null ? "—" : fmt ? fmt(v) : v;
  // The entry gate is a BAND, not a one-sided ceiling — `_passes_pop_band()`
  // rejects both below min_pop/above max_short_delta ("too risky") AND above
  // max_pop/below min_short_delta ("too safe"). If either band edge is
  // missing from the live config, fall back to the single-sided reading
  // rather than rendering "— ≤ |Δ| ≤ 0.2".
  var deltaBand = c.min_short_delta == null ? `|Δ| ≤ ${dash(c.max_short_delta)}` : `${dash(c.min_short_delta)} ≤ |Δ| ≤ ${dash(c.max_short_delta)}`;
  var popBand = c.max_pop == null ? `≥ ${pct(c.min_pop)}` : `${pct(c.min_pop)}–${pct(c.max_pop)}`;
  var field = (label, value, gloss, term) => /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 1
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 9,
      color: "var(--text-3)",
      textTransform: "uppercase",
      letterSpacing: ".06em"
    }
  }, label, term && /*#__PURE__*/React.createElement(window.Help, {
    term: term,
    inputs: FIELD_TERM_CONFIG_INPUT[term]
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--mono)",
      fontSize: 12
    }
  }, value), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      color: "var(--text-3)",
      lineHeight: 1.35
    }
  }, gloss));
  // Compact: this card is an explainer, not a live reading — it sits at the
  // bottom of the page under "Strategy & rules", so it gets narrower columns
  // and smaller type than the live cards above it.
  var grid = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: "8px 12px",
    marginTop: 6
  };
  var h4 = {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: ".06em",
    color: "var(--text-3)",
    marginTop: 10,
    marginBottom: 0
  };

  // The three buy-to-close triggers a SELL leg can hit, shared verbatim by
  // both SELL PUT and SELL CALL so the wording never drifts between legs —
  // only the leg noun ("short put" / "short call") differs.
  var buyToCloseTriggers = legNoun => /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 11,
      color: "var(--text-2)",
      margin: "3px 0 0",
      maxWidth: 760
    }
  }, "Precedence, not a menu \u2014 the first of these three that fires is the one that closes the spread; the other two never get evaluated."), /*#__PURE__*/React.createElement("ul", {
    className: "opts-strategy-leg-triggers"
  }, /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("b", null, "Strike breach"), " (", /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--mono)"
    }
  }, "close_on_strike_breach = ", String(dash(c.close_on_strike_breach)), ", strike_breach_buffer_pct = ", pct(c.strike_breach_buffer_pct)), /*#__PURE__*/React.createElement(window.Help, {
    term: "strike_breach_exit"
  }), " ", /*#__PURE__*/React.createElement(window.Help, {
    term: "strike_breach_buffer"
  }), ") \u2014 buy to close if the stock trades past the ", legNoun, "'s strike by more than the buffer. Caps the loss instead of waiting for expiry. Checked first, and stays active even when the mark is suspect, because it keys on spot vs strike, never on the mark.", /*#__PURE__*/React.createElement(PolicyFeedback, {
    section: "Exit \u2014 strike breach",
    compact: true
  })), /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("b", null, "Max-loss stop"), " (", /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--mono)"
    }
  }, "max_loss_pct = ", dash(c.max_loss_pct, pct)), /*#__PURE__*/React.createElement(window.Help, {
    term: "max_loss_pct"
  }), ") \u2014 buy to close once the cost to close equals ", dash(c.max_loss_pct, pct), " of the credit collected. Checked second, only if the strike hasn't breached.", /*#__PURE__*/React.createElement(PolicyFeedback, {
    section: "Exit \u2014 max-loss stop",
    compact: true
  })), /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("b", null, "Profit target"), " (", /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--mono)"
    }
  }, "profit_target_pct = ", pct(c.profit_target_pct)), /*#__PURE__*/React.createElement(window.Help, {
    term: "profit_target"
  }), ") \u2014 buy to close once ", pct(c.profit_target_pct), " of the entry credit is captured. Frees the collateral sooner instead of sitting through the last, highest-gamma slice of credit. Checked last, only if neither exit above fired, and only when", " ", /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--mono)"
    }
  }, "hold_to_expiry = ", String(dash(c.hold_to_expiry))), " is false.", /*#__PURE__*/React.createElement(PolicyFeedback, {
    section: "Exit \u2014 profit target",
    compact: true
  }))), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 11,
      color: "var(--text-2)",
      margin: "6px 0 0",
      maxWidth: 760
    }
  }, /*#__PURE__*/React.createElement("b", null, "Suppressors:"), " a ", /*#__PURE__*/React.createElement(window.Help, {
    term: "mark_suspect"
  }), "suspect mark disables both mark-driven exits \u2014 max-loss stop and profit target \u2014 while the strike breach stays active, since the breach keys on spot vs strike, not the mark. A non-positive entry credit disables the same two percent-of-credit exits (there is no credit to take a percent of), leaving only the strike breach.", /*#__PURE__*/React.createElement(PolicyFeedback, {
    section: "Exit \u2014 suppressors",
    compact: true
  })));
  var legStyle = {
    marginTop: 10,
    paddingTop: 10,
    borderTop: "1px solid var(--line)"
  };
  var legTitle = {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: ".02em",
    margin: 0
  };
  return /*#__PURE__*/React.createElement("section", {
    className: "card opts-strategy-card"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "baseline",
      flexWrap: "wrap",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      margin: 0,
      fontSize: 13
    }
  }, "CREDIT_SPREAD \u2014 fund policy", /*#__PURE__*/React.createElement(PolicyFeedback, {
    section: "Overall"
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      color: "var(--text-3)",
      fontFamily: "var(--mono)"
    }
  }, "config as of ", String(sc.generatedAt || "unknown").replace("T", " "))), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 11,
      color: "var(--text-2)",
      marginTop: 4,
      maxWidth: 760
    }
  }, "These are the live, actually-traded rules \u2014 loaded from data/spread_config.json with any SST_SPREAD_* env overrides applied. The ticker worksheet above is an exploratory scan with its own, looser filters; it is not this policy."), /*#__PURE__*/React.createElement("h4", {
    style: h4
  }, "Universe", /*#__PURE__*/React.createElement(PolicyFeedback, {
    section: "Universe"
  })), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 11,
      fontFamily: "var(--mono)",
      margin: "3px 0 0",
      color: "var(--text-2)"
    },
    title: "The only tickers the sleeve scans and trades."
  }, (c.tickers || []).join(", ")), /*#__PURE__*/React.createElement("h4", {
    style: h4
  }, "Direction \u2014 momentum", /*#__PURE__*/React.createElement(PolicyFeedback, {
    section: "Entry \u2014 momentum"
  })), /*#__PURE__*/React.createElement("div", {
    style: grid
  }, field("PUT spreads (bullish)", c.require_momentum === false ? "off" : `RSI < ${dash(c.put_max_rsi)}, stoch %K < ${dash(c.put_max_stoch)}`, "we only sell put spreads into an OVERSOLD name — the fall has to have gone far enough that a bounce is the likelier next move; RSI(14) Wilder and fast %K(14) on daily bars", "rsi"), field("CALL spreads (bearish)", c.require_momentum === false ? "off" : `RSI > ${dash(c.call_min_rsi)}, stoch %K > ${dash(c.call_min_stoch)}`, "we only sell call spreads into an OVERBOUGHT name — the run has to be stretched enough that a pause is the likelier next move", "stochastic"), field("Unmeasurable momentum", c.require_momentum === false ? "n/a — gate off" : "reject", "a name whose RSI/%K cannot be computed (no bars, short history) is REJECTED, not waved through — a spread whose direction was never checked is exactly what this gate exists to stop", "rsi")), /*#__PURE__*/React.createElement("h4", {
    style: h4
  }, "Entry gates", /*#__PURE__*/React.createElement(PolicyFeedback, {
    section: "Entry gates"
  })), /*#__PURE__*/React.createElement("div", {
    style: grid
  }, field("Short-leg delta", deltaBand, "a BAND, not just a ceiling — too far ITM (above the ceiling) is too risky, but too far OTM (below the floor) is too safe: the credit no longer covers the round-trip cost", "short_leg_delta"), field("Win probability", popBand, "also a band: below the floor is rejected as too risky, but above the ceiling is rejected as too safe too — a very high PoP means a small credit that a fixed round-trip cost swallows", "pop"), field("DTE window", `${dash(c.min_dte)}–${dash(c.max_dte)}d`, "floor keeps out of 1-DTE gamma; cap keeps capital turning over", "dte"), field("Risk per position", `${usd(c.min_notional)}–${usd(c.max_notional)}`, "capital-at-risk band per position, not a ceiling alone", "risk"), field("Min net credit", `> ${usd2(c.min_net_credit)}`, "the unconditional floor — a candidate whose net credit does not clear this is refused before submission, checked again against the exact price about to be sent to the broker, not just the earlier scan estimate; a fill that slips through anyway pages the operator", "min_net_credit"), field("Min credit", usd2(c.min_credit), "an ADDITIONAL absolute floor a candidate must ALSO clear — below this, fees dominate the trade regardless of how favorable the breakeven ratio looks", "min_credit"), field("Min breakeven multiple", c.min_credit_breakeven_multiple > 0 ? `≥ ${c.min_credit_breakeven_multiple}× breakeven` : "off", c.min_credit_breakeven_multiple > 0 ? "the binding credit gate — credit must be at least this multiple of (1 − pop) × width × 100, the spread's own breakeven credit, i.e. a margin over what it needed just to break even" : "not used — leaving only the absolute Min credit floor", "min_credit_breakeven_multiple"), field("Expected value", `≥ ${usd2(c.min_ev)}${c.require_positive_ev ? " (must be positive)" : ""}`, "pop × credit − (1−pop) × max loss must clear this", "ev"), field("Max quote width", c.max_quote_spread_pct > 0 ? pct(c.max_quote_spread_pct) : "off", c.max_quote_spread_pct > 0 ? "per leg, (ask − bid) ÷ mid — BOTH legs must be tighter than this or the spread is dropped before it is scored. The credit is computed off the mid, and on an illiquid contract that mid is not a tradeable price" : "not used — a spread can be scored off a mid no one will trade at"), field("Fill assumption", dash(c.entry_fill_fraction), c.entry_fill_fraction >= 1 ? "1.0 — every candidate is priced assuming we cross the bid/ask on BOTH legs. The most pessimistic setting: the credit on every card above is what we would get at the worst fill, not the mid" : `${c.entry_fill_fraction} — candidates are priced assuming we cross this fraction of the bid/ask on both legs (0 = both legs fill at the mid, 1 = both legs cross). Lower is a more optimistic credit than we are likely to receive`), field("Ann. yield floor", c.min_ann_yield > 0 ? pct(c.min_ann_yield) : "off (0)", c.min_ann_yield > 0 ? `minimum annualized yield required — ann_yield is credit/collateral annualised over the ${dash(c.min_dte)}–${dash(c.max_dte)}d hold, so this isn't a typo: 10.0 renders as 1000%/yr` : "not used — a high yield floor mechanically forces 1-DTE risk", "ann_yield")), /*#__PURE__*/React.createElement("h4", {
    style: h4
  }, "Book limits", /*#__PURE__*/React.createElement(PolicyFeedback, {
    section: "Book limits"
  })), /*#__PURE__*/React.createElement("div", {
    style: grid
  }, field("Max positions", dash(c.max_positions), "open spreads across the whole book at once", "max_positions"), field("Max total risk", `${dash(c.max_total_risk_equity_multiple)}× equity`, "a BACKSTOP above the target_invested_pct budget below — that budget is what actually binds day to day; this only catches equity being misread or growing unexpectedly", "max_total_risk"), field("Max per underlying", dash(c.max_per_underlying), "at most this many open spreads per name at a time", "max_per_underlying"), field("Margin buffer", pct(c.margin_buffer_pct), "new entries are refused once maintenance margin would exceed equity minus this buffer", "margin_buffer_pct"), field("Max expiry concentration", c.max_expiry_concentration_pct > 0 ? pct(c.max_expiry_concentration_pct) : "off", c.max_expiry_concentration_pct > 0 ? "no single expiry date may hold more than this share of total book risk — existing positions plus everything already chosen this batch" : "not used — no cap on how much risk sits on one expiry", "max_expiry_concentration_pct"), field("Target deployment", pct(c.target_invested_pct), `the deployment target the sleeve fills toward — new entries pause once deployed capital is within ${pct(c.deploy_band_pct)} of this target`, "target_invested_pct"), field("Beta gate floor", pct(c.beta_gate_floor_pct), "the deployment ceiling while the realized-vs-delta-implied beta is unmeasured (or shows no edge) — floors target deployment down from target_invested_pct until beta is actually measured against outcomes", "beta_gate_floor_pct")), /*#__PURE__*/React.createElement("h4", {
    style: h4
  }, "Legs \u2014 who sells, who buys, and why", /*#__PURE__*/React.createElement(PolicyFeedback, {
    section: "Legs"
  })), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 11,
      color: "var(--text-2)",
      margin: "3px 0 0",
      maxWidth: 760
    }
  }, "Every position is a vertical spread: one leg ", /*#__PURE__*/React.createElement("b", null, "sold to open"), /*#__PURE__*/React.createElement(window.Help, {
    term: "sell_to_open"
  }), " for", " ", /*#__PURE__*/React.createElement("b", null, "credit received"), /*#__PURE__*/React.createElement(window.Help, {
    term: "credit_received"
  }), " (money in), one leg", " ", /*#__PURE__*/React.createElement("b", null, "bought to open"), /*#__PURE__*/React.createElement(window.Help, {
    term: "buy_to_open"
  }), " for a ", /*#__PURE__*/React.createElement("b", null, "debit paid"), /*#__PURE__*/React.createElement(window.Help, {
    term: "debit_paid"
  }), " (money out) that caps the loss. A short put spread pairs SELL PUT + BUY PUT; a short call spread pairs SELL CALL + BUY CALL \u2014 this sleeve never trades a naked leg."), /*#__PURE__*/React.createElement("div", {
    style: legStyle
  }, /*#__PURE__*/React.createElement("h5", {
    style: legTitle
  }, "SELL PUT (short leg \u2014 the credit)", /*#__PURE__*/React.createElement(window.Help, {
    term: "short_leg"
  }), /*#__PURE__*/React.createElement(PolicyFeedback, {
    section: "SELL PUT"
  })), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 11,
      color: "var(--text-2)",
      margin: "3px 0 0",
      maxWidth: 760
    }
  }, /*#__PURE__*/React.createElement("b", null, "Opens:"), " SELL TO OPEN a put with delta inside the band (", /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--mono)"
    }
  }, deltaBand), ") and win probability inside the band ", /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--mono)"
    }
  }, popBand), " \u2014 too far ITM is rejected as too risky, too far OTM is rejected as too safe \u2014 with", " ", /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--mono)"
    }
  }, dash(c.min_dte), "\u2013", dash(c.max_dte), "d"), " to expiry \u2014 the same Entry gates above, applied to this leg specifically. This is the credit-collecting leg: the bet is the stock stays above this strike."), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 11,
      color: "var(--text-2)",
      margin: "6px 0 0"
    }
  }, /*#__PURE__*/React.createElement("b", null, "Closes \u2014 buy to close"), /*#__PURE__*/React.createElement(window.Help, {
    term: "buy_to_close"
  }), ":"), buyToCloseTriggers("short put")), /*#__PURE__*/React.createElement("div", {
    style: legStyle
  }, /*#__PURE__*/React.createElement("h5", {
    style: legTitle
  }, "BUY PUT (long leg \u2014 the loss cap)", /*#__PURE__*/React.createElement(window.Help, {
    term: "long_leg"
  }), /*#__PURE__*/React.createElement(PolicyFeedback, {
    section: "BUY PUT"
  })), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 11,
      color: "var(--text-2)",
      margin: "3px 0 0",
      maxWidth: 760
    }
  }, /*#__PURE__*/React.createElement("b", null, "Opens:"), " BUY TO OPEN a lower-strike put in the same order as its SELL PUT, sized to the Risk per position band above (", /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--mono)"
    }
  }, usd(c.min_notional), "\u2013", usd(c.max_notional)), "). This leg is never opened on its own \u2014 it exists purely to convert the short put's uncapped risk into a defined max loss (width minus credit received)."), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 11,
      color: "var(--text-2)",
      margin: "6px 0 0"
    }
  }, /*#__PURE__*/React.createElement("b", null, "Closes:"), " BUY TO CLOSE the SELL PUT is what actually locks in profit or loss on this pair \u2014 the long put is sold to close (or expires worthless) alongside it, same order, same moment. It is never traded independently of its short leg.")), /*#__PURE__*/React.createElement("div", {
    style: legStyle
  }, /*#__PURE__*/React.createElement("h5", {
    style: legTitle
  }, "SELL CALL (short leg \u2014 the credit)", /*#__PURE__*/React.createElement(window.Help, {
    term: "short_leg"
  }), /*#__PURE__*/React.createElement(PolicyFeedback, {
    section: "SELL CALL"
  })), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 11,
      color: "var(--text-2)",
      margin: "3px 0 0",
      maxWidth: 760
    }
  }, /*#__PURE__*/React.createElement("b", null, "Opens:"), " SELL TO OPEN a call with delta inside the band (", /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--mono)"
    }
  }, deltaBand), ") and win probability inside the band ", /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--mono)"
    }
  }, popBand), " \u2014 too far ITM is rejected as too risky, too far OTM is rejected as too safe \u2014 with", " ", /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--mono)"
    }
  }, dash(c.min_dte), "\u2013", dash(c.max_dte), "d"), " to expiry \u2014 the same Entry gates above, applied to this leg specifically. This is the credit-collecting leg: the bet is the stock stays below this strike."), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 11,
      color: "var(--text-2)",
      margin: "6px 0 0"
    }
  }, /*#__PURE__*/React.createElement("b", null, "Closes \u2014 buy to close"), /*#__PURE__*/React.createElement(window.Help, {
    term: "buy_to_close"
  }), ":"), buyToCloseTriggers("short call")), /*#__PURE__*/React.createElement("div", {
    style: legStyle
  }, /*#__PURE__*/React.createElement("h5", {
    style: legTitle
  }, "BUY CALL (long leg \u2014 the loss cap)", /*#__PURE__*/React.createElement(window.Help, {
    term: "long_leg"
  }), /*#__PURE__*/React.createElement(PolicyFeedback, {
    section: "BUY CALL"
  })), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 11,
      color: "var(--text-2)",
      margin: "3px 0 0",
      maxWidth: 760
    }
  }, /*#__PURE__*/React.createElement("b", null, "Opens:"), " BUY TO OPEN a higher-strike call in the same order as its SELL CALL, sized to the Risk per position band above (", /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--mono)"
    }
  }, usd(c.min_notional), "\u2013", usd(c.max_notional)), "). This leg is never opened on its own \u2014 it exists purely to convert the short call's uncapped risk into a defined max loss (width minus credit received)."), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 11,
      color: "var(--text-2)",
      margin: "6px 0 0"
    }
  }, /*#__PURE__*/React.createElement("b", null, "Closes:"), " BUY TO CLOSE the SELL CALL is what actually locks in profit or loss on this pair \u2014 the long call is sold to close (or expires worthless) alongside it, same order, same moment. It is never traded independently of its short leg.")));
}
function TickerCard({
  row,
  params,
  asOf
}) {
  var [tab, setTab] = useState("put_spreads");
  var rows = row[tab];
  var active = LADDERS.find(l => l.key === tab);
  // The page's own asOf is the client-observed completion time of the live
  // optionChain() call this row came from — the closest thing to "the
  // timestamp the live response actually carries" available here.
  var ivAsOf = asOf ? {
    quotes: asOf
  } : undefined;
  return /*#__PURE__*/React.createElement("section", {
    className: "card",
    style: {
      padding: 14,
      marginTop: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "baseline",
      justifyContent: "space-between",
      flexWrap: "wrap",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "baseline",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      margin: 0,
      fontSize: 18
    }
  }, row.ticker), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--mono)",
      color: "var(--text-2)"
    }
  }, usd2(row.spot))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      flexWrap: "wrap"
    }
  }, row.error && /*#__PURE__*/React.createElement(Chip, {
    tone: "bad",
    title: row.error
  }, "chain error"), row.csp_blocked_by_capital && /*#__PURE__*/React.createElement(Chip, {
    tone: "warn",
    title: `A cash-secured put needs strike x 100 in cash. At ${usd2(row.spot)} that exceeds the ${usd(params.max_collateral)} per-contract ceiling.`
  }, "CSP over cash ceiling"), row.lots > 0 ? /*#__PURE__*/React.createElement(Chip, {
    tone: "good",
    title: `${row.shares_owned} shares = ${row.lots} covered-call lot(s)`
  }, row.lots, " lot", row.lots > 1 ? "s" : "", " coverable") : /*#__PURE__*/React.createElement(Chip, {
    tone: "neutral",
    title: "Covered calls need 100+ shares of the underlying."
  }, "no shares held"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
      gap: 12,
      marginTop: 12
    }
  }, /*#__PURE__*/React.createElement(Stat, {
    label: "Contracts scanned",
    value: row.contracts_scanned
  }), /*#__PURE__*/React.createElement(Stat, {
    label: "Expiries in window",
    value: row.expiries?.length || 0
  }), /*#__PURE__*/React.createElement(Stat, {
    label: "Avg IV",
    value: pct(row.atm_iv),
    term: "iv",
    asOf: ivAsOf
  }), /*#__PURE__*/React.createElement(Stat, {
    label: "Shares owned",
    value: row.shares_owned
  }), /*#__PURE__*/React.createElement(Stat, {
    label: "Cheapest defined risk",
    value: usd(cheapestRisk(row))
  }), /*#__PURE__*/React.createElement(Stat, {
    label: "Candidates",
    value: LADDERS.reduce((n, l) => n + (row[l.key]?.length || 0), 0)
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      marginTop: 14,
      flexWrap: "wrap"
    }
  }, LADDERS.map(l => /*#__PURE__*/React.createElement("button", {
    key: l.key,
    onClick: () => setTab(l.key),
    title: l.hint,
    style: {
      fontSize: 11,
      padding: "4px 10px",
      background: tab === l.key ? "var(--accent)" : "var(--surface-2)",
      color: tab === l.key ? "var(--bg)" : "var(--text-2)",
      border: "1px solid var(--line)",
      borderRadius: 6,
      cursor: "pointer"
    }
  }, l.label, " (", row[l.key]?.length || 0, ")"))), active && /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 11,
      color: "var(--text-3)",
      margin: "8px 0 0"
    }
  }, active.hint), /*#__PURE__*/React.createElement(LadderTable, {
    rows: rows,
    kind: tab
  }));
}

// The smallest amount of capital that puts a trade on for this name — the
// number that decides how many positions the book can actually hold.
function cheapestRisk(row) {
  var all = LADDERS.flatMap(l => row[l.key] || []).map(r => r.collateral).filter(v => v > 0);
  return all.length ? Math.min(...all) : null;
}

// #options/AAPL and ?ticker=AAPL both deep-link a single stock. The hash form is
// canonical (it survives the static-site routing); the query form is accepted so
// a link pasted from anywhere still works.
function tickerFromUrl() {
  var fromHash = (location.hash || "").replace("#", "").split("/")[1];
  if (fromHash) return decodeURIComponent(fromHash).toUpperCase();
  var q = new URLSearchParams(location.search || "").get("ticker");
  return q ? q.toUpperCase() : "";
}

// One ticker in, its option detail out. Live-only: every render comes from
// window.OptimizationClient.optionChain() (a real Alpaca call through the
// trader API), never a bundled snapshot. The only snapshotting in this app
// happens at trade time (options_chain.snapshot_legs), not here.
function TickerDetailsPage() {
  var urlTicker = tickerFromUrl();
  var [input, setInput] = useState(urlTicker);
  var [row, setRow] = useState(null);
  var [params, setParams] = useState({});
  var [feed, setFeed] = useState("indicative");
  var [asOf, setAsOf] = useState("");
  var [busy, setBusy] = useState(false);
  var [note, setNote] = useState("");
  var lookup = async raw => {
    var t = String(raw || input).trim().toUpperCase();
    if (!t) return;
    setBusy(true);
    setNote("");
    // Make the URL match what's on screen, so the view is shareable/bookmarkable.
    if (tickerFromUrl() !== t) location.hash = `options/${t}`;
    try {
      var res = await window.OptimizationClient.optionChain(t, {
        max_dte: params.max_dte,
        max_collateral: params.max_collateral
      });
      setRow(res.ticker);
      setParams(res.params || params);
      setFeed(res.feed || feed);
      setAsOf(new Date().toISOString().slice(0, 19));
      if (res.ticker && res.ticker.error) setNote(`Chain error: ${res.ticker.error}`);
    } catch (err) {
      setRow(null);
      setAsOf("");
      setNote(`Live lookup failed (${err.message}). Start the local API with ` + `\`.venv/bin/python -m social_signals_trader.optimization_api\`.`);
    } finally {
      setBusy(false);
    }
  };

  // A deep link should render that ticker without the user touching anything.
  // Runs once on mount, and again if the hash changes under us (back button).
  useEffect(() => {
    if (urlTicker) lookup(urlTicker);
    var onHash = () => {
      var t = tickerFromUrl();
      if (t && t !== (row && row.ticker)) {
        setInput(t);
        lookup(t);
      }
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  var summary = window.optionsSummaryParts && window.optionsSummaryParts() || {};
  var tradeLog = window.optionsTradeLogParts && window.optionsTradeLogParts(window.SPREAD_LOG, summary.positionsCount) || {};

  // Reading order, top to bottom: what happened today → what we hold → the
  // full history of what we did → when positions roll off and where the book
  // stands → what we make of it → what to do → what's queued → the ticker
  // worksheet. Everything explanatory (how a credit spread works, the fund
  // policy, the rules, provenance) is compacted into one "Strategy & rules"
  // block at the very bottom: it's reference material, read once, not a live
  // reading.
  return /*#__PURE__*/React.createElement("main", {
    className: "shell opts-page",
    id: "ticker-details"
  }, /*#__PURE__*/React.createElement("header", {
    className: "opts-page-head"
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      margin: 0,
      fontSize: 20
    }
  }, "Options Log"), /*#__PURE__*/React.createElement("span", {
    className: "opts-page-sub"
  }, "every open credit spread, what it's worth now, and what we did"), /*#__PURE__*/React.createElement("p", {
    className: "opts-page-loop"
  }, "Three voices write this page: the ", /*#__PURE__*/React.createElement("b", null, "Analyst"), " reads the book and posts its opinion", " ", "(", summary.cadenceLabel || "on schedule", ", weekdays); you, the ", /*#__PURE__*/React.createElement("b", null, "User"), ", comment in public on any card or proposal; the ", /*#__PURE__*/React.createElement("b", null, "Trader"), " wakes on its own 15-minute tick and applies the fund's frozen rules \u2014 arithmetic only. The Analyst's read and your comments are for the human reading this page; neither is an input to the Trader's decision."), /*#__PURE__*/React.createElement(ExecutionState, null)), summary.empty || /*#__PURE__*/React.createElement(React.Fragment, null, summary.headline, /*#__PURE__*/React.createElement("div", {
    id: "options-summary"
  }, summary.positions)), window.ProposedTrades && /*#__PURE__*/React.createElement(window.ProposedTrades, null), /*#__PURE__*/React.createElement("div", {
    id: "options-trade-log"
  }, tradeLog.empty || tradeLog.tradeLog), summary.empty || /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Row2, null, tradeLog.expiryLadder, summary.whereBookStands), /*#__PURE__*/React.createElement(Row2, null, summary.whatWeThink, summary.actionQueue), /*#__PURE__*/React.createElement(Row2, null, tradeLog.openOrders)), tradeLog.foot, /*#__PURE__*/React.createElement("section", {
    className: "opts-worksheet"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "opts-section-title"
  }, "Ticker worksheet"), /*#__PURE__*/React.createElement("p", {
    className: "opts-page-sub"
  }, "Give it one ticker; it returns everything the options market will tell us about that name, scored for premium selling. Spreads are included so a $300 stock costs a few hundred dollars of risk instead of $30k of cash."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      alignItems: "center",
      marginTop: 10,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("input", {
    value: input,
    onChange: e => setInput(e.target.value.toUpperCase()),
    onKeyDown: e => {
      if (e.key === "Enter") lookup();
    },
    placeholder: "Ticker, e.g. AAPL",
    style: {
      background: "var(--surface-2)",
      border: "1px solid var(--line)",
      borderRadius: 6,
      padding: "7px 12px",
      color: "var(--text)",
      fontFamily: "var(--mono)",
      fontSize: 13,
      width: 160
    }
  }), /*#__PURE__*/React.createElement("button", {
    onClick: () => lookup(),
    disabled: busy || !input.trim(),
    style: {
      padding: "7px 16px",
      background: "var(--accent)",
      color: "var(--bg)",
      border: "1px solid var(--line)",
      borderRadius: 6,
      cursor: busy ? "wait" : "pointer",
      fontSize: 12,
      fontWeight: 600,
      opacity: busy || !input.trim() ? 0.6 : 1
    }
  }, busy ? "Loading…" : "Get options")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      flexWrap: "wrap",
      marginTop: 10
    }
  }, /*#__PURE__*/React.createElement(Chip, {
    tone: "neutral",
    title: "The free Alpaca tier. OPRA requires a signed agreement + Algo Trader Plus."
  }, "feed: ", feed), Object.keys(params).length > 0 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Chip, {
    tone: "neutral",
    title: "Exploratory scan filter \u2014 this worksheet, not the fund policy below."
  }, "scan: \u2264 ", params.max_dte, "d to expiry"), /*#__PURE__*/React.createElement(Chip, {
    tone: "neutral",
    title: "Exploratory scan filter \u2014 this worksheet, not the fund policy below."
  }, "scan: risk ceiling ", usd(params.max_collateral), "/position"), /*#__PURE__*/React.createElement(Chip, {
    tone: "neutral",
    title: "Exploratory scan filter \u2014 this worksheet, not the fund policy below."
  }, "scan: min credit ", usd2(params.min_credit))), asOf && /*#__PURE__*/React.createElement(Chip, {
    tone: "neutral"
  }, "as of ", String(asOf).replace("T", " "))), note && /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 12,
      color: "var(--text-3)",
      marginTop: 10,
      maxWidth: 760
    }
  }, note), row ? /*#__PURE__*/React.createElement(TickerCard, {
    row: row,
    params: params,
    asOf: asOf
  }) : busy ? /*#__PURE__*/React.createElement("p", {
    style: {
      color: "var(--text-3)",
      marginTop: 14
    }
  }, "Loading\u2026") : /*#__PURE__*/React.createElement("p", {
    style: {
      color: "var(--text-3)",
      marginTop: 14
    }
  }, "Enter a ticker above to pull its chain.")), /*#__PURE__*/React.createElement("section", {
    className: "opts-strategy"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "opts-section-title"
  }, "Strategy & rules"), summary.howto, /*#__PURE__*/React.createElement(StrategyPolicy, null), /*#__PURE__*/React.createElement(Row2, null, summary.rulesInForce, summary.provenance), /*#__PURE__*/React.createElement("p", {
    style: {
      color: "var(--text-3)",
      fontSize: 11,
      marginTop: 12,
      maxWidth: 760
    }
  }, "Win probability is approximated as 1 \u2212 |\u0394|, the standard dealer heuristic \u2014 it is not a guarantee, and it ignores the fat left tail a short put carries. Quotes come from Alpaca's free indicative feed, a derivative of OPRA rather than the consolidated book; treat the credit column as indicative, not fillable.")), window.SystemFeedbackPanel && /*#__PURE__*/React.createElement(window.SystemFeedbackPanel, null));
}
window.TickerDetailsPage = TickerDetailsPage;

/* ---- panels/strategies.jsx ---- */
/* global React, Sparkline */
var {
  useState: useStateS
} = React;
var STRAT_COLORS = {
  WSB: "oklch(0.78 0.18 25)",
  FUND: "oklch(0.78 0.16 145)",
  OPT: "oklch(0.78 0.14 235)",
  BLEND: "oklch(0.82 0.16 75)",
  DAY: "oklch(0.74 0.16 320)",
  VS: "oklch(0.80 0.14 180)",
  CONTRA: "oklch(0.66 0.10 280)"
};
function RetirementStatusPanel() {
  var rows = (window.STRATEGY_RETIREMENT_STATUS || []).filter(r => r.status === "RETIRED" || r.status === "SOFT_RETIRED");
  if (!rows.length) return null;
  function copyOverrideCmd(row) {
    var cmd = `python scripts/auto-retire-strategies.py --dry-run\n# To pin as ACTIVE, edit data/retired_strategies.json:\n# set "manual_override": "ACTIVE" for ${row.id}`;
    navigator.clipboard.writeText(cmd).then(() => {
      var el = document.getElementById(`retire-toast-${row.id}`);
      if (el) {
        el.style.opacity = 1;
        setTimeout(() => {
          el.style.opacity = 0;
        }, 2000);
      }
    });
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      borderLeft: "3px solid #e55"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "card-head"
  }, /*#__PURE__*/React.createElement("h3", null, "Retirement Status"), /*#__PURE__*/React.createElement("span", {
    className: "pill",
    style: {
      background: "#e552",
      color: "#e55"
    }
  }, rows.length, " affected")), /*#__PURE__*/React.createElement("div", {
    className: "card-body",
    style: {
      padding: 0
    }
  }, /*#__PURE__*/React.createElement("table", {
    style: {
      width: "100%",
      borderCollapse: "collapse",
      fontSize: 12
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", {
    style: {
      borderBottom: "1px solid var(--line)",
      color: "var(--muted)",
      textAlign: "left"
    }
  }, ["Sleeve", "Status", "Sharpe", "Max DD", "Trades", "Win%", "Reason", "Since", "Override"].map(h => /*#__PURE__*/React.createElement("th", {
    key: h,
    style: {
      padding: "6px 10px",
      fontWeight: 500
    }
  }, h)))), /*#__PURE__*/React.createElement("tbody", null, rows.map(r => /*#__PURE__*/React.createElement("tr", {
    key: r.id,
    style: {
      borderBottom: "1px solid var(--line)"
    }
  }, /*#__PURE__*/React.createElement("td", {
    style: {
      padding: "7px 10px",
      fontFamily: "var(--mono)",
      fontWeight: 600
    }
  }, r.id), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: "7px 10px"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: r.statusColor,
      fontWeight: 600
    }
  }, r.statusLabel), r.manualOverride && /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: 4,
      color: "var(--muted)",
      fontSize: 10
    }
  }, "\uD83D\uDCCC pinned")), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: "7px 10px",
      fontFamily: "var(--mono)"
    }
  }, r.trigger.sharpe != null ? r.trigger.sharpe.toFixed(2) : "—"), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: "7px 10px",
      fontFamily: "var(--mono)",
      color: "#e55"
    }
  }, r.trigger.maxDdPct != null ? r.trigger.maxDdPct.toFixed(1) + "%" : "—"), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: "7px 10px",
      fontFamily: "var(--mono)"
    }
  }, r.trigger.nTrades ?? "—"), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: "7px 10px",
      fontFamily: "var(--mono)"
    }
  }, r.trigger.winRate != null ? (r.trigger.winRate * 100).toFixed(0) + "%" : "—"), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: "7px 10px",
      color: "var(--muted)",
      maxWidth: 220,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    },
    title: r.reason
  }, r.reason), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: "7px 10px",
      color: "var(--muted)",
      whiteSpace: "nowrap"
    }
  }, (r.since || "").slice(0, 10)), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: "7px 10px",
      position: "relative"
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => copyOverrideCmd(r),
    style: {
      fontSize: 10,
      padding: "3px 8px",
      cursor: "pointer",
      background: "var(--surface-2)",
      border: "1px solid var(--line)",
      borderRadius: 3
    }
  }, "Copy override"), /*#__PURE__*/React.createElement("span", {
    id: `retire-toast-${r.id}`,
    style: {
      position: "absolute",
      left: 0,
      top: -22,
      background: "#222",
      color: "#fff",
      fontSize: 10,
      padding: "2px 6px",
      borderRadius: 3,
      opacity: 0,
      transition: "opacity 0.2s",
      whiteSpace: "nowrap"
    }
  }, "Copied!"))))))));
}
function StrategiesPage() {
  var strategies = window.STRATEGIES;
  var [selected, setSelected] = useStateS(strategies[0].id);

  // Real per-strategy equity (cumulative P&L) from snapshot.py. Only strategies
  // with closed trades appear here — empty/missing strategies are intentionally
  // dropped from the chart but kept in the legend (dimmed).
  var rawStrat = window.STRATEGY_EQUITY_SERIES || {};
  var rawSpy = window.SPY_BENCHMARK_SERIES || [];
  var {
    normalized,
    spyPts,
    unionDates,
    hasData
  } = React.useMemo(() => {
    var norm = {};
    var haveData = {};
    Object.keys(rawStrat).forEach(sid => {
      var arr = rawStrat[sid] || [];
      if (arr.length < 2) return;
      var base = arr[0].equity;
      if (!base) return;
      norm[sid] = arr.map(r => ({
        t: (r.t || "").slice(0, 10),
        value: r.equity / base * 100
      }));
      haveData[sid] = true;
    });
    var spyN = (rawSpy || []).map(r => ({
      t: (r.t || "").slice(0, 10),
      value: r.value
    }));
    var dateSet = new Set();
    Object.values(norm).forEach(arr => arr.forEach(p => p.t && dateSet.add(p.t)));
    spyN.forEach(p => p.t && dateSet.add(p.t));
    var dates = [...dateSet].sort();
    return {
      normalized: norm,
      spyPts: spyN,
      unionDates: dates,
      hasData: haveData
    };
  }, [rawStrat, rawSpy]);
  var sel = strategies.find(s => s.id === selected) || strategies[0];

  // Render combined chart
  var W = 760,
    H = 240,
    PAD_L = 44,
    PAD_R = 12,
    PAD_T = 12,
    PAD_B = 22;
  var dateToIdx = React.useMemo(() => {
    var m = new Map();
    unionDates.forEach((d, i) => m.set(d, i));
    return m;
  }, [unionDates]);
  var hasAny = unionDates.length >= 2;
  var allVals = [];
  Object.values(normalized).forEach(arr => arr.forEach(p => allVals.push(p.value)));
  spyPts.forEach(p => allVals.push(p.value));
  var min = hasAny ? Math.min(...allVals) * 0.99 : 95;
  var max = hasAny ? Math.max(...allVals) * 1.01 : 105;
  var range = max - min || 1;
  var xStep = hasAny ? (W - PAD_L - PAD_R) / Math.max(unionDates.length - 1, 1) : 0;
  var yFor = v => PAD_T + (max - v) / range * (H - PAD_T - PAD_B);
  var xFor = i => PAD_L + i * xStep;
  var yTicks = [min, min + range / 2, max];
  var linePts = arr => arr.map(p => {
    var i = dateToIdx.get(p.t);
    return i == null ? null : `${xFor(i)},${yFor(p.value)}`;
  }).filter(Boolean).join(" ");
  var live = strategies.filter(s => s.status === "LIVE");
  var exp = strategies.filter(s => s.status === "EXPERIMENTAL");
  var ytdVals = strategies.map(s => s.ytdPct);
  return /*#__PURE__*/React.createElement("main", {
    className: "shell"
  }, /*#__PURE__*/React.createElement(PageHeader, {
    title: "Strategies",
    subtitle: "Independent autonomous bots competing against each other and SPY \xB7 each fed by a different mix of subreddits"
  }), /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "statgrid"
  }, [["Live strategies", live.length], ["Experimental", exp.length], ["Best YTD", `+${Math.max(...ytdVals).toFixed(1)}%`, "up"], ["Worst YTD", `+${Math.min(...ytdVals).toFixed(1)}%`, ""], ["SPY benchmark", "+9.4%"], ["Auto-kill rule", "-15% DD"]].map((s, i) => /*#__PURE__*/React.createElement("div", {
    className: "stat",
    key: i
  }, /*#__PURE__*/React.createElement("div", {
    className: "label"
  }, s[0]), /*#__PURE__*/React.createElement("div", {
    className: `value ${s[2] || ""}`
  }, s[1]))))), /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "card-head"
  }, /*#__PURE__*/React.createElement("h3", null, "All strategies \xB7 YTD performance vs SPY"), /*#__PURE__*/React.createElement("div", {
    className: "row",
    style: {
      gap: 12,
      fontFamily: "var(--mono)",
      fontSize: 10.5,
      color: "var(--muted)",
      flexWrap: "wrap"
    }
  }, strategies.map(s => {
    var has = hasData[s.id];
    return /*#__PURE__*/React.createElement("span", {
      key: s.id,
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        opacity: has ? 1 : 0.35
      }
    }, /*#__PURE__*/React.createElement("i", {
      style: {
        width: 8,
        height: 8,
        background: STRAT_COLORS[s.id] || "var(--muted)",
        borderRadius: 2
      }
    }), s.id, !has && /*#__PURE__*/React.createElement("em", {
      style: {
        fontStyle: "normal",
        color: "var(--muted)"
      }
    }, " \xB7 no trades yet"));
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 5,
      opacity: spyPts.length >= 2 ? 1 : 0.35
    }
  }, /*#__PURE__*/React.createElement("i", {
    style: {
      width: 8,
      height: 8,
      background: "var(--muted)",
      borderRadius: 2
    }
  }), "SPY"))), /*#__PURE__*/React.createElement("div", {
    className: "chart-wrap"
  }, hasAny ? /*#__PURE__*/React.createElement("svg", {
    viewBox: `0 0 ${W} ${H}`,
    width: "100%",
    height: "240",
    style: {
      display: "block"
    }
  }, yTicks.map((v, i) => /*#__PURE__*/React.createElement("g", {
    key: i
  }, /*#__PURE__*/React.createElement("line", {
    x1: PAD_L,
    x2: W - PAD_R,
    y1: yFor(v),
    y2: yFor(v),
    stroke: "var(--line)",
    strokeDasharray: "2 4"
  }), /*#__PURE__*/React.createElement("text", {
    x: PAD_L - 6,
    y: yFor(v) + 3,
    fill: "var(--muted)",
    fontSize: "10",
    textAnchor: "end",
    fontFamily: "var(--mono)"
  }, (v - 100).toFixed(0), "%"))), /*#__PURE__*/React.createElement("line", {
    x1: PAD_L,
    x2: W - PAD_R,
    y1: yFor(100),
    y2: yFor(100),
    stroke: "var(--line-2)",
    strokeDasharray: "3 3"
  }), spyPts.length >= 2 && /*#__PURE__*/React.createElement("polyline", {
    points: linePts(spyPts),
    fill: "none",
    stroke: "var(--muted)",
    strokeWidth: "1.4",
    strokeDasharray: "3 3"
  }), strategies.map(s => {
    var arr = normalized[s.id];
    if (!arr) return null;
    return /*#__PURE__*/React.createElement("polyline", {
      key: s.id,
      points: linePts(arr),
      fill: "none",
      stroke: STRAT_COLORS[s.id] || "var(--muted)",
      strokeWidth: "1.6",
      strokeLinejoin: "round"
    });
  })) : /*#__PURE__*/React.createElement("div", {
    className: "mono",
    style: {
      padding: "40px 12px",
      color: "var(--muted)",
      fontSize: 12,
      textAlign: "center"
    }
  }, "Waiting for closed trades \xB7 curves render once strategies log \u22652 round-trips."))), /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "card-head"
  }, /*#__PURE__*/React.createElement("h3", null, "Leaderboard"), /*#__PURE__*/React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 10,
      color: "var(--muted)"
    }
  }, "ranked by YTD return")), /*#__PURE__*/React.createElement("div", {
    className: "card-body tight"
  }, /*#__PURE__*/React.createElement("table", {
    className: "trades"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Rank"), /*#__PURE__*/React.createElement("th", null, "Strategy"), /*#__PURE__*/React.createElement("th", null, "Feeds"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "YTD"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Sharpe"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Win rate"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Trades"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Max DD"), /*#__PURE__*/React.createElement("th", null, "Status"), /*#__PURE__*/React.createElement("th", null, "Curve"))), /*#__PURE__*/React.createElement("tbody", null, [...strategies].sort((a, b) => b.ytdPct - a.ytdPct).map((s, i) => {
    var sparkVals = (normalized[s.id] || []).map(p => p.value);
    return /*#__PURE__*/React.createElement("tr", {
      key: s.id,
      onClick: () => setSelected(s.id),
      style: {
        cursor: "pointer",
        background: selected === s.id ? "var(--surface-2)" : "transparent"
      }
    }, /*#__PURE__*/React.createElement("td", {
      className: "dim mono"
    }, String(i + 1).padStart(2, "0")), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 8
      }
    }, /*#__PURE__*/React.createElement("i", {
      style: {
        width: 8,
        height: 16,
        background: STRAT_COLORS[s.id] || "var(--muted)",
        borderRadius: 2
      }
    }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      className: "ticker"
    }, s.name), /*#__PURE__*/React.createElement("div", {
      className: "sub-cell"
    }, s.id)))), /*#__PURE__*/React.createElement("td", {
      className: "dim",
      style: {
        fontSize: 10.5
      }
    }, s.feeds.map(f => /*#__PURE__*/React.createElement("span", {
      key: f,
      style: {
        background: "var(--surface-2)",
        border: "1px solid var(--line)",
        padding: "1px 5px",
        borderRadius: 3,
        marginRight: 4
      }
    }, "r/", f))), /*#__PURE__*/React.createElement("td", {
      className: `num ${s.ytdPct >= 9.4 ? "up" : s.ytdPct >= 0 ? "" : "down"}`
    }, "+", s.ytdPct.toFixed(1), "%"), /*#__PURE__*/React.createElement("td", {
      className: "num"
    }, s.sharpe.toFixed(2)), /*#__PURE__*/React.createElement("td", {
      className: "num"
    }, (s.winRate * 100).toFixed(0), "%"), /*#__PURE__*/React.createElement("td", {
      className: "num dim"
    }, s.trades), /*#__PURE__*/React.createElement("td", {
      className: "num down"
    }, s.dd.toFixed(1), "%"), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("span", {
      className: `pill ${s.status === "LIVE" ? "holding" : "watching"}`
    }, s.status)), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement(Sparkline, {
      data: sparkVals,
      width: 80,
      height: 20,
      color: STRAT_COLORS[s.id] || "var(--muted)"
    })));
  }), /*#__PURE__*/React.createElement("tr", {
    style: {
      borderTop: "2px solid var(--line-2)",
      opacity: 0.7
    }
  }, /*#__PURE__*/React.createElement("td", {
    className: "dim mono"
  }, "\u2014"), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("i", {
    style: {
      width: 8,
      height: 16,
      background: "var(--muted)",
      borderRadius: 2
    }
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "ticker"
  }, "SPY (benchmark)"), /*#__PURE__*/React.createElement("div", {
    className: "sub-cell"
  }, "passive")))), /*#__PURE__*/React.createElement("td", {
    className: "dim"
  }, "\u2014"), /*#__PURE__*/React.createElement("td", {
    className: "num"
  }, "+9.4%"), /*#__PURE__*/React.createElement("td", {
    className: "num"
  }, "0.81"), /*#__PURE__*/React.createElement("td", {
    className: "num"
  }, "\u2014"), /*#__PURE__*/React.createElement("td", {
    className: "num dim"
  }, "\u2014"), /*#__PURE__*/React.createElement("td", {
    className: "num dim"
  }, "\u22124.2%"), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("span", {
    className: "pill"
  }, "BENCHMARK")), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement(Sparkline, {
    data: spyPts.map(p => p.value),
    width: 80,
    height: 20,
    color: "var(--muted)"
  }))))))), window.WSBHeadToHead && /*#__PURE__*/React.createElement(window.WSBHeadToHead, null), window.StrategyComparisonPanel && /*#__PURE__*/React.createElement(window.StrategyComparisonPanel, null), /*#__PURE__*/React.createElement(RetirementStatusPanel, null), /*#__PURE__*/React.createElement("div", {
    className: "card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "card-head"
  }, /*#__PURE__*/React.createElement("h3", null, sel.name, " \xB7 ", sel.id), /*#__PURE__*/React.createElement("span", {
    className: `pill ${sel.status === "LIVE" ? "holding" : "watching"}`
  }, sel.status)), /*#__PURE__*/React.createElement("div", {
    className: "card-body"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(6, 1fr)",
      border: "1px solid var(--line)",
      borderRadius: 4,
      marginBottom: 16
    }
  }, [["YTD return", `+${sel.ytdPct.toFixed(1)}%`, sel.ytdPct >= 9.4 ? "up" : "down"], ["vs SPY", `${sel.ytdPct - 9.4 >= 0 ? "+" : ""}${(sel.ytdPct - 9.4).toFixed(1)} pts`, sel.ytdPct >= 9.4 ? "up" : "down"], ["Sharpe", sel.sharpe.toFixed(2)], ["Win rate", (sel.winRate * 100).toFixed(0) + "%"], ["Trades", sel.trades], ["Max DD", sel.dd.toFixed(1) + "%", "down"]].map((s, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      padding: "12px 14px",
      borderRight: i < 5 ? "1px solid var(--line)" : "none"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "label",
    style: {
      fontFamily: "var(--mono)",
      fontSize: 10,
      textTransform: "uppercase",
      letterSpacing: "0.08em",
      color: "var(--muted)"
    }
  }, s[0]), /*#__PURE__*/React.createElement("div", {
    className: `mono ${s[2] || ""}`,
    style: {
      fontSize: 18,
      fontWeight: 600,
      marginTop: 2
    }
  }, s[1])))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "label",
    style: {
      fontFamily: "var(--mono)",
      fontSize: 10,
      textTransform: "uppercase",
      letterSpacing: "0.08em",
      color: "var(--muted)",
      marginBottom: 8
    }
  }, "Signal feeds"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 6
    }
  }, sel.feeds.map(f => {
    var sub = window.SUBREDDITS.find(x => x.name === f);
    return /*#__PURE__*/React.createElement("div", {
      key: f,
      style: {
        padding: 10,
        background: "var(--surface-2)",
        border: "1px solid var(--line)",
        borderRadius: 4,
        display: "grid",
        gridTemplateColumns: "1fr auto",
        gap: 12
      }
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      className: "ticker mono",
      style: {
        fontSize: 12,
        fontWeight: 600
      }
    }, "r/", f), /*#__PURE__*/React.createElement("div", {
      className: "mono",
      style: {
        fontSize: 10,
        color: "var(--muted)",
        marginTop: 2
      }
    }, sub ? `${sub.posts24h} posts/24h · sentiment ${sub.sentiment >= 0 ? "+" : ""}${sub.sentiment.toFixed(2)}` : "")), sub && /*#__PURE__*/React.createElement(Sparkline, {
      data: sub.pulse,
      width: 80,
      height: 22,
      color: STRAT_COLORS[sel.id]
    }));
  }))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "label",
    style: {
      fontFamily: "var(--mono)",
      fontSize: 10,
      textTransform: "uppercase",
      letterSpacing: "0.08em",
      color: "var(--muted)",
      marginBottom: 8
    }
  }, "How the signal is computed"), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      color: "var(--text-2)",
      fontSize: 13,
      lineHeight: 1.6
    }
  }, sel.id === "WSB" && "Weighted mention velocity from r/wallstreetbets and r/pennystocks. Signal fires when a ticker's 24h mention z-score crosses 2σ and aggregate sentiment > +0.4.", sel.id === "FUND" && "DD-flair posts in r/SecurityAnalysis and r/ValueInvesting weighted by post score. Signal fires only on tickers with conviction ≥ 0.7 and at least 2 independent posts.", sel.id === "OPT" && "Reads strike-and-expiry mentions from r/options and r/thetagang. Tracks unusual call/put structures and IV-regime chatter; fires structured trades.", sel.id === "BLEND" && "Cross-validates signals across r/stocks, r/investing and r/StockMarket. A ticker must surface in at least 2 of 3 with sentiment > +0.3 to fire.", sel.id === "DAY" && "Intraday momentum scanner using r/Daytrading post velocity. Short hold windows (<2 days). Higher trade count, lower per-trade edge.", sel.id === "VS" && "Trades the spread between WSB hype and SecurityAnalysis fundamentals: long when both align bullish, short hype-only signals SecurityAnalysis is silent on.", sel.id === "CONTRA" && "Fades extreme one-sided sentiment in r/wallstreetbets and r/pennystocks. Fires when sentiment > +0.85 or < −0.7 and post velocity is exhausting (3-day declining MA)."))))));
}
window.StrategiesPage = StrategiesPage;

/* ---- panels/macro.jsx ---- */
/* global React */

// Live MACRO_THEMES come from window.MACRO_THEMES, emitted by snapshot.py
// (aggregations.build_macro_themes — Alpaca BTC/GLD bars + burrow trending).
// No in-file synthetic series anymore: an empty/missing payload renders an
// honest empty state, not fake noise.

// ===== Macro page component =====
function MacroPage() {
  var themes = typeof window !== "undefined" && Array.isArray(window.MACRO_THEMES) ? window.MACRO_THEMES : [];
  var [selId, setSelId] = React.useState(themes[0] && themes[0].id || "AI");
  if (!themes.length) {
    return /*#__PURE__*/React.createElement("main", {
      className: "shell"
    }, /*#__PURE__*/React.createElement(PageHeader, {
      title: "Macro Themes",
      subtitle: "AI \xB7 Bitcoin \xB7 Gold \u2014 thematic indexes built from live bars + subreddit chatter"
    }), /*#__PURE__*/React.createElement("div", {
      className: "card"
    }, /*#__PURE__*/React.createElement("div", {
      className: "card-body"
    }, /*#__PURE__*/React.createElement("div", {
      className: "dim",
      style: {
        padding: "32px 0",
        textAlign: "center",
        fontFamily: "var(--mono)",
        fontSize: 12
      }
    }, "No macro data yet \u2014 waiting for next snapshot tick."))));
  }
  var sel = themes.find(t => t.id === selId) || themes[0];

  // Tolerate missing fields — live builders emit nulls/empties for
  // not-yet-populated fields (sentiment, talkingPoints, sourceBreakdown).
  var series = Array.isArray(sel.series) ? sel.series : [];
  var keyTickers = Array.isArray(sel.keyTickers) ? sel.keyTickers : [];
  var sourceBreakdown = Array.isArray(sel.sourceBreakdown) ? sel.sourceBreakdown : [];
  var talkingPoints = Array.isArray(sel.talkingPoints) ? sel.talkingPoints : [];
  var bullCount = Number(sel.bullCount || 0);
  var bearCount = Number(sel.bearCount || 0);
  var sentiment = sel.sentiment;
  var sentimentDelta = sel.sentimentDelta;
  var mentions24h = Number(sel.mentions24h || 0);
  var mentionsDelta = sel.mentionsDelta;
  var headlinePrice = sel.headlinePrice;
  var headlineValue = sel.headlineValue;
  var headlineDelta = sel.headlineDelta;
  var headlineDeltaPct = sel.headlineDeltaPct;

  // small line renderer
  var W = 760,
    H = 200,
    PAD_L = 50,
    PAD_R = 12,
    PAD_T = 12,
    PAD_B = 22;
  var hasSeries = series.length >= 2;
  var min = hasSeries ? Math.min(...series) * 0.99 : 0;
  var max = hasSeries ? Math.max(...series) * 1.01 : 1;
  var range = max - min || 1;
  var xStep = hasSeries ? (W - PAD_L - PAD_R) / (series.length - 1) : 0;
  var yFor = v => PAD_T + (max - v) / range * (H - PAD_T - PAD_B);
  var xFor = i => PAD_L + i * xStep;
  var pts = hasSeries ? series.map((v, i) => `${xFor(i)},${yFor(v)}`).join(" ") : "";
  var area = hasSeries ? `${PAD_L},${H - PAD_B} ${pts} ${xFor(series.length - 1)},${H - PAD_B}` : "";
  var yTicks = hasSeries ? [min, min + range / 2, max] : [];
  var fmtV = v => headlinePrice ? "$" + Math.round(v).toLocaleString() : v.toFixed(0);
  var totalShare = sourceBreakdown.reduce((a, b) => a + (b.share || 0), 0) || 1;
  var totalPosts = bullCount + bearCount;
  var bullPct = totalPosts ? bullCount / totalPosts : 0;
  return /*#__PURE__*/React.createElement("main", {
    className: "shell"
  }, /*#__PURE__*/React.createElement(PageHeader, {
    title: "Macro Themes",
    subtitle: "AI \xB7 Bitcoin \xB7 Gold \u2014 thematic indexes built from subreddit chatter, with the tickers each theme touches"
  }), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-12",
    style: {
      marginBottom: 12
    }
  }, themes.map(t => {
    var m24 = Number(t.mentions24h || 0);
    var hv = t.headlineValue;
    var hp = t.headlinePrice;
    var hd = t.headlineDelta;
    var hdp = t.headlineDeltaPct;
    var sLine = Array.isArray(t.series) ? t.series : [];
    return /*#__PURE__*/React.createElement("div", {
      key: t.id,
      className: "col-4 col-md-12"
    }, /*#__PURE__*/React.createElement("div", {
      onClick: () => setSelId(t.id),
      style: {
        background: "var(--surface)",
        border: "1px solid " + (selId === t.id ? t.color : "var(--line)"),
        borderRadius: 6,
        padding: 16,
        cursor: "pointer",
        boxShadow: selId === t.id ? `0 0 0 1px ${t.color} inset` : "none"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 10,
        marginBottom: 10
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 20,
        color: t.color,
        fontFamily: "var(--mono)"
      }
    }, t.icon), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: "var(--mono)",
        fontSize: 11,
        color: "var(--muted)",
        letterSpacing: "0.08em",
        textTransform: "uppercase"
      }
    }, t.id), /*#__PURE__*/React.createElement("span", {
      style: {
        marginLeft: "auto",
        fontSize: 11,
        color: "var(--muted)",
        fontFamily: "var(--mono)"
      }
    }, m24.toLocaleString(), " mentions/24h")), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 18,
        fontWeight: 600,
        marginBottom: 4
      }
    }, t.name), /*#__PURE__*/React.createElement("div", {
      className: "mono",
      style: {
        fontSize: 26,
        fontWeight: 600,
        letterSpacing: "-0.01em"
      }
    }, hv == null ? "—" : hp ? "$" + Number(hv).toLocaleString() : Number(hv).toFixed(1)), /*#__PURE__*/React.createElement("div", {
      className: "mono",
      style: {
        fontSize: 12,
        marginTop: 4
      }
    }, hd == null && hdp == null ? /*#__PURE__*/React.createElement("span", {
      className: "dim"
    }, "no \u0394 data") : /*#__PURE__*/React.createElement("span", {
      className: (hd ?? hdp) >= 0 ? "up" : "down"
    }, hd != null ? (hd >= 0 ? "+" : "") + Number(hd).toLocaleString() : "", hdp != null ? ` (${hdp >= 0 ? "+" : ""}${Number(hdp).toFixed(2)}%)` : ""), /*#__PURE__*/React.createElement("span", {
      className: "dim",
      style: {
        marginLeft: 6
      }
    }, "24h")), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 10
      }
    }, /*#__PURE__*/React.createElement(Sparkline, {
      data: sLine,
      width: 300,
      height: 36,
      color: t.color
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 14,
        marginTop: 10,
        fontFamily: "var(--mono)",
        fontSize: 10.5,
        color: "var(--muted)"
      }
    }, /*#__PURE__*/React.createElement("span", null, "sentiment ", t.sentiment == null ? /*#__PURE__*/React.createElement("span", {
      className: "dim"
    }, "\u2014") : /*#__PURE__*/React.createElement("span", {
      className: t.sentiment >= 0 ? "up" : "down"
    }, t.sentiment >= 0 ? "+" : "", Number(t.sentiment).toFixed(2))), /*#__PURE__*/React.createElement("span", null, "\u039424h ", t.sentimentDelta == null ? /*#__PURE__*/React.createElement("span", {
      className: "dim"
    }, "\u2014") : /*#__PURE__*/React.createElement("span", {
      className: t.sentimentDelta >= 0 ? "up" : "down"
    }, t.sentimentDelta >= 0 ? "+" : "", Number(t.sentimentDelta).toFixed(2))), /*#__PURE__*/React.createElement("span", {
      style: {
        marginLeft: "auto"
      }
    }, "mentions ", t.mentionsDelta == null ? /*#__PURE__*/React.createElement("span", {
      className: "dim"
    }, "\u2014") : /*#__PURE__*/React.createElement("span", {
      className: t.mentionsDelta >= 0 ? "up" : "down"
    }, t.mentionsDelta >= 0 ? "+" : "", Number(t.mentionsDelta).toFixed(0), "%")))));
  })), /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "card-head"
  }, /*#__PURE__*/React.createElement("h3", null, sel.name, " \xB7 60-day chart"), /*#__PURE__*/React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 10,
      color: "var(--muted)"
    }
  }, sel.headlineLabel)), /*#__PURE__*/React.createElement("div", {
    className: "chart-wrap"
  }, hasSeries ? /*#__PURE__*/React.createElement("svg", {
    viewBox: `0 0 ${W} ${H}`,
    width: "100%",
    height: "200",
    style: {
      display: "block"
    }
  }, yTicks.map((v, i) => /*#__PURE__*/React.createElement("g", {
    key: i
  }, /*#__PURE__*/React.createElement("line", {
    x1: PAD_L,
    x2: W - PAD_R,
    y1: yFor(v),
    y2: yFor(v),
    stroke: "var(--line)",
    strokeDasharray: "2 4"
  }), /*#__PURE__*/React.createElement("text", {
    x: PAD_L - 6,
    y: yFor(v) + 3,
    fill: "var(--muted)",
    fontSize: "10",
    textAnchor: "end",
    fontFamily: "var(--mono)"
  }, fmtV(v)))), /*#__PURE__*/React.createElement("polyline", {
    points: area,
    fill: sel.color,
    opacity: "0.10"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: pts,
    fill: "none",
    stroke: sel.color,
    strokeWidth: "1.8",
    strokeLinejoin: "round"
  })) : /*#__PURE__*/React.createElement("div", {
    className: "dim",
    style: {
      padding: "32px 0",
      textAlign: "center",
      fontFamily: "var(--mono)",
      fontSize: 12
    }
  }, "No price series available \u2014 check Alpaca / burrow data sources."))), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-12",
    style: {
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "col-7 col-md-12"
  }, /*#__PURE__*/React.createElement("div", {
    className: "card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "card-head"
  }, /*#__PURE__*/React.createElement("h3", null, "AI summary \xB7 what the 10 subs are saying about ", sel.name)), /*#__PURE__*/React.createElement("div", {
    className: "card-body"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr 1fr",
      gap: 0,
      border: "1px solid var(--line)",
      borderRadius: 4,
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "10px 14px",
      borderRight: "1px solid var(--line)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "label",
    style: {
      fontFamily: "var(--mono)",
      fontSize: 10,
      textTransform: "uppercase",
      letterSpacing: "0.08em",
      color: "var(--muted)"
    }
  }, "Aggregate sentiment"), /*#__PURE__*/React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 18,
      fontWeight: 600,
      marginTop: 2
    }
  }, sentiment == null ? /*#__PURE__*/React.createElement("span", {
    className: "dim"
  }, "\u2014") : /*#__PURE__*/React.createElement("span", {
    className: sentiment >= 0 ? "up" : "down"
  }, sentiment >= 0 ? "+" : "", Number(sentiment).toFixed(2)))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "10px 14px",
      borderRight: "1px solid var(--line)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "label",
    style: {
      fontFamily: "var(--mono)",
      fontSize: 10,
      textTransform: "uppercase",
      letterSpacing: "0.08em",
      color: "var(--muted)"
    }
  }, "Bull / Bear posts"), totalPosts > 0 ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 14,
      fontWeight: 600,
      marginTop: 2
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "up"
  }, bullCount.toLocaleString()), /*#__PURE__*/React.createElement("span", {
    className: "dim"
  }, " / "), /*#__PURE__*/React.createElement("span", {
    className: "down"
  }, bearCount.toLocaleString())), /*#__PURE__*/React.createElement("div", {
    style: {
      width: "100%",
      height: 4,
      background: "var(--neg-bg)",
      borderRadius: 2,
      marginTop: 6,
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: `${bullPct * 100}%`,
      height: "100%",
      background: "var(--pos)"
    }
  }))) : /*#__PURE__*/React.createElement("div", {
    className: "dim mono",
    style: {
      fontSize: 11.5,
      marginTop: 4
    }
  }, "Aggregate sentiment not yet computed.")), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "10px 14px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "label",
    style: {
      fontFamily: "var(--mono)",
      fontSize: 10,
      textTransform: "uppercase",
      letterSpacing: "0.08em",
      color: "var(--muted)"
    }
  }, "Mentions/24h"), /*#__PURE__*/React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 18,
      fontWeight: 600,
      marginTop: 2
    }
  }, mentions24h.toLocaleString(), mentionsDelta != null && /*#__PURE__*/React.createElement("span", {
    className: mentionsDelta >= 0 ? "up" : "down",
    style: {
      fontSize: 11
    }
  }, " ", mentionsDelta >= 0 ? "+" : "", Number(mentionsDelta).toFixed(0), "%")))), /*#__PURE__*/React.createElement("div", {
    className: "label",
    style: {
      fontFamily: "var(--mono)",
      fontSize: 10,
      textTransform: "uppercase",
      letterSpacing: "0.08em",
      color: "var(--muted)",
      marginBottom: 8
    }
  }, "Key talking points"), talkingPoints.length ? /*#__PURE__*/React.createElement("ul", {
    style: {
      margin: 0,
      padding: "0 0 0 16px",
      color: "var(--text-2)",
      fontSize: 13,
      lineHeight: 1.65
    }
  }, talkingPoints.map((tp, i) => /*#__PURE__*/React.createElement("li", {
    key: i,
    style: {
      marginBottom: 6
    }
  }, tp))) : /*#__PURE__*/React.createElement("div", {
    className: "dim",
    style: {
      fontFamily: "var(--mono)",
      fontSize: 11.5
    }
  }, "Talking points are agent-generated; not yet wired in this build.")))), /*#__PURE__*/React.createElement("div", {
    className: "col-5 col-md-12"
  }, /*#__PURE__*/React.createElement("div", {
    className: "card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "card-head"
  }, /*#__PURE__*/React.createElement("h3", null, "Where the chatter lives"), /*#__PURE__*/React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 10,
      color: "var(--muted)"
    }
  }, "share of ", sel.name, " mentions")), /*#__PURE__*/React.createElement("div", {
    className: "card-body"
  }, sourceBreakdown.length ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 8
    }
  }, sourceBreakdown.map(s => /*#__PURE__*/React.createElement("div", {
    key: s.sub,
    style: {
      display: "grid",
      gridTemplateColumns: "150px 1fr 50px",
      alignItems: "center",
      gap: 10,
      fontFamily: "var(--mono)",
      fontSize: 11.5
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--text-2)"
    }
  }, "r/", s.sub), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 16,
      background: "var(--surface-2)",
      borderRadius: 3,
      position: "relative",
      border: "1px solid var(--line)",
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: `${(s.share || 0) / totalShare * 100}%`,
      height: "100%",
      background: sel.color,
      opacity: 0.8
    }
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      textAlign: "right"
    }
  }, ((s.share || 0) * 100).toFixed(0), "%")))) : /*#__PURE__*/React.createElement("div", {
    className: "dim",
    style: {
      fontFamily: "var(--mono)",
      fontSize: 11.5
    }
  }, "Source breakdown not yet computed."))))), /*#__PURE__*/React.createElement("div", {
    className: "card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "card-head"
  }, /*#__PURE__*/React.createElement("h3", null, "Tickers tied to ", sel.name), /*#__PURE__*/React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 10,
      color: "var(--muted)"
    }
  }, "system positions tagged")), /*#__PURE__*/React.createElement("div", {
    className: "card-body tight"
  }, /*#__PURE__*/React.createElement("table", {
    className: "trades"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Ticker"), /*#__PURE__*/React.createElement("th", null, "Role"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Mentions 24h"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Sentiment"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Strategy P&L"), /*#__PURE__*/React.createElement("th", null, "Engine action"))), /*#__PURE__*/React.createElement("tbody", null, keyTickers.map(t => {
    var mn = Number(t.mentions || 0);
    var sn = t.sentiment;
    var pn = Number(t.pnl || 0);
    var action = t.action || "—";
    return /*#__PURE__*/React.createElement("tr", {
      key: t.ticker
    }, /*#__PURE__*/React.createElement("td", {
      className: "ticker"
    }, t.ticker), /*#__PURE__*/React.createElement("td", {
      className: "dim"
    }, t.role), /*#__PURE__*/React.createElement("td", {
      className: "num"
    }, mn.toLocaleString()), /*#__PURE__*/React.createElement("td", {
      className: "num"
    }, sn == null ? /*#__PURE__*/React.createElement("span", {
      className: "dim"
    }, "\u2014") : /*#__PURE__*/React.createElement("span", {
      className: sn >= 0 ? "up" : "down"
    }, sn >= 0 ? "+" : "", Number(sn).toFixed(2))), /*#__PURE__*/React.createElement("td", {
      className: `num ${pn > 0 ? "up" : pn < 0 ? "down" : "dim"}`
    }, pn === 0 ? "—" : (pn > 0 ? "+" : "−") + "$" + Math.abs(pn).toLocaleString()), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("span", {
      className: `pill ${action === "HOLDING" ? "holding" : action === "WATCHING" ? "watching" : typeof action === "string" && action.startsWith("STOPPED") ? "stopped" : typeof action === "string" && action.startsWith("CLOSED") ? "closed" : "passed"}`
    }, action)));
  }))))));
}
window.MacroPage = MacroPage;

/* ---- panels/event-cards.jsx ---- */
/* global React */
// Event-card panel (F8) — one card per (ticker, event_date) event.
// Reads window.EVENT_CARDS emitted by snapshot.py.
// Zero external dependencies; reuses existing dashboard CSS variables.

// ============== Conviction sparkline (SVG, no chart library) ==============
function ConvictionSparkline({
  points,
  width = 80,
  height = 24
}) {
  if (!points || points.length < 2) {
    return /*#__PURE__*/React.createElement("span", {
      style: {
        color: "var(--muted)",
        fontSize: 10
      }
    }, "\u2014");
  }
  var xs = points.map((_, i) => i / (points.length - 1) * width);
  var ys = points.map(p => height - (p.conviction || 0) * height);
  var d = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(" ");
  return /*#__PURE__*/React.createElement("svg", {
    width: width,
    height: height,
    style: {
      display: "block",
      overflow: "visible"
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: d,
    fill: "none",
    stroke: "var(--info)",
    strokeWidth: "1.5",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }));
}

// ============== Direction badge ==============
function DirBadge({
  direction
}) {
  var color = direction === "long" ? "var(--pos)" : direction === "short" ? "var(--neg)" : "var(--muted)";
  var label = (direction || "?").toUpperCase();
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-block",
      padding: "1px 6px",
      borderRadius: 3,
      fontSize: 10,
      fontFamily: "var(--mono)",
      fontWeight: 600,
      letterSpacing: "0.07em",
      border: `1px solid ${color}`,
      color
    }
  }, label);
}

// ============== Conviction bar ==============
function ConvictionBar({
  value
}) {
  var pct = Math.min(100, Math.max(0, (value || 0) * 100));
  var color = pct >= 65 ? "var(--pos)" : pct >= 40 ? "var(--warn)" : "var(--neg)";
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 60,
      height: 4,
      background: "var(--surface-2)",
      borderRadius: 2,
      overflow: "hidden",
      border: "1px solid var(--line)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: `${pct}%`,
      height: "100%",
      background: color
    }
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--mono)",
      fontSize: 10,
      color: "var(--text-2)",
      minWidth: 28
    }
  }, pct.toFixed(0), "%"));
}

// ============== P&L chip ==============
function PnlChip({
  pnl
}) {
  if (pnl === null || pnl === undefined) {
    return /*#__PURE__*/React.createElement("span", {
      style: {
        color: "var(--muted)",
        fontSize: 11
      }
    }, "\u2014");
  }
  var cls = pnl >= 0 ? "up" : "down";
  var sign = pnl >= 0 ? "+" : "−";
  return /*#__PURE__*/React.createElement("span", {
    className: cls,
    style: {
      fontFamily: "var(--mono)",
      fontSize: 11
    }
  }, sign, "$", Math.abs(pnl).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }));
}

// ============== Agreement bar ==============
function AgreementBar({
  agreement
}) {
  var long = (agreement.long_subs || []).length;
  var short = (agreement.short_subs || []).length;
  var neutral = (agreement.neutral_subs || []).length;
  var total = long + short + neutral || 1;
  var longPct = long / total * 100;
  var shortPct = short / total * 100;
  var neutPct = neutral / total * 100;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      height: 6,
      display: "flex",
      borderRadius: 3,
      overflow: "hidden",
      border: "1px solid var(--line)"
    }
  }, long > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      width: `${longPct}%`,
      background: "var(--pos)"
    },
    title: `long: ${agreement.long_subs.join(", ")}`
  }), neutral > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      width: `${neutPct}%`,
      background: "var(--muted)"
    },
    title: `neutral: ${agreement.neutral_subs.join(", ")}`
  }), short > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      width: `${shortPct}%`,
      background: "var(--neg)"
    },
    title: `short: ${agreement.short_subs.join(", ")}`
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--mono)",
      fontSize: 10,
      color: "var(--text-2)",
      whiteSpace: "nowrap"
    }
  }, long, "L / ", short, "S \xB7 ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: agreement.consensus_direction === "long" ? "var(--pos)" : agreement.consensus_direction === "short" ? "var(--neg)" : "var(--warn)"
    }
  }, agreement.consensus_direction, " ", Math.round((agreement.consensus_strength || 0) * 100), "%")));
}

// ============== Single event card ==============
function EventCard({
  card
}) {
  var daysUntil = Math.ceil((new Date(card.event_date) - new Date()) / 86400000);
  var countdown = daysUntil >= 0 ? `T-${daysUntil}d` : `T+${-daysUntil}d`;
  return /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "card-head",
    style: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      margin: 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "ticker mono",
    style: {
      fontSize: 17,
      fontWeight: 700
    }
  }, card.ticker), card.catalyst && /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: 8,
      fontSize: 11,
      fontFamily: "var(--mono)",
      color: "var(--accent)",
      letterSpacing: "0.07em",
      textTransform: "uppercase"
    }
  }, card.catalyst)), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--mono)",
      fontSize: 11,
      color: "var(--text-2)"
    }
  }, card.event_date, /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: 6,
      color: daysUntil >= 0 ? "var(--warn)" : "var(--muted)"
    }
  }, countdown)), /*#__PURE__*/React.createElement("div", {
    style: {
      marginLeft: "auto",
      display: "flex",
      gap: 10,
      flexWrap: "wrap"
    }
  }, Object.entries(card.state_summary || {}).filter(([, v]) => v > 0).map(([k, v]) => /*#__PURE__*/React.createElement("span", {
    key: k,
    style: {
      fontFamily: "var(--mono)",
      fontSize: 10,
      color: "var(--muted)",
      textTransform: "uppercase",
      letterSpacing: "0.06em"
    }
  }, k, " ", v)))), /*#__PURE__*/React.createElement("div", {
    className: "card-body tight",
    style: {
      padding: 0
    }
  }, /*#__PURE__*/React.createElement("table", {
    className: "trades",
    style: {
      width: "100%"
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Subreddit"), /*#__PURE__*/React.createElement("th", null, "Dir"), /*#__PURE__*/React.createElement("th", null, "Conviction"), /*#__PURE__*/React.createElement("th", null, "Timeline"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Qty @ Entry"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Exit"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "P&L"), /*#__PURE__*/React.createElement("th", null, "State"))), /*#__PURE__*/React.createElement("tbody", null, (card.subreddits || []).map(sub => /*#__PURE__*/React.createElement("tr", {
    key: sub.thesis_key || sub.subreddit
  }, /*#__PURE__*/React.createElement("td", {
    style: {
      fontFamily: "var(--mono)",
      fontSize: 12
    }
  }, "r/", sub.subreddit), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement(DirBadge, {
    direction: sub.direction
  })), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement(ConvictionBar, {
    value: sub.conviction_now
  })), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement(ConvictionSparkline, {
    points: sub.sentiment_timeline
  })), /*#__PURE__*/React.createElement("td", {
    className: "num",
    style: {
      fontFamily: "var(--mono)",
      fontSize: 11
    }
  }, sub.qty != null ? `${sub.qty}sh` : "—", sub.entry_price != null ? /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--muted)"
    }
  }, " @ $", sub.entry_price.toFixed(2)) : null), /*#__PURE__*/React.createElement("td", {
    className: "num",
    style: {
      fontFamily: "var(--mono)",
      fontSize: 11
    }
  }, sub.exit_price != null ? `$${sub.exit_price.toFixed(2)}` : "—"), /*#__PURE__*/React.createElement("td", {
    className: "num"
  }, /*#__PURE__*/React.createElement(PnlChip, {
    pnl: sub.realized_pnl_usd != null ? sub.realized_pnl_usd : sub.unrealized_pnl_usd
  })), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("span", {
    className: "pill",
    style: {
      fontSize: 9,
      letterSpacing: "0.05em"
    }
  }, sub.current_state))))))), card.summary && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "8px 14px",
      borderTop: "1px solid var(--line)",
      display: "flex",
      gap: 24,
      flexWrap: "wrap",
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--mono)",
      fontSize: 11,
      color: "var(--text-2)"
    }
  }, "Total: ", card.summary.total_qty || 0, "sh \xB7 $", (card.summary.total_notional_usd || 0).toLocaleString()), card.summary.blended_realized_pnl != null && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--mono)",
      fontSize: 11
    }
  }, "Realized: ", /*#__PURE__*/React.createElement(PnlChip, {
    pnl: card.summary.blended_realized_pnl
  })), card.summary.blended_unrealized_pnl != null && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--mono)",
      fontSize: 11
    }
  }, "Unrealized: ", /*#__PURE__*/React.createElement(PnlChip, {
    pnl: card.summary.blended_unrealized_pnl
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginLeft: "auto",
      flex: 1,
      minWidth: 180
    }
  }, /*#__PURE__*/React.createElement(AgreementBar, {
    agreement: card.agreement || {
      long_subs: [],
      short_subs: [],
      neutral_subs: [],
      consensus_direction: "split",
      consensus_strength: 0
    }
  }))));
}

// ============== Event card list (section) ==============
function EventCardList() {
  var raw = window.EVENT_CARDS;
  if (!raw || typeof raw !== "object" || Object.keys(raw).length === 0) {
    return /*#__PURE__*/React.createElement("p", {
      style: {
        color: "var(--muted)",
        fontFamily: "var(--mono)",
        fontSize: 13
      }
    }, "No upcoming events with sentiment data yet.");
  }

  // Sort by event_date ascending.
  var cards = Object.values(raw).sort((a, b) => (a.event_date || "").localeCompare(b.event_date || ""));
  return /*#__PURE__*/React.createElement("div", {
    className: "event-card-grid"
  }, cards.map(card => /*#__PURE__*/React.createElement(EventCard, {
    key: `${card.ticker}:${card.event_date}`,
    card: card
  })));
}

// Expose to global scope for use in pages.jsx / app.jsx.
Object.assign(window, {
  EventCard,
  EventCardList,
  ConvictionSparkline,
  AgreementBar
});

/* ---- panels/catalyst-window.jsx ---- */
/* global React */

var EMPTY_CATALYST_WINDOW = {
  withinDays: 7,
  asOf: null,
  entries: [],
  grouped: {},
  counts: {
    total: 0,
    byCatalyst: {}
  }
};
function CatalystChip({
  catalyst
}) {
  var label = (catalyst || "").replace(/_/g, " ").toUpperCase();
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-block",
      padding: "1px 6px",
      borderRadius: 3,
      fontSize: 10,
      fontFamily: "var(--mono)",
      fontWeight: 600,
      letterSpacing: "0.07em",
      border: "1px solid var(--accent)",
      color: "var(--accent)"
    }
  }, label);
}
function CatalystRow({
  entry
}) {
  return /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    style: {
      fontFamily: "var(--mono)",
      fontSize: 12,
      fontWeight: 600
    }
  }, entry.ticker || /*#__PURE__*/React.createElement("span", {
    className: "dim"
  }, "\u2014")), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement(CatalystChip, {
    catalyst: entry.catalyst
  })), /*#__PURE__*/React.createElement("td", {
    style: {
      fontSize: 12,
      color: "var(--text-2)"
    }
  }, entry.subject || "—"), /*#__PURE__*/React.createElement("td", {
    style: {
      fontFamily: "var(--mono)",
      fontSize: 11
    }
  }, entry.confirmed ? /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--pos)"
    }
  }, "confirmed") : /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--warn)"
    }
  }, "unconfirmed")), /*#__PURE__*/React.createElement("td", {
    style: {
      fontFamily: "var(--mono)",
      fontSize: 10,
      color: "var(--muted)"
    }
  }, entry.source || ""));
}
function CatalystDateGroup({
  date,
  entries
}) {
  var daysAway = entries[0] && entries[0].daysAway != null ? entries[0].daysAway : null;
  var countdown = daysAway == null ? "" : daysAway === 0 ? "today" : `T-${daysAway}d`;
  return /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "card-head",
    style: {
      display: "flex",
      alignItems: "center",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      margin: 0,
      fontSize: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--mono)"
    }
  }, date), countdown && /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: 8,
      fontSize: 11,
      fontFamily: "var(--mono)",
      color: "var(--warn)"
    }
  }, countdown)), /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: "auto",
      fontFamily: "var(--mono)",
      fontSize: 10,
      color: "var(--muted)"
    }
  }, entries.length, " ", entries.length === 1 ? "catalyst" : "catalysts")), /*#__PURE__*/React.createElement("div", {
    className: "card-body tight",
    style: {
      padding: 0
    }
  }, /*#__PURE__*/React.createElement("table", {
    className: "trades",
    style: {
      width: "100%"
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Ticker"), /*#__PURE__*/React.createElement("th", null, "Catalyst"), /*#__PURE__*/React.createElement("th", null, "Subject"), /*#__PURE__*/React.createElement("th", null, "Status"), /*#__PURE__*/React.createElement("th", null, "Source"))), /*#__PURE__*/React.createElement("tbody", null, entries.map((e, i) => /*#__PURE__*/React.createElement(CatalystRow, {
    key: `${e.ticker}-${e.catalyst}-${i}`,
    entry: e
  }))))));
}
function CatalystWindowPanel() {
  var raw = window.CATALYST_WINDOW || EMPTY_CATALYST_WINDOW;
  var counts = raw.counts || EMPTY_CATALYST_WINDOW.counts;
  var grouped = raw.grouped || {};
  var dates = Object.keys(grouped).sort();
  if (!counts.total) {
    return /*#__PURE__*/React.createElement("p", {
      style: {
        color: "var(--muted)",
        fontFamily: "var(--mono)",
        fontSize: 13
      }
    }, "No catalysts in window", raw.withinDays ? ` (next ${raw.withinDays}d)` : "", ".");
  }
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 10,
      display: "flex",
      flexWrap: "wrap",
      gap: 12,
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--mono)",
      fontSize: 11,
      color: "var(--text-2)"
    }
  }, counts.total, " catalyst", counts.total === 1 ? "" : "s", " in next ", raw.withinDays, "d", raw.asOf && /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--muted)"
    }
  }, " \xB7 as of ", raw.asOf)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      flexWrap: "wrap"
    }
  }, Object.entries(counts.byCatalyst || {}).map(([k, v]) => /*#__PURE__*/React.createElement("span", {
    key: k,
    style: {
      fontFamily: "var(--mono)",
      fontSize: 10,
      color: "var(--muted)",
      border: "1px solid var(--line)",
      padding: "1px 6px",
      borderRadius: 3,
      textTransform: "uppercase",
      letterSpacing: "0.06em"
    }
  }, k.replace(/_/g, " "), " ", v)))), dates.map(date => /*#__PURE__*/React.createElement(CatalystDateGroup, {
    key: date,
    date: date,
    entries: grouped[date]
  })));
}
Object.assign(window, {
  CatalystWindowPanel,
  CatalystDateGroup,
  CatalystRow
});

/* ---- panels/upcoming-catalysts-widget.jsx ---- */
/* global React */
/* PRD 76 — Upcoming Catalysts widget.
 *
 * Consumes `window.UPCOMING_CATALYSTS` (built by
 * `aggregations.build_upcoming_catalysts`). Renders a compact, grouped-by-
 * date list with hover (desktop) / tap (mobile) popovers that surface the
 * position, thesis, and a concrete "what's the plan today" action.
 *
 * Design judgment:
 *  - Stays visually compact at desktop (max-height + scroll); the hero P&L
 *    remains the headline.
 *  - Tier badge reuses the same colour map as PRD 74's <TierBadge /> so the
 *    user's eye trains on one consistent semantic.
 *  - Plan-today phrasing is derived from days-away (single source of truth)
 *    so we don't drift from the trader's entry-window math.
 */

var UC_EMPTY = {
  asOf: null,
  withinDays: 10,
  entries: [],
  counts: {
    total: 0,
    held: 0,
    withThesis: 0
  }
};

// ---------- pure helpers ----------

function formatDateHeader(iso) {
  if (!iso) return "—";
  // Treat as US-Eastern calendar date (matches the trader's NY-anchored day).
  var d = new Date(iso + "T12:00:00Z");
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric"
  });
}
function fmtMoney(v) {
  if (v == null || Number.isNaN(v)) return "—";
  var sign = v >= 0 ? "+$" : "−$";
  return sign + Math.abs(v).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}
function fmtPct(v) {
  if (v == null || Number.isNaN(v)) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}
function catalystLabel(c) {
  return (c || "").replace(/_/g, " ").toUpperCase();
}

// Group entries by date. O(n) single pass; entries are already sorted server-side.
function groupByDate(entries) {
  var out = [];
  var current = null;
  for (var e of entries || []) {
    if (!current || current.date !== e.date) {
      current = {
        date: e.date,
        rows: []
      };
      out.push(current);
    }
    current.rows.push(e);
  }
  return out;
}

// Plan-today phrasing. Driven by daysAway + position state so the user can
// glance at the row and know what (if anything) the trader will do today.
function planForToday(entry) {
  var d = entry.daysAway;
  var pos = entry.position;
  if (pos) {
    if (d != null && d <= 0) return "EXIT at close (event today)";
    if (d != null && d === 1) return "HOLD into event (T-1)";
    return "HOLD";
  }
  // No position yet.
  if (d != null && d <= 0) return "Event passed — skip";
  if (d != null && d === 1) {
    return entry.thesis && entry.thesis.direction === "short" ? "Plan: SHORT $5k at open (T-1)" : "Plan: BUY $5k at open (T-1)";
  }
  return "Wait — entry window opens T-1";
}

// Compact deterministic exit-policy summary, e.g. "@open T+1 · stop 10d · −5% circuit".
// Mirrors the backend `exitPlan` policy facts so the chip line never drifts from
// what the trader actually enforces.
function exitPolicyChips(exitPlan) {
  if (!exitPlan) return [];
  var chips = [];
  if (exitPlan.intradayOnly) {
    chips.push("intraday only");
  } else if (exitPlan.exitAt != null && exitPlan.exitLagDays != null) {
    var lag = exitPlan.exitLagDays === 0 ? "T" : `T+${exitPlan.exitLagDays}`;
    chips.push(`@${exitPlan.exitAt} ${lag}`);
  }
  if (exitPlan.timeStopDays != null) chips.push(`time-stop ${exitPlan.timeStopDays}d`);
  if (exitPlan.dailyLossCircuitPct != null) chips.push(`−${exitPlan.dailyLossCircuitPct}% circuit`);
  return chips;
}

// Map a signal-builder avg_sentiment (−1..1) to an up/down/neutral class.
function sentimentTone(avg) {
  if (avg == null || Number.isNaN(avg)) return "dim";
  if (avg > 0.05) return "up";
  if (avg < -0.05) return "down";
  return "dim";
}

// ---------- subcomponents ----------

function PositionDot({
  position
}) {
  // Hollow = no position; filled green = long held; filled red = short held.
  if (!position) {
    return /*#__PURE__*/React.createElement("span", {
      className: "uc-position-dot uc-dot-empty",
      "aria-label": "no position",
      title: "No position"
    }, "\u25CB");
  }
  var isShort = position.side === "SHORT";
  var cls = isShort ? "uc-dot-short" : "uc-dot-long";
  var label = isShort ? "Short position open" : "Long position open";
  return /*#__PURE__*/React.createElement("span", {
    className: `uc-position-dot ${cls}`,
    "aria-label": label,
    title: label
  }, "\u25CF");
}
function UcTierBadge({
  tier,
  kind
}) {
  if (!tier) return null;
  var t = String(tier).toLowerCase();
  var map = {
    social: {
      bg: "var(--pos)",
      fg: "#0a0e14",
      label: "SOCIAL"
    },
    options_tech: {
      bg: "var(--accent)",
      fg: "#0a0e14",
      label: "OPTIONS/TECH"
    },
    naive: {
      bg: "var(--muted)",
      fg: "#0a0e14",
      label: "NAIVE"
    }
  };
  var cfg = map[t] || {
    bg: "var(--muted)",
    fg: "#0a0e14",
    label: t.toUpperCase()
  };
  var isForecast = kind === "forecast";
  return /*#__PURE__*/React.createElement("span", {
    className: "uc-tier-badge tier-badge",
    title: isForecast ? `forecast tier: ${t}` : `fired tier: ${t}`,
    style: {
      background: cfg.bg,
      color: cfg.fg,
      opacity: isForecast ? 0.55 : 1,
      borderStyle: isForecast ? "dashed" : "solid"
    }
  }, cfg.label, isForecast ? "?" : "");
}
function PositionBlock({
  position
}) {
  if (!position) return null;
  return /*#__PURE__*/React.createElement("div", {
    className: "uc-pop-block"
  }, /*#__PURE__*/React.createElement("div", {
    className: "uc-pop-block-title"
  }, "Position"), /*#__PURE__*/React.createElement("div", {
    className: "uc-pop-grid"
  }, /*#__PURE__*/React.createElement("span", {
    className: "uc-pop-k"
  }, "Side"), /*#__PURE__*/React.createElement("span", {
    className: `uc-pop-v mono ${position.side === "LONG" ? "up" : "down"}`
  }, position.side), /*#__PURE__*/React.createElement("span", {
    className: "uc-pop-k"
  }, "Qty"), /*#__PURE__*/React.createElement("span", {
    className: "uc-pop-v mono"
  }, position.qty), /*#__PURE__*/React.createElement("span", {
    className: "uc-pop-k"
  }, "Avg entry"), /*#__PURE__*/React.createElement("span", {
    className: "uc-pop-v mono"
  }, "$", (position.avgEntry || 0).toFixed(2)), /*#__PURE__*/React.createElement("span", {
    className: "uc-pop-k"
  }, "Current"), /*#__PURE__*/React.createElement("span", {
    className: "uc-pop-v mono"
  }, "$", (position.currentPrice || 0).toFixed(2)), /*#__PURE__*/React.createElement("span", {
    className: "uc-pop-k"
  }, "Unrealized"), /*#__PURE__*/React.createElement("span", {
    className: `uc-pop-v mono ${(position.unrealizedPl || 0) >= 0 ? "up" : "down"}`
  }, fmtMoney(position.unrealizedPl), " (", fmtPct(position.unrealizedPlPct), ")")));
}
function ThesisBlock({
  thesis,
  tier,
  tierKind
}) {
  if (!thesis) {
    return /*#__PURE__*/React.createElement("div", {
      className: "uc-pop-block"
    }, /*#__PURE__*/React.createElement("div", {
      className: "uc-pop-block-title"
    }, "Thesis"), /*#__PURE__*/React.createElement("div", {
      className: "uc-pop-empty"
    }, "No social signal \u2014 calendar sweeper will fire as ", /*#__PURE__*/React.createElement("em", null, "tier ", tier), "."));
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "uc-pop-block"
  }, /*#__PURE__*/React.createElement("div", {
    className: "uc-pop-block-title"
  }, "Thesis \xB7 ", thesis.state), /*#__PURE__*/React.createElement("div", {
    className: "uc-pop-grid"
  }, /*#__PURE__*/React.createElement("span", {
    className: "uc-pop-k"
  }, "Direction"), /*#__PURE__*/React.createElement("span", {
    className: `uc-pop-v mono ${thesis.direction === "long" ? "up" : "down"}`
  }, (thesis.direction || "").toUpperCase()), /*#__PURE__*/React.createElement("span", {
    className: "uc-pop-k"
  }, "Confidence"), /*#__PURE__*/React.createElement("span", {
    className: "uc-pop-v mono"
  }, (thesis.confidence * 100).toFixed(0), "%"), /*#__PURE__*/React.createElement("span", {
    className: "uc-pop-k"
  }, "Tier"), /*#__PURE__*/React.createElement("span", {
    className: "uc-pop-v mono"
  }, tier, " ", /*#__PURE__*/React.createElement("span", {
    className: "dim"
  }, "(", tierKind, ")")), /*#__PURE__*/React.createElement("span", {
    className: "uc-pop-k"
  }, "Source"), /*#__PURE__*/React.createElement("span", {
    className: "uc-pop-v mono"
  }, thesis.extractedBy || "—")), thesis.evidence && /*#__PURE__*/React.createElement("div", {
    className: "uc-pop-evidence"
  }, /*#__PURE__*/React.createElement("div", {
    className: "uc-pop-block-title"
  }, "Evidence"), /*#__PURE__*/React.createElement("div", {
    className: "uc-pop-evidence-body"
  }, thesis.evidence)));
}

// Explicit status disambiguates "checked, found nothing" from "call failed".
// Legacy payloads (pre-PRD 346) carry no `status` field at all — treat those
// as "ok" so old snapshots keep rendering the bar exactly as before.
function sentimentStatus(sentiment) {
  if (!sentiment) return "unavailable";
  return sentiment.status || "ok";
}

// Sentiment — signal-builder social read (bull/bear + avg) shown side-by-side
// with the trader's own thesis stance, so divergence is obvious at a glance.
function SentimentBlock({
  sentiment,
  thesis
}) {
  var hasThesis = !!thesis;
  var status = sentimentStatus(sentiment);
  var bull = sentiment && sentiment.bullishPct != null ? sentiment.bullishPct : null;
  var bear = sentiment && sentiment.bearishPct != null ? sentiment.bearishPct : null;
  return /*#__PURE__*/React.createElement("div", {
    className: "uc-pop-block"
  }, /*#__PURE__*/React.createElement("div", {
    className: "uc-pop-block-title"
  }, "Sentiment"), /*#__PURE__*/React.createElement("div", {
    className: "uc-sent-cols"
  }, /*#__PURE__*/React.createElement("div", {
    className: "uc-sent-col"
  }, /*#__PURE__*/React.createElement("div", {
    className: "uc-sent-col-head"
  }, "Social ", /*#__PURE__*/React.createElement("span", {
    className: "dim"
  }, "\xB7 signal-builder")), status === "unavailable" ? /*#__PURE__*/React.createElement("div", {
    className: "uc-sent-body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "uc-sent-meta mono warn"
  }, "no data \u2014 signal-builder degraded/timeout"), sentiment && sentiment.asOf && /*#__PURE__*/React.createElement("div", {
    className: "uc-sent-sub dim"
  }, "last known ", sentiment.asOf)) : status === "quiet" ? /*#__PURE__*/React.createElement("div", {
    className: "uc-sent-body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "uc-sent-meta mono dim"
  }, "0 mentions \u2014 checked, quiet"), sentiment.asOf && /*#__PURE__*/React.createElement("div", {
    className: "uc-sent-sub dim"
  }, "as of ", sentiment.asOf)) : /*#__PURE__*/React.createElement("div", {
    className: "uc-sent-body"
  }, (bull != null || bear != null) && /*#__PURE__*/React.createElement("div", {
    className: "uc-sent-bar",
    title: `bull ${bull ?? "—"}% / bear ${bear ?? "—"}%`
  }, /*#__PURE__*/React.createElement("span", {
    className: "uc-sent-bull",
    style: {
      width: `${bull ?? 0}%`
    }
  }), /*#__PURE__*/React.createElement("span", {
    className: "uc-sent-bear",
    style: {
      width: `${bear ?? 0}%`
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "uc-sent-meta mono"
  }, /*#__PURE__*/React.createElement("span", {
    className: sentimentTone(sentiment.avgSentiment)
  }, sentiment.label || (sentiment.avgSentiment != null ? (sentiment.avgSentiment >= 0 ? "net +" : "net ") + sentiment.avgSentiment : "—")), bull != null && /*#__PURE__*/React.createElement("span", {
    className: "dim"
  }, " \xB7 bull ", Math.round(bull), "%"), bear != null && /*#__PURE__*/React.createElement("span", {
    className: "dim"
  }, " / bear ", Math.round(bear), "%"), /*#__PURE__*/React.createElement("span", {
    className: "dim"
  }, " \xB7 ", sentiment.mentions, " mentions"), sentiment.asOf && /*#__PURE__*/React.createElement("span", {
    className: "dim"
  }, " \xB7 as of ", sentiment.asOf)), sentiment.topSubreddit && /*#__PURE__*/React.createElement("div", {
    className: "uc-sent-sub dim"
  }, "top: r/", sentiment.topSubreddit))), /*#__PURE__*/React.createElement("div", {
    className: "uc-sent-col"
  }, /*#__PURE__*/React.createElement("div", {
    className: "uc-sent-col-head"
  }, "Thesis ", /*#__PURE__*/React.createElement("span", {
    className: "dim"
  }, "\xB7 trader")), hasThesis ? /*#__PURE__*/React.createElement("div", {
    className: "uc-sent-body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "uc-sent-meta mono"
  }, /*#__PURE__*/React.createElement("span", {
    className: thesis.direction === "long" ? "up" : "down"
  }, (thesis.direction || "").toUpperCase()), /*#__PURE__*/React.createElement("span", {
    className: "dim"
  }, " \xB7 conf ", (thesis.confidence * 100).toFixed(0), "%")), /*#__PURE__*/React.createElement("div", {
    className: "uc-sent-sub dim"
  }, "state ", thesis.state || "—")) : /*#__PURE__*/React.createElement("div", {
    className: "uc-pop-empty"
  }, "No thesis \u2014 calendar sweeper only."))));
}

// Social · burrow — mentions/velocity/top-posts read routed via signal-builder
// (PRD 347). Mirrors SentimentBlock's three-state status handling so a failed
// SB route reads distinctly from a genuinely quiet ticker.
function SocialBlock({
  social
}) {
  var status = social && social.status ? social.status : "unavailable";
  return /*#__PURE__*/React.createElement("div", {
    className: "uc-pop-block"
  }, /*#__PURE__*/React.createElement("div", {
    className: "uc-pop-block-title"
  }, "Social ", /*#__PURE__*/React.createElement("span", {
    className: "dim"
  }, "\xB7 burrow")), status === "unavailable" ? /*#__PURE__*/React.createElement("div", {
    className: "uc-sent-body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "uc-sent-meta mono warn"
  }, "no data \u2014 SB route degraded/timeout"), social && social.asOf && /*#__PURE__*/React.createElement("div", {
    className: "uc-sent-sub dim"
  }, "last known ", social.asOf)) : status === "quiet" ? /*#__PURE__*/React.createElement("div", {
    className: "uc-sent-body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "uc-sent-meta mono dim"
  }, "0 mentions \u2014 checked, quiet"), social.asOf && /*#__PURE__*/React.createElement("div", {
    className: "uc-sent-sub dim"
  }, "as of ", social.asOf)) : /*#__PURE__*/React.createElement("div", {
    className: "uc-sent-body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "uc-sent-meta mono"
  }, social.mentions ?? 0, " mentions", social.velocity != null && /*#__PURE__*/React.createElement("span", {
    className: "dim"
  }, " \xB7 velocity ", social.velocity), social.asOf && /*#__PURE__*/React.createElement("span", {
    className: "dim"
  }, " \xB7 as of ", social.asOf)), (social.topPosts || []).slice(0, 2).map((p, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "uc-sent-sub dim"
  }, p.title, p.subreddit ? ` — r/${p.subreddit}` : ""))));
}

// Exit plan — deterministic policy chips (always) + LLM narrative (when present).
function ExitPlanBlock({
  exitPlan,
  entry
}) {
  var chips = exitPolicyChips(exitPlan);
  var narrative = exitPlan && exitPlan.narrative;
  var planToday = planForToday(entry);
  return /*#__PURE__*/React.createElement("div", {
    className: "uc-pop-block"
  }, /*#__PURE__*/React.createElement("div", {
    className: "uc-pop-block-title"
  }, "Exit plan"), chips.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "uc-exit-chips"
  }, chips.map((c, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    className: "uc-exit-chip mono"
  }, c))), narrative ? /*#__PURE__*/React.createElement("div", {
    className: "uc-exit-narrative"
  }, narrative) : /*#__PURE__*/React.createElement("div", {
    className: "uc-pop-empty"
  }, "Policy-driven exit (no narrative generated)."), /*#__PURE__*/React.createElement("div", {
    className: "uc-pop-grid uc-exit-today"
  }, /*#__PURE__*/React.createElement("span", {
    className: "uc-pop-k"
  }, "Today"), /*#__PURE__*/React.createElement("span", {
    className: "uc-pop-v"
  }, planToday)));
}

// Inline detail panel — rendered directly beneath an expanded row (accordion),
// no floating popover. Replaces PRD 76's hover popover per the user's request
// to surface position / sentiment / exit-plan in place.
function UcDetail({
  entry
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "uc-detail",
    role: "region"
  }, entry.subject && /*#__PURE__*/React.createElement("div", {
    className: "uc-pop-subject"
  }, entry.subject), /*#__PURE__*/React.createElement(PositionBlock, {
    position: entry.position
  }), /*#__PURE__*/React.createElement(SentimentBlock, {
    sentiment: entry.sentiment,
    thesis: entry.thesis
  }), /*#__PURE__*/React.createElement(SocialBlock, {
    social: entry.social
  }), /*#__PURE__*/React.createElement(ThesisBlock, {
    thesis: entry.thesis,
    tier: entry.tier,
    tierKind: entry.tierKind
  }), /*#__PURE__*/React.createElement(ExitPlanBlock, {
    exitPlan: entry.exitPlan,
    entry: entry
  }));
}

// Collapsed-row trade-log line — the fund's public blotter ("hedge-fund RSS").
// Reads as a fixed-column matrix so rows stack into an aligned ledger:
//   [TYPE] [qty @ entry] [ ± $ P&L ] [ ± % ]
// Trade type is the opening order action: SHORT → SELL, LONG → BUY. The ± value
// columns populate from the position's live unrealized P&L (a short opened via
// SELL shows its running gain; a flat/unfilled BUY simply has nothing to show).
function RowPnl({
  position
}) {
  if (!position) return null;
  var up = (position.unrealizedPl || 0) >= 0;
  var isShort = position.side === "SHORT";
  var action = isShort ? "SELL" : "BUY";
  var upCls = up ? "up" : "down";
  return /*#__PURE__*/React.createElement("span", {
    className: "uc-row-trade mono"
  }, /*#__PURE__*/React.createElement("span", {
    className: `uc-trade-type ${isShort ? "sell" : "buy"}`
  }, action), /*#__PURE__*/React.createElement("span", {
    className: "uc-trade-size dim"
  }, position.qty, " @ $", (position.avgEntry || 0).toFixed(2)), /*#__PURE__*/React.createElement("span", {
    className: `uc-trade-pnl ${upCls}`
  }, fmtMoney(position.unrealizedPl)), /*#__PURE__*/React.createElement("span", {
    className: `uc-trade-pct ${upCls}`
  }, fmtPct(position.unrealizedPlPct)));
}
function UcRow({
  entry,
  isOpen,
  onToggle
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: `uc-row ${isOpen ? "uc-row-open" : ""}`,
    onClick: onToggle,
    tabIndex: 0,
    role: "button",
    "aria-expanded": isOpen,
    onKeyDown: ev => {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        onToggle();
      }
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "uc-caret dim",
    "aria-hidden": "true"
  }, isOpen ? "▾" : "▸"), /*#__PURE__*/React.createElement(PositionDot, {
    position: entry.position
  }), /*#__PURE__*/React.createElement("span", {
    className: "uc-ticker mono"
  }, entry.ticker), /*#__PURE__*/React.createElement("span", {
    className: "uc-catalyst"
  }, catalystLabel(entry.catalyst)), /*#__PURE__*/React.createElement(UcTierBadge, {
    tier: entry.tier,
    kind: entry.tierKind
  }), entry.position ? /*#__PURE__*/React.createElement(RowPnl, {
    position: entry.position
  }) : /*#__PURE__*/React.createElement("span", {
    className: "uc-subject dim"
  }, entry.subject || ""), /*#__PURE__*/React.createElement("span", {
    className: "uc-days-away mono dim"
  }, entry.daysAway == null ? "—" : entry.daysAway === 0 ? "today" : entry.daysAway === 1 ? "T-1" : `T-${entry.daysAway}`));
}

// ---------- main ----------

function UpcomingCatalystsWidget({
  panel
}) {
  var data = panel || UC_EMPTY;
  var [openKey, setOpenKey] = React.useState(null);
  var groups = React.useMemo(() => groupByDate(data.entries), [data.entries]);
  var total = data.counts && data.counts.total || 0;
  var held = data.counts && data.counts.held || 0;
  var knowledge = data.knowledge;
  return /*#__PURE__*/React.createElement("div", {
    className: "card upcoming-catalysts"
  }, /*#__PURE__*/React.createElement("div", {
    className: "card-head"
  }, /*#__PURE__*/React.createElement("h3", null, "Upcoming Catalysts \xB7 next ", data.withinDays || 10, " days"), /*#__PURE__*/React.createElement("div", {
    className: "uc-head-right"
  }, /*#__PURE__*/React.createElement("span", {
    className: "uc-summary mono dim"
  }, total, " events \xB7 ", held, " held"), knowledge && knowledge.coveragePct != null && /*#__PURE__*/React.createElement("span", {
    className: "uc-knowledge mono dim"
  }, "Knowledge 7d: ", knowledge.coveragePct, "% \xB7 both ", knowledge.knownBoth, " \xB7 SB ", knowledge.sbOnly, " ", "\xB7 social ", knowledge.socialOnly, " \xB7", " ", /*#__PURE__*/React.createElement("span", {
    className: knowledge.blind > 0 ? "warn" : ""
  }, "blind ", knowledge.blind)))), /*#__PURE__*/React.createElement("div", {
    className: "card-body tight uc-body"
  }, total === 0 && /*#__PURE__*/React.createElement("div", {
    className: "uc-empty"
  }, "No catalysts in the next ", data.withinDays || 10, " days."), groups.map(g => /*#__PURE__*/React.createElement("div", {
    key: g.date,
    className: "uc-date-group"
  }, /*#__PURE__*/React.createElement("div", {
    className: "uc-date-header mono"
  }, formatDateHeader(g.date)), g.rows.map(e => {
    var key = `${e.date}:${e.ticker}:${e.catalyst}`;
    var isOpen = openKey === key;
    return /*#__PURE__*/React.createElement("div", {
      key: key,
      className: "uc-row-wrap"
    }, /*#__PURE__*/React.createElement(UcRow, {
      entry: e,
      isOpen: isOpen,
      onToggle: () => setOpenKey(isOpen ? null : key)
    }), isOpen && /*#__PURE__*/React.createElement(UcDetail, {
      entry: e
    }));
  })))));
}
window.UpcomingCatalystsWidget = UpcomingCatalystsWidget;
window.UC_EMPTY = UC_EMPTY;

/* ---- panels/signal-dedup.jsx ---- */
/* global React */

var EMPTY_SIGNAL_DEDUP = {
  recentBlocks: [],
  activeWindows: [],
  counts: {
    recentBlocks24h: 0,
    byStrategy: {},
    byTicker: {}
  }
};
function _fmtSeconds(s) {
  if (s == null) return "—";
  var n = Math.max(0, Number(s) || 0);
  if (n < 60) return `${n}s`;
  if (n < 3600) return `${Math.floor(n / 60)}m`;
  return `${Math.floor(n / 3600)}h ${Math.floor(n % 3600 / 60)}m`;
}
function _fmtClock(iso) {
  if (!iso) return "—";
  try {
    var d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toISOString().replace("T", " ").slice(0, 19) + "Z";
  } catch (_) {
    return iso;
  }
}
function DirectionChip({
  direction
}) {
  var dir = (direction || "").toLowerCase();
  var color = dir === "short" ? "var(--neg)" : dir === "long" ? "var(--pos)" : "var(--muted)";
  return /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--mono)",
      fontSize: 10,
      fontWeight: 600,
      letterSpacing: "0.07em",
      color,
      textTransform: "uppercase"
    }
  }, dir || "—");
}
function RecentBlocksTable({
  rows
}) {
  if (!rows || !rows.length) {
    return /*#__PURE__*/React.createElement("p", {
      style: {
        color: "var(--muted)",
        fontFamily: "var(--mono)",
        fontSize: 13,
        margin: 0,
        padding: 12
      }
    }, "No dedup blocks in the recent audit window.");
  }
  return /*#__PURE__*/React.createElement("table", {
    className: "trades",
    style: {
      width: "100%"
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Blocked at"), /*#__PURE__*/React.createElement("th", null, "Strategy"), /*#__PURE__*/React.createElement("th", null, "Ticker"), /*#__PURE__*/React.createElement("th", null, "Direction"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Since original fire"))), /*#__PURE__*/React.createElement("tbody", null, rows.map((b, i) => /*#__PURE__*/React.createElement("tr", {
    key: `${b.ts}-${b.strategyId}-${b.ticker}-${i}`
  }, /*#__PURE__*/React.createElement("td", {
    className: "dim",
    style: {
      fontFamily: "var(--mono)",
      fontSize: 11
    }
  }, _fmtClock(b.ts)), /*#__PURE__*/React.createElement("td", {
    style: {
      fontFamily: "var(--mono)",
      fontSize: 11
    }
  }, b.strategyId || "—"), /*#__PURE__*/React.createElement("td", {
    className: "ticker"
  }, b.ticker || "—"), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement(DirectionChip, {
    direction: b.direction
  })), /*#__PURE__*/React.createElement("td", {
    className: "num dim",
    style: {
      fontFamily: "var(--mono)",
      fontSize: 11
    }
  }, _fmtSeconds(b.secondsSinceOriginal))))));
}
function ActiveWindowsTable({
  rows
}) {
  if (!rows || !rows.length) {
    return /*#__PURE__*/React.createElement("p", {
      style: {
        color: "var(--muted)",
        fontFamily: "var(--mono)",
        fontSize: 13,
        margin: 0,
        padding: 12
      }
    }, "No live dedup windows.");
  }
  return /*#__PURE__*/React.createElement("table", {
    className: "trades",
    style: {
      width: "100%"
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Strategy"), /*#__PURE__*/React.createElement("th", null, "Ticker"), /*#__PURE__*/React.createElement("th", null, "Direction"), /*#__PURE__*/React.createElement("th", null, "Last fire"), /*#__PURE__*/React.createElement("th", null, "Expires at"))), /*#__PURE__*/React.createElement("tbody", null, rows.map((w, i) => /*#__PURE__*/React.createElement("tr", {
    key: `${w.strategyId}-${w.ticker}-${w.direction}-${i}`
  }, /*#__PURE__*/React.createElement("td", {
    style: {
      fontFamily: "var(--mono)",
      fontSize: 11
    }
  }, w.strategyId || "—"), /*#__PURE__*/React.createElement("td", {
    className: "ticker"
  }, w.ticker || "—"), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement(DirectionChip, {
    direction: w.direction
  })), /*#__PURE__*/React.createElement("td", {
    className: "dim",
    style: {
      fontFamily: "var(--mono)",
      fontSize: 11
    }
  }, _fmtClock(w.lastFireTs)), /*#__PURE__*/React.createElement("td", {
    className: "dim",
    style: {
      fontFamily: "var(--mono)",
      fontSize: 11
    }
  }, _fmtClock(w.expiresAt))))));
}
function SignalDedupPanel() {
  var raw = window.SIGNAL_DEDUP || EMPTY_SIGNAL_DEDUP;
  var blocks = raw.recentBlocks || [];
  var active = raw.activeWindows || [];
  var counts = raw.counts || EMPTY_SIGNAL_DEDUP.counts;
  var byStrat = counts.byStrategy || {};
  var byTick = counts.byTicker || {};
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 10,
      display: "flex",
      flexWrap: "wrap",
      gap: 12,
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--mono)",
      fontSize: 11,
      color: "var(--text-2)"
    }
  }, counts.recentBlocks24h || 0, " block", counts.recentBlocks24h === 1 ? "" : "s", " in last 24h", /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--muted)"
    }
  }, " \xB7 ", active.length, " active window", active.length === 1 ? "" : "s")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      flexWrap: "wrap"
    }
  }, Object.entries(byStrat).map(([k, v]) => /*#__PURE__*/React.createElement("span", {
    key: `s-${k}`,
    style: {
      fontFamily: "var(--mono)",
      fontSize: 10,
      color: "var(--muted)",
      border: "1px solid var(--line)",
      padding: "1px 6px",
      borderRadius: 3,
      letterSpacing: "0.06em"
    }
  }, k, " ", v)), Object.entries(byTick).map(([k, v]) => /*#__PURE__*/React.createElement("span", {
    key: `t-${k}`,
    style: {
      fontFamily: "var(--mono)",
      fontSize: 10,
      color: "var(--accent)",
      border: "1px solid var(--accent)",
      padding: "1px 6px",
      borderRadius: 3,
      letterSpacing: "0.06em"
    }
  }, k, " ", v)))), /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "card-head"
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      margin: 0,
      fontSize: 14
    }
  }, "Recent dedup blocks")), /*#__PURE__*/React.createElement("div", {
    className: "card-body tight",
    style: {
      padding: 0
    }
  }, /*#__PURE__*/React.createElement(RecentBlocksTable, {
    rows: blocks
  }))), /*#__PURE__*/React.createElement("div", {
    className: "card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "card-head"
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      margin: 0,
      fontSize: 14
    }
  }, "Active dedup windows")), /*#__PURE__*/React.createElement("div", {
    className: "card-body tight",
    style: {
      padding: 0
    }
  }, /*#__PURE__*/React.createElement(ActiveWindowsTable, {
    rows: active
  }))));
}
Object.assign(window, {
  SignalDedupPanel,
  RecentBlocksTable,
  ActiveWindowsTable
});

/* ---- panels/news-signal-health.jsx ---- */
/* global React */

var EMPTY_NEWS_SIGNAL_HEALTH = {
  asOf: null,
  counts24h: {
    clear: 0,
    blockEntry: 0,
    exitNow: 0,
    total: 0
  },
  recentFlagged: [],
  byTicker: {}
};
function _fmtClock(iso) {
  if (!iso) return "—";
  try {
    var d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toISOString().replace("T", " ").slice(0, 19) + "Z";
  } catch (_) {
    return iso;
  }
}
function ClassificationChip({
  classification
}) {
  // exit_now = red (force-exit), block_entry = warn (caution), clear = muted (informational).
  var cls = classification || "";
  var color = cls === "exit_now" ? "var(--neg)" : cls === "block_entry" ? "var(--warn)" : "var(--muted)";
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-block",
      padding: "1px 6px",
      borderRadius: 3,
      fontSize: 10,
      fontFamily: "var(--mono)",
      fontWeight: 600,
      letterSpacing: "0.07em",
      border: `1px solid ${color}`,
      color,
      textTransform: "uppercase"
    }
  }, cls.replace(/_/g, " ") || "—");
}
function RecentFlaggedTable({
  rows
}) {
  if (!rows || !rows.length) {
    return /*#__PURE__*/React.createElement("p", {
      style: {
        color: "var(--muted)",
        fontFamily: "var(--mono)",
        fontSize: 13,
        margin: 0,
        padding: 12
      }
    }, "No flagged headlines in the recent scan window.");
  }
  return /*#__PURE__*/React.createElement("table", {
    className: "trades",
    style: {
      width: "100%"
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Scanned at"), /*#__PURE__*/React.createElement("th", null, "Ticker"), /*#__PURE__*/React.createElement("th", null, "Classification"), /*#__PURE__*/React.createElement("th", null, "Top headline"), /*#__PURE__*/React.createElement("th", null, "Keywords"))), /*#__PURE__*/React.createElement("tbody", null, rows.map((r, i) => /*#__PURE__*/React.createElement("tr", {
    key: `${r.ts}-${r.ticker}-${i}`
  }, /*#__PURE__*/React.createElement("td", {
    className: "dim",
    style: {
      fontFamily: "var(--mono)",
      fontSize: 11
    }
  }, _fmtClock(r.ts)), /*#__PURE__*/React.createElement("td", {
    className: "ticker"
  }, r.ticker || "—"), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement(ClassificationChip, {
    classification: r.classification
  })), /*#__PURE__*/React.createElement("td", {
    style: {
      fontSize: 12,
      color: "var(--text-2)"
    }
  }, r.topHeadline || "—"), /*#__PURE__*/React.createElement("td", {
    style: {
      fontFamily: "var(--mono)",
      fontSize: 10,
      color: "var(--muted)"
    }
  }, (r.keywords || []).join(", ") || "—")))));
}
function NewsSignalHealthPanel() {
  var raw = window.NEWS_SIGNAL_HEALTH || EMPTY_NEWS_SIGNAL_HEALTH;
  var counts = raw.counts24h || EMPTY_NEWS_SIGNAL_HEALTH.counts24h;
  var flagged = raw.recentFlagged || [];
  var byTicker = raw.byTicker || {};
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 10,
      display: "flex",
      flexWrap: "wrap",
      gap: 12,
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--mono)",
      fontSize: 11,
      color: "var(--text-2)"
    }
  }, counts.total, " scan", counts.total === 1 ? "" : "s", " 24h", /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--muted)"
    }
  }, " \xB7 "), /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--muted)"
    }
  }, counts.clear, " clear"), /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--muted)"
    }
  }, " \xB7 "), /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--warn)"
    }
  }, counts.blockEntry, " block_entry"), /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--muted)"
    }
  }, " \xB7 "), /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--neg)"
    }
  }, counts.exitNow, " exit_now")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      flexWrap: "wrap"
    }
  }, Object.entries(byTicker).map(([k, v]) => /*#__PURE__*/React.createElement("span", {
    key: `nt-${k}`,
    style: {
      fontFamily: "var(--mono)",
      fontSize: 10,
      color: "var(--accent)",
      border: "1px solid var(--accent)",
      padding: "1px 6px",
      borderRadius: 3,
      letterSpacing: "0.06em"
    }
  }, k, " b", v.blockEntry, "/x", v.exitNow)))), /*#__PURE__*/React.createElement("div", {
    className: "card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "card-head"
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      margin: 0,
      fontSize: 14
    }
  }, "Recent flagged headlines")), /*#__PURE__*/React.createElement("div", {
    className: "card-body tight",
    style: {
      padding: 0
    }
  }, /*#__PURE__*/React.createElement(RecentFlaggedTable, {
    rows: flagged
  }))));
}
Object.assign(window, {
  NewsSignalHealthPanel,
  RecentFlaggedTable,
  ClassificationChip
});

/* ---- panels/thesis-card.jsx ---- */
/* global React */
// D1 — <ThesisCard> JSX component.
// Reads window.THESES (a flat list of thesis objects emitted by snapshot.py
// via aggregations.build_theses_panel). Each card shows:
//   - lifecycle bar (DETECTED → CORROBORATED → ENTERED → EXITED)
//   - days-to-event countdown
//   - contributing strategies
//   - kill reason if KILLED

var LIFECYCLE = ["DETECTED", "CORROBORATED", "ENTERED", "EXITED"];
function lifecycleIndex(state) {
  var i = LIFECYCLE.indexOf(state);
  return i === -1 ? -1 : i;
}
function LifecycleBar({
  state
}) {
  var killed = state === "KILLED";
  var activeIdx = killed ? -1 : lifecycleIndex(state);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 0
    }
  }, LIFECYCLE.map((stage, i) => {
    var reached = !killed && i <= activeIdx;
    var current = !killed && i === activeIdx;
    var bg = current ? "var(--accent)" : reached ? "var(--pos)" : "var(--surface-2)";
    var color = current || reached ? "var(--bg)" : "var(--muted)";
    return /*#__PURE__*/React.createElement(React.Fragment, {
      key: stage
    }, /*#__PURE__*/React.createElement("div", {
      title: stage + (current ? " (current)" : ""),
      style: {
        padding: "3px 8px",
        background: bg,
        color,
        fontFamily: "var(--mono)",
        fontSize: 9.5,
        fontWeight: 600,
        letterSpacing: "0.06em",
        border: "1px solid var(--line)",
        borderRadius: 2
      }
    }, stage), i < LIFECYCLE.length - 1 && /*#__PURE__*/React.createElement("div", {
      style: {
        width: 10,
        height: 1,
        background: reached && i < activeIdx ? "var(--pos)" : "var(--line)"
      }
    }));
  }), killed && /*#__PURE__*/React.createElement("span", {
    className: "pill stopped",
    style: {
      marginLeft: 8,
      fontSize: 9.5,
      letterSpacing: "0.06em"
    }
  }, "KILLED"));
}
function ThesisCard({
  thesis
}) {
  if (!thesis) return null;
  var {
    ticker,
    eventDate,
    direction,
    catalyst,
    state,
    confidence,
    contributors,
    daysUntil,
    pnlPct,
    killReason
  } = thesis;
  var isKilled = state === "KILLED";
  var countdown = daysUntil == null ? "—" : daysUntil >= 0 ? `T-${daysUntil}d` : `T+${-daysUntil}d`;
  var dirColor = direction === "long" ? "var(--pos)" : direction === "short" ? "var(--neg)" : "var(--muted)";
  return /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      marginBottom: 10,
      padding: 12,
      opacity: isKilled ? 0.7 : 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      flexWrap: "wrap",
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "ticker mono",
    style: {
      fontSize: 15,
      fontWeight: 700
    }
  }, ticker), /*#__PURE__*/React.createElement("span", {
    style: {
      padding: "1px 6px",
      borderRadius: 3,
      fontSize: 10,
      fontFamily: "var(--mono)",
      fontWeight: 600,
      letterSpacing: "0.07em",
      border: `1px solid ${dirColor}`,
      color: dirColor
    }
  }, (direction || "?").toUpperCase()), catalyst && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--mono)",
      fontSize: 10,
      color: "var(--accent)",
      textTransform: "uppercase",
      letterSpacing: "0.07em"
    }
  }, catalyst), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--mono)",
      fontSize: 11,
      color: "var(--text-2)"
    }
  }, eventDate || "—", /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: 6,
      color: daysUntil == null ? "var(--muted)" : daysUntil >= 0 ? "var(--warn)" : "var(--muted)"
    }
  }, countdown)), pnlPct != null && /*#__PURE__*/React.createElement("span", {
    className: pnlPct >= 0 ? "up" : "down",
    style: {
      fontFamily: "var(--mono)",
      fontSize: 11,
      marginLeft: "auto"
    }
  }, pnlPct >= 0 ? "+" : "", pnlPct.toFixed(2), "%"), pnlPct == null && confidence != null && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--mono)",
      fontSize: 11,
      color: "var(--muted)",
      marginLeft: "auto"
    }
  }, "conf ", Math.round(confidence * 100), "%")), /*#__PURE__*/React.createElement(LifecycleBar, {
    state: state
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10,
      display: "flex",
      flexWrap: "wrap",
      gap: 6,
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "label",
    style: {
      fontFamily: "var(--mono)",
      fontSize: 9.5,
      textTransform: "uppercase",
      letterSpacing: "0.08em",
      color: "var(--muted)",
      marginRight: 4
    }
  }, "Contributors"), (contributors || []).length === 0 ? /*#__PURE__*/React.createElement("span", {
    className: "dim",
    style: {
      fontFamily: "var(--mono)",
      fontSize: 11
    }
  }, "\u2014") : (contributors || []).map(c => /*#__PURE__*/React.createElement("span", {
    key: c,
    style: {
      background: "var(--surface-2)",
      border: "1px solid var(--line)",
      padding: "1px 6px",
      borderRadius: 3,
      fontFamily: "var(--mono)",
      fontSize: 10.5,
      color: "var(--text-2)"
    }
  }, c))), isKilled && killReason && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 8,
      padding: "6px 8px",
      background: "var(--surface-2)",
      border: "1px solid var(--line)",
      borderRadius: 3,
      fontFamily: "var(--mono)",
      fontSize: 10.5,
      color: "var(--neg)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "dim",
    style: {
      marginRight: 6
    }
  }, "kill reason"), killReason));
}
function ThesisCardList({
  theses,
  limit
}) {
  var raw = Array.isArray(theses) ? theses : window.THESES || [];
  if (raw.length === 0) {
    return /*#__PURE__*/React.createElement("p", {
      style: {
        color: "var(--muted)",
        fontFamily: "var(--mono)",
        fontSize: 13,
        padding: "8px 0"
      }
    }, "No theses materialized yet.");
  }

  // Sort: non-KILLED first by daysUntil asc, then KILLED at the end.
  var sorted = [...raw].sort((a, b) => {
    var aK = a.state === "KILLED" ? 1 : 0;
    var bK = b.state === "KILLED" ? 1 : 0;
    if (aK !== bK) return aK - bK;
    var ad = a.daysUntil == null ? 1e9 : a.daysUntil;
    var bd = b.daysUntil == null ? 1e9 : b.daysUntil;
    return ad - bd;
  });
  var shown = typeof limit === "number" ? sorted.slice(0, limit) : sorted;
  return /*#__PURE__*/React.createElement("div", null, shown.map(t => /*#__PURE__*/React.createElement(ThesisCard, {
    key: t.key || `${t.ticker}:${t.eventDate}`,
    thesis: t
  })));
}
Object.assign(window, {
  ThesisCard,
  ThesisCardList,
  LifecycleBar
});

/* ---- panels/tick-report-feed.jsx ---- */
/* global React */
// D2 — <TickReportFeed> JSX component.
// Renders window.AGENT_REPORTS (newest-first list of rows from
// data/agent_reports.jsonl, emitted by snapshot.py). One row per tick:
// timestamp, cost, summary; expandable for the full provenance payload.

var TICK_REPORT_HIDDEN_KEYS = new Set(["ts", "kind", "summary", "costUsd", "cost_usd", "cost", "usd", "usd_cost", "total_cost_usd", "cost_usd_estimate"]);
function _fmtUsd(v) {
  if (v == null) return "—";
  var n = Number(v);
  if (!Number.isFinite(n)) return "—";
  if (n === 0) return "$0";
  if (n < 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}
function _fmtTs(ts) {
  if (!ts) return "—";
  try {
    var d = new Date(ts);
    if (Number.isNaN(d.getTime())) return ts;
    // YYYY-MM-DD HH:MM local
    var pad = n => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` + `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch (e) {
    return ts;
  }
}
function TickCountChip({
  label,
  value,
  tone
}) {
  if (value == null || value === 0) return null;
  var color = tone === "pos" ? "var(--pos)" : tone === "neg" ? "var(--neg)" : tone === "warn" ? "var(--warn)" : "var(--text-2)";
  return /*#__PURE__*/React.createElement("span", {
    style: {
      background: "var(--surface-2)",
      border: "1px solid var(--line)",
      padding: "1px 6px",
      borderRadius: 3,
      fontFamily: "var(--mono)",
      fontSize: 10,
      color,
      marginRight: 4
    }
  }, label, ":", value);
}
function TickReportRow({
  report
}) {
  var [open, setOpen] = React.useState(false);
  var {
    ts,
    kind,
    summary,
    costUsd,
    detected,
    corroborated,
    entered,
    exited,
    killed,
    errors,
    notes
  } = report || {};
  var hasErrors = Array.isArray(errors) && errors.length > 0;
  var kindColor = kind === "roadmap" ? "var(--accent)" : hasErrors ? "var(--neg)" : "var(--text-2)";

  // Extra fields beyond the known surface for the expanded view.
  var extras = {};
  for (var k of Object.keys(report || {})) {
    if (TICK_REPORT_HIDDEN_KEYS.has(k)) continue;
    extras[k] = report[k];
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      marginBottom: 6,
      padding: "8px 10px",
      opacity: hasErrors ? 0.95 : 1,
      borderLeft: hasErrors ? "2px solid var(--neg)" : "2px solid var(--line)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: () => setOpen(v => !v),
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      cursor: "pointer",
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--mono)",
      fontSize: 11,
      color: "var(--text-2)",
      minWidth: 110
    }
  }, _fmtTs(ts)), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--mono)",
      fontSize: 9.5,
      color: kindColor,
      textTransform: "uppercase",
      letterSpacing: "0.07em",
      minWidth: 56
    }
  }, kind || "tick"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--mono)",
      fontSize: 10.5,
      color: costUsd > 0 ? "var(--warn)" : "var(--muted)",
      minWidth: 56
    }
  }, _fmtUsd(costUsd)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement(TickCountChip, {
    label: "det",
    value: detected,
    tone: "pos"
  }), /*#__PURE__*/React.createElement(TickCountChip, {
    label: "corr",
    value: corroborated,
    tone: "pos"
  }), /*#__PURE__*/React.createElement(TickCountChip, {
    label: "ent",
    value: entered,
    tone: "pos"
  }), /*#__PURE__*/React.createElement(TickCountChip, {
    label: "exit",
    value: exited,
    tone: "warn"
  }), /*#__PURE__*/React.createElement(TickCountChip, {
    label: "kill",
    value: killed,
    tone: "neg"
  }), hasErrors && /*#__PURE__*/React.createElement(TickCountChip, {
    label: "err",
    value: errors.length,
    tone: "neg"
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: "1 1 280px",
      fontFamily: "var(--mono)",
      fontSize: 11.5,
      color: "var(--text)",
      minWidth: 200
    }
  }, summary || /*#__PURE__*/React.createElement("span", {
    className: "dim"
  }, "(no summary)")), /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    style: {
      fontFamily: "var(--mono)",
      fontSize: 11,
      color: "var(--muted)"
    }
  }, open ? "▾" : "▸")), open && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 8,
      paddingTop: 8,
      borderTop: "1px dashed var(--line)"
    }
  }, hasErrors && /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "label",
    style: {
      fontFamily: "var(--mono)",
      fontSize: 9.5,
      textTransform: "uppercase",
      letterSpacing: "0.08em",
      color: "var(--neg)"
    }
  }, "Errors"), /*#__PURE__*/React.createElement("ul", {
    style: {
      margin: "4px 0 0",
      paddingLeft: 18,
      fontFamily: "var(--mono)",
      fontSize: 11,
      color: "var(--neg)"
    }
  }, errors.map((e, i) => /*#__PURE__*/React.createElement("li", {
    key: i
  }, typeof e === "string" ? e : JSON.stringify(e))))), notes && /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "label",
    style: {
      fontFamily: "var(--mono)",
      fontSize: 9.5,
      textTransform: "uppercase",
      letterSpacing: "0.08em",
      color: "var(--muted)"
    }
  }, "Notes"), Array.isArray(notes) ? /*#__PURE__*/React.createElement("ul", {
    style: {
      margin: "4px 0 0",
      paddingLeft: 18,
      fontFamily: "var(--mono)",
      fontSize: 11,
      color: "var(--text-2)"
    }
  }, notes.map((n, i) => /*#__PURE__*/React.createElement("li", {
    key: i
  }, typeof n === "string" ? n : JSON.stringify(n)))) : /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 4,
      fontFamily: "var(--mono)",
      fontSize: 11,
      color: "var(--text-2)"
    }
  }, typeof notes === "string" ? notes : JSON.stringify(notes))), Object.keys(extras).length > 0 && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "label",
    style: {
      fontFamily: "var(--mono)",
      fontSize: 9.5,
      textTransform: "uppercase",
      letterSpacing: "0.08em",
      color: "var(--muted)"
    }
  }, "Provenance"), /*#__PURE__*/React.createElement("pre", {
    style: {
      margin: "4px 0 0",
      padding: "6px 8px",
      background: "var(--surface-2)",
      border: "1px solid var(--line)",
      borderRadius: 3,
      fontFamily: "var(--mono)",
      fontSize: 10.5,
      color: "var(--text-2)",
      whiteSpace: "pre-wrap",
      wordBreak: "break-word",
      overflowX: "auto"
    }
  }, JSON.stringify(extras, null, 2)))));
}
function TickReportFeed({
  reports,
  limit
}) {
  var raw = Array.isArray(reports) ? reports : window.AGENT_REPORTS || [];
  if (raw.length === 0) {
    return /*#__PURE__*/React.createElement("p", {
      style: {
        color: "var(--muted)",
        fontFamily: "var(--mono)",
        fontSize: 13,
        padding: "8px 0"
      }
    }, "No agent tick reports yet.");
  }
  // snapshot emits newest-first; tolerate any order defensively.
  var sorted = [...raw].sort((a, b) => {
    var at = a && a.ts || "";
    var bt = b && b.ts || "";
    if (at === bt) return 0;
    return at < bt ? 1 : -1;
  });
  var shown = typeof limit === "number" ? sorted.slice(0, limit) : sorted;
  return /*#__PURE__*/React.createElement("div", null, shown.map((r, i) => /*#__PURE__*/React.createElement(TickReportRow, {
    key: r && r.ts || i,
    report: r
  })));
}
Object.assign(window, {
  TickReportFeed,
  TickReportRow
});

/* ---- panels/trade-provenance-modal.jsx ---- */
/* global React */
// D3 — <TradeProvenanceModal> JSX component.
// Clicking a row in the trade log opens this modal. It reads
// window.THESIS_PROVENANCE (a dict keyed by thesis_key, emitted by
// snapshot.py via aggregations.build_thesis_provenance) and surfaces:
//   - Header: ticker, side, status, P&L, entry/exit
//   - Sources: original Reddit posts (subreddit, author, permalink)
//   - Conviction breakdown: contributing strategies + confidence bar
//   - Corroboration: state_meta.corroboration evidence
//   - Agent rationale: recent audit rows (kind, ts, rationale, ruleBreaks)
//
// Trades emitted to dashboard/data.js currently lack an explicit
// `thesisKey` field, so the modal falls back to a best-effort lookup by
// (ticker, opened date) when no key is attached.

function findProvenanceForTrade(trade, provenanceDict) {
  if (!trade || !provenanceDict) return null;
  // Preferred: explicit thesisKey on the trade row.
  var explicit = trade.thesisKey || trade.thesis_key;
  if (explicit && provenanceDict[explicit]) return provenanceDict[explicit];
  var ticker = (trade.ticker || "").toUpperCase();
  if (!ticker) return null;

  // Collect candidates that match ticker. Most THESIS_PROVENANCE entries
  // expose a `ticker` field directly; some may only carry it via the key
  // (`TICKER:DATE:DIR:SUBREDDIT`).
  var candidates = [];
  for (var key of Object.keys(provenanceDict)) {
    var p = provenanceDict[key];
    var t = (p && p.ticker ? p.ticker : key.split(":")[0] || "").toUpperCase();
    if (t === ticker) candidates.push({
      key,
      p
    });
  }
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0].p;

  // Tie-break: prefer the one whose eventDate is nearest to trade.opened.
  var opened = trade.opened || trade.closed || "";
  var score = p => {
    var ev = p && p.eventDate ? p.eventDate : "";
    if (!ev || !opened) return Number.POSITIVE_INFINITY;
    return Math.abs(Date.parse(ev) - Date.parse(opened)) || 0;
  };
  candidates.sort((a, b) => score(a.p) - score(b.p));
  return candidates[0].p;
}
function _fmtTs(ts) {
  if (!ts) return "—";
  try {
    var d = new Date(ts);
    if (Number.isNaN(d.getTime())) return ts;
    var pad = n => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` + `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch (e) {
    return ts;
  }
}
function _Section({
  title,
  children,
  accent
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--mono)",
      fontSize: 10,
      textTransform: "uppercase",
      letterSpacing: "0.08em",
      color: accent || "var(--muted)",
      marginBottom: 6
    }
  }, title), children);
}
function SourcesList({
  sources
}) {
  if (!Array.isArray(sources) || sources.length === 0) {
    return /*#__PURE__*/React.createElement("div", {
      className: "dim",
      style: {
        fontFamily: "var(--mono)",
        fontSize: 11
      }
    }, "no source posts captured");
  }
  return /*#__PURE__*/React.createElement("ul", {
    style: {
      margin: 0,
      paddingLeft: 16,
      listStyle: "disc"
    }
  }, sources.map((s, i) => {
    var sub = s.subreddit ? `r/${s.subreddit}` : "";
    var author = s.author ? `u/${s.author}` : "";
    var url = s.permalink || s.url || null;
    var titleText = s.title || s.text || url || "(no title)";
    return /*#__PURE__*/React.createElement("li", {
      key: i,
      style: {
        fontFamily: "var(--mono)",
        fontSize: 11.5,
        color: "var(--text-2)",
        marginBottom: 4,
        lineHeight: 1.45
      }
    }, url ? /*#__PURE__*/React.createElement("a", {
      href: url,
      target: "_blank",
      rel: "noreferrer",
      style: {
        color: "var(--text)",
        textDecoration: "underline"
      }
    }, titleText) : /*#__PURE__*/React.createElement("span", null, titleText), /*#__PURE__*/React.createElement("span", {
      style: {
        marginLeft: 6,
        color: "var(--muted)"
      }
    }, sub, sub && author ? " · " : "", author, s.score != null && /*#__PURE__*/React.createElement("span", null, " \xB7 ", s.score, "\u2191")));
  }));
}
function ConvictionBreakdown({
  rows
}) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return /*#__PURE__*/React.createElement("div", {
      className: "dim",
      style: {
        fontFamily: "var(--mono)",
        fontSize: 11
      }
    }, "no contributors recorded");
  }
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 4
    }
  }, rows.map(r => {
    var conf = Math.max(0, Math.min(1, Number(r.confidence) || 0));
    return /*#__PURE__*/React.createElement("div", {
      key: r.traderId,
      style: {
        display: "grid",
        gridTemplateColumns: "150px 1fr 56px",
        alignItems: "center",
        gap: 10,
        fontFamily: "var(--mono)",
        fontSize: 11
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        color: "var(--text-2)"
      }
    }, r.traderId), /*#__PURE__*/React.createElement("div", {
      style: {
        height: 8,
        background: "var(--surface-2)",
        border: "1px solid var(--line)",
        borderRadius: 3,
        overflow: "hidden"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: `${conf * 100}%`,
        height: "100%",
        background: "var(--accent)",
        opacity: 0.85
      }
    })), /*#__PURE__*/React.createElement("span", {
      style: {
        textAlign: "right",
        color: "var(--muted)"
      }
    }, (conf * 100).toFixed(0), "%"));
  }));
}
function CorroborationView({
  corroboration
}) {
  if (!corroboration || typeof corroboration !== "object") {
    return /*#__PURE__*/React.createElement("div", {
      className: "dim",
      style: {
        fontFamily: "var(--mono)",
        fontSize: 11
      }
    }, "no corroboration evidence");
  }
  return /*#__PURE__*/React.createElement("pre", {
    style: {
      margin: 0,
      padding: "6px 8px",
      background: "var(--surface-2)",
      border: "1px solid var(--line)",
      borderRadius: 3,
      fontFamily: "var(--mono)",
      fontSize: 10.5,
      color: "var(--text-2)",
      whiteSpace: "pre-wrap",
      wordBreak: "break-word",
      overflowX: "auto"
    }
  }, JSON.stringify(corroboration, null, 2));
}

// Block reason codes that reflect market state rather than a strategy
// decision. Historically the agent wrote one rule_break per cron tick
// for each open thesis whenever markets were closed, which swamped the
// rationale feed. New code no longer emits these (theses_cli J1 fix),
// but the modal still filters legacy rows from `audit.jsonl`.
var ENV_RULE_BREAKS = new Set(["market_closed", "weekend", "pre_open", "post_close"]);
function _isEnvironmentalRow(r) {
  var breaks = Array.isArray(r && r.ruleBreaks) ? r.ruleBreaks : [];
  if (breaks.length === 0) return false;
  return breaks.every(b => ENV_RULE_BREAKS.has(b));
}
function RationaleList({
  rationale
}) {
  var [showEnv, setShowEnv] = React.useState(false);
  if (!Array.isArray(rationale) || rationale.length === 0) {
    return /*#__PURE__*/React.createElement("div", {
      className: "dim",
      style: {
        fontFamily: "var(--mono)",
        fontSize: 11
      }
    }, "no agent rationale captured yet");
  }
  var envCount = rationale.filter(_isEnvironmentalRow).length;
  var visible = showEnv ? rationale : rationale.filter(r => !_isEnvironmentalRow(r));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 6
    }
  }, envCount > 0 && /*#__PURE__*/React.createElement("label", {
    style: {
      fontFamily: "var(--mono)",
      fontSize: 10.5,
      color: "var(--muted)",
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      cursor: "pointer"
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: showEnv,
    onChange: e => setShowEnv(e.target.checked)
  }), "show environmental skips (", envCount, " hidden)"), visible.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "dim",
    style: {
      fontFamily: "var(--mono)",
      fontSize: 11
    }
  }, "no strategy-level rationale (only environmental skips on file)") : visible.map((r, i) => {
    var kindColor = r.kind === "ENTERED" ? "var(--pos)" : r.kind === "EXITED" ? "var(--warn)" : r.kind === "KILLED" ? "var(--neg)" : "var(--text-2)";
    return /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        padding: "6px 8px",
        border: "1px solid var(--line)",
        borderRadius: 3,
        background: "var(--surface-2)"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 8,
        alignItems: "center",
        flexWrap: "wrap",
        fontFamily: "var(--mono)",
        fontSize: 10.5
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        color: "var(--muted)"
      }
    }, _fmtTs(r.ts)), /*#__PURE__*/React.createElement("span", {
      style: {
        color: kindColor,
        textTransform: "uppercase",
        letterSpacing: "0.07em",
        fontWeight: 600
      }
    }, r.kind || "—"), r.strategyId && /*#__PURE__*/React.createElement("span", {
      style: {
        color: "var(--text-2)"
      }
    }, r.strategyId)), r.rationale && /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 4,
        fontFamily: "var(--mono)",
        fontSize: 11,
        color: "var(--text)",
        lineHeight: 1.45
      }
    }, r.rationale), Array.isArray(r.ruleBreaks) && r.ruleBreaks.length > 0 && /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 4,
        fontFamily: "var(--mono)",
        fontSize: 10.5,
        color: "var(--neg)"
      }
    }, "rule breaks: ", r.ruleBreaks.join(", ")));
  }));
}

// PRD 999 — a PRD 998 spread row (`type: "OPTION_SPREAD"`) carries its own
// `legs[]` (parsed OCC symbol, side, qty, entry/exit price per leg) instead of
// thesis provenance sources. Expand those on click rather than showing the
// equity-flavoured Sources/Conviction sections, which have nothing to say
// about a two-leg vertical.
function SpreadLegsList({
  legs
}) {
  var {
    money
  } = window.SpreadFormat;
  if (!Array.isArray(legs) || legs.length === 0) {
    return /*#__PURE__*/React.createElement("div", {
      className: "dim",
      style: {
        fontFamily: "var(--mono)",
        fontSize: 11
      }
    }, "no leg detail captured");
  }
  return /*#__PURE__*/React.createElement("table", {
    className: "opt-table",
    style: {
      width: "100%"
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", {
    className: "al"
  }, "Leg"), /*#__PURE__*/React.createElement("th", {
    className: "al"
  }, "Side"), /*#__PURE__*/React.createElement("th", null, "Qty"), /*#__PURE__*/React.createElement("th", null, "Entry"), /*#__PURE__*/React.createElement("th", null, "Exit"))), /*#__PURE__*/React.createElement("tbody", null, legs.map((l, i) => /*#__PURE__*/React.createElement("tr", {
    key: l.symbol || i
  }, /*#__PURE__*/React.createElement("td", {
    className: "al mono-dim"
  }, l.underlying && l.strike != null && l.right ? `${l.underlying} $${l.strike} ${l.right} exp ${l.expiry}` : l.symbol), /*#__PURE__*/React.createElement("td", {
    className: "al"
  }, l.side || l.positionIntent || "—"), /*#__PURE__*/React.createElement("td", null, l.qty), /*#__PURE__*/React.createElement("td", null, money(l.entryPrice)), /*#__PURE__*/React.createElement("td", null, l.exitPrice != null ? money(l.exitPrice) : "—")))));
}
function TradeProvenanceModal({
  trade,
  provenance,
  onClose
}) {
  // Esc closes; clicks on the backdrop close; clicks inside the modal don't.
  React.useEffect(() => {
    if (!trade) return undefined;
    var onKey = e => {
      if (e.key === "Escape" && onClose) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [trade, onClose]);
  if (!trade) return null;
  var dict = provenance || window.THESIS_PROVENANCE || {};
  var p = findProvenanceForTrade(trade, dict);
  var sideColor = trade.side === "LONG" ? "var(--pos)" : trade.side === "SHORT" ? "var(--neg)" : "var(--muted)";
  var pnl = Number(trade.pnl) || 0;
  var pnlColor = pnl >= 0 ? "var(--pos)" : "var(--neg)";
  var fmt$ = v => (v >= 0 ? "+$" : "−$") + Math.abs(v).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return /*#__PURE__*/React.createElement("div", {
    role: "dialog",
    "aria-modal": "true",
    "aria-label": "Trade provenance",
    onClick: onClose,
    style: {
      position: "fixed",
      inset: 0,
      background: "rgba(0, 0, 0, 0.55)",
      zIndex: 1000,
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "center",
      padding: "60px 16px",
      overflowY: "auto"
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    className: "card",
    style: {
      width: "min(720px, 100%)",
      maxHeight: "calc(100vh - 120px)",
      overflowY: "auto",
      padding: 16,
      background: "var(--bg)",
      border: "1px solid var(--line)",
      boxShadow: "0 16px 48px rgba(0, 0, 0, 0.45)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      flexWrap: "wrap",
      marginBottom: 6
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "ticker mono",
    style: {
      fontSize: 18,
      fontWeight: 700
    }
  }, trade.ticker), /*#__PURE__*/React.createElement("span", {
    style: {
      padding: "1px 6px",
      borderRadius: 3,
      fontFamily: "var(--mono)",
      fontSize: 10,
      fontWeight: 600,
      letterSpacing: "0.07em",
      border: `1px solid ${sideColor}`,
      color: sideColor
    }
  }, trade.side || "?"), /*#__PURE__*/React.createElement("span", {
    className: `pill ${trade.status === "OPEN" ? "open" : "closed"}`,
    style: {
      fontSize: 10
    }
  }, trade.status || "—"), trade.strategy && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--mono)",
      fontSize: 10.5,
      color: "var(--accent)",
      textTransform: "uppercase",
      letterSpacing: "0.07em"
    }
  }, trade.strategy)), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onClose,
    "aria-label": "Close",
    style: {
      background: "transparent",
      border: "1px solid var(--line)",
      color: "var(--text-2)",
      fontFamily: "var(--mono)",
      fontSize: 11,
      padding: "4px 10px",
      borderRadius: 3,
      cursor: "pointer"
    }
  }, "\u2715 close")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 18,
      flexWrap: "wrap",
      fontFamily: "var(--mono)",
      fontSize: 11.5,
      color: "var(--text-2)",
      marginTop: 4
    }
  }, /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("span", {
    className: "dim"
  }, "entry"), " ", trade.entry != null ? Number(trade.entry).toFixed(2) : "—"), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("span", {
    className: "dim"
  }, "exit"), " ", trade.exit != null ? Number(trade.exit).toFixed(2) : "—"), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("span", {
    className: "dim"
  }, "qty"), " ", trade.qty ?? "—"), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("span", {
    className: "dim"
  }, "opened"), " ", trade.opened || "—", trade.closed ? ` → ${trade.closed}` : ""), /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: "auto",
      color: pnlColor,
      fontWeight: 600
    }
  }, fmt$(pnl), trade.pnlPct != null && /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: 6,
      color: pnlColor,
      opacity: 0.8
    }
  }, "(", trade.pnlPct >= 0 ? "+" : "", Number(trade.pnlPct).toFixed(2), "%)"))), trade.type === "OPTION_SPREAD" && /*#__PURE__*/React.createElement(_Section, {
    title: "Legs"
  }, /*#__PURE__*/React.createElement(SpreadLegsList, {
    legs: trade.legs
  })), !p ? /*#__PURE__*/React.createElement("p", {
    style: {
      marginTop: 16,
      color: "var(--muted)",
      fontFamily: "var(--mono)",
      fontSize: 12,
      lineHeight: 1.5
    }
  }, "No matching thesis provenance for this trade. It may have been a legacy momentum fill or an opportunistic entry outside the thesis pipeline.") : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(_Section, {
    title: "Sources"
  }, /*#__PURE__*/React.createElement(SourcesList, {
    sources: p.sources
  })), /*#__PURE__*/React.createElement(_Section, {
    title: "Conviction breakdown"
  }, /*#__PURE__*/React.createElement(ConvictionBreakdown, {
    rows: p.convictionBreakdown
  })), /*#__PURE__*/React.createElement(_Section, {
    title: "Corroboration"
  }, /*#__PURE__*/React.createElement(CorroborationView, {
    corroboration: p.corroboration
  })), /*#__PURE__*/React.createElement(_Section, {
    title: "Agent rationale",
    accent: "var(--accent)"
  }, /*#__PURE__*/React.createElement(RationaleList, {
    rationale: p.rationale
  })))));
}
Object.assign(window, {
  TradeProvenanceModal,
  findProvenanceForTrade
});

/* ---- panels/strategy-comparison-panel.jsx ---- */
/* global React */
// D4 — <StrategyComparisonPanel>: head-to-head between two strategies.
// Reads:
//   - window.STRATEGIES (rows with id/name/sharpe/winRate/trades/ytdPct/dd)
//   - window.STRATEGY_EQUITY_SERIES ({sid: [{t, equity}, ...]}) for overlay
//   - window.TRADES (used to derive avg hold days per strategy)

var _COMPARE_COLORS = ["oklch(0.78 0.18 25)", "oklch(0.78 0.16 145)"];
function _holdDays(opened, closed) {
  if (!opened || !closed) return null;
  var a = new Date(opened).getTime();
  var b = new Date(closed).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  var d = (b - a) / 86400000;
  return d >= 0 ? d : null;
}
function _avgHoldFor(trades, sid) {
  var xs = [];
  for (var t of trades || []) {
    if (!t || t.status !== "CLOSED") continue;
    var stratHere = t.strategy || null;
    if (stratHere !== sid) continue;
    var h = _holdDays(t.opened, t.closed);
    if (h != null) xs.push(h);
  }
  if (xs.length === 0) return null;
  return xs.reduce((s, v) => s + v, 0) / xs.length;
}
function _stat({
  label,
  a,
  b,
  fmt,
  deltaFmt,
  betterIs
}) {
  var fa = a == null ? "—" : fmt ? fmt(a) : String(a);
  var fb = b == null ? "—" : fmt ? fmt(b) : String(b);
  var delta = "—";
  var deltaTone = "";
  if (typeof a === "number" && typeof b === "number") {
    var d = a - b;
    var better = betterIs === "lower" ? d < 0 : d > 0;
    if (d === 0) {
      delta = "0";
    } else {
      delta = deltaFmt ? deltaFmt(d) : d > 0 ? `+${d.toFixed(2)}` : d.toFixed(2);
      deltaTone = better ? "up" : "down";
    }
  }
  return {
    label,
    fa,
    fb,
    delta,
    deltaTone
  };
}
function StrategyComparisonPanel({
  defaultA,
  defaultB
}) {
  var strategies = Array.isArray(window.STRATEGIES) ? window.STRATEGIES : [];
  var equitySeries = window.STRATEGY_EQUITY_SERIES || {};
  var trades = Array.isArray(window.TRADES) ? window.TRADES : [];
  if (strategies.length < 2) {
    return /*#__PURE__*/React.createElement("div", {
      className: "card",
      style: {
        padding: 12
      }
    }, /*#__PURE__*/React.createElement("p", {
      style: {
        color: "var(--muted)",
        fontFamily: "var(--mono)",
        fontSize: 13,
        margin: 0
      }
    }, "Need at least 2 strategies to compare."));
  }
  var initialA = defaultA && strategies.find(s => s.id === defaultA) ? defaultA : strategies[0].id;
  var initialBPick = strategies.find(s => s.id !== initialA);
  var initialB = defaultB && strategies.find(s => s.id === defaultB) && defaultB !== initialA ? defaultB : initialBPick ? initialBPick.id : strategies[1].id;
  var [aId, setAId] = React.useState(initialA);
  var [bId, setBId] = React.useState(initialB);
  var a = strategies.find(s => s.id === aId) || strategies[0];
  var b = strategies.find(s => s.id === bId) || strategies[1];
  var seriesA = Array.isArray(equitySeries[a.id]) ? equitySeries[a.id] : [];
  var seriesB = Array.isArray(equitySeries[b.id]) ? equitySeries[b.id] : [];
  var holdA = _avgHoldFor(trades, a.id);
  var holdB = _avgHoldFor(trades, b.id);
  var stats = [_stat({
    label: "YTD return",
    a: a.ytdPct,
    b: b.ytdPct,
    fmt: v => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`,
    deltaFmt: d => `${d >= 0 ? "+" : ""}${d.toFixed(1)} pts`
  }), _stat({
    label: "Sharpe",
    a: a.sharpe,
    b: b.sharpe,
    fmt: v => v.toFixed(2),
    deltaFmt: d => `${d >= 0 ? "+" : ""}${d.toFixed(2)}`
  }), _stat({
    label: "Win rate",
    a: a.winRate,
    b: b.winRate,
    fmt: v => `${(v * 100).toFixed(0)}%`,
    deltaFmt: d => `${d >= 0 ? "+" : ""}${(d * 100).toFixed(0)} pp`
  }), _stat({
    label: "Trades",
    a: a.trades,
    b: b.trades,
    fmt: v => String(v),
    deltaFmt: d => `${d >= 0 ? "+" : ""}${d}`
  }), _stat({
    label: "Max DD",
    a: a.dd,
    b: b.dd,
    fmt: v => `${v.toFixed(1)}%`,
    deltaFmt: d => `${d >= 0 ? "+" : ""}${d.toFixed(1)} pts`,
    betterIs: "lower"
  }), _stat({
    label: "Avg hold (d)",
    a: holdA,
    b: holdB,
    fmt: v => v.toFixed(1),
    deltaFmt: d => `${d >= 0 ? "+" : ""}${d.toFixed(1)}d`
  })];

  // Equity overlay — normalize each series so both start at 100.
  var W = 640,
    H = 200,
    PAD_L = 44,
    PAD_R = 12,
    PAD_T = 12,
    PAD_B = 22;
  var norm = s => {
    if (!s || s.length === 0) return [];
    var base = s[0].equity || 1;
    return s.map(p => p.equity / base * 100);
  };
  var nA = norm(seriesA);
  var nB = norm(seriesB);
  var allVals = nA.concat(nB);
  var hasData = allVals.length > 0;
  var minV = hasData ? Math.min(100, ...allVals) * 0.99 : 95;
  var maxV = hasData ? Math.max(100, ...allVals) * 1.01 : 105;
  var range = maxV - minV || 1;
  var lenA = Math.max(nA.length, 1);
  var lenB = Math.max(nB.length, 1);
  var longest = Math.max(lenA, lenB);
  var xFor = (i, total) => {
    var denom = Math.max(longest - 1, 1);
    var proportion = total <= 1 ? 1 : i / (total - 1) * ((total - 1) / denom);
    return PAD_L + proportion * (W - PAD_L - PAD_R);
  };
  var yFor = v => PAD_T + (maxV - v) / range * (H - PAD_T - PAD_B);
  var linePts = arr => arr.map((v, i) => `${xFor(i, arr.length)},${yFor(v)}`).join(" ");
  var _select = (current, onChange, otherId, key) => /*#__PURE__*/React.createElement("select", {
    key: key,
    value: current,
    onChange: e => onChange(e.target.value),
    className: "mono",
    style: {
      background: "var(--surface-2)",
      color: "var(--text)",
      border: "1px solid var(--line)",
      borderRadius: 3,
      padding: "3px 6px",
      fontFamily: "var(--mono)",
      fontSize: 11
    }
  }, strategies.map(s => /*#__PURE__*/React.createElement("option", {
    key: s.id,
    value: s.id,
    disabled: s.id === otherId
  }, s.id, " \xB7 ", s.name)));
  return /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "card-head"
  }, /*#__PURE__*/React.createElement("h3", null, "Head-to-head"), /*#__PURE__*/React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 10,
      color: "var(--muted)"
    }
  }, "equity overlay normalized to 100 at first close")), /*#__PURE__*/React.createElement("div", {
    className: "card-body"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 12,
      alignItems: "center",
      flexWrap: "wrap",
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("i", {
    style: {
      width: 8,
      height: 8,
      background: _COMPARE_COLORS[0],
      borderRadius: 2
    }
  }), /*#__PURE__*/React.createElement("span", {
    className: "label",
    style: {
      fontFamily: "var(--mono)",
      fontSize: 10,
      textTransform: "uppercase",
      letterSpacing: "0.08em",
      color: "var(--muted)"
    }
  }, "A"), _select(aId, setAId, bId, "selA")), /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("i", {
    style: {
      width: 8,
      height: 8,
      background: _COMPARE_COLORS[1],
      borderRadius: 2
    }
  }), /*#__PURE__*/React.createElement("span", {
    className: "label",
    style: {
      fontFamily: "var(--mono)",
      fontSize: 10,
      textTransform: "uppercase",
      letterSpacing: "0.08em",
      color: "var(--muted)"
    }
  }, "B"), _select(bId, setBId, aId, "selB"))), /*#__PURE__*/React.createElement("div", {
    className: "chart-wrap",
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("svg", {
    viewBox: `0 0 ${W} ${H}`,
    width: "100%",
    height: "200",
    style: {
      display: "block"
    }
  }, [minV, minV + range / 2, maxV].map((v, i) => /*#__PURE__*/React.createElement("g", {
    key: i
  }, /*#__PURE__*/React.createElement("line", {
    x1: PAD_L,
    x2: W - PAD_R,
    y1: yFor(v),
    y2: yFor(v),
    stroke: "var(--line)",
    strokeDasharray: "2 4"
  }), /*#__PURE__*/React.createElement("text", {
    x: PAD_L - 6,
    y: yFor(v) + 3,
    fill: "var(--muted)",
    fontSize: "10",
    textAnchor: "end",
    fontFamily: "var(--mono)"
  }, (v - 100).toFixed(0), "%"))), /*#__PURE__*/React.createElement("line", {
    x1: PAD_L,
    x2: W - PAD_R,
    y1: yFor(100),
    y2: yFor(100),
    stroke: "var(--line-2)",
    strokeDasharray: "3 3"
  }), nA.length > 0 && /*#__PURE__*/React.createElement("polyline", {
    points: linePts(nA),
    fill: "none",
    stroke: _COMPARE_COLORS[0],
    strokeWidth: "1.8",
    strokeLinejoin: "round"
  }), nB.length > 0 && /*#__PURE__*/React.createElement("polyline", {
    points: linePts(nB),
    fill: "none",
    stroke: _COMPARE_COLORS[1],
    strokeWidth: "1.8",
    strokeLinejoin: "round"
  }), !hasData && /*#__PURE__*/React.createElement("text", {
    x: W / 2,
    y: H / 2,
    fill: "var(--muted)",
    fontSize: "11",
    textAnchor: "middle",
    fontFamily: "var(--mono)"
  }, "no closed-trade equity series for either strategy yet"))), /*#__PURE__*/React.createElement("table", {
    className: "trades"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Metric"), /*#__PURE__*/React.createElement("th", {
    className: "num",
    style: {
      color: _COMPARE_COLORS[0]
    }
  }, a.id), /*#__PURE__*/React.createElement("th", {
    className: "num",
    style: {
      color: _COMPARE_COLORS[1]
    }
  }, b.id), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "A \u2212 B"))), /*#__PURE__*/React.createElement("tbody", null, stats.map(row => /*#__PURE__*/React.createElement("tr", {
    key: row.label
  }, /*#__PURE__*/React.createElement("td", {
    className: "dim"
  }, row.label), /*#__PURE__*/React.createElement("td", {
    className: "num"
  }, row.fa), /*#__PURE__*/React.createElement("td", {
    className: "num"
  }, row.fb), /*#__PURE__*/React.createElement("td", {
    className: `num ${row.deltaTone}`
  }, row.delta)))))));
}
Object.assign(window, {
  StrategyComparisonPanel
});

/* ---- panels/wsb-head-to-head.jsx ---- */
/* global React */
// G3 — <WSBHeadToHead>: pinned head-to-head between WSB_FADE (contrarian
// at extreme bull spikes) and WSB_EARN (event-driven earnings runs). Both
// are fed primarily by r/wallstreetbets — same subreddit, opposite
// mechanics. Renders the verdict: "which wins?"
//
// Reads:
//   - window.STRATEGIES (rows with id/name/sharpe/winRate/trades/ytdPct/dd)
//   - window.STRATEGY_EQUITY_SERIES ({sid: [{t, equity}, ...]})
//   - window.TRADES (filtered to the two strategies for hold + recent fill)

var _WSB_PAIR = ["WSB_FADE", "WSB_EARN"];
var _WSB_COLORS = {
  WSB_FADE: "oklch(0.66 0.10 280)",
  // matches CONTRA palette
  WSB_EARN: "oklch(0.78 0.18 25)" // matches WSB palette
};
function _wsbHold(opened, closed) {
  if (!opened || !closed) return null;
  var a = new Date(opened).getTime();
  var b = new Date(closed).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  var d = (b - a) / 86400000;
  return d >= 0 ? d : null;
}
function _wsbTradesFor(trades, sid) {
  return (trades || []).filter(t => t && t.strategy === sid);
}
function _wsbAvgHold(trades, sid) {
  var xs = _wsbTradesFor(trades, sid).filter(t => t.status === "CLOSED").map(t => _wsbHold(t.opened, t.closed)).filter(v => v != null);
  if (xs.length === 0) return null;
  return xs.reduce((s, v) => s + v, 0) / xs.length;
}
function _wsbVerdict(a, b) {
  // a, b are the strategy rows. Verdict picks the one with the better
  // YTD return when both have trades; otherwise reports the disparity.
  var aTrades = a && a.trades ? a.trades : 0;
  var bTrades = b && b.trades ? b.trades : 0;
  if (aTrades === 0 && bTrades === 0) {
    return {
      winner: null,
      line: "Both strategies are still warming up — no trades attributed yet."
    };
  }
  if (aTrades === 0) {
    return {
      winner: b.id,
      line: `${b.id} is live with ${bTrades} trades; ${a.id} has logged none yet.`
    };
  }
  if (bTrades === 0) {
    return {
      winner: a.id,
      line: `${a.id} is live with ${aTrades} trades; ${b.id} has logged none yet.`
    };
  }
  if (a.ytdPct === b.ytdPct) {
    return {
      winner: null,
      line: `Dead heat at ${a.ytdPct.toFixed(1)}% YTD apiece.`
    };
  }
  var w = a.ytdPct > b.ytdPct ? a : b;
  var l = a.ytdPct > b.ytdPct ? b : a;
  var delta = (w.ytdPct - l.ytdPct).toFixed(1);
  return {
    winner: w.id,
    line: `${w.id} leads by ${delta} pts YTD (${w.ytdPct.toFixed(1)}% vs ${l.ytdPct.toFixed(1)}%).`
  };
}
function WSBHeadToHead() {
  var strategies = Array.isArray(window.STRATEGIES) ? window.STRATEGIES : [];
  var equitySeries = window.STRATEGY_EQUITY_SERIES || {};
  var trades = Array.isArray(window.TRADES) ? window.TRADES : [];
  var fade = strategies.find(s => s.id === "WSB_FADE");
  var earn = strategies.find(s => s.id === "WSB_EARN");
  if (!fade || !earn) {
    return /*#__PURE__*/React.createElement("div", {
      className: "card",
      style: {
        marginBottom: 12
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "card-head"
    }, /*#__PURE__*/React.createElement("h3", null, "WSB_FADE vs WSB_EARN \xB7 same subreddit, opposite mechanics")), /*#__PURE__*/React.createElement("div", {
      className: "card-body"
    }, /*#__PURE__*/React.createElement("p", {
      className: "mono",
      style: {
        margin: 0,
        color: "var(--muted)",
        fontSize: 12
      }
    }, "Both strategies must be registered to render this head-to-head.", !fade && " WSB_FADE missing.", !earn && " WSB_EARN missing.")));
  }
  var fadeHold = _wsbAvgHold(trades, "WSB_FADE");
  var earnHold = _wsbAvgHold(trades, "WSB_EARN");
  var verdict = _wsbVerdict(fade, earn);
  var seriesFade = Array.isArray(equitySeries.WSB_FADE) ? equitySeries.WSB_FADE : [];
  var seriesEarn = Array.isArray(equitySeries.WSB_EARN) ? equitySeries.WSB_EARN : [];

  // Equity overlay: normalize to 100 at first close, align by index.
  var W = 720,
    H = 200,
    PAD_L = 44,
    PAD_R = 12,
    PAD_T = 12,
    PAD_B = 22;
  var norm = s => {
    if (!s || s.length === 0) return [];
    var base = s[0].equity || 1;
    return s.map(p => p.equity / base * 100);
  };
  var nF = norm(seriesFade);
  var nE = norm(seriesEarn);
  var all = nF.concat(nE);
  var hasData = all.length > 0;
  var minV = hasData ? Math.min(100, ...all) * 0.99 : 95;
  var maxV = hasData ? Math.max(100, ...all) * 1.01 : 105;
  var range = maxV - minV || 1;
  var longest = Math.max(nF.length, nE.length, 1);
  var xFor = (i, total) => {
    var denom = Math.max(longest - 1, 1);
    var proportion = total <= 1 ? 1 : i / (total - 1) * ((total - 1) / denom);
    return PAD_L + proportion * (W - PAD_L - PAD_R);
  };
  var yFor = v => PAD_T + (maxV - v) / range * (H - PAD_T - PAD_B);
  var linePts = arr => arr.map((v, i) => `${xFor(i, arr.length)},${yFor(v)}`).join(" ");
  var rows = [{
    label: "YTD return",
    f: fade.ytdPct,
    e: earn.ytdPct,
    fmt: v => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`,
    delta: d => `${d >= 0 ? "+" : ""}${d.toFixed(1)} pts`
  }, {
    label: "Sharpe",
    f: fade.sharpe,
    e: earn.sharpe,
    fmt: v => v.toFixed(2),
    delta: d => `${d >= 0 ? "+" : ""}${d.toFixed(2)}`
  }, {
    label: "Win rate",
    f: fade.winRate,
    e: earn.winRate,
    fmt: v => `${(v * 100).toFixed(0)}%`,
    delta: d => `${d >= 0 ? "+" : ""}${(d * 100).toFixed(0)} pp`
  }, {
    label: "Trades",
    f: fade.trades,
    e: earn.trades,
    fmt: v => String(v),
    delta: d => `${d >= 0 ? "+" : ""}${d}`
  }, {
    label: "Max DD",
    f: fade.dd,
    e: earn.dd,
    fmt: v => `${v.toFixed(1)}%`,
    delta: d => `${d >= 0 ? "+" : ""}${d.toFixed(1)} pts`,
    betterLow: true
  }, {
    label: "Avg hold (d)",
    f: fadeHold,
    e: earnHold,
    fmt: v => v == null ? "—" : v.toFixed(1),
    delta: d => `${d >= 0 ? "+" : ""}${d.toFixed(1)}d`
  }];
  var fmtCell = (v, fmt) => v == null ? "—" : fmt(v);
  var deltaCell = (f, e, fmt, betterLow) => {
    if (typeof f !== "number" || typeof e !== "number") return {
      txt: "—",
      tone: ""
    };
    var d = f - e;
    if (d === 0) return {
      txt: "0",
      tone: ""
    };
    var better = betterLow ? d < 0 : d > 0;
    return {
      txt: fmt(d),
      tone: better ? "up" : "down"
    };
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "card-head"
  }, /*#__PURE__*/React.createElement("h3", null, "WSB_FADE vs WSB_EARN \xB7 same subreddit, opposite mechanics"), /*#__PURE__*/React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 10,
      color: "var(--muted)"
    }
  }, "both fed by r/wallstreetbets \xB7 which mechanic wins?")), /*#__PURE__*/React.createElement("div", {
    className: "card-body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "mono",
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 12,
      marginBottom: 12,
      fontSize: 12,
      color: "var(--text-2)",
      lineHeight: 1.6
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 10,
      background: "var(--surface-2)",
      border: `1px solid ${_WSB_COLORS.WSB_FADE}33`,
      borderLeft: `3px solid ${_WSB_COLORS.WSB_FADE}`,
      borderRadius: 4
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 600,
      color: _WSB_COLORS.WSB_FADE,
      marginBottom: 4
    }
  }, "WSB_FADE \xB7 contrarian"), "Shorts when WSB attention crosses the 95th-percentile mention spike AND bull_share > 0.85. Holds 5 trading days. Edge: \u22128.5% HPRs at peak attention (Wang et al., 2024)."), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 10,
      background: "var(--surface-2)",
      border: `1px solid ${_WSB_COLORS.WSB_EARN}33`,
      borderLeft: `3px solid ${_WSB_COLORS.WSB_EARN}`,
      borderRadius: 4
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 600,
      color: _WSB_COLORS.WSB_EARN,
      marginBottom: 4
    }
  }, "WSB_EARN \xB7 event-driven"), "Longs WSB-discussed tickers into earnings. Enters T\u22127, exits T+1. Captures the pre-event attention bid and earnings drift on names the crowd is already watching.")), /*#__PURE__*/React.createElement("div", {
    className: "mono",
    style: {
      padding: "8px 12px",
      marginBottom: 12,
      background: verdict.winner ? `${_WSB_COLORS[verdict.winner]}1a` : "var(--surface-2)",
      border: `1px solid ${verdict.winner ? _WSB_COLORS[verdict.winner] : "var(--line)"}`,
      borderRadius: 4,
      fontSize: 12
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--mono)",
      fontSize: 10,
      textTransform: "uppercase",
      letterSpacing: "0.08em",
      color: "var(--muted)",
      marginRight: 8
    }
  }, "verdict"), verdict.line), /*#__PURE__*/React.createElement("div", {
    className: "chart-wrap",
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("svg", {
    viewBox: `0 0 ${W} ${H}`,
    width: "100%",
    height: "200",
    style: {
      display: "block"
    }
  }, [minV, minV + range / 2, maxV].map((v, i) => /*#__PURE__*/React.createElement("g", {
    key: i
  }, /*#__PURE__*/React.createElement("line", {
    x1: PAD_L,
    x2: W - PAD_R,
    y1: yFor(v),
    y2: yFor(v),
    stroke: "var(--line)",
    strokeDasharray: "2 4"
  }), /*#__PURE__*/React.createElement("text", {
    x: PAD_L - 6,
    y: yFor(v) + 3,
    fill: "var(--muted)",
    fontSize: "10",
    textAnchor: "end",
    fontFamily: "var(--mono)"
  }, (v - 100).toFixed(0), "%"))), /*#__PURE__*/React.createElement("line", {
    x1: PAD_L,
    x2: W - PAD_R,
    y1: yFor(100),
    y2: yFor(100),
    stroke: "var(--line-2)",
    strokeDasharray: "3 3"
  }), nF.length > 0 && /*#__PURE__*/React.createElement("polyline", {
    points: linePts(nF),
    fill: "none",
    stroke: _WSB_COLORS.WSB_FADE,
    strokeWidth: "1.8",
    strokeLinejoin: "round"
  }), nE.length > 0 && /*#__PURE__*/React.createElement("polyline", {
    points: linePts(nE),
    fill: "none",
    stroke: _WSB_COLORS.WSB_EARN,
    strokeWidth: "1.8",
    strokeLinejoin: "round"
  }), !hasData && /*#__PURE__*/React.createElement("text", {
    x: W / 2,
    y: H / 2,
    fill: "var(--muted)",
    fontSize: "11",
    textAnchor: "middle",
    fontFamily: "var(--mono)"
  }, "no closed-trade equity series for WSB_FADE or WSB_EARN yet"))), /*#__PURE__*/React.createElement("table", {
    className: "trades"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Metric"), /*#__PURE__*/React.createElement("th", {
    className: "num",
    style: {
      color: _WSB_COLORS.WSB_FADE
    }
  }, "WSB_FADE"), /*#__PURE__*/React.createElement("th", {
    className: "num",
    style: {
      color: _WSB_COLORS.WSB_EARN
    }
  }, "WSB_EARN"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "FADE \u2212 EARN"))), /*#__PURE__*/React.createElement("tbody", null, rows.map(r => {
    var d = deltaCell(r.f, r.e, r.delta, r.betterLow);
    return /*#__PURE__*/React.createElement("tr", {
      key: r.label
    }, /*#__PURE__*/React.createElement("td", {
      className: "dim"
    }, r.label), /*#__PURE__*/React.createElement("td", {
      className: "num"
    }, fmtCell(r.f, r.fmt)), /*#__PURE__*/React.createElement("td", {
      className: "num"
    }, fmtCell(r.e, r.fmt)), /*#__PURE__*/React.createElement("td", {
      className: `num ${d.tone}`
    }, d.txt));
  })))));
}
Object.assign(window, {
  WSBHeadToHead
});

/* ---- panels/signal-agreement-panel.jsx ---- */
/* global React */
// G1 — <SignalAgreementPanel>: per-thesis 4-source signal agreement.
// For each thesis (window.THESES), shows what 4 distinct signal sources
// said about the ticker:
//   1. legacy momentum         → derived from window.AUDIT_LOG
//                                (rule_break / signal entries by ticker)
//   2. event-driven agent      → derived from thesis.contributors
//                                (the agent strategies that built the thesis)
//   3. ticker_intent           → derived from thesis direction + confidence
//   4. unusual_options_volume  → looked up in window.OPTIONS_FLOW by ticker
//
// When window.SIGNAL_AGREEMENT[thesis.key] is present (G2 aggregation),
// it overrides the inferred view — that lets G2 land later without
// touching this file again.
//
// Agreement is highlighted: when 3+ sources lean the same direction
// (long/short), the row gets a green/red border tint.

var _SOURCES = ["momentum", "agent", "intent", "options"];
var _SOURCE_LABELS = {
  momentum: "Legacy momentum",
  agent: "Event-driven agent",
  intent: "ticker_intent",
  options: "Unusual options"
};
function _normDir(d) {
  if (d === "long" || d === "bullish" || d === "buy") return "long";
  if (d === "short" || d === "bearish" || d === "sell") return "short";
  return "neutral";
}
function _toneFor(dir) {
  if (dir === "long") return {
    color: "var(--pos)",
    label: "long"
  };
  if (dir === "short") return {
    color: "var(--neg)",
    label: "short"
  };
  return {
    color: "var(--muted)",
    label: "—"
  };
}
function _inferMomentum(ticker, auditLog) {
  if (!ticker || !Array.isArray(auditLog)) return {
    dir: "neutral",
    note: "no audit row"
  };
  var tk = ticker.toUpperCase();
  for (var row of auditLog) {
    if (!row || (row.ticker || "").toUpperCase() !== tk) continue;
    if (row.action === "rule_break") {
      return {
        dir: "neutral",
        note: row.rationale || "rejected"
      };
    }
    var meta = row.metadata || {};
    var decision = (meta.decision || "").toLowerCase();
    if (decision === "buy" || row.action === "buy") return {
      dir: "long",
      note: row.action || "buy"
    };
    if (decision === "sell" || row.action === "sell") return {
      dir: "short",
      note: row.action || "sell"
    };
  }
  return {
    dir: "neutral",
    note: "silent"
  };
}
function _inferAgent(thesis) {
  var contributors = Array.isArray(thesis.contributors) ? thesis.contributors : [];
  var agents = contributors.filter(c => /^[A-Z_]+$/.test(c) && !c.startsWith("r_"));
  if (agents.length === 0) return {
    dir: "neutral",
    note: "no agent contributor"
  };
  return {
    dir: _normDir(thesis.direction),
    note: agents.join(" + ")
  };
}
function _inferIntent(thesis) {
  var conf = typeof thesis.confidence === "number" ? thesis.confidence : null;
  if (conf == null) return {
    dir: "neutral",
    note: "no confidence"
  };
  if (conf < 0.5) return {
    dir: "neutral",
    note: `conf ${conf.toFixed(2)}`
  };
  return {
    dir: _normDir(thesis.direction),
    note: `conf ${conf.toFixed(2)}`
  };
}
function _inferOptions(ticker, optionsFlow) {
  if (!ticker || !Array.isArray(optionsFlow)) return {
    dir: "neutral",
    note: "no flow row"
  };
  var tk = ticker.toUpperCase();
  var row = optionsFlow.find(r => r && (r.ticker || "").toUpperCase() === tk);
  if (!row) return {
    dir: "neutral",
    note: "no flow row"
  };
  var dir = _normDir(row.direction);
  var tag = row.isUnusual ? "unusual" : "normal";
  var cp = typeof row.callPutRatio === "number" ? ` C/P ${row.callPutRatio.toFixed(2)}` : "";
  return {
    dir,
    note: `${tag}${cp}`
  };
}
function _signalsFor(thesis, auditLog, optionsFlow, override) {
  if (override && typeof override === "object") {
    var out = {};
    for (var k of _SOURCES) {
      var v = override[k];
      if (v && typeof v === "object") {
        out[k] = {
          dir: _normDir(v.dir || v.direction),
          note: v.note || ""
        };
      } else {
        out[k] = {
          dir: "neutral",
          note: "—"
        };
      }
    }
    return out;
  }
  return {
    momentum: _inferMomentum(thesis.ticker, auditLog),
    agent: _inferAgent(thesis),
    intent: _inferIntent(thesis),
    options: _inferOptions(thesis.ticker, optionsFlow)
  };
}
function _agreementFor(signals) {
  var long = 0;
  var short = 0;
  for (var k of _SOURCES) {
    var s = signals[k];
    if (!s) continue;
    if (s.dir === "long") long += 1;else if (s.dir === "short") short += 1;
  }
  var max = Math.max(long, short);
  if (max < 3) return {
    dir: "neutral",
    count: max,
    label: `${max}/4`
  };
  if (long > short) return {
    dir: "long",
    count: long,
    label: `${long}/4 long`
  };
  return {
    dir: "short",
    count: short,
    label: `${short}/4 short`
  };
}
function SignalAgreementPanel({
  limit
}) {
  var theses = Array.isArray(window.THESES) ? window.THESES : [];
  var auditLog = Array.isArray(window.AUDIT_LOG) ? window.AUDIT_LOG : [];
  var optionsFlow = Array.isArray(window.OPTIONS_FLOW) ? window.OPTIONS_FLOW : [];
  var overrides = window.SIGNAL_AGREEMENT && typeof window.SIGNAL_AGREEMENT === "object" ? window.SIGNAL_AGREEMENT : {};
  if (theses.length === 0) {
    return /*#__PURE__*/React.createElement("div", {
      className: "card",
      style: {
        marginBottom: 12
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "card-head"
    }, /*#__PURE__*/React.createElement("h3", null, "Signal agreement \xB7 4-way")), /*#__PURE__*/React.createElement("div", {
      className: "card-body"
    }, /*#__PURE__*/React.createElement("p", {
      style: {
        color: "var(--muted)",
        fontFamily: "var(--mono)",
        fontSize: 12,
        margin: 0
      }
    }, "No theses yet \u2014 nothing to compare.")));
  }

  // Newest-first (by updatedAt) so the active book bubbles up; fall back
  // to input order if updatedAt is missing.
  var sorted = theses.slice().sort((a, b) => {
    var ta = new Date(a.updatedAt || 0).getTime() || 0;
    var tb = new Date(b.updatedAt || 0).getTime() || 0;
    return tb - ta;
  });
  var max = typeof limit === "number" && limit > 0 ? limit : 12;
  var rows = sorted.slice(0, max);
  return /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "card-head"
  }, /*#__PURE__*/React.createElement("h3", null, "Signal agreement \xB7 4-way"), /*#__PURE__*/React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 10,
      color: "var(--muted)"
    }
  }, "legacy momentum \xB7 event agent \xB7 ticker_intent \xB7 options flow \xB7 3+ aligned highlights")), /*#__PURE__*/React.createElement("div", {
    className: "card-body tight"
  }, /*#__PURE__*/React.createElement("table", {
    className: "trades"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Ticker"), /*#__PURE__*/React.createElement("th", null, "Thesis"), _SOURCES.map(s => /*#__PURE__*/React.createElement("th", {
    key: s,
    className: "num",
    style: {
      minWidth: 110
    }
  }, _SOURCE_LABELS[s])), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Agreement"))), /*#__PURE__*/React.createElement("tbody", null, rows.map(th => {
    var signals = _signalsFor(th, auditLog, optionsFlow, overrides[th.key]);
    var agree = _agreementFor(signals);
    var tone = _toneFor(agree.dir);
    var rowStyle = agree.count >= 3 ? {
      borderLeft: `3px solid ${tone.color}`
    } : {};
    return /*#__PURE__*/React.createElement("tr", {
      key: th.key,
      style: rowStyle
    }, /*#__PURE__*/React.createElement("td", {
      className: "ticker"
    }, th.ticker), /*#__PURE__*/React.createElement("td", {
      className: "dim",
      style: {
        fontSize: 11,
        maxWidth: 220
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: "var(--mono)",
        fontSize: 10,
        color: "var(--muted)"
      }
    }, th.state, " \xB7 ", th.catalyst || "—"), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 11
      }
    }, (th.contributors || []).join(", ") || "—")), _SOURCES.map(s => {
      var sig = signals[s];
      var t = _toneFor(sig.dir);
      return /*#__PURE__*/React.createElement("td", {
        key: s,
        className: "num",
        style: {
          fontFamily: "var(--mono)",
          fontSize: 11
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          color: t.color,
          fontWeight: 600
        }
      }, t.label), /*#__PURE__*/React.createElement("div", {
        style: {
          color: "var(--muted)",
          fontSize: 10
        }
      }, sig.note));
    }), /*#__PURE__*/React.createElement("td", {
      className: "num",
      style: {
        fontFamily: "var(--mono)",
        fontSize: 11,
        color: tone.color,
        fontWeight: 600
      }
    }, agree.label));
  })))));
}
Object.assign(window, {
  SignalAgreementPanel
});

/* ---- panels/subreddit-alpha-attribution.jsx ---- */
/* global React */
// G4 — <SubredditAlphaAttribution>: per-subreddit alpha attribution panel.
// For each subreddit, shows total realized P&L, win rate, avg hold, Sharpe,
// over a 30d / 90d window toggle. Reads window.SUB_ATTRIBUTION (built by
// aggregations.build_sub_attribution from data/per_sub_outcomes.jsonl).
//
// Renders on the Reddit Intel page so the reader can see, at a glance,
// which subreddit is generating real P&L vs. just noise.

var _SAA_WINDOWS = ["30", "90"];
function _saaFmtUsd(v) {
  if (typeof v !== "number" || !Number.isFinite(v)) return "—";
  var sign = v >= 0 ? "+" : "−";
  var abs = Math.abs(v);
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(1)}k`;
  return `${sign}$${abs.toFixed(0)}`;
}
function _saaFmtPct(v) {
  if (typeof v !== "number" || !Number.isFinite(v)) return "—";
  return `${(v * 100).toFixed(0)}%`;
}
function _saaFmtSharpe(v) {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toFixed(2);
}
function _saaFmtHold(v) {
  if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) return "—";
  return `${v.toFixed(1)}d`;
}
function _saaPnlTone(v) {
  if (typeof v !== "number" || !Number.isFinite(v)) return "";
  if (v > 0) return "up";
  if (v < 0) return "down";
  return "";
}
function SubredditAlphaAttribution() {
  var data = window.SUB_ATTRIBUTION && typeof window.SUB_ATTRIBUTION === "object" ? window.SUB_ATTRIBUTION : null;
  var [windowKey, setWindowKey] = React.useState("30");
  var byWindow = data && data.by_window || {};
  var rows = Array.isArray(byWindow[windowKey]) ? byWindow[windowKey] : [];
  if (!data || rows.length === 0) {
    return /*#__PURE__*/React.createElement("div", {
      className: "card",
      style: {
        marginBottom: 12
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "card-head"
    }, /*#__PURE__*/React.createElement("h3", null, "Subreddit alpha attribution"), /*#__PURE__*/React.createElement("span", {
      className: "mono",
      style: {
        fontSize: 10,
        color: "var(--muted)"
      }
    }, "which subreddit is paying for itself?")), /*#__PURE__*/React.createElement("div", {
      className: "card-body"
    }, /*#__PURE__*/React.createElement("p", {
      className: "mono",
      style: {
        margin: 0,
        color: "var(--muted)",
        fontSize: 12
      }
    }, "No per-subreddit attribution rows yet \u2014 `per_sub_outcomes.jsonl` is empty or the snapshot has not run since theses started entering positions.")));
  }

  // The aggregation already sorts by total_pnl_usd desc. Hoist a small
  // summary line for the page reader: best/worst sub and total realized.
  var sumRealized = rows.reduce((s, r) => s + (Number(r.realized_pnl_usd) || 0), 0);
  var sumExits = rows.reduce((s, r) => s + (Number(r.n_exits) || 0), 0);
  var best = rows[0];
  var worst = rows[rows.length - 1];
  var computedAt = data.computed_at ? new Date(data.computed_at) : null;
  return /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "card-head"
  }, /*#__PURE__*/React.createElement("h3", null, "Subreddit alpha attribution \xB7 ", windowKey, "d"), /*#__PURE__*/React.createElement("div", {
    className: "row",
    style: {
      gap: 6,
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 10,
      color: "var(--muted)",
      marginRight: 8
    }
  }, "which subreddit is paying for itself?"), _SAA_WINDOWS.map(w => /*#__PURE__*/React.createElement("button", {
    key: w,
    type: "button",
    onClick: () => setWindowKey(w),
    className: "mono",
    style: {
      padding: "2px 8px",
      fontSize: 11,
      background: w === windowKey ? "var(--accent)" : "var(--surface-2)",
      color: w === windowKey ? "var(--bg)" : "var(--text-2)",
      border: "1px solid var(--line)",
      borderRadius: 3,
      cursor: "pointer"
    }
  }, w, "d")))), /*#__PURE__*/React.createElement("div", {
    className: "card-body tight"
  }, /*#__PURE__*/React.createElement("div", {
    className: "mono",
    style: {
      padding: "8px 12px",
      background: "var(--surface-2)",
      borderBottom: "1px solid var(--line)",
      fontSize: 11,
      color: "var(--text-2)",
      display: "grid",
      gridTemplateColumns: "1fr 1fr 1fr",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--muted)"
    }
  }, "total realized\xA0"), /*#__PURE__*/React.createElement("span", {
    className: _saaPnlTone(sumRealized)
  }, _saaFmtUsd(sumRealized)), /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--muted)"
    }
  }, "\xA0\xB7 ", sumExits, " closed")), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--muted)"
    }
  }, "best\xA0"), "r/", best.subreddit, /*#__PURE__*/React.createElement("span", {
    className: _saaPnlTone(best.total_pnl_usd),
    style: {
      marginLeft: 4
    }
  }, _saaFmtUsd(best.total_pnl_usd))), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--muted)"
    }
  }, "worst\xA0"), "r/", worst.subreddit, /*#__PURE__*/React.createElement("span", {
    className: _saaPnlTone(worst.total_pnl_usd),
    style: {
      marginLeft: 4
    }
  }, _saaFmtUsd(worst.total_pnl_usd)))), /*#__PURE__*/React.createElement("table", {
    className: "trades"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Subreddit"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Realized P&L"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Win rate"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Avg hold"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Sharpe"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Trades"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Killed / deferred"))), /*#__PURE__*/React.createElement("tbody", null, rows.map(r => /*#__PURE__*/React.createElement("tr", {
    key: r.subreddit
  }, /*#__PURE__*/React.createElement("td", {
    className: "ticker"
  }, "r/", r.subreddit), /*#__PURE__*/React.createElement("td", {
    className: `num ${_saaPnlTone(r.realized_pnl_usd)}`
  }, _saaFmtUsd(r.realized_pnl_usd)), /*#__PURE__*/React.createElement("td", {
    className: "num"
  }, _saaFmtPct(r.win_rate)), /*#__PURE__*/React.createElement("td", {
    className: "num"
  }, _saaFmtHold(r.avg_hold_days)), /*#__PURE__*/React.createElement("td", {
    className: "num"
  }, _saaFmtSharpe(r.sharpe)), /*#__PURE__*/React.createElement("td", {
    className: "num dim"
  }, r.n_exits || 0, /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--muted)"
    }
  }, " / ", r.n_entries || 0)), /*#__PURE__*/React.createElement("td", {
    className: "num dim"
  }, r.n_killed || 0, /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--muted)"
    }
  }, " / ", r.n_deferred || 0)))))), computedAt && /*#__PURE__*/React.createElement("div", {
    className: "mono",
    style: {
      padding: "6px 12px",
      fontSize: 10,
      color: "var(--muted)",
      borderTop: "1px solid var(--line)"
    }
  }, "attribution computed ", computedAt.toISOString().slice(0, 19).replace("T", " "), "Z \xB7 P&L split pro-rata by contributor confidence when multiple subreddits feed a thesis \xB7 Sharpe is a 5d-return proxy, not portfolio Sharpe")));
}
Object.assign(window, {
  SubredditAlphaAttribution
});

/* ---- panels/decision-narrative-stream.jsx ---- */
/* global React */
// D5 — <DecisionNarrativeStream>: "the agent did X because Y" feed.
// Reads window.AGENT_REPORTS (rows produced by snapshot's
// _build_agent_reports_panel, already newest-first + cost-normalized) and
// renders each row as a single narrative line:
//
//   2026-05-12 11:00  [ENTERED 2]  because PANW entry deferred (market closed) …
//
// Different from <TickReportFeed> (D2), which is tabular with expandable
// provenance — this is the prose-y story-mode view for the Methodology page.

function _verbFor(report) {
  var r = report || {};
  if (r.kind === "roadmap") {
    var item = r.item || "";
    return {
      label: item ? `Roadmap ${item}` : "Roadmap",
      tone: "accent"
    };
  }
  // position_reasoning[_book] rows come from the 2h book-review cron
  // (position_reasoning.py) — a per-position or book-level rationale, never
  // a mechanical order event, so it gets its own badge rather than falling
  // through to the generic "Tick" label.
  if (r.kind === "position_reasoning_book") {
    return {
      label: "Book note",
      tone: "accent"
    };
  }
  if (r.kind === "position_reasoning") {
    if (r.status === "failed") return {
      label: "Review failed",
      tone: "neg"
    };
    if (r.status === "closed") return {
      label: "Closed",
      tone: "muted"
    };
    return {
      label: r.early_close_flag ? "Rotation flag" : "Holding",
      tone: r.early_close_flag ? "warn" : "info"
    };
  }
  if (Array.isArray(r.errors) && r.errors.length > 0) {
    return {
      label: `Errored ${r.errors.length}`,
      tone: "neg"
    };
  }
  if ((r.entered || 0) > 0) return {
    label: `Entered ${r.entered}`,
    tone: "pos"
  };
  if ((r.exited || 0) > 0) return {
    label: `Exited ${r.exited}`,
    tone: "warn"
  };
  if ((r.killed || 0) > 0) return {
    label: `Killed ${r.killed}`,
    tone: "neg"
  };
  if ((r.corroborated || 0) > 0) return {
    label: `Corroborated ${r.corroborated}`,
    tone: "pos"
  };
  if ((r.detected || 0) > 0) return {
    label: `Detected ${r.detected}`,
    tone: "info"
  };
  if ((r.deferred_market_closed || 0) > 0) return {
    label: "Deferred",
    tone: "muted"
  };
  if ((r.skipped_market_closed || 0) > 0) return {
    label: "Skipped",
    tone: "muted"
  };
  if ((r.skipped_no_corroboration || 0) > 0) return {
    label: "Skipped",
    tone: "muted"
  };
  return {
    label: "Tick",
    tone: "muted"
  };
}
function _toneColor(tone) {
  switch (tone) {
    case "pos":
      return "var(--pos)";
    case "neg":
      return "var(--neg)";
    case "warn":
      return "var(--warn)";
    case "info":
      return "var(--info)";
    case "accent":
      return "var(--accent)";
    default:
      return "var(--muted)";
  }
}
function _fmtNarrativeTs(ts) {
  if (!ts) return "—";
  try {
    var d = new Date(ts);
    if (Number.isNaN(d.getTime())) return ts;
    var pad = n => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` + `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch (e) {
    return ts;
  }
}
function _fmtNarrativeCost(v) {
  if (v == null) return null;
  var n = Number(v);
  if (!Number.isFinite(n) || n === 0) return null;
  if (n < 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}
function DecisionNarrativeLine({
  report
}) {
  var {
    ts,
    summary,
    costUsd
  } = report || {};
  var verb = _verbFor(report);
  var color = _toneColor(verb.tone);
  var hasSummary = typeof summary === "string" && summary.trim().length > 0;
  var costLabel = _fmtNarrativeCost(costUsd);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 12,
      padding: "10px 14px",
      borderBottom: "1px solid var(--line)",
      alignItems: "flex-start"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--mono)",
      fontSize: 10.5,
      color: "var(--muted)",
      minWidth: 110,
      paddingTop: 2,
      whiteSpace: "nowrap"
    }
  }, _fmtNarrativeTs(ts)), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--mono)",
      fontSize: 10,
      fontWeight: 600,
      textTransform: "uppercase",
      letterSpacing: "0.08em",
      color,
      background: "var(--surface-2)",
      border: `1px solid ${color}`,
      padding: "2px 8px",
      borderRadius: 3,
      minWidth: 92,
      textAlign: "center",
      whiteSpace: "nowrap",
      marginTop: 1
    }
  }, verb.label), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      fontFamily: "var(--mono)",
      fontSize: 12,
      color: "var(--text)",
      lineHeight: 1.55
    }
  }, hasSummary ? /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--muted)"
    }
  }, "because "), summary) : /*#__PURE__*/React.createElement("span", {
    className: "dim"
  }, "(no narrative recorded)")), costLabel && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--mono)",
      fontSize: 10,
      color: "var(--warn)",
      paddingTop: 3,
      whiteSpace: "nowrap"
    }
  }, costLabel));
}
function DecisionNarrativeStream({
  reports,
  limit
}) {
  var raw = Array.isArray(reports) ? reports : window.AGENT_REPORTS || [];
  if (raw.length === 0) {
    return /*#__PURE__*/React.createElement("p", {
      style: {
        color: "var(--muted)",
        fontFamily: "var(--mono)",
        fontSize: 13,
        padding: "10px 14px",
        margin: 0
      }
    }, "No agent decisions logged yet.");
  }
  // snapshot emits newest-first; tolerate any order defensively.
  var sorted = [...raw].sort((a, b) => {
    var at = a && a.ts || "";
    var bt = b && b.ts || "";
    if (at === bt) return 0;
    return at < bt ? 1 : -1;
  });
  var cap = typeof limit === "number" ? limit : 25;
  var shown = sorted.slice(0, cap);
  return /*#__PURE__*/React.createElement("div", null, shown.map((r, i) => /*#__PURE__*/React.createElement(DecisionNarrativeLine, {
    key: r && r.ts || i,
    report: r
  })));
}
Object.assign(window, {
  DecisionNarrativeStream,
  DecisionNarrativeLine
});

/* ---- app.jsx ---- */
/* global React, ReactDOM, SITE, PERF, EQUITY, HEATMAP, TRADES, WATCHLIST, SUBREDDITS, TRENDING, THEMES, STRATEGIES, WEEKLY_REPORTS, UNIVERSE_COVERAGE, SLEEVE_ACTIVATION, UPCOMING_CATALYSTS,
   StatusBar, Header, Hero, StatStrip, PerStrategyAttribution, EquityChart, Heatmap, TradesTable,
   SubredditPanel, TrendingTickers, Themes, Watchlist, Methodology, FooterCTA,
   TradesPage, RedditPage, WatchlistPage, MethodologyPage, ReportsPage, StrategiesPage,
   TweaksPanel, useTweaks, TweakSection, TweakRadio, TweakToggle, TweakSelect */

var {
  useState
} = React;
var TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "dark",
  "density": "default",
  "accent": "amber",
  "showRedditPanel": true,
  "heroMetric": "dollar",
  "showFloatingBmc": true
} /*EDITMODE-END*/;
var ACCENT_MAP = {
  amber: "oklch(0.82 0.16 75)",
  green: "oklch(0.78 0.16 145)",
  blue: "oklch(0.78 0.14 235)",
  mono: "oklch(0.86 0.008 250)"
};
function getInitialPage() {
  // Options Log is deep-linkable per ticker as #options/AAPL, so match on the
  // segment before the slash — the page itself reads the ticker off the hash.
  var h = (location.hash || "").replace("#", "").split("/")[0];
  if (["dashboard", "trades", "watchlist", "signals", "optimization", "options", "trade"].includes(h)) return h;
  // ?ticker=AAPL with no hash is still an Options Log link — honour it rather
  // than silently dropping the visitor elsewhere.
  if (new URLSearchParams(location.search || "").get("ticker")) return "options";
  // Landing surface: the Options Log. The credit-spread book IS the fund's
  // live activity right now, so a visitor with no hash lands on it; the
  // account-vs-SPY review page stays one click away at #dashboard.
  // Paused tabs (strategies, macro, reddit, reports, methodology) land here too.
  return "options";
}
function App() {
  var [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);
  var [tf, setTf] = useState("90D");
  var [page, setPageRaw] = useState(getInitialPage);
  var setPage = p => {
    setPageRaw(p);
    if (location.hash !== "#" + p) location.hash = p;
    window.scrollTo(0, 0);
  };
  React.useEffect(() => {
    var onHash = () => setPageRaw(getInitialPage());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  React.useEffect(() => {
    document.documentElement.dataset.theme = tweaks.theme;
    document.documentElement.dataset.density = tweaks.density;
    document.documentElement.style.setProperty("--accent", ACCENT_MAP[tweaks.accent] || ACCENT_MAP.amber);
  }, [tweaks.theme, tweaks.density, tweaks.accent]);

  // Single-page consolidation: one review surface — Hero (account vs SPY) +
  // EquityChart, then the four sections the user cares about: Catalysts coming
  // up → Current positions → Trade log → long-horizon Watchlist. All other
  // tabs (Trades/Strategies/Macro/Reddit/Signals/Optimization/Reports) are
  // retired; their component files remain on disk but are no longer mounted.
  // Options Log (#options) is the one surface that is NOT part of the
  // single-page dashboard — it's a full-width options worksheet, so it replaces
  // the dashboard body rather than sitting inside it. It is also the landing
  // page (see getInitialPage).
  if (page === "options" && window.TickerDetailsPage) {
    return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(StatusBar, null), /*#__PURE__*/React.createElement(Header, {
      handle: SITE.handle,
      bmcUrl: SITE.bmcUrl,
      setPage: setPage,
      showBmc: false
    }), /*#__PURE__*/React.createElement(window.TickerDetailsPage, null));
  }
  if (page === "trade" && window.OptionTradeDetailPage) {
    return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(StatusBar, null), /*#__PURE__*/React.createElement(Header, {
      handle: SITE.handle,
      bmcUrl: SITE.bmcUrl,
      setPage: setPage,
      showBmc: false
    }), /*#__PURE__*/React.createElement(window.OptionTradeDetailPage, null));
  }
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(StatusBar, null), /*#__PURE__*/React.createElement(Header, {
    handle: SITE.handle,
    bmcUrl: SITE.bmcUrl,
    setPage: setPage
  }), /*#__PURE__*/React.createElement("main", {
    className: "shell",
    id: "dashboard"
  }, /*#__PURE__*/React.createElement(Hero, {
    perf: PERF,
    equity: EQUITY,
    mode: tweaks.heroMetric
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 12
    }
  }, /*#__PURE__*/React.createElement(EquityChart, {
    equity: EQUITY,
    timeframe: tf,
    setTimeframe: setTf
  })), window.UpcomingCatalystsWidget && /*#__PURE__*/React.createElement("div", {
    id: "catalysts",
    style: {
      marginTop: 12
    }
  }, /*#__PURE__*/React.createElement(window.UpcomingCatalystsWidget, {
    panel: window.UPCOMING_CATALYSTS
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 12
    }
  }, /*#__PURE__*/React.createElement(CurrentPositions, {
    positions: window.POSITIONS
  })), /*#__PURE__*/React.createElement("div", {
    id: "tradelog",
    style: {
      marginTop: 12
    }
  }, /*#__PURE__*/React.createElement(TradesTable, {
    trades: TRADES,
    bmcUrl: SITE.bmcUrl
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 12
    }
  }, /*#__PURE__*/React.createElement(Watchlist, {
    detail: window.WATCHLIST_DETAIL,
    passed: window.PASSED_SIGNALS
  })), /*#__PURE__*/React.createElement(FooterCTA, {
    bmcUrl: SITE.bmcUrl,
    perf: PERF
  })), /*#__PURE__*/React.createElement("div", {
    className: "shell footer-meta",
    style: {
      paddingTop: 0
    }
  }, /*#__PURE__*/React.createElement("span", null, SITE.handle), /*#__PURE__*/React.createElement("span", null, "\xB7"), /*#__PURE__*/React.createElement("span", null, "started ", SITE.startedISO), /*#__PURE__*/React.createElement("span", null, "\xB7"), /*#__PURE__*/React.createElement("span", null, "not financial advice"), /*#__PURE__*/React.createElement("span", null, "\xB7"), /*#__PURE__*/React.createElement("span", null, "data refreshed every 15m"), /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: "auto"
    }
  }, "v0.4.2")), tweaks.showFloatingBmc && /*#__PURE__*/React.createElement("a", {
    className: "bmc-floating",
    href: SITE.bmcUrl,
    target: "_blank",
    rel: "noreferrer"
  }, /*#__PURE__*/React.createElement("span", null, "\u2615"), " Buy me a coffee"), /*#__PURE__*/React.createElement(TweaksPanel, {
    title: "Tweaks"
  }, /*#__PURE__*/React.createElement(TweakSection, {
    title: "Theme"
  }, /*#__PURE__*/React.createElement(TweakRadio, {
    label: "Mode",
    value: tweaks.theme,
    onChange: v => setTweak("theme", v),
    options: [{
      value: "dark",
      label: "Dark"
    }, {
      value: "light",
      label: "Light"
    }]
  }), /*#__PURE__*/React.createElement(TweakRadio, {
    label: "Density",
    value: tweaks.density,
    onChange: v => setTweak("density", v),
    options: [{
      value: "compact",
      label: "Compact"
    }, {
      value: "default",
      label: "Default"
    }, {
      value: "comfortable",
      label: "Cozy"
    }]
  }), /*#__PURE__*/React.createElement(TweakSelect, {
    label: "Accent",
    value: tweaks.accent,
    onChange: v => setTweak("accent", v),
    options: [{
      value: "amber",
      label: "Amber"
    }, {
      value: "green",
      label: "Green"
    }, {
      value: "blue",
      label: "Blue"
    }, {
      value: "mono",
      label: "Mono"
    }]
  })), /*#__PURE__*/React.createElement(TweakSection, {
    title: "Layout"
  }, /*#__PURE__*/React.createElement(TweakRadio, {
    label: "Hero",
    value: tweaks.heroMetric,
    onChange: v => setTweak("heroMetric", v),
    options: [{
      value: "dollar",
      label: "$"
    }, {
      value: "percent",
      label: "%"
    }, {
      value: "legacy",
      label: "5-col"
    }]
  }), /*#__PURE__*/React.createElement(TweakToggle, {
    label: "Reddit intel sidebar",
    value: tweaks.showRedditPanel,
    onChange: v => setTweak("showRedditPanel", v)
  }), /*#__PURE__*/React.createElement(TweakToggle, {
    label: "Floating coffee button",
    value: tweaks.showFloatingBmc,
    onChange: v => setTweak("showFloatingBmc", v)
  }))));
}

// Shown instead of <App/> when the page has no data at all — the live snapshot
// fetch failed AND no usable fallback bundle is published (see
// lib/live-snapshot.js). Every panel reads window.* globals that simply are not
// there, so App() throws on `SITE.handle` and React renders an empty <div>.
//
// A blank page reads as "the fund has nothing" — which is a lie. State the real
// condition instead, and show NO numbers: nothing here is stale or estimated,
// there is genuinely nothing to display until the data service answers.
function DataUnavailable({
  meta
}) {
  return /*#__PURE__*/React.createElement("main", {
    className: "shell",
    style: {
      paddingTop: 64,
      maxWidth: 640
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      fontSize: 22,
      marginBottom: 12
    }
  }, "Live data unavailable"), /*#__PURE__*/React.createElement("p", {
    style: {
      opacity: 0.85,
      lineHeight: 1.6
    }
  }, "The dashboard could not load the fund's data from the server, and no offline copy is published. Nothing is shown rather than something stale \u2014 this page has no numbers to display until the data service responds."), /*#__PURE__*/React.createElement("p", {
    style: {
      opacity: 0.6,
      fontFamily: "ui-monospace, monospace",
      fontSize: 12,
      marginTop: 16
    }
  }, meta && meta.error || "no snapshot"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => location.reload(),
    style: {
      marginTop: 20,
      padding: "8px 16px",
      cursor: "pointer"
    }
  }, "Retry"));
}

// Overlay live server data over the bundled baseline BEFORE the first render, so
// every component reads fresh window.* values. __loadLiveSnapshot never rejects,
// so render always runs — but it CAN come back with nothing (see above).
(async () => {
  var meta = null;
  if (typeof window.__loadLiveSnapshot === "function") {
    meta = await window.__loadLiveSnapshot();
  }
  // Gate on the data actually being present, not on meta alone: serving
  // dashboard/ straight off disk loads the data via index.html's own <script>
  // tags while the snapshot fetch still fails, and that case must render the
  // real dashboard, not this notice.
  var haveData = typeof window.SITE !== "undefined" && window.SITE !== null;
  ReactDOM.createRoot(document.getElementById("root")).render(haveData ? /*#__PURE__*/React.createElement(App, null) : /*#__PURE__*/React.createElement(DataUnavailable, {
    meta: meta
  }));
})();