import { REUTILIZACAO_STATUS, ReutilizacaoStatus, normalizarStatusReutilizacao } from '../entities/reutilizacao';

/**
 * Consulta de reutilizações no servidor x acervo legado.
 *
 * A tela de Reutilizações só consegue pedir ao Firestore "as pendências da
 * fila" ou "a página 3 do histórico" se TODOS os documentos tiverem `status`
 * canônico (um dos REUTILIZACAO_STATUS) e `dataCriacao` como string ISO: um
 * registro antigo com status 'pendente' (ou sem status) não aparece em
 * `where('status', 'in', [...])`, e um sem `dataCriacao` não aparece em
 * `orderBy('dataCriacao')`. Enquanto houver registros assim, a tela usa o
 * modo legado (coleção inteira, como antes) e a Administração pode
 * normalizá-los uma vez.
 *
 * Este módulo é puro (sem Firebase): decide o modo a partir das contagens e
 * planeja a normalização. Ver PERFORMANCE.md.
 */

export type ModoReutilizacoes = 'servidor' | 'legado';

/** Contagens feitas no servidor (count(), ~1 leitura por 1.000 documentos cada). */
export interface ContagensProntidao {
  /** Documentos da coleção. */
  total: number;
  /** Documentos com `status` em REUTILIZACAO_STATUS. */
  comStatusCanonico: number;
  /** Documentos com `dataCriacao` string não vazia. */
  comDataCriacao: number;
}

/** Modo servidor só quando todos os documentos são alcançáveis pelas consultas. */
export function decidirModoReutilizacoes(c: ContagensProntidao): ModoReutilizacoes {
  return c.comStatusCanonico === c.total && c.comDataCriacao === c.total ? 'servidor' : 'legado';
}

/** Quantos documentos ficam de fora das consultas no servidor (para o aviso). */
export function documentosLegados(c: ContagensProntidao): number {
  return Math.max(c.total - c.comStatusCanonico, c.total - c.comDataCriacao, 0);
}

/** Campos gravados pela normalização num documento. */
export interface AlteracaoNormalizacao {
  status?: ReutilizacaoStatus;
  dataCriacao?: string;
}

export interface PlanoNormalizacao {
  /** Só os documentos que mudam (os demais não são regravados). */
  itens: { id: string; alteracoes: AlteracaoNormalizacao }[];
  /** Documentos lidos. */
  analisados: number;
  comStatusAlterado: number;
  comDataCriacaoAlterada: number;
  /** Datas de criação sem origem confiável (usado o momento da normalização). */
  comDataCriacaoAtual: number;
}

const ISO_DIA = /^\d{4}-\d{2}-\d{2}$/;

/** Converte Timestamp do Firestore ({ toDate }) ou string/número de data em ISO; null se não der. */
function paraIso(valor: unknown): string | null {
  if (valor && typeof valor === 'object' && typeof (valor as { toDate?: unknown }).toDate === 'function') {
    try {
      const d = (valor as { toDate: () => Date }).toDate();
      return Number.isNaN(d.getTime()) ? null : d.toISOString();
    } catch {
      return null;
    }
  }
  if (typeof valor === 'string' && valor.trim()) {
    const s = valor.trim();
    // Só o dia (campo `data` do formulário): meio-dia UTC, que continua no
    // mesmo dia no horário de Brasília ao exibir.
    if (ISO_DIA.test(s)) return `${s}T12:00:00.000Z`;
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  if (typeof valor === 'number' && Number.isFinite(valor)) {
    const d = new Date(valor);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  return null;
}

/**
 * `dataCriacao` para um documento que não a tem como string: a própria
 * `dataCriacao` convertida (Timestamp/número), senão o campo `data` do
 * registro (dia informado no cadastro), senão o momento da normalização.
 */
export function derivarDataCriacao(doc: Record<string, unknown>, agora: Date): { valor: string; atual: boolean } {
  const derivada = paraIso(doc.dataCriacao) ?? paraIso(doc.data);
  return derivada ? { valor: derivada, atual: false } : { valor: agora.toISOString(), atual: true };
}

/**
 * Planeja a normalização: status canônico (via normalizarStatusReutilizacao,
 * a mesma regra que a tela já usava na exibição) e `dataCriacao` quando
 * faltar ou não for string. Documentos já canônicos ficam fora do plano.
 */
export function planejarNormalizacaoReutilizacoes(
  docs: { id: string; dados: Record<string, unknown> }[],
  agora: Date = new Date()
): PlanoNormalizacao {
  const plano: PlanoNormalizacao = { itens: [], analisados: docs.length, comStatusAlterado: 0, comDataCriacaoAlterada: 0, comDataCriacaoAtual: 0 };
  for (const { id, dados } of docs) {
    const alteracoes: AlteracaoNormalizacao = {};
    const status = dados.status;
    if (typeof status !== 'string' || !(REUTILIZACAO_STATUS as string[]).includes(status)) {
      alteracoes.status = normalizarStatusReutilizacao(typeof status === 'string' ? status : undefined);
      plano.comStatusAlterado++;
    }
    const dc = dados.dataCriacao;
    if (typeof dc !== 'string' || dc.trim() === '') {
      const { valor, atual } = derivarDataCriacao(dados, agora);
      alteracoes.dataCriacao = valor;
      plano.comDataCriacaoAlterada++;
      if (atual) plano.comDataCriacaoAtual++;
    }
    if (alteracoes.status || alteracoes.dataCriacao) plano.itens.push({ id, alteracoes });
  }
  return plano;
}

/** Divide em lotes (writeBatch aceita até 500 operações). */
export function emLotes<T>(itens: T[], tamanho = 500): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < itens.length; i += tamanho) out.push(itens.slice(i, i + tamanho));
  return out;
}
