import {
  ContextoProcessamento,
  OuvinteProgressoPlanilha,
  ResultadoProcessamento,
  lerPlanilha,
  processarPlanilhaDispositivos,
} from './planilhaDispositivos';

/**
 * Protocolo de mensagens entre o modal de importação e o Web Worker que lê e
 * processa a planilha. Fica num módulo sem `import.meta` (testável no Jest).
 */
export interface PedidoProcessamentoPlanilha {
  tipo: 'processar';
  conteudo: ArrayBuffer;
  nomeArquivo: string;
  ctx: ContextoProcessamento;
}

export type MensagemWorkerPlanilha =
  | { tipo: 'progresso'; progresso: Parameters<OuvinteProgressoPlanilha>[0] }
  | { tipo: 'resultado'; resultado: ResultadoProcessamento; duracaoMs: number }
  | { tipo: 'erro'; mensagem: string };

/**
 * Lê e processa a planilha (regra Código + Dispositivo), avisando o progresso.
 * Executado dentro do Worker ou, se o navegador não tiver Worker, na thread
 * principal (fallback).
 */
export function executarProcessamentoPlanilha(
  conteudo: ArrayBuffer | Uint8Array,
  nomeArquivo: string,
  ctx: ContextoProcessamento,
  onProgresso?: OuvinteProgressoPlanilha
): ResultadoProcessamento {
  const abas = lerPlanilha(conteudo, nomeArquivo, onProgresso);
  return processarPlanilhaDispositivos(abas, ctx, onProgresso);
}

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

/** Trata um pedido recebido pelo Worker, enviando progresso e o resultado por `responder`. */
export function tratarPedidoPlanilha(
  pedido: PedidoProcessamentoPlanilha,
  responder: (m: MensagemWorkerPlanilha) => void,
  agora: () => number = () => Date.now()
): void {
  const inicio = agora();
  try {
    const resultado = executarProcessamentoPlanilha(
      pedido.conteudo, pedido.nomeArquivo, pedido.ctx,
      progresso => responder({ tipo: 'progresso', progresso })
    );
    responder({ tipo: 'resultado', resultado, duracaoMs: agora() - inicio });
  } catch (err) {
    responder({ tipo: 'erro', mensagem: err instanceof Error ? err.message : String(err) });
  }
}
