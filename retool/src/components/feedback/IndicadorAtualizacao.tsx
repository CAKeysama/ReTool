import React from 'react';
import { LoaderCircle } from 'lucide-react';

export interface IndicadorAtualizacaoProps {
  /** true enquanto uma nova consulta roda e os dados anteriores continuam visíveis. */
  ativo: boolean;
  texto?: string;
}

/**
 * Selo discreto "Atualizando…". Mantém o espaço reservado (visibility) para
 * não deslocar o layout quando aparece/desaparece.
 */
export function IndicadorAtualizacao({ ativo, texto = 'Atualizando…' }: IndicadorAtualizacaoProps) {
  return (
    <span
      className="indicador-atualizacao"
      role="status"
      aria-live="polite"
      style={{ visibility: ativo ? 'visible' : 'hidden' }}
    >
      {ativo && (
        <>
          <LoaderCircle size={14} className="estado-dados-girando" aria-hidden="true" />
          {texto}
        </>
      )}
    </span>
  );
}

export interface ConteudoAtualizavelProps {
  /** true → conteúdo esmaecido e aria-busy enquanto a nova consulta roda. */
  atualizando: boolean;
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}

/** Contêiner que esmaece levemente o conteúdo anterior durante a atualização. */
export function ConteudoAtualizavel({ atualizando, children, style, className }: ConteudoAtualizavelProps) {
  return (
    <div
      className={`conteudo-atualizavel${atualizando ? ' conteudo-atualizavel--ativo' : ''}${className ? ` ${className}` : ''}`}
      aria-busy={atualizando || undefined}
      style={style}
    >
      {children}
    </div>
  );
}
