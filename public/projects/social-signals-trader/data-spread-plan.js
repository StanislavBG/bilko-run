window.SPREAD_PLAN = {
  "generatedAt": "2026-08-13T23:19:03+00:00",
  "strategy": "CREDIT_SPREAD",
  "deployment": {
    "equity": 105900.93,
    "spread_risk": 0,
    "stock_value": 4823.1,
    "deployed": 4823.1,
    "deployed_pct": 0.0455,
    "target_pct": 0.6,
    "target": 31770.28,
    "max_total_risk": 105900.93,
    "options_buying_power": 101077.83,
    "headroom": 26947.18,
    "deployable_now": 26947.18,
    "at_target": false,
    "beta_gate": {
      "cap": 0.3,
      "target_invested_pct": 0.6,
      "beta": null,
      "n": 11,
      "min_sample": 20,
      "confidence": 0.0,
      "reason": "beta not yet measured with an adequate sample (n=11, need >= 20 closed positions) \u2014 deployment HELD at the floor 30% of equity."
    },
    "entry_fill_fraction_gate": {
      "status": "measured",
      "n": 15,
      "configured_entry_fill_fraction": 0.5,
      "observed_realised_scored_ratio": 0.2764
    },
    "maintenance_margin": 4823.1,
    "margin_buffer_pct": 0.35,
    "margin_cap": 68835.6,
    "margin_headroom": 64012.5,
    "margin_breach": false
  },
  "funnel": {
    "tickers": 33,
    "chain_errors": 0,
    "priced": 40,
    "selected": 1,
    "rejected_non_positive_credit": 0,
    "rejected_ev_or_credit": 0,
    "rejected_pop_band": 0,
    "rejected_momentum": 1,
    "passed": 0,
    "momentum_gate": true,
    "best_credit_ratio": 1.065,
    "credit_ratio_required": 1.05
  },
  "intent": [
    {
      "ticker": "BABA",
      "short": "BABA260814C00143000",
      "long": "BABA260814C00144000",
      "contracts": 56,
      "expiry": "2026-08-14",
      "dte": 1,
      "pop": 0.82,
      "risk": 3752.0,
      "credit": 1848.0,
      "ev": 612.0,
      "right": "call",
      "short_strike": 143.0,
      "long_strike": 144.0,
      "width": 1.0,
      "spot": 128.41,
      "credit_per_contract": 0.33,
      "collateral_per_contract": 100.0,
      "collateral": 5600.0,
      "short_delta": -0.18,
      "rsi": 41.2,
      "stoch_k": 22.5,
      "momentum_asof": "2026-08-13",
      "iv": 0.34,
      "breakeven": 143.33,
      "credit_vs_breakeven_pct": 0.23,
      "ann_yield": 0.61,
      "id": "BABA-call-143-144-2026-08-14",
      "label": "BABA 143/144 call spread, expires 2026-08-14",
      "explain": {
        "headline": "We are betting BABA stays below $143 until 2026-08-14.",
        "bullets": [
          "Someone pays us $1,848 today. That money is ours the moment the trade opens \u2014 it is called the credit.",
          "We keep all of it if BABA is still below $143 on 2026-08-14 \u2014 that is 11% away from today's price of $128.41.",
          "If we are wrong, the most we can lose is $3,752, because we also bought the $144 option as a safety net. The loss cannot get bigger than that, no matter how far BABA moves.",
          "While the trade is open the broker locks up $5,600 of our cash as a deposit. $1,848 of that is the money we were just paid, so the new cash actually tied up is $3,752 \u2014 and we get the deposit back when the trade closes or expires.",
          "The market itself says there is about a 82% chance we are right. We only take this bet when that number is high AND the payment is big enough to be worth the small chance of being wrong.",
          "It is over in 1 day \u2014 on 2026-08-14 the options expire and the money is settled either way.",
          "Why now: BABA has already run hot (RSI 41.2, stochastic 22.5 \u2014 both in 'overbought' territory), so we are betting the climb pauses, not fighting a rally that just started."
        ],
        "structure": "Sell 56 BABA 143 calls, buy 56 BABA 144 calls, both expiring 2026-08-14.",
        "worst_case": "BABA closes past $143 on 2026-08-14 and we lose $3,752 of the $3,752 we put at risk.",
        "best_case": "BABA never gets there and we keep the whole $1,848."
      },
      "checks": [
        {
          "label": "Momentum \u2014 overbought (call side)",
          "pass": false,
          "observed": "RSI 41.2, %K 22.5",
          "rule": "RSI above 65 and stochastic %K above 70",
          "why": "A call spread only pays if the stock stops rising. We wait until it is already overbought \u2014 stretched far enough that a pause is the likelier next move \u2014 instead of selling into strength."
        },
        {
          "label": "Win probability in band",
          "pass": true,
          "observed": "82.0%",
          "rule": "between 78% and 88%",
          "why": "Too low and we lose too often; too high and the payment is too small to be worth it."
        },
        {
          "label": "Short strike distance (delta)",
          "pass": true,
          "observed": "0.18",
          "rule": "at most 0.20",
          "why": "Delta is roughly the chance the strike gets hit \u2014 the further out, the safer."
        },
        {
          "label": "Days to expiry",
          "pass": false,
          "observed": "1 days",
          "rule": "between 4 and 9 days",
          "why": "Short enough that the option melts fast, long enough that the credit is real."
        },
        {
          "label": "Expected value positive",
          "pass": true,
          "observed": "$612",
          "rule": "greater than $0",
          "why": "Win rate alone is not edge: a high chance of a small win can still lose money."
        },
        {
          "label": "Credit clears breakeven",
          "pass": false,
          "observed": "0.23x",
          "rule": "at least 1.05x the fair-value credit",
          "why": "The payment has to beat what the losing tail costs, with margin to spare."
        },
        {
          "label": "Money at risk in band",
          "pass": false,
          "observed": "$3,752",
          "rule": "between $500 and $2,500",
          "why": "One trade can never be big enough to matter on its own."
        },
        {
          "label": "Net credit is a real credit",
          "pass": true,
          "observed": "$1,848.00",
          "rule": "greater than $1.00",
          "why": "A spread that pays us nothing \u2014 or pays us to open it in reverse \u2014 carries the full width of risk for no premium and can never profit at any price."
        },
        {
          "label": "Credit collected",
          "pass": true,
          "observed": "$1,848",
          "rule": "at least $5",
          "why": "Below this the commissions and slippage eat the whole trade."
        }
      ],
      "rules": [
        {
          "field": "put_max_rsi / put_max_stoch",
          "value": "RSI < 35, %K < 30",
          "plain": "ENTRY \u2014 we only sell PUT spreads on a stock that is already beaten down (oversold), so we are betting on a bounce, not standing in front of a fall."
        },
        {
          "field": "call_min_rsi / call_min_stoch",
          "value": "RSI > 65, %K > 70",
          "plain": "ENTRY \u2014 we only sell CALL spreads on a stock that has already run hot (overbought), so we are betting on a pause, not fighting a rally early."
        },
        {
          "field": "min_pop / max_pop",
          "value": "78%\u201388%",
          "plain": "We only sell options the market thinks probably expire worthless \u2014 but not so safe that nobody pays us anything for them."
        },
        {
          "field": "min_dte / max_dte",
          "value": "4\u20139 days",
          "plain": "Every trade is over within a week or two. We never hold something for months."
        },
        {
          "field": "max_short_delta",
          "value": "0.20",
          "plain": "The strike we sell has to sit well away from today's price."
        },
        {
          "field": "max_notional",
          "value": "$2,500",
          "plain": "No single trade may risk more than this, so one bad one can't hurt the fund."
        },
        {
          "field": "min_net_credit",
          "value": "greater than $1.00",
          "plain": "ENTRY \u2014 a spread that would net zero or a negative credit is refused before it is ever sent to the broker, checked against the exact price about to be submitted, not just the earlier scan estimate."
        },
        {
          "field": "max_per_underlying",
          "value": "1",
          "plain": "At most this many open trades on the same company at once."
        },
        {
          "field": "close_on_strike_breach",
          "value": "True",
          "plain": "EXIT 1 \u2014 if the price actually reaches the strike we sold, we buy the trade back immediately instead of hoping."
        },
        {
          "field": "max_loss_pct",
          "value": "100%",
          "plain": "EXIT 2 \u2014 if buying the trade back costs 100% of the money we were paid, we take the loss and stop."
        },
        {
          "field": "profit_target_pct",
          "value": "50%",
          "plain": "EXIT 3 \u2014 once we have kept 50% of the payment, we close early and free the money up for the next trade."
        },
        {
          "field": "live",
          "value": "False",
          "plain": "Whether these proposals are actually sent to the broker, or only simulated."
        }
      ]
    }
  ]
};
