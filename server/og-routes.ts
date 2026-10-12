import type { FastifyInstance } from 'fastify';
import { injectOgMeta, resolveOg, type OgContext } from './og-meta.js';
import { renderOgCard } from './og-image.js';

const OG_FILE_RE = /^([a-z0-9-]+)\.png$/;

export function registerOgRoutes(app: FastifyInstance, ctx: OgContext): void {
  app.get<{ Params: { file: string } }>('/og/:file', async (req, reply) => {
    const m = OG_FILE_RE.exec(req.params.file);
    if (!m) return reply.status(404).type('text/plain').send('Not found');
    const slug = m[1];

    let png: Buffer;
    if (slug === 'default') {
      const site = resolveOg('/', ctx)!;
      png = renderOgCard({ title: 'bilko.run', tagline: site.description, urlLabel: 'bilko.run' });
    } else {
      const p = ctx.projects.find(x => x.slug === slug);
      if (!p) return reply.status(404).type('text/plain').send('Not found');
      png = renderOgCard({
        title: p.displayName ?? p.name,
        tagline: p.tagline,
        category: p.category,
        urlLabel: `bilko.run/projects/${slug}`,
      });
    }
    reply.header('cache-control', 'public, max-age=86400');
    return reply.type('image/png').send(png);
  });

  // Registered right after the security-headers hook: by now HTML payloads
  // (including former streams) are strings and carry the CSP nonce.
  app.addHook('onSend', async (req, reply, payload) => {
    const ctype = String(reply.getHeader('content-type') ?? '');
    if (!ctype.startsWith('text/html')) return payload;
    if (/^\s*attachment\b/i.test(String(reply.getHeader('content-disposition') ?? ''))) return payload;
    if (typeof payload !== 'string' && !Buffer.isBuffer(payload)) return payload;
    const [path, qs = ''] = req.url.split('?', 2);
    let meta = null;
    for (const resolve of ctx.dynamic ?? []) {
      try {
        meta = await resolve(path, new URLSearchParams(qs));
      } catch (err) {
        req.log.warn({ err }, 'og: dynamic resolver failed; using static meta');
      }
      if (meta) break;
    }
    meta ??= resolveOg(path, ctx);
    if (!meta) return payload;
    reply.removeHeader('content-length');
    return injectOgMeta(typeof payload === 'string' ? payload : payload.toString('utf-8'), meta);
  });
}
