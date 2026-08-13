window.SPREAD_PLAN = {
  "generatedAt": "2026-08-13T23:24:15+00:00",
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
    "priced": 31,
    "selected": 31,
    "rejected_ev_or_credit": 0,
    "rejected_pop_band": 0,
    "rejected_momentum": 0,
    "passed": 5,
    "momentum_gate": true,
    "best_credit_ratio": 1.062,
    "credit_ratio_required": 1.05
  },
  "intent": [
    {
      "ticker": "NFLX",
      "short": "NFLX260821P00075000",
      "long": "NFLX260821P00074000",
      "contracts": 25,
      "expiry": "2026-08-21",
      "dte": 8,
      "pop": 0.8235,
      "risk": 2500.0,
      "credit": 468.75,
      "ev": 27.5,
      "right": "put",
      "short_strike": 75.0,
      "long_strike": 74.0,
      "width": 1.0,
      "spot": 78.24,
      "credit_per_contract": 18.75,
      "collateral_per_contract": 100.0,
      "collateral": 2500.0,
      "short_delta": -0.1765,
      "rsi": 61.82,
      "stoch_k": 98.13,
      "momentum_asof": "2026-08-13T04:00:00Z",
      "iv": 0.3608,
      "breakeven": 74.81,
      "credit_vs_breakeven_pct": 1.0623,
      "ann_yield": 10.5288,
      "id": "NFLX-put-75-74-2026-08-21",
      "label": "NFLX 75/74 put spread, expires 2026-08-21",
      "explain": {
        "headline": "We are betting NFLX stays above $75 until 2026-08-21.",
        "bullets": [
          "Someone pays us $469 today. That money is ours the moment the trade opens \u2014 it is called the credit.",
          "We keep all of it if NFLX is still above $75 on 2026-08-21 \u2014 that is 4% away from today's price of $78.24.",
          "If we are wrong, the most we can lose is $2,500, because we also bought the $74 option as a safety net. The loss cannot get bigger than that, no matter how far NFLX moves.",
          "While the trade is open the broker locks up $2,500 of our cash as a deposit. $469 of that is the money we were just paid, so the new cash actually tied up is $2,500 \u2014 and we get the deposit back when the trade closes or expires.",
          "The market itself says there is about a 82% chance we are right. We only take this bet when that number is high AND the payment is big enough to be worth the small chance of being wrong.",
          "It is over in 8 days \u2014 on 2026-08-21 the options expire and the money is settled either way.",
          "Why now: NFLX has already been sold off hard (RSI 61.82, stochastic 98.13 \u2014 both in 'oversold' territory), so we are betting the fall has gone far enough, not stepping in front of it."
        ],
        "structure": "Sell 25 NFLX 75 puts, buy 25 NFLX 74 puts, both expiring 2026-08-21.",
        "worst_case": "NFLX closes past $75 on 2026-08-21 and we lose $2,500 of the $2,500 we put at risk.",
        "best_case": "NFLX never gets there and we keep the whole $469."
      },
      "checks": [
        {
          "label": "Momentum \u2014 oversold (put side)",
          "pass": false,
          "observed": "RSI 61.82, %K 98.13",
          "rule": "RSI below 35 and stochastic %K below 30",
          "why": "A put spread only pays if the stock stops falling. We wait until it is already oversold \u2014 beaten down far enough that a bounce is the likelier next move \u2014 instead of catching it mid-slide."
        },
        {
          "label": "Win probability in band",
          "pass": true,
          "observed": "82.3%",
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
          "pass": true,
          "observed": "8 days",
          "rule": "between 4 and 9 days",
          "why": "Short enough that the option melts fast, long enough that the credit is real."
        },
        {
          "label": "Expected value positive",
          "pass": true,
          "observed": "$28",
          "rule": "greater than $0",
          "why": "Win rate alone is not edge: a high chance of a small win can still lose money."
        },
        {
          "label": "Credit clears breakeven",
          "pass": true,
          "observed": "1.06x",
          "rule": "at least 1.05x the fair-value credit",
          "why": "The payment has to beat what the losing tail costs, with margin to spare."
        },
        {
          "label": "Money at risk in band",
          "pass": true,
          "observed": "$2,500",
          "rule": "between $500 and $2,500",
          "why": "One trade can never be big enough to matter on its own."
        },
        {
          "label": "Net credit is a real credit",
          "pass": true,
          "observed": "$468.75",
          "rule": "greater than $1.00",
          "why": "A spread that pays us nothing \u2014 or pays us to open it in reverse \u2014 carries the full width of risk for no premium and can never profit at any price."
        },
        {
          "label": "Credit collected",
          "pass": true,
          "observed": "$469",
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
    },
    {
      "ticker": "WMT",
      "short": "WMT260821C00123000",
      "long": "WMT260821C00125000",
      "contracts": 12,
      "expiry": "2026-08-21",
      "dte": 8,
      "pop": 0.8154,
      "risk": 2400.0,
      "credit": 363.0,
      "ev": -80.04,
      "right": "call",
      "short_strike": 123.0,
      "long_strike": 125.0,
      "width": 2.0,
      "spot": 115.74,
      "credit_per_contract": 30.25,
      "collateral_per_contract": 200.0,
      "collateral": 2400.0,
      "short_delta": 0.1846,
      "rsi": 58.27,
      "stoch_k": 92.27,
      "momentum_asof": "2026-08-13T04:00:00Z",
      "iv": 0.4485,
      "breakeven": 123.3,
      "credit_vs_breakeven_pct": 0.8193,
      "ann_yield": 8.1305,
      "id": "WMT-call-123-125-2026-08-21",
      "label": "WMT 123/125 call spread, expires 2026-08-21",
      "explain": {
        "headline": "We are betting WMT stays below $123 until 2026-08-21.",
        "bullets": [
          "Someone pays us $363 today. That money is ours the moment the trade opens \u2014 it is called the credit.",
          "We keep all of it if WMT is still below $123 on 2026-08-21 \u2014 that is 6% away from today's price of $115.74.",
          "If we are wrong, the most we can lose is $2,400, because we also bought the $125 option as a safety net. The loss cannot get bigger than that, no matter how far WMT moves.",
          "While the trade is open the broker locks up $2,400 of our cash as a deposit. $363 of that is the money we were just paid, so the new cash actually tied up is $2,400 \u2014 and we get the deposit back when the trade closes or expires.",
          "The market itself says there is about a 82% chance we are right. We only take this bet when that number is high AND the payment is big enough to be worth the small chance of being wrong.",
          "It is over in 8 days \u2014 on 2026-08-21 the options expire and the money is settled either way.",
          "Why now: WMT has already run hot (RSI 58.27, stochastic 92.27 \u2014 both in 'overbought' territory), so we are betting the climb pauses, not fighting a rally that just started."
        ],
        "structure": "Sell 12 WMT 123 calls, buy 12 WMT 125 calls, both expiring 2026-08-21.",
        "worst_case": "WMT closes past $123 on 2026-08-21 and we lose $2,400 of the $2,400 we put at risk.",
        "best_case": "WMT never gets there and we keep the whole $363."
      },
      "checks": [
        {
          "label": "Momentum \u2014 overbought (call side)",
          "pass": false,
          "observed": "RSI 58.27, %K 92.27",
          "rule": "RSI above 65 and stochastic %K above 70",
          "why": "A call spread only pays if the stock stops rising. We wait until it is already overbought \u2014 stretched far enough that a pause is the likelier next move \u2014 instead of selling into strength."
        },
        {
          "label": "Win probability in band",
          "pass": true,
          "observed": "81.5%",
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
          "pass": true,
          "observed": "8 days",
          "rule": "between 4 and 9 days",
          "why": "Short enough that the option melts fast, long enough that the credit is real."
        },
        {
          "label": "Expected value positive",
          "pass": false,
          "observed": "$-80",
          "rule": "greater than $0",
          "why": "Win rate alone is not edge: a high chance of a small win can still lose money."
        },
        {
          "label": "Credit clears breakeven",
          "pass": false,
          "observed": "0.82x",
          "rule": "at least 1.05x the fair-value credit",
          "why": "The payment has to beat what the losing tail costs, with margin to spare."
        },
        {
          "label": "Money at risk in band",
          "pass": true,
          "observed": "$2,400",
          "rule": "between $500 and $2,500",
          "why": "One trade can never be big enough to matter on its own."
        },
        {
          "label": "Net credit is a real credit",
          "pass": true,
          "observed": "$363.00",
          "rule": "greater than $1.00",
          "why": "A spread that pays us nothing \u2014 or pays us to open it in reverse \u2014 carries the full width of risk for no premium and can never profit at any price."
        },
        {
          "label": "Credit collected",
          "pass": true,
          "observed": "$363",
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
    },
    {
      "ticker": "TSLA",
      "short": "TSLA260819P00327500",
      "long": "TSLA260819P00322500",
      "contracts": 5,
      "expiry": "2026-08-19",
      "dte": 6,
      "pop": 0.8131,
      "risk": 2500.0,
      "credit": 381.25,
      "ev": -86.0,
      "right": "put",
      "short_strike": 327.5,
      "long_strike": 322.5,
      "width": 5.0,
      "spot": 340.77,
      "credit_per_contract": 76.25,
      "collateral_per_contract": 500.0,
      "collateral": 2500.0,
      "short_delta": -0.1869,
      "rsi": 47.69,
      "stoch_k": 96.2,
      "momentum_asof": "2026-08-13T04:00:00Z",
      "iv": 0.3721,
      "breakeven": 326.74,
      "credit_vs_breakeven_pct": 0.8159,
      "ann_yield": 10.9464,
      "id": "TSLA-put-327.5-322.5-2026-08-19",
      "label": "TSLA 327.5/322.5 put spread, expires 2026-08-19",
      "explain": {
        "headline": "We are betting TSLA stays above $328 until 2026-08-19.",
        "bullets": [
          "Someone pays us $381 today. That money is ours the moment the trade opens \u2014 it is called the credit.",
          "We keep all of it if TSLA is still above $328 on 2026-08-19 \u2014 that is 4% away from today's price of $340.77.",
          "If we are wrong, the most we can lose is $2,500, because we also bought the $322 option as a safety net. The loss cannot get bigger than that, no matter how far TSLA moves.",
          "While the trade is open the broker locks up $2,500 of our cash as a deposit. $381 of that is the money we were just paid, so the new cash actually tied up is $2,500 \u2014 and we get the deposit back when the trade closes or expires.",
          "The market itself says there is about a 81% chance we are right. We only take this bet when that number is high AND the payment is big enough to be worth the small chance of being wrong.",
          "It is over in 6 days \u2014 on 2026-08-19 the options expire and the money is settled either way.",
          "Why now: TSLA has already been sold off hard (RSI 47.69, stochastic 96.2 \u2014 both in 'oversold' territory), so we are betting the fall has gone far enough, not stepping in front of it."
        ],
        "structure": "Sell 5 TSLA 327.5 puts, buy 5 TSLA 322.5 puts, both expiring 2026-08-19.",
        "worst_case": "TSLA closes past $328 on 2026-08-19 and we lose $2,500 of the $2,500 we put at risk.",
        "best_case": "TSLA never gets there and we keep the whole $381."
      },
      "checks": [
        {
          "label": "Momentum \u2014 oversold (put side)",
          "pass": false,
          "observed": "RSI 47.69, %K 96.2",
          "rule": "RSI below 35 and stochastic %K below 30",
          "why": "A put spread only pays if the stock stops falling. We wait until it is already oversold \u2014 beaten down far enough that a bounce is the likelier next move \u2014 instead of catching it mid-slide."
        },
        {
          "label": "Win probability in band",
          "pass": true,
          "observed": "81.3%",
          "rule": "between 78% and 88%",
          "why": "Too low and we lose too often; too high and the payment is too small to be worth it."
        },
        {
          "label": "Short strike distance (delta)",
          "pass": true,
          "observed": "0.19",
          "rule": "at most 0.20",
          "why": "Delta is roughly the chance the strike gets hit \u2014 the further out, the safer."
        },
        {
          "label": "Days to expiry",
          "pass": true,
          "observed": "6 days",
          "rule": "between 4 and 9 days",
          "why": "Short enough that the option melts fast, long enough that the credit is real."
        },
        {
          "label": "Expected value positive",
          "pass": false,
          "observed": "$-86",
          "rule": "greater than $0",
          "why": "Win rate alone is not edge: a high chance of a small win can still lose money."
        },
        {
          "label": "Credit clears breakeven",
          "pass": false,
          "observed": "0.82x",
          "rule": "at least 1.05x the fair-value credit",
          "why": "The payment has to beat what the losing tail costs, with margin to spare."
        },
        {
          "label": "Money at risk in band",
          "pass": true,
          "observed": "$2,500",
          "rule": "between $500 and $2,500",
          "why": "One trade can never be big enough to matter on its own."
        },
        {
          "label": "Net credit is a real credit",
          "pass": true,
          "observed": "$381.25",
          "rule": "greater than $1.00",
          "why": "A spread that pays us nothing \u2014 or pays us to open it in reverse \u2014 carries the full width of risk for no premium and can never profit at any price."
        },
        {
          "label": "Credit collected",
          "pass": true,
          "observed": "$381",
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
    },
    {
      "ticker": "MRVL",
      "short": "MRVL260821P00205000",
      "long": "MRVL260821P00195000",
      "contracts": 2,
      "expiry": "2026-08-21",
      "dte": 8,
      "pop": 0.8017,
      "risk": 2000.0,
      "credit": 319.5,
      "ev": -77.1,
      "right": "put",
      "short_strike": 205.0,
      "long_strike": 195.0,
      "width": 10.0,
      "spot": 223.95,
      "credit_per_contract": 159.75,
      "collateral_per_contract": 1000.0,
      "collateral": 2000.0,
      "short_delta": -0.1983,
      "rsi": 53.75,
      "stoch_k": 86.57,
      "momentum_asof": "2026-08-13T04:00:00Z",
      "iv": 0.7718,
      "breakeven": 203.4,
      "credit_vs_breakeven_pct": 0.8056,
      "ann_yield": 8.6743,
      "id": "MRVL-put-205-195-2026-08-21",
      "label": "MRVL 205/195 put spread, expires 2026-08-21",
      "explain": {
        "headline": "We are betting MRVL stays above $205 until 2026-08-21.",
        "bullets": [
          "Someone pays us $320 today. That money is ours the moment the trade opens \u2014 it is called the credit.",
          "We keep all of it if MRVL is still above $205 on 2026-08-21 \u2014 that is 8% away from today's price of $223.95.",
          "If we are wrong, the most we can lose is $2,000, because we also bought the $195 option as a safety net. The loss cannot get bigger than that, no matter how far MRVL moves.",
          "While the trade is open the broker locks up $2,000 of our cash as a deposit. $320 of that is the money we were just paid, so the new cash actually tied up is $2,000 \u2014 and we get the deposit back when the trade closes or expires.",
          "The market itself says there is about a 80% chance we are right. We only take this bet when that number is high AND the payment is big enough to be worth the small chance of being wrong.",
          "It is over in 8 days \u2014 on 2026-08-21 the options expire and the money is settled either way.",
          "Why now: MRVL has already been sold off hard (RSI 53.75, stochastic 86.57 \u2014 both in 'oversold' territory), so we are betting the fall has gone far enough, not stepping in front of it."
        ],
        "structure": "Sell 2 MRVL 205 puts, buy 2 MRVL 195 puts, both expiring 2026-08-21.",
        "worst_case": "MRVL closes past $205 on 2026-08-21 and we lose $2,000 of the $2,000 we put at risk.",
        "best_case": "MRVL never gets there and we keep the whole $320."
      },
      "checks": [
        {
          "label": "Momentum \u2014 oversold (put side)",
          "pass": false,
          "observed": "RSI 53.75, %K 86.57",
          "rule": "RSI below 35 and stochastic %K below 30",
          "why": "A put spread only pays if the stock stops falling. We wait until it is already oversold \u2014 beaten down far enough that a bounce is the likelier next move \u2014 instead of catching it mid-slide."
        },
        {
          "label": "Win probability in band",
          "pass": true,
          "observed": "80.2%",
          "rule": "between 78% and 88%",
          "why": "Too low and we lose too often; too high and the payment is too small to be worth it."
        },
        {
          "label": "Short strike distance (delta)",
          "pass": true,
          "observed": "0.20",
          "rule": "at most 0.20",
          "why": "Delta is roughly the chance the strike gets hit \u2014 the further out, the safer."
        },
        {
          "label": "Days to expiry",
          "pass": true,
          "observed": "8 days",
          "rule": "between 4 and 9 days",
          "why": "Short enough that the option melts fast, long enough that the credit is real."
        },
        {
          "label": "Expected value positive",
          "pass": false,
          "observed": "$-77",
          "rule": "greater than $0",
          "why": "Win rate alone is not edge: a high chance of a small win can still lose money."
        },
        {
          "label": "Credit clears breakeven",
          "pass": false,
          "observed": "0.81x",
          "rule": "at least 1.05x the fair-value credit",
          "why": "The payment has to beat what the losing tail costs, with margin to spare."
        },
        {
          "label": "Money at risk in band",
          "pass": true,
          "observed": "$2,000",
          "rule": "between $500 and $2,500",
          "why": "One trade can never be big enough to matter on its own."
        },
        {
          "label": "Net credit is a real credit",
          "pass": true,
          "observed": "$319.50",
          "rule": "greater than $1.00",
          "why": "A spread that pays us nothing \u2014 or pays us to open it in reverse \u2014 carries the full width of risk for no premium and can never profit at any price."
        },
        {
          "label": "Credit collected",
          "pass": true,
          "observed": "$320",
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
    },
    {
      "ticker": "AAPL",
      "short": "AAPL260821P00295000",
      "long": "AAPL260821P00292500",
      "contracts": 10,
      "expiry": "2026-08-21",
      "dte": 8,
      "pop": 0.8416,
      "risk": 2500.0,
      "credit": 287.5,
      "ev": -108.5,
      "right": "put",
      "short_strike": 295.0,
      "long_strike": 292.5,
      "width": 2.5,
      "spot": 304.95,
      "credit_per_contract": 28.75,
      "collateral_per_contract": 250.0,
      "collateral": 2500.0,
      "short_delta": -0.1584,
      "rsi": 43.04,
      "stoch_k": 11.8,
      "momentum_asof": "2026-08-13T04:00:00Z",
      "iv": 0.2321,
      "breakeven": 294.71,
      "credit_vs_breakeven_pct": 0.726,
      "ann_yield": 5.9287,
      "id": "AAPL-put-295-292.5-2026-08-21",
      "label": "AAPL 295/292.5 put spread, expires 2026-08-21",
      "explain": {
        "headline": "We are betting AAPL stays above $295 until 2026-08-21.",
        "bullets": [
          "Someone pays us $288 today. That money is ours the moment the trade opens \u2014 it is called the credit.",
          "We keep all of it if AAPL is still above $295 on 2026-08-21 \u2014 that is 3% away from today's price of $304.95.",
          "If we are wrong, the most we can lose is $2,500, because we also bought the $292 option as a safety net. The loss cannot get bigger than that, no matter how far AAPL moves.",
          "While the trade is open the broker locks up $2,500 of our cash as a deposit. $288 of that is the money we were just paid, so the new cash actually tied up is $2,500 \u2014 and we get the deposit back when the trade closes or expires.",
          "The market itself says there is about a 84% chance we are right. We only take this bet when that number is high AND the payment is big enough to be worth the small chance of being wrong.",
          "It is over in 8 days \u2014 on 2026-08-21 the options expire and the money is settled either way.",
          "Why now: AAPL has already been sold off hard (RSI 43.04, stochastic 11.8 \u2014 both in 'oversold' territory), so we are betting the fall has gone far enough, not stepping in front of it."
        ],
        "structure": "Sell 10 AAPL 295 puts, buy 10 AAPL 292.5 puts, both expiring 2026-08-21.",
        "worst_case": "AAPL closes past $295 on 2026-08-21 and we lose $2,500 of the $2,500 we put at risk.",
        "best_case": "AAPL never gets there and we keep the whole $288."
      },
      "checks": [
        {
          "label": "Momentum \u2014 oversold (put side)",
          "pass": false,
          "observed": "RSI 43.04, %K 11.8",
          "rule": "RSI below 35 and stochastic %K below 30",
          "why": "A put spread only pays if the stock stops falling. We wait until it is already oversold \u2014 beaten down far enough that a bounce is the likelier next move \u2014 instead of catching it mid-slide."
        },
        {
          "label": "Win probability in band",
          "pass": true,
          "observed": "84.2%",
          "rule": "between 78% and 88%",
          "why": "Too low and we lose too often; too high and the payment is too small to be worth it."
        },
        {
          "label": "Short strike distance (delta)",
          "pass": true,
          "observed": "0.16",
          "rule": "at most 0.20",
          "why": "Delta is roughly the chance the strike gets hit \u2014 the further out, the safer."
        },
        {
          "label": "Days to expiry",
          "pass": true,
          "observed": "8 days",
          "rule": "between 4 and 9 days",
          "why": "Short enough that the option melts fast, long enough that the credit is real."
        },
        {
          "label": "Expected value positive",
          "pass": false,
          "observed": "$-108",
          "rule": "greater than $0",
          "why": "Win rate alone is not edge: a high chance of a small win can still lose money."
        },
        {
          "label": "Credit clears breakeven",
          "pass": false,
          "observed": "0.73x",
          "rule": "at least 1.05x the fair-value credit",
          "why": "The payment has to beat what the losing tail costs, with margin to spare."
        },
        {
          "label": "Money at risk in band",
          "pass": true,
          "observed": "$2,500",
          "rule": "between $500 and $2,500",
          "why": "One trade can never be big enough to matter on its own."
        },
        {
          "label": "Net credit is a real credit",
          "pass": true,
          "observed": "$287.50",
          "rule": "greater than $1.00",
          "why": "A spread that pays us nothing \u2014 or pays us to open it in reverse \u2014 carries the full width of risk for no premium and can never profit at any price."
        },
        {
          "label": "Credit collected",
          "pass": true,
          "observed": "$288",
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
