import React from 'react';
import { ClerkProvider } from '@clerk/clerk-react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Layout } from './components/Layout.js';
import { ToolErrorBoundary } from './components/ErrorBoundary.js';
import { HomePage } from './pages/HomePage.js';
import { ProjectsPage } from './pages/ProjectsPage.js';
import { BlogPage } from './pages/BlogPage.js';
import { PricingPage } from './pages/PricingPage.js';
import { PrivacyPage } from './pages/PrivacyPage.js';
import { TermsPage } from './pages/TermsPage.js';
import { AdminPage } from './pages/AdminPage.js';
import { AdminCostPage } from './pages/AdminCostPage.js';
import { ObservabilityPage } from './pages/admin/ObservabilityPage.js';
import { SecretsPage } from './pages/admin/SecretsPage.js';
import { NotFoundPage } from './pages/NotFoundPage.js';
import { StudioPage } from './pages/StudioPage.js';
import { AcademyPage } from './pages/AcademyPage.js';
import { AcademyLevelPage } from './pages/AcademyLevelPage.js';
import { GamesPage } from './pages/GamesPage.js';
import { WorkflowsPage } from './pages/WorkflowsPage.js';
import { ContactPage } from './pages/ContactPage.js';
import { PortfolioProjectDetailPage } from './pages/PortfolioProjectDetailPage.js';
import { ROUTABLE_TOOLS } from './config/tools.js';
import { PROJECTS } from './data/projectsRegistry.js';

// Lazy-loaded pages. Tool page loaders live in the registry (src/config/tools.ts);
// only non-tool landing pages are declared here.
const BlogPostPage = React.lazy(() => import('./pages/BlogPostPage.js').then(m => ({ default: m.BlogPostPage })));
const PackagesPage = React.lazy(() => import('./pages/PackagesPage.js').then(m => ({ default: m.PackagesPage })));

// Build one React.lazy component per registered tool so code-splitting still works.
const TOOL_COMPONENTS: Record<string, React.LazyExoticComponent<React.ComponentType>> = Object.fromEntries(
  ROUTABLE_TOOLS.map(t => [t.slug, React.lazy(t.loader)]),
);

import { AuthProvider } from './hooks/useAuth.js';

const CLERK_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || 'pk_live_Y2xlcmsuYmlsa28ucnVuJA';

// Error boundary — renders children without auth if Clerk fails
class ClerkErrorBoundary extends React.Component<{ children: React.ReactNode; fallback: React.ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(err: Error) { console.error('[Clerk init failed, running without auth]', err.message); }
  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
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

/** Tool routes shared between /projects/* and /products/* */
function toolRoutes() {
  return (
    <>
      {ROUTABLE_TOOLS.map(t => (
        <Route key={t.slug} path={t.slug} element={lazyRoute(TOOL_COMPONENTS[t.slug])} />
      ))}
      {/* Old /content-tools route (HeadlineGrader/AdScorer/ThreadGrader/EmailForge/AudienceDecoder
          tabbed dashboard) — all 5 tools are now sibling apps. Old links forward to /projects. */}
      <Route path="content-tools" element={<Navigate to="/products" replace />} />
    </>
  );
}

function AppRoutes() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* ── bilko.run public pages ── */}
          <Route element={<Layout />}>
            <Route path="/" element={<HomePage />} />

            {/* /products/* — canonical */}
            <Route path="/products" element={<ProjectsPage />} />
            <Route path="/products/*">
              {toolRoutes()}
              {/* unknown slug under /products/* — maybe a static-path project? */}
              <Route path="*" element={<MaybeStandaloneRedirect />} />
            </Route>

            {/* /projects/* — redirect to canonical /products/* */}
            <Route path="/projects" element={<Navigate to="/products" replace />} />
            <Route path="/projects/*" element={<RedirectProjectsToProducts />} />

            <Route path="/games" element={<GamesPage />} />
            <Route path="/packages" element={<React.Suspense fallback={null}><PackagesPage /></React.Suspense>} />
            <Route path="/blog" element={<BlogPage />} />
            <Route path="/blog/:slug" element={<React.Suspense fallback={null}><BlogPostPage /></React.Suspense>} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/admin/cost" element={<AdminCostPage />} />
            <Route path="/admin/observability" element={<ObservabilityPage />} />
            <Route path="/admin/secrets" element={<SecretsPage />} />

            {/* ── Portfolio sections ── */}
            <Route path="/studio" element={<StudioPage />} />
            <Route path="/academy" element={<AcademyPage />} />
            <Route path="/academy/:level" element={<AcademyLevelPage />} />
            <Route path="/workflows" element={<WorkflowsPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/work/:id" element={<PortfolioProjectDetailPage />} />
          </Route>

          {/* /app/* — legacy dashboard URLs redirect to canonical /products/* */}
          <Route path="/app" element={<RedirectAppToProducts />} />
          <Route path="/app/*" element={<RedirectAppToProducts />} />

          {/* 404 */}
          <Route path="*" element={<Layout />}>
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default function App() {
  return (
    <ClerkErrorBoundary fallback={<AppRoutes />}>
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
