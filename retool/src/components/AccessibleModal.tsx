import React, { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

interface AccessibleModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: string;
}

/*
 * Pilha de modais abertos: só o do topo responde ao Esc, para que um modal
 * de confirmação aberto sobre outro não feche os dois de uma vez.
 */
const pilhaModais: symbol[] = [];

const SELETOR_FOCAVEIS = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function AccessibleModal({ isOpen, onClose, title, children, maxWidth = '400px' }: AccessibleModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const tituloId = useId();
  // onClose costuma ser uma arrow inline: guardamos em ref para não recriar
  // os listeners a cada render do componente pai.
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const chave = Symbol('modal');
    pilhaModais.push(chave);
    const focoAnterior = document.activeElement as HTMLElement | null;

    // Foca o modal só se nenhum filho (ex.: input com autoFocus) já pegou o foco.
    if (modalRef.current && !modalRef.current.contains(document.activeElement)) {
      modalRef.current.focus();
    }

    // Trava a rolagem da página enquanto o modal está aberto.
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKey = (e: KeyboardEvent) => {
      if (pilhaModais[pilhaModais.length - 1] !== chave) return;
      // Esc com o foco fora do diálogo (o caso com foco dentro é tratado no onKeyDown).
      if (e.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      // Mantém o Tab circulando dentro do modal.
      if (e.key === 'Tab' && modalRef.current) {
        const focaveis = Array.from(modalRef.current.querySelectorAll<HTMLElement>(SELETOR_FOCAVEIS))
          .filter(el => el.offsetParent !== null);
        if (focaveis.length === 0) { e.preventDefault(); return; }
        const primeiro = focaveis[0];
        const ultimo = focaveis[focaveis.length - 1];
        const ativo = document.activeElement;
        if (e.shiftKey && (ativo === primeiro || ativo === modalRef.current)) {
          e.preventDefault();
          ultimo.focus();
        } else if (!e.shiftKey && ativo === ultimo) {
          e.preventDefault();
          primeiro.focus();
        }
      }
    };
    window.addEventListener('keydown', handleKey);

    return () => {
      window.removeEventListener('keydown', handleKey);
      const i = pilhaModais.indexOf(chave);
      if (i >= 0) pilhaModais.splice(i, 1);
      if (pilhaModais.length === 0) document.body.style.overflow = overflowAnterior;
      // Devolve o foco para quem abriu o modal, se ainda estiver na página.
      if (focoAnterior && document.contains(focoAnterior)) focoAnterior.focus();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay modal-overlay-acessivel"
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000,
        display: 'flex', justifyContent: 'center'
      }}
      onClick={() => onCloseRef.current()}
    >
      <div
        ref={modalRef}
        tabIndex={-1} // focusable via JS
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        className="modal-content modal-acessivel"
        style={{
          backgroundColor: 'white',
          borderRadius: 'var(--radius)', width: '100%', maxWidth: maxWidth,
          boxShadow: 'var(--shadow)'
        }}
        onClick={(e) => e.stopPropagation()} // previne fechar ao clicar dentro
        onKeyDown={(e) => {
          // Para aqui o Esc, para que atalhos globais (useHotkeys) não reajam também.
          if (e.key === 'Escape') {
            e.stopPropagation();
            onCloseRef.current();
          }
        }}
      >
        <div className="modal-acessivel-cabecalho">
          <h2 id={tituloId} style={{ margin: 0 }}>{title}</h2>
          <button
            type="button"
            onClick={() => onCloseRef.current()}
            className="btn btn-icon"
            aria-label="Fechar janela"
          >
            <X size={16} />
          </button>
        </div>
        <div className="modal-acessivel-corpo custom-scrollbar">
          {children}
        </div>
      </div>
    </div>
  );
}
