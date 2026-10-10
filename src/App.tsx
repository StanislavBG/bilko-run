import React, { useEffect } from 'react';
import { ClerkProvider } from '@clerk/clerk-react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Layout } from './components/Layout.js';
import { ToolErrorBoundary } from './components/ErrorBoundary.js';
import { HomePage } from './pages/HomePage.js';
import { ProjectsPage } from './pages/ProjectsPage.js';
import { BlogPage } from './pages/BlogPage.js';
import { NotFoundPage } from './pages/NotFoundPage.js';
import { PROJECTS } from './data/projectsRegistry.js';

// One full reload per tab session when a lazy chunk fails to load (typically a
// 404 after a deploy replaced the hashed filenames). The sessionStorage flag
// stops a reload loop: a second failure propagates to the ErrorBoundary.
const CHUNK_RELOAD_FLAG = 'chunk-reload-attempted';

function lazyWithRetry<T extends React.ComponentType<any>>(factory: () => Promise<{ default: T }>) {
  return React.lazy(async () => {
    try {
      const mod = await factory();
      sessionStorage.removeItem(CHUNK_RELOAD_FLAG);
      return mod;
    } catch (err) {
      if (sessionStorage.getItem(CHUNK_RELOAD_FLAG) !== '1') {
        sessionStorage.setItem(CHUNK_RELOAD_FLAG, '1');
        window.location.reload();
        // Keep Suspense pending while the page reloads.
        return new Promise<{ default: T }>(() => {});
      }
      throw err;
    }
  });
}

// Lazy-loaded pages. Declared here with lazyWithRetry so each page is its own chunk.
const PricingPage = lazyWithRetry(() => import('./pages/PricingPage.js').then(m => ({ default: m.PricingPage })));
const PrivacyPage = lazyWithRetry(() => import('./pages/PrivacyPage.js').then(m => ({ default: m.PrivacyPage })));
const TermsPage = lazyWithRetry(() => import('./pages/TermsPage.js').then(m => ({ default: m.TermsPage })));
const AdminPage = lazyWithRetry(() => import('./pages/AdminPage.js').then(m => ({ default: m.AdminPage })));
const AdminCostPage = lazyWithRetry(() => import('./pages/AdminCostPage.js').then(m => ({ default: m.AdminCostPage })));
const ObservabilityPage = lazyWithRetry(() => import('./pages/admin/ObservabilityPage.js').then(m => ({ default: m.ObservabilityPage })));
const SecretsPage = lazyWithRetry(() => import('./pages/admin/SecretsPage.js').then(m => ({ default: m.SecretsPage })));
const ContactPage = lazyWithRetry(() => import('./pages/ContactPage.js').then(m => ({ default: m.ContactPage })));
const PortfolioProjectDetailPage = lazyWithRetry(() => import('./pages/PortfolioProjectDetailPage.js').then(m => ({ default: m.PortfolioProjectDetailPage })));
const BlogPostPage = lazyWithRetry(() => import('./pages/BlogPostPage.js').then(m => ({ default: m.BlogPostPage })));
// The Session Manager Field Manual reader — lazy because its bundle is only
// needed by the slice of visitors who open the manual.
const ManualPage = lazyWithRetry(() => import('./pages/session-manager-landing/ManualPage.js'));
const SessionManagerPage = lazyWithRetry(() => import('./pages/session-manager-landing/SessionManagerPage.js'));

const CLERK_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || 'pk_live_Y2xlcmsuYmlsa28ucnVuJA';

// Error boundary — if Clerk fails to initialise, show a static message instead
// of re-rendering the routes without ClerkProvider (auth hooks would throw).
class ClerkErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(err: Error) { console.error('[Clerk init failed]', err.message); }
  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="max-w-xl mx-auto px-6 py-24 text-center">
        <h2 className="text-2xl font-extrabold text-warm-900 mb-2">Something went wrong loading the site</h2>
        <p className="text-warm-600 mb-6">Sign-in could not start. Reloading usually fixes it.</p>
        <button
          onClick={() => window.location.reload()}
          className="px-5 py-2.5 bg-fire-500 hover:bg-fire-600 text-white font-bold rounded-lg transition-colors"
        >
          Reload
        </button>
      </div>
    );
  }
}
// Single-source-of-truth path canonicalization. Both /projects/<slug> and
// /app/<old-slug> redirect to /products/<slug> while preserving the rest of
// the URL (search params, hash). Old links keep working; the address bar
// shows the canonical form.
const APP_TO_PRODUCT: Record<string, string> = {
  headline: 'headline-grader',
  'page-roast': 'page-roast',
  'ad-scorer': 'ad-scorer',
  thread: 'thread-grader',
  'email-forge': 'email-forge',
  audience: 'audience-decoder',
};

function RedirectProjectsToProducts() {
  const loc = useLocation();
  return <Navigate to={loc.pathname.replace(/^\/projects/, '/products') + loc.search + loc.hash} replace />;
}

// /products/<slug> for a slug that's not a react-route tool — check whether
// it's a standalone (static-path/external) project and redirect there.
// Lets old links survive when a tool migrates from react-route to static-path.
function MaybeStandaloneRedirect() {
  const loc = useLocation();
  const slug = loc.pathname.replace(/^\/products\//, '').split('/')[0];
  const standalone = PROJECTS.find(p => p.slug === slug && p.host.kind !== 'react-route');
  if (standalone) {
    if (standalone.host.kind === 'external-url') {
      window.location.href = standalone.host.url;
      return null;
    }
    // static-path: trigger full reload so Fastify serves the static index.html.
    window.location.href = standalone.host.path;
    return null;
  }
  return <NotFoundPage />;
}

// Legacy top-level /manual → the canonical product-scoped path. Kept forever:
// Stripe receipt emails already in customers' inboxes link to /manual, and every
// chapter anchor (#getting-started, …) must survive the hop, so search AND hash
// are carried across verbatim.
// The real Academy course lives in the static-path sibling app, not this
// repo. Full page load (not <Navigate>) so Fastify serves that bundle.
function RedirectAcademyToCourse() {
  useEffect(() => {
    window.location.replace('/projects/academy/');
  }, []);
  return null;
}

function RedirectManualToProduct() {
  const loc = useLocation();
  return <Navigate to={'/products/session-manager/manual' + loc.search + loc.hash} replace />;
}

function RedirectAppToProducts() {
  const loc = useLocation();
  // /app/<old> → /products/<canonical>; /app/metrics → /admin; /app or anything else → /products
  const segments = loc.pathname.split('/').filter(Boolean); // ["app", "<rest>"]
  const old = segments[1];
  if (old === 'metrics') return <Navigate to="/admin" replace />;
  const canonical = old ? APP_TO_PRODUCT[old] : undefined;
  const target = canonical ? `/products/${canonical}` : '/products';
  return <Navigate to={target + loc.search + loc.hash} replace />;
}

function lazyRoute(El: React.ComponentType) {
  return (
    <ToolErrorBoundary>
      <React.Suspense fallback={null}><El /></React.Suspense>
    </ToolErrorBoundary>
  );
}

/** Legacy tool routes under /products/*. */
function toolRoutes() {
  return (
    <>
      {/* Old /content-tools route (HeadlineGrader/AdScorer/ThreadGrader/EmailForge/AudienceDecoder
          tabbed dashboard) — all 5 tools are now sibling apps. Old links forward to /projects. */}
      <Route path="content-tools" element={<Navigate to="/products" replace />} />
    </>
  );
}

function AppRoutes() {
  return (
    <BrowserRouter>
        <Routes>
          {/* ── bilko.run public pages ── */}
          <Route element={<Layout />}>
            <Route path="/" element={<HomePage />} />

            {/* /projects — canonical home of the combined Projects + Packages hub */}
            <Route path="/projects" element={<ProjectsPage />} />
            {/* /products (and its tool slugs) stay live; the bare listing canonicalizes to /projects */}
            <Route path="/products" element={<Navigate to="/projects" replace />} />
            <Route path="/products/*">
              {toolRoutes()}
              {/* unknown slug under /products/* — maybe a static-path project? */}
              <Route path="*" element={<MaybeStandaloneRedirect />} />
            </Route>

            {/* /projects/<slug> (no trailing slash) — redirect to canonical /products/<slug> */}
            <Route path="/projects/*" element={<RedirectProjectsToProducts />} />

            {/* Games are projects now — the standalone Game Studio tab/page was
                retired. /games and /studio fold into the projects hub (games
                surface there, admin-gated). */}
            <Route path="/games" element={<Navigate to="/projects" replace />} />
            <Route path="/studio" element={<Navigate to="/projects" replace />} />
            {/* /packages merged into the hub */}
            <Route path="/packages" element={<Navigate to="/projects" replace />} />
            {/* /workflows retired 2026-10-10 — fold into the projects hub */}
            <Route path="/workflows" element={<Navigate to="/projects" replace />} />
            <Route path="/blog" element={<BlogPage />} />
            <Route path="/blog/:slug" element={lazyRoute(BlogPostPage)} />
            <Route path="/pricing" element={lazyRoute(PricingPage)} />
            <Route path="/privacy" element={lazyRoute(PrivacyPage)} />
            <Route path="/terms" element={lazyRoute(TermsPage)} />
            <Route path="/admin" element={lazyRoute(AdminPage)} />
            <Route path="/admin/cost" element={lazyRoute(AdminCostPage)} />
            <Route path="/admin/observability" element={lazyRoute(ObservabilityPage)} />
            <Route path="/admin/secrets" element={lazyRoute(SecretsPage)} />

            {/* ── Portfolio sections ── */}
            <Route path="/academy" element={<RedirectAcademyToCourse />} />
            <Route path="/academy/*" element={<RedirectAcademyToCourse />} />
            <Route path="/contact" element={lazyRoute(ContactPage)} />
            <Route path="/work/:id" element={lazyRoute(PortfolioProjectDetailPage)} />

            {/* ── Legacy manual URLs ── */}
            {/* Canonical path is /products/session-manager/manual (see above).
                These two never die — they are in customers' receipt emails. */}
            <Route path="/manual" element={<RedirectManualToProduct />} />
            <Route path="/manual/*" element={<RedirectManualToProduct />} />
          </Route>

          {/* /products/session-manager — standalone marketing page (nothing is
              sold there: the app and the Field Manual are both free).
              Deliberately OUTSIDE <Layout /> so it renders zero Bilko site
              chrome (no pf-topbar, no Bilko nav, no Cmd-K palette); it ships
              its own header instead. Still shares this repo's
              ClerkProvider, which
              its header account chip reads. */}
          <Route path="/products/session-manager" element={lazyRoute(SessionManagerPage)} />
          {/* The Field Manual reader is the landing's next page, so it lives
              outside <Layout /> too and wears the landing's chrome (own
              Header, stylesheet, fonts). It lives under the Session Manager
              product root, not at top level — /manual implied "the bilko.run
              manual" on a host with ~25 projects. Static segments outrank the
              /products/* splat, so declaration order is not load-bearing. */}
          <Route
            path="/products/session-manager/manual"
            element={lazyRoute(ManualPage)}
          />

          {/* /app/* — legacy dashboard URLs redirect to canonical /products/* */}
          <Route path="/app" element={<RedirectAppToProducts />} />
          <Route path="/app/*" element={<RedirectAppToProducts />} />

          {/* 404 */}
          <Route path="*" element={<Layout />}>
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <ClerkErrorBoundary>
      <ClerkProvider
        publishableKey={CLERK_KEY}
        afterSignInUrl={window.location.pathname + window.location.search}
        afterSignUpUrl={window.location.pathname + window.location.search}
        afterSignOutUrl="/"
      >
        <AppRoutes />
      </ClerkProvider>
    </ClerkErrorBoundary>
  );
}
