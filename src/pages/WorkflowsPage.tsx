import { useEffect } from 'react';
import { PageHeader } from '../components/portfolio/PageHeader.js';
import { WORKFLOWS, CHANNELS } from '../data/portfolio.js';

export function WorkflowsPage() {
  useEffect(() => {
    document.title = 'Workflows — Bilko';
  }, []);

  return (
    <div className="pf-page">
      <PageHeader
        eyebrow="Section 07 · Background"
        title="Workflows."
        lede="The agents that don't sleep. A local-first orchestrator (Burrow) runs cron-tick pipelines that scroll, capture, draft, and post — all at human speed, all on this machine."
        what="The actual pipelines and the channels they post into. No fake dashboards — just what's wired up."
      />

      <section className="pf-wf-channels">
        <h2 className="pf-wf-section-title">Channels</h2>
        <ul className="pf-wf-channel-list">
          {CHANNELS.map(c => (
            <li key={c.id}>
              <a
                href={c.href}
                target={c.href.startsWith('/') ? undefined : '_blank'}
                rel={c.href.startsWith('/') ? undefined : 'noopener noreferrer'}
              >
                <span className="pf-wf-channel-label">{c.label}</span>
                <span className="pf-wf-channel-handle">{c.handle}</span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section className="pf-wf-pipelines">
        <h2 className="pf-wf-section-title">Pipelines</h2>
        <table className="pf-wf-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Cadence</th>
              <th>What it does</th>
            </tr>
          </thead>
          <tbody>
            {WORKFLOWS.map(w => (
              <tr key={w.id}>
                <td className="pf-name">{w.name}</td>
                <td className="pf-mono" style={{ color: 'var(--pf-ink-2)', whiteSpace: 'nowrap' }}>{w.cadence}</td>
                <td style={{ color: 'var(--pf-ink-2)' }}>{w.desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
