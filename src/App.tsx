import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import SessionExpiredModal from './components/SessionExpiredModal';
import Sidebar from './components/layout/Sidebar';
import TopBar from './components/layout/TopBar';
import Login from './views/Login';
import { useAuth } from './contexts/AuthContext';
import { isSupabaseConfigured } from './lib/supabase';

// Vistas con carga diferida: reduce el bundle inicial (las librerías de
// exportación PDF/Excel solo se descargan al entrar a la vista que las usa)
const Dashboard = lazy(() => import('./views/Dashboard'));
const Patients = lazy(() => import('./views/Patients'));
const Nurses = lazy(() => import('./views/Nurses'));
const Calendar = lazy(() => import('./views/Calendar'));
const Financials = lazy(() => import('./views/Financials'));
const Payroll = lazy(() => import('./views/Payroll'));
const Clients = lazy(() => import('./views/Clients'));
const ClientDetail = lazy(() => import('./views/ClientDetail'));
const Catalog = lazy(() => import('./views/Catalog'));
const PatientDetail = lazy(() => import('./views/PatientDetail'));
const NurseDetail = lazy(() => import('./views/NurseDetail'));
const Settings = lazy(() => import('./views/Settings'));
const Reports = lazy(() => import('./views/Reports'));
const Documents = lazy(() => import('./views/Documents'));

// Spinner simple mientras carga la sesión
const LoadingScreen: React.FC = () => (
  <div style={{
    minHeight: '100vh', display: 'flex', alignItems: 'center',
    justifyContent: 'center', flexDirection: 'column', gap: 12,
    background: '#f0f4ff', fontFamily: 'Inter, sans-serif',
  }}>
    <img src="/logo.svg" alt="EIMED" style={{ height: 48, opacity: 0.8 }} />
    <div style={{ color: '#6b7280', fontSize: 14 }}>Cargando...</div>
  </div>
);

// Layout con sidebar protegido
const AppLayout: React.FC = () => {
  const { user, loading, sessionExpired } = useAuth();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const location = useLocation();

  if (loading) return <LoadingScreen />;

  // Si Supabase está configurado y no hay sesión → login
  // En producción sin sesión (incluye el caso de Supabase no configurado) → login
  if (isSupabaseConfigured && !user) {
    return <Navigate to="/login" replace />;
  }
  if (!isSupabaseConfigured && import.meta.env.PROD && !user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="app-layout">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="main-content">
        <TopBar onMenuClick={() => setSidebarOpen(true)} />
        <div className="view-viewport">
          <div className="view-container">
            {/* key por ruta: si una vista falla, navegar a otra resetea el error */}
            <ErrorBoundary compact key={location.pathname}>
              <Suspense fallback={
                <div style={{ padding: 48, textAlign: 'center', color: '#6b7280', fontSize: 14 }}>
                  Cargando...
                </div>
              }>
                <Outlet />
              </Suspense>
            </ErrorBoundary>
          </div>
        </div>
      </main>
      {sessionExpired && <SessionExpiredModal />}
    </div>
  );
};

const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        {/* Ruta pública: login */}
        <Route path="/login" element={<Login />} />

        {/* Rutas protegidas */}
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/patients" element={<Patients />} />
          <Route path="/patients/:id" element={<PatientDetail />} />
          <Route path="/clients" element={<Clients />} />
          <Route path="/clients/:id" element={<ClientDetail />} />
          <Route path="/nurses" element={<Nurses />} />
          <Route path="/nurses/:id" element={<NurseDetail />} />
          <Route path="/catalog" element={<Catalog />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/financials" element={<Financials />} />
          <Route path="/payroll" element={<Payroll />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/documents" element={<Documents />} />
        </Route>
      </Routes>
    </Router>
  );
};

export default App;
