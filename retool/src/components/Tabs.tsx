import React from 'react';

export interface TabDef {
  id: string;
  label: string;
  count?: number;
}

interface TabsProps {
  tabs: TabDef[];
  active: string;
  onChange: (id: string) => void;
}

/** Navegação em abas no padrão visual do sistema (pílulas .btn). */
export function Tabs({ tabs, active, onChange }: TabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Seções da página"
      style={{
        display: 'flex',
        gap: 'var(--spacing-sm)',
        flexWrap: 'wrap',
        marginBottom: 'var(--spacing-lg)'
      }}
    >
      {tabs.map(t => {
        const selected = active === t.id;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(t.id)}
            className="btn"
            style={selected
              ? {
                  backgroundColor: 'var(--color-primary)',
                  borderColor: 'var(--color-primary)',
                  color: 'white',
                  fontWeight: 700
                }
              : {
                  backgroundColor: 'transparent',
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-text-body)'
                }}
          >
            {t.label}
            {typeof t.count === 'number' ? ` (${t.count})` : ''}
          </button>
        );
      })}
    </div>
  );
}

/** Estado vazio centralizado das filas (sem contêiner vazio). */
export function EmptyState({ message }: { message: string }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 'var(--spacing-sm)',
      padding: 'var(--spacing-2xl) var(--spacing-md)',
      color: '#9ca3af',
      fontSize: '0.88rem',
      textAlign: 'center'
    }}>
      <span style={{ fontSize: '1.6rem', lineHeight: 1 }}>•</span>
      {message}
    </div>
  );
}
