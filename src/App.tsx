import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import Sidebar from './components/layout/Sidebar';
import TopBar from './components/layout/TopBar';
import Dashboard from './views/Dashboard';
import Patients from './views/Patients';
import Nurses from './views/Nurses';
import Calendar from './views/Calendar';
import Financials from './views/Financials';
import Payroll from './views/Payroll';
import Clients from './views/Clients';
import ClientDetail from './views/ClientDetail';
import Catalog from './views/Catalog';
import PatientDetail from './views/PatientDetail';
import NurseDetail from './views/NurseDetail';
import Settings from './views/Settings';
import Reports from './views/Reports';
import Documents from './views/Documents';
import Login from './views/Login';
import { useAuth } from './contexts/AuthContext';
import { isSupabaseConfigured } from './lib/supabase';

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
  const { user, loading } = useAuth();
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
              <Outlet />
            </ErrorBoundary>
          </div>
        </div>
      </main>
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
