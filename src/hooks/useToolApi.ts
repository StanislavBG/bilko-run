import { useState, useRef } from 'react';
import { useAuth, useUser, SignInButton } from '@clerk/clerk-react';

const API = import.meta.env.VITE_API_URL || '/api';

export interface ToolApiState<T> {
  result: T | null;
  loading: boolean;
  error: string | null;
  needsTokens: boolean;
  tokenBalance: number | null;
}

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

  async function authHeaders(): Promise<Record<string, string>> {
    const token = await getToken();
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  async function submit(body: Record<string, unknown>) {
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
      const headers = await authHeaders();
      const res = await fetch(`${API}/demos/${endpoint}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ ...body, email }),
      });
      const data = await res.json();
      if (data.requiresTokens) {
        setNeedsTokens(true);
        setTokenBalance(data.balance ?? 0);
        return;
      }
      if (data.gated) {
        setError(data.message || 'Rate limit reached. Sign in for more.');
        return;
      }
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setResult(data as TResult);
      if (data.usage?.balance !== undefined) setTokenBalance(data.usage.balance);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Analysis failed.');
    } finally {
      setLoading(false);
    }
  }

  async function submitCompare(body: Record<string, unknown>) {
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
      const headers = await authHeaders();
      const res = await fetch(`${API}/demos/${endpoint}/compare`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ ...body, email }),
      });
      const data = await res.json();
      if (data.requiresTokens) {
        setNeedsTokens(true);
        setTokenBalance(data.balance ?? 0);
        return;
      }
      if (data.gated) {
        setError(data.message || 'Rate limit reached.');
        return;
      }
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setCompareResult(data);
      if (data.usage?.balance !== undefined) setTokenBalance(data.usage.balance);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Comparison failed.');
    } finally {
      setLoading(false);
    }
  }

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
