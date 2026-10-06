/**
 * Métricas de diagnóstico de performance (sem dados sensíveis: só nomes de
 * consulta, quantidades e tempos).
 *
 * - Sempre acumuladas em memória em `window.__retoolPerf` (útil no console).
 * - Impressas no console quando `localStorage.retoolPerf = '1'` ou em dev.
 *
 * Exemplo no console do navegador:
 *   __retoolPerf.resumo()   // documentos lidos e tempo por consulta
 */
export interface RegistroConsulta {
  nome: string;
  documentos: number;
  ms: number;
  quando: number;
  erro?: string;
}

interface PainelPerf {
  consultas: RegistroConsulta[];
  documentosLidos: number;
  resumo: () => Record<string, { vezes: number; documentos: number; msMedio: number; erros: number }>;
}

const MAX_REGISTROS = 500;

function painel(): PainelPerf {
  const g = globalThis as unknown as { __retoolPerf?: PainelPerf };
  if (!g.__retoolPerf) {
    const p: PainelPerf = {
      consultas: [],
      documentosLidos: 0,
      resumo() {
        const r: ReturnType<PainelPerf['resumo']> = {};
        for (const c of p.consultas) {
          const x = (r[c.nome] ||= { vezes: 0, documentos: 0, msMedio: 0, erros: 0 });
          x.msMedio = Math.round((x.msMedio * x.vezes + c.ms) / (x.vezes + 1));
          x.vezes++;
          x.documentos += c.documentos;
          if (c.erro) x.erros++;
        }
        return r;
      },
    };
    g.__retoolPerf = p;
  }
  return g.__retoolPerf;
}

function verboso(): boolean {
  try {
    return globalThis.localStorage?.getItem('retoolPerf') === '1';
  } catch {
    return false;
  }
}

export function registrarConsulta(nome: string, documentos: number, ms: number, erro?: unknown): void {
  const p = painel();
  const registro: RegistroConsulta = {
    nome,
    documentos,
    ms: Math.round(ms),
    quando: Date.now(),
    erro: erro ? String((erro as { code?: string })?.code || erro).slice(0, 80) : undefined,
  };
  p.consultas.push(registro);
  if (p.consultas.length > MAX_REGISTROS) p.consultas.splice(0, p.consultas.length - MAX_REGISTROS);
  if (!nome.startsWith('cpu:')) p.documentosLidos += documentos;
  if (verboso()) {
    console.debug(`[retool/perf] ${nome}: ${documentos} doc(s) em ${registro.ms} ms${registro.erro ? ` (erro: ${registro.erro})` : ''}`);
  }
}

/** Mede uma consulta: registra tempo, documentos (via `contar`) e erros. */
export async function medirConsulta<T>(nome: string, fn: () => Promise<T>, contar: (r: T) => number): Promise<T> {
  const t0 = performance.now();
  try {
    const r = await fn();
    registrarConsulta(nome, contar(r), performance.now() - t0);
    return r;
  } catch (e) {
    registrarConsulta(nome, 0, performance.now() - t0, e);
    throw e;
  }
}

/** Mede um trabalho síncrono de CPU (filtro, preparação de índice). */
export function medirTrabalho<T>(nome: string, fn: () => T, itens: number): T {
  const t0 = performance.now();
  const r = fn();
  const ms = performance.now() - t0;
  if (ms > 16 || verboso()) registrarConsulta(`cpu:${nome}`, itens, ms);
  return r;
}
