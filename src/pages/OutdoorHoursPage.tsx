/**
 * OutdoorHours — KOUT-7 dashboard.
 *
 * Read-only data viz: 10 years of hourly ERA5 reanalysis collapsed into
 * "good-for-outdoors hours" via a four-rule classifier (daytime, comfortable
 * temp, safe UV, not pouring). Compares Santa Clara County, CA with Eastside
 * King County, WA.
 *
 * Fully static: fetches `/outdoor-hours/last10y.json` for rollups and
 * `/outdoor-hours/hourly/YYYY-MM.json` on-demand for hourly drill-ins. Plotly
 * is loaded once via CDN.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

declare global { interface Window { Plotly?: any; } }

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

interface HourlyRow {
  ts: string;
  santa_clara_ca: Record<string, number | null>;
  eastside_king_wa: Record<string, number | null>;
}
interface HourlyMonth { month: string; rows: HourlyRow[]; }

const REGION_COLOR: Record<RegionKey, string> = { santa_clara_ca: '#e45c3a', eastside_king_wa: '#0e8f74' };
const REGION_ORDER: RegionKey[] = ['santa_clara_ca', 'eastside_king_wa'];
const REGION_SHORT: Record<RegionKey, string> = { santa_clara_ca: 'SCC', eastside_king_wa: 'WA' };

const PLOTLY_SRC = 'https://cdn.plot.ly/plotly-2.35.2.min.js';
let plotlyPromise: Promise<void> | null = null;
function loadPlotly(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.Plotly) return Promise.resolve();
  if (plotlyPromise) return plotlyPromise;
  plotlyPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = PLOTLY_SRC; s.async = true;
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

function prettyBucket(x: string | number, grain: Grain | 'hourly'): string {
  if (grain === 'yearly') return String(x);
  if (grain === 'hourly') {
    const m = String(x).match(/T(\d{2}:\d{2})/);
    return m ? m[1] : String(x);
  }
  const m = String(x).match(/^(\d{4})-(\d{2})(?:-(\d{2}))?/);
  if (!m) return String(x);
  const year = +m[1], month = +m[2] - 1, day = m[3] ? +m[3] : null;
  return day ? `${MONTHS[month]} ${day}, ${year}` : `${MONTHS[month]} ${year}`;
}

// ── Detail column schema ──────────────────────────────────────────────

type ColFmt = 'num0' | 'num1' | 'num2' | 'pts' | 'bool' | 'time';
interface Col { key: string; label: string; fmt?: ColFmt; paired?: boolean; leading?: boolean; }

const DETAIL_COLS: Record<'hourly' | 'daily' | 'monthly', Col[]> = {
  hourly: [
    { key: 'ts',               label: 'Local time',  fmt: 'time', paired: false },
    { key: 'stay_outside_pts', label: 'Stay-out',    fmt: 'pts',  paired: true, leading: true },
    { key: 'ok_day',           label: 'Day?',        fmt: 'bool', paired: true, leading: true },
    { key: 'temperature_2m',   label: 'Temp (°C)',   fmt: 'num1', paired: true },
    { key: 'uv_index_est',     label: 'UV',          fmt: 'num2', paired: true },
    { key: 'precipitation',    label: 'Rain (mm/h)', fmt: 'num2', paired: true },
    { key: 'cloud_cover',      label: 'Cloud (%)',   fmt: 'num0', paired: true },
    { key: 'wind_gusts_10m',   label: 'Gust (m/s)',  fmt: 'num1', paired: true },
  ],
  daily: [
    { key: 'x',                     label: 'Date',               paired: false },
    { key: 'stay_outside_hours',    label: 'Stay-out (h)',       fmt: 'num1', paired: true, leading: true },
    { key: 'pct_daytime_outside',   label: '% daylight usable',  fmt: 'num1', paired: true, leading: true },
    { key: 'temperature_2m_mean',   label: 'Temp avg (°C)',      fmt: 'num1', paired: true },
    { key: 'temperature_2m_max',    label: 'Temp max',           fmt: 'num1', paired: true },
    { key: 'uv_index_est_max',      label: 'UV max',             fmt: 'num2', paired: true },
    { key: 'precipitation_sum',     label: 'Rain (mm)',          fmt: 'num2', paired: true },
    { key: 'cloud_cover_mean',      label: 'Cloud (%)',          fmt: 'num0', paired: true },
    { key: 'wind_gusts_10m_max',    label: 'Peak gust (m/s)',    fmt: 'num1', paired: true },
  ],
  monthly: [
    { key: 'x',                     label: 'Month',              paired: false },
    { key: 'stay_outside_hours',    label: 'Stay-out (h)',       fmt: 'num0', paired: true, leading: true },
    { key: 'pct_daytime_outside',   label: '% daylight usable',  fmt: 'num1', paired: true, leading: true },
    { key: 'temperature_2m_mean',   label: 'Temp avg (°C)',      fmt: 'num1', paired: true },
    { key: 'temperature_2m_max',    label: 'Temp max',           fmt: 'num1', paired: true },
    { key: 'uv_index_est_mean',    label: 'UV avg',              fmt: 'num2', paired: true },
    { key: 'precipitation_sum',     label: 'Rain (mm)',          fmt: 'num1', paired: true },
    { key: 'wind_gusts_10m_max',    label: 'Peak gust (m/s)',    fmt: 'num1', paired: true },
  ],
};

// ── Drill-down (all local compute, except hourly which lazy-fetches a month) ──

interface DetailRow { _x: string | number; santa_clara_ca: Record<string, number | null>; eastside_king_wa: Record<string, number | null>; shared: Record<string, string | number | null>; }
interface DetailResult { detailGrain: 'hourly' | 'daily' | 'monthly'; rows: DetailRow[]; }

function pivotGrain(payload: Payload, fromGrain: Grain, bucket: string | number): DetailResult | null {
  let detailGrain: 'daily' | 'monthly';
  let match: (x: string | number) => boolean;
  if (fromGrain === 'yearly') { detailGrain = 'monthly'; match = x => Number(String(x).slice(0, 4)) === Number(bucket); }
  else if (fromGrain === 'monthly') { detailGrain = 'daily'; match = x => String(x).slice(0, 7) === String(bucket).slice(0, 7); }
  else return null;
  const data = payload.grains[detailGrain];
  const scc = data.regions.santa_clara_ca;
  const king = data.regions.eastside_king_wa;
  const rows: DetailRow[] = [];
  scc.x.forEach((x, i) => {
    if (!match(x)) return;
    const row: DetailRow = { _x: x, santa_clara_ca: {}, eastside_king_wa: {}, shared: { x } };
    Object.entries(scc.series).forEach(([k, arr]) => { row.santa_clara_ca[k] = arr[i]; });
    const kIdx = king.x.indexOf(x);
    if (kIdx >= 0) Object.entries(king.series).forEach(([k, arr]) => { row.eastside_king_wa[k] = arr[kIdx]; });
    rows.push(row);
  });
  return { detailGrain, rows };
}

async function fetchHourlyDay(bucket: string): Promise<DetailResult> {
  const month = bucket.slice(0, 7);
  const r = await fetch(`/outdoor-hours/hourly/${month}.json`);
  if (!r.ok) throw new Error(`hourly fetch failed: ${r.status}`);
  const data: HourlyMonth = await r.json();
  const target = bucket.slice(0, 10);
  const rows = data.rows
    .filter(row => row.ts.slice(0, 10) === target)
    .map(row => ({ _x: row.ts, santa_clara_ca: row.santa_clara_ca, eastside_king_wa: row.eastside_king_wa, shared: { ts: row.ts } }));
  return { detailGrain: 'hourly', rows };
}

// ── Formatting ───────────────────────────────────────────────────────

function fmtCell(v: number | string | null | undefined, fmt?: ColFmt): string | JSX.Element {
  if (v == null || v === '') return '';
  if (fmt === 'time') {
    const m = String(v).match(/T(\d{2}:\d{2})/);
    return m ? m[1] : String(v);
  }
  if (fmt === 'bool') {
    const n = Number(v);
    return <span className={n ? 'text-[#0e8f74] font-bold' : 'text-[#c44]  font-bold'}>{n ? '✓' : '✗'}</span>;
  }
  if (fmt === 'pts') {
    const n = Number(v);
    const cls = n === 0 ? 'text-[#c44]' : n === 3 ? 'text-[#0e8f74]' : 'text-[#d4831b]';
    return <span className={`${cls} font-bold`}>{n}/3</span>;
  }
  const num = Number(v);
  if (!Number.isFinite(num)) return '';
  const d = fmt === 'num0' ? 0 : fmt === 'num2' ? 2 : 1;
  return num.toFixed(d);
}

function leadingWinner(row: DetailRow, key: string): RegionKey | null {
  const vals = REGION_ORDER.map(r => row[r]?.[key]).filter((v): v is number => v != null && Number.isFinite(Number(v)));
  if (vals.length < 2) return null;
  const best = Math.max(...vals.map(Number));
  return REGION_ORDER.find(r => Number(row[r]?.[key]) === best) || null;
}

// ── Page component ───────────────────────────────────────────────────

interface Crumb { grain: Grain | 'hourly-drill'; bucket: string | number; xLabel: string; }

export function OutdoorHoursPage() {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [grain, setGrain] = useState<Grain>('monthly');
  const [metricKey, setMetricKey] = useState<string>('stay_outside_hours');
  const [drillStack, setDrillStack] = useState<Crumb[]>([]);
  const [detailResult, setDetailResult] = useState<DetailResult | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/outdoor-hours/last10y.json')
      .then(r => { if (!r.ok) throw new Error(`load failed: ${r.status}`); return r.json(); })
      .then(setPayload)
      .catch(e => setError(String(e)));
    loadPlotly().catch(e => setError(String(e)));
  }, []);

  const meta = payload?.metrics.find(m => m.key === metricKey);

  // ── Plotly ──
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
      const rawX = p.data.x[p.pointIndex];
      openDrill(grain, rawX);
    };
    node.on?.('plotly_click', onClick);
    return () => { node.removeAllListeners?.('plotly_click'); };
  }, [payload, grain, metricKey, meta]);

  // ── Drill management ──
  const openDrill = useCallback((g: Grain, bucket: string | number) => {
    if (g === 'daily') return; // no drill for daily click from chart — we show hourly below via row-click chain
    setDrillStack([{ grain: g, bucket, xLabel: prettyBucket(bucket, g) }]);
  }, []);

  // Fetch detail when drillStack changes.
  useEffect(() => {
    if (!payload || !drillStack.length) { setDetailResult(null); return; }
    const current = drillStack[drillStack.length - 1];
    setDetailLoading(true);
    const run = async () => {
      try {
        if (current.grain === 'hourly-drill') {
          const result = await fetchHourlyDay(String(current.bucket));
          setDetailResult(result);
        } else {
          const result = pivotGrain(payload, current.grain as Grain, current.bucket);
          setDetailResult(result);
        }
      } catch (e) {
        setDetailResult(null); setError(String(e));
      } finally {
        setDetailLoading(false);
      }
    };
    run();
  }, [drillStack, payload]);

  const drillFurther = useCallback((newGrain: Grain | 'hourly-drill', newBucket: string | number, newLabel: string) => {
    setDrillStack(prev => [...prev, { grain: newGrain, bucket: newBucket, xLabel: newLabel }]);
  }, []);
  const drillTo = useCallback((index: number) => { setDrillStack(prev => prev.slice(0, index + 1)); }, []);
  const closeDetail = useCallback(() => { setDrillStack([]); setFullscreen(false); }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && drillStack.length) closeDetail(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [drillStack, closeDetail]);

  // ── Quick Take ──
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
      const sccWin = sccVal > kingVal;
      const higher = sccWin ? 'Santa Clara' : 'Eastside King';
      const lower = sccWin ? 'Eastside King' : 'Santa Clara';
      const higherCls = sccWin ? 'text-[#b43f21]' : 'text-[#096a56]';
      const lowerCls = sccWin ? 'text-[#096a56]' : 'text-[#b43f21]';
      const higherVal = sccWin ? sccVal : kingVal;
      const lowerVal = sccWin ? kingVal : sccVal;
      const pct = Math.abs(higherVal - lowerVal) / Math.max(Math.abs(higherVal), Math.abs(lowerVal)) * 100;
      if (HIGHER_BETTER.has(metricKey)) {
        winnerShort = higher;
        headlineHtml = `<span class="${higherCls} font-bold">${higher}</span> wins on <em>${meta.label.toLowerCase()}</em> — <span class="font-bold tabular-nums">${fmtValue(higherVal, meta.unit)}</span> vs. <span class="${lowerCls} font-bold tabular-nums">${fmtValue(lowerVal, meta.unit)}</span> on the ${lower.includes('East') ? 'Eastside' : 'South Bay'}, about <span class="font-bold tabular-nums">${pct.toFixed(0)}%</span> more.`;
      } else if (LOWER_BETTER.has(metricKey)) {
        winnerShort = lower;
        headlineHtml = `<span class="${lowerCls} font-bold">${lower}</span> comes out ahead — less <em>${meta.label.toLowerCase()}</em> (<span class="font-bold tabular-nums">${fmtValue(lowerVal, meta.unit)}</span>) than ${higher} (<span class="font-bold tabular-nums">${fmtValue(higherVal, meta.unit)}</span>).`;
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

  // ── Render ──

  if (error) return <div className="p-8 text-red-600">Failed to load: {error}</div>;
  if (!payload || !meta) return <div className="p-8 text-slate-500">Loading the last 10 years of weather…</div>;

  // When drilling from a daily row, bucket is the ISO date → we want hourly.
  // When drilling from a monthly row, bucket is "YYYY-MM" → we want the daily breakdown for that month.
  const nextStepFor = (detailGrain: 'hourly' | 'daily' | 'monthly', rawX: string | number): { grain: Grain | 'hourly-drill'; bucket: string | number; label: string } | null => {
    if (detailGrain === 'daily') {
      const day = String(rawX).slice(0, 10);
      return { grain: 'hourly-drill', bucket: day, label: prettyBucket(day, 'daily') };
    }
    if (detailGrain === 'monthly') {
      const month = String(rawX).slice(0, 7);
      return { grain: 'monthly', bucket: `${month}-01`, label: prettyBucket(`${month}-01`, 'monthly') };
    }
    return null;
  };

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
          Click any dot to drill in: year → month → day → hour, both counties side-by-side.
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
        <span className="ml-auto text-sm font-medium text-[#6b7388] pb-2">Tip: click a dot on the chart — or a row in the drill-in table — to dig deeper.</span>
      </section>

      {/* ── Rules card (four color-coded cards, AND between them) ────────────── */}
      <section className="max-w-[1320px] mx-auto mt-5 px-7 pt-6 pb-7 bg-gradient-to-b from-[#fffcf3] to-[#fdf6e0] border border-[#f0e6c6] rounded-xl shadow-sm text-[#3c2f0a]">
        <header className="flex items-end justify-between gap-6 flex-wrap pb-4 border-b border-dashed border-[#e4d9a8]">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.14em] text-[#8a7330]">The Four Rules</div>
            <h2 className="mt-1 text-[26px] font-extrabold tracking-tight text-[#2a1f07]">What counts as a comfortable hour?</h2>
          </div>
          <div className="inline-flex items-center gap-3.5 px-[18px] py-2.5 bg-[#3c2f0a] text-[#fbe389] rounded-xl shadow-md">
            <span className="font-mono text-2xl font-extrabold tracking-wider text-white">{payload.metrics.length && '4 of 4'}</span>
            <span className="text-xs leading-tight font-semibold text-[#fbe389]">must pass<br />for the hour to count</span>
          </div>
        </header>

        <ol className="mt-5 grid gap-3.5 items-stretch list-none p-0"
            style={{ gridTemplateColumns: 'minmax(0,1fr) auto minmax(0,1fr) auto minmax(0,1fr) auto minmax(0,1fr)' }}>
          {[
            { cls: 'from-[#fff6e0] text-[#8a5b0e] border-t-[#f5b041]', icon: '☀', name: 'Daytime', val: 'Sun is up', sub: 'Nighttime hours don\u2019t count.' },
            { cls: 'from-[#fdeee8] text-[#a8311a] border-t-[#e85d3e]', icon: '🌡', name: 'Comfortable temp', val: `${payload.rule.temp_min_f}°\u2013${payload.rule.temp_max_f}°F`, sub: `That\u2019s ${payload.rule.temp_min_c}°\u2013${payload.rule.temp_max_c}°C \u2014 not too cold, not too hot.` },
            { cls: 'from-[#f4ecf7] text-[#6d2d85] border-t-[#9b59b6]', icon: '⛅', name: 'Safe UV', val: `Index \u2264 ${payload.rule.uv_max}`, sub: 'Above that and dermatologists say cover up.' },
            { cls: 'from-[#eaf2f9] text-[#1f5a82] border-t-[#3498db]', icon: '☂', name: 'Barely raining', val: `\u2264 ${payload.rule.rain_max_mm_h} mm/hr`, sub: 'Light drizzle is OK \u2014 a downpour isn\u2019t.' },
          ].map((r, i, arr) => [
            <li key={`r-${i}`} className="p-[18px] bg-white border border-[#f0e6c6] rounded-2xl shadow-sm flex flex-col gap-1.5 border-t-4" style={{ borderTopColor: r.cls.match(/border-t-\[(#[a-f0-9]+)\]/)?.[1] }}>
              <div className={`w-[52px] h-[52px] rounded-xl inline-flex items-center justify-center text-[28px] leading-none bg-gradient-to-b ${r.cls.split(' ').slice(0,1).join(' ')} ${r.cls.split(' ').slice(1,2).join(' ')}`} style={{ background: r.cls.includes('#fff6e0') ? '#fff6e0' : r.cls.includes('#fdeee8') ? '#fdeee8' : r.cls.includes('#f4ecf7') ? '#f4ecf7' : '#eaf2f9' }}>{r.icon}</div>
              <div className="text-[11px] font-bold uppercase tracking-[0.1em] mt-1" style={{ color: r.cls.includes('#a8311a') ? '#a8311a' : r.cls.includes('#6d2d85') ? '#6d2d85' : r.cls.includes('#1f5a82') ? '#1f5a82' : '#8a5b0e' }}>{r.name}</div>
              <div className="text-[22px] font-extrabold text-[#1a150a] leading-tight tracking-tight">{r.val}</div>
              <div className="text-[13.5px] text-[#6e5e2c] leading-snug mt-0.5">{r.sub}</div>
            </li>,
            i < arr.length - 1 ? (
              <li key={`and-${i}`} className="hidden lg:flex self-center justify-self-center font-mono text-[13px] font-bold tracking-[0.1em] text-[#b89a3a] px-2.5 py-1.5 bg-white border border-dashed border-[#e4d9a8] rounded">AND</li>
            ) : null,
          ])}
        </ol>
        <p className="mt-4 text-sm italic text-[#7a6c3d]">Each county is the average of three sample neighborhoods. Every hour is scored independently.</p>
      </section>

      {/* Chart */}
      <main className="max-w-[1320px] mx-auto mt-5 p-3 bg-white border border-[#e3e6ef] rounded-xl shadow-md" style={{ height: 'min(70vh, 640px)' }}>
        <div ref={chartRef} className="w-full h-full" />
      </main>

      {/* Detail panel */}
      {drillStack.length > 0 && (
        <DetailPanel
          stack={drillStack}
          onDrillTo={drillTo}
          onClose={closeDetail}
          onRowDrill={(detailGrain, rawX) => {
            const n = nextStepFor(detailGrain, rawX);
            if (n) drillFurther(n.grain, n.bucket, n.label);
          }}
          fullscreen={fullscreen}
          setFullscreen={setFullscreen}
          loading={detailLoading}
          result={detailResult}
          payload={payload}
          metricLabel={meta.label}
          metricUnit={meta.unit}
        />
      )}

      {/* Notes */}
      <section className="max-w-[1320px] mx-auto mt-5 mb-8 px-8 py-7 bg-white border border-[#e3e6ef] rounded-xl shadow-sm text-[#39415a] text-base">
        <h3 className="text-xl font-bold text-[#121726] mb-3 tracking-tight">How to read the chart</h3>
        <ul className="list-disc pl-6 space-y-2 leading-relaxed">
          <li><strong className="text-[#121726]">Each dot is a block of time</strong> — a year, month, or day depending on what you picked above.</li>
          <li>The drill-in table shows <strong className="text-[#121726]">both counties side by side</strong>. Classification columns lead; the winner per row is starred.</li>
          <li>In the hourly view you can see <strong className="text-[#121726]">why</strong> each hour passed or failed — the four driver columns (daytime, temp, UV, rain) sit next to the stay-out score.</li>
        </ul>
        <h3 className="text-xl font-bold text-[#121726] mb-3 mt-6 tracking-tight">Where the numbers come from</h3>
        <ul className="list-disc pl-6 space-y-2 leading-relaxed">
          <li>Hourly historical weather data from the global ERA5 record — the same archive meteorologists use, updated to within about five days of today.</li>
          <li>Each county is represented by three sample neighborhoods (San Jose / Palo Alto / Morgan Hill in CA; Bellevue / Redmond / Woodinville in WA), then averaged.</li>
          <li>UV is estimated from the sun&rsquo;s angle and cloud cover — close to a consumer UV index, but not a direct sensor reading.</li>
        </ul>
        <div className="flex justify-between items-center gap-3 mt-5 pt-4 border-t border-[#e3e6ef] text-sm text-[#6b7388] flex-wrap">
          <span>KOUT·7 Outdoor Hours · open weather data · all hours, no cherry-picking</span>
          <span className="px-3 py-1.5 border border-[#e3e6ef] rounded-full bg-[#f4f5fa] text-[#39415a] font-semibold tabular-nums">last10y · {payload.grains.daily.regions.santa_clara_ca.x.length} days × 2 counties</span>
        </div>
      </section>
    </div>
  );
}

export default OutdoorHoursPage;

// ── Detail panel subcomponent ────────────────────────────────────────

interface DetailPanelProps {
  stack: Crumb[];
  onDrillTo: (i: number) => void;
  onClose: () => void;
  onRowDrill: (detailGrain: 'daily' | 'monthly' | 'hourly', rawX: string | number) => void;
  fullscreen: boolean;
  setFullscreen: (f: boolean | ((p: boolean) => boolean)) => void;
  loading: boolean;
  result: DetailResult | null;
  payload: Payload;
  metricLabel: string;
  metricUnit: string;
}

function DetailPanel({ stack, onDrillTo, onClose, onRowDrill, fullscreen, setFullscreen, loading, result, payload, metricLabel, metricUnit }: DetailPanelProps) {
  const current = stack[stack.length - 1];
  const cols = result ? DETAIL_COLS[result.detailGrain] : [];
  const paired = cols.filter(c => c.paired);
  const shared = cols.filter(c => !c.paired);
  const leading = paired.filter(c => c.leading);
  const trailing = paired.filter(c => !c.leading);
  const ordered = [...shared, ...leading, ...trailing];

  const containerCls = `bg-white border border-[#e3e6ef] rounded-xl shadow-md overflow-hidden flex flex-col mt-5 ${
    fullscreen ? 'fixed inset-0 z-[1000] m-0 rounded-none border-0' : 'max-w-[1320px] mx-auto'
  }`;

  const drillable = result && (result.detailGrain === 'daily' || result.detailGrain === 'monthly');

  return (
    <section className={containerCls}>
      <div className="flex justify-between items-center gap-3 px-6 py-3 bg-gradient-to-b from-[#fafbff] to-[#f5f6fb] border-b border-[#e3e6ef]">
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="font-bold text-lg text-[#121726]">{current.xLabel} — side-by-side</span>
          <span className="text-sm text-[#6b7388]">Drill by {metricLabel.toLowerCase()} · {metricUnit} where applicable</span>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button className="text-sm font-semibold px-4 py-2 border border-[#e3e6ef] rounded-lg bg-white text-[#39415a] hover:bg-[#f4f5fa] hover:border-[#c9cedb]" onClick={() => setFullscreen(f => !f)}>
            {fullscreen ? '⤡ Exit full screen' : '⤢ Full screen'}
          </button>
          <button className="text-sm font-semibold px-4 py-2 border border-[#e3e6ef] rounded-lg bg-white text-[#39415a] hover:bg-[#f4f5fa] hover:border-[#c9cedb]" onClick={onClose}>×</button>
        </div>
      </div>

      <div className={`p-5 overflow-auto ${fullscreen ? 'flex-1' : 'max-h-[640px]'}`}>
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-1.5 flex-wrap mb-3 px-3 py-1.5 bg-[#fafbff] border border-[#e8ebf3] rounded-md text-sm">
          {stack.map((c, i) => {
            const last = i === stack.length - 1;
            return (
              <span key={i} className="inline-flex items-center">
                {last ? (
                  <span className="px-2 py-1 rounded text-[#121726] font-bold">{c.xLabel} <span className="text-xs text-[#6b7388] font-medium"> · {c.grain === 'hourly-drill' ? 'hourly' : c.grain}</span></span>
                ) : (
                  <button onClick={() => onDrillTo(i)} className="px-2 py-1 rounded text-[#4055f1] font-semibold hover:bg-[#4055f1]/10 hover:underline">
                    {c.xLabel} <span className="text-xs text-[#6b7388] font-medium"> · {c.grain === 'hourly-drill' ? 'hourly' : c.grain}</span>
                  </button>
                )}
                {!last && <span className="text-[#6b7388] px-0.5">›</span>}
              </span>
            );
          })}
        </nav>

        {loading ? (
          <p className="text-[#6b7388] text-[15px]">Loading…</p>
        ) : !result || !result.rows.length ? (
          <p className="text-[#6b7388] text-[15px]">No underlying rows for this point.</p>
        ) : (
          <>
            <div className="mb-3 p-3 px-3.5 bg-[#f0f4ff] border-l-4 border-[#4055f1] rounded text-[13.5px] leading-relaxed text-[#39415a]">
              {result.detailGrain === 'hourly' ? (
                <><strong>Hourly view: {result.rows.length} rows.</strong> <strong>Stay-out</strong> is how many of the 3 sample neighborhoods passed <em>all four</em> rules that hour. The driver columns to the right (daytime, temp, UV, rain) show <em>why</em> — winner starred per row.</>
              ) : (
                <><strong>{result.rows.length} {result.detailGrain} rows.</strong> Classification columns lead; the winner per row is starred. {drillable && <strong>Click any row</strong>} {drillable && (result.detailGrain === 'daily' ? 'to see the hour-by-hour breakdown.' : 'to see the day-by-day breakdown.')}</>
              )}
            </div>

            <table className="border-collapse w-full text-[15px] tabular-nums">
              <thead>
                <tr>
                  {ordered.map(c => {
                    if (!c.paired) return <th key={c.key} rowSpan={2} className="sticky top-0 z-20 bg-[#f5f6fb] text-[#39415a] px-3 py-3 border-b border-[#e3e6ef] text-left font-bold text-xs uppercase tracking-wider whitespace-nowrap border-r-2 border-r-[#dde2ef]">{c.label}</th>;
                    return <th key={c.key} colSpan={2} className={`sticky top-0 z-10 px-3 py-2.5 text-center border-b border-[#e3e6ef] text-xs uppercase tracking-wider whitespace-nowrap ${c.leading ? 'bg-gradient-to-b from-[#eef5ff] to-[#dfe9ff] text-[#4055f1] font-extrabold' : 'bg-[#eef1f8] text-[#39415a] font-bold'} border-r border-r-[#dde2ef]`}><span>{c.label}</span></th>;
                  })}
                </tr>
                <tr>
                  {ordered.map(c => {
                    if (!c.paired) return null;
                    return REGION_ORDER.map(r => (
                      <th key={`${c.key}-${r}`} className={`sticky bg-[#f9fafd] px-3 py-1.5 text-[12px] text-[#6b7388] font-semibold border-b border-[#e3e6ef] text-left whitespace-nowrap ${c.leading ? 'font-bold text-[#121726]' : ''}`} style={{ top: '41px' }}>
                        <span className={`inline-block w-2 h-2 rounded-full mr-1.5 align-middle ${r === 'santa_clara_ca' ? 'bg-[#e45c3a]' : 'bg-[#0e8f74]'}`} />{REGION_SHORT[r]}
                      </th>
                    ));
                  })}
                </tr>
              </thead>
              <tbody className={drillable ? 'cursor-pointer' : ''}>
                {result.rows.map((row, i) => {
                  const winners: Record<string, RegionKey | null> = {};
                  leading.forEach(c => { winners[c.key] = leadingWinner(row, c.key); });
                  return (
                    <tr key={i}
                        className={drillable ? 'hover:bg-[#eef4ff] transition-colors' : 'hover:bg-[#fafbff]'}
                        onClick={drillable ? () => onRowDrill(result.detailGrain as 'daily' | 'monthly', row._x) : undefined}>
                      {ordered.map(c => {
                        if (!c.paired) {
                          const val = (row.shared as any)[c.key] ?? row._x;
                          const display = c.key === 'x' ? prettyBucket(val, result.detailGrain as Grain) : fmtCell(val as any, c.fmt);
                          return <td key={c.key} className="px-3 py-2.5 border-b border-[#eef0f5] whitespace-nowrap font-semibold text-[#121726] bg-[#fafbff] border-r-2 border-r-[#e3e6ef]">
                            {drillable && <span className="text-[#6b7388] font-bold mr-1.5">›</span>}{display}
                          </td>;
                        }
                        return REGION_ORDER.map(r => {
                          const val = row[r]?.[c.key];
                          const isWinner = c.leading && winners[c.key] === r;
                          const tdCls = `px-3 py-2.5 border-b border-[#eef0f5] whitespace-nowrap ${c.fmt === 'bool' || c.fmt === 'pts' ? 'text-center' : 'text-right'} ${
                            c.leading ? (isWinner ? 'bg-gradient-to-r from-[#4055f1]/15 to-[#4055f1]/5 font-bold text-[#121726]' : 'bg-[#4055f1]/5 font-semibold') : 'text-[#39415a]'
                          } ${r === 'santa_clara_ca' ? 'border-r border-dashed border-[#e8ebf3]' : 'border-r border-[#dde2ef]'}`;
                          return <td key={`${c.key}-${r}`} className={tdCls}>{fmtCell(val, c.fmt)}{isWinner && <span className="ml-1.5 text-[#4055f1] text-[11px] align-[2px]">★</span>}</td>;
                        });
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}
      </div>
    </section>
  );
}
