import { useEffect } from 'react';

// All 5 content tools (HeadlineGrader, AdScorer, ThreadGrader, EmailForge, AudienceDecoder) extracted to
// static-path siblings under /projects/<slug>/. This page now redirects to the projects listing.
export function ContentToolsPage() {
  useEffect(() => {
    window.location.replace('/projects');
  }, []);
  return null;
}
