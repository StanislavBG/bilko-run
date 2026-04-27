import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PORTFOLIO_PROJECTS } from '../data/portfolio.js';

export function PortfolioProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const p = PORTFOLIO_PROJECTS.find(x => x.id === id);

  useEffect(() => {
    document.title = p ? `${p.name} — Bilko` : 'Not found — Bilko';
  }, [p]);

  if (!p) {
    return (
      <div className="pf-page" style={{ padding: '60px 0' }}>
        <div className="pf-eyebrow">404</div>
        <h1 className="pf-serif" style={{ fontSize: 80, fontWeight: 400, margin: '12px 0 24px' }}>Not found.</h1>
        <button className="pf-btn" onClick={() => navigate('/projects')}>← Back to projects</button>
      </div>
    );
  }

  return (
    <div className="pf-page pf-proj-detail">
      <button
        onClick={() => navigate('/projects')}
        className="pf-mono"
        style={{ cursor: 'pointer', margin: '32px 0 16px', color: 'var(--pf-ink-2)' }}
      >
        ← Back to projects
      </button>
      <div className="pf-eyebrow">{p.kind}</div>
      <h1 className="pf-serif" style={{ fontSize: 96, margin: '12px 0 24px', fontWeight: 400, letterSpacing: '-0.025em', lineHeight: 0.95 }}>
        {p.name}
      </h1>
      <p style={{ fontSize: 22, color: 'var(--pf-ink-2)', maxWidth: 680, lineHeight: 1.45 }}>{p.blurb}</p>

      <div className="pf-meta-strip" style={{ marginTop: 40 }}>
        <div><span className="pf-k">Status</span><span>{p.status}</span></div>
        <div><span className="pf-k">Year</span><span>{p.year}</span></div>
        <div><span className="pf-k">Stack</span><span>{p.tags.join(' · ')}</span></div>
        <div><span className="pf-k">Role</span><span>Solo</span></div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 60, marginTop: 48 }}>
        <div>
          <h2 className="pf-serif" style={{ fontSize: 36, fontWeight: 400, margin: '0 0 16px' }}>The brief.</h2>
          <p style={{ color: 'var(--pf-ink-2)', fontSize: 16, lineHeight: 1.6, marginBottom: 32 }}>
            {p.name} started as a small frustration: existing tools assumed too much,
            shipped too late, or hid the interesting parts behind enterprise paywalls.
            The goal was something direct, opinionated, and small enough to maintain alone.
          </p>
          <h2 className="pf-serif" style={{ fontSize: 36, fontWeight: 400, margin: '0 0 16px' }}>What got hard.</h2>
          <p style={{ color: 'var(--pf-ink-2)', fontSize: 16, lineHeight: 1.6, marginBottom: 32 }}>
            The model was the easy part. The hard parts were turn-taking, error
            recovery when the model returned malformed JSON, and resisting the urge
            to add features that nobody asked for.
          </p>
          <h2 className="pf-serif" style={{ fontSize: 36, fontWeight: 400, margin: '0 0 16px' }}>What got cut.</h2>
          <p style={{ color: 'var(--pf-ink-2)', fontSize: 16, lineHeight: 1.6 }}>
            Multi-tenant. Settings panel. Dark mode. A "share this" button. None of these
            served the core loop, so they're sitting in a notebook waiting to be obvious.
          </p>
        </div>
        <aside>
          <div style={{ position: 'sticky', top: 90 }}>
            <div style={{ padding: 24, background: 'var(--pf-paper)', border: '1px solid var(--pf-rule)' }}>
              <div className="pf-eyebrow" style={{ marginBottom: 12 }}>Visit</div>
              <button className="pf-btn" style={{ width: '100%', justifyContent: 'center' }}>Open project →</button>
              <div className="pf-eyebrow" style={{ marginTop: 24, marginBottom: 12 }}>Source</div>
              <a className="pf-mono" style={{ color: 'var(--pf-ink)', display: 'block' }}>github.com/bilko/{p.id}</a>
              <div className="pf-eyebrow" style={{ marginTop: 24, marginBottom: 12 }}>Tags</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {p.tags.map(t => <span key={t} className="pf-chip">{t}</span>)}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
