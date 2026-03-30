import { Link, NavLink, Outlet } from 'react-router-dom';
import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/clerk-react';

const NAV_LINKS = [
  { to: '/projects', label: 'Projects' },
  { to: '/projects/page-roast', label: 'PageRoast' },
] as const;

export function Layout() {
  return (
    <div className="min-h-screen bg-warm-50 flex flex-col">
      <header className="sticky top-0 z-50 backdrop-blur-md bg-warm-50/80 border-b border-warm-200/60">
        <nav className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group">
            <span className="text-xl font-extrabold tracking-tight text-warm-900 group-hover:text-fire-600 transition-colors">
              bilko<span className="text-fire-500">.run</span>
            </span>
          </Link>

          <div className="flex items-center gap-1">
            {NAV_LINKS.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                    isActive
                      ? 'bg-warm-200/60 text-warm-900'
                      : 'text-warm-600 hover:text-warm-900 hover:bg-warm-100'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
            <div className="ml-2">
              <SignedOut>
                <SignInButton mode="modal">
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
        </nav>
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
          <div className="mt-10 pt-6 border-t border-warm-200/40 text-xs text-warm-400">
            Built with unreasonable ambition by Bilko.
          </div>
        </div>
      </footer>
    </div>
  );
}
