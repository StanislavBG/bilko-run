import React, { useState, useEffect, useCallback } from 'react';
import { ToolErrorBoundary } from '../components/ErrorBoundary.js';

// HeadlineGrader extracted to ~/Projects/Headline-Grader (static-path sibling at /projects/headline-grader/).
// AdScorer extracted to ~/Projects/Ad-Scorer (static-path sibling at /projects/ad-scorer/).
const ThreadGraderPage = React.lazy(() => import('./ThreadGraderPage.js').then(m => ({ default: m.ThreadGraderPage })));
const EmailForgePage = React.lazy(() => import('./EmailForgePage.js').then(m => ({ default: m.EmailForgePage })));
const AudienceDecoderPage = React.lazy(() => import('./AudienceDecoderPage.js').then(m => ({ default: m.AudienceDecoderPage })));

interface Tab {
  id: string;
  label: string;
}

const TABS: Tab[] = [
  // HeadlineGrader is now a sibling app — link out instead of rendering inline.
  // AdScorer is now a sibling app — link out instead of rendering inline.
  { id: 'thread-grader', label: 'Threads' },
  { id: 'email-forge', label: 'Email' },
  { id: 'audience-decoder', label: 'Audience' },
];

function getTabFromHash(): string {
  const hash = window.location.hash.replace('#', '');
  const match = TABS.find(t => t.id === hash);
  return match ? match.id : TABS[0].id;
}

export function ContentToolsPage() {
  const [activeTab, setActiveTab] = useState(getTabFromHash);

  useEffect(() => {
    function onHashChange() {
      setActiveTab(getTabFromHash());
    }
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    document.title = 'Content & Copy Tools — bilko.run';
    return () => { document.title = 'Bilko — AI Advisory for Small Business'; };
  }, []);

  const switchTab = useCallback((tabId: string) => {
    setActiveTab(tabId);
    window.history.replaceState(null, '', `#${tabId}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return (
    <>
      {/* Sticky tab bar */}
      <div className="sticky top-16 z-40 bg-warm-50/95 backdrop-blur-md border-b border-warm-200/60 shadow-sm">
        <div className="max-w-6xl mx-auto px-4">
          <nav className="flex gap-1 overflow-x-auto py-2 scrollbar-hide" aria-label="Content tools">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => switchTab(tab.id)}
                className={`px-5 py-2.5 text-sm font-bold rounded-lg whitespace-nowrap transition-all ${
                  activeTab === tab.id
                    ? 'bg-fire-500 text-white shadow-sm shadow-fire-500/20'
                    : 'text-warm-500 hover:text-warm-900 hover:bg-warm-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Tab content — renders the full Page component */}
      <ToolErrorBoundary>
        <React.Suspense fallback={
          <div className="flex items-center justify-center py-32">
            <div className="w-10 h-10 border-4 border-warm-200 border-t-fire-500 rounded-full animate-spin" />
          </div>
        }>
          {activeTab === 'thread-grader' && <ThreadGraderPage />}
          {activeTab === 'email-forge' && <EmailForgePage />}
          {activeTab === 'audience-decoder' && <AudienceDecoderPage />}
        </React.Suspense>
      </ToolErrorBoundary>
    </>
  );
}
