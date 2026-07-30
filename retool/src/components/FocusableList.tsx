import React from 'react';
import { useKeyboardNavigation } from '../hooks/useKeyboardNavigation';

interface FocusableListProps<T> {
  items: T[];
  renderItem: (item: T, index: number, isFocused: boolean) => React.ReactNode;
  onItemAction?: (item: T) => void;
  onDeleteItem?: (item: T) => void;
  onEditItem?: (item: T) => void;
  ariaLabel?: string;
}

export function FocusableList<T>({ items, renderItem, onItemAction, onDeleteItem, onEditItem, ariaLabel }: FocusableListProps<T>) {
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
        gap: 'var(--spacing-sm)' 
      }}
    >
      {items.map((item, index) => {
        const isFocused = index === activeIndex;
        return (
          <li
            key={index}
            role="option"
            aria-selected={isFocused}
            tabIndex={0}
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
            style={{
              padding: 'var(--spacing-md) var(--spacing-lg)',
              border: isFocused ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
              borderRadius: 'var(--radius)',
              cursor: onItemAction ? 'pointer' : 'default',
              backgroundColor: 'var(--color-surface)',
              outline: isFocused ? '2px solid rgba(228, 13, 44, 0.1)' : 'none',
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
