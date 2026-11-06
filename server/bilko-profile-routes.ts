import type { FastifyInstance } from 'fastify';
import { BOOKING_PAGE_PRERENDER_HTML } from '../shared/booking-page.js';

const START = '<!--bilko-prerender-->';
const END = '<!--/bilko-prerender-->';

/** Same marker swap for the /book page. */
export function renderBookingPageShell(indexHtml: string): string {
  return injectPrerender(indexHtml, BOOKING_PAGE_PRERENDER_HTML);
}

function injectPrerender(indexHtml: string, block: string): string {
  const a = indexHtml.indexOf(START);
  const b = indexHtml.indexOf(END);
  if (a === -1 || b === -1 || b < a) {
    console.error('bilko-profile: prerender markers missing from index.html; serving the shell unchanged');
    return indexHtml;
  }
  return indexHtml.slice(0, a) + block + indexHtml.slice(b + END.length);
}

/**
 * Serve /book with the booking copy already in the HTML, and 301 the retired Hire
 * paths (/bilko, /hire, /human-for-hire, /projects/human-for-hire/...) to it. The
 * redirect target is a fixed path plus the request's own query string, so it cannot
 * become an open redirect.
 */
export function registerBilkoProfileRoutes(app: FastifyInstance, indexHtml: string): void {
  const bookHtml = renderBookingPageShell(indexHtml);

  for (const path of ['/book', '/book/']) {
    app.get(path, async (_req, reply) => {
      reply.header('cache-control', 'private, no-store');
      return reply.type('text/html').send(bookHtml);
    });
  }

  for (const path of [
    '/bilko',
    '/bilko/',
    '/hire',
    '/hire/',
    '/human-for-hire',
    '/human-for-hire/',
    '/projects/human-for-hire',
    '/projects/human-for-hire/',
    '/projects/human-for-hire/thanks',
    '/projects/human-for-hire/thanks/',
  ]) {
    app.get(path, async (req, reply) => {
      const qs = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
      return reply.redirect('/book' + qs, 301);
    });
  }
}
