import { useEffect, useMemo, useRef, useState } from 'react';
import { geoContains, geoDistance, geoGraticule10, geoOrthographic, geoPath } from 'd3-geo';
import type { GeoPermissibleObjects } from 'd3-geo';
import { feature } from 'topojson-client';
import type { TrafficData } from './types.js';
import { C, FONT, fmtNum } from './theme.js';

type LonLat = [number, number];
type Topology = Parameters<typeof feature>[0];

/** Render us-west region: every request arc ends here. */
const HOME: LonLat = [-122.4, 37.8];

/** ISO-3166 alpha-2 -> approximate [lon, lat] centroid. */
export const COUNTRY_CENTROIDS: Record<string, LonLat> = {
  AD: [1.6, 42.5], AE: [54, 24], AF: [66, 33], AG: [-61.8, 17.1], AI: [-63.1, 18.2], AL: [20, 41],
  AM: [45, 40], AO: [17.5, -12.5], AQ: [0, -80], AR: [-64, -34], AS: [-170.7, -14.3], AT: [14.5, 47.5],
  AU: [134, -25], AW: [-70, 12.5], AX: [20, 60.2], AZ: [47.5, 40.3], BA: [17.8, 44], BB: [-59.5, 13.2],
  BD: [90, 24], BE: [4.5, 50.6], BF: [-1.7, 12.3], BG: [25, 42.7], BH: [50.6, 26], BI: [30, -3.4],
  BJ: [2.3, 9.6], BL: [-62.8, 17.9], BM: [-64.8, 32.3], BN: [114.7, 4.5], BO: [-64.7, -16.7], BQ: [-68.3, 12.2],
  BR: [-52, -10], BS: [-77.4, 24.7], BT: [90.4, 27.5], BV: [3.4, -54.4], BW: [24, -22], BY: [28, 53.7],
  BZ: [-88.7, 17.2], CA: [-100, 58], CC: [96.9, -12.2], CD: [23.7, -2.9], CF: [20.9, 6.6], CG: [15.2, -0.7],
  CH: [8.2, 46.8], CI: [-5.5, 7.5], CK: [-159.8, -21.2], CL: [-71, -33], CM: [12.4, 5.7], CN: [103.8, 35.9],
  CO: [-74, 4.6], CR: [-84, 9.9], CU: [-79.5, 21.5], CV: [-23.6, 15.1], CW: [-69, 12.2], CX: [105.7, -10.5],
  CY: [33.4, 35.1], CZ: [15.5, 49.8], DE: [10.4, 51.2], DJ: [42.6, 11.8], DK: [9.5, 56], DM: [-61.4, 15.4],
  DO: [-70.2, 18.7], DZ: [2.6, 28.2], EC: [-78.2, -1.8], EE: [25, 58.6], EG: [30.8, 26.8], EH: [-12.9, 24.2],
  ER: [39.8, 15.2], ES: [-3.7, 40.2], ET: [40.5, 9.1], FI: [26, 64.5], FJ: [178, -17.7], FK: [-59.5, -51.8],
  FM: [158.2, 6.9], FO: [-6.9, 62], FR: [2.2, 46.6], GA: [11.8, -0.8], GB: [-2.5, 54], GD: [-61.7, 12.1],
  GE: [43.4, 42.3], GF: [-53.1, 3.9], GG: [-2.6, 49.5], GH: [-1.2, 7.9], GI: [-5.35, 36.1], GL: [-42, 72],
  GM: [-15.4, 13.4], GN: [-10.9, 10.4], GP: [-61.6, 16.2], GQ: [10.3, 1.7], GR: [22, 39], GS: [-36.6, -54.4],
  GT: [-90.4, 15.7], GU: [144.8, 13.4], GW: [-15, 12], GY: [-58.9, 4.9], HK: [114.2, 22.3], HM: [73.5, -53.1],
  HN: [-86.6, 14.8], HR: [15.5, 45.1], HT: [-72.3, 19], HU: [19.5, 47.2], ID: [117, -2.2], IE: [-8, 53.2],
  IL: [35, 31.4], IM: [-4.5, 54.2], IN: [79, 22], IO: [72.4, -7.3], IQ: [43.7, 33], IR: [53.7, 32.4],
  IS: [-18.6, 64.9], IT: [12.5, 42.8], JE: [-2.1, 49.2], JM: [-77.3, 18.1], JO: [36.8, 31.2], JP: [138.3, 36.5],
  KE: [37.9, 0.2], KG: [74.6, 41.5], KH: [104.9, 12.7], KI: [173, 1.4], KM: [43.9, -11.9], KN: [-62.7, 17.3],
  KP: [127.2, 40.3], KR: [127.8, 36.4], KW: [47.6, 29.3], KY: [-80.6, 19.3], KZ: [67, 48.2], LA: [103.8, 18.5],
  LB: [35.9, 33.9], LC: [-61, 13.9], LI: [9.55, 47.15], LK: [80.7, 7.9], LR: [-9.4, 6.4], LS: [28.2, -29.6],
  LT: [23.9, 55.3], LU: [6.1, 49.8], LV: [24.9, 56.9], LY: [17.2, 27], MA: [-6.8, 31.8], MC: [7.4, 43.7],
  MD: [28.4, 47.2], ME: [19.3, 42.8], MF: [-63.05, 18.07], MG: [46.7, -19.4], MH: [171, 7.1], MK: [21.7, 41.6],
  ML: [-3.5, 17.4], MM: [96.5, 21.2], MN: [103, 46.8], MO: [113.5, 22.2], MP: [145.7, 15.2], MQ: [-61, 14.6],
  MR: [-10.4, 20.3], MS: [-62.2, 16.7], MT: [14.4, 35.9], MU: [57.6, -20.3], MV: [73.2, 3.2], MW: [34.3, -13.2],
  MX: [-102, 23.9], MY: [109.7, 3.9], MZ: [35.5, -17.3], NA: [17.2, -22.1], NC: [165.6, -21.3], NE: [9.4, 17.4],
  NF: [167.95, -29.04], NG: [8.1, 9.6], NI: [-85, 12.9], NL: [5.6, 52.2], NO: [9, 62], NP: [84.1, 28.3],
  NR: [166.9, -0.5], NU: [-169.9, -19.05], NZ: [172, -41.5], OM: [56.1, 20.6], PA: [-80.1, 8.5], PE: [-75.2, -9.2],
  PF: [-149.4, -17.7], PG: [144, -6.3], PH: [122, 12.9], PK: [69.4, 29.9], PL: [19.4, 52.1], PM: [-56.3, 46.9],
  PN: [-128.3, -24.4], PR: [-66.5, 18.2], PS: [35.2, 31.9], PT: [-8, 39.6], PW: [134.5, 7.5], PY: [-58.4, -23.4],
  QA: [51.2, 25.3], RE: [55.5, -21.1], RO: [24.9, 45.9], RS: [20.8, 44], RU: [95, 61.5], RW: [29.9, -1.9],
  SA: [45, 24], SB: [160.2, -9.6], SC: [55.5, -4.7], SD: [30, 15.6], SE: [16, 62], SG: [103.8, 1.35],
  SH: [-5.7, -15.95], SI: [14.8, 46.1], SJ: [16, 77.5], SK: [19.5, 48.7], SL: [-11.8, 8.5], SM: [12.46, 43.94],
  SN: [-14.5, 14.5], SO: [46.2, 5.2], SR: [-56, 4], SS: [30.2, 7.3], ST: [6.6, 0.3], SV: [-88.9, 13.8],
  SX: [-63.05, 18.04], SY: [38.5, 35], SZ: [31.5, -26.5], TC: [-71.8, 21.8], TD: [18.7, 15.5], TF: [69.3, -49.3],
  TG: [0.8, 8.6], TH: [101, 15.9], TJ: [71.3, 38.9], TK: [-171.8, -9.2], TL: [125.7, -8.8], TM: [59.6, 39.1],
  TN: [9.5, 34], TO: [-175.2, -21.2], TR: [35.2, 39], TT: [-61.2, 10.7], TV: [178.7, -7.5], TW: [121, 23.7],
  TZ: [34.9, -6.4], UA: [31.2, 48.4], UG: [32.3, 1.4], UM: [-176.5, 0.2], US: [-98.6, 39.8], UY: [-55.8, -32.5],
  UZ: [64.6, 41.4], VA: [12.45, 41.9], VC: [-61.2, 13.25], VE: [-66.6, 6.4], VG: [-64.6, 18.4], VI: [-64.8, 18.3],
  VN: [108, 14.1], VU: [167.7, -16.2], WF: [-177.2, -13.8], WS: [-172.1, -13.8], XK: [20.9, 42.6], YE: [48.5, 15.6],
  YT: [45.15, -12.8], ZA: [25, -29], ZM: [27.8, -13.1], ZW: [29.9, -19],
};

// Land dot grid: computed once at module level, chunked so the main thread never blocks.
let landCache: Promise<{ land: GeoPermissibleObjects; dots: LonLat[] }> | null = null;

function loadLand(): Promise<{ land: GeoPermissibleObjects; dots: LonLat[] }> {
  if (landCache) return landCache;
  landCache = (async () => {
    const mod = await import('world-atlas/land-110m.json');
    const topo = (mod.default ?? mod) as unknown as Topology;
    const land = feature(topo, topo.objects.land as never) as unknown as GeoPermissibleObjects;
    const dots: LonLat[] = [];
    const step = 2;
    for (let lat = -56; lat <= 82; lat += step) {
      const n = Math.max(1, Math.round((360 * Math.cos((lat * Math.PI) / 180)) / step));
      for (let i = 0; i < n; i++) {
        const lon = -180 + ((i + 0.5) * 360) / n;
        if (geoContains(land, [lon, lat])) dots.push([lon, lat]);
      }
      if (lat % 8 === 0) await new Promise<void>((r) => setTimeout(r, 0));
    }
    return { land, dots };
  })();
  landCache.catch(() => { landCache = null; });
  return landCache;
}

interface Ping { code: string; t: number }
interface Hit { code: string; hits: number; ll: LonLat }

const PING_MS = 1600;
const empty = (msg: string) => (
  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', font: `400 11px/1 ${FONT.mono}`, color: C.faint }}>
    {msg}
  </div>
);

export function GlobeModule({ stage, traffic, pingCountries }: { stage: boolean; traffic: TrafficData | null; pingCountries: string[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pingCount, setPingCount] = useState(0);

  const countries = useMemo<Hit[]>(() => {
    const rows = traffic?.byCountry ?? [];
    return rows
      .filter((r) => r.country && COUNTRY_CENTROIDS[r.country.toUpperCase()])
      .map((r) => ({ code: r.country.toUpperCase(), hits: r.hits, ll: COUNTRY_CENTROIDS[r.country.toUpperCase()]! }))
      .sort((a, b) => b.hits - a.hits);
  }, [traffic]);

  const live = useRef({ countries, stage });
  live.current = { countries, stage };
  const pings = useRef<Ping[]>([]);

  useEffect(() => {
    if (!pingCountries.length) return;
    const t = performance.now();
    for (const code of pingCountries) {
      const c = code?.toUpperCase();
      if (c && COUNTRY_CENTROIDS[c]) pings.current.push({ code: c, t });
    }
    pings.current = pings.current.slice(-14);
    setPingCount((n) => n + pingCountries.length);
  }, [pingCountries]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const rot: LonLat = [20, -18];
    let drag: { x: number; y: number; r: LonLat } | null = null;
    let land: GeoPermissibleObjects | null = null;
    let dots: LonLat[] | null = null;
    let alive = true;
    let raf = 0;
    loadLand().then((l) => { if (alive) { land = l.land; dots = l.dots; } }).catch(() => {});

    const proj = geoOrthographic().clipAngle(90).precision(0.5);
    const grat = geoGraticule10();

    const onDown = (e: PointerEvent) => {
      if (!live.current.stage) return;
      drag = { x: e.clientX, y: e.clientY, r: [rot[0], rot[1]] };
      canvas.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!drag) return;
      rot[0] = drag.r[0] + (e.clientX - drag.x) * 0.3;
      rot[1] = Math.max(-60, Math.min(60, drag.r[1] - (e.clientY - drag.y) * 0.3));
    };
    const onUp = () => { drag = null; };
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (w < 10 || h < 10) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const W = Math.round(w * dpr), H = Math.round(h * dpr);
      if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const { stage: st, countries: cs } = live.current;
      const t = reduced ? 0 : now / 1000;
      if (!reduced && !drag) rot[0] += 0.05;
      const r = st ? Math.min(w * 0.33, h * 0.42) : Math.min(w, h) * 0.38;
      const cx = st ? Math.max(w * 0.58, 270 + r * 1.2) : w * 0.5;
      const cy = h * (st ? 0.5 : 0.47);
      proj.scale(r).translate([cx, cy]).rotate([rot[0], rot[1]]);
      const path = geoPath(proj, ctx);
      const center: LonLat = [-rot[0], -rot[1]];

      // glow + rotating tick ring
      let g = ctx.createRadialGradient(cx, cy, r * 0.92, cx, cy, r * 1.4);
      g.addColorStop(0, 'rgba(242,106,46,0.16)');
      g.addColorStop(1, 'rgba(242,106,46,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r * 1.4, 0, 7); ctx.fill();
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(t * 0.04);
      for (let k = 0; k < 120; k++) {
        const a = (k / 120) * Math.PI * 2, R = r * 1.1, L = k % 10 === 0 ? 7 : 3;
        ctx.beginPath(); ctx.moveTo(Math.cos(a) * R, Math.sin(a) * R); ctx.lineTo(Math.cos(a) * (R + L), Math.sin(a) * (R + L));
        ctx.strokeStyle = k % 10 === 0 ? 'rgba(242,106,46,.55)' : 'rgba(245,240,230,.10)'; ctx.lineWidth = 1; ctx.stroke();
      }
      ctx.beginPath(); ctx.arc(0, 0, r * 1.18, -0.6, 0.5); ctx.strokeStyle = 'rgba(244,185,66,.35)'; ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, r * 1.18, 2.4, 3.2); ctx.stroke();
      ctx.restore();

      // sphere body
      g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r);
      g.addColorStop(0, '#231d16'); g.addColorStop(1, '#0c0a08');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill();

      // graticule, then land dots
      ctx.beginPath(); path(grat); ctx.strokeStyle = 'rgba(245,240,230,0.055)'; ctx.lineWidth = 0.6; ctx.stroke();
      if (land) { ctx.beginPath(); path(land); ctx.fillStyle = 'rgba(245,240,230,0.03)'; ctx.fill(); }
      if (dots) {
        const ds = st ? 1.7 : 1.2;
        for (const p of dots) {
          const dist = geoDistance(p, center);
          if (dist > 1.53) continue;
          const xy = proj(p);
          if (!xy) continue;
          ctx.fillStyle = `rgba(232,224,207,${(0.12 + 0.55 * Math.cos(dist)).toFixed(2)})`;
          ctx.fillRect(xy[0] - ds / 2, xy[1] - ds / 2, ds, ds);
        }
      }
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.strokeStyle = 'rgba(242,106,46,.4)'; ctx.lineWidth = 1; ctx.stroke();

      // dashed arcs from the top 14 to HOME
      const maxHits = cs[0]?.hits || 1;
      ctx.lineWidth = st ? 1.1 : 0.8; ctx.setLineDash([3, 5]); ctx.lineDashOffset = -t * 16;
      for (const c of cs.slice(0, 14)) {
        const wg = Math.sqrt(c.hits / maxHits);
        ctx.beginPath(); path({ type: 'LineString', coordinates: [c.ll, HOME] });
        ctx.strokeStyle = `rgba(244,185,66,${(0.18 + 0.5 * wg).toFixed(2)})`; ctx.stroke();
      }
      ctx.setLineDash([]);

      // origin square
      if (geoDistance(HOME, center) < 1.5) {
        const xy = proj(HOME);
        if (xy) {
          const [x, y] = xy;
          ctx.fillStyle = C.green; ctx.fillRect(x - 3.5, y - 3.5, 7, 7);
          ctx.strokeStyle = 'rgba(111,191,138,.5)'; ctx.strokeRect(x - 7, y - 7, 14, 14);
          if (st) { ctx.font = `500 10px ${FONT.mono}`; ctx.fillText('ORIGIN', x + 11, y + 3); }
        }
      }

      // country pulses + labels
      ctx.font = `500 10px ${FONT.mono}`;
      cs.forEach((c, i) => {
        if (geoDistance(c.ll, center) > 1.5) return;
        const xy = proj(c.ll);
        if (!xy) return;
        const [x, y] = xy;
        const rr = (st ? 2 : 1.4) + Math.sqrt(c.hits) / (st ? 5 : 8);
        if (!reduced) {
          const ph = (t * 0.5 + i * 0.17) % 1;
          ctx.beginPath(); ctx.arc(x, y, rr + ph * rr * 2.2, 0, 7);
          ctx.strokeStyle = `rgba(242,106,46,${(0.5 * (1 - ph)).toFixed(2)})`; ctx.lineWidth = 1; ctx.stroke();
        }
        ctx.beginPath(); ctx.arc(x, y, rr, 0, 7); ctx.fillStyle = 'rgba(242,106,46,0.88)'; ctx.fill();
        if (st && i < 10) { ctx.fillStyle = C.text; ctx.fillText(`${c.code} ${c.hits}`, x + rr + 5, y + 3); }
      });

      // pings: only real new hits supplied via pingCountries
      const nowp = performance.now();
      pings.current = pings.current.filter((p) => nowp - p.t < PING_MS);
      if (!reduced) {
        for (const p of pings.current) {
          const ll = COUNTRY_CENTROIDS[p.code];
          if (!ll || geoDistance(ll, center) > 1.5) continue;
          const xy = proj(ll);
          if (!xy) continue;
          const a = (nowp - p.t) / PING_MS;
          ctx.beginPath(); ctx.arc(xy[0], xy[1], 4 + a * (st ? 30 : 16), 0, 7);
          ctx.strokeStyle = `rgba(244,185,66,${(1 - a).toFixed(2)})`; ctx.lineWidth = 1.5; ctx.stroke();
        }
      }
    };
    raf = requestAnimationFrame(frame);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
    };
  }, []);

  const top12 = countries.slice(0, 12);
  const rest = countries.slice(12);
  const maxHits = countries[0]?.hits || 1;
  const totalHits = traffic?.totals.hits ?? 0;

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block', touchAction: 'none' }} />
      {!traffic && empty('loading')}
      {traffic && countries.length === 0 && empty('no geo data in window')}
      {stage && traffic && countries.length > 0 && (
        <>
          <div style={{ position: 'absolute', top: 16, left: 18, width: 236, display: 'flex', flexDirection: 'column', gap: 6, pointerEvents: 'none' }}>
            <span style={{ font: `500 10px/1 ${FONT.mono}`, letterSpacing: '.16em', color: C.muted }}>ORIGIN · {countries.length} COUNTRIES</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
              <span style={{ font: `600 40px/1 ${FONT.sans}`, color: C.ink }}>{fmtNum(totalHits)}</span>
              <span style={{ font: `400 11px/1 ${FONT.mono}`, color: C.muted }}>hits · {fmtNum(traffic.totals.visitors)} uv</span>
            </div>
            {top12.map((c) => (
              <div key={c.code} style={{ display: 'grid', gridTemplateColumns: '24px minmax(0,1fr) 36px', gap: 8, alignItems: 'center', font: `400 11px/1 ${FONT.mono}`, color: C.text, height: 16 }}>
                <span style={{ color: C.muted }}>{c.code}</span>
                <div style={{ height: 4, background: '#221d17' }}><div style={{ height: '100%', width: `${(c.hits / maxHits) * 100}%`, background: C.orange }} /></div>
                <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtNum(c.hits)}</span>
              </div>
            ))}
            {rest.length > 0 && (
              <span style={{ font: `400 10px/1.4 ${FONT.mono}`, color: C.faint, marginTop: 4 }}>
                +{rest.length} more · {rest.slice(0, 10).map((c) => c.code).join(' ')}
              </span>
            )}
          </div>
          <div style={{ position: 'absolute', top: 16, right: 18, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, pointerEvents: 'none', font: `500 10px/1 ${FONT.mono}`, letterSpacing: '.14em', color: C.muted }}>
            <span>ARCS → ORIGIN · US-WEST</span>
            <span style={{ color: C.amber }}>PINGS {pingCount}</span>
            <span style={{ color: C.faint }}>DRAG TO ROTATE</span>
          </div>
          <div style={{ position: 'absolute', bottom: 14, right: 18, display: 'flex', gap: 16, pointerEvents: 'none', font: `400 10px/1 ${FONT.mono}`, color: C.muted }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: C.orange }} />visitor origin</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 7, height: 7, background: C.green }} />origin server</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 14, borderTop: `1px dashed ${C.amber}` }} />request path</span>
          </div>
          <div style={{ position: 'absolute', inset: 0, border: `1px solid ${C.stageOutline}`, pointerEvents: 'none', boxShadow: 'inset 0 0 60px rgba(242,106,46,.06)' }} />
        </>
      )}
      {!stage && countries.length > 0 && (
        <div style={{ position: 'absolute', left: 10, bottom: 8, display: 'flex', flexDirection: 'column', gap: 3, pointerEvents: 'none', font: `400 10px/1 ${FONT.mono}`, color: C.text }}>
          {countries.slice(0, 3).map((c) => (
            <span key={c.code}><span style={{ color: C.muted }}>{c.code}</span> {fmtNum(c.hits)}</span>
          ))}
        </div>
      )}
    </div>
  );
}
