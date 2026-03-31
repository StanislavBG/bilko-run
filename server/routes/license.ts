import type { FastifyInstance } from 'fastify';
import { validateLicenseKey, getLicenseKeysForEmail } from '../services/license.js';
import { hasActiveSubscriptionLive } from '../services/stripe.js';
import { requireAuth } from '../clerk.js';

// Simple in-memory rate limiter: max 10 calls per IP per minute
const _validateRateLimiter = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = _validateRateLimiter.get(ip);
  if (!entry || entry.resetAt < now) {
    _validateRateLimiter.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 10) return false;
  entry.count++;
  return true;
}

export function registerLicenseRoutes(app: FastifyInstance): void {
  app.get('/api/license/my-keys', async (req, reply) => {
    const email = await requireAuth(req, reply);
    if (!email) return;
    const keys = getLicenseKeysForEmail(email);
    return { keys };
  });

  app.post('/api/license/validate', async (req, reply) => {
    const ip = req.ip ?? 'unknown';
    if (!checkRateLimit(ip)) {
      reply.status(429);
      return { valid: false, message: 'Too many requests. Try again in a minute.' };
    }

    const body = req.body as { key?: string } | null;
    const key = (body?.key ?? '').trim();
    if (!key) {
      reply.status(400);
      return { valid: false, message: 'key required' };
    }

    const result = validateLicenseKey(key);
    if (!result.valid) {
      // Key not in DB — could be Render cold start DB wipe. Guide user to self-serve recovery.
      const isValidFormat = /^CG-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/i.test(key);
      if (isValidFormat) {
        return { valid: false, reason: 'not_found', message: 'Key not found. If you are a Pro subscriber, retrieve your key at: https://bilko.run/my-license' };
      }
      return { valid: false, reason: 'format_invalid', message: 'Invalid license key format.' };
    }

    if (result.status !== 'active') {
      return { valid: false, reason: 'revoked', message: 'License key has been revoked.' };
    }

    // Also verify Stripe subscription is still active for subscription-based keys.
    // Uses live Stripe check (with DB fallback) so DB wipes on Render cold start don't invalidate valid subscribers.
    if (result.productKey === 'contentgrade_pro' && result.email) {
      const subActive = await hasActiveSubscriptionLive(result.email);
      if (!subActive) {
        return { valid: false, reason: 'subscription_expired', message: 'Subscription is no longer active. Please renew at bilko.run.' };
      }
    }

    return { valid: true, email: result.email, productKey: result.productKey };
  });
}
