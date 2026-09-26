/**
 * HTTP surface for the Session Manager Field Manual — free to read and
 * download as of release 2.0.1.
 *
 * Route map:
 *
 *   GET  /api/manual/toc                     public   table of contents
 *   GET  /api/manual/chapter/:slug           public   chapter body (every chapter is free since 2.0.1)
 *   GET  /api/manual/download/:assetId       public   streams the PDF / offline HTML
 *   GET  /products/session-manager/my-manual public   "it's free now" page for past buyers
 *   GET  /my-manual                          public   301 → the path above (legacy, in receipt emails)
 *
 * The manual used to be a one-time `session_manager` purchase. Those
 * entitlement rows are kept (see shared/manual-catalog.ts), and the Stripe
 * wiring stays so a late payment still resolves — nothing here sells anything.
 */

import type { FastifyInstance } from 'fastify';
import { createReadStream } from 'fs';
import { verifyClerkToken } from '../clerk.js';
import {
  latestManifest,
  findChapter,
  findAsset,
  readChapterHtml,
  resolveReleaseFile,
  isEntitledToManual,
} from '../services/manual.js';
import { tocFromManifest, isValidManualSlug } from '../../shared/manual-catalog.js';

/** 503 body used everywhere a release bundle hasn't been published yet. */
const NOT_PUBLISHED = { error: 'The manual has not been published yet. Check back shortly.' };

/** Canonical, product-scoped paths. Everything Session Manager hangs off
 *  /products/session-manager; the old top-level /manual and /my-manual 301 here. */
const MANUAL_PATH = '/products/session-manager/manual';
const MY_MANUAL_PATH = '/products/session-manager/my-manual';

/**
 * RFC 9110 §13.1.2: does an If-None-Match header match `etag`? Uses the weak
 * comparison GET requires (a `W/` prefix on either side is ignored), accepts
 * a comma-separated list, and treats `*` as matching any current file.
 */
function ifNoneMatchHits(header: string | string[] | undefined, etag: string): boolean {
  if (!header) return false;
  const opaque = (tag: string) => tag.trim().replace(/^W\//, '');
  const want = opaque(etag);
  return (Array.isArray(header) ? header.join(',') : header)
    .split(',')
    .some(tag => tag.trim() === '*' || opaque(tag) === want);
}

export function registerManualRoutes(app: FastifyInstance): void {
  // ── Public: what's in the manual ───────────────────────────────────────────
  app.get('/api/manual/toc', async (_req, reply) => {
    const m = latestManifest();
    if (!m) {
      reply.status(503);
      return NOT_PUBLISHED;
    }
    return { free: true, toc: tocFromManifest(m) };
  });

  // ── Public: one chapter's body ─────────────────────────────────────────────
  app.get('/api/manual/chapter/:slug', async (req, reply) => {
    const { slug } = req.params as { slug: string };
    if (!isValidManualSlug(slug)) {
      reply.status(400);
      return { error: 'Invalid chapter.' };
    }

    const m = latestManifest();
    if (!m) {
      reply.status(503);
      return NOT_PUBLISHED;
    }

    const chapter = findChapter(m, slug);
    if (!chapter) {
      reply.status(404);
      return { error: 'Chapter not found.' };
    }

    // The manual is free as of release 2.0.1: its manifest marks every chapter
    // `free: true`, so this branch never runs for it. The check stays as a
    // guard on the manifest flag — a release that marks a chapter non-free
    // gets a neutral 402 (the reader shows "isn't available right now", not a
    // price), while a pre-2.0.1 buyer's entitlement row still opens it.
    if (!chapter.free) {
      // Soft auth: a signed-out visitor gets the 402 shape, not a bare 401.
      const email = await verifyClerkToken(req.headers.authorization);
      const entitled = email ? await isEntitledToManual(email) : false;
      if (!entitled) {
        reply.status(402);
        return {
          error: "This chapter isn't available right now.",
          locked: true,
          title: chapter.title,
          blurb: chapter.blurb,
        };
      }
    }

    const html = readChapterHtml(m.version, chapter);
    if (html === null) {
      console.error(`[manual] chapter ${slug} listed in manifest ${m.version} but its file is missing`);
      reply.status(500);
      return { error: 'Chapter content is unavailable.' };
    }

    return { version: m.version, slug: chapter.slug, title: chapter.title, html };
  });

  // ── Public: the actual bytes ───────────────────────────────────────────────
  //
  // Free since 2.0.1 — no sign-in, no entitlement. ManualPage links here
  // directly and the attachment disposition makes the browser save the file.
  app.get('/api/manual/download/:assetId', async (req, reply) => {
    const { assetId } = req.params as { assetId: string };
    if (!isValidManualSlug(assetId)) {
      reply.status(400);
      return { error: 'Invalid download.' };
    }

    const m = latestManifest();
    if (!m) {
      reply.status(503);
      return NOT_PUBLISHED;
    }

    const asset = findAsset(m, assetId);
    if (!asset) {
      reply.status(404);
      return { error: 'Unknown download.' };
    }

    const full = resolveReleaseFile(m.version, asset.file);
    if (!full) {
      console.error(`[manual] asset ${assetId} listed in manifest ${m.version} but its file is missing`);
      reply.status(500);
      return { error: 'Download is unavailable.' };
    }

    // Asset ids are stable across releases (`pdf` is always the LATEST PDF),
    // so a cache may keep the bytes but must revalidate before reusing them.
    // The validator is what makes that revalidation cheap: a release directory
    // is immutable once published, so version + id + size names these exact
    // bytes, and a browser or Cloudflare holding them gets a bodiless 304
    // instead of the whole file again. Weak, because @fastify/compress may
    // send the offline HTML edition gzip/br-encoded.
    const etag = `W/"${m.version}-${asset.id}-${asset.bytes}"`;
    reply.header('ETag', etag);
    reply.header('Cache-Control', 'no-cache');
    if (ifNoneMatchHits(req.headers['if-none-match'], etag)) {
      return reply.code(304).send();
    }

    reply.header('Content-Type', asset.mime);
    reply.header('Content-Disposition', `attachment; filename="${asset.file.replace(/[^\w.\-]/g, '_')}"`);
    return reply.send(createReadStream(full));
  });

  // ── "It's free now" page for past buyers ──────────────────────────────────
  // This used to recover a purchase by email. The manual is free as of 2.0.1,
  // so there is nothing to recover: every visitor, with or without the
  // `?email=` that receipt emails carry, gets pointed at the reader.
  //
  // Canonical path is product-scoped so Session Manager's whole web presence
  // hangs off /products/session-manager. The bare /my-manual is registered
  // below as a permanent 301 — it is printed in receipt emails already sent.
  app.get(MY_MANUAL_PATH, async (_req, reply) => {
    reply.type('text/html');
    return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>The Field Manual is free now — Bilko.run</title>
<style>
body{font-family:system-ui,sans-serif;background:#0d0d0d;color:#e8e8e8;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
.card{max-width:520px;width:90%;background:#1a1a1a;border:1px solid #333;border-radius:12px;padding:40px}
h1{margin-top:0;font-size:1.5em}p{color:#aaa;font-size:0.95em}a{color:#7fc4ff}
</style></head><body><div class="card">
<h1>The Field Manual is free now</h1>
<p><a href="${MANUAL_PATH}">Read it here →</a> Every chapter, plus the PDF and offline editions, with no sign-in needed.</p>
<p>Bought a copy earlier? Thank you for the support. There's nothing to recover — it's all open to read.</p>
</div></body></html>`;
  });

  // ── Permanent redirects for the retired top-level paths ────────────────────
  // These must keep working forever: Stripe receipt emails sent before the
  // consolidation link to /manual and /my-manual. The query string is carried
  // over for those old receipt links (they carry ?email=, which the "it's free
  // now" page ignores). The fragment (#getting-started and every other chapter
  // anchor) is never sent to the server — the browser re-applies it to the
  // redirect target on its own, so anchors survive.
  app.get('/my-manual', async (req, reply) => {
    const qs = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
    return reply.redirect(MY_MANUAL_PATH + qs, 301);
  });

  // /manual is otherwise an SPA route; answering it here makes the hop a real
  // 301 rather than a 200-then-client-redirect. src/App.tsx keeps a matching
  // <Navigate> so in-app links that never touch the server redirect too.
  app.get('/manual', async (req, reply) => {
    const qs = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
    return reply.redirect(MANUAL_PATH + qs, 301);
  });
}
