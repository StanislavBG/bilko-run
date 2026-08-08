/**
 * HTTP surface for the paid Session Manager Field Manual ($19.99).
 *
 * Route map — the whole buy → read → download framework:
 *
 *   GET  /api/manual/toc                     public   table of contents (sales page)
 *   GET  /api/manual/status                  auth     { entitled, toc } for the signed-in user
 *   GET  /api/manual/chapter/:slug           mixed    free chapters public, rest 402 unless entitled
 *   GET  /api/manual/download/:assetId       auth     streams the PDF / offline HTML
 *   GET  /my-manual                          public   email-based recovery page (payment-link buyers)
 *
 * Entitlement itself is the already-wired `session_manager` one-time purchase —
 * see shared/manual-catalog.ts for why there's no second SKU.
 */

import type { FastifyInstance } from 'fastify';
import { createReadStream } from 'fs';
import { requireAuth, verifyClerkToken, EMAIL_RE } from '../clerk.js';
import {
  latestManifest,
  findChapter,
  findAsset,
  readChapterHtml,
  resolveReleaseFile,
  isEntitledToManual,
} from '../services/manual.js';
import {
  tocFromManifest,
  isValidManualSlug,
  MANUAL_PRICE_LABEL,
  MANUAL_TITLE,
} from '../../shared/manual-catalog.js';

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** 503 body used everywhere a release bundle hasn't been published yet. */
const NOT_PUBLISHED = { error: 'The manual has not been published yet. Check back shortly.' };

export function registerManualRoutes(app: FastifyInstance): void {
  // ── Public: what you get for your money ────────────────────────────────────
  app.get('/api/manual/toc', async (_req, reply) => {
    const m = latestManifest();
    if (!m) {
      reply.status(503);
      return NOT_PUBLISHED;
    }
    return { priceLabel: MANUAL_PRICE_LABEL, toc: tocFromManifest(m) };
  });

  // ── Auth: does THIS user own it? ───────────────────────────────────────────
  app.get('/api/manual/status', async (req, reply) => {
    const email = await requireAuth(req, reply);
    if (!email) return;

    const m = latestManifest();
    const entitled = await isEntitledToManual(email);
    if (!m) {
      // Still report entitlement — a buyer with no bundle yet should see
      // "you own it, it's coming", not a bare error.
      reply.status(200);
      return { email, entitled, published: false, priceLabel: MANUAL_PRICE_LABEL, toc: null };
    }
    return { email, entitled, published: true, priceLabel: MANUAL_PRICE_LABEL, toc: tocFromManifest(m) };
  });

  // ── Mixed: free chapters are the marketing sample; the rest are paid ───────
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

    if (!chapter.free) {
      // Soft auth: no `requireAuth` here so a signed-out visitor gets the
      // paywall shape (402 + price) rather than a bare 401 they can't act on.
      const email = await verifyClerkToken(req.headers.authorization);
      const entitled = email ? await isEntitledToManual(email) : false;
      if (!entitled) {
        reply.status(402);
        return {
          error: 'This chapter is part of the paid manual.',
          locked: true,
          signedIn: !!email,
          priceLabel: MANUAL_PRICE_LABEL,
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

  // ── Auth: the actual bytes ─────────────────────────────────────────────────
  //
  // Entitlement is checked HERE, on the request that serves the file, against
  // the persisted purchase row — the same check every other route uses. There
  // is no signed URL, no download token, and no shared signing secret to
  // configure or rotate.
  //
  // This works because the browser never navigates to this URL: ManualPage
  // fetches it with the Clerk bearer header and saves the resulting blob (see
  // src/lib/manualClient.ts). A plain `window.location = url` couldn't send
  // that header, which is the only reason a signed-URL scheme was ever
  // needed. The assets are a few hundred KB, so buffering one client-side
  // costs nothing.
  app.get('/api/manual/download/:assetId', async (req, reply) => {
    const email = await requireAuth(req, reply);
    if (!email) return;

    if (!(await isEntitledToManual(email))) {
      reply.status(402);
      return { error: 'Purchase required.', locked: true, priceLabel: MANUAL_PRICE_LABEL };
    }

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

    reply.header('Content-Type', asset.mime);
    reply.header('Content-Disposition', `attachment; filename="${asset.file.replace(/[^\w.\-]/g, '_')}"`);
    // Per-user paid content — must never be cached by a shared proxy.
    reply.header('Cache-Control', 'private, no-store');
    return reply.send(createReadStream(full));
  });

  // ── Recovery page for buyers who paid via a static payment link ────────────
  // Mirrors /my-license: no Clerk session needed, just the purchase email.
  app.get('/my-manual', async (req, reply) => {
    const query = req.query as { email?: string };
    const email = (query.email ?? '').trim().toLowerCase();
    reply.type('text/html');

    const page = (title: string, body: string) => `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${escHtml(title)} — Bilko.run</title>
<style>
body{font-family:system-ui,sans-serif;background:#0d0d0d;color:#e8e8e8;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
.card{max-width:520px;width:90%;background:#1a1a1a;border:1px solid #333;border-radius:12px;padding:40px}
h1{margin-top:0;font-size:1.5em}p{color:#aaa;font-size:0.95em}a{color:#7fc4ff}
input{width:100%;box-sizing:border-box;padding:10px 14px;background:#111;border:1px solid #444;border-radius:6px;color:#e8e8e8;font-size:1em;margin:8px 0 16px}
button{width:100%;padding:12px;background:#7fff7f;color:#000;border:none;border-radius:6px;font-size:1em;font-weight:600;cursor:pointer}
</style></head><body><div class="card"><h1>${escHtml(title)}</h1>${body}</div></body></html>`;

    if (email && EMAIL_RE.test(email)) {
      const entitled = await isEntitledToManual(email);
      if (!entitled) {
        return page('No purchase found', `
          <p>We couldn't find a ${escHtml(MANUAL_TITLE)} purchase for <strong>${escHtml(email)}</strong>.</p>
          <p>If you just paid, the webhook can take up to a minute — try again shortly.</p>
          <p><a href="/my-manual">Try a different email</a> · <a href="/manual">Buy for ${MANUAL_PRICE_LABEL}</a></p>`);
      }
      const m = latestManifest();
      return page('Your manual is unlocked', `
        <p>Purchase confirmed for <strong>${escHtml(email)}</strong>.</p>
        <p>Sign in at <a href="/manual">bilko.run/manual</a> with this email to read online and download
        ${m ? `<strong>v${escHtml(m.version)}</strong>` : 'the latest release'}.</p>
        <p style="color:#888;font-size:0.85em">Every future revision is included — no repeat purchase.</p>`);
    }

    return page('Find your manual', `
      <p>Enter the email you used to buy ${escHtml(MANUAL_TITLE)}.</p>
      <form method="GET" action="/my-manual">
        <input type="email" name="email" placeholder="you@example.com" required autofocus/>
        <button type="submit">Find my purchase</button>
      </form>
      <p style="margin-top:24px">Don't have it yet? <a href="/manual">Get it for ${MANUAL_PRICE_LABEL} →</a></p>`);
  });
}
