import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePermissions } from './usePermissions';

/*
  Atalhos Globais:
  / -> focus na busca
  H -> Home
  D -> Dispositivos
  U -> Reutilizações
  C -> Categorias
  N -> Novo registro (requer permissão de cadastro)
  Esc -> Close
*/

interface HotkeysConfig {
  onSearchFocus?: () => void;
  onNewRecord?: () => void;
  onClose?: () => void;
}

export function useHotkeys(config?: HotkeysConfig) {
  const navigate = useNavigate();
  const { canCadastrar, canEditar } = usePermissions();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignorar se estiver digitando em um input ou textarea (exceto os atalhos como Esc que sempre podem funcionar ali tb)
      const target = e.target as HTMLElement | null;
      const isInputPhase = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;

      if (e.key === 'Escape') {
        if (config?.onClose) {
          config.onClose();
        }
        return;
      }

      if (isInputPhase) return;

      // Se houver algum modal/diálogo aberto no DOM, ignora todos os atalhos globais
      // para não navegar para outra tela nem desmontar operações em andamento (A1).
      const isModalOpen = !!document.querySelector('[role="dialog"], [aria-modal="true"], .modal-overlay, dialog[open]');
      if (isModalOpen) return;

      // Se o foco estiver em controles interativos (botões, selects, etc.), ignora atalhos
      const isControl = !!target?.closest('button, select, input, textarea, [role="button"]');
      if (isControl) return;

      // Ignora combinações com Ctrl, Alt ou Meta/Command
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      const key = e.key.toLowerCase();

      switch (key) {
        case '/':
          e.preventDefault();
          if (config?.onSearchFocus) {
            config.onSearchFocus();
          }
          break;
        case 'h':
          navigate('/');
          break;
        case 'd':
          navigate('/dispositivos');
          break;
        case 'u':
          navigate('/reutilizacoes');
          break;
        case 'c':
          if (canCadastrar || canEditar) {
            navigate('/categorias');
          }
          break;
        case 'n':
          if (canCadastrar && config?.onNewRecord) {
            e.preventDefault();
            config.onNewRecord();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate, config, canCadastrar, canEditar]);
}
