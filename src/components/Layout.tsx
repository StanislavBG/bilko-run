import { useState, useRef, useEffect } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { SignedIn, SignedOut, SignInButton, UserButton, useUser } from '@clerk/clerk-react';
import { usePageView } from '../hooks/usePageView.js';
import { ADMIN_EMAILS } from '../constants.js';

const PROJECT_LINKS = [
  { to: '/projects/page-roast', label: 'PageRoast', badge: '🔥' },
  { to: '/projects/headline-grader', label: 'HeadlineGrader' },
  { to: '/projects/ad-scorer', label: 'AdScorer' },
  { to: '/projects/thread-grader', label: 'ThreadGrader' },
  { to: '/projects/email-forge', label: 'EmailForge' },
  { to: '/projects/audience-decoder', label: 'AudienceDecoder' },
  { to: '/projects/stepproof', label: 'Stepproof' },
  { to: '/projects', label: 'All Projects' },
] as const;

function ProjectsDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
          open ? 'bg-warm-200/60 text-warm-900' : 'text-warm-600 hover:text-warm-900 hover:bg-warm-100'
        }`}
      >
        Projects
        <svg className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-52 bg-white rounded-xl border border-warm-200/60 shadow-lg shadow-warm-200/30 py-1.5 animate-fade-in z-50">
          {PROJECT_LINKS.map(({ to, label, ...rest }) => (
            <Link
              key={to}
              to={to}
              onClick={() => setOpen(false)}
              className="flex items-center justify-between px-4 py-2.5 text-sm text-warm-700 hover:bg-warm-50 hover:text-fire-600 transition-colors"
            >
              {label}
              {'badge' in rest && <span className="text-xs">{(rest as any).badge}</span>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function useIsAdmin(): boolean {
  const { user } = useUser();
  const email = user?.primaryEmailAddress?.emailAddress?.toLowerCase() ?? '';
  return ADMIN_EMAILS.includes(email);
}

export function Layout() {
  usePageView();
  const isAdmin = useIsAdmin();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-warm-50 flex flex-col">
      <header className="sticky top-0 z-50 backdrop-blur-md bg-warm-50/80 border-b border-warm-200/60">
        <nav className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group" onClick={() => setMobileOpen(false)}>
            <span className="text-xl font-extrabold tracking-tight text-warm-900 group-hover:text-fire-600 transition-colors">
              bilko<span className="text-fire-500">.run</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            <ProjectsDropdown />

            <NavLink
              to="/blog"
              className={({ isActive }) =>
                `px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                  isActive
                    ? 'bg-warm-200/60 text-warm-900'
                    : 'text-warm-600 hover:text-warm-900 hover:bg-warm-100'
                }`
              }
            >
              Blog
            </NavLink>

            <NavLink
              to="/pricing"
              className={({ isActive }) =>
                `px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                  isActive
                    ? 'bg-warm-200/60 text-warm-900'
                    : 'text-warm-600 hover:text-warm-900 hover:bg-warm-100'
                }`
              }
            >
              Pricing
            </NavLink>

            <Link
              to="/projects/page-roast"
              className="px-4 py-2 text-sm font-bold text-white bg-fire-500 hover:bg-fire-600 rounded-lg shadow-sm shadow-fire-500/20 transition-all"
            >
              Try Free
            </Link>

            {isAdmin && (
              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  `px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    isActive
                      ? 'bg-fire-100 text-fire-700'
                      : 'text-fire-400 hover:text-fire-600 hover:bg-fire-50'
                  }`
                }
              >
                Admin
              </NavLink>
            )}

            <div className="ml-2">
              <SignedOut>
                <SignInButton mode="modal" forceRedirectUrl={window.location.pathname}>
                  <button className="px-4 py-2 text-sm font-medium text-warm-600 hover:text-warm-900 hover:bg-warm-100 rounded-lg transition-all">
                    Sign in
                  </button>
                </SignInButton>
              </SignedOut>
              <SignedIn>
                <UserButton
                  appearance={{
                    elements: { avatarBox: 'w-8 h-8' }
                  }}
                />
              </SignedIn>
            </div>
          </div>

          {/* Mobile: auth + hamburger */}
          <div className="flex md:hidden items-center gap-2">
            <SignedIn>
              <UserButton appearance={{ elements: { avatarBox: 'w-7 h-7' } }} />
            </SignedIn>
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="p-2 text-warm-600 hover:text-warm-900 rounded-lg hover:bg-warm-100 transition-all"
              aria-label="Menu"
            >
              {mobileOpen ? (
                <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" /></svg>
              )}
            </button>
          </div>
        </nav>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden border-t border-warm-200/60 bg-warm-50/95 backdrop-blur-md px-6 py-4 space-y-1 animate-fade-in">
            {[
              { to: '/projects/page-roast', label: 'PageRoast' },
              { to: '/projects', label: 'All Projects' },
              { to: '/blog', label: 'Blog' },
              { to: '/pricing', label: 'Pricing' },
              ...(isAdmin ? [{ to: '/admin', label: 'Admin' }] : []),
            ].map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                onClick={() => setMobileOpen(false)}
                className="block px-4 py-2.5 text-sm font-medium text-warm-700 hover:bg-warm-100 hover:text-fire-600 rounded-lg transition-colors"
              >
                {label}
              </Link>
            ))}
            <SignedOut>
              <SignInButton mode="modal" forceRedirectUrl={window.location.pathname}>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="w-full px-4 py-2.5 text-sm font-medium text-fire-600 hover:bg-fire-50 rounded-lg transition-colors text-left"
                >
                  Sign in
                </button>
              </SignInButton>
            </SignedOut>
          </div>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-warm-200/60 bg-warm-100/50">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="flex flex-col md:flex-row justify-between items-start gap-8">
            <div>
              <span className="text-lg font-extrabold text-warm-900">
                bilko<span className="text-fire-500">.run</span>
              </span>
              <p className="mt-2 text-sm text-warm-500 max-w-xs">
                Free AI-powered tools for people who make things on the internet.
              </p>
            </div>
            <div className="flex gap-12 text-sm">
              <div>
                <h4 className="font-semibold text-warm-700 mb-3">Tools</h4>
                <div className="flex flex-col gap-2">
                  <Link to="/projects/page-roast" className="text-warm-500 hover:text-fire-600 transition-colors">PageRoast</Link>
                  <Link to="/projects" className="text-warm-500 hover:text-fire-600 transition-colors">All Projects</Link>
                  <Link to="/blog" className="text-warm-500 hover:text-fire-600 transition-colors">Blog</Link>
                  <Link to="/pricing" className="text-warm-500 hover:text-fire-600 transition-colors">Pricing</Link>
                </div>
              </div>
              <div>
                <h4 className="font-semibold text-warm-700 mb-3">Connect</h4>
                <div className="flex flex-col gap-2">
                  <a href="https://x.com/BilkoBibitkov" target="_blank" rel="noopener noreferrer" className="text-warm-500 hover:text-fire-600 transition-colors">X / Twitter</a>
                  <a href="https://www.linkedin.com/in/bilko-bibitkov-23b5b13b1/" target="_blank" rel="noopener noreferrer" className="text-warm-500 hover:text-fire-600 transition-colors">LinkedIn</a>
                  <a href="https://github.com/BilkoBibitkov" target="_blank" rel="noopener noreferrer" className="text-warm-500 hover:text-fire-600 transition-colors">GitHub</a>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-10 pt-6 border-t border-warm-200/40 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-warm-400">
            <span>Built with unreasonable ambition by Bilko.</span>
            <div className="flex items-center gap-4">
              <Link to="/privacy" className="hover:text-warm-600 transition-colors">Privacy Policy</Link>
              <Link to="/terms" className="hover:text-warm-600 transition-colors">Terms of Service</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
