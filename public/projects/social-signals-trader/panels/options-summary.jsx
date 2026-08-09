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

// PRD 1009's actual cadence (scripts/install-crons.sh: `0 */2 * * *`) — the
// render module's own STALE_AFTER assumes 30m pending that job, so staleness
// here is computed independently, live, against wall-clock at render time.
const REFRESH_INTERVAL_MINUTES = 120;
const REFRESH_INTERVAL_HOURS = REFRESH_INTERVAL_MINUTES / 60;
const STALE_AFTER_MS = REFRESH_INTERVAL_MINUTES * 2 * 60 * 1000;

const BAND_LABEL_CLASS = {
  SAFE: "opts-band opts-band--safe",
  WATCH: "opts-band opts-band--watch",
  DANGER: "opts-band opts-band--danger",
  BREACHED: "opts-band opts-band--breached",
};

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

// Shared staleness test — a snapshot is stale once it's older than 2 refresh
// cycles. Kept as one function (rather than each caller re-deriving
// `Date.now() - t > STALE_AFTER_MS`) so this panel and any other reader of
// window.OPTIONS_SUMMARY (dashboard/pages/option-trade-detail.jsx) can never
// disagree on what "stale" means.
function isStaleAsOf(iso) {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t > STALE_AFTER_MS;
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

// "Last updated <PT time> · <age> · refreshes every 2h" for a card whose
// content is written by a cron rather than computed live in the browser.
// The absolute time comes from window.AsOfTime (the same PT formatter the
// `?` tooltips' as-of lines use) so the two can't drift apart; staleness
// reuses isStaleAsOf, so a stamp and the headline's STALE banner always
// agree. Renders nothing when there's no usable timestamp — an unstamped
// card is better than a fabricated one.
function SectionStamp({ iso }) {
  const t = window.AsOfTime ? window.AsOfTime.format(iso) : null;
  if (!t) return null;
  const stale = isStaleAsOf(iso);
  return (
    <span
      className={stale ? "opts-section-stamp opts-section-stamp--stale" : "opts-section-stamp"}
      title={iso}
    >
      {/* One span per clause so a half-width card wraps BETWEEN clauses
          rather than mid-timestamp ("6:00 PM PDT, / Aug 8"). */}
      <span>{stale ? "⚠ " : ""}Last updated {t.text}</span>
      <span>· {window.AsOfTime.relativeAge(t.ms)}</span>
      <span>· refreshes every {REFRESH_INTERVAL_HOURS}h</span>
      <window.Help term="last_updated" />
    </span>
  );
}

// Every section below is the same card/head/title shell around a different
// body — one wrapper instead of seven copies of the same markup.
// `updatedAt` is opt-in: only the cards whose content is regenerated by the
// 2h refresh cron carry a stamp, so the stamp keeps meaning something.
function Section({ title, titleTerm, updatedAt, children }) {
  return (
    <section className="card opt-panel">
      <div className="opt-panel-head">
        <h3 className="opt-panel-title">
          {title}
          {titleTerm && <window.Help term={titleTerm} />}
        </h3>
        {updatedAt && <SectionStamp iso={updatedAt} />}
      </div>
      {children}
    </section>
  );
}

function Headline({ text, staleLabel }) {
  return (
    <div className="opts-headline">
      <div className="opts-headline-text">{glossify(text)}</div>
      {staleLabel && <div className="opts-stale-banner">⚠ STALE — refreshed {staleLabel}, expected every {REFRESH_INTERVAL_HOURS}h</div>}
    </div>
  );
}

// 3-4 plain-English sentences on what a credit spread even is, shown once at
// the top of the panel so every jargon term below has a home to point back
// to — the per-term <Help/> buttons handle the specifics.
function HowToReadThisPage() {
  return (
    <p className="opt-log-empty opts-howto">
      We sell credit spreads: a defined-risk options trade where the broker pays us cash (the
      credit) up front, in exchange for us taking on the risk that the stock crosses a price we
      picked (the strike). We keep that cash if the stock stays on the safe side of the strike
      through expiration; we owe money if it doesn't. Every number below traces back to that one
      idea — how much cash we collected, how much room the stock has before we're at risk, and
      whether that room is shrinking.
    </p>
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
    <Section title="Where the book stands">
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

// Frozen entry columns (0-1) get a visual break from the live/now columns
// (2-8) via a left border on the first live column — same table, two eras.
const FROZEN_COLS = new Set([0, 1]);

function colClass(i, extra) {
  if (FROZEN_COLS.has(i)) return `al ${extra || ""} opts-col-frozen`.trim();
  return i === 2 ? "opts-col-live-first" : undefined;
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

// --- row -> record.positions[] identity match --------------------------
// The "Spread" cell is rendered by options_summary_render.py as
// `f"{underlying} {right} {short_strike}/{long_strike} {expiry}"` — parse it
// back into typed fields rather than string-comparing against the record's
// own formatting (float repr can drift, e.g. "255" vs "255.0").
const SPREAD_LABEL_RE = /^(\S+)\s+(call|put)\s+([\d.]+)\/([\d.]+)\s+(\d\d\d\d-\d\d-\d\d)$/i;

function parseSpreadLabel(label) {
  const m = SPREAD_LABEL_RE.exec((label || "").trim());
  if (!m) return null;
  return {
    underlying: m[1],
    right: m[2].toLowerCase(),
    shortStrike: Number(m[3]),
    longStrike: Number(m[4]),
    expiry: m[5],
  };
}

function positionMatchesLabel(pos, parsed) {
  if (!pos || !parsed) return false;
  return (
    pos.underlying === parsed.underlying &&
    String(pos.right).toLowerCase() === parsed.right &&
    Number(pos.short_strike) === parsed.shortStrike &&
    Number(pos.long_strike) === parsed.longStrike &&
    pos.expiry === parsed.expiry
  );
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

// Header text comes verbatim from options_summary_render.py's markdown table
// (out of scope to change) — mapped to the shared glossary term it explains.
const POSITIONS_HEADER_TERM = {
  Spread: "spread",
  "FROZEN entry (filled / net / credit)": "frozen_entry",
  "LIVE spread price (Δ)": "close_cost",
  "LIVE spot": "spot",
  "LIVE cushion (Δ)": "cushion",
  "LIVE band": "band",
  "LIVE open P/L (Δ)": "open_pl",
  "% captured": "pct_captured",
  "short Δ (Δ)": "short_leg_delta",
  conf: "wide_quote",
};

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
  const creditCloseCost = pos ? { credit: pos.entry.credit, close_cost: pos.now.close_cost } : {};
  return {
    asOf,
    risk: pos ? { width: pos.width, contracts: pos.qty, credit: pos.entry.credit } : {},
    cushion: pos ? { short_strike: pos.short_strike, spot: pos.now.spot, right: pos.right } : {},
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

function PositionsTable({ lines, positions, fallbackAsOf }) {
  const table = tableOf(lines);
  if (!table) {
    return (
      <p className="opt-log-empty">
        {plainLinesOf(lines)[0] || "No open options positions."}
      </p>
    );
  }
  const { header, body } = table;
  const bandCol = header.findIndex((h) => h === "LIVE band");
  const confCol = header.findIndex((h) => h === "conf");
  const spreadCol = header.findIndex((h) => h === "Spread");
  const frozenEntryCol = header.findIndex((h) => h === "FROZEN entry (filled / net / credit)");
  const spreadPriceCol = header.findIndex((h) => h === "LIVE spread price (Δ)");
  const cushionCol = header.findIndex((h) => h === "LIVE cushion (Δ)");
  const openPlCol = header.findIndex((h) => h === "LIVE open P/L (Δ)");
  const pctCapturedCol = header.findIndex((h) => h === "% captured");
  const posList = positions || [];
  return (
    <div className="opt-table-scroll">
      <table className="opt-table opt-table--orders opts-positions-table">
        <thead>
          <tr>
            {header.map((h, i) => (
              <th key={i} className={colClass(i)}>
                {h}
                {POSITIONS_HEADER_TERM[h] && <window.Help term={POSITIONS_HEADER_TERM[h]} />}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, ri) => {
            const parsedLabel = spreadCol >= 0 ? parseSpreadLabel(row[spreadCol]) : null;
            const pos = parsedLabel ? posList.find((p) => positionMatchesLabel(p, parsedLabel)) : null;
            const key = pos ? tradeKeyForPosition(pos) : null;
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
              confCol >= 0 && (row[confCol] || "").indexOf("⚠") !== -1
                ? "⚠ Wide-quoted leg(s) on this row — this mark is the least trustworthy number in the table."
                : undefined;
            return (
              <tr
                key={ri}
                className={openDetail ? "opt-row" : undefined}
                onClick={openDetail || undefined}
                tabIndex={openDetail ? 0 : undefined}
                role={openDetail ? "link" : undefined}
                onKeyDown={onKeyDown}
              >
                {row.map((cell, ci) => (
                  <td key={ci} className={colClass(ci, "mono-dim")}>
                    {ci === bandCol ? (
                      <BandBadge value={cell} />
                    ) : ci === confCol ? (
                      <ConfCell value={cell} />
                    ) : ci === frozenEntryCol ? (
                      <>
                        {cell}
                        <window.Help term="risk" inputs={calcProps.risk} asOf={calcProps.asOf} />
                      </>
                    ) : ci === spreadPriceCol ? (
                      <>
                        {colorizeSigned(cell)}
                        <window.Help
                          term="close_cost"
                          inputs={calcProps.close_cost}
                          asOf={calcProps.asOf}
                          note={wideQuoteNote}
                        />
                      </>
                    ) : ci === cushionCol ? (
                      <>
                        {colorizeSigned(cell)}
                        <window.Help term="cushion" inputs={calcProps.cushion} asOf={calcProps.asOf} />
                      </>
                    ) : ci === openPlCol ? (
                      <>
                        {colorizeSigned(cell)}
                        <window.Help term="open_pl" inputs={calcProps.open_pl} asOf={calcProps.asOf} />
                      </>
                    ) : ci === pctCapturedCol ? (
                      <>
                        {colorizeSigned(cell)}
                        <window.Help term="pct_captured" inputs={calcProps.pct_captured} asOf={calcProps.asOf} />
                      </>
                    ) : FROZEN_COLS.has(ci) ? (
                      cell
                    ) : (
                      colorizeSigned(cell)
                    )}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PositionsSection({ lines, positions, fallbackAsOf }) {
  return (
    <Section title="Positions — entry snapshot (frozen) vs now (live)">
      <PositionsTable lines={lines} positions={positions} fallbackAsOf={fallbackAsOf} />
    </Section>
  );
}

function WhatWeThink({ lines, updatedAt }) {
  const items = bulletsOf(lines);
  return (
    <Section title="What we think right now" updatedAt={updatedAt}>
      {items.length ? (
        <BulletList items={items} render={renderInlineMd} className="opts-bullets opts-what-we-think" />
      ) : (
        <p className="opt-log-empty">{plainLinesOf(lines)[0] || "No open options positions — nothing to assess."}</p>
      )}
    </Section>
  );
}

const ACTION_SEVERITY = { "🔴": "breached", "🟠": "danger", "⚠": "watch", "✅": "safe" };

function ActionQueue({ lines, updatedAt }) {
  const items = bulletsOf(lines);
  return (
    <Section title="Action queue" updatedAt={updatedAt}>
      {!items.length || items[0] === "Nothing needs attention right now." ? (
        <p className="opt-log-empty">Nothing needs attention right now.</p>
      ) : (
        <ul className="opts-bullets opts-action-queue">
          {items.map((t, i) => {
            const sev = ACTION_SEVERITY[t.slice(0, 2).trim()] || ACTION_SEVERITY[t[0]] || "neutral";
            return (
              <li key={i} className={`opts-action opts-action--${sev}`}>
                {renderInlineMdGlossy(t)}
              </li>
            );
          })}
        </ul>
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
    <Section title="Rules in force">
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
    <Section title="Provenance" titleTerm="provenance">
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
        time. It's scheduled every {REFRESH_INTERVAL_HOURS}h.
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
  const staleLabel = isStaleAsOf(summaryData.generatedAt) ? ageLabel(summaryData.generatedAt) : null;

  const record = summaryData.record;
  // PRD 1026: single fallback stamp for any price-derived calc that has no
  // more specific timestamp of its own (a position's own oldest_quote_ts /
  // entry.filled_at always wins when present).
  const fallbackAsOf = summaryData.generatedAt || record.generated_at;
  const bookAsOf = { quotes: record.oldest_quote_ts || fallbackAsOf, entry: fallbackAsOf };

  return {
    empty: null,
    howto: <HowToReadThisPage />,
    headline: <Headline text={headlineText} staleLabel={staleLabel} />,
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
        lines={findSection(sections, "Positions — entry snapshot (frozen) vs now (live)").lines}
        positions={record.positions}
        fallbackAsOf={fallbackAsOf}
      />
    ),
    // Both cards are prose the 2h refresh cron re-derives wholesale, so each
    // carries that job's run time — `fallbackAsOf` is exactly the summary's
    // own generated_at (see above), not a per-position quote clock.
    whatWeThink: <WhatWeThink lines={findSection(sections, "What we think right now").lines} updatedAt={fallbackAsOf} />,
    actionQueue: <ActionQueue lines={findSection(sections, "Action queue").lines} updatedAt={fallbackAsOf} />,
    openQueue: (
      <OpenQueue lines={findSection(sections, "Open queue").lines} totals={record.totals} account={record.account} />
    ),
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
        {parts.openQueue}
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
  parseSpreadLabel, positionMatchesLabel, eventMatchesPosition, tradeKeyForPosition,
  ageLabel, isStaleAsOf, STALE_AFTER_MS, REFRESH_INTERVAL_HOURS, REFRESH_INTERVAL_MINUTES,
};

window.OptionsSummaryPanel = OptionsSummaryPanel;
// Per-card access for the page that owns the Options Log layout.
window.optionsSummaryParts = optionsSummaryParts;
