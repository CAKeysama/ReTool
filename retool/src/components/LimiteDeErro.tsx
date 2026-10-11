import React from 'react';
import { EstadoDados, SkeletonLinha } from './feedback';

const CHAVE_RECARGA = 'retool:recarga-modulo';

/** Erro de arquivo de código carregado sob demanda (rede instável ou nova publicação). */
export function ehErroDeModulo(e: unknown): boolean {
  const msg = String((e as Error)?.message || e || '');
  return /dynamically imported module|Importing a module script failed|error loading dynamically|Failed to fetch|ChunkLoadError/i.test(msg);
}

interface Props {
  children: React.ReactNode;
  /** Versão compacta (dentro de um modal ou de parte da tela). */
  compacto?: boolean;
  /** Chamado ao fechar quando o conteúdo é um modal (ex.: fechar o modal que falhou). */
  onFechar?: () => void;
}

interface Estado { erro: unknown }

/** Depois de um carregamento bem-sucedido, libera nova recarga automática no futuro. */
export function liberarRecargaAutomatica() {
  setTimeout(() => { try { sessionStorage.removeItem(CHAVE_RECARGA); } catch { /* ignora */ } }, 30_000);
}

/**
 * Evita a tela branca quando uma tela ou modal não carrega. Se o motivo é
 * um arquivo de código que não existe mais (o app foi publicado de novo com
 * a aba aberta), recarrega a página uma vez sozinho; senão mostra o erro com
 * "Tentar novamente".
 */
export class LimiteDeErro extends React.Component<Props, Estado> {
  state: Estado = { erro: null };

  static getDerivedStateFromError(erro: unknown): Estado {
    return { erro };
  }

  componentDidCatch(erro: unknown) {
    console.error('Falha ao exibir a tela:', erro);
    if (ehErroDeModulo(erro) && typeof window !== 'undefined') {
      try {
        if (!sessionStorage.getItem(CHAVE_RECARGA) && navigator.onLine) {
          sessionStorage.setItem(CHAVE_RECARGA, String(Date.now()));
          window.location.reload();
        }
      } catch { /* sem sessionStorage: mostra o erro */ }
    }
  }

  private tentarNovamente = () => {
    try { sessionStorage.removeItem(CHAVE_RECARGA); } catch { /* ignora */ }
    if (ehErroDeModulo(this.state.erro)) window.location.reload();
    else this.setState({ erro: null });
  };

  render() {
    if (!this.state.erro) return this.props.children;
    const offline = typeof navigator !== 'undefined' && !navigator.onLine;
    return (
      <div style={{ padding: this.props.compacto ? 0 : '24px 0' }}>
        <EstadoDados
          estado="erro"
          compacto={this.props.compacto}
          titulo="Não foi possível carregar esta tela"
          descricao={offline ? 'Sem conexão com a internet. Verifique a rede e tente novamente.' : 'Tente novamente. Se continuar, recarregue a página.'}
          onTentarNovamente={this.tentarNovamente}
        >
          {this.props.onFechar && (
            <button type="button" className="btn" onClick={() => { this.setState({ erro: null }); this.props.onFechar?.(); }}>Fechar</button>
          )}
        </EstadoDados>
      </div>
    );
  }
}

/** Fundo escurecido com um cartão em esqueleto, enquanto o código de um modal chega. */
export function CarregandoModal() {
  return (
    <div className="modal-overlay" role="status" aria-label="Carregando…" style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius)', padding: '24px', width: 'min(92vw, 520px)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <SkeletonLinha largura="45%" altura={18} />
        <SkeletonLinha largura="100%" />
        <SkeletonLinha largura="85%" />
        <SkeletonLinha largura="60%" />
      </div>
    </div>
  );
}
