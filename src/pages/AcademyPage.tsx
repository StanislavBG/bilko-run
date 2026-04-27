import { useEffect } from 'react';
import { PageHeader } from '../components/portfolio/PageHeader.js';
import { ACADEMY_LEVELS } from '../data/portfolio.js';

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
        what="Pick the level closest to where you are. Every level has 4–6 lessons, each ending in a tiny working artifact. No quizzes, no certificates."
      />
      <div className="pf-level-list">
        {ACADEMY_LEVELS.map(l => (
          <div key={l.n} className="pf-level-row">
            <div className="pf-n">0{l.n}</div>
            <div className="pf-name">{l.name}</div>
            <div className="pf-desc">{l.desc}</div>
            <div className="pf-cta">Start →</div>
          </div>
        ))}
      </div>
    </div>
  );
}
