// Shared option-spread formatting/parsing — the single OCC parser + spread
// classifier + breakeven math used by every panel that renders option legs
// (options-trade-log.jsx, CurrentPositions / TradesTable in components.jsx).
// Plain JS (no JSX), loaded before any panel that references window.SpreadFormat.

(function () {
  const g4 = (v) => (v == null ? "—" : Number(v).toFixed(4));
  const money = (v) => (v == null ? "—" : (v < 0 ? "-$" : "$") + Math.abs(Number(v)).toLocaleString(undefined, { maximumFractionDigits: 2 }));
  const pctv = (v) => (v == null ? "—" : (Number(v) * 100).toFixed(1) + "%");
  const num = (v) => (v == null || v === "" ? null : Number(v));

  // --- OCC symbol parsing ------------------------------------------------
  // Layout: <root><yymmdd><C|P><strike*1000, 8 digits>, e.g.
  // SPY260810C00777000 -> SPY $777 CALL exp 2026-08-10.
  function parseOccSymbol(symbol) {
    if (!symbol || typeof symbol !== "string" || symbol.length < 15) return null;
    const tail = symbol.slice(-15);
    const datePart = tail.slice(0, 6);
    const rightChar = tail[6];
    const strikePart = tail.slice(7);
    if (!/^[0-9]{6}$/.test(datePart) || !/^[CP]$/.test(rightChar) || !/^[0-9]{8}$/.test(strikePart)) {
      return null;
    }
    const root = symbol.slice(0, -15);
    if (!root) return null;
    const yy = datePart.slice(0, 2);
    const mm = datePart.slice(2, 4);
    const dd = datePart.slice(4, 6);
    const strike = parseInt(strikePart, 10) / 1000;
    return {
      root,
      expiry: `20${yy}-${mm}-${dd}`,
      right: rightChar === "C" ? "CALL" : "PUT",
      strike,
    };
  }

  function plainEnglishLeg(symbol) {
    const p = parseOccSymbol(symbol);
    if (!p) return symbol || "—";
    return `${p.root} $${p.strike} ${p.right} exp ${p.expiry}`;
  }

  function spreadStructure(shortParsed, longParsed, ticker) {
    if (!shortParsed || !longParsed) return null;
    if (shortParsed.right === "CALL" && longParsed.right === "CALL" && shortParsed.strike < longParsed.strike) {
      return {
        name: "Bear call credit spread",
        gloss: `profits if ${ticker} stays below $${shortParsed.strike} through ${shortParsed.expiry}`,
      };
    }
    if (shortParsed.right === "PUT" && longParsed.right === "PUT" && shortParsed.strike > longParsed.strike) {
      return {
        name: "Bull put credit spread",
        gloss: `profits if ${ticker} stays above $${shortParsed.strike} through ${shortParsed.expiry}`,
      };
    }
    return { name: "Credit spread", gloss: null };
  }

  // Breakeven = short strike + credit/share for a call spread,
  // short strike - credit/share for a put spread. A spread that filled at a
  // net DEBIT (credit <= 0) has no breakeven — it cannot win at any price —
  // so this returns null rather than a number that looks like a real target.
  function breakeven(shortParsed, credit, contracts) {
    if (!shortParsed || credit == null || credit <= 0 || !contracts) return null;
    const creditPerShare = credit / contracts / 100;
    return shortParsed.right === "CALL" ? shortParsed.strike + creditPerShare : shortParsed.strike - creditPerShare;
  }

  // Whole calendar days from now until an ISO expiry date (YYYY-MM-DD).
  function dteFromExpiry(expiry, now) {
    if (!expiry) return null;
    const exp = new Date(expiry + "T00:00:00Z");
    if (Number.isNaN(exp.getTime())) return null;
    const ref = now || new Date();
    const refUtc = Date.UTC(ref.getFullYear(), ref.getMonth(), ref.getDate());
    return Math.round((exp.getTime() - refUtc) / 86400000);
  }

  window.SpreadFormat = {
    g4, money, pctv, num,
    parseOccSymbol, plainEnglishLeg, spreadStructure, breakeven, dteFromExpiry,
  };
})();
