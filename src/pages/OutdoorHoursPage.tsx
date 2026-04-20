/**
 * OutdoorHours — KOUT-7 dashboard.
 *
 * Read-only data viz: 10 years of hourly ERA5 reanalysis collapsed into
 * "good-for-outdoors hours" via a four-rule classifier (daytime, comfortable
 * temp, safe UV, not pouring). Compares Santa Clara County, CA with Eastside
 * King County, WA.
 *
 * Bundle is fully static — fetches `/outdoor-hours/last10y.json` and renders
 * with Plotly (loaded once via CDN). No backend route, no auth, no inputs.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

declare global {
  interface Window { Plotly?: any; }
}

type Grain = 'yearly' | 'monthly' | 'daily';
type RegionKey = 'santa_clara_ca' | 'eastside_king_wa';

interface MetricMeta { key: string; label: string; unit: string; kind: 'sum' | 'mean' | 'max' | 'pct'; }
interface RegionGrainData { label: string; x: (string | number)[]; series: Record<string, (number | null)[]>; }
interface GrainData { tag: string; grain: Grain; x_label: string; regions: Record<RegionKey, RegionGrainData>; }
interface Payload {
  tag: string;
  metrics: MetricMeta[];
  regions: Record<RegionKey, string>;
  grains: Record<Grain, GrainData>;
  rule: { temp_min_c: number; temp_max_c: number; temp_min_f: number; temp_max_f: number; uv_max: number; rain_max_mm_h: number };
}

const REGION_COLOR: Record<RegionKey, string> = {
  santa_clara_ca: '#e45c3a',
  eastside_king_wa: '#0e8f74',
};

const PLOTLY_SRC = 'https://cdn.plot.ly/plotly-2.35.2.min.js';
let plotlyPromise: Promise<void> | null = null;
function loadPlotly(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.Plotly) return Promise.resolve();
  if (plotlyPromise) return plotlyPromise;
  plotlyPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = PLOTLY_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('plotly failed to load'));
    document.head.appendChild(s);
  });
  return plotlyPromise;
}

const HIGHER_BETTER = new Set(['stay_outside_hours', 'pct_daytime_outside', 'sunshine_hours']);
const LOWER_BETTER = new Set(['precipitation_sum', 'cloud_cover_mean', 'wind_gusts_10m_max', 'relative_humidity_2m_mean']);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function fmtValue(v: number | null | undefined, unit: string): string {
  if (v == null || !Number.isFinite(v)) return '—';
  const abs = Math.abs(v);
  const digits = abs >= 100 ? 0 : abs >= 10 ? 1 : 2;
  return `${v.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })} ${unit}`.trim();
}

function summarize(values: (number | null)[], kind: MetricMeta['kind']): number | null {
  const vs = values.filter((v): v is number => v != null && Number.isFinite(v));
  if (!vs.length) return null;
  if (kind === 'sum') return vs.reduce((a, b) => a + b, 0);
  if (kind === 'max') return Math.max(...vs);
  return vs.reduce((a, b) => a + b, 0) / vs.length;
}

function findExtremes(xs: (string | number)[], ys: (number | null)[]) {
  let hi = -Infinity, lo = Infinity, hiI = -1, loI = -1;
  ys.forEach((v, i) => {
    if (v == null || !Number.isFinite(v)) return;
    if (v > hi) { hi = v; hiI = i; }
    if (v < lo) { lo = v; loI = i; }
  });
  return {
    hi: hiI >= 0 ? { x: xs[hiI], y: hi } : null,
    lo: loI >= 0 ? { x: xs[loI], y: lo } : null,
  };
}

function prettyBucket(x: string | number, grain: Grain): string {
  if (grain === 'yearly') return String(x);
  const m = String(x).match(/^(\d{4})-(\d{2})(?:-(\d{2}))?/);
  if (!m) return String(x);
  const year = +m[1], month = +m[2] - 1, day = m[3] ? +m[3] : null;
  return day ? `${MONTHS[month]} ${day}, ${year}` : `${MONTHS[month]} ${year}`;
}

// ── Drill-down: yearly→monthly slice, monthly→daily slice (no extra fetch needed). ──

interface DetailRow { x: string | number; values: Record<string, number | null>; }
interface DetailResult { detailGrain: Grain; rows: DetailRow[]; }

function drillDown(payload: Payload, grain: Grain, region: RegionKey, bucket: string | number): DetailResult | null {
  if (grain === 'daily') {
    // Hourly drill not shipped in v1 — clicking a day shows all metrics at that day for the region.
    const day = String(bucket).slice(0, 10);
    const data = payload.grains.daily.regions[region];
    const idx = data.x.findIndex(v => String(v).slice(0, 10) === day);
    if (idx < 0) return null;
    const row: DetailRow = { x: data.x[idx], values: {} };
    Object.entries(data.series).forEach(([k, arr]) => { row.values[k] = arr[idx]; });
    return { detailGrain: 'daily', rows: [row] };
  }
  if (grain === 'monthly') {
    const month = String(bucket).slice(0, 7); // "YYYY-MM"
    const data = payload.grains.daily.regions[region];
    const rows: DetailRow[] = [];
    data.x.forEach((x, i) => {
      if (String(x).slice(0, 7) !== month) return;
      const row: DetailRow = { x, values: {} };
      Object.entries(data.series).forEach(([k, arr]) => { row.values[k] = arr[i]; });
      rows.push(row);
    });
    return { detailGrain: 'daily', rows };
  }
  // yearly → monthly
  const year = Number(bucket);
  const data = payload.grains.monthly.regions[region];
  const rows: DetailRow[] = [];
  data.x.forEach((x, i) => {
    const yr = Number(String(x).slice(0, 4));
    if (yr !== year) return;
    const row: DetailRow = { x, values: {} };
    Object.entries(data.series).forEach(([k, arr]) => { row.values[k] = arr[i]; });
    rows.push(row);
  });
  return { detailGrain: 'monthly', rows };
}

const DETAIL_COLS: { key: string; label: string; fmt: 'num0' | 'num1' | 'num2' }[] = [
  { key: 'stay_outside_hours',  label: 'Good-for-outdoors (h)', fmt: 'num1' },
  { key: 'pct_daytime_outside', label: '% daylight usable',     fmt: 'num1' },
  { key: 'temperature_2m_mean', label: 'Temp avg (°C)',         fmt: 'num1' },
  { key: 'temperature_2m_max',  label: 'Temp max',              fmt: 'num1' },
  { key: 'temperature_2m_min',  label: 'Temp min',              fmt: 'num1' },
  { key: 'uv_index_est_mean',   label: 'UV avg',                fmt: 'num2' },
  { key: 'uv_index_est_max',    label: 'UV max',                fmt: 'num2' },
  { key: 'precipitation_sum',   label: 'Rain (mm)',             fmt: 'num2' },
  { key: 'cloud_cover_mean',    label: 'Cloud (%)',             fmt: 'num0' },
  { key: 'wind_gusts_10m_max',  label: 'Peak gust (m/s)',       fmt: 'num1' },
];

function fmtCell(v: number | null | undefined, fmt: 'num0' | 'num1' | 'num2'): string {
  if (v == null || !Number.isFinite(v)) return '';
  const d = fmt === 'num0' ? 0 : fmt === 'num1' ? 1 : 2;
  return v.toFixed(d);
}

// ── Page ─────────────────────────────────────────────────────────────────

export function OutdoorHoursPage() {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [grain, setGrain] = useState<Grain>('monthly');
  const [metricKey, setMetricKey] = useState<string>('stay_outside_hours');
  const [detail, setDetail] = useState<{ region: RegionKey; bucket: string | number; result: DetailResult; xLabel: string; metricLabel: string; metricValue: number | null; unit: string } | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);

  // Load data + Plotly once.
  useEffect(() => {
    fetch('/outdoor-hours/last10y.json')
      .then(r => { if (!r.ok) throw new Error(`load failed: ${r.status}`); return r.json(); })
      .then(setPayload)
      .catch(e => setError(String(e)));
    loadPlotly().catch(e => setError(String(e)));
  }, []);

  const meta: MetricMeta | undefined = payload?.metrics.find(m => m.key === metricKey);

  // Render plot whenever data/grain/metric changes.
  useEffect(() => {
    if (!payload || !chartRef.current || !window.Plotly || !meta) return;
    const grainData = payload.grains[grain];
    const traces = (Object.entries(grainData.regions) as [RegionKey, RegionGrainData][]).map(([region, s]) => ({
      x: s.x, y: s.series[metricKey] ?? [], name: s.label, type: 'scatter', mode: 'lines+markers',
      marker: { size: grain === 'yearly' ? 11 : 7, color: REGION_COLOR[region], line: { width: 1, color: 'white' } },
      line: { width: 3, color: REGION_COLOR[region] },
      meta: region,
      hovertemplate: `<b>${s.label}</b><br>%{x}<br>${meta.label}: %{y:.2f} ${meta.unit}<br><i>(click to drill in)</i><extra></extra>`,
    }));
    const inter = 'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif';
    const grainWord = { yearly: 'year', monthly: 'month', daily: 'day' }[grain];
    const layout = {
      title: { text: `${meta.label}  <span style="color:#6b7388;font-weight:500">per ${grainWord}</span>`, font: { family: inter, size: 26, color: '#121726' }, x: 0.02, xanchor: 'left', y: 0.96 },
      font: { family: inter, color: '#39415a', size: 15 },
      xaxis: { title: { text: grainData.x_label, font: { size: 15, color: '#6b7388' } }, type: grain === 'yearly' ? 'linear' : 'date', showgrid: true, gridcolor: '#eef0f5', linecolor: '#c9cedb', tickcolor: '#c9cedb', tickfont: { size: 14 } },
      yaxis: { title: { text: `${meta.label} (${meta.unit})`, font: { size: 15, color: '#6b7388' } }, showgrid: true, gridcolor: '#eef0f5', zerolinecolor: '#e3e6ef', linecolor: '#c9cedb', tickcolor: '#c9cedb', tickfont: { size: 14 }, rangemode: meta.key === 'stay_outside_hours' ? 'tozero' : undefined },
      hovermode: 'x unified',
      hoverlabel: { bgcolor: '#121726', bordercolor: '#121726', font: { color: 'white', family: inter, size: 15 } },
      legend: { orientation: 'h', y: -0.18, font: { size: 15, color: '#121726' }, bgcolor: 'rgba(0,0,0,0)' },
      margin: { l: 80, r: 32, t: 80, b: 80 },
      plot_bgcolor: 'white', paper_bgcolor: 'white',
    };
    window.Plotly.newPlot(chartRef.current, traces, layout, { responsive: true, displaylogo: false, modeBarButtonsToRemove: ['lasso2d', 'select2d'] });

    const node: any = chartRef.current;
    const onClick = (ev: any) => {
      if (!ev.points?.length) return;
      const p = ev.points[0];
      const region: RegionKey = (p.data.meta || Object.keys(grainData.regions).find(r => grainData.regions[r as RegionKey].label === p.data.name)) as RegionKey;
      if (!region) return;
      const rawX = p.data.x[p.pointIndex];
      const result = drillDown(payload, grain, region, rawX);
      if (!result) return;
      setDetail({
        region,
        bucket: rawX,
        result,
        xLabel: prettyBucket(rawX, grain),
        metricLabel: meta.label,
        metricValue: p.y,
        unit: meta.unit,
      });
    };
    node.on?.('plotly_click', onClick);
    return () => { node.removeAllListeners?.('plotly_click'); };
  }, [payload, grain, metricKey, meta]);

  // Quick Take.
  const quickTake = useMemo(() => {
    if (!payload || !meta) return null;
    const g = payload.grains[grain];
    const scc = g.regions.santa_clara_ca;
    const king = g.regions.eastside_king_wa;
    const sccVal = summarize(scc.series[metricKey] ?? [], meta.kind);
    const kingVal = summarize(king.series[metricKey] ?? [], meta.kind);
    const sccEx = findExtremes(scc.x, scc.series[metricKey] ?? []);
    const kingEx = findExtremes(king.x, king.series[metricKey] ?? []);
    let winnerShort = '—';
    let headlineHtml = `<em>${meta.label}</em> looks identical across both counties.`;
    if (sccVal != null && kingVal != null && sccVal !== kingVal) {
      const diff = sccVal - kingVal;
      const sccWin = diff > 0;
      const higher = sccWin ? 'Santa Clara' : 'Eastside King';
      const lower = sccWin ? 'Eastside King' : 'Santa Clara';
      const higherCls = sccWin ? 'text-[#b43f21]' : 'text-[#096a56]';
      const lowerCls = sccWin ? 'text-[#096a56]' : 'text-[#b43f21]';
      const higherVal = sccWin ? sccVal : kingVal;
      const lowerVal = sccWin ? kingVal : sccVal;
      const pct = Math.abs(diff) / Math.max(Math.abs(higherVal), Math.abs(lowerVal)) * 100;
      if (HIGHER_BETTER.has(metricKey)) {
        winnerShort = higher;
        headlineHtml = `<span class="${higherCls} font-bold">${higher}</span> wins on <em>${meta.label.toLowerCase()}</em> — <span class="font-bold tabular-nums">${fmtValue(higherVal, meta.unit)}</span> vs. <span class="${lowerCls} font-bold tabular-nums">${fmtValue(lowerVal, meta.unit)}</span> on the ${lower.includes('East') ? 'Eastside' : 'South Bay'}, about <span class="font-bold tabular-nums">${pct.toFixed(0)}%</span> more.`;
      } else if (LOWER_BETTER.has(metricKey)) {
        winnerShort = lower;
        headlineHtml = `<span class="${lowerCls} font-bold">${lower}</span> comes out ahead — less <em>${meta.label.toLowerCase()}</em> (<span class="font-bold tabular-nums">${fmtValue(lowerVal, meta.unit)}</span>) than ${higher} (<span class="font-bold tabular-nums">${fmtValue(higherVal, meta.unit)}</span>), about <span class="font-bold tabular-nums">${pct.toFixed(0)}%</span> less.`;
      } else {
        headlineHtml = `<em>${meta.label}</em> came in at <span class="text-[#b43f21] font-bold tabular-nums">${fmtValue(sccVal, meta.unit)}</span> for Santa Clara and <span class="text-[#096a56] font-bold tabular-nums">${fmtValue(kingVal, meta.unit)}</span> on the Eastside.`;
      }
    }
    const auxBits: string[] = [];
    if (sccEx.hi && kingEx.hi) {
      auxBits.push(
        `Highest: <span class="text-[#b43f21]">Santa Clara peaked at <span class="font-bold tabular-nums">${fmtValue(sccEx.hi.y, meta.unit)}</span> in ${prettyBucket(sccEx.hi.x, grain)}</span>; ` +
        `<span class="text-[#096a56]">the Eastside peaked at <span class="font-bold tabular-nums">${fmtValue(kingEx.hi.y, meta.unit)}</span> in ${prettyBucket(kingEx.hi.x, grain)}</span>.`
      );
    }
    if (metricKey === 'stay_outside_hours' && sccVal != null && kingVal != null) {
      const extraDays = Math.abs(sccVal - kingVal) / 8;
      if (extraDays >= 1) auxBits.push(`That gap works out to roughly <span class="font-bold tabular-nums">${extraDays.toFixed(0)}</span> extra outdoor-friendly days (at 8 daylight hours each).`);
    }
    return { winnerShort, sccVal, kingVal, headlineHtml, auxHtml: auxBits.join(' ') };
  }, [payload, grain, metricKey, meta]);

  const closeDetail = useCallback(() => { setDetail(null); setFullscreen(false); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && detail) closeDetail(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [detail, closeDetail]);

  // ── Render ─────────────────────────────────────────────────────────

  if (error) return <div className="p-8 text-red-600">Failed to load: {error}</div>;
  if (!payload || !meta) return <div className="p-8 text-slate-500">Loading the last 10 years of weather…</div>;

  return (
    <div className="bg-[#f6f7fb] min-h-screen">
      <div className="h-1 bg-gradient-to-r from-[#e45c3a] via-[#f2b046] to-[#0e8f74]" />

      {/* KOUT-7 station bar */}
      <div className="bg-gradient-to-b from-[#0d1019] to-[#121726] border-b border-[#1c2033] shadow-sm">
        <div className="max-w-[1320px] mx-auto px-7 py-3 flex items-center gap-4">
          <span className="font-mono text-lg font-bold tracking-widest px-3 py-1 rounded text-white"
                style={{ background: 'linear-gradient(180deg,#e45c3a,#c44a2a)' }}>KOUT·7</span>
          <span className="w-px h-5 bg-[#2a3050]" />
          <span className="text-base text-[#d4d8e6]">The <strong className="text-white font-bold">Outdoor&nbsp;Hours</strong> Report</span>
          <span className="ml-auto inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#ff4d4d]">
            <span className="w-2 h-2 rounded-full bg-[#ff2a2a] animate-pulse" style={{ boxShadow: '0 0 0 4px rgba(255,42,42,0.25)' }} />
            On the air
          </span>
        </div>
      </div>

      {/* Hero */}
      <header className="max-w-[1320px] mx-auto px-7 pt-12 pb-4">
        <div className="inline-flex items-center gap-3 px-4 py-2 bg-white border border-[#e3e6ef] rounded-full text-sm font-semibold text-[#39415a] shadow-sm">
          <span className="w-3 h-3 rounded-full bg-[#e45c3a]" style={{ boxShadow: '0 0 0 4px rgba(228,92,58,0.18)' }} /> Santa Clara County, CA
          <span className="text-[#6b7388] font-medium">vs.</span>
          <span className="w-3 h-3 rounded-full bg-[#0e8f74]" style={{ boxShadow: '0 0 0 4px rgba(14,143,116,0.18)' }} /> Eastside King County, WA
        </div>
        <h1 className="mt-6 text-[clamp(42px,5.6vw,64px)] font-extrabold tracking-tight leading-[1.02] text-[#121726]">
          Where is the weather <span className="bg-gradient-to-r from-[#e45c3a] via-[#f2b046] to-[#0e8f74] bg-clip-text text-transparent">actually</span> better?
        </h1>
        <p className="mt-4 max-w-[760px] text-xl leading-snug text-[#39415a]">
          We counted every hour of the last <strong className="text-[#121726]">ten years</strong> and asked one simple question — <em className="text-[#121726]">was it comfortable to be outside?</em>
          This dashboard turns those hours into totals you can compare, year by year, between the Bay Area and the Seattle Eastside.
          Click any dot on the chart to see the days behind it.
        </p>

        {/* Stats */}
        <div className="flex gap-4 mt-8 flex-wrap">
          <div className="px-5 py-4 bg-white border border-[#e3e6ef] rounded-xl shadow-sm min-w-[180px] border-t-[3px] border-t-[#e45c3a]">
            <div className="text-3xl font-extrabold tabular-nums text-[#121726] leading-tight">{fmtValue(quickTake?.sccVal ?? null, meta.unit)}</div>
            <div className="text-xs uppercase tracking-wider font-bold mt-1" style={{ color: '#b43f21' }}>Santa Clara, CA</div>
          </div>
          <div className="px-5 py-4 bg-white border border-[#e3e6ef] rounded-xl shadow-sm min-w-[180px] border-t-[3px] border-t-[#0e8f74]">
            <div className="text-3xl font-extrabold tabular-nums text-[#121726] leading-tight">{fmtValue(quickTake?.kingVal ?? null, meta.unit)}</div>
            <div className="text-xs uppercase tracking-wider font-bold mt-1" style={{ color: '#096a56' }}>Eastside King, WA</div>
          </div>
          <div className="px-5 py-4 bg-gradient-to-b from-white to-[#f4f6ff] border border-[#e3e6ef] rounded-xl shadow-sm min-w-[180px]">
            <div className="text-3xl font-extrabold tabular-nums text-[#121726] leading-tight">{quickTake?.winnerShort ?? '—'}</div>
            <div className="text-xs uppercase tracking-wider font-bold mt-1 text-[#6b7388]">Who&rsquo;s ahead</div>
          </div>
          <div className="px-5 py-4 bg-white border border-[#e3e6ef] rounded-xl shadow-sm min-w-[180px]">
            <div className="text-3xl font-extrabold tabular-nums text-[#121726] leading-tight">10 yrs</div>
            <div className="text-xs uppercase tracking-wider font-bold mt-1 text-[#6b7388]">2016 → 2026</div>
          </div>
        </div>

        {/* Quick Take */}
        <div className="mt-6 p-5 bg-gradient-to-br from-white to-[#fafbff] border border-[#e3e6ef] border-l-[6px] border-l-[#4055f1] rounded-xl shadow-md max-w-[1020px] text-xl leading-snug text-[#121726]">
          <span className="inline-block mr-3 px-3 py-1 rounded-full bg-[#4055f1] text-white text-xs font-bold uppercase tracking-widest align-middle">Quick take</span>
          <span dangerouslySetInnerHTML={{ __html: quickTake?.headlineHtml ?? '' }} />
          {quickTake?.auxHtml && <div className="mt-3 text-base text-[#39415a]" dangerouslySetInnerHTML={{ __html: quickTake.auxHtml }} />}
        </div>
      </header>

      {/* Controls */}
      <section className="max-w-[1320px] mx-auto mt-7 px-5 py-4 bg-white border border-[#e3e6ef] rounded-xl shadow-sm flex gap-4 items-end flex-wrap relative">
        <span className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l bg-gradient-to-b from-[#e45c3a] to-[#0e8f74]" />
        <label className="flex flex-col gap-1.5 min-w-[200px]">
          <span className="text-xs font-bold uppercase tracking-wider text-[#6b7388]">Show by</span>
          <select className="text-base font-semibold px-4 py-3 border border-[#e3e6ef] rounded-lg bg-white text-[#121726] cursor-pointer hover:border-[#c9cedb] focus:outline-none focus:border-[#4055f1] focus:ring-2 focus:ring-[#4055f1]/20"
                  value={grain} onChange={e => setGrain(e.target.value as Grain)}>
            <option value="yearly">Year</option>
            <option value="monthly">Month</option>
            <option value="daily">Day</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5 min-w-[320px] flex-1">
          <span className="text-xs font-bold uppercase tracking-wider text-[#6b7388]">Tell me about…</span>
          <select className="text-base font-semibold px-4 py-3 border border-[#e3e6ef] rounded-lg bg-white text-[#121726] cursor-pointer hover:border-[#c9cedb] focus:outline-none focus:border-[#4055f1] focus:ring-2 focus:ring-[#4055f1]/20"
                  value={metricKey} onChange={e => setMetricKey(e.target.value)}>
            {payload.metrics.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
          </select>
        </label>
        <span className="ml-auto text-sm font-medium text-[#6b7388] pb-2">Tip: click a dot on the chart to see the days behind it.</span>
      </section>

      {/* Classifier */}
      <section className="max-w-[1320px] mx-auto mt-4 p-6 bg-gradient-to-b from-[#fffcf3] to-[#fdf6e0] border border-[#f0e6c6] rounded-xl shadow-sm flex gap-5 items-start text-[#4a4324]">
        <div className="flex-shrink-0 px-4 py-2 rounded-full bg-[#3c2f0a] text-[#fbe389] text-sm font-bold whitespace-nowrap">What counts as a &ldquo;good&rdquo; hour?</div>
        <div className="flex-1">
          <p className="text-base">An hour is counted as comfortable for being outside when <strong>all four</strong> of these are true:</p>
          <ul className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 list-none p-0">
            {[
              { icon: '☀', text: <><strong>It&rsquo;s daytime</strong> (sun is up)</> },
              { icon: '🌡', text: <><strong>Comfortable temperature</strong> — between <strong>{payload.rule.temp_min_f}°F and {payload.rule.temp_max_f}°F</strong> ({payload.rule.temp_min_c}°C–{payload.rule.temp_max_c}°C)</> },
              { icon: '⛅', text: <><strong>UV isn&rsquo;t dangerous</strong> — UV index of {payload.rule.uv_max} or lower</> },
              { icon: '☂', text: <><strong>Not raining hard</strong> — a light drizzle at most ({payload.rule.rain_max_mm_h} mm/hour or less)</> },
            ].map((r, i) => (
              <li key={i} className="flex items-center gap-3 text-lg text-[#3c2f0a]">
                <span className="inline-flex items-center justify-center w-11 h-11 flex-shrink-0 text-2xl bg-white border border-[#f0e6c6] rounded-full shadow-sm">{r.icon}</span>
                {r.text}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm italic text-[#7a6c3d]">Each county is represented by three sample neighborhoods, averaged together.</p>
        </div>
      </section>

      {/* Chart */}
      <main className="max-w-[1320px] mx-auto mt-5 p-3 bg-white border border-[#e3e6ef] rounded-xl shadow-md" style={{ height: 'min(70vh, 640px)' }}>
        <div ref={chartRef} className="w-full h-full" />
      </main>

      {/* Detail panel */}
      {detail && (
        <section className={`bg-white border border-[#e3e6ef] rounded-xl shadow-md overflow-hidden flex flex-col mt-5 ${
          fullscreen ? 'fixed inset-0 z-[1000] m-0 rounded-none border-0' : 'max-w-[1320px] mx-auto'
        }`}>
          <div className="flex justify-between items-center gap-3 px-6 py-3 bg-gradient-to-b from-[#fafbff] to-[#f5f6fb] border-b border-[#e3e6ef]">
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="font-bold text-lg text-[#121726]">{payload.regions[detail.region]} · {detail.xLabel}</span>
              <span className="text-sm text-[#6b7388]">{detail.metricLabel}: <span className="font-semibold tabular-nums">{detail.metricValue == null ? '—' : `${detail.metricValue.toFixed(2)} ${detail.unit}`}</span> — drill-in below ({detail.result.rows.length} {detail.result.detailGrain} rows)</span>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button className="text-sm font-semibold px-4 py-2 border border-[#e3e6ef] rounded-lg bg-white text-[#39415a] hover:bg-[#f4f5fa] hover:border-[#c9cedb]" onClick={() => setFullscreen(f => !f)}>
                {fullscreen ? '⤡ Exit full screen' : '⤢ Full screen'}
              </button>
              <button className="text-sm font-semibold px-4 py-2 border border-[#e3e6ef] rounded-lg bg-white text-[#39415a] hover:bg-[#f4f5fa] hover:border-[#c9cedb]" onClick={closeDetail}>×</button>
            </div>
          </div>
          <div className={`p-5 overflow-auto ${fullscreen ? 'flex-1' : 'max-h-[560px]'}`}>
            <table className="border-collapse w-full text-sm tabular-nums">
              <thead>
                <tr>
                  <th className="sticky top-0 bg-[#f5f6fb] text-[#39415a] px-3 py-3 border-b border-[#e3e6ef] text-left font-bold text-xs uppercase tracking-wider">{detail.result.detailGrain === 'monthly' ? 'Month' : 'Date'}</th>
                  {DETAIL_COLS.map(c => <th key={c.key} className="sticky top-0 bg-[#f5f6fb] text-[#39415a] px-3 py-3 border-b border-[#e3e6ef] text-left font-bold text-xs uppercase tracking-wider whitespace-nowrap">{c.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {detail.result.rows.map((r, i) => (
                  <tr key={i} className="hover:bg-[#fafbff]">
                    <td className="px-3 py-2 border-b border-[#eef0f5] whitespace-nowrap text-[#121726]">{prettyBucket(r.x, detail.result.detailGrain)}</td>
                    {DETAIL_COLS.map(c => <td key={c.key} className="px-3 py-2 border-b border-[#eef0f5] whitespace-nowrap text-right text-[#39415a]">{fmtCell(r.values[c.key], c.fmt)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Notes */}
      <section className="max-w-[1320px] mx-auto mt-5 mb-8 px-8 py-7 bg-white border border-[#e3e6ef] rounded-xl shadow-sm text-[#39415a] text-base">
        <h3 className="text-xl font-bold text-[#121726] mb-3 tracking-tight">How to read the chart</h3>
        <ul className="list-disc pl-6 space-y-2 leading-relaxed">
          <li><strong className="text-[#121726]">Each dot is a block of time</strong> — a year, a month, or a day depending on what you picked above.</li>
          <li><strong className="text-[#121726]">Good-for-outdoors hours</strong> is a simple tally: how many hours in that block passed the four-rule check (sunny-enough, comfortable, safe UV, not pouring).</li>
          <li>Click any dot to see the <strong className="text-[#121726]">days behind it</strong>. The hour-by-hour breakdown is available in the local KOUT-7 dev dashboard.</li>
        </ul>
        <h3 className="text-xl font-bold text-[#121726] mb-3 mt-6 tracking-tight">Where the numbers come from</h3>
        <ul className="list-disc pl-6 space-y-2 leading-relaxed">
          <li>We use <strong className="text-[#121726]">hourly historical weather data</strong> from the global ERA5 record — the same archive meteorologists use for climate analysis, updated to within about five days of today.</li>
          <li>Each county is represented by <strong className="text-[#121726]">three neighborhoods</strong> (San Jose / Sunnyvale / Mountain View in CA; Bellevue / Redmond / Woodinville in WA), then averaged.</li>
          <li>UV is estimated from the sun&rsquo;s angle and cloud cover — close to what a consumer UV index would report, but not a direct sensor reading.</li>
        </ul>
        <div className="flex justify-between items-center gap-3 mt-5 pt-4 border-t border-[#e3e6ef] text-sm text-[#6b7388] flex-wrap">
          <span>KOUT·7 Outdoor Hours · built on open weather data · all hours, no cherry-picking</span>
          <span className="px-3 py-1.5 border border-[#e3e6ef] rounded-full bg-[#f4f5fa] text-[#39415a] font-semibold tabular-nums">last10y · {payload.grains.daily.regions.santa_clara_ca.x.length} days × 2 counties</span>
        </div>
      </section>
    </div>
  );
}

export default OutdoorHoursPage;
