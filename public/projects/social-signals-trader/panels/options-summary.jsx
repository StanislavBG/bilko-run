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

// Every section below is the same card/head/title shell around a different
// body — one wrapper instead of seven copies of the same markup.
function Section({ title, children }) {
  return (
    <section className="card opt-panel">
      <div className="opt-panel-head">
        <h3 className="opt-panel-title">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function Headline({ text, staleLabel }) {
  return (
    <div className="opts-headline">
      <div className="opts-headline-text">{colorizeSigned(text)}</div>
      {staleLabel && <div className="opts-stale-banner">⚠ STALE — refreshed {staleLabel}, expected every {REFRESH_INTERVAL_HOURS}h</div>}
    </div>
  );
}

function WhereBookStands({ lines }) {
  return (
    <Section title="Where the book stands">
      <BulletList items={bulletsOf(lines)} />
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

function PositionsTable({ lines, positions }) {
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
  const posList = positions || [];
  return (
    <div className="opt-table-scroll">
      <table className="opt-table opt-table--orders opts-positions-table">
        <thead>
          <tr>
            {header.map((h, i) => (
              <th key={i} className={colClass(i)}>
                {h}
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

function PositionsSection({ lines, positions }) {
  return (
    <Section title="Positions — entry snapshot (frozen) vs now (live)">
      <PositionsTable lines={lines} positions={positions} />
    </Section>
  );
}

function WhatWeThink({ lines }) {
  const items = bulletsOf(lines);
  return (
    <Section title="What we think right now">
      {items.length ? (
        <BulletList items={items} render={renderInlineMd} className="opts-bullets opts-what-we-think" />
      ) : (
        <p className="opt-log-empty">{plainLinesOf(lines)[0] || "No open options positions — nothing to assess."}</p>
      )}
    </Section>
  );
}

const ACTION_SEVERITY = { "🔴": "breached", "🟠": "danger", "⚠": "watch", "✅": "safe" };

function ActionQueue({ lines }) {
  const items = bulletsOf(lines);
  return (
    <Section title="Action queue">
      {!items.length || items[0] === "Nothing needs attention right now." ? (
        <p className="opt-log-empty">Nothing needs attention right now.</p>
      ) : (
        <ul className="opts-bullets opts-action-queue">
          {items.map((t, i) => {
            const sev = ACTION_SEVERITY[t.slice(0, 2).trim()] || ACTION_SEVERITY[t[0]] || "neutral";
            return (
              <li key={i} className={`opts-action opts-action--${sev}`}>
                {renderInlineMd(t)}
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}

function OpenQueue({ lines }) {
  const bullets = bulletsOf(lines);
  const table = tableOf(lines);
  const plain = plainLinesOf(lines);
  return (
    <Section title="Open queue">
      {bullets.length ? <BulletList items={bullets} /> : <Paragraphs items={plain} />}
      {table && (
        <div className="opt-table-scroll" style={{ marginTop: 10 }}>
          <table className="opt-table opt-table--orders">
            <thead>
              <tr>
                {table.header.map((h, i) => (
                  <th key={i} className={i === 0 ? "al" : undefined}>
                    {h}
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

function RulesInForce({ lines }) {
  const items = bulletsOf(lines).map((l) => {
    const m = /^`([^`]+)`:\s*(.*)$/.exec(l);
    return m ? { key: m[1], value: m[2] } : { key: l, value: "" };
  });
  return (
    <Section title="Rules in force">
      <div className="opt-kv">
        {items.map((it, i) => (
          <div className="opt-kv-item" key={i}>
            <span className="opt-kv-k">{it.key}</span>
            <span className="opt-kv-v">{it.value}</span>
          </div>
        ))}
      </div>
    </Section>
  );
}

function Provenance({ lines }) {
  return (
    <Section title="Provenance">
      <BulletList items={bulletsOf(lines)} className="opts-bullets mono-dim" />
    </Section>
  );
}

function EmptyState() {
  return (
    <section className="card opt-log">
      <h3 className="opt-log-title">Options book summary</h3>
      <p className="opt-log-empty">
        No summary yet — the <code>options-status-refresh-summary</code> job hasn't run for the first
        time. It's scheduled every {REFRESH_INTERVAL_HOURS}h.
      </p>
    </section>
  );
}

function OptionsSummaryPanel({ data }) {
  const summaryData = data || window.OPTIONS_SUMMARY;
  const summaryText = summaryData && summaryData.summary;
  // Hooks must run unconditionally, so this memo sits ahead of the
  // empty-state guard below even though its result is unused in that case.
  const sections = useMemo(() => parseSections(summaryText), [summaryText]);
  if (!summaryData || !summaryData.record || !summaryData.summary) {
    return <EmptyState />;
  }

  const headlineText = (sections[0].lines.find((l) => l.trim()) || "").trim();
  const staleLabel = (() => {
    const t = new Date(summaryData.generatedAt).getTime();
    if (Number.isNaN(t)) return null;
    return Date.now() - t > STALE_AFTER_MS ? ageLabel(summaryData.generatedAt) : null;
  })();

  return (
    <div className="opt-log opt-log--stacked opts-summary">
      <div className="opt-log-stack">
        <Headline text={headlineText} staleLabel={staleLabel} />
        <WhereBookStands lines={findSection(sections, "Where the book stands").lines} />
        <PositionsSection
          lines={findSection(sections, "Positions — entry snapshot (frozen) vs now (live)").lines}
          positions={summaryData.record.positions}
        />
        <WhatWeThink lines={findSection(sections, "What we think right now").lines} />
        <ActionQueue lines={findSection(sections, "Action queue").lines} />
        <OpenQueue lines={findSection(sections, "Open queue").lines} />
        <RulesInForce lines={findSection(sections, "Rules in force").lines} />
        <Provenance lines={findSection(sections, "Provenance").lines} />
      </div>
    </div>
  );
}

window.OptionsSummaryPanel = OptionsSummaryPanel;
