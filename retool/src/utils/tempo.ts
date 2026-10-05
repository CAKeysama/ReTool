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
