window.SPREAD_PLAN = {
  "generatedAt": "2026-08-13T23:05:04+00:00",
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
    "priced": 39,
    "selected": 1,
    "rejected_non_positive_credit": 0,
    "rejected_ev_or_credit": 1,
    "rejected_pop_band": 0,
    "rejected_momentum": 0,
    "passed": 0,
    "momentum_gate": true,
    "best_credit_ratio": 1.065,
    "credit_ratio_required": 1.25
  },
  "intent": []
};
