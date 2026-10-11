import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';

interface VirtualListProps<T> {
  itens: T[];
  /** Altura fixa de cada linha, em px (necessária para calcular a janela visível). */
  alturaItem: number;
  chave: (item: T) => string;
  renderItem: (item: T, index: number, ativo: boolean) => React.ReactNode;
  /** Enter/Espaço sobre a linha ativa. */
  onAtivar?: (item: T, index: number) => void;
  ariaLabel: string;
  className?: string;
  style?: React.CSSProperties;
  /** Linhas extras renderizadas acima/abaixo da área visível. */
  margem?: number;
  /** Seleção múltipla: informa se o item está marcado (leitores de tela anunciam "selecionado"). */
  marcado?: (item: T) => boolean;
}

/**
 * Lista virtualizada: só as linhas visíveis (mais uma margem) existem no DOM,
 * então 20 mil itens custam o mesmo que 20. Navegação por teclado com
 * setas/Home/End/PageUp/PageDown e Enter/Espaço, rolando até a linha ativa.
 */
export function VirtualList<T>({
  itens, alturaItem, chave, renderItem, onAtivar, ariaLabel, className, style, margem = 6, marcado
}: VirtualListProps<T>) {
  const prefixo = useId();
  const ref = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [alturaVisivel, setAlturaVisivel] = useState(400);
  const [ativo, setAtivo] = useState(-1);
  const raf = useRef(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setAlturaVisivel(el.clientHeight || 400);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setAlturaVisivel(el.clientHeight || 400));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  // Lista nova (busca/filtro): volta ao topo para não exibir uma janela vazia.
  useEffect(() => {
    setAtivo(a => (a >= itens.length ? -1 : a));
    if (ref.current && ref.current.scrollTop > itens.length * alturaItem) {
      ref.current.scrollTop = 0;
      setScrollTop(0);
    }
  }, [itens, alturaItem]);

  const onScroll = useCallback(() => {
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => setScrollTop(ref.current?.scrollTop || 0));
  }, []);

  const irPara = (i: number) => {
    const el = ref.current;
    if (!el || itens.length === 0) return;
    const idx = Math.max(0, Math.min(itens.length - 1, i));
    setAtivo(idx);
    const topo = idx * alturaItem;
    if (topo < el.scrollTop) el.scrollTop = topo;
    else if (topo + alturaItem > el.scrollTop + el.clientHeight) el.scrollTop = topo + alturaItem - el.clientHeight;
  };

  const porPagina = Math.max(1, Math.floor(alturaVisivel / alturaItem));
  const onKeyDown = (e: React.KeyboardEvent) => {
    const mapa: Record<string, number> = {
      ArrowDown: ativo + 1, ArrowUp: ativo - 1, PageDown: ativo + porPagina, PageUp: ativo - porPagina,
      Home: 0, End: itens.length - 1,
    };
    if (e.key in mapa) {
      e.preventDefault();
      irPara(ativo < 0 && e.key === 'ArrowUp' ? 0 : mapa[e.key]);
    } else if ((e.key === 'Enter' || e.key === ' ') && ativo >= 0 && itens[ativo]) {
      e.preventDefault();
      onAtivar?.(itens[ativo], ativo);
    }
  };

  const inicio = Math.max(0, Math.floor(scrollTop / alturaItem) - margem);
  const fim = Math.min(itens.length, Math.ceil((scrollTop + alturaVisivel) / alturaItem) + margem);
  const visiveis: React.ReactNode[] = [];
  for (let i = inicio; i < fim; i++) {
    const item = itens[i];
    visiveis.push(
      <div
        key={chave(item)}
        id={`${prefixo}-item-${i}`}
        role="option"
        aria-selected={marcado ? marcado(item) : i === ativo}
        className={i === ativo ? 'vl-item-ativo' : undefined}
        aria-setsize={itens.length}
        aria-posinset={i + 1}
        style={{ position: 'absolute', top: i * alturaItem, left: 0, right: 0, height: alturaItem }}
        onMouseDown={() => setAtivo(i)}
      >
        {renderItem(item, i, i === ativo)}
      </div>
    );
  }

  return (
    <div
      ref={ref}
      role="listbox"
      aria-label={ariaLabel}
      aria-multiselectable={marcado ? true : undefined}
      aria-activedescendant={ativo >= 0 ? `${prefixo}-item-${ativo}` : undefined}
      tabIndex={0}
      onScroll={onScroll}
      onKeyDown={onKeyDown}
      onFocus={() => { if (ativo < 0 && itens.length) setAtivo(0); }}
      className={['vl-lista', className].filter(Boolean).join(' ')}
      style={{ overflowY: 'auto', position: 'relative', ...style }}
    >
      <div style={{ height: itens.length * alturaItem, position: 'relative' }}>{visiveis}</div>
    </div>
  );
}
