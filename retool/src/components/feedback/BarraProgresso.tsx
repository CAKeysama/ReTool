import React from 'react';

const fmtInteiro = new Intl.NumberFormat('pt-BR');
const fmtPct = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export interface BarraProgressoProps {
  feitos: number;
  /** Total esperado. 0/undefined → modo indeterminado (sem porcentagem inventada). */
  total?: number;
  /** Rótulo acima da barra (ex.: "Importando dispositivos"). */
  rotulo?: string;
  /** Texto auxiliar abaixo da barra (ex.: "Lote 3 de 10"). */
  detalhe?: string;
}

/** Barra de progresso com contagem "127.430 / 472.976 · 26,9%" em pt-BR. */
export function BarraProgresso({ feitos, total, rotulo, detalhe }: BarraProgressoProps) {
  const feitosSeguro = Math.max(0, Number.isFinite(feitos) ? feitos : 0);
  const determinado = typeof total === 'number' && Number.isFinite(total) && total > 0;
  const fracao = determinado ? Math.min(1, feitosSeguro / (total as number)) : 0;
  const pct = fracao * 100;

  const contagem = determinado
    ? `${fmtInteiro.format(feitosSeguro)} / ${fmtInteiro.format(total as number)} · ${fmtPct.format(pct)}%`
    : `${fmtInteiro.format(feitosSeguro)} processados`;

  return (
    <div className="barra-progresso">
      {(rotulo || contagem) && (
        <div className="barra-progresso-topo">
          {rotulo && <span className="barra-progresso-rotulo">{rotulo}</span>}
          <span className="barra-progresso-contagem">{contagem}</span>
        </div>
      )}
      <div
        className={`barra-progresso-trilho${determinado ? '' : ' barra-progresso-trilho--indeterminado'}`}
        role="progressbar"
        aria-label={rotulo || 'Progresso'}
        aria-valuemin={0}
        aria-valuemax={determinado ? total : undefined}
        aria-valuenow={determinado ? Math.min(feitosSeguro, total as number) : undefined}
        aria-valuetext={contagem}
      >
        <div
          className="barra-progresso-preenchimento"
          style={determinado ? { transform: `scaleX(${fracao})` } : undefined}
        />
      </div>
      {detalhe && <div className="barra-progresso-detalhe">{detalhe}</div>}
    </div>
  );
}
