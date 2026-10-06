import type { ContextoProcessamento } from './planilhaDispositivos';

// Fica fora de processamentoPlanilha.ts para o ImportModal não puxar a
// biblioteca xlsx para a thread principal (ela só é carregada no Worker).
/**
 * Copia só o que o processamento usa (id e nome) — o contexto vai por
 * `postMessage` (structured clone) e não precisa levar o resto das entidades.
 */
export function contextoSerializavel(ctx: ContextoProcessamento): ContextoProcessamento {
  const enxuto = (lista: { id: string; nome?: string }[]) => lista.map(({ id, nome }) => ({ id, nome }));
  return {
    categorias: enxuto(ctx.categorias),
    familias: enxuto(ctx.familias),
    produtos: enxuto(ctx.produtos),
    defaultCategoriaId: ctx.defaultCategoriaId,
  };
}
