import { useEffect } from 'react';
import { PageHeader } from '../components/portfolio/PageHeader.js';
import { WORKFLOWS, CHANNELS, WORKFLOWS_SUMMARY } from '../data/portfolio.js';

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

      <section className="pf-wf-summary">
        <div className="pf-wf-summary-stats">
          <div><span className="pf-wf-stat-n">{WORKFLOWS_SUMMARY.pipelinesCount}</span><span className="pf-wf-stat-l">pipelines</span></div>
          <div><span className="pf-wf-stat-n">{WORKFLOWS_SUMMARY.channelsCount}</span><span className="pf-wf-stat-l">public channels</span></div>
          <div><span className="pf-wf-stat-n">5min</span><span className="pf-wf-stat-l">scheduler tick</span></div>
        </div>
        <p className="pf-wf-summary-blurb">{WORKFLOWS_SUMMARY.blurb}</p>
        <p className="pf-wf-summary-cadence">{WORKFLOWS_SUMMARY.postingCadenceLine}</p>
      </section>

      <section className="pf-wf-channels">
        <h2 className="pf-wf-section-title">Follow the output</h2>
        <ul className="pf-wf-channel-list">
          {CHANNELS.map(c => (
            <li key={c.id}>
              <a
                href={c.href}
                target={c.href.startsWith('/') ? undefined : '_blank'}
                rel={c.href.startsWith('/') ? undefined : 'noopener noreferrer'}
                data-channel-id={c.id}
              >
                <span className="pf-wf-channel-text">
                  <span className="pf-wf-channel-label">{c.label}</span>
                  <span className="pf-wf-channel-handle">{c.handle}</span>
                </span>
                <span className="pf-wf-channel-cta">{c.kind === 'blog' ? 'Read →' : 'Follow →'}</span>
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
              <th>Where to see it</th>
            </tr>
          </thead>
          <tbody>
            {WORKFLOWS.map(w => (
              <tr key={w.id}>
                <td className="pf-name">{w.name}</td>
                <td className="pf-mono" style={{ color: 'var(--pf-ink-2)', whiteSpace: 'nowrap' }}>{w.cadence}</td>
                <td style={{ color: 'var(--pf-ink-2)' }}>{w.desc}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  {w.output ? (
                    <a
                      className="pf-wf-output-link"
                      href={w.output.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-workflow-id={w.id}
                    >
                      {w.output.label} →
                    </a>
                  ) : (
                    <span className="pf-mono" style={{ color: 'var(--pf-ink-3)' }}>internal</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
