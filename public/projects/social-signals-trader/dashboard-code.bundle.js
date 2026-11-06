
/* ---- lib/telemetry.js ---- */
/* telemetry.js — bilko.run observability events for the dashboard.
 *
 * The bilko.run host injects its own beacon into every page under
 * /projects/<slug>/: it records page views (load + history navigation) and
 * clicks on a/button/summary/[data-track], so buttons only need a kebab
 * `data-track="<area>-<action>"` attribute. This module covers what that
 * beacon cannot see: screens that change without a new path (every route here
 * is a #hash, and the mobile Options Log tabs change no URL at all) and the
 * named flows (explore / live / tip / feedback).
 *
 * Plain JS, no SDK dependency (the dashboard has no bundler — CLAUDE.md). The
 * wire shape matches host-kit's track()/trackFlow(): POST
 * /api/telemetry/event with { batch: [{ app, name, ts, props }] }; the server
 * stamps the bilko_vid/bilko_sid session ids from the cookie. The body is sent
 * as an application/json Blob — a bare string goes out as text/plain, which
 * the endpoint does not parse (it would answer `ingested: 0`).
 *
 * PII: props carry route/screen names and step metadata only — never account
 * numbers, balances, free text or anything a visitor typed. Keys matching
 * host-kit's stripPII pattern are dropped here too, as a backstop.
 *
 * Fire-and-forget: never throws, never blocks render. When served off disk
 * (file://) or the endpoint is unreachable, the beacon simply goes nowhere. */
(function () {
  var APP = "social-signals-trader";
  var ENDPOINT = "/api/telemetry/event";
  var NAME_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;
  var PII_KEY_RE = /(email|password|token|key|ssn|card|cvv|apikey)/i;
  function clean(props) {
    var out = {};
    if (!props || typeof props !== "object") return out;
    for (var k in props) {
      if (!Object.prototype.hasOwnProperty.call(props, k)) continue;
      if (PII_KEY_RE.test(k)) continue;
      var v = props[k];
      if (v === undefined || typeof v === "function") continue;
      if (typeof v === "string") v = v.slice(0, 200);
      out[k] = v;
    }
    return out;
  }
  function send(name, props) {
    try {
      if (location.protocol === "file:") return;
      var p = clean(props);
      if (p.path === undefined) p.path = location.pathname;
      var body = JSON.stringify({
        batch: [{
          app: APP,
          name: name,
          ts: Date.now(),
          props: p
        }]
      });
      if (navigator.sendBeacon) {
        navigator.sendBeacon(ENDPOINT, new Blob([body], {
          type: "application/json"
        }));
      } else if (window.fetch) {
        fetch(ENDPOINT, {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: body,
          keepalive: true
        }).catch(function () {});
      }
    } catch (e) {/* telemetry never breaks the dashboard */}
  }
  function trackFlow(flow, step, props) {
    if (!NAME_RE.test(flow) || !NAME_RE.test(step)) return;
    var p = clean(props);
    p.flow = flow;
    p.step = step;
    send(flow + "." + step, p);
  }

  // Dedupe consecutive identical screens — a re-render or a hashchange that
  // lands on the screen already showing is not a view change.
  var lastScreen = null;
  function screenView(screen) {
    if (!NAME_RE.test(screen) || screen === lastScreen) return;
    lastScreen = screen;
    send("screen_view", {
      screen: screen
    });
  }
  window.BilkoTelemetry = {
    track: send,
    trackFlow: trackFlow,
    screenView: screenView
  };
})();

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

  // bilko.run 'live' flow (lib/telemetry.js) — no-op if it didn't load.
  function liveStep(step, props) {
    var t = window.BilkoTelemetry;
    if (t) t.trackFlow("live", step, props);
  }
  window.__loadLiveSnapshot = function () {
    liveStep("snapshot-requested");
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
      liveStep("snapshot-loaded", {
        globals: n
      });
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
        liveStep("snapshot-failed", {
          reason: errMsg.slice(0, 120),
          fallbackLoaded: loaded
        });
        if (window.console) {
          console.warn(loaded ? "[live-snapshot] using bundled data (" + errMsg + ")" : "[live-snapshot] NO DATA — live fetch failed (" + errMsg + ") and no usable fallback bundle is published");
        }
        return window.__liveSnapshotMeta;
      });
    });
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
 * as the glossary module, so every `type=text/babel` panel below it in
 * index.html can already see window.FeedbackButton.
 */
(function () {
  var SLUG = "social-signals-trader";
  // Absolute path → resolves against the ORIGIN root (bilko.run), not the
  // /projects/<slug>/ page path. Same reasoning as live-snapshot.js.
  var ENDPOINT = "/api/projects/social-signals-trader/feedback";
  var OUTBOX_KEY = "sst.feedback.outbox";
  var OUTBOX_CAP = 20;

  // Pending echo (PRD feedback-store-pending-echo). A just-submitted comment
  // is rendered from localStorage immediately, before the pull+publish round
  // trip has a chance to put the real row into window.FEEDBACK_THREADS.
  var PENDING_KEY = "sst.feedback.pending";
  var PENDING_CAP = 40;
  // An echo that never reconciles (submission lost, pull pipeline stuck)
  // must not haunt the page forever.
  var PENDING_TTL_MS = 24 * 60 * 60 * 1000;
  // Mirrors USER_AUTHOR / _AUTHOR_LABELS[USER_AUTHOR] in
  // src/social_signals_trader/ui/feedback_threads.py — hardcoded here so the
  // echo slots into messages[] with no renderer-side special case.
  var PENDING_AUTHOR = "visitor";
  var PENDING_AUTHOR_LABEL = "Visitor";

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

  // Returns the parsed server response — {ok, id, receivedAt} — per the POST
  // contract (docs/feedback-api-contract.md: `{"id": "...", "receivedAt":
  // "..."}` on 2xx). `id`/`receivedAt` are null when the body is missing or
  // unparseable; `ok` keeps its prior bare-boolean meaning.
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
      var ok = !!(r && r.ok);
      if (!r) return {
        ok: ok,
        id: null,
        receivedAt: null
      };
      return r.json().catch(function () {
        return null;
      }).then(function (body) {
        return {
          ok: ok,
          id: body && typeof body.id === "string" ? body.id : null,
          receivedAt: body && typeof body.receivedAt === "string" ? body.receivedAt : null
        };
      });
    }).catch(function () {
      return {
        ok: false,
        id: null,
        receivedAt: null
      };
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
        return postPayload(item).then(function (result) {
          if (!result.ok) {
            toKeep.push(item);
          } else {
            recordPendingFromPayload(item, result.id);
          }
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
  // Pending echo — a just-submitted comment, rendered locally until the
  // real row shows up in window.FEEDBACK_THREADS.
  // ---------------------------------------------------------------------

  function readPending() {
    try {
      var raw = window.localStorage.getItem(PENDING_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }
  function writePending(arr) {
    try {
      window.localStorage.setItem(PENDING_KEY, JSON.stringify(arr));
    } catch (e) {
      // Safari private mode / storage disabled / quota — degrade to
      // in-memory for this page load, same as writeOutbox.
    }
  }
  function dispatchPendingChanged() {
    try {
      window.dispatchEvent(new Event("sst:feedback-pending-changed"));
    } catch (e) {}
  }
  function scopeKeyFor(kind, id) {
    return String(kind || "") + "|" + String(id || "");
  }
  function makeFallbackId() {
    return "local-" + Date.now() + "-" + Math.random().toString(36).slice(2, 10);
  }
  function isExpired(entry) {
    var recordedAt = Date.parse(entry && entry.recordedAt);
    if (isNaN(recordedAt)) return true;
    return Date.now() - recordedAt > PENDING_TTL_MS;
  }

  // Drops expired echoes on every read so a permanently-lost submission
  // cannot haunt the page forever, even if reconcilePending() is never
  // called against a matching payload.
  function liveEntries() {
    var all = readPending();
    var live = all.filter(function (e) {
      return !isExpired(e);
    });
    if (live.length !== all.length) writePending(live);
    return live;
  }

  // Called on every successful POST — a fresh submit() or a flushOutbox()
  // replay. `serverId` is the id the server assigned; falls back to a
  // locally-minted id when the response body was missing/unparseable.
  function recordPendingFromPayload(payload, serverId) {
    var target = payload && payload.target || {};
    var fallback = !serverId;
    var entry = {
      id: serverId || makeFallbackId(),
      fallback: fallback,
      scopeKey: scopeKeyFor(target.kind, target.id),
      targetKind: target.kind || null,
      targetId: target.id || null,
      targetLabel: target.label || null,
      parentId: payload && payload.parentId || null,
      type: payload && payload.type || "feedback",
      title: payload && payload.title || "",
      body: payload && payload.description || "",
      // hasImage reflects whether an image was submitted; the data URL
      // itself is never persisted here (localStorage quota).
      hasImage: !!(payload && payload.image),
      createdAt: payload && payload.client && payload.client.submittedAt || null,
      recordedAt: new Date().toISOString()
    };
    var arr = liveEntries();
    arr.push(entry);
    while (arr.length > PENDING_CAP) arr.shift();
    writePending(arr);
    dispatchPendingChanged();
    return entry;
  }
  function toMessage(entry) {
    return {
      id: entry.id,
      role: "user",
      author: PENDING_AUTHOR,
      authorLabel: PENDING_AUTHOR_LABEL,
      title: entry.title,
      body: entry.body,
      createdAt: entry.createdAt,
      hasImage: entry.hasImage,
      parentId: entry.parentId,
      pending: true
    };
  }

  // One target's echoes, thread-message-shaped so the renderer can splice
  // them into messages[] with no special case.
  function pendingFor(target) {
    var key = scopeKeyFor(target && target.kind, target && target.id);
    return liveEntries().filter(function (e) {
      return e.scopeKey === key;
    }).map(toMessage);
  }
  function allPending() {
    return liveEntries();
  }

  // Collects every id (thread id + every messages[].id) and, per target
  // scope, every trimmed message body already present in the real payload.
  function knownFromThreads(payload) {
    var ids = {};
    var bodiesByScope = {};
    var threads = payload && payload.threads || [];
    threads.forEach(function (thread) {
      if (thread && thread.id) ids[thread.id] = true;
      var key = scopeKeyFor(thread && thread.targetKind, thread && thread.targetId);
      var messages = thread && thread.messages || [];
      messages.forEach(function (msg) {
        if (msg && msg.id) ids[msg.id] = true;
        if (!bodiesByScope[key]) bodiesByScope[key] = [];
        bodiesByScope[key].push(String(msg && msg.body || "").trim());
      });
    });
    return {
      ids: ids,
      bodiesByScope: bodiesByScope
    };
  }

  // Drops every pending echo now represented in `threadsPayload` (defaults
  // to window.FEEDBACK_THREADS): by server id for a normal echo, or by an
  // identical trimmed body on the same target for a fallback-id echo that
  // never got a server id back.
  function reconcilePending(threadsPayload) {
    var payload = threadsPayload || window.FEEDBACK_THREADS;
    var known = knownFromThreads(payload);
    var before = readPending();
    var after = before.filter(function (e) {
      if (isExpired(e)) return false;
      if (!e.fallback && known.ids[e.id]) return false;
      if (e.fallback) {
        var bodies = known.bodiesByScope[e.scopeKey] || [];
        var body = String(e.body || "").trim();
        if (bodies.indexOf(body) !== -1) return false;
      }
      return true;
    });
    if (after.length !== before.length) {
      writePending(after);
      dispatchPendingChanged();
    }
    return after;
  }

  // React hook (consumed by panels/feedback-threads.jsx and
  // the proposals panel — the ONE place both subscribe to
  // sst:feedback-pending-changed, so neither reimplements the subscription).
  // With a target it returns message-shaped echoes scoped to that target
  // (pendingFor); without one it returns every live echo (allPending) so a
  // caller can bucket them itself.
  function usePendingFeedback(target) {
    var kind = target && target.kind;
    var id = target && target.id;
    function snapshot() {
      return kind && id ? pendingFor({
        kind: kind,
        id: id
      }) : allPending();
    }
    var pair = React.useState(snapshot);
    var pending = pair[0];
    var setPending = pair[1];
    React.useEffect(function () {
      function onChange() {
        setPending(snapshot());
      }
      onChange();
      window.addEventListener("sst:feedback-pending-changed", onChange);
      return function () {
        window.removeEventListener("sst:feedback-pending-changed", onChange);
      };
    }, [kind, id]);
    return pending;
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
    return postPayload(payload).then(function (result) {
      if (result.ok) {
        flushOutbox();
        recordPendingFromPayload(payload, result.id);
        return {
          ok: true,
          queued: false
        };
      }
      // Not on the server yet — no echo. The echo is recorded when
      // flushOutbox() later replays this same payload successfully.
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
    PENDING_KEY: PENDING_KEY,
    PENDING_TTL_MS: PENDING_TTL_MS,
    MODERATE_ACTIONS: MODERATE_ACTIONS,
    buildPayload: buildPayload,
    submit: submit,
    flushOutbox: flushOutbox,
    moderate: moderate,
    getOwnerToken: readOwnerToken,
    clearOwnerToken: clearOwnerToken,
    pendingFor: pendingFor,
    allPending: allPending,
    reconcilePending: reconcilePending,
    messageFor: toMessage,
    usePendingFeedback: usePendingFeedback
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
      feedbackStep("submit", target, isReply);
      submit(payload).then(function (result) {
        feedbackStep(result && result.ok ? "submit-success" : "submit-queued", target, isReply);
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
      "data-track-redact": "",
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
        "data-track": "feedback-type-" + t,
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
      "data-track": "feedback-remove-image",
      onClick: removeImage
    }, "Remove")) : null, React.createElement("div", {
      className: "fb-actions"
    }, React.createElement("button", {
      type: "button",
      "data-track": "feedback-cancel",
      onClick: function () {
        feedbackStep("cancel", target, isReply);
        onBackdropClick();
      }
    }, "Cancel"), React.createElement("button", {
      type: "submit",
      "data-track": "feedback-submit",
      disabled: !canSubmit
    }, status === "pending" ? "Sending…" : isReply ? "Send reply" : "Send feedback")))));
  }

  // bilko.run 'feedback' flow (lib/telemetry.js). Props carry the target KIND
  // and reply/topic mode only — never the label, title or anything typed.
  function feedbackStep(step, target, isReply) {
    var t = window.BilkoTelemetry;
    if (t) t.trackFlow("feedback", step, {
      kind: target && target.kind,
      reply: !!isReply
    });
  }
  function FeedbackButton(props) {
    var target = props && props.target;
    var malformed = !target || typeof target !== "object" || !target.kind || !target.id || !target.label || VALID_KINDS.indexOf(target.kind) === -1;
    var isReply = !!(props && props.parentId);
    // `variant="secondary"` gets the same quiet visual treatment as a reply
    // button without actually being one (still starts a NEW topic) — used to
    // demote the proposal deck's comment affordance now that the open
    // position, not the proposal, is the primary comment target (see
    // CLAUDE.md's "propose -> act -> review loop").
    var secondary = !isReply && props && props.variant === "secondary";
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
      className: "feedback-btn" + (isReply || secondary ? " feedback-btn--reply" : ""),
      "aria-label": isReply ? "Reply in the thread " + target.label : "Leave feedback on " + target.label,
      "aria-expanded": open,
      "data-track": isReply ? "feedback-reply-open" : "feedback-open",
      onClick: function (e) {
        e.stopPropagation();
        feedbackStep("open-form", target, isReply);
        setOpen(true);
      }
    }, FeedbackIcon(),
    // `label` lets a surface name the action in its own words — the
    // mobile position card says "Comment on this position", because on a
    // phone this button IS the job the reader came to do and a bare
    // "Feedback" next to "Full detail →" reads as the lesser of the two.
    // Defaults to the generic wording everywhere else.
    React.createElement("span", {
      className: "feedback-btn-label"
    }, props && props.label || (isReply ? "Reply" : "Feedback"))), open ? ReactDOM.createPortal(React.createElement(FeedbackModal, {
      target: target,
      parentId: props.parentId,
      parentType: props.parentType,
      onClose: close
    }), document.body) : null);
  }
  window.FeedbackButton = FeedbackButton;
  window.FeedbackClient = FeedbackClient;
})();

/* ---- one-pager.jsx ---- */
/* global React */
// The whole site: one page rendered only from the `data` prop (the ONE_PAGER payload).
// prop). Self-contained on purpose — React, window.FeedbackButton and
// window.BilkoTelemetry are the only globals it touches.

var MINUS = "−";
var ET = "America/New_York";
var MOBILE_QUERY = "(max-width: 820px)";
var isNum = v => typeof v === "number" && isFinite(v);
function money(v, signed) {
  if (!isNum(v)) return "—";
  var body = "$" + Math.abs(Math.round(v)).toLocaleString("en-US");
  if (v < 0) return MINUS + body;
  return (signed ? "+" : "") + body;
}
function pct(v) {
  if (!isNum(v)) return "—";
  return (v > 0 ? "+" : "") + v.toFixed(1) + "%";
}
function tone(v) {
  return isNum(v) && v < 0 ? "op-down" : "op-up";
}

// Date-only strings ("2026-03-10") are calendar dates: read them in UTC so the
// day never shifts. Full timestamps read in market time (ET).
function fmtDate(s, opts) {
  if (!s) return "—";
  var dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(s);
  var d = new Date(dateOnly ? s + "T00:00:00Z" : s);
  if (isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    ...opts,
    timeZone: dateOnly ? "UTC" : ET
  }).format(d);
}
var shortDate = s => fmtDate(s, {
  month: "short",
  day: "numeric"
});
function updatedLabel(asOf) {
  if (!asOf) return "";
  var d = new Date(asOf);
  if (isNaN(d.getTime())) return "";
  var day = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: ET
  }).format(d);
  var time = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: ET
  }).format(d);
  return "Updated " + day + ", " + time + " ET";
}
function vsSpy(row) {
  var r = row || {};
  var fund = isNum(r.accountPct) ? "Fund " + pct(r.accountPct) : "Fund —";
  var spy = isNum(r.spyPct) ? "SPY " + pct(r.spyPct) : "SPY —";
  var gap = "—";
  if (isNum(r.vsSpyPts)) {
    var n = Math.abs(r.vsSpyPts).toFixed(1);
    gap = r.vsSpyPts < 0 ? n + " pts behind SPY" : n + " pts ahead of SPY";
  }
  return fund + " · " + spy + " · " + gap;
}
function useIsMobile() {
  var get = () => typeof window.matchMedia === "function" && window.matchMedia(MOBILE_QUERY).matches;
  var [m, setM] = React.useState(get);
  React.useEffect(() => {
    if (typeof window.matchMedia !== "function") return undefined;
    var mq = window.matchMedia(MOBILE_QUERY);
    var on = () => setM(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return m;
}
function useWidth(ref) {
  var [w, setW] = React.useState(720);
  React.useEffect(() => {
    var el = ref.current;
    if (!el) return undefined;
    var measure = () => {
      if (el.clientWidth) setW(el.clientWidth);
    };
    measure();
    if (typeof ResizeObserver !== "function") return undefined;
    var ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return w;
}
function Chart({
  points
}) {
  var wrap = React.useRef(null);
  var width = useWidth(wrap);
  var mobile = useIsMobile();
  var height = mobile ? 180 : 220;
  var pts = (points || []).filter(p => p && isNum(p.account) && isNum(p.spy));
  if (pts.length < 2) return /*#__PURE__*/React.createElement("div", {
    className: "op-chart op-empty",
    ref: wrap
  }, "Not enough history to chart yet.");
  var padL = 52,
    padR = mobile ? 84 : 104,
    padT = 12,
    padB = 24;
  var vals = pts.flatMap(p => [p.account, p.spy]);
  var lo = Math.min(...vals),
    hi = Math.max(...vals);
  var span = hi - lo || 1;
  var yMin = lo - span * 0.05,
    yMax = hi + span * 0.05;
  var x = i => padL + i / (pts.length - 1) * (width - padL - padR);
  var y = v => padT + (1 - (v - yMin) / (yMax - yMin)) * (height - padT - padB);
  var path = key => pts.map((p, i) => (i ? "L" : "M") + x(i).toFixed(1) + " " + y(p[key]).toFixed(1)).join(" ");
  var ticks = [0, 1, 2, 3].map(i => yMin + (yMax - yMin) * i / 3);
  var last = pts[pts.length - 1];
  var fundLabel = "Fund " + money(last.account);
  var spyLabel = "SPY " + money(last.spy);
  var yf = y(last.account),
    ys = y(last.spy);
  if (Math.abs(yf - ys) < 14) {
    if (yf <= ys) {
      yf -= 7;
      ys += 7;
    } else {
      yf += 7;
      ys -= 7;
    }
  }
  var aria = "Account value versus SPY since " + shortDate(pts[0].d) + ": " + fundLabel + ", " + spyLabel + ".";
  return /*#__PURE__*/React.createElement("div", {
    className: "op-chart",
    ref: wrap
  }, /*#__PURE__*/React.createElement("svg", {
    width: width,
    height: height,
    viewBox: "0 0 " + width + " " + height,
    role: "img",
    "aria-label": aria
  }, ticks.map((t, i) => /*#__PURE__*/React.createElement("g", {
    key: i
  }, /*#__PURE__*/React.createElement("line", {
    className: "op-grid",
    x1: padL,
    x2: width - padR,
    y1: y(t),
    y2: y(t)
  }), /*#__PURE__*/React.createElement("text", {
    className: "op-axis",
    x: padL - 6,
    y: y(t) + 4,
    textAnchor: "end"
  }, money(t)))), /*#__PURE__*/React.createElement("path", {
    className: "op-line-spy",
    d: path("spy"),
    fill: "none"
  }), /*#__PURE__*/React.createElement("path", {
    className: "op-line-fund",
    d: path("account"),
    fill: "none"
  }), /*#__PURE__*/React.createElement("text", {
    className: "op-label-fund",
    x: width - padR + 6,
    y: yf + 4
  }, fundLabel), /*#__PURE__*/React.createElement("text", {
    className: "op-label-spy",
    x: width - padR + 6,
    y: ys + 4
  }, spyLabel), /*#__PURE__*/React.createElement("text", {
    className: "op-axis",
    x: padL,
    y: height - 6,
    textAnchor: "start"
  }, shortDate(pts[0].d)), /*#__PURE__*/React.createElement("text", {
    className: "op-axis",
    x: width - padR,
    y: height - 6,
    textAnchor: "end"
  }, shortDate(last.d))));
}
function OpenRow({
  p
}) {
  var ret = isNum(p.returnPct) ? " (" + pct(p.returnPct) + ")" : "";
  var sub = [p.detail, "opened " + shortDate(p.openedAt)].filter(Boolean).join(" · ") + (p.cost ? " · cost " + money(p.cost) : "");
  return /*#__PURE__*/React.createElement("li", {
    className: "op-row"
  }, /*#__PURE__*/React.createElement("div", {
    className: "op-row-main"
  }, /*#__PURE__*/React.createElement("span", {
    className: "op-what"
  }, p.what), /*#__PURE__*/React.createElement("span", {
    className: tone(p.pnl)
  }, money(p.pnl, true) + ret)), /*#__PURE__*/React.createElement("div", {
    className: "op-sub"
  }, sub), p.exitPlan ? /*#__PURE__*/React.createElement("div", {
    className: "op-plan"
  }, p.exitPlan) : null);
}
function TradeRow({
  t
}) {
  var ret = isNum(t.returnPct) ? " (" + pct(t.returnPct) + ")" : "";
  var held = isNum(t.heldDays) ? " · held " + t.heldDays + "d" : "";
  return /*#__PURE__*/React.createElement("li", {
    className: "op-row"
  }, /*#__PURE__*/React.createElement("div", {
    className: "op-row-main"
  }, /*#__PURE__*/React.createElement("span", {
    className: "op-what"
  }, shortDate(t.closedAt) + " · " + t.what + held), /*#__PURE__*/React.createElement("span", {
    className: tone(t.pnl)
  }, money(t.pnl, true) + ret)));
}
function OnePager({
  data
}) {
  var d = data || {};
  var site = d.site || {};
  var sb = d.scoreboard || {};
  var open = d.open || [];
  var closed = d.closed || [];
  var [all, setAll] = React.useState(false);
  var shown = all ? closed : closed.slice(0, 10);
  var tip = placement => () => window.BilkoTelemetry?.trackFlow("tip", "click-tip", {
    placement
  });
  return /*#__PURE__*/React.createElement("main", {
    className: "op-page"
  }, /*#__PURE__*/React.createElement("header", {
    className: "op-header"
  }, /*#__PURE__*/React.createElement("div", {
    className: "op-brand"
  }, /*#__PURE__*/React.createElement("span", {
    className: "op-brand-name"
  }, "Bilko Bibitkov"), /*#__PURE__*/React.createElement("span", {
    className: "op-handle"
  }, site.handle), site.paper ? /*#__PURE__*/React.createElement("span", {
    className: "op-pill"
  }, "Paper account") : null), /*#__PURE__*/React.createElement("div", {
    className: "op-header-right"
  }, /*#__PURE__*/React.createElement("span", {
    className: "op-updated"
  }, updatedLabel(d.asOf)), /*#__PURE__*/React.createElement("a", {
    className: "op-coffee",
    href: site.bmcUrl,
    target: "_blank",
    rel: "noreferrer",
    "data-track": "tip-header-coffee",
    onClick: tip("header")
  }, "Buy me a coffee"))), /*#__PURE__*/React.createElement("section", {
    className: "op-score"
  }, /*#__PURE__*/React.createElement("div", {
    className: "op-label"
  }, "Account value"), /*#__PURE__*/React.createElement("div", {
    className: "op-equity"
  }, money(sb.equity)), /*#__PURE__*/React.createElement("div", {
    className: "op-sub"
  }, `Started with ${money(sb.startEquity)} on ${fmtDate(sb.startDate, {
    month: "short",
    day: "numeric",
    year: "numeric"
  })}`), /*#__PURE__*/React.createElement("dl", {
    className: "op-compare"
  }, /*#__PURE__*/React.createElement("dt", null, "Since start"), /*#__PURE__*/React.createElement("dd", null, vsSpy(sb.sinceStart)), /*#__PURE__*/React.createElement("dt", null, "Today"), /*#__PURE__*/React.createElement("dd", null, vsSpy(sb.today)))), /*#__PURE__*/React.createElement(Chart, {
    points: d.chart
  }), /*#__PURE__*/React.createElement("section", {
    className: "op-section"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "op-h"
  }, `Open positions (${open.length})`), open.length ? /*#__PURE__*/React.createElement("ul", {
    className: "op-list"
  }, open.map((p, i) => /*#__PURE__*/React.createElement(OpenRow, {
    key: i,
    p: p
  }))) : /*#__PURE__*/React.createElement("p", {
    className: "op-empty"
  }, "No open positions right now.")), /*#__PURE__*/React.createElement("section", {
    className: "op-section"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "op-h"
  }, "Recent trades"), closed.length ? /*#__PURE__*/React.createElement("ul", {
    className: "op-list"
  }, shown.map((t, i) => /*#__PURE__*/React.createElement(TradeRow, {
    key: i,
    t: t
  }))) : /*#__PURE__*/React.createElement("p", {
    className: "op-empty"
  }, "No closed trades yet."), !all && closed.length > 10 ? /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "op-more",
    "data-track": "trades-show-all",
    onClick: () => setAll(true)
  }, `Show all ${closed.length}`) : null, /*#__PURE__*/React.createElement("p", {
    className: "op-note"
  }, "% = profit \xF7 money put at risk on that trade. Account and SPY figures come from Alpaca.")), /*#__PURE__*/React.createElement("footer", {
    className: "op-footer"
  }, /*#__PURE__*/React.createElement("p", null, "What is this? An automated trader that reads Reddit's r/wallstreetbets and trades US stock options on a paper (simulated) Alpaca account. The numbers are real broker figures; the money is not. Not financial advice."), /*#__PURE__*/React.createElement("div", {
    className: "op-footer-actions"
  }, window.FeedbackButton && /*#__PURE__*/React.createElement(window.FeedbackButton, {
    target: {
      kind: "page",
      id: "one-pager",
      label: "This page"
    }
  }), /*#__PURE__*/React.createElement("a", {
    className: "op-coffee",
    href: site.bmcUrl,
    target: "_blank",
    rel: "noreferrer",
    "data-track": "tip-footer-coffee",
    onClick: tip("footer")
  }, "Buy me a coffee"))));
}
window.OnePager = OnePager;

/* ---- app.jsx ---- */
/* global React, ReactDOM */

// One page for every URL: no routes, no tabs. Any location.hash is dropped so a
// stale #options / #trade/<key> link lands on the same page.

// Shown instead of <OnePager/> when window.ONE_PAGER is missing — the live
// snapshot fetch failed AND no usable fallback is published (see
// lib/live-snapshot.js). A blank page would read as "the fund has nothing".
//
// A blank page reads as "the fund has nothing" — which is a lie. State the real
// condition instead, and show NO numbers: nothing here is stale or estimated,
// there is genuinely nothing to display until the data service answers.
function DataUnavailable({
  meta
}) {
  React.useEffect(() => {
    window.BilkoTelemetry?.screenView("data-unavailable");
  }, []);
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
    "data-track": "live-retry",
    onClick: () => location.reload(),
    style: {
      marginTop: 20,
      padding: "8px 16px",
      cursor: "pointer"
    }
  }, "Retry"));
}

// Overlay live server data BEFORE the first render. __loadLiveSnapshot never
// rejects, so render always runs — but it CAN come back with nothing.
(async () => {
  var meta = null;
  if (typeof window.__loadLiveSnapshot === "function") {
    meta = await window.__loadLiveSnapshot();
  }
  if (location.hash) {
    history.replaceState(null, "", location.pathname + location.search);
  }
  var haveData = typeof window.ONE_PAGER !== "undefined" && window.ONE_PAGER !== null;
  if (haveData) window.BilkoTelemetry?.screenView("one-pager");
  ReactDOM.createRoot(document.getElementById("root")).render(haveData && window.OnePager ? /*#__PURE__*/React.createElement(window.OnePager, {
    data: window.ONE_PAGER
  }) : /*#__PURE__*/React.createElement(DataUnavailable, {
    meta: meta
  }));
})();