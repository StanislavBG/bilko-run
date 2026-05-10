import { useEffect } from 'react';
import { GameCard } from '../components/GameCard.js';
import { getGames } from '../data/games.js';
import { useOgMeta } from '../hooks/useOgMeta.js';

export function GamesPage() {
  useOgMeta({
    title: 'Bilko Games — free, ad-free, login-optional',
    description: 'A small arcade of free, restraint-first browser games by Bilko.',
    url: 'https://bilko.run/games',
  });

  useEffect(() => {
    document.title = 'Bilko Games — free, ad-free, login-optional';
  }, []);

  const games = getGames();

  return (
    <div className="pf-page">
      <div style={{ marginBottom: 40 }}>
        <div className="pf-eyebrow">Arcade</div>
        <h1 className="pf-serif" style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', margin: '8px 0 12px' }}>
          Bilko Games
        </h1>
        <p style={{ color: 'var(--pf-ink-3)', maxWidth: 480, lineHeight: 1.6 }}>
          A small arcade. All free. All ad-free. Sign-in optional.
        </p>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
        gap: 16,
      }}>
        {games.map(g => <GameCard key={g.slug} game={g} />)}
      </div>

      <p style={{ marginTop: 48, fontSize: 12, color: 'var(--pf-ink-3)', textAlign: 'center' }}>
        Built by Bilko · all games are free, ad-free, and login-optional.
      </p>
    </div>
  );
}
