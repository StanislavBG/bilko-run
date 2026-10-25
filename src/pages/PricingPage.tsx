import { useCallback, useEffect, useState } from 'react';
import { SignInButton, useAuth } from '@clerk/clerk-react';
import { API_BASE } from '../constants.js';
import { trackFlow } from '../lib/telemetry.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';

interface IntakeField { key: string; label: string; required: boolean; maxLength: number; kind: 'text' | 'url' }
interface MenuEntry {
  id: string; name: string; summary: string; whatYouGet: string;
  price: string; priceCents: number; kind: 'async' | 'download' | 'live'; intake: IntakeField[];
}
interface MenuPayload { topups: { cents: number; price: string }[]; items: MenuEntry[] }
interface SlotsPayload { timeZone: string; durationMinutes: number; slots: { startMs: number; endMs: number }[] }

const BTN_PRIMARY = 'px-5 py-3 text-sm font-bold text-white bg-fire-500 hover:bg-fire-600 rounded-xl shadow-md shadow-fire-500/20 transition-all disabled:opacity-50';
const BTN_SOFT = 'px-5 py-3 text-sm font-bold text-fire-600 bg-fire-50 hover:bg-fire-100 rounded-xl transition-colors disabled:opacity-50';

function useWallet() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [balance, setBalance] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    if (!isSignedIn) return;
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/wallet`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setBalance(((await res.json()) as { balance: string }).balance);
    } catch { /* balance stays hidden */ }
  }, [isSignedIn, getToken]);
  useEffect(() => { void refresh(); }, [refresh]);
  return { isLoaded, isSignedIn: !!isSignedIn, getToken, balance, refresh };
}

function WalletSection({ menu }: { menu: MenuPayload | null }) {
  const { isLoaded, isSignedIn, getToken, balance, refresh } = useWallet();
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState('');
  const params = new URLSearchParams(window.location.search);
  const topup = params.get('topup');

  useEffect(() => {
    if (topup === 'success') {
      void refresh();
      // The webhook can land a moment after the redirect; check once more.
      const t = setTimeout(() => void refresh(), 4000);
      return () => clearTimeout(t);
    }
  }, [topup, refresh]);

  async function startTopup(cents: number) {
    setBusy(cents);
    setError('');
    trackFlow('checkout', 'click-buy', { product: 'credits', plan: String(cents) });
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/wallet/topup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ cents }),
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (res.ok && data.url) {
        window.location.href = data.url;
        return;
      }
      setError(data.error || 'Checkout is not available right now.');
    } catch {
      setError('Checkout is not available right now.');
    }
    setBusy(null);
  }

  return (
    <section className="max-w-3xl mx-auto px-6 pb-12">
      <div className="bg-white rounded-2xl shadow-elevation-2 p-7 text-center">
        {topup === 'success' && (
          <p role="status" className="mb-4 text-sm font-bold text-fire-600">
            Payment received. Credits are landing in your wallet now.
          </p>
        )}
        {topup === 'cancel' && (
          <p role="status" className="mb-4 text-sm text-warm-500">Checkout cancelled. No charge.</p>
        )}
        <span className="text-label text-fire-500">Your wallet</span>
        {isSignedIn && (
          <p className="mt-2 text-4xl font-black text-warm-900" style={{ letterSpacing: '-0.03em' }}>
            {balance ?? '…'}
          </p>
        )}
        <p className="mt-2 text-sm text-warm-500">
          Top up, then spend on anything below. Credits never expire; some countries get bonus credits at checkout.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          {(menu?.topups ?? []).map(t =>
            isSignedIn ? (
              <button key={t.cents} type="button" className={BTN_PRIMARY} disabled={busy !== null} onClick={() => void startTopup(t.cents)}>
                {busy === t.cents ? 'Opening checkout…' : `Add ${t.price}`}
              </button>
            ) : (
              <SignInButton key={t.cents} mode="modal" forceRedirectUrl={window.location.pathname}>
                <button type="button" className={BTN_PRIMARY} disabled={!isLoaded}>Add {t.price}</button>
              </SignInButton>
            ),
          )}
        </div>
        {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
      </div>
    </section>
  );
}

function MenuSection({ menu, menuError }: { menu: MenuPayload | null; menuError: boolean }) {
  return (
    <section className="max-w-3xl mx-auto px-6 pb-16 md:pb-20">
      <h2 className="text-display-md text-warm-900 text-center mb-2">The menu</h2>
      <p className="text-sm text-warm-500 text-center mb-8">
        Written answers are drafted by Bilko's agents and reviewed before they reach your inbox. Best effort, no guaranteed results.
      </p>
      {menuError && <p role="alert" className="text-center text-sm text-warm-500">The menu didn't load. Refresh and try again.</p>}
      {!menu && !menuError && <p className="text-center text-sm text-warm-400">Loading the menu…</p>}
      <div className="space-y-4">
        {menu?.items.map(item => <MenuRow key={item.id} item={item} />)}
      </div>
    </section>
  );
}

function MenuRow({ item }: { item: MenuEntry }) {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [slots, setSlots] = useState<SlotsPayload | null>(null);
  const [slotsError, setSlotsError] = useState(false);
  const [startMs, setStartMs] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'warn'; text: string; topUp?: boolean } | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!open || item.kind !== 'live' || slots) return;
    fetch(`${API_BASE}/services/human-for-hire/slots`)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error('slots'))))
      .then((s: SlotsPayload) => setSlots(s))
      .catch(() => setSlotsError(true));
  }, [open, item.kind, slots]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const intake: Record<string, string> = {};
    for (const f of item.intake) {
      const v = (values[f.key] ?? '').trim();
      if (v) intake[f.key] = v;
    }
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/menu/${encodeURIComponent(item.id)}/order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(item.kind === 'live' ? { intake, startMs } : { intake }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (res.status === 201) {
        setDone(true);
        trackFlow('checkout', 'click-buy', { product: 'menu', plan: item.id });
        setMessage({
          tone: 'ok',
          text: item.kind === 'live'
            ? 'Booked. A confirmation is on its way to your email.'
            : item.kind === 'download'
              ? 'Paid from credits. Your download link is on its way to your email.'
              : 'Ordered. It arrives by email within 48 hours.',
        });
      } else if (res.status === 402) {
        setMessage({ tone: 'warn', text: 'Not enough credits for this one. Top up above and try again.', topUp: true });
      } else if (res.status === 409 && data.error === 'daily_cap') {
        setMessage({ tone: 'warn', text: "Today's slots are full. Come back tomorrow." });
      } else if (res.status === 409 && data.error === 'unavailable') {
        setMessage({ tone: 'warn', text: 'Not on sale yet.' });
      } else if (res.status === 409) {
        setMessage({ tone: 'warn', text: 'That slot was just taken. Pick another.' });
        setSlots(null);
        setStartMs(null);
      } else if (res.status === 429) {
        setMessage({ tone: 'warn', text: 'Too many requests. Try again in a minute.' });
      } else {
        setMessage({ tone: 'warn', text: 'Something went wrong. Check the form and try again.' });
      }
    } catch {
      setMessage({ tone: 'warn', text: 'Network hiccup. Try again.' });
    }
    setBusy(false);
  }

  const missingRequired = item.intake.some(f => f.required && !(values[f.key] ?? '').trim());
  const needsSlot = item.kind === 'live' && startMs === null;
  const cta = item.kind === 'download' ? 'Buy with credits' : item.kind === 'live' ? 'Book a call' : 'Order';

  return (
    <div className="bg-white rounded-2xl shadow-elevation-1 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-bold text-warm-900">{item.name}</h3>
          <p className="mt-1 text-sm text-warm-500">{item.summary}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-2xl font-black text-warm-900" style={{ letterSpacing: '-0.03em' }}>{item.price}</div>
          <button type="button" className={`mt-2 ${BTN_SOFT} !py-2`} aria-expanded={open} onClick={() => setOpen(o => !o)}>
            {open ? 'Close' : cta}
          </button>
        </div>
      </div>
      {open && (
        <div className="mt-5 border-t border-warm-200/40 pt-5">
          <p className="text-xs text-warm-400 mb-4">{item.whatYouGet}</p>
          {!isSignedIn ? (
            <SignInButton mode="modal" forceRedirectUrl={window.location.pathname}>
              <button type="button" className={BTN_PRIMARY} disabled={!isLoaded}>Sign in to continue</button>
            </SignInButton>
          ) : done ? null : (
            <form onSubmit={e => void submit(e)} className="space-y-4">
              {item.kind === 'live' && (
                <div>
                  <p className="text-sm font-bold text-warm-900 mb-2">Pick a slot (Pacific Time)</p>
                  {slotsError && <p className="text-sm text-warm-500">Couldn't load slots. Try again shortly.</p>}
                  {!slots && !slotsError && <p className="text-sm text-warm-400">Loading slots…</p>}
                  {slots && slots.slots.length === 0 && <p className="text-sm text-warm-500">No open slots right now. Check back soon.</p>}
                  <div className="flex flex-wrap gap-2">
                    {slots?.slots.map(s => (
                      <button
                        key={s.startMs}
                        type="button"
                        aria-pressed={startMs === s.startMs}
                        onClick={() => setStartMs(s.startMs)}
                        className={`px-3 py-2 text-xs font-bold rounded-lg border ${startMs === s.startMs ? 'bg-fire-500 text-white border-fire-500' : 'bg-white text-warm-600 border-warm-200 hover:border-fire-400'}`}
                      >
                        {formatSlot(s.startMs)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {item.intake.map(f => (
                <label key={f.key} className="block">
                  <span className="text-sm font-bold text-warm-900">{f.label}</span>
                  {f.kind === 'url' || f.maxLength <= 300 ? (
                    <input
                      type={f.kind === 'url' ? 'url' : 'text'}
                      required={f.required}
                      maxLength={f.maxLength}
                      value={values[f.key] ?? ''}
                      onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
                      className="mt-1 w-full rounded-xl border border-warm-200 px-3 py-2 text-sm"
                    />
                  ) : (
                    <textarea
                      required={f.required}
                      maxLength={f.maxLength}
                      rows={f.maxLength > 5000 ? 8 : 4}
                      value={values[f.key] ?? ''}
                      onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
                      className="mt-1 w-full rounded-xl border border-warm-200 px-3 py-2 text-sm"
                    />
                  )}
                </label>
              ))}
              <button type="submit" className={BTN_PRIMARY} disabled={busy || missingRequired || needsSlot}>
                {busy ? 'Working…' : `${cta} · ${item.price}`}
              </button>
            </form>
          )}
          {message && (
            <p role={message.tone === 'ok' ? 'status' : 'alert'} className={`mt-4 text-sm ${message.tone === 'ok' ? 'text-fire-600 font-bold' : 'text-warm-600'}`}>
              {message.text}
              {message.topUp && (
                <> <a href="#top" onClick={e => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="underline font-bold">Add credits</a></>
              )}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function formatSlot(startMs: number): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  }).format(new Date(startMs));
}

export function PricingPage() {
  useDocumentTitle('Pricing — bilko.run');
  const [menu, setMenu] = useState<MenuPayload | null>(null);
  const [menuError, setMenuError] = useState(false);
  useEffect(() => {
    trackFlow('checkout', 'view-offer', { product: 'credits' });
    let cancelled = false;
    fetch(`${API_BASE}/menu`)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error('menu'))))
      .then((m: MenuPayload) => { if (!cancelled) setMenu(m); })
      .catch(() => { if (!cancelled) setMenuError(true); });
    return () => { cancelled = true; };
  }, []);

  return (
    <>
      <section className="max-w-4xl mx-auto px-6 pt-16 pb-10 md:pt-24 md:pb-14 text-center">
        <h1 className="text-display-xl text-warm-900">
          No subscriptions. No BS.
        </h1>
        <p className="mt-5 text-lg text-warm-500 leading-relaxed">
          Bilko Credits: top up a few dollars, spend them on the menu below.
        </p>
        <p className="mt-2 text-sm text-warm-400">
          Credits never expire. Some countries get bonus credits at checkout.
        </p>
      </section>

      <WalletSection menu={menu} />
      <MenuSection menu={menu} menuError={menuError} />

      {/* Git Viewer — the one subscription */}
      <section className="max-w-5xl mx-auto px-6 pb-16 md:pb-20">
        <h2 className="text-display-md text-warm-900 text-center mb-2">Git Viewer</h2>
        <p className="text-sm text-warm-500 text-center mb-8">
          Turn your GitHub into a public portfolio. No setup — just your GitHub username.
        </p>
        <div className="grid md:grid-cols-2 gap-5 items-start max-w-3xl mx-auto">
          {[
            {
              label: 'Free', price: '$0', unit: '', accent: 'text-warm-400',
              features: ['1 project', 'Public repos only', 'Refreshed at most once a day', 'Bilko branding'],
            },
            {
              label: 'Paid', price: '$5', unit: '/ month', accent: 'text-fire-500',
              features: ['Up to 12 projects you choose', 'Refreshed daily', 'Writing tab from your profile repo', 'Included with any existing bilko.run subscription'],
            },
          ].map(tier => (
            <div key={tier.label} className="bg-white rounded-2xl shadow-elevation-1 p-7">
              <span className={`text-label ${tier.accent}`}>{tier.label}</span>
              <div className="flex items-baseline gap-1 mt-3 mb-6">
                <span className="text-4xl font-black text-warm-900" style={{ letterSpacing: '-0.03em' }}>{tier.price}</span>
                {tier.unit && <span className="text-sm text-warm-400 ml-0.5">{tier.unit}</span>}
              </div>
              <ul className="space-y-3 text-sm text-warm-600 mb-8">
                {tier.features.map(f => (
                  <li key={f} className="flex items-start gap-2.5">
                    <span className={`${tier.accent} mt-0.5 flex-shrink-0`}>&#x2713;</span>
                    {f}
                  </li>
                ))}
              </ul>
              <a
                href="/projects/git-viewer/"
                data-track="buy-git-viewer"
                className="block w-full py-3 text-center text-sm font-bold text-fire-600 bg-fire-50 hover:bg-fire-100 rounded-xl transition-colors"
              >
                Open Git Viewer
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-warm-200/40">
        <div className="max-w-2xl mx-auto px-6 py-16 md:py-20">
          <h2 className="text-display-md text-warm-900 text-center mb-10">Common questions</h2>
          <div className="space-y-6">
            {[
              { q: 'Why not a subscription?', a: 'Because you don\'t analyze pages every day. Pay for what you use, not what you don\'t. The one exception is Git Viewer at $5/year, because it keeps rebuilding your portfolio every day.' },
              { q: 'What if I don\'t use all my credits?', a: 'They never expire. Buy today, use the last one next year. No pressure.' },
              { q: 'Can I get a refund?', a: 'Credits are spent the moment you order. Top-ups are final, so start with the smallest one.' },
              { q: 'Is my payment secure?', a: 'Payments are processed by Stripe. We never see your card number.' },
              { q: 'What\'s the A/B Compare?', a: 'Paste two URLs — your page vs. a competitor. We score both and pick a winner. Costs 2 credits because we\'re working twice as hard.' },
              { q: 'What do tools cost?', a: 'The AI tools on bilko.run run on the same wallet. Each analysis uses a credit or two, and the tool page shows the exact cost before you commit. LocalScore is free because it runs in your browser.' },
            ].map(({ q, a }) => (
              <div key={q}>
                <h3 className="font-bold text-warm-900 mb-1.5 text-sm">{q}</h3>
                <p className="text-sm text-warm-500 leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-6 py-12 text-center">
        <p className="text-sm text-warm-400">
          Credits are one-time purchases. Powered by Stripe. No hidden fees.
        </p>
      </section>
    </>
  );
}
