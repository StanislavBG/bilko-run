import type { FastifyInstance } from 'fastify';
import { dbGet, dbAll, dbRun } from '../db.js';
import { requireAdmin } from '../clerk.js';
import { join } from 'node:path';
import { blogVideoUrl, scanBlogVideos } from '../blog-videos.js';

export function registerBlogRoutes(app: FastifyInstance, opts: { videosRoot?: string } = {}): void {
  // Videos only change on deploy, so scan once at boot.
  const videoSlugs = scanBlogVideos(opts.videosRoot ?? join(process.cwd(), 'public', 'blog-videos'));

  // Public list memo: key = normalized query string. Entries expire after 60 s or at the
  // next scheduled post's publish time, whichever is sooner. Admin writes clear it.
  const LIST_TTL_MS = 60_000;
  const listMemo = new Map<string, { expiresAt: number; body: unknown }>();
  let memoGeneration = 0;
  const invalidateListMemo = (): void => { memoGeneration++; listMemo.clear(); };

  // Public: list published posts
  app.get('/api/blog', async (req, reply) => {
    const key = (req.url.split('?')[1] ?? '').split('&').filter(Boolean).sort().join('&');
    reply.header('Cache-Control', 'public, max-age=60');
    const hit = listMemo.get(key);
    if (hit && hit.expiresAt > Date.now()) return hit.body;

    const generation = memoGeneration;
    const rows = await dbAll<{ slug: string }>(
      "SELECT id, slug, title, excerpt, category, cover_image, published_at FROM blog_posts WHERE published = 1 AND datetime(published_at) <= datetime('now') ORDER BY published_at DESC",
    );
    const next = await dbGet<{ next_at: string | null }>(
      "SELECT MIN(published_at) AS next_at FROM blog_posts WHERE published = 1 AND datetime(published_at) > datetime('now')",
    );
    const body = rows.map(row => ({ ...row, video_url: blogVideoUrl(row.slug, videoSlugs) }));

    let expiresAt = Date.now() + LIST_TTL_MS;
    const nextAt = next?.next_at ? Date.parse(next.next_at) : NaN;
    if (Number.isFinite(nextAt)) expiresAt = Math.min(expiresAt, nextAt);
    if (generation === memoGeneration) listMemo.set(key, { expiresAt, body });
    return body;
  });

  // Public: get single post by slug
  app.get('/api/blog/:slug', async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const post = await dbGet(
      "SELECT * FROM blog_posts WHERE slug = ? AND published = 1 AND datetime(published_at) <= datetime('now')", slug,
    );
    if (!post) { reply.status(404); return { error: 'Post not found' }; }
    return { ...post, video_url: blogVideoUrl(slug, videoSlugs) };
  });

  // Admin: list all posts (including drafts)
  app.get('/api/blog/admin/all', async (req, reply) => {
    if (!await requireAdmin(req, reply)) return;
    return dbAll('SELECT * FROM blog_posts ORDER BY created_at DESC');
  });

  // Admin: create post
  app.post('/api/blog/admin/create', async (req, reply) => {
    if (!await requireAdmin(req, reply)) return;
    const body = req.body as any;
    const { slug, title, excerpt, content, category, cover_image, published } = body;
    if (!slug || !title || !content) {
      reply.status(400);
      return { error: 'slug, title, and content are required' };
    }
    const result = await dbRun(
      `INSERT INTO blog_posts (slug, title, excerpt, content, category, cover_image, published, published_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      slug, title, excerpt ?? '', content, category ?? 'build-log', cover_image ?? null,
      published ? 1 : 0, published ? new Date().toISOString() : null,
    );
    invalidateListMemo();
    return { id: result.lastInsertRowid, slug };
  });

  // Admin: update post
  app.put('/api/blog/admin/:id', async (req, reply) => {
    if (!await requireAdmin(req, reply)) return;
    const { id } = req.params as { id: string };
    const numericId = parseInt(id, 10);
    if (!Number.isFinite(numericId) || numericId < 1) {
      reply.status(400);
      return { error: 'Invalid post id' };
    }
    const body = req.body as any;
    const { title, excerpt, content, category, cover_image, published } = body;
    await dbRun(
      `UPDATE blog_posts SET title = ?, excerpt = ?, content = ?, category = ?, cover_image = ?,
       published = ?, published_at = CASE WHEN ? = 1 AND published_at IS NULL THEN ? ELSE published_at END,
       updated_at = ? WHERE id = ?`,
      title, excerpt, content, category, cover_image,
      published ? 1 : 0, published ? 1 : 0, new Date().toISOString(),
      new Date().toISOString(), numericId,
    );
    invalidateListMemo();
    return { ok: true };
  });
}
