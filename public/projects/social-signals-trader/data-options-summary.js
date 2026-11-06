window.OPTIONS_SUMMARY = {
  "generatedAt": "2026-11-06T20:55:04+00:00",
  "record": {
    "schema_version": 5,
    "generated_at": "2026-11-06T20:55:04+00:00",
    "account": {
      "equity": 21294.82,
      "cash": 12131.82,
      "buying_power": 44255.28,
      "options_buying_power": 11063.82,
      "options_approved_level": 3,
      "balance_asof": "2026-11-05"
    },
    "totals": {
      "credit": -17663.0,
      "close_cost": -10066.0,
      "open_pl": -7597.0,
      "max_loss": 59913.0,
      "delta": -148.64,
      "theta": -350.43,
      "vega": 89.23,
      "gamma": 54.15,
      "mark_suspect_count": 7
    },
    "positions": [
      {
        "underlying": "AAPL",
        "right": "put",
        "expiry": "2026-11-13",
        "short_strike": 335.0,
        "long_strike": 337.5,
        "width": 2.5,
        "qty": 14.0,
        "short_symbol": "AAPL261113P00335000",
        "long_symbol": "AAPL261113P00337500",
        "entry": {
          "filled_at": "2026-11-06T14:45:41.826986Z",
          "net_per_contract": 1.0,
          "tag": "WSBM_AAPL-2026-11-06-momo",
          "broker_tag": "WSBM_AAPL-2026-11-06-momo",
          "leg_fill_prices": {
            "AAPL261113P00337500": 4.65,
            "AAPL261113P00335000": 3.65
          },
          "credit": -1400.0,
          "approval": null
        },
        "now": {
          "spot": 342.885,
          "cushion_pct": 0.023,
          "band": "WATCH",
          "close_cost": -798.0,
          "raw_close_cost": -798.0,
          "mark_suspect": false,
          "profit_mark_suspect": false,
          "open_pl": -602.0,
          "max_loss": 4900.0,
          "pct_captured": null,
          "credit_positive": false,
          "breach_px": 336.675,
          "target_close": null,
          "max_loss_close": null
        },
        "greeks": {
          "short_leg_delta": -0.284,
          "short_leg_iv": 0.3178,
          "net": {
            "delta": -0.0566,
            "gamma": 0.0024,
            "theta": -0.0183,
            "vega": 0.0131,
            "rho": -0.0039
          },
          "position": {
            "delta": -79.24,
            "gamma": 3.36,
            "theta": -25.62,
            "vega": 18.34,
            "rho": -5.46
          }
        },
        "quality": {
          "short": {
            "bid": 2.68,
            "ask": 2.78,
            "mid": 2.73,
            "spread_pct": 0.0366
          },
          "long": {
            "bid": 3.35,
            "ask": 3.49,
            "mid": 3.42,
            "spread_pct": 0.0409
          }
        },
        "ev_at_fill": -2394.0,
        "breakeven_credit": 994.0,
        "credit_vs_breakeven_pct": -1.4085,
        "oldest_quote_ts": "2026-11-06T20:55:03.303061917Z"
      },
      {
        "underlying": "AMD",
        "right": "call",
        "expiry": "2026-11-13",
        "short_strike": 472.5,
        "long_strike": 460.0,
        "width": 12.5,
        "qty": 2.0,
        "short_symbol": "AMD261113C00472500",
        "long_symbol": "AMD261113C00460000",
        "entry": {
          "filled_at": "2026-11-06T15:16:59.715Z",
          "net_per_contract": 5.2,
          "tag": "WSBM_AMD-2026-11-06-momo",
          "broker_tag": "WSBM_AMD-2026-11-06-momo",
          "leg_fill_prices": {
            "AMD261113C00460000": 16.85,
            "AMD261113C00472500": 11.65
          },
          "credit": -1040.0,
          "approval": null
        },
        "now": {
          "spot": 444.26,
          "cushion_pct": 0.0636,
          "band": "SAFE",
          "close_cost": -662.0,
          "raw_close_cost": -662.0,
          "mark_suspect": true,
          "profit_mark_suspect": true,
          "open_pl": -378.0,
          "max_loss": 3540.0,
          "pct_captured": null,
          "credit_positive": false,
          "breach_px": 470.1375,
          "target_close": null,
          "max_loss_close": null
        },
        "greeks": {
          "short_leg_delta": 0.3291,
          "short_leg_iv": 0.8716,
          "net": {
            "delta": 0.0844,
            "gamma": 0.0005,
            "theta": -0.1175,
            "vega": 0.0171,
            "rho": 0.0064
          },
          "position": {
            "delta": 16.88,
            "gamma": 0.1,
            "theta": -23.5,
            "vega": 3.42,
            "rho": 1.28
          }
        },
        "quality": {
          "short": {
            "bid": 10.41,
            "ask": 11.35,
            "mid": 10.88,
            "spread_pct": 0.0864
          },
          "long": {
            "bid": 14.66,
            "ask": 15.45,
            "mid": 15.055,
            "spread_pct": 0.0525
          }
        },
        "ev_at_fill": -1862.76,
        "breakeven_credit": 822.75,
        "credit_vs_breakeven_pct": -1.2641,
        "oldest_quote_ts": "2026-11-06T20:55:02.140566937Z"
      },
      {
        "underlying": "INTC",
        "right": "call",
        "expiry": "2026-11-13",
        "short_strike": 60.0,
        "long_strike": 59.0,
        "width": 1.0,
        "qty": 39.0,
        "short_symbol": "INTC261113C00060000",
        "long_symbol": "INTC261113C00059000",
        "entry": {
          "filled_at": "2026-11-06T19:15:29.930974Z",
          "net_per_contract": 0.41,
          "tag": "WSBM_INTC-2026-11-06-momo-a3",
          "broker_tag": "WSBM_INTC-2026-11-06-momo-a3",
          "leg_fill_prices": {
            "INTC261113C00059000": 1.97,
            "INTC261113C00060000": 1.56
          },
          "credit": -1599.0,
          "approval": null
        },
        "now": {
          "spot": 56.285,
          "cushion_pct": 0.066,
          "band": "SAFE",
          "close_cost": -975.0,
          "raw_close_cost": -975.0,
          "mark_suspect": false,
          "profit_mark_suspect": false,
          "open_pl": -624.0,
          "max_loss": 5499.0,
          "pct_captured": null,
          "credit_positive": false,
          "breach_px": 59.7,
          "target_close": null,
          "max_loss_close": null
        },
        "greeks": {
          "short_leg_delta": 0.3211,
          "short_leg_iv": 0.8625,
          "net": {
            "delta": 0.051,
            "gamma": 0.0033,
            "theta": -0.009,
            "vega": 0.0016,
            "rho": 0.0005
          },
          "position": {
            "delta": 198.9,
            "gamma": 12.87,
            "theta": -35.1,
            "vega": 6.24,
            "rho": 1.95
          }
        },
        "quality": {
          "short": {
            "bid": 1.3,
            "ask": 1.34,
            "mid": 1.32,
            "spread_pct": 0.0303
          },
          "long": {
            "bid": 1.59,
            "ask": 1.63,
            "mid": 1.61,
            "spread_pct": 0.0248
          }
        },
        "ev_at_fill": -2851.29,
        "breakeven_credit": 1252.29,
        "credit_vs_breakeven_pct": -1.2769,
        "oldest_quote_ts": "2026-11-06T20:55:01.181116961Z"
      },
      {
        "underlying": "MRNA",
        "right": "call",
        "expiry": "2026-11-06",
        "short_strike": 232.5,
        "long_strike": 230.0,
        "width": 2.5,
        "qty": 13.0,
        "short_symbol": "MRNA261106C00232500",
        "long_symbol": "MRNA261106C00230000",
        "entry": {
          "filled_at": "2026-11-03T18:23:47.823755Z",
          "net_per_contract": 1.65,
          "tag": "EVW_MRNA-2026-11-05-fade",
          "broker_tag": "EVW_MRNA-2026-11-05-fade",
          "leg_fill_prices": {
            "MRNA261106C00230000": 12.0,
            "MRNA261106C00232500": 10.35
          },
          "credit": -2145.0,
          "approval": null
        },
        "now": {
          "spot": 254.51,
          "cushion_pct": -0.0865,
          "band": "BREACHED",
          "close_cost": 1417.0,
          "raw_close_cost": 1417.0,
          "mark_suspect": true,
          "profit_mark_suspect": true,
          "open_pl": -3562.0,
          "max_loss": 5395.0,
          "pct_captured": null,
          "credit_positive": false,
          "breach_px": 231.3375,
          "target_close": null,
          "max_loss_close": null
        },
        "greeks": {
          "short_leg_delta": 0.0,
          "short_leg_iv": null,
          "net": {
            "delta": 0.0,
            "gamma": 0.0,
            "theta": 0.0,
            "vega": 0.0,
            "rho": 0.0
          },
          "position": {
            "delta": 0.0,
            "gamma": 0.0,
            "theta": 0.0,
            "vega": 0.0,
            "rho": 0.0
          }
        },
        "quality": {
          "short": {
            "bid": 20.05,
            "ask": 23.22,
            "mid": 21.635,
            "spread_pct": 0.1465
          },
          "long": {
            "bid": 22.13,
            "ask": 25.92,
            "mid": 24.025,
            "spread_pct": 0.1578
          }
        },
        "ev_at_fill": -2145.0,
        "breakeven_credit": 0.0,
        "credit_vs_breakeven_pct": null,
        "oldest_quote_ts": "2026-11-06T20:54:59.588663433Z"
      },
      {
        "underlying": "NET",
        "right": "put",
        "expiry": "2026-11-20",
        "short_strike": 250.0,
        "long_strike": 260.0,
        "width": 10.0,
        "qty": 3.0,
        "short_symbol": "NET261120P00250000",
        "long_symbol": "NET261120P00260000",
        "entry": {
          "filled_at": "2026-11-06T16:31:43.044818Z",
          "net_per_contract": 3.75,
          "tag": "WSBM_NET-2026-11-06-momo",
          "broker_tag": "WSBM_NET-2026-11-06-momo",
          "leg_fill_prices": {
            "NET261120P00260000": 10.0,
            "NET261120P00250000": 6.25
          },
          "credit": -1125.0,
          "approval": null
        },
        "now": {
          "spot": 269.655,
          "cushion_pct": 0.0729,
          "band": "SAFE",
          "close_cost": -570.0,
          "raw_close_cost": -570.0,
          "mark_suspect": true,
          "profit_mark_suspect": true,
          "open_pl": -555.0,
          "max_loss": 4125.0,
          "pct_captured": null,
          "credit_positive": false,
          "breach_px": 251.25,
          "target_close": null,
          "max_loss_close": null
        },
        "greeks": {
          "short_leg_delta": -0.2821,
          "short_leg_iv": 0.7893,
          "net": {
            "delta": -0.0916,
            "gamma": 0.0009,
            "theta": -0.0602,
            "vega": 0.0216,
            "rho": -0.011
          },
          "position": {
            "delta": -27.48,
            "gamma": 0.27,
            "theta": -18.06,
            "vega": 6.48,
            "rho": -3.3
          }
        },
        "quality": {
          "short": {
            "bid": 7.09,
            "ask": 8.77,
            "mid": 7.93,
            "spread_pct": 0.2119
          },
          "long": {
            "bid": 10.67,
            "ask": 13.0,
            "mid": 11.835,
            "spread_pct": 0.1969
          }
        },
        "ev_at_fill": -1971.3,
        "breakeven_credit": 846.3,
        "credit_vs_breakeven_pct": -1.3293,
        "oldest_quote_ts": "2026-11-06T20:55:02.46548106Z"
      },
      {
        "underlying": "NVDA",
        "right": "put",
        "expiry": "2026-11-13",
        "short_strike": 190.0,
        "long_strike": 192.5,
        "width": 2.5,
        "qty": 15.0,
        "short_symbol": "NVDA261113P00190000",
        "long_symbol": "NVDA261113P00192500",
        "entry": {
          "filled_at": "2026-11-06T14:45:30.217811Z",
          "net_per_contract": 1.05,
          "tag": "WSBM_NVDA-2026-11-06-momo",
          "broker_tag": "WSBM_NVDA-2026-11-06-momo",
          "leg_fill_prices": {
            "NVDA261113P00192500": 5.7,
            "NVDA261113P00190000": 4.65
          },
          "credit": -1575.0,
          "approval": null
        },
        "now": {
          "spot": 186.325,
          "cushion_pct": -0.0197,
          "band": "BREACHED",
          "close_cost": -2190.0,
          "raw_close_cost": -2190.0,
          "mark_suspect": false,
          "profit_mark_suspect": false,
          "open_pl": 615.0,
          "max_loss": 5325.0,
          "pct_captured": null,
          "credit_positive": false,
          "breach_px": 190.95,
          "target_close": null,
          "max_loss_close": null
        },
        "greeks": {
          "short_leg_delta": -0.5719,
          "short_leg_iv": 0.6068,
          "net": {
            "delta": -0.0593,
            "gamma": -0.0011,
            "theta": 0.0165,
            "vega": -0.004,
            "rho": -0.0024
          },
          "position": {
            "delta": -88.95,
            "gamma": -1.65,
            "theta": 24.75,
            "vega": -6.0,
            "rho": -3.6
          }
        },
        "quality": {
          "short": {
            "bid": 8.1,
            "ask": 8.35,
            "mid": 8.225,
            "spread_pct": 0.0304
          },
          "long": {
            "bid": 9.81,
            "ask": 9.86,
            "mid": 9.835,
            "spread_pct": 0.0051
          }
        },
        "ev_at_fill": -3719.55,
        "breakeven_credit": 2144.62,
        "credit_vs_breakeven_pct": -0.7344,
        "oldest_quote_ts": "2026-11-06T20:55:05.107183315Z"
      },
      {
        "underlying": "ORCL",
        "right": "call",
        "expiry": "2026-11-13",
        "short_strike": 120.0,
        "long_strike": 117.0,
        "width": 3.0,
        "qty": 12.0,
        "short_symbol": "ORCL261113C00120000",
        "long_symbol": "ORCL261113C00117000",
        "entry": {
          "filled_at": "2026-11-06T18:18:21.267691Z",
          "net_per_contract": 1.17,
          "tag": "WSBM_ORCL-2026-11-06-momo",
          "broker_tag": "WSBM_ORCL-2026-11-06-momo",
          "leg_fill_prices": {
            "ORCL261113C00117000": 3.3,
            "ORCL261113C00120000": 2.13
          },
          "credit": -1404.0,
          "approval": null
        },
        "now": {
          "spot": 115.58,
          "cushion_pct": 0.0382,
          "band": "WATCH",
          "close_cost": -1392.0,
          "raw_close_cost": -1392.0,
          "mark_suspect": true,
          "profit_mark_suspect": true,
          "open_pl": -12.0,
          "max_loss": 5004.0,
          "pct_captured": null,
          "credit_positive": false,
          "breach_px": 119.4,
          "target_close": null,
          "max_loss_close": null
        },
        "greeks": {
          "short_leg_delta": 0.3676,
          "short_leg_iv": 0.6899,
          "net": {
            "delta": 0.1063,
            "gamma": 0.0003,
            "theta": -0.0326,
            "vega": 0.0034,
            "rho": 0.0021
          },
          "position": {
            "delta": 127.56,
            "gamma": 0.36,
            "theta": -39.12,
            "vega": 4.08,
            "rho": 2.52
          }
        },
        "quality": {
          "short": {
            "bid": 2.59,
            "ask": 2.7,
            "mid": 2.645,
            "spread_pct": 0.0416
          },
          "long": {
            "bid": 3.86,
            "ask": 4.13,
            "mid": 3.995,
            "spread_pct": 0.0676
          }
        },
        "ev_at_fill": -2727.36,
        "breakeven_credit": 1323.36,
        "credit_vs_breakeven_pct": -1.0609,
        "oldest_quote_ts": "2026-11-06T20:55:02.189769083Z"
      },
      {
        "underlying": "PLTR",
        "right": "call",
        "expiry": "2026-11-13",
        "short_strike": 167.5,
        "long_strike": 165.0,
        "width": 2.5,
        "qty": 15.0,
        "short_symbol": "PLTR261113C00167500",
        "long_symbol": "PLTR261113C00165000",
        "entry": {
          "filled_at": "2026-11-06T15:03:17.21781Z",
          "net_per_contract": 1.05,
          "tag": "WSBM_PLTR-2026-11-06-momo",
          "broker_tag": "WSBM_PLTR-2026-11-06-momo",
          "leg_fill_prices": {
            "PLTR261113C00165000": 3.95,
            "PLTR261113C00167500": 2.9
          },
          "credit": -1575.0,
          "approval": null
        },
        "now": {
          "spot": 160.16,
          "cushion_pct": 0.0458,
          "band": "WATCH",
          "close_cost": -1155.0,
          "raw_close_cost": -1155.0,
          "mark_suspect": false,
          "profit_mark_suspect": false,
          "open_pl": -420.0,
          "max_loss": 5325.0,
          "pct_captured": null,
          "credit_positive": false,
          "breach_px": 166.6625,
          "target_close": null,
          "max_loss_close": null
        },
        "greeks": {
          "short_leg_delta": 0.3079,
          "short_leg_iv": 0.5944,
          "net": {
            "delta": 0.0699,
            "gamma": 0.0016,
            "theta": -0.0347,
            "vega": 0.0062,
            "rho": 0.002
          },
          "position": {
            "delta": 104.85,
            "gamma": 2.4,
            "theta": -52.05,
            "vega": 9.3,
            "rho": 3.0
          }
        },
        "quality": {
          "short": {
            "bid": 2.46,
            "ask": 2.52,
            "mid": 2.49,
            "spread_pct": 0.0241
          },
          "long": {
            "bid": 3.29,
            "ask": 3.44,
            "mid": 3.365,
            "spread_pct": 0.0446
          }
        },
        "ev_at_fill": -2729.7,
        "breakeven_credit": 1154.63,
        "credit_vs_breakeven_pct": -1.3641,
        "oldest_quote_ts": "2026-11-06T20:55:01.800966548Z"
      },
      {
        "underlying": "RDDT",
        "right": "put",
        "expiry": "2026-11-20",
        "short_strike": 90.0,
        "long_strike": 95.0,
        "width": 5.0,
        "qty": 7.0,
        "short_symbol": "RDDT261120P00090000",
        "long_symbol": "RDDT261120P00095000",
        "entry": {
          "filled_at": "2026-11-06T20:15:47.844151Z",
          "net_per_contract": 2.09,
          "tag": "WSBM_RDDT-2026-11-06-momo-a5",
          "broker_tag": "WSBM_RDDT-2026-11-06-momo-a5",
          "leg_fill_prices": {
            "RDDT261120P00095000": 4.65,
            "RDDT261120P00090000": 2.56
          },
          "credit": -1463.0,
          "approval": null
        },
        "now": {
          "spot": 95.2,
          "cushion_pct": 0.0546,
          "band": "SAFE",
          "close_cost": -1148.0,
          "raw_close_cost": -1148.0,
          "mark_suspect": true,
          "profit_mark_suspect": true,
          "open_pl": -315.0,
          "max_loss": 4963.0,
          "pct_captured": null,
          "credit_positive": false,
          "breach_px": 90.45,
          "target_close": null,
          "max_loss_close": null
        },
        "greeks": {
          "short_leg_delta": -0.3081,
          "short_leg_iv": 0.6752,
          "net": {
            "delta": -0.1557,
            "gamma": 0.005,
            "theta": -0.0113,
            "vega": 0.0085,
            "rho": -0.0064
          },
          "position": {
            "delta": -108.99,
            "gamma": 3.5,
            "theta": -7.91,
            "vega": 5.95,
            "rho": -4.48
          }
        },
        "quality": {
          "short": {
            "bid": 2.57,
            "ask": 2.77,
            "mid": 2.67,
            "spread_pct": 0.0749
          },
          "long": {
            "bid": 4.41,
            "ask": 4.87,
            "mid": 4.64,
            "spread_pct": 0.0991
          }
        },
        "ev_at_fill": -2541.35,
        "breakeven_credit": 1078.35,
        "credit_vs_breakeven_pct": -1.3567,
        "oldest_quote_ts": "2026-11-06T20:55:03.534862227Z"
      },
      {
        "underlying": "SOXL",
        "right": "put",
        "expiry": "2026-11-13",
        "short_strike": 40.0,
        "long_strike": 42.0,
        "width": 2.0,
        "qty": 18.0,
        "short_symbol": "SOXL261113P00040000",
        "long_symbol": "SOXL261113P00042000",
        "entry": {
          "filled_at": "2026-11-06T15:45:28.765243Z",
          "net_per_contract": 0.85,
          "tag": "WSBM_SOXL-2026-11-06-momo-a3",
          "broker_tag": "WSBM_SOXL-2026-11-06-momo-a3",
          "leg_fill_prices": {
            "SOXL261113P00042000": 4.0,
            "SOXL261113P00040000": 3.15
          },
          "credit": -1530.0,
          "approval": null
        },
        "now": {
          "spot": 45.315,
          "cushion_pct": 0.1173,
          "band": "SAFE",
          "close_cost": -1350.0,
          "raw_close_cost": -1350.0,
          "mark_suspect": false,
          "profit_mark_suspect": false,
          "open_pl": -180.0,
          "max_loss": 5130.0,
          "pct_captured": null,
          "credit_positive": false,
          "breach_px": 40.2,
          "target_close": null,
          "max_loss_close": null
        },
        "greeks": {
          "short_leg_delta": -0.2877,
          "short_leg_iv": 2.2652,
          "net": {
            "delta": -0.055,
            "gamma": 0.002,
            "theta": -0.024,
            "vega": 0.0017,
            "rho": -0.0006
          },
          "position": {
            "delta": -99.0,
            "gamma": 3.6,
            "theta": -43.2,
            "vega": 3.06,
            "rho": -1.08
          }
        },
        "quality": {
          "short": {
            "bid": 3.02,
            "ask": 3.07,
            "mid": 3.045,
            "spread_pct": 0.0164
          },
          "long": {
            "bid": 3.82,
            "ask": 3.93,
            "mid": 3.875,
            "spread_pct": 0.0284
          }
        },
        "ev_at_fill": -2565.72,
        "breakeven_credit": 1035.72,
        "credit_vs_breakeven_pct": -1.4772,
        "oldest_quote_ts": "2026-11-06T20:55:01.802583689Z"
      },
      {
        "underlying": "TSLA",
        "right": "call",
        "expiry": "2026-11-13",
        "short_strike": 372.5,
        "long_strike": 370.0,
        "width": 2.5,
        "qty": 16.0,
        "short_symbol": "TSLA261113C00372500",
        "long_symbol": "TSLA261113C00370000",
        "entry": {
          "filled_at": "2026-11-06T15:38:39.499146Z",
          "net_per_contract": 0.95,
          "tag": "WSBM_TSLA-2026-11-06-momo-a2",
          "broker_tag": "WSBM_TSLA-2026-11-06-momo-a2",
          "leg_fill_prices": {
            "TSLA261113C00370000": 6.55,
            "TSLA261113C00372500": 5.6
          },
          "credit": -1520.0,
          "approval": null
        },
        "now": {
          "spot": 358.06,
          "cushion_pct": 0.0403,
          "band": "WATCH",
          "close_cost": -736.0,
          "raw_close_cost": -736.0,
          "mark_suspect": true,
          "profit_mark_suspect": true,
          "open_pl": -784.0,
          "max_loss": 5520.0,
          "pct_captured": null,
          "credit_positive": false,
          "breach_px": 370.6375,
          "target_close": null,
          "max_loss_close": null
        },
        "greeks": {
          "short_leg_delta": 0.3205,
          "short_leg_iv": 0.5536,
          "net": {
            "delta": 0.036,
            "gamma": 0.0003,
            "theta": -0.048,
            "vega": 0.0074,
            "rho": 0.0022
          },
          "position": {
            "delta": 57.6,
            "gamma": 0.48,
            "theta": -76.8,
            "vega": 11.84,
            "rho": 3.52
          }
        },
        "quality": {
          "short": {
            "bid": 5.31,
            "ask": 5.68,
            "mid": 5.495,
            "spread_pct": 0.0673
          },
          "long": {
            "bid": 6.14,
            "ask": 6.88,
            "mid": 6.51,
            "spread_pct": 0.1137
          }
        },
        "ev_at_fill": -2801.92,
        "breakeven_credit": 1282.0,
        "credit_vs_breakeven_pct": -1.1856,
        "oldest_quote_ts": "2026-11-06T20:55:01.758644878Z"
      },
      {
        "underlying": "WMT",
        "right": "put",
        "expiry": "2026-11-13",
        "short_strike": 122.0,
        "long_strike": 123.0,
        "width": 1.0,
        "qty": 39.0,
        "short_symbol": "WMT261113P00122000",
        "long_symbol": "WMT261113P00123000",
        "entry": {
          "filled_at": "2026-11-06T15:12:41.629556Z",
          "net_per_contract": 0.33,
          "tag": "WSBM_WMT-2026-11-06-momo",
          "broker_tag": "WSBM_WMT-2026-11-06-momo",
          "leg_fill_prices": {
            "WMT261113P00123000": 1.23,
            "WMT261113P00122000": 0.9
          },
          "credit": -1287.0,
          "approval": null
        },
        "now": {
          "spot": 125.485,
          "cushion_pct": 0.0278,
          "band": "WATCH",
          "close_cost": -507.0,
          "raw_close_cost": -507.0,
          "mark_suspect": true,
          "profit_mark_suspect": true,
          "open_pl": -780.0,
          "max_loss": 5187.0,
          "pct_captured": null,
          "credit_positive": false,
          "breach_px": 122.61,
          "target_close": null,
          "max_loss_close": null
        },
        "greeks": {
          "short_leg_delta": -0.2399,
          "short_leg_iv": 0.3032,
          "net": {
            "delta": -0.0643,
            "gamma": 0.0074,
            "theta": -0.0138,
            "vega": 0.0068,
            "rho": -0.0016
          },
          "position": {
            "delta": -250.77,
            "gamma": 28.86,
            "theta": -53.82,
            "vega": 26.52,
            "rho": -6.24
          }
        },
        "quality": {
          "short": {
            "bid": 0.69,
            "ask": 0.83,
            "mid": 0.76,
            "spread_pct": 0.1842
          },
          "long": {
            "bid": 0.96,
            "ask": 1.13,
            "mid": 1.045,
            "spread_pct": 0.1627
          }
        },
        "ev_at_fill": -2222.61,
        "breakeven_credit": 935.61,
        "credit_vs_breakeven_pct": -1.3756,
        "oldest_quote_ts": "2026-11-06T20:55:04.42774065Z"
      }
    ],
    "unpaired_legs": [],
    "oldest_quote_ts": "2026-11-06T20:54:59.588663433Z",
    "beta_gate": {
      "measurement": {
        "status": "measured",
        "n": 102,
        "min_sample": 20,
        "beta": 0.9011,
        "realized_breach_rate": 0.1961,
        "implied_breach_rate": 0.2176,
        "n_breaches": 20,
        "ci_low": 0.5457,
        "ci_high": 1.2566,
        "n_clusters": 11,
        "by_dte_bucket": {
          "0-4": {
            "n": 9,
            "status": "insufficient_sample",
            "beta": null
          },
          "5-9": {
            "n": 58,
            "status": "measured",
            "realized_breach_rate": 0.1897,
            "implied_breach_rate": 0.2052,
            "beta": 0.9243
          },
          "10-14": {
            "n": 21,
            "status": "measured",
            "realized_breach_rate": 0.2381,
            "implied_breach_rate": 0.2439,
            "beta": 0.9763
          },
          "15+": {
            "n": 14,
            "status": "insufficient_sample",
            "beta": null
          }
        }
      },
      "deployment_cap": {
        "cap": 0.95,
        "target_invested_pct": 0.95,
        "beta": 0.9011,
        "ci_low": 0.5457,
        "ci_high": 1.2566,
        "n": 102,
        "min_sample": 20,
        "confidence": 0.0,
        "reason": "beta=0.9011 (n=102, conservative/ci_high=1.2566) supports 0% of the lift from the floor 95% to the target 95% \u2014 deployment capped at 95% of equity."
      }
    },
    "mandatePace": {
      "targetAnnual": 5.0,
      "requiredMonthly": 0.16103667237399422,
      "requiredWeekly": 0.03505742976103665,
      "sinceInception": {
        "return": -0.7870518,
        "annualized": -0.9011073679991826,
        "days": 244
      },
      "trailing30d": {
        "return": -0.7117706056319918,
        "requiredForWindow": 0.15866432945917186,
        "onPace": false
      },
      "trailing7d": {
        "return": -0.42521232504187123,
        "requiredForWindow": 0.03495972236295897,
        "onPace": false
      },
      "projectedYearEnd": -0.9999997328128247
    }
  },
  "summary": "Today: -$1,640 (-7.2%). Realized -$1,221 \u00b7 open marks -$419 \u00b7 12 spreads live, 2 breached, -$350/day decay working against us.\n\n## Where the book stands\n\n- Account equity: $21,294.82\n- Cash: $12,131.82\n- Open spreads: 12  \u00b7  unpaired legs: 0\n- Bands: 2 BREACHED, 5 SAFE, 5 WATCH\n- Book totals (as stored): credit -$17,663.00, close cost -$10,066.00, open P/L -$7,597, max loss $59,913.00\n- Book greeks (confidence-gated \u2014 wide-quoted legs excluded): delta -148.6, theta -$350/day, vega +89.2, gamma +54.1\n- Spot quotes: last close (market closed)\n- \u26a0 EQUITY RECONCILIATION MISMATCH: no positions opened/closed this interval, but open marks moved -$419 while account equity moved -$1,640. Treat both numbers with suspicion.\n\n## Positions \u2014 entry snapshot (frozen) vs now (live)\n\n| Spread | Contracts | Proposal | FROZEN entry (filled / net per contract / total credit) | LIVE spread price / contract (position total) (\u0394) | LIVE spot | LIVE cushion (\u0394) | LIVE band | LIVE open P/L (\u0394) | % captured | short \u0394 (\u0394) | conf | Legs | Structure | Collateral | Credit |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|\n| AAPL put 335.0/337.5 2026-11-13 | 14 | \u2014 | Nov 6, 9:45 AM EST / -1.00 / -$1,400.00 debit | -$0.57 (-$798) (-$98) | 342.88 | +2.30% (-0.14%) | WATCH | -$602 (+$98) | n/a | -0.284 (-0.013) | ok | 335P/337.5P | spread | $3,500 | -$1,400 |\n| AMD call 472.5/460.0 2026-11-13 | 2 | \u2014 | Nov 6, 10:16 AM EST / -5.20 / -$1,040.00 debit | -$3.31 (-$662) (+$184) | 444.26 | +6.36% (+0.71%) | SAFE | -$378 (-$184) | n/a | +0.329 (-0.018) | ok | 472.5C/460C | spread | $2,500 | -$1,040 |\n| INTC call 60.0/59.0 2026-11-13 | 39 | \u2014 | Nov 6, 2:15 PM EST / -0.41 / -$1,599.00 debit | -$0.25 (-$975) (+$117) | 56.28 | +6.60% (-0.08%) | SAFE | -$624 (-$117) | n/a | +0.321 (+0.010) | ok | 60C/59C | spread | $3,900 | -$1,599 |\n| MRNA call 232.5/230.0 2026-11-06 | 13 | \u2014 | Nov 3, 1:23 PM EST / -1.65 / -$2,145.00 debit | $1.09 ($1,417) (+$247) | 254.51 | -8.65% (+2.36%) | BREACHED | -$3,562 (-$247) | n/a | 0.000 (0.000) | ok | 232.5C/230C | spread | $3,250 | -$2,145 |\n| NET put 250.0/260.0 2026-11-20 | 3 | \u2014 | Nov 6, 11:31 AM EST / -3.75 / -$1,125.00 debit | -$1.90 (-$570) (+$108) | 269.65 | +7.29% (-0.49%) | SAFE | -$555 (-$108) | n/a | -0.282 (-0.014) | ok | 250P/260P | spread | $3,000 | -$1,125 |\n| NVDA put 190.0/192.5 2026-11-13 | 15 | \u2014 | Nov 6, 9:45 AM EST / -1.05 / -$1,575.00 debit | -$1.46 (-$2,190) (-$285) | 186.32 | -1.97% (-0.52%) | BREACHED | +$615 (+$285) | n/a | -0.572 (-0.024) | ok | 190P/192.5P | spread | $3,750 | -$1,575 |\n| ORCL call 120.0/117.0 2026-11-13 | 12 | \u2014 | Nov 6, 1:18 PM EST / -1.17 / -$1,404.00 debit | -$1.16 (-$1,392) (-$156) | 115.58 | +3.82% (-0.11%) | WATCH | -$12 (+$156) | n/a | +0.368 (+0.005) | ok | 120C/117C | spread | $3,600 | -$1,404 |\n| PLTR call 167.5/165.0 2026-11-13 | 15 | \u2014 | Nov 6, 10:03 AM EST / -1.05 / -$1,575.00 debit | -$0.77 (-$1,155) (+$90) | 160.16 | +4.58% (+0.54%) | WATCH | -$420 (-$90) | n/a | +0.308 (-0.020) | ok | 167.5C/165C | spread | $3,750 | -$1,575 |\n| RDDT put 90.0/95.0 2026-11-20 | 7 | \u2014 | Nov 6, 3:15 PM EST / -2.09 / -$1,463.00 debit | -$1.64 (-$1,148) (-$63) | 95.20 | +5.46% (+0.03%) | SAFE | -$315 (+$63) | n/a | -0.308 (+0.001) | ok | 90P/95P | spread | $3,500 | -$1,463 |\n| SOXL put 40.0/42.0 2026-11-13 | 18 | \u2014 | Nov 6, 10:45 AM EST / -0.85 / -$1,530.00 debit | -$0.75 (-$1,350) (-$432) | 45.31 | +11.73% (-0.76%) | SAFE | -$180 (+$432) | n/a | -0.288 (-0.008) | ok | 40P/42P | spread | $3,600 | -$1,530 |\n| TSLA call 372.5/370.0 2026-11-13 | 16 | \u2014 | Nov 6, 10:38 AM EST / -0.95 / -$1,520.00 debit | -$0.46 (-$736) (+$512) | 358.06 | +4.03% (+0.60%) | WATCH | -$784 (-$512) | n/a | +0.321 (-0.025) | ok | 372.5C/370C | spread | $4,000 | -$1,520 |\n| WMT put 122.0/123.0 2026-11-13 | 39 | \u2014 | Nov 6, 10:12 AM EST / -0.33 / -$1,287.00 debit | -$0.13 (-$507) (+$195) | 125.48 | +2.78% (-0.14%) | WATCH | -$780 (-$195) | n/a | -0.240 (-0.015) | ok | 122P/123P | spread | $3,900 | -$1,287 |\n\n## What we think right now\n\n- **AAPL put 335.0/337.5** (2026-11-13, 7d): spot 342.88, cushion 2.3%, credit -$1,400.00 vs close-cost -$798.00 (n/a captured); exit: strike-breach buffer at 336.675. <!-- id:pos-AAPL-put-335.0-2026-11-13 -->\n- **AMD call 472.5/460.0** (2026-11-13, 7d): spot 444.26, cushion 6.4%, credit -$1,040.00 vs close-cost -$662.00 (n/a captured); exit: strike-breach buffer at 470.137. <!-- id:pos-AMD-call-472.5-2026-11-13 -->\n- **INTC call 60.0/59.0** (2026-11-13, 7d): spot 56.28, cushion 6.6%, credit -$1,599.00 vs close-cost -$975.00 (n/a captured); exit: strike-breach buffer at 59.7. <!-- id:pos-INTC-call-60.0-2026-11-13 -->\n- **MRNA call 232.5/230.0** (2026-11-06, 0d): spot 254.51, cushion -8.6%, credit -$2,145.00 vs close-cost $1,417.00 (n/a captured); exit: strike-breach buffer at 231.338. <!-- id:pos-MRNA-call-232.5-2026-11-06 -->\n- **NET put 250.0/260.0** (2026-11-20, 14d): spot 269.65, cushion 7.3%, credit -$1,125.00 vs close-cost -$570.00 (n/a captured); exit: strike-breach buffer at 251.25. <!-- id:pos-NET-put-250.0-2026-11-20 -->\n- **NVDA put 190.0/192.5** (2026-11-13, 7d): spot 186.32, cushion -2.0%, credit -$1,575.00 vs close-cost -$2,190.00 (n/a captured); exit: strike-breach buffer at 190.95. <!-- id:pos-NVDA-put-190.0-2026-11-13 -->\n- **ORCL call 120.0/117.0** (2026-11-13, 7d): spot 115.58, cushion 3.8%, credit -$1,404.00 vs close-cost -$1,392.00 (n/a captured); exit: strike-breach buffer at 119.4. <!-- id:pos-ORCL-call-120.0-2026-11-13 -->\n- **PLTR call 167.5/165.0** (2026-11-13, 7d): spot 160.16, cushion 4.6%, credit -$1,575.00 vs close-cost -$1,155.00 (n/a captured); exit: strike-breach buffer at 166.662. <!-- id:pos-PLTR-call-167.5-2026-11-13 -->\n- **RDDT put 90.0/95.0** (2026-11-20, 14d): spot 95.20, cushion 5.5%, credit -$1,463.00 vs close-cost -$1,148.00 (n/a captured); exit: strike-breach buffer at 90.45. <!-- id:pos-RDDT-put-90.0-2026-11-20 -->\n- **SOXL put 40.0/42.0** (2026-11-13, 7d): spot 45.31, cushion 11.7%, credit -$1,530.00 vs close-cost -$1,350.00 (n/a captured); exit: strike-breach buffer at 40.2. <!-- id:pos-SOXL-put-40.0-2026-11-13 -->\n- **TSLA call 372.5/370.0** (2026-11-13, 7d): spot 358.06, cushion 4.0%, credit -$1,520.00 vs close-cost -$736.00 (n/a captured); exit: strike-breach buffer at 370.637. <!-- id:pos-TSLA-call-372.5-2026-11-13 -->\n- **WMT put 122.0/123.0** (2026-11-13, 7d): spot 125.48, cushion 2.8%, credit -$1,287.00 vs close-cost -$507.00 (n/a captured); exit: strike-breach buffer at 122.61. <!-- id:pos-WMT-put-122.0-2026-11-13 -->\n\n## Action queue\n\n0 armed \u00b7 12 watching \u00b7 7 blocked \u00b7 $0.00 total at stake\nMarket closed \u2014 nothing executes until the next regular session.\n\n**Watching**\n\n- \ud83d\udd34 MRNA call 232.5/230.0 2026-11-06: strike BREACHED \u2014 close on breach policy \u2014 -$3,562.00 of $5,395.00 risked <!-- id:pos-MRNA-call-232.5-2026-11-06 -->\n- \ud83d\udd35 MRNA call 232.5/230.0 2026-11-06: entered at a net debit \u2014 no percent exit rule applies \u2014 -$3,562.00 of $5,395.00 risked <!-- id:pos-MRNA-call-232.5-2026-11-06 -->\n- \ud83d\udd35 TSLA call 372.5/370.0 2026-11-13: entered at a net debit \u2014 no percent exit rule applies \u2014 -$784.00 of $5,520.00 risked <!-- id:pos-TSLA-call-372.5-2026-11-13 -->\n- \ud83d\udd35 WMT put 122.0/123.0 2026-11-13: entered at a net debit \u2014 no percent exit rule applies \u2014 -$780.00 of $5,187.00 risked <!-- id:pos-WMT-put-122.0-2026-11-13 -->\n- \ud83d\udd35 INTC call 60.0/59.0 2026-11-13: entered at a net debit \u2014 no percent exit rule applies \u2014 -$624.00 of $5,499.00 risked <!-- id:pos-INTC-call-60.0-2026-11-13 -->\n- \ud83d\udd34 NVDA put 190.0/192.5 2026-11-13: strike BREACHED \u2014 close on breach policy \u2014 +$615.00 of $5,325.00 risked <!-- id:pos-NVDA-put-190.0-2026-11-13 -->\n- \ud83d\udd35 NVDA put 190.0/192.5 2026-11-13: entered at a net debit \u2014 no percent exit rule applies \u2014 +$615.00 of $5,325.00 risked <!-- id:pos-NVDA-put-190.0-2026-11-13 -->\n- \ud83d\udd35 AAPL put 335.0/337.5 2026-11-13: entered at a net debit \u2014 no percent exit rule applies \u2014 -$602.00 of $4,900.00 risked <!-- id:pos-AAPL-put-335.0-2026-11-13 -->\n- \ud83d\udd35 NET put 250.0/260.0 2026-11-20: entered at a net debit \u2014 no percent exit rule applies \u2014 -$555.00 of $4,125.00 risked <!-- id:pos-NET-put-250.0-2026-11-20 -->\n- \ud83d\udd35 PLTR call 167.5/165.0 2026-11-13: entered at a net debit \u2014 no percent exit rule applies \u2014 -$420.00 of $5,325.00 risked <!-- id:pos-PLTR-call-167.5-2026-11-13 -->\n- \ud83d\udd35 AMD call 472.5/460.0 2026-11-13: entered at a net debit \u2014 no percent exit rule applies \u2014 -$378.00 of $3,540.00 risked <!-- id:pos-AMD-call-472.5-2026-11-13 -->\n- \ud83d\udd35 RDDT put 90.0/95.0 2026-11-20: entered at a net debit \u2014 no percent exit rule applies \u2014 -$315.00 of $4,963.00 risked <!-- id:pos-RDDT-put-90.0-2026-11-20 -->\n- \ud83d\udd35 SOXL put 40.0/42.0 2026-11-13: entered at a net debit \u2014 no percent exit rule applies \u2014 -$180.00 of $5,130.00 risked <!-- id:pos-SOXL-put-40.0-2026-11-13 -->\n- \ud83d\udd35 ORCL call 120.0/117.0 2026-11-13: entered at a net debit \u2014 no percent exit rule applies \u2014 -$12.00 of $5,004.00 risked <!-- id:pos-ORCL-call-120.0-2026-11-13 -->\n\n\n## Open queue\n\n- Deployed $29,150.00 of target $61,717.67 (44.9% of equity) \u2014 headroom $32,567.67\n- 1 entry order(s) working at the broker \u2014 submitted, not yet filled ($5,658.00 gross collateral, `working_entries`)\nNo queued candidates.\n\n## Rules in force\n\n- `hold_to_expiry`: False\n- `profit_target_pct`: 0.5\n- `max_loss_pct`: 1.0\n- `close_on_strike_breach`: True\n- `strike_breach_buffer_pct`: 0.005\n- `max_short_delta`: 0.34\n- `min_pop`: 0.68\n- `min_dte`: 4\n- `max_dte`: 21\n- `index_max_dte`: 13\n- `max_per_underlying`: 3\n- `live`: True\n\n- **Beta (realized/implied breach rate)**: 0.9011 (n=102, 95% CI [0.5457, 1.2566])\n- Deployment cap: 95.0% of equity \u2014 beta=0.9011 (n=102, conservative/ci_high=1.2566) supports 0% of the lift from the floor 95% to the target 95% \u2014 deployment capped at 95% of equity.\n\n## Provenance\n\n- Record generated: 2026-11-06T20:55:04+00:00 (0m ago)\n- Oldest quote: 2026-11-06T20:54:59.588663433Z (0m ago)\n- SPREAD_PLAN generated: 2026-10-08T19:47:23+00:00 (29.0d ago)\n- Prior snapshot: 2026-11-06T20:45:05+00:00\n",
  "positions_display": [
    {
      "short_symbol": "AAPL261113P00335000",
      "structure": "spread",
      "member_symbols": [
        "AAPL261113P00335000"
      ],
      "calc": {
        "collateral": 3500.0,
        "credit": -1400.0,
        "close_cost": -798.0,
        "contracts": 14.0,
        "max_width": 2.5,
        "put_width": 2.5,
        "call_width": 0.0,
        "put_short_leg_delta": null,
        "call_short_leg_delta": null,
        "put_close_cost": null,
        "call_close_cost": null,
        "put_short_strike": null,
        "call_short_strike": null
      },
      "cells": {
        "spread": "AAPL put 335.0/337.5 2026-11-13",
        "spread_compact": "AAPL 335/337.5 P",
        "legs": "335P/337.5P",
        "structure": "spread",
        "contracts": "14",
        "proposal": "\u2014",
        "frozen_entry": "Nov 6, 9:45 AM EST / -1.00 / -$1,400.00 debit",
        "frozen_entry_compact": "-$1,400 debit @ -1.00",
        "expiry_compact": "Nov 13 \u00b7 7d",
        "collateral": "$3,500",
        "credit": "-$1,400",
        "spread_price": "-$0.57 (-$798) (-$98)",
        "entry_credit_per_contract": "-$100.00",
        "live_price_per_contract": "-$57.00",
        "spot": "342.88",
        "cushion": "+2.30% (-0.14%)",
        "band": "WATCH",
        "open_pl": "-$602 (+$98)",
        "pct_captured": "n/a",
        "short_delta": "-0.284 (-0.013)",
        "conf": "ok"
      }
    },
    {
      "short_symbol": "AMD261113C00472500",
      "structure": "spread",
      "member_symbols": [
        "AMD261113C00472500"
      ],
      "calc": {
        "collateral": 2500.0,
        "credit": -1040.0,
        "close_cost": -662.0,
        "contracts": 2.0,
        "max_width": 12.5,
        "put_width": 0.0,
        "call_width": 12.5,
        "put_short_leg_delta": null,
        "call_short_leg_delta": null,
        "put_close_cost": null,
        "call_close_cost": null,
        "put_short_strike": null,
        "call_short_strike": null
      },
      "cells": {
        "spread": "AMD call 472.5/460.0 2026-11-13",
        "spread_compact": "AMD 472.5/460 C",
        "legs": "472.5C/460C",
        "structure": "spread",
        "contracts": "2",
        "proposal": "\u2014",
        "frozen_entry": "Nov 6, 10:16 AM EST / -5.20 / -$1,040.00 debit",
        "frozen_entry_compact": "-$1,040 debit @ -5.20",
        "expiry_compact": "Nov 13 \u00b7 7d",
        "collateral": "$2,500",
        "credit": "-$1,040",
        "spread_price": "-$3.31 (-$662) (+$184)",
        "entry_credit_per_contract": "-$520.00",
        "live_price_per_contract": "-$331.00",
        "spot": "444.26",
        "cushion": "+6.36% (+0.71%)",
        "band": "SAFE",
        "open_pl": "-$378 (-$184)",
        "pct_captured": "n/a",
        "short_delta": "+0.329 (-0.018)",
        "conf": "ok"
      }
    },
    {
      "short_symbol": "INTC261113C00060000",
      "structure": "spread",
      "member_symbols": [
        "INTC261113C00060000"
      ],
      "calc": {
        "collateral": 3900.0,
        "credit": -1599.0,
        "close_cost": -975.0,
        "contracts": 39.0,
        "max_width": 1.0,
        "put_width": 0.0,
        "call_width": 1.0,
        "put_short_leg_delta": null,
        "call_short_leg_delta": null,
        "put_close_cost": null,
        "call_close_cost": null,
        "put_short_strike": null,
        "call_short_strike": null
      },
      "cells": {
        "spread": "INTC call 60.0/59.0 2026-11-13",
        "spread_compact": "INTC 60/59 C",
        "legs": "60C/59C",
        "structure": "spread",
        "contracts": "39",
        "proposal": "\u2014",
        "frozen_entry": "Nov 6, 2:15 PM EST / -0.41 / -$1,599.00 debit",
        "frozen_entry_compact": "-$1,599 debit @ -0.41",
        "expiry_compact": "Nov 13 \u00b7 7d",
        "collateral": "$3,900",
        "credit": "-$1,599",
        "spread_price": "-$0.25 (-$975) (+$117)",
        "entry_credit_per_contract": "-$41.00",
        "live_price_per_contract": "-$25.00",
        "spot": "56.28",
        "cushion": "+6.60% (-0.08%)",
        "band": "SAFE",
        "open_pl": "-$624 (-$117)",
        "pct_captured": "n/a",
        "short_delta": "+0.321 (+0.010)",
        "conf": "ok"
      }
    },
    {
      "short_symbol": "MRNA261106C00232500",
      "structure": "spread",
      "member_symbols": [
        "MRNA261106C00232500"
      ],
      "calc": {
        "collateral": 3250.0,
        "credit": -2145.0,
        "close_cost": 1417.0,
        "contracts": 13.0,
        "max_width": 2.5,
        "put_width": 0.0,
        "call_width": 2.5,
        "put_short_leg_delta": null,
        "call_short_leg_delta": null,
        "put_close_cost": null,
        "call_close_cost": null,
        "put_short_strike": null,
        "call_short_strike": null
      },
      "cells": {
        "spread": "MRNA call 232.5/230.0 2026-11-06",
        "spread_compact": "MRNA 232.5/230 C",
        "legs": "232.5C/230C",
        "structure": "spread",
        "contracts": "13",
        "proposal": "\u2014",
        "frozen_entry": "Nov 3, 1:23 PM EST / -1.65 / -$2,145.00 debit",
        "frozen_entry_compact": "-$2,145 debit @ -1.65",
        "expiry_compact": "Nov 6 \u00b7 0d",
        "collateral": "$3,250",
        "credit": "-$2,145",
        "spread_price": "$1.09 ($1,417) (+$247)",
        "entry_credit_per_contract": "-$165.00",
        "live_price_per_contract": "$109.00",
        "spot": "254.51",
        "cushion": "-8.65% (+2.36%)",
        "band": "BREACHED",
        "open_pl": "-$3,562 (-$247)",
        "pct_captured": "n/a",
        "short_delta": "0.000 (0.000)",
        "conf": "ok"
      }
    },
    {
      "short_symbol": "NET261120P00250000",
      "structure": "spread",
      "member_symbols": [
        "NET261120P00250000"
      ],
      "calc": {
        "collateral": 3000.0,
        "credit": -1125.0,
        "close_cost": -570.0,
        "contracts": 3.0,
        "max_width": 10.0,
        "put_width": 10.0,
        "call_width": 0.0,
        "put_short_leg_delta": null,
        "call_short_leg_delta": null,
        "put_close_cost": null,
        "call_close_cost": null,
        "put_short_strike": null,
        "call_short_strike": null
      },
      "cells": {
        "spread": "NET put 250.0/260.0 2026-11-20",
        "spread_compact": "NET 250/260 P",
        "legs": "250P/260P",
        "structure": "spread",
        "contracts": "3",
        "proposal": "\u2014",
        "frozen_entry": "Nov 6, 11:31 AM EST / -3.75 / -$1,125.00 debit",
        "frozen_entry_compact": "-$1,125 debit @ -3.75",
        "expiry_compact": "Nov 20 \u00b7 14d",
        "collateral": "$3,000",
        "credit": "-$1,125",
        "spread_price": "-$1.90 (-$570) (+$108)",
        "entry_credit_per_contract": "-$375.00",
        "live_price_per_contract": "-$190.00",
        "spot": "269.65",
        "cushion": "+7.29% (-0.49%)",
        "band": "SAFE",
        "open_pl": "-$555 (-$108)",
        "pct_captured": "n/a",
        "short_delta": "-0.282 (-0.014)",
        "conf": "ok"
      }
    },
    {
      "short_symbol": "NVDA261113P00190000",
      "structure": "spread",
      "member_symbols": [
        "NVDA261113P00190000"
      ],
      "calc": {
        "collateral": 3750.0,
        "credit": -1575.0,
        "close_cost": -2190.0,
        "contracts": 15.0,
        "max_width": 2.5,
        "put_width": 2.5,
        "call_width": 0.0,
        "put_short_leg_delta": null,
        "call_short_leg_delta": null,
        "put_close_cost": null,
        "call_close_cost": null,
        "put_short_strike": null,
        "call_short_strike": null
      },
      "cells": {
        "spread": "NVDA put 190.0/192.5 2026-11-13",
        "spread_compact": "NVDA 190/192.5 P",
        "legs": "190P/192.5P",
        "structure": "spread",
        "contracts": "15",
        "proposal": "\u2014",
        "frozen_entry": "Nov 6, 9:45 AM EST / -1.05 / -$1,575.00 debit",
        "frozen_entry_compact": "-$1,575 debit @ -1.05",
        "expiry_compact": "Nov 13 \u00b7 7d",
        "collateral": "$3,750",
        "credit": "-$1,575",
        "spread_price": "-$1.46 (-$2,190) (-$285)",
        "entry_credit_per_contract": "-$105.00",
        "live_price_per_contract": "-$146.00",
        "spot": "186.32",
        "cushion": "-1.97% (-0.52%)",
        "band": "BREACHED",
        "open_pl": "+$615 (+$285)",
        "pct_captured": "n/a",
        "short_delta": "-0.572 (-0.024)",
        "conf": "ok"
      }
    },
    {
      "short_symbol": "ORCL261113C00120000",
      "structure": "spread",
      "member_symbols": [
        "ORCL261113C00120000"
      ],
      "calc": {
        "collateral": 3600.0,
        "credit": -1404.0,
        "close_cost": -1392.0,
        "contracts": 12.0,
        "max_width": 3.0,
        "put_width": 0.0,
        "call_width": 3.0,
        "put_short_leg_delta": null,
        "call_short_leg_delta": null,
        "put_close_cost": null,
        "call_close_cost": null,
        "put_short_strike": null,
        "call_short_strike": null
      },
      "cells": {
        "spread": "ORCL call 120.0/117.0 2026-11-13",
        "spread_compact": "ORCL 120/117 C",
        "legs": "120C/117C",
        "structure": "spread",
        "contracts": "12",
        "proposal": "\u2014",
        "frozen_entry": "Nov 6, 1:18 PM EST / -1.17 / -$1,404.00 debit",
        "frozen_entry_compact": "-$1,404 debit @ -1.17",
        "expiry_compact": "Nov 13 \u00b7 7d",
        "collateral": "$3,600",
        "credit": "-$1,404",
        "spread_price": "-$1.16 (-$1,392) (-$156)",
        "entry_credit_per_contract": "-$117.00",
        "live_price_per_contract": "-$116.00",
        "spot": "115.58",
        "cushion": "+3.82% (-0.11%)",
        "band": "WATCH",
        "open_pl": "-$12 (+$156)",
        "pct_captured": "n/a",
        "short_delta": "+0.368 (+0.005)",
        "conf": "ok"
      }
    },
    {
      "short_symbol": "PLTR261113C00167500",
      "structure": "spread",
      "member_symbols": [
        "PLTR261113C00167500"
      ],
      "calc": {
        "collateral": 3750.0,
        "credit": -1575.0,
        "close_cost": -1155.0,
        "contracts": 15.0,
        "max_width": 2.5,
        "put_width": 0.0,
        "call_width": 2.5,
        "put_short_leg_delta": null,
        "call_short_leg_delta": null,
        "put_close_cost": null,
        "call_close_cost": null,
        "put_short_strike": null,
        "call_short_strike": null
      },
      "cells": {
        "spread": "PLTR call 167.5/165.0 2026-11-13",
        "spread_compact": "PLTR 167.5/165 C",
        "legs": "167.5C/165C",
        "structure": "spread",
        "contracts": "15",
        "proposal": "\u2014",
        "frozen_entry": "Nov 6, 10:03 AM EST / -1.05 / -$1,575.00 debit",
        "frozen_entry_compact": "-$1,575 debit @ -1.05",
        "expiry_compact": "Nov 13 \u00b7 7d",
        "collateral": "$3,750",
        "credit": "-$1,575",
        "spread_price": "-$0.77 (-$1,155) (+$90)",
        "entry_credit_per_contract": "-$105.00",
        "live_price_per_contract": "-$77.00",
        "spot": "160.16",
        "cushion": "+4.58% (+0.54%)",
        "band": "WATCH",
        "open_pl": "-$420 (-$90)",
        "pct_captured": "n/a",
        "short_delta": "+0.308 (-0.020)",
        "conf": "ok"
      }
    },
    {
      "short_symbol": "RDDT261120P00090000",
      "structure": "spread",
      "member_symbols": [
        "RDDT261120P00090000"
      ],
      "calc": {
        "collateral": 3500.0,
        "credit": -1463.0,
        "close_cost": -1148.0,
        "contracts": 7.0,
        "max_width": 5.0,
        "put_width": 5.0,
        "call_width": 0.0,
        "put_short_leg_delta": null,
        "call_short_leg_delta": null,
        "put_close_cost": null,
        "call_close_cost": null,
        "put_short_strike": null,
        "call_short_strike": null
      },
      "cells": {
        "spread": "RDDT put 90.0/95.0 2026-11-20",
        "spread_compact": "RDDT 90/95 P",
        "legs": "90P/95P",
        "structure": "spread",
        "contracts": "7",
        "proposal": "\u2014",
        "frozen_entry": "Nov 6, 3:15 PM EST / -2.09 / -$1,463.00 debit",
        "frozen_entry_compact": "-$1,463 debit @ -2.09",
        "expiry_compact": "Nov 20 \u00b7 14d",
        "collateral": "$3,500",
        "credit": "-$1,463",
        "spread_price": "-$1.64 (-$1,148) (-$63)",
        "entry_credit_per_contract": "-$209.00",
        "live_price_per_contract": "-$164.00",
        "spot": "95.20",
        "cushion": "+5.46% (+0.03%)",
        "band": "SAFE",
        "open_pl": "-$315 (+$63)",
        "pct_captured": "n/a",
        "short_delta": "-0.308 (+0.001)",
        "conf": "ok"
      }
    },
    {
      "short_symbol": "SOXL261113P00040000",
      "structure": "spread",
      "member_symbols": [
        "SOXL261113P00040000"
      ],
      "calc": {
        "collateral": 3600.0,
        "credit": -1530.0,
        "close_cost": -1350.0,
        "contracts": 18.0,
        "max_width": 2.0,
        "put_width": 2.0,
        "call_width": 0.0,
        "put_short_leg_delta": null,
        "call_short_leg_delta": null,
        "put_close_cost": null,
        "call_close_cost": null,
        "put_short_strike": null,
        "call_short_strike": null
      },
      "cells": {
        "spread": "SOXL put 40.0/42.0 2026-11-13",
        "spread_compact": "SOXL 40/42 P",
        "legs": "40P/42P",
        "structure": "spread",
        "contracts": "18",
        "proposal": "\u2014",
        "frozen_entry": "Nov 6, 10:45 AM EST / -0.85 / -$1,530.00 debit",
        "frozen_entry_compact": "-$1,530 debit @ -0.85",
        "expiry_compact": "Nov 13 \u00b7 7d",
        "collateral": "$3,600",
        "credit": "-$1,530",
        "spread_price": "-$0.75 (-$1,350) (-$432)",
        "entry_credit_per_contract": "-$85.00",
        "live_price_per_contract": "-$75.00",
        "spot": "45.31",
        "cushion": "+11.73% (-0.76%)",
        "band": "SAFE",
        "open_pl": "-$180 (+$432)",
        "pct_captured": "n/a",
        "short_delta": "-0.288 (-0.008)",
        "conf": "ok"
      }
    },
    {
      "short_symbol": "TSLA261113C00372500",
      "structure": "spread",
      "member_symbols": [
        "TSLA261113C00372500"
      ],
      "calc": {
        "collateral": 4000.0,
        "credit": -1520.0,
        "close_cost": -736.0,
        "contracts": 16.0,
        "max_width": 2.5,
        "put_width": 0.0,
        "call_width": 2.5,
        "put_short_leg_delta": null,
        "call_short_leg_delta": null,
        "put_close_cost": null,
        "call_close_cost": null,
        "put_short_strike": null,
        "call_short_strike": null
      },
      "cells": {
        "spread": "TSLA call 372.5/370.0 2026-11-13",
        "spread_compact": "TSLA 372.5/370 C",
        "legs": "372.5C/370C",
        "structure": "spread",
        "contracts": "16",
        "proposal": "\u2014",
        "frozen_entry": "Nov 6, 10:38 AM EST / -0.95 / -$1,520.00 debit",
        "frozen_entry_compact": "-$1,520 debit @ -0.95",
        "expiry_compact": "Nov 13 \u00b7 7d",
        "collateral": "$4,000",
        "credit": "-$1,520",
        "spread_price": "-$0.46 (-$736) (+$512)",
        "entry_credit_per_contract": "-$95.00",
        "live_price_per_contract": "-$46.00",
        "spot": "358.06",
        "cushion": "+4.03% (+0.60%)",
        "band": "WATCH",
        "open_pl": "-$784 (-$512)",
        "pct_captured": "n/a",
        "short_delta": "+0.321 (-0.025)",
        "conf": "ok"
      }
    },
    {
      "short_symbol": "WMT261113P00122000",
      "structure": "spread",
      "member_symbols": [
        "WMT261113P00122000"
      ],
      "calc": {
        "collateral": 3900.0,
        "credit": -1287.0,
        "close_cost": -507.0,
        "contracts": 39.0,
        "max_width": 1.0,
        "put_width": 1.0,
        "call_width": 0.0,
        "put_short_leg_delta": null,
        "call_short_leg_delta": null,
        "put_close_cost": null,
        "call_close_cost": null,
        "put_short_strike": null,
        "call_short_strike": null
      },
      "cells": {
        "spread": "WMT put 122.0/123.0 2026-11-13",
        "spread_compact": "WMT 122/123 P",
        "legs": "122P/123P",
        "structure": "spread",
        "contracts": "39",
        "proposal": "\u2014",
        "frozen_entry": "Nov 6, 10:12 AM EST / -0.33 / -$1,287.00 debit",
        "frozen_entry_compact": "-$1,287 debit @ -0.33",
        "expiry_compact": "Nov 13 \u00b7 7d",
        "collateral": "$3,900",
        "credit": "-$1,287",
        "spread_price": "-$0.13 (-$507) (+$195)",
        "entry_credit_per_contract": "-$33.00",
        "live_price_per_contract": "-$13.00",
        "spot": "125.48",
        "cushion": "+2.78% (-0.14%)",
        "band": "WATCH",
        "open_pl": "-$780 (-$195)",
        "pct_captured": "n/a",
        "short_delta": "-0.240 (-0.015)",
        "conf": "ok"
      }
    }
  ],
  "schedule": {
    "runsPerDay": 5,
    "cadenceLabel": "pre-open + 4x through the session, weekdays",
    "nextRunAt": "2026-11-09T14:05:00+00:00",
    "staleAfterMs": 1200000
  }
};
