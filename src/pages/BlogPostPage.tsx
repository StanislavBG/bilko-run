import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';

const API = import.meta.env.VITE_API_URL || '/api';

interface FullPost {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  category: string;
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

export function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<FullPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    fetch(`${API}/blog/${slug}`).then(r => {
      if (!r.ok) { setNotFound(true); setLoading(false); return null; }
      return r.json();
    }).then(d => {
      if (d) { setPost(d); document.title = `${d.title} — bilko.run`; }
    }).catch(() => setNotFound(true)).finally(() => setLoading(false));
    return () => { document.title = 'Bilko.run — Tools for Makers Who Ship'; };
  }, [slug]);

  if (loading) return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="h-5 w-5 rounded-full border-2 border-fire-500 border-t-transparent animate-spin" />
    </div>
  );

  if (notFound || !post) return (
    <div className="max-w-2xl mx-auto px-6 py-20 text-center">
      <h1 className="text-2xl font-black text-warm-900 mb-2">Post not found</h1>
      <p className="text-warm-500 mb-4">This post doesn't exist or hasn't been published yet.</p>
      <Link to="/blog" className="text-fire-500 hover:text-fire-600 font-semibold">Back to blog &rarr;</Link>
    </div>
  );

  const cat = CATEGORY_LABELS[post.category] ?? { label: post.category, color: 'bg-warm-100 text-warm-600' };

  // Render markdown-like content as HTML (simple parser for paragraphs, headings, bold, links, code)
  function renderContent(text: string) {
    return text.split('\n\n').map((block, i) => {
      const trimmed = block.trim();
      if (!trimmed) return null;

      // Headings
      if (trimmed.startsWith('## ')) return <h2 key={i} className="text-xl font-extrabold text-warm-900 mt-8 mb-3">{trimmed.slice(3)}</h2>;
      if (trimmed.startsWith('### ')) return <h3 key={i} className="text-lg font-bold text-warm-900 mt-6 mb-2">{trimmed.slice(4)}</h3>;

      // Code blocks
      if (trimmed.startsWith('```')) {
        const lines = trimmed.split('\n');
        const code = lines.slice(1, lines.length - 1).join('\n');
        return <pre key={i} className="bg-warm-900 text-warm-100 rounded-xl p-4 overflow-x-auto text-sm my-4 font-mono">{code}</pre>;
      }

      // Bullet lists
      if (trimmed.split('\n').every(l => l.startsWith('- '))) {
        return (
          <ul key={i} className="space-y-1 my-3 pl-4">
            {trimmed.split('\n').map((l, j) => (
              <li key={j} className="text-warm-600 leading-relaxed text-sm list-disc">{renderInline(l.slice(2))}</li>
            ))}
          </ul>
        );
      }

      // Regular paragraph
      return <p key={i} className="text-warm-600 leading-relaxed text-[15px] my-3">{renderInline(trimmed)}</p>;
    });
  }

  function renderInline(text: string): React.ReactNode {
    // Bold
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-bold text-warm-800">{part.slice(2, -2)}</strong>;
      }
      // Inline code
      const codeParts = part.split(/(`[^`]+`)/g);
      return codeParts.map((cp, j) => {
        if (cp.startsWith('`') && cp.endsWith('`')) {
          return <code key={`${i}-${j}`} className="bg-warm-100 text-fire-700 px-1.5 py-0.5 rounded text-sm font-mono">{cp.slice(1, -1)}</code>;
        }
        return cp;
      });
    });
  }

  const shareText = `${post.title}\n\nhttps://bilko.run/blog/${post.slug}`;

  return (
    <article className="max-w-2xl mx-auto px-6 pb-16">
      {/* Breadcrumb */}
      <div className="pt-8 pb-4">
        <Link to="/blog" className="text-sm text-warm-400 hover:text-fire-500 transition-colors">&larr; Back to blog</Link>
      </div>

      {/* Header */}
      <header className="pb-8 border-b border-warm-200/40">
        <div className="flex items-center gap-2 mb-4">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cat.color}`}>{cat.label}</span>
          <span className="text-xs text-warm-400">{formatDate(post.published_at)}</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-black text-warm-900 tracking-tight leading-tight">
          {post.title}
        </h1>
        <p className="mt-3 text-warm-500 leading-relaxed">{post.excerpt}</p>
      </header>

      {/* Content */}
      <div className="pt-8">
        {renderContent(post.content)}
      </div>

      {/* Share + CTA */}
      <div className="mt-12 pt-8 border-t border-warm-200/40">
        <div className="flex flex-wrap gap-3 mb-8">
          <button onClick={() => window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(shareText)}`, '_blank', 'width=550,height=420')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-warm-900 hover:bg-warm-800 text-white text-sm font-semibold rounded-lg transition-colors">
            Share on X
          </button>
          <button onClick={() => window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(`https://bilko.run/blog/${post.slug}`)}`, '_blank')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#0077B5] hover:bg-[#006299] text-white text-sm font-semibold rounded-lg transition-colors">
            Share on LinkedIn
          </button>
        </div>

        <div className="bg-warm-50 rounded-2xl border border-warm-200/60 p-6 text-center">
          <p className="text-warm-900 font-bold mb-2">Want to try the tools?</p>
          <p className="text-sm text-warm-500 mb-4">Everything mentioned in this post is live and free to start.</p>
          <Link to="/projects" className="inline-flex items-center gap-2 px-6 py-3 bg-fire-500 hover:bg-fire-600 text-white font-bold rounded-xl transition-all">
            View All Tools
          </Link>
        </div>
      </div>
    </article>
  );
}
