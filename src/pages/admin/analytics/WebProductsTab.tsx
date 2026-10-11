import { useAdminResource } from '../../../hooks/useAdmin.js';
import { LoadingState } from './parts.js';

interface TabProps {
  days: number;
  excludeSelf: boolean;
}

interface WebProductEntry {
  slug: string;
  name: string;
  displayPrice: string;
  version: string | null;
  releaseStored: boolean;
  views: number;
  uniqueVisitors: number;
  checkoutStarts: number;
  orders: number;
  revenueCents: number;
  downloads: number;
  uniqueDownloadSessions: number;
  lastOrderAt: number | null;
  lastDownloadAt: number | null;
}

interface WebProductDaily {
  date: string;
  slug: string;
  views: number;
  checkoutStarts: number;
  orders: number;
  downloads: number;
}

interface WebProductsResponse {
  days: number;
  products: WebProductEntry[];
  daily: WebProductDaily[];
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

function pct(num: number, den: number): string {
  return den > 0 ? `${Math.round((num / den) * 100)}%` : '—';
}

function dollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function ProductCard({ p }: { p: WebProductEntry }) {
  const steps: Array<{ label: string; value: number; conv: string | null }> = [
    { label: 'Views', value: p.views, conv: null },
    { label: 'Checkout starts', value: p.checkoutStarts, conv: pct(p.checkoutStarts, p.views) },
    { label: 'Orders', value: p.orders, conv: pct(p.orders, p.checkoutStarts) },
    { label: 'Downloads', value: p.downloads, conv: pct(p.downloads, p.orders) },
  ];
  return (
    <div className="bg-white rounded-xl border border-warm-200/60 p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-base font-extrabold text-warm-900">{p.name}</h2>
          <p className="text-xs text-warm-500">
            {p.displayPrice} · {p.version ? `v${p.version}` : 'no release'}
          </p>
        </div>
        <span
          className={`px-2 py-1 rounded-lg text-xs font-bold whitespace-nowrap ${
            p.releaseStored ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
          }`}
        >
          {p.releaseStored ? 'release stored' : 'release missing'}
        </span>
      </div>

      <div className="flex items-stretch gap-2 mb-4">
        {steps.map((s, i) => (
          <div key={s.label} className="flex items-center gap-2 flex-1">
            {i > 0 && (
              <div className="text-center text-xs text-warm-400 w-10 flex-shrink-0">
                <div>→</div>
                <div className="font-bold">{s.conv}</div>
              </div>
            )}
            <div className="flex-1 bg-warm-50 rounded-lg p-3 text-center">
              <div className="text-xl font-extrabold text-warm-900">{s.value}</div>
              <div className="text-xs font-semibold text-warm-500">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-warm-700">
        <span>Revenue: <span className="font-bold text-warm-900">{dollars(p.revenueCents)}</span></span>
        <span>Last order: <span className="font-medium">{formatPt(p.lastOrderAt)}</span></span>
        <span>Last download: <span className="font-medium">{formatPt(p.lastDownloadAt)}</span></span>
      </div>
    </div>
  );
}

export function WebProductsTab({ days }: TabProps) {
  const { data, error, loading } = useAdminResource<WebProductsResponse>(`/admin/web-products?days=${days}`);
  if (!data) return <LoadingState loading={loading} error={error} label="web products" />;
  if (data.products.length === 0) {
    return <div className="text-warm-400 text-center py-12">No web products yet</div>;
  }
  const nameBySlug = new Map(data.products.map(p => [p.slug, p.name]));
  return (
    <div className="space-y-6">
      {data.products.map(p => <ProductCard key={p.slug} p={p} />)}

      <div className="bg-white rounded-xl border border-warm-200/60 p-5">
        <h2 className="text-xs font-bold uppercase tracking-wider text-warm-400 mb-4">Daily Series</h2>
        {data.daily.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-warm-100">
                <th className="text-left py-1 px-2 text-xs font-bold text-warm-400">Date</th>
                <th className="text-left py-1 px-2 text-xs font-bold text-warm-400">Product</th>
                <th className="text-right py-1 px-2 text-xs font-bold text-warm-400">Views</th>
                <th className="text-right py-1 px-2 text-xs font-bold text-warm-400">Checkout starts</th>
                <th className="text-right py-1 px-2 text-xs font-bold text-warm-400">Orders</th>
                <th className="text-right py-1 px-2 text-xs font-bold text-warm-400">Downloads</th>
              </tr>
            </thead>
            <tbody>
              {data.daily.map(r => (
                <tr key={`${r.slug}-${r.date}`} className="border-b border-warm-50">
                  <td className="py-1.5 px-2 text-warm-800">{r.date}</td>
                  <td className="py-1.5 px-2 text-warm-600">{nameBySlug.get(r.slug) ?? r.slug}</td>
                  <td className="py-1.5 px-2 text-right text-warm-800">{r.views}</td>
                  <td className="py-1.5 px-2 text-right text-warm-800">{r.checkoutStarts}</td>
                  <td className="py-1.5 px-2 text-right font-bold text-warm-900">{r.orders}</td>
                  <td className="py-1.5 px-2 text-right font-bold text-warm-900">{r.downloads}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p className="text-sm text-warm-400">No activity in this window</p>}
      </div>
    </div>
  );
}
