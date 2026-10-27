import React from 'react';
import { useKeyboardNavigation } from '../hooks/useKeyboardNavigation';

interface FocusableListProps<T> {
  items: T[];
  renderItem: (item: T, index: number, isFocused: boolean) => React.ReactNode;
  onItemAction?: (item: T) => void;
  onDeleteItem?: (item: T) => void;
  onEditItem?: (item: T) => void;
  ariaLabel?: string;
  /** Chave estável por item (evita remontar linhas ao paginar/filtrar). */
  getKey?: (item: T, index: number) => string;
  /** "cartao" (padrão): itens com borda, para listas no nível da página. "linha": linhas com divisória, para listas dentro de um cartão. */
  variante?: 'cartao' | 'linha';
}

export function FocusableList<T>({ items, renderItem, onItemAction, onDeleteItem, onEditItem, ariaLabel, getKey, variante = 'cartao' }: FocusableListProps<T>) {
  const emLinha = variante === 'linha';
  const { activeIndex, setActiveIndex, containerRef, handleKeyDown } = useKeyboardNavigation<HTMLUListElement>(items.length, 1);

  if (items.length === 0) {
    return <div style={{ padding: 'var(--spacing-md)', color: 'var(--color-text-body)' }}>Nenhum item encontrado.</div>;
  }

  return (
    <ul 
      ref={containerRef}
      role="listbox"
      aria-label={ariaLabel || "Lista interativa"}
      onKeyDown={handleKeyDown}
      style={{ 
        listStyle: 'none', 
        padding: 0, 
        margin: 0, 
        display: 'flex', 
        flexDirection: 'column', 
        gap: emLinha ? 0 : 'var(--spacing-sm)' 
      }}
    >
      {items.map((item, index) => {
        const isFocused = index === activeIndex;
        // Uma única parada de Tab na lista (a linha ativa); as setas andam entre as linhas.
        const paradaDeTab = index === (activeIndex >= 0 && activeIndex < items.length ? activeIndex : 0);
        return (
          <li
            key={getKey ? getKey(item, index) : index}
            role="option"
            aria-selected={isFocused}
            tabIndex={paradaDeTab ? 0 : -1}
            data-navigable="true"
            onFocus={() => setActiveIndex(index)}
            onClick={() => onItemAction && onItemAction(item)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onItemAction && onItemAction(item);
              }
              // D = deletar item focado
              if (e.key === 'd' || e.key === 'D') {
                e.preventDefault();
                e.stopPropagation(); // impede o atalho global de navegar para /dispositivos
                onDeleteItem && onDeleteItem(item);
              }
              // E = editar item focado
              if (e.key === 'e' || e.key === 'E') {
                e.preventDefault();
                e.stopPropagation();
                onEditItem && onEditItem(item);
              }
            }}
            style={emLinha ? {
              padding: '10px 8px',
              borderBottom: index < items.length - 1 ? '1px solid var(--color-border)' : 'none',
              borderRadius: 'var(--radius-sm)',
              cursor: onItemAction ? 'pointer' : 'default',
              backgroundColor: isFocused ? 'var(--color-hover)' : 'transparent',
              transition: 'background-color 0.15s ease',
              display: 'flex',
              alignItems: 'center',
              wordBreak: 'break-word',
              minWidth: 0
            } : {
              padding: 'var(--spacing-md) var(--spacing-lg)',
              border: isFocused ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
              borderRadius: 'var(--radius)',
              cursor: onItemAction ? 'pointer' : 'default',
              backgroundColor: 'var(--color-surface)',
              outline: isFocused ? '2px solid var(--color-primary)' : 'none',
              outlineOffset: '2px',
              transition: 'all 0.15s ease',
              display: 'flex',
              alignItems: 'center',
              boxShadow: isFocused ? '0 4px 12px rgba(228, 13, 44, 0.05)' : 'none',
              wordBreak: 'break-word',
              minWidth: 0
            }}
          >
            {renderItem(item, index, isFocused)}
          </li>
        );
      })}
    </ul>
  );
}
