import React, { useRef } from 'react';
import { EstadoDados, EstadoDadosTipo } from './feedback/EstadoDados';

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
  const listaRef = useRef<HTMLDivElement>(null);
  if (tabs.length === 0) return null;
  const idxFocavel = Math.max(0, tabs.findIndex(t => t.id === active));

  // Setas/Home/End movem entre abas (padrão WAI-ARIA de tablist).
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const atual = idxFocavel;
    let proximo = -1;
    if (e.key === 'ArrowRight') proximo = (atual + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') proximo = (atual - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') proximo = 0;
    else if (e.key === 'End') proximo = tabs.length - 1;
    if (proximo < 0) return;
    e.preventDefault();
    onChange(tabs[proximo].id);
    listaRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[proximo]?.focus();
  };

  return (
    <div
      ref={listaRef}
      role="tablist"
      aria-label="Seções da página"
      onKeyDown={handleKeyDown}
      style={{
        display: 'flex',
        gap: 'var(--spacing-sm)',
        flexWrap: 'wrap',
        marginBottom: 'var(--spacing-lg)'
      }}
    >
      {tabs.map((t, i) => {
        const selected = active === t.id;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={i === idxFocavel ? 0 : -1}
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
            {typeof t.count === 'number' ? ` (${t.count.toLocaleString('pt-BR')})` : ''}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Estado vazio das filas (sem contêiner vazio). Mantém a API antiga
 * (`message`) e delega ao <EstadoDados>, para que vazio, "sem resultados",
 * carregando e erro tenham a mesma aparência em todo o sistema.
 */
export function EmptyState({
  message,
  estado = 'vazio',
  descricao = '',
  onTentarNovamente,
  children
}: {
  message: string;
  estado?: EstadoDadosTipo;
  descricao?: string;
  onTentarNovamente?: () => void;
  children?: React.ReactNode;
}) {
  return (
    <EstadoDados estado={estado} titulo={message} descricao={descricao} onTentarNovamente={onTentarNovamente} compacto>
      {children}
    </EstadoDados>
  );
}
