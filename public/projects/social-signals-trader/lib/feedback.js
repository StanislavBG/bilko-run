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
    return {
      schema: 1,
      slug: SLUG,
      target: { kind: target.kind, id: target.id, label: target.label },
      route: (window.location && window.location.hash) || "#options",
      type: type,
      title: opts.title || "",
      description: opts.description || "",
      image: opts.image || null,
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
    buildPayload: buildPayload,
    submit: submit,
    flushOutbox: flushOutbox,
  };

  // Drain anything left over from a prior offline session as soon as the
  // page has this module loaded.
  flushOutbox();

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

  function FeedbackModal(props) {
    var target = props.target;
    var label = target.label;
    var closeRef = React.useRef(props.onClose);
    closeRef.current = props.onClose;

    var titleRef = React.useRef(null);
    var [type, setType] = React.useState("feedback");
    var [title, setTitle] = React.useState("");
    var [description, setDescription] = React.useState("");
    var [image, setImage] = React.useState(null);
    var [imageError, setImageError] = React.useState("");
    var [status, setStatus] = React.useState("idle"); // idle | pending | success | queued
    var [message, setMessage] = React.useState("");

    React.useEffect(function () {
      if (titleRef.current) titleRef.current.focus();
    }, []);

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

    var canSubmit = title.trim().length > 0 && description.trim().length > 0 && status !== "pending";

    function onSubmit(e) {
      e.preventDefault();
      if (!canSubmit) return;
      setStatus("pending");
      var payload = buildPayload({
        target: target,
        type: type,
        title: title.trim(),
        description: description.trim(),
        image: image,
      });
      submit(payload).then(function (result) {
        if (result && result.ok) {
          setStatus("success");
          setMessage("Thanks — feedback sent.");
        } else {
          setStatus("queued");
          setMessage("Saved — we'll send it next time you're online");
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
          "aria-label": "Leave feedback on " + label,
          onClick: function (e) {
            e.stopPropagation();
          },
          onPaste: onPaste,
        },
        React.createElement(
          "div",
          { className: "fb-modal-head" },
          "Leave feedback on ",
          React.createElement("b", null, label)
        ),
        doneMsg
          ? React.createElement("div", { className: "fb-msg" }, message)
          : React.createElement(
              "form",
              { onSubmit: onSubmit },
              React.createElement(
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
              React.createElement(
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
                "Description",
                React.createElement("textarea", {
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
                  status === "pending" ? "Sending…" : "Send feedback"
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
          className: "feedback-btn",
          "aria-label": "Leave feedback on " + target.label,
          "aria-expanded": open,
          onClick: function (e) {
            e.stopPropagation();
            setOpen(true);
          },
        },
        FeedbackIcon(),
        React.createElement("span", { className: "feedback-btn-label" }, "Feedback")
      ),
      open
        ? ReactDOM.createPortal(
            React.createElement(FeedbackModal, { target: target, onClose: close }),
            document.body
          )
        : null
    );
  }

  window.FeedbackButton = FeedbackButton;
  window.FeedbackClient = FeedbackClient;
})();
