/* global React */
// Stand-alone, full-width page for one Options Trade Log entry — a narrative
// explanation of a single spread trade, not a jargon dump. Answers three
// questions in plain English before showing any raw numbers: what did we do,
// what had to happen to win, and what actually happened. All math/parsing is
// reused from window.SpreadFormat + window.OptionsTradeLogInternals — this
// file only turns those facts into sentences and layout.

const { useState, useEffect } = React;
const { money, pctv, num, parseOccSymbol, plainEnglishLeg } = window.SpreadFormat;
const Help = window.Help;

// #trade/<key> is the only shape this page reads — the key itself is opaque
// (see tradeKey in options-trade-log.jsx), so this just decodes the segment
// after the slash.
function tradeKeyFromUrl() {
  const fromHash = (location.hash || "").replace("#", "").split("/")[1];
  return fromHash ? decodeURIComponent(fromHash) : "";
}

// Called right after `location.hash = "options"` — the Options Log page
// mounts asynchronously (React re-render off the hashchange event), so this
// retries a few times rather than assuming the element exists on the next tick.
function scrollToTradeLog(attempts) {
  const el = document.getElementById("options-trade-log");
  if (el) {
    el.scrollIntoView({ behavior: "auto", block: "start" });
    return;
  }
  if (attempts > 0) setTimeout(() => scrollToTradeLog(attempts - 1), 30);
}

function BackToTradeLog() {
  const goBack = () => {
    location.hash = "options";
    scrollToTradeLog(10);
  };
  return (
    <button
      onClick={goBack}
      className="optd-back"
      style={{
        background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: 6,
        padding: "7px 14px", color: "var(--text)", fontSize: 12, fontWeight: 600, cursor: "pointer",
      }}
    >
      ← Back to trade log
    </button>
  );
}

// Same target shape/id as the row this page was opened from (options-trade-log.jsx's
// tradeKey), so a visitor's feedback from the row and from the detail page join to
// the same trade regardless of which surface they used.
function TradeDetailFeedbackButton({ ev, facts, tradeKeyValue }) {
  if (!window.FeedbackButton || !tradeKeyValue) return null;
  const structureName = facts.structure ? facts.structure.name : "credit spread";
  const target = { kind: "trade", id: tradeKeyValue, label: `${ev.ticker || "this ticker"} ${structureName}` };
  return <window.FeedbackButton target={target} />;
}

// Which feedback targets this page owns: the trade key itself, plus — while
// the trade is still open — the id the Options Log's Positions table files
// position feedback under. Both are REUSED from their one definition
// (tradeKey via the URL, positionFeedbackTarget from OptionsSummaryInternals),
// never re-derived here, so a question asked from the positions table and one
// asked from this page land in the same discussion.
function feedbackTargets(tradeKeyValue, pos) {
  const targets = [];
  if (tradeKeyValue) targets.push({ kind: "trade", id: tradeKeyValue });
  const summaryInternals = window.OptionsSummaryInternals;
  const posTarget = pos && summaryInternals && summaryInternals.positionFeedbackTarget
    ? summaryInternals.positionFeedbackTarget(pos)
    : null;
  if (posTarget) targets.push({ kind: "position", id: posTarget.id });
  return targets;
}

const BADGE_CLASS = { filled: "fill-filled", terminal: "terminal", partial: "fill-partial", unfilled: "fill-unfilled" };

// --- plain-English helpers -------------------------------------------------

// "2026-08-10" or an ISO timestamp -> "10 Aug". Display-only; never fed back
// into any calculation, so this stays local rather than living in SpreadFormat.
function shortDate(isoLike) {
  if (!isoLike) return null;
  const d = new Date(String(isoLike).slice(0, 10) + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

// "short_strike_breached" -> "Short strike breached"; leaves already-readable
// sentences (the common case today) untouched.
function reasonPhrase(reason) {
  if (!reason) return null;
  const cleaned = String(reason).replace(/_/g, " ");
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
  const { structure, shortParsed, classification } = facts;
  const ticker = ev.ticker || "this ticker";
  const dateStr = shortDate(ev.ts) || "an earlier date";

  if (!structure) {
    return `On ${dateStr} we opened an options trade on ${ticker}.`;
  }

  const name = structure.name.charAt(0).toLowerCase() + structure.name.slice(1);
  const expiryStr = shortDate(expiryOf(ev, facts));
  // Composed from the parsed fields directly, not by string-surgering
  // structure.gloss's pre-baked sentence — a wording/date-format change in
  // spreadStructure() would otherwise silently break this substitution.
  let conditionClause = null;
  if (structure.gloss && shortParsed) {
    const verbPhrase = profitDirection(shortParsed) === "below" ? "stays below" : "stays above";
    conditionClause = `as long as ${ticker} ${verbPhrase} $${shortParsed.strike}${expiryStr ? ` through ${expiryStr}` : ""}`;
  }

  const creditVal = ev.credit ?? ev.entry_credit;
  const creditStr = creditVal != null ? money(creditVal) : null;
  const unfilled = classification.bucket !== "trade";

  let sentence = `On ${dateStr} we sold a ${name} on ${ticker}.`;
  if (creditStr) {
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
  const { isClose, pnl, classification } = facts;
  if (classification.bucket !== "trade") {
    return { tone: "neutral", text: `Not filled — ${classification.label}. No money has changed hands.` };
  }
  if (isClose) {
    if (pnl == null) return { tone: "neutral", text: "Closed — result not yet reported." };
    const expiry = expiryOf(ev, facts);
    const closeDate = ev.ts ? new Date(ev.ts) : null;
    const expiryDate = expiry ? new Date(expiry + "T00:00:00Z") : null;
    const early = closeDate && expiryDate && !Number.isNaN(closeDate.getTime()) && !Number.isNaN(expiryDate.getTime()) && closeDate < expiryDate;
    const verb = pnl >= 0 ? "gain" : "loss";
    return { tone: pnl >= 0 ? "pos" : "neg", text: `Closed ${early ? "early " : ""}for a ${money(Math.abs(pnl))} ${verb}.` };
  }
  return { tone: "neutral", text: "Still open — the result isn't decided yet." };
}

function breakevenCaption(facts) {
  if (facts.isNetDebit) return "This spread filled at a net debit — it cannot win at any price, so there is no breakeven.";
  if (facts.be == null || !facts.shortParsed) return "Not enough data to compute a breakeven.";
  const dir = profitDirection(facts.shortParsed) === "below" ? "above" : "below";
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
  const summary = window.OPTIONS_SUMMARY;
  const internals = window.OptionsSummaryInternals;
  const positions = summary && summary.record && summary.record.positions;
  if (!Array.isArray(positions) || !positions.length || !internals) return null;
  const longParsed = ev.long ? parseOccSymbol(ev.long) : null;
  const candidates = positions.filter((pos) => {
    if (!internals.eventMatchesPosition(pos, ev)) return false;
    if (longParsed && pos.long_strike != null && Number(pos.long_strike) !== Number(longParsed.strike)) return false;
    return true;
  });
  return candidates.length === 1 ? candidates[0] : null;
}

// Header price element: the live spot from the matched position when one
// exists, else the frozen entry spot labelled as such, else nothing — never
// a `$null`/`$NaN` and never a stale live price passed off as current.
function CurrentPrice({ ev, facts, pos }) {
  const internals = window.OptionsSummaryInternals;
  const livePrice = pos ? num(pos.now && pos.now.spot) : null;
  if (livePrice == null) {
    const entrySpot = num(ev.spot_at_entry);
    return entrySpot != null ? <span className="optd-price mono-dim">Spot at entry {money(entrySpot)}</span> : null;
  }
  const summary = window.OPTIONS_SUMMARY;
  const asOfIso = pos.oldest_quote_ts || (summary && summary.generatedAt);
  const ageStr = internals && asOfIso ? internals.ageLabel(asOfIso) : null;
  const stale = !!(internals && asOfIso && internals.isStaleAsOf(asOfIso, summary && summary.schedule));
  return (
    <span className="optd-price">
      {money(livePrice)}
      <Help term="spot" inputs={{ spot: livePrice }} asOf={{ quotes: asOfIso }} />
      {ageStr && (
        <span className={stale ? "opts-stale-banner optd-price-asof" : "optd-price-asof mono-dim"}>
          {stale ? "⚠ stale — " : "as of "}{ageStr}
        </span>
      )}
    </span>
  );
}

// --- "What we did" ----------------------------------------------------------

function LegRow({ ev, symbol, isClose, roleText }) {
  const dir = window.OptionsTradeLogInternals.legDirection(ev, symbol, isClose);
  if (!symbol) {
    return <li><p className="optd-leg-sentence">Leg details aren&rsquo;t available for this record.</p></li>;
  }
  const parsed = parseOccSymbol(symbol);
  let sentence;
  if (!parsed) {
    sentence = `${dir || "Traded"} ${plainEnglishLeg(symbol)} — ${roleText}`;
  } else {
    const verb = dir && dir.indexOf("BUY") === 0 ? "Bought" : dir && dir.indexOf("SELL") === 0 ? "Sold" : "Traded";
    const contracts = ev.contracts != null ? ev.contracts : null;
    const qtyPhrase = contracts != null ? `${contracts} contracts of the` : "the";
    const expiryStr = shortDate(parsed.expiry);
    sentence = `${verb} ${qtyPhrase} ${parsed.root} $${parsed.strike} ${parsed.right.toLowerCase()}`
      + `${expiryStr ? ` expiring ${expiryStr}` : ""} — ${roleText}`;
  }
  return (
    <li>
      <p className="optd-leg-sentence">{sentence}</p>
      <div className="mono-dim optd-occ">{symbol}</div>
    </li>
  );
}

// Both legs' roles are fixed for a credit spread (short = premium, long =
// insurance) but the sentence has to match the direction actually traded:
// "collects the premium" is only true while the position is open — on a
// close we're buying that leg back, not collecting anything.
function WhatWeDid({ ev, facts }) {
  const hasLegs = !!(ev.short || ev.long);
  const shortRole = facts.isClose
    ? "the leg that had been collecting the premium, now bought back to close"
    : "this is the leg that collects the premium";
  const longRole = facts.isClose
    ? "the insurance leg, now sold since the position is closing"
    : "the insurance leg that caps our loss";
  return (
    <section className="card opt-panel optd-section">
      <h2 className="optd-h2">What we did</h2>
      <p className="optd-explainer">
        A credit spread sells one option to collect cash up front, then buys a further-out option
        purely as insurance so the most we can lose is capped.
      </p>
      {hasLegs ? (
        <ul className="optd-leg-list">
          <LegRow ev={ev} symbol={ev.short} isClose={facts.isClose} roleText={shortRole} />
          <LegRow ev={ev} symbol={ev.long} isClose={facts.isClose} roleText={longRole} />
        </ul>
      ) : (
        <p className="opt-legs-empty">this record predates leg snapshots</p>
      )}
    </section>
  );
}

// --- "What had to happen for this to win" -----------------------------------

function payoffAnchors(facts, ev, livePrice) {
  const short = facts.shortParsed;
  if (!short || facts.be == null) return null;
  const long = facts.longParsed;
  const spot = num(ev.spot_at_entry);
  const values = [short.strike, facts.be];
  if (long) values.push(long.strike);
  if (spot != null) values.push(spot);
  if (livePrice != null) values.push(livePrice);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  if (!(hi > lo)) return null;
  const pad = (hi - lo) * 0.2;
  const min = lo - pad;
  const max = hi + pad;
  const pct = (v) => ((v - min) / (max - min)) * 100;
  return {
    shortPct: pct(short.strike),
    longPct: long ? pct(long.strike) : null,
    bePct: pct(facts.be),
    spotPct: spot != null ? pct(spot) : null,
    nowPct: livePrice != null ? pct(livePrice) : null,
    profitSide: profitDirection(short) === "below" ? "left" : "right",
  };
}

function PayoffStrip({ facts, ev, livePrice }) {
  const a = payoffAnchors(facts, ev, livePrice);
  if (!a) {
    return <p className="optd-payoff-empty">Not enough data to draw the payoff strip.</p>;
  }
  const profitLeft = a.profitSide === "left";
  return (
    <div className="optd-payoff">
      <div className="optd-payoff-track">
        <div
          className="optd-payoff-zone optd-payoff-zone--profit"
          style={{ left: profitLeft ? "0%" : `${a.bePct}%`, width: `${profitLeft ? a.bePct : 100 - a.bePct}%` }}
        />
        <div
          className="optd-payoff-zone optd-payoff-zone--loss"
          style={{ left: profitLeft ? `${a.bePct}%` : "0%", width: `${profitLeft ? 100 - a.bePct : a.bePct}%` }}
        />
        <div className="optd-payoff-marker" style={{ left: `${a.shortPct}%` }} title={`Short strike $${facts.shortParsed.strike}`}>
          <span className="optd-payoff-dot" />
          <span className="optd-payoff-tag">${facts.shortParsed.strike}</span>
        </div>
        {a.longPct != null && (
          <div className="optd-payoff-marker" style={{ left: `${a.longPct}%` }} title={`Long strike $${facts.longParsed.strike}`}>
            <span className="optd-payoff-dot" />
            <span className="optd-payoff-tag">${facts.longParsed.strike}</span>
          </div>
        )}
        <div className="optd-payoff-marker optd-payoff-marker--be" style={{ left: `${a.bePct}%` }} title={`Breakeven ${money(facts.be)}`}>
          <span className="optd-payoff-dot" />
          <span className="optd-payoff-tag">BE {money(facts.be)}</span>
        </div>
        {a.spotPct != null && (
          <div className="optd-payoff-marker optd-payoff-marker--spot" style={{ left: `${a.spotPct}%` }} title={`Spot at entry ${money(ev.spot_at_entry)}`}>
            <span className="optd-payoff-dot" />
            <span className="optd-payoff-tag">Spot at entry {money(ev.spot_at_entry)}</span>
          </div>
        )}
        {a.nowPct != null && (
          <div className="optd-payoff-marker optd-payoff-marker--now" style={{ left: `${a.nowPct}%` }} title={`Stock trading at ${money(livePrice)} now`}>
            <span className="optd-payoff-dot" />
            <span className="optd-payoff-tag">Now {money(livePrice)}</span>
          </div>
        )}
      </div>
      <div className="optd-payoff-legend">
        <span><span className="optd-payoff-swatch optd-payoff-swatch--profit" /> Profit zone</span>
        <span><span className="optd-payoff-swatch optd-payoff-swatch--loss" /> Loss zone</span>
      </div>
      <p className="optd-payoff-caption">
        Green is where the stock can trade and this trade still wins; red is where it starts
        losing money — both relative to where the stock trades today.
      </p>
    </div>
  );
}

// A "credit" spread that filled as a net DEBIT has no max gain — the best
// case at expiry is $0. This swaps the max-gain stat's label/value/caption
// for a net-debit framing instead of printing a negative "max gain".
function maxGainStat(facts) {
  if (!facts.isNetDebit) {
    return {
      label: "Most we can make", value: money(facts.maxGain), sub: "Max gain", tone: "up",
      caption: "The most we can make — the full credit, if the trade finishes on the safe side.",
    };
  }
  return {
    label: "Net debit paid", value: money(Math.abs(facts.maxGain)), sub: "Net debit", tone: "down",
    caption: "This spread filled as a net DEBIT, not a credit — best case at expiry is $0; this is what we already paid.",
  };
}

function WhatHadToHappen({ ev, facts, livePrice }) {
  const calc = tradeCalcProps(ev, facts);
  const mg = maxGainStat(facts);
  return (
    <section className="card opt-panel optd-section">
      <h2 className="optd-h2">What had to happen for this to win</h2>
      <div className="optd-stat-grid">
        <div className="optd-stat">
          <div className="optd-stat-label">
            {mg.label}
            <Help term="max_gain" inputs={calc.max_gain.inputs} asOf={calc.max_gain.asOf} />
          </div>
          <div className={`optd-stat-value ${mg.tone}`}>{mg.value}</div>
          <div className="optd-stat-sub">{mg.sub}</div>
          <div className="optd-stat-caption">{mg.caption}</div>
        </div>
        <div className="optd-stat">
          <div className="optd-stat-label">
            Most we can lose
            <Help term="max_loss" inputs={calc.max_loss.inputs} asOf={calc.max_loss.asOf} />
          </div>
          <div className="optd-stat-value down">{money(facts.maxLoss)}</div>
          <div className="optd-stat-sub">Max loss</div>
          <div className="optd-stat-caption">
            The maximum possible loss if the spread finishes fully in the money at expiry — worst
            case, not what it is showing right now.
          </div>
        </div>
        <div className="optd-stat">
          <div className="optd-stat-label">
            Break-even price
            <Help term="breakeven" inputs={calc.breakeven.inputs} asOf={calc.breakeven.asOf} />
          </div>
          <div className="optd-stat-value">{facts.be != null ? money(facts.be) : (facts.isNetDebit ? "no breakeven — net debit" : "—")}</div>
          <div className="optd-stat-sub">Breakeven</div>
          <div className="optd-stat-caption">{breakevenCaption(facts)}</div>
        </div>
        <div className="optd-stat">
          <div className="optd-stat-label">
            Chance this wins
            <Help term="pop" inputs={calc.pop.inputs} asOf={calc.pop.asOf} />
          </div>
          <div className="optd-stat-value">{pctv(ev.pop)}</div>
          <div className="optd-stat-sub">Win prob (POP)</div>
          <div className="optd-stat-caption">The modeled odds this trade finishes a winner.</div>
        </div>
      </div>
      <PayoffStrip ev={ev} facts={facts} livePrice={livePrice} />
    </section>
  );
}

// --- "What actually happened" ------------------------------------------------

function timelineSteps(ev, facts) {
  const resp = ev.response || {};
  const steps = [];
  if (resp.submitted_at) {
    steps.push({ ts: resp.submitted_at, label: "Order sent to the broker" });
  }
  if (resp.filled_at) {
    const fs = facts.fs;
    const qtyPhrase = fs && fs.state === "PARTIAL"
      ? `${fs.filled} of ${fs.total} contracts`
      : `all ${ev.contracts != null ? ev.contracts : ""} contracts`.trim();
    steps.push({ ts: resp.filled_at, label: `Broker filled ${qtyPhrase}` });
  }
  if (facts.isClose && ev.ts) {
    steps.push({ ts: ev.ts, label: "We closed the position early" });
  }
  return steps.filter((s) => s.ts).sort((a, b) => new Date(a.ts) - new Date(b.ts));
}

// One reasoning row matches this trade when its position key — ticker +
// short_strike + long_strike + expiry, written by
// src/social_signals_trader/position_reasoning.py — equals this trade's own
// key. Same-ticker/different-expiry rows never collide because expiry is
// part of the key. "failed" rows carry no ticker and never match anything.
function _reasoningRowMatches(row, ticker, shortStrike, longStrike, expiry) {
  if (!row || row.kind !== "position_reasoning" || row.status === "failed") return false;
  if (String(row.ticker || "").toUpperCase() !== String(ticker || "").toUpperCase()) return false;
  const close = (a, b) => a != null && b != null && Math.abs(Number(a) - Number(b)) < 0.005;
  return close(row.short_strike, shortStrike) && close(row.long_strike, longStrike) && row.expiry === expiry;
}

// The full reasoning journal for this trade, oldest first — every 2h
// book-review entry logged against this exact position, regardless of
// whether it's still open (a closed position still keeps its history).
function reasoningEntriesFor(ev, facts) {
  const ticker = ev.ticker;
  const shortStrike = facts.shortParsed ? facts.shortParsed.strike : null;
  const longStrike = facts.longParsed ? facts.longParsed.strike : null;
  const expiry = expiryOf(ev, facts);
  if (!ticker || shortStrike == null || longStrike == null || !expiry) return [];
  const rows = window.AGENT_REPORTS || [];
  return rows
    .filter((r) => _reasoningRowMatches(r, ticker, shortStrike, longStrike, expiry))
    .sort((a, b) => new Date(a.ts) - new Date(b.ts));
}

function WhatActuallyHappened({ ev, facts }) {
  const steps = timelineSteps(ev, facts);
  const reasoningEntries = reasoningEntriesFor(ev, facts);
  // Reused as-is from the Methodology page's D5 panel — this page never
  // re-implements how a report row renders, it only supplies the rows.
  const DecisionNarrativeLine = window.DecisionNarrativeLine;
  return (
    <section className="card opt-panel optd-section">
      <h2 className="optd-h2">What actually happened</h2>
      {steps.length ? (
        <ol className="optd-timeline">
          {steps.map((s, i) => (
            <li key={i}>
              <div className="optd-timeline-dot" />
              <div>
                <div className="optd-timeline-label">{s.label}</div>
                <div className="optd-timeline-ts mono-dim">{tsPretty(s.ts)}</div>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="opt-log-empty">No timeline events recorded for this order yet.</p>
      )}
      {facts.isClose && ev.reason && (
        <p className="optd-reason">Why: {reasonPhrase(ev.reason)}</p>
      )}
      {reasoningEntries.length > 0 && DecisionNarrativeLine && (
        <div className="optd-reasoning-journal" style={{ marginTop: 12, borderTop: "1px solid var(--line)" }}>
          {reasoningEntries.map((r, i) => (
            <DecisionNarrativeLine key={r.ts || i} report={r} />
          ))}
        </div>
      )}
    </section>
  );
}

// --- "The numbers" ------------------------------------------------------------

// The short leg's own entry-snapshot row (from ev.entry_legs) — the source
// of the short-leg delta that drives PoP/EV's live-quote-clock inputs. Same
// shape resolution as LegDetail's own rows: array or {short, long} object.
function shortEntryLeg(ev) {
  const legs = ev.entry_legs;
  if (!legs) return null;
  const rows = Array.isArray(legs) ? legs : Object.values(legs).filter((l) => l && l.symbol);
  return rows.find((l) => l.symbol === ev.short) || null;
}

// One place computing every calc-driving `{inputs, asOf}` pair for this
// trade's own numbers — reused by both the hero stat grid and "The numbers"
// KvGroups so the two surfaces can never drift out of sync with each other.
function tradeCalcProps(ev, facts) {
  const entryTs = (ev.response && ev.response.filled_at) || ev.ts;
  const asOfEntry = { entry: entryTs };
  const leg = shortEntryLeg(ev);
  const quoteTs = leg && leg.quote_ts;
  const shortDelta = leg && leg.greeks ? leg.greeks.delta : undefined;
  const shortStrike = facts.shortParsed ? facts.shortParsed.strike : undefined;
  const longStrike = facts.longParsed ? facts.longParsed.strike : undefined;
  const right = facts.shortParsed ? facts.shortParsed.right : undefined;
  const credit = facts.maxGain;
  const maxLossCalc = { inputs: { width: ev.width, contracts: ev.contracts, credit }, asOf: asOfEntry };
  return {
    max_gain: { inputs: { credit }, asOf: asOfEntry },
    max_loss: maxLossCalc,
    risk: maxLossCalc,
    breakeven: { inputs: { short_strike: shortStrike, credit, contracts: ev.contracts, right }, asOf: asOfEntry },
    pop: { inputs: { short_leg_delta: shortDelta }, asOf: { quotes: quoteTs } },
    risk_reward: { inputs: { max_loss: facts.maxLoss, max_gain: facts.maxGain }, asOf: asOfEntry },
    credit_if_filled: { inputs: { limit_price: num(ev.response && ev.response.limit_price), contracts: ev.contracts } },
    credit_received: {
      inputs: { net_per_contract: num(ev.response && ev.response.filled_avg_price), contracts: facts.fs && facts.fs.filled },
      asOf: asOfEntry,
    },
    realized_pl: { inputs: { credit_received: ev.entry_credit, exit_cost: ev.exit_cost }, asOf: asOfEntry },
    ev: { inputs: { short_leg_delta: shortDelta, credit, width: ev.width, contracts: ev.contracts }, asOf: { entry: entryTs, quotes: quoteTs } },
    width: { inputs: { short_strike: shortStrike, long_strike: longStrike } },
    credit_per_contract: { inputs: { credit, contracts: ev.contracts }, asOf: asOfEntry },
    profit_target: { inputs: { credit, profit_target_pct: ev.profit_target_pct }, asOf: asOfEntry },
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
function KvGroup({ title, items, calc }) {
  const rows = items.filter((item) => item[1] != null && item[1] !== "—");
  if (!rows.length) return null;
  return (
    <div className="optd-kv-group">
      <div className="optd-kv-group-title">{title}</div>
      <div className="opt-kv optd-tiles">
        {rows.map(([label, v, term, secondary, wide]) => {
          const props = (calc && term && calc[term]) || {};
          return (
            <div className={`optd-tile${wide ? " optd-tile--wide" : ""}`} key={label}>
              <span className="opt-kv-k">
                {label}
                {term && <Help term={term} inputs={props.inputs} asOf={props.asOf} />}
              </span>
              {secondary && <span className="opt-kv-sub">{secondary}</span>}
              <span className="opt-kv-v">{v}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Current-position calc for the "Current open P&L" row — same shape as
// options-summary.jsx's positionRowCalcProps so the detail page's <Help/>
// tooltip explains the number with the exact inputs that produced it,
// instead of re-deriving a second formula for the same field.
function openPlCalcProps(pos) {
  if (!pos || !pos.entry || !pos.now) return {};
  return {
    inputs: { credit: pos.entry.credit, close_cost: pos.now.close_cost },
    asOf: { entry: pos.entry.filled_at, quotes: pos.oldest_quote_ts },
  };
}

function TheNumbers({ ev, facts, pos }) {
  const { isClose, received, maxGain, isNetDebit, maxLoss, be, riskReward, pnl, classification } = facts;
  const calc = { ...tradeCalcProps(ev, facts), open_pl: openPlCalcProps(pos) };
  const maxGainLabel = isNetDebit ? "Net debit paid" : "Most we can make";
  const maxGainSecondary = isNetDebit ? "Net debit" : "Max gain (credit)";
  const maxGainValue = money(isNetDebit ? Math.abs(maxGain) : maxGain);
  // Only meaningful while the trade is still open and matched to a live
  // position — a closed trade already has "Realized P&L" below, and the two
  // must never both render for the same trade (one is a live mark, the other
  // is final).
  const openPl = !isClose && pos && pos.now ? pos.now.open_pl : null;
  return (
    <section className="card opt-panel optd-section">
      <h2 className="optd-h2">The numbers</h2>
      <KvGroup
        title="Money"
        calc={calc}
        items={[
          [maxGainLabel, maxGainValue, "max_gain", maxGainSecondary],
          // "Most we can lose" is the worst case if the spread finishes fully
          // in the money at expiry — NOT what it's showing right now. Kept
          // apart from "Current open P&L" below (a live mark that moves
          // every quote) so the two are never mistaken for each other.
          ["Most we can lose", money(maxLoss), "max_loss", "Max loss (risk, worst case at expiry)"],
          ["Current open P&L", openPl != null ? money(openPl) : null, "open_pl", "Live mark, not worst case"],
          ["Break-even price", be != null ? money(be) : (isNetDebit ? "no breakeven — net debit" : null), "breakeven", "Breakeven"],
          ["Risk:reward", riskReward != null ? `${riskReward.toFixed(1)} : 1 against` : null, "risk_reward"],
          ["Credit if filled", money(ev.credit ?? ev.entry_credit), "credit_if_filled"],
          // A CLOSE event's own `received` is what it cost to close, not a
          // credit — that's the "Exit cost" row below, not this one.
          ["Credit received", classification.bucket === "trade" && !isClose ? money(received) : null, "credit_received"],
          ["Realized P&L", isClose ? money(pnl) : null, "realized_pl"],
          ["EV at entry", money(ev.ev), "ev"],
          ["Chance this wins", pctv(ev.pop), "pop", "Win prob (POP)"],
          ["Exit cost", isClose ? money(ev.exit_cost) : null, "exit_cost"],
        ]}
      />
      <KvGroup
        title="The contract"
        calc={calc}
        items={[
          ["Days until it expires", ev.dte, "dte", "DTE"],
          ["Expiry", expiryOf(ev, facts), "expiry"],
          ["Spot at entry", money(ev.spot_at_entry), "spot_at_entry"],
          ["IV at entry", pctv(ev.iv_at_entry), "iv"],
          ["Width", money(ev.width), "width"],
          ["Contracts", ev.contracts, "contracts"],
          ["Credit per contract", money(ev.credit_per_contract), "credit_per_contract"],
          ["Profit target", pctv(ev.profit_target_pct), "profit_target"],
        ]}
      />
      <KvGroup
        title="The order"
        items={(() => {
          const resp = ev.response || {};
          return [
            ["Fill state", classification.label, "fill_state"],
            ["Reason", ev.reason, "reason"],
            ["Order id", ev.client_order_id, "order_id", null, true],
            ["Broker order status", resp.status, "broker_order_status"],
            ["Broker limit price", resp.limit_price != null ? money(num(resp.limit_price)) : null, "broker_limit_price"],
            ["Time in force", resp.time_in_force, "time_in_force"],
            ["Submitted at", tsPretty(resp.submitted_at), "submitted_at", null, true],
            ["Filled at", tsPretty(resp.filled_at), "filled_at", null, true],
          ];
        })()}
      />
    </section>
  );
}

// --- Greeks -------------------------------------------------------------------

function Greeks({ ev, facts }) {
  const internals = window.OptionsTradeLogInternals;
  return (
    <section className="card opt-panel optd-section">
      <h2 className="optd-h2">The greeks</h2>
      <p className="optd-explainer optd-explainer--wide">
        These are the risk sensitivities for each leg — tap the <strong>?</strong> on a column
        header below for what a delta, gamma, theta, vega, or rho actually means.
      </p>
      <p className="optd-note">These were frozen at the moment of the order — not live prices.</p>
      <div className="optd-legtable-wrap">
        <internals.LegDetail title="Legs at entry" legs={ev.entry_legs} predatesSnapshots={!("entry_legs" in ev)} contracts={ev.contracts} />
      </div>
      {facts.isClose && (
        <div className="optd-legtable-wrap">
          <internals.LegDetail title="Legs at exit" legs={ev.exit_legs} predatesSnapshots={!("exit_legs" in ev)} contracts={ev.contracts} />
        </div>
      )}
    </section>
  );
}

// --- Page -----------------------------------------------------------------

function OptionTradeDetailPage() {
  const [key, setKey] = useState(tradeKeyFromUrl);

  useEffect(() => {
    const onHash = () => setKey(tradeKeyFromUrl());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const internals = window.OptionsTradeLogInternals;
  const resolved = internals ? internals.resolveTrade(key, window.SPREAD_LOG) : null;

  if (!resolved) {
    return (
      <main className="shell" id="trade-detail">
        <div style={{ marginTop: 12 }}>
          <BackToTradeLog />
        </div>
        <section className="card opt-panel" style={{ marginTop: 16 }}>
          <p className="opt-log-empty">That trade isn&rsquo;t in the log any more.</p>
        </section>
      </main>
    );
  }

  const { ev, classification } = resolved;
  const facts = internals.tradeFacts(ev, classification);
  const isClose = facts.isClose;
  const banner = outcomeBanner(ev, facts);
  const pos = matchedPosition(ev, facts);
  const livePrice = pos ? num(pos.now && pos.now.spot) : null;

  return (
    <main className="shell" id="trade-detail">
      <div
        style={{
          marginTop: 12, position: "sticky", top: 0, zIndex: 1, paddingBottom: 8,
          display: "flex", alignItems: "center", gap: 8,
        }}
      >
        <BackToTradeLog />
        <TradeDetailFeedbackButton ev={ev} facts={facts} tradeKeyValue={key} />
      </div>
      <section className="card opt-panel" style={{ marginTop: 8 }}>
        <div className="opt-panel-head">
          <h3 className="opt-panel-title">
            <strong className="opt-ticker">{ev.ticker}</strong>
            <CurrentPrice ev={ev} facts={facts} pos={pos} />
          </h3>
          <div className="opt-panel-stats">
            <span className={`opt-badge opt-badge--${isClose ? "close" : "open"}`}>{isClose ? "CLOSE" : "OPEN"}</span>
            <span className={`opt-badge opt-badge--${BADGE_CLASS[classification.kind] || "fill-unfilled"}`}>
              {classification.label}
            </span>
          </div>
        </div>
        <p className="optd-headline">{headlineSentence(ev, facts)}</p>
        <span className={`optd-banner optd-banner--${banner.tone}`}>{banner.text}</span>
      </section>
      <WhatWeDid ev={ev} facts={facts} />
      <WhatHadToHappen ev={ev} facts={facts} livePrice={livePrice} />
      <WhatActuallyHappened ev={ev} facts={facts} />
      <TheNumbers ev={ev} facts={facts} pos={pos} />
      <Greeks ev={ev} facts={facts} />
      {window.TradeFeedbackThreads && (
        <window.TradeFeedbackThreads targets={feedbackTargets(key, pos)} />
      )}
    </main>
  );
}

window.OptionTradeDetailPage = OptionTradeDetailPage;
