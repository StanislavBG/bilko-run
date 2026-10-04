import { useCallback, useEffect, useRef, useState } from 'react';
import { authFetch } from './auth.js';

const HOST = 'https://bilko.run';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ScoreRow {
  display_name: string;
  score: number;
  mode: string;
  created_at: number;
}

export interface LeaderboardOpts {
  range?: 'today' | 'week' | 'all';
  mode?: string;
  limit?: number;
}

export interface AchievementDef {
  key: string;
  name: string;
  description: string;
  icon: string;
  secret?: boolean;
}

export interface UnlockRow {
  key: string;
  unlocked_at: number;
}

export interface CrossUnlock {
  game: string;
  key: string;
  name: string;
}

export interface SaveStateResult<T> {
  blob: T | null;
  version: number;
  updated_at: number;
  loading: boolean;
  save(blob: T): Promise<boolean>;
  clear(): Promise<void>;
}

// ── useLeaderboard ────────────────────────────────────────────────────────────

export function useLeaderboard(game: string, opts: LeaderboardOpts = {}): {
  scores: ScoreRow[];
  loading: boolean;
  error: string | null;
  submit(score: number, mode?: string, payload?: unknown): Promise<boolean>;
  refresh(): Promise<void>;
} {
  const [scores, setScores] = useState<ScoreRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const fetchScores = useCallback(async () => {
    setLoading(true);
    try {
      const { range, mode, limit } = optsRef.current;
      const params = new URLSearchParams();
      if (range) params.set('range', range);
      if (mode) params.set('mode', mode);
      if (limit) params.set('limit', String(limit));
      const r = await fetch(`${HOST}/api/games/${game}/scores?${params}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json() as { scores?: ScoreRow[] };
      setScores(j.scores ?? []);
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'failed');
    } finally {
      setLoading(false);
    }
  }, [game]);

  useEffect(() => {
    void fetchScores();
  }, [fetchScores]);

  const submit = useCallback(async (score: number, mode?: string, payload?: unknown): Promise<boolean> => {
    const r = await authFetch(`${HOST}/api/games/${game}/scores`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ score, mode, payload }),
    });
    if (r?.ok) void fetchScores();
    return r?.ok ?? false;
  }, [game, fetchScores]);

  return { scores, loading, error, submit, refresh: fetchScores };
}

// ── useSaveState ──────────────────────────────────────────────────────────────

export function useSaveState<T = unknown>(game: string): SaveStateResult<T> {
  const [state, setState] = useState<{ blob: T | null; version: number; updated_at: number }>({
    blob: null, version: 0, updated_at: 0,
  });
  const [loading, setLoading] = useState(true);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    void (async () => {
      const r = await authFetch(`${HOST}/api/games/${game}/save`);
      if (r?.ok) setState(await r.json() as typeof state);
      setLoading(false);
    })();
  }, [game]);

  const save = useCallback(async (blob: T): Promise<boolean> => {
    const r = await authFetch(`${HOST}/api/games/${game}/save`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ blob, expectedVersion: stateRef.current.version }),
    });
    if (r?.ok) {
      const j = await r.json() as { version: number };
      setState({ blob, version: j.version, updated_at: Math.floor(Date.now() / 1000) });
      return true;
    }
    return false;
  }, [game]);

  const clear = useCallback(async (): Promise<void> => {
    await authFetch(`${HOST}/api/games/${game}/save`, { method: 'DELETE' });
    setState({ blob: null, version: 0, updated_at: 0 });
  }, [game]);

  return { ...state, loading, save, clear };
}

// ── useUnlocks ────────────────────────────────────────────────────────────────

export function useUnlocks(game: string): {
  unlocks: UnlockRow[];
  achievements: AchievementDef[];
  unlock(key: string): Promise<boolean>;
  lastCrossUnlock: CrossUnlock | null;
} {
  const [unlocks, setUnlocks] = useState<UnlockRow[]>([]);
  const [achievements, setAchievements] = useState<AchievementDef[]>([]);
  const [lastCrossUnlock, setLastCrossUnlock] = useState<CrossUnlock | null>(null);

  useEffect(() => {
    void (async () => {
      const [u, a] = await Promise.all([
        authFetch(`${HOST}/api/games/${game}/unlocks`)
          .then((r) => r?.ok ? r.json() as Promise<{ unlocks: UnlockRow[] }> : { unlocks: [] }),
        fetch(`${HOST}/api/games/${game}/achievements`)
          .then((r) => r.ok ? r.json() as Promise<{ achievements: AchievementDef[] }> : { achievements: [] }),
      ]);
      setUnlocks(u.unlocks ?? []);
      setAchievements(a.achievements ?? []);
    })();
  }, [game]);

  const unlock = useCallback(async (key: string): Promise<boolean> => {
    const r = await authFetch(`${HOST}/api/games/${game}/unlock`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ key }),
    });
    if (r?.ok) {
      const j = await r.json() as { unlocked_at: number; crossUnlock?: CrossUnlock };
      setUnlocks((prev) =>
        prev.some((u) => u.key === key) ? prev : [...prev, { key, unlocked_at: j.unlocked_at }],
      );
      if (j.crossUnlock) setLastCrossUnlock(j.crossUnlock);
      return true;
    }
    return false;
  }, [game]);

  return { unlocks, achievements, unlock, lastCrossUnlock };
}
