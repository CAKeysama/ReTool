import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/*
  Atalhos Globais:
  / -> focus na busca
  H -> Home
  D -> Dispositivos
  U -> Utilizações
  C -> Categorias
  N -> Novo registro
  Esc -> Close
*/

interface HotkeysConfig {
  onSearchFocus?: () => void;
  onNewRecord?: () => void;
  onClose?: () => void;
}

export function useHotkeys(config?: HotkeysConfig) {
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignorar se estiver digitando em um input ou textarea (exceto os atalhos como Esc que sempre podem funcionar ali tb)
      const target = e.target as HTMLElement;
      const isInputPhase = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      if (e.key === 'Escape') {
        if (config?.onClose) {
          config.onClose();
        }
      }

      if (isInputPhase) return;

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
          navigate('/utilizacoes');
          break;
        case 'c':
          navigate('/categorias');
          break;
        case 'n':
          if (config?.onNewRecord) {
            config.onNewRecord();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate, config]);
}
