import type { FastifyInstance } from 'fastify';
import { dbGet, dbAll, dbRun } from '../db.js';
import { requireAdmin } from '../clerk.js';

export function registerBlogRoutes(app: FastifyInstance): void {
  // Public: list published posts
  app.get('/api/blog', async () => {
    return dbAll(
      'SELECT id, slug, title, excerpt, category, cover_image, published_at FROM blog_posts WHERE published = 1 ORDER BY published_at DESC',
    );
  });

  // Public: get single post by slug
  app.get('/api/blog/:slug', async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const post = await dbGet(
      'SELECT * FROM blog_posts WHERE slug = ? AND published = 1', slug,
    );
    if (!post) { reply.status(404); return { error: 'Post not found' }; }
    return post;
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
    return { ok: true };
  });
}
