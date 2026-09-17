import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { ROLES_CONFIG, UserRole } from '../domain/entities/user';
import { 
  ShieldCheck, 
  ChevronDown, 
  Users, 
  FileText, 
  LogOut, 
  LogIn, 
  CheckCircle2, 
  SlidersHorizontal,
  HardHat,
  Cpu,
  Building2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface UserNavMenuProps {
  onOpenUsersModal?: () => void;
  onOpenLogsModal?: () => void;
}

export function UserNavMenu({ onOpenUsersModal, onOpenLogsModal }: UserNavMenuProps) {
  const { 
    userProfile, 
    currentRole, 
    roleConfig, 
    logout, 
    firebaseUser,
    canGerenciarUsuarios,
    canVerLogs
  } = useAuth();

  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getRoleIcon = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return <SlidersHorizontal size={16} color={ROLES_CONFIG.admin.iconColor} />;
      case 'projetista':
        return <HardHat size={16} color={ROLES_CONFIG.projetista.iconColor} />;
      case 'engenharia':
        return <Cpu size={16} color={ROLES_CONFIG.engenharia.iconColor} />;
      case 'gerencia':
        return <Building2 size={16} color={ROLES_CONFIG.gerencia.iconColor} />;
    }
  };

  return (
    <div ref={menuRef} style={{ position: 'relative', width: '100%' }}>
      {/* Botão Gatilho do Perfil */}
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '8px 16px',
          minHeight: 40,
          backgroundColor: roleConfig.badgeBg,
          border: `1px solid ${roleConfig.borderColor}`,
          borderRadius: '50px',
          cursor: 'pointer',
          textAlign: 'left',
          transition: 'all 0.2s ease',
          boxShadow: isOpen ? 'var(--shadow)' : 'none'
        }}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          backgroundColor: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          flexShrink: 0
        }}>
          {getRoleIcon(currentRole)}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ 
            fontSize: '0.8rem', 
            fontWeight: 700, 
            color: roleConfig.badgeText,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
            {roleConfig.titulo}
          </div>
          <div style={{ 
            fontSize: '0.7rem', 
            color: '#4b5563',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
            {userProfile?.nome || (firebaseUser?.email ? firebaseUser.email.split('@')[0] : 'Convidado')}
          </div>
        </div>

        <ChevronDown 
          size={16} 
          color={roleConfig.badgeText} 
          style={{ 
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0)', 
            transition: 'transform 0.2s ease' 
          }} 
        />
      </button>

      {/* DROPDOWN MENU */}
      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          marginTop: '8px',
          backgroundColor: 'white',
          borderRadius: 'var(--radius)',
          boxShadow: '0 12px 30px rgba(0,0,0,0.15)',
          border: '1px solid var(--color-border)',
          padding: '10px',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          maxHeight: 'calc(100vh - 160px)',
          overflowY: 'auto'
        }}>
          {/* Informações básicas do usuário */}
          <div style={{ 
            padding: '4px 8px 8px 8px', 
            borderBottom: '1px solid #f3f4f6', 
            marginBottom: '4px' 
          }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#111827' }}>
              {userProfile?.nome || 'Usuário ReTool'}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#6b7280' }}>
              {userProfile?.email || (firebaseUser ? firebaseUser.email : '')}
            </div>
          </div>

          {/* Tipo de perfil */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 10px',
            backgroundColor: roleConfig.badgeBg,
            borderRadius: '6px',
            border: `1px solid ${roleConfig.borderColor}`,
            margin: '4px 0'
          }}>
            {getRoleIcon(currentRole)}
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: roleConfig.badgeText }}>
              {roleConfig.titulo}
            </span>
          </div>

          <div style={{ height: '1px', backgroundColor: '#f3f4f6', margin: '4px 0' }} />

          {/* ITENS ADMINISTRATIVOS */}
          {canGerenciarUsuarios && (
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onOpenUsersModal?.();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: 'transparent',
                color: '#374151',
                fontSize: '0.8rem',
                fontWeight: 500,
                cursor: 'pointer',
                textAlign: 'left'
              }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f3f4f6')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <Users size={16} color="#7c3aed" />
              <span>Gerenciar Usuários & Acessos</span>
            </button>
          )}

          {canVerLogs && (
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onOpenLogsModal?.();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: 'transparent',
                color: '#374151',
                fontSize: '0.8rem',
                fontWeight: 500,
                cursor: 'pointer',
                textAlign: 'left'
              }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f3f4f6')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <FileText size={16} color="#2563eb" />
              <span>Histórico de Auditoria / Exclusões</span>
            </button>
          )}

          {/* BOTÃO DE LOGIN / LOGOUT */}
          {firebaseUser ? (
            <button
              type="button"
              onClick={async () => {
                setIsOpen(false);
                await logout();
                navigate('/login');
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: 'transparent',
                color: '#ef4444',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'left'
              }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#fef2f2')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <LogOut size={16} color="#ef4444" />
              <span>Sair da Conta</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                navigate('/login');
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: 'transparent',
                color: 'var(--color-primary)',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'left'
              }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f0fdf4')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <LogIn size={16} />
              <span>Fazer Login com E-mail</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
