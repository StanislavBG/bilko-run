window.OPTIONS_SUMMARY = {
  "generatedAt": "2026-08-13T21:00:01+00:00",
  "record": {
    "schema_version": 4,
    "generated_at": "2026-08-13T21:00:01+00:00",
    "account": {
      "equity": 105900.93,
      "cash": 101077.83,
      "buying_power": 404311.32,
      "options_buying_power": 101077.83,
      "options_approved_level": 3,
      "balance_asof": "2026-08-12"
    },
    "totals": {
      "credit": 0,
      "close_cost": 0,
      "open_pl": 0,
      "max_loss": 0,
      "delta": 0,
      "theta": 0,
      "vega": 0,
      "gamma": 0,
      "mark_suspect_count": 0
    },
    "positions": [],
    "unpaired_legs": [
      {
        "symbol": "BABA260814C00144000",
        "qty": 56.0,
        "side": "long",
        "unpaired_reason": "long_with_no_matching_short"
      }
    ],
    "oldest_quote_ts": null,
    "beta_gate": {
      "measurement": {
        "status": "insufficient_sample",
        "n": 11,
        "min_sample": 20,
        "beta": null,
        "realized_breach_rate": null,
        "implied_breach_rate": null,
        "n_breaches": null,
        "ci_low": null,
        "ci_high": null,
        "n_clusters": null,
        "by_dte_bucket": {
          "0-4": {
            "n": 1,
            "status": "insufficient_sample",
            "beta": null
          },
          "5-9": {
            "n": 8,
            "status": "insufficient_sample",
            "beta": null
          },
          "10-14": {
            "n": 2,
            "status": "insufficient_sample",
            "beta": null
          }
        },
        "note": "only 11 closed position(s) with a measured entry probability (need >= 20) \u2014 beta is NOT measured yet, not '3 trades as if it were a measurement'. Treated as no demonstrated edge."
      },
      "deployment_cap": {
        "cap": 0.3,
        "target_invested_pct": 0.6,
        "beta": null,
        "n": 11,
        "min_sample": 20,
        "confidence": 0.0,
        "reason": "beta not yet measured with an adequate sample (n=11, need >= 20 closed positions) \u2014 deployment HELD at the floor 30% of equity."
      }
    }
  },
  "summary": "Today: $0 (0.0%). Realized $0 \u00b7 open marks $0 \u00b7 0 spreads live, 0 breached, $0/day decay working for us.\n\n## Where the book stands\n\n- Account equity: $105,900.93\n- Cash: $101,077.83\n- Open spreads: 0  \u00b7  unpaired legs: 1\n- Book totals (as stored): credit $0.00, close cost $0.00, open P/L $0, max loss $0.00\n- Book greeks (confidence-gated \u2014 wide-quoted legs excluded): delta 0.0, theta $0/day, vega 0.0, gamma 0.0\n- Spot quotes: last close (market closed)\n- Equity reconciliation: open marks \u0394 ties to equity \u0394. \u2713\n\n## Positions \u2014 entry snapshot (frozen) vs now (live)\n\nNo open options positions.\n\n## What we think right now\n\nNo open options positions \u2014 nothing to assess.\n\n## Action queue\n\nNothing needs attention right now.\n\n## Open queue\n\n- Deployed $4,823.10 of target $31,770.28 (4.5% of equity) \u2014 headroom $26,947.18\nNo queued candidates.\n\n## Rules in force\n\n- `hold_to_expiry`: False\n- `profit_target_pct`: 0.5\n- `max_loss_pct`: 1.0\n- `close_on_strike_breach`: True\n- `strike_breach_buffer_pct`: 0.005\n- `max_short_delta`: 0.2\n- `min_pop`: 0.78\n- `min_dte`: 4\n- `max_dte`: 9\n- `max_per_underlying`: 1\n- `live`: False\n\n- **Beta**: NOT YET MEASURED \u2014 only 11 closed position(s) with a measured entry probability (need >= 20) \u2014 beta is NOT measured yet, not '3 trades as if it were a measurement'. Treated as no demonstrated edge.\n- Deployment cap: 30.0% of equity (floor, until beta is measured)\n\n## Provenance\n\n- Record generated: 2026-08-13T21:00:01+00:00 (0m ago)\n- Oldest quote: \u2014 (unknown ago)\n- SPREAD_PLAN generated: 2026-08-13T20:10:23+00:00 (50m ago)\n- Prior snapshot: 2026-08-13T19:00:02+00:00\n",
  "positions_display": []
};
