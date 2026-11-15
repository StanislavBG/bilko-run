import { createHash } from 'crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { injectOgMeta, resolveOg, type OgContext } from './og-meta.js';
import { buildOfferJsonLd, hasProductJsonLd, injectJsonLd, offersForPath } from './offer-jsonld.js';
import { availableOffers } from './services/offer-availability.js';
import { renderOgCard } from './og-image.js';
import { readProjectPng } from './og-assets.js';

const SHARE_MAX_BYTES = 5 * 1024 * 1024;
const ICON_MAX_BYTES = 512 * 1024;

const OG_FILE_RE = /^([a-z0-9-]+)\.png$/;

type OgRoute = { Params: { file: string }; Querystring: { v?: string } };

/** True when an If-None-Match header (exact, W/ weak form, comma list, or *) matches the strong tag. */
export function ifNoneMatch(header: string | string[] | undefined, etag: string): boolean {
  if (!header) return false;
  const raw = Array.isArray(header) ? header.join(',') : header;
  return raw.split(',').some(part => {
    const t = part.trim();
    return t === '*' || t.replace(/^W\//, '') === etag;
  });
}

function sendPng(req: FastifyRequest<OgRoute>, reply: FastifyReply, bytes: Buffer) {
  const etag = `"${createHash('sha1').update(bytes).digest('hex').slice(0, 16)}"`;
  const v = req.query?.v;
  reply.header('etag', etag);
  reply.header('cache-control', typeof v === 'string' && v.length > 0 ? 'public, max-age=86400' : 'public, max-age=300');
  if (ifNoneMatch(req.headers['if-none-match'], etag)) return reply.code(304).send();
  return reply.type('image/png').send(bytes);
}

export function registerOgRoutes(app: FastifyInstance, ctx: OgContext): void {
  app.get<OgRoute>('/og/:file', async (req, reply) => {
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
      if (p.shareImage && ctx.staticRoot) {
        const asset = readProjectPng(ctx.staticRoot, slug, p.shareImage, SHARE_MAX_BYTES);
        if (asset && asset.width === 1200 && asset.height === 630) {
          return sendPng(req, reply, asset.bytes);
        }
        req.log.warn(
          `og: shareImage for ${slug} unusable (${asset ? `${asset.width}x${asset.height}, need 1200x630` : 'missing, oversize, escaped or not a PNG'}); using generated card`,
        );
      }
      let iconPng: Buffer | undefined;
      if (p.icon && ctx.staticRoot) {
        const icon = readProjectPng(ctx.staticRoot, slug, p.icon, ICON_MAX_BYTES);
        if (icon && icon.width === icon.height && icon.width >= 128 && icon.width <= 1024) iconPng = icon.bytes;
      }
      png = renderOgCard({
        iconPng,
        title: p.displayName ?? p.name,
        tagline: p.tagline,
        category: p.category,
        urlLabel: `bilko.run/projects/${slug}`,
      });
    }
    return sendPng(req, reply, png);
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
    const onPage = offersForPath(path);
    const offers = onPage.length ? await availableOffers(onPage) : onPage;
    if (!meta && !offers.length) return payload;
    let html = typeof payload === 'string' ? payload : payload.toString('utf-8');
    if (meta) html = injectOgMeta(html, meta);
    if (offers.length && !hasProductJsonLd(html)) html = injectJsonLd(html, buildOfferJsonLd(offers));
    reply.removeHeader('content-length');
    return html;
  });
}
