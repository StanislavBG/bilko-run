import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/portfolio/PageHeader.js';
import { navigateProject } from '../components/portfolio/navigateProject.js';
import { PORTFOLIO_PROJECTS, type PortfolioProject } from '../data/portfolio.js';

const FILTERS = ['All', 'Live', 'Shipped', 'Cooking'] as const;
type Filter = typeof FILTERS[number];

/**
 * Display order for category groups. Anything not in this list falls to the
 * end and renders in the order it first appears in the registry.
 */
const CATEGORY_ORDER: readonly string[] = [
  'AI Tool · Content',
  'AI Tool · Productivity',
  'AI Tool · Dev',
  'Game',
];

interface Group {
  category: string;
  projects: readonly PortfolioProject[];
}

function groupByCategory(list: readonly PortfolioProject[]): Group[] {
  const map = new Map<string, PortfolioProject[]>();
  for (const p of list) {
    const arr = map.get(p.kind) ?? [];
    arr.push(p);
    map.set(p.kind, arr);
  }
  const orderIndex = (cat: string) => {
    const i = CATEGORY_ORDER.indexOf(cat);
    return i === -1 ? CATEGORY_ORDER.length : i;
  };
  return [...map.entries()]
    .map(([category, projects]) => ({ category, projects }))
    .sort((a, b) => orderIndex(a.category) - orderIndex(b.category));
}

export function ProjectsPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>('All');

  useEffect(() => {
    document.title = 'Projects — Bilko Bibitkov';
  }, []);

  const list = useMemo(
    () => filter === 'All' ? PORTFOLIO_PROJECTS : PORTFOLIO_PROJECTS.filter(p => p.status === filter),
    [filter],
  );

  const groups = useMemo(() => groupByCategory(list), [list]);

  return (
    <div className="pf-page">
      <PageHeader
        eyebrow="Section 02 · Portfolio"
        title="Projects."
        lede={`${PORTFOLIO_PROJECTS.length} projects across ${groupByCategory(PORTFOLIO_PROJECTS).length} categories. Each one is a real attempt at making something useful — not a demo, not a screenshot.`}
        what="Grouped by what they do. Click any card for the live tool. Filter by status to see what's live, shipped, or still cooking."
      />
      <div style={{ display: 'flex', gap: 8, marginBottom: 32, flexWrap: 'wrap' }}>
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

      {groups.length === 0 && (
        <div className="pf-mono" style={{ padding: '40px 0', color: 'var(--pf-ink-3)' }}>
          Nothing matches that filter.
        </div>
      )}

      {groups.map(({ category, projects }) => (
        <section key={category} className="pf-category">
          <header className="pf-category-header">
            <h2 className="pf-serif">{category}</h2>
            <span className="pf-mono">{projects.length} {projects.length === 1 ? 'project' : 'projects'}</span>
          </header>
          <div className="pf-proj-grid">
            {projects.map((p, i) => (
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
                  {p.kind.includes('Game') && (
                    <Link
                      to="/games"
                      className="pf-chip"
                      onClick={e => e.stopPropagation()}
                      style={{ color: 'var(--pf-accent)', borderColor: 'var(--pf-accent)' }}
                    >
                      Play in arcade →
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
