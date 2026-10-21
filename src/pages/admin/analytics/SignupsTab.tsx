import { useState } from 'react';
import { useAdminFetch, useAdminResource } from '../../../hooks/useAdmin.js';
import { LoadingState } from './parts.js';

interface TabProps {
  days: number;
}

// Mirrors GET /api/admin/signups. Timestamps are epoch MILLISECONDS.
interface SignupsResponse {
  windowDays: number;
  total: number;
  consented: number;
  bySource: Array<{
    source: string;
    signups: number;
    consented: number;
    promptShown: number;
    promptDismissed: number;
    signinCompleted: number;
  }>;
  rows: Array<{ email: string; source: string; consent: boolean; consentAt: number | null; createdAt: number }>;
}

const PT_FORMAT = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Los_Angeles',
  timeZoneName: 'short',
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

function formatPt(ms: number | null): string {
  return ms ? PT_FORMAT.format(new Date(ms)) : '—';
}

/** "Sign in for updates" capture: signups by source page + consent, with an admin-only CSV export. */
export function SignupsTab({ days }: TabProps) {
  const { data, error, loading } = useAdminResource<SignupsResponse>(`/admin/signups?days=${days}`);
  const adminFetch = useAdminFetch();
  const [exportError, setExportError] = useState<string | null>(null);

  const exportCsv = async () => {
    setExportError(null);
    try {
      const res = await adminFetch('/admin/signups.csv');
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = 'bilko-signups.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setExportError(e instanceof Error ? e.message : 'Export failed');
    }
  };

  if (!data) return <LoadingState loading={loading} error={error} label="signups" />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-warm-600">
          <span className="font-bold text-warm-900">{data.total}</span> signups ·{' '}
          <span className="font-bold text-warm-900">{data.consented}</span> opted in to updates
        </p>
        <button
          type="button"
          onClick={() => void exportCsv()}
          className="px-4 py-2 rounded-lg text-sm font-semibold bg-warm-900 text-white hover:bg-warm-800"
        >
          Export CSV
        </button>
      </div>
      {exportError && <p className="text-sm text-red-500">{exportError}</p>}

      <div className="bg-white rounded-xl border border-warm-200/60 p-5 overflow-x-auto">
        <h2 className="text-xs font-bold uppercase tracking-wider text-warm-400 mb-4">By source</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-warm-500">
              <th className="py-1 pr-4">Source</th>
              <th className="py-1 pr-4">Signups (all time)</th>
              <th className="py-1 pr-4">Opted in</th>
              <th className="py-1 pr-4">Prompt shown ({data.windowDays}d)</th>
              <th className="py-1 pr-4">Dismissed ({data.windowDays}d)</th>
              <th className="py-1">Sign-ins ({data.windowDays}d)</th>
            </tr>
          </thead>
          <tbody>
            {data.bySource.map(s => (
              <tr key={s.source} className="border-t border-warm-100">
                <td className="py-2 pr-4 font-semibold text-warm-900">{s.source}</td>
                <td className="py-2 pr-4">{s.signups}</td>
                <td className="py-2 pr-4">{s.consented}</td>
                <td className="py-2 pr-4">{s.promptShown}</td>
                <td className="py-2 pr-4">{s.promptDismissed}</td>
                <td className="py-2">{s.signinCompleted}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-white rounded-xl border border-warm-200/60 p-5 overflow-x-auto">
        <h2 className="text-xs font-bold uppercase tracking-wider text-warm-400 mb-4">Latest signups</h2>
        {data.rows.length === 0 ? (
          <p className="text-sm text-warm-400">No signups yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-warm-500">
                <th className="py-1 pr-4">Email</th>
                <th className="py-1 pr-4">Source</th>
                <th className="py-1 pr-4">Updates</th>
                <th className="py-1">Signed up</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map(r => (
                <tr key={r.email} className="border-t border-warm-100">
                  <td className="py-2 pr-4 text-warm-900">{r.email}</td>
                  <td className="py-2 pr-4">{r.source}</td>
                  <td className="py-2 pr-4">{r.consent ? `yes · ${formatPt(r.consentAt)}` : 'no'}</td>
                  <td className="py-2">{formatPt(r.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
