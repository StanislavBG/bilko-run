import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/portfolio/PageHeader.js';
import { LESSONS } from '../data/academy/lessons.js';

export function AcademyPage() {
  useEffect(() => {
    document.title = 'Academy — Bilko';
  }, []);

  return (
    <div className="pf-page">
      <PageHeader
        eyebrow="Section 06 · Learn"
        title={<>Bilko's <em style={{ color: 'var(--pf-accent)', fontStyle: 'italic' }}>Academy.</em></>}
        lede="Five levels of AI fluency, free to all, opinionated as hell. Start at zero, end as someone who can wire a model into a real product."
        what="Pick the level closest to where you are. Each level is a single ~30-min lesson built around custom diagrams and a concrete project. No quizzes, no certificates."
      />
      <div className="pf-academy-cta" role="note" style={{ marginBottom: '2rem', padding: '0.75rem 1rem', borderLeft: '3px solid var(--pf-accent)', background: 'color-mix(in oklch, var(--pf-accent) 8%, transparent)', borderRadius: '4px' }}>
        Looking for the long-form, non-technical course? Read{' '}
        <a href="/projects/academy/" style={{ color: 'var(--pf-accent)', fontWeight: 600 }}>Bilko Academy</a>{' '}
        — three modules, every claim cited, BYOK or Bilko's quota for "Ask Claude" exercises.
      </div>
      <div className="pf-level-list">
        {LESSONS.map(l => (
          <Link key={l.n} to={`/academy/${l.slug}`} className="pf-level-row" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="pf-n">0{l.n}</div>
            <div className="pf-name">{l.name}</div>
            <div className="pf-desc">
              <div>{l.tagline}</div>
              <div className="pf-mono" style={{ marginTop: 6, color: 'var(--pf-ink-3)', textTransform: 'none', letterSpacing: 0 }}>
                {l.readMinutes} min · {l.tags.slice(0, 3).join(' · ')}
              </div>
            </div>
            <div className="pf-cta" style={{ color: l.status === 'live' ? 'var(--pf-accent)' : 'var(--pf-ink-3)' }}>
              {l.status === 'live' ? 'Start →' : 'Cooking'}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
