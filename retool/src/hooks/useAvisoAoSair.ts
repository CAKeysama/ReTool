import { useEffect } from 'react';

/**
 * Enquanto `ativo`, o navegador pede confirmação antes de fechar ou recarregar
 * a aba (operações longas como importação e ações em massa).
 */
export function useAvisoAoSair(ativo: boolean) {
  useEffect(() => {
    if (!ativo) return;
    const aviso = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', aviso);
    return () => window.removeEventListener('beforeunload', aviso);
  }, [ativo]);
}
