import { createElement, useCallback, useEffect, useState, type ReactNode } from 'react';
import { useAuth, useUser } from '@clerk/clerk-react';
import { ADMIN_EMAILS, API_BASE } from '../constants.js';

export function useIsAdmin(): boolean {
  const { user } = useUser();
  const email = user?.primaryEmailAddress?.emailAddress?.toLowerCase() ?? '';
  return ADMIN_EMAILS.includes(email);
}

/** Fetch against API_BASE; adds the Bearer header only when a token exists. */
export function useAdminFetch(): (path: string, init?: RequestInit) => Promise<Response> {
  const { getToken } = useAuth();
  return useCallback(
    async (path: string, init: RequestInit = {}) => {
      const token = await getToken();
      const headers = new Headers(init.headers);
      if (token) headers.set('Authorization', `Bearer ${token}`);
      return fetch(`${API_BASE}${path}`, { ...init, headers });
    },
    [getToken],
  );
}

export interface AdminResource<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => Promise<void>;
}

export function useAdminResource<T>(path: string, opts: { enabled?: boolean } = {}): AdminResource<T> {
  const { isLoaded, isSignedIn } = useAuth();
  const adminFetch = useAdminFetch();
  const enabled = (opts.enabled ?? true) && isLoaded && !!isSignedIn;
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminFetch(path);
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      setData((await res.json()) as T);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  }, [adminFetch, path]);

  useEffect(() => {
    if (enabled) void reload();
    else if (isLoaded) setLoading(false);
  }, [enabled, isLoaded, reload]);

  return { data, error, loading, reload };
}

export function AdminGate({ children }: { children: ReactNode }) {
  const isAdmin = useIsAdmin();
  if (!isAdmin) return createElement('p', { className: 'text-zinc-400 text-sm p-6' }, 'Admins only');
  return createElement('div', null, children);
}
