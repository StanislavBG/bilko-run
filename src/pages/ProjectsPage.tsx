import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/portfolio/PageHeader.js';
import { navigateProject } from '../components/portfolio/navigateProject.js';
import { PORTFOLIO_PROJECTS } from '../data/portfolio.js';

const FILTERS = ['All', 'Live', 'Shipped', 'Cooking'] as const;
type Filter = typeof FILTERS[number];

export function ProjectsPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>('All');

  useEffect(() => {
    document.title = 'Projects — Bilko Bibitkov';
  }, []);

  const list = filter === 'All' ? PORTFOLIO_PROJECTS : PORTFOLIO_PROJECTS.filter(p => p.status === filter);

  return (
    <div className="pf-page">
      <PageHeader
        eyebrow="Section 02 · Portfolio"
        title="Projects."
        lede="Twelve shipped. Two cooking. Each one is a real attempt at making something useful with AI — not a demo, not a screenshot."
        what="A grid of everything Bilko has built. Click any card for a detailed write-up: what it does, what was hard, what got cut. Filter by status."
      />
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {FILTERS.map(f => {
          const count = f === 'All' ? PORTFOLIO_PROJECTS.length : PORTFOLIO_PROJECTS.filter(p => p.status === f).length;
          const isActive = filter === f;
          return (
            <button
              key={f}
              className="pf-chip"
              onClick={() => setFilter(f)}
              style={{
                cursor: 'pointer',
                background: isActive ? 'var(--pf-ink)' : 'transparent',
                color: isActive ? 'var(--pf-bg)' : 'var(--pf-ink-2)',
                borderColor: isActive ? 'var(--pf-ink)' : 'var(--pf-rule-2)',
              }}
            >
              {f} <span style={{ opacity: 0.6 }}>· {count}</span>
            </button>
          );
        })}
      </div>
      <div className="pf-proj-grid">
        {list.map((p, i) => (
          <div key={p.id} className="pf-proj-card" onClick={() => navigateProject(navigate, p)}>
            <div className={`pf-swatch ${p.color}`}></div>
            <div className="pf-head">
              <span className="pf-ord">No. {String(i + 1).padStart(2, '0')}</span>
              <span className="pf-ord">{p.year}</span>
            </div>
            <div className="pf-kind">{p.kind}</div>
            <h3>{p.name}</h3>
            <p className="pf-blurb">{p.blurb}</p>
            <div className="pf-foot">
              <span className={`pf-status ${p.status.toLowerCase()}`}>{p.status}</span>
              {p.tags.map(t => <span key={t} className="pf-chip">{t}</span>)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
