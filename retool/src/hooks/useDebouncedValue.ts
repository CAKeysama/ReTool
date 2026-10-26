import { useEffect, useState } from 'react';

/** Devolve `valor` somente depois de `ms` sem novas alterações. */
export function useDebouncedValue<T>(valor: T, ms: number): T {
  const [atrasado, setAtrasado] = useState(valor);

  useEffect(() => {
    if (ms <= 0) {
      setAtrasado(valor);
      return;
    }
    const t = setTimeout(() => setAtrasado(valor), ms);
    return () => clearTimeout(t);
  }, [valor, ms]);

  return ms <= 0 ? valor : atrasado;
}
