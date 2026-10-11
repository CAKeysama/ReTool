import type { ContextoProcessamento, ProgressoPlanilha, ResultadoProcessamento } from './planilhaDispositivos';
import type { MensagemWorkerPlanilha, PedidoProcessamentoPlanilha } from './processamentoPlanilha';

/**
 * Cliente do Worker de importação (usado pelo ImportModal). Este módulo usa
 * `import.meta.url` (sintaxe do Vite para empacotar o Worker), por isso NÃO
 * é importado pelos testes Jest — a lógica testável está em
 * `processamentoPlanilha.ts` e `planilhaDispositivos.ts`.
 */
export interface TarefaPlanilha {
  resultado: Promise<ResultadoProcessamento & { duracaoMs: number; noWorker: boolean }>;
  /** Interrompe o processamento (encerra o Worker). A promessa rejeita com `ProcessamentoCancelado`. */
  cancelar: () => void;
}

export class ProcessamentoCancelado extends Error {
  constructor() {
    super('Processamento da planilha cancelado.');
    this.name = 'ProcessamentoCancelado';
  }
}

export function processarPlanilhaNoWorker(
  conteudo: ArrayBuffer,
  nomeArquivo: string,
  ctx: ContextoProcessamento,
  onProgresso: (p: ProgressoPlanilha) => void,
  /** Relê o arquivo: o ArrayBuffer é transferido ao Worker; se ele falhar ao iniciar, o fallback precisa de uma cópia nova. */
  reler?: () => Promise<ArrayBuffer>
): TarefaPlanilha {
  let cancelar: () => void = () => {};

  const resultado = new Promise<ResultadoProcessamento & { duracaoMs: number; noWorker: boolean }>((resolve, reject) => {
    let encerrado = false;

    const semWorker = async (conteudoFallback: ArrayBuffer = conteudo) => {
      // Fallback: navegador sem Worker. Carrega o parser (e a `xlsx`) sob
      // demanda e processa na thread principal; a tela fica ocupada durante o
      // processamento, mas o resultado é o mesmo.
      cancelar = () => { encerrado = true; reject(new ProcessamentoCancelado()); };
      const { executarProcessamentoPlanilha } = await import('./processamentoPlanilha');
      // Deixa a UI pintar o estado "processando" antes de ocupar a thread.
      await new Promise(r => setTimeout(r, 50));
      if (encerrado) return;
      const inicio = performance.now();
      try {
        const r = executarProcessamentoPlanilha(conteudoFallback, nomeArquivo, ctx, onProgresso);
        if (!encerrado) resolve({ ...r, duracaoMs: performance.now() - inicio, noWorker: false });
      } catch (err) {
        if (!encerrado) reject(err);
      }
    };

    if (typeof Worker === 'undefined') { void semWorker(); return; }

    let worker: Worker;
    try {
      worker = new Worker(new URL('./planilhaDispositivos.worker.ts', import.meta.url), { type: 'module' });
    } catch {
      void semWorker();
      return;
    }

    let recebeuMensagem = false;
    const finalizar = () => { encerrado = true; worker.terminate(); };
    cancelar = () => {
      if (encerrado) return;
      finalizar();
      reject(new ProcessamentoCancelado());
    };
    worker.onmessage = (e: MessageEvent<MensagemWorkerPlanilha>) => {
      if (encerrado) return;
      const m = e.data;
      recebeuMensagem = true;
      if (m.tipo === 'progresso') onProgresso(m.progresso);
      else if (m.tipo === 'resultado') { finalizar(); resolve({ ...m.resultado, duracaoMs: m.duracaoMs, noWorker: true }); }
      else { finalizar(); reject(new Error(m.mensagem)); }
    };
    worker.onerror = (e: ErrorEvent) => {
      if (encerrado) return;
      worker.terminate();
      // O Worker nem chegou a rodar (ex.: bloqueado pelo navegador): processa
      // na thread principal com o arquivo relido (o buffer original foi transferido).
      if (!recebeuMensagem && reler) {
        reler().then(c => semWorker(c)).catch(err => { encerrado = true; reject(err); });
        return;
      }
      encerrado = true;
      reject(new Error(e.message || 'Falha no processamento da planilha.'));
    };

    const pedido: PedidoProcessamentoPlanilha = { tipo: 'processar', conteudo, nomeArquivo, ctx };
    // Transfere o ArrayBuffer (sem cópia): o arquivo pode ter dezenas de MB.
    worker.postMessage(pedido, [conteudo]);
  });

  return { resultado, cancelar: () => cancelar() };
}
