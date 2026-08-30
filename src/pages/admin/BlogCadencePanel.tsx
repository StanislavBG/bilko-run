import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';

const API = import.meta.env.VITE_API_URL || '/api';

interface BlogCadenceResponse {
  lastPublishedAt: string | null;
  gapDays: number | null;
  targetUpperDays: number | null;
  catchupTriggerDays: number | null;
  status: 'ok' | 'warn' | 'critical' | 'unknown';
}

const STATUS_STYLE: Record<BlogCadenceResponse['status'], { color: string; label: string }> = {
  ok:       { color: 'bg-green-100 text-green-700',   label: 'On cadence' },
  warn:     { color: 'bg-yellow-100 text-yellow-700', label: 'Behind cadence' },
  critical: { color: 'bg-red-100 text-red-700',       label: 'Way behind' },
  unknown:  { color: 'bg-warm-100 text-warm-500',     label: 'Unknown' },
};

// Sourced from /api/admin/blog-cadence, which reads the live blog_posts
// table (not a cache) and blog.config.yaml's cadence policy — this is the
// tile the 36-day gap incident would have caught had it existed.
export function BlogCadencePanel() {
  const { getToken } = useAuth();
  const [data, setData] = useState<BlogCadenceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await fetch(`${API}/admin/blog-cadence`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) { setError('Failed to load blog cadence'); return; }
      setData(await res.json());
      setError(null);
    } catch {
      setError('Network error');
    }
  }, [getToken]);

  useEffect(() => { load(); }, [load]);

  // On error, keep showing the last-known-good numbers (if any) rather than
  // blanking the tile — a transient fetch failure shouldn't hide the most
  // recent real cadence reading.
  if (error && !data) return <p className="text-red-500 text-sm">{error}</p>;
  if (!data) return null;

  const pill = STATUS_STYLE[data.status];

  return (
    <div className="rounded-xl border border-warm-200/60 bg-white p-4 flex items-center justify-between">
      <div>
        <h3 className="text-sm font-bold text-warm-900">Blog cadence</h3>
        <p className="text-xs text-warm-500 mt-0.5">
          {data.lastPublishedAt
            ? `Last live post: ${new Date(data.lastPublishedAt).toLocaleDateString()}`
            : 'No published posts found'}
          {data.targetUpperDays !== null && data.catchupTriggerDays !== null && (
            <> · target ≤{data.targetUpperDays}d, catch-up at {data.catchupTriggerDays}d</>
          )}
        </p>
      </div>
      <div className="flex items-center gap-3">
        {data.gapDays !== null && (
          <span className="font-mono text-xl font-extrabold text-warm-900">{data.gapDays}d</span>
        )}
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${pill.color}`}>
          {pill.label}
        </span>
      </div>
    </div>
  );
}
