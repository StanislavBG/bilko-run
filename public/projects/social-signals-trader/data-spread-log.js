window.SPREAD_LOG = {
  "generatedAt": "2026-08-07T00:01:18+00:00",
  "strategy": "CREDIT_SPREAD",
  "events": [
    {
      "ts": "2026-08-07T00:00:47+00:00",
      "event": "open",
      "strategy": "CREDIT_SPREAD",
      "ticker": "SPY",
      "spot_at_entry": 768.13,
      "short": "SPY260811C00779000",
      "long": "SPY260811C00780000",
      "short_strike": 779.0,
      "long_strike": 780.0,
      "width": 1.0,
      "expiry": "2026-08-11",
      "contracts": 120,
      "credit": 2040.0,
      "credit_per_contract": 17.0,
      "risk": 9960.0,
      "ev": 474.0,
      "pop": 0.8695,
      "dte": 4,
      "iv_at_entry": 0.0982,
      "profit_target_pct": 0.8,
      "entry_legs": {
        "SPY260811C00779000": {
          "symbol": "SPY260811C00779000",
          "underlying": "SPY",
          "right": "call",
          "strike": 779.0,
          "expiry": "2026-08-11",
          "dte": 4,
          "bid": 0.57,
          "ask": 0.58,
          "mid": 0.575,
          "last": 0.56,
          "iv": 0.0982,
          "greeks": {
            "delta": 0.1305,
            "gamma": 0.024,
            "theta": -0.1973,
            "vega": 0.1907,
            "rho": 0.0137
          },
          "volume": 704,
          "open_interest": 0,
          "quote_ts": "2026-08-06T19:59:59.248581017Z"
        },
        "SPY260811C00780000": {
          "symbol": "SPY260811C00780000",
          "underlying": "SPY",
          "right": "call",
          "strike": 780.0,
          "expiry": "2026-08-11",
          "dte": 4,
          "bid": 0.39,
          "ask": 0.4,
          "mid": 0.395,
          "last": 0.43,
          "iv": 0.0943,
          "greeks": {
            "delta": 0.099,
            "gamma": 0.0205,
            "theta": -0.1554,
            "vega": 0.1567,
            "rho": 0.0104
          },
          "volume": 3273,
          "open_interest": 0,
          "quote_ts": "2026-08-06T19:59:59.561355508Z"
        }
      },
      "status": "dry_run",
      "client_order_id": "CREDIT_SPREAD_SPY_20260811_77900",
      "response": {
        "advanced_instructions": {},
        "client_order_id": "CREDIT_SPREAD_SPY_20260811_77900",
        "legs": [
          {
            "position_intent": "sell_to_open",
            "ratio_qty": "1",
            "side": "sell",
            "symbol": "SPY260811C00779000"
          },
          {
            "position_intent": "buy_to_open",
            "ratio_qty": "1",
            "side": "buy",
            "symbol": "SPY260811C00780000"
          }
        ],
        "limit_price": "0.17",
        "order_class": "mleg",
        "qty": "120",
        "time_in_force": "day",
        "type": "limit"
      }
    },
    {
      "ts": "2026-08-06T23:19:51+00:00",
      "strategy": "CREDIT_SPREAD",
      "ticker": "SPY",
      "short": "SPY260810C00777000",
      "long": "SPY260810C00778000",
      "contracts": 121,
      "credit": 2178.0,
      "risk": 9922.0,
      "ev": 382.36,
      "pop": 0.8516,
      "dte": 4,
      "status": "submitted",
      "client_order_id": "CREDIT_SPREAD_SPY_20260810_77700",
      "response": {
        "client_order_id": "CREDIT_SPREAD_SPY_20260810_77700",
        "created_at": "2026-08-06T23:19:51.795287746Z",
        "filled_qty": "0",
        "id": "fcceee63-4644-4475-879a-051bfdf23913",
        "legs": [
          {
            "asset_class": "us_option",
            "asset_id": "9aea5920-60e7-4777-952e-bf7a92b8d7d2",
            "client_order_id": "58e38a14-ed60-4a33-8365-8011907ad333",
            "created_at": "2026-08-06T23:19:51.795287746Z",
            "filled_qty": "0",
            "id": "7e0478e4-2e65-41ac-a73c-b705ef745754",
            "notional": null,
            "order_class": "mleg",
            "order_type": "limit",
            "position_intent": "sell_to_open",
            "qty": "121",
            "side": "sell",
            "status": "accepted",
            "submitted_at": "2026-08-06T23:19:51.795287746Z",
            "symbol": "SPY260810C00777000",
            "time_in_force": "day",
            "type": "limit",
            "updated_at": "2026-08-06T23:19:51.797372276Z"
          },
          {
            "asset_class": "us_option",
            "asset_id": "82b7221d-05f8-44a5-b4f0-93e9edb5e18b",
            "client_order_id": "7819f2bb-69b8-4c17-8117-c7d66c07204d",
            "created_at": "2026-08-06T23:19:51.795287746Z",
            "filled_qty": "0",
            "id": "db383b29-94e5-4edb-964e-14cfb0334e09",
            "notional": null,
            "order_class": "mleg",
            "order_type": "limit",
            "position_intent": "buy_to_open",
            "qty": "121",
            "side": "buy",
            "status": "accepted",
            "submitted_at": "2026-08-06T23:19:51.795287746Z",
            "symbol": "SPY260810C00778000",
            "time_in_force": "day",
            "type": "limit",
            "updated_at": "2026-08-06T23:19:51.797396396Z"
          }
        ],
        "limit_price": "0.18",
        "notional": null,
        "order_class": "mleg",
        "order_type": "limit",
        "qty": "121",
        "status": "accepted",
        "submitted_at": "2026-08-06T23:19:51.795287746Z",
        "time_in_force": "day",
        "type": "limit",
        "updated_at": "2026-08-06T23:19:51.797354956Z"
      }
    }
  ]
};
