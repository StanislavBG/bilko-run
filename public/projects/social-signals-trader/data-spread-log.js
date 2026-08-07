window.SPREAD_LOG = {
  "generatedAt": "2026-08-07T01:17:26+00:00",
  "strategy": "CREDIT_SPREAD",
  "events": [
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
