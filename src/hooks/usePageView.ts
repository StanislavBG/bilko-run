import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';

const API = import.meta.env.VITE_API_URL || '/api';

/** Fire a page view on every route change. Sends email when authenticated. */
export function usePageView() {
  const location = useLocation();
  const { user } = useUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? '';

  useEffect(() => {
    fetch(`${API}/analytics/pageview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: location.pathname,
        referrer: document.referrer || '',
        screen: `${window.innerWidth}x${window.innerHeight}`,
        ...(email ? { email } : {}),
      }),
    }).catch(() => {});
  }, [location.pathname, email]);
}
