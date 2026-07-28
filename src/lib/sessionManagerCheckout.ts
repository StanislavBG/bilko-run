import { API } from '../data/api.js';

export interface CheckoutResult {
  ok: boolean;
  url?: string;
  error?: string;
}

export interface CheckoutOptions {
  /** Injectable for tests; defaults to the global fetch. */
  fetchImpl?: typeof fetch;
  /** Injectable for tests; defaults to a real browser redirect. */
  redirect?: (url: string) => void;
}

/**
 * Starts a Stripe Checkout session for the Session Manager one-time
 * "support this project" purchase and redirects the browser to it.
 * See server/routes/stripe.ts POST /api/stripe/create-checkout-session.
 */
export async function startSessionManagerCheckout(
  email: string,
  opts: CheckoutOptions = {},
): Promise<CheckoutResult> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const redirect = opts.redirect ?? ((url: string) => { window.location.href = url; });

  let res: Response;
  try {
    res = await fetchImpl(`${API}/stripe/create-checkout-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, priceType: 'session_manager' }),
    });
  } catch {
    return { ok: false, error: 'Network error — please try again.' };
  }

  const data = await res.json().catch(() => null) as { url?: string; error?: string } | null;

  if (!res.ok || !data?.url) {
    return { ok: false, error: data?.error ?? 'Checkout failed. Please try again.' };
  }

  redirect(data.url);
  return { ok: true, url: data.url };
}
