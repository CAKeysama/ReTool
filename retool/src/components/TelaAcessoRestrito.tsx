import React from 'react';
import { LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Moldura das telas exibidas antes do acesso normal ao sistema
 * (convidado em análise, troca obrigatória de senha). Mantém a identidade
 * visual da tela de login e só oferece a saída da conta.
 */
export function TelaAcessoRestrito({ icone, titulo, subtitulo, children }: {
  icone: React.ReactNode;
  titulo: string;
  subtitulo: string;
  children: React.ReactNode;
}) {
  const { logout, userProfile } = useAuth();
  const navigate = useNavigate();

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f1f5f9',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
      fontFamily: 'Inter, system-ui, sans-serif'
    }}>
      <main style={{
        maxWidth: '560px',
        width: '100%',
        backgroundColor: 'white',
        borderRadius: 'var(--radius-lg)',
        boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.15)',
        border: '1px solid #e2e8f0',
        overflow: 'hidden'
      }}>
        <div style={{
          backgroundColor: '#0f172a', color: 'white', padding: '18px 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px'
        }}>
          <div style={{ fontSize: '1.3rem', fontWeight: 800 }}>
            <span style={{ color: '#ffffff' }}>Re</span><span style={{ color: 'var(--color-primary)' }}>Tool</span>
          </div>
          <button
            type="button"
            onClick={async () => { await logout(); navigate('/login'); }}
            className="btn"
            style={{
              backgroundColor: 'transparent', color: '#e2e8f0', borderColor: 'rgba(255,255,255,0.25)',
              minHeight: 34, padding: '4px 14px', fontSize: '0.8rem'
            }}
          >
            <LogOut size={14} /> Sair
          </button>
        </div>

        <div style={{ padding: '28px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '10px', flexShrink: 0,
              backgroundColor: '#fef2f2', color: 'var(--color-primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              {icone}
            </div>
            <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>{titulo}</h1>
          </div>
          <p style={{ color: '#64748b', fontSize: '0.88rem', lineHeight: 1.55, marginBottom: '20px' }}>
            {subtitulo}
          </p>
          {children}
          {userProfile && (
            <div style={{ marginTop: '20px', fontSize: '0.75rem', color: '#94a3b8' }}>
              Conectado como {userProfile.email}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
