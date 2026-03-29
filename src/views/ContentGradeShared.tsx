import React, { useState, useEffect } from 'react';
import { API } from '../data/api.js';
import { useAuth } from '../hooks/useAuth.js';

/** Fire a funnel event. Fire-and-forget — never throws. */
function fireFunnelEvent(event: string, extra?: { tool?: string; email?: string }) {
  fetch(`${API}/analytics/event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event, ...extra }),
  }).catch(() => {});
}

// Email capture — persists to SQLite via server endpoint
export function EmailCapture({ tool, score, accentColor = '#7c4dff' }: {
  tool: string;
  score: number;
  accentColor?: string;
}) {
  const [email, setEmail] = useState('');
  const [saved, setSaved] = useState(false);

  async function submit() {
    if (!email.trim() || !email.includes('@')) return;
    try {
      await fetch(`${API}/demos/email-capture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), tool, score: String(score) }),
      });
    } catch { /* server down — still show success UX */ }
    fireFunnelEvent('email_captured', { tool, email: email.trim() });
    setSaved(true);
  }

  if (saved) {
    return (
      <div style={{
        background: '#0d1f0d', border: '1px solid #1e4a1e', borderRadius: 14,
        padding: 20, textAlign: 'center', marginTop: 16,
      }}>
        <p style={{ color: '#4caf50', fontSize: 14, fontWeight: 700, margin: '0 0 4px' }}>
          You're on the early access list.
        </p>
        <p style={{ color: '#2e7d32', fontSize: 11, margin: 0 }}>
          We'll notify you when Pro launches — full reports, history & API access.
        </p>
      </div>
    );
  }

  return (
    <div style={{
      background: '#12121f',
      border: `1px solid ${accentColor}33`,
      borderRadius: 14,
      padding: '20px 20px 18px',
      marginTop: 16,
    }}>
      <div style={{ marginBottom: 14 }}>
        <p style={{ fontSize: 14, color: '#e0e0e0', fontWeight: 700, margin: '0 0 4px' }}>
          Get your full report — free
        </p>
        <p style={{ fontSize: 11, color: '#666', margin: 0, lineHeight: 1.5 }}>
          Framework breakdown, all rewrites, and competitor edge. No spam. Unsubscribe anytime.
        </p>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit(); }}
          style={{
            flex: 1, background: '#0d0d1a', border: '1px solid #1a1a2e', borderRadius: 8,
            padding: '10px 12px', fontSize: 13, color: '#e0e0e0',
            outline: 'none', fontFamily: 'inherit',
          }}
        />
        <button
          onClick={submit}
          disabled={!email.includes('@')}
          style={{
            padding: '10px 20px',
            background: !email.includes('@') ? '#333' : accentColor,
            color: '#fff', fontWeight: 700, fontSize: 12, border: 'none', borderRadius: 8,
            cursor: !email.includes('@') ? 'not-allowed' : 'pointer',
            opacity: !email.includes('@') ? 0.5 : 1,
            whiteSpace: 'nowrap',
            letterSpacing: 0.2,
          }}
        >
          Send My Report
        </button>
      </div>
    </div>
  );
}

// Share Score button — copies viral text to clipboard
export function ShareButton({ shareText, accentColor }: { shareText: string; accentColor: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(shareText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  return (
    <button
      onClick={copy}
      style={{
        padding: '6px 14px', fontSize: 11, fontWeight: 600,
        background: copied ? '#1a2e1a' : accentColor + '18',
        color: copied ? '#4caf50' : accentColor,
        border: `1px solid ${copied ? '#4caf5044' : accentColor + '44'}`,
        borderRadius: 7, cursor: 'pointer',
        transition: 'all 0.2s',
        whiteSpace: 'nowrap',
      }}
    >
      {copied ? 'Copied!' : 'Share Score'}
    </button>
  );
}

// Pro gate — blurs content and shows upgrade CTA overlay
export function ProGate({ children, accentColor, label = 'Full Report', priceLabel = 'Unlock Full Report — $9/mo', email, product = 'contentgrade_pro' }: {
  children: React.ReactNode;
  accentColor: string;
  label?: string;
  priceLabel?: string;
  email?: string;
  product?: 'contentgrade_pro' | 'audiencedecoder_report';
}) {
  const auth = useAuth();
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [loading, setLoading] = useState(false);
  // Use email prop if provided, otherwise fall back to global auth email
  const resolvedEmail = email ?? auth.email;
  const [emailInput, setEmailInput] = useState(resolvedEmail);
  const [emailSaved, setEmailSaved] = useState(false);

  // Sync emailInput when global auth email changes (e.g. user signs in via Nav)
  useEffect(() => {
    if (!email && auth.email && !emailInput) {
      setEmailInput(auth.email);
    }
  }, [auth.email]);

  // If global auth shows Pro for this product, auto-unlock
  useEffect(() => {
    if (product !== 'audiencedecoder_report' && auth.isPro) {
      setUnlocked(true);
    }
  }, [auth.isPro, product]);

  useEffect(() => {
    const checkEmail = resolvedEmail.trim().toLowerCase();

    // Check if Stripe is configured + check subscription for known email
    if (checkEmail && checkEmail.includes('@')) {
      fetch(`${API}/stripe/subscription-status?email=${encodeURIComponent(checkEmail)}`)
        .then(r => r.json())
        .then(d => {
          setConfigured(d.configured ?? false);
          const isProduct = product === 'audiencedecoder_report' ? d.audiencedecoder : d.active;
          if (isProduct) setUnlocked(true);
        })
        .catch(() => setConfigured(false));
    } else {
      fetch(`${API}/stripe/subscription-status?email=noop@check.com`)
        .then(r => r.json())
        .then(d => setConfigured(d.configured ?? false))
        .catch(() => setConfigured(false));
    }

    // Check for checkout=success in URL and re-verify
    const params = new URLSearchParams(window.location.search);
    if (params.get('checkout') === 'success' && checkEmail) {
      // Small delay for webhook processing
      setTimeout(() => {
        fetch(`${API}/stripe/subscription-status?email=${encodeURIComponent(checkEmail)}`)
          .then(r => r.json())
          .then(d => {
            const isProduct = product === 'audiencedecoder_report' ? d.audiencedecoder : d.active;
            if (isProduct) {
              setUnlocked(true);
              auth.refresh();
            }
          })
          .catch(() => {});
      }, 2000);
    }
  }, [resolvedEmail]);

  async function handleUpgrade() {
    const targetEmail = emailInput.trim().toLowerCase();
    if (!targetEmail || !targetEmail.includes('@')) return;
    setLoading(true);
    fireFunnelEvent('upgrade_clicked', { email: targetEmail });
    try {
      auth.setEmail(targetEmail);
      const res = await fetch(`${API}/stripe/create-checkout-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail, priceType: product }),
      });
      const data = await res.json();
      if (data.url) {
        fireFunnelEvent('checkout_started', { email: targetEmail });
        window.location.href = data.url;
      } else {
        setConfigured(false);
      }
    } catch {
      setConfigured(false);
    } finally {
      setLoading(false);
    }
  }

  async function handleEmailCapture() {
    const targetEmail = emailInput.trim().toLowerCase();
    if (!targetEmail || !targetEmail.includes('@')) return;
    try {
      await fetch(`${API}/demos/headline-grader/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail }),
      });
    } catch { /* best effort */ }
    setEmailSaved(true);
  }

  // Subscription active — show content unlocked
  if (unlocked) {
    return <div style={{ marginBottom: 16 }}>{children}</div>;
  }

  return (
    <div style={{ position: 'relative', marginBottom: 16 }}>
      <div style={{ filter: 'blur(5px)', pointerEvents: 'none', userSelect: 'none' }}>
        {children}
      </div>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: 'rgba(10,10,20,0.72)', borderRadius: 14,
        backdropFilter: 'blur(2px)',
      }}>
        <div style={{ fontSize: 22, marginBottom: 8 }}>🔒</div>
        <div style={{ fontSize: 15, fontWeight: 800, color: '#e0e0e0', marginBottom: 4 }}>
          {label}
        </div>
        <div style={{ fontSize: 11, color: '#666', marginBottom: 18, textAlign: 'center', maxWidth: 220, lineHeight: 1.5 }}>
          Framework breakdown, all rewrites & more
        </div>

        {configured ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, width: '100%', maxWidth: 260, padding: '0 16px' }}>
            <input
              type="email"
              placeholder="your@email.com"
              value={emailInput}
              onChange={e => setEmailInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleUpgrade(); }}
              style={{
                width: '100%', background: '#0d0d1a', border: '1px solid #2a2a3e',
                borderRadius: 7, padding: '8px 12px', fontSize: 12, color: '#e0e0e0',
                outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
              }}
            />
            <button
              onClick={handleUpgrade}
              disabled={loading || !emailInput.includes('@')}
              style={{
                width: '100%', padding: '10px 24px',
                background: loading ? '#333' : `linear-gradient(135deg, ${accentColor}dd, ${accentColor}99)`,
                color: '#fff', fontWeight: 700, fontSize: 13, borderRadius: 8,
                border: `1px solid ${accentColor}`,
                letterSpacing: 0.2, cursor: loading ? 'wait' : 'pointer',
                opacity: !emailInput.includes('@') ? 0.5 : 1,
              }}
            >
              {loading ? 'Redirecting...' : priceLabel}
            </button>
          </div>
        ) : emailSaved ? (
          <div style={{ fontSize: 12, color: '#4caf50', textAlign: 'center', maxWidth: 220 }}>
            You're on the early access list. We'll notify you at launch.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, width: '100%', maxWidth: 260, padding: '0 16px' }}>
            <div style={{ fontSize: 11, color: '#888', textAlign: 'center' }}>Coming soon — leave your email</div>
            <div style={{ display: 'flex', gap: 6, width: '100%' }}>
              <input
                type="email"
                placeholder="your@email.com"
                value={emailInput}
                onChange={e => setEmailInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleEmailCapture(); }}
                style={{
                  flex: 1, background: '#0d0d1a', border: '1px solid #2a2a3e',
                  borderRadius: 7, padding: '8px 10px', fontSize: 12, color: '#e0e0e0',
                  outline: 'none', fontFamily: 'inherit',
                }}
              />
              <button
                onClick={handleEmailCapture}
                disabled={!emailInput.includes('@')}
                style={{
                  padding: '8px 12px', background: accentColor + '33',
                  color: accentColor, fontWeight: 700, fontSize: 11, borderRadius: 7,
                  border: `1px solid ${accentColor}44`, cursor: 'pointer',
                  opacity: !emailInput.includes('@') ? 0.5 : 1,
                  whiteSpace: 'nowrap',
                }}
              >
                Notify me
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const TIERS = [
  {
    name: 'Free',
    price: null as string | null,
    tagline: 'Try it, no strings',
    features: [
      'Score + grade (0–100)',
      'Best rewrite suggestion',
      'Top fix recommendation',
    ],
    cta: 'Current plan',
    highlight: false,
  },
  {
    name: 'Pro',
    price: '$9/mo',
    tagline: 'Everything, unlimited',
    features: [
      'Full framework breakdown',
      'All AI rewrites',
      'A/B compare mode',
      'Score history & tracking',
      'HeadlineGrader + AdScorer + ThreadGrader',
    ],
    cta: 'Get Pro',
    highlight: true,
  },
];

const AUDIENCE_DECODER_TIERS = [
  {
    name: 'Free',
    price: null as string | null,
    tagline: 'Audience snapshot',
    features: [
      'Audience archetypes (3)',
      'Top archetype description',
      'Content score',
    ],
    cta: 'Current plan',
    highlight: false,
  },
  {
    name: 'Deep Report',
    price: '$49',
    tagline: 'One-time · Full intelligence',
    features: [
      'Full engagement model',
      'Content pattern analysis',
      'Growth opportunities',
      'Content calendar',
      'Creator comparison',
    ],
    cta: 'Unlock Report',
    highlight: true,
  },
];

export function PricingTiers({ accentColor, product = 'contentgrade', email }: {
  accentColor: string;
  product?: 'contentgrade' | 'audiencedecoder';
  email?: string;
}) {
  const tiers = product === 'audiencedecoder' ? AUDIENCE_DECODER_TIERS : TIERS;
  const subtitle = product === 'audiencedecoder'
    ? 'One-time unlock · No subscription'
    : 'Free forever · No credit card for trial';

  const [configured, setConfigured] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`${API}/stripe/subscription-status?email=noop@check.com`)
      .then(r => r.json())
      .then(d => {
        if (product === 'audiencedecoder') setConfigured(d.audienceDecoderConfigured ?? false);
        else setConfigured(d.configured ?? false);
      })
      .catch(() => setConfigured(false));
  }, [product]);

  async function handleUpgrade() {
    const targetEmail = (email ?? '').trim().toLowerCase();
    if (!targetEmail || !targetEmail.includes('@')) return;
    setLoading(true);
    localStorage.setItem('bilko_pro_email', targetEmail);
    const priceType = product === 'audiencedecoder' ? 'audiencedecoder_report' : 'contentgrade_pro';
    fireFunnelEvent('upgrade_clicked', { email: targetEmail });
    try {
      const res = await fetch(`${API}/stripe/create-checkout-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail, priceType }),
      });
      const data = await res.json();
      if (data.url) {
        fireFunnelEvent('checkout_started', { email: targetEmail });
        window.location.href = data.url;
      }
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ marginTop: 24 }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 10, color: '#444', textTransform: 'uppercase', letterSpacing: 2, fontFamily: 'monospace', marginBottom: 4 }}>
          {product === 'audiencedecoder' ? 'AudienceDecoder' : 'ContentGrade Suite'}
        </div>
        <div style={{ fontSize: 16, fontWeight: 800, color: '#e0e0e0' }}>
          Upgrade for the full picture
        </div>
        <div style={{ fontSize: 11, color: '#555', marginTop: 4 }}>
          {subtitle}
        </div>
      </div>

      {/* Tier cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
        {tiers.map(tier => (
          <div
            key={tier.name}
            style={{
              background: tier.highlight ? '#12121f' : '#0d0d1a',
              border: `1px solid ${tier.highlight ? accentColor + '55' : '#1a1a2e'}`,
              borderRadius: 12, padding: 16,
              position: 'relative',
              boxShadow: tier.highlight ? `0 0 24px ${accentColor}18` : 'none',
            }}
          >
            {tier.highlight && (
              <div style={{
                position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)',
                background: accentColor, color: '#000', fontSize: 9, fontWeight: 800,
                padding: '2px 10px', borderRadius: 8, letterSpacing: 1, whiteSpace: 'nowrap',
              }}>MOST POPULAR</div>
            )}
            <div style={{ fontWeight: 800, fontSize: 13, color: '#e0e0e0', marginBottom: 2 }}>{tier.name}</div>
            <div style={{ fontSize: 9, color: '#555', marginBottom: 8 }}>{tier.tagline}</div>
            <div style={{
              fontSize: tier.price ? 20 : 13, fontWeight: 800,
              color: tier.price ? accentColor : '#444', marginBottom: 12,
            }}>
              {tier.price ?? 'Free forever'}
            </div>
            <div style={{ marginBottom: 14 }}>
              {tier.features.map(f => (
                <div key={f} style={{
                  fontSize: 10, color: tier.highlight ? '#aaa' : '#666', marginBottom: 5,
                  display: 'flex', alignItems: 'flex-start', gap: 5,
                }}>
                  <span style={{ color: tier.price ? accentColor : '#444', flexShrink: 0 }}>✓</span>
                  {f}
                </div>
              ))}
            </div>
            <button
              disabled={!tier.highlight || !configured || loading || (!email || !email.includes('@'))}
              onClick={tier.highlight && configured ? handleUpgrade : undefined}
              style={{
                width: '100%', padding: '8px 0', fontSize: 11, fontWeight: 700, borderRadius: 7,
                border: tier.highlight ? `1px solid ${accentColor}66` : 'none',
                background: tier.highlight && configured ? accentColor + '33' : tier.highlight ? accentColor + '22' : '#1a1a2e',
                color: tier.highlight ? accentColor : '#444',
                cursor: tier.highlight && configured && email?.includes('@') ? 'pointer' : 'default',
              }}
            >
              {tier.highlight && !tier.price ? tier.cta : tier.highlight && configured === false ? 'Coming soon' : loading ? 'Loading...' : tier.cta}
            </button>
          </div>
        ))}
      </div>

      {configured === false && (
        <div style={{ textAlign: 'center', marginTop: 12, fontSize: 10, color: '#333' }}>
          Pro launches soon · Capture your email above to be first
        </div>
      )}
    </div>
  );
}

// ── RateLimitGate ────────────────────────────────────────────────────────────
// Shown when a user hits their daily limit. Handles upgrade flow to Pro.
export function RateLimitGate({ accentColor = '#7c4dff', product = 'contentgrade_pro', onEmailChange }: {
  accentColor?: string;
  product?: 'contentgrade_pro' | 'audiencedecoder_report';
  onEmailChange?: (email: string) => void;
}) {
  const [emailInput, setEmailInput] = useState(() => localStorage.getItem('bilko_pro_email') ?? '');
  const [loading, setLoading] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);

  // Fire free_limit_hit on first render — this component only mounts when the limit is reached
  useEffect(() => {
    fireFunnelEvent('free_limit_hit');
  }, []);

  useEffect(() => {
    fetch(`${API}/stripe/subscription-status?email=noop@check.com`)
      .then(r => r.json())
      .then(d => {
        if (product === 'audiencedecoder_report') setConfigured(d.audienceDecoderConfigured ?? false);
        else setConfigured(d.configured ?? false);
      })
      .catch(() => setConfigured(false));
  }, [product]);

  function handleEmailChange(e: React.ChangeEvent<HTMLInputElement>) {
    setEmailInput(e.target.value);
    onEmailChange?.(e.target.value);
  }

  async function handleUpgrade() {
    const targetEmail = emailInput.trim().toLowerCase();
    if (!targetEmail || !targetEmail.includes('@')) return;
    setLoading(true);
    localStorage.setItem('bilko_pro_email', targetEmail);
    fireFunnelEvent('upgrade_clicked', { email: targetEmail });
    try {
      const res = await fetch(`${API}/stripe/create-checkout-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail, priceType: product }),
      });
      const data = await res.json();
      if (data.url) {
        fireFunnelEvent('checkout_started', { email: targetEmail });
        window.location.href = data.url;
      }
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }

  const isAD = product === 'audiencedecoder_report';

  return (
    <div style={{
      background: '#12121f',
      border: `1px solid ${accentColor}44`,
      borderRadius: 14,
      padding: '24px 20px',
      marginTop: 16,
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 28, marginBottom: 8 }}>🚧</div>
      <div style={{ fontSize: 15, fontWeight: 800, color: '#e0e0e0', marginBottom: 6 }}>
        Free daily limit reached
      </div>
      <div style={{ fontSize: 12, color: '#666', marginBottom: 20, lineHeight: 1.6 }}>
        You've used your 5 free analyses today.{' '}
        {isAD
          ? 'Purchase the full report ($49 one-time) for 100 analyses/day.'
          : 'Upgrade to Pro ($9/mo) for 100 analyses/day across all 6 tools.'}
        {' '}Or come back tomorrow for 5 more free.
      </div>

      {configured ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, maxWidth: 280, margin: '0 auto' }}>
          <input
            type="email"
            placeholder="your@email.com"
            value={emailInput}
            onChange={handleEmailChange}
            onKeyDown={e => { if (e.key === 'Enter') handleUpgrade(); }}
            style={{
              width: '100%', background: '#0d0d1a', border: '1px solid #2a2a3e',
              borderRadius: 7, padding: '10px 12px', fontSize: 13, color: '#e0e0e0',
              outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
            }}
          />
          <button
            onClick={handleUpgrade}
            disabled={loading || !emailInput.includes('@')}
            style={{
              width: '100%', padding: '11px 24px',
              background: loading ? '#333' : `linear-gradient(135deg, ${accentColor}dd, ${accentColor}99)`,
              color: '#fff', fontWeight: 700, fontSize: 13, borderRadius: 8,
              border: `1px solid ${accentColor}`,
              letterSpacing: 0.2, cursor: loading || !emailInput.includes('@') ? 'not-allowed' : 'pointer',
              opacity: !emailInput.includes('@') ? 0.5 : 1,
            }}
          >
            {loading ? 'Redirecting...' : isAD ? 'Unlock Report — $49' : 'Upgrade to Pro — $9/mo'}
          </button>
          <div style={{ fontSize: 10, color: '#444', marginTop: 2 }}>
            {isAD ? 'One-time payment · Full access' : 'Cancel anytime · Instant access'}
          </div>
        </div>
      ) : configured === false ? (
        <div style={{ fontSize: 12, color: '#555' }}>
          Come back tomorrow for 5 more free analyses.
        </div>
      ) : null}
    </div>
  );
}
