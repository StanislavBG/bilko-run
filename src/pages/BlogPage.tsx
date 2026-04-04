import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const API = import.meta.env.VITE_API_URL || '/api';

interface BlogPost {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  cover_image: string | null;
  published_at: string;
}

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  'build-log': { label: 'Build Log', color: 'bg-fire-100 text-fire-700' },
  'lessons': { label: 'Lessons', color: 'bg-blue-100 text-blue-700' },
  'deep-dive': { label: 'Deep Dive', color: 'bg-purple-100 text-purple-700' },
  'market': { label: 'Market', color: 'bg-green-100 text-green-700' },
  'product': { label: 'Product', color: 'bg-yellow-100 text-yellow-700' },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export function BlogPage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = 'Blog — bilko.run';
    fetch(`${API}/blog`).then(r => r.json()).then(d => {
      if (Array.isArray(d)) setPosts(d);
    }).catch(() => {}).finally(() => setLoading(false));
    return () => { document.title = 'Bilko.run — Tools for Makers Who Ship'; };
  }, []);

  return (
    <article className="max-w-2xl mx-auto px-6">
      {/* Hero */}
      <header className="pt-16 pb-10 md:pt-24 md:pb-14">
        <h1 className="text-3xl md:text-4xl font-black text-warm-900 tracking-tight animate-slide-up">
          Building in public.
          <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-fire-500 to-fire-600">
            Learning out loud.
          </span>
        </h1>
        <p className="mt-4 text-lg text-warm-600 leading-relaxed animate-slide-up" style={{ animationDelay: '60ms' }}>
          Lessons from building 7 AI tools solo. Build logs, technical deep dives,
          honest numbers, and everything I wish someone told me before I started.
        </p>
        <p className="mt-3 text-sm text-warm-400 animate-slide-up" style={{ animationDelay: '120ms' }}>
          New posts weekly &middot; Podcast coming soon &middot; All from the trenches, not the sidelines
        </p>
      </header>

      {/* Announcement Card */}
      <div className="bg-gradient-to-r from-fire-50 to-warm-50 border-2 border-fire-200 rounded-2xl p-6 md:p-8 mb-10 animate-slide-up" style={{ animationDelay: '180ms' }}>
        <div className="flex items-start gap-4">
          <span className="text-2xl flex-shrink-0">📢</span>
          <div>
            <h2 className="text-lg font-black text-warm-900 mb-2">We're starting a blog. And a podcast.</h2>
            <p className="text-sm text-warm-600 leading-relaxed mb-3">
              I've been building bilko.run's tools in relative silence — shipping features,
              fixing bugs, watching numbers. But the most interesting stuff isn't the code.
              It's the decisions. Why I built PageRoast before HeadlineGrader. Why credits
              beat subscriptions. Why one person with AI can build what used to take a team.
            </p>
            <p className="text-sm text-warm-600 leading-relaxed mb-3">
              This blog is where those stories live. Each post becomes a podcast episode —
              same content, different format. Read it or listen to it. Your call.
            </p>
            <p className="text-sm text-warm-700 font-semibold">
              First up: How PageRoast went from "I need feedback on my landing page" to a
              tool that scores pages across 4 CRO frameworks and roasts them for fun.
            </p>
          </div>
        </div>
      </div>

      {/* Posts */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="h-5 w-5 rounded-full border-2 border-fire-500 border-t-transparent animate-spin" />
          <span className="ml-3 text-sm text-warm-500">Loading posts...</span>
        </div>
      )}

      {!loading && posts.length > 0 && (
        <div className="space-y-6 mb-16 stagger-children">
          {posts.map(post => {
            const cat = CATEGORY_LABELS[post.category] ?? { label: post.category, color: 'bg-warm-100 text-warm-600' };
            return (
              <Link key={post.slug} to={`/blog/${post.slug}`}
                className="group block bg-white rounded-2xl border border-warm-200/60 p-6 hover:border-fire-300 hover:shadow-lg hover:shadow-fire-100/30 hover:-translate-y-0.5 transition-all">
                <div className="flex items-center gap-2 mb-3">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cat.color}`}>{cat.label}</span>
                  <span className="text-xs text-warm-400">{formatDate(post.published_at)}</span>
                </div>
                <h2 className="text-lg font-bold text-warm-900 group-hover:text-fire-600 transition-colors mb-2">
                  {post.title}
                </h2>
                <p className="text-sm text-warm-600 leading-relaxed line-clamp-3">{post.excerpt}</p>
                <p className="mt-3 text-sm font-semibold text-fire-500 group-hover:text-fire-600">
                  Read more &rarr;
                </p>
              </Link>
            );
          })}
        </div>
      )}

      {!loading && posts.length === 0 && (
        <div className="text-center py-12">
          <p className="text-warm-500 mb-2">First post dropping soon.</p>
          <p className="text-sm text-warm-400">Follow on <a href="https://x.com/BilkoBibitkov" target="_blank" rel="noopener noreferrer" className="text-fire-500 hover:underline">X</a> or <a href="https://www.linkedin.com/in/bilko-bibitkov-23b5b13b1/" target="_blank" rel="noopener noreferrer" className="text-fire-500 hover:underline">LinkedIn</a> to get notified.</p>
        </div>
      )}

      {/* What to expect */}
      <section className="border-t border-warm-200/40 py-12 mb-8">
        <h2 className="text-xl font-extrabold text-warm-900 mb-6">What you'll find here</h2>
        <div className="grid grid-cols-2 gap-4">
          {[
            { icon: '🔨', label: 'Build Logs', desc: 'What we shipped, real numbers, what broke' },
            { icon: '💡', label: 'Lessons', desc: 'Insights from building solo with AI' },
            { icon: '🔬', label: 'Deep Dives', desc: 'How things work under the hood' },
            { icon: '📊', label: 'Market Intel', desc: 'Competitor analysis, trends, positioning' },
          ].map(({ icon, label, desc }) => (
            <div key={label} className="bg-warm-50 rounded-xl p-4 border border-warm-100">
              <span className="text-lg">{icon}</span>
              <h3 className="font-bold text-warm-800 text-sm mt-1">{label}</h3>
              <p className="text-xs text-warm-500 mt-0.5">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Newsletter signup */}
      <section className="border-t border-warm-200/40 py-12 mb-8">
        <div className="bg-gradient-to-r from-fire-50 to-warm-50 rounded-2xl border border-fire-200 p-6 text-center">
          <h3 className="text-lg font-black text-warm-900 mb-2">Get new posts in your inbox</h3>
          <p className="text-sm text-warm-600 mb-4">Weekly lessons from building AI tools solo. No spam. Unsubscribe anytime.</p>
          <form onSubmit={(e) => {
            e.preventDefault();
            const input = (e.target as HTMLFormElement).querySelector('input');
            const email = input?.value?.trim();
            if (!email) return;
            fetch(`${API}/demos/email-capture`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, tool: 'blog-newsletter', score: '', source: 'blog' }),
            }).catch(() => {});
            input!.value = '';
            alert('Subscribed! You\'ll get new posts weekly.');
          }} className="flex gap-2 max-w-sm mx-auto">
            <input type="email" placeholder="you@example.com" required
              className="flex-1 px-4 py-2.5 rounded-xl border border-warm-200 text-sm focus:outline-none focus:ring-2 focus:ring-fire-400" />
            <button type="submit" className="px-5 py-2.5 bg-fire-500 hover:bg-fire-600 text-white font-bold text-sm rounded-xl transition-colors">
              Subscribe
            </button>
          </form>
          <p className="text-xs text-warm-400 mt-2">Join the builders. No marketing fluff.</p>
        </div>
      </section>

      {/* Podcast teaser */}
      <section className="border-t border-warm-200/40 py-12 mb-8">
        <div className="bg-warm-900 rounded-2xl p-6 text-center">
          <span className="text-2xl">🎙️</span>
          <h3 className="text-lg font-black text-white mt-2">Podcast coming soon</h3>
          <p className="text-sm text-warm-400 mt-1 max-w-md mx-auto">
            Every blog post becomes a podcast episode. Same insights, different format.
            Subscribe once it launches — or just keep reading.
          </p>
        </div>
      </section>
    </article>
  );
}
