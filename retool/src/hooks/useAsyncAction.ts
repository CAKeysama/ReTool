import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Resultado de `executar`:
 * - `ok: true` → a promise resolveu (só então é seguro informar sucesso);
 * - `ok: false, ignorado: true` → já havia uma execução em andamento (clique duplo);
 * - `ok: false, erro` → a promise rejeitou (o erro também fica em `erro`).
 */
export interface ResultadoAcao<R> {
  ok: boolean;
  valor?: R;
  erro?: unknown;
  ignorado?: boolean;
}

export interface AsyncAction<A extends unknown[], R> {
  executar: (...args: A) => Promise<ResultadoAcao<R>>;
  emAndamento: boolean;
  erro: unknown;
  limparErro: () => void;
}

/**
 * Envolve uma ação assíncrona com estado de processamento, erro e trava
 * contra execução duplicada (a trava é síncrona, via ref, então dois cliques
 * no mesmo frame não disparam duas gravações).
 */
export function useAsyncAction<A extends unknown[], R>(fn: (...a: A) => Promise<R>): AsyncAction<A, R> {
  const [emAndamento, setEmAndamento] = useState(false);
  const [erro, setErro] = useState<unknown>(null);
  const travaRef = useRef(false);
  const fnRef = useRef(fn);
  const montadoRef = useRef(true);

  useEffect(() => { fnRef.current = fn; }, [fn]);
  useEffect(() => {
    montadoRef.current = true;
    return () => { montadoRef.current = false; };
  }, []);

  const executar = useCallback(async (...args: A): Promise<ResultadoAcao<R>> => {
    if (travaRef.current) return { ok: false, ignorado: true };
    travaRef.current = true;
    setEmAndamento(true);
    setErro(null);
    try {
      const valor = await fnRef.current(...args);
      return { ok: true, valor };
    } catch (e) {
      if (montadoRef.current) setErro(e);
      return { ok: false, erro: e };
    } finally {
      travaRef.current = false;
      if (montadoRef.current) setEmAndamento(false);
    }
  }, []);

  const limparErro = useCallback(() => setErro(null), []);

  return { executar, emAndamento, erro, limparErro };
}
