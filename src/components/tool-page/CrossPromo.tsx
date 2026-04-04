import { Link } from 'react-router-dom';

interface Promo { slug: string; name: string; hook: string; }

const PROMOS: Record<string, Promo[]> = {
  'page-roast': [
    { slug: 'headline-grader', name: 'HeadlineGrader', hook: 'Roasted your page? Now grade the headline that\'s selling it.' },
    { slug: 'ad-scorer', name: 'AdScorer', hook: 'Fixed your page? Score the ad that\'s driving traffic to it.' },
  ],
  'headline-grader': [
    { slug: 'page-roast', name: 'PageRoast', hook: 'Great headline. Now roast the page it lives on.' },
    { slug: 'thread-grader', name: 'ThreadGrader', hook: 'Headlines are hooks. Test yours in a full thread.' },
  ],
  'ad-scorer': [
    { slug: 'page-roast', name: 'PageRoast', hook: 'Ad scored. Now roast the landing page it sends people to.' },
    { slug: 'email-forge', name: 'EmailForge', hook: 'Ads drive clicks. Emails close deals. Generate your sequence.' },
  ],
  'thread-grader': [
    { slug: 'headline-grader', name: 'HeadlineGrader', hook: 'Thread hooks are headlines. Score them in isolation.' },
    { slug: 'audience-decoder', name: 'AudienceDecoder', hook: 'Know who\'s reading your threads. Decode your audience.' },
  ],
  'email-forge': [
    { slug: 'ad-scorer', name: 'AdScorer', hook: 'Emails done. Now score the ad that fills the top of funnel.' },
    { slug: 'audience-decoder', name: 'AudienceDecoder', hook: 'Know who you\'re emailing. Decode your audience first.' },
  ],
  'audience-decoder': [
    { slug: 'thread-grader', name: 'ThreadGrader', hook: 'Know your audience. Now write threads they\'ll actually share.' },
    { slug: 'email-forge', name: 'EmailForge', hook: 'Know your people. Now write emails they\'ll actually open.' },
  ],
  'stepproof': [
    { slug: 'page-roast', name: 'PageRoast', hook: 'Tests passing? Celebrate by roasting your landing page.' },
    { slug: 'headline-grader', name: 'HeadlineGrader', hook: 'Pipeline works. Now make sure the headline selling it works too.' },
  ],
  'stack-audit': [
    { slug: 'launch-grader', name: 'LaunchGrader', hook: 'Stack optimized. Now audit your launch readiness.' },
    { slug: 'local-score', name: 'LocalScore', hook: 'Need to analyze sensitive contracts? Do it privately in your browser.' },
  ],
  'local-score': [
    { slug: 'stack-audit', name: 'StackAudit', hook: 'Analyzed your docs. Now find waste in your SaaS stack.' },
    { slug: 'page-roast', name: 'PageRoast', hook: 'Documents done. Now roast your landing page.' },
  ],
  'launch-grader': [
    { slug: 'page-roast', name: 'PageRoast', hook: 'Launch readiness checked. Now roast the landing page that sells it.' },
    { slug: 'stack-audit', name: 'StackAudit', hook: 'Ready to launch? Make sure your stack isn\'t bleeding money first.' },
  ],
};

export function CrossPromo({ currentTool }: { currentTool: string }) {
  const promos = PROMOS[currentTool];
  if (!promos || promos.length === 0) return null;

  return (
    <div className="max-w-2xl mx-auto px-6 pb-12">
      <div className="bg-warm-50 rounded-2xl border border-warm-200/60 p-6">
        <h3 className="text-xs font-bold uppercase tracking-widest text-warm-400 mb-4">Next up</h3>
        <div className="space-y-3">
          {promos.map(p => (
            <Link key={p.slug} to={`/projects/${p.slug}`}
              className="group flex items-center gap-3 p-3 rounded-xl border border-warm-200/60 bg-white hover:border-fire-300 hover:shadow-sm transition-all">
              <div className="flex-1 min-w-0">
                <span className="text-sm font-bold text-warm-800 group-hover:text-fire-600 transition-colors">{p.name}</span>
                <p className="text-xs text-warm-500 mt-0.5">{p.hook}</p>
              </div>
              <svg className="w-4 h-4 text-warm-400 group-hover:text-fire-500 group-hover:translate-x-0.5 transition-all flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
