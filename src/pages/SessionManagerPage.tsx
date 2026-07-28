import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth.js';
import { startSessionManagerCheckout } from '../lib/sessionManagerCheckout.js';

interface Feature {
  title: string;
  description: string;
}

const FEATURES: readonly Feature[] = [
  { title: 'Scheduler', description: 'Author PRDs, run them as claude -p jobs around the 5h token window, auto-pause and auto-resume.' },
  { title: 'Subagents · Hive', description: 'Fan work across a live hive of subagents instead of one linear session.' },
  { title: 'History', description: 'Every session, fully resumable — pick up exactly where you left off.' },
  { title: 'Usage', description: 'Live token and cost burn-rate, right in the app.' },
  { title: 'Voice', description: 'Local Whisper push-to-talk — nothing leaves the machine.' },
  { title: 'Browser', description: 'An embedded dev browser Claude can drive directly.' },
  { title: 'Web Remote', description: 'Pair your phone and issue commands over a self-hosted relay.' },
  { title: 'Everything, one cockpit', description: '25+ config and observability surfaces, one left-nav.' },
];

function PurchaseSection() {
  const { email: savedEmail, setEmail } = useAuth();
  const [emailInput, setEmailInput] = useState(savedEmail);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = emailInput.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('Enter a valid email address.');
      return;
    }
    setError(null);
    setLoading(true);
    setEmail(trimmed);
    const result = await startSessionManagerCheckout(trimmed);
    setLoading(false);
    if (!result.ok) {
      setError(result.error ?? 'Something went wrong. Please try again.');
    }
  }

  return (
    <section className="max-w-2xl mx-auto px-6 pb-20 md:pb-28 text-center">
      <h2 className="text-display-lg text-warm-900">Support the build</h2>
      <p className="mt-4 text-warm-500 leading-relaxed">
        Session Manager is free and open source — this is a one-time, pay-what-you-want way to
        back the project.
      </p>
      <form onSubmit={handleSubmit} className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
        <input
          type="email"
          required
          value={emailInput}
          onChange={(e) => setEmailInput(e.target.value)}
          placeholder="you@example.com"
          aria-label="Email"
          className="flex-1 sm:max-w-xs px-4 py-3 rounded-xl border border-warm-200 text-warm-900 placeholder:text-warm-400 focus:outline-none focus:ring-2 focus:ring-fire-400"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-3 text-sm font-bold text-white bg-fire-500 hover:bg-fire-600 rounded-xl shadow-md shadow-fire-500/20 transition-all disabled:opacity-60"
        >
          {loading ? 'Redirecting…' : 'Support Session Manager'}
        </button>
      </form>
      {error && (
        <p role="alert" className="mt-4 text-sm text-red-600">
          {error}
        </p>
      )}
    </section>
  );
}

export default function SessionManagerPage() {
  useEffect(() => {
    document.title = 'Session Manager — bilko.run';
    return () => { document.title = 'Bilko.run — Tools for Makers Who Ship'; };
  }, []);

  return (
    <>
      <section className="max-w-4xl mx-auto px-6 pt-16 pb-10 md:pt-24 md:pb-14 text-center">
        <h1 className="text-display-xl text-warm-900">
          One cockpit for every Claude Code session.
        </h1>
        <p className="mt-5 text-lg text-warm-500 leading-relaxed">
          A local desktop cockpit for the Claude Code CLI — scheduler, subagent hive, full
          session history, live usage, voice, an embedded browser, and a self-hosted web remote,
          all in one left-nav.
        </p>
      </section>

      <section className="max-w-5xl mx-auto px-6 pb-16 md:pb-20">
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-5">
          {FEATURES.map((f) => (
            <div key={f.title} className="bg-white rounded-2xl shadow-elevation-1 p-6">
              <h3 className="text-sm font-bold text-warm-900">{f.title}</h3>
              <p className="mt-2 text-sm text-warm-500 leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      <PurchaseSection />
    </>
  );
}
