// Published stub. The live trade log carries per-position sizing, expected
// value and strategy thresholds, which the project contract keeps internal —
// so only the shape ships here, not the book. The panel renders its empty
// state against this and the local dashboard overrides it with the real file.
window.SPREAD_LOG = { generatedAt: null, strategy: "CREDIT_SPREAD", events: [] };
