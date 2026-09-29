import React from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Settings, Home, List, Component, ShieldCheck } from 'lucide-react';
import { useReTool } from '../context/ReToolContext';
import { useAuth } from '../context/AuthContext';
import { useHotkeys } from '../hooks/useHotkeys';
import { usePermissions } from '../hooks/usePermissions';
import { situacaoDoUsuario } from '../domain/entities/user';
import { DispositivoForm } from '../pages/DispositivoForm';
import { UserNavMenu } from './UserNavMenu';
import { NotificationsMenu } from './NotificationsMenu';

export function Layout() {
  const { announcement, isDispFormOpen } = useReTool();
  const { users, solicitacoesCargo } = useAuth();
  const { canCadastrar, canEditar, canExcluir, canGerenciarUsuarios } = usePermissions();
  useHotkeys();
  const location = useLocation();

  // Pendências administrativas (cadastros + solicitações de cargo) exibidas no menu.
  const pendenciasAdmin = canGerenciarUsuarios
    ? users.filter(u => situacaoDoUsuario(u) === 'pendente').length
      + solicitacoesCargo.filter(s => s.status === 'pendente').length
    : 0;

  // Condição para telas centralizadas sem a sidebar fixa
  const isFullScreenMode = location.pathname === '/' || location.pathname === '/sobre';

  const bottomNav = (
    <nav className="bottom-nav" aria-label="Navegação Mobile">
      <ul className="bottom-nav-list">
        <li>
          <NavLink to="/" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
            <Home size={24} />
            <span>Home</span>
          </NavLink>
        </li>
        <li>
          <NavLink to="/dispositivos" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
            <Component size={24} />
            <span>Dispositivos</span>
          </NavLink>
        </li>
        <li>
          <NavLink to="/reutilizacoes" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
            <List size={24} />
            <span>Reutilizações</span>
          </NavLink>
        </li>
        {(canCadastrar || canEditar) && (
          <li>
            <NavLink to="/categorias" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
              <Settings size={24} />
              <span>Categorias</span>
            </NavLink>
          </li>
        )}
        {canGerenciarUsuarios && (
          <li>
            <NavLink to="/administracao" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
              <ShieldCheck size={24} />
              <span>Admin{pendenciasAdmin > 0 ? ` (${pendenciasAdmin})` : ''}</span>
            </NavLink>
          </li>
        )}
      </ul>
    </nav>
  );

  if (isFullScreenMode) {
    return (
      <div className="app-container" style={{ justifyContent: 'center', backgroundColor: 'var(--color-surface)', paddingBottom: '90px', position: 'relative' }}>
        <div aria-live="polite" className="sr-only">{announcement}</div>

        {/* TOP RIGHT PROFILE BADGE EM TELAS FULLSCREEN */}
        <div style={{ position: 'absolute', top: '16px', right: '24px', zIndex: 100, width: '280px', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <UserNavMenu />
          </div>
          <NotificationsMenu align="right" />
        </div>

        <Outlet />
        {isDispFormOpen && <DispositivoForm />}

        {/* BOTTOM NAVIGATION (MOBILE ONLY) */}
        {bottomNav}
      </div>
    );
  }

  return (
    <div className="app-container">
      <div aria-live="polite" className="sr-only">{announcement}</div>

      <nav className="sidebar" aria-label="Navegação Principal">

        {/* LOGO AREA */}
        <div style={{ marginBottom: 'var(--spacing-lg)' }}>
          <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800 }}>
            <span style={{ color: 'var(--color-gray-steel)' }}>Re</span>
            <span style={{ color: 'var(--color-primary)' }}>Tool</span>
          </h1>
          <div style={{ color: '#9ca3af', fontSize: '0.75rem', fontWeight: 500, marginTop: '2px' }}>
            Gestão Industrial
          </div>
        </div>

        {/* PERFIL DE ACESSO RBAC + NOTIFICAÇÕES */}
        <div style={{ marginBottom: 'var(--spacing-lg)', display: 'flex', gap: '8px', alignItems: 'flex-start', minWidth: 0 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <UserNavMenu />
          </div>
          <NotificationsMenu align="left" />
        </div>

        {/* MENU */}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#9ca3af', marginBottom: 'var(--spacing-sm)', letterSpacing: '0.05em' }}>
            MENU
          </div>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <li>
              <SidebarLink to="/" icon={<Home size={18} />} label="Home" shortcut="H" />
            </li>
            <li>
              <SidebarLink to="/dispositivos" icon={<Component size={18} />} label="Dispositivos" shortcut="D" />
            </li>
            <li>
              <SidebarLink to="/reutilizacoes" icon={<List size={18} />} label="Reutilizações" shortcut="U" />
            </li>
            {(canCadastrar || canEditar) && (
              <li>
                <SidebarLink to="/categorias" icon={<Settings size={18} />} label="Categorias" shortcut="C" />
              </li>
            )}
            {canGerenciarUsuarios && (
              <li>
                <SidebarLink to="/administracao" icon={<ShieldCheck size={18} />} label="Administração" shortcut="A" badge={pendenciasAdmin} />
              </li>
            )}
          </ul>
        </div>

        {/* ATALHOS / FOOTER HELP */}
        <div style={{ backgroundColor: '#f9fafb', padding: 'var(--spacing-md)', borderRadius: 'var(--radius)', marginTop: 'auto' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#9ca3af', marginBottom: 'var(--spacing-sm)', letterSpacing: '0.05em' }}>
            ATALHOS
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-sm)', fontSize: '0.75rem', color: '#6b7280' }}>
            <div style={{ display: 'flex', gap: '6px' }}><span>/</span> Buscar</div>
            {canCadastrar && <div style={{ display: 'flex', gap: '6px' }}><span>N</span> Novo</div>}
            {canEditar && <div style={{ display: 'flex', gap: '6px' }}><span>E</span> Editar</div>}
            {canExcluir && <div style={{ display: 'flex', gap: '6px' }}><span>D</span> Excluir</div>}
            <div style={{ display: 'flex', gap: '6px' }}><span>Esc</span> Fechar</div>
            <div style={{ display: 'flex', gap: '6px', gridColumn: 'span 2' }}><span>Tab</span> Navegar</div>
          </div>
        </div>
      </nav>

      {/* BOTTOM NAVIGATION (MOBILE ONLY) */}
      {bottomNav}

      <main className="main-content" id="main-content">
        <Outlet />
      </main>

      {isDispFormOpen && <DispositivoForm />}
    </div>
  );
}

// Subcomponente de estilo do Link da Sidebar
function SidebarLink({ to, icon, label, shortcut, badge }: { to: string, icon: React.ReactNode, label: string, shortcut: string, badge?: number }) {
  return (
    <NavLink
      to={to}
      style={({ isActive }) => ({
        display: 'flex',
        alignItems: 'center',
        padding: '10px 12px',
        borderRadius: 'var(--radius-sm)',
        textDecoration: 'none',
        color: isActive ? 'white' : 'var(--color-text-dark)',
        backgroundColor: isActive ? 'var(--color-primary)' : 'transparent',
        transition: 'all 0.2s',
        position: 'relative'
      })}
    >
      {({ isActive }) => (
        <>
          <span style={{ marginRight: '12px', display: 'flex' }}>{icon}</span>
          <span style={{ fontWeight: isActive ? 600 : 500, fontSize: '0.95rem' }}>{label}</span>

          {!!badge && badge > 0 && (
            <span
              aria-label={`${badge} pendências`}
              style={{
                marginLeft: '8px', minWidth: '18px', height: '18px', padding: '0 5px', borderRadius: '9px',
                fontSize: '0.66rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                backgroundColor: isActive ? 'white' : 'var(--color-primary)',
                color: isActive ? 'var(--color-primary)' : 'white'
              }}
            >
              {badge}
            </span>
          )}

          <div style={{
            marginLeft: 'auto',
            fontSize: '10px',
            width: '18px', height: '18px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: '4px',
            backgroundColor: isActive ? 'rgba(255,255,255,0.2)' : 'var(--color-border)',
            color: isActive ? 'white' : '#9ca3af',
            fontWeight: 700
          }}>
            {shortcut}
          </div>
        </>
      )}
    </NavLink>
  );
}
