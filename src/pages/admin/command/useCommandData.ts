// Loads every existing admin observability source for the Command page and derives the KPI strip + status LED.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useAdminFetch } from '../../../hooks/useAdmin.js';
import { formatBytes } from '../../../lib/format.js';
import type {
  BlogCadence, EgressData, FlowsData, ObservabilityData, TrafficData,
} from './types.js';

export type Tone = 'neutral' | 'green' | 'amber' | 'red';

export interface KpiTile {
  label: string;
  value: string;
  sub: string;
  tone: Tone;
  spark?: number[];
}

export interface StatusLed { label: string; tone: Tone }

export interface Source<T> { data: T | null; error: string | null }

export interface CommandData {
  traffic: Source<TrafficData>;
  flows: Source<FlowsData>;
  egress: Source<EgressData>;
  blog: Source<BlogCadence>;
  obs: Source<ObservabilityData>;
  lastOkAt: number | null;
  failed: boolean;
  reload: () => Promise<void>;
}

const EMPTY = { data: null, error: null };
const num = (n: number): string => n.toLocaleString('en-US');
const DASH = '—';

export function deriveKpis(
  traffic: TrafficData | null,
  flows: FlowsData | null,
  egress: EgressData | null,
  blog: BlogCadence | null,
): KpiTile[] {
  const t = traffic?.totals;
  const tile = (label: string, value: string | null, sub: string, tone: Tone = 'neutral', spark?: number[]): KpiTile => ({
    label, value: value ?? DASH, sub: value === null ? '' : sub, tone, ...(spark ? { spark } : {}),
  });

  const botPct = t ? Math.round((t.botHits / Math.max(1, t.hits + t.botHits)) * 100) : 0;
  const top = traffic?.topClicks?.[0];

  const apps = flows?.apps ?? null;
  const sessions = apps ? apps.reduce((s, a) => s + a.sessions, 0) : 0;
  const errors = apps ? apps.reduce((s, a) => s + a.errors, 0) : 0;
  const topErr = apps?.reduce<typeof apps[number] | null>((m, a) => (a.errors > (m?.errors ?? 0) ? a : m), null) ?? null;

  const topSlug = egress?.bySlug?.[0];
  const topShare = egress && topSlug && egress.totalBytes > 0
    ? Math.round((Math.max(...egress.bySlug.map((s) => s.bytes)) / egress.totalBytes) * 100)
    : 0;

  const blogTone: Tone = blog?.status === 'ok' ? 'green' : blog?.status === 'warn' ? 'amber' : blog?.status === 'critical' ? 'red' : 'neutral';
  const gap = blog?.gapDays ?? null;

  return [
    tile('HITS', t ? num(t.hits) : null, '', 'neutral', traffic?.byDay?.map((d) => d.hits)),
    tile('UNIQUE VISITORS', t ? num(t.visitors) : null, `${traffic?.byCountry?.length ?? 0} countries`),
    tile('BOT HITS', t ? num(t.botHits) : null, `${botPct}% of hits`, 'amber'),
    tile('404S', t ? num(t.notFound) : null, t && t.notFound === 0 ? 'clean' : 'not found', t ? (t.notFound === 0 ? 'green' : 'red') : 'neutral'),
    tile('CLICKS', t ? num(t.clicks) : null, top?.label ? `top · ${top.label}` : top ? `top · ${top.path}` : ''),
    tile('APP SESSIONS', apps ? num(sessions) : null, `${apps?.length ?? 0} apps`),
    tile('ERRORS', apps ? num(errors) : null, topErr ? `top · ${topErr.app}` : 'none', errors > 0 ? 'red' : 'neutral'),
    tile('EGRESS', egress ? formatBytes(egress.totalBytes) : null, topSlug ? `${topShare}% one app` : '', topShare > 50 ? 'amber' : 'neutral'),
    tile(
      'BLOG CADENCE',
      gap !== null ? `${gap}d` : null,
      blog?.targetUpperDays != null ? `on cadence · ≤${blog.targetUpperDays}d` : blog?.status ?? '',
      blogTone,
    ),
  ];
}

export function deriveStatus(obs: ObservabilityData | null, failed: boolean): StatusLed {
  if (failed) return { label: 'STALE', tone: 'red' };
  const alerts = (obs?.rows ?? []).reduce((s, r) => s + (r.openAlerts?.length ?? 0), 0) + (obs?.globalAlerts?.length ?? 0);
  return alerts > 0 ? { label: `${alerts} ALERTS`, tone: 'amber' } : { label: 'ONLINE', tone: 'green' };
}

export function useCommandData(opts: { days: number; refreshMs: number; enabled: boolean }): CommandData {
  const { days, refreshMs } = opts;
  const { isLoaded, isSignedIn } = useAuth();
  const enabled = opts.enabled && isLoaded && !!isSignedIn;
  const adminFetch = useAdminFetch();
  const [state, setState] = useState<Omit<CommandData, 'reload'>>({
    traffic: EMPTY, flows: EMPTY, egress: EMPTY, blog: EMPTY, obs: EMPTY, lastOkAt: null, failed: false,
  });
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const reload = useCallback(async () => {
    const flowDays = Math.min(30, Math.max(1, days));
    const get = async <T,>(path: string): Promise<T> => {
      const res = await adminFetch(path);
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      return (await res.json()) as T;
    };
    const results = await Promise.allSettled([
      get<TrafficData>(`/admin/traffic?days=${days}`),
      get<FlowsData>(`/admin/flows?days=${flowDays}`),
      get<EgressData>(`/admin/egress?days=${days}`),
      get<BlogCadence>('/admin/blog-cadence'),
      get<ObservabilityData>('/admin/observability'),
    ]);
    // A failing source keeps its last good data; only its error is updated.
    const merge = <T,>(prev: Source<T>, r: PromiseSettledResult<T>): Source<T> =>
      r.status === 'fulfilled'
        ? { data: r.value, error: null }
        : { data: prev.data, error: r.reason instanceof Error ? r.reason.message : 'Request failed' };
    const anyFailed = results.some((r) => r.status === 'rejected');
    setState((p) => ({
      traffic: merge(p.traffic, results[0] as PromiseSettledResult<TrafficData>),
      flows: merge(p.flows, results[1] as PromiseSettledResult<FlowsData>),
      egress: merge(p.egress, results[2] as PromiseSettledResult<EgressData>),
      blog: merge(p.blog, results[3] as PromiseSettledResult<BlogCadence>),
      obs: merge(p.obs, results[4] as PromiseSettledResult<ObservabilityData>),
      lastOkAt: results.some((r) => r.status === 'fulfilled') ? Date.now() : p.lastOkAt,
      failed: anyFailed,
    }));
  }, [adminFetch, days]);

  // Poll only while the tab is visible; refresh once immediately on regaining visibility (see ObservabilityPage).
  useEffect(() => {
    if (!enabled) return;
    const stop = () => {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    };
    const start = () => {
      stop();
      if (refreshMs > 0) timerRef.current = setInterval(() => { void reload(); }, refreshMs);
    };
    const onVisibility = () => {
      if (document.hidden) { stop(); return; }
      void reload();
      start();
    };
    void reload();
    if (!document.hidden) start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      stop();
    };
  }, [enabled, refreshMs, reload]);

  return { ...state, reload };
}
