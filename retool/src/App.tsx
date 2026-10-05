import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ReToolProvider } from './context/ReToolContext';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { SkeletonCards, SkeletonLinha } from './components/feedback';
import { LimiteDeErro, liberarRecargaAutomatica } from './components/LimiteDeErro';

// Cada tela vira um arquivo separado, baixado quando a rota é aberta.
const Home = lazy(() => import('./pages/Home').then(m => ({ default: m.Home })));
const Dispositivos = lazy(() => import('./pages/Dispositivos').then(m => ({ default: m.Dispositivos })));
const DispositivoDetails = lazy(() => import('./pages/DispositivoDetails').then(m => ({ default: m.DispositivoDetails })));
const Categorias = lazy(() => import('./pages/Categorias').then(m => ({ default: m.Categorias })));
const Reutilizacoes = lazy(() => import('./pages/Reutilizacoes').then(m => ({ default: m.Reutilizacoes })));
const Sobre = lazy(() => import('./pages/Sobre').then(m => ({ default: m.Sobre })));

function CarregandoPagina() {
  return (
    <div aria-busy="true" aria-label="Carregando página" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '8px 0' }}>
      <SkeletonLinha largura={260} altura={22} />
      <SkeletonLinha largura={380} altura={12} />
      <SkeletonCards quantidade={3} />
    </div>
  );
}

const pagina = (el: React.ReactNode) => (
  <LimiteDeErro><Suspense fallback={<CarregandoPagina />}>{el}</Suspense></LimiteDeErro>
);

// Depois do login, baixa as telas em segundo plano (navegar não espera a rede).
let telasPreCarregadas = false;
function preCarregarTelas() {
  if (telasPreCarregadas) return;
  telasPreCarregadas = true;
  const carregar = () => {
    void import('./pages/Dispositivos'); void import('./pages/Home'); void import('./pages/DispositivoDetails');
    void import('./pages/Reutilizacoes'); void import('./pages/Categorias');
  };
  const ric = (window as unknown as { requestIdleCallback?: (f: () => void) => void }).requestIdleCallback;
  if (ric) ric(carregar); else setTimeout(carregar, 1500);
}

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

  preCarregarTelas();
  liberarRecargaAutomatica();
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
              <Route index element={pagina(<Home />)} />
              <Route path="sobre" element={pagina(<Sobre />)} />
              <Route path="dispositivos" element={pagina(<Dispositivos />)} />
              <Route path="dispositivos/:id" element={pagina(<DispositivoDetails />)} />
              <Route 
                path="categorias" 
                element={
                  <RoleRoute allowedRoles={['admin', 'projetista']}>
                    {pagina(<Categorias />)}
                  </RoleRoute>
                } 
              />
              <Route path="reutilizacoes" element={pagina(<Reutilizacoes />)} />
            </Route>
            <Route path="*" element={<Navigate to="/dispositivos" replace />} />
          </Routes>
        </BrowserRouter>
      </ReToolProvider>
    </AuthProvider>
  );
}

export default App;
