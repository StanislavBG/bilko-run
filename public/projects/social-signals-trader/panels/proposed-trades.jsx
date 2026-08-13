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

function ProposalStat({ label, value, term }) {
  return (
    <div className="prop-stat">
      <span className="prop-stat-label">
        {label}
        {term && window.Help && <window.Help term={term} />}
      </span>
      <span className="prop-stat-value">{value}</span>
    </div>
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

function ProposalCard({ item }) {
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

      <div className="prop-stats">
        <ProposalStat label="We get paid" value={propMoney(item.credit)} term="credit_received" />
        <ProposalStat label="Most we can lose" value={propMoney(item.risk)} term="risk" />
        <ProposalStat label="Chance we're right" value={propPct(item.pop)} term="pop" />
        <ProposalStat label="Expected value" value={propMoney(item.ev)} term="ev" />
        <ProposalStat label="Contracts" value={item.contracts} term="contracts" />
        <ProposalStat label="Expires" value={`${item.expiry} (${item.dte}d)`} term="dte" />
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
function DeploymentLine({ deployment }) {
  const d = deployment || {};
  if (d.deployed === undefined && d.headroom === undefined) return null;
  return (
    <div className="prop-deployment">
      <span>
        Deployed {propMoney(d.deployed)} of target {propMoney(d.target)} (
        {propPct(d.deployed_pct)} of equity) — headroom {propMoney(d.headroom)}
      </span>
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

function ProposedTrades() {
  const plan = proposalPlan();
  const items = plan.intent;
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

      <DeploymentLine deployment={plan.deployment} />

      {items.length ? (
        items.map((item, i) => <ProposalCard key={item.id || i} item={item} />)
      ) : (
        <EmptyState funnel={plan.funnel} />
      )}
    </section>
  );
}

window.ProposedTrades = ProposedTrades;
window.ProposedTradesInternals = {
  PROPOSAL_ID_PREFIX,
  proposalPlan,
  proposalFeedbackTarget,
  propMoney,
  propPct,
};
