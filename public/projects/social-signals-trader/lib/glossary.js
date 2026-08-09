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
  const MAX_LOSS_CALC = {
    expr: "width × 100 × contracts − credit",
    inputs: [
      { key: "width", label: "Spread width", unit: "$" },
      { key: "contracts", label: "Contracts", unit: "" },
      { key: "credit", label: "Credit received", unit: "$", priced: true, clock: "entry" },
    ],
    result: (v) => v.width * 100 * v.contracts - v.credit,
    unit: "$",
    source: "src/social_signals_trader/options_summary.py:250",
  };

  const TERMS = {
    credit_received: {
      label: "Credit received",
      short: "The cash we were paid up front to open this trade.",
      long: "Selling a spread means we collect money immediately instead of paying it. This is that amount, per contract times how many contracts we hold.",
      calc: {
        expr: "−(net premium per contract) × 100 × contracts",
        inputs: [
          { key: "net_per_contract", label: "Net premium per contract", unit: "$", priced: true, clock: "entry" },
          { key: "contracts", label: "Contracts", unit: "" },
        ],
        result: (v) => -v.net_per_contract * 100 * v.contracts,
        unit: "$",
        source: "src/social_signals_trader/options_summary.py:223",
      },
    },
    credit_if_filled: {
      label: "Credit if filled",
      short: "The cash we'd be paid up front if this order fills at its limit price.",
      long: "Same idea as credit received, but for an order that hasn't executed yet.",
      calc: {
        expr: "limit price × 100 × contracts",
        inputs: [
          { key: "limit_price", label: "Limit price (per share)", unit: "$" },
          { key: "contracts", label: "Contracts", unit: "" },
        ],
        result: (v) => v.limit_price * 100 * v.contracts,
        unit: "$",
        source: "src/social_signals_trader/options_chain.py:655",
      },
    },
    max_gain: {
      label: "Max gain",
      short: "The most this trade can make, best case.",
      long: "For a credit spread that ceiling is the credit received — if the stock cooperates, we simply keep the whole premium.",
      calc: {
        expr: "credit",
        inputs: [{ key: "credit", label: "Credit received", unit: "$", priced: true, clock: "entry" }],
        result: (v) => v.credit,
        unit: "$",
        source: "src/social_signals_trader/options_summary.py:223",
      },
    },
    max_loss: {
      label: "Max loss",
      short: "The most this trade can lose, worst case.",
      long: "The width of the spread (the gap between the two strikes) minus the credit we collected, times contracts. This is capped and known up front — it cannot get worse than this.",
      calc: MAX_LOSS_CALC,
    },
    risk: {
      label: "Risk",
      short: "How much money is on the line if this trade goes the wrong way.",
      long: "Shorthand for max loss — the capital that's actually exposed on this position.",
      calc: MAX_LOSS_CALC,
    },
    breakeven: {
      label: "Breakeven",
      short: "The stock price at which this trade neither makes nor loses money.",
      long: "Past this price the trade starts losing; short of it, we keep some or all of the credit.",
      calc: {
        expr: "short strike ± credit ÷ contracts ÷ 100 (call: +, put: −)",
        inputs: [
          { key: "short_strike", label: "Short strike", unit: "$" },
          { key: "credit", label: "Credit received", unit: "$", priced: true, clock: "entry" },
          { key: "contracts", label: "Contracts", unit: "" },
          { key: "right", label: "Option type", unit: "", text: true },
        ],
        result: (v) => {
          const cps = v.credit / v.contracts / 100;
          return String(v.right).toLowerCase() === "call" ? v.short_strike + cps : v.short_strike - cps;
        },
        unit: "$",
        source: "src/social_signals_trader/aggregations.py:502",
      },
    },
    cushion: {
      label: "Cushion",
      short: "How far the stock has to move before this trade starts losing — bigger is safer.",
      long: "Measured as the distance from the current stock price to breakeven. A wide cushion means the stock would have to move a lot against us before we're at risk.",
      calc: {
        expr: "(short strike − spot) ÷ spot, put: (spot − short strike) ÷ spot",
        inputs: [
          { key: "short_strike", label: "Short strike", unit: "$" },
          { key: "spot", label: "Spot price", unit: "$", priced: true, clock: "quotes" },
          { key: "right", label: "Option type", unit: "", text: true },
        ],
        result: (v) => {
          if (!v.spot) return null;
          const r = String(v.right).toLowerCase();
          return r === "call" ? (v.short_strike - v.spot) / v.spot : (v.spot - v.short_strike) / v.spot;
        },
        unit: "%",
        source: "src/social_signals_trader/options_summary.py:243",
      },
    },
    band: {
      label: "Band",
      short: "A traffic-light label for how close this trade is to trouble.",
      long: "SAFE = plenty of cushion left. WATCH = cushion is shrinking, keep an eye on it. DANGER = cushion is nearly gone. BREACHED = the stock has already crossed the strike that protects this trade.",
      example: "A short $255 put with the stock at $270 has ~5.6% cushion — that reads SAFE; the same trade at $256 has ~0.4% cushion and reads DANGER.",
    },
    dte: {
      label: "DTE",
      short: "Days left until this option expires.",
      long: "Short for 'days to expiration'. Fewer days means less time for the stock to move against us, but also less time for it to recover if it does.",
      example: "An expiry of 0 or a negative number of days just means the contract has already expired or expires today — not that time is somehow owed back.",
      calc: {
        expr: "expiry date − today, in calendar days",
        inputs: [
          { key: "expiry", label: "Expiry date", unit: "", text: true },
          { key: "today", label: "Today's date", unit: "", text: true },
        ],
        result: (v) => {
          // Both inputs are plain YYYY-MM-DD calendar-date strings (not
          // instants), so a bare `new Date(...)` parses each consistently
          // as UTC midnight — unlike SpreadFormat.dteFromExpiry, whose `now`
          // param expects a real instant and re-derives the local calendar
          // day from it, which would double-convert a date-only string.
          const exp = new Date(v.expiry);
          const today = new Date(v.today);
          if (Number.isNaN(exp.getTime()) || Number.isNaN(today.getTime())) return null;
          return Math.round((exp.getTime() - today.getTime()) / 86400000);
        },
        unit: "",
        source: "src/social_signals_trader/options_summary_render.py:195",
      },
    },
    last_updated: {
      label: "Last updated",
      short: "When the job that wrote this card last ran.",
      long: "The read-through of the book — what we think and what needs action — is re-derived wholesale every 2 hours by the options-status-refresh cron (scripts/options-status-refresh-summary.sh, `0 */2 * * *`), never live in your browser. This stamp is that job's own generated_at, shown in Pacific time with its age; it turns amber once the card is older than two refresh cycles (4h), which means the cron missed a run.",
      example: "A stamp reading '1:00 PM PDT, Aug 8 · ~2h old' means the cron last ran at 1:00 PM Pacific and the next run is due at 3:00 PM — the prices quoted in the bullets are from 1:00 PM, not from right now.",
    },
    expiry: {
      label: "Expiry",
      short: "The date this option contract stops existing.",
      long: "After this date the contract is settled — worthless if out of the money, exercised if in the money.",
      example: "An option with expiry 2026-08-21 stops trading and settles on that date — that's what the 8/21 in the contract symbol means.",
    },
    short_leg: {
      label: "Short leg",
      short: "The option we sold as part of this spread.",
      long: "Selling it is what generates the credit; it's also the leg that defines breakeven and risk.",
      example: "In a $255/$250 bull put spread, the $255 put we sold is the short leg.",
    },
    long_leg: {
      label: "Long leg",
      short: "The option we bought as part of this spread.",
      long: "It exists to cap our downside — it's what makes the max loss a known, limited number instead of unlimited.",
      example: "In a $255/$250 bull put spread, the $250 put we bought is the long leg — it caps the loss at $5 wide minus the credit collected.",
    },
    strike: {
      label: "Strike",
      short: "The price level written into an option contract.",
      long: "It's the price at which the option would be exercised — where shares would change hands if the option is in the money at expiry.",
      example: "If we sold the $255 put, $255 is the strike — below that price at expiry, the buyer can put the shares to us at $255 each.",
    },
    width: {
      label: "Width",
      short: "The dollar gap between the two strike prices in a spread.",
      long: "Wider spreads collect more credit but also risk more, since max loss is roughly the width minus the credit received.",
      calc: {
        expr: "|short strike − long strike|",
        inputs: [
          { key: "short_strike", label: "Short strike", unit: "$" },
          { key: "long_strike", label: "Long strike", unit: "$" },
        ],
        result: (v) => Math.abs(v.short_strike - v.long_strike),
        unit: "$",
        source: "src/social_signals_trader/options_summary.py:208",
      },
    },
    contracts: {
      label: "Contracts",
      short: "How many copies of this spread we're holding.",
      long: "Each option contract represents 100 shares, so gains, losses, and credit all scale by this number.",
      example: "3 contracts of a $1.20 credit spread means $360 of credit total (3 × $1.20 × 100), not $1.20.",
    },
    delta: {
      label: "Delta",
      short: "How much an option's price moves for a $1 move in the stock.",
      long: "Also used as a rough odds estimate — a 0.20 delta option behaves like it has roughly a 20% chance of finishing in the money.",
      example: "A 0.30-delta call gains about $0.30 in value for every $1 the stock rises.",
      calc: {
        expr: "net delta × 100 × contracts = position delta",
        inputs: [
          { key: "net_greek", label: "Net delta (per share)", unit: "" },
          { key: "contracts", label: "Contracts", unit: "" },
        ],
        result: (v) => v.net_greek * 100 * v.contracts,
        unit: "",
        source: "dashboard/panels/options-trade-log.jsx:123",
      },
    },
    short_leg_delta: {
      label: "Short-leg delta",
      short: "The odds-style read on our sold option — roughly its chance of finishing in the money.",
      long: "A lower short-leg delta means the strike we sold is farther from the stock price, so the trade is statistically safer (but usually pays less credit).",
      example: "A short-leg delta of −0.15 on a sold put reads as roughly a 15% chance the stock finishes below that strike at expiry.",
    },
    gamma: {
      label: "Gamma",
      short: "How fast delta itself changes as the stock moves.",
      long: "High gamma means the trade's sensitivity to the stock can shift quickly — risk can change fast, especially close to expiry.",
      example: "A gamma of 0.05 means a $1 stock move shifts delta by about 0.05 — e.g. from 0.20 to 0.25.",
      calc: {
        expr: "net gamma × 100 × contracts = position gamma",
        inputs: [
          { key: "net_greek", label: "Net gamma (per share)", unit: "" },
          { key: "contracts", label: "Contracts", unit: "" },
        ],
        result: (v) => v.net_greek * 100 * v.contracts,
        unit: "",
        source: "dashboard/panels/options-trade-log.jsx:124",
      },
    },
    theta: {
      label: "Theta",
      short: "How much value this position gains (or loses) each day just from time passing.",
      long: "Credit spreads are usually sold to profit from theta — time decay works in our favor as long as the stock stays away from the short strike.",
      example: "A position with theta of +$8 gains about $8 in value overnight from time decay alone, stock price unchanged.",
      calc: {
        expr: "net theta × 100 × contracts = position theta",
        inputs: [
          { key: "net_greek", label: "Net theta (per share)", unit: "" },
          { key: "contracts", label: "Contracts", unit: "" },
        ],
        result: (v) => v.net_greek * 100 * v.contracts,
        unit: "$",
        source: "dashboard/panels/options-trade-log.jsx:125",
      },
    },
    vega: {
      label: "Vega",
      short: "How much this position's value changes when the market's expected volatility changes.",
      long: "A jump in expected volatility (e.g. before earnings) can move this position even if the stock price hasn't moved at all.",
      example: "A vega of −$12 means the position loses about $12 in value for every 1-point rise in implied volatility.",
      calc: {
        expr: "net vega × 100 × contracts = position vega",
        inputs: [
          { key: "net_greek", label: "Net vega (per share)", unit: "" },
          { key: "contracts", label: "Contracts", unit: "" },
        ],
        result: (v) => v.net_greek * 100 * v.contracts,
        unit: "$",
        source: "dashboard/panels/options-trade-log.jsx:126",
      },
    },
    rho: {
      label: "Rho",
      short: "How much this position's value changes when interest rates change.",
      long: "Usually the smallest factor for short-dated option trades, but included for completeness.",
      example: "A rho of $2 means the position's value moves about $2 for a full 1% (100bp) move in interest rates — rarely material over a 2-week hold.",
      calc: {
        expr: "net rho × 100 × contracts = position rho",
        inputs: [
          { key: "net_greek", label: "Net rho (per share)", unit: "" },
          { key: "contracts", label: "Contracts", unit: "" },
        ],
        result: (v) => v.net_greek * 100 * v.contracts,
        unit: "$",
        source: "dashboard/panels/options-trade-log.jsx:127",
      },
    },
    iv: {
      label: "IV",
      short: "The market's current guess at how much this stock will swing around.",
      long: "Short for 'implied volatility'. Higher IV means option premiums are richer — good for sellers of credit spreads, but it also signals the market expects a bigger move.",
      example: "An IV of 45% implies the market expects this stock could move roughly ±45% over the next year, annualized.",
    },
    pop: {
      label: "PoP / win probability",
      short: "Our best estimate of the odds this trade ends up profitable.",
      long: "Short for 'probability of profit'. It's an estimate, not a guarantee — it comes from option pricing math, not a promise about what the stock will actually do.",
      calc: {
        expr: "1 − |short-leg delta| (an estimate from option-pricing math, not an exact identity)",
        inputs: [
          { key: "short_leg_delta", label: "Short-leg delta", unit: "", priced: true, clock: "quotes" },
        ],
        result: (v) => 1 - Math.abs(v.short_leg_delta),
        unit: "%",
        source: "src/social_signals_trader/options_summary.py:322",
      },
    },
    ev: {
      label: "EV",
      short: "The average dollar outcome we'd expect if we ran this exact trade many times.",
      long: "Short for 'expected value'. It blends the size of the win, the size of the loss, and how likely each is, into one number — positive EV means the trade is favorable on average.",
      calc: {
        expr: "(pop × credit ÷ contracts − (1 − pop) × (width × 100 − credit ÷ contracts)) × contracts, pop = 1 − |short delta|",
        inputs: [
          { key: "short_leg_delta", label: "Short-leg delta", unit: "", priced: true, clock: "quotes" },
          { key: "credit", label: "Credit received", unit: "$", priced: true, clock: "entry" },
          { key: "width", label: "Spread width", unit: "$" },
          { key: "contracts", label: "Contracts", unit: "" },
        ],
        result: (v) => {
          const pop = 1 - Math.abs(v.short_leg_delta);
          const creditPc = v.credit / v.contracts;
          const maxLossPc = v.width * 100 - creditPc;
          return (pop * creditPc - (1 - pop) * maxLossPc) * v.contracts;
        },
        unit: "$",
        source: "src/social_signals_trader/options_summary.py:325",
      },
    },
    breakeven_credit: {
      label: "Breakeven credit",
      short: "The minimum credit that would have made this trade break even, given its odds.",
      long: "Compares what we actually collected against what the option math says we needed to collect just to break even on average — collecting more than this is what makes the trade +EV.",
      calc: {
        expr: "(1 − pop) × width × 100 × contracts",
        inputs: [
          { key: "pop", label: "PoP (win probability)", unit: "%" },
          { key: "width", label: "Spread width", unit: "$" },
          { key: "contracts", label: "Contracts", unit: "" },
        ],
        result: (v) => (1 - v.pop) * v.width * 100 * v.contracts,
        unit: "$",
        source: "src/social_signals_trader/options_summary.py:326",
      },
    },
    pct_captured: {
      label: "% captured",
      short: "How much of the maximum possible profit we've actually locked in so far.",
      long: "100% would mean we've captured the full credit received; a negative number means the trade is currently underwater relative to what we collected.",
      calc: {
        expr: "(credit − close cost) ÷ credit",
        inputs: [
          { key: "credit", label: "Credit received", unit: "$", priced: true, clock: "entry" },
          { key: "close_cost", label: "Close cost", unit: "$", priced: true, clock: "quotes" },
        ],
        result: (v) => (v.credit == null || v.credit <= 0 ? null : (v.credit - v.close_cost) / v.credit),
        unit: "%",
        source: "src/social_signals_trader/options_summary.py:269",
      },
    },
    profit_target: {
      label: "Profit target",
      short: "The point at which we plan to close this trade early and take the win.",
      long: "Usually set as a percentage of the credit received, so we don't have to hold every trade all the way to expiry to realize a profit.",
      calc: {
        expr: "credit × (1 − profit_target_pct)",
        inputs: [
          { key: "credit", label: "Credit received", unit: "$", priced: true, clock: "entry" },
          { key: "profit_target_pct", token: "profit_target_pct", label: "Profit-target %", unit: "%" },
        ],
        result: (v) => v.credit * (1 - v.profit_target_pct),
        unit: "$",
        source: "src/social_signals_trader/options_summary.py:275",
      },
    },
    strike_breach_exit: {
      label: "Strike-breach exit",
      short: "A rule that closes the trade automatically if the stock crosses our short strike.",
      long: "This caps how bad a losing trade can get instead of waiting for the theoretical max loss at expiry.",
      calc: {
        expr: "short strike ± (short strike × strike_breach_buffer_pct), put: +, call: −",
        inputs: [
          { key: "short_strike", label: "Short strike", unit: "$" },
          { key: "strike_breach_buffer_pct", label: "Breach buffer %", unit: "%" },
          { key: "right", label: "Option type", unit: "", text: true },
        ],
        result: (v) => {
          const buffer = v.short_strike * v.strike_breach_buffer_pct;
          return String(v.right).toLowerCase() === "put" ? v.short_strike + buffer : v.short_strike - buffer;
        },
        unit: "$",
        source: "src/social_signals_trader/options_summary.py:274",
      },
    },
    bull_put_spread: {
      label: "Bull put spread",
      short: "A trade that profits if the stock stays above a certain price.",
      long: "We sell a put at a higher strike and buy a put at a lower strike for protection, collecting credit up front — the bet is the stock stays above the strike we sold.",
      example: "Sell the $255 put, buy the $250 put: we collect credit now and keep it all as long as the stock stays above $255 at expiry.",
    },
    bear_call_spread: {
      label: "Bear call spread",
      short: "A trade that profits if the stock stays below a certain price.",
      long: "We sell a call at a lower strike and buy a call at a higher strike for protection, collecting credit up front — the bet is the stock stays below the strike we sold.",
      example: "Sell the $260 call, buy the $265 call: we collect credit now and keep it all as long as the stock stays below $260 at expiry.",
    },
    open_pl: {
      label: "Open P/L",
      short: "The paper profit or loss on a position we're still holding.",
      long: "This changes constantly with the stock price and isn't locked in until we close the position.",
      calc: {
        expr: "credit − close cost",
        inputs: [
          { key: "credit", label: "Credit received", unit: "$", priced: true, clock: "entry" },
          { key: "close_cost", label: "Close cost", unit: "$", priced: true, clock: "quotes" },
        ],
        result: (v) => v.credit - v.close_cost,
        unit: "$",
        source: "src/social_signals_trader/options_summary.py:266",
      },
    },
    realized_pl: {
      label: "Realized P/L",
      short: "The actual profit or loss once a position is closed.",
      long: "Unlike open P/L, this number is final — it's what actually hit the account. Distinct from open P/L, which is still a paper mark that moves with the quote.",
      example: "We collected $360 credit and paid $90 to close it — realized P/L is +$270, and it doesn't change again after that.",
      calc: {
        expr: "credit received − exit cost",
        inputs: [
          { key: "credit_received", label: "Credit received", unit: "$", priced: true, clock: "entry" },
          { key: "exit_cost", label: "Exit cost", unit: "$", priced: true, clock: "entry" },
        ],
        result: (v) => v.credit_received - v.exit_cost,
        unit: "$",
        source: "src/social_signals_trader/spread_trader.py:1462",
      },
    },
    decay: {
      label: "Decay",
      short: "The steady loss of an option's time value as expiry approaches.",
      long: "All else equal, an option is worth less tomorrow than today simply because there's less time left for the stock to move — this is what theta measures.",
      example: "An option worth $2.10 today with theta of −$0.05 is worth roughly $2.05 tomorrow if the stock and IV don't move at all.",
    },
    deployment: {
      label: "Deployment",
      short: "How much of the account's available capital is currently committed to open trades.",
      long: "Low deployment means most of the account is sitting in cash rather than at risk in a position.",
      calc: {
        expr: "(spread risk + stock value) ÷ equity",
        inputs: [
          { key: "spread_risk", label: "Spread risk (sum of open max loss)", unit: "$" },
          { key: "stock_value", label: "Stock market value", unit: "$" },
          { key: "equity", label: "Equity", unit: "$", priced: true, clock: "quotes" },
        ],
        result: (v) => (v.equity ? (v.spread_risk + v.stock_value) / v.equity : null),
        unit: "%",
        source: "src/social_signals_trader/spread_trader.py:517",
      },
    },
    wide_quote: {
      label: "Wide quote / low confidence",
      short: "The buy and sell prices for this option are far apart, so the 'real' price is uncertain.",
      long: "A wide bid-ask spread usually means this option is thinly traded — any single quote should be trusted less, and fills may be worse than the quoted mid-price.",
      calc: {
        expr: "(ask − bid) ÷ mid — flagged wide above a 25% threshold",
        inputs: [
          { key: "bid", label: "Bid", unit: "$", priced: true, clock: "quotes" },
          { key: "ask", label: "Ask", unit: "$", priced: true, clock: "quotes" },
        ],
        result: (v) => (v.ask + v.bid ? (v.ask - v.bid) / ((v.ask + v.bid) / 2) : null),
        unit: "%",
        source: "src/social_signals_trader/options_summary.py:183",
      },
    },
    variance_risk_premium: {
      label: "Variance risk premium (beta)",
      short: "The gap between what the market expected a stock to move and how much it actually moved — a rough gauge of whether options are rich or cheap.",
      long: "This is a beta metric: it compares implied volatility (the market's forecast) against realized volatility (what actually happened) after the fact. A consistently positive gap suggests option sellers are being overpaid for the risk they take on.",
      calc: {
        expr: "implied vol − realized vol (a beta estimate over closed trades, not an exact per-trade identity)",
        inputs: [
          { key: "avg_implied_vol", label: "Avg. implied vol at entry", unit: "%" },
          { key: "avg_realized_vol", label: "Avg. realized vol over the hold", unit: "%" },
        ],
        result: (v) => v.avg_implied_vol - v.avg_realized_vol,
        unit: "%",
        source: "src/social_signals_trader/beta.py:462",
      },
    },
    risk_reward: {
      label: "Risk:reward",
      short: "How many dollars are risked for every dollar of potential profit.",
      long: "Credit spreads typically show an unfavorable-looking ratio here on purpose — they're high-probability, capped-reward trades, so a small, likely win is being weighed against a larger, unlikely loss.",
      calc: {
        expr: "max loss ÷ max gain",
        inputs: [
          { key: "max_loss", label: "Max loss", unit: "$", priced: true, clock: "entry" },
          { key: "max_gain", label: "Max gain", unit: "$", priced: true, clock: "entry" },
        ],
        result: (v) => (v.max_gain ? v.max_loss / v.max_gain : null),
        unit: "",
        source: "src/social_signals_trader/options_summary.py:250",
      },
    },
    exit_cost: {
      label: "Exit cost",
      short: "What it cost to buy back the spread and close the position.",
      long: "This is the debit paid to close a spread that was originally sold for a credit. The trade's real profit or loss is the credit received minus this cost.",
      example: "We collected $360 to open the spread and paid $90 to close it — exit cost is $90, and realized P/L is $360 − $90 = $270.",
    },
    spot_at_entry: {
      label: "Spot at entry",
      short: "The stock's price at the moment we opened the trade.",
      long: "Used as the reference point for how far the stock has moved since entry.",
      example: "If the stock was $270.50 the moment we opened the trade, that's spot at entry — even if it's since moved to $265.",
    },
    credit_per_contract: {
      label: "Credit per contract",
      short: "The premium collected per single spread contract.",
      long: "Multiply by the number of contracts to get the total credit received.",
      calc: {
        expr: "credit ÷ contracts",
        inputs: [
          { key: "credit", label: "Credit received", unit: "$", priced: true, clock: "entry" },
          { key: "contracts", label: "Contracts", unit: "" },
        ],
        result: (v) => (v.contracts ? v.credit / v.contracts : null),
        unit: "$",
        source: "src/social_signals_trader/spread_trader.py:1415",
      },
    },
    fill_state: {
      label: "Fill state",
      short: "Whether the broker filled none, some, or all of the contracts.",
      long: "FILLED means the whole order went through, PARTIAL means only some contracts filled, and UNFILLED/QUEUED means none have yet.",
      example: "An order for 3 contracts where only 2 filled shows PARTIAL, not FILLED.",
    },
    reason: {
      label: "Reason",
      short: "Why the position was opened or closed.",
      long: "A short internal tag describing the trigger — for example a strike breach, a profit target being hit, or a time-stop.",
      example: "A row tagged strike_breach means the exit fired because the stock crossed the short strike, not because the profit target was hit.",
    },
    order_id: {
      label: "Order id",
      short: "The broker's identifier for this order.",
      long: "Useful for looking this order up directly in the Alpaca dashboard or API.",
      example: "An order id like 6b1e2c4a-... can be pasted straight into the Alpaca dashboard's order search.",
    },
    broker_order_status: {
      label: "Broker order status",
      short: "The broker's own status label for this order.",
      long: "Reported directly by Alpaca, independent of the fill-state label shown next to it.",
      example: "A row can show broker status 'accepted' while our own fill-state label still reads UNFILLED — the broker has the order but hasn't matched it yet.",
    },
    broker_limit_price: {
      label: "Broker limit price",
      short: "The most we were willing to pay or accept per share for the fill.",
      long: "The order won't fill at a worse price than this, though it may fill better.",
      example: "A broker limit price of −$1.20 (credit) means we accept any fill at a credit of $1.20/share or better, but never a worse one.",
    },
    time_in_force: {
      label: "Time in force",
      short: "How long the order stays working before the broker cancels it.",
      long: "Common values are DAY (cancels at market close) and GTC (stays open until filled or cancelled).",
      example: "A DAY order placed at 10am that hasn't filled by the 4pm close is automatically cancelled.",
    },
    submitted_at: {
      label: "Submitted at",
      short: "When the order was sent to the broker.",
      long: "Timestamped the moment we transmitted the order, not when it filled.",
      example: "An order submitted at 9:31 AM PT may not fill until 9:34 AM PT — submitted_at is the earlier timestamp.",
    },
    filled_at: {
      label: "Filled at",
      short: "When the broker completed the fill.",
      long: "May be seconds or minutes after submission, depending on how much liquidity was available.",
      example: "An order submitted at 9:31 AM PT that fills at 9:34 AM PT shows filled_at as 9:34 AM PT.",
    },
    spot: {
      label: "Spot",
      short: "The stock's current live price.",
      long: "Not the strike, not the entry price — this is where the underlying is trading right now, which is what cushion and band are measured against.",
      example: "If the ticker is trading at $268.40 right now, that's spot — regardless of what it was at entry or what the strike is.",
    },
    equity: {
      label: "Equity",
      short: "The total value of the account — cash plus everything held, marked to market.",
      long: "This is the number that moves day to day as positions gain or lose value; it's what performance is measured against.",
      example: "$40,000 cash plus $10,000 of open-position value marks equity at $50,000, even with no positions closed today.",
    },
    cash: {
      label: "Cash",
      short: "The uninvested dollars sitting in the account, not committed to any open position.",
      long: "Selling a credit spread ties up collateral (max loss) against this cash, but the credit received is added to it immediately.",
      example: "Selling a spread for $360 credit against $1,140 of max-loss collateral adds $360 to cash while reserving $1,140 of buying power against it.",
    },
    close_cost: {
      label: "Close cost",
      short: "What it would cost right now to buy back this spread and close it out.",
      long: "Compared against the credit we originally received, this is how we know how much of the max profit we've already captured.",
      calc: {
        expr: "min((short ask − long bid) × 100, width × 100) × contracts",
        inputs: [
          { key: "short_ask", label: "Short-leg ask", unit: "$", priced: true, clock: "quotes" },
          { key: "long_bid", label: "Long-leg bid", unit: "$", priced: true, clock: "quotes" },
          { key: "width", label: "Spread width", unit: "$" },
          { key: "contracts", label: "Contracts", unit: "" },
        ],
        result: (v) => Math.min((v.short_ask - v.long_bid) * 100, v.width * 100) * v.contracts,
        unit: "$",
        source: "src/social_signals_trader/options_summary.py:257-262",
      },
    },
    unpaired_leg: {
      label: "Unpaired leg",
      short: "An option leg on the books with no matching spread partner.",
      long: "Normally every short leg has a long leg protecting it (or vice versa); an unpaired leg usually means a data gap or a position that didn't close cleanly, and is worth a second look.",
      example: "A short $255 put on the books with no matching long put nearby shows up as an unpaired leg — worth checking for a broken close.",
    },
    spread: {
      label: "Spread",
      short: "The two-option combo — one sold, one bought — that makes up this trade.",
      long: "Selling the short leg brings in the credit; buying the long leg caps the risk. Together they define one defined-risk position.",
      example: "Selling the $255 put and buying the $250 put together is one spread — a $5-wide bull put spread.",
    },
    frozen_entry: {
      label: "Frozen entry",
      short: "The fill time, price, and credit exactly as they were the moment this trade opened.",
      long: "This never updates — it's the historical snapshot, kept alongside the live/now columns so you can see how far the trade has moved since it opened.",
      example: "A trade filled at 10:02 AM PT for $1.20/contract keeps that fill time and price in frozen_entry forever, even after the market moves.",
    },
    min_credit: {
      label: "Min credit",
      short: "The smallest credit we'll accept to bother opening a trade.",
      long: "Below this, commissions and slippage eat too much of the potential profit for the trade to be worth putting on.",
      example: "With min_credit set to $0.20, a candidate that only offers $0.12/contract is rejected before it's ever scored.",
    },
    ann_yield: {
      label: "Annualized yield floor",
      short: "The minimum credit-per-day-of-risk, scaled up to a yearly rate, required to enter.",
      long: "Set too high, this filter mechanically forces very short-dated (1-DTE) trades, since those show the richest annualized numbers — which is why it's often left off.",
      calc: {
        expr: "(credit ÷ max loss) × (365 ÷ DTE) — the code annualizes by calendar days, not trading days",
        inputs: [
          { key: "credit", label: "Credit received", unit: "$", priced: true, clock: "entry" },
          { key: "max_loss", label: "Max loss", unit: "$", priced: true, clock: "entry" },
          { key: "dte", label: "DTE", unit: "" },
        ],
        result: (v) => (v.max_loss > 0 && v.dte > 0 ? (v.credit / v.max_loss) * (365 / v.dte) : null),
        unit: "%",
        source: "src/social_signals_trader/options_chain.py:214-217",
      },
    },
    max_positions: {
      label: "Max positions",
      short: "The most open spreads the book will hold across every ticker at once.",
      long: "A book-wide ceiling, independent of how much capital each individual position risks.",
      example: "With max_positions set to 12, an entry scan that finds a 13th attractive setup skips it until something else closes.",
    },
    max_total_risk: {
      label: "Max total risk",
      short: "The most capital the whole book is allowed to have on the line at once, across every open spread — scaled to live equity, not a fixed dollar figure.",
      long: "Each new trade's max loss counts against this ceiling — once it's hit, no new positions open even if individual position limits allow it. Expressed as a multiple of equity so it can't drift above the account's own size the way a fixed dollar cap can.",
      calc: {
        expr: "equity × max_total_risk_equity_multiple",
        inputs: [
          { key: "equity", label: "Equity", unit: "$", priced: true, clock: "quotes" },
          { key: "max_total_risk_equity_multiple", label: "Equity multiple", unit: "" },
        ],
        result: (v) => v.equity * v.max_total_risk_equity_multiple,
        unit: "$",
        source: "src/social_signals_trader/spread_trader.py:515",
      },
    },
    max_per_underlying: {
      label: "Max per underlying",
      short: "The most open spreads allowed on a single stock at the same time.",
      long: "Keeps the book from concentrating too much risk in one name, even if that name keeps generating attractive-looking setups.",
      example: "With max_per_underlying set to 2, a third attractive setup on the same ticker is skipped even though the book-wide max_positions cap has room.",
      calc: {
        expr: "at most max_per_underlying open spreads allowed on one underlying at a time",
        inputs: [{ key: "max_per_underlying", token: "max_per_underlying", label: "Max per underlying", unit: "" }],
        result: (v) => v.max_per_underlying,
        unit: "",
        source: "src/social_signals_trader/spread_trader.py:170",
      },
    },
    min_pop: {
      label: "Min PoP requirement",
      short: "The lowest win-probability estimate a candidate needs to even be considered.",
      long: "A floor on PoP (see PoP / win probability) — candidates estimated below this are never scored, no matter how much credit they'd pay.",
      calc: {
        expr: "candidate pop must be >= min pop to enter",
        inputs: [{ key: "min_pop", label: "Min PoP", unit: "%" }],
        result: (v) => v.min_pop,
        unit: "%",
        source: "src/social_signals_trader/spread_trader.py:69",
      },
    },
    max_short_delta: {
      label: "Max short-leg delta",
      short: "The most aggressive (highest-delta) short strike the strategy will sell.",
      long: "A ceiling on short-leg delta (see Short-leg delta) — candidates whose short strike prices in more risk than this are skipped.",
      calc: {
        expr: "|candidate short delta| must be <= max short delta to enter",
        inputs: [{ key: "max_short_delta", label: "Max short delta", unit: "" }],
        result: (v) => v.max_short_delta,
        unit: "",
        source: "src/social_signals_trader/spread_trader.py:61",
      },
    },
    margin_buffer_pct: {
      label: "Margin buffer",
      short: "How much of equity is kept as broker-margin cushion — new entries are refused once maintenance margin plus the order's own risk would eat into it.",
      long: "The only sizing cap denominated in the broker's own maintenance-margin figure rather than the sleeve's internal risk accounting. Read fresh from the broker every tick, so a stale equity or margin reading can never mask a breach.",
      calc: {
        expr: "maintenance margin ÷ equity, compared against the configured margin_buffer_pct",
        inputs: [
          { key: "maintenance_margin", label: "Maintenance margin", unit: "$", priced: true, clock: "quotes" },
          { key: "equity", label: "Equity", unit: "$", priced: true, clock: "quotes" },
        ],
        result: (v) => (v.equity ? v.maintenance_margin / v.equity : null),
        unit: "%",
        source: "src/social_signals_trader/spread_trader.py:523",
      },
    },
    hold_to_expiry: {
      label: "Hold to expiry",
      short: "Whether this strategy lets trades run all the way to expiration instead of closing them early.",
      long: "When true, the profit-target and strike-breach exits are not used — the trade is only closed at expiry (or on assignment).",
      example: "With hold_to_expiry true, a trade sitting at 90% of max profit two weeks before expiry is still left open rather than closed early to lock in the win.",
    },
    strike_breach_buffer: {
      label: "Strike-breach buffer",
      short: "How much room past the strike the stock gets before the strike-breach exit actually fires.",
      long: "A small buffer avoids getting stopped out by a brief, noisy tick through the strike that reverses a moment later.",
      example: "With a 1% buffer on a $255 short put, the stock has to trade below about $252.45 before the strike-breach exit fires — not the instant it dips under $255.",
      calc: {
        expr: "short strike × strike breach buffer pct = buffer distance from the strike",
        inputs: [
          { key: "short_strike", label: "Short strike", unit: "$" },
          { key: "strike_breach_buffer_pct", label: "Breach buffer %", unit: "%" },
        ],
        result: (v) => v.short_strike * v.strike_breach_buffer_pct,
        unit: "$",
        source: "src/social_signals_trader/spread_trader.py:1385",
      },
    },
    live_flag: {
      label: "Live",
      short: "Whether this strategy is currently allowed to place real orders, as opposed to being paused.",
      long: "When false, the strategy can still be evaluated and logged, but it won't submit anything to the broker.",
      example: "A strategy with live=false still scores and logs candidates every tick, but every order it would have placed is logged as dry_run instead of submitted.",
    },
    provenance: {
      label: "Provenance",
      short: "Where this summary's numbers came from and how fresh they are.",
      long: "Includes when the underlying record was generated, how old the option quotes are, and what the previous snapshot looked like — the receipts behind every number above.",
      example: "A record generated at 9:35 AM PT with quotes stamped 9:34 AM PT has a provenance block showing ~1 minute of quote age.",
    },
    positions_count: {
      label: "Positions",
      short: "How many open spreads share this expiration date.",
      long: "Grouping by expiry shows how much risk rolls off the book on a given day, rather than trickling out one position at a time.",
      calc: {
        expr: "count of open spreads whose expiry matches this row",
        inputs: [{ key: "positions_count", label: "Open positions on this expiry", unit: "" }],
        result: (v) => v.positions_count,
        unit: "",
        source: "dashboard/panels/options-trade-log.jsx:376",
      },
    },
    risk_rolling_off: {
      label: "Risk rolling off",
      short: "The total max loss across every spread that expires on this date.",
      long: "Once these positions expire (or are closed), this much capital-at-risk comes off the book, whether the trades won or lost.",
      calc: {
        expr: "Σ max loss across every open spread sharing this expiry",
        inputs: [{ key: "risk_rolling_off", label: "Total max loss on this expiry", unit: "$" }],
        result: (v) => v.risk_rolling_off,
        unit: "$",
        source: "dashboard/panels/options-trade-log.jsx:377",
      },
    },
    trade_event: {
      label: "Event",
      short: "Whether this row opened the position (OPEN) or closed it out (CLOSE).",
      long: "A spread usually appears as two rows over its life — one to open it, one to close it — unless it's still open, in which case only the OPEN row exists so far.",
      example: "A spread opened on Monday and closed on Friday shows two rows — one OPEN, one CLOSE; a spread still open only has the OPEN row.",
    },
    limit_price: {
      label: "Limit",
      short: "The price we told the broker we're willing to accept — the order won't fill worse than this.",
      long: "For a credit spread this is a minimum credit to receive; the order sits unfilled until the market offers at least that much.",
      example: "A limit of $1.20 credit means the order only fills at $1.20/contract or a better (higher) credit — never worse.",
    },
    total_credit: {
      label: "Total credit received (open book)",
      short: "The sum of credit collected across every open spread right now.",
      long: "Adds each open position's own credit received into one book-wide figure.",
      calc: {
        expr: "sum of credit received across count open spreads",
        inputs: [
          { key: "count", label: "Open spreads", unit: "" },
          { key: "total", label: "Total credit received", unit: "$", priced: true, clock: "entry" },
        ],
        result: (v) => v.total,
        unit: "$",
        source: "src/social_signals_trader/options_summary.py:223",
      },
    },
    total_open_pl: {
      label: "Total open P/L (open book)",
      short: "The combined paper profit or loss across every open spread right now.",
      long: "Adds each open position's own open P/L into one book-wide figure — it moves with live quotes.",
      calc: {
        expr: "sum of open P/L across count open spreads",
        inputs: [
          { key: "count", label: "Open spreads", unit: "" },
          { key: "total", label: "Total open P/L", unit: "$", priced: true, clock: "quotes" },
        ],
        result: (v) => v.total,
        unit: "$",
        source: "src/social_signals_trader/options_summary.py:266",
      },
    },
    total_max_loss: {
      label: "Total max loss (open book)",
      short: "The combined worst-case loss across every open spread right now.",
      long: "Adds each open position's own max loss — capped and known per position — into one book-wide figure.",
      calc: {
        expr: "sum of max loss across count open spreads",
        inputs: [
          { key: "count", label: "Open spreads", unit: "" },
          { key: "total", label: "Total max loss", unit: "$", priced: true, clock: "entry" },
        ],
        result: (v) => v.total,
        unit: "$",
        source: "src/social_signals_trader/options_summary.py:250",
      },
    },
    tif: {
      label: "TIF",
      short: "Short for 'time in force' — how long this order stays active before it's automatically cancelled.",
      long: "A common value is DAY, meaning the order cancels itself at the end of the trading session if it hasn't filled.",
      example: "A DAY order placed at 3:55 PM PT that hasn't filled by the 4:00 PM PT close is cancelled automatically.",
    },
  };

  function normalizeTerm(term) {
    if (!term) return null;
    return String(term).trim().toLowerCase().replace(/[\s-]+/g, "_");
  }

  function get(term) {
    return TERMS[normalizeTerm(term)] || null;
  }

  const React = window.React;
  const SF = window.SpreadFormat;
  let activeCloser = null;

  // A priced calc value that isn't stamped goes stale invisibly — this
  // mirrors options-summary.jsx's REFRESH_INTERVAL_MINUTES=120 (*2 grace)
  // convention so a calc block flags the same staleness the panel does.
  const DEFAULT_STALE_AFTER_MS = 4 * 60 * 60 * 1000;

  function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function formatByUnit(value, unit) {
    if (value == null || !Number.isFinite(Number(value))) return "—";
    const n = Number(value);
    if (unit === "$") return SF ? SF.money(n) : `$${n}`;
    if (unit === "%") return SF ? SF.pctv(n) : `${(n * 100).toFixed(1)}%`;
    if (unit === "px") return `${n}px`;
    return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
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
    let out = expr;
    calcInputs.forEach((inputSpec) => {
      const token = inputSpec.token || inputSpec.key.replace(/_/g, " ");
      const formatted = formatInputValue(inputSpec, inputs[inputSpec.key]);
      out = out.replace(new RegExp(escapeRegExp(token), "gi"), formatted);
    });
    return out;
  }

  // Two clocks, never conflated: fill-derived values (credit, entry prices)
  // are historical facts stamped with the fill time; live-quote-derived
  // values (close cost, spot, ...) are stamped with the quote time. A calc
  // that mixes both prints one as-of line per clock.
  const CLOCK_LABEL = { entry: "entry fill", quotes: "quotes" };

  function formatAsOfTime(iso) {
    const d = new Date(iso);
    if (!iso || Number.isNaN(d.getTime())) return null;
    const timePart = d.toLocaleTimeString("en-US", {
      timeZone: "America/Los_Angeles",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    });
    const datePart = d.toLocaleDateString("en-US", {
      timeZone: "America/Los_Angeles",
      month: "short",
      day: "numeric",
    });
    return { text: `${timePart}, ${datePart}`, ms: d.getTime() };
  }

  function relativeAge(ms) {
    const delta = Math.abs(Date.now() - ms);
    const m = delta / 60000;
    if (m < 1) return "just now";
    if (m < 60) return `~${Math.round(m)}m old`;
    const h = m / 60;
    if (h < 48) return `~${Math.round(h)}h old`;
    return `~${Math.round(h / 24)}d old`;
  }

  function asOfLine(clock, asOf, staleAfterMs, key) {
    const iso = asOf ? asOf[clock] : null;
    const label = CLOCK_LABEL[clock] || clock;
    if (!iso) {
      return React.createElement(
        "span",
        { className: "help-tip-calc-asof", key },
        `Price time unavailable (${label})`
      );
    }
    const t = formatAsOfTime(iso);
    if (!t) {
      return React.createElement(
        "span",
        { className: "help-tip-calc-asof", key },
        `Price time unavailable (${label})`
      );
    }
    const stale = Date.now() - t.ms > staleAfterMs;
    return React.createElement(
      "span",
      { className: stale ? "help-tip-calc-asof help-tip-calc-asof--stale" : "help-tip-calc-asof", key },
      `${stale ? "⚠ " : ""}Prices as of ${t.text} (${label}) — ${relativeAge(t.ms)}`
    );
  }

  function renderCalcBlock(calc, props) {
    const inputs = props.inputs || {};
    const presentSpecs = calc.inputs.filter((spec) => inputPresent(spec, inputs[spec.key]));
    const allPresent = presentSpecs.length === calc.inputs.length;
    const elements = [
      React.createElement("span", { className: "help-tip-calc-title", key: "title" }, "How we got this"),
      React.createElement("span", { className: "help-tip-calc-expr", key: "expr" }, calc.expr),
    ];

    if (!presentSpecs.length) {
      elements.push(
        React.createElement(
          "span",
          { className: "help-tip-calc-names", key: "names" },
          calc.inputs.map((s) => s.label).join(", ")
        ),
        React.createElement(
          "span",
          { className: "help-tip-calc-unavailable", key: "unavailable" },
          "live inputs not available on this view"
        )
      );
      return React.createElement("span", { className: "help-tip-calc" }, elements);
    }

    // At least one input is present but not all (e.g. a config-only value
    // shown outside the context of one specific position) — substitute what
    // we have, leave the rest as the formula's own words, and stop short of
    // a result rather than pretending we can compute one.
    if (!allPresent) {
      presentSpecs.forEach((spec, i) => {
        elements.push(
          React.createElement(
            "span",
            { className: "help-tip-calc-input", key: `input-${i}` },
            `${spec.label}: ${formatInputValue(spec, inputs[spec.key])}`
          )
        );
      });
      elements.push(
        React.createElement(
          "span",
          { className: "help-tip-calc-sub", key: "sub" },
          substituteExpr(calc.expr, presentSpecs, inputs)
        )
      );
      const missing = calc.inputs.filter((spec) => presentSpecs.indexOf(spec) === -1);
      elements.push(
        React.createElement(
          "span",
          { className: "help-tip-calc-unavailable", key: "unavailable" },
          `still needs ${missing.map((s) => s.label).join(", ")} to finish this calc`
        )
      );
      return React.createElement("span", { className: "help-tip-calc" }, elements);
    }

    const numericInputs = {};
    calc.inputs.forEach((spec) => {
      numericInputs[spec.key] = spec.text ? inputs[spec.key] : Number(inputs[spec.key]);
    });

    calc.inputs.forEach((spec, i) => {
      elements.push(
        React.createElement(
          "span",
          { className: "help-tip-calc-input", key: `input-${i}` },
          `${spec.label}: ${formatInputValue(spec, inputs[spec.key])}`
        )
      );
    });

    const result = calc.result(numericInputs);
    if (!Number.isFinite(result)) {
      elements.push(
        React.createElement(
          "span",
          { className: "help-tip-calc-unavailable", key: "unavailable" },
          "value not computable from these inputs"
        )
      );
      return React.createElement("span", { className: "help-tip-calc" }, elements);
    }

    elements.push(
      React.createElement(
        "span",
        { className: "help-tip-calc-sub", key: "sub" },
        substituteExpr(calc.expr, calc.inputs, inputs)
      ),
      React.createElement(
        "span",
        { className: "help-tip-calc-result", key: "result" },
        "= ",
        React.createElement("b", null, formatByUnit(result, calc.unit))
      )
    );

    const clocks = [];
    calc.inputs.forEach((spec) => {
      if (spec.priced && spec.clock && clocks.indexOf(spec.clock) === -1) clocks.push(spec.clock);
    });
    const staleAfterMs = props.staleAfterMs || DEFAULT_STALE_AFTER_MS;
    ["entry", "quotes"].forEach((clock) => {
      if (clocks.indexOf(clock) !== -1) {
        elements.push(asOfLine(clock, props.asOf, staleAfterMs, `asof-${clock}`));
      }
    });

    return React.createElement("span", { className: "help-tip-calc" }, elements);
  }

  //: Gap between the `?` button and the popover, and the minimum breathing room
  //: kept between the popover and the viewport edge before it flips.
  const TIP_GAP = 6;
  const TIP_MARGIN = 8;

  // Viewport coordinates for a popover anchored under `btn`, flipped above /
  // pulled leftward when it would otherwise run past the viewport edge. Pure
  // maths on two rects so it can be reasoned about (and tested) without a DOM.
  function tipPosition(btnRect, tipSize, viewport) {
    let left = btnRect.left;
    if (left + tipSize.width > viewport.width - TIP_MARGIN) {
      left = Math.max(TIP_MARGIN, viewport.width - TIP_MARGIN - tipSize.width);
    }
    let top = btnRect.bottom + TIP_GAP;
    // Flip above the trigger only when that actually gives more room — on a
    // very short viewport, staying below and clamping beats flipping into an
    // even smaller gap.
    const roomBelow = viewport.height - btnRect.bottom - TIP_GAP;
    const roomAbove = btnRect.top - TIP_GAP;
    if (tipSize.height > roomBelow && roomAbove > roomBelow) {
      top = Math.max(TIP_MARGIN, btnRect.top - TIP_GAP - tipSize.height);
    }
    return { top: top, left: left };
  }

  function Help(props) {
    const term = props && props.term;
    const entry = get(term);
    const [open, setOpen] = React.useState(false);
    // null until measured — the popover renders off-screen for one frame so it
    // can be measured, then snaps to its final spot; never flashes mid-page.
    const [pos, setPos] = React.useState(null);
    const btnRef = React.useRef(null);
    const tipRef = React.useRef(null);
    const closeRef = React.useRef(null);
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
      const place = () => {
        const btn = btnRef.current;
        const tip = tipRef.current;
        if (!btn || !tip) return;
        setPos(
          tipPosition(btn.getBoundingClientRect(), {
            width: tip.offsetWidth,
            height: tip.offsetHeight,
          }, { width: window.innerWidth, height: window.innerHeight })
        );
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

    return React.createElement(
      "span",
      { className: "help", onClick: (e) => e.stopPropagation() },
      React.createElement(
        "button",
        {
          type: "button",
          ref: btnRef,
          className: "help-btn",
          "aria-label": `What is ${entry.label}?`,
          "aria-expanded": open,
          onClick: toggle,
          onKeyDown: onKeyDown,
        },
        "?"
      ),
      open
        ? ReactDOM.createPortal(
            React.createElement(
              "span",
              {
                className: "help-tip",
                role: "tooltip",
                ref: tipRef,
                // Clicks inside the popover must not reach whatever is under
                // the portal's DOM position (e.g. a clickable table row).
                onClick: (e) => e.stopPropagation(),
                style: pos
                  ? { top: pos.top + "px", left: pos.left + "px" }
                  : { top: "0px", left: "0px", visibility: "hidden" },
              },
              React.createElement("span", { className: "help-tip-label" }, entry.label),
              props && props.note
                ? React.createElement("span", { className: "help-tip-note" }, props.note)
                : null,
              React.createElement("span", { className: "help-tip-short" }, entry.short),
              React.createElement("span", { className: "help-tip-long" }, entry.long),
              entry.example
                ? React.createElement("span", { className: "help-tip-example" }, entry.example)
                : null,
              entry.calc ? renderCalcBlock(entry.calc, props || {}) : null
            ),
            document.body
          )
        : null
    );
  }

  window.Glossary = TERMS;
  window.Help = Help;
  // The one PT-clock formatter, shared with panels that stamp a card with
  // "when did the job that produced this last run" (options-summary.jsx's
  // SectionStamp) — so a section stamp and a `?` tooltip's "as of" line can
  // never disagree on how a timestamp reads.
  window.AsOfTime = { format: formatAsOfTime, relativeAge: relativeAge };
})();
