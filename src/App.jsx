import React, { useContext, useEffect, useState, Suspense } from 'react';
import { AuthProvider, AuthContext } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { LanguageProvider } from './contexts/LanguageContext';

const MainLayout = React.lazy(() => import('./layout/MainLayout'));
const LoginPage = React.lazy(() => import('./pages/LoginPage'));
const POSPage = React.lazy(() => import('./pages/POSPage'));
const ProductsPage = React.lazy(() => import('./pages/ProductsPage'));
const ReportsPage = React.lazy(() => import('./pages/ReportsPage'));
const DashboardPage = React.lazy(() => import('./pages/DashboardPage'));
const UsersPage = React.lazy(() => import('./pages/UsersPage'));
const SettingsPage = React.lazy(() => import('./pages/SettingsPage'));
const KasirSettingsPage = React.lazy(() => import('./pages/KasirSettingsPage'));
const HelpPage = React.lazy(() => import('./pages/HelpPage'));
const HistoryPage = React.lazy(() => import('./pages/HistoryPage'));
const ShiftSettingsPage = React.lazy(() => import('./pages/ShiftSettingsPage'));

import SplashScreen from './components/SplashScreen';

function AppContent() {
  const { user, login, restoreUser, isFirebaseReady } = useContext(AuthContext);
  const [activePage, setActivePage] = useState('pos');
  const [visitedPages, setVisitedPages] = useState(new Set(['pos']));
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    restoreUser();
  }, [restoreUser]);

  useEffect(() => {
    if (user) {
      const defaultPage = user.role === 'admin' ? 'dashboard' : 'pos';
      setActivePage(defaultPage);
      setVisitedPages(prev => new Set(prev).add(defaultPage));
    }
  }, [user]);

  const handlePageChange = (page) => {
    setActivePage(page);
    setVisitedPages(prev => new Set(prev).add(page));
  };

  if (showSplash || !isFirebaseReady) {
    // If firebase is ready earlier than 2s, the splash screen will still play its animation until onFinish
    // If firebase takes longer, we will just wait for it.
    // However, to make it fast, if firebase is ready we should not force block the user if they're on a fast connection.
    // Wait, let's just make the splash screen finish immediately if firebase is ready, but by default it has its min duration to look good.
    return <SplashScreen onFinish={() => setShowSplash(false)} duration={600} />;
  }

  if (!user) {
    return (
      <Suspense fallback={null}>
        <LoginPage />
      </Suspense>
    );
  }

  const isAdmin = user.role === 'admin';

  return (
    <Suspense fallback={<SplashScreen onFinish={() => {}} duration={99999} />}>
      <MainLayout activePage={activePage} onPageChange={handlePageChange}>
        <Suspense fallback={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '50vh', color: '#999', fontSize: '13px', fontFamily: 'monospace' }}>Memuat modul...</div>}>
          {visitedPages.has('dashboard') && (
            <div style={{ display: activePage === 'dashboard' ? 'contents' : 'none' }}>
              <DashboardPage />
            </div>
          )}
          {visitedPages.has('pos') && (
            <div style={{ display: activePage === 'pos' ? 'contents' : 'none' }}>
              <POSPage isAdmin={isAdmin} />
            </div>
          )}
          {visitedPages.has('products') && (
            <div style={{ display: activePage === 'products' ? 'contents' : 'none' }}>
              <ProductsPage kasirMode={!isAdmin} />
            </div>
          )}
          {visitedPages.has('reports') && (
            <div style={{ display: activePage === 'reports' ? 'contents' : 'none' }}>
              <ReportsPage kasirMode={!isAdmin} />
            </div>
          )}
          {isAdmin && visitedPages.has('users') && (
            <div style={{ display: activePage === 'users' ? 'contents' : 'none' }}>
              <UsersPage />
            </div>
          )}
          {isAdmin && visitedPages.has('shift_settings') && (
            <div style={{ display: activePage === 'shift_settings' ? 'contents' : 'none' }}>
              <ShiftSettingsPage />
            </div>
          )}
          {visitedPages.has('help') && (
            <div style={{ display: activePage === 'help' ? 'contents' : 'none' }}>
              <HelpPage />
            </div>
          )}
          {visitedPages.has('history') && (
            <div style={{ display: activePage === 'history' ? 'contents' : 'none' }}>
              <HistoryPage />
            </div>
          )}
          {visitedPages.has('settings') && (
            <div style={{ display: activePage === 'settings' ? 'contents' : 'none' }}>
              {isAdmin ? <SettingsPage /> : <KasirSettingsPage />}
            </div>
          )}
        </Suspense>
      </MainLayout>
    </Suspense>
  );
}

function App() {
  return (
    <LanguageProvider>
      <ToastProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </ToastProvider>
    </LanguageProvider>
  );
}

export default App;
