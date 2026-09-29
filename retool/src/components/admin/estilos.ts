import React from 'react';

/** Estilos compartilhados pelos painéis da Administração (mesmo padrão das filas/tabelas do sistema). */

export const cartaoAdmin: React.CSSProperties = {
  padding: '14px 16px',
  backgroundColor: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius)',
  boxShadow: 'var(--shadow-sm)'
};

export function estiloBotaoAcao(cor: 'success' | 'danger' | 'primary' | 'neutro'): React.CSSProperties {
  const base: React.CSSProperties = { padding: '6px 12px', minHeight: 32, fontSize: '0.78rem', fontWeight: 600 };
  if (cor === 'neutro') return base;
  const fundo = cor === 'success' ? 'var(--color-success)' : cor === 'danger' ? 'var(--color-danger)' : 'var(--color-primary)';
  return { ...base, backgroundColor: fundo, borderColor: fundo, color: 'white' };
}

export const tabelaAdmin = {
  moldura: {
    backgroundColor: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius)',
    overflow: 'hidden'
  } as React.CSSProperties,
  tabela: { width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' } as React.CSSProperties,
  cabecalho: { backgroundColor: '#f9fafb', borderBottom: '1px solid var(--color-border)', textAlign: 'left' } as React.CSSProperties,
  th: { padding: '10px 12px', fontWeight: 600, color: '#4b5563', whiteSpace: 'nowrap' } as React.CSSProperties,
  td: { padding: '10px 12px', verticalAlign: 'top' } as React.CSSProperties,
  linha: { borderBottom: '1px solid #f3f4f6' } as React.CSSProperties,
};
