import type { FastifyInstance } from 'fastify';
import { BOOKING_PAGE_PRERENDER_HTML } from '../shared/booking-page.js';
import { SITE_SECTIONS, NOW_ITEMS } from '../shared/site-chrome.js';
import { BILKO_CONTACT_EMAIL } from '../shared/bilko-profile.js';

const START = '<!--bilko-prerender-->';
const END = '<!--/bilko-prerender-->';

function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Static copy of src/components/Layout.tsx's header and bottom bar (signed-out, non-home,
 * no admin chips), so no-JS visitors and crawlers get the site nav and nothing moves when
 * React replaces #root. Keep the nesting and classes in step with Layout.
 */
function siteChrome(activePath: string): { before: string; after: string } {
  const nav = SITE_SECTIONS.filter(s => s.id !== 'home')
    .map((s, i) => {
      const active = s.path === activePath;
      return `<a class="bk-pill-nav${active ? ' active' : ''}" href="${esc(s.path)}"${active ? ' aria-current="page"' : ''} data-track="nav-${esc(s.id)}"><span class="bk-num">${String(i + 1).padStart(2, '0')}</span>${esc(s.label)}</a>`;
    })
    .join('');
  const before =
    '<div class="portfolio-shell">' +
    '<header class="bk-header">' +
    '<a href="/" class="bk-brand"><span class="bk-mark">B</span><span class="bk-brand-name">Bilko Bibitkov</span></a>' +
    `<nav class="bk-nav" aria-label="Primary">${nav}</nav>` +
    '<div class="bk-right">' +
    '<span class="bk-online"><span class="bk-online-dot"></span>Online</span>' +
    '<button class="bk-chip" title="Search (Ctrl K)"><span>Search</span><span style="opacity:0.6">Ctrl K</span></button>' +
    '<button class="bk-chip pf-mobile-trigger" aria-label="Menu"><span>Menu</span></button>' +
    '</div>' +
    '</header>' +
    '<main>';
  const after =
    '</main>' +
    '<footer class="bk-bottombar">' +
    `<div class="bk-bb-left"><span class="bk-bb-label">Currently →</span><span class="bk-bb-now">${esc(NOW_ITEMS[0] ?? '')}</span></div>` +
    '<div class="bk-bb-center">' +
    '<a href="/privacy" data-track="footer-privacy">Privacy</a>' +
    '<a href="/terms" data-track="footer-terms">Terms</a>' +
    '<a href="https://github.com/StanislavBG" target="_blank" rel="noopener noreferrer" data-track="footer-github">GitHub</a>' +
    `<a href="mailto:${esc(BILKO_CONTACT_EMAIL)}" data-track="footer-email">Email</a>` +
    '</div>' +
    '<div class="bk-bb-right">' +
    '<a href="/coffee" data-track="tip-coffee" class="bk-bb-coffee">Buy me a coffee →</a>' +
    '<span class="bk-bb-small"><a href="/privacy" data-track="footer-privacy">Privacy</a><a href="/terms" data-track="footer-terms">Terms</a></span>' +
    '</div>' +
    '</footer>' +
    '</div>';
  return { before, after };
}

const BOOK_CHROME = siteChrome('/book');

/** Same marker swap for the /book page, wrapped in the site header, nav and bottom bar. */
export function renderBookingPageShell(indexHtml: string): string {
  return injectPrerender(indexHtml, BOOK_CHROME.before + BOOKING_PAGE_PRERENDER_HTML + BOOK_CHROME.after);
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
