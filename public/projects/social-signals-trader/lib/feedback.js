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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(function (r) {
        return !!(r && r.ok);
      })
      .catch(function () {
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
        return postPayload(item)
          .then(function (ok) {
            if (!ok) toKeep.push(item);
          })
          .catch(function () {
            toKeep.push(item);
          });
      });
    });
    return chain
      .then(function () {
        writeOutbox(toKeep);
      })
      .catch(function () {})
      .then(function () {
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
      return Promise.resolve({ ok: false, status: 0 });
    }
    if (MODERATE_ACTIONS.indexOf(action) === -1) {
      return Promise.resolve({ ok: false, status: 0 });
    }
    var token = readOwnerToken();
    if (!token) {
      return Promise.resolve({ ok: false, status: 401 });
    }
    var body = { action: action };
    if (typeof opts.reason === "string" && opts.reason) body.reason = opts.reason;
    return fetch(ENDPOINT + "/" + encodeURIComponent(id) + "/moderate", {
      method: "POST",
      cache: "no-store",
      credentials: "omit",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify(body),
    })
      .then(function (r) {
        var status = r ? r.status : 0;
        if (status === 401 || status === 403) clearOwnerToken();
        return { ok: !!(r && r.ok), status: status };
      })
      .catch(function () {
        return { ok: false, status: 0 };
      });
  }

  function buildPayload(opts) {
    opts = opts || {};
    var target = opts.target || {};
    var viewport = {
      w: (window.innerWidth || 0),
      h: (window.innerHeight || 0),
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
      target: { kind: target.kind, id: target.id, label: target.label },
      route: stripOwnerParam((window.location && window.location.hash) || "#options"),
      type: type,
      title: opts.title || "",
      description: opts.description || "",
      image: opts.image || null,
      parentId: parentId,
      client: {
        ua: (window.navigator && window.navigator.userAgent) || "",
        viewport: viewport,
        tz: tz,
        submittedAt: new Date().toISOString(),
      },
      snapshotGeneratedAt:
        (window.__liveSnapshotMeta && window.__liveSnapshotMeta.generatedAt) || null,
    };
  }

  function submit(payload) {
    return postPayload(payload).then(function (ok) {
      if (ok) {
        flushOutbox();
        return { ok: true, queued: false };
      }
      enqueue(payload);
      return { ok: false, queued: true };
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
    clearOwnerToken: clearOwnerToken,
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
    return React.createElement(
      "svg",
      {
        viewBox: "0 0 12 12",
        width: 14,
        height: 14,
        "aria-hidden": "true",
        stroke: "currentColor",
        fill: "none",
        strokeWidth: 1.5,
      },
      React.createElement("path", {
        d: "M1.5 2.5h9v5.5h-4l-2 2v-2h-3z",
        strokeLinejoin: "round",
      }),
      React.createElement("path", { d: "M4 5.1l3-1.4", strokeLinecap: "round" }),
      React.createElement("path", { d: "M4.3 6.3l3-1.4", strokeLinecap: "round" })
    );
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
          var bytes = Math.round((b64.length * 3) / 4);
          resolve({ dataUrl: dataUrl, bytes: bytes, mime: "image/jpeg" });
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
    var [type, setType] = React.useState(
      isReply && VALID_TYPES.indexOf(props.parentType) !== -1 ? props.parentType : "feedback"
    );
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
      downscaleImage(file, MAX_EDGE, JPEG_QUALITY)
        .then(function (result) {
          if (result.bytes > MAX_DATAURL_BYTES) {
            setImageError("Image is still too large after compression — pick a smaller file.");
            return;
          }
          setImage(result);
        })
        .catch(function () {
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

    var canSubmit =
      (isReply || title.trim().length > 0) &&
      description.trim().length > 0 &&
      status !== "pending";

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
        parentId: props.parentId,
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

    return React.createElement(
      "div",
      { className: "fb-backdrop", onClick: onBackdropClick },
      React.createElement(
        "div",
        {
          className: "fb-modal",
          role: "dialog",
          "aria-modal": "true",
          "aria-label": isReply ? "Reply in the thread " + label : "Leave feedback on " + label,
          onClick: function (e) {
            e.stopPropagation();
          },
          onPaste: onPaste,
        },
        React.createElement(
          "div",
          { className: "fb-modal-head" },
          isReply ? "Reply in " : "Leave feedback on ",
          React.createElement("b", null, label)
        ),
        doneMsg
          ? React.createElement("div", { className: "fb-msg" }, message)
          : React.createElement(
              "form",
              { onSubmit: onSubmit },
              // Type + Title name a NEW topic. A reply is another message in a
              // topic that already has both, so it asks for the body alone.
              isReply
                ? null
                : React.createElement(
                    "div",
                    { className: "fb-chips", role: "radiogroup", "aria-label": "Feedback type" },
                    VALID_TYPES.map(function (t) {
                      var chipLabel = t === "bug" ? "Bug" : t === "feature" ? "Feature" : "Feedback";
                      return React.createElement(
                        "button",
                        {
                          type: "button",
                          key: t,
                          className: "fb-chip" + (type === t ? " fb-chip--on" : ""),
                          "aria-pressed": type === t,
                          onClick: function () {
                            setType(t);
                          },
                        },
                        chipLabel
                      );
                    })
                  ),
              isReply
                ? null
                : React.createElement(
                    "label",
                    { className: "fb-field" },
                    "Title",
                    React.createElement("input", {
                      type: "text",
                      ref: titleRef,
                      value: title,
                      maxLength: 120,
                      required: true,
                      onChange: function (e) {
                        setTitle(e.target.value);
                      },
                    })
                  ),
              React.createElement(
                "label",
                { className: "fb-field" },
                isReply ? "Your reply" : "Description",
                React.createElement("textarea", {
                  ref: bodyRef,
                  value: description,
                  maxLength: 4000,
                  required: true,
                  rows: 4,
                  onChange: function (e) {
                    setDescription(e.target.value);
                  },
                })
              ),
              React.createElement(
                "label",
                { className: "fb-field" },
                "Screenshot (optional — you can also paste an image)",
                React.createElement("input", {
                  type: "file",
                  accept: "image/*",
                  onChange: onFileInputChange,
                })
              ),
              imageError ? React.createElement("div", { className: "fb-msg" }, imageError) : null,
              image
                ? React.createElement(
                    "div",
                    { className: "fb-thumb" },
                    React.createElement("img", { src: image.dataUrl, alt: "Attached screenshot" }),
                    React.createElement(
                      "button",
                      { type: "button", onClick: removeImage },
                      "Remove"
                    )
                  )
                : null,
              React.createElement(
                "div",
                { className: "fb-actions" },
                React.createElement(
                  "button",
                  { type: "button", onClick: onBackdropClick },
                  "Cancel"
                ),
                React.createElement(
                  "button",
                  { type: "submit", disabled: !canSubmit },
                  status === "pending" ? "Sending…" : isReply ? "Send reply" : "Send feedback"
                )
              )
            )
      )
    );
  }

  function FeedbackButton(props) {
    var target = props && props.target;
    var malformed =
      !target ||
      typeof target !== "object" ||
      !target.kind ||
      !target.id ||
      !target.label ||
      VALID_KINDS.indexOf(target.kind) === -1;
    var isReply = !!(props && props.parentId);
    var [open, setOpen] = React.useState(false);
    var btnRef = React.useRef(null);

    if (malformed) return null;

    function close() {
      setOpen(false);
      if (btnRef.current) btnRef.current.focus();
    }

    return React.createElement(
      "span",
      {
        className: "feedback",
        onClick: function (e) {
          e.stopPropagation();
        },
      },
      React.createElement(
        "button",
        {
          type: "button",
          ref: btnRef,
          className: "feedback-btn" + (isReply ? " feedback-btn--reply" : ""),
          "aria-label": isReply
            ? "Reply in the thread " + target.label
            : "Leave feedback on " + target.label,
          "aria-expanded": open,
          onClick: function (e) {
            e.stopPropagation();
            setOpen(true);
          },
        },
        FeedbackIcon(),
        React.createElement("span", { className: "feedback-btn-label" }, isReply ? "Reply" : "Feedback")
      ),
      open
        ? ReactDOM.createPortal(
            React.createElement(FeedbackModal, {
              target: target,
              parentId: props.parentId,
              parentType: props.parentType,
              onClose: close,
            }),
            document.body
          )
        : null
    );
  }

  window.FeedbackButton = FeedbackButton;
  window.FeedbackClient = FeedbackClient;
})();
