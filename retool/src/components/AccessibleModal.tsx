import React, { useEffect, useRef } from 'react';

interface AccessibleModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function AccessibleModal({ isOpen, onClose, title, children }: AccessibleModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && modalRef.current) {
      modalRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      className="modal-overlay"
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000,
        display: 'flex', justifyContent: 'center'
      }}
      onClick={onClose}
    >
      <div 
        ref={modalRef}
        tabIndex={-1} // focusable via JS
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className="modal-content"
        style={{
          backgroundColor: 'white', padding: 'var(--spacing-lg)', 
          borderRadius: 'var(--radius)', width: '100%', maxWidth: '400px',
          overflowY: 'auto',
          boxShadow: 'var(--shadow)'
        }}
        onClick={(e) => e.stopPropagation()} // previne fechar ao clicar dentro
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            onClose();
          }
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
          <h2 id="modal-title" style={{ margin: 0 }}>{title}</h2>
          <button 
            onClick={onClose} 
            className="btn" 
            aria-label="Fechar janela"
            style={{ padding: '4px 8px' }}
          >
            X
          </button>
        </div>
        <div>
          {children}
        </div>
      </div>
    </div>
  );
}
