import { useAdminResource } from '../../hooks/useAdmin.js';
import { LoadingState } from './analytics/parts.js';

interface BookingEntry {
  slug: string;
  startMs: number;
  endMs: number;
  email: string;
  topic: string;
  createdAt: number;
}

interface BookingsResponse {
  days: number;
  free_hours_booked: number;
  paid_hours: number;
  mailer_configured: boolean;
  upcoming: BookingEntry[];
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

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white rounded-xl border border-warm-200/60 p-4 text-center">
      <div className="text-2xl font-extrabold text-warm-900">{value}</div>
      <div className="text-xs font-semibold text-warm-500">{label}</div>
    </div>
  );
}

export function BookingsTab({ days }: { days: number }) {
  const { data, error, loading } = useAdminResource<BookingsResponse>(`/admin/bookings?days=${days}`);
  if (!data) return <LoadingState loading={loading} error={error} label="bookings" />;
  const upcoming = [...data.upcoming].sort((a, b) => a.startMs - b.startMs);
  return (
    <div className="space-y-6">
      {error && <div className="text-red-500 text-sm">Could not refresh bookings: {error}</div>}
      {!data.mailer_configured && (
        <div role="alert" className="bg-red-50 border border-red-300 text-red-700 font-bold rounded-xl p-4">
          Booking is refusing visitors: set RESEND_API_KEY, MAIL_FROM and BILKO_INBOX on Render.
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 max-w-md">
        <Tile label="free_hours_booked" value={data.free_hours_booked} />
        <Tile label="paid_hours" value={data.paid_hours} />
      </div>
      <div className="bg-white rounded-xl border border-warm-200/60 p-5">
        <h2 className="text-xs font-bold uppercase tracking-wider text-warm-400 mb-4">Upcoming</h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-warm-400">No bookings yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-warm-100">
                <th className="text-left py-1 px-2 text-xs font-bold text-warm-400">Time</th>
                <th className="text-left py-1 px-2 text-xs font-bold text-warm-400">Email</th>
                <th className="text-left py-1 px-2 text-xs font-bold text-warm-400">Topic</th>
                <th className="text-left py-1 px-2 text-xs font-bold text-warm-400">Slug</th>
              </tr>
            </thead>
            <tbody>
              {upcoming.map(b => (
                <tr key={`${b.slug}-${b.startMs}-${b.email}`} className="border-b border-warm-50 align-top">
                  <td className="py-1.5 px-2 text-warm-800 whitespace-nowrap">{PT_FORMAT.format(new Date(b.startMs))}</td>
                  <td className="py-1.5 px-2 text-warm-800">{b.email}</td>
                  <td className="py-1.5 px-2 text-warm-600 whitespace-pre-wrap break-words">{b.topic}</td>
                  <td className="py-1.5 px-2 text-warm-600">{b.slug}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
