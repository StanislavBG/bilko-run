import React from 'react';
import { ClerkProvider } from '@clerk/clerk-react';
import { BrowserRouter, Routes, Route, Navigate, NavLink } from 'react-router-dom';
import { Layout } from './components/Layout.js';
import { ToolErrorBoundary } from './components/ErrorBoundary.js';
import { usePageView } from './hooks/usePageView.js';
import { HomePage } from './pages/HomePage.js';
import { ProjectsPage } from './pages/ProjectsPage.js';
import { BlogPage } from './pages/BlogPage.js';
import { PricingPage } from './pages/PricingPage.js';
import { PrivacyPage } from './pages/PrivacyPage.js';
import { TermsPage } from './pages/TermsPage.js';
import { AdminPage } from './pages/AdminPage.js';
import { NotFoundPage } from './pages/NotFoundPage.js';
import { ROUTABLE_TOOLS } from './config/tools.js';

// Lazy-loaded pages. Tool page loaders live in the registry (src/config/tools.ts);
// only non-tool landing pages are declared here.
const BlogPostPage = React.lazy(() => import('./pages/BlogPostPage.js').then(m => ({ default: m.BlogPostPage })));
const ContentToolsPage = React.lazy(() => import('./pages/ContentToolsPage.js').then(m => ({ default: m.ContentToolsPage })));

// Build one React.lazy component per registered tool so code-splitting still works.
const TOOL_COMPONENTS: Record<string, React.LazyExoticComponent<React.ComponentType>> = Object.fromEntries(
  ROUTABLE_TOOLS.map(t => [t.slug, React.lazy(t.loader)]),
);

// Legacy dashboard imports — kept at /app for backward compat
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
// Legacy views — lazy loaded (only fetched if user visits /app)
const HeadlineGraderView = React.lazy(() => import('./views/HeadlineGraderView.js').then(m => ({ default: m.HeadlineGraderView })));
const PageRoastView = React.lazy(() => import('./views/PageRoastView.js').then(m => ({ default: m.PageRoastView })));
const AdScorerView = React.lazy(() => import('./views/AdScorerView.js').then(m => ({ default: m.AdScorerView })));
const ThreadGraderView = React.lazy(() => import('./views/ThreadGraderView.js').then(m => ({ default: m.ThreadGraderView })));
const EmailForgeView = React.lazy(() => import('./views/EmailForgeView.js').then(m => ({ default: m.EmailForgeView })));
const AudienceDecoderView = React.lazy(() => import('./views/AudienceDecoderView.js'));
const MetricsView = React.lazy(() => import('./views/MetricsView.js').then(m => ({ default: m.MetricsView })));

const LEGACY_NAV = [
  { path: '/headline', label: 'HeadlineGrader' },
  { path: '/page-roast', label: 'PageRoast' },
  { path: '/ad-scorer', label: 'AdScorer' },
  { path: '/thread', label: 'ThreadGrader' },
  { path: '/email-forge', label: 'EmailForge' },
  { path: '/audience', label: 'AudienceDecoder' },
  { path: '/metrics', label: 'Metrics' },
] as const;

function LegacyNav() {
  return (
    <nav style={{
      background: '#080810', borderBottom: '1px solid #12121f',
      padding: '0 24px', display: 'flex', alignItems: 'center', gap: 4, overflowX: 'auto', flexShrink: 0,
    }}>
      <span style={{ fontSize: 12, fontWeight: 800, color: '#555', marginRight: 16, whiteSpace: 'nowrap', letterSpacing: 1 }}>CG</span>
      {LEGACY_NAV.map(({ path, label }) => (
        <NavLink key={path} to={path} style={({ isActive }) => ({
          padding: '12px 14px', fontSize: 12, fontWeight: 600,
          color: isActive ? '#e0e0e0' : '#444', textDecoration: 'none',
          borderBottom: isActive ? '2px solid #7c4dff' : '2px solid transparent', whiteSpace: 'nowrap',
        })}>{label}</NavLink>
      ))}
    </nav>
  );
}

function LegacyDashboard({ children }: { children: React.ReactNode }) {
  usePageView();
  return (
    <div style={{ background: '#0a0a0f', color: '#e0e0e0', minHeight: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <LegacyNav />
      <main style={{ flex: 1, overflowY: 'auto' }}>{children}</main>
    </div>
  );
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
      <Route path="content-tools" element={lazyRoute(ContentToolsPage)} />
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
            </Route>

            {/* /projects/* — backward compat aliases */}
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/projects/*">
              {toolRoutes()}
            </Route>

            <Route path="/blog" element={<BlogPage />} />
            <Route path="/blog/:slug" element={<React.Suspense fallback={null}><BlogPostPage /></React.Suspense>} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/admin" element={<AdminPage />} />
          </Route>

          {/* ── Legacy dashboard at /app ── */}
          <Route path="/app" element={<Navigate to="/app/headline" replace />} />
          <Route path="/app/headline" element={<React.Suspense fallback={null}><LegacyDashboard><HeadlineGraderView /></LegacyDashboard></React.Suspense>} />
          <Route path="/app/page-roast" element={<React.Suspense fallback={null}><LegacyDashboard><PageRoastView /></LegacyDashboard></React.Suspense>} />
          <Route path="/app/ad-scorer" element={<React.Suspense fallback={null}><LegacyDashboard><AdScorerView /></LegacyDashboard></React.Suspense>} />
          <Route path="/app/thread" element={<React.Suspense fallback={null}><LegacyDashboard><ThreadGraderView /></LegacyDashboard></React.Suspense>} />
          <Route path="/app/email-forge" element={<React.Suspense fallback={null}><LegacyDashboard><EmailForgeView /></LegacyDashboard></React.Suspense>} />
          <Route path="/app/audience" element={<React.Suspense fallback={null}><LegacyDashboard><AudienceDecoderView /></LegacyDashboard></React.Suspense>} />
          <Route path="/app/metrics" element={<React.Suspense fallback={null}><LegacyDashboard><MetricsView /></LegacyDashboard></React.Suspense>} />

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
