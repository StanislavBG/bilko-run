import { useEffect } from 'react';
import { PageHeader } from '../components/portfolio/PageHeader.js';
import { GAMES } from '../data/portfolio.js';

export function StudioPage() {
  useEffect(() => {
    document.title = 'Game Studio — Bilko';
  }, []);

  return (
    <div className="pf-page">
      <PageHeader
        eyebrow="Section 03 · Game Studio"
        title={<>Small games, <em style={{ color: 'var(--pf-accent)', fontStyle: 'italic' }}>weird ideas.</em></>}
        lede="Browser-first games made on weekends. Short loops, strong art direction, no microtransactions, no metaverse."
        what="Each game is playable in a browser tab. Click a card to play. More games coming as I get faster at making them."
      />
      <div className="pf-game-grid">
        {GAMES.map(g => (
          <div key={g.id} className="pf-game-card">
            <div className={`pf-cover ${g.color}`}>
              <span style={{ position: 'relative', zIndex: 1 }}>{g.name[0]}</span>
            </div>
            <div className="pf-game-body">
              <div className="pf-meta">
                <span>{g.genre}</span>
                <span>{g.plays} plays</span>
              </div>
              <h3>{g.name}</h3>
              <p>{g.blurb}</p>
              <button className="pf-btn" style={{ width: '100%', justifyContent: 'center' }}>Play →</button>
            </div>
          </div>
        ))}
        <div
          className="pf-game-card"
          style={{ display: 'grid', placeItems: 'center', border: '1px dashed var(--pf-rule-2)', background: 'transparent', minHeight: 380 }}
        >
          <div style={{ textAlign: 'center', padding: 24 }}>
            <div className="pf-serif" style={{ fontSize: 48, color: 'var(--pf-ink-3)' }}>+</div>
            <div className="pf-mono" style={{ marginTop: 8 }}>Game 04 · cooking</div>
          </div>
        </div>
      </div>
    </div>
  );
}
