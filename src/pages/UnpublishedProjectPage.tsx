import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { track } from '../lib/telemetry.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import type { Project } from '../data/projectsRegistry.js';

// A registered static-path project whose bundle isn't on the server. Terminal:
// never redirects, so /projects/<slug>/ can't bounce off /products/<slug>.
export function UnpublishedProjectPage({ project }: { project: Project }) {
  const name = project.displayName ?? project.name;
  useDocumentTitle(`${name} isn't published right now — bilko.run`);
  useEffect(() => { track('project_unpublished', { tool: project.slug }); }, [project.slug]);
  return (
    <section className="max-w-2xl mx-auto px-6 py-20 text-center">
      <p className="text-6xl font-black text-warm-200 mb-4">404</p>
      <h1 className="text-2xl font-extrabold text-warm-900 mb-2">{name} isn't published right now</h1>
      <p className="text-warm-500 mb-8">
        {project.status === 'postponed'
          ? "It's on hold for now. Check back later."
          : 'It will be back soon.'}
      </p>
      <Link to="/projects" className="text-fire-500 hover:text-fire-600 font-semibold text-sm">See every project &rarr;</Link>
    </section>
  );
}
