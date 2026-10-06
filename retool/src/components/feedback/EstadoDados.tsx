import React from 'react';
import { Ban, Clock, Inbox, LoaderCircle, Lock, RotateCw, SearchX, TriangleAlert } from 'lucide-react';

export type EstadoDadosTipo =
  | 'carregando'
  | 'vazio'
  | 'sem-resultados'
  | 'erro'
  | 'timeout'
  | 'sem-permissao'
  | 'cancelado';

interface Padrao {
  icone: React.ComponentType<{ size?: number; className?: string; 'aria-hidden'?: boolean }>;
  titulo: string;
  descricao: string;
}

const PADROES: Record<EstadoDadosTipo, Padrao> = {
  carregando: { icone: LoaderCircle, titulo: 'Carregando…', descricao: 'Buscando os dados mais recentes.' },
  vazio: { icone: Inbox, titulo: 'Nada cadastrado ainda', descricao: 'Quando houver registros, eles aparecerão aqui.' },
  'sem-resultados': { icone: SearchX, titulo: 'Nenhum resultado para os filtros', descricao: 'Tente outros termos ou limpe os filtros aplicados.' },
  erro: { icone: TriangleAlert, titulo: 'Não foi possível carregar os dados', descricao: 'Verifique sua conexão e tente novamente.' },
  timeout: { icone: Clock, titulo: 'A consulta demorou mais que o esperado', descricao: 'A conexão pode estar lenta. Tente novamente em instantes.' },
  'sem-permissao': { icone: Lock, titulo: 'Sem permissão para ver estes dados', descricao: 'Peça a um administrador para liberar o acesso.' },
  cancelado: { icone: Ban, titulo: 'Consulta cancelada', descricao: 'A operação foi interrompida antes de terminar.' }
};

export interface EstadoDadosProps {
  estado: EstadoDadosTipo;
  /** Substitui o título padrão (ex.: "Nenhum dispositivo cadastrado"). */
  titulo?: string;
  /** Substitui a descrição padrão. Passe '' para ocultar. */
  descricao?: string;
  /** Exibe "Tentar novamente" (em erro, timeout e cancelado). */
  onTentarNovamente?: () => void;
  /** Versão reduzida para listas pequenas, modais e painéis. */
  compacto?: boolean;
  /** Conteúdo extra (ex.: botão "Limpar filtros" ou "Cadastrar"). */
  children?: React.ReactNode;
}

const ESTADOS_COM_REPETICAO: EstadoDadosTipo[] = ['erro', 'timeout', 'cancelado'];
const ESTADOS_DE_ALERTA: EstadoDadosTipo[] = ['erro', 'timeout', 'sem-permissao'];

/**
 * Bloco de estado para listas e painéis: carregando, vazio, sem resultados,
 * erro, timeout, sem permissão e cancelado — cada um com ícone e texto próprios.
 */
export function EstadoDados({ estado, titulo, descricao, onTentarNovamente, compacto = false, children }: EstadoDadosProps) {
  const padrao = PADROES[estado];
  const Icone = padrao.icone;
  const alerta = ESTADOS_DE_ALERTA.includes(estado);
  const desc = descricao ?? padrao.descricao;
  const mostrarRepetir = !!onTentarNovamente && ESTADOS_COM_REPETICAO.includes(estado);

  return (
    <div
      className={`estado-dados estado-dados--${estado}${compacto ? ' estado-dados--compacto' : ''}`}
      role={alerta ? 'alert' : 'status'}
      aria-live={alerta ? 'assertive' : 'polite'}
      aria-busy={estado === 'carregando' || undefined}
    >
      <span className="estado-dados-icone" aria-hidden="true">
        <Icone size={compacto ? 20 : 28} className={estado === 'carregando' ? 'estado-dados-girando' : undefined} />
      </span>
      <p className="estado-dados-titulo">{titulo ?? padrao.titulo}</p>
      {desc && <p className="estado-dados-descricao">{desc}</p>}
      {(mostrarRepetir || children) && (
        <div className="estado-dados-acoes">
          {mostrarRepetir && (
            <button type="button" className="btn" onClick={onTentarNovamente}>
              <RotateCw size={16} aria-hidden="true" /> Tentar novamente
            </button>
          )}
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * Classifica um erro qualquer (Firebase, fetch, AbortController, `comTimeout`)
 * em um dos estados de falha do <EstadoDados>.
 */
export function classificarErro(e: unknown): 'erro' | 'timeout' | 'sem-permissao' | 'cancelado' {
  if (!e || typeof e !== 'object') return 'erro';
  const { code, name } = e as { code?: unknown; name?: unknown };
  const codigo = typeof code === 'string' ? code.replace(/^firestore\//, '').replace(/^storage\//, '') : '';
  const nome = typeof name === 'string' ? name : '';

  if (codigo === 'permission-denied' || codigo === 'unauthorized' || codigo === 'unauthenticated') return 'sem-permissao';
  if (codigo === 'timeout' || codigo === 'deadline-exceeded' || codigo === 'unavailable'
    || codigo === 'retry-limit-exceeded' || nome === 'TimeoutError' || nome === 'ErroTimeout') return 'timeout';
  if (codigo === 'cancelled' || codigo === 'canceled' || nome === 'AbortError') return 'cancelado';
  return 'erro';
}

/** Mensagem curta em pt-BR para um erro (útil em toasts). */
export function mensagemDeErro(e: unknown, fallback = 'Não foi possível concluir a operação.'): string {
  switch (classificarErro(e)) {
    case 'sem-permissao': return 'Você não tem permissão para esta operação.';
    case 'timeout': {
      // ErroTimeout com mensagem própria (ex.: gravação pendente) mantém a mensagem.
      const msg = (e as { name?: string; message?: string })?.name === 'ErroTimeout' ? (e as Error).message : '';
      return msg && msg !== 'A operação demorou mais que o esperado.' ? msg : 'O servidor demorou a responder. Verifique a conexão e tente novamente.';
    }
    case 'cancelado': return 'A operação foi cancelada.';
    default: {
      const msg = e instanceof Error ? e.message : '';
      return msg || fallback;
    }
  }
}
