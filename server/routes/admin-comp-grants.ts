/**
 * Admin-only complimentary entitlement grants.
 *
 *   GET    /api/admin/comp-grants          list the audit log (incl. revoked)
 *   POST   /api/admin/comp-grants          { email, productKey, reason }
 *   DELETE /api/admin/comp-grants          { email, productKey }
 *
 * See server/services/comp-grants.ts for why comps exist and how the sentinel
 * Stripe ids keep them distinguishable from real sales.
 */

import type { FastifyInstance } from 'fastify';
import { requireAdmin } from '../clerk.js';
import { grantComp, revokeComp, listCompGrants } from '../services/comp-grants.js';
import { PRODUCT_KEYS } from '../../shared/product-catalog.js';

const VALID_PRODUCT_KEYS = new Set<string>(Object.values(PRODUCT_KEYS));

export function registerCompGrantRoutes(app: FastifyInstance): void {
  app.get('/api/admin/comp-grants', async (req, reply) => {
    if (!await requireAdmin(req, reply)) return;
    return { grants: await listCompGrants() };
  });

  app.post('/api/admin/comp-grants', async (req, reply) => {
    const admin = await requireAdmin(req, reply);
    if (!admin) return;

    const { email, productKey, reason } = (req.body ?? {}) as
      { email?: string; productKey?: string; reason?: string };

    if (!email || !productKey || !reason) {
      reply.status(400).send({ error: 'email, productKey and reason are all required.' });
      return;
    }
    // Guard against typo'd keys: a comp for 'session-manager' (hyphen) would
    // insert cleanly and silently never unlock anything.
    if (!VALID_PRODUCT_KEYS.has(productKey)) {
      reply.status(400).send({
        error: `Unknown productKey '${productKey}'.`,
        validKeys: [...VALID_PRODUCT_KEYS],
      });
      return;
    }

    try {
      const result = await grantComp({ email, productKey, reason, grantedBy: admin });
      return result;
    } catch (err) {
      reply.status(400).send({ error: (err as Error).message });
    }
  });

  app.delete('/api/admin/comp-grants', async (req, reply) => {
    const admin = await requireAdmin(req, reply);
    if (!admin) return;

    const { email, productKey } = (req.body ?? {}) as { email?: string; productKey?: string };
    if (!email || !productKey) {
      reply.status(400).send({ error: 'email and productKey are required.' });
      return;
    }

    const result = await revokeComp({ email, productKey, revokedBy: admin });
    if (!result.ok) {
      reply.status(400).send({ error: result.reason });
      return;
    }
    return { ok: true };
  });
}
