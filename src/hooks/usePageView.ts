import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const API = import.meta.env.VITE_API_URL || '/api';

/** Fire a page view on every route change. No cookies, no PII. */
export function usePageView() {
  const location = useLocation();

  useEffect(() => {
    fetch(`${API}/analytics/pageview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: location.pathname,
        referrer: document.referrer || '',
        screen: `${window.innerWidth}x${window.innerHeight}`,
      }),
    }).catch(() => {}); // fire-and-forget
  }, [location.pathname]);
}
