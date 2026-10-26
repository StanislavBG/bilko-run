import type { FastifyInstance } from 'fastify';

/**
 * Serve the projects hub at /projects (no slash) and 301 /projects/ to it.
 * Without this, @fastify/static (redirect: true) sees dist/projects/ and
 * 301s /projects -> /projects/, which gets the SPA shell with no OG meta.
 * The redirect target is a fixed path plus the request's own query string,
 * so it cannot be turned into an open redirect.
 */
export function registerProjectsHubRoutes(app: FastifyInstance, indexHtml: string): void {
  app.get('/projects', async (_req, reply) => {
    reply.header('cache-control', 'private, no-store');
    return reply.type('text/html').send(indexHtml);
  });

  app.get('/projects/', async (req, reply) => {
    const qs = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
    return reply.redirect('/projects' + qs, 301);
  });
}
