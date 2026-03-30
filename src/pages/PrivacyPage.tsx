import { useEffect } from 'react';

export function PrivacyPage() {
  useEffect(() => {
    document.title = 'Privacy Policy — bilko.run';
    return () => { document.title = 'Bilko.run — Tools for Makers Who Ship'; };
  }, []);

  return (
    <section className="max-w-3xl mx-auto px-6 py-16 md:py-24">
      <h1 className="text-3xl font-extrabold text-warm-900 mb-2">Privacy Policy</h1>
      <p className="text-sm text-warm-400 mb-10">Last updated: March 29, 2026</p>

      <div className="prose-warm space-y-8 text-warm-700 text-sm leading-relaxed">
        <div>
          <h2 className="text-lg font-bold text-warm-900 mb-2">1. What bilko.run Is</h2>
          <p>bilko.run is a collection of AI-powered tools for marketers, founders, and makers. Our flagship tool, PageRoast, analyzes landing pages and provides conversion feedback. The service is operated by Bilko (Stanislav Bibitkov) as a solo venture.</p>
        </div>

        <div>
          <h2 className="text-lg font-bold text-warm-900 mb-2">2. Data We Collect</h2>
          <p>We collect the minimum data needed to operate:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li><strong>Account data:</strong> Email address and name provided via Clerk (our authentication provider) when you sign in with Google or email.</li>
            <li><strong>Usage data:</strong> URLs you submit for analysis, scores generated, and credit balances.</li>
            <li><strong>Payment data:</strong> Processed by Stripe. We never see or store your card number. We store your email and Stripe customer ID for credit delivery.</li>
            <li><strong>Analytics:</strong> Page views and funnel events (anonymized IP hash, tool used). No personal tracking cookies.</li>
          </ul>
        </div>

        <div>
          <h2 className="text-lg font-bold text-warm-900 mb-2">3. How We Use Your Data</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>To provide the service (analyzing pages, managing credits).</li>
            <li>To process payments via Stripe.</li>
            <li>To display anonymized roast results on the "Wall of Shame" (domain and score only, no email or personal info).</li>
            <li>To prevent abuse (rate limiting via hashed IP).</li>
          </ul>
          <p className="mt-2">We do <strong>not</strong> sell, share, or rent your data to third parties for marketing.</p>
        </div>

        <div>
          <h2 className="text-lg font-bold text-warm-900 mb-2">4. Page Content</h2>
          <p>When you submit a URL, we fetch the publicly accessible HTML of that page. We extract text content for AI analysis. <strong>We do not store your page content after analysis.</strong> Only the domain, score, grade, and roast line are retained.</p>
        </div>

        <div>
          <h2 className="text-lg font-bold text-warm-900 mb-2">5. Third-Party Services</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Clerk</strong> — Authentication. Manages sign-in, sessions, and user data. <a href="https://clerk.com/privacy" className="text-fire-600 underline" target="_blank" rel="noopener noreferrer">Clerk Privacy Policy</a></li>
            <li><strong>Stripe</strong> — Payment processing. Handles all financial transactions. <a href="https://stripe.com/privacy" className="text-fire-600 underline" target="_blank" rel="noopener noreferrer">Stripe Privacy Policy</a></li>
            <li><strong>Google Gemini</strong> — AI analysis. Page content is sent to Google's Gemini API for scoring. <a href="https://policies.google.com/privacy" className="text-fire-600 underline" target="_blank" rel="noopener noreferrer">Google Privacy Policy</a></li>
            <li><strong>Render</strong> — Hosting. <a href="https://render.com/privacy" className="text-fire-600 underline" target="_blank" rel="noopener noreferrer">Render Privacy Policy</a></li>
          </ul>
        </div>

        <div>
          <h2 className="text-lg font-bold text-warm-900 mb-2">6. Your Rights</h2>
          <p>You can:</p>
          <ul className="list-disc pl-5 mt-1 space-y-1">
            <li>Request a copy of your data.</li>
            <li>Request deletion of your account and data.</li>
            <li>Manage your Clerk account settings directly.</li>
            <li>Manage your Stripe billing via the customer portal.</li>
          </ul>
          <p className="mt-2">To exercise these rights, email <strong>bilko@bilko.run</strong>.</p>
        </div>

        <div>
          <h2 className="text-lg font-bold text-warm-900 mb-2">7. Data Retention</h2>
          <p>Account data is retained while your account is active. Roast history (domain + score) is retained indefinitely for the Wall of Shame feature. Payment records are retained as required by law. You can request deletion at any time.</p>
        </div>

        <div>
          <h2 className="text-lg font-bold text-warm-900 mb-2">8. Children</h2>
          <p>bilko.run is not intended for users under 13. We do not knowingly collect data from children.</p>
        </div>

        <div>
          <h2 className="text-lg font-bold text-warm-900 mb-2">9. Changes</h2>
          <p>We may update this policy. Changes will be posted on this page with an updated date. Continued use of the service constitutes acceptance.</p>
        </div>

        <div>
          <h2 className="text-lg font-bold text-warm-900 mb-2">10. Contact</h2>
          <p>Questions? Email <strong>bilko@bilko.run</strong>.</p>
        </div>
      </div>
    </section>
  );
}
