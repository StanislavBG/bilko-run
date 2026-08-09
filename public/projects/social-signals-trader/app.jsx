/* global React, ReactDOM, SITE, PERF, EQUITY, HEATMAP, TRADES, WATCHLIST, SUBREDDITS, TRENDING, THEMES, STRATEGIES, WEEKLY_REPORTS, UNIVERSE_COVERAGE, SLEEVE_ACTIVATION, UPCOMING_CATALYSTS,
   StatusBar, Header, Hero, StatStrip, PerStrategyAttribution, EquityChart, Heatmap, TradesTable,
   SubredditPanel, TrendingTickers, Themes, Watchlist, Methodology, FooterCTA,
   TradesPage, RedditPage, WatchlistPage, MethodologyPage, ReportsPage, StrategiesPage,
   TweaksPanel, useTweaks, TweakSection, TweakRadio, TweakToggle, TweakSelect */

const { useState } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "dark",
  "density": "default",
  "accent": "amber",
  "showRedditPanel": true,
  "heroMetric": "dollar",
  "showFloatingBmc": true
}/*EDITMODE-END*/;

const ACCENT_MAP = {
  amber: "oklch(0.82 0.16 75)",
  green: "oklch(0.78 0.16 145)",
  blue:  "oklch(0.78 0.14 235)",
  mono:  "oklch(0.86 0.008 250)",
};

function getInitialPage() {
  // Options Log is deep-linkable per ticker as #options/AAPL, so match on the
  // segment before the slash — the page itself reads the ticker off the hash.
  const h = (location.hash || "").replace("#", "").split("/")[0];
  if (["dashboard","trades","watchlist","signals","optimization","options","trade"].includes(h)) return h;
  // ?ticker=AAPL with no hash is still an Options Log link — honour it rather
  // than silently dropping the visitor elsewhere.
  if (new URLSearchParams(location.search || "").get("ticker")) return "options";
  // Landing surface: the Options Log. The credit-spread book IS the fund's
  // live activity right now, so a visitor with no hash lands on it; the
  // account-vs-SPY review page stays one click away at #dashboard.
  // Paused tabs (strategies, macro, reddit, reports, methodology) land here too.
  return "options";
}

function App() {
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [tf, setTf] = useState("90D");
  const [page, setPageRaw] = useState(getInitialPage);

  const setPage = (p) => {
    setPageRaw(p);
    if (location.hash !== "#" + p) location.hash = p;
    window.scrollTo(0, 0);
  };

  React.useEffect(() => {
    const onHash = () => setPageRaw(getInitialPage());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  React.useEffect(() => {
    document.documentElement.dataset.theme = tweaks.theme;
    document.documentElement.dataset.density = tweaks.density;
    document.documentElement.style.setProperty("--accent", ACCENT_MAP[tweaks.accent] || ACCENT_MAP.amber);
  }, [tweaks.theme, tweaks.density, tweaks.accent]);

  // Single-page consolidation: one review surface — Hero (account vs SPY) +
  // EquityChart, then the four sections the user cares about: Catalysts coming
  // up → Current positions → Trade log → long-horizon Watchlist. All other
  // tabs (Trades/Strategies/Macro/Reddit/Signals/Optimization/Reports) are
  // retired; their component files remain on disk but are no longer mounted.
  // Options Log (#options) is the one surface that is NOT part of the
  // single-page dashboard — it's a full-width options worksheet, so it replaces
  // the dashboard body rather than sitting inside it. It is also the landing
  // page (see getInitialPage).
  if (page === "options" && window.TickerDetailsPage) {
    return (
      <>
        <StatusBar />
        <Header handle={SITE.handle} bmcUrl={SITE.bmcUrl} setPage={setPage} />
        <window.TickerDetailsPage />
      </>
    );
  }

  if (page === "trade" && window.OptionTradeDetailPage) {
    return (
      <>
        <StatusBar />
        <Header handle={SITE.handle} bmcUrl={SITE.bmcUrl} setPage={setPage} />
        <window.OptionTradeDetailPage />
      </>
    );
  }

  return (
    <>
      <StatusBar />
      <Header handle={SITE.handle} bmcUrl={SITE.bmcUrl} setPage={setPage} />

      <main className="shell" id="dashboard">
        <Hero perf={PERF} equity={EQUITY} mode={tweaks.heroMetric} />
        <div style={{ marginTop: 12 }}>
          <EquityChart equity={EQUITY} timeframe={tf} setTimeframe={setTf} />
        </div>
        {window.UpcomingCatalystsWidget && (
          <div id="catalysts" style={{ marginTop: 12 }}>
            <window.UpcomingCatalystsWidget panel={window.UPCOMING_CATALYSTS} />
          </div>
        )}
        <div style={{ marginTop: 12 }}>
          <CurrentPositions positions={window.POSITIONS} />
        </div>
        <div id="tradelog" style={{ marginTop: 12 }}>
          <TradesTable trades={TRADES} bmcUrl={SITE.bmcUrl} />
        </div>
        <div style={{ marginTop: 12 }}>
          <Watchlist detail={window.WATCHLIST_DETAIL} passed={window.PASSED_SIGNALS} />
        </div>
        <FooterCTA bmcUrl={SITE.bmcUrl} perf={PERF} />
      </main>

      <div className="shell footer-meta" style={{ paddingTop: 0 }}>
        <span>{SITE.handle}</span><span>·</span>
        <span>started {SITE.startedISO}</span><span>·</span>
        <span>not financial advice</span><span>·</span>
        <span>data refreshed every 15m</span>
        <span style={{ marginLeft: "auto" }}>v0.4.2</span>
      </div>

      {tweaks.showFloatingBmc && (
        <a className="bmc-floating" href={SITE.bmcUrl} target="_blank" rel="noreferrer">
          <span>☕</span> Buy me a coffee
        </a>
      )}

      <TweaksPanel title="Tweaks">
        <TweakSection title="Theme">
          <TweakRadio label="Mode" value={tweaks.theme} onChange={(v) => setTweak("theme", v)}
            options={[{ value: "dark", label: "Dark" },{ value: "light", label: "Light" }]} />
          <TweakRadio label="Density" value={tweaks.density} onChange={(v) => setTweak("density", v)}
            options={[{ value: "compact", label: "Compact" },{ value: "default", label: "Default" },{ value: "comfortable", label: "Cozy" }]} />
          <TweakSelect label="Accent" value={tweaks.accent} onChange={(v) => setTweak("accent", v)}
            options={[{ value: "amber", label: "Amber" },{ value: "green", label: "Green" },{ value: "blue", label: "Blue" },{ value: "mono", label: "Mono" }]} />
        </TweakSection>
        <TweakSection title="Layout">
          <TweakRadio label="Hero" value={tweaks.heroMetric} onChange={(v) => setTweak("heroMetric", v)}
            options={[{ value: "dollar", label: "$" },{ value: "percent", label: "%" },{ value: "legacy", label: "5-col" }]} />
          <TweakToggle label="Reddit intel sidebar" value={tweaks.showRedditPanel} onChange={(v) => setTweak("showRedditPanel", v)} />
          <TweakToggle label="Floating coffee button" value={tweaks.showFloatingBmc} onChange={(v) => setTweak("showFloatingBmc", v)} />
        </TweakSection>
      </TweaksPanel>
    </>
  );
}

// Overlay live server data over the bundled baseline BEFORE the first render, so
// every component reads fresh window.* values. __loadLiveSnapshot never rejects
// (it falls back to the bundled data.js on any failure), so render always runs.
(async () => {
  if (typeof window.__loadLiveSnapshot === "function") {
    await window.__loadLiveSnapshot();
  }
  ReactDOM.createRoot(document.getElementById("root")).render(<App />);
})();
