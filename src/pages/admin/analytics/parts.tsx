import type { ReactNode } from 'react';

export interface Stats {
  period: { days: number; since: string };
  revenue: { single: number; bundle: number; total: number };
  revenue_prior: { single: number; bundle: number; total: number };
}

export function StatCard({ label, value, sub, priorValue, currentNumeric }: { label: string; value: string | number; sub?: string; priorValue?: number; currentNumeric?: number }) {
  let badge: ReactNode = null;
  if (typeof priorValue === 'number' && typeof currentNumeric === 'number') {
    if (priorValue === 0 && currentNumeric === 0) {
      badge = null;
    } else if (priorValue === 0) {
      badge = <span className="inline-block ml-2 text-[10px] font-bold text-green-600">new</span>;
    } else {
      const pct = Math.round(((currentNumeric - priorValue) / priorValue) * 100);
      const up = pct >= 0;
      badge = (
        <span className={`inline-block ml-2 text-[10px] font-bold ${up ? 'text-green-600' : 'text-red-500'}`}>
          {up ? '↑' : '↓'} {Math.abs(pct)}%
        </span>
      );
    }
  }
  return (
    <div className="bg-white rounded-xl border border-warm-200/60 p-5">
      <div className="text-xs font-bold uppercase tracking-wider text-warm-400 mb-1">{label}</div>
      <div className="text-3xl font-black text-warm-900 flex items-baseline">{value}{badge}</div>
      {sub && <div className="text-xs text-warm-500 mt-1">{sub}</div>}
    </div>
  );
}

export function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function LoadingState({ loading, error, label = 'stats' }: { loading: boolean; error: string | null; label?: string }) {
  if (error) return <div className="text-red-500 text-center py-12">Could not load {label}: {error}</div>;
  if (loading) return <div className="text-warm-400 text-center py-12">Loading {label}...</div>;
  return null;
}
