import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { API } from '../data/api.js';

interface AuthState {
  email: string;
  isPro: boolean;
  loading: boolean;
  setEmail: (email: string) => void;
  refresh: () => void;
}

const AuthContext = createContext<AuthState>({
  email: '',
  isPro: false,
  loading: false,
  setEmail: () => {},
  refresh: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [email, setEmailState] = useState(() => localStorage.getItem('bilko_pro_email') ?? '');
  const [isPro, setIsPro] = useState(false);
  const [loading, setLoading] = useState(false);

  const checkSubscription = useCallback(async (e: string) => {
    const target = e.trim().toLowerCase();
    if (!target || !target.includes('@')) {
      setIsPro(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API}/stripe/subscription-status?email=${encodeURIComponent(target)}`);
      const data = await res.json();
      setIsPro(data.active ?? false);
    } catch {
      setIsPro(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkSubscription(email);
  }, [email, checkSubscription]);

  function setEmail(e: string) {
    const normalized = e.trim().toLowerCase();
    localStorage.setItem('bilko_pro_email', normalized);
    setEmailState(normalized);
  }

  return (
    <AuthContext.Provider value={{ email, isPro, loading, setEmail, refresh: () => checkSubscription(email) }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
