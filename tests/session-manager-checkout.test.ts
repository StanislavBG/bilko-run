import { describe, it, expect, vi } from 'vitest';
import { startSessionManagerCheckout } from '../src/lib/sessionManagerCheckout.js';

describe('startSessionManagerCheckout', () => {
  it('POSTs priceType session_manager and redirects to the returned Stripe URL', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ url: 'https://checkout.stripe.com/session/abc123' }),
    });
    const redirect = vi.fn();

    const result = await startSessionManagerCheckout('user@example.com', {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      redirect,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(String(url)).toContain('/stripe/create-checkout-session');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ email: 'user@example.com', priceType: 'session_manager' });

    expect(redirect).toHaveBeenCalledWith('https://checkout.stripe.com/session/abc123');
    expect(result).toEqual({ ok: true, url: 'https://checkout.stripe.com/session/abc123' });
  });

  it('surfaces the server error message inline on a non-2xx response instead of redirecting', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Stripe not configured — price ID missing' }),
    });
    const redirect = vi.fn();

    const result = await startSessionManagerCheckout('user@example.com', {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      redirect,
    });

    expect(redirect).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: false, error: 'Stripe not configured — price ID missing' });
  });

  it('returns a generic error when the network request itself fails', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('offline'));
    const redirect = vi.fn();

    const result = await startSessionManagerCheckout('user@example.com', {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      redirect,
    });

    expect(redirect).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
  });
});
