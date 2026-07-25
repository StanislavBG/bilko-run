/* global React */
// G1 — <SignalAgreementPanel>: per-thesis 4-source signal agreement.
// For each thesis (window.THESES), shows what 4 distinct signal sources
// said about the ticker:
//   1. legacy momentum         → derived from window.AUDIT_LOG
//                                (rule_break / signal entries by ticker)
//   2. event-driven agent      → derived from thesis.contributors
//                                (the agent strategies that built the thesis)
//   3. ticker_intent           → derived from thesis direction + confidence
//   4. unusual_options_volume  → looked up in window.OPTIONS_FLOW by ticker
//
// When window.SIGNAL_AGREEMENT[thesis.key] is present (G2 aggregation),
// it overrides the inferred view — that lets G2 land later without
// touching this file again.
//
// Agreement is highlighted: when 3+ sources lean the same direction
// (long/short), the row gets a green/red border tint.

const _SOURCES = ["momentum", "agent", "intent", "options"];
const _SOURCE_LABELS = {
  momentum: "Legacy momentum",
  agent: "Event-driven agent",
  intent: "ticker_intent",
  options: "Unusual options",
};

function _normDir(d) {
  if (d === "long" || d === "bullish" || d === "buy") return "long";
  if (d === "short" || d === "bearish" || d === "sell") return "short";
  return "neutral";
}

function _toneFor(dir) {
  if (dir === "long") return { color: "var(--pos)", label: "long" };
  if (dir === "short") return { color: "var(--neg)", label: "short" };
  return { color: "var(--muted)", label: "—" };
}

function _inferMomentum(ticker, auditLog) {
  if (!ticker || !Array.isArray(auditLog)) return { dir: "neutral", note: "no audit row" };
  const tk = ticker.toUpperCase();
  for (const row of auditLog) {
    if (!row || (row.ticker || "").toUpperCase() !== tk) continue;
    if (row.action === "rule_break") {
      return { dir: "neutral", note: row.rationale || "rejected" };
    }
    const meta = row.metadata || {};
    const decision = (meta.decision || "").toLowerCase();
    if (decision === "buy" || row.action === "buy") return { dir: "long", note: row.action || "buy" };
    if (decision === "sell" || row.action === "sell") return { dir: "short", note: row.action || "sell" };
  }
  return { dir: "neutral", note: "silent" };
}

function _inferAgent(thesis) {
  const contributors = Array.isArray(thesis.contributors) ? thesis.contributors : [];
  const agents = contributors.filter((c) => /^[A-Z_]+$/.test(c) && !c.startsWith("r_"));
  if (agents.length === 0) return { dir: "neutral", note: "no agent contributor" };
  return { dir: _normDir(thesis.direction), note: agents.join(" + ") };
}

function _inferIntent(thesis) {
  const conf = typeof thesis.confidence === "number" ? thesis.confidence : null;
  if (conf == null) return { dir: "neutral", note: "no confidence" };
  if (conf < 0.5) return { dir: "neutral", note: `conf ${conf.toFixed(2)}` };
  return { dir: _normDir(thesis.direction), note: `conf ${conf.toFixed(2)}` };
}

function _inferOptions(ticker, optionsFlow) {
  if (!ticker || !Array.isArray(optionsFlow)) return { dir: "neutral", note: "no flow row" };
  const tk = ticker.toUpperCase();
  const row = optionsFlow.find((r) => (r && (r.ticker || "").toUpperCase() === tk));
  if (!row) return { dir: "neutral", note: "no flow row" };
  const dir = _normDir(row.direction);
  const tag = row.isUnusual ? "unusual" : "normal";
  const cp = typeof row.callPutRatio === "number" ? ` C/P ${row.callPutRatio.toFixed(2)}` : "";
  return { dir, note: `${tag}${cp}` };
}

function _signalsFor(thesis, auditLog, optionsFlow, override) {
  if (override && typeof override === "object") {
    const out = {};
    for (const k of _SOURCES) {
      const v = override[k];
      if (v && typeof v === "object") {
        out[k] = { dir: _normDir(v.dir || v.direction), note: v.note || "" };
      } else {
        out[k] = { dir: "neutral", note: "—" };
      }
    }
    return out;
  }
  return {
    momentum: _inferMomentum(thesis.ticker, auditLog),
    agent: _inferAgent(thesis),
    intent: _inferIntent(thesis),
    options: _inferOptions(thesis.ticker, optionsFlow),
  };
}

function _agreementFor(signals) {
  let long = 0;
  let short = 0;
  for (const k of _SOURCES) {
    const s = signals[k];
    if (!s) continue;
    if (s.dir === "long") long += 1;
    else if (s.dir === "short") short += 1;
  }
  const max = Math.max(long, short);
  if (max < 3) return { dir: "neutral", count: max, label: `${max}/4` };
  if (long > short) return { dir: "long", count: long, label: `${long}/4 long` };
  return { dir: "short", count: short, label: `${short}/4 short` };
}

function SignalAgreementPanel({ limit }) {
  const theses = Array.isArray(window.THESES) ? window.THESES : [];
  const auditLog = Array.isArray(window.AUDIT_LOG) ? window.AUDIT_LOG : [];
  const optionsFlow = Array.isArray(window.OPTIONS_FLOW) ? window.OPTIONS_FLOW : [];
  const overrides = (window.SIGNAL_AGREEMENT && typeof window.SIGNAL_AGREEMENT === "object")
    ? window.SIGNAL_AGREEMENT : {};

  if (theses.length === 0) {
    return (
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-head"><h3>Signal agreement · 4-way</h3></div>
        <div className="card-body">
          <p style={{ color: "var(--muted)", fontFamily: "var(--mono)", fontSize: 12, margin: 0 }}>
            No theses yet — nothing to compare.
          </p>
        </div>
      </div>
    );
  }

  // Newest-first (by updatedAt) so the active book bubbles up; fall back
  // to input order if updatedAt is missing.
  const sorted = theses.slice().sort((a, b) => {
    const ta = new Date(a.updatedAt || 0).getTime() || 0;
    const tb = new Date(b.updatedAt || 0).getTime() || 0;
    return tb - ta;
  });
  const max = typeof limit === "number" && limit > 0 ? limit : 12;
  const rows = sorted.slice(0, max);

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div className="card-head">
        <h3>Signal agreement · 4-way</h3>
        <span className="mono" style={{ fontSize: 10, color: "var(--muted)" }}>
          legacy momentum · event agent · ticker_intent · options flow · 3+ aligned highlights
        </span>
      </div>
      <div className="card-body tight">
        <table className="trades">
          <thead>
            <tr>
              <th>Ticker</th>
              <th>Thesis</th>
              {_SOURCES.map((s) => (
                <th key={s} className="num" style={{ minWidth: 110 }}>{_SOURCE_LABELS[s]}</th>
              ))}
              <th className="num">Agreement</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((th) => {
              const signals = _signalsFor(th, auditLog, optionsFlow, overrides[th.key]);
              const agree = _agreementFor(signals);
              const tone = _toneFor(agree.dir);
              const rowStyle = agree.count >= 3
                ? { borderLeft: `3px solid ${tone.color}` }
                : {};
              return (
                <tr key={th.key} style={rowStyle}>
                  <td className="ticker">{th.ticker}</td>
                  <td className="dim" style={{ fontSize: 11, maxWidth: 220 }}>
                    <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--muted)" }}>
                      {th.state} · {th.catalyst || "—"}
                    </div>
                    <div style={{ fontSize: 11 }}>{(th.contributors || []).join(", ") || "—"}</div>
                  </td>
                  {_SOURCES.map((s) => {
                    const sig = signals[s];
                    const t = _toneFor(sig.dir);
                    return (
                      <td key={s} className="num" style={{ fontFamily: "var(--mono)", fontSize: 11 }}>
                        <span style={{ color: t.color, fontWeight: 600 }}>{t.label}</span>
                        <div style={{ color: "var(--muted)", fontSize: 10 }}>{sig.note}</div>
                      </td>
                    );
                  })}
                  <td className="num" style={{ fontFamily: "var(--mono)", fontSize: 11, color: tone.color, fontWeight: 600 }}>
                    {agree.label}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

Object.assign(window, { SignalAgreementPanel });
