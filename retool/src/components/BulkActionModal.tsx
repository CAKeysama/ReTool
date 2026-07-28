import React from 'react';
import { ListChecks, Search, X, CheckSquare, Square, Trash2, AlertTriangle } from 'lucide-react';
import { AccessibleModal } from './AccessibleModal';
import { BulkProgress } from '../hooks/useBulkProgress';

export interface BulkItem {
  id: string;
  label: string;
  sublabel?: string;
  inactive?: boolean;
}

interface BulkActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: BulkItem[];
  selected: Set<string>;
  search: string;
  onSearchChange: (val: string) => void;
  onToggleItem: (id: string) => void;
  onToggleAll: () => void;
  confirmAction: 'disable' | 'delete' | null;
  onSetConfirmAction: (action: 'disable' | 'delete' | null) => void;
  onDisable?: () => Promise<void>;
  onDelete: () => Promise<void>;
  isLoading: boolean;
  progress?: BulkProgress | null;
  /** Se false, o botão "Desativar" não aparece */
  canDisable?: boolean;
}

export function BulkActionModal({
  isOpen,
  onClose,
  items,
  selected,
  search,
  onSearchChange,
  onToggleItem,
  onToggleAll,
  confirmAction,
  onSetConfirmAction,
  onDisable,
  onDelete,
  isLoading,
  progress,
  canDisable = true,
}: BulkActionModalProps) {
  if (!isOpen) return null;

  const allSelected = items.length > 0 && items.every(d => selected.has(d.id));
  const someSelected = selected.size > 0;

  return (
    <>
      {/* Main selection modal */}
      <div
        className="modal-overlay"
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '16px'
        }}
        onClick={isLoading ? undefined : onClose}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="bulk-modal-title"
          style={{
            backgroundColor: 'white',
            borderRadius: 'var(--radius-lg)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
            width: '100%',
            maxWidth: '560px',
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            position: 'relative'
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Loading overlay */}
          {isLoading && (
            <div style={{
              position: 'absolute', inset: 0,
              backgroundColor: 'rgba(255,255,255,0.96)',
              zIndex: 10,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: '20px',
              borderRadius: 'var(--radius-lg)',
              padding: '32px'
            }}>
              {progress ? (
                // Barra de progresso real
                <>
                  <div style={{ width: '100%', maxWidth: '340px', textAlign: 'center' }}>
                    <p style={{ fontWeight: 700, color: 'var(--color-text-dark)', fontSize: '1rem', margin: '0 0 6px' }}>
                      {progress.done < progress.total
                        ? `Processando itens...`
                        : `Concluído!`}
                    </p>
                    <p style={{ fontSize: '0.82rem', color: '#9ca3af', margin: '0 0 16px' }}>
                      {progress.done} de {progress.total} {progress.total === 1 ? 'item' : 'itens'}
                    </p>
                    {/* Track */}
                    <div style={{
                      width: '100%', height: '8px',
                      backgroundColor: 'var(--color-border)',
                      borderRadius: '99px', overflow: 'hidden'
                    }}>
                      <div style={{
                        height: '100%',
                        width: `${Math.round((progress.done / progress.total) * 100)}%`,
                        backgroundColor: progress.done === progress.total
                          ? 'var(--color-success)'
                          : 'var(--color-primary)',
                        borderRadius: '99px',
                        transition: 'width 0.25s ease, background-color 0.3s ease'
                      }} />
                    </div>
                    <p style={{ fontSize: '0.78rem', color: 'var(--color-text-body)', marginTop: '8px', fontWeight: 600 }}>
                      {Math.round((progress.done / progress.total) * 100)}%
                    </p>
                  </div>
                </>
              ) : (
                // Spinner simples (fallback para operações ≤ threshold)
                <>
                  <div style={{
                    width: '40px', height: '40px',
                    border: '3px solid var(--color-border)',
                    borderTop: '3px solid var(--color-primary)',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite'
                  }} />
                  <p style={{ fontWeight: 600, color: 'var(--color-text-dark)', fontSize: '0.95rem', margin: 0 }}>
                    Processando {selected.size} {selected.size === 1 ? 'item' : 'itens'}...
                  </p>
                </>
              )}
              <p style={{ fontSize: '0.75rem', color: '#9ca3af', margin: 0 }}>Não feche esta janela</p>
            </div>
          )}
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '20px 24px 16px',
            borderBottom: '1px solid var(--color-border)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: 'var(--radius-sm)',
                backgroundColor: 'rgba(228,13,44,0.08)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <ListChecks size={18} color="var(--color-primary)" />
              </div>
              <div>
                <h2 id="bulk-modal-title" style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>
                  Ações em Massa
                </h2>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#9ca3af' }}>
                  Selecione itens e aplique uma ação
                </p>
              </div>
            </div>
            <button
              className="btn btn-icon"
              onClick={onClose}
              aria-label="Fechar"
            >
              <X size={18} />
            </button>
          </div>

          {/* Search */}
          <div style={{ padding: '14px 24px', borderBottom: '1px solid var(--color-border)' }}>
            <div style={{ position: 'relative' }}>
              <Search size={16} color="#9ca3af" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              <input
                type="text"
                className="input-field"
                placeholder="Buscar item..."
                value={search}
                onChange={e => onSearchChange(e.target.value)}
                style={{ paddingLeft: '38px', height: '38px', fontSize: '0.9rem' }}
                autoFocus
              />
            </div>
          </div>

          {/* Select All */}
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '10px 24px',
              borderBottom: '1px solid var(--color-border)',
              backgroundColor: allSelected ? 'rgba(228,13,44,0.04)' : '#fafafa',
              cursor: 'pointer',
              userSelect: 'none'
            }}
            onClick={onToggleAll}
          >
            {allSelected
              ? <CheckSquare size={18} color="var(--color-primary)" />
              : <Square size={18} color="#9ca3af" />
            }
            <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--color-text-dark)' }}>
              Selecionar todos ({items.length})
            </span>
          </div>

          {/* List */}
          <div
            className="custom-scrollbar"
            style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}
          >
            {items.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px', color: '#9ca3af', fontSize: '0.9rem' }}>
                Nenhum item encontrado
              </div>
            ) : (
              items.map(item => {
                const isSelected = selected.has(item.id);
                return (
                  <div
                    key={item.id}
                    onClick={() => onToggleItem(item.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      padding: '10px 24px',
                      cursor: 'pointer',
                      backgroundColor: isSelected ? 'rgba(228,13,44,0.05)' : 'transparent',
                      borderLeft: isSelected ? '3px solid var(--color-primary)' : '3px solid transparent',
                      transition: 'background-color 0.15s, border-color 0.15s'
                    }}
                  >
                    {isSelected
                      ? <CheckSquare size={18} color="var(--color-primary)" style={{ flexShrink: 0 }} />
                      : <Square size={18} color="#d1d5db" style={{ flexShrink: 0 }} />
                    }
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                        <span style={{
                          fontWeight: 600, fontSize: '0.9rem',
                          color: isSelected ? 'var(--color-primary)' : 'var(--color-text-dark)',
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                        }}>
                          {item.label}
                        </span>
                        {item.sublabel && (
                          <span style={{ fontSize: '0.78rem', color: '#9ca3af', flexShrink: 0 }}>
                            {item.sublabel}
                          </span>
                        )}
                      </div>
                    </div>
                    {item.inactive && (
                      <span style={{
                        fontSize: '0.7rem', padding: '2px 7px', borderRadius: '99px',
                        backgroundColor: 'var(--gray03)', color: 'var(--gray00)', flexShrink: 0
                      }}>
                        Inativo
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div style={{
            padding: '14px 24px',
            borderTop: '1px solid var(--color-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            backgroundColor: '#fafafa',
            gap: '12px',
            flexWrap: 'wrap'
          }}>
            <span style={{ fontSize: '0.85rem', color: '#6b7280', fontWeight: 500 }}>
              {selected.size > 0
                ? <><strong style={{ color: 'var(--color-text-dark)' }}>{selected.size}</strong> selecionado{selected.size > 1 ? 's' : ''}</>
                : 'Nenhum selecionado'
              }
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="btn"
                onClick={onClose}
                style={{ padding: '0 16px', height: '36px' }}
              >
                Cancelar
              </button>
              {canDisable && onDisable && (
                <button
                  className="btn"
                  disabled={!someSelected || isLoading}
                  onClick={() => onSetConfirmAction('disable')}
                  style={{
                    padding: '0 16px', height: '36px',
                    color: someSelected ? 'var(--various04)' : '#9ca3af',
                    borderColor: someSelected ? 'var(--various04)' : 'var(--color-border)',
                    opacity: someSelected ? 1 : 0.5
                  }}
                >
                  Desativar
                </button>
              )}
              <button
                className="btn btn-primary"
                disabled={!someSelected || isLoading}
                onClick={() => onSetConfirmAction('delete')}
                style={{
                  padding: '0 16px', height: '36px',
                  backgroundColor: someSelected ? 'var(--color-danger)' : '#9ca3af',
                  borderColor: someSelected ? 'var(--color-danger)' : '#9ca3af',
                  display: 'flex', alignItems: 'center', gap: '6px'
                }}
              >
                <Trash2 size={15} />
                Excluir
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmação: Desativar */}
      <AccessibleModal
        isOpen={confirmAction === 'disable'}
        onClose={() => onSetConfirmAction(null)}
        title="Desativar itens"
        maxWidth="420px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
            <AlertTriangle size={22} color="var(--various04)" style={{ flexShrink: 0, marginTop: '2px' }} />
            <p style={{ color: 'var(--color-text-dark)', lineHeight: 1.6 }}>
              Você está prestes a <strong>desativar {selected.size} item{selected.size > 1 ? 's' : ''}</strong>.
              Eles não serão excluídos, mas ficarão inativos no sistema.
            </p>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-sm)' }}>
            <button className="btn" onClick={() => onSetConfirmAction(null)} disabled={isLoading}>
              Cancelar
            </button>
            <button
              className="btn"
              style={{ color: 'var(--various04)', borderColor: 'var(--various04)' }}
              onClick={onDisable}
              disabled={isLoading}
            >
              {isLoading ? 'Processando...' : `Desativar ${selected.size}`}
            </button>
          </div>
        </div>
      </AccessibleModal>

      {/* Confirmação: Excluir */}
      <AccessibleModal
        isOpen={confirmAction === 'delete'}
        onClose={() => onSetConfirmAction(null)}
        title="Excluir itens"
        maxWidth="420px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
            <AlertTriangle size={22} color="var(--color-danger)" style={{ flexShrink: 0, marginTop: '2px' }} />
            <p style={{ color: 'var(--color-text-dark)', lineHeight: 1.6 }}>
              Você está prestes a <strong>excluir permanentemente {selected.size} item{selected.size > 1 ? 's' : ''}</strong>.
              Esta ação <strong>não pode ser desfeita</strong>.
            </p>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-sm)' }}>
            <button className="btn" onClick={() => onSetConfirmAction(null)} disabled={isLoading}>
              Cancelar
            </button>
            <button
              className="btn btn-primary"
              style={{ backgroundColor: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}
              onClick={onDelete}
              disabled={isLoading}
            >
              {isLoading ? 'Excluindo...' : `Excluir ${selected.size}`}
            </button>
          </div>
        </div>
      </AccessibleModal>
    </>
  );
}
