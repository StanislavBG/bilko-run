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

const PROPOSAL_ID_PREFIX = "proposal-";

function proposalPlan() {
  const p = window.SPREAD_PLAN;
  if (!p || typeof p !== "object") return { generatedAt: null, deployment: {}, intent: [] };
  return {
    generatedAt: p.generatedAt || null,
    deployment: p.deployment || {},
    funnel: p.funnel || null,
    intent: Array.isArray(p.intent) ? p.intent : [],
  };
}

function proposalFeedbackTarget(item) {
  return {
    kind: "component",
    id: PROPOSAL_ID_PREFIX + (item.id || "unknown"),
    label: item.label || `Proposed trade — ${item.ticker || "?"}`,
  };
}

// Plan timestamps are UTC ISO; every time on this site reads in Pacific.
function whenPlanned(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
    timeZone: "America/Los_Angeles", timeZoneName: "short",
  });
}

function propMoney(n, decimals) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "—";
  return `$${Number(n).toLocaleString("en-US", {
    minimumFractionDigits: decimals || 0,
    maximumFractionDigits: decimals || 0,
  })}`;
}

function propPct(n, decimals) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "—";
  return `${(Number(n) * 100).toFixed(decimals === undefined ? 0 : decimals)}%`;
}

// A proposal is missing its card when data-spread-plan.js predates the
// proposal-card export. Say so loudly rather than rendering an empty shell —
// same rule the Positions table follows for a missing identity field.
function MissingCard({ item }) {
  return (
    <p className="prop-error">
      This proposal has no explanation attached (no <code>explain</code> block on{" "}
      {item.ticker || "the intent row"}) — data-spread-plan.js was written by an older
      spread_trader. Re-run <code>spread_trader --preopen</code> to regenerate it.
    </p>
  );
}

function ProposalChecks({ checks }) {
  if (!Array.isArray(checks) || !checks.length) return null;
  return (
    <div className="prop-block">
      <h5 className="prop-block-title">Why it got through the gates</h5>
      <table className="opt-table prop-checks">
        <thead>
          <tr>
            <th className="al">Check</th>
            <th className="al">This trade</th>
            <th className="al">The rule</th>
            <th className="al">Why the rule exists</th>
          </tr>
        </thead>
        <tbody>
          {checks.map((c, i) => (
            <tr key={i} className={c.pass ? undefined : "prop-check-fail"}>
              <td className="al">
                <span className={`prop-tick prop-tick--${c.pass ? "pass" : "fail"}`}>
                  {c.pass ? "✓" : "✕"}
                </span>
                {c.label}
              </td>
              <td className="al prop-mono">{c.observed}</td>
              <td className="al prop-mono">{c.rule}</td>
              <td className="al prop-why">{c.why}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Today's rules, carried on the proposal itself rather than read live from
// SPREAD_CONFIG: a proposal reviewed tomorrow must show the policy it was
// generated under. The full per-leg breakdown stays in the "CREDIT_SPREAD —
// fund policy" card at the bottom of the page; this is that policy's
// decision-relevant subset, restated in plain words.
function ProposalRules({ rules }) {
  const [open, setOpen] = React.useState(false);
  if (!Array.isArray(rules) || !rules.length) return null;
  return (
    <div className="prop-block">
      <h5 className="prop-block-title">
        Today&rsquo;s trading rules
        <button className="prop-toggle" onClick={() => setOpen(!open)}>
          {open ? "hide" : "show all"}
        </button>
      </h5>
      <ul className="prop-rules">
        {(open ? rules : rules.filter((r) => String(r.plain).startsWith("EXIT"))).map((r, i) => (
          <li key={i}>
            <span className="prop-rule-plain">{r.plain}</span>
            <span className="prop-rule-field">
              {r.field} = <b>{r.value}</b>
            </span>
          </li>
        ))}
      </ul>
      {!open && (
        <p className="prop-rules-note">
          Showing the three exit rules — the ones that decide when this trade ends. &ldquo;Show
          all&rdquo; adds the entry rules that let it in.
        </p>
      )}
    </div>
  );
}

// The broker reserves the FULL strike width, not the width net of the credit.
// `risk` is what we can lose; this is what is locked up until the trade closes
// — the two differ by exactly the credit, and sizing runs off this number, so
// showing only `risk` understates the capital a proposal consumes. The share
// of equity is appended when the plan carries it, because "$2,000" means
// nothing without "of what".
function collateralLabel(item, equity) {
  if (item.collateral === null || item.collateral === undefined) return "—";
  const base = propMoney(item.collateral);
  const eq = Number(equity);
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
function ScoreRow({ label, value, term, tone, big }) {
  return (
    <div className={`prop-score-row${big ? " prop-score-row--big" : ""}`}>
      <span className="prop-score-label">
        {label}
        {term && window.Help && <window.Help term={term} />}
      </span>
      <span className={`prop-score-value${tone ? ` prop-score-value--${tone}` : ""}`}>{value}</span>
    </div>
  );
}

// A proposal only reaches this panel by clearing every gate, so the badge
// normally reads "8 of 8". It is computed, not assumed: a hand-edited plan or
// a future soft gate must show the real count rather than a green lie.
function gateTally(checks) {
  const list = Array.isArray(checks) ? checks : [];
  return { passed: list.filter((c) => c && c.pass).length, total: list.length };
}

function momentumChip(item) {
  if (item.rsi === null || item.rsi === undefined) return null;
  const isPut = String(item.right || "").toLowerCase() === "put";
  return `${isPut ? "Oversold" : "Overbought"} · RSI ${item.rsi} · %K ${item.stoch_k}`;
}

function ProposalScorecard({ item, equity }) {
  const tally = gateTally(item.checks);
  const clean = tally.total > 0 && tally.passed === tally.total;
  const chip = momentumChip(item);
  const pop = Number(item.pop);
  return (
    <aside className="prop-scorecard">
      <div className="prop-score-head">
        <span className="prop-score-title">Scorecard</span>
        <span className={`prop-score-gates prop-score-gates--${clean ? "pass" : "fail"}`}>
          {clean ? "✓" : "✕"} {tally.passed} of {tally.total} gates
        </span>
      </div>

      <ScoreRow label="We get paid" value={propMoney(item.credit)} term="credit_received" tone="pos" big />
      <ScoreRow label="Most we can lose" value={propMoney(item.risk)} term="risk" tone="neg" big />
      <ScoreRow label="Cash tied up (collateral)" value={collateralLabel(item, equity)} term="collateral" />
      <ScoreRow label="Expected value" value={propMoney(item.ev)} term="ev" tone={Number(item.ev) > 0 ? "pos" : "neg"} />

      <ScoreRow label="Chance we're right" value={propPct(item.pop)} term="pop" />
      {Number.isFinite(pop) && (
        <div className="prop-meter" title={`${(pop * 100).toFixed(1)}% probability of profit`}>
          <span className="prop-meter-fill" style={{ width: `${Math.max(0, Math.min(100, pop * 100))}%` }} />
        </div>
      )}

      <ScoreRow label="Contracts" value={item.contracts} term="contracts" />
      <ScoreRow label="Expires" value={`${item.expiry} (${item.dte}d)`} term="dte" />
      {chip && <div className="prop-score-chip">{chip}</div>}
    </aside>
  );
}

function ProposalCard({ item, equity }) {
  const explain = item.explain;
  const target = proposalFeedbackTarget(item);
  return (
    <article className="prop-card" id={`proposal-${item.id || ""}`}>
      <header className="prop-card-head">
        <h4 className="prop-card-title">{item.label || item.ticker}</h4>
        <div className="prop-card-head-right">
          <span className="prop-badge">PROPOSED · not yet placed</span>
          {window.FeedbackButton && <window.FeedbackButton target={target} />}
        </div>
      </header>

      {/* Narrative left, scorecard right — the right half of the card used to
          be dead space while the numbers were crammed into a strip below. */}
      <div className="prop-card-body">
        <div className="prop-narrative">
          {explain ? (
            <>
              <p className="prop-headline">{explain.headline}</p>
              <ul className="prop-bullets">
                {(explain.bullets || []).map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
              <p className="prop-structure">
                <b>What we actually place:</b> {explain.structure}
              </p>
            </>
          ) : (
            <MissingCard item={item} />
          )}
        </div>
        <ProposalScorecard item={item} equity={equity} />
      </div>

      <ProposalChecks checks={item.checks} />
      <ProposalRules rules={item.rules} />

      {window.ProposalDiscussion && (
        <window.ProposalDiscussion proposalId={target.id} label={target.label} />
      )}
    </article>
  );
}

// The deployment gap used to live in the "Open queue" card. It moves here with
// the proposals it explains: how much room the book has is the reason there
// are (or aren't) proposals on screen at all.
function DeploymentLine({ deployment, totalCollateral }) {
  const d = deployment || {};
  if (d.deployed === undefined && d.headroom === undefined && !totalCollateral) return null;
  return (
    <div className="prop-deployment">
      <span>
        Deployed {propMoney(d.deployed)} of target {propMoney(d.target)} (
        {propPct(d.deployed_pct)} of equity) — headroom {propMoney(d.headroom)}
      </span>
      {totalCollateral > 0 && (
        <span>
          These proposals would together tie up {propMoney(totalCollateral)} of collateral
          {d.equity ? ` (${propPct(totalCollateral / d.equity, 1)} of equity)` : ""} — that cash is
          reserved by the broker until each trade closes, and it is returned in full when they do.
        </span>
      )}
      {d.margin_breach && (
        <span className="prop-margin-breach">
          🔴 MARGIN BREACH — maintenance margin {propMoney(d.maintenance_margin)} exceeds cap{" "}
          {propMoney(d.margin_cap)}. New entries are refused until it clears, so nothing below can
          fill.
        </span>
      )}
    </div>
  );
}

// "Nothing to review" is only believable with the count of what was looked
// at. Without the funnel, a barren option chain and a broken scanner render
// identically — which is what an empty panel meant before this.
function EmptyState({ funnel }) {
  if (!funnel) {
    return (
      <p className="opt-log-empty">
        No proposals right now. Either no candidate cleared the entry gates, or the book is
        already at its deployment target — the line above says which.
      </p>
    );
  }
  const rows = [
    ["Names scanned", funnel.tickers],
    ["Spreads the chain priced", funnel.priced],
    ["Cleared width / liquidity / expiry screen", funnel.selected],
    ["Dropped — expected value or credit too small", funnel.rejected_ev_or_credit],
    ["Dropped — win probability outside the band", funnel.rejected_pop_band],
    [
      funnel.momentum_gate
        ? "Dropped — wrong side for the stock's momentum"
        : "Momentum gate OFF this run",
      funnel.momentum_gate ? funnel.rejected_momentum : "—",
    ],
    ["Proposed", funnel.passed],
  ];
  return (
    <div className="prop-empty">
      <p className="opt-log-empty">
        No proposals right now — and that is a measurement, not a blank screen. Here is the whole
        funnel behind it:
      </p>
      <ul className="prop-funnel">
        {rows.map(([label, value], i) => (
          <li key={i}>
            <span>{label}</span>
            <b>{value === undefined || value === null ? "—" : value}</b>
          </li>
        ))}
      </ul>
      {funnel.chain_errors > 0 && (
        <p className="prop-funnel-note">
          ⚠ {funnel.chain_errors} name{funnel.chain_errors === 1 ? "" : "s"} could not be priced at
          all (chain error) — those were never evaluated.
        </p>
      )}
    </div>
  );
}

// One proposal at a time, with a pager. Reviewing is a per-trade decision —
// stacking seven full cards buries the later ones and makes "how many are
// there, and which am I on?" unanswerable without scrolling. The dot rail is
// the position indicator: ‹ o o ● o o ›, one dot per proposal, the filled one
// is the open card. A dot for a proposal carrying an unanswered comment gets a
// ring, so an unread objection is visible from any card, not only from its own.
function unansweredCountFor(item) {
  const internals = window.FeedbackThreadsInternals;
  const payload = window.FEEDBACK_THREADS;
  if (!internals || !internals.proposalThreads || !payload || !Array.isArray(payload.threads)) {
    return 0;
  }
  const threads = internals.proposalThreads(payload.threads, PROPOSAL_ID_PREFIX + (item.id || ""));
  return threads.filter((t) => !t.answered).length;
}

function ProposalPager({ items, index, onGo }) {
  if (items.length < 2) return null;
  const wrap = (i) => (i + items.length) % items.length;
  return (
    <nav className="prop-pager" aria-label="Proposed trade navigation">
      <button
        className="prop-pager-arrow"
        onClick={() => onGo(wrap(index - 1))}
        aria-label="Previous proposal"
        title="Previous proposal (←)"
      >
        ‹
      </button>
      <div className="prop-dots">
        {items.map((it, i) => {
          const open = unansweredCountFor(it);
          const label = `${it.ticker || "proposal"} — ${i + 1} of ${items.length}` +
            (open ? ` (${open} unanswered comment${open === 1 ? "" : "s"})` : "");
          return (
            <button
              key={it.id || i}
              className={
                `prop-dot${i === index ? " prop-dot--on" : ""}${open ? " prop-dot--flagged" : ""}`
              }
              onClick={() => onGo(i)}
              aria-label={label}
              aria-current={i === index ? "true" : undefined}
              title={label}
            />
          );
        })}
      </div>
      <button
        className="prop-pager-arrow"
        onClick={() => onGo(wrap(index + 1))}
        aria-label="Next proposal"
        title="Next proposal (→)"
      >
        ›
      </button>
      <span className="prop-pager-count">
        {index + 1} of {items.length}
        {items[index] && items[index].ticker ? ` · ${items[index].ticker}` : ""}
      </span>
    </nav>
  );
}

function ProposedTrades() {
  const plan = proposalPlan();
  const items = plan.intent;
  const [index, setIndex] = React.useState(0);
  // A regenerated plan can be shorter than the one that was on screen; clamp
  // rather than render a blank card off the end of the list.
  const safeIndex = items.length ? Math.min(index, items.length - 1) : 0;
  const active = items[safeIndex];

  const onKeyDown = (e) => {
    if (items.length < 2) return;
    if (e.key === "ArrowLeft") { setIndex((safeIndex - 1 + items.length) % items.length); e.preventDefault(); }
    if (e.key === "ArrowRight") { setIndex((safeIndex + 1) % items.length); e.preventDefault(); }
  };

  return (
    <section className="card opt-panel prop-panel" id="proposed-trades">
      <div className="opt-panel-head">
        <h3 className="opt-panel-title">
          Proposed trades
          {window.Help && <window.Help term="proposed_trade" />}
          {window.FeedbackButton && (
            <window.FeedbackButton
              target={{ kind: "component", id: "proposed-trades", label: "Proposed trades" }}
            />
          )}
        </h3>
        <div className="opt-panel-stats">
          <span className="fbt-count">
            {items.length} proposal{items.length === 1 ? "" : "s"}
          </span>
          {plan.generatedAt && (
            <span className="fbt-count" title={plan.generatedAt}>
              planned {whenPlanned(plan.generatedAt)}
            </span>
          )}
        </div>
      </div>

      <p className="opts-page-sub prop-lede">
        Nothing here has been placed. These are the trades the fund intends to open on the next
        tick, each explained from scratch, with the rules it had to clear. Disagree with one? Use
        its 💬 button — the comment thread under a proposal is how you tell the fund what to do
        with it, and it is read before anything fills.
      </p>

      <DeploymentLine
        deployment={plan.deployment}
        totalCollateral={items.reduce((sum, it) => sum + (Number(it.collateral) || 0), 0)}
      />

      {items.length ? (
        <div className="prop-deck" tabIndex={0} onKeyDown={onKeyDown} aria-live="polite">
          <ProposalPager items={items} index={safeIndex} onGo={setIndex} />
          <ProposalCard
            key={active.id || safeIndex}
            item={active}
            equity={plan.deployment && plan.deployment.equity}
          />
          <ProposalPager items={items} index={safeIndex} onGo={setIndex} />
        </div>
      ) : (
        <EmptyState funnel={plan.funnel} />
      )}
    </section>
  );
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
  propPct,
};
