import { describe, it, expect } from 'vitest';
import { liveKeyBlocked } from '../server/services/stripe.js';

describe('live Stripe key guard', () => {
  it('refuses a live key outside production', () => {
    expect(liveKeyBlocked('sk_live_x', { NODE_ENV: 'development' })).toBe(true);
    expect(liveKeyBlocked('sk_live_x', {})).toBe(true);
  });
  it('allows live in production, test keys anywhere, and an explicit dev override', () => {
    expect(liveKeyBlocked('sk_live_x', { NODE_ENV: 'production' })).toBe(false);
    expect(liveKeyBlocked('sk_test_x', { NODE_ENV: 'development' })).toBe(false);
    expect(liveKeyBlocked('sk_live_x', { NODE_ENV: 'development', STRIPE_ALLOW_LIVE_IN_DEV: '1' })).toBe(false);
  });
});
