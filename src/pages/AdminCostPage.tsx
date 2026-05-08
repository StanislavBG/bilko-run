import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { Navigate } from 'react-router-dom';
import { ADMIN_EMAILS } from '../constants.js';

const API = import.meta.env.VITE_API_URL || '/api';
const COST_PER_CALL = 0.001;

interface CostData {
  todayTotal: { total: number; estimated_cost: number } | null;
  byTool: Array<{ app_slug: string; calls: number }>;
  byDay: Array<{ date: string; calls: number; estimated_cost: number }>;
  openAlerts: Array<{ id: number; alert_kind: string; app_slug?: string; user_email?: string; details_json: string; created_at: number }>;
  ceilings: Array<{ app_slug: string; max_calls_per_day: number; updated_at: number }>;
}

function SparkBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
        <div className="h-full bg-sky-400 rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-zinc-400 w-8 text-right">{pct}%</span>
    </div>
  );
}

export function AdminCostPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [data, setData] = useState<CostData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ceilingEdits, setCeilingEdits] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token = await getToken();
    const res = await fetch(`${API}/admin/cost`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) { setError('Failed to load cost data'); return; }
    setData(await res.json());
  }, [getToken]);

  useEffect(() => { if (isLoaded && isSignedIn) load(); }, [isLoaded, isSignedIn, load]);

  if (!isLoaded) return null;
  if (!isSignedIn) return <Navigate to="/" replace />;

  async function resolveAlert(id: number) {
    const token = await getToken();
    await fetch(`${API}/admin/cost/resolve-alert`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    load();
  }

  async function saveCeiling(slug: string) {
    const val = parseInt(ceilingEdits[slug] ?? '', 10);
    if (!val || val < 1) return;
    setSaving(slug);
    const token = await getToken();
    await fetch(`${API}/admin/spend-ceiling`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ app_slug: slug, max_calls_per_day: val }) });
    setSaving(null);
    load();
  }

  const todayCalls = data?.todayTotal?.total ?? 0;
  const todayCost = (todayCalls * COST_PER_CALL).toFixed(2);
  const maxDayCalls = Math.max(...(data?.byDay.map(d => d.calls) ?? [0]));

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-white">Cost Controls</h1>
        <p className="text-zinc-400 text-sm mt-1">Gemini call usage, spend ceilings, and open alerts</p>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {/* Today summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Calls today', value: todayCalls.toLocaleString() },
          { label: 'Est. cost today', value: `$${todayCost}` },
          { label: 'Open alerts', value: (data?.openAlerts.length ?? 0).toString() },
          { label: 'Tools tracked', value: (data?.ceilings.length ?? 0).toString() },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white/5 rounded-xl p-4 border border-white/10">
            <p className="text-xs text-zinc-400">{label}</p>
            <p className="text-2xl font-bold text-white mt-1">{value}</p>
          </div>
        ))}
      </div>

      {/* 30-day call chart */}
      <div className="bg-white/5 rounded-xl p-6 border border-white/10">
        <h2 className="text-sm font-semibold text-white mb-4">30-day call history</h2>
        {data && data.byDay.length > 0 ? (
          <div className="space-y-1.5">
            {data.byDay.slice(-14).map(d => (
              <div key={d.date} className="flex items-center gap-3 text-xs">
                <span className="text-zinc-500 w-20 shrink-0">{d.date.slice(5)}</span>
                <SparkBar value={d.calls} max={maxDayCalls} />
                <span className="text-zinc-300 w-12 text-right shrink-0">{d.calls}</span>
                <span className="text-zinc-500 w-14 text-right shrink-0">${d.estimated_cost}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-zinc-500 text-sm">No data yet.</p>
        )}
      </div>

      {/* Per-tool today */}
      <div className="bg-white/5 rounded-xl p-6 border border-white/10">
        <h2 className="text-sm font-semibold text-white mb-4">Top tools today</h2>
        {data && data.byTool.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-zinc-400 text-xs border-b border-white/10">
                <th className="text-left pb-2">Tool</th>
                <th className="text-right pb-2">Calls</th>
                <th className="text-right pb-2">Est. cost</th>
              </tr>
            </thead>
            <tbody>
              {data.byTool.map(t => (
                <tr key={t.app_slug} className="border-b border-white/5">
                  <td className="py-1.5 text-zinc-200">{t.app_slug}</td>
                  <td className="py-1.5 text-right text-zinc-300">{t.calls}</td>
                  <td className="py-1.5 text-right text-zinc-400">${(t.calls * COST_PER_CALL).toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-zinc-500 text-sm">No calls today.</p>
        )}
      </div>

      {/* Spend ceilings */}
      <div className="bg-white/5 rounded-xl p-6 border border-white/10">
        <h2 className="text-sm font-semibold text-white mb-4">Per-app spend ceilings</h2>
        {data && data.ceilings.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-zinc-400 text-xs border-b border-white/10">
                <th className="text-left pb-2">App</th>
                <th className="text-right pb-2">Max calls/day</th>
                <th className="text-right pb-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {data.ceilings.map(c => (
                <tr key={c.app_slug} className="border-b border-white/5">
                  <td className="py-1.5 text-zinc-200">{c.app_slug}</td>
                  <td className="py-1.5 text-right">
                    <input
                      type="number"
                      min={1}
                      defaultValue={c.max_calls_per_day}
                      className="w-24 bg-white/10 text-white text-right rounded px-2 py-0.5 text-xs border border-white/20"
                      onChange={e => setCeilingEdits(prev => ({ ...prev, [c.app_slug]: e.target.value }))}
                    />
                  </td>
                  <td className="py-1.5 text-right">
                    <button
                      onClick={() => saveCeiling(c.app_slug)}
                      disabled={saving === c.app_slug}
                      className="text-xs text-sky-400 hover:text-sky-300 disabled:opacity-50"
                    >
                      {saving === c.app_slug ? 'Saving…' : 'Save'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-zinc-500 text-sm">No ceilings configured.</p>
        )}
      </div>

      {/* Open alerts */}
      <div className="bg-white/5 rounded-xl p-6 border border-white/10">
        <h2 className="text-sm font-semibold text-white mb-4">
          Open alerts {data && data.openAlerts.length > 0 && <span className="ml-2 text-red-400">({data.openAlerts.length})</span>}
        </h2>
        {data && data.openAlerts.length > 0 ? (
          <div className="space-y-3">
            {data.openAlerts.map(a => {
              let details: Record<string, unknown> = {};
              try { details = JSON.parse(a.details_json); } catch { /* skip */ }
              return (
                <div key={a.id} className="flex items-start justify-between gap-4 border border-white/10 rounded-lg p-3 bg-red-900/10">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-red-400">{a.alert_kind}</p>
                    {a.app_slug && <p className="text-xs text-zinc-400">app: <span className="text-zinc-200">{a.app_slug}</span></p>}
                    {a.user_email && <p className="text-xs text-zinc-400">user: <span className="text-zinc-200">{a.user_email}</span></p>}
                    <p className="text-xs text-zinc-500 mt-1">{JSON.stringify(details)}</p>
                    <p className="text-xs text-zinc-600 mt-0.5">{new Date(a.created_at * 1000).toLocaleString()}</p>
                  </div>
                  <button
                    onClick={() => resolveAlert(a.id)}
                    className="shrink-0 text-xs text-zinc-400 hover:text-white border border-white/10 rounded px-2 py-1"
                  >
                    Resolve
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-zinc-500 text-sm">No open alerts.</p>
        )}
      </div>
    </div>
  );
}
