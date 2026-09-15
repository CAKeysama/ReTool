import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ReToolProvider } from './context/ReToolContext';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { Dispositivos } from './pages/Dispositivos';
import { DispositivoDetails } from './pages/DispositivoDetails';
import { Categorias } from './pages/Categorias';
import { Reutilizacoes } from './pages/Reutilizacoes';
import { Sobre } from './pages/Sobre';
import { Login } from './pages/Login';

function ProtectedLayout() {
  const { userProfile, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f8fafc',
        fontFamily: 'Inter, system-ui, sans-serif',
        gap: '16px'
      }}>
        <div style={{
          width: '36px',
          height: '36px',
          border: '3.5px solid #e2e8f0',
          borderTopColor: 'var(--color-primary)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite'
        }} />
        <div style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 600 }}>
          Sincronizando sessão ReTool...
        </div>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (!userProfile) {
    return <Navigate to="/login" replace />;
  }

  return <Layout />;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { userProfile, loading } = useAuth();

  if (!loading && userProfile) {
    return <Navigate to="/dispositivos" replace />;
  }

  return <>{children}</>;
}

function RoleRoute({ allowedRoles, children }: { allowedRoles: string[]; children: React.ReactNode }) {
  const { currentRole, loading } = useAuth();

  if (loading) return null;

  if (!allowedRoles.includes(currentRole)) {
    return <Navigate to="/dispositivos" replace />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <AuthProvider>
      <ReToolProvider>
        <BrowserRouter>
          <Routes>
            <Route 
              path="/login" 
              element={
                <PublicRoute>
                  <Login />
                </PublicRoute>
              } 
            />
            <Route path="/" element={<ProtectedLayout />}>
              <Route index element={<Home />} />
              <Route path="sobre" element={<Sobre />} />
              <Route path="dispositivos" element={<Dispositivos />} />
              <Route path="dispositivos/:id" element={<DispositivoDetails />} />
              <Route 
                path="categorias" 
                element={
                  <RoleRoute allowedRoles={['admin', 'projetista']}>
                    <Categorias />
                  </RoleRoute>
                } 
              />
              <Route path="reutilizacoes" element={<Reutilizacoes />} />
            </Route>
            <Route path="*" element={<Navigate to="/dispositivos" replace />} />
          </Routes>
        </BrowserRouter>
      </ReToolProvider>
    </AuthProvider>
  );
}

export default App;
