import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/portfolio/PageHeader.js';

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

const CATEGORY_LABELS: Record<string, string> = {
  'build-log': 'Build Log',
  'lessons': 'Lessons',
  'deep-dive': 'Deep Dive',
  'market': 'Market',
  'product': 'Product',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function estimateReadTime(excerpt: string): string {
  const words = (excerpt || '').split(/\s+/).length;
  const minutes = Math.max(3, Math.round(words / 60));
  return `${minutes} min`;
}

export function BlogPage() {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = 'Blog — Bilko Bibitkov';
    fetch(`${API}/blog`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setPosts(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="pf-page">
      <PageHeader
        eyebrow="Section 04 · Writing"
        title="Blog."
        lede="Notes from the workshop — half-finished thoughts on AI, craft, and what shipping actually feels like."
        what="A reverse-chronological feed of essays. Click a row to read. New posts roughly weekly."
      />

      {loading && (
        <div className="pf-mono" style={{ padding: '32px 0', color: 'var(--pf-ink-3)' }}>Loading posts…</div>
      )}

      {!loading && posts.length > 0 && (
        <div className="pf-post-list">
          {posts.map(post => (
            <div key={post.slug} className="pf-post-row" onClick={() => navigate(`/blog/${post.slug}`)}>
              <div className="pf-date">{formatDate(post.published_at)}</div>
              <div className="pf-title">
                {post.title}
                <span className="pf-arrow">→</span>
              </div>
              <div className="pf-tag">{CATEGORY_LABELS[post.category] ?? post.category}</div>
              <div className="pf-read">{estimateReadTime(post.excerpt)}</div>
            </div>
          ))}
        </div>
      )}

      {!loading && posts.length === 0 && (
        <div className="pf-mono" style={{ padding: '32px 0', color: 'var(--pf-ink-3)' }}>
          First post dropping soon.
        </div>
      )}
    </div>
  );
}
