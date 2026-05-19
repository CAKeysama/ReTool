import React, { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Settings, Home, List, Component, Menu, X } from 'lucide-react';
import { useReTool } from '../context/ReToolContext';
import { useHotkeys } from '../hooks/useHotkeys';
import { DispositivoForm } from '../pages/DispositivoForm';

export function Layout() {
  const { announcement, isDispFormOpen } = useReTool();
  useHotkeys();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // Condição para telas centralizadas sem a sidebar fixa
  const isFullScreenMode = location.pathname === '/' || location.pathname === '/sobre';

  if (isFullScreenMode) {
    return (
      <div className="app-container" style={{ justifyContent: 'center', backgroundColor: 'var(--color-surface)' }}>
        <div aria-live="polite" className="sr-only">{announcement}</div>
        <Outlet />
        {isDispFormOpen && <DispositivoForm />}
      </div>
    );
  }

  return (
    <div className="app-container">
      <div aria-live="polite" className="sr-only">{announcement}</div>

      {/* Hamburger Menu Button */}
      <button 
        className="hamburger-btn" 
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        aria-label="Alternar menu"
      >
        {isSidebarOpen ? <X size={28} /> : <Menu size={28} />}
      </button>

      {/* Overlay para fechar ao clicar fora no mobile */}
      <div 
        className={`sidebar-overlay ${isSidebarOpen ? 'active' : ''}`} 
        onClick={() => setIsSidebarOpen(false)}
        aria-hidden="true"
      />

      <nav className={`sidebar ${isSidebarOpen ? 'open' : ''}`} aria-label="Navegação Principal">
        
        {/* LOGO AREA */}
        <div style={{ marginBottom: 'var(--spacing-2xl)' }}>
          <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800 }}>
            <span style={{ color: 'var(--color-gray-steel)' }}>Re</span>
            <span style={{ color: 'var(--color-primary)' }}>Tool</span>
          </h1>
          <div style={{ color: '#9ca3af', fontSize: '0.75rem', fontWeight: 500, marginTop: '2px' }}>
            Gestão Industrial
          </div>
        </div>

        {/* MENU */}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#9ca3af', marginBottom: 'var(--spacing-sm)', letterSpacing: '0.05em' }}>
            MENU
          </div>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <li>
              <SidebarLink to="/" icon={<Home size={18} />} label="Home" shortcut="H" onClick={() => setIsSidebarOpen(false)} />
            </li>
            <li>
              <SidebarLink to="/dispositivos" icon={<Component size={18} />} label="Dispositivos" shortcut="D" onClick={() => setIsSidebarOpen(false)} />
            </li>
            <li>
              <SidebarLink to="/utilizacoes" icon={<List size={18} />} label="Utilizações" shortcut="U" onClick={() => setIsSidebarOpen(false)} />
            </li>
            <li>
              <SidebarLink to="/categorias" icon={<Settings size={18} />} label="Categorias" shortcut="C" onClick={() => setIsSidebarOpen(false)} />
            </li>
          </ul>
        </div>

        {/* ATALHOS / FOOTER HELP */}
        <div style={{ backgroundColor: '#f9fafb', padding: 'var(--spacing-md)', borderRadius: 'var(--radius)', marginTop: 'auto' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#9ca3af', marginBottom: 'var(--spacing-sm)', letterSpacing: '0.05em' }}>
            ATALHOS
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-sm)', fontSize: '0.75rem', color: '#6b7280' }}>
            <div style={{ display: 'flex', gap: '6px' }}><span>/</span> Buscar</div>
            <div style={{ display: 'flex', gap: '6px' }}><span>N</span> Novo</div>
            <div style={{ display: 'flex', gap: '6px' }}><span>E</span> Editar</div>
            <div style={{ display: 'flex', gap: '6px' }}><span>D</span> Excluir</div>
            <div style={{ display: 'flex', gap: '6px' }}><span>Esc</span> Fechar</div>
            <div style={{ display: 'flex', gap: '6px', gridColumn: 'span 2' }}><span>Tab</span> Navegar</div>
          </div>
        </div>
      </nav>

      <main className="main-content" id="main-content">
        <Outlet />
      </main>
      
      {isDispFormOpen && <DispositivoForm />}
    </div>
  );
}

// Subcomponente de estilo do Link da Sidebar
function SidebarLink({ to, icon, label, shortcut, onClick }: { to: string, icon: React.ReactNode, label: string, shortcut: string, onClick?: () => void }) {
  return (
    <NavLink 
      to={to} 
      onClick={onClick}
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
