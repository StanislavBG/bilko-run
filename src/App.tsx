import React from 'react';
import { ClerkProvider } from '@clerk/clerk-react';
import { BrowserRouter, Routes, Route, Navigate, NavLink } from 'react-router-dom';
import { Layout } from './components/Layout.js';
import { HomePage } from './pages/HomePage.js';
import { ProjectsPage } from './pages/ProjectsPage.js';
import { PageRoastPage } from './pages/PageRoastPage.js';
import { PricingPage } from './pages/PricingPage.js';
import { PrivacyPage } from './pages/PrivacyPage.js';
import { TermsPage } from './pages/TermsPage.js';

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
  return (
    <div style={{ background: '#0a0a0f', color: '#e0e0e0', minHeight: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <LegacyNav />
      <main style={{ flex: 1, overflowY: 'auto' }}>{children}</main>
    </div>
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
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/projects/page-roast" element={<PageRoastPage />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/terms" element={<TermsPage />} />
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

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
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
