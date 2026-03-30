import React from 'react';
import { ClerkProvider } from '@clerk/clerk-react';
import { BrowserRouter, Routes, Route, Navigate, NavLink } from 'react-router-dom';
import { Layout } from './components/Layout.js';
import { HomePage } from './pages/HomePage.js';
import { ProjectsPage } from './pages/ProjectsPage.js';
import { PageRoastPage } from './pages/PageRoastPage.js';

// Legacy dashboard imports — kept at /app for backward compat
import { AuthProvider } from './hooks/useAuth.js';

const CLERK_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || 'pk_test_ZHJpdmVuLXBpa2EtNDUuY2xlcmsuYWNjb3VudHMuZGV2JA';
import { HeadlineGraderView } from './views/HeadlineGraderView.js';
import { PageRoastView } from './views/PageRoastView.js';
import { AdScorerView } from './views/AdScorerView.js';
import { ThreadGraderView } from './views/ThreadGraderView.js';
import { EmailForgeView } from './views/EmailForgeView.js';
import AudienceDecoderView from './views/AudienceDecoderView.js';
import { MetricsView } from './views/MetricsView.js';

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

export default function App() {
  return (
    <ClerkProvider publishableKey={CLERK_KEY}>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* ── bilko.run public pages ── */}
          <Route element={<Layout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/projects/page-roast" element={<PageRoastPage />} />
          </Route>

          {/* ── Legacy dashboard at /app ── */}
          <Route path="/app" element={<Navigate to="/app/headline" replace />} />
          <Route path="/app/headline" element={<LegacyDashboard><HeadlineGraderView /></LegacyDashboard>} />
          <Route path="/app/page-roast" element={<LegacyDashboard><PageRoastView /></LegacyDashboard>} />
          <Route path="/app/ad-scorer" element={<LegacyDashboard><AdScorerView /></LegacyDashboard>} />
          <Route path="/app/thread" element={<LegacyDashboard><ThreadGraderView /></LegacyDashboard>} />
          <Route path="/app/email-forge" element={<LegacyDashboard><EmailForgeView /></LegacyDashboard>} />
          <Route path="/app/audience" element={<LegacyDashboard><AudienceDecoderView /></LegacyDashboard>} />
          <Route path="/app/metrics" element={<LegacyDashboard><MetricsView /></LegacyDashboard>} />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
    </ClerkProvider>
  );
}
