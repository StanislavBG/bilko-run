import { useEffect } from 'react';
import { PageHeader } from '../components/portfolio/PageHeader.js';
import { WORKFLOWS } from '../data/portfolio.js';

export function WorkflowsPage() {
  useEffect(() => {
    document.title = 'Workflows — Bilko';
  }, []);

  return (
    <div className="pf-page">
      <PageHeader
        eyebrow="Section 07 · Background"
        title="Workflows."
        lede="The agents that don't sleep. n8n-orchestrated jobs running content pipelines, audits, social posting, and image processing."
        what="A live status board for what's running in the background. Public so you can see when a job is broken or behind."
      />
      <table className="pf-wf-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Status</th>
            <th>Last run</th>
            <th style={{ textAlign: 'right' }}>Total runs</th>
          </tr>
        </thead>
        <tbody>
          {WORKFLOWS.map(w => (
            <tr key={w.id}>
              <td className="pf-name">{w.name}</td>
              <td><span className={`pf-wf-status ${w.status}`}><span className="pf-d"></span>{w.status}</span></td>
              <td className="pf-mono" style={{ color: 'var(--pf-ink-2)' }}>{w.lastRun}</td>
              <td className="pf-mono" style={{ textAlign: 'right', color: 'var(--pf-ink-2)' }}>{w.runs}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
