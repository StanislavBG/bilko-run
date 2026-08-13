/* global React */
const { useMemo } = React;
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
const FALLBACK_CADENCE_LABEL = "every 2h";
const FALLBACK_REFRESH_INTERVAL_MINUTES = 120;
const FALLBACK_STALE_AFTER_MS = FALLBACK_REFRESH_INTERVAL_MINUTES * 2 * 60 * 1000;

const BAND_LABEL_CLASS = {
  SAFE: "opts-band opts-band--safe",
  WATCH: "opts-band opts-band--watch",
  DANGER: "opts-band opts-band--danger",
  BREACHED: "opts-band opts-band--breached",
};

// PRD: the Options Log is written by three voices — the Analyst (the 5x/day
// options-summary cron forming an opinion), the Trader (trader-tick /
// spread_trader + the frozen rules deciding), and the User (public feedback
// threads). Every card head carries a byline naming which one wrote it, so a
// reader can tell an opinion refreshed hours ago from a broker fact refreshed
// minutes ago. Kept as a plain label map (not derived) so ROLE.ANALYST etc.
// are the single spelling used at every call site.
const ROLE = { ANALYST: "Analyst", TRADER: "Trader", USER: "User" };

// Presentation only — never touches a feedback target id. Re-exported via
// window.OptionsSummaryInternals.RoleByline so options-trade-log.jsx,
// proposed-trades.jsx and feedback-threads.jsx render the identical chip
// instead of three near-copies. The glossary term matches the role label
// lowercased ("Analyst" -> "analyst"), so every byline resolves to its own
// definition of what that voice does and on what cadence.
function RoleByline({ role }) {
  if (!role) return null;
  return (
    <span className={`opts-role-byline opts-role-byline--${role.toLowerCase()}`}>
      {role}
      <window.Help term={role.toLowerCase()} />
    </span>
  );
}

function ageLabel(iso) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  const ms = Date.now() - t;
  const m = ms / 60000;
  if (m < 1) return "just now";
  if (m < 60) return `${Math.round(m)}m ago`;
  const h = m / 60;
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
    const next = new Date(schedule.nextRunAt).getTime();
    if (!Number.isNaN(next)) {
      return Date.now() > next + schedule.staleAfterMs;
    }
  }
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t > FALLBACK_STALE_AFTER_MS;
}

// --- markdown-lite parsing -------------------------------------------------
// The render's shape is fixed (owned by PRDs 1007/1008 — out of scope here),
// so a small dedicated parser beats pulling in a full markdown lib for one
// producer.
function parseSections(md) {
  const lines = (md || "").split("\n");
  const sections = [];
  let current = { title: null, lines: [] };
  for (const line of lines) {
    const m = /^##\s+(.*)$/.exec(line);
    if (m) {
      sections.push(current);
      current = { title: m[1].trim(), lines: [] };
    } else {
      current.lines.push(line);
    }
  }
  sections.push(current);
  return sections;
}

function findSection(sections, title) {
  return sections.find((s) => s.title === title) || { title, lines: [] };
}

function bulletsOf(lines) {
  return lines.filter((l) => l.startsWith("- ")).map((l) => l.slice(2));
}

function plainLinesOf(lines) {
  return lines.map((l) => l.trim()).filter((l) => l && !l.startsWith("- ") && !l.startsWith("|"));
}

function isTableLine(l) {
  return l.trim().startsWith("|");
}

function tableOf(lines) {
  const rows = lines
    .filter(isTableLine)
    .map((l) => l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim()));
  if (rows.length < 2) return null;
  return { header: rows[0], body: rows.slice(2) };
}

// --- inline styling ---------------------------------------------------------
// Only tokens with an explicit +/- sign get colour — a bare "$104,191.02"
// (equity, not a change) stays neutral.
const SIGNED_TOKEN_RE = /([+-]\$[\d,]+(?:\.\d+)?|[+-]\d+(?:\.\d+)?%)/g;

function colorizeSigned(text) {
  if (!text) return text;
  const out = [];
  SIGNED_TOKEN_RE.lastIndex = 0;
  let last = 0;
  let m;
  let key = 0;
  while ((m = SIGNED_TOKEN_RE.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    out.push(
      <span key={key++} className={tok.startsWith("-") ? "down" : "up"}>
        {tok}
      </span>
    );
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
const PROSE_TERMS = [
  ["Account equity", "equity"],
  ["unpaired legs", "unpaired_leg"],
  ["close cost", "close_cost"],
  ["open P/L", "open_pl"],
  ["open marks", "open_pl"],
  ["max loss", "max_loss"],
  ["wide-quoted", "wide_quote"],
  ["wide quote", "wide_quote"],
  ["strike BREACHED", "strike_breach_exit"],
  ["profit target", "profit_target"],
  ["Spot quotes", "spot"],
  ["% captured", "pct_captured"],
  ["captured", "pct_captured"],
  ["Realized", "realized_pl"],
  ["Deployment cap", "deployment"],
  ["Deployed", "deployment"],
  ["headroom", "deployment"],
  ["decay", "decay"],
  ["PoP", "pop"],
  ["Cash", "cash"],
  ["Bands", "band"],
  ["DANGER", "band"],
  ["cushion", "cushion"],
  ["DTE", "dte"],
  ["credit", "credit_received"],
  ["delta", "delta"],
  ["theta", "theta"],
  ["vega", "vega"],
  ["gamma", "gamma"],
  ["Beta", "variance_risk_premium"],
  ["Risk", "risk"],
  ["EV", "ev"],
  ["breach", "strike_breach_exit"],
].sort((a, b) => b[0].length - a[0].length);
const PROSE_TERM_MAP = new Map(PROSE_TERMS);

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Word-boundary the pattern on whichever ends actually start/end on a word
// character, so e.g. "breach" doesn't also swallow half of "breached".
function wordBoundedPattern(label) {
  const escaped = escapeRegExp(label);
  const pre = /^\w/.test(label) ? "\\b" : "";
  const post = /\w$/.test(label) ? "\\b" : "";
  return `${pre}${escaped}${post}`;
}

const GLOSSY_LINE_RE = new RegExp(
  PROSE_TERMS.map(([label]) => wordBoundedPattern(label)).join("|") + "|" + SIGNED_TOKEN_RE.source,
  "g"
);

const SIGNED_TOKEN_WHOLE_RE = /^[+-]\$[\d,]+(?:\.\d+)?$|^[+-]\d+(?:\.\d+)?%$/;

// Same tokenizing shape as colorizeSigned, but scanning for BOTH signed
// money/pct tokens (colour) and known glossary labels (a <Help/> button) in
// one pass, so a bullet like "max loss $1,234" gets both.
function glossify(text) {
  if (!text) return text;
  const out = [];
  GLOSSY_LINE_RE.lastIndex = 0;
  let last = 0;
  let m;
  let key = 0;
  const used = new Set();
  while ((m = GLOSSY_LINE_RE.exec(text))) {
    const tok = m[0];
    if (m.index > last) out.push(text.slice(last, m.index));
    if (SIGNED_TOKEN_WHOLE_RE.test(tok)) {
      out.push(
        <span key={key++} className={tok.startsWith("-") ? "down" : "up"}>
          {tok}
        </span>
      );
    } else {
      out.push(tok);
      const term = PROSE_TERM_MAP.get(tok);
      if (term && !used.has(term)) {
        used.add(term);
        out.push(<window.Help key={"h" + key++} term={term} />);
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
  const parts = String(text).split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) {
      return <strong key={i}>{colorizeSigned(p.slice(2, -2))}</strong>;
    }
    return <React.Fragment key={i}>{colorizeSigned(p)}</React.Fragment>;
  });
}

// Same bold-handling as renderInlineMd, but glossifying instead of just
// colour-coding — used where the bullet text itself contains a jargon term
// (Action queue).
function renderInlineMdGlossy(text) {
  const parts = String(text).split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) {
      return <strong key={i}>{glossify(p.slice(2, -2))}</strong>;
    }
    return <React.Fragment key={i}>{glossify(p)}</React.Fragment>;
  });
}

function BulletList({ items, render = colorizeSigned, className = "opts-bullets" }) {
  if (!items.length) return null;
  return (
    <ul className={className}>
      {items.map((t, i) => (
        <li key={i} className={t.indexOf("⚠") !== -1 ? "opts-line-warn" : undefined}>
          {render(t)}
        </li>
      ))}
    </ul>
  );
}

function Paragraphs({ items }) {
  if (!items.length) return null;
  return (
    <>
      {items.map((t, i) => (
        <p key={i} className="opt-log-empty">
          {colorizeSigned(t)}
        </p>
      ))}
    </>
  );
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
function SectionStamp({ iso, schedule }) {
  const t = window.AsOfTime ? window.AsOfTime.format(iso) : null;
  if (!t) return null;
  const stale = isStaleAsOf(iso, schedule);
  const cadenceLabel = (schedule && schedule.cadenceLabel) || FALLBACK_CADENCE_LABEL;
  return (
    <span
      className={stale ? "opts-section-stamp opts-section-stamp--stale" : "opts-section-stamp"}
      title={iso}
    >
      {/* One span per clause so a half-width card wraps BETWEEN clauses
          rather than mid-timestamp ("6:00 PM PDT, / Aug 8"). */}
      <span>{stale ? "⚠ " : ""}Last updated {t.text}</span>
      <span>· {window.AsOfTime.relativeAge(t.ms)}</span>
      <span>· {cadenceLabel}</span>
      <window.Help term="last_updated" />
    </span>
  );
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
function Section({ title, titleTerm, feedbackId, updatedAt, schedule, role, extraHead, children }) {
  const resolvedFeedbackId = feedbackId || panelComponentId(title);
  return (
    <section className="card opt-panel">
      <div className="opt-panel-head">
        <h3 className="opt-panel-title">
          {title}
          {titleTerm && <window.Help term={titleTerm} />}
          {window.FeedbackButton && (
            <window.FeedbackButton target={{ kind: "component", id: resolvedFeedbackId, label: title }} />
          )}
        </h3>
        {(role || updatedAt) && (
          <span className="opts-provenance">
            <RoleByline role={role} />
            {role && updatedAt && <span className="opts-provenance-sep">·</span>}
            {updatedAt && <SectionStamp iso={updatedAt} schedule={schedule} />}
          </span>
        )}
        {extraHead}
      </div>
      {children}
    </section>
  );
}

// The banner states the day's P&L but never said what it is a percentage OF.
// Account equity is the denominator for every ratio on this page (deployment,
// collateral share, day move), so it belongs on the banner itself rather than
// three cards further down. Cash sits beside it because equity alone does not
// say how much of it is still spendable.
function AccountBalance({ account }) {
  const a = account || {};
  if (a.equity === null || a.equity === undefined) return null;
  const money = (n) =>
    n === null || n === undefined || Number.isNaN(Number(n))
      ? "—"
      : `$${Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  return (
    <div className="opts-headline-balance">
      <div className="opts-balance-main">
        <span className="opts-balance-label">
          Account balance
          <window.Help term="equity" />
        </span>
        <span className="opts-balance-value">{money(a.equity)}</span>
      </div>
      <div className="opts-balance-sub">
        cash {money(a.cash)}
        {a.options_buying_power !== undefined && a.options_buying_power !== null
          ? ` · options buying power ${money(a.options_buying_power)}`
          : ""}
        {a.balance_asof ? ` · as of ${a.balance_asof}` : ""}
      </div>
    </div>
  );
}

function Headline({ text, staleLabel, cadenceLabel, account }) {
  return (
    <div className="opts-headline">
      <div className="opts-headline-main">
        <div className="opts-headline-text">{glossify(text)}</div>
        {staleLabel && (
          <div className="opts-stale-banner">
            ⚠ STALE — refreshed {staleLabel}, expected {cadenceLabel || FALLBACK_CADENCE_LABEL}
          </div>
        )}
      </div>
      <AccountBalance account={account} />
    </div>
  );
}

// 3-4 plain-English sentences on what a credit spread even is, shown once at
// the top of the panel so every jargon term below has a home to point back
// to — the per-term <Help/> buttons handle the specifics. A second paragraph
// states the three-voice loop the rest of the page assumes a reader already
// knows: who writes each card, on what cadence, and who acts on it. Renders
// `cadenceLabel` from the Analyst's own published schedule rather than a
// literal, so this copy can't drift from the cron the way the old hardcoded
// "every 2h" text did (PRD 1080/1081).
function HowToReadThisPage({ cadenceLabel }) {
  return (
    <>
      <p className="opt-log-empty opts-howto">
        We sell credit spreads: a defined-risk options trade where the broker pays us cash (the
        credit) up front, in exchange for us taking on the risk that the stock crosses a price we
        picked (the strike). We keep that cash if the stock stays on the safe side of the strike
        through expiration; we owe money if it doesn't. Every number below traces back to that one
        idea — how much cash we collected, how much room the stock has before we're at risk, and
        whether that room is shrinking.
      </p>
      <p className="opt-log-empty opts-howto">
        Every card is written by one of three voices, named on its byline: the{" "}
        <b>Analyst</b> reads the book and writes what it thinks ({cadenceLabel || FALLBACK_CADENCE_LABEL},
        weekdays); the <b>User</b> — that's you — comments in public on a proposal or a card; the{" "}
        <b>Trader</b> wakes on its own 15-minute tick and decides from the Analyst's latest read, your
        comments, and the fund's frozen rules. Tap a byline's <code>?</code> for what each voice actually
        does.
      </p>
    </>
  );
}

// The "Book totals" bullet gets three extra input-carrying `?` badges (one
// per figure it names) on top of the generic per-word ones glossify() already
// inserts — additive, per PRD 1026, never a replacement for the header-level
// explainers.
function WhereBookStands({ lines, totals, positionsCount, asOf }) {
  const items = bulletsOf(lines);
  if (!items.length) return null;
  return (
    <Section title="Where the book stands" role={ROLE.ANALYST}>
      <ul className="opts-bullets">
        {items.map((t, i) => (
          <li key={i} className={t.indexOf("⚠") !== -1 ? "opts-line-warn" : undefined}>
            {glossify(t)}
            {totals && t.startsWith("Book totals") && (
              <>
                <window.Help term="total_credit" inputs={{ count: positionsCount, total: totals.credit }} asOf={asOf} />
                <window.Help term="total_open_pl" inputs={{ count: positionsCount, total: totals.open_pl }} asOf={asOf} />
                <window.Help term="total_max_loss" inputs={{ count: positionsCount, total: totals.max_loss }} asOf={asOf} />
              </>
            )}
          </li>
        ))}
      </ul>
    </Section>
  );
}

// The frozen entry columns get a visual break from the live/now columns via a
// left border on the first live column — same table, two eras.
function makeColClass(frozenCount) {
  return function colClass(i, extra) {
    if (i < frozenCount) return `al ${extra || ""} opts-col-frozen`.trim();
    return i === frozenCount ? "opts-col-live-first" : undefined;
  };
}

function BandBadge({ value }) {
  const cls = BAND_LABEL_CLASS[value];
  if (!cls) return <span className="mono-dim">{value || "—"}</span>;
  return <span className={cls}>{value}</span>;
}

function ConfCell({ value }) {
  if ((value || "").indexOf("⚠") !== -1) return <span className="opts-line-warn">{value}</span>;
  return <span className="mono-dim">{value}</span>;
}

// A row only becomes a link when its `entry.tag` (== client_order_id) both
// resolves to exactly one SPREAD_LOG event AND that event describes the same
// spread (underlying/right/short strike/expiry) as the position — a stale or
// reused client_order_id must never link to the wrong trade.
function eventMatchesPosition(pos, ev) {
  if (!pos || !ev || !window.SpreadFormat) return false;
  const parsed = window.SpreadFormat.parseOccSymbol(ev.short);
  if (!parsed) return false;
  return (
    parsed.root === pos.underlying &&
    parsed.right.toLowerCase() === String(pos.right).toLowerCase() &&
    Number(parsed.strike) === Number(pos.short_strike) &&
    parsed.expiry === pos.expiry
  );
}

function tradeKeyForPosition(pos) {
  const tag = pos && pos.entry && pos.entry.tag;
  const events = (window.SPREAD_LOG && window.SPREAD_LOG.events) || [];
  const internals = window.OptionsTradeLogInternals;
  if (!tag || !events.length || !internals) return null;
  const candidates = [];
  events.forEach((ev, i) => {
    if (ev && ev.client_order_id === tag && eventMatchesPosition(pos, ev)) {
      candidates.push({ ev, i });
    }
  });
  if (candidates.length !== 1) return null;
  const { ev, i } = candidates[0];
  return internals.tradeKey(ev, i);
}

// "2026-08-15" -> "Aug 15", for the human-readable feedback label below.
// Display-only — never fed back into a calculation.
function expiryShortLabel(iso) {
  if (!iso) return "";
  const d = new Date(String(iso).slice(0, 10) + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
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
  const hasFields =
    pos.underlying != null && pos.right != null &&
    pos.short_strike != null && pos.long_strike != null && pos.expiry != null;
  if (hasFields) {
    const right = String(pos.right).charAt(0).toUpperCase();
    const rightWord = String(pos.right).toLowerCase();
    return {
      id: `${pos.underlying}-${right}-${pos.short_strike}/${pos.long_strike}-${pos.expiry}`,
      label: `${pos.underlying} ${pos.short_strike}/${pos.long_strike} ${rightWord} spread, expires ${expiryShortLabel(pos.expiry)}`,
    };
  }
  const symbol = pos.short_symbol || pos.symbol || pos.raw;
  const parsed = symbol && window.SpreadFormat && window.SpreadFormat.parseOccSymbol(symbol);
  if (parsed) {
    const right = parsed.right.charAt(0).toUpperCase();
    return {
      id: `${parsed.root}-${right}-${parsed.strike}-${parsed.expiry}`,
      label: window.SpreadFormat.plainEnglishLeg(symbol),
    };
  }
  return symbol ? { id: symbol, label: symbol } : null;
}

// After setting the hash to a trade's detail page, that page mounts
// asynchronously (React re-render off the hashchange event) — so this retries
// a few times rather than assuming #trade-feedback exists on the next tick.
// Mirrors option-trade-detail.jsx's scrollToTradeLog for the reverse trip.
const TRADE_FEEDBACK_SCROLL_BEHAVIOR = "auto";
function scrollToTradeFeedback(attempts) {
  const el = document.getElementById("trade-feedback");
  if (el) {
    el.scrollIntoView({ behavior: TRADE_FEEDBACK_SCROLL_BEHAVIOR, block: "start" });
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
function PositionFeedbackIndicator({ feedbackTarget, tradeKeyValue }) {
  const internals = window.FeedbackThreadsInternals;
  if (!internals || !feedbackTarget) return null;
  const payload = internals.feedbackPayload();
  const threads = internals.selectThreads(payload.threads, [{ kind: "position", id: feedbackTarget.id }]);
  if (!threads.length) return null;
  const open = threads.filter((t) => !t.answered).length;
  const count = `${threads.length}${open > 0 ? "!" : ""}`;
  const label = `${threads.length} thread${threads.length === 1 ? "" : "s"}${open > 0 ? `, ${open} awaiting reply` : ""}`;
  const cls = `opts-fb-indicator${open > 0 ? " opts-fb-indicator--open" : ""}`;
  const help = window.Help && <window.Help term="position_feedback_indicator" />;
  if (tradeKeyValue) {
    return (
      <>
        <button
          type="button"
          className={cls}
          title={`${label} — view on this trade's page`}
          onClick={(e) => {
            e.stopPropagation();
            location.hash = "trade/" + encodeURIComponent(tradeKeyValue);
            scrollToTradeFeedback(10);
          }}
        >
          {"\u{1F4AC}"} {count}
        </button>
        {help}
      </>
    );
  }
  return (
    <>
      <span
        className={`${cls} opts-fb-indicator--unlinked`}
        title={`${label} — no trade page yet for this position`}
      >
        {"\u{1F4AC}"} {count}
      </span>
      {help}
    </>
  );
}

// One column per cell key in `positions_display[i].cells` (written by
// `positions_display_rows()` in options_summary_render.py — the single place
// that formats these numbers into strings). `frozen` marks the columns the
// entry-snapshot styling (`opts-col-frozen`) applies to; `term` is the shared
// glossary key for the header tooltip.
const POSITIONS_COLUMNS = [
  { key: "spread", header: "Spread", term: "spread", frozen: true },
  { key: "contracts", header: "Contracts", term: "contracts", frozen: true },
  { key: "frozen_entry", header: "FROZEN entry (filled / net / credit)", term: "frozen_entry", frozen: true },
  { key: "spread_price", header: "LIVE spread price (Δ)", term: "close_cost" },
  { key: "spot", header: "LIVE spot", term: "spot" },
  { key: "cushion", header: "LIVE cushion (Δ)", term: "cushion" },
  { key: "band", header: "LIVE band", term: "band" },
  { key: "open_pl", header: "LIVE open P/L (Δ)", term: "open_pl" },
  { key: "pct_captured", header: "% captured", term: "pct_captured" },
  { key: "short_delta", header: "short Δ (Δ)", term: "short_leg_delta" },
  { key: "conf", header: "conf", term: "wide_quote" },
];

// A position row can't be rendered at all without these — they build both
// its display key (matching it to `positions_display`) and its #trade/<key>
// link. Checked in this order so the error names the FIRST field missing.
const POSITIONS_REQUIRED_FIELDS = [
  "short_symbol", "underlying", "right", "short_strike", "long_strike", "expiry", "qty",
];

function missingPositionField(pos) {
  if (!pos) return "position";
  for (const field of POSITIONS_REQUIRED_FIELDS) {
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
  const asOf = {
    quotes: (pos && pos.oldest_quote_ts) || fallbackAsOf,
    entry: (pos && pos.entry && pos.entry.filled_at) || fallbackAsOf,
  };
  // `entry`/`now` are guaranteed on a current snapshot but NOT on the legacy
  // one the fallback above now renders, and an unguarded deref here would take
  // the whole panel down with it — the exact failure mode the per-row error
  // was protecting against.
  const entry = (pos && pos.entry) || {};
  const now = (pos && pos.now) || {};
  const creditCloseCost = pos ? { credit: entry.credit, close_cost: now.close_cost } : {};
  return {
    asOf,
    risk: pos ? { width: pos.width, contracts: pos.qty, credit: entry.credit } : {},
    cushion: pos ? { short_strike: pos.short_strike, spot: now.spot, right: pos.right } : {},
    open_pl: creditCloseCost,
    pct_captured: creditCloseCost,
    close_cost: pos
      ? {
          short_ask: pos.quality && pos.quality.short && pos.quality.short.ask,
          long_bid: pos.quality && pos.quality.long && pos.quality.long.bid,
          width: pos.width,
          contracts: pos.qty,
        }
      : {},
  };
}

const colClass = makeColClass(POSITIONS_COLUMNS.filter((c) => c.frozen).length);

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
  const money = (n) =>
    n === null || n === undefined || Number.isNaN(Number(n))
      ? "—"
      : `$${Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  const pct = (n, digits) =>
    n === null || n === undefined || Number.isNaN(Number(n))
      ? "—"
      : `${(Number(n) * 100).toFixed(digits === undefined ? 2 : digits)}%`;
  const num = (n, digits) =>
    n === null || n === undefined || Number.isNaN(Number(n)) ? "—" : Number(n).toFixed(digits);

  const entry = pos.entry || {};
  const now = pos.now || {};
  const greeks = pos.greeks || {};
  const filled = entry.filled_at ? String(entry.filled_at).slice(0, 10) : "—";
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
    conf: "⚠ legacy",
  };
}

// One typed record.positions[] row -> one <tr>. `display` is this position's
// entry from `positions_display` (the export's pre-formatted cell strings,
// keyed by short_symbol). When it's missing the row falls back to
// legacyDisplayCells(); only a position missing an IDENTITY field (which no
// fallback can invent) still renders an explicit error row.
function PositionsRow({ pos, display, fallbackAsOf }) {
  const missingField = missingPositionField(pos);
  if (missingField) {
    const label = pos && pos.short_symbol ? ` (${pos.short_symbol})` : "";
    return (
      <tr className="opts-row-error">
        <td colSpan={POSITIONS_COLUMNS.length + 1} className="opts-line-warn">
          ⚠ Could not render this position{label} — missing `{missingField}`.
        </td>
      </tr>
    );
  }
  const cells = display ? display.cells : legacyDisplayCells(pos);
  const key = tradeKeyForPosition(pos);
  const feedbackTarget = positionFeedbackTarget(pos);
  const openDetail = key != null ? () => { location.hash = "trade/" + encodeURIComponent(key); } : null;
  const onKeyDown = openDetail
    ? (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openDetail();
        }
      }
    : undefined;
  const calcProps = positionRowCalcProps(pos, fallbackAsOf);
  const wideQuoteNote =
    (cells.conf || "").indexOf("⚠") !== -1
      ? "⚠ Wide-quoted leg(s) on this row — this mark is the least trustworthy number in the table."
      : undefined;
  return (
    <tr
      className={openDetail ? "opt-row" : undefined}
      onClick={openDetail || undefined}
      tabIndex={openDetail ? 0 : undefined}
      role={openDetail ? "link" : undefined}
      onKeyDown={onKeyDown}
    >
      {POSITIONS_COLUMNS.map(({ key: ck, frozen }, ci) => (
        <td key={ck} className={colClass(ci, "mono-dim")}>
          {ck === "band" ? (
            <BandBadge value={cells.band} />
          ) : ck === "conf" ? (
            <ConfCell value={cells.conf} />
          ) : ck === "frozen_entry" ? (
            <>
              {cells.frozen_entry}
              <window.Help term="risk" inputs={calcProps.risk} asOf={calcProps.asOf} />
            </>
          ) : ck === "spread_price" ? (
            <>
              {colorizeSigned(cells.spread_price)}
              <window.Help
                term="close_cost"
                inputs={calcProps.close_cost}
                asOf={calcProps.asOf}
                note={wideQuoteNote}
              />
            </>
          ) : ck === "cushion" ? (
            <>
              {colorizeSigned(cells.cushion)}
              <window.Help term="cushion" inputs={calcProps.cushion} asOf={calcProps.asOf} />
            </>
          ) : ck === "open_pl" ? (
            <>
              {colorizeSigned(cells.open_pl)}
              <window.Help term="open_pl" inputs={calcProps.open_pl} asOf={calcProps.asOf} />
            </>
          ) : ck === "pct_captured" ? (
            <>
              {colorizeSigned(cells.pct_captured)}
              <window.Help term="pct_captured" inputs={calcProps.pct_captured} asOf={calcProps.asOf} />
            </>
          ) : frozen ? (
            cells[ck]
          ) : (
            colorizeSigned(cells[ck])
          )}
        </td>
      ))}
      <td
        className="opts-col-feedback"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {window.FeedbackButton && feedbackTarget && (
          <window.FeedbackButton target={{ kind: "position", ...feedbackTarget }} />
        )}
        <PositionFeedbackIndicator feedbackTarget={feedbackTarget} tradeKeyValue={key} />
      </td>
    </tr>
  );
}

// An option leg the broker holds that this page's spread pairing cannot pair
// (a long with no matching short, e.g. after the short side was closed or
// assigned). It is a REAL position with real P&L — Alpaca shows it — so
// omitting it made "No open options positions" a lie whenever one existed.
// Rendered as its own block rather than a spread row: it has no width, no
// credit and no cushion, and inventing those columns would be worse than
// stating plainly what it is.
function UnpairedLegs({ legs }) {
  const list = (legs || []).filter(Boolean);
  if (!list.length) return null;
  const reasonText = {
    long_with_no_matching_short: "long leg with no matching short — the spread's other side is gone",
    short_with_no_matching_long: "short leg with no matching long — UNCOVERED, no loss cap",
  };
  return (
    <div className="opts-unpaired">
      <h4 className="opts-unpaired-title">
        ⚠ {list.length} unpaired option leg{list.length === 1 ? "" : "s"} — held at the broker, not part of any spread
      </h4>
      <table className="opt-table opts-unpaired-table">
        <thead>
          <tr>
            <th className="al">Contract</th>
            <th className="al">Qty</th>
            <th className="al">Side</th>
            <th className="al">Why it is not a spread</th>
          </tr>
        </thead>
        <tbody>
          {list.map((leg, i) => (
            <tr key={leg.symbol || i}>
              <td className="al mono-dim">{leg.symbol || "—"}</td>
              <td className="al mono-dim">{leg.qty === null || leg.qty === undefined ? "—" : leg.qty}</td>
              <td className="al mono-dim">{leg.side || "—"}</td>
              <td className="al">{reasonText[leg.unpaired_reason] || leg.unpaired_reason || "unpaired"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="opts-unpaired-note">
        These carry no credit, no width and no loss cap of their own, so the book totals above
        exclude them. They still move with the underlying — check them against the broker.
      </p>
    </div>
  );
}

function PositionsTable({ positions, positionsDisplay, fallbackAsOf, unpairedLegs }) {
  const posList = positions || [];
  if (!posList.length) {
    return (
      <>
        <p className="opt-log-empty">No open credit spreads.</p>
        <UnpairedLegs legs={unpairedLegs} />
      </>
    );
  }
  const displayBySymbol = new Map((positionsDisplay || []).map((d) => [d.short_symbol, d]));
  return (
    <div className="opt-table-scroll">
      <table className="opt-table opt-table--orders opts-positions-table">
        <thead>
          <tr>
            {POSITIONS_COLUMNS.map(({ key, header, term }, ci) => (
              <th key={key} className={colClass(ci)}>
                {header}
                {term && <window.Help term={term} />}
              </th>
            ))}
            <th className="sr-only">Feedback</th>
          </tr>
        </thead>
        <tbody>
          {posList.map((pos, ri) => (
            <PositionsRow
              key={(pos && pos.short_symbol) || ri}
              pos={pos}
              display={pos && pos.short_symbol ? displayBySymbol.get(pos.short_symbol) : null}
              fallbackAsOf={fallbackAsOf}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PositionsSection({ positions, positionsDisplay, fallbackAsOf, unpairedLegs, schedule }) {
  return (
    <Section
      title="Positions — entry snapshot (frozen) vs now (live)"
      updatedAt={fallbackAsOf}
      schedule={schedule}
      role={ROLE.ANALYST}
    >
      <PositionsTable
        positions={positions}
        positionsDisplay={positionsDisplay}
        fallbackAsOf={fallbackAsOf}
        unpairedLegs={unpairedLegs}
      />
    </Section>
  );
}

// options_summary_render.py's `_anchor_id()` trails both "What we think"
// bullets and Action queue rows with `<!-- id:pos-... -->` (link 2) so a
// queue row can deep-link to its rationale bullet (link 3) — strip it from
// the visible text everywhere it's parsed out, never render the raw comment.
const ANCHOR_COMMENT_RE = /\s*<!--\s*id:([\w.-]+)\s*-->\s*$/;
function stripAnchorComment(text) {
  const m = ANCHOR_COMMENT_RE.exec(text);
  return m ? { text: text.slice(0, m.index), anchorId: m[1] } : { text, anchorId: null };
}

const ACTION_QUEUE_HIGHLIGHT_CLASS = "opts-wwt-row--highlight";

// scrollIntoView + a transient CSS class is the whole deep-link mechanism —
// no router, no new state library, per the PRD's implementation notes.
function scrollToWhatWeThinkRow(anchorId) {
  const el = document.getElementById(anchorId);
  if (!el) return false;
  const SMOOTH_SCROLL = "smooth";
  el.scrollIntoView({ behavior: SMOOTH_SCROLL, block: "center" });
  el.classList.add(ACTION_QUEUE_HIGHLIGHT_CLASS);
  window.setTimeout(() => el.classList.remove(ACTION_QUEUE_HIGHLIGHT_CLASS), 2000);
  return true;
}

function WhatWeThink({ lines, updatedAt, schedule }) {
  const items = bulletsOf(lines);
  return (
    <Section title="What we think right now" updatedAt={updatedAt} schedule={schedule} role={ROLE.ANALYST}>
      {items.length ? (
        <ul className="opts-bullets opts-what-we-think">
          {items.map((raw, i) => {
            const { text, anchorId } = stripAnchorComment(raw);
            return (
              <li
                key={i}
                id={anchorId || undefined}
                className={text.indexOf("⚠") !== -1 ? "opts-line-warn" : undefined}
              >
                {renderInlineMd(text)}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="opt-log-empty">{plainLinesOf(lines)[0] || "No open options positions — nothing to assess."}</p>
      )}
    </Section>
  );
}

const ACTION_SEVERITY = {
  "🔴": "breached",
  "🟠": "danger",
  "⚠": "watch",
  "✅": "safe",
  "🚫": "suppressed",
  "🔵": "info",
};

const ACTION_COUNTS_RE = /^(\d+) armed · (\d+) watching · (\d+) blocked · (.+) total at stake$/;

// The counts line (`options_summary_render.py::_action_queue`) is plain
// prose, not a bullet — pulled out separately from the grouped rows below so
// it can move into the card head instead of the body.
function parseActionCounts(lines) {
  for (const line of lines) {
    const m = ACTION_COUNTS_RE.exec(line.trim());
    if (m) return { armed: m[1], watching: m[2], blocked: m[3], totalAtStake: m[4] };
  }
  return null;
}

// Buckets the queue's `**Armed**` / `**Watching**` / `**Can't trust**`
// sub-headings, preserving emission order and skipping empty groups. A
// pre-link-2 payload with no sub-headings falls every row into one
// ungrouped (label: null) bucket instead of throwing.
function parseActionGroups(lines) {
  const groups = [];
  let current = null;
  for (const line of lines) {
    const headingMatch = /^\*\*(.+)\*\*$/.exec(line.trim());
    if (headingMatch) {
      current = { label: headingMatch[1], items: [] };
      groups.push(current);
      continue;
    }
    if (line.startsWith("- ")) {
      if (!current) {
        current = { label: null, items: [] };
        groups.push(current);
      }
      current.items.push(line.slice(2));
    }
  }
  return groups.filter((g) => g.items.length > 0);
}

// Only the two groups with a dedicated glossary term get a label-level Help;
// "Watching" leans on the per-row band/credit glossify() terms already
// present in its own row text.
const ACTION_GROUP_TERM = { Armed: "armed", "Can't trust": "mark_suspect" };

const EMPTY_ANCHOR_SET = new Set();

function ActionQueueCounts({ counts }) {
  if (!counts) return null;
  return (
    <span className="opts-action-counts-chip">
      <span>{counts.armed} armed</span>
      <span>· {counts.watching} watching</span>
      <span>· {counts.blocked} blocked</span>
      <span>· {counts.totalAtStake} total at stake</span>
      <window.Help term="at_stake" />
    </span>
  );
}

function ActionQueueRow({ text, anchors }) {
  const { text: visible, anchorId } = stripAnchorComment(text);
  const sev = ACTION_SEVERITY[visible.slice(0, 2).trim()] || ACTION_SEVERITY[visible[0]] || "neutral";
  const clickable = Boolean(anchorId && anchors.has(anchorId));
  const rowTerm =
    visible.slice(0, 2).trim() === "🚫" ? "suppressed_exit" : visible.indexOf("unpriceable") !== -1 ? "unpriceable" : null;
  const activate = clickable ? () => scrollToWhatWeThinkRow(anchorId) : undefined;
  const onKeyDown = clickable
    ? (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          activate();
        }
      }
    : undefined;
  return (
    <li
      className={`opts-action opts-action--${sev}${clickable ? " opts-action--clickable" : ""}`}
      onClick={activate}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={onKeyDown}
    >
      {renderInlineMdGlossy(visible)}
      {rowTerm && <window.Help term={rowTerm} />}
    </li>
  );
}

function ActionQueue({ lines, updatedAt, anchors, schedule }) {
  const counts = parseActionCounts(lines);
  const groups = parseActionGroups(lines);
  const anchorSet = anchors || EMPTY_ANCHOR_SET;
  return (
    <Section
      title="Action queue"
      updatedAt={updatedAt}
      schedule={schedule}
      role={ROLE.ANALYST}
      extraHead={<ActionQueueCounts counts={counts} />}
    >
      {groups.length ? (
        groups.map((g, gi) => (
          <div className="opts-action-group" key={gi}>
            {g.label && (
              <h4 className="opts-action-group-label">
                {g.label}
                {ACTION_GROUP_TERM[g.label] && <window.Help term={ACTION_GROUP_TERM[g.label]} />}
              </h4>
            )}
            <ul className="opts-bullets opts-action-queue">
              {g.items.map((t, i) => (
                <ActionQueueRow key={i} text={t} anchors={anchorSet} />
              ))}
            </ul>
          </div>
        ))
      ) : (
        <p className="opt-log-empty">Nothing needs attention right now.</p>
      )}
    </Section>
  );
}

const OPEN_QUEUE_HEADER_TERM = {
  Short: "short_leg",
  Long: "long_leg",
  Contracts: "contracts",
  Expiry: "expiry",
  DTE: "dte",
  PoP: "pop",
  Risk: "risk",
  Credit: "credit_received",
  EV: "ev",
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
function OpenQueue({ lines, totals, account }) {
  const bullets = bulletsOf(lines);
  const table = tableOf(lines);
  const plain = plainLinesOf(lines);
  const deploymentAsOf = account ? { quotes: account.balance_asof } : undefined;
  return (
    <Section title="Open queue">
      {bullets.length ? (
        <ul className="opts-bullets">
          {bullets.map((t, i) => (
            <li key={i} className={t.indexOf("⚠") !== -1 ? "opts-line-warn" : undefined}>
              {glossify(t)}
              {totals && account && t.startsWith("Deployed ") && (
                <window.Help
                  term="deployment"
                  inputs={{ spread_risk: totals.max_loss, stock_value: 0, equity: account.equity }}
                  asOf={deploymentAsOf}
                />
              )}
            </li>
          ))}
        </ul>
      ) : (
        <Paragraphs items={plain} />
      )}
      {table && (
        <div className="opt-table-scroll" style={{ marginTop: 10 }}>
          <table className="opt-table opt-table--orders">
            <thead>
              <tr>
                {table.header.map((h, i) => (
                  <th key={i} className={i === 0 ? "al" : undefined}>
                    {h}
                    {OPEN_QUEUE_HEADER_TERM[h] && <window.Help term={OPEN_QUEUE_HEADER_TERM[h]} />}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.body.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td key={ci} className={ci === 0 ? "al" : undefined}>
                      {ci === table.header.length - 1 ? colorizeSigned(cell) : cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

// `key` here is the raw config field name from options_summary_render.py's
// `_RULES_FIELDS` (out of scope to change) — mapped to the existing glossary
// term for that concept, reusing definitions rather than writing new ones.
const RULES_FIELD_TERM = {
  hold_to_expiry: "hold_to_expiry",
  profit_target_pct: "profit_target",
  close_on_strike_breach: "strike_breach_exit",
  strike_breach_buffer_pct: "strike_breach_buffer",
  max_short_delta: "max_short_delta",
  min_pop: "min_pop",
  min_dte: "dte",
  max_dte: "dte",
  max_per_underlying: "max_per_underlying",
  live: "live_flag",
};

// Rendered markdown already carries the config's own value as this bullet's
// `value` text — these five terms' glossary calcs accept that same field
// name as an input key, so the live SPREAD_CONFIG value substitutes straight
// into the rule's formula instead of the header-level explainer staying
// generic. Kept as a plain Set (not an object literal) so it doesn't get
// picked up by the "every mapped term must resolve" source-level test scan,
// which only looks for `key: "glossary_term"` shaped mappings.
const RULES_FIELDS_WITH_CONFIG_INPUT = new Set([
  "profit_target_pct",
  "strike_breach_buffer_pct",
  "max_per_underlying",
  "min_pop",
  "max_short_delta",
]);

function RulesInForce({ lines }) {
  const items = bulletsOf(lines).map((l) => {
    const m = /^`([^`]+)`:\s*(.*)$/.exec(l);
    return m ? { key: m[1], value: m[2], term: RULES_FIELD_TERM[m[1]] } : { key: l, value: "", free: true };
  });
  const config = (window.SPREAD_CONFIG && window.SPREAD_CONFIG.config) || {};
  return (
    <Section title="Rules in force" role={ROLE.TRADER}>
      <div className="opt-kv">
        {items.map((it, i) => {
          const configValue =
            !it.free && RULES_FIELDS_WITH_CONFIG_INPUT.has(it.key) ? config[it.key] : undefined;
          const inputs = configValue != null ? { [it.key]: configValue } : undefined;
          return (
            <div className="opt-kv-item" key={i}>
              <span className="opt-kv-k">
                {it.free ? glossify(it.key) : it.key}
                {it.term && <window.Help term={it.term} inputs={inputs} />}
              </span>
              <span className="opt-kv-v">{it.value}</span>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

function Provenance({ lines }) {
  return (
    <Section title="Provenance" titleTerm="provenance" role={ROLE.ANALYST}>
      <BulletList items={bulletsOf(lines)} className="opts-bullets mono-dim" />
    </Section>
  );
}

function EmptyState() {
  return (
    <section className="card opt-log">
      <h3 className="opt-log-title">Options book summary</h3>
      <HowToReadThisPage />
      <p className="opt-log-empty">
        No summary yet — the <code>options-status-refresh-summary</code> job hasn't run for the first
        time.
      </p>
    </section>
  );
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
  const summaryData = data || window.OPTIONS_SUMMARY;
  if (!summaryData || !summaryData.record || !summaryData.summary) {
    return { empty: <EmptyState /> };
  }
  const sections = parseSections(summaryData.summary);
  const headlineText = (sections[0].lines.find((l) => l.trim()) || "").trim();
  // Absent on an older cached payload published before PRD 1080 — every
  // consumer below falls back to the pre-1080 flat-2h assumption via
  // isStaleAsOf()/SectionStamp's own defaulting, never throws on the missing key.
  const schedule = summaryData.schedule || null;
  const staleLabel = isStaleAsOf(summaryData.generatedAt, schedule) ? ageLabel(summaryData.generatedAt) : null;
  const cadenceLabel = (schedule && schedule.cadenceLabel) || FALLBACK_CADENCE_LABEL;

  const record = summaryData.record;
  // PRD 1026: single fallback stamp for any price-derived calc that has no
  // more specific timestamp of its own (a position's own oldest_quote_ts /
  // entry.filled_at always wins when present).
  const fallbackAsOf = summaryData.generatedAt || record.generated_at;
  const bookAsOf = { quotes: record.oldest_quote_ts || fallbackAsOf, entry: fallbackAsOf };

  // Action queue rows deep-link to their What-we-think rationale row by the
  // same `pos-...` anchor id both sections carry — derived once here, from
  // the one bullet parse, so the two sections can never disagree on which
  // anchors actually exist.
  const whatWeThinkLines = findSection(sections, "What we think right now").lines;
  const whatWeThinkAnchors = new Set(
    bulletsOf(whatWeThinkLines)
      .map((b) => stripAnchorComment(b).anchorId)
      .filter(Boolean)
  );

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
    howto: <HowToReadThisPage cadenceLabel={cadenceLabel} />,
    headline: (
      <Headline text={headlineText} staleLabel={staleLabel} cadenceLabel={cadenceLabel} account={record.account} />
    ),
    whereBookStands: (
      <WhereBookStands
        lines={findSection(sections, "Where the book stands").lines}
        totals={record.totals}
        positionsCount={record.positions.length}
        asOf={bookAsOf}
      />
    ),
    positions: (
      <PositionsSection
        positions={record.positions}
        positionsDisplay={summaryData.positions_display}
        fallbackAsOf={fallbackAsOf}
        unpairedLegs={record.unpaired_legs}
        schedule={schedule}
      />
    ),
    // Both cards are prose the Analyst cron re-derives wholesale, so each
    // carries that job's run time — `fallbackAsOf` is exactly the summary's
    // own generated_at (see above), not a per-position quote clock.
    whatWeThink: <WhatWeThink lines={whatWeThinkLines} updatedAt={fallbackAsOf} schedule={schedule} />,
    actionQueue: (
      <ActionQueue
        lines={findSection(sections, "Action queue").lines}
        updatedAt={fallbackAsOf}
        anchors={whatWeThinkAnchors}
        schedule={schedule}
      />
    ),
    // No `openQueue` key: the live page (ticker-details.jsx) never mounted
    // one, and Proposed trades is what a reader sees for "what's about to
    // happen" now. OpenQueue the component stays defined above for the
    // standalone-panel test coverage only — see its own comment.
    rulesInForce: <RulesInForce lines={findSection(sections, "Rules in force").lines} />,
    provenance: <Provenance lines={findSection(sections, "Provenance").lines} />,
  };
}

function OptionsSummaryPanel({ data }) {
  const summaryText = data ? data.summary : window.OPTIONS_SUMMARY && window.OPTIONS_SUMMARY.summary;
  // Hooks must run unconditionally, so this memo sits ahead of the
  // empty-state guard below even though its result is unused in that case.
  const parts = useMemo(() => optionsSummaryParts(data), [data, summaryText]);
  if (parts.empty) return parts.empty;

  return (
    <div className="opt-log opt-log--stacked opts-summary">
      <div className="opt-log-stack">
        {parts.howto}
        {parts.headline}
        {parts.whereBookStands}
        {parts.positions}
        {parts.whatWeThink}
        {parts.actionQueue}
        {parts.rulesInForce}
        {parts.provenance}
      </div>
    </div>
  );
}

// Shared with dashboard/pages/option-trade-detail.jsx so it can resolve a
// trade-log event to its live record.positions[] entry (for the current
// price) using the same row<->position identity rules this panel uses —
// rather than a third, drift-prone matcher.
window.OptionsSummaryInternals = {
  eventMatchesPosition, tradeKeyForPosition,
  ageLabel, isStaleAsOf, FALLBACK_STALE_AFTER_MS, FALLBACK_CADENCE_LABEL, FALLBACK_REFRESH_INTERVAL_MINUTES,
  componentId: panelComponentId, positionFeedbackTarget,
  RoleByline, ROLE,
};

window.OptionsSummaryPanel = OptionsSummaryPanel;
// Per-card access for the page that owns the Options Log layout.
window.optionsSummaryParts = optionsSummaryParts;
