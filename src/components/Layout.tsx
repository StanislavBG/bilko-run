import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { SignedIn, SignedOut, SignInButton, UserButton, useUser } from '@clerk/clerk-react';
import { usePageView, track } from '../hooks/usePageView.js';
import { ADMIN_EMAILS } from '../constants.js';
import { SECTIONS } from '../data/portfolio.js';
import { CommandPalette } from './portfolio/CommandPalette.js';

function useIsAdmin(): boolean {
  const { user } = useUser();
  const email = user?.primaryEmailAddress?.emailAddress?.toLowerCase() ?? '';
  return ADMIN_EMAILS.includes(email);
}

function activeSectionPath(pathname: string): string {
  if (pathname === '/' || pathname === '/home') return '/';
  if (pathname.startsWith('/projects') || pathname.startsWith('/work')) return '/projects';
  if (pathname.startsWith('/products')) return '/projects';
  if (pathname.startsWith('/studio')) return '/studio';
  if (pathname.startsWith('/blog')) return '/blog';
  if (pathname.startsWith('/skills')) return '/skills';
  if (pathname.startsWith('/academy')) return '/academy';
  if (pathname.startsWith('/workflows')) return '/workflows';
  if (pathname.startsWith('/contact')) return '/contact';
  return pathname;
}

export function Layout() {
  usePageView();
  const isAdmin = useIsAdmin();
  const navigate = useNavigate();
  const location = useLocation();
  const [cmdOpen, setCmdOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCmdOpen(o => !o);
      }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);

  const activePath = activeSectionPath(location.pathname);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  return (
    <div className="portfolio-shell">
      <header className="pf-topbar">
        <Link to="/" className="pf-brand" onClick={() => setMobileOpen(false)}>
          <span className="pf-mark">B</span>
          <span>Bilko Bibitkov</span>
        </Link>
        <nav>
          {SECTIONS.map(s => (
            <NavLink
              key={s.id}
              to={s.path}
              className={() => (activePath === s.path ? 'active' : '')}
              end={s.path === '/'}
            >
              {s.label}
            </NavLink>
          ))}
        </nav>
        <div className="pf-right">
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontFamily: 'var(--pf-font-mono)', fontSize: 11,
            color: 'var(--pf-ink-3)', letterSpacing: '0.08em', textTransform: 'uppercase',
          }}>
            <span className="pf-status-dot"></span>
            Online
          </span>
          <button className="pf-kbd" onClick={() => setCmdOpen(true)} title="Search (⌘K)">
            <span>Search</span>
            <span style={{ opacity: 0.6 }}>⌘K</span>
          </button>
          <SignedOut>
            <SignInButton mode="modal" forceRedirectUrl={window.location.pathname}>
              <button
                onClick={() => track('signin_click')}
                className="pf-kbd"
                style={{ borderColor: 'var(--pf-ink)', color: 'var(--pf-ink)' }}
              >
                Sign in
              </button>
            </SignInButton>
          </SignedOut>
          <SignedIn>
            <UserButton appearance={{ elements: { avatarBox: 'w-7 h-7' } }} />
          </SignedIn>
          {isAdmin && (
            <NavLink to="/admin" className="pf-kbd" style={{ color: 'var(--pf-accent)', borderColor: 'var(--pf-accent)' }}>
              Admin
            </NavLink>
          )}
          <button
            className="pf-kbd pf-mobile-trigger"
            onClick={() => setMobileOpen(o => !o)}
            aria-label="Menu"
          >
            <span>Menu</span>
          </button>
        </div>
      </header>

      {mobileOpen && (
        <div className="pf-mobile-menu" onClick={() => setMobileOpen(false)}>
          <div className="pf-mobile-sheet" onClick={e => e.stopPropagation()}>
            <div className="pf-eyebrow" style={{ marginBottom: 12 }}>Sections</div>
            {SECTIONS.map(s => (
              <Link key={s.id} to={s.path} className={'pf-mobile-link ' + (activePath === s.path ? 'active' : '')}>
                <span className="pf-mobile-icon">{s.icon}</span>
                <span>{s.label}</span>
                <span className="pf-mobile-tag">{s.tag}</span>
              </Link>
            ))}
            <div className="pf-eyebrow" style={{ marginTop: 24, marginBottom: 12 }}>Elsewhere</div>
            <a href="https://github.com/StanislavBG" target="_blank" rel="noopener noreferrer" className="pf-mobile-link">GitHub ↗</a>
            <a href="https://x.com/BilkoBibitkov" target="_blank" rel="noopener noreferrer" className="pf-mobile-link">Twitter ↗</a>
            <a href="mailto:bilko@bilko.run" className="pf-mobile-link">Email ↗</a>
          </div>
        </div>
      )}

      <main>
        <Outlet />
      </main>

      <footer className="pf-footer">
        <div className="pf-col">
          <div className="pf-sig">Bilko <em>Bibitkov</em></div>
          <div style={{ opacity: 0.7, maxWidth: 300 }}>
            Relentless believer. Regular human. Building AI things from a small studio.
          </div>
          <div className="pf-meta-line">© {new Date().getFullYear()} · bilko.run</div>
        </div>
        <div className="pf-col">
          <h4>Sections</h4>
          {SECTIONS.slice(0, 4).map(s => (
            <Link key={s.id} to={s.path}>{s.label}</Link>
          ))}
        </div>
        <div className="pf-col">
          <h4>More</h4>
          {SECTIONS.slice(4).map(s => (
            <Link key={s.id} to={s.path}>{s.label}</Link>
          ))}
        </div>
        <div className="pf-col">
          <h4>Elsewhere</h4>
          <a href="https://github.com/StanislavBG" target="_blank" rel="noopener noreferrer">GitHub →</a>
          <a href="https://x.com/BilkoBibitkov" target="_blank" rel="noopener noreferrer">Twitter →</a>
          <a href="mailto:bilko@bilko.run">Email →</a>
          <Link to="/privacy">Privacy →</Link>
          <Link to="/terms">Terms →</Link>
        </div>
      </footer>

      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />
    </div>
  );
}
