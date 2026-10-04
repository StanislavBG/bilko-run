import { useEffect } from 'react';
import { PageHeader } from '../components/portfolio/PageHeader.js';
import { CHANNELS } from '../data/portfolio.js';
import {
  WORKFLOW_GROUPS, WORKFLOW_STATS, WORKFLOWS_GENERATED_AT, ON_DEMAND_PROJECTS,
} from '../data/workflowsView.js';

function isLocal(href: string): boolean {
  return href.startsWith('/');
}

export function WorkflowsPage() {
  useEffect(() => {
    document.title = 'Workflows — Bilko';
  }, []);

  const updated = new Date(WORKFLOWS_GENERATED_AT).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/Los_Angeles',
  });

  return (
    <div className="pf-page">
      <PageHeader
        eyebrow="Section 07 · Background"
        title="Workflows."
        lede="The jobs that run without anyone pressing a button. Behind the projects on /projects is one local machine running a scheduler, a trader, social pipelines, and the watchdogs that keep them honest."
        what="Read straight from the machine's real crontab and timers, grouped by project. Private jobs are left out."
      />

      <section className="pf-wf-summary">
        <div className="pf-wf-summary-stats">
          <div><span className="pf-wf-stat-n">{WORKFLOW_STATS.jobCount}</span><span className="pf-wf-stat-l">scheduled jobs</span></div>
          <div><span className="pf-wf-stat-n">{WORKFLOW_STATS.projectCount}</span><span className="pf-wf-stat-l">projects automated</span></div>
          {WORKFLOW_STATS.fastest && (
            <div><span className="pf-wf-stat-n">{WORKFLOW_STATS.fastest}</span><span className="pf-wf-stat-l">fastest cadence</span></div>
          )}
          <div><span className="pf-wf-stat-n">{CHANNELS.length}</span><span className="pf-wf-stat-l">public channels</span></div>
        </div>
        <p className="pf-wf-summary-cadence">Synced from the machine {updated}</p>
      </section>

      {WORKFLOW_GROUPS.map(g => (
        <section key={g.slug} className="pf-wf-group" data-workflow-group={g.slug}>
          <h2 className="pf-wf-section-title pf-wf-group-title">
            {g.href ? <a href={g.href}>{g.name} →</a> : <span>{g.name}</span>}
            <span>{g.jobs.length} {g.jobs.length === 1 ? 'job' : 'jobs'}</span>
          </h2>
          <p className="pf-wf-mechanics">{g.mechanics}</p>
          <table className="pf-wf-table">
            <thead>
              <tr>
                <th>Job</th>
                <th>When</th>
                <th>What it does</th>
                <th>Where to see it</th>
              </tr>
            </thead>
            <tbody>
              {g.jobs.map(j => (
                <tr key={j.id} data-workflow-id={j.id}>
                  <td className="pf-name">{j.name}</td>
                  <td className="pf-wf-cadence">
                    {j.cadence.map(c => <div key={c}>{c}</div>)}
                  </td>
                  <td style={{ color: 'var(--pf-ink-2)' }}>{j.desc}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {j.output ? (
                      <a
                        className="pf-wf-output-link"
                        href={j.output.href}
                        target={isLocal(j.output.href) ? undefined : '_blank'}
                        rel={isLocal(j.output.href) ? undefined : 'noopener noreferrer'}
                      >
                        {j.output.label} →
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
      ))}

      {ON_DEMAND_PROJECTS.length > 0 && (
        <p className="pf-wf-on-demand">
          {ON_DEMAND_PROJECTS.map((p, i) => (
            <span key={p.slug}>
              {i > 0 && (i === ON_DEMAND_PROJECTS.length - 1 ? ' and ' : ', ')}
              {p.href ? <a href={p.href}>{p.name}</a> : p.name}
            </span>
          ))}
          {' '}have no recurring jobs of their own. They change only when a new build ships.
        </p>
      )}

      <section className="pf-wf-channels">
        <h2 className="pf-wf-section-title">Follow the output</h2>
        <ul className="pf-wf-channel-list">
          {CHANNELS.map(c => (
            <li key={c.id}>
              <a
                href={c.href}
                target={isLocal(c.href) ? undefined : '_blank'}
                rel={isLocal(c.href) ? undefined : 'noopener noreferrer'}
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
    </div>
  );
}
