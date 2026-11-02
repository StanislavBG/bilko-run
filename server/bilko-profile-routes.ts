import type { FastifyInstance } from 'fastify';
import { BILKO_PROFILE_BOTTOM_HTML, BILKO_PROFILE_TOP_HTML } from '../shared/bilko-profile.js';

const START = '<!--bilko-prerender-->';
const END = '<!--/bilko-prerender-->';

/** Swap the loading placeholder between the prerender markers for the approved profile copy. */
export function renderBilkoProfileShell(indexHtml: string): string {
  const a = indexHtml.indexOf(START);
  const b = indexHtml.indexOf(END);
  if (a === -1 || b === -1 || b < a) {
    console.error('bilko-profile: prerender markers missing from index.html; serving the shell unchanged');
    return indexHtml;
  }
  const block = `<div class="bilko-profile">${BILKO_PROFILE_TOP_HTML}${BILKO_PROFILE_BOTTOM_HTML}</div>`;
  return indexHtml.slice(0, a) + block + indexHtml.slice(b + END.length);
}

/**
 * Serve /bilko (and aliases) with the copy already in the HTML, and 301 the old
 * /projects/human-for-hire paths to it. Redirect target is a fixed path plus the
 * request's own query string, so it cannot become an open redirect.
 */
export function registerBilkoProfileRoutes(app: FastifyInstance, indexHtml: string): void {
  const html = renderBilkoProfileShell(indexHtml);

  for (const path of ['/bilko', '/hire', '/human-for-hire']) {
    app.get(path, async (_req, reply) => {
      reply.header('cache-control', 'private, no-store');
      return reply.type('text/html').send(html);
    });
  }

  for (const path of [
    '/projects/human-for-hire',
    '/projects/human-for-hire/',
    '/projects/human-for-hire/thanks',
    '/projects/human-for-hire/thanks/',
  ]) {
    app.get(path, async (req, reply) => {
      const qs = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
      return reply.redirect('/bilko' + qs, 301);
    });
  }
}
