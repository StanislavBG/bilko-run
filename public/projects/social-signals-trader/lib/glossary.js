// Shared options glossary + <Help term="..."/> tooltip primitive — the ONE
// definition per concept, project-wide, so PRDs 1019/1020 apply it instead of
// each panel inventing its own tooltip. Plain JS (no JSX — uses
// React.createElement directly), loaded before any panel that references
// window.Glossary / window.Help.

(function () {
  const TERMS = {
    credit_received: {
      label: "Credit received",
      short: "The cash we were paid up front to open this trade.",
      long: "Selling a spread means we collect money immediately instead of paying it. This is that amount, per contract times how many contracts we hold.",
    },
    credit_if_filled: {
      label: "Credit if filled",
      short: "The cash we'd be paid up front if this order fills at its limit price.",
      long: "Same idea as credit received, but for an order that hasn't executed yet.",
    },
    max_gain: {
      label: "Max gain",
      short: "The most this trade can make, best case.",
      long: "For a credit spread that ceiling is the credit received — if the stock cooperates, we simply keep the whole premium.",
    },
    max_loss: {
      label: "Max loss",
      short: "The most this trade can lose, worst case.",
      long: "The width of the spread (the gap between the two strikes) minus the credit we collected, times contracts. This is capped and known up front — it cannot get worse than this.",
    },
    risk: {
      label: "Risk",
      short: "How much money is on the line if this trade goes the wrong way.",
      long: "Shorthand for max loss — the capital that's actually exposed on this position.",
    },
    breakeven: {
      label: "Breakeven",
      short: "The stock price at which this trade neither makes nor loses money.",
      long: "Past this price the trade starts losing; short of it, we keep some or all of the credit.",
    },
    cushion: {
      label: "Cushion",
      short: "How far the stock has to move before this trade starts losing — bigger is safer.",
      long: "Measured as the distance from the current stock price to breakeven. A wide cushion means the stock would have to move a lot against us before we're at risk.",
    },
    band: {
      label: "Band",
      short: "A traffic-light label for how close this trade is to trouble.",
      long: "SAFE = plenty of cushion left. WATCH = cushion is shrinking, keep an eye on it. DANGER = cushion is nearly gone. BREACHED = the stock has already crossed the strike that protects this trade.",
    },
    dte: {
      label: "DTE",
      short: "Days left until this option expires.",
      long: "Short for 'days to expiration'. Fewer days means less time for the stock to move against us, but also less time for it to recover if it does.",
    },
    expiry: {
      label: "Expiry",
      short: "The date this option contract stops existing.",
      long: "After this date the contract is settled — worthless if out of the money, exercised if in the money.",
    },
    short_leg: {
      label: "Short leg",
      short: "The option we sold as part of this spread.",
      long: "Selling it is what generates the credit; it's also the leg that defines breakeven and risk.",
    },
    long_leg: {
      label: "Long leg",
      short: "The option we bought as part of this spread.",
      long: "It exists to cap our downside — it's what makes the max loss a known, limited number instead of unlimited.",
    },
    strike: {
      label: "Strike",
      short: "The price level written into an option contract.",
      long: "It's the price at which the option would be exercised — where shares would change hands if the option is in the money at expiry.",
    },
    width: {
      label: "Width",
      short: "The dollar gap between the two strike prices in a spread.",
      long: "Wider spreads collect more credit but also risk more, since max loss is roughly the width minus the credit received.",
    },
    contracts: {
      label: "Contracts",
      short: "How many copies of this spread we're holding.",
      long: "Each option contract represents 100 shares, so gains, losses, and credit all scale by this number.",
    },
    delta: {
      label: "Delta",
      short: "How much an option's price moves for a $1 move in the stock.",
      long: "Also used as a rough odds estimate — a 0.20 delta option behaves like it has roughly a 20% chance of finishing in the money.",
    },
    short_leg_delta: {
      label: "Short-leg delta",
      short: "The odds-style read on our sold option — roughly its chance of finishing in the money.",
      long: "A lower short-leg delta means the strike we sold is farther from the stock price, so the trade is statistically safer (but usually pays less credit).",
    },
    gamma: {
      label: "Gamma",
      short: "How fast delta itself changes as the stock moves.",
      long: "High gamma means the trade's sensitivity to the stock can shift quickly — risk can change fast, especially close to expiry.",
    },
    theta: {
      label: "Theta",
      short: "How much value this position gains (or loses) each day just from time passing.",
      long: "Credit spreads are usually sold to profit from theta — time decay works in our favor as long as the stock stays away from the short strike.",
    },
    vega: {
      label: "Vega",
      short: "How much this position's value changes when the market's expected volatility changes.",
      long: "A jump in expected volatility (e.g. before earnings) can move this position even if the stock price hasn't moved at all.",
    },
    rho: {
      label: "Rho",
      short: "How much this position's value changes when interest rates change.",
      long: "Usually the smallest factor for short-dated option trades, but included for completeness.",
    },
    iv: {
      label: "IV",
      short: "The market's current guess at how much this stock will swing around.",
      long: "Short for 'implied volatility'. Higher IV means option premiums are richer — good for sellers of credit spreads, but it also signals the market expects a bigger move.",
    },
    pop: {
      label: "PoP / win probability",
      short: "Our best estimate of the odds this trade ends up profitable.",
      long: "Short for 'probability of profit'. It's an estimate, not a guarantee — it comes from option pricing math, not a promise about what the stock will actually do.",
    },
    ev: {
      label: "EV",
      short: "The average dollar outcome we'd expect if we ran this exact trade many times.",
      long: "Short for 'expected value'. It blends the size of the win, the size of the loss, and how likely each is, into one number — positive EV means the trade is favorable on average.",
    },
    pct_captured: {
      label: "% captured",
      short: "How much of the maximum possible profit we've actually locked in so far.",
      long: "100% would mean we've captured the full credit received; a negative number means the trade is currently underwater relative to what we collected.",
    },
    profit_target: {
      label: "Profit target",
      short: "The point at which we plan to close this trade early and take the win.",
      long: "Usually set as a percentage of the credit received, so we don't have to hold every trade all the way to expiry to realize a profit.",
    },
    strike_breach_exit: {
      label: "Strike-breach exit",
      short: "A rule that closes the trade automatically if the stock crosses our short strike.",
      long: "This caps how bad a losing trade can get instead of waiting for the theoretical max loss at expiry.",
    },
    bull_put_spread: {
      label: "Bull put spread",
      short: "A trade that profits if the stock stays above a certain price.",
      long: "We sell a put at a higher strike and buy a put at a lower strike for protection, collecting credit up front — the bet is the stock stays above the strike we sold.",
    },
    bear_call_spread: {
      label: "Bear call spread",
      short: "A trade that profits if the stock stays below a certain price.",
      long: "We sell a call at a lower strike and buy a call at a higher strike for protection, collecting credit up front — the bet is the stock stays below the strike we sold.",
    },
    open_pl: {
      label: "Open P/L",
      short: "The paper profit or loss on a position we're still holding.",
      long: "This changes constantly with the stock price and isn't locked in until we close the position.",
    },
    realized_pl: {
      label: "Realized P/L",
      short: "The actual profit or loss once a position is closed.",
      long: "Unlike open P/L, this number is final — it's what actually hit the account.",
    },
    decay: {
      label: "Decay",
      short: "The steady loss of an option's time value as expiry approaches.",
      long: "All else equal, an option is worth less tomorrow than today simply because there's less time left for the stock to move — this is what theta measures.",
    },
    deployment: {
      label: "Deployment",
      short: "How much of the account's available capital is currently committed to open trades.",
      long: "Low deployment means most of the account is sitting in cash rather than at risk in a position.",
    },
    wide_quote: {
      label: "Wide quote / low confidence",
      short: "The buy and sell prices for this option are far apart, so the 'real' price is uncertain.",
      long: "A wide bid-ask spread usually means this option is thinly traded — any single quote should be trusted less, and fills may be worse than the quoted mid-price.",
    },
    variance_risk_premium: {
      label: "Variance risk premium (beta)",
      short: "The gap between what the market expected a stock to move and how much it actually moved — a rough gauge of whether options are rich or cheap.",
      long: "This is a beta metric: it compares implied volatility (the market's forecast) against realized volatility (what actually happened) after the fact. A consistently positive gap suggests option sellers are being overpaid for the risk they take on.",
    },
    risk_reward: {
      label: "Risk:reward",
      short: "How many dollars are risked for every dollar of potential profit.",
      long: "Credit spreads typically show an unfavorable-looking ratio here on purpose — they're high-probability, capped-reward trades, so a small, likely win is being weighed against a larger, unlikely loss.",
    },
    exit_cost: {
      label: "Exit cost",
      short: "What it cost to buy back the spread and close the position.",
      long: "This is the debit paid to close a spread that was originally sold for a credit. The trade's real profit or loss is the credit received minus this cost.",
    },
    spot_at_entry: {
      label: "Spot at entry",
      short: "The stock's price at the moment we opened the trade.",
      long: "Used as the reference point for how far the stock has moved since entry.",
    },
    credit_per_contract: {
      label: "Credit per contract",
      short: "The premium collected per single spread contract.",
      long: "Multiply by the number of contracts to get the total credit received.",
    },
    fill_state: {
      label: "Fill state",
      short: "Whether the broker filled none, some, or all of the contracts.",
      long: "FILLED means the whole order went through, PARTIAL means only some contracts filled, and UNFILLED/QUEUED means none have yet.",
    },
    reason: {
      label: "Reason",
      short: "Why the position was opened or closed.",
      long: "A short internal tag describing the trigger — for example a strike breach, a profit target being hit, or a time-stop.",
    },
    order_id: {
      label: "Order id",
      short: "The broker's identifier for this order.",
      long: "Useful for looking this order up directly in the Alpaca dashboard or API.",
    },
    broker_order_status: {
      label: "Broker order status",
      short: "The broker's own status label for this order.",
      long: "Reported directly by Alpaca, independent of the fill-state label shown next to it.",
    },
    broker_limit_price: {
      label: "Broker limit price",
      short: "The most we were willing to pay or accept per share for the fill.",
      long: "The order won't fill at a worse price than this, though it may fill better.",
    },
    time_in_force: {
      label: "Time in force",
      short: "How long the order stays working before the broker cancels it.",
      long: "Common values are DAY (cancels at market close) and GTC (stays open until filled or cancelled).",
    },
    submitted_at: {
      label: "Submitted at",
      short: "When the order was sent to the broker.",
      long: "Timestamped the moment we transmitted the order, not when it filled.",
    },
    filled_at: {
      label: "Filled at",
      short: "When the broker completed the fill.",
      long: "May be seconds or minutes after submission, depending on how much liquidity was available.",
    },
    spot: {
      label: "Spot",
      short: "The stock's current live price.",
      long: "Not the strike, not the entry price — this is where the underlying is trading right now, which is what cushion and band are measured against.",
    },
    equity: {
      label: "Equity",
      short: "The total value of the account — cash plus everything held, marked to market.",
      long: "This is the number that moves day to day as positions gain or lose value; it's what performance is measured against.",
    },
    cash: {
      label: "Cash",
      short: "The uninvested dollars sitting in the account, not committed to any open position.",
      long: "Selling a credit spread ties up collateral (max loss) against this cash, but the credit received is added to it immediately.",
    },
    close_cost: {
      label: "Close cost",
      short: "What it would cost right now to buy back this spread and close it out.",
      long: "Compared against the credit we originally received, this is how we know how much of the max profit we've already captured.",
    },
    unpaired_leg: {
      label: "Unpaired leg",
      short: "An option leg on the books with no matching spread partner.",
      long: "Normally every short leg has a long leg protecting it (or vice versa); an unpaired leg usually means a data gap or a position that didn't close cleanly, and is worth a second look.",
    },
    spread: {
      label: "Spread",
      short: "The two-option combo — one sold, one bought — that makes up this trade.",
      long: "Selling the short leg brings in the credit; buying the long leg caps the risk. Together they define one defined-risk position.",
    },
    frozen_entry: {
      label: "Frozen entry",
      short: "The fill time, price, and credit exactly as they were the moment this trade opened.",
      long: "This never updates — it's the historical snapshot, kept alongside the live/now columns so you can see how far the trade has moved since it opened.",
    },
    min_credit: {
      label: "Min credit",
      short: "The smallest credit we'll accept to bother opening a trade.",
      long: "Below this, commissions and slippage eat too much of the potential profit for the trade to be worth putting on.",
    },
    ann_yield: {
      label: "Annualized yield floor",
      short: "The minimum credit-per-day-of-risk, scaled up to a yearly rate, required to enter.",
      long: "Set too high, this filter mechanically forces very short-dated (1-DTE) trades, since those show the richest annualized numbers — which is why it's often left off.",
    },
    max_positions: {
      label: "Max positions",
      short: "The most open spreads the book will hold across every ticker at once.",
      long: "A book-wide ceiling, independent of how much capital each individual position risks.",
    },
    max_total_risk: {
      label: "Max total risk",
      short: "The most capital the whole book is allowed to have on the line at once, across every open spread.",
      long: "Each new trade's max loss counts against this ceiling — once it's hit, no new positions open even if individual position limits allow it.",
    },
    max_per_underlying: {
      label: "Max per underlying",
      short: "The most open spreads allowed on a single stock at the same time.",
      long: "Keeps the book from concentrating too much risk in one name, even if that name keeps generating attractive-looking setups.",
    },
    hold_to_expiry: {
      label: "Hold to expiry",
      short: "Whether this strategy lets trades run all the way to expiration instead of closing them early.",
      long: "When true, the profit-target and strike-breach exits are not used — the trade is only closed at expiry (or on assignment).",
    },
    strike_breach_buffer: {
      label: "Strike-breach buffer",
      short: "How much room past the strike the stock gets before the strike-breach exit actually fires.",
      long: "A small buffer avoids getting stopped out by a brief, noisy tick through the strike that reverses a moment later.",
    },
    live_flag: {
      label: "Live",
      short: "Whether this strategy is currently allowed to place real orders, as opposed to being paused.",
      long: "When false, the strategy can still be evaluated and logged, but it won't submit anything to the broker.",
    },
    provenance: {
      label: "Provenance",
      short: "Where this summary's numbers came from and how fresh they are.",
      long: "Includes when the underlying record was generated, how old the option quotes are, and what the previous snapshot looked like — the receipts behind every number above.",
    },
    positions_count: {
      label: "Positions",
      short: "How many open spreads share this expiration date.",
      long: "Grouping by expiry shows how much risk rolls off the book on a given day, rather than trickling out one position at a time.",
    },
    risk_rolling_off: {
      label: "Risk rolling off",
      short: "The total max loss across every spread that expires on this date.",
      long: "Once these positions expire (or are closed), this much capital-at-risk comes off the book, whether the trades won or lost.",
    },
    trade_event: {
      label: "Event",
      short: "Whether this row opened the position (OPEN) or closed it out (CLOSE).",
      long: "A spread usually appears as two rows over its life — one to open it, one to close it — unless it's still open, in which case only the OPEN row exists so far.",
    },
    limit_price: {
      label: "Limit",
      short: "The price we told the broker we're willing to accept — the order won't fill worse than this.",
      long: "For a credit spread this is a minimum credit to receive; the order sits unfilled until the market offers at least that much.",
    },
    tif: {
      label: "TIF",
      short: "Short for 'time in force' — how long this order stays active before it's automatically cancelled.",
      long: "A common value is DAY, meaning the order cancels itself at the end of the trading session if it hasn't filled.",
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
  let activeCloser = null;

  function Help(props) {
    const term = props && props.term;
    const entry = get(term);
    const [open, setOpen] = React.useState(false);
    const btnRef = React.useRef(null);
    const closeRef = React.useRef(null);
    closeRef.current = () => setOpen(false);

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
        ? React.createElement(
            "span",
            { className: "help-tip", role: "tooltip" },
            React.createElement("span", { className: "help-tip-label" }, entry.label),
            React.createElement("span", { className: "help-tip-short" }, entry.short),
            React.createElement("span", { className: "help-tip-long" }, entry.long)
          )
        : null
    );
  }

  window.Glossary = TERMS;
  window.Help = Help;
})();
