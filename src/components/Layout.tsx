import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { SignedIn, SignedOut, SignInButton, UserButton, useAuth } from '@clerk/clerk-react';
import { track, trackFlow } from '../lib/telemetry.js';
import { useIsAdmin } from '../hooks/useAdmin.js';
import { NOW_ITEMS, SECTIONS } from '../data/portfolio.js';
import { CommandPalette } from './portfolio/CommandPalette.js';
import { fetchMe, type ForumMember } from '../lib/forumClient.js';
import { useForumToast } from '../pages/forum/ForumToast.js';

const HandleModal = lazy(() => import('../pages/forum/HandleModal.js').then(m => ({ default: m.HandleModal })));

function searchShortcutLabel(): string {
  if (typeof navigator === 'undefined') return 'Ctrl K';
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  const platform = nav.userAgentData?.platform || nav.platform || nav.userAgent || '';
  return /mac|iphone|ipad|ipod/i.test(platform) ? '⌘K' : 'Ctrl K';
}

function activeSectionPath(pathname: string): string {
  if (pathname === '/' || pathname === '/home') return '/';
  if (pathname.startsWith('/projects') || pathname.startsWith('/work')) return '/projects';
  if (pathname.startsWith('/products')) return '/projects';
  if (pathname.startsWith('/studio') || pathname.startsWith('/games')) return '/projects';
  if (pathname.startsWith('/blog')) return '/blog';
  if (pathname.startsWith('/contact')) return '/contact';
  if (pathname.startsWith('/forum')) return '/forum';
  return pathname;
}

const NOW_ROTATE_MS = 12000;
const NOW_FADE_MS = 400;

const NAV_SECTIONS = SECTIONS.filter(s => s.id !== 'home');

export function Layout() {
  const isAdmin = useIsAdmin();
  const location = useLocation();
  const [cmdOpen, setCmdOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [nowIdx, setNowIdx] = useState(0);
  const [nowFading, setNowFading] = useState(false);
  const pausedRef = useRef({ hover: false, focus: false });
  const isHome = location.pathname === '/';
  const onForum = location.pathname.startsWith('/forum');
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [member, setMember] = useState<ForumMember | null>(null);
  const [handleOpen, setHandleOpen] = useState(false);
  const { flash, toast } = useForumToast();

  useEffect(() => {
    if (!onForum || !isLoaded || !isSignedIn) { setMember(null); return; }
    let live = true;
    fetchMe(getToken).then(res => { if (live && res.ok) setMember(res.member); });
    return () => { live = false; };
  }, [onForum, isLoaded, isSignedIn, getToken]);

  function onHandleSaved(next: ForumMember) {
    const was = member?.handle;
    setMember(next);
    setHandleOpen(false);
    flash(was && was !== next.handle ? `Renamed. Every post now says @${next.handle}.` : `You're @${next.handle}.`);
  }

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let swap: ReturnType<typeof setTimeout> | undefined;
    const id = setInterval(() => {
      if (pausedRef.current.hover || pausedRef.current.focus) return;
      setNowFading(true);
      swap = setTimeout(() => {
        setNowIdx(i => (i + 1) % NOW_ITEMS.length);
        setNowFading(false);
      }, NOW_FADE_MS);
    }, NOW_ROTATE_MS);
    return () => { clearInterval(id); clearTimeout(swap); };
  }, []);

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
      <header className="bk-header">
        <Link to="/" className="bk-brand" onClick={() => setMobileOpen(false)}>
          <span className="bk-mark">B</span>
          <span className="bk-brand-name">Bilko Bibitkov</span>
        </Link>
        <nav className="bk-nav" aria-label="Primary">
          {NAV_SECTIONS.map((s, i) => (
            <NavLink
              key={s.id}
              to={s.path}
              data-track={`nav-${s.id}`}
              data-home-flip={s.id}
              className={() => 'bk-pill-nav' + (activePath === s.path ? ' active' : '')}
            >
              <span className="bk-num">{String(i + 1).padStart(2, '0')}</span>
              {s.label}
            </NavLink>
          ))}
        </nav>
        <div className="bk-right">
          <span className="bk-online">
            <span className="bk-online-dot"></span>
            Online
          </span>
          <button className="bk-chip" onClick={() => setCmdOpen(true)} title={`Search (${searchShortcutLabel()})`}>
            <span>Search</span>
            <span style={{ opacity: 0.6 }}>{searchShortcutLabel()}</span>
          </button>
          <SignedOut>
            <SignInButton mode="modal" forceRedirectUrl={window.location.pathname}>
              <button onClick={() => track('signin_click')} className="bk-chip bk-chip-strong">
                Sign in
              </button>
            </SignInButton>
          </SignedOut>
          <SignedIn>
            {onForum && (
              <button
                type="button"
                className={'bk-handle-chip' + (member ? '' : ' unset')}
                title={member ? 'Change your handle' : undefined}
                onClick={() => setHandleOpen(true)}
              >
                {member ? `@${member.handle} ✎` : 'Set handle'}
              </button>
            )}
            <UserButton appearance={{ elements: { avatarBox: 'w-7 h-7' } }} />
          </SignedIn>
          {isAdmin && (
            <>
              <NavLink to="/admin" className="bk-chip bk-chip-accent">Admin</NavLink>
              <NavLink to="/admin/observability" className="bk-chip bk-chip-accent">Observability</NavLink>
            </>
          )}
          <button
            className="bk-chip pf-mobile-trigger"
            onClick={() => setMobileOpen(o => !o)}
            aria-label="Menu"
          >
            <span>Menu</span>
          </button>
        </div>
      </header>

      {onForum && handleOpen && (
        <Suspense fallback={null}>
          <HandleModal
            open
            currentHandle={member?.handle ?? null}
            pending={false}
            onClose={() => setHandleOpen(false)}
            onSaved={onHandleSaved}
          />
        </Suspense>
      )}
      {toast}

      {mobileOpen && (
        <div className="pf-mobile-menu" onClick={() => setMobileOpen(false)}>
          <div className="pf-mobile-sheet" onClick={e => e.stopPropagation()}>
            <div className="pf-eyebrow" style={{ marginBottom: 12 }}>Sections</div>
            {SECTIONS.map(s =>
              s.href ? (
                <a key={s.id} href={s.href} data-track={`nav-${s.id}`} className={'pf-mobile-link ' + (activePath === s.path ? 'active' : '')}>
                  <span className="pf-mobile-icon">{s.icon}</span>
                  <span>{s.label}</span>
                  <span className="pf-mobile-tag">{s.tag}</span>
                </a>
              ) : (
                <Link key={s.id} to={s.path} data-track={`nav-${s.id}`} className={'pf-mobile-link ' + (activePath === s.path ? 'active' : '')}>
                  <span className="pf-mobile-icon">{s.icon}</span>
                  <span>{s.label}</span>
                  <span className="pf-mobile-tag">{s.tag}</span>
                </Link>
              ),
            )}
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

      <footer
        className="bk-bottombar"
        onMouseEnter={() => { pausedRef.current.hover = true; }}
        onMouseLeave={() => { pausedRef.current.hover = false; }}
        onFocus={() => { pausedRef.current.focus = true; }}
        onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) pausedRef.current.focus = false; }}
      >
        <div className="bk-bb-left">
          <span className="bk-bb-label">Currently →</span>
          <span className={`bk-bb-now${nowFading ? ' is-fading' : ''}`}>{NOW_ITEMS[nowIdx]}</span>
        </div>
        <div className="bk-bb-center">
          {isHome ? (
            <Link to="/projects" data-home-flip="projects" data-track="home-flip-hint" className="bk-bb-hint">
              <span className="bk-bb-arrow">↓</span> Scroll to flip into Projects · or press 1 · 2 · 3
            </Link>
          ) : (
            <>
              <Link to="/privacy" data-track="footer-privacy">Privacy</Link>
              <Link to="/terms" data-track="footer-terms">Terms</Link>
              <a href="https://github.com/StanislavBG" target="_blank" rel="noopener noreferrer" data-track="footer-github">GitHub</a>
              <a href="mailto:bilko@bilko.run" data-track="footer-email">Email</a>
            </>
          )}
        </div>
        <div className="bk-bb-right">
          <a href="/coffee" data-track="tip-coffee" className="bk-bb-coffee" onClick={() => trackFlow('tip', 'click-tip', { product: 'coffee', area: 'footer' })}>Buy me a coffee →</a>
          <span className="bk-bb-small">
            <Link to="/privacy" data-track="footer-privacy">Privacy</Link>
            <Link to="/terms" data-track="footer-terms">Terms</Link>
          </span>
        </div>
      </footer>

      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />
    </div>
  );
}
