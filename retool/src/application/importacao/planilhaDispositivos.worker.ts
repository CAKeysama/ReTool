import { PedidoProcessamentoPlanilha, MensagemWorkerPlanilha, tratarPedidoPlanilha } from './processamentoPlanilha';

/**
 * Web Worker da importação: lê o .xlsx/.csv (biblioteca `xlsx`, que só é
 * carregada aqui) e aplica a regra Código + Dispositivo fora da thread
 * principal, para a tela não travar com planilhas de centenas de milhares de
 * linhas. O cancelamento é feito pelo chamador com `worker.terminate()`.
 */
const escopo = self as unknown as {
  onmessage: ((e: MessageEvent<PedidoProcessamentoPlanilha>) => void) | null;
  postMessage: (m: MensagemWorkerPlanilha) => void;
};

escopo.onmessage = (e) => {
  if (e.data?.tipo !== 'processar') return;
  tratarPedidoPlanilha(e.data, m => escopo.postMessage(m));
};
