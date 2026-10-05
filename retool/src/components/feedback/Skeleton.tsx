import React from 'react';

/*
 * Esqueletos de carregamento. Todos são decorativos (aria-hidden): o anúncio
 * "Carregando…" para leitores de tela fica a cargo de <EstadoDados estado="carregando">
 * ou de um texto sr-only no contêiner que os usa.
 * A animação (shimmer) é definida em index.css (.skeleton) e desligada com
 * prefers-reduced-motion.
 */

function px(v: string | number | undefined, padrao: string): string {
  if (v === undefined) return padrao;
  return typeof v === 'number' ? `${v}px` : v;
}

interface SkeletonLinhaProps {
  largura?: string | number;
  altura?: number;
  /** Raio de borda (padrão: 4px). */
  raio?: string | number;
  style?: React.CSSProperties;
}

/** Bloco retangular genérico. */
export function SkeletonLinha({ largura, altura = 12, raio, style }: SkeletonLinhaProps) {
  return (
    <span
      className="skeleton"
      aria-hidden="true"
      style={{
        display: 'block',
        width: px(largura, '100%'),
        height: `${altura}px`,
        borderRadius: px(raio, '4px'),
        flexShrink: 0,
        ...style
      }}
    />
  );
}

// Larguras variadas e determinísticas (sem Math.random → sem saltos entre renders).
const LARGURAS_TITULO = ['42%', '58%', '35%', '50%', '64%', '46%'];
const LARGURAS_BADGES = [[64, 72, 56], [80, 60], [56, 88, 48], [72, 64]];

interface SkeletonListaProps {
  linhas?: number;
  /** Altura mínima de cada item (padrão 74px, igual ao item da lista de dispositivos). */
  alturaLinha?: number;
}

/** Imita os itens da lista de dispositivos: ícone 40px + título/código + badges. */
export function SkeletonLista({ linhas = 5, alturaLinha = 74 }: SkeletonListaProps) {
  return (
    <ul className="skeleton-lista" aria-hidden="true">
      {Array.from({ length: Math.max(0, linhas) }, (_, i) => (
        <li key={i} className="skeleton-lista-item" style={{ minHeight: `${alturaLinha}px` }}>
          <SkeletonLinha largura={40} altura={40} raio="var(--radius-sm)" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <SkeletonLinha largura={LARGURAS_TITULO[i % LARGURAS_TITULO.length]} altura={14} />
              <SkeletonLinha largura={56} altura={10} />
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {LARGURAS_BADGES[i % LARGURAS_BADGES.length].map((w, j) => (
                <SkeletonLinha key={j} largura={w} altura={18} raio={12} />
              ))}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

interface SkeletonTabelaProps {
  linhas?: number;
  colunas?: number;
}

/** Tabela genérica: cabeçalho + linhas com células de larguras variadas. */
export function SkeletonTabela({ linhas = 6, colunas = 4 }: SkeletonTabelaProps) {
  const cols = Math.max(1, colunas);
  const grade = { gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` };
  return (
    <div className="skeleton-tabela" aria-hidden="true">
      <div className="skeleton-tabela-linha skeleton-tabela-cabecalho" style={grade}>
        {Array.from({ length: cols }, (_, c) => (
          <SkeletonLinha key={c} largura="60%" altura={10} />
        ))}
      </div>
      {Array.from({ length: Math.max(0, linhas) }, (_, l) => (
        <div key={l} className="skeleton-tabela-linha" style={grade}>
          {Array.from({ length: cols }, (_, c) => (
            <SkeletonLinha key={c} largura={`${55 + ((l * 7 + c * 13) % 40)}%`} altura={12} />
          ))}
        </div>
      ))}
    </div>
  );
}

interface SkeletonCardsProps {
  quantidade?: number;
}

/** Cards 140×140 da Home (ícone circular + número + rótulo). */
export function SkeletonCards({ quantidade = 3 }: SkeletonCardsProps) {
  return (
    <div className="skeleton-cards" aria-hidden="true">
      {Array.from({ length: Math.max(0, quantidade) }, (_, i) => (
        <div key={i} className="skeleton-card">
          <SkeletonLinha largura={32} altura={32} raio="50%" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <SkeletonLinha largura={48} altura={24} />
            <SkeletonLinha largura={72} altura={10} />
          </div>
        </div>
      ))}
    </div>
  );
}
