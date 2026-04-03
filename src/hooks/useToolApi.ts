import { useState, useRef } from 'react';
import { useAuth, useUser, SignInButton } from '@clerk/clerk-react';

const API = import.meta.env.VITE_API_URL || '/api';

export function useToolApi<TResult>(endpoint: string) {
  const { getToken } = useAuth();
  const { user, isSignedIn } = useUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? '';

  const [result, setResult] = useState<TResult | null>(null);
  const [compareResult, setCompareResult] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsTokens, setNeedsTokens] = useState(false);
  const [tokenBalance, setTokenBalance] = useState<number | null>(null);
  const signInRef = useRef<HTMLButtonElement>(null);

  async function fetchEndpoint(urlSuffix: string, body: Record<string, unknown>, onSuccess: (data: any) => void) {
    if (!isSignedIn) {
      signInRef.current?.click();
      return;
    }
    setLoading(true);
    setResult(null);
    setCompareResult(null);
    setError(null);
    setNeedsTokens(false);
    try {
      const token = await getToken();
      const res = await fetch(`${API}/demos/${endpoint}${urlSuffix}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ ...body, email }),
      });
      const data = await res.json();
      if (data.requiresTokens) { setNeedsTokens(true); setTokenBalance(data.balance ?? 0); return; }
      if (data.gated) { setError(data.message || 'Rate limit reached.'); return; }
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      onSuccess(data);
      if (data.usage?.balance !== undefined) setTokenBalance(data.usage.balance);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Request failed.');
    } finally {
      setLoading(false);
    }
  }

  const submit = (body: Record<string, unknown>) =>
    fetchEndpoint('', body, (data) => setResult(data as TResult));

  const submitCompare = (body: Record<string, unknown>) =>
    fetchEndpoint('/compare', body, setCompareResult);

  function reset() {
    setResult(null);
    setCompareResult(null);
    setError(null);
    setNeedsTokens(false);
  }

  return {
    result, compareResult, loading, error, needsTokens, tokenBalance,
    email, isSignedIn,
    submit, submitCompare, reset,
    signInRef, SignInButton,
  };
}
