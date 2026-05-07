/* global React, ReactDOM, SITE, PERF, EQUITY, HEATMAP, TRADES, WATCHLIST, SUBREDDITS, TRENDING, THEMES, STRATEGIES,
   StatusBar, Header, Hero, StatStrip, EquityChart, Heatmap, TradesTable,
   SubredditPanel, TrendingTickers, Themes, Watchlist, Methodology, FooterCTA,
   TradesPage, RedditPage, WatchlistPage, MethodologyPage, StrategiesPage,
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
  const h = (location.hash || "").replace("#", "");
  return ["dashboard","strategies","macro","trades","reddit","watchlist","methodology"].includes(h) ? h : "dashboard";
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

  return (
    <>
      <StatusBar />
      <Header handle={SITE.handle} bmcUrl={SITE.bmcUrl} page={page} setPage={setPage} />

      {page === "dashboard" && (
        <main className="shell" id="dashboard">
          <Hero perf={PERF} equity={EQUITY} />
          <div style={{ marginTop: 12 }}><StatStrip perf={PERF} /></div>
          <div className="grid grid-12" style={{ marginTop: 12 }}>
            <div className={`${tweaks.showRedditPanel ? "col-8" : "col-12"} col-md-12`} style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr" }}>
              <EquityChart equity={EQUITY} timeframe={tf} setTimeframe={setTf} />
              <div className="grid grid-12">
                <div className="col-7 col-md-12"><Heatmap data={HEATMAP} /></div>
                <div className="col-5 col-md-12"><TrendingTickers trending={TRENDING} /></div>
              </div>
              <TradesTable trades={TRADES} bmcUrl={SITE.bmcUrl} />
              <Watchlist list={WATCHLIST} />
            </div>
            {tweaks.showRedditPanel && (
              <div className="col-4 col-md-12" id="reddit-side" style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr", alignContent: "start" }}>
                <Themes themes={THEMES} />
                <SubredditPanel subs={SUBREDDITS} />
              </div>
            )}
          </div>
          <FooterCTA bmcUrl={SITE.bmcUrl} perf={PERF} />
        </main>
      )}

      {page === "strategies" && <StrategiesPage />}
      {page === "macro" && <MacroPage />}
      {page === "trades" && <TradesPage />}
      {page === "reddit" && <RedditPage />}
      {page === "watchlist" && <WatchlistPage />}
      {page === "methodology" && <MethodologyPage />}

      {page !== "dashboard" && (
        <div className="shell"><FooterCTA bmcUrl={SITE.bmcUrl} perf={PERF} /></div>
      )}

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
          <TweakToggle label="Reddit intel sidebar" value={tweaks.showRedditPanel} onChange={(v) => setTweak("showRedditPanel", v)} />
          <TweakToggle label="Floating coffee button" value={tweaks.showFloatingBmc} onChange={(v) => setTweak("showFloatingBmc", v)} />
        </TweakSection>
      </TweaksPanel>
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
