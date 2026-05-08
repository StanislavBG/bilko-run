import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PACKAGES, type Package } from '../data/packages.js';
import { track } from '../hooks/usePageView.js';
import { PageHeader } from '../components/portfolio/PageHeader.js';

const CATEGORY_BADGE: Record<Package['category'], string> = {
  CLI:     'bg-warm-100 text-warm-800',
  Library: 'bg-warm-100 text-warm-800',
  Kit:     'bg-fire-50 text-fire-700',
  App:     'bg-warm-100 text-warm-800',
};

function PackageCard({ pkg }: { pkg: Package }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    void navigator.clipboard.writeText(pkg.install);
    setCopied(true);
    track('packages_install_copy', { tool: pkg.slug });
    setTimeout(() => setCopied(false), 1400);
  }

  return (
    <article id={pkg.slug} className="bg-white rounded-2xl border border-warm-200/60 p-5 shadow-sm hover:shadow transition-shadow">
      <header className="flex items-start justify-between gap-3 mb-2">
        <div>
          <h3 className="text-base font-black text-warm-900">{pkg.name}</h3>
          <p className="text-xs font-mono text-warm-500 mt-0.5">{pkg.npmName}</p>
        </div>
        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${CATEGORY_BADGE[pkg.category]}`}>
          {pkg.category}
        </span>
      </header>
      <p className="text-sm text-warm-700 leading-relaxed mb-3">{pkg.description}</p>
      <button
        onClick={copy}
        className="w-full text-left bg-warm-50 hover:bg-warm-100 border border-warm-200/60 rounded-lg px-3 py-2 font-mono text-xs text-warm-800 transition-colors group"
        aria-label={`Copy install command for ${pkg.name}`}
      >
        <span className="text-warm-500">$</span> {pkg.install}
        <span className="float-right text-[10px] font-bold uppercase tracking-wider text-fire-500 opacity-0 group-hover:opacity-100 transition-opacity">
          {copied ? 'copied' : 'copy'}
        </span>
      </button>
      <div className="flex gap-3 mt-3 text-xs font-bold">
        <a href={pkg.npm} target="_blank" rel="noopener noreferrer" className="text-fire-500 hover:text-fire-600">npm →</a>
        <a href={pkg.github} target="_blank" rel="noopener noreferrer" className="text-warm-600 hover:text-warm-900">GitHub →</a>
      </div>
    </article>
  );
}

export function PackagesPage() {
  useEffect(() => {
    document.title = 'Packages — Bilko Bibitkov';
    track('page_view', { tool: 'packages' });
    return () => { document.title = 'Bilko — AI Advisory for Small Business'; };
  }, []);

  const publicPkgs = PACKAGES.filter(p => p.scope === 'public');
  const paidPkgs   = PACKAGES.filter(p => p.scope === 'paid');

  return (
    <div className="pf-page">
      <PageHeader
        eyebrow="Open source"
        title="Packages."
        lede="CLI tools and libraries you can install with one line. No signup, no telemetry on by default. Most are MIT; a few of the agent-pipeline CLIs require a license key."
        what={`${PACKAGES.length} packages live on npm. See pricing for license-key CLIs.`}
      />

      <div className="max-w-2xl space-y-3 mb-10">
        {publicPkgs.map(p => <PackageCard key={p.slug} pkg={p} />)}
      </div>

      {paidPkgs.length > 0 && (
        <>
          <div className="mb-4 mt-12">
            <h2 className="text-xl font-black text-warm-900">Paid (license required)</h2>
            <p className="mt-1 text-sm text-warm-600">
              Free to install; require a license key from <Link to="/pricing" className="text-fire-500 hover:text-fire-600">pricing</Link>.
            </p>
          </div>
          <div className="max-w-2xl space-y-3">
            {paidPkgs.map(p => <PackageCard key={p.slug} pkg={p} />)}
          </div>
        </>
      )}
    </div>
  );
}
