import { Link } from 'react-router-dom';

/** Small "Admin home" link back to the /admin hub, shown at the top of each admin page. */
export function AdminHomeLink({ className = '' }: { className?: string }) {
  return (
    <Link
      to="/admin"
      data-testid="admin-home-link"
      className={`inline-block text-xs font-semibold text-warm-500 hover:text-fire-500 ${className}`}
    >
      ← Admin home
    </Link>
  );
}
