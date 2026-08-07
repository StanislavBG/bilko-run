window.OPTIONS_SUMMARY = {
  "generatedAt": "2026-08-07T20:36:38+00:00",
  "record": {
    "schema_version": 1,
    "generated_at": "2026-08-07T20:36:38+00:00",
    "account": {
      "equity": 104191.02,
      "cash": 112224.92,
      "buying_power": 44299.68,
      "options_buying_power": 11074.92,
      "options_approved_level": 3,
      "balance_asof": "2026-08-06"
    },
    "totals": {
      "credit": 2218.0,
      "close_cost": 142.48,
      "open_pl": 2075.52,
      "max_loss": 98932.0,
      "delta": 1217.33,
      "theta": 1074.39,
      "vega": -406.47,
      "gamma": -1078.43
    },
    "positions": [
      {
        "underlying": "ARM",
        "right": "put",
        "expiry": "2026-08-14",
        "short_strike": 255.0,
        "long_strike": 250.0,
        "width": 5.0,
        "qty": 5.0,
        "short_symbol": "ARM260814P00255000",
        "long_symbol": "ARM260814P00250000",
        "entry": {
          "filled_at": "2026-08-07T15:30:44.814821Z",
          "net_per_contract": -0.39,
          "tag": "CREDIT_SPREAD_ARM_20260814_25500",
          "leg_fill_prices": {
            "ARM260814P00255000": 2.37,
            "ARM260814P00250000": 1.98
          },
          "credit": 195.0
        },
        "now": {
          "spot": 282.64,
          "cushion_pct": 0.0978,
          "band": "SAFE",
          "close_cost": 5.1,
          "open_pl": 189.9,
          "max_loss": 2305.0,
          "pct_captured": 0.9738,
          "breach_px": 256.275,
          "target_close": 39.0
        },
        "greeks": {
          "short_leg_delta": -0.1466,
          "short_leg_iv": 0.7585,
          "net": {
            "delta": 0.0374,
            "gamma": -0.0015,
            "theta": 0.0863,
            "vega": -0.0167,
            "rho": 0.0022
          },
          "position": {
            "delta": 18.7,
            "gamma": -0.75,
            "theta": 43.15,
            "vega": -8.35,
            "rho": 1.1
          }
        },
        "quality": {
          "short": {
            "bid": 2.19,
            "ask": 2.52,
            "mid": 2.355,
            "spread_pct": 0.1401
          },
          "long": {
            "bid": 1.5,
            "ask": 1.8,
            "mid": 1.65,
            "spread_pct": 0.1818
          }
        },
        "ev_at_fill": -171.5,
        "breakeven_credit": 366.5,
        "credit_vs_breakeven_pct": 0.5321,
        "oldest_quote_ts": "2026-08-07T19:59:15.284529228Z"
      },
      {
        "underlying": "BABA",
        "right": "call",
        "expiry": "2026-08-14",
        "short_strike": 143.0,
        "long_strike": 144.0,
        "width": 1.0,
        "qty": 56.0,
        "short_symbol": "BABA260814C00143000",
        "long_symbol": "BABA260814C00144000",
        "entry": {
          "filled_at": "2026-08-07T14:45:37.733443Z",
          "net_per_contract": 0.33,
          "tag": "CREDIT_SPREAD_BABA_20260814_14300",
          "leg_fill_prices": {
            "BABA260814C00143000": 0.05,
            "BABA260814C00144000": 0.38
          },
          "credit": -1848.0
        },
        "now": {
          "spot": 128.405,
          "cushion_pct": 0.1137,
          "band": "SAFE",
          "close_cost": 21.84,
          "open_pl": -1869.84,
          "max_loss": 7448.0,
          "pct_captured": null,
          "breach_px": 142.285,
          "target_close": null
        },
        "greeks": {
          "short_leg_delta": 0.062,
          "short_leg_iv": 0.4949,
          "net": {
            "delta": -0.0108,
            "gamma": -0.002,
            "theta": 0.0105,
            "vega": -0.003,
            "rho": -0.0003
          },
          "position": {
            "delta": -60.48,
            "gamma": -11.2,
            "theta": 58.8,
            "vega": -16.8,
            "rho": -1.68
          }
        },
        "quality": {
          "short": {
            "bid": 0.01,
            "ask": 0.45,
            "mid": 0.23,
            "spread_pct": 1.913
          },
          "long": {
            "bid": 0.06,
            "ask": 0.31,
            "mid": 0.185,
            "spread_pct": 1.3514
          }
        },
        "ev_at_fill": -2195.2,
        "breakeven_credit": 347.2,
        "credit_vs_breakeven_pct": -5.3226,
        "oldest_quote_ts": "2026-08-07T19:59:30.65975476Z"
      },
      {
        "underlying": "COIN",
        "right": "put",
        "expiry": "2026-08-14",
        "short_strike": 143.0,
        "long_strike": 142.0,
        "width": 1.0,
        "qty": 32.0,
        "short_symbol": "COIN260814P00143000",
        "long_symbol": "COIN260814P00142000",
        "entry": {
          "filled_at": "2026-08-07T14:45:42.206802Z",
          "net_per_contract": -0.05,
          "tag": "CREDIT_SPREAD_COIN_20260814_14300",
          "leg_fill_prices": {
            "COIN260814P00143000": 1.52,
            "COIN260814P00142000": 1.47
          },
          "credit": 160.0
        },
        "now": {
          "spot": 153.61,
          "cushion_pct": 0.0691,
          "band": "SAFE",
          "close_cost": 12.8,
          "open_pl": 147.2,
          "max_loss": 3040.0,
          "pct_captured": 0.92,
          "breach_px": 143.715,
          "target_close": 32.0
        },
        "greeks": {
          "short_leg_delta": -0.1891,
          "short_leg_iv": 0.6441,
          "net": {
            "delta": 0.0213,
            "gamma": -0.0014,
            "theta": 0.0198,
            "vega": -0.0042,
            "rho": 0.0007
          },
          "position": {
            "delta": 68.16,
            "gamma": -4.48,
            "theta": 63.36,
            "vega": -13.44,
            "rho": 2.24
          }
        },
        "quality": {
          "short": {
            "bid": 1.4,
            "ask": 1.58,
            "mid": 1.49,
            "spread_pct": 0.1208
          },
          "long": {
            "bid": 1.18,
            "ask": 1.37,
            "mid": 1.275,
            "spread_pct": 0.149
          }
        },
        "ev_at_fill": -445.12,
        "breakeven_credit": 605.12,
        "credit_vs_breakeven_pct": 0.2644,
        "oldest_quote_ts": "2026-08-07T19:59:59.498473664Z"
      },
      {
        "underlying": "INTC",
        "right": "put",
        "expiry": "2026-08-12",
        "short_strike": 88.0,
        "long_strike": 87.0,
        "width": 1.0,
        "qty": 28.0,
        "short_symbol": "INTC260812P00088000",
        "long_symbol": "INTC260812P00087000",
        "entry": {
          "filled_at": "2026-08-07T14:45:40.311198Z",
          "net_per_contract": 0.03,
          "tag": "CREDIT_SPREAD_INTC_20260812_8800",
          "leg_fill_prices": {
            "INTC260812P00088000": 0.36,
            "INTC260812P00087000": 0.39
          },
          "credit": -84.0
        },
        "now": {
          "spot": 101.645,
          "cushion_pct": 0.1342,
          "band": "SAFE",
          "close_cost": 6.16,
          "open_pl": -90.16,
          "max_loss": 2884.0,
          "pct_captured": null,
          "breach_px": 88.44,
          "target_close": null
        },
        "greeks": {
          "short_leg_delta": -0.0378,
          "short_leg_iv": 0.7021,
          "net": {
            "delta": 0.0378,
            "gamma": -0.0099,
            "theta": 0.0682,
            "vega": -0.0098,
            "rho": 0.0005
          },
          "position": {
            "delta": 105.84,
            "gamma": -27.72,
            "theta": 190.96,
            "vega": -27.44,
            "rho": 1.4
          }
        },
        "quality": {
          "short": {
            "bid": 0.04,
            "ask": 0.22,
            "mid": 0.13,
            "spread_pct": 1.3846
          },
          "long": {
            "bid": null,
            "ask": 0.27,
            "mid": 0.27,
            "spread_pct": null
          }
        },
        "ev_at_fill": -189.84,
        "breakeven_credit": 105.84,
        "credit_vs_breakeven_pct": -0.7937,
        "oldest_quote_ts": "2026-08-07T19:56:01.657421708Z"
      },
      {
        "underlying": "MSFT",
        "right": "call",
        "expiry": "2026-08-14",
        "short_strike": 527.5,
        "long_strike": 530.0,
        "width": 2.5,
        "qty": 50.0,
        "short_symbol": "MSFT260814C00527500",
        "long_symbol": "MSFT260814C00530000",
        "entry": {
          "filled_at": "2026-08-07T14:21:46.228817Z",
          "net_per_contract": -0.12,
          "tag": "CREDIT_SPREAD_MSFT_20260814_52750",
          "leg_fill_prices": {
            "MSFT260814C00527500": 1.18,
            "MSFT260814C00530000": 1.06
          },
          "credit": 600.0
        },
        "now": {
          "spot": 499.875,
          "cushion_pct": 0.0553,
          "band": "SAFE",
          "close_cost": 18.5,
          "open_pl": 581.5,
          "max_loss": 11900.0,
          "pct_captured": 0.9692,
          "breach_px": 524.8625,
          "target_close": 120.0
        },
        "greeks": {
          "short_leg_delta": 0.0933,
          "short_leg_iv": 0.2847,
          "net": {
            "delta": -0.0227,
            "gamma": -0.0015,
            "theta": 0.0495,
            "vega": -0.0219,
            "rho": -0.0021
          },
          "position": {
            "delta": -113.5,
            "gamma": -7.5,
            "theta": 247.5,
            "vega": -109.5,
            "rho": -10.5
          }
        },
        "quality": {
          "short": {
            "bid": 0.76,
            "ask": 0.93,
            "mid": 0.845,
            "spread_pct": 0.2012
          },
          "long": {
            "bid": 0.56,
            "ask": 0.63,
            "mid": 0.595,
            "spread_pct": 0.1176
          }
        },
        "ev_at_fill": -566.0,
        "breakeven_credit": 1166.25,
        "credit_vs_breakeven_pct": 0.5145,
        "oldest_quote_ts": "2026-08-07T19:57:11.676978468Z"
      },
      {
        "underlying": "MSTR",
        "right": "put",
        "expiry": "2026-08-14",
        "short_strike": 95.0,
        "long_strike": 94.0,
        "width": 1.0,
        "qty": 32.0,
        "short_symbol": "MSTR260814P00095000",
        "long_symbol": "MSTR260814P00094000",
        "entry": {
          "filled_at": "2026-08-07T14:45:38.618737Z",
          "net_per_contract": -0.06,
          "tag": "CREDIT_SPREAD_MSTR_20260814_9500",
          "leg_fill_prices": {
            "MSTR260814P00095000": 1.04,
            "MSTR260814P00094000": 0.98
          },
          "credit": 192.0
        },
        "now": {
          "spot": 99.97,
          "cushion_pct": 0.0497,
          "band": "WATCH",
          "close_cost": 13.76,
          "open_pl": 178.24,
          "max_loss": 3008.0,
          "pct_captured": 0.9283,
          "breach_px": 95.475,
          "target_close": 38.4
        },
        "greeks": {
          "short_leg_delta": -0.2789,
          "short_leg_iv": 0.6819,
          "net": {
            "delta": 0.0347,
            "gamma": -0.0026,
            "theta": 0.0126,
            "vega": -0.0031,
            "rho": 0.0007
          },
          "position": {
            "delta": 111.04,
            "gamma": -8.32,
            "theta": 40.32,
            "vega": -9.92,
            "rho": 2.24
          }
        },
        "quality": {
          "short": {
            "bid": 1.64,
            "ask": 1.78,
            "mid": 1.71,
            "spread_pct": 0.0819
          },
          "long": {
            "bid": 1.35,
            "ask": 1.54,
            "mid": 1.445,
            "spread_pct": 0.1315
          }
        },
        "ev_at_fill": -700.48,
        "breakeven_credit": 892.48,
        "credit_vs_breakeven_pct": 0.2151,
        "oldest_quote_ts": "2026-08-07T19:59:56.172256903Z"
      },
      {
        "underlying": "NFLX",
        "right": "put",
        "expiry": "2026-08-21",
        "short_strike": 65.0,
        "long_strike": 64.0,
        "width": 1.0,
        "qty": 105.0,
        "short_symbol": "NFLX260821P00065000",
        "long_symbol": "NFLX260821P00064000",
        "entry": {
          "filled_at": "2026-08-07T13:45:24.24419Z",
          "net_per_contract": -0.01,
          "tag": "CREDIT_SPREAD_NFLX_20260821_6500",
          "leg_fill_prices": {
            "NFLX260821P00065000": 0.07,
            "NFLX260821P00064000": 0.06
          },
          "credit": 105.0
        },
        "now": {
          "spot": 74.12,
          "cushion_pct": 0.123,
          "band": "SAFE",
          "close_cost": 2.1,
          "open_pl": 102.9,
          "max_loss": 10395.0,
          "pct_captured": 0.98,
          "breach_px": 65.325,
          "target_close": 21.0
        },
        "greeks": {
          "short_leg_delta": -0.0194,
          "short_leg_iv": 0.3325,
          "net": {
            "delta": -0.0021,
            "gamma": -0.0005,
            "theta": -0.002,
            "vega": 0.0007,
            "rho": 0.0
          },
          "position": {
            "delta": -22.05,
            "gamma": -5.25,
            "theta": -21.0,
            "vega": 7.35,
            "rho": 0.0
          }
        },
        "quality": {
          "short": {
            "bid": 0.03,
            "ask": 0.04,
            "mid": 0.035,
            "spread_pct": 0.2857
          },
          "long": {
            "bid": 0.02,
            "ask": 0.07,
            "mid": 0.045,
            "spread_pct": 1.1111
          }
        },
        "ev_at_fill": -98.7,
        "breakeven_credit": 203.7,
        "credit_vs_breakeven_pct": 0.5155,
        "oldest_quote_ts": "2026-08-07T19:59:11.262789013Z"
      },
      {
        "underlying": "ORCL",
        "right": "put",
        "expiry": "2026-08-14",
        "short_strike": 134.0,
        "long_strike": 133.0,
        "width": 1.0,
        "qty": 30.0,
        "short_symbol": "ORCL260814P00134000",
        "long_symbol": "ORCL260814P00133000",
        "entry": {
          "filled_at": "2026-08-07T14:45:42.898437Z",
          "net_per_contract": -0.07,
          "tag": "CREDIT_SPREAD_ORCL_20260814_13400",
          "leg_fill_prices": {
            "ORCL260814P00134000": 1.03,
            "ORCL260814P00133000": 0.96
          },
          "credit": 210.0
        },
        "now": {
          "spot": 146.935,
          "cushion_pct": 0.088,
          "band": "SAFE",
          "close_cost": 7.5,
          "open_pl": 202.5,
          "max_loss": 2790.0,
          "pct_captured": 0.9643,
          "breach_px": 134.67,
          "target_close": 42.0
        },
        "greeks": {
          "short_leg_delta": -0.1252,
          "short_leg_iv": 0.5922,
          "net": {
            "delta": 0.0205,
            "gamma": -0.0018,
            "theta": 0.0228,
            "vega": -0.005,
            "rho": 0.0006
          },
          "position": {
            "delta": 61.5,
            "gamma": -5.4,
            "theta": 68.4,
            "vega": -15.0,
            "rho": 1.8
          }
        },
        "quality": {
          "short": {
            "bid": 0.71,
            "ask": 0.84,
            "mid": 0.775,
            "spread_pct": 0.1677
          },
          "long": {
            "bid": 0.59,
            "ask": 0.64,
            "mid": 0.615,
            "spread_pct": 0.0813
          }
        },
        "ev_at_fill": -165.6,
        "breakeven_credit": 375.6,
        "credit_vs_breakeven_pct": 0.5591,
        "oldest_quote_ts": "2026-08-07T19:59:20.391849326Z"
      },
      {
        "underlying": "PLTR",
        "right": "put",
        "expiry": "2026-08-14",
        "short_strike": 150.0,
        "long_strike": 149.0,
        "width": 1.0,
        "qty": 181.0,
        "short_symbol": "PLTR260814P00150000",
        "long_symbol": "PLTR260814P00149000",
        "entry": {
          "filled_at": "2026-08-07T16:05:22.271329Z",
          "net_per_contract": 0.0,
          "tag": "CREDIT_SPREAD_PLTR_20260814_15000",
          "leg_fill_prices": {
            "PLTR260814P00150000": 0.35,
            "PLTR260814P00149000": 0.35
          },
          "credit": -0.0
        },
        "now": {
          "spot": 171.995,
          "cushion_pct": 0.1279,
          "band": "SAFE",
          "close_cost": 9.05,
          "open_pl": -9.05,
          "max_loss": 18100.0,
          "pct_captured": null,
          "breach_px": 150.75,
          "target_close": null
        },
        "greeks": {
          "short_leg_delta": -0.0411,
          "short_leg_iv": 0.5769,
          "net": {
            "delta": 0.0026,
            "gamma": -0.0005,
            "theta": 0.0018,
            "vega": -0.0011,
            "rho": 0.0001
          },
          "position": {
            "delta": 47.06,
            "gamma": -9.05,
            "theta": 32.58,
            "vega": -19.91,
            "rho": 1.81
          }
        },
        "quality": {
          "short": {
            "bid": 0.23,
            "ask": 0.24,
            "mid": 0.235,
            "spread_pct": 0.0426
          },
          "long": {
            "bid": 0.19,
            "ask": 0.26,
            "mid": 0.225,
            "spread_pct": 0.3111
          }
        },
        "ev_at_fill": -743.91,
        "breakeven_credit": 743.91,
        "credit_vs_breakeven_pct": -0.0,
        "oldest_quote_ts": "2026-08-07T19:59:00.773991409Z"
      },
      {
        "underlying": "SLV",
        "right": "put",
        "expiry": "2026-08-14",
        "short_strike": 53.5,
        "long_strike": 53.0,
        "width": 0.5,
        "qty": 222.0,
        "short_symbol": "SLV260814P00053500",
        "long_symbol": "SLV260814P00053000",
        "entry": {
          "filled_at": "2026-08-07T14:11:36.006493Z",
          "net_per_contract": -0.01,
          "tag": "CREDIT_SPREAD_SLV_20260814_5350",
          "leg_fill_prices": {
            "SLV260814P00053500": 0.17,
            "SLV260814P00053000": 0.16
          },
          "credit": 222.0
        },
        "now": {
          "spot": 57.51,
          "cushion_pct": 0.0697,
          "band": "SAFE",
          "close_cost": 24.42,
          "open_pl": 197.58,
          "max_loss": 10878.0,
          "pct_captured": 0.89,
          "breach_px": 53.7675,
          "target_close": 44.4
        },
        "greeks": {
          "short_leg_delta": -0.1071,
          "short_leg_iv": 0.4179,
          "net": {
            "delta": 0.0304,
            "gamma": -0.0115,
            "theta": 0.01,
            "vega": -0.0033,
            "rho": 0.0003
          },
          "position": {
            "delta": 674.88,
            "gamma": -255.3,
            "theta": 222.0,
            "vega": -73.26,
            "rho": 6.66
          }
        },
        "quality": {
          "short": {
            "bid": 0.16,
            "ask": 0.19,
            "mid": 0.175,
            "spread_pct": 0.1714
          },
          "long": {
            "bid": 0.08,
            "ask": 0.15,
            "mid": 0.115,
            "spread_pct": 0.6087
          }
        },
        "ev_at_fill": -965.7,
        "breakeven_credit": 1188.81,
        "credit_vs_breakeven_pct": 0.1867,
        "oldest_quote_ts": "2026-08-07T19:59:58.104562532Z"
      },
      {
        "underlying": "SPY",
        "right": "call",
        "expiry": "2026-08-11",
        "short_strike": 784.0,
        "long_strike": 785.0,
        "width": 1.0,
        "qty": 28.0,
        "short_symbol": "SPY260811C00784000",
        "long_symbol": "SPY260811C00785000",
        "entry": {
          "filled_at": "2026-08-07T14:30:43.25206Z",
          "net_per_contract": -0.05,
          "tag": "CREDIT_SPREAD_SPY_20260811_78400",
          "leg_fill_prices": {
            "SPY260811C00784000": 0.29,
            "SPY260811C00785000": 0.24
          },
          "credit": 140.0
        },
        "now": {
          "spot": 773.16,
          "cushion_pct": 0.014,
          "band": "DANGER",
          "close_cost": 0.28,
          "open_pl": 139.72,
          "max_loss": 2660.0,
          "pct_captured": 0.998,
          "breach_px": 780.08,
          "target_close": 28.0
        },
        "greeks": {
          "short_leg_delta": 0.0473,
          "short_leg_iv": 0.079,
          "net": {
            "delta": -0.0028,
            "gamma": -0.0017,
            "theta": -0.0016,
            "vega": -0.0038,
            "rho": -0.0002
          },
          "position": {
            "delta": -7.84,
            "gamma": -4.76,
            "theta": -4.48,
            "vega": -10.64,
            "rho": -0.56
          }
        },
        "quality": {
          "short": {
            "bid": 0.12,
            "ask": 0.13,
            "mid": 0.125,
            "spread_pct": 0.08
          },
          "long": {
            "bid": 0.12,
            "ask": 0.13,
            "mid": 0.125,
            "spread_pct": 0.08
          }
        },
        "ev_at_fill": 7.56,
        "breakeven_credit": 132.44,
        "credit_vs_breakeven_pct": 1.0571,
        "oldest_quote_ts": "2026-08-07T19:59:56.858101642Z"
      },
      {
        "underlying": "TLT",
        "right": "put",
        "expiry": "2026-08-17",
        "short_strike": 81.0,
        "long_strike": 80.5,
        "width": 0.5,
        "qty": 227.0,
        "short_symbol": "TLT260817P00081000",
        "long_symbol": "TLT260817P00080500",
        "entry": {
          "filled_at": "2026-08-07T13:53:27.494782Z",
          "net_per_contract": -0.02,
          "tag": "CREDIT_SPREAD_TLT_20260817_8100",
          "leg_fill_prices": {
            "TLT260817P00081000": 0.07,
            "TLT260817P00080500": 0.05
          },
          "credit": 454.0
        },
        "now": {
          "spot": 82.76,
          "cushion_pct": 0.0213,
          "band": "WATCH",
          "close_cost": 6.81,
          "open_pl": 447.19,
          "max_loss": 10896.0,
          "pct_captured": 0.985,
          "breach_px": 81.405,
          "target_close": 90.8
        },
        "greeks": {
          "short_leg_delta": -0.0978,
          "short_leg_iv": 0.1023,
          "net": {
            "delta": 0.0142,
            "gamma": -0.0322,
            "theta": -0.001,
            "vega": -0.0026,
            "rho": 0.0003
          },
          "position": {
            "delta": 322.34,
            "gamma": -730.94,
            "theta": -22.7,
            "vega": -59.02,
            "rho": 6.81
          }
        },
        "quality": {
          "short": {
            "bid": 0.04,
            "ask": 0.09,
            "mid": 0.065,
            "spread_pct": 0.7692
          },
          "long": {
            "bid": 0.06,
            "ask": 0.07,
            "mid": 0.065,
            "spread_pct": 0.1538
          }
        },
        "ev_at_fill": -656.03,
        "breakeven_credit": 1110.03,
        "credit_vs_breakeven_pct": 0.409,
        "oldest_quote_ts": "2026-08-07T19:59:23.971011525Z"
      },
      {
        "underlying": "TSLA",
        "right": "put",
        "expiry": "2026-08-12",
        "short_strike": 305.0,
        "long_strike": 302.5,
        "width": 2.5,
        "qty": 46.0,
        "short_symbol": "TSLA260812P00305000",
        "long_symbol": "TSLA260812P00302500",
        "entry": {
          "filled_at": "2026-08-07T13:40:17.618555Z",
          "net_per_contract": -0.36,
          "tag": "CREDIT_SPREAD_TSLA_20260812_30500",
          "leg_fill_prices": {
            "TSLA260812P00305000": 0.98,
            "TSLA260812P00302500": 0.62
          },
          "credit": 1656.0
        },
        "now": {
          "spot": 327.5,
          "cushion_pct": 0.0687,
          "band": "SAFE",
          "close_cost": 5.52,
          "open_pl": 1650.48,
          "max_loss": 9844.0,
          "pct_captured": 0.9967,
          "breach_px": 306.525,
          "target_close": 331.2
        },
        "greeks": {
          "short_leg_delta": -0.0551,
          "short_leg_iv": 0.4041,
          "net": {
            "delta": 0.0112,
            "gamma": -0.0014,
            "theta": 0.0229,
            "vega": -0.0071,
            "rho": 0.0005
          },
          "position": {
            "delta": 51.52,
            "gamma": -6.44,
            "theta": 105.34,
            "vega": -32.66,
            "rho": 2.3
          }
        },
        "quality": {
          "short": {
            "bid": 0.34,
            "ask": 0.4,
            "mid": 0.37,
            "spread_pct": 0.1622
          },
          "long": {
            "bid": 0.28,
            "ask": 0.31,
            "mid": 0.295,
            "spread_pct": 0.1017
          }
        },
        "ev_at_fill": 1022.12,
        "breakeven_credit": 633.65,
        "credit_vs_breakeven_pct": 2.6134,
        "oldest_quote_ts": "2026-08-07T19:59:34.475388052Z"
      },
      {
        "underlying": "TSM",
        "right": "call",
        "expiry": "2026-08-14",
        "short_strike": 437.5,
        "long_strike": 440.0,
        "width": 2.5,
        "qty": 12.0,
        "short_symbol": "TSM260814C00437500",
        "long_symbol": "TSM260814C00440000",
        "entry": {
          "filled_at": "2026-08-07T15:01:29.570716Z",
          "net_per_contract": -0.18,
          "tag": "CREDIT_SPREAD_TSM_20260814_43750",
          "leg_fill_prices": {
            "TSM260814C00437500": 2.5,
            "TSM260814C00440000": 2.32
          },
          "credit": 216.0
        },
        "now": {
          "spot": 419.92,
          "cushion_pct": 0.0419,
          "band": "WATCH",
          "close_cost": 8.64,
          "open_pl": 207.36,
          "max_loss": 2784.0,
          "pct_captured": 0.96,
          "breach_px": 435.3125,
          "target_close": 43.2
        },
        "greeks": {
          "short_leg_delta": 0.2374,
          "short_leg_iv": 0.3726,
          "net": {
            "delta": -0.0332,
            "gamma": -0.0011,
            "theta": 0.0418,
            "vega": -0.0149,
            "rho": -0.0026
          },
          "position": {
            "delta": -39.84,
            "gamma": -1.32,
            "theta": 50.16,
            "vega": -17.88,
            "rho": -3.12
          }
        },
        "quality": {
          "short": {
            "bid": 2.83,
            "ask": 3.07,
            "mid": 2.95,
            "spread_pct": 0.0814
          },
          "long": {
            "bid": 2.35,
            "ask": 2.5,
            "mid": 2.425,
            "spread_pct": 0.0619
          }
        },
        "ev_at_fill": -496.2,
        "breakeven_credit": 712.2,
        "credit_vs_breakeven_pct": 0.3033,
        "oldest_quote_ts": "2026-08-07T19:59:33.665902764Z"
      }
    ],
    "unpaired_legs": [],
    "oldest_quote_ts": "2026-08-07T19:56:01.657421708Z"
  },
  "summary": "Today: $0 (0.0%). Realized $0 \u00b7 open marks $0 \u00b7 14 spreads live, 0 breached, +$614/day decay working for us.\n\n## Where the book stands\n\n- Account equity: $104,191.02\n- Cash: $112,224.92\n- Open spreads: 14  \u00b7  unpaired legs: 0\n- Bands: 1 DANGER, 10 SAFE, 3 WATCH\n- Book totals (as stored): credit $2,218.00, close cost $142.48, open P/L +$2,076, max loss $98,932.00\n- Book greeks (confidence-gated \u2014 wide-quoted legs excluded): delta +149.7, theta +$614/day, vega -217.4, gamma -39.0\n- \u26a0 6 position(s) excluded from book greeks \u2014 leg quoting wider than 25% of mid.\n- Spot quotes: last close (market closed)\n- Equity reconciliation: open marks \u0394 ties to equity \u0394. \u2713\n\n## Positions \u2014 entry snapshot (frozen) vs now (live)\n\n| Spread | FROZEN entry (filled / net / credit) | LIVE spot | LIVE cushion (\u0394) | LIVE band | LIVE open P/L (\u0394) | % captured | short \u0394 (\u0394) | conf |\n|---|---|---|---|---|---|---|---|---|\n| ARM put 255.0/250.0 2026-08-14 | 2026-08-07T15:30:44.814821Z / -0.39 / $195.00 | 282.64 | +9.78% (0.00%) | SAFE | +$190 ($0) | 97.4% | -0.147 (+0.003) | ok |\n| BABA call 143.0/144.0 2026-08-14 | 2026-08-07T14:45:37.733443Z / +0.33 / -$1,848.00 | 128.41 | +11.37% (0.00%) | SAFE | -$1,870 ($0) | n/a | +0.062 (0.000) | \u26a0 wide |\n| COIN put 143.0/142.0 2026-08-14 | 2026-08-07T14:45:42.206802Z / -0.05 / $160.00 | 153.61 | +6.91% (0.00%) | SAFE | +$147 ($0) | 92.0% | -0.189 (+0.003) | ok |\n| INTC put 88.0/87.0 2026-08-12 | 2026-08-07T14:45:40.311198Z / +0.03 / -$84.00 | 101.64 | +13.42% (0.00%) | SAFE | -$90 ($0) | n/a | -0.038 (0.000) | \u26a0 wide |\n| MSFT call 527.5/530.0 2026-08-14 | 2026-08-07T14:21:46.228817Z / -0.12 / $600.00 | 499.88 | +5.53% (0.00%) | SAFE | +$582 ($0) | 96.9% | +0.093 (0.000) | ok |\n| MSTR put 95.0/94.0 2026-08-14 | 2026-08-07T14:45:38.618737Z / -0.06 / $192.00 | 99.97 | +4.97% (0.00%) | WATCH | +$178 ($0) | 92.8% | -0.279 (0.000) | ok |\n| NFLX put 65.0/64.0 2026-08-21 | 2026-08-07T13:45:24.24419Z / -0.01 / $105.00 | 74.12 | +12.30% (0.00%) | SAFE | +$103 ($0) | 98.0% | -0.019 (0.000) | \u26a0 wide |\n| ORCL put 134.0/133.0 2026-08-14 | 2026-08-07T14:45:42.898437Z / -0.07 / $210.00 | 146.94 | +8.80% (0.00%) | SAFE | +$202 ($0) | 96.4% | -0.125 (0.000) | ok |\n| PLTR put 150.0/149.0 2026-08-14 | 2026-08-07T16:05:22.271329Z / 0.00 / $0.00 | 172.00 | +12.79% (0.00%) | SAFE | -$9 ($0) | n/a | -0.041 (0.000) | \u26a0 wide |\n| SLV put 53.5/53.0 2026-08-14 | 2026-08-07T14:11:36.006493Z / -0.01 / $222.00 | 57.51 | +6.97% (0.00%) | SAFE | +$198 ($0) | 89.0% | -0.107 (0.000) | \u26a0 wide |\n| SPY call 784.0/785.0 2026-08-11 | 2026-08-07T14:30:43.25206Z / -0.05 / $140.00 | 773.16 | +1.40% (0.00%) | DANGER | +$140 ($0) | 99.8% | +0.047 (+0.001) | ok |\n| TLT put 81.0/80.5 2026-08-17 | 2026-08-07T13:53:27.494782Z / -0.02 / $454.00 | 82.76 | +2.13% (0.00%) | WATCH | +$447 ($0) | 98.5% | -0.098 (-0.001) | \u26a0 wide |\n| TSLA put 305.0/302.5 2026-08-12 | 2026-08-07T13:40:17.618555Z / -0.36 / $1,656.00 | 327.50 | +6.87% (0.00%) | SAFE | +$1,650 ($0) | 99.7% | -0.055 (0.000) | ok |\n| TSM call 437.5/440.0 2026-08-14 | 2026-08-07T15:01:29.570716Z / -0.18 / $216.00 | 419.92 | +4.19% (0.00%) | WATCH | +$207 ($0) | 96.0% | +0.237 (+0.001) | ok |\n\n## What we think right now\n\n- **ARM put 255.0/250.0** (2026-08-14, 7d): spot 282.64, cushion 9.8%, credit $195.00 vs close-cost $5.10 (97.4% captured); exit: hold to expiry.\n- **BABA call 143.0/144.0** (2026-08-14, 7d): spot 128.41, cushion 11.4%, credit -$1,848.00 vs close-cost $21.84 (n/a captured); exit: hold to expiry. (\u26a0 wide quote \u2014 greeks low-confidence)\n- **COIN put 143.0/142.0** (2026-08-14, 7d): spot 153.61, cushion 6.9%, credit $160.00 vs close-cost $12.80 (92.0% captured); exit: hold to expiry.\n- **INTC put 88.0/87.0** (2026-08-12, 5d): spot 101.64, cushion 13.4%, credit -$84.00 vs close-cost $6.16 (n/a captured); exit: hold to expiry. (\u26a0 wide quote \u2014 greeks low-confidence)\n- **MSFT call 527.5/530.0** (2026-08-14, 7d): spot 499.88, cushion 5.5%, credit $600.00 vs close-cost $18.50 (96.9% captured); exit: hold to expiry.\n- **MSTR put 95.0/94.0** (2026-08-14, 7d): spot 99.97, cushion 5.0%, credit $192.00 vs close-cost $13.76 (92.8% captured); exit: hold to expiry.\n- **NFLX put 65.0/64.0** (2026-08-21, 14d): spot 74.12, cushion 12.3%, credit $105.00 vs close-cost $2.10 (98.0% captured); exit: hold to expiry. (\u26a0 wide quote \u2014 greeks low-confidence)\n- **ORCL put 134.0/133.0** (2026-08-14, 7d): spot 146.94, cushion 8.8%, credit $210.00 vs close-cost $7.50 (96.4% captured); exit: hold to expiry.\n- **PLTR put 150.0/149.0** (2026-08-14, 7d): spot 172.00, cushion 12.8%, credit $0.00 vs close-cost $9.05 (n/a captured); exit: hold to expiry. (\u26a0 wide quote \u2014 greeks low-confidence)\n- **SLV put 53.5/53.0** (2026-08-14, 7d): spot 57.51, cushion 7.0%, credit $222.00 vs close-cost $24.42 (89.0% captured); exit: hold to expiry. (\u26a0 wide quote \u2014 greeks low-confidence)\n- **SPY call 784.0/785.0** (2026-08-11, 4d): spot 773.16, cushion 1.4%, credit $140.00 vs close-cost $0.28 (99.8% captured); exit: hold to expiry.\n- **TLT put 81.0/80.5** (2026-08-17, 10d): spot 82.76, cushion 2.1%, credit $454.00 vs close-cost $6.81 (98.5% captured); exit: hold to expiry. (\u26a0 wide quote \u2014 greeks low-confidence)\n- **TSLA put 305.0/302.5** (2026-08-12, 5d): spot 327.50, cushion 6.9%, credit $1,656.00 vs close-cost $5.52 (99.7% captured); exit: hold to expiry.\n- **TSM call 437.5/440.0** (2026-08-14, 7d): spot 419.92, cushion 4.2%, credit $216.00 vs close-cost $8.64 (96.0% captured); exit: hold to expiry.\n\n## Action queue\n\n- \u26a0 BABA call 143.0/144.0 2026-08-14: leg quote too wide for confident greeks \u2014 verify before acting on it.\n- \u26a0 INTC put 88.0/87.0 2026-08-12: leg quote too wide for confident greeks \u2014 verify before acting on it.\n- \u26a0 NFLX put 65.0/64.0 2026-08-21: leg quote too wide for confident greeks \u2014 verify before acting on it.\n- \u26a0 PLTR put 150.0/149.0 2026-08-14: leg quote too wide for confident greeks \u2014 verify before acting on it.\n- \u26a0 SLV put 53.5/53.0 2026-08-14: leg quote too wide for confident greeks \u2014 verify before acting on it.\n- \ud83d\udfe0 SPY call 784.0/785.0 2026-08-11: cushion in DANGER band \u2014 watch closely.\n- \u26a0 TLT put 81.0/80.5 2026-08-17: leg quote too wide for confident greeks \u2014 verify before acting on it.\n\n## Open queue\n\n- Deployed $44,373.89 of target $104,659.29 (38.2% of equity) \u2014 headroom $60,285.40\n\n| Ticker | Short | Long | Contracts | Expiry | DTE | PoP | Risk | Credit | EV |\n|---|---|---|---|---|---|---|---|---|---|\n| TLT | TLT260819C00085000 | TLT260819C00085500 | 222 | 2026-08-19 | 12 | 90.2% | $9,990.00 | $1,110.00 | +$24.42 |\n\n## Rules in force\n\n- `hold_to_expiry`: True\n- `profit_target_pct`: 0.8\n- `close_on_strike_breach`: True\n- `strike_breach_buffer_pct`: 0.005\n- `max_short_delta`: 0.2\n- `min_pop`: 0.78\n- `min_dte`: 4\n- `max_dte`: 9\n- `max_per_underlying`: 1\n- `live`: False\n\n## Provenance\n\n- Record generated: 2026-08-07T20:36:38+00:00 (0m ago)\n- Oldest quote: 2026-08-07T19:56:01.657421708Z (41m ago)\n- SPREAD_PLAN generated: 2026-08-07T06:00:44+00:00 (14.6h ago)\n- Prior snapshot: 2026-08-07T20:33:11+00:00\n"
};
