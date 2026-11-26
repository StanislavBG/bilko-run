import { useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import { Link, Navigate } from 'react-router-dom';

import { useIsAdmin } from '../hooks/useAdmin.js';

export interface AdminArea {
  name: string;
  to: string;
  description: string;
}

/** One card per admin area on the /admin home. */
export const ADMIN_AREAS: readonly AdminArea[] = [
  { name: 'Command', to: '/admin/observability', description: 'Live traffic, apps, sessions and errors on one screen.' },
  { name: 'Analytics', to: '/admin/analytics', description: 'Live web-product revenue, traffic sources, per-tool funnels, product orders, bookings, Session Manager and sign-ups.' },
  { name: 'Secrets & API keys', to: '/admin/secrets', description: 'Rotate secrets and create the read-only and Registry write keys for the bilko-host MCP.' },
  { name: 'Sessions', to: '/admin/sessions', description: 'Replay visitor sessions step by step.' },
  { name: 'Cost', to: '/admin/cost', description: 'Gemini call usage, spend ceilings and open alerts.' },
];

export function AdminPage() {
  const { isLoaded } = useUser();
  const isAdmin = useIsAdmin();

  useEffect(() => {
    document.title = 'Admin — bilko.run';
    return () => { document.title = 'Bilko.run — Tools for Makers Who Ship'; };
  }, []);

  if (isLoaded && !isAdmin) return <Navigate to="/" replace />;
  if (!isLoaded) return <div className="p-12 text-center text-warm-400">Loading...</div>;

  return (
    <section className="max-w-5xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-extrabold text-warm-900 mb-6">Admin</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ADMIN_AREAS.map(area => (
          <Link
            key={area.to}
            to={area.to}
            data-testid="admin-area-card"
            className="block rounded-2xl border border-warm-200/60 bg-white p-5 shadow-sm transition-all hover:border-fire-300 hover:shadow-md"
          >
            <h2 className="text-base font-bold text-warm-900">{area.name}</h2>
            <p className="mt-1 text-sm text-warm-500">{area.description}</p>
            <span className="mt-3 inline-block text-xs font-semibold text-fire-500">Open →</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
