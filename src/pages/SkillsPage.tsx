import { useEffect } from 'react';
import { PageHeader } from '../components/portfolio/PageHeader.js';
import { SKILLS } from '../data/portfolio.js';

export function SkillsPage() {
  useEffect(() => {
    document.title = 'AI Skills — Bilko';
  }, []);

  return (
    <div className="pf-page">
      <PageHeader
        eyebrow="Section 05 · The kit"
        title="AI Skills."
        lede="What's in the toolbox right now — models I reach for, frameworks I trust, patterns that survived contact with shipping."
        what="A snapshot, not a résumé. Updated whenever something earns its place (or gets booted)."
      />
      <div className="pf-skills-grid">
        {SKILLS.map(s => (
          <div key={s.group} className="pf-skill-block">
            <h3>{s.group}</h3>
            <div className="pf-items">
              {s.items.map(i => <span key={i} className="pf-pill">{i}</span>)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
