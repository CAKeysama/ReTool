import { useState, useCallback } from 'react';

export interface BulkProgress {
  done: number;
  total: number;
}

/**
 * Hook para executar operações em massa com tracking de progresso.
 * Processa os itens em batches para equilibrar velocidade e granularidade do progresso.
 */
export function useBulkProgress(batchSize = 5) {
  const [progress, setProgress] = useState<BulkProgress | null>(null);

  const runWithProgress = useCallback(async <T>(
    items: T[],
    fn: (item: T) => Promise<void>
  ): Promise<void> => {
    const total = items.length;
    let done = 0;
    setProgress({ done: 0, total });

    for (let i = 0; i < total; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      await Promise.all(
        batch.map(item =>
          fn(item).then(() => {
            done++;
            setProgress({ done, total });
          })
        )
      );
    }

    // Garante 100% antes de fechar
    setProgress({ done: total, total });
    // Pequena pausa para o usuário ver 100%
    await new Promise(res => setTimeout(res, 300));
    setProgress(null);
  }, [batchSize]);

  return { progress, runWithProgress };
}
