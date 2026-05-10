import { useEffect, useRef, useState } from 'react';
import type { GameCard as GameCardType } from '../data/games.js';

interface LeaderboardEntry {
  display_name: string;
  score: number;
}

function fmtScore(score: number, apiSlug: string): string {
  if (apiSlug === 'boat-shooter') return score.toLocaleString();
  // puzzle games store completion time in ms (scoreOrder: 'asc')
  const m = Math.floor(score / 60_000);
  const s = Math.floor((score / 1000) % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function GameCard({ game }: { game: GameCardType }) {
  const [scores, setScores] = useState<LeaderboardEntry[] | null>(null);
  const [unlocks, setUnlocks] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const obs = new IntersectionObserver(async (entries) => {
      if (!entries[0]?.isIntersecting) return;
      obs.disconnect();
      const range = game.apiSlug === 'boat-shooter' ? 'all' : 'today';
      try {
        const r = await fetch(`/api/games/${game.apiSlug}/scores?range=${range}&limit=3`);
        if (r.ok) {
          const j = await r.json() as { scores?: LeaderboardEntry[] };
          setScores(j.scores ?? []);
        }
      } catch { /* failure-quiet */ }
      try {
        const r = await fetch(`/api/games/${game.apiSlug}/unlocks`, { credentials: 'include' });
        if (r.ok) {
          const j = await r.json() as { unlocks?: unknown[] };
          setUnlocks(j.unlocks?.length ?? 0);
        }
      } catch { /* failure-quiet */ }
    }, { rootMargin: '200px' });
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, [game.apiSlug]);

  return (
    <div
      ref={ref}
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        padding: 20,
        borderRadius: 'var(--pf-radius, 12px)',
        background: 'var(--pf-surface, #f5f5f5)',
        boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
        minHeight: 240,
      }}
    >
      {unlocks != null && unlocks > 0 && (
        <span style={{
          position: 'absolute',
          top: 12,
          right: 12,
          fontSize: 11,
          padding: '2px 8px',
          borderRadius: 99,
          background: 'rgba(255,255,255,0.7)',
          border: '1px solid var(--pf-rule-2)',
          backdropFilter: 'blur(4px)',
        }}>
          🏆 {unlocks}
        </span>
      )}

      <div style={{ fontSize: 48, lineHeight: 1 }}>{game.icon}</div>

      <div>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, fontFamily: 'var(--pf-font-serif)' }}>
          {game.name}
        </h2>
        <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--pf-ink-3)', lineHeight: 1.5 }}>
          {game.tagline}
        </p>
      </div>

      {scores && scores.length > 0 && (
        <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--pf-ink-3)', lineHeight: 1.8 }}>
          {scores.map((s, i) => (
            <li key={i}>{s.display_name} — {fmtScore(s.score, game.apiSlug)}</li>
          ))}
        </ol>
      )}

      <a
        href={game.href}
        style={{
          marginTop: 'auto',
          alignSelf: 'flex-start',
          fontSize: 14,
          fontWeight: 500,
          textDecoration: 'underline',
          color: 'inherit',
        }}
      >
        Play →
      </a>
    </div>
  );
}
