import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAdminFetch, useAdminResource } from '../../hooks/useAdmin.js';
import { LoadingState } from './analytics/parts.js';

type OrderStatus = 'queued' | 'drafted' | 'delivered' | 'refunded' | 'booked';

// Mirrors GET /api/admin/menu-orders. Timestamps are epoch SECONDS.
interface MenuOrderView {
  id: number;
  ref: string;
  itemId: string;
  itemName: string;
  email: string;
  priceCents: number;
  kind: string;
  status: OrderStatus;
  via: string;
  intake: unknown;
  draft: string | null;
  deliveredBody: string | null;
  createdAt: number;
  updatedAt: number;
}

interface MenuOrdersResponse {
  orders: MenuOrderView[];
  asyncToday: number;
  asyncCap: number;
}

const STATUSES: OrderStatus[] = ['queued', 'drafted', 'delivered', 'refunded', 'booked'];
const FILTERS = ['all', ...STATUSES] as const;
const RANK: Record<OrderStatus, number> = { queued: 0, drafted: 1, booked: 2, delivered: 3, refunded: 4 };

const PT_FORMAT = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Los_Angeles',
  timeZoneName: 'short',
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

const formatPt = (sec: number) => PT_FORMAT.format(new Date(sec * 1000));
const formatPrice = (cents: number) => `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;

function intakeLines(intake: unknown): Array<[string, string]> {
  if (intake && typeof intake === 'object' && !Array.isArray(intake)) {
    return Object.entries(intake as Record<string, unknown>).map(([k, v]) => [
      k,
      typeof v === 'string' ? v : JSON.stringify(v),
    ]);
  }
  return [['intake', typeof intake === 'string' ? intake : JSON.stringify(intake)]];
}

function OrderCard({ order, onChanged }: { order: MenuOrderView; onChanged: () => Promise<void> }) {
  const adminFetch = useAdminFetch();
  const [text, setText] = useState(order.draft ?? '');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Pick up a server-side draft change (e.g. after Redraft) without clobbering unrelated edits.
  useEffect(() => { setText(order.draft ?? ''); }, [order.draft]);

  const act = async (action: 'draft' | 'approve' | 'refund') => {
    setBusy(action);
    setError(null);
    try {
      const res = await adminFetch(`/admin/menu-orders/${order.id}/${action}`, {
        method: 'POST',
        headers: action === 'approve' ? { 'Content-Type': 'application/json' } : undefined,
        body: action === 'approve' ? JSON.stringify({ body: text }) : undefined,
      });
      if (!res.ok) {
        let msg = `Request failed (${res.status})`;
        try {
          const j = (await res.json()) as { error?: string; reason?: string };
          if (j.error) msg = j.reason ? `${j.error} (${j.reason})` : j.error;
        } catch { /* keep generic message */ }
        throw new Error(msg);
      }
      if (action === 'draft') {
        const j = (await res.json()) as { draft?: string };
        if (typeof j.draft === 'string') setText(j.draft);
      }
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed');
      await onChanged().catch(() => undefined);
    } finally {
      setBusy(null);
    }
  };

  const canDraft = order.status === 'queued' || order.status === 'drafted';
  const canApprove = order.status === 'drafted' && text.trim().length > 0;
  const canRefund = order.status !== 'refunded';

  return (
    <div className="bg-white rounded-xl border border-warm-200/60 p-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <div>
          <span className="font-bold text-warm-900">{order.itemName}</span>{' '}
          <span className="text-warm-600">{formatPrice(order.priceCents)}</span>
        </div>
        <span className="px-2 py-0.5 rounded-md bg-warm-100 text-xs font-bold uppercase text-warm-700">{order.status}</span>
      </div>
      <p className="text-xs text-warm-500">{order.email} · {formatPt(order.createdAt)}</p>

      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-warm-400 mb-1">Intake</h3>
        <dl className="text-sm text-warm-800 space-y-1">
          {intakeLines(order.intake).map(([k, v]) => (
            <div key={k}>
              <dt className="inline font-semibold">{k}: </dt>
              <dd className="inline whitespace-pre-wrap break-words">{v}</dd>
            </div>
          ))}
        </dl>
      </div>

      {order.status === 'delivered' && order.deliveredBody ? (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-warm-400 mb-1">Delivered</h3>
          <p className="text-sm text-warm-800 whitespace-pre-wrap break-words">{order.deliveredBody}</p>
        </div>
      ) : (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-warm-400 mb-1">Draft</h3>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            rows={8}
            disabled={!canDraft}
            className="w-full rounded-lg border border-warm-200 p-3 text-sm font-mono text-warm-900"
          />
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {canDraft && (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void act('draft')}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-warm-100 text-warm-800 hover:bg-warm-200 disabled:opacity-50"
          >
            {busy === 'draft' ? 'Drafting...' : order.status === 'drafted' ? 'Redraft' : 'Draft'}
          </button>
        )}
        {canDraft && (
          <button
            type="button"
            disabled={busy !== null || !canApprove}
            onClick={() => void act('approve')}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-fire-500 text-white hover:bg-fire-600 disabled:opacity-50"
          >
            {busy === 'approve' ? 'Sending...' : 'Approve & send'}
          </button>
        )}
        {canRefund && (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => {
              if (window.confirm(`Refund ${formatPrice(order.priceCents)} to ${order.email}?`)) void act('refund');
            }}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-warm-900 text-white hover:bg-warm-800 disabled:opacity-50"
          >
            {busy === 'refund' ? 'Refunding...' : 'Refund'}
          </button>
        )}
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}

/** Owner approval screen for menu orders: intake, editable draft, Draft / Approve & send / Refund. */
export function MenuOrdersTab() {
  const { data, error, loading, reload } = useAdminResource<MenuOrdersResponse>('/admin/menu-orders');
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('all');

  const refresh = useCallback(async () => { await reload(); }, [reload]);

  const orders = useMemo(() => {
    if (!data) return [];
    const list = filter === 'all' ? data.orders : data.orders.filter(o => o.status === filter);
    // Stable sort keeps the server's newest-first order within each status.
    return list.slice().sort((a, b) => RANK[a.status] - RANK[b.status]);
  }, [data, filter]);

  if (!data) return <LoadingState loading={loading} error={error} label="orders" />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-warm-600">
          Today: <span className="font-bold text-warm-900">{data.asyncToday}</span> / {data.asyncCap} async orders
        </p>
        <label className="flex items-center gap-2 text-xs font-semibold text-warm-600">
          Status
          <select
            value={filter}
            onChange={e => setFilter(e.target.value as (typeof FILTERS)[number])}
            className="rounded-lg border border-warm-200 px-2 py-1 text-sm"
          >
            {FILTERS.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </label>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      {orders.length === 0 ? (
        <p className="text-sm text-warm-400">No orders.</p>
      ) : (
        orders.map(o => <OrderCard key={o.id} order={o} onChanged={refresh} />)
      )}
    </div>
  );
}
