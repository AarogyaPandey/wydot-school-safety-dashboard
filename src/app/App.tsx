import { lazy, Suspense, useEffect, useState, Component, type ErrorInfo, type ReactNode } from 'react';
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { BarChart3, BookOpen, Map, School } from 'lucide-react';
import { DashboardProvider } from './DashboardContext';

const MapPage = lazy(() => import('../pages/MapPage'));
const AnalyticsPage = lazy(() => import('../pages/AnalyticsPage'));
const AboutPage = lazy(() => import('../pages/AboutPage'));

class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('Dashboard view error', error, info.componentStack); }
  render() { return this.state.failed ? <main className="page-error"><h1>This view couldn’t be opened</h1><p>Reload the dashboard to try again. No source data has been changed.</p><button className="button primary" onClick={() => window.location.reload()}>Reload dashboard</button></main> : this.props.children; }
}
function Shell() {
  const location = useLocation();
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  useEffect(() => {
    const name = location.pathname.includes('analytics') ? 'Analytics' : location.pathname.includes('about') ? 'About the project' : 'Map explorer';
    document.title = `${name} · Cheyenne School Zone Safety`;
    if (location.pathname !== '/map' && !location.hash) window.scrollTo(0, 0);
  }, [location.pathname]);
  return <>
    <a className="skip-link" href="#main-content">Skip to main content</a>
    <header className="site-header">
      <NavLink to={`/map${location.search}`} className="brand" aria-label="Cheyenne School Zone Safety home">
        <span className="brand-mark"><School size={19} strokeWidth={1.65} /></span>
        <span><strong>School Zone Safety</strong><small>CHEYENNE, WYOMING</small></span>
      </NavLink>
      <nav className="main-nav" aria-label="Main navigation">
        {[{ to: '/map', label: 'Map', Icon: Map }, { to: '/analytics', label: 'Analytics', Icon: BarChart3 }, { to: '/about', label: 'About', Icon: BookOpen }].map(({ to, label, Icon }) => <NavLink key={to} to={`${to}${location.search}`} className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}><Icon size={14} /><span>{label}</span></NavLink>)}
      </nav>
    </header>
    {!online && <div className="offline-banner" role="status">You’re offline. Loaded data remains available; basemap tiles and unloaded layers may be unavailable.</div>}
    <ErrorBoundary><Suspense fallback={<main className="page-loading" aria-live="polite"><span className="spinner" />Opening dashboard…</main>}><Routes>
      <Route path="/map" element={<MapPage />} />
      <Route path="/analytics" element={<AnalyticsPage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="*" element={<Navigate to={`/map${location.search}`} replace />} />
    </Routes></Suspense></ErrorBoundary>
  </>;
}
export default function App() { return <DashboardProvider><Shell /></DashboardProvider>; }
