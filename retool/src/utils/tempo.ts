/**
 * Utilitários de tempo para operações assíncronas.
 */

/** Erro lançado por `comTimeout` quando o prazo se esgota (code = 'timeout'). */
export class ErroTimeout extends Error {
  readonly code = 'timeout';
  constructor(mensagem = 'A operação demorou mais que o esperado.') {
    super(mensagem);
    this.name = 'ErroTimeout';
  }
}

/**
 * Rejeita com `ErroTimeout` (code 'timeout') se a promise não concluir em `ms`.
 * Não cancela a operação original — apenas deixa de esperá-la.
 */
export function comTimeout<T>(p: Promise<T>, ms: number, mensagem?: string): Promise<T> {
  if (!Number.isFinite(ms) || ms <= 0) return p;
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new ErroTimeout(mensagem)), ms);
    p.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); }
    );
  });
}

/** Prazo para gravações feitas por um clique (salvar, enviar, aprovar). */
export const PRAZO_GRAVACAO_MS = 15_000;

/**
 * Mensagem para quando a gravação não teve resposta no prazo. O Firestore
 * mantém a gravação pendente e a envia quando a conexão volta (com a aba
 * aberta), por isso não dizemos que falhou: pedimos para conferir.
 */
export const MENSAGEM_GRAVACAO_SEM_RESPOSTA =
  'Sem resposta do servidor. Verifique a conexão: a gravação pode ser concluída quando ela voltar. Confira antes de tentar de novo.';

/** `comTimeout` com o prazo e a mensagem padrão das gravações. */
export const gravarComPrazo = <T>(p: Promise<T>) => comTimeout(p, PRAZO_GRAVACAO_MS, MENSAGEM_GRAVACAO_SEM_RESPOSTA);
