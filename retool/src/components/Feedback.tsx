import React from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

/** Estados de tela reutilizados nas áreas administrativas (padrão visual do sistema). */

const AVISO_CORES = {
  sucesso: { fundo: '#dcfce7', texto: '#15803d', Icone: CheckCircle2 },
  erro: { fundo: '#fee2e2', texto: '#b91c1c', Icone: AlertCircle },
  info: { fundo: '#eff6ff', texto: '#1d4ed8', Icone: Info },
};

export function Aviso({ tipo, children, onClose }: {
  tipo: keyof typeof AVISO_CORES;
  children: React.ReactNode;
  onClose?: () => void;
}) {
  const { fundo, texto, Icone } = AVISO_CORES[tipo];
  return (
    <div
      role={tipo === 'erro' ? 'alert' : 'status'}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: '8px',
        padding: '10px 14px', borderRadius: 'var(--radius-sm)',
        backgroundColor: fundo, color: texto,
        fontSize: '0.84rem', fontWeight: 600, lineHeight: 1.45,
        marginBottom: 'var(--spacing-md)'
      }}
    >
      <Icone size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar aviso"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: texto, padding: 0, display: 'flex' }}
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

export function EstadoCarregando({ mensagem = 'Carregando...' }: { mensagem?: string }) {
  return (
    <div
      role="status"
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
        padding: 'var(--spacing-2xl) var(--spacing-md)', color: '#6b7280', fontSize: '0.86rem'
      }}
    >
      <span style={{
        width: '18px', height: '18px', borderRadius: '50%',
        border: '2.5px solid #e5e7eb', borderTopColor: 'var(--color-primary)',
        animation: 'spin 0.8s linear infinite', flexShrink: 0
      }} />
      {mensagem}
    </div>
  );
}

export function EstadoErro({ mensagem, onTentarNovamente }: { mensagem: string; onTentarNovamente?: () => void }) {
  return (
    <div
      role="alert"
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--spacing-sm)',
        padding: 'var(--spacing-xl) var(--spacing-md)', textAlign: 'center',
        color: '#b91c1c', fontSize: '0.86rem'
      }}
    >
      <AlertCircle size={22} />
      <div style={{ maxWidth: '520px', wordBreak: 'break-word' }}>{mensagem}</div>
      {onTentarNovamente && (
        <button type="button" className="btn" onClick={onTentarNovamente} style={{ fontSize: '0.8rem', minHeight: 32, padding: '4px 14px' }}>
          Tentar novamente
        </button>
      )}
    </div>
  );
}
