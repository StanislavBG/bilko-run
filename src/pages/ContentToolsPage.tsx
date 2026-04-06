import React, { useState, useEffect, useCallback } from 'react';

const HeadlineGraderView = React.lazy(() => import('../views/HeadlineGraderView.js').then(m => ({ default: m.HeadlineGraderView })));
const AdScorerView = React.lazy(() => import('../views/AdScorerView.js').then(m => ({ default: m.AdScorerView })));
const ThreadGraderView = React.lazy(() => import('../views/ThreadGraderView.js').then(m => ({ default: m.ThreadGraderView })));
const EmailForgeView = React.lazy(() => import('../views/EmailForgeView.js').then(m => ({ default: m.EmailForgeView })));
const AudienceDecoderView = React.lazy(() => import('../views/AudienceDecoderView.js'));

interface Tab {
  id: string;
  label: string;
  hash: string;
}

const TABS: Tab[] = [
  { id: 'headline-grader', label: 'HeadlineGrader', hash: '#headline-grader' },
  { id: 'ad-scorer', label: 'AdScorer', hash: '#ad-scorer' },
  { id: 'thread-grader', label: 'ThreadGrader', hash: '#thread-grader' },
  { id: 'email-forge', label: 'EmailForge', hash: '#email-forge' },
  { id: 'audience-decoder', label: 'AudienceDecoder', hash: '#audience-decoder' },
];

function getTabFromHash(): string {
  const hash = window.location.hash.replace('#', '');
  const match = TABS.find(t => t.id === hash);
  return match ? match.id : TABS[0].id;
}

export function ContentToolsPage() {
  const [activeTab, setActiveTab] = useState(getTabFromHash);

  // Sync tab from hash on popstate (back/forward)
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
  }, []);

  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-b from-warm-100/50 to-warm-50 border-b border-warm-200/40">
        <div className="max-w-6xl mx-auto px-6 pt-16 pb-8 md:pt-20 md:pb-10">
          <h1 className="text-3xl md:text-4xl font-extrabold text-warm-900 tracking-tight">
            Content & Copy Tools
          </h1>
          <p className="mt-3 text-lg text-warm-500 max-w-2xl">
            AI-powered analysis for headlines, ads, threads, email sequences, and audience insights.
          </p>
        </div>
      </section>

      {/* Sticky tab bar */}
      <div className="sticky top-16 z-40 bg-warm-50/95 backdrop-blur-sm border-b border-warm-200/60">
        <div className="max-w-6xl mx-auto px-6">
          <nav className="flex gap-1 overflow-x-auto py-2 -mb-px" aria-label="Content tools">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => switchTab(tab.id)}
                className={`px-4 py-2.5 text-sm font-semibold rounded-lg whitespace-nowrap transition-all ${
                  activeTab === tab.id
                    ? 'bg-fire-500 text-white shadow-sm shadow-fire-500/20'
                    : 'text-warm-600 hover:text-warm-900 hover:bg-warm-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Tab content */}
      <div className="min-h-[60vh]">
        <React.Suspense fallback={
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-warm-200 border-t-fire-500 rounded-full animate-spin" />
          </div>
        }>
          {activeTab === 'headline-grader' && <HeadlineGraderView />}
          {activeTab === 'ad-scorer' && <AdScorerView />}
          {activeTab === 'thread-grader' && <ThreadGraderView />}
          {activeTab === 'email-forge' && <EmailForgeView />}
          {activeTab === 'audience-decoder' && <AudienceDecoderView />}
        </React.Suspense>
      </div>
    </>
  );
}
