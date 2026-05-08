import { useState, useEffect, useCallback } from 'react';
import { useUser, useAuth } from '@clerk/clerk-react';
import { Navigate } from 'react-router-dom';
import { ADMIN_EMAILS } from '../../constants.js';

const API = import.meta.env.VITE_API_URL || '/api';

interface SecretRow {
  name: string;
  last_rotated_at: number | null;
  rotated_by: string | null;
  notes: string | null;
}

function ageDays(epochSec: number | null): number | null {
  if (epochSec === null) return null;
  return Math.floor((Date.now() / 1000 - epochSec) / 86400);
}

function humanizeAgo(epochSec: number | null): string {
  if (epochSec === null) return 'never';
  const days = ageDays(epochSec)!;
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? '1 month ago' : `${months} months ago`;
}

function StatusBadge({ days }: { days: number | null }) {
  if (days === null)
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-700">never rotated</span>;
  if (days < 60)
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-green-100 text-green-700">{days}d — ok</span>;
  if (days < 90)
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-yellow-100 text-yellow-700">{days}d — due soon</span>;
  if (days < 180)
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-orange-100 text-orange-700">{days}d — overdue</span>;
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-700">{days}d — CRITICAL</span>;
}

function MarkRotatedModal({
  name,
  onClose,
  onConfirm,
}: {
  name: string;
  onClose: () => void;
  onConfirm: (notes: string) => void;
}) {
  const [notes, setNotes] = useState('');
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full mx-4 space-y-4">
        <h2 className="text-lg font-extrabold text-warm-900">Mark {name} as rotated</h2>
        <p className="text-sm text-warm-500">
          This records that you followed the runbook. It does NOT rotate the secret — do that in the vendor dashboard first.
        </p>
        <textarea
          className="w-full border border-warm-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-fire-400 resize-none"
          rows={3}
          placeholder="Optional notes (e.g. '90d rotation', 'post-incident')"
          value={notes}
          onChange={e => setNotes(e.target.value)}
        />
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-warm-100 text-warm-700 hover:bg-warm-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(notes)}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-fire-500 text-white hover:bg-fire-600 transition-colors"
          >
            Confirm rotation
          </button>
        </div>
      </div>
    </div>
  );
}

export function SecretsPage() {
  const { user, isLoaded } = useUser();
  const { getToken } = useAuth();
  const email = user?.primaryEmailAddress?.emailAddress?.toLowerCase() ?? '';
  const isAdmin = ADMIN_EMAILS.includes(email);

  const [rows, setRows] = useState<SecretRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await fetch(`${API}/admin/secrets`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) { setError('Failed to load secrets metadata'); return; }
      setRows(await res.json());
      setError(null);
    } catch {
      setError('Network error');
    }
  }, [getToken]);

  useEffect(() => {
    if (!isAdmin) return;
    load().finally(() => setLoading(false));
  }, [isAdmin, load]);

  useEffect(() => {
    document.title = 'Secrets — bilko.run';
    return () => { document.title = 'Bilko.run — Tools for Makers Who Ship'; };
  }, []);

  async function markRotated(name: string, notes: string) {
    setSaving(true);
    try {
      const token = await getToken();
      await fetch(`${API}/admin/secrets/${encodeURIComponent(name)}/rotated`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ notes: notes || undefined }),
      });
      setModal(null);
      await load();
    } finally {
      setSaving(false);
    }
  }

  if (isLoaded && !isAdmin) return <Navigate to="/" replace />;
  if (!isLoaded) return <div className="p-12 text-center text-warm-400">Loading...</div>;

  const staleCount = rows.filter(r => ageDays(r.last_rotated_at) === null || (ageDays(r.last_rotated_at) ?? 0) >= 90).length;

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-6">
      {modal && (
        <MarkRotatedModal
          name={modal}
          onClose={() => setModal(null)}
          onConfirm={notes => markRotated(modal, notes)}
        />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-warm-900">Secrets rotation</h1>
          <p className="text-warm-500 text-sm mt-1">
            Rotate any secret older than 90 days. Follow{' '}
            <a
              href="https://github.com/StanislavBG/bilko-run/blob/main/docs/secrets-rotation.md"
              target="_blank"
              rel="noopener noreferrer"
              className="text-fire-600 hover:underline"
            >
              docs/secrets-rotation.md
            </a>{' '}
            runbook.
          </p>
        </div>
        {staleCount > 0 && (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-red-100 text-red-700">
            {staleCount} secret{staleCount !== 1 ? 's' : ''} need rotation
          </span>
        )}
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}
      {loading && <div className="text-warm-400 text-center py-16">Loading…</div>}

      {!loading && (
        <div className="overflow-x-auto rounded-xl border border-warm-200/60 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-warm-100 text-xs font-bold text-warm-400 uppercase tracking-wide">
                <th className="text-left px-4 py-3">Secret</th>
                <th className="text-left px-4 py-3">Last rotated</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Rotated by</th>
                <th className="text-left px-4 py-3">Notes</th>
                <th className="text-right px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => {
                const days = ageDays(row.last_rotated_at);
                return (
                  <tr key={row.name} className="border-b border-warm-50 hover:bg-warm-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <code className="font-mono text-xs font-semibold text-warm-800">{row.name}</code>
                    </td>
                    <td className="px-4 py-3 text-warm-600 text-xs">{humanizeAgo(row.last_rotated_at)}</td>
                    <td className="px-4 py-3"><StatusBadge days={days} /></td>
                    <td className="px-4 py-3 text-warm-500 text-xs">{row.rotated_by ?? '—'}</td>
                    <td className="px-4 py-3 text-warm-500 text-xs max-w-xs truncate">{row.notes ?? '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setModal(row.name)}
                        disabled={saving}
                        className="px-3 py-1 text-xs font-semibold rounded-lg bg-fire-50 text-fire-700 hover:bg-fire-100 transition-colors disabled:opacity-50"
                      >
                        Mark rotated
                      </button>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-warm-400 text-sm">
                    No secrets tracked yet. Run DB migration to seed the table.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
